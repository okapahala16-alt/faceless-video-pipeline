import raw from '../public/timeline.json';
export type Word = {w: string; s: number; e: number};
export type Counter = {label: string; from: number; to: number; unit: string; dec: number} | null;
export type Beat = {id: string; text: string; label: string; highlight: string[]; shot: string; counter: Counter;
  start: number; end: number; voStart: number; voDur: number; words: Word[]};
export const tl = raw as unknown as {title: string; duration: number; beats: Beat[]};
export const FPS = 30;
export const beatById = (id: string) => tl.beats.find((b) => b.id === id)!;
export const beatAt = (t: number) => tl.beats.find((b) => t >= b.start && t < b.end) ?? (t < tl.beats[0].start ? tl.beats[0] : tl.beats[tl.beats.length - 1]);
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
