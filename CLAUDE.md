# Faceless "What if..." video pipeline

## Architecture
```
script JSON ──> pipeline/build_audio.py ──> public/audio/mix.wav + public/timeline.json ──> Remotion ──> out/*.mp4
                 │  legacy path: main()      (Kuta EN/ID, 24 kHz mono, frozen)
                 └  v2 path:     main_v2() + pipeline/audio_fx.py (48 kHz stereo, drone, SFX, -14 LUFS)
```
- **Remotion 4.0.540** + **@remotion/three** (Three.js 0.169, R3F 8.17, React 18.3.1). 1080x1920, 30 fps.
- `src/Root.tsx` composition `Main`, duration from `public/timeline.json` (generated, git-ignored).
- `src/sim.ts` deterministic physics precomputed per frame (frame = f(t)); scene events anchor to beats.
- `src/World.tsx` the Kuta 3D scene (beach, sea, 190 people, props) + camera shots per beat; exports shared parts.
- `src/scenes/Copacabana.tsx` Copacabana world (wave-pattern promenade, avenue with moving cars, high-rise row,
  hills, Sugarloaf-like domes, kiosks, lifeguard posts, volley nets, instanced background crowd). Pick with `"scene"`.
  No Christ the Redeemer statue on purpose: its image rights are claimed for commercial use.
- `src/Overlay.tsx` captions (karaoke/editorial), HUD countdown, title card, legacy counter/meter, safe-zone guides.
- `src/SfxDemo.tsx` black screen used when `mode: "sfxdemo"`.
- Python audio: numpy, soundfile, scipy. TTS: Kokoro (EN, CPU) or OmniVoice (clone, GPU).

## Commands
| Command | What |
|---|---|
| `npm run audio` / `npm run audio:id` | Kuta EN / ID audio + timeline |
| `npm run build -- <script.json> public` | any script |
| `npm run studio` | live preview |
| `npm run stills` / `npm run stills:guides` | one PNG per beat middle into `out/stills/` (guides = TikTok safe zones) |
| `npm run render` | `out/video.mp4` from the current timeline |
| `npm run sfx-demo` | `out/sfx-demo.wav` + `out/sfx-demo.mp4` |
| `npm run test-novo` | the 3-beat no-VO format demo |

No GPU / cloud container: set `REMOTION_GL=swangle`. If Remotion cannot download its browser,
set `REMOTION_BROWSER=<path to chrome-headless-shell>`. On a normal PC leave both unset.

## Important files
- `docs/SCRIPT_FORMAT.md` every JSON field, with examples. Read it before writing a script.
- `pipeline/script.json`, `pipeline/script.id.json` Kuta EN/ID (frozen reference videos).
- `docs/scripts/` new episode scripts (`copacabana-scene-test.json` = one beat per Copacabana shot). `docs/sfx-demo.json` SFX audition.
- `assets/sfx/` SFX + `ambience_*.wav`; `assets/music/` drone beds. Audio files are git-ignored.
- `voices/` OmniVoice reference clips (git-ignored). Only voices you own or have permission for.

## Rules for changes
1. **Do not change the Kuta output.** Kuta scripts go through the legacy path (`is_legacy()` in
   build_audio.py). New behaviour must be opt-in via new JSON fields. After touching `src/` or the
   pipeline, rebuild Kuta and compare with tag `baseline-kuta`: audio md5 must match, frames may
   differ only by renderer noise (max 1 level, ~0% pixels).
2. Remotion code: animation only from `useCurrentFrame()`. `<ThreeCanvas>` needs width/height.
   Check APIs with the `/remotion-docs` skill (`.claude/skills/`), do not guess.
   Note: docs now recommend `<Audio>` from `@remotion/media`; we keep `remotion`'s `<Audio>` so Kuta stays identical.
3. Review loop: after any scene change run `npm run stills:guides`, look at every still, fix text that is
   cut off, enters the TikTok UI zones (top 150 px, bottom 400 px, right 140 px) or has poor contrast. Then render.
4. Scripts must be original. Never copy another creator's script or voice.

## STYLE BIBLE
<!-- to be filled in from Claude chat -->
