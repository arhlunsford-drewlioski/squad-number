export const avgOf = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
