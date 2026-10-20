"""Tests for lib/brand.py: the motion system's single code source, checked against the design tokens, the app, the engine,
the capture runtime and video/brand/motion-system.md.

  python3 video/edit/tests/test_brand.py

Standard library only (brand.py and theme.py import no torch), so it runs in CI with the system Python.

  - every brand colour with a token equals that token in _ds/.../tokens/figma/fig-tokens.css (red, blue, neutrals, ...)
  - the moisture accents equal the app legend (SpatialAdjustApp.dc.html) with the transform layer's corrected boundaries
  - Golos UI weights are 400/500/700 only: no 600 anywhere
  - min_hold(words) == 1.5 + 0.3 * words, the same rule as the episode schema
  - red appears only as the lockup tile colour and the 0-5 % band; strip_active, highlight and the cursors are blue
  - theme.THEME takes every value from BRAND; glass.py and timeline.py draw the active fill, URL dot and type cursor from it
  - the eases equal the engine's EASE table; the focus box and cursor equal the capture runtime's
  - motion-system.md states every value BRAND holds (and no colour BRAND lacks)
Each drift check is also run on a deliberately drifted copy, to prove it fails.
"""
import copy
import os
import re
import sys
import unittest

TESTS = os.path.dirname(os.path.abspath(__file__))
EDIT = os.path.dirname(TESTS)
LIB = os.path.join(EDIT, 'lib')
VIDEO = os.path.dirname(EDIT)
REPO = os.path.dirname(VIDEO)
sys.path.insert(0, LIB)

import brand  # noqa: E402
from brand import BRAND, COLORS, TOKENS, MOISTURE, TYPE, EASES, LOUDNESS, SFX, DURATIONS, LAYOUT, LOCKUP, min_hold  # noqa: E402

DOC = os.path.join(VIDEO, 'brand', 'motion-system.md')
HEX = re.compile(r'#[0-9A-Fa-f]{6}\b')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


# ----------------------------------------------------------------------------------------------------------------------
# checks: each returns a list of problems (empty when clean)
# ----------------------------------------------------------------------------------------------------------------------
def parse_tokens(css_text):
    """{'--base': '#E11837', ...} for every rgb() colour token in fig-tokens.css."""
    out = {}
    for name, r, g, b in re.findall(r'(--[\w-]+):\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)', css_text):
        out[name] = '#%02X%02X%02X' % (int(r), int(g), int(b))
    return out


def token_drift(colors, tokens, css_text):
    toks = parse_tokens(css_text)
    probs = []
    for key, tok in tokens.items():
        if tok not in toks:
            probs.append(f'{key}: token {tok} not in fig-tokens.css')
        elif colors[key].upper() != toks[tok]:
            probs.append(f'{key}: brand.py {colors[key]} != {tok} {toks[tok]}')
    return probs


def app_bands(html):
    """[(label, colour)] from the moisture legend in SpatialAdjustApp.dc.html (the band('0-5%', '#E11837', ...) calls)."""
    line = next(ln for ln in html.splitlines() if "band('0-5%'" in ln)
    return re.findall(r"band\('([^']+)',\s*'(#[0-9A-Fa-f]{6})'", line)


def moisture_drift(moisture, html, transform_js):
    probs = []
    bands = app_bands(html)
    fixes = dict(re.findall(r"pattern: /(\d+-\d+%)/,\s*replace: '(\d+-\d+%)'", transform_js))
    if len(bands) != len(moisture):
        return [f'{len(moisture)} brand bands, {len(bands)} in the app legend']
    for b, (label, col) in zip(moisture, bands):
        label = fixes.get(label, label)
        if b['label'] != label: probs.append(f'band {b["label"]}: the guides show {label}')
        if b['color'].upper() != col.upper(): probs.append(f'band {b["label"]}: brand.py {b["color"]} != app {col}')
    return probs


def walk(obj, path=()):
    if isinstance(obj, dict):
        for k, v in obj.items(): yield from walk(v, path + (k,))
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj): yield from walk(v, path + (i,))
    else:
        yield path, obj


RED_FAMILY = {COLORS['red'].upper(), COLORS['red_shade'].upper(), COLORS['red_tint'].upper()}
RED_ALLOWED = {('red',), ('red_shade',), ('red_tint',), ('moisture', 0, 'color')}


def red_leaks(brand_dict):
    """Paths where a Toro red value appears outside the colour table and the 0-5 % band."""
    return [p for p, v in walk(brand_dict) if isinstance(v, str) and v.upper() in RED_FAMILY and p not in RED_ALLOWED]


def num(s):
    return float(s.replace('−', '-'))


def row(doc, key):
    """The cells after the key cell of the table row whose first cell is `key` (in backticks), or None."""
    m = re.search(r'^\|\s*`' + re.escape(key) + r'`\s*\|(.*)$', doc, re.M)
    return [c.strip() for c in m.group(1).strip().strip('|').split('|')] if m else None


def section(doc, title, after=None, before=None):
    """The text of section '## N. title', optionally cut after / before a marker inside it."""
    m = re.search(r'^## \d+\. ' + re.escape(title) + r'\n(.*?)(?=^## |\Z)', doc, re.M | re.S)
    text = m.group(1) if m else ''
    if after: text = text.split(after, 1)[-1] if after in text else ''
    if before: text = text.split(before, 1)[0]
    return text


def doc_drift(full):
    probs = []
    bad = lambda what: probs.append(what)
    doc = section(full, 'Palette')
    # palette: one row per colour with its hex and token, and no hex in the doc that BRAND lacks
    for k, v in COLORS.items():
        r = row(doc, k)
        if not r or r[0].upper() != v.upper(): bad(f'palette {k}: doc {r and r[0]} != {v}')
        elif k in TOKENS and TOKENS[k] not in r[1]: bad(f'palette {k}: doc token {r[1]} != {TOKENS[k]}')
    extra = {h.upper() for h in HEX.findall(full)} - {v.upper() for v in COLORS.values()}
    if extra: bad(f'colours in the doc that brand.py lacks: {sorted(extra)}')
    for b in MOISTURE:
        if not re.search(r'^\|\s*' + re.escape(b['label']) + r'\s*\|\s*' + b['color'] + r'\s*\|', doc, re.M | re.I):
            bad(f'moisture band {b["label"]} {b["color"]} missing')
    for k in ('text', 'light', 'secondary', 'muted', 'highlight', 'strip_active', 'type_cursor', 'ripple'):
        r = row(doc, k)
        if not r or r[0].upper() != BRAND[k].upper(): bad(f'role {k}: doc {r and r[0]} != {BRAND[k]}')
    # lockup
    doc = section(full, 'Lockup')
    for k, want in (('font_ratio', LOCKUP['font_ratio']), ('gap_ratio', LOCKUP['gap_ratio']),
                    ('tile_open', LOCKUP['tile_open']), ('tile_end', LOCKUP['tile_end'])):
        r = row(doc, k)
        if not r or num(re.match(r'[-\d.]+', r[0]).group()) != want: bad(f'lockup {k}: doc {r and r[0]} != {want}')
    r = row(doc, 'wordmark')
    if not r or f'Golos UI Bold ({LOCKUP["wordmark_weight"]})' not in r[0] or LOCKUP['wordmark'] not in r[0]: bad('lockup wordmark')
    r = row(doc, 'tile')
    if not r or LOCKUP['tile'] not in r[0]: bad('lockup tile')
    # background
    doc = section(full, 'Background')
    W = BRAND['wall']
    r = row(doc, 'line')
    if not r or f'alpha {W["line_alpha"]}' not in r[0] or f'every {W["index_every"]}th' not in r[0] or f'alpha {W["index_alpha"]}' not in r[0]:
        bad('wall line')
    r = row(doc, 'blooms')
    names = {v: k for k, v in COLORS.items()}
    for preset, blooms in W['blooms'].items():
        want = f'`{preset}` ' + ', '.join(f'{names[c]} {a:.2f}' for c, a in blooms)
        if not r or want not in r[0]: bad(f'wall blooms {preset}: want "{want}"')
    r = row(doc, 'style')
    if not r or W['style'] not in r[0]: bad('wall style')
    # type
    doc = section(full, 'Type')
    for k, t in TYPE.items():
        r = row(doc, k)
        if not r or r[:3] != [f'{t["size"]} px', str(t['weight']), t['tracking']] or r[4] != f'`{t["color"]}`' \
                or (r[3] == 'caps') != t['caps']:
            bad(f'type {k}: doc {r and r[:5]} != {t}')
    if f'"{BRAND["series_word"]}"' not in doc: bad('series word')
    # motion
    doc = section(full, 'Motion', before='**Durations**')
    for k, (name, bz) in EASES.items():
        r = row(doc, k)
        if not r or r[0] != name or r[1] != '(' + ', '.join(f'{x:g}' for x in bz) + ')': bad(f'ease {k}: doc {r and r[:2]}')
    sp = BRAND['spring']
    if f'w = {sp["w"]:g}, z = {sp["z"]:g}' not in doc: bad('title spring')
    doc = section(full, 'Motion', after='**Durations**', before='**Title card**')
    for k, v in DURATIONS.items():
        r = row(doc, k)
        m = r and re.match(r'([\d.]+)(?:-([\d.]+))?', r[0])
        got = m and ((num(m.group(1)), num(m.group(2))) if m.group(2) else num(m.group(1)))
        if got != v: bad(f'duration {k}: doc {r and r[0]} != {v}')
    doc = section(full, 'Motion', after='**Title card**')
    tc = BRAND['title_card']
    for k in ('t_in', 't_move', 'click', 'pop', 'leave', 'out', 'drop'):
        r = row(doc, k)
        got = r and [num(re.match(r'[-\d.]+', c).group()) for c in r[:2]]
        if got != [tc[k], tc['up_next'].get(k, tc[k])]: bad(f'title card {k}: doc {r and r[:2]}')
    doc = section(full, 'Motion', after='**End card**', before='**Camera.**')
    ec = BRAND['end_card']
    for k in ('cta', 'url', 'legal'):
        r = row(doc, k)
        got = r and [num(re.match(r'[-\d.]+', c).group()) for c in r[:2]]
        if got != list(ec[k]): bad(f'end card {k}: doc {r and r[:2]} != {ec[k]}')
    if f'`dim` {ec["dim"]:g}' not in doc or f'`z0` {ec["z0"]:g}' not in doc: bad('end card wall dim and zoom')
    # holds
    doc = section(full, 'Holds')
    if f'**{BRAND["hold"]["base"]:g} s + {BRAND["hold"]["per_word"]:g} s per word**' not in doc: bad('hold rule')
    # layout
    doc = section(full, 'Layout')
    r = row(doc, 'title_safe')
    if not r or not r[0].startswith(f'{LAYOUT["title_safe"]:.2f}') or str(LAYOUT['title_safe_box']) not in r[0]: bad('title safe')
    s = LAYOUT['strip']
    r = row(doc, 'strip')
    want = f'{tuple(s["box"])}, corner radius {s["r"]}, blur {s["blur"]}, pad {s["pad"]}, gap {s["gap"]}'
    if not r or want not in r[0]: bad(f'strip: want "{want}"')
    e = LAYOUT['end_card']
    r = row(doc, 'end_card')
    want = f'{e["lockup"]:g} H (lockup), {e["cta"]:g} H (call to action) and {e["url"]:g} H (URL pill)'
    if not r or want not in r[0]: bad(f'end card layout: want "{want}"')
    ww = LAYOUT['window_wide']
    r = row(doc, 'window_wide')
    if not r or f'scale {ww["s"]} at {tuple(ww["pos"])}' not in r[0]: bad('window_wide')
    # cursor and focus box
    doc = section(full, 'Cursor and highlight')
    fb, cu = BRAND['focus_box'], BRAND['cursor_spec']
    r = row(doc, 'focus_box')
    for want in (f'{fb["border"]} px {fb["color"]} border', f'radius {fb["radius"]}', f'{fb["ring"]} px blue ring at {round(fb["ring_alpha"] * 100)} %',
                 f'{fb["glow"]} px glow at {round(fb["glow_alpha"] * 100)} %', f'{fb["fade"]} s'):
        if not r or want not in r[0]: bad(f'focus box: want "{want}"')
    r = row(doc, 'cursor_spec')
    for want in (f'viewBox {cu["view_box"][0]} x {cu["view_box"][1]}', f'{cu["css_size"][0]:g} x {cu["css_size"][1]:g} CSS px',
                 f'outline', f'{cu["title_scale"]} px per unit'):
        if not r or want not in r[0]: bad(f'cursor: want "{want}"')
    # sound
    doc = section(full, 'Sound')
    for k, v in LOUDNESS.items():
        r = row(doc, k)
        m = r and re.search(r'[-+]?\d+(?:\.\d+)?', r[0].replace('+/- ', ''))
        if not m or num(m.group()) != v: bad(f'loudness {k}: doc {r and r[0]} != {v}')
    for k, v in SFX.items():
        r = row(doc, k)
        if not r or r[0] != f'{v:.1f} dB': bad(f'sfx {k}: doc {r and r[0]} != {v:.1f} dB')
    return probs


# ----------------------------------------------------------------------------------------------------------------------
class TokenTest(unittest.TestCase):
    def setUp(self):
        self.css = read(brand.TOKENS_CSS)

    def test_tokens_file_is_the_figma_export(self):
        toks = parse_tokens(self.css)
        self.assertEqual(toks['--base'], '#E11837')            # fig-tokens.css:40
        self.assertEqual(toks['--informative-02'], '#3079F0')  # fig-tokens.css:50

    def test_brand_colours_match_tokens(self):
        self.assertEqual(token_drift(COLORS, TOKENS, self.css), [])

    def test_neutrals_red_and_blue_are_token_checked(self):
        for k in ('red', 'blue', 'gray100', 'gray05', 'gray60'):
            self.assertIn(k, TOKENS)
        self.assertEqual((COLORS['gray100'], COLORS['gray05'], COLORS['gray60']), ('#080D12', '#F5F7F8', '#646E73'))

    def test_drift_is_caught(self):
        for key, val in (('red', '#E01837'), ('blue', '#3079F1'), ('gray100', '#080D13'), ('gray60', '#646E74'), ('gray05', '#F5F7F9')):
            drifted = dict(COLORS, **{key: val})
            probs = token_drift(drifted, TOKENS, self.css)
            self.assertEqual(len(probs), 1, probs)
            self.assertIn(key, probs[0])


class MoistureTest(unittest.TestCase):
    def setUp(self):
        self.html = read(brand.APP_HTML)
        self.js = read(os.path.join(REPO, 'src', 'transform-app.mjs'))

    def test_bands_match_the_app_legend_and_the_corrections(self):
        self.assertEqual(moisture_drift(MOISTURE, self.html, self.js), [])
        self.assertEqual([b['label'] for b in MOISTURE], ['0-5%', '6-19%', '20-30%', '> 30%'])

    def test_band_drift_is_caught(self):
        drifted = copy.deepcopy(MOISTURE)
        drifted = (drifted[0], dict(drifted[1], color='#F3D43C')) + tuple(drifted[2:])
        self.assertEqual(len(moisture_drift(drifted, self.html, self.js)), 1)


class TypeTest(unittest.TestCase):
    def test_weights_are_the_shipped_golos_faces(self):
        self.assertEqual(brand.WEIGHTS, (400, 500, 700))
        self.assertEqual(sorted(BRAND['weights']), [400, 500, 700])
        fonts = os.path.join(brand.DS, 'assets', 'fonts')
        for w, f in BRAND['weights'].items():
            self.assertTrue(os.path.exists(os.path.join(fonts, f)), f)

    def test_no_weight_600(self):
        used = [t['weight'] for t in TYPE.values()] + [LOCKUP['wordmark_weight'], BRAND['heading_weight']]
        self.assertNotIn(600, used)
        self.assertTrue(set(used) <= {400, 500, 700}, used)
        self.assertEqual(BRAND['weight_map'], {600: 500})
        self.assertEqual(TYPE['title']['weight'], 700)
        self.assertEqual(TYPE['series']['size'], 150)
        self.assertEqual((TYPE['chapter_label']['size'], TYPE['chapter_label']['tracking']), (40, '0.2em'))
        self.assertEqual(TYPE['strip']['size'], 19)


class HoldTest(unittest.TestCase):
    def test_min_hold(self):
        for words in range(0, 25):
            self.assertAlmostEqual(min_hold(words), 1.5 + 0.3 * words, places=9)
        self.assertAlmostEqual(min_hold('Read the map'), 2.4, places=9)
        with self.assertRaises(ValueError): min_hold(-1)

    def test_same_rule_as_the_episode_schema(self):
        js = read(os.path.join(VIDEO, 'lib', 'episode-schema.mjs'))
        self.assertEqual(float(re.search(r'HOLD_BASE_S = ([\d.]+)', js).group(1)), BRAND['hold']['base'])
        self.assertEqual(float(re.search(r'HOLD_PER_WORD_S = ([\d.]+)', js).group(1)), BRAND['hold']['per_word'])


class RedTest(unittest.TestCase):
    def test_red_only_in_the_lockup_tile_and_the_dry_band(self):
        self.assertEqual(red_leaks(BRAND), [])

    def test_highlights_are_blue(self):
        for k in ('strip_active', 'highlight', 'type_cursor', 'cursor'):
            self.assertNotEqual(BRAND[k].upper(), COLORS['red'].upper(), k)
            self.assertEqual(BRAND[k], COLORS['blue'], k)
        self.assertEqual(BRAND['focus_box']['color'], COLORS['blue'])
        self.assertNotIn(COLORS['red'], [c for c, _ in sum(BRAND['wall']['blooms'].values(), ())])

    def test_strip_active_red_is_caught(self):
        drifted = dict(BRAND, strip_active=COLORS['red'])
        self.assertEqual(red_leaks(drifted), [('strip_active',)])


class ThemeTest(unittest.TestCase):
    def test_theme_takes_every_value_from_brand(self):
        from theme import THEME
        for k, v in BRAND.items():
            self.assertIs(THEME[k], v, k)
        self.assertTrue(os.path.isdir(THEME['font_dir']))

    def test_theme_holds_no_colour_literals(self):
        self.assertEqual(HEX.findall(read(os.path.join(LIB, 'theme.py'))), [])

    def test_glass_and_timeline_draw_highlights_from_theme(self):
        glass = read(os.path.join(LIB, 'layers', 'glass.py'))
        self.assertIn("THEME['strip_active']", glass)
        self.assertNotIn("THEME['red']", glass)
        tl = read(os.path.join(LIB, 'timeline.py'))
        self.assertIn("cursor_color=TYPE_CURSOR", tl)
        self.assertIn("background:{HIGHLIGHT}", tl)
        self.assertNotIn("cursor_color=RED", tl)
        self.assertNotIn("background:{RED}", tl)


class EngineMirrorTest(unittest.TestCase):
    def test_eases_match_the_engine(self):
        src = read(os.path.join(LIB, 'engine.py'))
        for key, (name, bz) in EASES.items():
            m = re.search(r"'" + name + r"': _bez\(([^)]*)\)", src)
            self.assertIsNotNone(m, name)
            self.assertEqual(tuple(float(x) for x in m.group(1).split(',')), tuple(float(x) for x in bz), key)

    def test_focus_box_and_cursor_match_the_capture_runtime(self):
        js = read(os.path.join(VIDEO, 'capture', 'director-runtime.js'))
        fb, cu = BRAND['focus_box'], BRAND['cursor_spec']
        self.assertIn(f"const BLUE = '{fb['color']}'", js)
        h = fb['color'].lstrip('#'); rgb = ','.join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))
        self.assertIn(f'border:{fb["border"]}px solid', js)
        self.assertIn(f'border-radius:{fb["radius"]}px', js)
        self.assertIn(f'0 0 0 {fb["ring"]}px rgba({rgb},{str(fb["ring_alpha"]).lstrip("0")})', js)
        self.assertIn(f'0 0 {fb["glow"]}px rgba({rgb},{str(fb["glow_alpha"]).lstrip("0")})', js)
        self.assertIn(f'transition:opacity {str(fb["fade"]).lstrip("0")}s', js)
        self.assertIn(f'viewBox="0 0 {cu["view_box"][0]} {cu["view_box"][1]}"', js)
        self.assertIn(f'width:{cu["css_size"][0]:g}px;height:{cu["css_size"][1]:g}px', js)


class DocMirrorTest(unittest.TestCase):
    def setUp(self):
        self.doc = read(DOC)

    def test_doc_has_the_ten_sections(self):
        heads = re.findall(r'^## \d+\. (.+)$', self.doc, re.M)
        self.assertEqual(heads, ['Lockup', 'Palette', 'Background', 'Type', 'Motion', 'Holds', 'Layout', 'Cursor and highlight',
                                 'Sound', "Do and don't"])
        self.assertNotRegex(self.doc, r'\bTBD\b')
        for must in ('#080D12', '#F5F7F8', '#646E73', 'No red boxes', 'design-system blue'):
            self.assertIn(must, self.doc)

    def test_doc_states_every_brand_value(self):
        self.assertEqual(doc_drift(self.doc), [])

    def test_doc_drift_is_caught(self):
        self.assertTrue(any('gray60' in p for p in doc_drift(self.doc.replace('#646E73', '#646E70'))))
        self.assertTrue(any('strip' in p for p in doc_drift(self.doc.replace('(250, 958, 1670, 1016)', '(250, 1002, 1670, 1060)'))))
        self.assertTrue(any('title' in p for p in doc_drift(self.doc.replace('| `title` | 200 px | 700 |', '| `title` | 200 px | 600 |'))))
        self.assertTrue(any('integrated_lufs' in p for p in doc_drift(self.doc.replace('-14.0 LUFS', '-16.0 LUFS'))))
        self.assertTrue(any('end card url' in p for p in doc_drift(self.doc.replace('| `url` | 0.75 | 0.6 |', '| `url` | 1.75 | 0.6 |'))))
        self.assertTrue(any('end card layout' in p for p in doc_drift(self.doc.replace('0.615 H (URL pill)', '0.7 H (URL pill)'))))


if __name__ == '__main__':
    unittest.main()
