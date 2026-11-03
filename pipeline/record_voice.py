"""Record your reference voice for OmniVoice cloning.
Shows a sentence, counts down, records from the default mic, saves voices/me.wav,
and writes the sentence into tts.ref_text of the script.
Usage: python pipeline/record_voice.py [pipeline/script.id.json] [seconds]"""
import os, sys, json, time
import numpy as np, soundfile as sf, sounddevice as sd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
script = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "script.id.json")
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 9
SR = 24000
SENTENCE = ("Halo, ini suara gue. Gue lagi nyobain bikin video pakai AI, "
            "dan semoga hasilnya keren banget.")

print("\nBaca kalimat ini dengan santai, jelas, dan nggak buru-buru:\n")
print("   >>  " + SENTENCE + "\n")
print("Tips: ruangan sepi, mic jangan terlalu dekat, tanpa musik.\n")
input("Tekan Enter kalau udah siap...")
for i in (3, 2, 1):
    print(f"  {i}..."); time.sleep(1)
print(f"  REKAM! ({int(secs)} detik)")
audio = sd.rec(int(secs * SR), samplerate=SR, channels=1, dtype="float32")
sd.wait()
a = audio[:, 0]
peak = float(np.max(np.abs(a)))
if peak < 0.02:
    sys.exit("\nSuaranya hampir nggak kerekam. Cek mic di Settings > Privacy > Microphone, terus coba lagi.")
idx = np.where(np.abs(a) > peak * 0.05)[0]
a = a[max(0, idx[0] - 2400): idx[-1] + 4800]
a = a / peak * 0.9
os.makedirs(os.path.join(ROOT, "voices"), exist_ok=True)
out = os.path.join(ROOT, "voices", "me.wav")
sf.write(out, a, SR)
print(f"\nTersimpan: {os.path.abspath(out)} ({len(a) / SR:.1f} detik)")

s = json.load(open(script, encoding="utf-8"))
s.setdefault("tts", {}).update({"engine": "omnivoice", "ref_audio": "voices/me.wav", "ref_text": SENTENCE})
json.dump(s, open(script, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"ref_text ditulis ke {os.path.relpath(script, ROOT)}")
print("\nDengerin dulu hasilnya: buka file voices\\me.wav. Kalau jelek, jalanin script ini lagi.")
