"""Brand cards for the Spatial Adjust videos: the lockup, the title card, the typed chapter card and the chapter strip.

Each function adds its graphics to a Gfx (timeline.Gfx) and its layers, SFX cues, labels and EDL rows to a TL, with every
colour, size and timing from brand.py (video/brand/motion-system.md). Assets are rendered on demand: a function renders the
Gfx again only when one of its assets is not in g.m yet, so a builder that wants one render can call the *_assets helpers
first, then g.render(), then the card functions.

  lockup(g, T, t0, t1, size='open')                     Toro tile + "Spatial Adjust" on the hero wall (size 'end': end card)
  title_card(g, T, t0, t1, 'Dashboard overview', tag=None)   the series word double-clicked, the episode name springs out
  chapter_card(g, T, t0, t1, 'READ THE MAP')            typed caps on the card wall, blue block cursor
  chapter_strip(T, [dict(asset, t_in, t_out), ...])      the frosted glass chapter strip (strip_names(g, names) makes assets)
  end_card(g, T, t0, t1=None, cfg=None, draft=False)    lockup, call to action, URL pill and legal line on the hero wall,
                                                        from video/brand/end-card.json; needs gate G4 decided unless draft
  card_hold_problems(...)                               the hold rule (1.5 s + 0.3 s per word), checked by every card

Holds are enforced here, not left to verify: a card too short for its words raises ValueError naming the shortfall.
"""
import html
import json
import os
import re
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import approvals  # noqa: E402
from brand import REPO, LOCKUP, TYPE, TITLE_CARD, END_CARD, DURATIONS, LAYOUT, SERIES_WORD, CURSOR, css, min_hold  # noqa: E402
from theme import THEME, rgba  # noqa: E402
from timeline import RATIOS  # noqa: E402

# Golos UI metrics in em, measured from _ds golos-ui_bold.ttf (the same for 400/500/700): ascent, descent, cap height, and
# the S's left side bearing. They place the wordmark's capitals on the tile's centre and its S at the reference gap.
GOLOS = dict(ascent=0.98, descent=0.22, cap=0.70, s_lsb=0.042)
WORD_PAD = 0.18                     # wordmark asset padding in em, so the j's descender is not clipped
CURSOR_PAD = 12                     # title card cursor asset padding, px


def _file_url(p):
    return Path(os.path.abspath(p)).as_uri()


def _rendered(g, ids):
    """g.m, rendering the Gfx first when any of ids has not been rendered yet."""
    m = getattr(g, 'm', None) or {}
    if any(a not in m for a in ids):
        g.render()
    return g.m


def _words(text):
    return len(re.findall(r"[\w'%-]+", text))


def _ink_rows(g, aid):
    """Rows of the asset PNG that hold ink (alpha > 128), as measured by dc_build.py:82-83."""
    import numpy as np
    from ff import read_png
    a = read_png(os.path.join(g.dir, f'{aid}.png'))
    return np.nonzero((a[..., 3] > 128).any(1))[0]


def card_hold_problems(items):
    """items: [(text, t_readable, t_gone)]. A problem string per text held for less than min_hold(its words)."""
    out = []
    for text, a, b in items:
        need = min_hold(_words(text))
        if b - a + 1e-6 < need:
            out.append(f'"{text}" is readable for {b - a:.2f} s; {_words(text)} words need {need:.2f} s (1.5 s + 0.3 s per word)')
    return out


def _check_hold(items, what):
    probs = card_hold_problems(items)
    if probs:
        raise ValueError(f'{what}: ' + '; '.join(probs))


# ----------------------------------------------------------------------------------------------------------------------
# lockup
# ----------------------------------------------------------------------------------------------------------------------
def lockup_assets(g, size='open', on='dark'):
    """Add the tile and wordmark assets for a lockup size ('open' or 'end'); returns (tile_id, word_id)."""
    H = LOCKUP['tile_open' if size == 'open' else 'tile_end']
    fs = round(H * LOCKUP['font_ratio'], 2)
    pad = int(round(WORD_PAD * fs))
    tile_id, word_id = f'sa_tile_{size}', f'sa_word_{size}_{on}'
    g.add(tile_id, f'<img src="{_file_url(os.path.join(REPO, LOCKUP["tile"]))}" style="height:{H}px;width:{H * LOCKUP["tile_aspect"]:.2f}px;display:block">',
          'line-height:0')
    col = LOCKUP['color_dark_wall'] if on == 'dark' else THEME['text']
    g.add(word_id, LOCKUP['wordmark'], f'font-weight:{LOCKUP["wordmark_weight"]};font-size:{fs}px;letter-spacing:{LOCKUP["wordmark_tracking"]};'
          f'color:{col};line-height:1;white-space:nowrap', words=True, pad=pad)
    return tile_id, word_id


def lockup_geometry(g, size='open', on='dark', cx=None, cy=None):
    """Centres of the tile and wordmark assets for a lockup centred on (cx, cy) by its ink, per the reference geometry."""
    tile_id, word_id = lockup_assets(g, size, on)
    m = _rendered(g, [tile_id, word_id])
    H = LOCKUP['tile_open' if size == 'open' else 'tile_end']
    fs = round(H * LOCKUP['font_ratio'], 2); pad = int(round(WORD_PAD * fs))
    W_, H_ = RATIOS[g.ratio]
    cx = W_ / 2 if cx is None else cx; cy = H_ / 2 if cy is None else cy
    tw, th = m[tile_id]['w'], m[tile_id]['h']
    ww, wh = m[word_id]['w'], m[word_id]['h']
    gap_ink = LOCKUP['gap_ratio'] * H
    word_ink_w = ww - 2 * pad - GOLOS['s_lsb'] * fs
    x0 = cx - (tw + gap_ink + word_ink_w) / 2                 # tile's left edge
    word_left = x0 + tw + gap_ink - GOLOS['s_lsb'] * fs - pad
    baseline = GOLOS['ascent'] + (1 - GOLOS['ascent'] - GOLOS['descent']) / 2       # em from the line box top (line-height 1)
    word_top = cy - pad - (baseline - GOLOS['cap'] / 2) * fs
    return dict(tile=tile_id, word=word_id, tile_c=[x0 + tw / 2, cy], word_c=[word_left + ww / 2, word_top + wh / 2],
                tile_box=[x0, cy - th / 2, x0 + tw, cy + th / 2], tile_h=H)


def lockup(g, T, t0, t1, size='open', wall='hero', cx=None, cy=None, on='dark', fade_out=True):
    """The Spatial Adjust lockup: the tile rises in sharpening from a blur, the wordmark wipes in left to right; both fade
    out over the exit duration at t1 (fade_out=False: they hold to t1, as on the end card, the video's last frame).
    wall: the wall preset behind it, or None to draw over what is there (end card)."""
    G = lockup_geometry(g, size, on, cx, cy)
    ex = DURATIONS['exit']
    if wall: T.wallpaper(wall, t0, t1)
    (tx, ty), (wx, wy) = G['tile_c'], G['word_c']
    fade = [[t1 - ex, 1.0], [t1, 0.0, 'inCubic']] if fade_out else []
    T.L.append(dict(type='logo', asset=G['tile'], t0=t0, t1=t1, pos=[[t0, [tx, ty + 18]], [t0 + 0.5, [tx, ty], 'outCubic']],
                    opacity=[[t0, 0.0], [t0 + 0.35, 1.0, 'outCubic']] + fade,
                    blur=[[t0, 10.0], [t0 + 0.4, 0.0, 'outCubic']]))
    T.L.append(dict(type='image', asset=G['word'], t0=t0, t1=t1, pos=[wx, wy], wipe=[t0 + 0.25, t0 + 0.75], feather=80,
                    dur_out=ex, **{'in': t0 + 0.25, 'out': t1 - ex if fade_out else t1 + 5}))
    T.edl.append(dict(t0=t0, t1=t1, shot='(lockup)', take='—', file='(post graphic)', effect=f'Spatial Adjust lockup ({size})',
                      label=LOCKUP['wordmark']))
    return G


# ----------------------------------------------------------------------------------------------------------------------
# title card (the dctitle layer)
# ----------------------------------------------------------------------------------------------------------------------
def title_assets(g, sub_id, episode_title, tag=None):
    """Add the series word, the episode name (sub_id), the optional tag and the cursor; returns the asset ids."""
    g.add('sa_series', SERIES_WORD, css('series'), words=True, pad=4)
    g.add(sub_id, episode_title, css('title'), pad=4)
    tag_id = None
    if tag:
        tag_id = 'tag_' + re.sub(r'[^a-z0-9]+', '_', tag.lower()).strip('_')
        g.add(tag_id, tag, css('chapter_label'), pad=2)
    k = CURSOR['title_scale']; vw, vh = CURSOR['view_box']
    g.add('sa_cursor', f'<svg viewBox="0 0 {vw} {vh}" style="width:{vw * k:.1f}px;height:{vh * k:.1f}px;display:block;overflow:visible;'
          f'filter:drop-shadow(0 3px 4px {rgba("gray100", 0.45)})"><path d="M1 1 L1 16 L4.6 12.6 L7.2 18.6 L9.6 17.6 L7 11.8 L12 11.8 Z" '
          f'fill="{CURSOR["fill"]}" stroke="{CURSOR["stroke"]}" stroke-width="0.8" stroke-linejoin="round"/></svg>', 'line-height:0', pad=CURSOR_PAD)
    return ['sa_series', sub_id, 'sa_cursor'] + ([tag_id] if tag_id else [])


def title_card(g, T, t0, t1, episode_title, tag=None, sub_id=None, **timing):
    """Series title moment on the card wall (dc_build.py:78-91). timing: t_in, t_move, click, pop, leave, out in seconds from
    t0; defaults are BRAND title_card (its up_next set when tag is given). Raises ValueError when a hold is too short."""
    tc = dict(TITLE_CARD['up_next'] if tag else {k: v for k, v in TITLE_CARD.items() if k not in ('up_next', 'drop')})
    unknown = set(timing) - set(tc)
    if unknown: raise TypeError(f'title_card: unknown timing {sorted(unknown)}')
    tc.update(timing)
    sub_id = sub_id or 'title_' + re.sub(r'[^a-z0-9]+', '_', episode_title.lower()).strip('_')
    ids = title_assets(g, sub_id, episode_title, tag)
    m = _rendered(g, ids)
    tag_id = ids[3] if tag else None
    a = lambda d: round(t0 + d, 3)
    gap = DURATIONS['double_click_gap']
    t_out = a(t1 - t0 - tc['out'])
    text = (f'{tag} / ' if tag else '') + f'{SERIES_WORD} / {episode_title}'
    _check_hold([(SERIES_WORD, a(tc['t_in']) + DURATIONS['enter'], t_out), (episode_title, a(tc['pop']), t_out)], f'title card "{text}"')
    if not (tc['t_in'] < tc['t_move'] < tc['click'] - 0.16 < tc['click'] + gap < tc['pop'] < t1 - t0 - tc['out']):
        raise ValueError(f'title card "{text}": timing must run t_in < t_move < click < pop < end - out, got {tc}')
    T.wallpaper('card', t0, t1, z0=1.12, pan=50)
    wm = m['sa_series']; last = wm['words'][-1]
    base = _ink_rows(g, 'sa_series')[-1] / wm['h']; cap = _ink_rows(g, sub_id)[0] / m[sub_id]['h']   # measured: word baseline, sub cap top
    k = CURSOR['title_scale']
    T.L.append(dict(type='dctitle', t0=t0, t1=t1, word='sa_series', sub=sub_id, tag=tag_id, cursor='sa_cursor', cur_scale=0.5,
                    baseline=round(float(base), 4), cap_top=round(float(cap), 4), drop=TITLE_CARD['drop'],
                    hot=[CURSOR_PAD + k, CURSOR_PAD + k], target=[(last['x'] + last['w'] * 0.45) / wm['w'], 0.60],
                    enter=[T.W + 90, T.H + 70], exit=[T.W + 140, T.H * 0.8],
                    t_in=a(tc['t_in']), t_move=a(tc['t_move']), clicks=[a(tc['click']), a(tc['click'] + gap)], t_pop=a(tc['pop']),
                    t_exit=a(tc['leave']), t_out=t_out))
    T.sfx += [[a(0), 'hit_soft'], [a(tc['click']), 'click'], [a(tc['click'] + gap), 'click'], [a(tc['pop']), 'tick_soft']]
    T.labels.append(dict(text=text, tin=a(tc['pop']), tout=t_out, kind='card'))
    T.edl.append(dict(t0=t0, t1=t1, shot='(title)', take='—', file='(post graphic)', effect='double-click title card', label=text))
    return T.L[-1]


# ----------------------------------------------------------------------------------------------------------------------
# chapter card and chapter strip
# ----------------------------------------------------------------------------------------------------------------------
def chapter_card_min(g, ids, label, cps=None):
    """Shortest chapter card for these typed lines: TL.card's typing time, the label's hold, its 0.2 s exit; at least 1.7 s."""
    cps = cps or DURATIONS['type_cps']
    typing = 0.06 + sum(len(g.m[a]['chars']) / cps + 0.04 for a in ids)
    return max(DURATIONS['chapter_card'], typing + min_hold(_words(label)) + 0.2)


def chapter_card(g, T, t0, t1, label, aid=None, cps=None):
    """A typed chapter card in caps on the card wall (TL.card: one blue block cursor, line by line). t1=None makes it as long
    as the label needs; a t1 too short for the hold rule raises ValueError."""
    cps = cps or DURATIONS['type_cps']
    aid = aid or 'ch_' + re.sub(r'[^a-z0-9]+', '_', label.lower()).strip('_')
    ids = g.typed(aid, label, caps=True)
    _rendered(g, ids)
    need = chapter_card_min(g, ids, label, cps)
    if t1 is None: t1 = round(t0 + need, 3)
    if t1 - t0 + 1e-6 < need:
        raise ValueError(f'chapter card "{label}": {t1 - t0:.2f} s is too short; typing it and holding {_words(label)} words '
                         f'needs {need:.2f} s (1.5 s + 0.3 s per word)')
    T.card(t0, t1, ids, 'label', label, cps=cps)
    return t1


def strip_names(g, names, prefix='gl'):
    """Add one chapter-strip name asset per chapter; returns their ids."""
    return [g.add(f'{prefix}{i}', n, css('strip'), pad=2) for i, n in enumerate(names)]


def chapter_strip(T, segments):
    """The glass chapter strip over segments [{asset, t_in, t_out}] (dc_build.py:118-121), box and look from BRAND layout:
    fades in over strip_fade at the first chapter, out after the last. Appends the layer to T and returns it."""
    s = LAYOUT['strip']; fade = DURATIONS['strip_fade']
    segs = [dict(asset=x['asset'], t_in=round(x['t_in'], 3), t_out=round(x['t_out'], 3)) for x in segments]
    g0, g1 = segs[0]['t_in'], segs[-1]['t_out']
    L = dict(type='glass', t0=g0, t1=round(g1 + fade + 0.1, 3), box=list(s['box']), r=s['r'], blur=s['blur'], pad=s['pad'], gap=s['gap'],
             segs=segs, opacity=[[g0, 0.0], [g0 + fade, 1.0, 'outCubic'], [g1, 1.0], [g1 + fade, 0.0, 'inCubic']])
    T.L.append(L)
    return L


# ----------------------------------------------------------------------------------------------------------------------
# end card
# ----------------------------------------------------------------------------------------------------------------------
END_CARD_JSON = os.path.join(REPO, 'video', 'brand', 'end-card.json')
END_GATE = 'G4'
PENDING_URL = 'URL PENDING APPROVAL'
END_LAYOUT = LAYOUT['end_card']      # centres of the lockup, call to action and URL pill as fractions of the frame height
END_TIMES = END_CARD                 # (in, dur) per part in seconds from the card's start; readable from in + dur


class EndCardError(ValueError):
    """The end card cannot be drawn as a final: end-card.json is incomplete, or gate G4 has no recorded decision."""


def load_end_card(path=None):
    """video/brand/end-card.json as a dict, checked: approval 'G4', and a url, display, cta and legal line."""
    path = path or END_CARD_JSON
    with open(path, encoding='utf-8') as f:
        cfg = json.load(f)
    return check_end_card(cfg, os.path.relpath(path, REPO) if path.startswith(REPO) else path)


def check_end_card(cfg, source='end card config'):
    if cfg.get('approval') != END_GATE:
        raise EndCardError(f'{source}: "approval" must be "{END_GATE}" (the end-card URL gate in video/approvals.md), '
                           f'got {cfg.get("approval")!r}')
    for k in ('url', 'display', 'cta', 'legal'):
        if not isinstance(cfg.get(k), str) or not cfg[k].strip():
            raise EndCardError(f'{source}: "{k}" must be a non-empty string')
    if not re.match(r'^https://', cfg['url']):
        raise EndCardError(f'{source}: "url" must be an https:// address, got {cfg["url"]!r}')
    bare = re.sub(r'^https://', '', cfg['url']).rstrip('/')
    if cfg['display'] != bare:
        raise EndCardError(f'{source}: "display" must be the url without https:// and the trailing slash ({bare!r}), '
                           f'got {cfg["display"]!r}')
    return cfg


def end_card_config(cfg=None, draft=False, approvals_path=None):
    """The end card's text: cfg (default end-card.json) when gate G4 is decided; in draft mode with G4 undecided, the same
    with the URL slot replaced by PENDING_URL. Raises EndCardError when G4 is undecided and draft is False."""
    cfg = check_end_card(dict(cfg)) if cfg is not None else load_end_card()
    if approvals.is_approved(END_GATE, approvals_path):
        return dict(cfg, pending=False)
    if not draft:
        r = approvals.latest(END_GATE, approvals_path)
        raise EndCardError(f'end card: gate {END_GATE} (end-card URL) has no recorded decision in video/approvals.md '
                           f'(latest row: {r["decision"] if r else "none"}); pass draft=True for a style frame or draft render')
    return dict(cfg, display=PENDING_URL, pending=True)


def _url_pill(text, pending):
    """The URL pill: frosted light pill, a blue arrow dot (grey while the URL is pending) and the address."""
    t = TYPE['url']; fs = t['size']
    dot = int(fs * 1.45)
    dot_col = THEME['gray60'] if pending else THEME['highlight']
    return ('<div style="display:flex;align-items:center;gap:%dpx;padding:%dpx %dpx %dpx %dpx;border-radius:999px;'
            'background:%s;border:1.5px solid %s;box-shadow:0 18px 50px %s">'
            % (int(fs * 0.55), int(fs * 0.55), int(fs), int(fs * 0.55), int(fs * 0.6),
               rgba('gray05', 0.10), rgba('gray05', 0.28), rgba('gray100', 0.45)) +
            f'<span style="width:{dot}px;height:{dot}px;border-radius:50%;background:{dot_col};display:flex;align-items:center;'
            f'justify-content:center;flex:none"><svg width="{int(dot * 0.48)}" height="{int(dot * 0.48)}" viewBox="0 0 24 24">'
            f'<path d="M5 12h12M12 6l6 6-6 6" stroke="{THEME["white"]}" stroke-width="2.6" fill="none" stroke-linecap="round" '
            f'stroke-linejoin="round"/></svg></span>'
            f'<span style="font-weight:{t["weight"]};font-size:{fs}px;letter-spacing:{t["tracking"]};color:{THEME[t["color"]]};'
            f'white-space:nowrap">{html.escape(text)}</span></div>')


def end_assets(g, cfg):
    """Add the end card's assets for a cfg from end_card_config; returns their ids (lockup tile and wordmark first)."""
    tile_id, word_id = lockup_assets(g, 'end')
    url_id = 'end_url_pending' if cfg['pending'] else 'end_url'
    g.add('end_cta', html.escape(cfg['cta']), css('cta') + ';white-space:nowrap', words=True, pad=4)
    g.add(url_id, _url_pill(cfg['display'], cfg['pending']), 'line-height:1', pad=40)
    g.add('end_legal', html.escape(cfg['legal']), css('legal') + ';white-space:nowrap', words=True, pad=2)
    return [tile_id, word_id, 'end_cta', url_id, 'end_legal']


def end_card(g, T, t0, t1=None, cfg=None, draft=False, approvals_path=None):
    """The end card, the video's last frame (dc_build.py's end card, rebuilt on the brand): the hero wall dimmed, the lockup
    at end size, the call to action, the URL pill and the legal line, all held to t1 with no exit. cfg defaults to
    video/brand/end-card.json. Gate G4 must be decided in video/approvals.md; with draft=True and G4 undecided the URL pill
    reads PENDING_URL. t1=None makes it BRAND's end_card duration. Raises EndCardError (gate, config) or ValueError (a part
    held for less than the hold rule, or wider than title-safe). Returns dict(draft=, url=, parts=)."""
    cfg = end_card_config(cfg, draft, approvals_path)
    t1 = round(t0 + DURATIONS['end_card'], 3) if t1 is None else t1
    ids = end_assets(g, cfg)
    m = _rendered(g, ids)
    _, _, cta_id, url_id, legal_id = ids
    W, H = RATIOS[g.ratio]
    sx0, sy0, sx1, sy1 = LAYOUT['title_safe_box'] if g.ratio == '16x9' else (W * 0.05, H * 0.05, W * 0.95, H * 0.95)
    for aid in (cta_id, legal_id):
        if m[aid]['w'] - 2 * 4 > sx1 - sx0:
            raise ValueError(f'end card: "{m[aid].get("text", aid)}" is {m[aid]["w"]} px wide, wider than title-safe ({sx1 - sx0:.0f} px)')
    if m[url_id]['w'] - 2 * 40 > sx1 - sx0:
        raise ValueError(f'end card: the URL pill for {cfg["display"]!r} is {m[url_id]["w"] - 80} px wide, wider than title-safe '
                         f'({sx1 - sx0:.0f} px); shorten "display" in end-card.json')
    parts = [(cfg['cta'], *END_TIMES['cta']), (cfg['display'], *END_TIMES['url']), (cfg['legal'], *END_TIMES['legal'])]
    _check_hold([(text, t0 + a + d, t1) for text, a, d in parts], 'end card')

    T.L.append(dict(type='wall', file=g.wall('hero'), t0=t0, t1=t1, zoom=[[t0, END_CARD['z0']], [t1, 1.0, 'outCubic']],
                    pan=[[t0, [0, 30]], [t1, [0, 0], 'outCubic']], dim=END_CARD['dim']))
    lockup(g, T, t0, t1, size='end', wall=None, cy=round(H * END_LAYOUT['lockup']), fade_out=False)
    legal_top = sy1 - m[legal_id]['h'] + 2                       # the legal line's ink sits on title-safe's bottom edge
    for aid, y, (tin, dur), anim in ((cta_id, H * END_LAYOUT['cta'] - m[cta_id]['h'] / 2, END_TIMES['cta'], 'rise'),
                                     (url_id, H * END_LAYOUT['url'] - m[url_id]['h'] / 2, END_TIMES['url'], 'fade'),
                                     (legal_id, legal_top, END_TIMES['legal'], 'fade')):
        T.L.append(dict(type='text', asset=aid, t0=t0, t1=t1, pos=[round((W - m[aid]['w']) / 2), round(y)], anim=anim,
                        dy=22 if aid != legal_id else 0, stagger=0.05, dur_in=dur, **{'in': round(t0 + tin, 3), 'out': t1 + 5}))
    for text, a, d in parts:
        T.labels.append(dict(text=text, tin=round(t0 + a + d, 3), tout=t1, kind='endcard'))
    T.sfx.append([round(t0, 3), 'hit_soft'])
    T.edl.append(dict(t0=t0, t1=t1, shot='(end)', take='—', file='(post graphic)',
                      effect='end card: Spatial Adjust lockup, call to action, URL pill, legal line'
                             + (f' (DRAFT: gate {END_GATE} undecided)' if cfg['pending'] else ''),
                      label=f'{cfg["cta"]} / {cfg["display"]}'))
    return dict(draft=cfg['pending'], url=None if cfg['pending'] else cfg['url'], parts=ids)
