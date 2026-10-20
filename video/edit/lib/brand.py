"""The Spatial Adjust motion system as code: the single source of every brand value the compositor draws or mixes with.

video/brand/motion-system.md is the human-readable spec and BRAND mirrors it value for value; test_brand.py fails when the
two disagree, when a colour drifts from the design tokens (_ds .../tokens/figma/fig-tokens.css) or the app's moisture legend
(SpatialAdjustApp.dc.html), when an ease or the title spring drifts from the engine, or when red leaves the lockup tile.

  from brand import BRAND, min_hold
  BRAND['highlight']           '#3079F0', the design-system blue on the element being described
  BRAND['type']['title']       {'size': 200, 'weight': 700, ...} at 1920x1080
  min_hold(4)                  2.7: an on-screen label of 4 words holds at least 1.5 s + 0.3 s per word

theme.py applies BRAND with THEME.update(BRAND), so the ported engine, the wallpaper, the timeline builder and the layer
types all read these values through THEME. Nothing else under video/edit/lib holds a colour literal.

Red (#E11837, Toro red) appears in exactly two places: the lockup's Toro tile, and the 0-5 % moisture band when the data
itself shows it. Every highlight, active fill, cursor and pointer is design-system blue. There are no red boxes.
"""
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
DS = os.path.join(REPO, '_ds', 'toro-oasis-design-system-53d56d79-256b-40ad-b179-70e176d485a8')
TOKENS_CSS = os.path.join(DS, 'tokens', 'figma', 'fig-tokens.css')
APP_HTML = os.path.join(REPO, 'SpatialAdjustApp.dc.html')

# ----------------------------------------------------------------------------------------------------------------------
# Colour. Every value is a token in fig-tokens.css (TOKENS names it) except the 6-19 % moisture yellow, which is the app's
# own legend colour (SpatialAdjustApp.dc.html:315) and has no design token.
# ----------------------------------------------------------------------------------------------------------------------
COLORS = dict(
    red='#E11837', red_shade='#C91E38', red_tint='#FA5069',                 # Toro red: the lockup tile only
    blue='#3079F0', blue_tint='#66A1FF', blue_shade='#2165DB',              # design-system blue: highlights
    green='#42CE11', yellow='#F3D43B',                                      # moisture-band accents
    gray100='#080D12', gray90='#1B1E21', gray80='#33393D', gray70='#4C5459', gray60='#646E73', gray50='#848E94',
    gray40='#A2ADB2', gray30='#BCC6CC', gray20='#D9DFE2', gray10='#ECEFF1', gray05='#F5F7F8', white='#FFFFFF',
)
TOKENS = dict(
    red='--base', red_shade='--shade', red_tint='--tint',
    blue='--informative-02', blue_tint='--informative-01', blue_shade='--informative-03',
    green='--positive-02',
    gray100='--100', gray90='--90', gray80='--80', gray70='--70', gray60='--60', gray50='--50',
    gray40='--40', gray30='--30', gray20='--20', gray10='--10', gray05='--05', white='--white',
)

# Moisture bands, as the guides show them: the colours of the app legend, the boundaries as corrected in the transform layer
# (src/transform-app.mjs: 6-19 % and 20-30 %, the product's range2Boundary of 19; the raw file still says 6-16 % / 17-30 %).
MOISTURE = (
    dict(label='0-5%', lo=0, hi=5, color=COLORS['red']),
    dict(label='6-19%', lo=6, hi=19, color=COLORS['yellow']),
    dict(label='20-30%', lo=20, hi=30, color=COLORS['green']),
    dict(label='> 30%', lo=31, hi=None, color=COLORS['blue']),
)

# Semantic roles (what each colour is for)
ROLES = dict(
    text=COLORS['gray100'],            # type on light surfaces
    light=COLORS['gray05'],            # type on the dark wall
    secondary=COLORS['gray60'],        # secondary type on light surfaces
    muted=COLORS['gray30'],            # secondary type on the dark wall (tags, legal line)
    highlight=COLORS['blue'],          # the element being described: focus box, URL pill dot
    strip_active=COLORS['blue'],       # chapter strip: the active chapter's fill and its glowing head
    type_cursor=COLORS['blue'],        # typewriter block cursor on chapter cards
    title_cursor_fill=COLORS['white'], title_cursor_stroke=COLORS['gray100'],   # arrow cursor on the title card
    ripple=COLORS['white'],            # click ripple and the title card's double-click pulse
)

# ----------------------------------------------------------------------------------------------------------------------
# Lockup: the Toro tile (assets/toro-logo.svg, 123 x 82, red with the white TORO wordmark) and "Spatial Adjust" set in
# Golos UI Bold, the geometry of assets/sa/sa-header-logo.png (tile 63 px high, cap height 28 px = Golos UI 700 at 40 px,
# 22 px from the tile's edge to the S, caps centred on the tile).
# ----------------------------------------------------------------------------------------------------------------------
LOCKUP = dict(
    tile='assets/toro-logo.svg', reference='assets/sa/sa-header-logo.png', tile_aspect=1.5,
    wordmark='Spatial Adjust', wordmark_weight=700, wordmark_tracking='0em',
    font_ratio=0.635,                  # wordmark font size / tile height (40 / 63)
    gap_ratio=0.35,                    # ink gap tile -> S / tile height (22 / 63)
    tile_open=150,                     # tile height on the open (lockup moment), px at 1920x1080
    tile_end=104,                      # tile height on the end card
    color_dark_wall=COLORS['gray05'],  # wordmark on the dark wall; on light surfaces it is ROLES['text']
)

# ----------------------------------------------------------------------------------------------------------------------
# Background: the contour wall (background.py). Dark Oasis neutrals, faint topographic contour lines like the slope map of
# a green, and soft blooms in the moisture-band accents (never red). Replaces the iCentral red satin wave.
# ----------------------------------------------------------------------------------------------------------------------
WALL = dict(
    style='sa-contour-1',
    top=COLORS['gray90'], bottom=COLORS['gray100'], lift=COLORS['gray80'],
    line=COLORS['gray40'], line_alpha=0.07, index_alpha=0.13, index_every=5,
    blooms=dict(
        bloom=((COLORS['blue'], 0.30), (COLORS['green'], 0.12), (COLORS['yellow'], 0.05)),
        hero=((COLORS['blue'], 0.34), (COLORS['green'], 0.10), (COLORS['yellow'], 0.05)),
        card=((COLORS['blue'], 0.22), (COLORS['green'], 0.06)),
    ),
    # wallpaper.py (the ported iCentral satin) still imports; its ribbon slots are re-skinned in design-system blue
    red=COLORS['blue'], shade=COLORS['blue_shade'], tint=COLORS['blue_tint'], g100=COLORS['gray100'], g90=COLORS['gray90'],
    g80=COLORS['gray80'], g70=COLORS['gray70'], g40=COLORS['gray40'], g20=COLORS['gray20'],
)

# ----------------------------------------------------------------------------------------------------------------------
# Type: Golos UI from _ds, 400 / 500 / 700 only (no 600). Sizes in px at 1920x1080.
# ----------------------------------------------------------------------------------------------------------------------
WEIGHTS = (400, 500, 700)
TYPE = dict(
    title=dict(size=200, weight=700, tracking='-0.035em', caps=False, color='white'),           # episode name, title card
    series=dict(size=150, weight=500, tracking='-0.025em', caps=False, color='light'),          # series word "Double Click"
    chapter_label=dict(size=40, weight=500, tracking='0.2em', caps=True, color='muted'),        # eyebrow tag (UP NEXT)
    chapter_card=dict(size=132, weight=500, tracking='0.06em', caps=True, color='light'),       # typed chapter card
    statement=dict(size=150, weight=500, tracking='-0.025em', caps=False, color='light'),       # typed sentence card
    strip=dict(size=19, weight=500, tracking='0.02em', caps=False, color='white'),              # chapter strip names
    cta=dict(size=84, weight=500, tracking='-0.02em', caps=False, color='light'),               # end card call to action
    url=dict(size=64, weight=500, tracking='0.005em', caps=False, color='light'),               # end card URL pill
    legal=dict(size=24, weight=400, tracking='0.01em', caps=False, color='muted'),              # end card legal line
)
SERIES_WORD = 'Double Click'

# ----------------------------------------------------------------------------------------------------------------------
# Motion: cubic-bezier eases (the engine's EASE table) and the title spring (dctitle.py _spring)
# ----------------------------------------------------------------------------------------------------------------------
EASES = dict(
    enter=('outCubic', (0.33, 1, 0.68, 1)),        # entrances, window float settle
    exit=('inCubic', (0.32, 0, 0.67, 0)),          # exits, type out
    glide=('inOutCubic', (0.65, 0, 0.35, 1)),      # cursor glides, camera push-ins and pulls
    type_in=('outQuint', (0.22, 1, 0.36, 1)),      # type in, per word
    drift=('inOutSine', (0.37, 0, 0.63, 1)),       # slow wall drift
    morph=('inOutQuart', (0.76, 0, 0.24, 1)),      # window morph between shots
)
SPRING = dict(w=15.0, z=0.42)                      # underdamped title pop, overshoot about 23 %

DURATIONS = dict(                                   # seconds
    enter=0.55, exit=0.30, type_word=0.60, type_stagger=0.07, type_out=0.22, type_cps=50,
    push_in=(1.2, 2.5), window_float=(0.8, 1.2), click_pulse=0.60, double_click_gap=0.16,
    lockup=2.3, title_card=5.9, up_next_card=4.6, chapter_card=1.7, end_card=5.0, strip_fade=0.5,
)
CAMERA = dict(tilt=True, flat_only=('title card', 'end card'))   # the window shot is the tilted plate with cursor-follow push-ins

# The title card (layers/dctitle.py, cards.title_card): seconds from the card's start, and the episode name's drop under the
# series word's baseline in px. up_next is the closing "Up next" card's timing.
TITLE_CARD = dict(t_in=0.15, t_move=0.75, click=1.74, pop=1.98, leave=2.6, out=0.3, drop=30,
                  up_next=dict(t_in=0.1, t_move=1.45, click=2.42, pop=2.68, leave=3.2, out=0.3))

# Holds: an on-screen label stays readable (every word at least 50 % opacity) for 1.5 s plus 0.3 s per word
HOLD = dict(base=1.5, per_word=0.3)

# ----------------------------------------------------------------------------------------------------------------------
# Layout at 1920x1080, 60 fps
# ----------------------------------------------------------------------------------------------------------------------
FRAME = dict(w=1920, h=1080, fps=60)
LAYOUT = dict(
    title_safe=0.90, title_safe_box=(96, 54, 1824, 1026),
    window_wide=dict(s=0.77, pos=(962, 522)),        # window shot rest framing: the plate spans y 106-938
    strip=dict(box=(250, 958, 1670, 1016), r=20, blur=22, pad=22, gap=14),
)
FOCUS_BOX = dict(color=ROLES['highlight'], border=2.5, radius=10, ring=6, ring_alpha=0.16, glow=24, glow_alpha=0.25, fade=0.28)
CURSOR = dict(view_box=(13, 20), css_size=(15.6, 24), fill=ROLES['title_cursor_fill'], stroke=ROLES['title_cursor_stroke'],
              title_scale=6.4)                     # the title card draws the same arrow at 6.4 px per viewBox unit (2x asset)

# ----------------------------------------------------------------------------------------------------------------------
# Sound: BS.1770 loudness of the final mix, and the SFX set (levels relative to the clip's design level)
# ----------------------------------------------------------------------------------------------------------------------
LOUDNESS = dict(
    integrated_lufs=-14.0, tolerance_lu=0.5, true_peak_max_dbtp=-1.0, limiter_ceiling_dbtp=-1.85,
    music_under_vo_db=-3.0, duck_db=-9.0, duck_key_dbfs=-45.0, duck_lookahead_ms=50, duck_attack_ms=80, duck_release_ms=350,
    sample_rate=48000,
)
SFX = dict(click=-10.0, hit_soft=-14.0, tick_soft=-10.0, type=-6.0)     # 'type' is one tick per character (type:<n>:<cps>)

# ----------------------------------------------------------------------------------------------------------------------
# BRAND: the flat dict theme.py applies with THEME.update(BRAND)
# ----------------------------------------------------------------------------------------------------------------------
BRAND = dict(COLORS)
BRAND.update(ROLES)
BRAND.update(
    moisture=MOISTURE, lockup=LOCKUP, wall=WALL, type=TYPE, series_word=SERIES_WORD, eases=EASES, spring=SPRING,
    durations=DURATIONS, camera=CAMERA, title_card=TITLE_CARD, hold=HOLD, frame=FRAME, layout=LAYOUT, focus_box=FOCUS_BOX, cursor_spec=CURSOR,
    loudness=LOUDNESS, sfx_levels=SFX,
    # engine fallbacks (engine.py v1 background and defaults, engine2 peel, glass layer tint)
    bg_tint=COLORS['gray10'], bloom_a=COLORS['blue'], bloom_b=COLORS['blue_tint'], cursor=ROLES['type_cursor'],
    card_tint=COLORS['white'], peel_back=COLORS['gray70'], glass_tint=(8, 13, 18, 0.46),
    font_family='Golos UI', weights={400: 'golos-ui_regular.ttf', 500: 'golos-ui_medium.ttf', 700: 'golos-ui_bold.ttf'},
    weight_map={600: 500}, heading_weight=500,
)


def min_hold(words):
    """Shortest hold, in seconds, for an on-screen label of `words` words: 1.5 s + 0.3 s per word."""
    if isinstance(words, str):
        words = len(words.split())
    if words < 0:
        raise ValueError('words must be >= 0')
    return HOLD['base'] + HOLD['per_word'] * words


def color(role):
    """A TYPE colour name ('white', 'light', 'muted', ...) or a COLORS key -> hex."""
    return BRAND[role]


def css(role):
    """CSS for a TYPE role, for render_gfx.mjs: weight, size, tracking, colour, case."""
    t = TYPE[role]
    return (f'font-weight:{t["weight"]};font-size:{t["size"]}px;letter-spacing:{t["tracking"]};color:{color(t["color"])};'
            f'line-height:1.1' + (';text-transform:uppercase' if t['caps'] else ''))
