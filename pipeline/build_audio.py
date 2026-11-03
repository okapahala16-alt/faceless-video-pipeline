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

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
