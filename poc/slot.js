'use strict';

/* =========================================================
   THE FOLLOWER — round math (no DOM): the crash curve and the 除霊 bonus slot
   Koban thrown in by chat while you film are spins here, after you got out.
   Every win is a talisman hitting the ghost; empty its HP and it is exorcised for a bounty.
   The bonus pays on top of the escape payout, in bets: payout + bet * win. It does not grow with the
   multiplier, so the crash curve only gives up that much — next to nothing at high multipliers.
   The crash is the game: the bonus is kept small (about 3% of the bet a koban), small line wins often and
   now and then a bounty of a bet or more. The ghost curses a reel, chat cheers a spin, koban spread over a
   reel, wins in a row build a combo: those move the damage (and so the bounties) more than the line pay.
   Loaded by the game and by tools/slot_sim.mjs, which measures PRIZE below and checks the RTP.
   ========================================================= */

(function (root) {
  const ROWS = 3;
  const REELS = 5;
  const WILD = 'koban';

  // per reel, how often each symbol lands in a cell; the wild only lands on the middle three reels.
  // onibi (the ghost's own fire) never pays: it is what an empty cell looks like
  const WEIGHTS = [
    { onibi: 36, shio: 21, omamori: 17, juzu: 12, ofuda: 8, koban: 0 },
    { onibi: 36, shio: 21, omamori: 17, juzu: 12, ofuda: 8, koban: 5 },
    { onibi: 36, shio: 21, omamori: 17, juzu: 12, ofuda: 8, koban: 5 },
    { onibi: 36, shio: 21, omamori: 17, juzu: 12, ofuda: 8, koban: 5 },
    { onibi: 36, shio: 21, omamori: 17, juzu: 12, ofuda: 8, koban: 0 },
  ];

  // 243 ways, left to right: power per way for 3 / 4 / 5 in a row. It hits for power * DMG_PER_POWER
  // and pays power * PAY_PER_POWER bets
  const PAYS = {
    shio: [0.004, 0.01, 0.025],
    omamori: [0.006, 0.015, 0.04],
    juzu: [0.01, 0.025, 0.07],
    ofuda: [0.015, 0.04, 0.12],
  };

  const DMG_PER_POWER = 1000;
  const PAY_PER_POWER = 0.6;
  const HP = [340, 600, 950];            // each ghost after an exorcism comes back stronger
  const BOUNTY = [{ x: 0.5, weight: 50 }, { x: 1, weight: 32 }, { x: 2, weight: 14 }, { x: 5, weight: 4 }];  // bets
  const RETRIGGER = 3;                   // this many koban land: chat throws in one more spin
  const MAX_SPINS = 12;
  const MAX_WIN = 20;                    // bets

  // features, per spin
  const CURSE = 0.11;                    // the ghost seals a reel (never the first spin): it lands all onibi
  const CHEER = 0.09;                    // chat cheers the spin: it hits and pays double
  const EXPAND = 0.3;                    // a koban on reel 2-4 spreads over its whole reel
  const COMBO = [1, 1, 1.5, 2, 2.5, 3];  // damage by wins in a row (index: the streak, capped)

  // E[win] in bets for K koban (index K), measured by tools/slot_sim.mjs: the crash curve pays for it up front
  const PRIZE = [0, 0.0271, 0.0596, 0.0963, 0.1377, 0.1817, 0.2266, 0.2761, 0.3275];

  function pickWeighted(table, u) {
    let total = 0;
    for (const k in table) total += table[k];
    let r = u * total;
    for (const k in table) if ((r -= table[k]) < 0) return k;
    return Object.keys(table).pop();
  }

  /** grid[reel][row] */
  function spinGrid(rng) {
    return WEIGHTS.map((w) => Array.from({ length: ROWS }, () => pickWeighted(w, rng())));
  }

  function evaluate(grid) {
    const wins = [];
    let power = 0;
    for (const sym of Object.keys(PAYS)) {
      let ways = 1;
      let n = 0;
      const cells = [];
      for (let r = 0; r < REELS; r++) {
        const hit = [];
        grid[r].forEach((s, row) => { if (s === sym || s === WILD) hit.push([r, row]); });
        if (!hit.length) break;
        ways *= hit.length;
        cells.push(...hit);
        n++;
      }
      if (n < 3) continue;
      const pay = PAYS[sym][n - 3] * ways;
      power += pay;
      wins.push({ sym, n, ways, power: pay, cells });
    }
    const koban = grid.flat().filter((s) => s === WILD).length;
    return { wins, power, koban, retrigger: koban >= RETRIGGER };
  }

  const BOUNTY_TABLE = Object.fromEntries(BOUNTY.map((e) => [e.x, e.weight]));
  const hpOf = (stage) => HP[Math.min(stage, HP.length - 1)];

  /**
   * The whole bonus for K koban, decided up front; the game only plays it back.
   * Per spin: the grid as it landed (land) and after koban spread over reels (grid, expand), the reel the
   * ghost cursed (curse) or chat's cheer (cheer: 2), its wins and the streak (combo, comboX), the hit (dmg)
   * on a ghost of hpMax with hpBefore left, what its wins pay (pay), the bounty when that hit finished it,
   * extra spins thrown in, and the win so far. Everything paid is in bets.
   */
  function play(K, rng) {
    const spins = [];
    let left = K;
    let win = 0;
    let stage = 0;
    let hp = hpOf(0);
    let streak = 0;
    while (left > 0 && spins.length < MAX_SPINS) {
      left--;
      const curse = spins.length && rng() < CURSE ? Math.floor(rng() * REELS) : null;
      const cheer = curse === null && rng() < CHEER ? 2 : 1;
      const land = spinGrid(rng);
      if (curse !== null) land[curse] = land[curse].map(() => 'onibi');
      const expand = [];
      for (let r = 1; r < REELS - 1; r++) if (land[r].includes(WILD) && rng() < EXPAND) expand.push(r);
      const grid = land.map((col, r) => (expand.includes(r) ? col.map(() => WILD) : col));
      const ev = evaluate(grid);
      streak = ev.wins.length ? streak + 1 : 0;
      const comboX = COMBO[Math.min(streak, COMBO.length - 1)];
      const dmg = Math.round(ev.power * DMG_PER_POWER * cheer * comboX);
      const pay = ev.power * PAY_PER_POWER * cheer;
      const spin = {
        land, grid, expand, curse, cheer, wins: ev.wins, combo: streak, comboX, dmg, pay,
        stage, hpMax: hpOf(stage), hpBefore: hp, bounty: null, extra: 0,
      };
      win += pay;
      hp = Math.max(0, hp - dmg);
      if (hp === 0) {
        spin.bounty = Number(pickWeighted(BOUNTY_TABLE, rng()));
        win += spin.bounty;
        stage++;
        hp = hpOf(stage);
      }
      const landed = land.flat().filter((s) => s === WILD).length;
      if (landed >= RETRIGGER && spins.length + 1 + left < MAX_SPINS) {
        left++;
        spin.extra = 1;
      }
      spin.win = Math.min(MAX_WIN, win);
      spins.push(spin);
    }
    return { spins, win: Math.min(MAX_WIN, win), exorcisms: stage };
  }

  /* ---------- the crash curve ---------- */
  const HOUSE_EDGE = 0.03;
  const MAX_MULT = 1000;
  // chat throws a koban each time the multiplier passes one of these while you are still filming
  const KOBAN_AT = [1.5, 2, 3, 5, 10, 20, 50, 100];
  const kobanAt = (m) => KOBAN_AT.filter((t) => m >= t).length;

  const STEPS = [1, ...KOBAN_AT];

  /**
   * Cashing out between two koban, chat throws in the next one as a parting gift with this chance: how far
   * the multiplier got from the last milestone to the next (log scale).
   */
  function kobanChance(m) {
    const k = kobanAt(m);
    if (k >= KOBAN_AT.length || m <= 1) return 0;
    return Math.log(m / STEPS[k]) / Math.log(STEPS[k + 1] / STEPS[k]);
  }

  /** what the bonus is worth (bets) cashing out at m, the parting koban included */
  function prizeAt(m) {
    const k = kobanAt(m);
    return k >= KOBAN_AT.length ? PRIZE[k] : PRIZE[k] + kobanChance(m) * (PRIZE[k + 1] - PRIZE[k]);
  }

  // P(crash point >= m): cashing out at m returns m + prizeAt(m) bets on the stake, so (1 - edge) / that
  // makes it exactly 1 - edge anywhere.
  function survival(m) {
    const x = Math.max(1, m);
    return (1 - HOUSE_EDGE) / (x + prizeAt(x));
  }

  /** u uniform in [0, 1) -> crash point on the cent grid, P(point >= m) = survival(m) */
  function crashPoint(u) {
    if (u >= survival(1)) return 1;
    if (u < survival(MAX_MULT)) return MAX_MULT;
    let lo = 0;
    let hi = Math.log(MAX_MULT);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (survival(Math.exp(mid)) > u) lo = mid;
      else hi = mid;
    }
    return Math.max(1, Math.floor(Math.exp(lo) * 100) / 100);
  }

  root.SLOT = {
    ROWS, REELS, WILD, WEIGHTS, PAYS, HP, BOUNTY, MAX_WIN, MAX_SPINS, COMBO, PRIZE, spinGrid, evaluate, play,
    HOUSE_EDGE, MAX_MULT, KOBAN_AT, kobanAt, kobanChance, prizeAt, survival, crashPoint,
  };
})(typeof window !== 'undefined' ? window : globalThis);
