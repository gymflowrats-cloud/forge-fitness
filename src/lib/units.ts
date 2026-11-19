// Canonical storage: weight in lb, length in inches, distance in miles.
export type Units = 'imperial' | 'metric';
const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const KM_PER_MI = 1.609344;

export const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export const wUnit = (u: Units) => (u === 'metric' ? 'kg' : 'lb');
export const lUnit = (u: Units) => (u === 'metric' ? 'cm' : 'in');
export const dUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi');

export const toDispW = (lb: number | null | undefined, u: Units) =>
  lb == null ? null : u === 'metric' ? round(lb / LB_PER_KG, 1) : round(lb, 1);
export const fromDispW = (v: number, u: Units) => (u === 'metric' ? v * LB_PER_KG : v);
export const toDispL = (inch: number | null | undefined, u: Units) =>
  inch == null ? null : u === 'metric' ? round(inch * CM_PER_IN, 1) : round(inch, 1);
export const fromDispL = (v: number, u: Units) => (u === 'metric' ? v / CM_PER_IN : v);
export const toDispD = (mi: number | null | undefined, u: Units) =>
  mi == null ? null : u === 'metric' ? round(mi * KM_PER_MI, 2) : round(mi, 2);
export const fromDispD = (v: number, u: Units) => (u === 'metric' ? v / KM_PER_MI : v);

export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const inToCm = (i: number) => i * CM_PER_IN;
