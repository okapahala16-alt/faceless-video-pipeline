import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import '@fontsource/archivo-black/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/inter/600.css';
import {tl, FPS, beatAt, Word, clamp, ease, lerp} from './timeline';
import {gravity, T, PEOPLE, KID_INDEX, fr} from './sim';

const ACCENT = '#7CFFB2';
const norm = (w: string) => w.replace(/[^A-Za-z0-9']/g, '').toLowerCase();

// group words into short caption chunks (max 3 words, break after punctuation)
type Chunk = {words: (Word & {hl: boolean})[]; s: number; e: number};
const CHUNKS: Chunk[] = [];
for (const b of tl.beats) {
  let cur: Chunk | null = null;
  const hl = new Set(b.highlight.map(norm));
  for (const w of b.words) {
    if (!cur) cur = {words: [], s: w.s, e: w.e};
    cur.words.push({...w, hl: hl.has(norm(w.w))}); cur.e = w.e;
    if (cur.words.length >= 3 || /[.,?!]$/.test(w.w)) { CHUNKS.push(cur); cur = null; }
  }
  if (cur) CHUNKS.push(cur);
}
CHUNKS.forEach((c, i) => { const n = CHUNKS[i + 1]; c.e = n ? Math.min(n.s, c.e + 0.6) : c.e + 0.8; });

const Captions: React.FC<{t: number}> = ({t}) => {
  const c = CHUNKS.find((c) => t >= c.s - 0.04 && t < c.e);
  if (!c) return null;
  const pop = ease(clamp((t - c.s + 0.04) / 0.12));
  return <div style={{position: 'absolute', top: 1180, left: 60, right: 60, textAlign: 'center', transform: `scale(${0.86 + 0.14 * pop})`, opacity: pop}}>
    {c.words.map((w, i) => {
      const on = t >= w.s - 0.03;
      return <span key={i} style={{fontFamily: 'Archivo Black', fontSize: 104, lineHeight: 1.08, letterSpacing: -1, margin: '0 14px', display: 'inline-block',
        color: w.hl ? ACCENT : '#fff', opacity: on ? 1 : 0.35, transform: `translateY(${on ? 0 : 8}px)`,
        WebkitTextStroke: '14px #0b1320', paintOrder: 'stroke fill', textShadow: '0 10px 30px rgba(0,0,0,.35)'}}>{w.w.replace(/[,.]$/, '')}</span>;
    })}
  </div>;
};

const fmt = (v: number, dec: number) => v.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
const CounterCard: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t); const c = b.counter;
  if (!c) return null;
  const u = ease(clamp((t - b.start - 0.3) / Math.max(0.5, (b.end - b.start) * 0.75)));
  const kid = PEOPLE[KID_INDEX];
  let v = c.label === 'GRAVITY' ? gravity(t) : lerp(c.from, c.to, u);
  if (b.id === 'jump') { let m = 0; for (let i = 0; i <= fr(t); i++) m = Math.max(m, kid.y[i]); v = Math.max(0.5, Math.min(3.0, m + 0.03)); }
  const enter = ease(clamp((t - b.start) / 0.25));
  return <div style={{position: 'absolute', top: 210, left: 64, padding: '26px 34px 22px', borderRadius: 28, background: 'rgba(11,19,32,.72)', border: '2px solid rgba(255,255,255,.14)',
    transform: `translateX(${(1 - enter) * -40}px)`, opacity: enter, minWidth: 360}}>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 26, letterSpacing: 4, color: ACCENT}}>{c.label}</div>
    <div style={{fontFamily: 'Archivo Black', fontSize: 92, color: '#fff', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
      {fmt(v, c.dec)}<span style={{fontSize: 40, marginLeft: 12, color: 'rgba(255,255,255,.7)'}}>{c.unit}</span></div>
  </div>;
};

const GravityMeter: React.FC<{t: number}> = ({t}) => {
  const g = gravity(t); const h = 520; const fill = (g / 9.81) * h;
  const low = g < 5;
  return <div style={{position: 'absolute', right: 64, top: 230, width: 120, alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 14}}>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 22, color: '#fff', opacity: 0.85, letterSpacing: 2}}>EARTH</div>
    <div style={{width: 34, height: h, borderRadius: 20, background: 'rgba(11,19,32,.55)', border: '2px solid rgba(255,255,255,.2)', position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: fill, background: low ? `linear-gradient(${ACCENT}, #3fd1a0)` : 'linear-gradient(#ffd166, #ff8a3d)', borderRadius: 20}} />
      <div style={{position: 'absolute', left: -6, right: -6, bottom: (1.62 / 9.81) * h, height: 3, background: '#fff', opacity: 0.8}} />
    </div>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 22, color: '#fff', opacity: 0.85, letterSpacing: 2}}>MOON</div>
  </div>;
};

const TopChip: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t);
  const enter = ease(clamp((t - b.start) / 0.2));
  return <div style={{position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 30, letterSpacing: 6, color: '#0b1320', background: ACCENT, padding: '10px 26px', borderRadius: 999,
      transform: `translateY(${(1 - enter) * -16}px)`, opacity: 0.4 + 0.6 * enter}}>{b.label}</div>
  </div>;
};

const Title: React.FC<{t: number}> = ({t}) => {
  const o = interpolate(t, [0.2, 0.6, 3.9, 4.5], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (o <= 0) return null;
  return <div style={{position: 'absolute', top: 760, left: 70, right: 70, textAlign: 'center', opacity: o}}>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 34, letterSpacing: 8, color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.5)'}}>9.81 → 1.62 m/s²</div>
  </div>;
};

export const Overlay: React.FC = () => {
  const f = useCurrentFrame(); const t = f / FPS;
  const flash = t > T.snap ? Math.exp(-(t - T.snap) * 10) * 0.85 : 0;
  const end = tl.beats[tl.beats.length - 1];
  const endO = interpolate(t, [end.end - 1.1, end.end - 0.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(5,10,20,.45) 100%)'}} />
    <AbsoluteFill style={{background: 'linear-gradient(rgba(5,10,20,.35), rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(5,10,20,.4))'}} />
    <TopChip t={t} />
    <CounterCard t={t} />
    <GravityMeter t={t} />
    <Title t={t} />
    <Captions t={t} />
    <AbsoluteFill style={{background: '#fff', opacity: flash}} />
    <AbsoluteFill style={{background: '#0b1320', opacity: endO, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontFamily: 'Archivo Black', fontSize: 84, color: '#fff', textAlign: 'center', lineHeight: 1.1}}>Where would<br /><span style={{color: ACCENT}}>you</span> stand?</div>
    </AbsoluteFill>
  </AbsoluteFill>;
};
