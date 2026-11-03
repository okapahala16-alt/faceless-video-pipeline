"""Whisper QA: transcribe VO and compute word error rate vs script."""
import sys, json, re
from transcribe import transcribe
def norm(s): return re.sub(r"[^a-z0-9' ]", " ", s.lower().replace("-", " ")).split()
def wer(r, h):
    d = [[i + j if i * j == 0 else 0 for j in range(len(h) + 1)] for i in range(len(r) + 1)]
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (r[i-1] != h[j-1]))
    return d[-1][-1] / max(1, len(r))
sc = json.load(open(sys.argv[1])); ref = norm(" ".join(b["text"] for b in sc["beats"]))
hyp_txt = " ".join(s["text"] for s in transcribe(sys.argv[2])["segments"])
hyp = norm(hyp_txt.replace("1.6", "one point six"))
print("WHISPER:", hyp_txt); print(f"WER vs script: {wer(ref, hyp)*100:.1f}%")
