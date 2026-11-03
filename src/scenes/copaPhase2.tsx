// Phase 2 effects for the "Earth stops" story, reusable for any coastal scene that uses the
// shared sim (EAST, driftAt): the whole ocean drifts east and exposes the seabed, a wall of water
// returns, supersonic air builds shock fronts on buildings, and the re-spin throws dust west.
// Every effect is inert unless its event is claimed by a beat (seaWithdraws, seaReturns,
// shockFronts, earthRespin), so other scripts render exactly as before.
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {tl, FPS, mulberry32, clamp, ease} from '../timeline';
import {EAST, TE, driftAt} from '../sim';
import {M} from '../World';
import {ME, anchorify} from '../grade';
import {BUILDINGS, bldCenter, Bld} from './Copacabana';

const INF = Number.POSITIVE_INFINITY;
function eventTime(name: string): number {
  for (const b of tl.beats) for (const e of b.events ?? []) {
    const n = typeof e === 'string' ? e : e.name;
    if (n === name) return b.start + (typeof e === 'string' ? 0 : e.at ?? 0);
  }
  return INF;
}
export const T2 = {
  withdraw: eventTime('seaWithdraws'),
  ret: eventTime('seaReturns'),
  shock: eventTime('shockFronts'),
  respin: TE.respin,
};
export const RETURN_TRAVEL = 3.2; // s from the start of seaReturns until the wall hits the beach (sfx "thuds")
export const oceanMoves = Number.isFinite(T2.withdraw) || Number.isFinite(T2.ret);
// friction with the seabed: water lags the free crowd a little, so the crowd ends up over the water
const WATER_K = 0.985;

// how far (m, along EAST) the water has moved from its normal place at time t
export function waterShift(t: number): number {
  if (!oceanMoves) return 0;
  const d = driftAt(t) * WATER_K;
  if (t < T2.ret) return d;
  const dFar = driftAt(T2.ret) * WATER_K, u = (t - T2.ret) / RETURN_TRAVEL;
  if (u < 1) return dFar * (1 - Math.pow(u, 1.25));           // accelerates toward the beach
  const v = u - 1;                                              // surge onto the sand, then settles
  return -26 * Math.sin(Math.min(v * 1.6, Math.PI)) * Math.exp(-v * 0.8);
}
// height of the water front (m above normal sea level)
function wallHeight(t: number): number {
  if (t < T2.ret) return 1.2 + 2.5 * clamp((t - (TE.drift0 ?? INF)) / 6);
  const u = (t - T2.ret) / RETURN_TRAVEL;
  if (u < 1) return 6 + 54 * Math.pow(u, 0.6);
  return Math.max(0, 60 * (1 - (u - 1) * 3));
}
const SEABED_SLOPE = 0.012; // m down per m from the old shoreline
const seabedY = (dist: number) => -0.55 - SEABED_SLOPE * Math.max(0, dist);

// ---------- ocean that slides east, wraps the scene's near sea ----------
export const OceanShift: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  const d = waterShift(f / FPS);
  const open = useMemo(() => new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -4500), []);
  return <group position={[EAST.x * d, 0, EAST.z * d]}>
    {children}
    {/* open ocean, near edge on the old shoreline (z = 0) */}
    <mesh geometry={open} position={[0, -0.35, 0]} material={M('#11789f')} receiveShadow />
    <WaterFront />
  </group>;
};

// vertical face of the water at its moving edge (dark below, foam on top), leaning toward the beach on return
const WaterFront: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(9000, 1, 300, 6);
    const p = g.attributes.position.array as Float32Array, cols = new Float32Array(p.length);
    const deep = new THREE.Color('#0d5f84'), mid = new THREE.Color('#2aa7c4'), foam = new THREE.Color('#eef8ff');
    for (let i = 0; i < p.length; i += 3) {
      const u = p[i + 1] + 0.5; // 0 bottom .. 1 top
      const c = deep.clone().lerp(mid, clamp(u * 1.6)).lerp(foam, clamp((u - 0.72) / 0.28));
      cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.4, side: THREE.DoubleSide, flatShading: true}), []);
  if (!oceanMoves) return null;
  const d = Math.max(0, waterShift(t));
  const depth = d * Math.abs(EAST.z) * SEABED_SLOPE + 0.6; // seabed depth under the edge
  const h = wallHeight(t) + depth;
  if (h < 0.7 || d < 1) return null;
  const lean = t > T2.ret ? -0.35 * clamp((t - T2.ret) / RETURN_TRAVEL) : 0.12;
  // the group is already shifted with the water, so the face sits on the old shoreline line z = 0
  const top = -0.35 - depth + h;
  return <group>
    <mesh geometry={geo} material={mat} position={[0, -0.35 - depth + h / 2, 0.2]} rotation={[lean, 0, 0]} scale={[1, h, 1]} />
    {/* foam crest: a white rolling lip on top of the returning wall */}
    {t > T2.ret && <mesh position={[0, top - 0.4, 0.2 + Math.sin(-lean) * h * 0.5 + 1.5]} rotation={[lean * 1.6, 0, 0]} material={M('#f4fbff')}>
      <boxGeometry args={[9000, Math.max(1.2, h * 0.08), 4 + h * 0.12]} />
    </mesh>}
  </group>;
};

// ---------- exposed seabed (anchored, so it turns slate in the split grade) ----------
export const Seabed: React.FC = () => {
  const {geo, rocks} = useMemo(() => {
    const g = new THREE.PlaneGeometry(9000, 6000, 180, 120); g.rotateX(-Math.PI / 2); g.translate(0, 0, -3000 + 4);
    const p = g.attributes.position.array as Float32Array, r = mulberry32(404), cols = new Float32Array(p.length);
    const wet = new THREE.Color('#9b8a6c'), deep = new THREE.Color('#5d6a63');
    for (let i = 0; i < p.length; i += 3) {
      const dist = -p[i + 2];
      p[i + 1] = seabedY(dist) + (r() - 0.5) * 0.25;
      const c = wet.clone().lerp(deep, clamp(dist / 900)); const n = (r() - 0.5) * 0.05;
      cols[i] = c.r + n; cols[i + 1] = c.g + n; cols[i + 2] = c.b + n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const rr = mulberry32(405);
    const rocks = Array.from({length: 160}, () => {
      const x = -320 + rr() * 520, dist = 8 + Math.pow(rr(), 0.7) * 700;
      return {x, z: -dist, y: seabedY(dist), s: 0.6 + rr() * 2.6, ry: rr() * 6};
    });
    return {geo: g, rocks};
  }, []);
  const mat = useMemo(() => anchorify(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true})), []);
  if (!oceanMoves) return null;
  return <group>
    <mesh geometry={geo} material={mat} receiveShadow />
    {rocks.map((k, i) => <mesh key={i} position={[k.x, k.y + k.s * 0.25, k.z]} rotation={[0.3, k.ry, 0.2]} scale={[k.s, k.s * 0.55, k.s * 0.8]}
      material={ME(i % 3 ? '#6e6a62' : '#57544f')}><dodecahedronGeometry args={[1, 0]} /></mesh>)}
  </group>;
};

// ---------- shock fronts on buildings hit by the air that is still moving east ----------
const WEST = {x: -EAST.x, z: -EAST.z};
const WEST_ANG = Math.atan2(WEST.x, WEST.z); // cylinder theta = atan2(x, z)
const shockOn = (t: number) => Number.isFinite(T2.shock) && t >= T2.shock && t < T2.respin;
export const ShockFronts: React.FC<{near: [number, number]; radius?: number}> = ({near, radius = 120}) => {
  const f = useCurrentFrame(), t = f / FPS;
  const list = useMemo(() => BUILDINGS.filter((b) => Math.abs(bldCenter(b).x - near[0]) < radius), [near, radius]);
  const shellMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.17, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: true}), []);
  const edgeMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending}), []);
  const streaks = useMemo(() => {
    const r = mulberry32(611);
    return Array.from({length: 900}, () => ({b: Math.floor(r() * 1e6), side: r() < 0.5 ? -1 : 1, h: r(), ph: r(), sp: 0.7 + r() * 0.6, len: 4 + r() * 10}));
  }, []);
  const shards = useMemo(() => {
    const r = mulberry32(612);
    return Array.from({length: 420}, () => ({b: Math.floor(r() * 1e6), u: r() - 0.5, h: r(), ph: r(), sp: 18 + r() * 30, spin: r() * 9, s: 0.25 + r() * 0.5}));
  }, []);
  const streakMesh = useMemo(() => new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.06), edgeMat, streaks.length), [edgeMat, streaks.length]);
  const shardMesh = useMemo(() => new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.7),
    new THREE.MeshBasicMaterial({color: '#dff3ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false}), shards.length), [shards.length]);
  const on = shockOn(t);
  const age = t - T2.shock;
  React.useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const flowYaw = Math.atan2(EAST.x, EAST.z) - Math.PI / 2;
    streaks.forEach((s, i) => {
      const b = list[s.b % Math.max(1, list.length)];
      if (!on || !b) { sc.set(0, 0, 0); m.compose(v.set(0, -999, 0), q, sc); streakMesh.setMatrixAt(i, m); return; }
      const c = bldCenter(b), r = Math.hypot(b.w, b.d) * 0.55;
      // start at the building's flank (perpendicular to the flow), race east past it
      const perp = {x: EAST.z * s.side, z: -EAST.x * s.side};
      // flow arrives from the west (upwind) near the centre line, bends out around the shock shell, races past
      const u = ((age * s.sp * 0.6 + s.ph) % 1);
      const along = -r * 2.4 + u * (r * 4.6 + 40);
      const bend = 0.12 + 1.0 * clamp((along + r * 1.3) / (r * 1.3)) ** 2;
      v.set(c.x + perp.x * r * bend + EAST.x * along, c.y + s.h * b.h * 1.05, c.z + perp.z * r * bend + EAST.z * along);
      e.set(0, flowYaw, 0); q.setFromEuler(e); sc.set(s.len * (0.4 + 0.6 * Math.sin(Math.PI * u)), 1, 1);
      m.compose(v, q, sc); streakMesh.setMatrixAt(i, m);
    });
    shards.forEach((s, i) => {
      const b = list[s.b % Math.max(1, list.length)];
      if (!on || !b) { m.compose(v.set(0, -999, 0), q, sc.set(0, 0, 0)); shardMesh.setMatrixAt(i, m); return; }
      const c = bldCenter(b);
      const life = ((age * 0.45 + s.ph) % 1), dist = life * s.sp * 2.2;
      // glass leaves the windward face and is blown east over the roof and past the building
      const start = {x: c.x + WEST.x * b.d * 0.5 + EAST.z * s.u * b.w, z: c.z + WEST.z * b.d * 0.5 - EAST.x * s.u * b.w};
      v.set(start.x + EAST.x * dist, c.y + s.h * b.h + life * 6 - life * life * 10, start.z + EAST.z * dist);
      e.set(s.spin * age, s.spin * age * 0.7, 0); q.setFromEuler(e); sc.setScalar(s.s * (1 - life * 0.5));
      m.compose(v, q, sc); shardMesh.setMatrixAt(i, m);
    });
    streakMesh.instanceMatrix.needsUpdate = true; shardMesh.instanceMatrix.needsUpdate = true;
    streakMesh.frustumCulled = false; shardMesh.frustumCulled = false;
  }, [f, on, age, list, streaks, shards, streakMesh, shardMesh]);
  if (!Number.isFinite(T2.shock)) return null;
  const build = clamp(age / 0.5);
  const flick = (i: number) => 0.75 + 0.25 * Math.sin(age * 23 + i * 1.7);
  return <group visible={on}>
    {list.map((b, i) => {
      const c = bldCenter(b), r = Math.hypot(b.w, b.d) * 0.62 + 3;
      return <group key={i} position={[c.x, c.y, c.z]}>
        <mesh material={shellMat} scale={[1, build, 1]} position={[0, b.h * 0.55 * build, 0]} renderOrder={5}>
          <cylinderGeometry args={[r, r * 1.15, b.h * 1.12, 28, 1, true, WEST_ANG - 1.15, 2.3]} />
        </mesh>
        <mesh material={shellMat} position={[WEST.x * 1.5, b.h * 0.55 * build, WEST.z * 1.5]} scale={[flick(i), build, flick(i)]} renderOrder={5}>
          <cylinderGeometry args={[r * 1.35, r * 1.6, b.h * 1.2, 28, 1, true, WEST_ANG - 0.9, 1.8]} />
        </mesh>
      </group>;
    })}
    <primitive object={streakMesh} />
    <primitive object={shardMesh} />
  </group>;
};

// ---------- re-spin: everything that had stopped is thrown west; dust clouds rise ----------
export const RespinDust: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const puffs = useMemo(() => {
    const r = mulberry32(733);
    return Array.from({length: 700}, () => ({x: -170 + r() * 340, zl: -10 + r() * 100, y0: r() * 6, sp: 0.5 + r() * 0.8, s: 6 + r() * 16, ph: r() * 0.35, c: r()}));
  }, []);
  const mesh = useMemo(() => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({color: '#d9c7a6', transparent: true, opacity: 0.55, roughness: 1, depthWrite: false, flatShading: true}), puffs.length), [puffs.length]);
  const debris = useMemo(() => {
    const r = mulberry32(734);
    return Array.from({length: 360}, () => ({x: -150 + r() * 300, zl: r() * 80, sp: 30 + r() * 60, up: 4 + r() * 12, s: 0.2 + r() * 0.6, spin: r() * 10, c: r()}));
  }, []);
  const deb = useMemo(() => new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M('#4a4640'), debris.length), [debris.length]);
  const age = t - T2.respin;
  const on = Number.isFinite(T2.respin) && age >= 0 && age < 7;
  React.useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    puffs.forEach((p, i) => {
      const a = age - p.ph;
      if (!on || a < 0) { m.compose(v.set(0, -999, 0), q, sc.set(0, 0, 0)); mesh.setMatrixAt(i, m); return; }
      const travel = 60 * p.sp * (1 - Math.exp(-a * 0.9)); // fast at first, then hangs in the air
      v.set(p.x + WEST.x * travel, p.y0 + 9 * a * p.sp + p.s * 0.45, p.zl + WEST.z * travel);
      sc.setScalar(p.s * (0.4 + 0.6 * clamp(a / 1.2)) * (1 + a * 0.15));
      m.compose(v, q.identity(), sc); mesh.setMatrixAt(i, m);
    });
    debris.forEach((p, i) => {
      if (!on) { m.compose(v.set(0, -999, 0), q, sc.set(0, 0, 0)); deb.setMatrixAt(i, m); return; }
      const travel = p.sp * age * (1 - clamp(age / 6) * 0.5), y = Math.max(0.2, p.up * age - 4.9 * age * age + 1);
      v.set(p.x + WEST.x * travel, y, p.zl + WEST.z * travel);
      e.set(p.spin * age, p.spin * age * 0.6, 0); q.setFromEuler(e); sc.setScalar(p.s);
      m.compose(v, q, sc); deb.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true; deb.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false; deb.frustumCulled = false;
    (mesh.material as THREE.MeshStandardMaterial).opacity = on ? 0.55 * (1 - clamp((age - 4) / 3)) : 0;
  }, [f, on, age, puffs, debris, mesh, deb]);
  if (!Number.isFinite(T2.respin)) return null;
  return <group visible={on}><primitive object={mesh} /><primitive object={deb} /></group>;
};

// current water edge in km east of the old shoreline (for the map diagram)
export const waterShiftKm = (t: number) => Math.max(0, waterShift(t)) / 1000;
export type {Bld};
export const easeOut = ease;
