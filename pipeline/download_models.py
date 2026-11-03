"""Download Kokoro TTS + Whisper (sherpa-onnx) models into models/. Safe to re-run."""
import os, sys, tarfile, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
FILES = [
    ("kokoro-v1.0.onnx", "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"),
    ("voices-v1.0.bin", "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"),
    ("whisper-base.en.tar.bz2", "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2"),
]

def progress(name):
    def hook(blocks, bs, total):
        if total > 0:
            pct = min(100, blocks * bs * 100 // total)
            sys.stdout.write(f"\r  {name}: {pct}% of {total // 1_000_000} MB"); sys.stdout.flush()
    return hook

os.makedirs(ROOT, exist_ok=True)
for name, url in FILES:
    dest = os.path.join(ROOT, name)
    if name.endswith(".tar.bz2") and os.path.isdir(os.path.join(ROOT, "sherpa-onnx-whisper-base.en")):
        print(f"  {name}: already extracted, skip"); continue
    if os.path.exists(dest) and not name.endswith(".tar.bz2"):
        print(f"  {name}: already there, skip"); continue
    urllib.request.urlretrieve(url, dest + ".part", progress(name))
    os.replace(dest + ".part", dest); print()
    if name.endswith(".tar.bz2"):
        print("  extracting..."); tarfile.open(dest).extractall(ROOT); os.remove(dest)
print("Done. Models are in", os.path.abspath(ROOT))
