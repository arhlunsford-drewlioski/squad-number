// Do safe, balanced and gamble options pay off differently? `npx tsx scripts/risk-check.ts`
import { DEFAULT_SETUP, reportFor } from '../src/engine/moments/lab';
import { TEMPLATES } from '../src/engine/moments/templates';

for (const [mine, opp] of [[8, 10], [10, 10], [13, 10]] as const) {
  const acc: Record<string, { n: number; s: number; ev: number; great: number; dis: number; good: number }> = {};
  for (const t of TEMPLATES) {
    if (t.followOnly) continue;
    for (const slot of t.for.slice(0, 1)) {
      for (const o of reportFor(t, { ...DEFAULT_SETUP, myLevel: mine, oppLevel: opp, slot })) {
        if (o.locked) continue;
        const a = (acc[o.risk] ??= { n: 0, s: 0, ev: 0, great: 0, dis: 0, good: 0 });
        a.n++; a.s += o.s; a.ev += o.ev; a.great += o.tiers[0]; a.good += o.tiers[1]; a.dis += o.tiers[3];
      }
    }
  }
  console.log(`you ${mine} v them ${opp}`);
  for (const k of ['safe', 'balanced', 'gamble']) {
    const a = acc[k]; if (!a) continue;
    console.log(`  ${k.padEnd(9)} options ${String(a.n).padStart(3)}  chance ${(a.s / a.n).toFixed(2)}  great ${(a.great / a.n).toFixed(2)}  good ${(a.good / a.n).toFixed(2)}  disaster ${(a.dis / a.n).toFixed(2)}  value ${(a.ev / a.n).toFixed(3)}`);
  }
}
