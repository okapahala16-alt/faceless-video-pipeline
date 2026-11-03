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
| `scene` | `"kuta"` or `"copacabana"` | `"kuta"` | which 3D world to render (see Scenes below) |
| `lighting` | `"day"` or `"golden"` | `"day"` | Copacabana only: `golden` = late-afternoon sun ~13° up in the true west (behind the towers), warm sky/fog, long shadows |
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
| `accentColor` | hex string | `titleCard.color`, else `#FFC857` | episode accent: editorial highlights, counter label under a HUD, amber trails and visible air |

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

**Limiter cap + punch (opt-in, v2):**
```json
"master": {"lufs": -14, "ceiling": -1.0, "maxReduction": 3, "minLufs": -16, "lufsStep": 0.25, "truePeak": -1.0},
"punch": {"levels": ["huge"], "softClip": 12, "duck": 10, "duckPre": 0.3, "duckHold": 0.15, "duckRelease": 1.5, "impactGain": 1.3, "mid": 0.8, "midDecay": 0.4, "midFreq": 170}
```
- `maxReduction`: if the limiter would cut more than this (dB), the target drops by `lufsStep` until `minLufs`.
- `punch`: impacts whose `level` is in `levels` go to their own bus, soft-clipped `softClip` dB below their own peak
  (harmonics that survive phone speakers); every other layer (drone, ambience, other SFX) is ducked `duck` dB from
  `duckPre` s before the hit, held `duckHold` s, released over `duckRelease` s. Per impact override: `"punch": true/false`, `"softClip"`, `"duck"`, `"mid"`.
- `mid`: adds a saturated mid layer (body falling from ~2x `midFreq`, crack 500 Hz-4 kHz, slam 250-1500 Hz) so hits read on phone speakers.
- `truePeak`: lowers the ceiling until the 4x-oversampled peak is under this (dBTP).
- Tip: put a literal non-breaking space (U+00A0) between a number and its unit in captions (`1,670\u00a0km/h`) so they never split across lines.


## Scenes
| scene | file | own shots (plus every Kuta shot name as a fallback) |
|---|---|---|
| `kuta` | `src/World.tsx` | `orbit_wide`, `beach_low`, `crowd_push`, `kid_follow`, `kid_side`, `wave_low`, `drift_up`, `crowd_air`, `crowd_air_hold`, `fall_drop`, `aftermath`, `orbit_end` |
| `copacabana` | `src/scenes/Copacabana.tsx` | `bay_aerial` (establishing: city, bay, Sugarloaf-like dome), `promenade_low` (wave pavement), `crowd_sand`, `skyline_from_sea`, `sugarloaf`, `avenue`, `copa_crowd_level`, `tracking_east_with_crowd`, `tracking_east_close` |

Both scenes share the sea, the 190 physics people and the props, so every `events` name works in both.
Copacabana adds ~520 background people and 150 umbrellas along the bay (instanced). They ignore the Kuta
events, but drift east with everyone else on `freeDriftEast`; so do the cars on the Avenida.

New Copacabana shots (consecutive beats with the same shot continue one camera move, they do not restart):

| shot | camera |
|---|---|
| `copa_crowd_level` | eye level (1.6 m) in a gap of the crowd, looking north-east along the beach toward Leme. Once `freeDriftEast` runs the camera is a free body too and drifts east with the crowd (`EAST * driftAt(t)`). |
| `tracking_east_with_crowd` | rides east with the crowd from the sea side, a little ahead, looking back at the receding (slate) beach and city |
| `tracking_east_close` | close-up of one adult from the middle of the crowd (picked so they face the camera), floating with them; turns at half their spin |

Props, umbrellas and background people within ~3 m of the camera (people ~1.6 m, and anyone between the
camera and a close-up subject) are hidden in Copacabana, using the pure `cameraAt(frame)` pose.

### Direction convention: `EAST`
World coordinates are not rotated. The beach runs along x (-x = north-east, Leme), the sea is at -z
(south-east), land at +z. True east is `EAST = normalize(-0.60, 0, -0.80)` (`src/sim.ts`): out to sea and a
little toward Leme. Every "moves east" effect uses `EAST`, never +x.

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
| `highlight` | string[] | accent words. Karaoke: per word. Editorial: words or phrases (`"no wind"`, `"two kilometres"`), case and punctuation ignored, drawn semibold in `accentColor` |
| `grade` | `"normal"` or `"split"` | colour grade, default normal. `split`: everything anchored to the Earth (sand, promenade, road, buildings, hills, domes, kiosks, posts, nets, palms) turns cold slate `#5B6672`, almost no saturation, a bit darker; free things (people, props, cars, water, air) keep their colour and get amber motion trails while they drift. Sky and clouds unchanged. Changes between beats cross over 2 frames |
| `shot` | string | camera shot name from `src/World.tsx` (`orbit_wide`, `beach_low`, `crowd_push`, `kid_follow`, `kid_side`, `wave_low`, `drift_up`, `crowd_air`, `crowd_air_hold`, `fall_drop`, `aftermath`, `orbit_end`) |
| `events` | list | scene events, see below |
| `counter` | object or `null` | legacy counter card `{label, from, to, unit, dec}`. In a beat with a `hud` it sits centred under the HUD, label in `accentColor` |
| `hud` | object | countdown HUD, see below |
| `drone` | number, object, or list | drone intensity keyframes, see below |
| `sfx` | list | sound events, see below |

### `events` (Kuta scene physics)
`["gravityDrop", {"name": "snap", "at": 0.8}]`. `at` = seconds into the beat.
Names: `gravityDrop`, `snap`, `massFall`, `kidJump`, `bigWave`, `drift`, `massJump`.
If no beat claims an event, the legacy beat ids are used (`drop`, `snap`, `fall`, `jump`, `waves`, `drift`, `everyone`).
If neither exists, the event never happens.

Earth-stops events (no legacy fallback; without them nothing changes):

| event | what |
|---|---|
| `earthStop` | camera holds still 0.2 s, then a 0.3 s jolt (amplitude 0.25 m); visible air starts fading in |
| `freeDriftEast` | every free body drifts along `EAST`: `driftAt(t)` eases in over 4 s to 35.7 m/s (428.2 m/s at 12x slow motion), per-body speed +-6 % (spread soft-capped at ~15 m so the crowd stays together). Bodies lean east for 0.4 s, lift 0.3-1.2 m, spin slowly (0.2-0.6 rad/s), arms up. Stops (drift frozen) at `earthRespin` |
| `visibleAirCoMoving` | thin amber air lines (InstancedMesh) moving east at exactly the crowd's speed, so in a tracking shot they hang still: no relative wind. Visible from `earthStop`, brightest in the beat that claims this event |
| `earthRespin` | drift freezes; camera jolt 0.6 s, amplitude 0.5 m (more to come in phase 2) |

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
| `tick` | | **v2: one click.** (legacy Kuta path: 5 clicks) |
| `ticks` | | the old 5 clicks, 0.2 s apart |
| `riser` | `dur`, `from`, `to` (Hz), `curve`, `tone`, `fadeOut` | slow rising tension, stops before a hit |
| `undertow` | `dur`, `intensity`, `cutoffFrom`, `cutoffTo`, `period`, `drift` | receding-sea rumble that gets darker and further away |
| legacy | `whoosh`, `drop`, `rise`, `tick`, `wave`, `wind`, `snap`, `thuds` | the original Kuta sounds |


## Earth-stops effects (phase 2, `src/scenes/copaPhase2.tsx`, `src/MapDiagram.tsx`)
| Event | Effect |
|---|---|
| `seaWithdraws` | whole ocean drifts along EAST with the free bodies (x0.985 seabed friction); exposed slate seabed with rocks; moving water front |
| `seaReturns` | water returns as a wall (max ~60 m, foam crest) that hits the beach 3.2 s after the event (sync your hit sfx there) |
| `shockFronts` | shock shells + bright rim on the windward (west) faces of the front buildings, flow that bends around them, flying glass; until `earthRespin` |
| `earthRespin` | white flash, grade back, rotational camera shake, dust clouds and debris thrown west |

Shots (Copacabana): `avenida_buildings_low`, `shoreline_high_angle`, `shoreline_high_angle_return`, `copa_wide_from_sea`, `map_top_down`.
`map_top_down` draws a north-up diagram (original shoreline dashed, today's water edge, 1 km scale). Its "M EAST" label uses the beat's counter.
Counter `"linear": true`: value goes exactly from `from` to `to` across the beat (no easing), e.g. physics counters like DRIFT EAST.
Fog is set per shot (`FOG` table in Copacabana.tsx) so a small world can show kilometres of seabed.


## Mini-scenes (phase 3, `src/scenes/copaPhase3.tsx`, labels in `src/scenes/CopaOverlay.tsx`)
When a beat uses one of these shots only the mini-scene is rendered (the coastal world is skipped):
| Shot | Scene |
|---|---|
| `pullback_to_globe` | first 0.5 s: fast climb over Rio; then a white cut to the globe (put the impact there) and a ~1.3 s pull back, "RIO" label + pulse rings |
| `globe_orbit` | slow orbit of the globe; amber air bands flow east (density and length follow cos latitude) |
| `globe_tilt_to_pole` | tilt toward the north pole; speed gradient shell; "1,670 KM/H · EQUATOR" (first half) then "0 KM/H · POLE" (second half) |
| `airliner_above_clouds` | generic airliner (no livery) above a moving cloud deck, normal colours |
| `horizon_dawn` | sea horizon at dawn, sun rising in the south-east |
Globe land: Natural Earth 110m via the `world-atlas` npm package (public domain data, ISC package).
