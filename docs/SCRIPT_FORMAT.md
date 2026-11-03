# Script format (JSON)

One JSON file describes one video. `python pipeline/build_audio.py <script.json> public [export.wav]`
writes `public/audio/mix.wav` + `public/timeline.json`; Remotion renders from those.

There are two paths, chosen automatically:

| Path | When | Audio |
|---|---|---|
| **legacy** (Kuta) | no `"audio"` block, `voiceover` not false, `tts` not null | 24 kHz mono, peak-normalized, original procedural SFX. Byte-identical to the baseline. |
| **v2** (cinematic) | any of: `"audio": {...}`, `"voiceover": false`, `"tts": null` | 48 kHz stereo, drone, silence cuts, new SFX, -14 LUFS + limiter. |

Everything new is optional. Leave a field out and you get the old behaviour.

## Top level

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | string | required | |
| `locale` | string | `"en-US"` | number formatting (`id-ID` uses a decimal comma) |
| `voiceover` | bool | `true` | `false` = no TTS at all, beats use `duration` |
| `tts` | object or `null` | kokoro | `null` = no voice-over. Engines: see README |
| `captionStyle` | `"karaoke"` or `"editorial"` | `"karaoke"` | per-beat override possible |
| `titleCard` | object | none | see below; also replaces the legacy end card |
| `ui` | object | all `true` | `topChip`, `counter`, `gravityMeter`, `vignette`, `snapFlash` |
| `lead` / `tail` | seconds | `0.35` / `1.6` with VO, `0` / `0` without | silence before the first beat / after the last |
| `gap` | seconds | `0.28` | pause after each VO line |
| `mode` | `"scene"` or `"sfxdemo"` | `"scene"` | `sfxdemo` = black screen naming each sound |
| `audio` | object | none | v2 audio settings, see below |
| `endCard` | `[line1, accent, line2]` | | legacy end card text (when there is no `titleCard`) |

### `titleCard`
```json
"titleCard": {"title": "What if Earth stopped spinning?", "accent": "stopped",
              "subtitle": "A 10-SECOND SIMULATION", "hold": 2.5, "fadeOut": 0.6,
              "endHold": 2.0, "backdrop": 0.35, "loopBackdrop": 0.8, "color": "#FFC857"}
```
Shown over the scene from frame 0 for `hold` s, fades out in `fadeOut` s. Comes back for the
last `endHold` s as the end card. Frame 0 and the last frame look the same, so the video loops.
`accent`: one word or a list, drawn italic in `color`. The HUD and editorial captions hide while it shows.

### `audio` (v2 only)
```json
"audio": {"seed": 3, "ambience": "auto", "ambienceGain": 1.0,
          "drone": {"base": 700, "fade": 1.5, "music": null, "musicMode": "add", "musicGain": 0.5},
          "droneGain": 1.0, "sfxGain": 0.8, "duck": 0.55,
          "master": {"lufs": -14, "ceiling": -1.0}}
```
- `seed`: every random sound is seeded from this, so a script always renders the same audio.
- `ambience`: `"auto"` = first `assets/sfx/ambience_*.wav`, else synthetic beach; `"synth"`; a file name; `null` = none.
- `drone.base`: fundamental in Hz (650-750 recommended). `drone.music`: `"auto"` (first file in `assets/music/`)
  or a file name. `musicMode`: `"add"` (music + synth drone) or `"replace"`. Music follows the drone intensity.
- `duck`: how much ambience/SFX drop under voice-over (only with VO).
- `master`: integrated loudness target (ITU-R BS.1770) and limiter ceiling in dBFS (sample peak).

## Beat fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | unique |
| `text` | string | VO line (with VO) or caption text |
| `say` | string | spelling for TTS only |
| `caption` | string | editorial caption; defaults to `text`; `""` hides it |
| `captionStyle` | `"karaoke"` or `"editorial"` | per-beat override |
| `duration` | seconds | used when the beat has no VO (`voiceover: false`, `tts: null`, or `"novo": true`) |
| `novo` | bool | skip VO for this one beat |
| `label` | string | legacy top chip; `""` hides it |
| `highlight` | string[] | karaoke accent words |
| `shot` | string | camera shot name from `src/World.tsx` (`orbit_wide`, `beach_low`, `crowd_push`, `kid_follow`, `kid_side`, `wave_low`, `drift_up`, `crowd_air`, `crowd_air_hold`, `fall_drop`, `aftermath`, `orbit_end`) |
| `events` | list | scene events, see below |
| `counter` | object or `null` | legacy counter card `{label, from, to, unit, dec}` |
| `hud` | object | countdown HUD, see below |
| `drone` | number, object, or list | drone intensity keyframes, see below |
| `sfx` | list | sound events, see below |

### `events` (Kuta scene physics)
`["gravityDrop", {"name": "snap", "at": 0.8}]`. `at` = seconds into the beat.
Names: `gravityDrop`, `snap`, `massFall`, `kidJump`, `bigWave`, `drift`, `massJump`.
If no beat claims an event, the legacy beat ids are used (`drop`, `snap`, `fall`, `jump`, `waves`, `drift`, `everyone`).
If neither exists, the event never happens.

### `hud`
```json
"hud": {"label": "EARTH STOPS IN", "from": 5.0, "to": 0, "rate": 1.0,
        "sub": "TIME SLOWED DOWN 11x", "end": "BACK", "decimals": 3}
```
Shows `0:04.779`. `rate` = HUD seconds per video second (`1/11` for 11x slow motion).
`from: "continue"` picks up where the previous HUD beat stopped. When the value reaches `to`,
it shows `end` (if set). Counting up works too (`to` greater than `from`).

### `drone`
```json
"drone": 0.4
"drone": {"intensity": 0.6, "at": 0.3, "fade": 1.0}
"drone": [{"at": 0.0, "intensity": 0.9, "fade": 0.8}, {"at": 1.9, "intensity": 0.2, "cut": true}]
```
Intensity 0-1 controls volume, number of harmonics and brightness. Changes crossfade over `fade` s
(default 1.5) unless `"cut": true` (one frame). The drone is never muted by `silence_cut`.

### `sfx`
Every entry: `{"type": ..., "at": seconds into beat, "gain": 1.0, "pan": 0.0, "seed": optional}`.

| type | extra fields | sound |
|---|---|---|
| `silence_cut` | `frames` (2), `hold` (`"beat"`, `"end"`, or seconds), `resume` (1.0 s) | chokes ambience and every SFX already playing within 1-2 frames; drone stays |
| `impact` | `level`: `small`, `medium`, `huge` | broadband hit + sub boom 60/50/42 Hz, decay 1.5/2.2/3.0 s |
| `sweep_up`, `sweep_down` | `dur` (1.5), `from`, `to` (Hz) | exponential glissando; use both at the same `at` for a cue |
| `noise_wall` | `dur` (4), `intensity` (0.8), `fadeIn` (0.6), `fadeOut` (1.0), `color` (`pink`, `white`, `brown`), `lo`, `hi` (Hz) | thick filtered noise for climaxes |
| `shimmer` | `dur` (3), `density` (8/s), `fLo` (2000), `fHi` (4000) | glassy pings, seeded |
| `swell` | `dur` (1.5, clamp 0.6-3) | noise that rises then falls |
| `file` | `file`: name in `assets/sfx/` | or put the file name directly in `type`, e.g. `"type": "boom_01.wav"` |
| legacy | `whoosh`, `drop`, `rise`, `tick`, `wave`, `wind`, `snap`, `thuds` | the original Kuta sounds |
