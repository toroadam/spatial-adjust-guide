"""THEME: every colour, font and brand value the compositor draws with, taken from brand.py (the Spatial Adjust motion system).

brand.py is the single code source of the motion system (video/brand/motion-system.md) and the only file under
video/edit/lib that holds colour literals; THEME is BRAND plus the font folder. The engine, the wallpapers (wallpaper.py,
background.py), the timeline builder, the cards and the layer types read THEME; nothing else hard-codes a hex value or a
font. Change a value in brand.py and every render picks it up; the wallpaper cache is keyed on THEME['wall'].

Fonts come from the repository's own design system (_ds, Golos UI, SIL OFL), never from the iCentral folder. Golos UI ships
as 400, 500 and 700 only: CSS asking for 600 is rendered at THEME['weight_map'][600] (see gfx/render_gfx.mjs).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand import BRAND, DS, REPO  # noqa: E402,F401

THEME = dict(font_dir=os.path.join(DS, 'assets', 'fonts'))
THEME.update(BRAND)


def rgba(name, alpha):
    """CSS rgba() for a THEME colour, for HTML snippets rendered by render_gfx.mjs."""
    h = THEME[name].lstrip('#')
    return 'rgba(%d,%d,%d,%s)' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def font_spec():
    """The font block render_gfx.mjs reads from its spec: family, absolute font directory, files by weight, weight map."""
    return dict(family=THEME['font_family'], dir=THEME['font_dir'],
                weights={str(k): v for k, v in THEME['weights'].items()},
                weight_map={str(k): v for k, v in THEME['weight_map'].items()})
