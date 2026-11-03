// Render one PNG from the middle of every beat in public/timeline.json into out/stills/.
// Usage: npm run stills [-- --guides] [-- --frames=0,120]
// --guides draws the TikTok UI safe zones (top 150, bottom 400, right 140 px) in red.
// Uses one `remotion render --frames=... --sequence` call (one bundle), as the Remotion docs recommend.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tl = JSON.parse(fs.readFileSync(path.join(root, 'public/timeline.json'), 'utf8'));
const fps = tl.fps ?? 30;
const last = Math.ceil(tl.duration * fps) - 1;
const guides = process.argv.includes('--guides');
const extra = (process.argv.find((a) => a.startsWith('--frames=')) ?? '').slice(9).split(',').filter(Boolean).map(Number);

const shots = tl.beats.map((b, i) => ({frame: Math.min(last, Math.round(((b.start + b.end) / 2) * fps)), name: `${String(i + 1).padStart(2, '0')}_${b.id}`}));
for (const f of extra) shots.push({frame: Math.min(last, f), name: `extra`});
const frames = [...new Set(shots.map((s) => s.frame))].sort((a, b) => a - b);

const outDir = path.join(root, 'out/stills');
const tmp = path.join(outDir, '_raw');
fs.rmSync(tmp, {recursive: true, force: true});
fs.mkdirSync(tmp, {recursive: true});
const propsFile = path.join(tmp, 'props.json');
fs.writeFileSync(propsFile, JSON.stringify({showSafeZones: guides}));

const cli = path.join(root, 'node_modules/@remotion/cli/remotion-cli.js');
const args = [cli, 'render', 'src/index.ts', 'Main', tmp, `--frames=${frames.join(',')}`, '--sequence', '--image-format=png', `--props=${propsFile}`, '--log=error'];
console.log(`Rendering ${frames.length} stills${guides ? ' with safe-zone guides' : ''}...`);
const r = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
if (r.status !== 0) process.exit(r.status ?? 1);

for (const s of shots) {
  const src = path.join(tmp, `element-${String(s.frame).padStart(String(last).length, '0')}.png`);
  const alt = fs.readdirSync(tmp).find((f) => f.endsWith(`${s.frame}.png`) && Number(f.match(/(\d+)\.png$/)[1]) === s.frame);
  const file = fs.existsSync(src) ? src : alt ? path.join(tmp, alt) : null;
  if (!file) { console.warn('missing frame', s.frame); continue; }
  const dst = path.join(outDir, `${s.name}_f${s.frame}${guides ? '_guides' : ''}.png`);
  fs.copyFileSync(file, dst);
  console.log('  ' + path.relative(root, dst));
}
fs.rmSync(tmp, {recursive: true, force: true});
