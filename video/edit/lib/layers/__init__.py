"""Layer types for renderer.Renderer. Every module in this package is imported here, and each registers its type(s) with
renderer.register_layer on import. Add a layer by adding a module; renderer.py does not change.

  glass    the frosted chapter strip (glass.py)
  dctitle  the series title card: not here yet (PI-ICNT-SW-1081-2 adds it with the Spatial Adjust branding)
"""
import importlib
import os
import pkgutil

for _m in sorted(pkgutil.iter_modules([os.path.dirname(os.path.abspath(__file__))]), key=lambda m: m.name):
    if not _m.name.startswith('_'):
        importlib.import_module(f'{__name__}.{_m.name}')
