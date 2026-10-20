"""Test-only layer type 'test_tint': a solid colour over the whole frame. Registering it here, from outside lib/, is the
point: renderer.Renderer must apply it without any edit to renderer.py."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
import torch  # noqa: E402
from engine import DEV, DT, kf  # noqa: E402
from renderer import register_layer  # noqa: E402


@register_layer('test_tint')
def test_tint(renderer, L, t, out):
    c = torch.tensor(L['rgb'], device=DEV, dtype=DT).view(1, 3, 1, 1)
    o = kf(L.get('opacity', 1.0), t)
    return out * (1 - o) + c * o
