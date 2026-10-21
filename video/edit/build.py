"""Build an episode's timeline from its episode.json, one take and the VO render report: the data-driven successor to the
iCentral Double Click script dc_build.py (provenance in video/edit/NOTES.md).

  python3 video/edit/build.py --episode video/episodes/<id>/episode.json --take N --draft
  python3 video/edit/build.py --episode video/episodes/<id>/episode.json --take N --final [--source demo|recreation]
  npm run video -- build --episode ... --take N --draft

Writes <media root>/episodes/<id>/edit/timeline.json (and edl.json beside it) for video/edit/render.py and
video/edit/mix.py. The timeline's outputs are named <id>-take<N> (a draft: <id>-take<N>-DRAFT).

Gates come first, before any media is read (video/approvals.md through lib/approvals.py):
  --draft   needs G3 (style frame) decided.
  --final   needs G3, G4 (end-card URL) and G5 (music licence) decided, the episode at status script-locked or later, and
            video/brand/music.json naming a licensed track (licence reference, SHA-256) whose file is on this machine.
A missing gate exits 3 with "missing approval: G..", naming every gate that is missing.

What it reads, all under the media root (episodes/<id>/):
  capture/raw/take<N>.mp4 (take<N>-recreation.mp4 for a recreation), take<N>-log.json (the cue log, seconds from the
  start flash), take<N>-track.json (cursor rows [t, x, y, a, ripple, focusBox] in take seconds, clicks in cue-log
  seconds); vo/render-report.json and vo/<line>.wav.

How the episode becomes a timeline (dc_build.py, with its hard-coded tables replaced by episode data):
  - Sync: the take's magenta start flash F (first 6 s at 64x36, dc_build.py:25-30); a cue's source time is
    F + log[cue] (dc_build.py:37). The take ends at its 'end' cue, else at its magenta end flash.
  - Open: the Spatial Adjust lockup, then the title card with the episode title (lib/cards.py).
  - Chapters (episode.chapters, in order): a typed chapter card, then a window shot of the take from the chapter's first
    cue minus LEAD (0.55 s, dc_build.py:54-55) to the next chapter's cut, the last ending 0.05 s before the take's end.
    A beat with "cutAfter": s ends its chapter s seconds after that beat's VO line (or its first cue) has finished.
  - Camera: the tilted window plate with cursor-follow push-ins on the director's focus boxes (dc_camplan.dc_plan) and
    the slow drift, from brand.py; the flat, still window of the Double Clicks (dc_build.py:40-42) only when the style
    frame decided at G3 says flat (BRAND camera tilt False).
  - The chapter strip over the chapters, then the end card (draft: URL PENDING APPROVAL while G4 is undecided).
  - VO: every line starts at its own cue, so picture and voice stay in sync: t = shot start + (F + log[line] - shot
    source in). A line spoken before the first chapter's footage goes on the title card, one after the last chapter on
    the end card. Lines closer than 0.15 s, or overlapping, fail the build (dc_build.py:137-140).
  - Music: video/brand/music.json, re-cut on its bar grid to the episode's length (intro, whole bars of the loop, the
    outro under the end card). A draft has no music unless music.json names a file that is present; there is never a
    default track.

Exit codes: 0 written; 1 the build failed (missing media, a hold or VO overlap, a tool); 2 usage or configuration
(episode, music record); 3 a gate is missing.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'video', 'lib'))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, HERE)
import approvals  # noqa: E402   (standard library only, so the gates run before torch or numpy load)
import media_root as MR  # noqa: E402
from brand import BRAND, DURATIONS, LAYOUT  # noqa: E402
from media import MediaRootError, ensure_media_dir  # noqa: E402
import mix as MIX  # noqa: E402   (music record and refusals; standard library at import)

EPISODE_SCHEMA = os.path.join(REPO, 'video', 'lib', 'episode-schema.mjs')
GATES = dict(draft=('G3',), final=('G3', 'G4', 'G5'))
GATE_NAMES = dict(G3='style frame', G4='end-card URL', G5='music licence')
STATUSES = ('draft', 'script-locked', 'captured', 'edited', 'verified', 'approved')

# Edit rules carried over from dc_build.py (seconds)
LEAD = 0.55          # footage before a chapter's first cue (dc_build.py:54)
FIRST_IN = 0.30      # the first footage starts at least this long after the start flash (dc_build.py:55)
END_PAD = 0.05       # the last footage ends this long before the take's end (dc_build.py:55)
TITLE_VO_AT = 0.45   # a line on the title card starts this long after the card (dc_build.py:101)
END_VO_AT = 0.30     # a line on the end card starts this long after the card (dc_build.py:125)
VO_GAP = 0.15        # two VO lines closer than this overlap (dc_build.py:139)
MIN_SHOT = 0.5       # a chapter's footage must be at least this long
CSS_W = 1920         # capture CSS width: the take's pixel width over this is its dsf (2 for a 3840x2160 take)
FPS = 60
UP_NEXT_PREFIX = 'Next on Double Click: '   # endCard.text when endCard.next names an open episode (video/episodes/RUNBOOK.md)
UP_NEXT_TAG = 'Next on'                   # the up-next card's eyebrow, over the series word and the next episode's title
MUSIC_FADE_IN, MUSIC_FADE_OUT, MUSIC_XFADE = 0.4, 0.6, 0.08     # dc_build.py:132, v5 timelines' xfade

EXIT_BUILD, EXIT_CONFIG, EXIT_GATE = 1, 2, 3


class BuildError(Exception):
    def __init__(self, msg, code=EXIT_BUILD):
        super().__init__(msg)
        self.code = code


def warn(msg):
    sys.stderr.write(f'build.py: warning: {msg}\n')


def slug(text):
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')


# ----------------------------------------------------------------------------------------------------------------------
# gates and inputs (standard library only)
# ----------------------------------------------------------------------------------------------------------------------
def approvals_path():
    """video/approvals.md, or $SA_APPROVALS_PATH (tests point it at a fixture table)."""
    return os.environ.get('SA_APPROVALS_PATH') or approvals.APPROVALS_MD


def missing_gates(mode, path=None):
    """[(gate, latest decision)] for every gate the mode needs that has no recorded decision."""
    out = []
    for g in GATES[mode]:
        if not approvals.is_approved(g, path):
            r = approvals.latest(g, path)
            out.append((g, r['decision'] if r else 'no row'))
    return out


def check_gates(mode, episode, path=None):
    missing = missing_gates(mode, path)
    if missing:
        detail = '; '.join(f'{g} ({GATE_NAMES[g]}) is {state}' for g, state in missing)
        raise BuildError(f'missing approval: {", ".join(g for g, _ in missing)}. A {mode} needs '
                         f'{", ".join(GATES[mode])} decided in video/approvals.md ({detail}). Record the decision in the '
                         "gate's row (video/approvals.md, Rules) and build again.", EXIT_GATE)
    if mode == 'final':
        st = episode.get('status')
        if st not in STATUSES or STATUSES.index(st) < STATUSES.index('script-locked'):
            raise BuildError(f'a final needs the episode at status script-locked or later (gate G6 locks the script); '
                             f'{episode.get("id")} is {st!r}', EXIT_GATE)


def load_episode(path):
    try:
        with open(path, encoding='utf-8') as f:
            ep = json.load(f)
    except (OSError, ValueError) as err:
        raise BuildError(f'cannot read episode {path}: {err}', EXIT_CONFIG)
    for k in ('id', 'title', 'source'):
        if not isinstance(ep.get(k), str) or not ep[k]:
            raise BuildError(f'episode {path}: "{k}" is missing', EXIT_CONFIG)
    if not ep.get('chapters'):
        raise BuildError(f'episode {path}: no chapters; the builder cuts one window shot per chapter', EXIT_CONFIG)
    return ep


def validate_episode(path):
    """The episode schema (video/lib/episode-schema.mjs): references, clicks, holds and claims."""
    node = shutil.which('node')
    if not node:
        raise BuildError('node is missing: the episode schema and the graphics need Node 22 or later', EXIT_BUILD)
    r = subprocess.run([node, EPISODE_SCHEMA, path], cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        raise BuildError(f'episode {path} fails the schema:\n{(r.stdout + r.stderr).strip()}', EXIT_CONFIG)


def music_record(mode):
    """(music.json dict, file path) for the mode, or (None, None) for a draft without usable music."""
    if mode == 'final':
        try:
            cfg = MIX.load_music_json()
        except MIX.MusicError as err:
            raise BuildError(f'a final needs a licensed music track: {err}', EXIT_GATE)
        probs = MIX.licence_problems(cfg)
        if probs:
            raise BuildError('a final needs video/brand/music.json to name a licensed track with a licence reference: '
                             + '; '.join(probs), EXIT_GATE)
    else:
        src = os.environ.get('SA_MUSIC_JSON') or MIX.MUSIC_JSON
        if not os.path.exists(src):
            warn(f'no music record ({src}): the draft has no music')
            return None, None
        try:
            cfg = MIX.load_music_json()
        except MIX.MusicError as err:
            raise BuildError(str(err), EXIT_CONFIG)
        tr = cfg.get('track') or {}
        if not tr.get('file') or not tr.get('sha256'):
            warn(f'{cfg["_source"]} names no music file: the draft has no music')
            return None, None
    path = MIX.track_path(cfg)
    if not MIX.music_refusal(path) and not os.path.isfile(path):
        if mode == 'final':
            raise BuildError(f'the licensed music file {path} is not on this machine (video/brand/music.json track.file; '
                             'render or copy it under the media root)', EXIT_BUILD)
        warn(f'music file {path} is missing: the draft has no music')
        return None, None
    try:
        MIX.check_music_file(path, cfg['track']['sha256'])
    except MIX.MusicError as err:
        raise BuildError(str(err), EXIT_BUILD if err.refused else EXIT_CONFIG)
    sec = cfg['track'].get('sections') or {}
    for k in ('intro', 'loop', 'outro', 'outro_min'):
        if k not in sec:
            raise BuildError(f'{cfg["_source"]}: track.sections.{k} is missing (the bar grid build.py cuts the bed on)', EXIT_CONFIG)
    if not cfg['track'].get('bar'):
        raise BuildError(f'{cfg["_source"]}: track.bar (seconds per bar) is missing', EXIT_CONFIG)
    return cfg, path


def music_segments(D, sec, bar, land=None):
    """[[t0, s0], ...] that play the intro, whole bars of the loop (wrapping at its end) and the outro, which starts on a
    bar line and runs to D. land: when the record marks the outro's final chord (sections.final), the number of loop bars
    is chosen so that chord lands nearest to `land` (the end card), as dc_build.py:132 put the track's own ending under the
    end card; otherwise the outro starts as late as outro_min allows. A timeline shorter than the intro, one bar and the
    outro plays the track from the top."""
    intro_end, (l0, l1), (o0, o1), o_min = sec['intro'][1], sec['loop'], sec['outro'], sec['outro_min']
    if D < intro_end + o_min + bar:
        return [[0.0, 0.0]]
    latest = int(math.floor((D - intro_end - o_min) / bar + 1e-9))                 # the outro still gets outro_min
    earliest = max(0, int(math.ceil((D - intro_end - (o1 - o0)) / bar - 1e-9)))    # the outro is long enough to reach D
    nb = latest
    if land is not None and sec.get('final') is not None:
        nb = int(round((land - (sec['final'] - o0) - intro_end) / bar))
    nb = max(earliest, min(latest, nb))
    lb = int(round((l1 - l0) / bar))
    segs = [[0.0, 0.0]]
    t, used, first = intro_end, 0, True
    while used < nb:
        k = min(lb, nb - used)
        if not first:
            segs.append([round(t, 4), round(l0, 4)])
        first = False
        t += k * bar; used += k
    if o1 - o0 < D - t - 1e-6:
        raise BuildError(f'music outro {o0}-{o1} is shorter than the {D - t:.2f} s it must cover', EXIT_CONFIG)
    segs.append([round(t, 4), round(o0, 4)])
    return segs


def take_files(ep, take, source):
    raw = MR.episode_dir(ep['id'], 'capture', 'raw')
    stem = f'take{take}' + ('-recreation' if source == 'recreation' else '')
    files = dict(mp4=os.path.join(raw, f'{stem}.mp4'), log=os.path.join(raw, f'{stem}-log.json'), track=os.path.join(raw, f'{stem}-track.json'))
    for k, p in files.items():
        if not os.path.exists(p):
            raise BuildError(f'take {take} ({source}) is missing its {k}: {p}. Capture it with npm run video -- capture '
                             f'--episode {ep["id"]} --take {take}')
    return files


def vo_report(ep):
    vo_dir = MR.episode_dir(ep['id'], 'vo')
    rp = os.path.join(vo_dir, 'render-report.json')
    if not os.path.exists(rp):
        return vo_dir, {}
    with open(rp, encoding='utf-8') as f:
        rep = json.load(f)
    return vo_dir, {l['line']: l for l in rep.get('lines', [])}


# ----------------------------------------------------------------------------------------------------------------------
# the take (dc_build.py:24-37)
# ----------------------------------------------------------------------------------------------------------------------
def _magenta(path, seconds=None):
    import numpy as np
    from ff import FFMPEG
    cmd = [FFMPEG, '-v', 'error', '-i', path] + (['-t', str(seconds)] if seconds else []) + ['-vf', 'scale=64:36', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    p = subprocess.run(cmd, capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8).reshape(-1, 36, 64, 3).astype(int)
    return ((a[..., 0] > 200) & (a[..., 1] < 80) & (a[..., 2] > 200)).mean((1, 2)) > 0.5


def flash_time(path):
    """The start flash: the first frame in the first 6 s that is mostly magenta (dc_build.py:25-30), in seconds."""
    import numpy as np
    mag = _magenta(path, 6)
    i = int(np.argmax(mag))
    if not len(mag) or not mag[i]:
        raise BuildError(f'no sync flash in the first 6 s of {path}: the director starts every take with a magenta flash')
    return i / FPS


def end_flash_time(path, after):
    """The start of the last magenta run after `after` seconds (the director's end flash), in seconds."""
    mag = _magenta(path)
    idx = [i for i in range(len(mag)) if mag[i] and i / FPS > after and (i == 0 or not mag[i - 1])]
    if not idx:
        raise BuildError(f'no end flash in {path} and no "end" cue in its log: cannot tell where the take ends')
    return idx[-1] / FPS


# ----------------------------------------------------------------------------------------------------------------------
# the build
# ----------------------------------------------------------------------------------------------------------------------
def camera_mode():
    """'tilt' (the window plate tilted, with push-ins) unless the style frame decided at G3 says flat: brand.py, which the
    style frame is rendered from, sets camera tilt False."""
    return 'tilt' if BRAND.get('camera', {}).get('tilt', True) else 'flat'


def up_next_title(ep):
    """The next episode's title when episode.json's endCard names one ("Next on Double Click: <title>"), else None: the
    episode then closes on the end card alone (the series-end line, RUNBOOK.md)."""
    end = ep.get('endCard') or {}
    text = end.get('text') or ''
    if end.get('next') and text.startswith(UP_NEXT_PREFIX) and text[len(UP_NEXT_PREFIX):].strip():
        return text[len(UP_NEXT_PREFIX):].strip()
    return None


def up_next_seconds(next_title):
    """The up-next card's length: BRAND's up_next_card, or longer when its label needs a longer hold (1.5 s + 0.3 s per
    word of "Next on / Double Click / <title>", counted as verify.py counts them)."""
    from brand import TITLE_CARD, SERIES_WORD, min_hold
    un = TITLE_CARD['up_next']
    label = f'{UP_NEXT_TAG} / {SERIES_WORD} / {next_title}'
    return round(max(DURATIONS['up_next_card'], un['pop'] + min_hold(label) + un['out'] + 0.05), 2)


def title_card_seconds(title):
    """The title card's length: BRAND's title_card, or longer when its label needs a longer hold (1.5 s + 0.3 s per word of
    "Double Click / <title>", counted as verify.py counts them: the slash is a word). A title of four words or fewer keeps
    BRAND's length; "Why is this station 0%?" (five) needs 0.33 s more."""
    from brand import TITLE_CARD, SERIES_WORD, min_hold
    return round(max(DURATIONS['title_card'], TITLE_CARD['pop'] + min_hold(f'{SERIES_WORD} / {title}') + TITLE_CARD['out'] + 0.05), 2)


def chapter_plan(ep, LOG, src, F, E, vo_len):
    """Per chapter: dict(id, label, cue, s0, s1). Raises BuildError when a chapter has no cue in the take's log."""
    beats = ep.get('beats', [])
    out = []
    for ch in ep['chapters']:
        cues = [a['id'] for b in beats if b.get('chapter') == ch['id'] for a in b.get('actions', []) if a.get('type') == 'cue']
        logged = [c for c in cues if c in LOG]
        if not logged:
            raise BuildError(f'chapter {ch["id"]} ("{ch["label"]}") has no cue in the take\'s log (its beats\' cues: '
                             f'{cues or "none"}); the builder cuts each chapter on its first cue')
        out.append(dict(id=ch['id'], label=ch['label'], cue=logged[0], s0=src(logged[0]) - LEAD))
    for k, c in enumerate(out):
        if k and c['s0'] <= out[k - 1]['s0']:
            raise BuildError(f'chapter {c["id"]} starts before chapter {out[k - 1]["id"]} in the take: chapters must be in take order')
    out[0]['s0'] = max(out[0]['s0'], F + FIRST_IN)
    for k, c in enumerate(out):
        c['s1'] = out[k + 1]['s0'] if k + 1 < len(out) else E - END_PAD
        for b in beats:
            if b.get('chapter') != c['id'] or b.get('cutAfter') is None: continue
            vo = b.get('vo')
            cue = vo if vo in LOG else next((a['id'] for a in b.get('actions', []) if a.get('type') == 'cue' and a['id'] in LOG), None)
            if cue is None:
                raise BuildError(f'beat {b["id"]} has cutAfter but no cue in the take\'s log to measure it from')
            c['s1'] = min(c['s1'], src(cue) + (vo_len.get(vo, 0.0) if vo else 0.0) + float(b['cutAfter']))
        c['s0'], c['s1'] = round(c['s0'], 4), round(c['s1'], 4)
        if c['s1'] - c['s0'] < MIN_SHOT:
            raise BuildError(f'chapter {c["id"]} has {c["s1"] - c["s0"]:.2f} s of footage ({c["s0"]:.2f}-{c["s1"]:.2f} s in the take); '
                             f'it needs at least {MIN_SHOT} s')
    return out


def place_vo(ep, LOG, src, chapters, shots, t_title, t_end, vo_len):
    """[[line, t], ...] for every VO line with a rendered length, and the lines skipped (no render)."""
    beats = ep.get('beats', [])
    beat_of = {b['vo']: i for i, b in enumerate(beats) if b.get('vo')}
    ch_beats = [i for i, b in enumerate(beats) if b.get('chapter')]
    first_ch, last_ch = (min(ch_beats), max(ch_beats)) if ch_beats else (0, len(beats))
    out, skipped = [], []
    for line in ep.get('vo', []):
        lid = line['id']
        if lid not in vo_len:
            skipped.append(lid); continue
        t = None
        if lid in LOG:
            s = src(lid)
            for c, (t0, _) in zip(chapters, shots):
                if c['s0'] - 1e-6 <= s < c['s1']:
                    t = t0 + (s - c['s0']); break
            if t is None:
                if s < chapters[0]['s0']: t = t_title + TITLE_VO_AT
                elif s >= chapters[-1]['s1'] and beat_of.get(lid, last_ch + 1) > last_ch: t = t_end + END_VO_AT
                else:
                    raise BuildError(f'VO line {lid} starts at {s:.2f} s in the take, in footage no chapter uses '
                                     '(a cutAfter ends its chapter first); move its cue or the cutAfter')
        elif lid in beat_of and beat_of[lid] < first_ch:
            t = t_title + TITLE_VO_AT
        elif lid in beat_of and beat_of[lid] > last_ch:
            t = t_end + END_VO_AT
        else:
            raise BuildError(f'VO line {lid} has no cue in the take\'s log: a line spoken over footage starts at its own cue '
                             f'(a cue action with id "{lid}" in its beat)')
        out.append([lid, round(t, 3)])
    return out, skipped


def vo_overlaps(vo, vo_len):
    """dc_build.py:137-140, as a list of (line a, line b, seconds a runs into b's 0.15 s gap)."""
    vv = sorted((t0, t0 + vo_len[n], n) for n, t0 in vo)
    return [(a[2], b[2], round(a[1] - b[0] + VO_GAP, 2)) for a, b in zip(vv, vv[1:]) if a[1] > b[0] - VO_GAP]


def build(episode_path, take, mode='draft', source=None, camera=None, validate=True):
    """Build the timeline; returns (timeline path, timeline dict). Raises BuildError."""
    ep = load_episode(episode_path)
    ap = approvals_path()
    if ap != approvals.APPROVALS_MD:
        warn(f'reading gates from {ap} ($SA_APPROVALS_PATH), not video/approvals.md')
    check_gates(mode, ep, ap)
    cfg, music_file = music_record(mode)
    if validate:
        validate_episode(episode_path)
    source = source or ep['source']
    if source not in ('demo', 'recreation'):
        raise BuildError(f'--source must be demo or recreation, got {source!r}', EXIT_CONFIG)
    try:
        files = take_files(ep, take, source)
        vo_dir, report = vo_report(ep)
        edit_dir = ensure_media_dir(MR.episode_dir(ep['id'], 'edit'), 'edit folder')
    except MediaRootError as err:
        raise BuildError(str(err), EXIT_CONFIG)

    vo_len = {}
    for line in ep.get('vo', []):
        r = report.get(line['id'])
        why = None
        if r is None: why = 'is not in vo/render-report.json'
        elif not os.path.exists(os.path.join(vo_dir, f'{line["id"]}.wav')): why = f'has no {line["id"]}.wav in {vo_dir}'
        elif r.get('text') is not None and r['text'] != line['text']: why = 'was rendered from different text (the report\'s text is stale)'
        if why:
            if mode == 'final':
                raise BuildError(f'VO line {line["id"]} {why}: render it with npm run video -- vo --episode {episode_path}')
            warn(f'VO line {line["id"]} {why}; the draft leaves it out')
            continue
        vo_len[line['id']] = float(r['seconds'])

    try:
        import numpy  # noqa: F401
        import ff
        import cards
        from dc_camplan import FLAT, dc_plan
        from timeline import Gfx, TL
    except (ImportError, RuntimeError) as err:
        raise BuildError(f'{err}: run with the pipeline Python ($SA_VIDEO_PYTHON, the venv at the media root; see video/README.md)')

    # ---- the take: sync flash, cue log, cursor track ------------------------------------------------------------------
    F = flash_time(files['mp4'])
    with open(files['log'], encoding='utf-8') as f:
        LOG = {c['id']: float(c['t']) for c in json.load(f)}
    with open(files['track'], encoding='utf-8') as f:
        TRK = json.load(f)
    src = lambda cue: F + LOG[cue]                                       # cue -> take seconds (dc_build.py:37)
    E = src('end') if 'end' in LOG else end_flash_time(files['mp4'], F + 0.5)
    frames = TRK.get('frames') or []
    clicks = [F + float(c) for c in TRK.get('clicks', [])]               # clicks are in cue-log seconds
    info = ff.probe(files['mp4'])
    if not info.get('w'):
        raise BuildError(f'cannot read the take {files["mp4"]}')
    dsf = info['w'] / CSS_W
    chapters = chapter_plan(ep, LOG, src, F, E, vo_len)

    # ---- graphics: one render pass for every card ---------------------------------------------------------------------
    cam = camera or camera_mode()
    name = f'{ep["id"]}-take{take}' + ('-DRAFT' if mode == 'draft' else '')
    g = Gfx(name, '16x9', episode=ep['id'])
    T = TL(name, '16x9', g)
    end_cfg = cards.end_card_config(draft=mode == 'draft', approvals_path=ap)
    sub_id = 'title_' + slug(ep['title'])
    cards.lockup_assets(g, 'open')
    cards.title_assets(g, sub_id, ep['title'])
    ch_aid = {c['id']: 'ch_' + slug(c['label']) for c in chapters}
    for c in chapters:
        g.typed(ch_aid[c['id']], c['label'], caps=True)
    strip = cards.strip_names(g, [c['label'] for c in chapters])
    nxt = up_next_title(ep)
    nxt_id = 'next_' + slug(nxt) if nxt else None
    if nxt:
        cards.title_assets(g, nxt_id, nxt, tag=UP_NEXT_TAG)
    cards.end_assets(g, end_cfg)
    g.render()

    try:
        t = 0.0
        cards.lockup(g, T, t, t + DURATIONS['lockup']); t = round(t + DURATIONS['lockup'], 3)
        t_title = t
        title_len = title_card_seconds(ep['title'])
        cards.title_card(g, T, t, round(t + title_len, 3), ep['title'], sub_id=sub_id); t = round(t + title_len, 3)
        ww = LAYOUT['window_wide']
        wide_over = dict(s=ww['s'], pos=list(ww['pos']))
        macro_over, drift = None, (1.0, 0.5, 7.0)
        if cam == 'flat':
            wide_over.update(FLAT); macro_over, drift = dict(FLAT), None
        shots, segs = [], []
        for k, c in enumerate(chapters):
            t_in = t
            t = cards.chapter_card(g, T, t, None, c['label'], aid=ch_aid[c['id']])
            s0, s1 = round(c['s0'], 4), round(c['s1'], 4)
            t1 = round(t + (s1 - s0), 3)
            trk = [f for f in frames if f[1] is not None and s0 - 1 <= f[0] <= s1 + 1]
            if len(trk) < 2:
                trk = [[s0, CSS_W / 2, 540, 1, 0, None], [s1, CSS_W / 2, 540, 1, 0, None]]
            cl = [x for x in clicks if s0 <= x <= s1]
            T.window_shot(f'{ep["id"]}-{k + 1}', str(take), files['mp4'], t, t1, s0, s0 + (t1 - t), clicks=cl, track=trk, Z=1.7, dsf=dsf,
                          lead=0.8, hold=0.9, merge=2.4, wide_over=wide_over, macro_over=macro_over, drift=drift, planner=dc_plan,
                          effect=f'chapter {k + 1}: {c["label"]} ({cam} window, cursor-follow push-ins)')
            shots.append((t, t1))
            t = t1
            segs.append(dict(asset=strip[k], t_in=t_in, t_out=t))
        cards.chapter_strip(T, segs)
        t_end = t
        if nxt:                                     # "Next on Double Click: <next title>" (RUNBOOK.md, template Close)
            t1 = round(t + up_next_seconds(nxt), 3)
            cards.title_card(g, T, t, t1, nxt, tag=UP_NEXT_TAG, sub_id=nxt_id)
            t = t1
        t_card = t
        end = cards.end_card(g, T, t, None, draft=mode == 'draft', approvals_path=ap)
        D = round(t + DURATIONS['end_card'], 3)
    except cards.EndCardError as err:
        raise BuildError(str(err), EXIT_GATE)
    except ValueError as err:                       # a card's hold rule (cards.py names the label and the shortfall)
        raise BuildError(str(err))

    # ---- VO, from the cue log --------------------------------------------------------------------------------------
    vo, skipped = place_vo(ep, LOG, src, chapters, shots, t_title, t_end, vo_len)
    over = vo_overlaps(vo, vo_len)
    if over:
        raise BuildError('VO lines overlap (each needs 0.15 s of air before the next): '
                         + '; '.join(f'{a} runs {s:.2f} s into {b}' for a, b, s in over))
    late = [n for n, t0 in vo if t0 + vo_len[n] > D]
    if late:
        raise BuildError(f'VO lines run past the end of the video ({D} s): {", ".join(late)}')

    # ---- music ---------------------------------------------------------------------------------------------------------
    music = None
    if cfg:
        tr = cfg['track']
        lic = cfg.get('licence') or {}
        music = dict(track=music_file, id=tr['id'], sha256=tr['sha256'], licence=lic or None,
                     licenceRef=lic.get('reference'), bpm=tr.get('bpm'), bar=tr['bar'],
                     segments=music_segments(D, tr['sections'], tr['bar'], land=t_card), fade_in=MUSIC_FADE_IN, fade_out=[round(D - MUSIC_FADE_OUT, 3), D],
                     xfade=MUSIC_XFADE, source=os.path.relpath(cfg['_source'], REPO) if cfg['_source'].startswith(REPO) else cfg['_source'],
                     notes='intro, whole bars of the loop, then the outro, its final chord on the end card')

    d = T.json(D, music, vo)
    gates = {gid: (lambda r: dict(decision=r['decision'], date=r['date'], version=r['version']) if r else None)(approvals.latest(gid, ap))
             for gid in GATES['final']}
    d.update(mode=mode, episode=ep['id'], title=ep['title'], take=take, source=source, vo_dir=vo_dir, camera=cam,
             end_card=dict(draft=end['draft'], url=end['url'], up_next=nxt), gates=gates,
             approvals=os.path.relpath(ap, REPO) if ap.startswith(REPO) else ap,
             chapters=[dict(id=c['id'], label=c['label'], t0=round(s[0], 3), t1=round(s[1], 3), src_in=round(c['s0'], 3), src_out=round(c['s1'], 3))
                       for c, s in zip(chapters, shots)],
             notes=dict(take=files['mp4'], flash=round(F, 4), end=round(E, 4), dsf=dsf, cuts=[[round(c['s0'], 3), round(c['s1'], 3)] for c in chapters],
                        vo_skipped=skipped))
    path = os.path.join(edit_dir, 'timeline.json')
    with open(path, 'w') as f:
        json.dump(d, f)
    with open(os.path.join(edit_dir, 'edl.json'), 'w') as f:
        json.dump(T.edl, f, indent=1)
    return path, d


def main(argv=None):
    ap = argparse.ArgumentParser(description='Build an episode timeline from episode.json, a take and the VO report.')
    ap.add_argument('--episode', required=True, help='video/episodes/<id>/episode.json')
    ap.add_argument('--take', required=True, type=int)
    m = ap.add_mutually_exclusive_group()
    m.add_argument('--draft', action='store_true', help='the default: needs G3')
    m.add_argument('--final', action='store_true', help='needs G3, G4 and G5, a licensed music track and a locked script')
    ap.add_argument('--source', choices=('demo', 'recreation'), help="default: the episode's source")
    a = ap.parse_args(argv)
    mode = 'final' if a.final else 'draft'
    try:
        path, d = build(a.episode, a.take, mode, a.source)
    except BuildError as err:
        sys.stderr.write(f'build.py: {err}\n')
        return err.code
    except MediaRootError as err:
        sys.stderr.write(f'build.py: {err}\n')
        return EXIT_CONFIG
    print(f'{path}  {mode}, {d["duration"]} s, {len(d["layers"])} layers, {len(d["vo"])} VO lines, flash {d["notes"]["flash"]} s, '
          f'camera {d["camera"]}, music {d["music"]["id"] if d["music"] else "none"}')
    print(f'next: render.py --timeline {path}, then mix.py --timeline {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
