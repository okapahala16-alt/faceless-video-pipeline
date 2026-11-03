// Phase 3 mini-scenes (reusable): a low-poly Earth with east-flowing air bands and a speed gradient,
// a calm airliner above the clouds, and a dawn sea horizon. When the current beat uses one of their
// shots the coastal world is not rendered at all, only the mini-scene (cheaper and cleaner).
// Globe coordinates: radius R, +y = north pole, lon 0 at +x, lon 90E at -z (matches THREE.SphereGeometry UVs).
import React, {useMemo, useLayoutEffect} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {feature} from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import {tl, FPS, mulberry32, clamp, ease, lerp, beatAt} from '../timeline';
import type {Shot} from '../World';

export const R = 100;
const D2R = Math.PI / 180;
export const globePos = (latDeg: number, lonDeg: number, r = R): [number, number, number] => {
  const p = latDeg * D2R, l = lonDeg * D2R;
  return [r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l)];
};
export const RIO = {lat: -22.97, lon: -43.18};

const GLOBE_SHOTS = new Set(['pullback_to_globe', 'globe_orbit', 'globe_tilt_to_pole']);
const beatOf = (id: string) => tl.beats.find((b) => b.shot === id);
const PULL = beatOf('pullback_to_globe');
export const GLOBE_CUT = PULL ? PULL.start + 0.5 : Infinity; // cut from Rio to the globe (with the impact)

export type MiniMode = 'globe' | 'plane' | 'dawn' | null;
export function miniModeAt(f: number): MiniMode {
  const t = f / FPS, b = beatAt(t);
  if (GLOBE_SHOTS.has(b.shot)) return b.shot === 'pullback_to_globe' && t < GLOBE_CUT ? null : 'globe';
  if (b.shot === 'airliner_above_clouds') return 'plane';
  if (b.shot === 'horizon_dawn') return 'dawn';
  return null;
}

// ---------- cameras ----------
const globeCam = (lat: number, lon: number, dist: number): Shot => {
  const P = globePos(lat, lon, dist);
  const L: number[] = [0, R * 0.1, 0]; // a touch above the centre: globe top clears the HUD, equator stays above the caption
  return {p0: P, p1: P, l0: L, l1: L, fov: 40};
};
export function miniShot(id: string, f: number): Shot | null {
  const t = f / FPS, b = beatAt(t), u = clamp((t - b.start) / Math.max(0.1, b.end - b.start));
  switch (id) {
    case 'pullback_to_globe': {
      if (t < GLOBE_CUT) { // last half second over Rio: a fast climb straight up
        const k = ease(clamp((t - b.start) / 0.5));
        const P = [lerp(110, 160, k), lerp(60, 900, k), lerp(-20, -80, k)], L = [lerp(-80, -20, k), 0, lerp(0, -20, k)];
        return {p0: P, p1: P, l0: L, l1: L, fov: 50};
      }
      const k = 1 - Math.pow(1 - clamp((t - GLOBE_CUT) / 1.3), 3); // fast pull back, eases out
      const dist = lerp(R * 1.06, R * 6.2, k) + (t - GLOBE_CUT) * 2;
      return globeCam(lerp(RIO.lat, -14, k), RIO.lon + 4 * k, dist);
    }
    case 'globe_orbit': return globeCam(lerp(-14, -4, u), RIO.lon + 4 + 26 * u, R * 6.3 + 6 * u);
    case 'globe_tilt_to_pole': return globeCam(lerp(-4, 48, ease(u)), RIO.lon + 30 + 8 * u, R * 6.1);
    case 'airliner_above_clouds': return {p0: [40, -7, 108], p1: [31, -6, 101], l0: [3, -5, 0], l1: [4, -5, 0], fov: 36}; // a little below the jet: blue sky behind it, cloud deck at the bottom
    case 'horizon_dawn': return {p0: [0, 2.6, 0], p1: [0, 2.6, 0], l0: [-12, 5.5, -100], l1: [-12, 6.2, -100], fov: 44};
    default: return null;
  }
}

// ---------- globe ----------
function landTexture(): THREE.Texture {
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0f3d60'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; // graticule every 30 deg
  for (let lon = -180; lon <= 180; lon += 30) { const x = ((lon + 180) / 360) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(land110 as any, (land110 as any).objects.land) as any;
  const polys: number[][][][] = [];
  for (const ft of fc.features ?? [fc]) {
    const geo = ft.geometry; if (!geo) continue;
    if (geo.type === 'Polygon') polys.push(geo.coordinates); else if (geo.type === 'MultiPolygon') polys.push(...geo.coordinates);
  }
  g.fillStyle = '#5B6672';
  for (const poly of polys) for (const off of [-360, 0, 360]) {
    g.beginPath();
    for (const ring of poly) {
      let prev = ring[0][0], acc = 0;
      ring.forEach(([lon, lat], i) => { // unwrap the antimeridian so no polygon draws a stripe across the map
        if (i > 0) { const dl = lon - prev; if (dl > 180) acc -= 360; else if (dl < -180) acc += 360; }
        prev = lon;
        const x = ((lon + acc + off + 180) / 360) * W, y = ((90 - lat) / 180) * H;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.closePath();
    }
    g.fill('evenodd');
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

const windOn = (t: number) => t >= GLOBE_CUT;
const gradBeat = beatOf('globe_tilt_to_pole');
export const Globe: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const tex = useMemo(() => landTexture(), []);
  const globeMat = useMemo(() => new THREE.MeshStandardMaterial({map: tex, roughness: 0.9, flatShading: true}), [tex]);
  const atmo = useMemo(() => new THREE.MeshBasicMaterial({color: '#8fd3ff', transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false}), []);
  const stars = useMemo(() => {
    const r = mulberry32(901), n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); pos.set([s * Math.cos(a) * 3000, u * 3000, s * Math.sin(a) * 3000], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({color: '#ffffff', size: 2, sizeAttenuation: false, fog: false}));
  }, []);
  // speed gradient shell: amber at the equator fading to nothing at the poles (cos latitude)
  const gradMat = useMemo(() => new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}), []);
  const gradGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(R * 1.012, 96, 64), p = g.attributes.position.array as Float32Array, c = new Float32Array(p.length);
    const amber = new THREE.Color(tl.accentColor ?? '#F2A33A');
    for (let i = 0; i < p.length; i += 3) { const k = Math.pow(Math.sqrt(p[i] ** 2 + p[i + 2] ** 2) / (R * 1.012), 6); c[i] = amber.r * k; c[i + 1] = amber.g * k; c[i + 2] = amber.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  }, []);
  // air bands: streaks flowing east; density and length follow cos(latitude) like the ground speed did
  const N = 2600;
  const seeds = useMemo(() => { const r = mulberry32(902); return Array.from({length: N}, () => ({lat: Math.asin(2 * r() - 1) / D2R, lon: r() * 360 - 180, h: 1.02 + r() * 0.05, ph: r(), sp: 0.8 + r() * 0.4})); }, []);
  const streaks = useMemo(() => new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.35),
    new THREE.MeshBasicMaterial({color: tl.accentColor ?? '#F2A33A', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending}), N), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), v = new THREE.Vector3(), ex = new THREE.Vector3(), ny = new THREE.Vector3(), ez = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    const on = windOn(t), age = t - GLOBE_CUT, grow = clamp(age / 0.6);
    seeds.forEach((s, i) => {
      if (!on) { m.compose(v.set(0, 0, 0), q, sc.set(0, 0, 0)); streaks.setMatrixAt(i, m); return; }
      const lon = s.lon + age * 22 * s.sp, c = Math.cos(s.lat * D2R); // angular speed is the same at every latitude
      const [x, y, z] = globePos(s.lat, lon, R * s.h); v.set(x, y, z);
      ny.set(x, y, z).normalize();
      ex.set(-Math.sin(lon * D2R), 0, -Math.cos(lon * D2R)); // east tangent
      ez.crossVectors(ex, ny);
      m.makeBasis(ex, ny, ez); q.setFromRotationMatrix(m);
      const len = R * 0.09 * c * (0.6 + 0.4 * Math.sin(Math.PI * ((age * 0.7 + s.ph) % 1)));
      sc.set(Math.max(0.01, len) * grow, c * grow, c * grow);
      m.compose(v, q, sc); streaks.setMatrixAt(i, m);
    });
    streaks.instanceMatrix.needsUpdate = true; streaks.frustumCulled = false;
    if (gradBeat) gradMat.opacity = 0.28 * clamp((t - gradBeat.start) / 0.8);
    (streaks.material as THREE.MeshBasicMaterial).opacity = gradBeat && t >= gradBeat.start ? 0.45 : 0.8;
  }, [f, t, seeds, streaks, gradMat]);
  return <>
    <color attach="background" args={['#02040a']} />
    <primitive object={stars} />
    <ambientLight intensity={0.35} />
    <directionalLight position={[300, 160, 220]} intensity={2.2} color="#fff4e0" />
    <mesh material={globeMat}><sphereGeometry args={[R, 96, 64]} /></mesh>
    <mesh geometry={gradGeo} material={gradMat} />
    <mesh material={atmo}><sphereGeometry args={[R * 1.08, 64, 48]} /></mesh>
    <primitive object={streaks} />
    {/* Rio marker */}
    <mesh position={globePos(RIO.lat, RIO.lon, R * 1.005)}><sphereGeometry args={[1.2, 12, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
  </>;
};

// ---------- airliner above the clouds ----------
const skyMat = (top: string, mid: string, bot: string) => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {top: {value: new THREE.Color(top)}, mid: {value: new THREE.Color(mid)}, bot: {value: new THREE.Color(bot)}},
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.02? mix(mid, top, smoothstep(0.02,0.6,h)) : mix(bot, mid, smoothstep(-0.25,0.02,h)); gl_FragColor=vec4(c,1.0);}',
});
const white = new THREE.MeshStandardMaterial({color: '#f3f5f7', roughness: 0.5, flatShading: true});
const grey = new THREE.MeshStandardMaterial({color: '#aab3bd', roughness: 0.6, flatShading: true});
const dark = new THREE.MeshStandardMaterial({color: '#2c3540', roughness: 0.4});
const Airliner: React.FC = () => <group rotation={[0, 0, 0]}>
  {/* fuselage along -x (nose) */}
  <mesh material={white} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[1.9, 30, 6, 16]} /></mesh>
  <mesh material={dark} position={[-7, 0.75, 1.85]}><boxGeometry args={[20, 0.32, 0.05]} /></mesh>
  <mesh material={dark} position={[-16.6, 0.65, 0]} rotation={[0, 0, 0.4]}><boxGeometry args={[1.2, 0.5, 2.6]} /></mesh>
  {/* wings (swept), engines, tail */}
  {[1, -1].map((s) => <group key={s}>
    <mesh material={grey} position={[1.5, -0.6, s * 9]} rotation={[0, s * 0.42, 0]}><boxGeometry args={[6, 0.35, 16]} /></mesh>
    <mesh material={white} position={[-1.5, -1.9, s * 6.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[1.1, 1.1, 4.2, 16]} /></mesh>
    <mesh material={grey} position={[14.5, 0.6, s * 3.5]} rotation={[0, s * 0.5, 0]}><boxGeometry args={[3, 0.25, 6]} /></mesh>
  </group>)}
  <mesh material={white} position={[14.8, 4.2, 0]} rotation={[0, 0, -0.55]}><boxGeometry args={[5.5, 6.5, 0.35]} /></mesh>
</group>;
export const PlaneScene: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const sky = useMemo(() => skyMat('#1d5fb8', '#8cc6f2', '#e9f4ff'), []);
  const puffs = useMemo(() => { const r = mulberry32(951); return Array.from({length: 260}, () => ({x: -900 + r() * 1800, z: -500 + r() * 900, y: -42 - r() * 10, s: 20 + r() * 40})); }, []);
  const deck = useMemo(() => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, flatShading: true}), puffs.length), [puffs.length]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    puffs.forEach((p, i) => { // the plane flies toward -x, so the cloud deck streams toward +x
      const x = ((p.x + t * 70 + 900) % 1800 + 1800) % 1800 - 900;
      m.compose(v.set(x, p.y, p.z), q, sc.set(p.s * 1.6, p.s * 0.35, p.s)); deck.setMatrixAt(i, m);
    });
    deck.instanceMatrix.needsUpdate = true; deck.frustumCulled = false;
  }, [f, t, puffs, deck]);
  const bob = Math.sin(t * 0.9) * 0.25;
  return <>
    <mesh material={sky}><sphereGeometry args={[1500, 32, 16]} /></mesh>
    <fog attach="fog" args={['#cfe6fb', 300, 1400]} />
    <hemisphereLight args={['#e8f4ff', '#ffffff', 0.9]} />
    <directionalLight position={[-120, 160, 120]} intensity={2.0} color="#fff6e6" />
    <mesh position={[-400, 260, -700]}><sphereGeometry args={[18, 16, 12]} /><meshBasicMaterial color="#fffbe8" fog={false} /></mesh>
    <group position={[0, bob, 0]} rotation={[0.02 * Math.sin(t * 0.6), 0, 0.015]}><Airliner /></group>
    <primitive object={deck} />
  </>;
};

// ---------- dawn horizon over the sea (south-east, -z) ----------
const dawnBeat = beatOf('horizon_dawn');
export const DawnScene: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const sky = useMemo(() => skyMat('#1c3156', '#d99a86', '#ffd6a0'), []);
  const sea = useMemo(() => { const g = new THREE.PlaneGeometry(4000, 3000, 160, 120); g.rotateX(-Math.PI / 2); g.translate(0, 0, -1500); return g; }, []);
  const base = useMemo(() => Float32Array.from(sea.attributes.position.array as Float32Array), [sea]);
  const seaMat = useMemo(() => new THREE.MeshStandardMaterial({color: '#35577a', roughness: 0.3, metalness: 0.15, flatShading: true}), []);
  useLayoutEffect(() => {
    const p = sea.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) { const x = base[i], z = base[i + 2]; p[i + 1] = 0.25 * Math.sin(0.08 * z + t * 0.9 + 0.03 * x) + 0.12 * Math.sin(0.21 * x - t * 0.7); }
    sea.attributes.position.needsUpdate = true; sea.computeVertexNormals();
  }, [f, t, sea, base]);
  const u = dawnBeat ? clamp((t - dawnBeat.start) / (dawnBeat.end - dawnBeat.start)) : 0;
  const sunY = lerp(-14, 34, u), sun: [number, number, number] = [-120, sunY, -900];
  return <>
    <mesh material={sky}><sphereGeometry args={[1500, 32, 16]} /></mesh>
    <fog attach="fog" args={['#efc0a0', 200, 1300]} />
    <hemisphereLight args={['#ffb48a', '#20304a', 0.55]} />
    <directionalLight position={[sun[0], Math.max(4, sun[1]), sun[2]]} intensity={1.4} color="#ffb070" />
    <mesh position={sun}><sphereGeometry args={[42, 32, 24]} /><meshBasicMaterial color="#ffd08a" fog={false} /></mesh>
    {/* glitter path on the water toward the camera */}
    <mesh position={[-60, 0.35, -450]} rotation={[-Math.PI / 2, 0, Math.atan2(-120, -900) * 0]} >
      <planeGeometry args={[26, 900]} /><meshBasicMaterial color="#ffb36b" transparent opacity={0.35 * clamp(u * 3)} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
    <mesh geometry={sea} material={seaMat} />
  </>;
};

export const MiniScene: React.FC<{mode: MiniMode}> = ({mode}) =>
  mode === 'globe' ? <Globe /> : mode === 'plane' ? <PlaneScene /> : mode === 'dawn' ? <DawnScene /> : null;
