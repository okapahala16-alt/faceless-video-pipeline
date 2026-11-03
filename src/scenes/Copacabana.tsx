// Copacabana, Rio de Janeiro: a stylised, original low-poly take on the place.
// Coordinates match the Kuta scene where the crowd lives (shoreline z = 0, sand toward +z),
// so the shared physics (src/sim.ts), sea, people and props work unchanged.
// Layout toward +z: sand -> wave-pattern promenade -> Avenida (road) -> sidewalk -> high-rise row -> hills.
// The bay curves seaward at both ends; Sugarloaf-like dome rises at the far left (-x).
import React, {useMemo, useLayoutEffect, useRef, useCallback} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {FPS, mulberry32, clamp, tl} from '../timeline';
import {PEOPLE, KID_INDEX, OBJS, EAST, TE, driftAt, freeParams, freeOffset, personFree} from '../sim';
import {CameraRig, Sky, Clouds, Sea, Palm, PersonMesh, Objects, SandBurst, Frisbee, M, shotFor, Shot, cameraAt, freeQuat, objWorld} from '../World';
import {ME, anchorify, gradeAt, GRADE_U, hasGrade} from '../grade';
import {Trails, AirFlow, TrailBody} from '../FreeFx';
import {OceanShift, Seabed, ShockFronts, RespinDust, oceanMoves} from './copaPhase2';

// ---------- layout ----------
const PROM_Z0 = 30, PROM_Z1 = 37;      // promenade (wave pavement)
const ROAD_Z0 = 37, ROAD_Z1 = 51;      // avenue
const WALK_Z1 = 55;                    // building-side sidewalk
const BLD_Z = 56;                      // building front line
export const ground = (zl: number) => zl * 0.02; // same slope as the Kuta sand
// bay curve: ends bend toward the sea (negative z)
export const bay = (x: number) => -0.0025 * Math.max(0, Math.abs(x) - 45) ** 2;

// ---------- procedural textures (DataTexture: deterministic, no DOM canvas) ----------
function wavePavementTexture() {
  const W = 1024, H = 256, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y + 22 * Math.sin((2 * Math.PI * x) / 256);       // 4 wave periods across, tiles seamlessly
    const band = Math.floor(v / 32) & 1;
    const c = band ? 236 : 24;
    const i = (y * W + x) * 4; data[i] = c; data[i + 1] = c - (band ? 4 : 0); data[i + 2] = c - (band ? 10 : 0); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, W, H); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function facadeTexture() {
  const W = 64, H = 64, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fy = y % 16, fx = x % 16;
    let r = 255, g = 255, b = 255;                               // tinted by the material colour
    if (fy >= 5 && fy <= 12 && fx >= 2 && fx <= 13) { r = 70; g = 92; b = 112; }   // window
    if (fy === 3 || fy === 4) { r = 205; g = 205; b = 205; }      // balcony slab shadow line
    const i = (y * W + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, W, H); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ---------- ground strips that follow the bay curve ----------
function curvedStrip(z0: number, z1: number, segX = 140, segZ = 6, x0 = -190, x1 = 190, lift = 0) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i] + (x0 + x1) / 2, zl = p[i + 2] + (z0 + z1) / 2;
    p[i] = x; p[i + 2] = zl + bay(x); p[i + 1] = ground(zl) + lift;
  }
  g.computeVertexNormals();
  return g;
}

const CopaSand: React.FC = () => {
  const g = useMemo(() => {
    const g = new THREE.PlaneGeometry(380, PROM_Z0 + 4, 160, 24); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position.array as Float32Array; const r = mulberry32(19);
    const cols = new Float32Array(p.length); const wet = new THREE.Color('#c8a877'), dry = new THREE.Color('#f6e2b3');
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], zl = p[i + 2] + (PROM_Z0 + 4) / 2 - 2;
      p[i + 2] = zl + bay(x); p[i + 1] = ground(zl) + (r() - 0.5) * 0.05 - 0.02;
      const c = wet.clone().lerp(dry, clamp(zl / 5)); const n = (r() - 0.5) * 0.04;
      cols[i] = c.r + n; cols[i + 1] = c.g + n; cols[i + 2] = c.b + n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
  }, []);
  const m = useMemo(() => anchorify(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true})), []);
  return <mesh geometry={g} material={m} receiveShadow />;
};

const Promenade: React.FC = () => {
  const g = useMemo(() => {
    const g = curvedStrip(PROM_Z0, PROM_Z1, 200, 4, -190, 190, 0.12);
    const uv = g.attributes.uv.array as Float32Array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] *= 380 / 9; uv[i + 1] *= 1; } // one tile ~9 m along the beach
    return g;
  }, []);
  const m = useMemo(() => anchorify(new THREE.MeshStandardMaterial({map: wavePavementTexture(), roughness: 0.9})), []);
  const curb = useMemo(() => curvedStrip(PROM_Z0 - 0.4, PROM_Z0, 200, 1, -190, 190, 0.14), []);
  return <group>
    <mesh geometry={g} material={m} receiveShadow />
    <mesh geometry={curb} material={ME('#d9d4c7')} receiveShadow />
  </group>;
};

// cars on the Avenida are free bodies: when the Earth stops they keep going and drift east
const CARS = (() => {
  const r = mulberry32(31); const cols = ['#e63946', '#f1faee', '#1d3557', '#ffb703', '#2a9d8f', '#adb5bd', '#111111', '#ffffff'];
  return Array.from({length: 26}, (_, i) => ({lane: i % 2 ? 41.2 : 46.8, dir: i % 2 ? 1 : -1, x0: -180 + r() * 360, speed: 6 + r() * 5,
    c: cols[Math.floor(r() * cols.length)], taxi: r() < 0.25}));
})();
const CAR_FREE = freeParams(4327, CARS.length).map((p) => ({...p, lift: p.lift * 0.5, spin: p.spin * 0.4, lean: p.lean * 0.3}));
function carWorld(i: number, f: number, t = f / FPS) {
  const c = CARS[i];
  const fo = freeOffset(CAR_FREE[i], t);
  const wrap = (v: number) => ((v + 190) % 380 + 380) % 380 - 190;
  // free: keeps its own speed from the moment the ground stopped (no wrap-around), plus the drift
  const x = fo ? wrap(c.x0 + c.dir * c.speed * TE.drift0) + c.dir * c.speed * (t - TE.drift0) : wrap(c.x0 + c.dir * c.speed * t);
  const z = c.lane + bay(x), y = ground(c.lane) + 0.1;
  const slope = Math.atan(-0.005 * Math.sign(x) * Math.max(0, Math.abs(x) - 45));
  return fo ? {x: x + fo.dx, y: y + fo.dy, z: z + fo.dz, slope, fo} : {x, y, z, slope, fo};
}
type Hide = (x: number, z: number, r?: number) => boolean;
const Avenue: React.FC<{hide?: Hide}> = ({hide}) => {
  const f = useCurrentFrame();
  const road = useMemo(() => curvedStrip(ROAD_Z0, ROAD_Z1, 200, 4, -190, 190, 0.1), []);
  const median = useMemo(() => curvedStrip(43.2, 44.8, 200, 1, -190, 190, 0.16), []);
  const walk = useMemo(() => curvedStrip(ROAD_Z1, WALK_Z1, 200, 2, -190, 190, 0.14), []);
  const dashes = useMemo(() => {
    const out: {x: number; z: number}[] = [];
    for (let x = -186; x <= 186; x += 6) for (const z of [40, 48]) out.push({x, z});
    return out;
  }, []);
  const t = f / FPS;
  return <group>
    <mesh geometry={road} material={ME('#3b3f45')} receiveShadow />
    <mesh geometry={median} material={ME('#c9c2b3')} receiveShadow />
    <mesh geometry={walk} material={ME('#d6d0c2')} receiveShadow />
    {dashes.map((d, i) => <mesh key={i} position={[d.x, ground(d.z) + 0.115, d.z + bay(d.x)]} material={ME('#e9e9e9')}><boxGeometry args={[2.4, 0.01, 0.15]} /></mesh>)}
    {CARS.map((c, i) => {
      const w = carWorld(i, f, t);
      if (hide && hide(w.x, w.z, 2.6)) return null;
      const orient = w.fo ? {quaternion: freeQuat(0, w.fo, [0, w.slope, 0])} : {rotation: [0, w.slope, 0] as [number, number, number]};
      return <group key={`${i}${w.fo ? 'f' : ''}`} position={[w.x, w.y, w.z]} {...orient}>
        <mesh position={[0, 0.55, 0]} material={M(c.taxi ? '#ffd23f' : c.c)} castShadow><boxGeometry args={[4.2, 0.8, 1.8]} /></mesh>
        <mesh position={[-0.2, 1.15, 0]} material={M('#22303c')} castShadow><boxGeometry args={[2.2, 0.55, 1.6]} /></mesh>
      </group>;
    })}
  </group>;
};

// building row (module level so other effects, e.g. shock fronts, can use the same footprints)
export type Bld = {x: number; w: number; d: number; h: number; c: string; floors: number};
export const BUILDINGS: Bld[] = (() => {
  const r = mulberry32(53); const out: Bld[] = [];
  const cols = ['#f7f3ea', '#efe6d2', '#e9ddd0', '#f4efe2', '#dfe7ea', '#f1e1cf', '#e8eef0', '#f6ead8', '#dcd6cc'];
  let x = -160;
  while (x < 160) {
    const w = 9 + r() * 9, floors = 9 + Math.floor(r() * 6);
    out.push({x: x + w / 2, w, d: 14 + r() * 6, h: floors * 3.1, c: cols[Math.floor(r() * cols.length)], floors});
    x += w + 0.6 + r() * 1.2;
  }
  return out;
})();
// world-space footprint centre of a building (same placement as <Buildings/>)
export const bldCenter = (b: Bld) => ({x: b.x, y: ground(BLD_Z) + 0.14, z: BLD_Z + b.d / 2 + bay(b.x)});
const Buildings: React.FC = () => {
  const tex = useMemo(() => facadeTexture(), []);
  const list = BUILDINGS;
  const mats = useMemo(() => list.map((b) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(Math.round(b.w / 2.6), b.floors);
    return anchorify(new THREE.MeshStandardMaterial({map: t, color: b.c, roughness: 0.8}));
  }), [list, tex]);
  return <group>{list.map((b, i) => {
    const zl = BLD_Z + b.d / 2, z = zl + bay(b.x), y = ground(BLD_Z) + 0.14;
    const slope = Math.atan(-0.005 * Math.sign(b.x) * Math.max(0, Math.abs(b.x) - 45));
    return <group key={i} position={[b.x, y, z]} rotation={[0, slope, 0]}>
      <mesh position={[0, b.h / 2, 0]} material={mats[i]} castShadow receiveShadow><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
      <mesh position={[0, b.h + 0.4, 0]} material={ME('#cfc8bb')}><boxGeometry args={[b.w * 0.96, 0.8, b.d * 0.96]} /></mesh>
      <mesh position={[0, 1.6, -b.d / 2 - 0.05]} material={ME('#2c3540')}><boxGeometry args={[b.w * 0.9, 3.0, 0.1]} /></mesh>
    </group>;
  })}</group>;
};

// rounded granite dome with a green base (Sugarloaf-like), built as a lathe
const Dome: React.FC<{x: number; z: number; h: number; r: number; lean?: number}> = ({x, z, h, r, lean = 0}) => {
  const rock = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(new THREE.Vector2(r * Math.pow(Math.cos(u * Math.PI / 2), 0.55), h * u)); }
    return new THREE.LatheGeometry(pts, 18);
  }, [h, r]);
  const skirt = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(new THREE.Vector2(r * 1.35 * (1 - u * 0.45), h * 0.32 * u)); }
    return new THREE.LatheGeometry(pts, 18);
  }, [h, r]);
  return <group position={[x, -1, z]} rotation={[0, 0, lean]}>
    <mesh geometry={rock} material={ME('#8d8a83')} castShadow />
    <mesh geometry={skirt} material={ME('#3f7d3a')} />
  </group>;
};

const Hills: React.FC = () => {
  const hills = useMemo(() => {
    const r = mulberry32(71);
    return Array.from({length: 11}, (_, i) => ({x: -230 + i * 46 + r() * 20, z: 140 + r() * 70, h: 45 + r() * 70, w: 50 + r() * 40}));
  }, []);
  return <group>
    {hills.map((h, i) => <mesh key={i} position={[h.x, h.h / 2 - 2, h.z]} scale={[h.w, h.h, h.w * 0.8]} material={ME(i % 2 ? '#3d7a3f' : '#4a8a47')}>
      <icosahedronGeometry args={[0.62, 1]} /></mesh>)}
    {/* headland at the left end of the bay, and the domes beyond it */}
    <mesh position={[-180, 8, -20]} scale={[52, 40, 70]} material={ME('#3f7d3a')}><icosahedronGeometry args={[0.6, 1]} /></mesh>
    <mesh position={[180, 6, -20]} scale={[44, 30, 60]} material={ME('#467f3f')}><icosahedronGeometry args={[0.6, 1]} /></mesh>
    <Dome x={-250} z={-70} h={118} r={30} lean={0.08} />
    <Dome x={-212} z={-58} h={64} r={26} />
  </group>;
};

const Kiosks: React.FC = () => {
  const items = useMemo(() => Array.from({length: 15}, (_, i) => -168 + i * 24), []);
  return <group>{items.map((x, i) => {
    const zl = 33.5, z = zl + bay(x), y = ground(zl) + 0.12;
    return <group key={i} position={[x, y, z]}>
      <mesh position={[0, 1.3, 0]} material={ME('#f2efe6')} castShadow><cylinderGeometry args={[1.5, 1.5, 2.6, 8]} /></mesh>
      <mesh position={[0, 2.9, 0]} material={ME(i % 2 ? '#1f8a70' : '#e76f51')} castShadow><coneGeometry args={[2.6, 0.9, 8]} /></mesh>
      {[-1, 1].map((s) => <group key={s} position={[s * 3.4, 0, -0.6]}>
        <mesh position={[0, 1.15, 0]} material={ME('#dddddd')}><cylinderGeometry args={[0.04, 0.04, 2.3, 6]} /></mesh>
        <mesh position={[0, 2.25, 0]} material={ME('#f4f1de')} castShadow><coneGeometry args={[1.3, 0.45, 8, 1, true]} /></mesh>
        <mesh position={[0, 0.72, 0]} material={ME('#f4f1de')}><cylinderGeometry args={[0.55, 0.55, 0.06, 12]} /></mesh>
      </group>)}
    </group>;
  })}</group>;
};

const LifeguardPosts: React.FC = () => {
  const xs = [-150, -75, 40, 115];
  return <group>{xs.map((x, i) => {
    const zl = 24, z = zl + bay(x), y = ground(zl);
    return <group key={i} position={[x, y, z]}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <mesh key={k} position={[a * 1.1, 1.6, b * 1.1]} material={ME('#e9e4d8')}><boxGeometry args={[0.16, 3.2, 0.16]} /></mesh>)}
      <mesh position={[0, 3.9, 0]} material={ME('#ffffff')} castShadow><boxGeometry args={[3.0, 1.6, 3.0]} /></mesh>
      <mesh position={[0, 3.9, -1.52]} material={ME('#e63946')}><boxGeometry args={[3.0, 0.45, 0.04]} /></mesh>
      <mesh position={[0, 4.9, 0]} material={ME('#2b2d42')}><boxGeometry args={[3.3, 0.2, 3.3]} /></mesh>
    </group>;
  })}</group>;
};

const VolleyNets: React.FC = () => {
  const nets = [-60, -38, 32, 54, 78];
  const netMat = useMemo(() => anchorify(new THREE.MeshStandardMaterial({color: '#1b1b1b', transparent: true, opacity: 0.55, roughness: 1})), []);
  return <group>{nets.map((x, i) => {
    const zl = 22, z = zl + bay(x), y = ground(zl);
    return <group key={i} position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      {[-4.6, 4.6].map((s) => <mesh key={s} position={[s, 1.25, 0]} material={ME('#f1f1f1')} castShadow><cylinderGeometry args={[0.06, 0.06, 2.5, 6]} /></mesh>)}
      <mesh position={[0, 2.05, 0]} material={netMat}><boxGeometry args={[9.2, 0.9, 0.02]} /></mesh>
      <mesh position={[0, 2.52, 0]} material={ME('#ffffff')}><boxGeometry args={[9.2, 0.07, 0.04]} /></mesh>
    </group>;
  })}</group>;
};


// Background crowd along the whole bay (instanced). The 190 physics people live in x -26..26,
// z 2.5..18.5; extras fill the rest of the sand so the beach reads as packed. They are free bodies:
// when the Earth stops they drift east like everyone else (instance matrices updated per frame).
const EXTRA = (() => {
  const r = mulberry32(97);
  const shirts = ['#ff6b6b', '#ffd93d', '#3ec97a', '#4d96ff', '#ff9f1c', '#f15bb5', '#00bbf9', '#ffffff', '#9b5de5', '#2ec4b6', '#e63946'];
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#b5835a'];
  const ppl: {x: number; zl: number; s: number; rot: number; shirt: string; skin: string; lie: boolean}[] = [];
  while (ppl.length < 520) {
    const x = -150 + r() * 300, zl = 2 + Math.pow(r(), 1.3) * 25;
    if (Math.abs(x) < 29 && zl < 20) continue;
    ppl.push({x, zl, s: 0.9 + r() * 0.2, rot: r() * Math.PI * 2, shirt: shirts[Math.floor(r() * shirts.length)], skin: skins[Math.floor(r() * skins.length)], lie: r() < 0.22});
  }
  const umb: {x: number; zl: number; c: string}[] = [];
  const ucol = ['#ff4d6d', '#ffd93d', '#4d96ff', '#3ec97a', '#ffffff', '#f15bb5', '#ff9f1c'];
  while (umb.length < 150) {
    const x = -150 + r() * 300, zl = 6 + r() * 18;
    if (Math.abs(x) < 29 && zl < 20) continue;
    umb.push({x, zl, c: ucol[Math.floor(r() * ucol.length)]});
  }
  return {ppl, umb, pplFree: freeParams(4297, ppl.length), umbFree: freeParams(4311, umb.length).map((p) => ({...p, lift: p.lift * 0.8}))};
})();
// feet / pole-foot position of an extra at frame f (with drift)
function extraFoot(kind: 'ppl' | 'umb', i: number, t: number) {
  const it = kind === 'ppl' ? EXTRA.ppl[i] : EXTRA.umb[i];
  const fo = freeOffset((kind === 'ppl' ? EXTRA.pplFree : EXTRA.umbFree)[i], t);
  const x = it.x, y = ground(it.zl), z = it.zl + bay(it.x);
  return fo ? {x: x + fo.dx, y: y + fo.dy, z: z + fo.dz, fo} : {x, y, z, fo};
}
const ExtraCrowd: React.FC<{hide?: Hide}> = ({hide}) => {
  const f = useCurrentFrame();
  const meshes = useMemo(() => {
    const data = EXTRA;
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.26, 0.55, 3, 8), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true}), data.ppl.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true}), data.ppl.length);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), new THREE.MeshStandardMaterial({color: '#eeeeee'}), data.umb.length);
    const can = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true, side: THREE.DoubleSide}), data.umb.length);
    const col = new THREE.Color();
    data.ppl.forEach((p, i) => { body.setColorAt(i, col.set(p.shirt)); head.setColorAt(i, col.set(p.skin)); });
    data.umb.forEach((u, i) => can.setColorAt(i, col.set(u.c)));
    for (const im of [body, head, pole, can]) { if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; }
    return [body, head, pole, can];
  }, []);
  useLayoutEffect(() => {
    const [body, head, pole, can] = meshes, t = f / FPS;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qf = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const foot = new THREE.Vector3(), off = new THREE.Vector3();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    // place a part: offset from the feet is rotated with the body when it floats
    const put = (im: THREE.InstancedMesh, i: number, ox: number, oy: number, oz: number, free: boolean) => {
      off.set(ox, oy, oz); if (free) off.applyQuaternion(qf);
      v.copy(foot).add(off); m.compose(v, free ? qf.clone().multiply(q) : q, sc); im.setMatrixAt(i, m);
    };
    EXTRA.ppl.forEach((p, i) => {
      const w = extraFoot('ppl', i, t);
      if (hide && hide(w.x, w.z, 1.2)) { body.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); return; }
      foot.set(w.x, w.y, w.z);
      if (w.fo) { const a = freeQuat(0, w.fo); qf.set(a[0], a[1], a[2], a[3]); }
      e.set(p.lie ? Math.PI / 2 : 0, p.rot, 0); q.setFromEuler(e); sc.set(p.s, p.s, p.s);
      put(body, i, 0, p.lie ? 0.3 : 0.78 * p.s, 0, !!w.fo);
      if (p.lie) put(head, i, Math.sin(p.rot) * 0.6, 0.3, Math.cos(p.rot) * 0.6, !!w.fo); else put(head, i, 0, 1.38 * p.s, 0, !!w.fo);
    });
    EXTRA.umb.forEach((u, i) => {
      const w = extraFoot('umb', i, t);
      if (hide && hide(w.x, w.z, 3.2)) { pole.setMatrixAt(i, ZERO); can.setMatrixAt(i, ZERO); return; }
      foot.set(w.x, w.y, w.z);
      if (w.fo) { const a = freeQuat(0, {...w.fo, yaw: w.fo.yaw * 0.5}); qf.set(a[0], a[1], a[2], a[3]); }
      q.identity(); sc.set(1, 1, 1);
      put(pole, i, 0, 1.4, 0, !!w.fo); put(can, i, 0, 2.55, 0, !!w.fo);
    });
    for (const im of meshes) im.instanceMatrix.needsUpdate = true;
  }, [f, meshes, hide]);
  return <group>{meshes.map((im, i) => <primitive key={i} object={im} />)}</group>;
};

// trail sources: every free body that drifts (physics crowd, props, extras, cars)
function freeBodies(f: number, hide?: Hide): TrailBody[] {
  const t = f / FPS, out: TrailBody[] = [];
  PEOPLE.forEach((p, i) => {
    const fo = personFree(i, f); if (!fo) return;
    const x = p.x + fo.dx, z = p.z + fo.dz;
    if (hide && hide(x, z, 1.2)) return;
    out.push({x, y: 0.02 + p.z * 0.02 + fo.dy + 0.85 * p.s, z, h: 1.45 * p.s, w: 0.62, speed: fo.speed});
  });
  OBJS.forEach((o, i) => {
    const w = objWorld(i, f); if (!w.fo) return;
    if (hide && hide(w.x, w.z, o.kind === 'umbrella' ? 3.2 : 2.2)) return;
    if (o.kind === 'umbrella') out.push({x: w.x, y: w.y + 2.1, z: w.z, h: 0.7, w: 2.0, speed: w.fo.speed});
    else out.push({x: w.x, y: w.y, z: w.z, h: o.kind === 'ball' ? 0.55 : 0.35, w: o.kind === 'ball' ? 0.55 : 1.2, speed: w.fo.speed});
  });
  EXTRA.ppl.forEach((p, i) => {
    const w = extraFoot('ppl', i, t); if (!w.fo) return;
    if (hide && hide(w.x, w.z, 1.2)) return;
    out.push({x: w.x, y: w.y + (p.lie ? 0.35 : 0.85 * p.s), z: w.z, h: p.lie ? 0.55 : 1.45 * p.s, w: p.lie ? 1.4 : 0.62, speed: w.fo.speed});
  });
  EXTRA.umb.forEach((_, i) => {
    const w = extraFoot('umb', i, t); if (!w.fo) return;
    if (hide && hide(w.x, w.z, 3.2)) return;
    out.push({x: w.x, y: w.y + 2.4, z: w.z, h: 0.7, w: 2.0, speed: w.fo.speed});
  });
  CARS.forEach((_, i) => {
    const w = carWorld(i, f, t); if (!w.fo) return;
    if (hide && hide(w.x, w.z, 2.6)) return;
    out.push({x: w.x, y: w.y + 0.8, z: w.z, h: 1.4, w: 2.0, speed: w.fo.speed});
  });
  return out;
}

// ---------- camera shots for this scene (Kuta shot names still work as a fallback) ----------
// start of the run of consecutive beats that share this shot (ground -> stop stays one continuous move)
function runStart(t: number, id: string) {
  let i = tl.beats.findIndex((b) => t >= b.start && t < b.end);
  if (i < 0) i = t < tl.beats[0].start ? 0 : tl.beats.length - 1;
  while (i > 0 && tl.beats[i - 1].shot === id) i--;
  return tl.beats[i].start;
}
const SIDE = {x: EAST.z, z: -EAST.x};  // horizontal, 90 deg left of east: toward Leme and the land
const WEST = {x: -EAST.x, z: -EAST.z};
// close-up subject: an adult of the physics crowd near the middle of the beach (not the kid), picked so
// that at the start of the close-up beat they face the land side (camera in front sees sky + sea behind)
const CLOSE_BEAT = tl.beats.find((b) => b.shot === 'tracking_east_close');
const facing = (i: number, f: number) => PEOPLE[i].rot + (personFree(i, f)?.yaw ?? 0); // yaw of the face (+z local)
export const CLOSE_SUBJECT = (() => {
  const f0 = Math.round((CLOSE_BEAT ? CLOSE_BEAT.start : 0) * FPS);
  let best = 0, bs = -Infinity;
  PEOPLE.forEach((p, i) => {
    if (i === KID_INDEX) return;
    const d = Math.hypot(p.x - 2, p.z - 10); if (d > 7) return;
    const a = facing(i, f0), score = Math.sin(a) * SIDE.x + Math.cos(a) * SIDE.z - d * 0.04;
    if (score > bs) { bs = score; best = i; }
  });
  return best;
})();
function subjectAt(f: number) {
  const p = PEOPLE[CLOSE_SUBJECT], fo = personFree(CLOSE_SUBJECT, f);
  return [p.x + (fo ? fo.dx : 0), 0.02 + p.z * 0.02 + (fo ? fo.dy : 0) + 1.05 * p.s, p.z + (fo ? fo.dz : 0)];
}
// Eye-level camera spot for one run of copa_crowd_level: searched once per run, deterministic. Picks the
// point whose nearest person (in view, looking -x; drift included) stays farthest away during the run.
const spotCache = new Map<number, [number, number]>();
function crowdSpot(t0: number): [number, number] {
  const hit = spotCache.get(t0); if (hit) return hit;
  let t1 = t0;
  for (const b of tl.beats) if (b.start >= t0 - 1e-6 && b.shot === 'copa_crowd_level' && Math.abs(b.start - t1) < 1e-3) t1 = b.end;
  let best: [number, number] = [4.5, 11], bw = -1;
  const f0 = Math.round(t0 * FPS), f1 = Math.round(t1 * FPS) - 1;
  for (let x = 2; x <= 16; x += 0.5) for (let z = 5; z <= 15; z += 0.5) {
    let worst = 99;
    for (let f = f0; f <= f1 && worst > bw; f += 6) {
      const t = f / FPS, d = driftAt(t), cx = x - 0.3 * Math.min(t - t0, 10) + EAST.x * d, cz = z + EAST.z * d;
      for (let i = 0; i < PEOPLE.length; i++) {
        const p = PEOPLE[i], fo = personFree(i, f);
        const dx = p.x + (fo ? fo.dx : 0) - cx, dz = p.z + (fo ? fo.dz : 0) - cz;
        const inFront = dx < 0 && Math.abs(dz) < -dx * 0.9 + 0.5;
        worst = Math.min(worst, Math.hypot(dx, dz) + (inFront ? 0 : 1.2));
      }
      for (let i = 0; i < OBJS.length; i++) { // props need more room (towels/umbrellas fill the lens)
        const w = objWorld(i, f), dist = Math.hypot(w.x - cx, w.z - cz);
        worst = Math.min(worst, dist - (OBJS[i].kind === 'umbrella' ? 1.6 : 1.0));
      }
    }
    if (worst > bw) { bw = worst; best = [x, z]; }
  }
  spotCache.set(t0, best);
  return best;
}
export function copaShot(id: string, f: number): Shot {
  const t = f / FPS;
  switch (id) {
    case 'bay_aerial': return {p0: [125, 45, -12], p1: [110, 41, -14], l0: [-180, 22, 10], l1: [-185, 24, 8]};
    case 'promenade_low': return {p0: [16, 1.9, 31.0], p1: [8, 1.9, 31.0], l0: [-70, 3, 22], l1: [-80, 4, 20]};
    case 'skyline_from_sea': return {p0: [-10, 3.2, -16], p1: [8, 3.6, -14], l0: [0, 10, 40], l1: [0, 11, 40]};
    case 'sugarloaf': return {p0: [6, 2.2, 14], p1: [0, 2.6, 13], l0: [-230, 45, -60], l1: [-235, 48, -62]};
    case 'avenue': return {p0: [-30, 9, 46], p1: [-18, 8, 46], l0: [10, 2, 30], l1: [20, 2, 24]};
    case 'crowd_sand': return {p0: [1, 3.0, 22], p1: [1, 2.2, 16], l0: [0, 1.3, 5], l1: [0, 1.3, 7]};
    // eye level (1.6 m) inside the crowd, looking north-east along the beach toward Leme. The camera
    // is a free body too: once the Earth stops it drifts east with the crowd (ground slides away).
    case 'copa_crowd_level': {
      const d = driftAt(t), t0 = runStart(t, id), tau = t - t0, sp = crowdSpot(t0);
      const x = sp[0] - 0.3 * Math.min(tau, 10), z = sp[1];
      const P = [x + EAST.x * d, 1.6, z + EAST.z * d];
      const L = [P[0] - 40, 1.3, P[2] - 6.0];
      return {p0: P, p1: P, l0: L, l1: L, focus: [P[0] - 14, 0, P[2] - 2]};
    }
    // camera moves east with the crowd, from the sea side and a little behind; city recedes behind them
    case 'tracking_east_with_crowd': {
      const d = driftAt(t), tau = t - runStart(t, id);
      const C = [EAST.x * d - 2, 1.4, 9 + EAST.z * d];
      const back = 16 - 0.6 * Math.min(tau, 6);
      const P = [C[0] - SIDE.x * back + EAST.x * 2, 5.2 - 0.2 * Math.min(tau, 6), C[2] - SIDE.z * back + EAST.z * 2];
      const L = [C[0] + WEST.x * 9, 1.0, C[2] + WEST.z * 9];
      return {p0: P, p1: P, l0: L, l1: L, focus: [C[0], 0, C[2]]};
    }
    // close-up of one floating person, the camera floats with them in front and a little to the side;
    // it turns at half their spin, so the face stays readable while the slow rotation still shows
    case 'tracking_east_close': {
      const S = subjectAt(f), t0 = runStart(t, id), tau = t - t0;
      const a = 0.5 * (facing(CLOSE_SUBJECT, f) + facing(CLOSE_SUBJECT, Math.round(t0 * FPS))) + 0.55;
      const r = 3.2 - 0.4 * Math.min(tau, 4.5) / 4.5;
      const P = [S[0] + Math.sin(a) * r, S[1] - 0.15, S[2] + Math.cos(a) * r];
      const L = [S[0], S[1] + 0.05, S[2]];
      return {p0: P, p1: P, l0: L, l1: L, focus: S};
    }
    // --- phase 2 ---
    // profile of the front buildings from the land side, above the roofs, sea behind; slow orbit across wall+record
    case 'avenida_buildings_low': {
      // 3/4 aerial profile: off to the Leme side and inland, above roof height, looking across the row
      // toward the sea; flow (east) crosses the frame, shock shells sit on the inland (windward) faces
      const H = bldCenter(HERO), tau = t - runStart(t, id), a = 0.1 * clamp(tau / 9);
      const sx = SIDE.x * Math.cos(a) - SIDE.z * Math.sin(a), sz = SIDE.x * Math.sin(a) + SIDE.z * Math.cos(a);
      const P = [H.x + sx * 120 + WEST.x * 55, 92 - 6 * clamp(tau / 9), H.z + sz * 120 + WEST.z * 55];
      const L = [H.x + EAST.x * 150, 0, H.z + EAST.z * 150]; // buildings mid-frame, sea and water edge behind them
      return {p0: P, p1: P, l0: L, l1: L, fov: 40, focus: [H.x, 0, H.z]};
    }
    // high above the old waterline, 45 deg down toward the south-east: seabed opening up as the sea leaves
    case 'shoreline_high_angle': {
      // 300 m up, ~340 m inland, pitched ~30 deg down (solved so the old beach lands around y 1350 px and the
      // receding water edge around y 650 px): city roofs at the bottom, beach, open seabed, the water far out
      const tau = clamp((t - runStart(t, id)) / 9);
      const P = [30, 300 + 20 * tau, 340 + 15 * tau];
      const dirx = -0.12, dirz = -1, pitch = (29.8 * Math.PI) / 180, n = Math.hypot(dirx, dirz);
      const L = [P[0] + (dirx / n) * 400 * Math.cos(pitch), P[1] - 400 * Math.sin(pitch), P[2] + (dirz / n) * 400 * Math.cos(pitch)];
      return {p0: P, p1: P, l0: L, l1: L, fov: 54, focus: [0, 0, 10]};
    }
    // low on the beach looking south-east: the returning wall rises above the horizon
    case 'shoreline_high_angle_return': return {p0: [18, 10, 26], p1: [16, 11, 24], l0: [-40, 22, -300], l1: [-36, 24, -280], fov: 38, focus: [0, 0, -10]};
    // wide from the sea (over the now dry seabed) back toward the beach and the city
    case 'copa_wide_from_sea': return {p0: [70, 24, -235], p1: [52, 22, -218], l0: [0, 16, 40], l1: [-4, 16, 40], fov: 55, focus: [0, 0, 20]};
    // the shore beat is drawn as a 2D diagram in the overlay; the 3D camera just looks straight down
    case 'map_top_down': return {p0: [0, 1400, 1], p1: [0, 1400, 1], l0: [0, 0, 0], l1: [0, 0, 0], fov: 50};
    default: return shotFor(id, f);
  }
}
// hero building for the shock-front profile: the front-row building closest to x = -10
const HERO = BUILDINGS.reduce((a, b) => (Math.abs(b.x + 10) < Math.abs(a.x + 10) ? b : a));
// fog per shot: the world is a few hundred metres wide; haze hides its edges while showing kilometres of seabed
const FOG: Record<string, [number, number]> = {
  avenida_buildings_low: [220, 1900], shoreline_high_angle: [220, 2300], shoreline_high_angle_return: [160, 1700],
  copa_wide_from_sea: [260, 1500], map_top_down: [2000, 4000],
};

// near-lens cull: hides props/people that would fill the frame (umbrellas through the lens), and
// bodies standing between the camera and a close-up subject. Uses the pure camera pose of the frame.
function makeHide(f: number): Hide {
  const c = cameraAt(f, copaShot), [cx, cy, cz] = c.pos, [fx, , fz] = c.focus;
  const low = cy < 7;
  const segLen = Math.hypot(fx - cx, fz - cz), seg = segLen > 0.5 && segLen < 9;
  return (x, z, r = 1.2) => {
    if (!low) return false;
    if (Math.hypot(x - cx, z - cz) < (seg && r <= 1.6 ? r * 1.5 : r)) return true;
    if (seg && r <= 1.6) {
      const u = ((x - cx) * (fx - cx) + (z - cz) * (fz - cz)) / (segLen * segLen);
      if (u > 0 && u < 0.8) { const px = cx + (fx - cx) * u, pz = cz + (fz - cz) * u; if (Math.hypot(x - px, z - pz) < 0.75) return true; }
    }
    return false;
  };
}

const CLOSE_AIR_C: [number, number, number] = [PEOPLE[CLOSE_SUBJECT].x, 2.2, PEOPLE[CLOSE_SUBJECT].z], CLOSE_AIR_S: [number, number, number] = [16, 5, 16];
const closeFollow = (f: number) => { const fo = personFree(CLOSE_SUBJECT, f); return fo ? [fo.dx, fo.dy * 0.6, fo.dz] : [0, 0, 0]; };
const SKY_HEMI = new THREE.Color('#e3f2ff'), GROUND_HEMI = new THREE.Color('#e2c896');
const SKY_HEMI_SPLIT = new THREE.Color('#d2def0'), GROUND_HEMI_SPLIT = new THREE.Color('#a3abb4');

export const CopacabanaWorld: React.FC = () => {
  const f = useCurrentFrame();
  const palms = useMemo(() => { const r = mulberry32(13); return Array.from({length: 26}, (_, i) => ({x: -175 + i * 14 + r() * 4, z: 28.6, h: 6 + r() * 3, lean: (r() - 0.5) * 0.25})); }, []);
  const cam = cameraAt(f, copaShot);
  const hide = useMemo(() => makeHide(f), [f]);
  const bodies = useCallback((fr: number) => freeBodies(fr, makeHide(fr)), []);
  const camPos = useCallback((fr: number) => cameraAt(fr, copaShot).pos, []);
  const hemi = useRef<THREE.HemisphereLight>(null), sun = useRef<THREE.DirectionalLight>(null), fog = useRef<THREE.Fog>(null);
  const shotNow = tl.beats.find((b) => f / FPS >= b.start && f / FPS < b.end)?.shot ?? '';
  const focus = cam.focus;
  useLayoutEffect(() => {
    const g = hasGrade ? gradeAt(f) : 0;
    GRADE_U.uGrade.value = g;
    if (hemi.current) { hemi.current.color.copy(SKY_HEMI).lerp(SKY_HEMI_SPLIT, g); hemi.current.groundColor.copy(GROUND_HEMI).lerp(GROUND_HEMI_SPLIT, g); }
    if (fog.current) { const fg = FOG[shotNow] ?? [110, 560]; fog.current.near = fg[0]; fog.current.far = fg[1]; }
    if (sun.current) { // shadows follow the part of the world the shot is about (origin for the classic shots)
      sun.current.position.set(focus[0] - 14, 34, focus[2] - 26);
      sun.current.target.position.set(focus[0], 0, focus[2]);
      sun.current.target.updateMatrixWorld();
    }
  }, [f, focus, shotNow]);
  return <>
    <CameraRig shots={copaShot} />
    {/* sky dome and sun sit around the camera, so a camera that drifts kilometres still sees the sky */}
    <group position={[cam.pos[0], 0, cam.pos[2]]}><Sky /></group>
    <fog ref={fog} attach="fog" args={['#d3e8f7', 110, 560]} />
    <hemisphereLight ref={hemi} args={['#e3f2ff', '#e2c896', 0.85]} />
    <directionalLight ref={sun} position={[-14, 34, -26]} intensity={2.0} color="#fff1dc" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={140} shadow-bias={-0.0005} />
    <mesh position={[-90 + cam.pos[0], 85 + Math.max(0, cam.pos[1] - 20), -320 + cam.pos[2]]}><sphereGeometry args={[14, 20, 16]} /><meshBasicMaterial color="#fff6d8" fog={false} /></mesh>
    {cam.pos[1] < 100 && <Clouds />}
    {/* open ocean: reaches far east (-x, -z) for shots that drift 2 km out to sea; near edge unchanged (z 150) */}
    {oceanMoves ? <OceanShift><Sea /></OceanShift> : <>
      <mesh position={[-1000, -0.35, -2425]} rotation={[-Math.PI / 2, 0, 0]} material={M('#11789f')} receiveShadow><planeGeometry args={[6000, 5150]} /></mesh>
      <Sea />
    </>}
    <Seabed />
    <CopaSand />
    <Promenade />
    <Avenue hide={hide} />
    <Buildings />
    <Hills />
    <Kiosks />
    <LifeguardPosts />
    <VolleyNets />
    {palms.map((p, i) => <Palm key={i} x={p.x} z={p.z + bay(p.x)} h={p.h} lean={p.lean} mat={ME} />)}
    <ExtraCrowd hide={hide} />
    {PEOPLE.map((_, i) => <PersonMesh key={i} i={i} hide={i === CLOSE_SUBJECT ? undefined : hide} />)}
    <Objects hide={hide} />
    <SandBurst />
    <Frisbee />
    <ShockFronts near={[bldCenter(HERO).x, bldCenter(HERO).z]} />
    <RespinDust />
    <Trails bodies={bodies} max={1000} opacity={0.42} />
    <AirFlow cam={camPos} count={1300} />
    {/* denser air right around the close-up subject (rides with them: same speed, no relative wind) */}
    {CLOSE_BEAT && <AirFlow cam={camPos} count={420} seed={6011} center={CLOSE_AIR_C} size={CLOSE_AIR_S} follow={closeFollow} gain={0.9} />}
  </>;
};
