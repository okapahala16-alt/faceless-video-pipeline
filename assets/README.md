# assets/
- `sfx/` sound effects. Call them from a script with `{"type": "file", "file": "boom.wav"}` or `{"type": "boom.wav"}`.
  Files named `ambience_*.wav` are used as ambience when `audio.ambience` is `"auto"`.
- `music/` drone beds / music. Used when `audio.drone.music` is `"auto"` or a file name.
Supported: wav, flac, ogg, mp3 (any sample rate, mono or stereo; resampled to 48 kHz).
Audio files here are git-ignored (keep large libraries out of the repo). Only use sounds you have the rights to.
