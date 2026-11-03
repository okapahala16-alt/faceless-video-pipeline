import React, {useMemo, useLayoutEffect} from 'react';
import {useCurrentFrame} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {FPS, beatAt, ease, lerp, clamp, mulberry32} from './timeline';
import {PEOPLE, KID_INDEX, OBJS, objPose, frisbeePose, wave, simT, T, fr, KID, TE, personFree, objFree, LEAN_AXIS, EAST, FreeOffset} from './sim';

// ---------- shared geometry ----------
export const geo = {
  body: new THREE.CapsuleGeometry(0.26, 0.55, 4, 10),
  head: new THREE.SphereGeometry(0.22, 14, 12),
  hair: new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
  hat: new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16),
  hatTop: new THREE.CylinderGeometry(0.16, 0.2, 0.14, 14),
  shorts: new THREE.CylinderGeometry(0.27, 0.24, 0.3, 10),
  eye: new THREE.SphereGeometry(0.03, 6, 6),
  pole: new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6),
  canopy: new THREE.ConeGeometry(1.25, 0.5, 8, 1, true),
  ball: new THREE.SphereGeometry(0.28, 14, 10),
  towel: new THREE.BoxGeometry(0.8, 0.03, 1.6),
  frisbee: new THREE.CylinderGeometry(0.22, 0.2, 0.04, 18),
  trunk: new THREE.CylinderGeometry(0.12, 0.2, 1, 7),
  leaf: new THREE.ConeGeometry(0.35, 2.4, 4),
};
const mat = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true, ...o});
const matCache = new Map<string, THREE.Material>();
export const M = (c: string) => { if (!matCache.has(c)) matCache.set(c, mat(c)); return matCache.get(c)!; };

// ---------- camera ----------
// fov: vertical field of view (default 50). focus: point the scene centres shadows/effects on (default origin).
export type Shot = {p0: number[]; p1: number[]; l0: number[]; l1: number[]; fov?: number; focus?: number[]};
const kidY = (f: number) => PEOPLE[KID_INDEX].y[f] * PEOPLE[KID_INDEX].s;
export function shotFor(id: string, f: number): Shot {
  const ky = kidY(f);
  switch (id) {
    case 'orbit_wide': return {p0: [26, 20, 34], p1: [14, 14, 32], l0: [0, 0, 6], l1: [0, 0.5, 6]};
    case 'beach_low': return {p0: [9, 1.7, 22], p1: [4, 1.6, 17], l0: [-2, 1.2, 4], l1: [0, 1.2, 3]};
    case 'crowd_push': return {p0: [0.5, 3.2, 21], p1: [0.8, 2.2, 15], l0: [0, 1.2, 5], l1: [0.5, 1.3, 7]};
    case 'kid_follow': return {p0: [4.5, 1.3, 15], p1: [3.5, 2.2 + ky * 0.6, 14.5], l0: [KID.x, 1 + ky, KID.z], l1: [KID.x, 1 + ky, KID.z]};
    case 'kid_side': return {p0: [6.5, 1 + ky * 0.8, 10.5], p1: [5.5, 0.8 + ky * 0.7, 11.5], l0: [KID.x, 0.9 + ky, KID.z], l1: [KID.x, 0.9 + ky, KID.z]};
    case 'wave_low': return {p0: [-17, 3.4, 9], p1: [-14, 3.0, 8], l0: [0, 1.4, -5], l1: [0, 1.4, -4]};
    case 'drift_up': return {p0: [2, 1.2, 20], p1: [2, 7, 24], l0: [0, 3, 8], l1: [0, 7, 6]};
    case 'crowd_air': return {p0: [-24, 4, 14], p1: [-19, 3.2, 15], l0: [0, 2.2, 8], l1: [0, 2.6, 8]};
    case 'crowd_air_hold': return {p0: [-15, 2.6, 12], p1: [-13.5, 2.8, 12.5], l0: [-2, 2.8, 8], l1: [-2, 2.8, 8]};
    case 'fall_drop': return {p0: [10, 10, 22], p1: [8, 6.5, 19], l0: [0, 0.5, 8], l1: [0, 0.3, 8]};
    case 'aftermath': return {p0: [-5, 2.2, 21], p1: [-8, 2.8, 23], l0: [0, 0.3, 9], l1: [0, 0.3, 9]};
    case 'orbit_end': default: return {p0: [18, 12, 30], p1: [-16, 20, 32], l0: [0, 0, 6], l1: [0, 0, 6]};
  }
}
// event-driven camera kicks (opt-in: anchors are Infinity in scripts without these events)
export const STOP_FREEZE = 0.2; // s the camera holds still when the Earth stops, before the jolt
export function eventShake(t: number): number {
  let k = 0;
  const ds = t - (TE.earthStop + STOP_FREEZE);
  if (ds >= 0 && ds < 0.3) k += 0.25 * Math.pow(1 - ds / 0.3, 2);
  const dr = t - TE.respin;
  if (dr >= 0 && dr < 0.6) k += 0.5 * Math.pow(1 - dr / 0.6, 2);
  return k;
}
export type CamPose = {pos: [number, number, number]; look: [number, number, number]; fov: number; focus: number[]};
// Pure camera pose for a frame: the same numbers CameraRig applies. Use it anywhere the scene
// needs to know where the camera is (hiding props near the lens, sky that follows the camera).
export function cameraAt(f: number, shots: (id: string, f: number) => Shot = shotFor): CamPose {
  const t = f / FPS;
  const fs = t >= TE.earthStop && t < TE.earthStop + STOP_FREEZE ? fr(TE.earthStop) : f; // freeze
  const ts = fs / FPS, b = beatAt(ts);
  const u = ease(clamp((ts - b.start) / Math.max(0.1, b.end - b.start)));
  const s = shots(b.shot, fs);
  const p = s.p0.map((v, i) => lerp(v, s.p1[i], u));
  const l = s.l0.map((v, i) => lerp(v, s.l1[i], u));
  // impact shake
  const dt = t - (T.fall + 0.35);
  const shake = dt > 0 ? 0.35 * Math.exp(-dt * 3) : 0;
  const snapPunch = t > T.snap && t < T.snap + 0.4 ? 0.12 * Math.exp(-(t - T.snap) * 8) : 0;
  const k = shake + snapPunch;
  const pos: [number, number, number] = [p[0] + Math.sin(f * 1.7) * k, p[1] + Math.cos(f * 2.3) * k, p[2]];
  const ek = eventShake(t);
  if (ek > 0) { pos[0] += Math.sin(f * 2.9 + 1) * ek; pos[1] += Math.cos(f * 3.7) * ek * 0.7; pos[2] += Math.sin(f * 2.1 + 2) * ek * 0.6; }
  return {pos, look: [l[0], l[1], l[2]], fov: s.fov ?? 50, focus: s.focus ?? [0, 0, 0]};
}
export const CameraRig: React.FC<{shots?: (id: string, f: number) => Shot}> = ({shots = shotFor}) => {
  const f = useCurrentFrame();
  const {camera} = useThree();
  useLayoutEffect(() => {
    const c = cameraAt(f, shots);
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    camera.lookAt(c.look[0], c.look[1], c.look[2]);
    (camera as THREE.PerspectiveCamera).fov = c.fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [f, camera, shots]);
  return null;
};

// ---------- environment ----------
export const Sky: React.FC = () => {
  const m = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {top: {value: new THREE.Color('#2f8fe6')}, mid: {value: new THREE.Color('#8fd3ff')}, bot: {value: new THREE.Color('#fff1d6')}},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.15? mix(mid, top, smoothstep(0.15,0.7,h)) : mix(bot, mid, smoothstep(-0.05,0.15,h)); gl_FragColor=vec4(c,1.0);}',
  }), []);
  return <mesh material={m}><sphereGeometry args={[400, 24, 16]} /></mesh>;
};

export const Clouds: React.FC = () => {
  const f = useCurrentFrame();
  const cl = useMemo(() => { const r = mulberry32(5); return Array.from({length: 14}, () => ({x: -150 + r() * 300, y: 40 + r() * 30, z: -120 - r() * 120, s: 6 + r() * 10})); }, []);
  return <group>{cl.map((c, i) => (
    <group key={i} position={[c.x + f * 0.02, c.y, c.z]} scale={[c.s * 1.8, c.s * 0.6, c.s]}>
      <mesh geometry={geo.ball} material={M('#ffffff')} scale={[3, 2, 2]} />
      <mesh geometry={geo.ball} material={M('#ffffff')} position={[0.7, 0.2, 0]} scale={[2.4, 2.2, 2]} />
      <mesh geometry={geo.ball} material={M('#f4f8ff')} position={[-0.7, -0.05, 0.2]} scale={[2.2, 1.6, 1.8]} />
    </group>))}</group>;
};

export const Sea: React.FC = () => {
  const f = useCurrentFrame();
  const g = useMemo(() => { const g = new THREE.PlaneGeometry(260, 120, 130, 80); g.rotateX(-Math.PI / 2); g.translate(0, 0, -60); return g; }, []);
  const base = useMemo(() => Float32Array.from(g.attributes.position.array as Float32Array), [g]);
  const m = useMemo(() => new THREE.MeshStandardMaterial({color: '#1aa6c9', roughness: 0.35, metalness: 0.05, flatShading: true, vertexColors: true}), []);
  useLayoutEffect(() => {
    const s = simT[f], w = wave(f);
    const pos = g.attributes.position.array as Float32Array;
    const cols = new Float32Array(pos.length);
    const deep = new THREE.Color('#0c6f9c'), shallow = new THREE.Color('#2fd0d6'), foam = new THREE.Color('#f2fbff');
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i], z = base[i + 2];
      let y = 0.18 * Math.sin(0.35 * z + 1.6 * s + 0.08 * x) + 0.1 * Math.sin(0.9 * x - 1.1 * s + z * 0.2);
      const d = z - w.zc; const crest = w.amp * Math.exp(-(d * d) / (d < 0 ? 30 : 6)) * (1 + 0.15 * Math.sin(x * 0.3));
      y += crest;
      pos[i + 1] = y - 0.15;
      const c = deep.clone().lerp(shallow, clamp(1 + z / 25)).lerp(foam, clamp((y - 0.25) / 1.4) + clamp((z + 1.2) / 1.5) * 0.7);
      cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  }, [f, g, base]);
  return <mesh geometry={g} material={m} receiveShadow />;
};

const Sand: React.FC = () => {
  const g = useMemo(() => {
    const g = new THREE.PlaneGeometry(260, 60, 100, 30); g.rotateX(-Math.PI / 2); g.translate(0, 0, 30);
    const p = g.attributes.position.array as Float32Array; const r = mulberry32(9);
    const cols = new Float32Array(p.length); const wet = new THREE.Color('#c9a774'), dry = new THREE.Color('#f3dcaa');
    for (let i = 0; i < p.length; i += 3) {
      const z = p[i + 2]; p[i + 1] = (z - 0) * 0.02 + (r() - 0.5) * 0.05 - 0.02;
      const c = wet.clone().lerp(dry, clamp(z / 4)); const n = (r() - 0.5) * 0.04; cols[i] = c.r + n; cols[i + 1] = c.g + n; cols[i + 2] = c.b + n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
  }, []);
  return <mesh geometry={g} receiveShadow material={useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true}), [])} />;
};

export const Palm: React.FC<{x: number; z: number; h: number; lean: number; mat?: (c: string) => THREE.Material}> = ({x, z, h, lean, mat = M}) => {
  const f = useCurrentFrame();
  const sway = Math.sin(f / 22 + x) * 0.04;
  return <group position={[x, 0.4, z]} rotation={[0, 0, lean + sway]}>
    {Array.from({length: 6}, (_, i) => <mesh key={i} geometry={geo.trunk} material={mat(i % 2 ? '#8a6a45' : '#7a5c3a')} position={[i * 0.06 * Math.sign(lean || 1), (i + 0.5) * h / 6, 0]} scale={[1 - i * 0.07, h / 6, 1 - i * 0.07]} castShadow />)}
    <group position={[0.36 * Math.sign(lean || 1), h, 0]}>
      {Array.from({length: 7}, (_, i) => <mesh key={i} geometry={geo.leaf} material={mat(i % 2 ? '#2f9e44' : '#37b24d')} rotation={[Math.PI / 2.6, (i / 7) * Math.PI * 2, 0]} position={[Math.cos((i / 7) * Math.PI * 2) * 0.9, -0.2, Math.sin((i / 7) * Math.PI * 2) * 0.9]} scale={[1, 1, 0.35]} castShadow />)}
    </group>
  </group>;
};

// Balinese-style split gate as the landmark + low shops along the road
const Gate: React.FC<{x: number; z: number}> = ({x, z}) => {
  const tiers = [[3.2, 1.0], [2.8, 1.0], [2.4, 0.9], [2.0, 0.9], [1.6, 0.8], [1.1, 0.8], [0.6, 0.7]];
  const half = (side: number) => {
    let y = 0;
    return <group position={[side * 2.2, 0, 0]}>
      {tiers.map(([w, h], i) => { const m = <mesh key={i} position={[side * (3.2 - w) / 2 * -1 + side * 0.0, y + h / 2, 0]} castShadow receiveShadow material={M(i % 2 ? '#a8573a' : '#c06a45')}><boxGeometry args={[w, h, w * 0.9]} /></mesh>; y += h; return m; })}
    </group>;
  };
  return <group position={[x, 0.5, z]}>{half(-1)}{half(1)}</group>;
};
const Shops: React.FC = () => {
  const items = useMemo(() => { const r = mulberry32(11); return Array.from({length: 16}, (_, i) => ({x: -60 + i * 7.5 + r() * 1.5, w: 4 + r() * 2.5, h: 2.6 + r() * 3.5, c: ['#f8f1e5', '#ffe5b4', '#e8d5c4', '#fff', '#d8f3dc', '#ffd6a5'][i % 6], roof: ['#c0583a', '#8a3b2a', '#d17a3c'][i % 3]})).filter((s) => Math.abs(s.x) > 5); }, []);
  return <group>
    <mesh position={[0, 0.55, 26]} receiveShadow material={M('#9a9a9a')}><boxGeometry args={[260, 0.1, 5]} /></mesh>
    {items.map((s, i) => <group key={i} position={[s.x, 0.6, 32]}>
      <mesh position={[0, s.h / 2, 0]} castShadow receiveShadow material={M(s.c)}><boxGeometry args={[s.w, s.h, 4]} /></mesh>
      <mesh position={[0, s.h + 0.7, 0]} rotation={[0, Math.PI / 4, 0]} castShadow material={M(s.roof)}><coneGeometry args={[s.w * 0.78, 1.4, 4]} /></mesh>
      <mesh position={[0, 1.1, -2.01]} material={M('#3a5a78')}><boxGeometry args={[s.w * 0.6, 1.2, 0.02]} /></mesh>
    </group>)}
  </group>;
};

// ---------- people ----------
// orientation of a free-floating body: base yaw + slow spin, small tumble, lean toward east
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _e = new THREE.Euler();
export function freeQuat(yaw0: number, fo: FreeOffset, extra?: [number, number, number]): [number, number, number, number] {
  _q.setFromAxisAngle(_ax.set(LEAN_AXIS.x, 0, LEAN_AXIS.z), fo.lean);
  _q.multiply(_q2.setFromAxisAngle(_ax.set(EAST.x, 0, EAST.z), fo.tumble));
  _q.multiply(_q2.setFromAxisAngle(_ax.set(0, 1, 0), yaw0 + fo.yaw));
  if (extra) _q.multiply(_q2.setFromEuler(_e.set(extra[0], extra[1], extra[2])));
  return [_q.x, _q.y, _q.z, _q.w];
}

// ---------- people ----------
// hide: optional per-scene cull (e.g. bodies right in front of the lens). Kuta passes nothing.
export const PersonMesh: React.FC<{i: number; hide?: (x: number, z: number, r?: number) => boolean}> = ({i, hide}) => {
  const f = useCurrentFrame();
  const p = PEOPLE[i];
  const y = p.y[f], tilt = p.tilt[f];
  const air = y > 0.05;
  const idle = Math.sin(f / 9 + i) * 0.03;
  const fo = personFree(i, f); // null unless the script has freeDriftEast
  const arms = fo ? fo.arms : air ? 1 : 0;
  const pos: [number, number, number] = fo ? [p.x + fo.dx, 0.02 + p.z * 0.02 + y + fo.dy, p.z + fo.dz] : [p.x, 0.02 + p.z * 0.02 + y, p.z];
  if (hide && hide(pos[0], pos[2], 1.6)) return null;
  const orient = fo ? {quaternion: freeQuat(p.rot, fo)} : {rotation: [Math.cos(p.tiltDir) * tilt, p.rot, Math.sin(p.tiltDir) * tilt] as [number, number, number]};
  return <group key={fo ? 'free' : 'rest'} position={pos} {...orient} scale={p.s}>
    <mesh geometry={geo.shorts} material={M('#33415c')} position={[0, 0.3, 0]} castShadow />
    <mesh geometry={geo.body} material={M(p.shirt)} position={[0, 0.78 + idle, 0]} castShadow />
    <group position={[0, 1.38 + idle, 0]}>
      <mesh geometry={geo.head} material={M(p.skin)} castShadow />
      <mesh geometry={geo.hair} material={M(p.hair)} position={[0, 0.02, -0.01]} />
      <mesh geometry={geo.eye} material={M('#111')} position={[-0.08, 0.02, 0.2]} />
      <mesh geometry={geo.eye} material={M('#111')} position={[0.08, 0.02, 0.2]} />
      {p.hat && <><mesh geometry={geo.hat} material={M('#f6e7b0')} position={[0, 0.14, 0]} /><mesh geometry={geo.hatTop} material={M('#f6e7b0')} position={[0, 0.22, 0]} /></>}
    </group>
    {[-1, 1].map((s) => <mesh key={s} geometry={geo.body} material={M(p.skin)} position={[s * 0.33, 0.9 + arms * 0.35, 0]} rotation={[0, 0, s * (0.25 + arms * 2.4)]} scale={[0.32, 0.55, 0.32]} castShadow />)}
  </group>;
};

// world position (pole foot / centre) and orientation of a loose prop; free drift is added when active
export function objWorld(i: number, f: number) {
  const o = OBJS[i], q = objPose(o, f), fo = objFree(i, f);
  const baseY = o.kind === 'umbrella' ? q.y + 0.3 : o.kind === 'ball' ? q.y + 0.5 + o.z * 0.02 : q.y + 0.25 + o.z * 0.02;
  if (!fo) return {x: q.x, y: baseY, z: o.z, q, fo};
  return {x: q.x + fo.dx, y: baseY + fo.dy * (o.kind === 'umbrella' ? 0.8 : 1), z: o.z + fo.dz, q, fo};
}
export const Objects: React.FC<{hide?: (x: number, z: number, r?: number) => boolean}> = ({hide}) => {
  const f = useCurrentFrame();
  return <group>{OBJS.map((o, i) => {
    if (hide || objFree(i, f)) { // opt-in path (Copacabana): drift + near-camera cull
      const w = objWorld(i, f), fo = w.fo, q = w.q;
      if (hide && hide(w.x, w.z, o.kind === 'umbrella' ? 3.2 : 2.2)) return null; // umbrella canopies: ~3 m clear of the lens
      const extra: [number, number, number] = o.kind === 'umbrella' ? [q.rx, 0, q.rz + 0.08] : o.kind === 'ball' ? [q.rx, 0, q.rz] : [q.rx, o.spin, q.rz];
      const orient = fo ? {quaternion: freeQuat(0, {...fo, yaw: fo.yaw * (o.kind === 'umbrella' ? 0.5 : 1.6)}, extra)} : {rotation: extra};
      if (o.kind === 'umbrella') return <group key={i} position={[w.x, w.y, w.z]} {...orient}>
        <mesh geometry={geo.pole} material={M('#eeeeee')} position={[0, 1.1, 0]} castShadow />
        <mesh geometry={geo.canopy} material={M(o.color)} position={[0, 2.25, 0]} castShadow />
      </group>;
      return <mesh key={i} geometry={o.kind === 'ball' ? geo.ball : geo.towel} material={M(o.color)} position={[w.x, w.y, w.z]} {...orient} castShadow />;
    }
    const q = objPose(o, f);
    if (o.kind === 'umbrella') return <group key={i} position={[q.x, q.y + 0.3, o.z]} rotation={[q.rx, 0, q.rz + 0.08]}>
      <mesh geometry={geo.pole} material={M('#eeeeee')} position={[0, 1.1, 0]} castShadow />
      <mesh geometry={geo.canopy} material={M(o.color)} position={[0, 2.25, 0]} castShadow />
    </group>;
    if (o.kind === 'ball') return <mesh key={i} geometry={geo.ball} material={M(o.color)} position={[q.x, q.y + 0.5 + o.z * 0.02, o.z]} rotation={[q.rx, 0, q.rz]} castShadow />;
    return <mesh key={i} geometry={geo.towel} material={M(o.color)} position={[q.x, q.y + 0.25 + o.z * 0.02, o.z]} rotation={[q.rx, o.spin, q.rz]} castShadow />;
  })}</group>;
};

export const SandBurst: React.FC = () => {
  const f = useCurrentFrame();
  const parts = useMemo(() => { const r = mulberry32(21); return Array.from({length: 260}, () => ({x: -25 + r() * 50, z: 2 + r() * 18, v: 0.3 + r() * 1.2, d: r() * 2.5, s: 0.04 + r() * 0.08})); }, []);
  const s0 = simT[fr(T.drift)], s = simT[f], sSnap = simT[fr(T.snap)];
  if (s < s0) return null;
  return <group>{parts.map((p, i) => {
    const q = Math.max(0, Math.min(s, sSnap) - s0 - p.d * 0.5);
    if (q <= 0) return null;
    let y = p.v * q * 1.4, x = p.x + q * 1.1;
    if (s > sSnap) { const d = s - sSnap; y = Math.max(0, y - 4.9 * d * d); }
    if (y <= 0 && s > sSnap) return null;
    return <mesh key={i} geometry={geo.ball} material={M('#e9cf98')} position={[x, 0.4 + y, p.z]} scale={p.s * 3} />;
  })}</group>;
};

export const Frisbee: React.FC = () => {
  const f = useCurrentFrame(); const q = frisbeePose(f);
  if (!q) return null;
  return <mesh geometry={geo.frisbee} material={M('#ff2e63')} position={[q.x, q.y, q.z]} rotation={[0.15, f * 0.6, 0.1]} castShadow />;
};

export const World: React.FC = () => {
  const palms = useMemo(() => { const r = mulberry32(3); return Array.from({length: 18}, (_, i) => ({x: -60 + i * 7 + r() * 2, z: 21 + r() * 2.5, h: 5 + r() * 2.5, lean: (r() - 0.5) * 0.35})); }, []);
  return <>
    <CameraRig />
    <Sky />
    <fog attach="fog" args={['#cfe9ff', 60, 230]} />
    <hemisphereLight args={['#dff3ff', '#e6c98f', 0.85]} />
    <directionalLight position={[18, 30, 22]} intensity={2.1} color="#fff4e0" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={120} shadow-bias={-0.0005} />
    <mesh position={[60, 70, -300]}><sphereGeometry args={[14, 20, 16]} /><meshBasicMaterial color="#fff6d8" fog={false} /></mesh>
    <Clouds />
    <Sea />
    <Sand />
    <Shops />
    <Gate x={0} z={30} />
    {palms.map((p, i) => <Palm key={i} {...p} />)}
    {PEOPLE.map((_, i) => <PersonMesh key={i} i={i} />)}
    <Objects />
    <SandBurst />
    <Frisbee />
  </>;
};
