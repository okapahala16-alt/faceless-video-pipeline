// Colour grades driven by beat.grade ("normal" | "split"). Reusable across scenes.
// "split": everything anchored to the Earth (ground, buildings, hills, street furniture) turns cold
// slate; free things (people, props, water, air, cars) keep their colour. Implemented as a shader
// hook on the anchored materials only, so scenes that never use these materials (Kuta) are untouched.
import * as THREE from 'three';
import {tl, FPS, clamp, lerp, GradeName} from './timeline';

export const PALETTE = {
  anchoredGrade: '#5B6672',
  freeGlow: tl.accentColor ?? '#F2A33A',
};

const gradeVal = (g?: GradeName | null) => (g === 'split' ? 1 : 0);
// per-frame amount of the split grade, 0..1. Changes between beats cross over 2 frames.
const GRADE_FRAMES = new Float32Array(Math.ceil(tl.duration * FPS) + 2);
{
  for (let f = 0; f < GRADE_FRAMES.length; f++) {
    const t = f / FPS;
    let bi = tl.beats.findIndex((b) => t >= b.start && t < b.end);
    if (bi < 0) bi = t < tl.beats[0].start ? 0 : tl.beats.length - 1;
    const b = tl.beats[bi], cur = gradeVal(b.grade), prev = bi > 0 ? gradeVal(tl.beats[bi - 1].grade) : cur;
    const k = clamp((f - Math.round(b.start * FPS) + 1) / 2); // first frame of the beat = halfway, next = done
    GRADE_FRAMES[f] = lerp(prev, cur, k);
  }
}
export const hasGrade = tl.beats.some((b) => b.grade === 'split');
export const gradeAt = (f: number) => GRADE_FRAMES[clamp(Math.round(f), 0, GRADE_FRAMES.length - 1)];

// shared uniforms: one write per frame updates every anchored material
export const GRADE_U = {uGrade: {value: 0}, uSlate: {value: new THREE.Color(PALETTE.anchoredGrade)}};

// Make a material "anchored": after lighting (linear space, before tone mapping and fog) its colour is
// pulled toward slate by uGrade. Brightness is kept but compressed (pow 0.62) and a bit darker.
export function anchorify<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGrade = GRADE_U.uGrade;
    sh.uniforms.uSlate = GRADE_U.uSlate;
    sh.fragmentShader = 'uniform float uGrade;\nuniform vec3 uSlate;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  {
    float gLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float sLum = dot(uSlate, vec3(0.2126, 0.7152, 0.0722));
    vec3 gTgt = uSlate * pow(max(gLum, 1e-4) / sLum, 0.62) * 0.78;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, gTgt, uGrade);
  }`);
  };
  m.customProgramCacheKey = () => 'anchored-grade-v1';
  return m;
}

// anchored counterpart of World.tsx M(): same parameters, own cache, grade hook
const cache = new Map<string, THREE.Material>();
export const ME = (c: string) => {
  if (!cache.has(c)) cache.set(c, anchorify(new THREE.MeshStandardMaterial({color: c, roughness: 0.85, flatShading: true})));
  return cache.get(c)!;
};
