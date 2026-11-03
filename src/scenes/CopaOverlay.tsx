// Scene-specific overlay for Copacabana stories: labels pinned to 3D points (projected with the same
// pure camera as the render) and the white cut into the globe shot.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {tl, FPS, clamp, beatAt} from '../timeline';
import {cameraAt} from '../World';
import {copaShot} from './Copacabana';
import {globePos, GLOBE_CUT, R} from './copaPhase3';

const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.25, 7000);
function project(f: number, p: [number, number, number]) {
  const c = cameraAt(f, copaShot);
  cam.fov = c.fov; cam.position.set(...c.pos); cam.lookAt(...c.look); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  // facing test for points on the globe: hidden when the surface normal points away from the camera
  const n = new THREE.Vector3(...p).normalize(), toCam = new THREE.Vector3(...c.pos).sub(new THREE.Vector3(...p)).normalize();
  return {x: (v.x * 0.5 + 0.5) * 1080, y: (-v.y * 0.5 + 0.5) * 1920, visible: v.z < 1 && n.dot(toCam) > 0.05};
}
const accent = tl.accentColor ?? tl.titleCard?.color ?? '#F2A33A';
const Label: React.FC<{x: number; y: number; o: number; big: string; small: string; color?: string}> = ({x, y, o, big, small, color = '#fff'}) =>
  <div style={{position: 'absolute', left: Math.min(Math.max(x, 260), 820), top: Math.max(y, 560), transform: 'translate(-50%, -100%)', opacity: o, textAlign: 'center',
    fontFamily: 'Space Mono', fontWeight: 700, color, textShadow: '0 2px 12px rgba(0,0,0,.8)'}}>
    <div style={{display: 'inline-block', background: 'rgba(6,10,18,.62)', borderRadius: 14, padding: '8px 18px 6px'}}>
    <div style={{fontSize: 46, lineHeight: 1}}>{big}</div>
    <div style={{fontSize: 22, letterSpacing: 4, opacity: 0.85}}>{small}</div>
    </div>
    <div style={{width: 3, height: 34, background: color, margin: '8px auto 0', opacity: 0.8}} />
  </div>;

export const CopaOverlay: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS, b = beatAt(t);
  const cut = Number.isFinite(GLOBE_CUT) && t >= GLOBE_CUT ? Math.exp(-(t - GLOBE_CUT) * 7) * 0.9 : 0;
  let labels: React.ReactNode = null;
  if (b.shot === 'globe_tilt_to_pole') {
    const o = Math.min(clamp((t - b.start - 0.6) / 0.5), clamp((b.end - t) / 0.3));
    const c = cameraAt(f, copaShot);
    const lon = -Math.atan2(c.pos[2], c.pos[0]) * 180 / Math.PI; // equator point facing the camera
    const eq = project(f, globePos(0, lon, R * 1.03)), pole = project(f, globePos(90, 0, R * 1.03));
    // follow the caption: equator first, pole second; a label never sits in the caption band (y > 1080)
    const mid = b.start + (b.end - b.start) * 0.5;
    const oEq = o * (1 - clamp((t - mid) / 0.3)) * (eq.y < 1080 ? 1 : 0);
    const oPole = o * clamp((t - mid + 0.3) / 0.4);
    labels = <>
      {eq.visible && oEq > 0 && <Label x={eq.x} y={eq.y} o={oEq} big="1,670" small="KM/H · EQUATOR" color={accent} />}
      {pole.visible && oPole > 0 && <Label x={pole.x} y={pole.y} o={oPole} big="0" small="KM/H · POLE" />}
    </>;
  }
  return <AbsoluteFill style={{pointerEvents: 'none'}}>
    {labels}
    <AbsoluteFill style={{background: '#fff', opacity: cut}} />
  </AbsoluteFill>;
};
