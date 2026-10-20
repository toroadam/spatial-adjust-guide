"""Brand cards for the Spatial Adjust videos: the lockup, the title card, the typed chapter card and the chapter strip.

Each function adds its graphics to a Gfx (timeline.Gfx) and its layers, SFX cues, labels and EDL rows to a TL, with every
colour, size and timing from brand.py (video/brand/motion-system.md). Assets are rendered on demand: a function renders the
Gfx again only when one of its assets is not in g.m yet, so a builder that wants one render can call the *_assets helpers
first, then g.render(), then the card functions.

  lockup(g, T, t0, t1, size='open')                     Toro tile + "Spatial Adjust" on the hero wall (size 'end': end card)
  title_card(g, T, t0, t1, 'Dashboard overview', tag=None)   the series word double-clicked, the episode name springs out
  chapter_card(g, T, t0, t1, 'READ THE MAP')            typed caps on the card wall, blue block cursor
  chapter_strip(T, [dict(asset, t_in, t_out), ...])      the frosted glass chapter strip (strip_names(g, names) makes assets)
  card_hold_problems(...)                               the hold rule (1.5 s + 0.3 s per word), checked by every card

Holds are enforced here, not left to verify: a card too short for its words raises ValueError naming the shortfall.
"""
import os
import re
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from brand import REPO, LOCKUP, TYPE, TITLE_CARD, DURATIONS, LAYOUT, SERIES_WORD, CURSOR, css, min_hold  # noqa: E402
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


def lockup(g, T, t0, t1, size='open', wall='hero', cx=None, cy=None, on='dark'):
    """The Spatial Adjust lockup: the tile rises in sharpening from a blur, the wordmark wipes in left to right; both fade
    out over the exit duration at t1. wall: the wall preset behind it, or None to draw over what is there (end card)."""
    G = lockup_geometry(g, size, on, cx, cy)
    ex = DURATIONS['exit']
    if wall: T.wallpaper(wall, t0, t1)
    (tx, ty), (wx, wy) = G['tile_c'], G['word_c']
    T.L.append(dict(type='logo', asset=G['tile'], t0=t0, t1=t1, pos=[[t0, [tx, ty + 18]], [t0 + 0.5, [tx, ty], 'outCubic']],
                    opacity=[[t0, 0.0], [t0 + 0.35, 1.0, 'outCubic'], [t1 - ex, 1.0], [t1, 0.0, 'inCubic']],
                    blur=[[t0, 10.0], [t0 + 0.4, 0.0, 'outCubic']]))
    T.L.append(dict(type='image', asset=G['word'], t0=t0, t1=t1, pos=[wx, wy], wipe=[t0 + 0.25, t0 + 0.75], feather=80,
                    dur_out=ex, **{'in': t0 + 0.25, 'out': t1 - ex}))
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
