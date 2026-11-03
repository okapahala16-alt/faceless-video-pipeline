import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {tl, FPS, beatAt, clamp} from './timeline';

// Black screen that names the sound that is playing (for judging SFX one by one).
export const SfxDemo: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const b = beatAt(t);
  const active = (tl.audioEvents ?? []).filter((e) => t >= e.start && t < e.end);
  const o = clamp((t - b.start) / 0.15);
  return <AbsoluteFill style={{background: '#050608', color: '#fff', justifyContent: 'center', alignItems: 'center'}}>
    <div style={{position: 'absolute', top: 190, fontFamily: 'Space Mono', fontWeight: 700, fontSize: 26, letterSpacing: 6, opacity: 0.6}}>
      SFX DEMO · {t.toFixed(1)}s / {tl.duration.toFixed(1)}s</div>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 70, letterSpacing: 4, textAlign: 'center', padding: '0 140px', opacity: o}}>{b.label}</div>
    <div style={{marginTop: 40, fontFamily: 'EB Garamond', fontStyle: 'italic', fontWeight: 500, fontSize: 44, opacity: 0.8, textAlign: 'center', padding: '0 140px'}}>{b.caption ?? b.text}</div>
    <div style={{position: 'absolute', top: 1200, left: 140, right: 140, fontFamily: 'Space Mono', fontWeight: 700, fontSize: 24, letterSpacing: 3, lineHeight: 1.7, opacity: 0.7}}>
      {active.map((e) => <div key={e.name + e.start}>▸ {e.name}</div>)}
    </div>
    <div style={{position: 'absolute', bottom: 430, left: 140, right: 140, height: 6, background: 'rgba(255,255,255,.15)'}}>
      <div style={{width: `${(t / tl.duration) * 100}%`, height: '100%', background: '#FFC857'}} /></div>
  </AbsoluteFill>;
};
