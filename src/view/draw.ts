import type { Frame } from './timeline';

export interface Palette { grass1: string; grass2: string; line: string; hc1: string; hc2: string; ac1: string; ac2: string; text: string; accent: string }

const ink = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111' : '#fff';
};

/** Draws the pitch markings. Pitch space maps to the canvas with a small margin so goals and corners show. */
export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  const m = Math.round(w * 0.025);
  const pw = w - 2 * m, ph = h - 2 * m;
  ctx.fillStyle = pal.grass1;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? pal.grass2 : pal.grass1;
    ctx.fillRect(m + (pw / 12) * i, m, pw / 12 + 1, ph);
  }
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1.5, w / 700);
  const X = (u: number) => m + u * pw, Y = (v: number) => m + v * ph;
  ctx.strokeRect(X(0), Y(0), pw, ph);
  ctx.beginPath(); ctx.moveTo(X(0.5), Y(0)); ctx.lineTo(X(0.5), Y(1)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), ph * 0.135, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), 3, 0, Math.PI * 2); ctx.fillStyle = pal.line; ctx.fill();
  for (const s of [0, 1]) {
    const sign = s ? -1 : 1, x0 = X(s);
    ctx.strokeRect(s ? X(1) - pw * 0.157 : x0, Y(0.5 - 0.3), pw * 0.157, ph * 0.6);
    ctx.strokeRect(s ? X(1) - pw * 0.052 : x0, Y(0.5 - 0.135), pw * 0.052, ph * 0.27);
    ctx.beginPath(); ctx.arc(X(s ? 1 - 0.105 : 0.105), Y(0.5), 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(X(s ? 1 - 0.105 : 0.105), Y(0.5), ph * 0.135, s ? Math.PI * 0.69 : -Math.PI * 0.31, s ? Math.PI * 1.31 : Math.PI * 0.31); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(s ? X(1) : x0 - m * 0.55, Y(0.5 - 0.055), m * 0.55 * (s ? 1 : 1), ph * 0.11);
    void sign;
  }
}

export interface Smoothed { x: number; y: number }

/** Draws players, the ball and the overlay. positions holds the smoothed positions by id. */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame, pos: Map<string, Smoothed>, pal: Palette, ballPos: Smoothed): void {
  const m = Math.round(w * 0.025);
  const pw = w - 2 * m, ph = h - 2 * m;
  const X = (u: number) => m + u * pw, Y = (v: number) => m + v * ph;
  const r = Math.max(7, w * 0.0125);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const p of f.players) {
    const q = pos.get(p.id) ?? p;
    const x = X(q.x), y = Y(q.y);
    const c1 = p.side === 'h' ? pal.hc1 : pal.ac1, c2 = p.side === 'h' ? pal.hc2 : pal.ac2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 1.5, y + r * 0.8, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = p.human ? 3 : 1.5;
    ctx.strokeStyle = p.human ? pal.accent : c2;
    ctx.stroke();
    ctx.fillStyle = ink(c1);
    ctx.font = `700 ${Math.round(r * 1.05)}px 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`;
    ctx.fillText(String(p.num), x, y + 0.5);
    if (p.human || (p.cast && f.item.kind === 'scene')) {
      const label = p.human ? 'You' : p.name.split(' ').slice(-1)[0];
      ctx.font = `${p.human ? 800 : 600} ${Math.round(r * 1.15)}px 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      ctx.fillRect(x - tw / 2 - 4, y - r * 2.55, tw + 8, r * 1.5);
      ctx.fillStyle = p.human ? pal.accent : '#fff';
      ctx.fillText(label, x, y - r * 1.8);
    }
  }

  const bx = X(ballPos.x), by = Y(ballPos.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(bx + 1.5, by + r * 0.5, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx, by, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  const o = f.overlay;
  if (o) {
    const a = Math.min(1, o.age / 160, (o.dur - o.age) / 220);
    const alpha = Math.max(0, a);
    const big = Math.round(w * 0.05);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = o.tone === 'goal' ? pal.accent : o.tone === 'card' ? (o.text.startsWith('Red') ? '#d4605e' : '#e0c04a') : 'rgba(10,14,20,0.82)';
    const bw = Math.min(pw * 0.7, w * 0.5), bh = big * (o.sub ? 2.1 : 1.4), cx = w / 2, cy = h * 0.2;
    ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.fillStyle = o.tone === 'goal' || o.tone === 'card' ? '#111' : '#fff';
    ctx.font = `700 ${big}px 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`;
    ctx.fillText(o.text, cx, o.sub ? cy - big * 0.38 : cy);
    if (o.sub) { ctx.font = `500 ${Math.round(big * 0.5)}px 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif`; ctx.fillText(o.sub, cx, cy + big * 0.52); }
    ctx.globalAlpha = 1;
  }
}
