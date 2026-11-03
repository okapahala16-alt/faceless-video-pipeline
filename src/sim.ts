// Deterministic physics, precomputed once per frame index: frame = f(t).
import {tl, FPS, beatById, mulberry32, clamp, lerp} from './timeline';

export const N = Math.ceil(tl.duration * FPS) + 2;
// Scene events are anchored to beats. A beat claims an event with "events": ["snap"] or
// [{"name": "snap", "at": 0.8}] (seconds into the beat). Legacy Kuta scripts have no
// "events" list; their beat ids (drop, jump, ...) are used instead, with the original offsets.
const INF = Number.POSITIVE_INFINITY;
type Ev = string | {name: string; at?: number};
const evList = (b: (typeof tl.beats)[number]): Ev[] => {
  const raw = (b as unknown as {events?: Ev[]; event?: string}).events;
  return raw ?? [];
};
function anchor(name: string, legacyId: string, legacyOffset: number): {beat?: (typeof tl.beats)[number]; t: number} {
  for (const b of tl.beats) {
    for (const e of evList(b)) {
      const n = typeof e === 'string' ? e : e.name;
      if (n === name) return {beat: b, t: b.start + (typeof e === 'string' || e.at === undefined ? legacyOffset : e.at)};
    }
  }
  const b = beatById(legacyId);
  return b ? {beat: b, t: b.start + legacyOffset} : {t: INF};
}
const A = {
  drop: anchor('gravityDrop', 'drop', 0.6),
  snap: anchor('snap', 'snap', 0.75),
  fall: anchor('massFall', 'fall', 0.55),
  kid: anchor('kidJump', 'jump', 0.35),
  wave: anchor('bigWave', 'waves', 0.2),
  drift: anchor('drift', 'drift', 0.15),
  mass: anchor('massJump', 'everyone', 0.1),
};
const kidBeatStart = A.kid.beat ? A.kid.beat.start : INF;
export const T = {
  drop: A.drop.t,
  snap: A.snap.t,
  fall: A.fall.t,
  kidJump: A.kid.t,
  frisbee: kidBeatStart - 0.9,
  wave: A.wave.t,
  drift: A.drift.t,
  mass0: A.mass.t,
};
// hop windows (legacy: jump.start, waves.start, drift.end)
const W = {
  hopEnd: kidBeatStart,
  waveStart: A.wave.beat ? A.wave.beat.start : INF,
  driftEnd: A.drift.beat ? A.drift.beat.end : INF,
};
const G = 9.81, GM = 1.62;
// world-time rate: slow-mo while gravity is low, near-freeze between "snap" and the fall
const rate = (t: number) => (t < T.drop ? 1 : t < T.snap ? 0.6 : t < T.fall ? 0.03 : 1);
export const gravity = (t: number) => (t < T.drop ? G : t < T.drop + 0.8 ? lerp(G, GM, (t - T.drop) / 0.8) : t < T.snap ? GM : G);

export const simT = new Float32Array(N);
for (let i = 1; i < N; i++) simT[i] = simT[i - 1] + rate((i - 1) / FPS) / FPS;
export const fr = (t: number) => clamp(Math.round(t * FPS), 0, N - 1);

const SHIRTS = ['#ff6b6b', '#ffd93d', '#3ec97a', '#4d96ff', '#ff9f1c', '#f15bb5', '#00bbf9', '#ffffff', '#9b5de5', '#2ec4b6', '#e63946'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#b5835a'];
const HAIR = ['#1b1b1b', '#3b2618', '#5a3825', '#111', '#d9b26f'];

export type Person = {x: number; z: number; rot: number; shirt: string; skin: string; hair: string; hat: boolean; s: number;
  kid: boolean; y: Float32Array; tilt: Float32Array; tiltDir: number};

const rnd = mulberry32(42);
export const KID = {x: 0.8, z: 9.5};
const people: Person[] = [];
const spots: [number, number][] = [];
const umbrellaSpots: [number, number][] = [];
for (let i = 0; i < 16; i++) umbrellaSpots.push([-24 + i * 3.2 + rnd() * 1.2, 11 + rnd() * 6]);
while (people.length < 190) {
  const x = -26 + rnd() * 52, z = 2.5 + Math.pow(rnd(), 1.4) * 16;
  if (Math.hypot(x - KID.x, z - KID.z) < 2.2) continue;
  if (spots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.9)) continue;
  if (umbrellaSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 1.1)) continue;
  spots.push([x, z]);
  people.push(mk(x, z, false));
}
people.push(mk(KID.x, KID.z, true));
function mk(x: number, z: number, kid: boolean): Person {
  return {x, z, rot: kid ? -0.4 : rnd() * Math.PI * 2, shirt: kid ? '#ff9f1c' : SHIRTS[Math.floor(rnd() * SHIRTS.length)],
    skin: SKIN[Math.floor(rnd() * SKIN.length)], hair: HAIR[Math.floor(rnd() * HAIR.length)], hat: !kid && rnd() < 0.25,
    s: kid ? 0.68 : 0.9 + rnd() * 0.2, kid, y: new Float32Array(N), tilt: new Float32Array(N), tiltDir: rnd() * Math.PI * 2};
}
export const PEOPLE = people;
export const KID_INDEX = people.length - 1;

// schedule jumps (video times)
const jumps: number[][] = people.map(() => []);
people.forEach((p, i) => {
  if (p.kid) { jumps[i].push(T.kidJump); return; }
  if (rnd() < 0.18) jumps[i].push(lerp(T.drop + 1.2, W.hopEnd - 0.3, rnd()));
  if (rnd() < 0.22) jumps[i].push(lerp(W.waveStart, W.driftEnd - 1, rnd()));
  if (rnd() < 0.62) jumps[i].push(lerp(T.mass0, T.snap - 0.5, Math.pow(rnd(), 0.8)));
  // drop jumps whose anchor event is missing in this script (keeps rnd() order intact)
  jumps[i] = jumps[i].filter((j) => Number.isFinite(j)).sort((a, b) => a - b);
});

// integrate
export const impactSpeed = new Float32Array(N); // max landing speed so far (m/s)
people.forEach((p, i) => {
  let y = 0, vy = 0, k = 0, fallenAt = -1, getUp = 3 + rnd() * 5;
  const v0 = p.kid ? Math.sqrt(2 * G * 0.5) : 2.9 + rnd() * 0.45;
  for (let f = 0; f < N; f++) {
    const t = f / FPS, ds = simT[Math.min(N - 1, f + 1)] - simT[f];
    while (k < jumps[i].length && jumps[i][k] <= t) { if (y <= 0.001) vy = v0; k++; }
    if (y > 0 || vy > 0) {
      vy -= gravity(t) * ds; y += vy * ds;
      if (y <= 0) {
        y = 0; const sp = -vy; vy = 0;
        if (sp > 5.5 && fallenAt < 0) fallenAt = t;
        impactSpeed[f] = Math.max(impactSpeed[f], sp);
      }
    }
    p.y[f] = y;
    const ft = fallenAt < 0 ? 0 : t - fallenAt;
    p.tilt[f] = fallenAt < 0 ? 0 : clamp(ft / 0.25) * (ft > getUp ? clamp(1 - (ft - getUp) / 1.2) : 1) * 1.35;
  }
});
for (let f = 1; f < N; f++) impactSpeed[f] = Math.max(impactSpeed[f], impactSpeed[f - 1]);

// loose objects: rise + drift during low-g, fall after the snap
export type Obj = {kind: 'umbrella' | 'ball' | 'towel'; x: number; z: number; color: string; t0: number; lift: number; spin: number};
const OCOL = ['#ff4d6d', '#ffd93d', '#4d96ff', '#3ec97a', '#ffffff', '#f15bb5', '#ff9f1c'];
export const OBJS: Obj[] = [
  ...umbrellaSpots.map(([x, z], i) => ({kind: 'umbrella' as const, x, z, color: OCOL[i % OCOL.length], t0: T.drift + rnd() * 2.2, lift: 0.8 + rnd() * 0.6, spin: rnd() * 2 - 1})),
  ...Array.from({length: 12}, (_, i) => ({kind: 'ball' as const, x: -20 + rnd() * 40, z: 4 + rnd() * 12, color: OCOL[i % OCOL.length], t0: T.drift + rnd() * 1.5, lift: 1 + rnd() * 0.8, spin: rnd() * 4 - 2})),
  ...Array.from({length: 18}, (_, i) => ({kind: 'towel' as const, x: -24 + rnd() * 48, z: 8 + rnd() * 10, color: OCOL[(i + 3) % OCOL.length], t0: T.drift + rnd() * 2.5, lift: 0.6 + rnd() * 0.5, spin: rnd() * 3 - 1.5})),
];
export function objPose(o: Obj, f: number) {
  const s0 = simT[fr(o.t0)], sSnap = simT[fr(T.snap)];
  const s = simT[f];
  if (s <= s0) return {x: o.x, y: 0, rx: 0, rz: 0};
  const up = (q: number) => o.lift * 1.1 * Math.pow(q, 1.35);
  if (s <= sSnap) { const q = s - s0; return {x: o.x + 0.9 * q, y: up(q), rx: o.spin * q * 0.6, rz: o.spin * q * 0.4}; }
  const q = sSnap - s0, h = up(q), d = s - sSnap;
  const y = Math.max(0, h - 0.5 * G * d * d);
  return {x: o.x + 0.9 * q + 0.9 * Math.min(d, Math.sqrt((2 * h) / G)), y, rx: o.spin * q * 0.6 + (y > 0 ? d * o.spin : 0), rz: o.spin * q * 0.4};
}

// frisbee: thrown before the kid jumps, kid catches it at apex
export function frisbeePose(f: number) {
  if (!Number.isFinite(T.frisbee) || !Number.isFinite(T.kidJump)) return null;
  const s = simT[f], s0 = simT[fr(T.frisbee)], kid = PEOPLE[KID_INDEX];
  const apexS = simT[fr(T.kidJump)] + Math.sqrt(2 * G * 0.5) / GM; // sim time of kid apex
  if (s < s0) return null;
  const u = clamp((s - s0) / (apexS - s0));
  if (u < 1) return {x: lerp(-9, KID.x + 0.3, u), y: 1.4 + 2.2 * Math.sin(Math.PI * 0.62 * u) + u * 0.1, z: KID.z, held: false};
  return {x: KID.x + 0.3, y: kid.y[f] * kid.s + 1.55 * kid.s + 0.1, z: KID.z, held: true};
}

// big wave crest position/height
export function wave(f: number) {
  if (!Number.isFinite(T.wave)) return {zc: -40, amp: 0};
  const s = simT[f], s0 = simT[fr(T.wave)];
  const q = s - s0;
  if (q < 0) return {zc: -40, amp: 0};
  return {zc: lerp(-16, 1.0, clamp(q / 3.2)), amp: 4.0 * Math.sin(Math.PI * clamp(q / 3.8 + 0.12))};
}
