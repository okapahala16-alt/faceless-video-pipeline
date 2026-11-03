"""Transcribe audio/video with Whisper (sherpa-onnx). Chunks audio into ~25s windows.
Usage: python transcribe.py <media> [out.json]"""
import sys, json, subprocess, numpy as np, sherpa_onnx, os
M = os.path.join(os.path.dirname(__file__), "..", "models", "sherpa-onnx-whisper-base.en")
def load(path):
    raw = subprocess.run(["ffmpeg","-v","error","-i",path,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def recognizer():
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=f"{M}/base.en-encoder.int8.onnx", decoder=f"{M}/base.en-decoder.int8.onnx",
        tokens=f"{M}/base.en-tokens.txt", language="en", task="transcribe", num_threads=4)
def transcribe(path, win=25.0):
    a = load(path); r = recognizer(); sr = 16000; out = []
    for s in np.arange(0, len(a)/sr, win):
        seg = a[int(s*sr):int((s+win)*sr)]
        if len(seg) < sr*0.3: continue
        st = r.create_stream(); st.accept_waveform(sr, seg); r.decode_stream(st)
        out.append({"start": round(float(s),2), "end": round(float(min(s+win, len(a)/sr)),2), "text": st.result.text.strip()})
    return {"duration": len(a)/sr, "segments": out}
if __name__ == "__main__":
    res = transcribe(sys.argv[1])
    txt = " ".join(s["text"] for s in res["segments"]); w = len(txt.split())
    res["words"] = w; res["wps"] = round(w/res["duration"],2)
    if len(sys.argv) > 2: json.dump(res, open(sys.argv[2],"w"), indent=1)
    print(json.dumps(res, indent=1))
