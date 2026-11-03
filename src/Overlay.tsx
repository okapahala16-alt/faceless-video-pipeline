import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import '@fontsource/archivo-black/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/inter/600.css';
import '@fontsource/eb-garamond/500-italic.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/600-italic.css';
import {tl, FPS, beatAt, Word, clamp, ease, lerp, Beat, CaptionStyle, Hud} from './timeline';
import {gravity, T, PEOPLE, KID_INDEX, fr} from './sim';

const ACCENT = '#7CFFB2';
const END = tl.endCard ?? ['Where would', 'you', 'stand?'];
const ID = (tl.locale || '').startsWith('id');
const norm = (w: string) => w.replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();

// group words into short caption chunks (max 3 words, break after punctuation)
type Chunk = {words: (Word & {hl: boolean})[]; s: number; e: number};
const CHUNKS: Chunk[] = [];
const styleOf = (b: Beat): CaptionStyle => b.captionStyle ?? tl.captionStyle ?? 'karaoke';
const IS_KUTA = (tl.scene ?? 'kuta') === 'kuta';
const UI = {topChip: true, counter: true, gravityMeter: true, vignette: true, snapFlash: true, ...(tl.ui ?? {})};
for (const b of tl.beats) {
  if (styleOf(b) !== 'karaoke') continue;
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

const fmt = (v: number, dec: number) => v.toLocaleString(tl.locale || 'en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
const CounterCard: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t); const c = b.counter;
  if (!c) return null;
  const u = ease(clamp((t - b.start - 0.3) / Math.max(0.5, (b.end - b.start) * 0.75)));
  const kid = PEOPLE[KID_INDEX];
  let v = c.unit === 'm/s²' ? gravity(t) : lerp(c.from, c.to, u);
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
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 22, color: '#fff', opacity: 0.85, letterSpacing: 2}}>{ID ? 'BUMI' : 'EARTH'}</div>
    <div style={{width: 34, height: h, borderRadius: 20, background: 'rgba(11,19,32,.55)', border: '2px solid rgba(255,255,255,.2)', position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: fill, background: low ? `linear-gradient(${ACCENT}, #3fd1a0)` : 'linear-gradient(#ffd166, #ff8a3d)', borderRadius: 20}} />
      <div style={{position: 'absolute', left: -6, right: -6, bottom: (1.62 / 9.81) * h, height: 3, background: '#fff', opacity: 0.8}} />
    </div>
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 22, color: '#fff', opacity: 0.85, letterSpacing: 2}}>{ID ? 'BULAN' : 'MOON'}</div>
  </div>;
};

const TopChip: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t);
  if (!b.label) return null;
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
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 34, letterSpacing: 8, color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.5)'}}>{fmt(9.81, 2)} → {fmt(1.62, 2)} m/s²</div>
  </div>;
};

// ---------- editorial caption: one serif italic sentence per beat, fade in/out ----------
const EditorialCaption: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t);
  if (styleOf(b) !== 'editorial') return null;
  const text = b.caption ?? b.text;
  if (!text) return null;
  const tc = tl.titleCard;
  const titleGone = tc ? (tc.hold ?? 2.5) + (tc.fadeOut ?? 0.6) : 0;
  const endCardAt = tc ? tl.duration - (tc.endHold ?? 2.0) : Infinity;
  const a = Math.max(b.start + 0.25, titleGone), z = Math.min(b.end - 0.2, endCardAt);
  if (z - a < 0.6) return null;
  const o = Math.min(clamp((t - a) / 0.45), clamp((z - t) / 0.4));
  if (o <= 0) return null;
  return <div style={{position: 'absolute', left: 140, right: 140, top: 1150, display: 'flex', justifyContent: 'center', opacity: o,
    transform: `translateY(${(1 - o) * 10}px)`}}>
    <div style={{position: 'relative', padding: '18px 34px', textAlign: 'center'}}>
      <div style={{position: 'absolute', inset: -30, background: 'radial-gradient(ellipse at center, rgba(5,10,20,.62) 0%, rgba(5,10,20,.38) 45%, rgba(5,10,20,0) 72%)'}} />
      <div style={{position: 'relative', fontFamily: 'EB Garamond', fontStyle: 'italic', fontWeight: 500, fontSize: 58, lineHeight: 1.22, color: '#fff',
        textShadow: '0 2px 14px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.6)'}}>{text}</div>
    </div>
  </div>;
};

// ---------- HUD countdown ----------
type HudState = {label: string; sub: string; v: number; done: boolean; end?: string; dec: number};
const hudStart = new Map<string, number>();
{ // resolve "from": "continue" by walking beats in order
  let last = 0;
  for (const b of tl.beats) {
    const h = b.hud;
    if (!h) continue;
    const from = h.from === 'continue' ? last : h.from;
    hudStart.set(b.id, from);
    const to = h.to ?? 0, dir = Math.sign(to - from) || -1, rate = h.rate ?? 1;
    const raw = from + dir * rate * (b.end - b.start);
    last = dir < 0 ? Math.max(to, raw) : Math.min(to, raw);
  }
}
function hudAt(b: Beat, h: Hud, t: number): HudState {
  const from = hudStart.get(b.id) ?? 0, to = h.to ?? 0, rate = h.rate ?? 1;
  const dir = Math.sign(to - from) || -1;
  const raw = from + dir * rate * (t - b.start);
  const v = dir < 0 ? Math.max(to, raw) : Math.min(to, raw);
  return {label: h.label ?? '', sub: h.sub ?? '', v, done: v === to && t > b.start, end: h.end, dec: h.decimals ?? 3};
}
export const fmtClock = (v: number, dec = 3) => {
  v = Math.max(0, v);
  const m = Math.floor(v / 60), s = v - m * 60;
  const whole = Math.floor(s), frac = Math.floor((s - whole) * Math.pow(10, dec));
  return `${m}:${String(whole).padStart(2, '0')}${dec > 0 ? '.' + String(frac).padStart(dec, '0') : ''}`;
};
const HudCountdown: React.FC<{t: number}> = ({t}) => {
  const b = beatAt(t);
  if (!b.hud) return null;
  const st = hudAt(b, b.hud, t);
  const showEnd = st.done && !!st.end;
  const sh = '0 2px 14px rgba(0,0,0,.6), 0 0 3px rgba(0,0,0,.5)';
  const vis = 1 - titleOpacity(t);
  if (vis <= 0.01) return null;
  return <div style={{position: 'absolute', top: 190, left: 140, right: 140, textAlign: 'center', color: '#fff', opacity: vis}}>
    {st.label && <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 26, letterSpacing: 7, opacity: 0.85, textShadow: sh}}>{st.label}</div>}
    <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: showEnd ? 104 : 112, lineHeight: 1.15, letterSpacing: showEnd ? 14 : 0,
      color: showEnd ? (tl.titleCard?.color ?? '#FFC857') : '#fff', textShadow: sh}}>{showEnd ? st.end : fmtClock(st.v, st.dec)}</div>
    {st.sub && <div style={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 25, letterSpacing: 5, opacity: 0.92, textShadow: sh}}>{st.sub}</div>}
  </div>;
};

// ---------- title card: opening (over the scene) + end card that matches frame 0 for a clean loop ----------
const TitleWords: React.FC<{title: string; accent: string[]; color: string}> = ({title, accent, color}) => {
  const acc = new Set(accent.map(norm));
  return <>{title.split(' ').map((w, i) => <React.Fragment key={i}>
    <span style={acc.has(norm(w)) ? {color, fontStyle: 'italic'} : undefined}>{w}</span>{' '}
  </React.Fragment>)}</>;
};
function titleParts(t: number) {
  const tc = tl.titleCard;
  if (!tc) return {startO: 0, endO: 0};
  const hold = tc.hold ?? 2.5, fadeOut = tc.fadeOut ?? 0.6, endHold = tc.endHold ?? 2.0;
  return {startO: 1 - clamp((t - hold) / fadeOut), endO: clamp((t - (tl.duration - endHold)) / 0.6)};
}
function titleOpacity(t: number) { const p = titleParts(t); return Math.max(p.startO, p.endO); }
const TitleCardLayer: React.FC<{t: number}> = ({t}) => {
  const tc = tl.titleCard;
  if (!tc) return null;
  const bd = tc.backdrop ?? 0.35, loopBd = tc.loopBackdrop ?? 0.8;
  const {endO} = titleParts(t);
  const o = titleOpacity(t);
  if (o <= 0) return null;
  // backdrop: dark at the loop point (frame 0 and the last frames), lighter while the scene shows through
  const bOpen = lerp(loopBd, bd, ease(clamp(t / 0.9)));
  const backdrop = endO > 0 ? lerp(bd, loopBd, endO) : bOpen;
  const color = tc.color ?? '#FFC857';
  const accent = typeof tc.accent === 'string' ? [tc.accent] : tc.accent ?? [];
  return <AbsoluteFill style={{opacity: o}}>
    <AbsoluteFill style={{background: `rgba(6,10,18,${backdrop})`}} />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 140px'}}>
      <div style={{textAlign: 'center', marginTop: -120}}>
        <div style={{fontFamily: 'EB Garamond', fontWeight: 600, fontSize: 104, lineHeight: 1.06, color: '#fff', letterSpacing: -1,
          textShadow: '0 4px 30px rgba(0,0,0,.45)'}}><TitleWords title={tc.title} accent={accent} color={color} /></div>
        {tc.subtitle && <div style={{marginTop: 34, fontFamily: 'Space Mono', fontWeight: 700, fontSize: 24, letterSpacing: 6, color: 'rgba(255,255,255,.8)'}}>{tc.subtitle}</div>}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
};

// ---------- review helper: TikTok UI safe zones (top 150, bottom 400, right 140) ----------
export const SafeZones: React.FC = () => <AbsoluteFill style={{pointerEvents: 'none'}}>
  <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 150, background: 'rgba(255,0,60,.28)', borderBottom: '3px dashed #ff003c'}} />
  <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 400, background: 'rgba(255,0,60,.28)', borderTop: '3px dashed #ff003c'}} />
  <div style={{position: 'absolute', top: 150, bottom: 400, right: 0, width: 140, background: 'rgba(255,0,60,.28)', borderLeft: '3px dashed #ff003c'}} />
</AbsoluteFill>;

export const Overlay: React.FC = () => {
  const f = useCurrentFrame(); const t = f / FPS;
  const flash = UI.snapFlash && t > T.snap ? Math.exp(-(t - T.snap) * 10) * 0.85 : 0;
  const end = tl.beats[tl.beats.length - 1];
  const endO = interpolate(t, [end.end - 1.1, end.end - 0.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill>
    {UI.vignette && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(5,10,20,.45) 100%)'}} />}
    {UI.vignette && <AbsoluteFill style={{background: 'linear-gradient(rgba(5,10,20,.35), rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(5,10,20,.4))'}} />}
    {UI.topChip && <TopChip t={t} />}
    {UI.counter && <CounterCard t={t} />}
    {UI.gravityMeter && <GravityMeter t={t} />}
    {!tl.titleCard && IS_KUTA && <Title t={t} />}
    <HudCountdown t={t} />
    <Captions t={t} />
    <EditorialCaption t={t} />
    <AbsoluteFill style={{background: '#fff', opacity: flash}} />
    <TitleCardLayer t={t} />
    {!tl.titleCard && IS_KUTA && <AbsoluteFill style={{background: '#0b1320', opacity: endO, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontFamily: 'Archivo Black', fontSize: 84, color: '#fff', textAlign: 'center', lineHeight: 1.1}}>{END[0]}<br /><span style={{color: ACCENT}}>{END[1]}</span> {END[2]}</div>
    </AbsoluteFill>}
  </AbsoluteFill>;
};
