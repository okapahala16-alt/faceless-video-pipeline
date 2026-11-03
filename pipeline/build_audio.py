"""script.json -> per-beat TTS, procedural SFX, ambience, final mix + timeline.json for Remotion.
Usage: python build_audio.py script.json public
TTS engine is set in script.json "tts":
  {"engine": "kokoro"}                                   (English, CPU, default)
  {"engine": "omnivoice", "ref_audio": "voices/me.wav",  (voice clone, any language, GPU)
   "ref_text": "exact words in the clip", "language": "id", "num_step": 32}
  {"engine": "omnivoice", "instruct": "male, low pitch"} (voice design, best in English)"""
import sys, os, json, re
import numpy as np, soundfile as sf

SR = 24000
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "..", "models")
rng = np.random.default_rng(7)

# ---------- TTS ----------
def tts_kokoro(text, voice, speed):
    from kokoro_onnx import Kokoro
    global _K
    if "_K" not in globals():
        _K = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    samples, sr = _K.create(text, voice=voice, speed=speed, lang="en-us")
    assert sr == SR
    return trim(samples.astype(np.float32))

_OV = {}
def tts_omnivoice(text, cfg, speed):
    import torch
    from omnivoice import OmniVoice
    if "model" not in _OV:
        dev = "cuda:0" if torch.cuda.is_available() else "cpu"
        _OV["model"] = OmniVoice.from_pretrained(cfg.get("model", "k2-fsa/OmniVoice"), device_map=dev,
                                                 dtype=torch.float16 if dev != "cpu" else torch.float32)
        if cfg.get("ref_audio"):
            ref = os.path.join(HERE, "..", cfg["ref_audio"])
            if not cfg.get("ref_text"):
                sys.exit("tts.ref_text is required: type exactly what is said in the reference clip")
            _OV["prompt"] = _OV["model"].create_voice_clone_prompt(ref_audio=ref, ref_text=cfg["ref_text"])
    kw = {"language": cfg.get("language"), "num_step": cfg.get("num_step", 32)}
    if speed and speed != 1.0: kw["speed"] = speed
    if "prompt" in _OV: kw["voice_clone_prompt"] = _OV["prompt"]
    elif cfg.get("instruct"): kw["instruct"] = cfg["instruct"]
    out = _OV["model"].generate(text=text, **kw)
    return trim(np.asarray(out[0], dtype=np.float32))

def synth(text, sc):
    cfg = sc.get("tts", {"engine": "kokoro"})
    if cfg.get("engine") == "omnivoice":
        return tts_omnivoice(text, cfg, sc.get("speed", 1.0))
    return tts_kokoro(text, sc.get("voice", "am_michael"), sc.get("speed", 1.0))

def trim(a, thr=0.01):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0: return a
    return a[max(0, idx[0] - 600): idx[-1] + 1200]

# ---------- word timing (proportional by syllable weight, pauses at punctuation) ----------
def word_times(text, dur):
    words = text.split()
    def weight(w):
        core = re.sub(r"[^\w']", "", w)
        syl = max(1, len(re.findall(r"[aeiouy]+", core.lower())))
        pause = 1.6 if re.search(r"[.?!]$", w) else (0.9 if w.endswith(",") else 0)
        return syl + 0.15 * len(core), pause
    ws = [weight(w) for w in words]
    total = sum(a + p for a, p in ws)
    t, out = 0.0, []
    for w, (a, p) in zip(words, ws):
        d = dur * a / total
        out.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)})
        t += d + dur * p / total
    return out

# ---------- procedural SFX ----------
def env(n, a=0.01, r=0.3):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / r)
    return e

def lp(x, k):  # one-pole lowpass, k in (0,1)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc); y[i] = acc
    return y

def noise(n): return rng.standard_normal(n).astype(np.float32)

def sfx(kind):
    if kind == "whoosh":
        n = int(SR * 0.9); x = noise(n); t = np.linspace(0, 1, n)
        k = 0.02 + 0.25 * np.sin(np.pi * t) ** 2
        y = np.empty(n); acc = 0
        for i in range(n): acc += k[i] * (x[i] - acc); y[i] = acc
        return 0.9 * y * np.sin(np.pi * t) ** 1.5
    if kind == "drop":   # descending sine sweep + sub rumble
        n = int(SR * 1.6); t = np.arange(n) / SR
        f = 420 * np.exp(-t * 2.2) + 40
        ph = 2 * np.pi * np.cumsum(f) / SR
        return 0.5 * np.sin(ph) * env(n, 0.02, 0.9) + 0.25 * lp(noise(n), 0.01) * env(n, 0.05, 1.0) * 6
    if kind == "rise":
        n = int(SR * 1.2); t = np.arange(n) / SR
        f = 180 + 520 * (t / t[-1]) ** 1.5
        ph = 2 * np.pi * np.cumsum(f) / SR
        return 0.25 * np.sin(ph) * np.sin(np.pi * t / t[-1])
    if kind == "tick":
        out = np.zeros(int(SR * 1.2))
        for i in range(5):
            n = int(SR * 0.04); t = np.arange(n) / SR
            s = int(SR * 0.2 * i); out[s:s + n] += 0.35 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90)
        return out
    if kind == "wave":
        n = int(SR * 3.2); t = np.linspace(0, 1, n)
        shape = np.clip(np.sin(np.pi * t ** 0.7), 0, 1) ** 2
        return 2.2 * lp(noise(n), 0.06) * shape
    if kind == "wind":
        n = int(SR * 4.0); t = np.linspace(0, 1, n)
        mod = 0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * t * 4)
        return 3.0 * lp(noise(n), 0.015) * mod * np.sin(np.pi * t)
    if kind == "snap":
        n = int(SR * 0.7); t = np.arange(n) / SR
        return 0.9 * (noise(n) * np.exp(-t * 40) * 0.5 + np.sin(2 * np.pi * 70 * t) * np.exp(-t * 6))
    if kind == "thuds":
        out = np.zeros(int(SR * 2.2))
        for i in range(26):
            s = int(SR * abs(rng.normal(0.5, 0.35))); n = int(SR * 0.35); t = np.arange(n) / SR
            f = rng.uniform(55, 95)
            th = (np.sin(2 * np.pi * f * t) * np.exp(-t * 14) + 0.3 * lp(noise(n), 0.08) * np.exp(-t * 25) * 3)
            s = min(s, len(out) - n); out[s:s + n] += 0.22 * th
        return out
    raise ValueError(kind)

def ambience(n):
    # surf: slow-modulated lowpassed noise; distant crowd: bandish noise; gulls: chirps
    t = np.arange(n) / SR
    surf = lp(noise(n), 0.03) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 7.0) ** 2) * 1.3
    crowd = (lp(noise(n), 0.2) - lp(noise(n), 0.05)) * 0.35
    out = 0.09 * surf + 0.05 * crowd
    for c in rng.uniform(1, n / SR - 1, size=int(n / SR / 6)):
        m = int(SR * 0.25); tt = np.arange(m) / SR
        f = 2200 - 900 * tt / tt[-1] + 200 * np.sin(2 * np.pi * 18 * tt)
        s = int(c * SR); out[s:s + m] += 0.03 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1])
    return out

def place(buf, clip, at, gain=1.0):
    s = int(at * SR); e = min(len(buf), s + len(clip))
    if s < len(buf): buf[s:e] += gain * clip[: e - s]

# ---------- main ----------
def main(script_path, public_dir):
    sc = json.load(open(script_path))
    os.makedirs(os.path.join(public_dir, "audio"), exist_ok=True)
    lead, tail = 0.35, 1.6
    t = lead; beats = []; vo_clips = []
    for b in sc["beats"]:
        a = synth(b.get("say", b["text"]), sc)
        d = len(a) / SR
        beats.append({**b, "start": round(t, 3), "voStart": round(t, 3), "voDur": round(d, 3),
                      "words": [{**w, "s": round(w["s"] + t, 3), "e": round(w["e"] + t, 3)} for w in word_times(b["text"], d)]})
        vo_clips.append((t, a)); t += d + sc.get("gap", 0.28)
    total = t + tail
    for i, b in enumerate(beats):
        b["end"] = beats[i + 1]["start"] if i + 1 < len(beats) else round(total, 3)
    n = int(total * SR)
    vo = np.zeros(n); fx = np.zeros(n)
    for at, a in vo_clips: place(vo, a, at)
    for b in beats:
        for s in b.get("sfx", []): place(fx, sfx(s["type"]), b["start"] + s["at"], s.get("gain", 1.0))
    amb = ambience(n)
    # duck ambience+fx under voice
    vo_env = lp(np.abs(vo), 0.0008) * 8
    duck = 1 - 0.55 * np.clip(vo_env, 0, 1)
    mix = vo * 1.0 + (fx * 0.55 + amb) * duck
    mix = mix / max(1e-6, np.max(np.abs(mix))) * 0.89
    sf.write(os.path.join(public_dir, "audio", "mix.wav"), mix.astype(np.float32), SR)
    sf.write(os.path.join(public_dir, "audio", "vo.wav"), vo.astype(np.float32), SR)
    tl = {"title": sc["title"], "fps": 30, "duration": round(total, 3), "locale": sc.get("locale", "en-US"),
          "endCard": sc.get("endCard", ["Where would", "you", "stand?"]), "beats": beats}
    json.dump(tl, open(os.path.join(public_dir, "timeline.json"), "w"), indent=1)
    print(f"total {total:.2f}s, {len(beats)} beats")
    for b in beats: print(f"  {b['start']:6.2f}-{b['end']:6.2f} {b['id']:9s} vo {b['voDur']:.2f}s")


# ======================================================================================
# v2: cinematic format (no-VO capable). Used only when the script opts in, see is_legacy().
# ======================================================================================
def is_legacy(sc):
    """Old scripts (Kuta EN/ID) have no "audio" block, have voice-over, and a tts engine.
    They keep going through main() above, untouched, so they render byte-identical audio."""
    return "audio" not in sc and sc.get("voiceover", True) is not False and sc.get("tts", "unset") is not None

NEW_SFX = {"impact", "sweep_up", "sweep_down", "noise_wall", "shimmer", "swell", "silence_cut", "file",
           "tick", "ticks", "riser", "undertow"}
LEGACY_SFX = {"whoosh", "drop", "rise", "tick", "wave", "wind", "snap", "thuds"}
AUDIO_EXT = (".wav", ".mp3", ".flac", ".ogg", ".aif", ".aiff")

def _legacy_sfx_stereo(kind):
    from audio_fx import SR as SR2
    mono = sfx(kind)  # 24 kHz mono from the original generator
    n2 = int(round(len(mono) * SR2 / SR))
    up = np.interp(np.arange(n2) / SR2, np.arange(len(mono)) / SR, mono)
    return np.vstack([up, up]) * 0.7

def _render_sfx(ev, seed, idx):
    """Returns (stereo clip, label) for one sfx entry."""
    import audio_fx as fx
    kind = ev.get("type", "file")
    rng = fx.rng_for(ev.get("seed", seed), "sfx", idx, kind)
    if kind.lower().endswith(AUDIO_EXT) or kind == "file":
        name = ev.get("file", kind)
        path = fx.find_asset("sfx", name)
        if not path: raise SystemExit(f"sfx file not found: assets/sfx/{name}")
        return fx.load_audio(path), f"file: {name}"
    if kind == "impact":
        lvl = ev.get("level", "medium"); return fx.impact(lvl, rng), f"impact ({lvl})"
    if kind in ("sweep_up", "sweep_down"):
        d = ev.get("dur", 1.5); direction = "up" if kind == "sweep_up" else "down"
        clip = fx.sweep(direction, d, ev.get("from"), ev.get("to"), rng)
        lo, hi = (ev.get("from"), ev.get("to"))
        return clip, f"{kind} {d:g}s" + (f" {lo:g}→{hi:g}Hz" if lo and hi else "")
    if kind == "noise_wall":
        return fx.noise_wall(ev.get("dur", 4.0), ev.get("intensity", 0.8), ev.get("fadeIn", 0.6), ev.get("fadeOut", 1.0),
                             ev.get("color", "pink"), ev.get("lo", 60), ev.get("hi", 7000), rng), f"noise_wall ({ev.get('intensity', 0.8):g})"
    if kind == "shimmer":
        return fx.shimmer(ev.get("dur", 3.0), ev.get("density", 8.0), ev.get("fLo", 2000), ev.get("fHi", 4000), rng), "shimmer"
    if kind == "swell":
        return fx.swell(ev.get("dur", 1.5), rng), "swell"
    if kind == "tick":  # v2: one click (the legacy 5-click pattern is "ticks")
        return fx.tick(rng), "tick"
    if kind == "ticks":
        return _legacy_sfx_stereo("tick"), "ticks (5)"
    if kind == "riser":
        d = ev.get("dur", 6.0)
        return fx.riser(d, ev.get("from", 150.0), ev.get("to", 1800.0), ev.get("curve", 2.0), ev.get("tone", 0.35),
                        ev.get("fadeOut", 0.15), rng), f"riser {d:g}s"
    if kind == "undertow":
        d = ev.get("dur", 9.0)
        return fx.undertow(d, ev.get("intensity", 0.6), ev.get("cutoffFrom", 900.0), ev.get("cutoffTo", 160.0),
                           ev.get("period", 2.4), ev.get("drift", 0.5), rng), f"undertow {d:g}s"
    if kind in LEGACY_SFX:
        return _legacy_sfx_stereo(kind), kind
    raise SystemExit(f"unknown sfx type '{kind}'. Synth types: {sorted(NEW_SFX | LEGACY_SFX)}, or a file name in assets/sfx/")

def main_v2(sc, public_dir, export_wav=None):
    import audio_fx as fx
    A = sc.get("audio") or {}
    seed = int(A.get("seed", 1))
    voiceover = sc.get("voiceover", True) is not False and sc.get("tts", "unset") is not None
    gap = sc.get("gap", 0.28)
    lead = sc.get("lead", 0.35 if voiceover else 0.0)
    tail = sc.get("tail", 1.6 if voiceover else 0.0)
    os.makedirs(os.path.join(public_dir, "audio"), exist_ok=True)

    # ---- timing: VO length when there is voice-over, otherwise the beat's "duration"
    t = lead; beats = []; vo_clips = []
    for b in sc["beats"]:
        has_vo = voiceover and not b.get("novo") and (b.get("say") or b.get("text"))
        if has_vo:
            a = synth(b.get("say", b["text"]), sc); d = len(a) / SR
            words = word_times(b["text"], d); length = d + gap
            vo_clips.append((t, a))
        else:
            if "duration" not in b: print(f"  beat '{b['id']}' has no VO and no duration, using 3.0 s")
            length = float(b.get("duration", 3.0)); d = 0.0
            words = word_times(b["text"], length * 0.8) if b.get("text") else []
            words = [{**w, "s": w["s"] + 0.1, "e": w["e"] + 0.1} for w in words]
        beats.append({**b, "start": round(t, 3), "voStart": round(t, 3), "voDur": round(d, 3),
                      "words": [{**w, "s": round(w["s"] + t, 3), "e": round(w["e"] + t, 3)} for w in words]})
        t += length
    total = t + tail
    for i, b in enumerate(beats):
        b["end"] = beats[i + 1]["start"] if i + 1 < len(beats) else round(total, 3)
    n = int(round(total * fx.SR))
    events = []

    # ---- drone intensity keyframes from beats
    keys = []
    for b in beats:
        dr = b.get("drone")
        if dr is None: continue
        for k in (dr if isinstance(dr, list) else [dr]):
            k = {"intensity": k} if isinstance(k, (int, float)) else k
            keys.append({"t": b["start"] + k.get("at", 0.0), "v": float(k.get("intensity", 0.0)),
                         "fade": k.get("fade", A.get("drone", {}).get("fade", 1.5) if isinstance(A.get("drone"), dict) else 1.5),
                         "cut": bool(k.get("cut", False))})
    drone_cfg = A.get("drone", {}) if isinstance(A.get("drone"), dict) else {}
    if keys or drone_cfg:
        inten = fx.intensity_curve(keys, n)
        drone = fx.drone_layer(inten, drone_cfg, seed)
        for i, k in enumerate(sorted(keys, key=lambda k: k["t"])):
            nxt = sorted(keys, key=lambda k: k["t"])[i + 1]["t"] if i + 1 < len(keys) else total
            if k["v"] > 0: events.append({"name": f"drone {k['v']:.2f}" + (" (cut)" if k["cut"] else ""), "start": round(k["t"], 3), "end": round(nxt, 3)})
    else:
        drone = np.zeros((2, n))

    # ---- ambience
    amb, amb_src = fx.ambience_layer(n, A.get("ambience", "auto"), seed)
    amb *= float(A.get("ambienceGain", 1.0))

    # ---- opt-in punch treatment for big impacts (audio.punch): soft-clip + bed pre-duck
    P = A.get("punch") if isinstance(A.get("punch"), dict) else None
    punch_levels = set(P.get("levels", ["huge"])) if P else set()
    punch_hits = []

    # ---- sfx events (+ silence cuts)
    clips = []; cuts = []; on_imp_bus = []
    idx = 0
    for b in beats:
        for ev in b.get("sfx", []):
            at = b["start"] + float(ev.get("at", 0.0)); idx += 1
            if ev.get("type") == "silence_cut":
                hold = ev.get("hold", "beat")
                until = total + 1 if hold == "end" else (b["end"] if hold == "beat" else at + float(hold))
                cuts.append({"t": at, "len": max(1, int(ev.get("frames", 2))) * fx.FRAME, "until": until, "resume": float(ev.get("resume", 1.0))})
                events.append({"name": "silence_cut", "start": round(at, 3), "end": round(at + 0.8, 3)})
                continue
            clip, label = _render_sfx(ev, seed, idx)
            gl, gr = fx.pan_gains(ev.get("pan", 0.0))
            clip = clip * float(ev.get("gain", 1.0)) * np.array([[gl], [gr]])
            is_punch = bool(P) and ev.get("type") == "impact" and ev.get("punch", ev.get("level", "medium") in punch_levels)
            if is_punch:  # per-event "mid" / "softClip" / "duck" override the audio.punch defaults
                mid = float(ev.get("mid", P.get("mid", 0.0)))
                if mid > 0:  # phone-band layer, scaled to the impact's own peak, before the saturation
                    ml = fx.impact_mid(float(ev.get("midDecay", P.get("midDecay", 0.3))), float(ev.get("midFreq", P.get("midFreq", 170.0))),
                                       fx.rng_for(ev.get("seed", seed), "mid", idx))
                    m = min(ml.shape[1], clip.shape[1])
                    clip = clip.copy(); clip[:, :m] += ml[:, :m] * mid * np.abs(clip).max()
                clip = fx.soft_clip(clip, float(ev.get("softClip", P.get("softClip", 0.0))))
                punch_hits.append((at, float(ev.get("duck", P.get("duck", 0.0)))))
            on_imp_bus.append(is_punch)
            clips.append((int(at * fx.SR), clip))
            events.append({"name": label, "start": round(at, 3), "end": round(at + clip.shape[1] / fx.SR, 3)})
    fxbus = np.zeros((2, n)); impbus = np.zeros((2, n)) if P else None
    tt = np.arange(n) / fx.SR
    for ci, (s0, clip) in enumerate(clips):
        m = min(clip.shape[1], n - s0)
        if m <= 0: continue
        c = clip[:, :m].copy()
        for cu in cuts:  # sounds that started before a cut get choked within 1-2 frames
            if s0 / fx.SR < cu["t"] < (s0 + m) / fx.SR:
                lt = tt[s0:s0 + m]
                c *= 1 - fx.smoothstep(cu["t"], cu["t"] + cu["len"], lt)
        if P and on_imp_bus[ci]: impbus[:, s0:s0 + m] += c
        else: fxbus[:, s0:s0 + m] += c
    amb_gate = np.ones(n)
    for cu in cuts:
        down = 1 - fx.smoothstep(cu["t"], cu["t"] + cu["len"], tt)
        up = fx.smoothstep(cu["until"], cu["until"] + cu["resume"], tt)
        amb_gate *= np.maximum(down, up)
    amb *= amb_gate
    if amb_src != "none":
        on = amb_gate > 0.05
        edges = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(int), [0]])))
        for a0, a1 in zip(edges[::2], edges[1::2]):
            events.append({"name": f"ambience ({amb_src})", "start": round(a0 / fx.SR, 3), "end": round(a1 / fx.SR, 3)})

    # ---- voice-over (optional) + ducking
    vo2 = np.zeros((2, n))
    if vo_clips:
        for at, a in vo_clips:
            up = np.interp(np.arange(int(len(a) * fx.SR / SR)) / fx.SR, np.arange(len(a)) / SR, a)
            s0 = int(at * fx.SR); m = min(len(up), n - s0); vo2[:, s0:s0 + m] += up[:m]
        from scipy.signal import lfilter
        env = lfilter([0.0008], [1, -0.9992], np.abs(vo2[0])) * 8
        duck = 1 - float(A.get("duck", 0.55)) * np.clip(env, 0, 1)
        amb *= duck; fxbus *= duck; drone *= 1 - 0.3 * np.clip(env, 0, 1)
        sf.write(os.path.join(public_dir, "audio", "vo.wav"), vo2[0].astype(np.float32), fx.SR)

    duck_hits = [(h, d) for h, d in punch_hits if d > 0]
    if duck_hits:
        # bed = drone, ambience and every sfx that is not a punch impact; dips just before each hit
        pre, hold, rel = float(P.get("duckPre", 0.25)), float(P.get("duckHold", 0.12)), float(P.get("duckRelease", 0.8))
        dk = fx.duck_curve(n, duck_hits, pre=pre, hold=hold, release=rel)
        drone = drone * dk; amb = amb * dk; fxbus = fxbus * dk
        for h, d in duck_hits: events.append({"name": f"pre-duck -{d:g} dB", "start": round(h - pre, 3), "end": round(h + hold + rel, 3)})
    mix = vo2 + drone * float(A.get("droneGain", 1.0)) + amb * 0.5 + fxbus * float(A.get("sfxGain", 0.8))
    if P: mix = mix + impbus * float(A.get("sfxGain", 0.8)) * float(P.get("impactGain", 1.0))
    mcfg = A.get("master", {})
    gr_curve = None
    if "maxReduction" in mcfg:  # opt-in: lower the loudness target (down to minLufs) to cap limiter reduction
        mix, out_lufs, gr, peak, gr_curve, tgt = fx.master_capped(mix, float(mcfg.get("lufs", -14.0)), float(mcfg.get("ceiling", -1.0)),
                                                                  float(mcfg["maxReduction"]), float(mcfg.get("minLufs", mcfg.get("lufs", -14.0))),
                                                                  float(mcfg.get("lufsStep", 0.25)),
                                                                  float(mcfg["truePeak"]) if "truePeak" in mcfg else None)
    else:
        mix, out_lufs, gr, peak = fx.master(mix, float(mcfg.get("lufs", -14.0)), float(mcfg.get("ceiling", -1.0)))
    sf.write(os.path.join(public_dir, "audio", "mix.wav"), mix.T.astype(np.float32), fx.SR)
    if export_wav:
        os.makedirs(os.path.dirname(os.path.abspath(export_wav)), exist_ok=True)
        sf.write(export_wav, mix.T.astype(np.float32), fx.SR)

    tl = {"title": sc["title"], "fps": 30, "duration": round(total, 3), "locale": sc.get("locale", "en-US"),
          "mode": sc.get("mode", "scene"), "scene": sc.get("scene", "kuta"), "voiceover": voiceover, "captionStyle": sc.get("captionStyle", "karaoke"),
          "titleCard": sc.get("titleCard"), "ui": sc.get("ui", {}), "audioEvents": sorted(events, key=lambda e: e["start"]),
          "beats": beats}
    if "endCard" in sc: tl["endCard"] = sc["endCard"]
    if "accentColor" in sc: tl["accentColor"] = sc["accentColor"]
    if "lighting" in sc: tl["lighting"] = sc["lighting"]
    json.dump(tl, open(os.path.join(public_dir, "timeline.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"total {total:.2f}s, {len(beats)} beats, voiceover={voiceover}, ambience={amb_src}")
    print(f"master: {out_lufs:.1f} LUFS, peak {peak:.1f} dBFS, limiter max reduction {gr:.1f} dB, stereo 48 kHz")
    if gr_curve is not None:
        print(f"  true peak (4x oversampled): {fx.true_peak_db(mix):.2f} dBTP")
        if tgt < float(mcfg.get("lufs", -14.0)) - 1e-6:
            print(f"  target lowered to {tgt:.2f} LUFS to keep the limiter under {float(mcfg['maxReduction']):g} dB" +
                  ("" if gr <= float(mcfg["maxReduction"]) + 1e-6 else f" (NOT reached at minLufs: {gr:.1f} dB)"))
        imp_t = sorted({e["start"] for e in events if e["name"].startswith("impact")})
        print("  limiter at impacts: " + ", ".join(f"{t:.2f}s {gr_curve[int(t * fx.SR):int((t + 0.25) * fx.SR)].max():.1f} dB" for t in imp_t))
    for b in beats: print(f"  {b['start']:6.2f}-{b['end']:6.2f} {b['id']:12s}" + (f" vo {b['voDur']:.2f}s" if b['voDur'] else ""))

if __name__ == "__main__":
    _sc = json.load(open(sys.argv[1], encoding="utf-8"))
    if is_legacy(_sc):
        main(sys.argv[1], sys.argv[2])
    else:
        sys.path.insert(0, HERE)
        main_v2(_sc, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
