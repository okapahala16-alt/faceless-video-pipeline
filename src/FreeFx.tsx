// Effects for "free" bodies while the Earth is stopped (reusable in any scene):
//  - Trails: amber motion streaks pointing west (opposite EAST), length ~ speed, fading to the tail.
//  - AirFlow: visible air, thin amber lines drifting east with the crowd (no relative wind).
// Both are single InstancedMeshes updated per frame from useCurrentFrame(); nothing animates on its own.
import React, {useLayoutEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {FPS, clamp, mulberry32} from './timeline';
import {EAST, DRIFT, TE, driftAt} from './sim';
import {PALETTE, gradeAt} from './grade';

export type TrailBody = {x: number; y: number; z: number; h: number; w: number; speed: number};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// fades a transparent MeshBasicMaterial out close to the lens (view depth near.x -> near.y metres),
// so streaks that pass the camera never become screen-filling shards
function nearFade(m: THREE.MeshBasicMaterial, near: [number, number]) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNear = {value: new THREE.Vector2(near[0], near[1])};
    sh.vertexShader = 'varying float vFadeZ;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vFadeZ = -mvPosition.z;');
    sh.fragmentShader = 'varying float vFadeZ;\nuniform vec2 uNear;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= smoothstep(uNear.x, uNear.y, vFadeZ);');
  };
  m.customProgramCacheKey = () => `near-fade-${near[0]}-${near[1]}`;
  return m;
}

// thin streak along +x from 0 (at the body) to 1 (tail), RGBA vertex colours, alpha fades to the tail
function streakGeometry(color: string) {
  const g = new THREE.BoxGeometry(1, 1, 1, 16, 1, 1);
  g.translate(0.5, 0, 0);
  const p = g.attributes.position.array as Float32Array, c = new THREE.Color(color);
  const col = new Float32Array((p.length / 3) * 4);
  for (let i = 0, j = 0; i < p.length; i += 3, j += 4) {
    const u = clamp(p[i]);
    col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; col[j + 3] = Math.pow(1 - u, 1.6) * clamp(u / 0.05);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}

// each body leaves three streaks (upper, middle, lower edge of its silhouette)
const STREAKS: [number, number, number][] = [[0.36, -0.22, 1.0], [0.02, 0.3, 0.82], [-0.3, -0.04, 0.68]]; // [dy*h, side*w, length]
const MAX_TRAIL = 6; // m at full drift speed
export const Trails: React.FC<{bodies: (f: number) => TrailBody[]; max: number; opacity?: number}> = ({bodies, max, opacity = 0.5}) => {
  const f = useCurrentFrame();
  const cap = max * STREAKS.length;
  const mesh = useMemo(() => {
    const mat = nearFade(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false, opacity}), [1.2, 4.0]);
    const im = new THREE.InstancedMesh(streakGeometry(PALETTE.freeGlow), mat, cap);
    im.frustumCulled = false; im.renderOrder = 2;
    return im;
  }, [cap, opacity]);
  useLayoutEffect(() => {
    const g = gradeAt(f);
    const list = g > 0.001 ? bodies(f) : [];
    _q.setFromAxisAngle(_y, Math.atan2(EAST.z, -EAST.x)); // rotates +x onto west
    const sx = EAST.z, sz = -EAST.x; // horizontal, perpendicular to the motion
    let n = 0;
    for (let bi = 0; bi < list.length && n < cap; bi++) {
      const b = list[bi];
      const len = MAX_TRAIL * clamp(b.speed / DRIFT.v, 0, 1.15);
      if (len < 0.15) continue;
      const th = clamp(0.035 + 0.025 * b.h, 0.04, 0.08) * clamp(len / 1.5, 0.4, 1);
      for (const [dy, side, l] of STREAKS) {
        if (n >= cap) break;
        const wob = 0.9 + 0.1 * Math.sin(f * 0.23 + bi * 1.7 + l * 5);
        _v.set(b.x + sx * side * b.w, b.y + dy * b.h, b.z + sz * side * b.w); _s.set(len * l * wob, th, th);
        _m.compose(_v, _q, _s); mesh.setMatrixAt(n++, _m);
      }
    }
    for (let i = n; i < cap; i++) mesh.setMatrixAt(i, ZERO);
    mesh.visible = n > 0;
    (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * g;
    mesh.instanceMatrix.needsUpdate = true;
  }, [f, mesh, bodies, cap, opacity]);
  return <primitive object={mesh} />;
};

// thin line along x, fading at both ends
function airGeometry(color: string) {
  const g = new THREE.BoxGeometry(1, 1, 1, 10, 1, 1);
  const p = g.attributes.position.array as Float32Array, c = new THREE.Color(color);
  const col = new Float32Array((p.length / 3) * 4);
  for (let i = 0, j = 0; i < p.length; i += 3, j += 4) {
    const u = p[i] + 0.5;
    col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; col[j + 3] = Math.pow(Math.sin(Math.PI * u), 1.5);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}

// Visible air: `count` lines in a box around `center`, moving east exactly with the crowd (driftAt),
// plus a slow local wobble. Shown from earthStop; brightest in the beat that claims visibleAirCoMoving.
const AIR_CENTER: [number, number, number] = [0, 2.6, 10], AIR_SIZE: [number, number, number] = [70, 5.2, 30];
export const AirFlow: React.FC<{count?: number; center?: [number, number, number]; size?: [number, number, number];
  cam?: (f: number) => [number, number, number]; follow?: (f: number) => number[]; gain?: number; seed?: number}> =
  ({count = 900, center = AIR_CENTER, size = AIR_SIZE, cam, follow, gain = 1, seed = 6007}) => {
  const f = useCurrentFrame();
  const pts = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({length: count}, () => ({x: center[0] + (r() - 0.5) * size[0], y: center[1] + (r() - 0.5) * size[1], z: center[2] + (r() - 0.5) * size[2],
      len: 0.35 + r() * 1.1, th: 0.008 + r() * 0.012, ph: r() * Math.PI * 2, w: 0.2 + r() * 0.5}));
  }, [count, center, size, seed]);
  const mesh = useMemo(() => {
    const mat = nearFade(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false, opacity: 0}), [0.6, 2.2]);
    const im = new THREE.InstancedMesh(airGeometry(PALETTE.freeGlow), mat, count);
    im.frustumCulled = false; im.renderOrder = 3;
    return im;
  }, [count]);
  useLayoutEffect(() => {
    const t = f / FPS;
    const on = clamp((t - TE.earthStop) / 1.2) * (t < TE.respin ? 1 : clamp(1 - (t - TE.respin) / 0.4));
    const ab = TE.airBeat;
    const boost = ab ? Math.min(clamp((t - ab.start) / 0.8), clamp((ab.end + 0.6 - t) / 0.8)) : 0;
    const o = on * (0.26 + 0.62 * boost) * gain;
    mesh.visible = o > 0.003;
    (mesh.material as THREE.MeshBasicMaterial).opacity = o;
    if (!mesh.visible) return;
    const d = driftAt(t), c = cam ? cam(f) : null;
    // default: the volume rides with the crowd (EAST * drift); `follow` gives an explicit offset instead
    const fo = follow ? follow(f) : [EAST.x * d, 0, EAST.z * d];
    _q.setFromAxisAngle(_y, Math.atan2(-EAST.z, EAST.x)); // +x onto east
    pts.forEach((p, i) => {
      const x = p.x + fo[0] + 0.18 * Math.sin(t * p.w + p.ph), y = p.y + fo[1] + 0.12 * Math.sin(t * p.w * 0.8 + p.ph * 2), z = p.z + fo[2] + 0.18 * Math.cos(t * p.w * 0.9 + p.ph);
      if (c && Math.hypot(x - c[0], y - c[1], z - c[2]) < 0.9) { mesh.setMatrixAt(i, ZERO); return; }
      _v.set(x, y, z); _s.set(p.len, p.th, p.th);
      _m.compose(_v, _q, _s); mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [f, mesh, pts, cam, follow, gain]);
  return <primitive object={mesh} />;
};
