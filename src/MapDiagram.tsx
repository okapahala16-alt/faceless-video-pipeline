// Top-down diagram used by the "map_top_down" shot: north-up schematic of the beach with the
// original shoreline (dashed) and today's water edge, shifted east by the drift. Pure SVG, frame-driven.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {tl, clamp, Beat, linearCounter} from './timeline';
import {waterShiftKm} from './scenes/copaPhase2';

// beach crescent in km (x = east, y = north), Forte (SW end) at the origin, Leme ~4 km away at bearing 37 deg
const BEAR = (37 * Math.PI) / 180;
const LEN = 4.0, SAG = 0.42; // crescent bows inland (north-west) by SAG km in the middle
const shore = (u: number) => {
  const ax = Math.sin(BEAR) * LEN * u, ay = Math.cos(BEAR) * LEN * u;
  const nx = -Math.cos(BEAR), ny = Math.sin(BEAR); // unit normal toward the land (north-west)
  const b = SAG * Math.sin(Math.PI * u);
  return [ax + nx * b, ay + ny * b];
};
const PTS = Array.from({length: 41}, (_, i) => shore(i / 40));
// view box in km
const X0 = -1.2, X1 = 5.4, Y0 = -0.9, Y1 = 4.4;
const W = 820, H = 580, S = Math.min(W / (X1 - X0), H / (Y1 - Y0));
const px = (x: number) => (x - X0) * S, py = (y: number) => H - (y - Y0) * S;
const path = (pts: number[][], dx = 0) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x + dx).toFixed(1)},${py(y).toFixed(1)}`).join(' ');

export const MapDiagram: React.FC<{t: number; beat: Beat}> = ({t, beat}) => {
  if (beat.shot !== 'map_top_down') return null;
  const accent = tl.accentColor ?? tl.titleCard?.color ?? '#F2A33A';
  const d = waterShiftKm(t);
  // number shown = the counter's value (physics: 428.2 m/s x real seconds), so map and counter always agree
  const label = beat.counter ? Math.round(linearCounter(beat, t)) : Math.round(d * 1000);
  const o = Math.min(clamp((t - beat.start) / 0.35), clamp((beat.end - t) / 0.3));
  const landPoly = `${path(PTS)} L${px(X1)},${py(Y1)} L${px(X0)},${py(Y1)} L${px(X0)},${py(PTS[0][1])} Z`;
  // exposed seabed: between the old shoreline and the new edge (old shore shifted east by d)
  const shifted = PTS.map(([x, y]) => [x + d, y]);
  const seabed = `${path(PTS)} ${shifted.slice().reverse().map(([x, y]) => `L${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')} Z`;
  const mid = shore(0.5), midNew = [mid[0] + d, mid[1]];
  const mono = {fontFamily: 'Space Mono', fontWeight: 700} as const;
  return <AbsoluteFill style={{background: '#0b1622', opacity: o}}>
    <svg width={W} height={H} style={{position: 'absolute', left: 90, top: 610}} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <pattern id="bed" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(37)">
          <rect width="14" height="14" fill="#3a434d" /><line x1="0" y1="0" x2="0" y2="14" stroke="#4d5763" strokeWidth="5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#12557a" />
      <path d={seabed} fill="url(#bed)" />
      <path d={landPoly} fill="#5B6672" />
      {/* city blocks just inland of the beach */}
      {PTS.filter((_, i) => i % 3 === 1).map(([x, y], i) => <rect key={i} x={px(x - 0.25 * Math.cos(BEAR)) - 9} y={py(y + 0.25 * Math.sin(BEAR)) - 9}
        width={18} height={18} fill="#49525c" transform={`rotate(-53 ${px(x - 0.25 * Math.cos(BEAR))} ${py(y + 0.25 * Math.sin(BEAR))})`} />)}
      <path d={path(shifted)} fill="none" stroke="#bfe9ff" strokeWidth={5} />
      <path d={path(PTS)} fill="none" stroke="#ffffff" strokeWidth={4} strokeDasharray="14 10" />
      {/* drift arrow at the middle of the beach */}
      <line x1={px(mid[0]) + 8} y1={py(mid[1])} x2={px(midNew[0]) - 14} y2={py(midNew[1])} stroke={accent} strokeWidth={4} />
      <polygon points={`${px(midNew[0]) - 2},${py(midNew[1])} ${px(midNew[0]) - 22},${py(midNew[1]) - 11} ${px(midNew[0]) - 22},${py(midNew[1]) + 11}`} fill={accent} />
      <rect x={px(mid[0] + d / 2) - 120} y={py(mid[1]) + 50} width={240} height={40} rx={8} fill="#0b1622" opacity={0.85} />
      <text x={px(mid[0] + d / 2)} y={py(mid[1]) + 80} textAnchor="middle" fill={accent} style={{...mono, fontSize: 30}}>{label.toLocaleString('en-US')} M EAST</text>
      {/* labels */}
      <text x={px(PTS[0][0]) - 10} y={py(PTS[0][1]) + 34} textAnchor="end" fill="#e8eef4" style={{...mono, fontSize: 28}}>FORTE</text>
      <text x={px(PTS[40][0]) - 14} y={py(PTS[40][1]) - 14} textAnchor="end" fill="#e8eef4" style={{...mono, fontSize: 28}}>LEME</text>
      <text x={px(shore(0.25)[0]) - 34} y={py(shore(0.25)[1])} textAnchor="end" fill="#ffffff" style={{...mono, fontSize: 26}}>ORIGINAL</text>
      <text x={px(shore(0.25)[0]) - 34} y={py(shore(0.25)[1]) + 30} textAnchor="end" fill="#ffffff" style={{...mono, fontSize: 26}}>SHORELINE</text>
      <text x={px(shore(0.75)[0] + d) + 34} y={py(shore(0.75)[1])} fill="#bfe9ff" style={{...mono, fontSize: 26}}>WATER&apos;S</text>
      <text x={px(shore(0.75)[0] + d) + 34} y={py(shore(0.75)[1]) + 30} fill="#bfe9ff" style={{...mono, fontSize: 26}}>EDGE NOW</text>
      {/* scale bar + north arrow */}
      <g transform={`translate(${W - 40 - S}, ${H - 44})`}>
        <rect width={S} height={10} fill="#ffffff" /><rect width={S / 2} height={10} fill="#0b1622" stroke="#ffffff" strokeWidth={2} />
        <text x={S / 2} y={-12} textAnchor="middle" fill="#ffffff" style={{...mono, fontSize: 28}}>1 KM</text>
      </g>
      <g transform="translate(46, 60)">
        <polygon points="0,-34 14,8 0,0 -14,8" fill="#ffffff" />
        <text x={0} y={36} textAnchor="middle" fill="#ffffff" style={{...mono, fontSize: 28}}>N</text>
      </g>
    </svg>
  </AbsoluteFill>;
};
