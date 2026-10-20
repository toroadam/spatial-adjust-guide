"""Shared helpers for the compositor tests.

The compositor needs torch, numpy and scipy (video/requirements.txt), which live in the pipeline venv at the media root, not
in the system Python that `npm run test:video:py` starts. A heavy test module therefore runs its tests in place when the
current interpreter has them (IN_PIPELINE), and otherwise defines one delegating test that runs the same file with the
pipeline Python: $SA_VIDEO_PYTHON, else <media root>/.venv/bin/python. With neither, the test is skipped, naming what is
missing. Tools the tests need (ffmpeg, node, Playwright Chromium) are checked the same way: missing means skip, not fail.

Tests write media only under <media root>/episodes/_test (lib/media.py TEST_EPISODE).
"""
import os
import shutil
import subprocess
import sys

TESTS = os.path.dirname(os.path.abspath(__file__))
EDIT = os.path.dirname(TESTS)
LIB = os.path.join(EDIT, 'lib')
VIDEO = os.path.dirname(EDIT)
REPO = os.path.dirname(VIDEO)
RENDER = os.path.join(EDIT, 'render.py')
DEPS = ('torch', 'numpy', 'scipy')

for p in (LIB, os.path.join(VIDEO, 'lib')):
    if p not in sys.path: sys.path.insert(0, p)


def missing_modules():
    missing = []
    for name in DEPS:
        try:
            mod = __import__(name)
            if name == 'numpy' and not hasattr(mod, 'ndarray'): missing.append(name)
        except Exception:
            missing.append(name)
    return missing


IN_PIPELINE = not missing_modules()


def pipeline_python():
    """An interpreter that imports torch, numpy and scipy, or None."""
    cands = [os.environ.get('SA_VIDEO_PYTHON')]
    try:
        import media_root
        cands.append(os.path.join(media_root.media_root(), '.venv', 'bin', 'python'))
    except Exception:
        pass
    for c in cands:
        if not c or not os.path.exists(c): continue
        r = subprocess.run([c, '-c', 'import torch, numpy, scipy'], capture_output=True)
        if r.returncode == 0: return c
    return None


def delegate(test, test_file):
    """Run test_file under the pipeline Python; fail with its output on failure, skip when it skipped everything."""
    py = pipeline_python()
    if not py:
        test.skipTest(f'{", ".join(missing_modules())} missing in {sys.executable}, and no pipeline Python found: set '
                      'SA_VIDEO_PYTHON or create the venv at the media root (video/README.md, Prerequisites)')
    r = subprocess.run([py, test_file, '-v'], cwd=REPO, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if r.returncode != 0:
        test.fail(f'{os.path.basename(test_file)} failed under {py}:\n' + '\n'.join(out.splitlines()[-60:]))
    last = out.splitlines()[-1] if out else ''
    ran = [ln for ln in out.splitlines() if ln.startswith('Ran ')]
    if 'skipped=' in last and ran:
        n = int(ran[-1].split()[1]); k = int(last.split('skipped=')[1].rstrip(')').split(',')[0])
        if n and k == n:
            reasons = [ln for ln in out.splitlines() if 'skipped' in ln and "'" in ln]
            test.skipTest(f'all {n} skipped under {py}: ' + '; '.join(reasons[:3]))


def require(test, *tools):
    """Skip unless every named tool is usable: 'ffmpeg' (as ff.py resolves it), 'node', 'chromium' (Playwright's)."""
    for tool in tools:
        if tool == 'ffmpeg':
            try:
                import ff  # noqa: F401
            except Exception as err:
                test.skipTest(f'ffmpeg unavailable: {err}')
        elif tool == 'node':
            if not shutil.which('node'): test.skipTest('node missing: Node 22 or later is needed for gfx/render_gfx.mjs')
        elif tool == 'chromium':
            if not shutil.which('node'): test.skipTest('node missing: Node 22 or later is needed for gfx/render_gfx.mjs')
            code = ("import('playwright').catch(() => process.exit(4)).then((p) => p.chromium.launch({ headless: true }))"
                    ".then((b) => b.close()).then(() => process.exit(0), () => process.exit(3))")
            r = subprocess.run(['node', '--input-type=module', '-e', code], cwd=REPO, capture_output=True)
            if r.returncode == 4: test.skipTest('Playwright missing: run npm ci in the repository')
            if r.returncode != 0: test.skipTest('Playwright Chromium missing: run npx playwright install chromium')
        else:
            raise ValueError(tool)


def ffprobe_json(path, *args):
    import json
    import ff
    r = subprocess.run([ff.FFPROBE, '-v', 'error', *args, '-of', 'json', path], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)
