"""Join the showcase's 26 shot takes into the one take the builder cuts from.

  $SA_VIDEO_PYTHON video/showcase/assemble-take.py --take 1001            # write the assembled take
  $SA_VIDEO_PYTHON video/showcase/assemble-take.py --take 1001 --dry-run  # print the plan, write nothing
  $SA_VIDEO_PYTHON video/showcase/assemble-take.py --take 1001 --force    # replace an assembled take

The pipeline's builder (video/edit/build.py, used as delivered) cuts every chapter from ONE take: it finds the take's
magenta start flash, places each chapter on the first cue of its beats and each VO line on its own cue. The showcase is
captured as one director take per shot (one guide page and one figure each, see capture-shots.mjs), so this script
lays the accepted shot takes end to end in film order, in a take file the builder reads in the same way as a director
take:

  <media root>/showcase/capture/raw/take<N>-recreation.mp4        3840x2160, 60 fps, H.264: a magenta start flash, then
                                                                  every shot's cut, back to back, then a short tail
  take<N>-recreation-log.json                                     the cue log: shot-<id> and VO line cues, and 'end'
  take<N>-recreation-track.json                                   the cursor and focus-box track, shifted to match
  take<N>-recreation-assembly.json                                where each shot sits in the assembled take

A shot's cut is [cue - 0.55 s, cue - 0.55 s + seconds] of its take (capture-shots.mjs: the pre-roll gives every shot the
builder's 0.55 s lead in front of its cue), so the cue lands 0.55 s into the shot and each chapter's footage is the sum
of its shots' lengths, which is what the beat sheet's timings in episode.json assume. Picture and cursor track move
together frame for frame; no picture is scaled, retimed or re-framed. This is take assembly, not the compositor: the
builder, renderer and mixer run unchanged on the result.

The assembled take is a new raw take number (1001 for cut v1, 1002 for v2, ...) and is never overwritten without
--force. Every file lands under the media root. Needs the pipeline Python ($SA_VIDEO_PYTHON) for numpy.

Exit codes: 0 written (or planned); 1 a shot take is missing or unusable, or ffmpeg failed; 2 usage or configuration.
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'video', 'lib'))
sys.path.insert(0, os.path.join(REPO, 'video', 'edit'))
sys.path.insert(0, os.path.join(REPO, 'video', 'edit', 'lib'))

FPS = 60
LEAD = 0.55                  # the builder's LEAD: a chapter's footage starts this long before its first cue
LEAD_F = round(LEAD * FPS)   # 33 frames
FLASH_F = 18                 # the assembled take's start flash, 0.3 s: the builder's first footage starts F + 0.30 s
TAIL_F = 12                  # frames after the last shot's cut, so the builder's end cue sits inside the file
END_PAD = 0.05               # build.py END_PAD: the last footage ends this long before the 'end' cue
EPISODE = os.path.join(REPO, 'video', 'showcase', 'episode.json')


class AssembleError(Exception):
    pass


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def shots_in_order(ep):
    out = []
    for b in ep['beats']:
        if b.get('chapter'):
            for s in (b.get('capture') or {}).get('shots', []):
                out.append((b, s))
    if not out:
        raise AssembleError('episode.json has no capture shots')
    return out


def plan(ep, raw_dir, flash_time):
    """One dict per shot: take files, flash F, cue time in take seconds, first and length in frames, position P in the
    assembled take (frames)."""
    rows, pos = [], FLASH_F
    for b, s in shots_in_order(ep):
        stem = f'take{s["take"]}-recreation'
        mp4, logp, trkp = (os.path.join(raw_dir, f'{stem}{x}') for x in ('.mp4', '-log.json', '-track.json'))
        for p in (mp4, logp, trkp):
            if not os.path.isfile(p):
                raise AssembleError(f'shot {s["id"]}: {p} is missing; capture it with node video/showcase/capture-shots.mjs run {s["id"]}')
        log = {c['id']: float(c['t']) for c in load(logp)}
        cue = f'shot-{s["id"]}'
        if cue not in log:
            raise AssembleError(f'shot {s["id"]}: no cue {cue!r} in {logp}')
        F = flash_time(mp4)
        start_f = round((F + log[cue]) * FPS) - LEAD_F
        n = round(s['seconds'] * FPS)
        if abs(n / FPS - s['seconds']) > 0.011:
            raise AssembleError(f'shot {s["id"]}: {s["seconds"]} s is not a whole number of frames at {FPS} fps')
        if start_f < 0:
            raise AssembleError(f'shot {s["id"]}: its cue is under {LEAD} s into the take, so the {LEAD} s lead does not fit')
        rows.append(dict(beat=b['id'], shot=s['id'], take=s['take'], mp4=mp4, track=trkp, F=F, log=log, cue=cue, start_f=start_f, n=n, pos_f=pos))
        pos += n
    return rows, pos


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise AssembleError(f'{cmd[0]} failed ({r.returncode}): {r.stderr.strip()[-600:]}')
    return r


def assemble(ep, take, force=False, dry=False):
    import ff
    import build as B
    import media_root as MR
    raw_dir = MR.episode_dir(ep['id'], 'capture', 'raw')
    stem = f'take{take}-recreation'
    out = {k: os.path.join(raw_dir, f'{stem}{x}') for k, x in dict(mp4='.mp4', log='-log.json', track='-track.json', map='-assembly.json').items()}
    rows, total_f = plan(ep, raw_dir, B.flash_time)
    end_f = total_f + TAIL_F
    sec = lambda f: round(f / FPS, 4)
    print(f'assemble-take: {len(rows)} shots, {sec(total_f - FLASH_F)} s of picture, take {take} -> {out["mp4"]}')
    for r in rows:
        print(f'  {r["shot"]:7s} take {r["take"]:3d}  source {sec(r["start_f"]):7.3f}-{sec(r["start_f"] + r["n"]):7.3f} s  ->  assembled {sec(r["pos_f"]):7.3f} s  ({r["n"]} frames)')
    if dry:
        return out
    if any(os.path.exists(p) for p in out.values()) and not force:
        raise AssembleError(f'take {take} is already assembled ({out["mp4"]}); pick the next take number, or use --force to replace it')
    work = os.path.join(MR.episode_dir(ep['id'], 'edit'), '_build', f'assemble-{take}')
    os.makedirs(work, exist_ok=True)
    ff_bin = ff.FFMPEG
    enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', '-g', '30', '-r', str(FPS), '-an', '-video_track_timescale', '15360']
    parts = []
    flash = os.path.join(work, 'flash.mp4')
    run([ff_bin, '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0xFF00FF:s=3840x2160:r={FPS}', '-frames:v', str(FLASH_F), *enc, flash])
    parts.append(flash)
    for i, r in enumerate(rows):
        seg = os.path.join(work, f'seg-{i:02d}-{r["shot"]}.mp4')
        extra = TAIL_F if i == len(rows) - 1 else 0
        run([ff_bin, '-v', 'error', '-y', '-ss', f'{r["start_f"] / FPS:.6f}', '-i', r['mp4'], '-frames:v', str(r['n'] + extra), *enc, seg])
        parts.append(seg)
    lst = os.path.join(work, 'concat.txt')
    with open(lst, 'w') as f:
        f.write(''.join(f"file '{p}'\n" for p in parts))
    tmp = out['mp4'] + '.part.mp4'
    run([ff_bin, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', tmp])
    os.replace(tmp, out['mp4'])
    info = ff.probe(out['mp4'])
    want = end_f / FPS
    if abs(float(info.get('dur') or info.get('duration') or 0) - want) > 0.1:
        print(f'assemble-take: warning: assembled duration {info.get("dur") or info.get("duration")} s, expected {want:.3f} s')

    # the cue log: seconds from the start flash (F = 0), at each shot's cue
    cues, frames, mapping = [], [], []
    for r in rows:
        shift = r['pos_f'] / FPS - r['start_f'] / FPS               # source take seconds -> assembled seconds
        base = r['pos_f'] / FPS + LEAD
        for cid, t in sorted(r['log'].items(), key=lambda kv: kv[1]):
            cues.append(dict(id=cid, t=round(base + (t - r['log'][r['cue']]), 4)))
        trk = load(r['track'])
        t0 = r['start_f'] / FPS
        t1 = t0 + (r['n'] + (TAIL_F if r is rows[-1] else 0)) / FPS
        for fr in trk.get('frames', []):
            if t0 - 1e-6 <= fr[0] < t1 - 1e-6:
                frames.append([round(fr[0] + shift, 4)] + fr[1:])
        mapping.append(dict(shot=r['shot'], beat=r['beat'], take=r['take'], source_in=round(r['start_f'] / FPS, 4), frames=r['n'],
                            assembled_in=round(r['pos_f'] / FPS, 4), cue_at=round(base, 4)))
    cues.append(dict(id='end', t=round(total_f / FPS + END_PAD, 4)))
    frames.sort(key=lambda fr: fr[0])
    with open(out['log'], 'w') as f:
        json.dump(cues, f, indent=1)
    with open(out['track'], 'w') as f:
        json.dump(dict(file=os.path.basename(out['mp4']), fps=FPS, units='CSS px (1920x1080); frame = [t, x, y, a, ripple, focusBox [x0, y0, x1, y1] | null]',
                       assembledFrom='video/showcase/assemble-take.py', frames=frames, clicks=[]), f)
    with open(out['map'], 'w') as f:
        json.dump(dict(take=take, episode=ep['id'], fps=FPS, flashFrames=FLASH_F, tailFrames=TAIL_F, totalFrames=end_f, shots=mapping), f, indent=1)
    print(f'assemble-take: wrote {out["mp4"]} ({sec(end_f)} s), its cue log ({len(cues)} cues) and track ({len(frames)} frames)')
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description='Join the showcase shot takes into one take for the builder.')
    ap.add_argument('--episode', default=EPISODE)
    ap.add_argument('--take', required=True, type=int, help='the assembled take number, 1001 and up (shot takes are 111 to 781)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args(argv)
    if a.take < 1000:
        sys.stderr.write('assemble-take: --take must be 1000 or more; 111 to 781 are shot takes\n')
        return 2
    try:
        ep = load(a.episode)
        assemble(ep, a.take, force=a.force, dry=a.dry_run)
    except AssembleError as err:
        sys.stderr.write(f'assemble-take: {err}\n')
        return 1
    except Exception as err:   # media root refusal, missing numpy
        sys.stderr.write(f'assemble-take: {type(err).__name__}: {err}\n')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
