# Ported from iCentral MarCom 06-edit/compositor/lib/ff.py (86 lines) on 2026-10-19; changes listed in video/edit/NOTES.md
"""ffmpeg helpers (no OpenCV/PIL needed): probe, frame readers, PNG I/O, grids.

ffmpeg and ffprobe resolve from $FFMPEG / $FFPROBE, else from PATH (ffprobe also next to the resolved ffmpeg). A missing
tool, or one whose path (before or after resolving symlinks) is under /tmp, /private/tmp, /var/folders, the system temp
directory, or inside an agent scratchpad (/scratchpad, /claude-), raises FFmpegError on import: a scratchpad build vanishes
with the session that made it, and a render must never depend on one.
"""
import json, os, re, shutil, subprocess, sys
try:
    import numpy as np
except ImportError:     # the resolvers and probe need only the standard library (video/verify runs in any python3)
    np = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media import MR, require_media_path  # noqa: E402


class FFmpegError(RuntimeError):
    """ffmpeg or ffprobe is missing, or resolves to a temporary or scratchpad path."""


def tool_refusal(p):
    """Why the executable at p may not be used, or None. Same temp and scratchpad rules as video/lib/media_root.py."""
    cands = []
    for c in (os.path.abspath(p), os.path.realpath(p)):
        if c not in cands: cands.append(c)
    temps = list(MR.TEMP_ROOTS)
    tmp = MR.system_tmpdir()
    for t in (os.path.abspath(tmp), os.path.realpath(tmp)):
        if not MR.is_inside(os.path.expanduser('~'), t) and t not in temps: temps.append(t)
    for c in cands:
        for t in temps:
            if MR.is_inside(c, t): return f'it is under the temporary directory {t}'
        for marker in MR.AGENT_MARKERS:
            if marker in c.lower(): return f'it is inside an agent scratchpad or working directory (path contains {marker})'
    return None


def resolve_tool(name, env_var, near=None):
    """Absolute path of an ffmpeg tool: $env_var, else `near`/<name> when given and present, else PATH."""
    p = os.environ.get(env_var)
    source = f'${env_var}'
    if not p and near:
        sib = os.path.join(os.path.dirname(near), name)
        if os.path.isfile(sib) and os.access(sib, os.X_OK): p, source = sib, f'next to {near}'
    if not p:
        p, source = shutil.which(name), 'PATH'
    if not p:
        raise FFmpegError(f'{name} not found: set {env_var} or put {name} on PATH (Homebrew: brew install ffmpeg)')
    reason = tool_refusal(p)
    if reason:
        raise FFmpegError(f'refusing {name} {p} (from {source}): {reason}. Install ffmpeg permanently (for example Homebrew) '
                          f'and point {env_var} at it, or put it on PATH.')
    if not (os.path.isfile(p) and os.access(p, os.X_OK)):
        raise FFmpegError(f'{name} from {source} is not an executable file: {p}')
    return os.path.abspath(p)


FFMPEG = resolve_tool('ffmpeg', 'FFMPEG')
FFPROBE = resolve_tool('ffprobe', 'FFPROBE', near=FFMPEG)


def probe(path):
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Video: (\w+).*?, (\d{1,5})x(\d{1,5})', out)
    fr = re.search(r'Video: .*?, ([\d.]+) (?:fps|tbr)', out)
    d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out)
    a = re.search(r'Audio: (\w+).*?, (\d+) Hz, (\w+)', out)
    return dict(codec=m and m.group(1), w=m and int(m.group(2)), h=m and int(m.group(3)), fps=fr and float(fr.group(1)),
                duration=d and int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)),
                audio=a and dict(codec=a.group(1), rate=int(a.group(2)), layout=a.group(3)), raw=out)


class Reader:
    """Sequential RGB frame reader. Frames are delivered at `fps` (source is resampled by ffmpeg fps filter if needed)."""
    def __init__(self, path, start=0.0, fps=60, scale=None, pix='rgb24', vf_extra=None):
        p = probe(path)
        self.w, self.h = (scale if scale else (p['w'], p['h']))
        vf = [f'fps={fps}']
        if scale: vf.append(f'scale={scale[0]}:{scale[1]}:flags=lanczos')
        if vf_extra: vf.append(vf_extra)
        self.ch = 4 if pix == 'rgba' else 3
        cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-ss', f'{start:.4f}', '-i', path, '-vf', ','.join(vf),
               '-f', 'rawvideo', '-pix_fmt', pix, '-']
        self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=self.w * self.h * self.ch * 2)
        self.n = 0

    def read(self):
        size = self.w * self.h * self.ch
        buf = self.proc.stdout.read(size)
        if len(buf) < size:
            return None
        self.n += 1
        return np.frombuffer(buf, np.uint8).reshape(self.h, self.w, self.ch)

    def close(self):
        try:
            self.proc.stdout.close(); self.proc.kill(); self.proc.wait()
        except Exception:
            pass


def grab(path, t, scale=None):
    r = Reader(path, start=t, scale=scale); f = r.read(); r.close(); return f


def read_png(path):
    p = probe(path)
    out = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(p['h'], p['w'], 4)


def write_img(arr, path, q=None):
    path = require_media_path(path, 'image')          # images are media: only under the media root
    arr = np.ascontiguousarray(arr)
    h, w, c = arr.shape
    pix = {3: 'rgb24', 4: 'rgba'}[c]
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', pix, '-s', f'{w}x{h}', '-i', '-']
    if path.endswith('.jpg'): cmd += ['-q:v', str(q or 3)]
    subprocess.run(cmd + [path], input=arr.tobytes(), check=True)


def grid(frames, cols, pad=6, bg=255, labels=None):
    h = max(f.shape[0] for f in frames); w = max(f.shape[1] for f in frames)
    rows = (len(frames) + cols - 1) // cols
    out = np.full((rows * h + (rows + 1) * pad, cols * w + (cols + 1) * pad, 3), bg, np.uint8)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols)
        y, x = pad + r * (h + pad), pad + c * (w + pad)
        out[y:y + f.shape[0], x:x + f.shape[1]] = f[..., :3]
    return out


def shrink(f, w):
    """Area-average downscale by an integer-ish factor using numpy (for review grids only)."""
    h0, w0 = f.shape[:2]; k = max(1, round(w0 / w))
    hh, ww = h0 // k * k, w0 // k * k
    return f[:hh, :ww, :3].reshape(hh // k, k, ww // k, k, 3).mean((1, 3)).astype(np.uint8)
