"""Cut a reference voice clip for OmniVoice from any video/audio file you own.
Usage:
  python pipeline/clip_voice.py "C:\\path\\to\\my_video.mp4" --start 12 --dur 8 --text "exact words spoken"
Saves voices/me.wav (24 kHz mono) and writes ref_audio/ref_text into pipeline/script.id.json.
Pick a part where only your voice is heard: no music, no other people."""
import os, sys, json, argparse, subprocess
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SR = 24000

ap = argparse.ArgumentParser()
ap.add_argument("src", help="video or audio file")
ap.add_argument("--start", type=float, default=0, help="start second")
ap.add_argument("--dur", type=float, default=8, help="length in seconds (3-10 recommended)")
ap.add_argument("--text", default=None, help="exact words spoken in the clip")
ap.add_argument("--script", default=os.path.join(HERE, "script.id.json"))
a = ap.parse_args()

if not os.path.exists(a.src):
    sys.exit(f"File not found: {a.src}")
if not 3 <= a.dur <= 12:
    print("Warning: 3-10 seconds works best; longer clips can run out of GPU memory.")
try:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    sys.exit("Run first:  python -m pip install imageio-ffmpeg")

raw = subprocess.run([ffmpeg, "-v", "error", "-ss", str(a.start), "-t", str(a.dur), "-i", a.src,
                      "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
if raw.returncode != 0 or not raw.stdout:
    sys.exit("Could not read audio: " + raw.stderr.decode(errors="ignore")[-400:])
x = np.frombuffer(raw.stdout, dtype=np.float32).copy()
peak = float(np.max(np.abs(x))) if len(x) else 0
if peak < 0.02:
    sys.exit("That part is (almost) silent. Try another --start.")
x = x / peak * 0.9
os.makedirs(os.path.join(ROOT, "voices"), exist_ok=True)
out = os.path.join(ROOT, "voices", "me.wav")
sf.write(out, x, SR)
print(f"Saved {os.path.abspath(out)} ({len(x) / SR:.1f} s)")

s = json.load(open(a.script, encoding="utf-8"))
tts = s.setdefault("tts", {}); tts.update({"engine": "omnivoice", "ref_audio": "voices/me.wav"})
if a.text:
    tts["ref_text"] = a.text
    print(f"ref_text written to {os.path.relpath(a.script, ROOT)}")
else:
    print("No --text given: put the exact words of the clip in tts.ref_text before generating.")
json.dump(s, open(a.script, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("Listen to voices\\me.wav first. If it has music or other voices, pick another --start.")
