// Copacabana, Rio de Janeiro: a stylised, original low-poly take on the place.
// Coordinates match the Kuta scene where the crowd lives (shoreline z = 0, sand toward +z),
// so the shared physics (src/sim.ts), sea, people and props work unchanged.
// Layout toward +z: sand -> wave-pattern promenade -> Avenida (road) -> sidewalk -> high-rise row -> hills.
// The bay curves seaward at both ends; Sugarloaf-like dome rises at the far left (-x).
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {FPS, mulberry32, clamp} from '../timeline';
import {PEOPLE} from '../sim';
import {CameraRig, Sky, Clouds, Sea, Palm, PersonMesh, Objects, SandBurst, Frisbee, M, shotFor, Shot} from '../World';

// ---------- layout ----------
const PROM_Z0 = 30, PROM_Z1 = 37;      // promenade (wave pavement)
const ROAD_Z0 = 37, ROAD_Z1 = 51;      // avenue
const WALK_Z1 = 55;                    // building-side sidewalk
const BLD_Z = 56;                      // building front line
const ground = (zl: number) => zl * 0.02; // same slope as the Kuta sand
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
  const m = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true}), []);
  return <mesh geometry={g} material={m} receiveShadow />;
};

const Promenade: React.FC = () => {
  const g = useMemo(() => {
    const g = curvedStrip(PROM_Z0, PROM_Z1, 200, 4, -190, 190, 0.12);
    const uv = g.attributes.uv.array as Float32Array;
    for (let i = 0; i < uv.length; i += 2) { uv[i] *= 380 / 9; uv[i + 1] *= 1; } // one tile ~9 m along the beach
    return g;
  }, []);
  const m = useMemo(() => new THREE.MeshStandardMaterial({map: wavePavementTexture(), roughness: 0.9}), []);
  const curb = useMemo(() => curvedStrip(PROM_Z0 - 0.4, PROM_Z0, 200, 1, -190, 190, 0.14), []);
  return <group>
    <mesh geometry={g} material={m} receiveShadow />
    <mesh geometry={curb} material={M('#d9d4c7')} receiveShadow />
  </group>;
};

const Avenue: React.FC = () => {
  const f = useCurrentFrame();
  const road = useMemo(() => curvedStrip(ROAD_Z0, ROAD_Z1, 200, 4, -190, 190, 0.1), []);
  const median = useMemo(() => curvedStrip(43.2, 44.8, 200, 1, -190, 190, 0.16), []);
  const walk = useMemo(() => curvedStrip(ROAD_Z1, WALK_Z1, 200, 2, -190, 190, 0.14), []);
  const dashes = useMemo(() => {
    const out: {x: number; z: number}[] = [];
    for (let x = -186; x <= 186; x += 6) for (const z of [40, 48]) out.push({x, z});
    return out;
  }, []);
  const cars = useMemo(() => {
    const r = mulberry32(31); const cols = ['#e63946', '#f1faee', '#1d3557', '#ffb703', '#2a9d8f', '#adb5bd', '#111111', '#ffffff'];
    return Array.from({length: 26}, (_, i) => ({lane: i % 2 ? 41.2 : 46.8, dir: i % 2 ? 1 : -1, x0: -180 + r() * 360, speed: 6 + r() * 5,
      c: cols[Math.floor(r() * cols.length)], taxi: r() < 0.25}));
  }, []);
  const t = f / FPS;
  return <group>
    <mesh geometry={road} material={M('#3b3f45')} receiveShadow />
    <mesh geometry={median} material={M('#c9c2b3')} receiveShadow />
    <mesh geometry={walk} material={M('#d6d0c2')} receiveShadow />
    {dashes.map((d, i) => <mesh key={i} position={[d.x, ground(d.z) + 0.115, d.z + bay(d.x)]} material={M('#e9e9e9')}><boxGeometry args={[2.4, 0.01, 0.15]} /></mesh>)}
    {cars.map((c, i) => {
      let x = c.x0 + c.dir * c.speed * t; x = ((x + 190) % 380 + 380) % 380 - 190;
      const z = c.lane + bay(x), y = ground(c.lane) + 0.1;
      const slope = Math.atan(-0.005 * Math.sign(x) * Math.max(0, Math.abs(x) - 45));
      return <group key={i} position={[x, y, z]} rotation={[0, slope, 0]}>
        <mesh position={[0, 0.55, 0]} material={M(c.taxi ? '#ffd23f' : c.c)} castShadow><boxGeometry args={[4.2, 0.8, 1.8]} /></mesh>
        <mesh position={[-0.2, 1.15, 0]} material={M('#22303c')} castShadow><boxGeometry args={[2.2, 0.55, 1.6]} /></mesh>
      </group>;
    })}
  </group>;
};

const Buildings: React.FC = () => {
  const tex = useMemo(() => facadeTexture(), []);
  const list = useMemo(() => {
    const r = mulberry32(53); const out: {x: number; w: number; d: number; h: number; c: string; floors: number}[] = [];
    const cols = ['#f7f3ea', '#efe6d2', '#e9ddd0', '#f4efe2', '#dfe7ea', '#f1e1cf', '#e8eef0', '#f6ead8', '#dcd6cc'];
    let x = -160;
    while (x < 160) {
      const w = 9 + r() * 9, floors = 9 + Math.floor(r() * 6);
      out.push({x: x + w / 2, w, d: 14 + r() * 6, h: floors * 3.1, c: cols[Math.floor(r() * cols.length)], floors});
      x += w + 0.6 + r() * 1.2;
    }
    return out;
  }, []);
  const mats = useMemo(() => list.map((b) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(Math.round(b.w / 2.6), b.floors);
    return new THREE.MeshStandardMaterial({map: t, color: b.c, roughness: 0.8});
  }), [list, tex]);
  return <group>{list.map((b, i) => {
    const zl = BLD_Z + b.d / 2, z = zl + bay(b.x), y = ground(BLD_Z) + 0.14;
    const slope = Math.atan(-0.005 * Math.sign(b.x) * Math.max(0, Math.abs(b.x) - 45));
    return <group key={i} position={[b.x, y, z]} rotation={[0, slope, 0]}>
      <mesh position={[0, b.h / 2, 0]} material={mats[i]} castShadow receiveShadow><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
      <mesh position={[0, b.h + 0.4, 0]} material={M('#cfc8bb')}><boxGeometry args={[b.w * 0.96, 0.8, b.d * 0.96]} /></mesh>
      <mesh position={[0, 1.6, -b.d / 2 - 0.05]} material={M('#2c3540')}><boxGeometry args={[b.w * 0.9, 3.0, 0.1]} /></mesh>
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
    <mesh geometry={rock} material={M('#8d8a83')} castShadow />
    <mesh geometry={skirt} material={M('#3f7d3a')} />
  </group>;
};

const Hills: React.FC = () => {
  const hills = useMemo(() => {
    const r = mulberry32(71);
    return Array.from({length: 11}, (_, i) => ({x: -230 + i * 46 + r() * 20, z: 140 + r() * 70, h: 45 + r() * 70, w: 50 + r() * 40}));
  }, []);
  return <group>
    {hills.map((h, i) => <mesh key={i} position={[h.x, h.h / 2 - 2, h.z]} scale={[h.w, h.h, h.w * 0.8]} material={M(i % 2 ? '#3d7a3f' : '#4a8a47')}>
      <icosahedronGeometry args={[0.62, 1]} /></mesh>)}
    {/* headland at the left end of the bay, and the domes beyond it */}
    <mesh position={[-180, 8, -20]} scale={[52, 40, 70]} material={M('#3f7d3a')}><icosahedronGeometry args={[0.6, 1]} /></mesh>
    <mesh position={[180, 6, -20]} scale={[44, 30, 60]} material={M('#467f3f')}><icosahedronGeometry args={[0.6, 1]} /></mesh>
    <Dome x={-250} z={-70} h={118} r={30} lean={0.08} />
    <Dome x={-212} z={-58} h={64} r={26} />
  </group>;
};

const Kiosks: React.FC = () => {
  const items = useMemo(() => Array.from({length: 15}, (_, i) => -168 + i * 24), []);
  return <group>{items.map((x, i) => {
    const zl = 33.5, z = zl + bay(x), y = ground(zl) + 0.12;
    return <group key={i} position={[x, y, z]}>
      <mesh position={[0, 1.3, 0]} material={M('#f2efe6')} castShadow><cylinderGeometry args={[1.5, 1.5, 2.6, 8]} /></mesh>
      <mesh position={[0, 2.9, 0]} material={M(i % 2 ? '#1f8a70' : '#e76f51')} castShadow><coneGeometry args={[2.6, 0.9, 8]} /></mesh>
      {[-1, 1].map((s) => <group key={s} position={[s * 3.4, 0, -0.6]}>
        <mesh position={[0, 1.15, 0]} material={M('#dddddd')}><cylinderGeometry args={[0.04, 0.04, 2.3, 6]} /></mesh>
        <mesh position={[0, 2.25, 0]} material={M('#f4f1de')} castShadow><coneGeometry args={[1.3, 0.45, 8, 1, true]} /></mesh>
        <mesh position={[0, 0.72, 0]} material={M('#f4f1de')}><cylinderGeometry args={[0.55, 0.55, 0.06, 12]} /></mesh>
      </group>)}
    </group>;
  })}</group>;
};

const LifeguardPosts: React.FC = () => {
  const xs = [-150, -75, 40, 115];
  return <group>{xs.map((x, i) => {
    const zl = 24, z = zl + bay(x), y = ground(zl);
    return <group key={i} position={[x, y, z]}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <mesh key={k} position={[a * 1.1, 1.6, b * 1.1]} material={M('#e9e4d8')}><boxGeometry args={[0.16, 3.2, 0.16]} /></mesh>)}
      <mesh position={[0, 3.9, 0]} material={M('#ffffff')} castShadow><boxGeometry args={[3.0, 1.6, 3.0]} /></mesh>
      <mesh position={[0, 3.9, -1.52]} material={M('#e63946')}><boxGeometry args={[3.0, 0.45, 0.04]} /></mesh>
      <mesh position={[0, 4.9, 0]} material={M('#2b2d42')}><boxGeometry args={[3.3, 0.2, 3.3]} /></mesh>
    </group>;
  })}</group>;
};

const VolleyNets: React.FC = () => {
  const nets = [-60, -38, 32, 54, 78];
  const netMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#1b1b1b', transparent: true, opacity: 0.55, roughness: 1}), []);
  return <group>{nets.map((x, i) => {
    const zl = 22, z = zl + bay(x), y = ground(zl);
    return <group key={i} position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      {[-4.6, 4.6].map((s) => <mesh key={s} position={[s, 1.25, 0]} material={M('#f1f1f1')} castShadow><cylinderGeometry args={[0.06, 0.06, 2.5, 6]} /></mesh>)}
      <mesh position={[0, 2.05, 0]} material={netMat}><boxGeometry args={[9.2, 0.9, 0.02]} /></mesh>
      <mesh position={[0, 2.52, 0]} material={M('#ffffff')}><boxGeometry args={[9.2, 0.07, 0.04]} /></mesh>
    </group>;
  })}</group>;
};


// Static background crowd along the whole bay (instanced, no physics). The 190 physics people
// live in x -26..26, z 2.5..18.5; extras fill the rest of the sand so the beach reads as packed.
const ExtraCrowd: React.FC = () => {
  const data = useMemo(() => {
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
    return {ppl, umb};
  }, []);
  const meshes = useMemo(() => {
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.26, 0.55, 3, 8), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true}), data.ppl.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true}), data.ppl.length);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), new THREE.MeshStandardMaterial({color: '#eeeeee'}), data.umb.length);
    const can = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({roughness: 0.85, flatShading: true, side: THREE.DoubleSide}), data.umb.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    data.ppl.forEach((p, i) => {
      const y = ground(p.zl), z = p.zl + bay(p.x);
      e.set(p.lie ? Math.PI / 2 : 0, p.rot, 0); q.setFromEuler(e); sc.set(p.s, p.s, p.s);
      v.set(p.x, y + (p.lie ? 0.3 : 0.78 * p.s), z); m.compose(v, q, sc); body.setMatrixAt(i, m); body.setColorAt(i, col.set(p.shirt));
      if (p.lie) v.set(p.x + Math.sin(p.rot) * 0.6, y + 0.3, z + Math.cos(p.rot) * 0.6); else v.set(p.x, y + 1.38 * p.s, z);
      m.compose(v, q, sc); head.setMatrixAt(i, m); head.setColorAt(i, col.set(p.skin));
    });
    data.umb.forEach((u, i) => {
      const y = ground(u.zl), z = u.zl + bay(u.x);
      q.identity(); sc.set(1, 1, 1);
      v.set(u.x, y + 1.4, z); m.compose(v, q, sc); pole.setMatrixAt(i, m);
      v.set(u.x, y + 2.55, z); m.compose(v, q, sc); can.setMatrixAt(i, m); can.setColorAt(i, col.set(u.c));
    });
    for (const im of [body, head, pole, can]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; }
    return [body, head, pole, can];
  }, [data]);
  return <group>{meshes.map((im, i) => <primitive key={i} object={im} />)}</group>;
};

// ---------- camera shots for this scene (Kuta shot names still work as a fallback) ----------
export function copaShot(id: string, f: number): Shot {
  switch (id) {
    case 'bay_aerial': return {p0: [125, 45, -12], p1: [110, 41, -14], l0: [-180, 22, 10], l1: [-185, 24, 8]};
    case 'promenade_low': return {p0: [16, 1.9, 31.0], p1: [8, 1.9, 31.0], l0: [-70, 3, 22], l1: [-80, 4, 20]};
    case 'skyline_from_sea': return {p0: [-10, 3.2, -16], p1: [8, 3.6, -14], l0: [0, 10, 40], l1: [0, 11, 40]};
    case 'sugarloaf': return {p0: [6, 2.2, 14], p1: [0, 2.6, 13], l0: [-230, 45, -60], l1: [-235, 48, -62]};
    case 'avenue': return {p0: [-30, 9, 46], p1: [-18, 8, 46], l0: [10, 2, 30], l1: [20, 2, 24]};
    case 'crowd_sand': return {p0: [1, 3.0, 22], p1: [1, 2.2, 16], l0: [0, 1.3, 5], l1: [0, 1.3, 7]};
    default: return shotFor(id, f);
  }
}

export const CopacabanaWorld: React.FC = () => {
  const palms = useMemo(() => { const r = mulberry32(13); return Array.from({length: 26}, (_, i) => ({x: -175 + i * 14 + r() * 4, z: 28.6, h: 6 + r() * 3, lean: (r() - 0.5) * 0.25})); }, []);
  return <>
    <CameraRig shots={copaShot} />
    <Sky />
    <fog attach="fog" args={['#d3e8f7', 110, 560]} />
    <hemisphereLight args={['#e3f2ff', '#e2c896', 0.85]} />
    <directionalLight position={[-14, 34, -26]} intensity={2.0} color="#fff1dc" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={140} shadow-bias={-0.0005} />
    <mesh position={[-90, 85, -320]}><sphereGeometry args={[14, 20, 16]} /><meshBasicMaterial color="#fff6d8" fog={false} /></mesh>
    <Clouds />
    <mesh position={[0, -0.35, -200]} rotation={[-Math.PI / 2, 0, 0]} material={M('#11789f')} receiveShadow><planeGeometry args={[1400, 700]} /></mesh>
    <Sea />
    <CopaSand />
    <Promenade />
    <Avenue />
    <Buildings />
    <Hills />
    <Kiosks />
    <LifeguardPosts />
    <VolleyNets />
    {palms.map((p, i) => <Palm key={i} x={p.x} z={p.z + bay(p.x)} h={p.h} lean={p.lean} />)}
    <ExtraCrowd />
    {PEOPLE.map((_, i) => <PersonMesh key={i} i={i} />)}
    <Objects />
    <SandBurst />
    <Frisbee />
  </>;
};
