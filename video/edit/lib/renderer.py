# Ported from iCentral MarCom double-clicks/tools/engine_dc.py (111 lines; RendererDC, lines 1-41) on 2026-10-19; changes listed in video/edit/NOTES.md
"""The episode renderer: engine2's Renderer2 plus a registry of extra layer types.

  Renderer.register_layer('glass', fn)     or   @register_layer('glass')     fn(renderer, layer, t, out) -> out
  Renderer(tl, root).frame(t)                                                 1x3xHxW tensor in 0..1

Registered types generalise the Double Click renderer's hard-coded OWN = ('glass', 'dctitle'). frame(t) renders the base
frame through Renderer2 with every registered layer removed from the timeline (restored in a finally block), then applies
the registered layers active at t in timeline order, and clamps to 0..1. Registered layers therefore always draw ABOVE
every base layer (wallpaper, window shots, text, logos), whatever their position in the timeline: put chrome such as the
glass chapter strip or title cards here, not footage.

Layer modules live in lib/layers/ and register themselves on import; importing this module imports them all. A layer type
may not reuse a base type name (BASE_TYPES).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine2 import Renderer2  # noqa: E402

BASE_TYPES = ('wall', 'plate', 'peel', 'peel3d', 'peel_strip', 'text', 'image', 'logo', 'card', 'solid', 'flash')


class Renderer(Renderer2):
    LAYERS = {}

    @classmethod
    def register_layer(cls, type_name, fn):
        if not isinstance(type_name, str) or not type_name:
            raise ValueError('layer type must be a non-empty string')
        if type_name in BASE_TYPES:
            raise ValueError(f'layer type {type_name!r} is a base engine type')
        if not callable(fn):
            raise TypeError(f'layer {type_name!r}: fn must be callable as fn(renderer, layer, t, out)')
        cls.LAYERS[type_name] = fn
        return fn

    def frame(self, t):
        own = [L for L in self.tl['layers'] if L['type'] in self.LAYERS and L['t0'] - 1e-9 <= t < L['t1'] - 1e-9]
        if not own: return super().frame(t)
        saved = self.tl['layers']
        self.tl['layers'] = [L for L in saved if L['type'] not in self.LAYERS]
        try: out = super().frame(t)
        finally: self.tl['layers'] = saved
        for L in own: out = self.LAYERS[L['type']](self, L, t, out)
        return out.clamp(0, 1)


def register_layer(type_name, fn=None):
    """Register fn(renderer, layer, t, out) -> out for layer type type_name; usable as a decorator."""
    if fn is None:
        return lambda f: Renderer.register_layer(type_name, f)
    return Renderer.register_layer(type_name, fn)


import layers  # noqa: E402,F401  (registers every layer type in lib/layers)
