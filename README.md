# video-test: faceless 3D short pipeline (prototype)

"What if Earth's gravity dropped to Moon level for 10 seconds?" Kuta Beach, 9:16, ~52s.

## Pipeline
1. `pipeline/script.json`: script per beat (text, caption highlight, camera shot, counter, SFX)
2. `python3 pipeline/build_audio.py pipeline/script.json public`
   - TTS per beat (Kokoro; stand-in for OmniVoice)
   - beat duration = voice duration, so scenes stay in sync automatically
   - procedural SFX + beach ambience, ducked under the voice
   - output: `public/audio/mix.wav` + `public/timeline.json`
3. `python3 pipeline/qa_transcript.py pipeline/script.json public/audio/vo.wav`
   - Whisper (sherpa-onnx base.en) re-listens to the VO and reports WER against the script
4. `npx remotion render src/index.ts Main out/video.mp4`
   - `src/sim.ts`: deterministic physics (gravity, jumps, falls, waves), frame = f(t)
   - `src/World.tsx`: low-poly 3D world (Three.js), camera per beat
   - `src/Overlay.tsx`: word captions, live counter, gravity meter

`pipeline/transcribe.py <video>` extracts text from a reference video.

## Models (not in the repo, download into `models/`)
- Kokoro: github.com/thewh1teagle/kokoro-onnx releases `model-files-v1.0`
- Whisper: github.com/k2-fsa/sherpa-onnx releases `asr-models/sherpa-onnx-whisper-base.en`

## OmniVoice (Indonesian voice clone)
1. Put a 3-10 s clip of your voice in `voices/me.wav`
2. In `pipeline/script.id.json`, set `tts.ref_text` to the exact words in that clip
3. `npm run audio:id`, then `npm run studio` / `npm run render`

## Not yet done
- AudioX (needs a separate Python 3.8 env)
- Word timing is estimated from syllables, not Whisper word timestamps
- Custom UI to repeat the process

## Run on your PC (GPU)
```
npm install
pip install kokoro-onnx soundfile sherpa-onnx numpy
# download models into models/ (see above)
npm run audio
npm run studio   # live preview in the browser
npm run render   # -> out/video.mp4
```
GL backend via env: `REMOTION_GL=angle` (Windows, default), `egl` (Linux NVIDIA), `swangle` (no GPU).
