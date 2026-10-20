"""Brand values for the video compositor: every colour and font the ported code draws with.

This is the only file under video/edit/lib that holds colour literals. The engine, the wallpaper, the timeline builder and
the layer types read THEME; nothing else hard-codes a hex value or a font. The values below are the ones found in the
iCentral MarCom compositor sources (see video/edit/NOTES.md); PI-ICNT-SW-1081-1 replaces them with the Spatial Adjust
motion system. Change a value here and every render picks it up; the wallpaper cache is keyed on its palette.

Fonts come from the repository's own design system (_ds, Golos UI, SIL OFL), never from the iCentral folder. Golos UI ships
as 400, 500 and 700 only: CSS asking for 600 is rendered at THEME['weight_map'][600] (see gfx/render_gfx.mjs).
"""
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
DS = os.path.join(REPO, '_ds', 'toro-oasis-design-system-53d56d79-256b-40ad-b179-70e176d485a8')

THEME = dict(
    # brand (iCentral phase2 tokens: $toro-red, $toro-red-shade, $toro-red-tint)
    red='#E11837', red_shade='#C91E38', red_tint='#FA5069',
    # Spatial Adjust app blue (SpatialAdjustApp.dc.html); not drawn by the ported iCentral code yet, used from PI-ICNT-SW-1081
    blue='#3079F0',
    # greys (iCentral phase2 tokens $gray-100 .. $gray-20, plus the type colours gray05/gray30 from v5_build.py)
    gray100='#080D12', gray90='#1B1E21', gray80='#33393D', gray70='#4C5459', gray40='#A2ADB2', gray30='#BCC6CC',
    gray20='#D9DFE2', gray05='#F5F7F8', white='#FFFFFF',
    # engine v1 (engine.py): blue-50 to white background, its two slow blooms, the typewriter cursor and the frosted card tint
    bg_tint='#e5eff8', bloom_a='#267dc1', bloom_b='#9cd3f5', cursor='#267dc1', card_tint='#ffffff',
    # engine v2 (engine2.py): the back face of the 3D strip peel
    peel_back='#4a4f57',
    # glass chapter timeline (layers/glass.py): frosted tint r, g, b (0..255) and its mix amount; the active fill is 'red'
    glass_tint=(14, 18, 24, 0.46),
    # type (gfx/render_gfx.mjs): family, font files by weight, and the weight used where the iCentral CSS asked for 600
    font_dir=os.path.join(DS, 'assets', 'fonts'),
    font_family='Golos UI',
    weights={400: 'golos-ui_regular.ttf', 500: 'golos-ui_medium.ttf', 700: 'golos-ui_bold.ttf'},
    weight_map={600: 500},
    heading_weight=500,
)

# Wallpaper palette (wallpaper.py): the satin ribbons and the charcoal base. Kept as its own block so the wallpaper can be
# re-skinned without touching the UI colours.
THEME['wall'] = dict(red=THEME['red'], shade=THEME['red_shade'], tint=THEME['red_tint'], g100=THEME['gray100'],
                     g90=THEME['gray90'], g80=THEME['gray80'], g70=THEME['gray70'], g40=THEME['gray40'], g20=THEME['gray20'])


def rgba(name, alpha):
    """CSS rgba() for a THEME colour, for HTML snippets rendered by render_gfx.mjs."""
    h = THEME[name].lstrip('#')
    return 'rgba(%d,%d,%d,%s)' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def font_spec():
    """The font block render_gfx.mjs reads from its spec: family, absolute font directory, files by weight, weight map."""
    return dict(family=THEME['font_family'], dir=THEME['font_dir'],
                weights={str(k): v for k, v in THEME['weights'].items()},
                weight_map={str(k): v for k, v in THEME['weight_map'].items()})
