// Measures the 除霊 bonus (poc/slot.js) and the crash curve that pays for it.
//   node tools/slot_sim.mjs            report
//   node tools/slot_sim.mjs --write    also write the measured PRIZE table into poc/slot.js
//   node tools/slot_sim.mjs --rtp      play whole rounds (crash + bonus) through the game's own curve
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SLOT_JS = fileURLToPath(new URL('../poc/slot.js', import.meta.url));
const N = Number(process.env.N || 400000);
const ctx = { globalThis: {} };
vm.runInNewContext(readFileSync(SLOT_JS, 'utf8'), ctx);
const SLOT = ctx.globalThis.SLOT;

// xorshift128+, seeded: runs are repeatable
function rngFrom(seed) {
  let a = seed >>> 0 || 1, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
  return () => {
    const t = a ^ (a << 11);
    a = b; b = c; c = d;
    d = (d ^ (d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return d / 2 ** 32;
  };
}

function spinStats(rng, n) {
  let hits = 0, boost = 0, retrig = 0, big = 0;
  for (let i = 0; i < n; i++) {
    const ev = SLOT.evaluate(SLOT.spinGrid(rng));
    if (ev.wins.length) hits++;
    if (ev.power >= 0.1) big++;
    boost += ev.power;
    if (ev.retrigger) retrig++;
  }
  return { hit: hits / n, ev: boost / n, retrig: retrig / n, big: big / n };
}

function bonusStats(K, rng, n) {
  let sum = 0, sq = 0, exo = 0, spins = 0, max = 0, capped = 0, event = 0, any = 0, bet1 = 0;
  const feat = { curse: 0, cheer: 0, expand: 0, combo: 0 };
  const Ws = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const b = SLOT.play(K, rng);
    const W = b.win;
    Ws[i] = W;
    sum += W;
    sq += W ** 2;
    if (W > 0) any++;
    if (W >= 1) bet1++;
    if (b.exorcisms) exo++;
    if (W >= SLOT.MAX_WIN) capped++;
    spins += b.spins.length;
    if (W > max) max = W;
    const has = {
      curse: b.spins.some((s) => s.curse !== null),
      cheer: b.spins.some((s) => s.cheer > 1),
      expand: b.spins.some((s) => s.expand.length),
      combo: b.spins.some((s) => s.combo >= 2),
    };
    for (const k in feat) if (has[k]) feat[k]++;
    if (b.exorcisms || Object.values(has).some(Boolean)) event++;
  }
  Ws.sort();
  const mean = sum / n;
  const se = Math.sqrt((sq / n - mean * mean) / n);
  const q = (p) => Ws[Math.floor(p * (n - 1))];
  for (const k in feat) feat[k] /= n;
  return { mean, se, any: any / n, bet1: bet1 / n, exo: exo / n, spins: spins / n, max, capped: capped / n, q50: q(0.5), q90: q(0.9), q99: q(0.99), feat, event: event / n };
}

const pct = (x) => `${(x * 100).toFixed(1).padStart(5)}%`;

const floor2 = (x) => Math.floor(x * 100 + 1e-7) / 100;

function report(rng) {
  const s = spinStats(rng, N * 2);
  console.log(`spin: hit ${(s.hit * 100).toFixed(1)}%  ev +${(s.ev * 100).toFixed(2)}%  big(>=10%) ${(s.big * 100).toFixed(2)}%  retrigger ${(s.retrig * 100).toFixed(2)}%`);
  console.log('wins in bets.  K  E[win]   se      win>0   win>=1  exorcised  spins  p50    p90    p99    max    capped  | curse  cheer  expand combo  any event');
  const prize = [0];
  for (let K = 1; K <= 8; K++) {
    const b = bonusStats(K, rng, N);
    prize.push(b.mean);
    console.log(`${K}  ${b.mean.toFixed(4)}  ${b.se.toFixed(4)}  ${pct(b.any)}  ${pct(b.bet1)}   ${(b.exo * 100).toFixed(2).padStart(6)}%   ${b.spins.toFixed(2)}  `
      + `${b.q50.toFixed(3)}  ${b.q90.toFixed(3)}  ${b.q99.toFixed(3)}  ${b.max.toFixed(2).padStart(5)}  ${(b.capped * 100).toFixed(3)}%  | `
      + `${pct(b.feat.curse)} ${pct(b.feat.cheer)} ${pct(b.feat.expand)} ${pct(b.feat.combo)}  ${pct(b.event)}`);
  }
  if (process.argv.includes('--write')) {
    const src = readFileSync(SLOT_JS, 'utf8');
    const table = `[${prize.map((g) => g.toFixed(4).replace(/\.?0+$/, '') || '0').join(', ')}]`;
    writeFileSync(SLOT_JS, src.replace(/const PRIZE = \[[^\]]*\];/, `const PRIZE = ${table};`));
    console.log(`wrote PRIZE = ${table}`);
  }
}

/** whole rounds at a fixed auto cash-out (bet 100, payouts floored to the cent as the game does) */
function rtp(rng) {
  const pts = Float64Array.from({ length: N }, () => SLOT.crashPoint(rng()));
  console.log('curve   P(point>=m) measured vs survival(m)');
  for (const m of [1.01, 1.5, 2, 3, 5, 10, 20, 100]) {
    const emp = pts.filter((c) => c >= m).length / N;
    console.log(`  ${m.toFixed(2).padStart(6)}  ${emp.toFixed(5)}  ${SLOT.survival(m).toFixed(5)}`);
  }
  console.log(`  instant (1.00x) ${(pts.filter((c) => c === 1).length / N * 100).toFixed(2)}%`);
  console.log('target  K+last  RTP sim   se       analytic  survival vs plain crash');
  for (const t of [1.01, 1.2, 1.49, 1.5, 1.8, 2, 2.5, 3, 4, 5, 7, 10, 15, 20, 50, 100, 200]) {
    const k = SLOT.kobanAt(t);
    const p = SLOT.kobanChance(t);
    let sum = 0, sq = 0;
    for (let i = 0; i < N; i++) {
      let ret = 0;
      if (SLOT.crashPoint(rng()) >= t) {
        const K = k + (rng() < p ? 1 : 0);
        ret = (floor2(100 * t) + (K ? floor2(100 * SLOT.play(K, rng).win) : 0)) / 100;
      }
      sum += ret;
      sq += ret * ret;
    }
    const mean = sum / N;
    const se = Math.sqrt((sq / N - mean * mean) / N);
    const ana = SLOT.survival(t) * (t + SLOT.prizeAt(t));
    const vsPlain = SLOT.survival(t) / ((1 - SLOT.HOUSE_EDGE) / t) - 1;
    console.log(`${t.toFixed(2).padStart(6)}  ${k}+${(p * 100).toFixed(0).padStart(2)}%  ${(mean * 100).toFixed(2)}%   ${(se * 100).toFixed(2)}%   ${(ana * 100).toFixed(2)}%    ${(vsPlain * 100).toFixed(1)}%`);
  }
}

const rng = rngFrom(Number(process.env.SEED || 7));
if (process.argv.includes('--rtp')) rtp(rng);
else report(rng);
