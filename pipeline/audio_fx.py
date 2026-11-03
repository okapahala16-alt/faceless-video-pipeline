"""Cinematic audio engine for the no-voiceover "What if..." format.

Everything here is used only by scripts that opt in (an "audio" block, "voiceover": false
or "tts": null). The legacy Kuta path in build_audio.py does not import this module.

All layers are stereo float32 arrays shaped (2, n) at SR = 48 kHz.
Every random source takes an explicit seed, so a script always renders the same audio.
"""
import os, glob, zlib
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, lfilter
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
FRAME = 1 / 30
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")


def rng_for(seed, *salt):
    """Deterministic generator per (seed, event) so adding one event never shifts another."""
    key = zlib.crc32(("|".join(str(s) for s in salt)).encode())
    return np.random.default_rng([int(seed) & 0xFFFFFFFF, key])


def pan_gains(p):
    p = float(np.clip(p, -1, 1))
    a = (p + 1) * np.pi / 4
    return np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)


def to_stereo(mono, pan=0.0):
    gl, gr = pan_gains(pan)
    return np.vstack([mono * gl, mono * gr])


def sos(kind, f, order=4):
    f = np.atleast_1d(f).astype(float)
    f = np.clip(f, 10, SR / 2 * 0.98)
    return butter(order, f if len(f) > 1 else f[0], btype=kind, fs=SR, output="sos")


def filt(x, kind, f, order=4):
    return sosfilt(sos(kind, f, order), x, axis=-1)


def colored_noise(n, rng, color="pink"):
    w = rng.standard_normal(n)
    if color == "white":
        return w / (np.std(w) + 1e-9)
    spec = np.fft.rfft(w)
    fr = np.fft.rfftfreq(n, 1 / SR)
    fr[0] = fr[1]
    spec /= np.sqrt(fr) if color == "pink" else fr  # brown = 1/f
    x = np.fft.irfft(spec, n)
    return x / (np.std(x) + 1e-9)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def fade_env(n, fade_in, fade_out):
    e = np.ones(n)
    i, o = int(fade_in * SR), int(fade_out * SR)
    if i > 0: e[:i] *= smoothstep(0, 1, np.linspace(0, 1, i))
    if o > 0: e[-o:] *= smoothstep(0, 1, np.linspace(1, 0, o))
    return e


# ---------------------------------------------------------------- SFX generators
IMPACT_LEVELS = {  # gain, boom Hz, decay s, transient decay s, tail s
    "small": (0.45, 60.0, 1.5, 0.05, 0.0),
    "medium": (0.75, 50.0, 2.2, 0.08, 1.2),
    "huge": (1.0, 42.0, 3.0, 0.12, 2.6),
}


def impact(level="medium", rng=None):
    g, f_end, decay, tdec, tail = IMPACT_LEVELS.get(level, IMPACT_LEVELS["medium"])
    n = int((decay + 0.3) * SR)
    t = np.arange(n) / SR
    # sub-bass boom: pitch drops from ~2.6x to the target over 120 ms
    f = f_end + f_end * 1.6 * np.exp(-t / 0.04)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (decay / 4.6))
    boom *= smoothstep(0, 1, np.clip(t / 0.004, 0, 1))
    if level == "huge":
        boom = np.tanh(boom * 2.2) / np.tanh(2.2)  # a bit of saturation for weight
    # broadband transient, decorrelated per channel
    out = np.zeros((2, n))
    for ch in range(2):
        hit = colored_noise(n, rng, "white") * np.exp(-t / tdec)
        hit = filt(hit, "highpass", 120, 2) * 0.55 + filt(hit, "lowpass", 900, 2) * 0.6
        layer = hit * 0.5
        if tail > 0:  # rumbling debris tail
            rum = filt(colored_noise(n, rng, "brown"), "lowpass", 380, 2)
            layer = layer + rum * np.exp(-t / (tail / 4)) * 0.35 * smoothstep(0, 1, np.clip(t / 0.02, 0, 1))
        out[ch] = boom * 0.95 + layer
    return out * g


def sweep(direction="up", dur=1.5, f_from=None, f_to=None, rng=None):
    if f_from is None: f_from = 180.0 if direction == "up" else 1800.0
    if f_to is None: f_to = 1800.0 if direction == "up" else 180.0
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    f = f_from * (f_to / f_from) ** u  # exponential glissando
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.3) + 0.15 * np.sin(3 * ph + 1.1)
    if direction == "up":
        env = u ** 1.6 * (1 - smoothstep(0.96, 1.0, u))
    else:
        env = (1 - u) ** 1.4 * smoothstep(0, 0.04, u)
    air = filt(colored_noise(n, rng, "pink"), "bandpass", [max(80, min(f_from, f_to) * 0.8), min(14000, max(f_from, f_to) * 2.5)], 2)
    mono = (tone * 0.22 + air * 0.08) * env
    wob = 0.12 * np.sin(2 * np.pi * 0.7 * u * dur)
    return np.vstack([mono * (1 - wob), mono * (1 + wob)])


def noise_wall(dur=4.0, intensity=0.8, fade_in=0.6, fade_out=1.0, color="pink", lo=60, hi=7000, rng=None):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    surge = 1 + 0.12 * np.sin(2 * np.pi * 0.35 * t) + 0.06 * np.sin(2 * np.pi * 1.7 * t + 1.0)
    for ch in range(2):
        x = filt(colored_noise(n, rng, color), "bandpass", [lo, hi], 2)
        out[ch] = x * surge
    return out * fade_env(n, fade_in, fade_out) * 0.32 * float(np.clip(intensity, 0, 1)) ** 1.2


def shimmer(dur=3.0, density=8.0, f_lo=2000.0, f_hi=4000.0, rng=None):
    n = int(dur * SR)
    out = np.zeros((2, n))
    count = max(1, int(dur * density))
    times = np.sort(rng.uniform(0, max(0.01, dur - 0.2), count))
    for t0 in times:
        f = rng.uniform(f_lo, f_hi)
        dec = rng.uniform(0.25, 0.8)
        m = int(min(dur - t0, dec * 4) * SR)
        if m <= 0: continue
        tt = np.arange(m) / SR
        ping = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / (dec * 0.4)))
        ping *= np.exp(-tt / dec) * smoothstep(0, 1, np.clip(tt / 0.002, 0, 1)) * rng.uniform(0.04, 0.09)
        gl, gr = pan_gains(rng.uniform(-0.8, 0.8))
        s = int(t0 * SR)
        out[0, s:s + m] += ping * gl
        out[1, s:s + m] += ping * gr
    return out * fade_env(n, 0.05, 0.4)


def swell(dur=1.5, rng=None):
    dur = float(np.clip(dur, 0.6, 3.0))
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    env = np.sin(np.pi * u ** 0.75) ** 2
    out = np.zeros((2, n))
    for ch in range(2):
        x = colored_noise(n, rng, "pink")
        dark, bright = filt(x, "lowpass", 600, 2), filt(x, "bandpass", [400, 6000], 2)
        out[ch] = (dark * (1 - env) + bright * env) * env * 0.22
    return out


# ---------------------------------------------------------------- file assets
def load_audio(path):
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    x = data.T
    if x.shape[0] == 1: x = np.vstack([x[0], x[0]])
    x = x[:2]
    if sr != SR:
        n_new = int(round(x.shape[1] * SR / sr))
        src = np.arange(x.shape[1]) / sr
        dst = np.arange(n_new) / SR
        x = np.vstack([np.interp(dst, src, x[c]) for c in range(2)])
    return x


def find_asset(sub, name):
    p = os.path.join(ASSETS, sub, name)
    return p if os.path.exists(p) else None


def loop_to(x, n, xfade=0.5):
    if x.shape[1] >= n: return x[:, :n]
    k = int(xfade * SR)
    out = np.zeros((2, n)); pos = 0
    while pos < n:
        seg = x.copy()
        if pos > 0 and k > 0:
            seg[:, :k] *= np.linspace(0, 1, k)
            out[:, pos - k:pos] *= np.linspace(1, 0, k)
            pos -= k
        m = min(seg.shape[1], n - pos)
        out[:, pos:pos + m] += seg[:, :m]
        pos += m
    return out


# ---------------------------------------------------------------- ambience
def synth_ambience(n, rng):
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    surf_mod = 0.55 + 0.45 * np.sin(2 * np.pi * t / 7.0) ** 2
    for ch in range(2):
        surf = filt(colored_noise(n, rng, "pink"), "lowpass", 900, 2) * surf_mod
        crowd = filt(colored_noise(n, rng, "pink"), "bandpass", [300, 2200], 2) * (0.8 + 0.2 * np.sin(2 * np.pi * t / 3.1 + ch))
        out[ch] = surf * 0.09 + crowd * 0.035
    for c in rng.uniform(1, max(1.5, n / SR - 1), size=max(1, int(n / SR / 6))):
        m = int(SR * 0.25); tt = np.arange(m) / SR
        f = 2200 - 900 * tt / tt[-1] + 200 * np.sin(2 * np.pi * 18 * tt)
        gull = 0.025 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1])
        s = int(c * SR); gl, gr = pan_gains(rng.uniform(-0.7, 0.7))
        out[0, s:s + m] += gull[: max(0, min(m, n - s))] * gl
        out[1, s:s + m] += gull[: max(0, min(m, n - s))] * gr
    return out


def ambience_layer(n, cfg, seed):
    """cfg: "auto" (assets/sfx/ambience_*.wav, else synth) | "synth" | "<file name>" | None/false."""
    if cfg in (None, False, "none"): return np.zeros((2, n)), "none"
    if cfg in ("auto", True):
        files = sorted(glob.glob(os.path.join(ASSETS, "sfx", "ambience_*.*")))
        if files: return loop_to(load_audio(files[0]), n) * 0.6, "file:" + os.path.basename(files[0])
        return synth_ambience(n, rng_for(seed, "ambience")), "synth"
    if cfg == "synth": return synth_ambience(n, rng_for(seed, "ambience")), "synth"
    p = find_asset("sfx", cfg)
    if not p: raise SystemExit(f"ambience file not found: assets/sfx/{cfg}")
    return loop_to(load_audio(p), n) * 0.6, "file:" + cfg


# ---------------------------------------------------------------- drone
DRONE_PARTIALS = [  # ratio, weight, intensity threshold where it fades in
    (0.25, 0.55, -1.0), (0.5, 0.65, -1.0), (1.0, 0.55, -1.0),
    (1.5, 0.30, 0.30), (2.0, 0.24, 0.45), (3.0, 0.14, 0.62), (4.0, 0.08, 0.78), (5.0, 0.05, 0.9),
]


def intensity_curve(keys, n, default_fade=1.5):
    """keys: list of dicts {t, v, fade, cut}. Smooth crossfades unless cut (1 frame)."""
    ctl_sr = 200
    m = int(np.ceil(n / SR * ctl_sr)) + 2
    tt = np.arange(m) / ctl_sr
    cur = np.zeros(m)
    v_prev = 0.0
    for k in sorted(keys, key=lambda k: k["t"]):
        ramp = FRAME if k.get("cut") else k.get("fade", default_fade)
        u = smoothstep(0, 1, np.clip((tt - k["t"]) / max(ramp, 1e-3), 0, 1))
        mask = tt >= k["t"]
        cur[mask] = v_prev + (k["v"] - v_prev) * u[mask]
        v_prev = k["v"]
    return np.interp(np.arange(n) / SR, tt, cur)


def drone_layer(inten, cfg, seed):
    n = len(inten)
    base = float(cfg.get("base", 700.0))
    t = np.arange(n) / SR
    rng = rng_for(seed, "drone")
    phases = rng.uniform(0, 2 * np.pi, size=(len(DRONE_PARTIALS), 2))
    out = np.zeros((2, n))
    for idx, (ratio, w, th) in enumerate(DRONE_PARTIALS):
        wt = w * (1.0 if th < 0 else smoothstep(th - 0.12, th + 0.08, inten))
        if ratio > 1: wt = wt * np.clip(inten, 0, 1) ** 0.6  # brightness follows intensity
        # main tone identical in L/R (mono-safe on phone speakers) + a quieter detuned layer for width
        main = np.sin(2 * np.pi * base * ratio * t + phases[idx, 0])
        for ch, det in enumerate((-0.0015, 0.0015)):
            wide = np.sin(2 * np.pi * base * ratio * (1 + det) * t + phases[idx, 1])
            out[ch] += wt * (main + 0.22 * wide)
    lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.07 * t + 0.4)
    gain = 0.16 * np.clip(inten, 0, 1) ** 1.1 * lfo
    synth = out * gain
    music = cfg.get("music")
    if music:
        files = sorted(glob.glob(os.path.join(ASSETS, "music", "*.*"))) if music == "auto" else [find_asset("music", music)]
        files = [f for f in files if f and not f.endswith(".gitkeep")]
        if files:
            mus = loop_to(load_audio(files[0]), n) * float(cfg.get("musicGain", 0.5)) * np.clip(inten, 0, 1)
            return mus if cfg.get("musicMode", "add") == "replace" else synth + mus
        print(f"  drone.music '{music}' not found in assets/music/, using the synth drone only")
    return synth


# ---------------------------------------------------------------- loudness + limiter
def lufs(x):
    """Integrated loudness, ITU-R BS.1770-4 (K-weighting, 400 ms blocks, -70/-10 gates). x: (2, n) at 48 kHz."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=-1), axis=-1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if y.shape[1] < blk: return -70.0
    sq = y ** 2
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(sq, axis=1)], axis=1)
    starts = np.arange(0, y.shape[1] - blk + 1, hop)
    z = ((cs[:, starts + blk] - cs[:, starts]) / blk).sum(axis=0)
    with np.errstate(divide="ignore"):
        l = -0.691 + 10 * np.log10(z + 1e-12)
    z = z[l > -70]
    if len(z) == 0: return -70.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z2 = z[(-0.691 + 10 * np.log10(z)) > rel]
    return float(-0.691 + 10 * np.log10(z2.mean())) if len(z2) else -70.0


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.15):
    """Linked-stereo lookahead peak limiter. Returns (y, max gain reduction dB)."""
    ceil = 10 ** (ceiling_db / 20)
    blk = 48  # 1 ms control blocks
    nb = int(np.ceil(x.shape[1] / blk))
    pad = np.zeros((2, nb * blk)); pad[:, :x.shape[1]] = x
    peak = np.abs(pad).max(axis=0).reshape(nb, blk).max(axis=1)
    req = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(round(lookahead * 1000))
    req = minimum_filter1d(req, size=2 * la + 1, mode="nearest")
    g = np.empty(nb); a = 1 - np.exp(-1e-3 / release); prev = 1.0
    for i in range(nb):  # instant attack (lookahead already applied), exponential release
        prev = min(req[i], prev + (1 - prev) * a); g[i] = prev
    gs = np.repeat(g, blk)[: x.shape[1]]
    gs = uniform_filter1d(gs, size=la * blk // 2 * 2 + 1, mode="nearest")
    gs = np.minimum(gs, np.repeat(req, blk)[: x.shape[1]])
    y = np.clip(x * gs, -ceil, ceil)
    return y, float(-20 * np.log10(max(gs.min(), 1e-9)))


def master(x, target_lufs=-14.0, ceiling_db=-1.0):
    """Normalize to target LUFS with a peak limiter. Returns (y, lufs, limiter_reduction_db, peak_db).
    limiter_reduction_db = how far the loudest peak would have gone above the ceiling without limiting."""
    l0 = lufs(x)
    if l0 <= -69: return x, l0, 0.0, float(20 * np.log10(np.abs(x).max() + 1e-12))
    unlimited_peak = 20 * np.log10(np.abs(x).max() + 1e-12) + (target_lufs - l0)
    src = x
    gain_db = target_lufs - l0
    for _ in range(10):  # raise the gain until the limited result lands on target (limiting eats loudness)
        y, _ = limiter(src * 10 ** (gain_db / 20), ceiling_db)
        err = target_lufs - lufs(y)
        if abs(err) < 0.1: break
        gain_db += err
    x = y
    return x, lufs(x), max(0.0, unlimited_peak - ceiling_db), float(20 * np.log10(np.abs(x).max() + 1e-12))
