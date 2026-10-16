'use strict';

/* =========================================================
   THE FOLLOWER — horror livestream crash POC
   The longer you film the thing in the dark, the higher the multiplier.
   CASH OUT = stop filming and run. CRASH = it comes for you.
   ========================================================= */

const AUDIO = '../assets/audio/';
const UI_DIR = '../assets/ui/';
const HOUSE_EDGE = 0.03;
const MAX_MULT = 1000;
const GROWTH_K = Math.LN2 / 5500;        // m = e^(k t): doubles every 5.5 s
const IDLE_RAMP = 6000;                  // ms for the standby audience to drift back in
const AUTO_NEXT = 1600;                  // ms between autoplay rounds
const START_BALANCE = 1000;
const AMOUNTS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const CHIPS = { bet: [1, 10, 20, 100], auto: [1.5, 2, 5, 10] };   // bet chips: one per tier boundary
const CLOSE_CALL = 1.25;                 // it attacked within 25% above your cash-out
const HISTORY_PILLS = 8;
const HISTORY_ROWS = 15;

/* phone + camera */
const SCREEN_AT = { x: 192, y: 455 };    // stage position of the phone screen; its size comes from hands.js
const SCREEN_BLEED = 3;                  // the stream canvas runs this far under the bezel
const CAM_AIM = [400, 600];              // screen-local point the camera holds the subject at
const CAM_ZOOM = 1.45;
const CAM_CREEP = 0.3;                   // the streamer edges closer as the multiplier climbs...
const CAM_CREEP_AT = 25;                 // ...+30% zoom by 25x
const TREMBLE = { base: 2.5, fear: 11, buzz: 1.6 };   // px: slow sway, fear-scaled sway, fast tremor
const CAM_PARALLAX = 1.7;                // the stream swings this much more than the phone moves
const IDENTITY_VIEW = { ax: 540, ay: 960, z: 1, cx: 540, cy: 960, rot: 0 };

/* fake-outs: rolled at round start from their own dice, so they say nothing about the crash point */
const FAKE_FIRST = [2600, 5200];
const FAKE_GAP = [3600, 7200];
const FAKE_GAP_SHRINK = 0.9;
const FAKE_GLITCH_ODDS = 0.25;           // a burst of static and a whisper instead of the creature moving
const GLITCH_GAP = [1800, 6000];         // ambient static, divided by (1 + ln m)
const AMBIENT_GAP = [5000, 11000];       // a creak or a whisper somewhere in the building

/* crash cinematic, ms after the crash */
const CRASH_T = { drop: 1250, dropMs: 650, charge: 1950, hold: 1300, fade: 450, back: 700 };
const CHARGE_COVER = 1.1;                // the lunge ends this much wider than the screen it fills
const CHARGE_EASE = 2.4;
const CHARGE_DOLLY = 0.18;               // the room pushes in behind it
const ESCAPE_T = { cut: 1700, reconnect: 1100 };   // ms: you ran (toast), the stream cuts, then standby
const TIER_T = { out: 460, in: 900, banner: 2200 };   // ms: the light dies, the new place lights up
const BLOOD = [
  { i: 0, x: 540, y: 900, s: 1250, r: 0 },
  { i: 4, x: 170, y: 420, s: 560, r: -20 },
  { i: 2, x: 910, y: 520, s: 520, r: 8 },
  { i: 3, x: 230, y: 1330, s: 560, r: -16 },
  { i: 1, x: 860, y: 1240, s: 680, r: 30 },
  { i: 5, x: 560, y: 1640, s: 480, r: 0 },
];

/* stream */
const CHAT_MAX = 13;
const chatGap = (m) => Math.max(75, 900 / m ** 0.8);
const superchatOdds = (m) => Math.min(0.3, 0.035 * m ** 0.7);
const viewerTarget = (base, m) => base * m ** 1.6;
const bpm = (m) => Math.min(172, 66 + 44 * Math.log(m));
const HEAT = [[1, [243, 230, 200]], [2, [255, 196, 107]], [5, [255, 106, 58]], [10, [255, 42, 26]]];

/* sound */
const ONESHOTS = ['heartbeat', 'static_s', 'static_m', 'static_l', 'sting', 'crack', 'creak', 'whisper', 'rise', 'shriek',
  'run', 'impact', 'phone_drop', 'splat', 'signal_lost', 'cashout', 'donate', 'click', 'bet'];
const BEDS = { drone: 'drone_loop.wav', tension: 'tension_loop.wav', breath: 'breath_loop.wav' };
const BED_VOL = { drone: 0.6, tension: 0.55, breath: 0.45 };
const HEART_VOL = [0.32, 0.9];           // at 1x / from 10x
const MUTE_KEY = 'follower.muted';

/* the streamer's voice: one line at a time, then quiet. He mostly just breathes. */
const VO_GAP = [6, 10];                  // s of quiet after a line before he talks again on his own
const VO_SKIP = 0.35;                    // a turn to talk is passed up this often, for another gap
const VO_STAGE = [1.8, 3];               // cocky below, uneasy below, scared from
const VO_ODDS = { start: 0.55, fake: 0.55, glitch: 0.3, donate: 0.2, ready: 0.35, escape: 0.85, close: 0.5 };
const VO_REACT_COOLDOWN = 9000;          // ms between two fake-out reactions
const VO_PRIO = { banter: 1, react: 2, event: 3, scream: 4 };
const VO_GAIN = 1;
const VO_DUCK = 0.55;                    // the room beds while he talks

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (t) => wait(Math.max(0, t - performance.now()));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) ** 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const floor2 = (x) => Math.floor(x * 100 + 1e-7) / 100;
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAmt = (n) => (Math.round(n * 10) === n * 10 ? n.toFixed(1) : n.toFixed(2));
const multText = (m) => `${m.toFixed(2)}x`;
const tween = (el, keyframes, opts) => el.animate(keyframes, { fill: 'forwards', ...opts }).finished;

function weighted(list) {
  let r = Math.random() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) if ((r -= x.weight) <= 0) return x;
  return list[list.length - 1];
}

/* ---------- content: the bet picks the tier (location + creature + how scary it plays) ---------- */
const HANDS = window.HANDS;
const CHAT = CONTENT.chat;
const VOICE = CONTENT.voice;
const TIERS = CONTENT.tiers;
const SCR = {
  x: SCREEN_AT.x - SCREEN_BLEED, y: SCREEN_AT.y - SCREEN_BLEED,
  w: HANDS.screen.w + SCREEN_BLEED * 2, h: HANDS.screen.h + SCREEN_BLEED * 2, r: HANDS.screen.r + SCREEN_BLEED,
};
const tier = { i: 0, want: 0, busy: false, loads: {} };
let LOC, CRE, CLIPS, FEAR, SPOT, VO_DECKS, POOLS;

/** shared lists + the ones a location / creature brings along */
function mergeLists(base, ...extra) {
  const out = {};
  for (const src of [base, ...extra]) {
    for (const [k, v] of Object.entries(src || {})) out[k] = [...(out[k] || []), ...v];
  }
  return out;
}

function tierFor(bet) {
  let i = 0;
  TIERS.forEach((t, k) => { if (bet >= t.minBet) i = k; });
  return i;
}

function useTier(i) {
  const t = TIERS[i];
  tier.i = i;
  LOC = CONTENT.locations[t.location];
  CRE = CONTENT.creatures[t.creature];
  CLIPS = window[CRE.clips];
  FEAR = t.fear;
  SPOT = [LOC.aim[0], LOC.floorY];   // where the creature crouches
  VO_DECKS = mergeLists(VOICE.decks, LOC.voice, CRE.voice);
  VO_DECKS.here = LOC.voice.open;   // the first round in a new place opens by naming it
  POOLS = mergeLists(CHAT.pools, LOC.chat, CRE.chat);
}
useTier(0);

/** multiplier thresholds come sooner in the scarier tiers */
const stageAt = (m) => 1 + (m - 1) * FEAR.stage;

/* ---------- crash math ---------- */
function randomUnit() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function generateCrashPoint() {
  const c = Math.floor((100 * (1 - HOUSE_EDGE)) / (1 - randomUnit())) / 100;
  return Math.min(MAX_MULT, Math.max(1, c));
}

/* ---------- cheat (open with ?dev): rig where it attacks ---------- */
const cheat = { at: null, keep: false };

function nextCrashPoint() {
  if (cheat.at === null) return generateCrashPoint();
  const at = cheat.at;
  if (!cheat.keep) cheat.at = null;
  renderCheat();
  return at;
}

function renderCheat() {
  $('#dev-status').textContent = cheat.at === null ? 'OFF: fair roll'
    : `${cheat.keep ? 'EVERY ROUND' : 'NEXT ROUND'}: attacks at ${multText(cheat.at)}`;
  $('#dev-keep').checked = cheat.keep;
}

function initCheat() {
  const set = (v) => {
    if (!(v >= 1)) return;
    cheat.at = Math.round(Math.min(MAX_MULT, v) * 100) / 100;
    renderCheat();
  };
  $('#dev-set').addEventListener('click', () => set(parseFloat($('#dev-at').value)));
  $('#dev-off').addEventListener('click', () => { cheat.at = null; renderCheat(); });
  $('#dev-keep').addEventListener('change', (e) => { cheat.keep = e.target.checked; renderCheat(); });
  for (const b of $$('#dev .presets button')) b.addEventListener('click', () => set(Number(b.dataset.at)));
  if (new URLSearchParams(location.search).has('dev')) $('#dev').hidden = false;
  renderCheat();
}

/* ---------- assets ---------- */
const images = { tiers: [] };            // per tier: { bg, frames: { clip: [img] } }
const art = () => images.tiers[tier.i];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(im));
    im.onerror = () => reject(new Error(src));
    im.src = src;
  });
}

function tierJobs(i) {
  const t = TIERS[i];
  const loc = CONTENT.locations[t.location];
  const cre = CONTENT.creatures[t.creature];
  const set = images.tiers[i] = { bg: null, frames: {} };
  const jobs = [[(im) => { set.bg = im; }, loc.bg]];
  if (loc.backdrop) jobs.push([() => {}, loc.backdrop]);
  for (const [name, clip] of Object.entries(window[cre.clips].clips)) {
    set.frames[name] = [];
    clip.frames.forEach((_, k) => jobs.push([(im) => { set.frames[name][k] = im; },
      `${cre.dir}${name}/${String(k).padStart(3, '0')}.webp`]));
  }
  return jobs;
}

async function runJobs(jobs, workers, onProgress = () => {}) {
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const [store, src] = jobs[next++];
      store(await loadImage(src));
      onProgress(++done / jobs.length);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
}

/** the higher tiers stream in behind the first one; switching waits for its tier if it isn't there yet */
function loadTier(i) {
  if (!tier.loads[i]) tier.loads[i] = runJobs(tierJobs(i), 4).catch((e) => { delete tier.loads[i]; throw e; });
  return tier.loads[i];
}

async function loadAll(onProgress) {
  const jobs = tierJobs(0);
  const extras = ['../assets/hands/hands.webp', '../assets/chat/avatars.webp', '../assets/chat/banknote.webp',
    '../assets/fx/logo.webp', '../assets/fx/drip.webp', ...BLOOD.map((b) => `../assets/fx/blood_${b.i}.webp`),
    ...['panel', 'bet', 'cashout', 'chip', 'tab_on', 'tab_off', 'pill', 'pill_hot', 'plate', 'frame', 'superchat', 'round']
      .map((n) => `${UI_DIR}${n}.webp`)];
  for (const src of extras) jobs.push([() => {}, src]);
  tier.loads[0] = runJobs(jobs, 10, onProgress);
  await tier.loads[0];
}

/* ---------- sound ---------- */
const sound = {
  ctx: null,
  master: null,
  bedBus: null,
  buffers: {},
  els: {},                               // file:// fallback: <audio> elements
  beds: {},
  muted: false,
  nextBeat: 0,
  nextAmbient: 0,

  init() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    $('#btn-sound').classList.toggle('muted', this.muted);
    $('#btn-sound').addEventListener('click', () => this.toggle());
    document.addEventListener('click', (e) => { if (e.target.closest('button')) this.play('click', 0.55); });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  },

  async start() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      this.ctx = new Ctx();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.bedBus = this.ctx.createGain();
      this.bedBus.connect(this.master);
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    const fetchOk = this.ctx && location.protocol !== 'file:';
    const allDecks = mergeLists(VOICE.decks, ...Object.values(CONTENT.locations).map((l) => l.voice),
      ...Object.values(CONTENT.creatures).map((c) => c.voice));
    const files = [...ONESHOTS.map((name) => [name, `${AUDIO}${name}.mp3`]),
      ...[...new Set(Object.values(allDecks).flat())].map((key) => [`vo:${key}`, `${VOICE.dir}${key}.mp3`])];
    for (const [name, url] of files) {
      if (fetchOk) this.load(url).then((b) => { this.buffers[name] = b; }).catch(() => this.fallback(name, url));
      else this.fallback(name, url);
    }
    for (const [name, file] of Object.entries(BEDS)) {
      if (fetchOk) {
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.bedBus);
        this.beds[name] = { gain, target: 0 };
        this.load(AUDIO + file).then((buf) => {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(gain);
          src.start(0, Math.random() * buf.duration);
        }).catch(() => {});
      } else {
        const el = new Audio(AUDIO + file);
        el.loop = true;
        el.volume = 0;
        el.play().catch(() => {});
        this.beds[name] = { el, target: 0 };
      }
    }
  },

  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  },

  fallback(name, url) {
    this.els[name] = new Audio(url);
  },

  /** one streamer line: the beds dip under it. Returns its length (s) and a way to cut it off. */
  voice(key, delay = 0) {
    const buf = this.buffers[`vo:${key}`];
    if (buf && this.ctx) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = VO_GAIN;
      src.connect(g);
      g.connect(this.master);
      const t = this.ctx.currentTime + delay;
      src.start(t);
      const duck = this.bedBus.gain;
      duck.cancelScheduledValues(this.ctx.currentTime);
      duck.setTargetAtTime(VO_DUCK, t, 0.06);
      duck.setTargetAtTime(1, t + buf.duration, 0.3);
      return {
        dur: buf.duration,
        stop: () => {
          const now = this.ctx.currentTime;
          g.gain.setTargetAtTime(0, now, 0.012);
          try { src.stop(now + 0.08); } catch { /* not started yet */ }
          duck.cancelScheduledValues(now);
          duck.setTargetAtTime(1, now, 0.2);
        },
      };
    }
    const el = this.els[`vo:${key}`];
    if (!el) return { dur: 0, stop() {} };
    const c = el.cloneNode();
    c.volume = this.muted ? 0 : clamp(VO_GAIN);
    const timer = setTimeout(() => c.play().catch(() => {}), delay * 1000);
    return { dur: el.duration || 0, stop: () => { clearTimeout(timer); c.pause(); } };
  },

  play(name, gain = 1, { delay = 0, rate = 1 } = {}) {
    if (this.muted) return;
    const buf = this.buffers[name];
    if (buf && this.ctx) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.master);
      src.start(this.ctx.currentTime + delay);
      return;
    }
    const el = this.els[name];
    if (!el) return;
    setTimeout(() => {
      const c = el.cloneNode();
      c.volume = clamp(gain);
      c.play().catch(() => {});
    }, delay * 1000);
  },

  bed(name, target, seconds = 0.4) {
    const bed = this.beds[name];
    if (!bed || Math.abs(bed.target - target) < 0.005) return;
    bed.target = target;
    if (bed.gain) bed.gain.gain.setTargetAtTime(target, this.ctx.currentTime, seconds / 3);
    else bed.el.volume = this.muted ? 0 : clamp(target);
  },

  /** the room goes quiet for a beat (before a fake-out lands) */
  hush(ms) {
    const bed = this.beds.drone;
    if (!bed || !bed.gain) return;
    const t = this.ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setTargetAtTime(bed.target * 0.2, t, 0.05);
    bed.gain.gain.setTargetAtTime(bed.target, t + ms / 1000, 0.25);
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* private mode */ }
    $('#btn-sound').classList.toggle('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    for (const bed of Object.values(this.beds)) if (bed.el) bed.el.volume = this.muted ? 0 : clamp(bed.target);
  },

  /** beds and heartbeat follow the round */
  update(now) {
    const m = game.m;
    const heat = clamp(Math.log(m) / Math.log(10));
    const running = game.phase === 'running' && !game.crashing;
    this.bed('drone', game.phase === 'boot' ? 0 : BED_VOL.drone);
    this.bed('tension', running ? BED_VOL.tension * clamp((m - 1.15) / 4) : 0, running ? 0.6 : 0.25);
    this.bed('breath', running ? BED_VOL.breath * clamp((m - stageAt(2.2)) / 6) : game.crashing === 'full' ? 0.5 : 0);

    let beat = 0;
    let vol = 0;
    if (running) {
      beat = bpm(m) + FEAR.heart + phone.spike * 18;
      vol = lerp(HEART_VOL[0], HEART_VOL[1], heat);
    } else if (game.phase === 'idle') {
      beat = 58 + FEAR.heart * 0.75;
      vol = 0.16 + 0.006 * FEAR.heart;
    }
    if (beat && now >= this.nextBeat) {
      this.play('heartbeat', vol);
      vignette.beat = 0.35 + 0.65 * heat;
      if (running) $('#mult-value').animate([{ transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 160 });
      this.nextBeat = now + 60000 / beat;
    }
    if (running && now >= this.nextAmbient) {
      if (this.nextAmbient) this.play(pick(['creak', 'whisper', 'creak']), rand(0.18, 0.38));
      this.nextAmbient = now + rand(...AMBIENT_GAP);
    }
  },
};

/* ---------- creature flipbook ---------- */
const anim = { clip: CRE.idle, t0: 0, from: 0, rate: 1, then: CRE.idle, frame: 0, resolve: null };

/** play a clip; resolves when it ends. then: clip to continue with, or null to hold the last frame */
function playClip(clip, { from = 0, rate = 1, then = CRE.idle } = {}) {
  if (anim.resolve) anim.resolve();
  Object.assign(anim, { clip, t0: performance.now(), from, rate, then, frame: from, resolve: null });
  return new Promise((r) => { anim.resolve = r; });
}

function clipMs(clip, from = 0, rate = 1) {
  const c = CLIPS.clips[clip];
  return ((c.frames.length - 1 - from) / (c.fps * rate)) * 1000;
}

function updateAnim(now) {
  const c = CLIPS.clips[anim.clip];
  const n = c.frames.length;
  // rAF timestamps can trail the performance.now() a clip was started with
  const f = anim.from + (Math.max(0, now - anim.t0) / 1000) * c.fps * anim.rate;
  if (c.loop) {
    anim.frame = Math.floor(f) % n;
    return;
  }
  if (f < n - 1) {
    anim.frame = Math.floor(f);
    return;
  }
  anim.frame = n - 1;
  const done = anim.resolve;
  anim.resolve = null;
  if (anim.then) Object.assign(anim, { clip: anim.then, t0: now, from: 0, rate: 1, then: CRE.idle, frame: 0 });
  if (done) done();
}

/** 0..1 through the charge, by frame, so the push-in stays locked to the run */
function chargeProgress() {
  if (anim.clip !== CRE.charge.clip) return 0;
  const n = CLIPS.clips[anim.clip].frames.length;
  return clamp((anim.frame - CRE.charge.from) / (n - 1 - CRE.charge.from));
}

/* ---------- rendering: the room (world) and the stream (cam) ---------- */
const worldCv = $('#world');
const worldCtx = worldCv.getContext('2d');
const camCv = $('#cam');
const camCtx = camCv.getContext('2d');
const tintCv = document.createElement('canvas');
tintCv.width = 1240;
tintCv.height = 2200;
const tintCtx = tintCv.getContext('2d');
const noiseCvs = [];

const cine = { worldLive: false, worldMix: 0, dolly: 0, shake: 0, cover: null, noSignal: false };
const glitch = { power: 0, until: 0, roll: 0 };
const vignette = { beat: 0 };
let worldDirty = true;
let camZoom = CAM_ZOOM;

function makeNoise() {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas');
    c.width = 232;
    c.height = 496;
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    noiseCvs.push(c);
  }
}

function camView() {
  return {
    ax: LOC.aim[0], ay: LOC.aim[1], z: camZoom,
    cx: CAM_AIM[0] + SCREEN_BLEED - phone.dx * CAM_PARALLAX,
    cy: CAM_AIM[1] + SCREEN_BLEED - phone.dy * CAM_PARALLAX,
    rot: (-phone.rot * Math.PI) / 180,
  };
}

/** the stream's framing in stage px: where the room has to sit for the cut from screen to reality */
function stageCamView() {
  return { ax: LOC.aim[0], ay: LOC.aim[1], z: camZoom, cx: SCREEN_AT.x + CAM_AIM[0], cy: SCREEN_AT.y + CAM_AIM[1], rot: 0 };
}

function lerpView(a, b, t) {
  return { ax: lerp(a.ax, b.ax, t), ay: lerp(a.ay, b.ay, t), z: lerp(a.z, b.z, t), cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), rot: lerp(a.rot, b.rot, t) };
}

function drawTinted(ctx, img, x, y, w, h, strength) {
  const iw = Math.ceil(w);
  const ih = Math.ceil(h);
  if (strength <= 0 || iw > tintCv.width || ih > tintCv.height) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  tintCtx.globalCompositeOperation = 'source-over';
  tintCtx.clearRect(0, 0, iw + 2, ih + 2);
  tintCtx.drawImage(img, 0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-atop';
  tintCtx.globalAlpha = strength;
  const g = tintCtx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, LOC.creatureTint[0]);
  g.addColorStop(1, LOC.creatureTint[1]);
  tintCtx.fillStyle = g;
  tintCtx.fillRect(0, 0, iw, ih);
  tintCtx.globalAlpha = 1;
  ctx.drawImage(tintCv, 0, 0, iw, ih, x, y, iw, ih);
}

/**
 * bg + creature through a view. cover: canvas rect the charge ends on (it grows from the creature's
 * own spot to that rect as the run comes at the lens).
 */
function drawScene(ctx, view, W, H, cover, light = 0) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(view.cx, view.cy);
  ctx.rotate(view.rot);
  ctx.translate(-view.cx, -view.cy);
  const z = view.z;
  const wx = (x) => (x - view.ax) * z + view.cx;
  const wy = (y) => (y - view.ay) * z + view.cy;
  const set = art();
  ctx.drawImage(set.bg, wx(0), wy(0), 1080 * z, 1920 * z);

  const s = CRE.scale;
  const p = cover ? chargeProgress() : 0;
  let R = { x: wx(SPOT[0] - 540 * s), y: wy(SPOT[1] - CRE.floorSrc * s), w: 1080 * s * z, h: CLIPS.frameH * s * z };
  if (p > 0) {
    const e = p ** CHARGE_EASE;
    R = { x: lerp(R.x, cover.x, e), y: lerp(R.y, cover.y, e), w: lerp(R.w, cover.w, e), h: lerp(R.h, cover.h, e) };
  }
  if (p < 0.3) {
    ctx.globalAlpha = LOC.shadow * (1 - p / 0.3);
    const sx = wx(SPOT[0]);
    const sy = wy(SPOT[1]);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 170 * z);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.18);
    ctx.translate(-sx, -sy);
    ctx.fillRect(sx - 170 * z, sy - 170 * z, 340 * z, 340 * z);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const img = set.frames[anim.clip][anim.frame];
  const [fx, fy, fw, fh] = CLIPS.clips[anim.clip].frames[anim.frame] || [0, 0, 0, 0];
  const kx = R.w / CLIPS.frameW;
  const ky = R.h / CLIPS.frameH;
  if (img && fw) drawTinted(ctx, img, R.x + fx * kx, R.y + fy * ky, fw * kx, fh * ky, (1 - light) * (1 - 0.6 * p));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (ctx === camCtx && ambient.a > 0.004) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = ambient.a;
    ctx.fillStyle = ambient.css;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** the location's own light (moonlight through the trees, the ward's emergency lamp) breathing over the room */
const ambient = { a: 0, css: '#000' };
function updateAmbient(now) {
  const L = LOC.light;
  ambient.css = `rgb(${L.color.join(',')})`;
  const wave = 0.5 + 0.5 * Math.sin((now / 1000 / L.period) * Math.PI * 2);
  ambient.a = L.amt * (0.25 + 0.75 * wave ** 3);
  $('#ambient').style.opacity = (ambient.a * 2.2).toFixed(3);
}

function glitchBurst(power, ms) {
  const now = performance.now();
  glitch.power = Math.max(glitch.power * (now < glitch.until ? 1 : 0), power);
  glitch.until = Math.max(glitch.until, now + ms);
}

function drawGlitch(ctx, W, H, now) {
  let g = now < glitch.until ? glitch.power * (0.6 + 0.4 * Math.random()) : 0;
  if (cine.noSignal) g = 1;
  ctx.imageSmoothingEnabled = false;
  if (g > 0.03) {
    const strips = 3 + Math.floor(g * 10);
    for (let i = 0; i < strips; i++) {
      const y = Math.random() * H;
      const h = rand(6, 26 + 70 * g);
      const dx = (Math.random() * 2 - 1) * 70 * g;
      ctx.drawImage(camCv, 0, y, W, h, dx, y, W, h);
    }
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 2 + g * 4; i++) {
      ctx.fillStyle = pick(['rgba(255,0,80,0.22)', 'rgba(0,220,255,0.2)', 'rgba(255,255,255,0.12)']);
      ctx.fillRect(0, Math.random() * H, W, rand(3, 18));
    }
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < g * 0.12) {
      ctx.fillStyle = `rgba(0,0,0,${rand(0.4, 0.85)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  ctx.globalAlpha = 0.07 + 0.55 * g;
  const n = noiseCvs[Math.floor(Math.random() * noiseCvs.length)];
  ctx.drawImage(n, rand(-40, 0), rand(-40, 0), W + 40, H + 40);
  ctx.globalAlpha = 1;
  // slow rolling band like a bad sensor
  glitch.roll = (glitch.roll + 2.4) % (H + 200);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, glitch.roll - 200, W, 120);
  ctx.imageSmoothingEnabled = true;
}

function render(now) {
  updateAnim(now);
  updateAmbient(now);
  const camCover = cine.cover === 'cam' || cine.cover === 'world'
    ? { x: (SCR.w - SCR.w * CHARGE_COVER) / 2, y: (SCR.h - SCR.w * CHARGE_COVER * (CLIPS.frameH / CLIPS.frameW)) / 2,
      w: SCR.w * CHARGE_COVER, h: SCR.w * CHARGE_COVER * (CLIPS.frameH / CLIPS.frameW) } : null;
  if (phone.drop < 1) {
    drawScene(camCtx, camView(), SCR.w, SCR.h, camCover, now < glitch.until ? glitch.power * 0.4 : 0);
    drawGlitch(camCtx, SCR.w, SCR.h, now);
  }
  if (cine.worldLive || worldDirty) {
    const v = lerpView(IDENTITY_VIEW, stageCamView(), cine.worldMix);
    v.z *= 1 + cine.dolly;
    const w = 1080 * CHARGE_COVER;
    const h = w * (CLIPS.frameH / CLIPS.frameW);
    drawScene(worldCtx, v, 1080, 1920, cine.cover === 'world' ? { x: (1080 - w) / 2, y: (1920 - h) / 2 - 40, w, h } : null);
    worldDirty = false;
  }
  const sx = cine.shake ? rand(-1, 1) * cine.shake : 0;
  const sy = cine.shake ? rand(-1, 1) * cine.shake : 0;
  $('#scene').style.transform = cine.shake > 0.5 ? `translate(${sx}px, ${sy}px) scale(1.04)` : '';
  $('#vignette').style.setProperty('--beat', vignette.beat.toFixed(3));
}

/* ---------- the phone in your hands ---------- */
const phone = { dx: 0, dy: 0, rot: 0, spike: 0, drop: 0 };

function fearLevel() {
  if (game.crashing === 'full') return 1.3;
  if (game.phase !== 'running' || game.crashing) return 0.08 * FEAR.tremble;
  return (0.12 + 0.45 * clamp(Math.log(game.m) / Math.log(10))) * FEAR.tremble;
}

function updatePhone(now, dt) {
  const t = now / 1000;
  const TAU = Math.PI * 2;
  phone.spike *= Math.exp(-dt / 900);
  const F = clamp(fearLevel() + phone.spike, 0, 1.7);
  const A = TREMBLE.base + TREMBLE.fear * F;
  const x = A * (0.55 * Math.sin(TAU * 0.43 * t) + 0.3 * Math.sin(TAU * 1.13 * t + 1.7) + 0.2 * Math.sin(TAU * 2.7 * t + 0.4));
  const y = A * (0.5 * Math.sin(TAU * 0.37 * t + 2.1) + 0.3 * Math.sin(TAU * 1.41 * t + 0.6) + 0.2 * Math.sin(TAU * 3.1 * t + 2.9))
    + 4 * Math.sin(TAU * 0.24 * t);
  const buzz = TREMBLE.buzz * (0.3 + F) * (Math.sin(TAU * 9.7 * t) + Math.sin(TAU * 12.3 * t + 1)) * 0.5;
  phone.dx = x + buzz;
  phone.dy = y + buzz * 0.7;
  phone.rot = A * 0.07 * (Math.sin(TAU * 0.31 * t + 0.8) + 0.4 * Math.sin(TAU * 1.7 * t));
  const d = easeIn(phone.drop);
  $('#phone').style.transform = `translate(${phone.dx + d * 120}px, ${phone.dy + d * 1650}px) rotate(${phone.rot + d * 16}deg)`;
}

/* ---------- the stream: chat, donations, viewers ---------- */
const chat = { next: 0, stop: false, list: $('#chat-list') };
const stream = { base: 1000, shown: 0, recBase: 0, nextHud: 0 };

function chatPool() {
  if (game.phase !== 'running') return 'standby';
  const m = game.m;
  if (m < stageAt(1.6)) return 'calm';
  if (m < stageAt(4)) return Math.random() < 0.7 ? 'scared' : 'calm';
  return Math.random() < 0.7 ? 'panic' : 'scared';
}

function addChat(text, superchat = false) {
  const el = document.createElement('div');
  el.className = superchat ? 'msg sc' : 'msg';
  const av = Math.floor(Math.random() * 16);
  const avatar = `<i class="av" style="background-position:${(av % 4) * 33.333}% ${Math.floor(av / 4) * 33.333}%"></i>`;
  const name = `<b class="nm" style="color:${pick(CHAT.colors)}">${pick(CHAT.names)}</b>`;
  if (superchat) {
    const notes = 1 + Math.floor(Math.random() * Math.random() * 3.2);
    el.innerHTML = `<div class="bub np np-superchat">${name}<span class="tx">${text}</span></div>`
      + `<div class="notes">${'<i class="note"></i>'.repeat(notes)}</div>`;
    el.insertAdjacentHTML('afterbegin', avatar);
  } else {
    el.innerHTML = `${avatar}<div class="bub">${name}<span class="tx">${text}</span></div>`;
  }
  chat.list.append(el);
  const h = el.offsetHeight + 10;
  const ms = clamp(chatGap(game.m) * 0.55, 70, 220);
  chat.list.animate([{ transform: `translateY(${h}px)` }, { transform: 'translateY(0)' }], { duration: ms, easing: 'ease-out' });
  while (chat.list.children.length > CHAT_MAX) chat.list.firstElementChild.remove();
  if (superchat) {
    sound.play('donate', 0.55);
    voDonate();
    stream.shown *= 1.01;
    const box = el.querySelector('.notes');
    for (let i = 0; i < 5; i++) {
      const f = document.createElement('i');
      f.className = 'fly';
      box.append(f);
      const dx = rand(-60, 70);
      const rot = rand(-200, 200);
      f.animate([
        { transform: 'translate(10px, 14px) rotate(0) scale(0.6)', opacity: 1 },
        { transform: `translate(${dx}px, ${rand(-170, -110)}px) rotate(${rot}deg) scale(1)`, opacity: 0 },
      ], { duration: rand(900, 1400), delay: i * 90, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' })
        .finished.then(() => f.remove());
    }
  }
}

function chatBurst(pool, n, gap = 120) {
  const lines = POOLS[pool] || POOLS.face;
  for (let i = 0; i < n; i++) setTimeout(() => { if (!chat.stop) addChat(pick(lines)); }, i * gap * rand(0.7, 1.3));
}

function clearChat() {
  chat.list.getAnimations().forEach((a) => a.cancel());
  chat.list.replaceChildren();
}

function updateChat(now) {
  if (chat.stop || game.phase === 'boot' || now < chat.next) return;
  const running = game.phase === 'running';
  const m = game.m;
  if (running && Math.random() < superchatOdds(m)) addChat(pick(CHAT.superchat), true);
  else addChat(pick(POOLS[chatPool()]));
  chat.next = now + (running ? chatGap(m) : 1100) * rand(0.6, 1.4);
}

function fmtViewers(v) {
  if (v < 10000) return Math.round(v).toLocaleString('en-US');
  if (v < 1e6) return `${(v / 1000).toFixed(1)}K`;
  return `${(v / 1e6).toFixed(2)}M`;
}

function fmtClock(s) {
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return [h, mm, ss].map((x) => String(x).padStart(2, '0')).join(':');
}

function updateStream(now, dt) {
  let target;
  if (game.phase === 'running') target = viewerTarget(stream.base, game.m);
  else if (game.phase === 'idle') target = stream.base * (0.4 + 0.25 * clamp((now - game.phaseAt) / IDLE_RAMP));
  else target = stream.shown;
  stream.shown += (target - stream.shown) * (1 - Math.exp(-dt / 450));
  if (now < stream.nextHud) return;
  stream.nextHud = now + 140;
  $('#viewers').textContent = fmtViewers(stream.shown * (1 + rand(-0.004, 0.004)));
  if (game.phase === 'running') $('#rec-time').textContent = fmtClock(stream.recBase + (now - game.round.start) / 1000);
}

function setLive(state) {
  const badge = $('#live-badge');
  badge.className = state === 'live' ? '' : state;
  badge.textContent = state === 'live' ? 'LIVE' : state === 'standby' ? 'STANDBY' : 'OFFLINE';
  $('.rec').classList.toggle('idle', state !== 'live');
}

function screenMsg(main, sub = '', cls = '') {
  const el = $('#screen-msg');
  if (!main) {
    el.className = '';
    return;
  }
  el.className = `on ${cls}`;
  el.innerHTML = `<b>${main}</b>${sub ? `<span>${sub}</span>` : ''}`;
}

/* ---------- the streamer, talking to himself and to chat ---------- */
const vo = { cur: null, prio: 0, end: 0, gap: 0, hush: 0, first: true, fresh: false, lastReact: -Infinity, readySaid: false, thanked: false, decks: {} };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** shuffled decks: no line repeats until its deck has played through, never twice in a row across a reshuffle */
function deal(deck) {
  let d = vo.decks[deck];
  if (!d || !d.cards.length) {
    const cards = shuffle([...VO_DECKS[deck]]);
    const last = d ? d.last : null;
    if (cards.length > 1 && cards[cards.length - 1] === last) cards.unshift(cards.pop());
    d = vo.decks[deck] = { cards, last };
  }
  return (d.last = d.cards.pop());
}

const voBusy = (now, gapS = 0) => now < vo.end + gapS * 1000;

/** a line from the deck; a higher priority cuts off whatever he was saying */
function say(deck, prio, delay = 0) {
  const now = performance.now();
  if (voBusy(now) && prio <= vo.prio) return false;
  stopVoice();
  const line = sound.voice(deal(deck), delay);
  Object.assign(vo, { cur: line, prio, end: now + (delay + (line.dur || 2.5)) * 1000, gap: rand(...VO_GAP) });
  return true;
}

function stopVoice() {
  if (vo.cur) vo.cur.stop();
  Object.assign(vo, { cur: null, prio: 0, end: 0 });
}

/** while filming: a line now and then for how deep into the round we are; after you ran, he's gone quiet */
function chatter(now) {
  if (game.crashing || player.cashedAt !== null) return;
  if (now - game.round.start < 600) return;
  // first round in a new place: he names it straight away, without waiting out his usual pause
  if (vo.first && vo.fresh && !voBusy(now)) {
    vo.first = vo.fresh = false;
    say('here', VO_PRIO.banter);
    return;
  }
  if (now < vo.hush || voBusy(now, vo.gap)) return;
  const first = vo.first;
  vo.first = false;
  if (Math.random() > (first ? VO_ODDS.start : 1 - VO_SKIP)) {
    vo.hush = now + rand(...VO_GAP) * 1000;
    return;
  }
  const m = game.m;
  const deck = first ? (Math.random() < 0.4 ? 'open' : 'early') : m < stageAt(VO_STAGE[0]) ? 'early' : m < stageAt(VO_STAGE[1]) ? 'mid' : 'late';
  say(deck, VO_PRIO.banter);
}

/** a fake-out lands: sometimes he flinches out loud, cutting himself off */
function voReact(kind) {
  const now = performance.now();
  if (player.cashedAt !== null || now - vo.lastReact < VO_REACT_COOLDOWN) return;
  if (Math.random() > (kind === 'glitch' ? VO_ODDS.glitch : VO_ODDS.fake)) return;
  const own = VO_DECKS[`fake_${kind}`] ? `fake_${kind}` : 'fake_any';
  if (say(Math.random() < 0.65 ? own : 'fake_any', VO_PRIO.react, 0.25)) vo.lastReact = now;
}

function voDonate() {
  if (game.phase !== 'running' || game.crashing || player.cashedAt !== null || vo.thanked) return;
  if (voBusy(performance.now(), vo.gap * 0.6) || Math.random() > VO_ODDS.donate) return;
  vo.thanked = say('donate', VO_PRIO.banter, 0.4);
}

/* ---------- player + betting panel ---------- */
const ui = { tab: 'bet', amountIdx: AMOUNTS.indexOf(10), autoTarget: 2 };
const player = { balance: START_BALANCE, active: null, cashedAt: null, autoOn: false };
const history = [];

function amount() { return AMOUNTS[ui.amountIdx]; }

function canCashOut() {
  return game.phase === 'running' && !game.crashing && player.active !== null && player.cashedAt === null;
}

function stepAuto(v, dir) {
  const step = v < 2 ? 0.1 : v < 5 ? 0.25 : v < 10 ? 0.5 : v < 50 ? 1 : 5;
  return clamp(Math.round((v + dir * step) * 100) / 100, 1.01, MAX_MULT);
}

function renderPanel() {
  const auto = ui.tab === 'auto';
  for (const t of $$('.tab')) {
    const sel = t.dataset.tab === ui.tab;
    t.classList.toggle('sel', sel);
    t.classList.toggle('np-tab_on', sel);
    t.classList.toggle('np-tab_off', !sel);
  }
  const amt = $('#amount');
  amt.textContent = auto ? `AUTO ${multText(ui.autoTarget)}` : `FUN ${fmtAmt(amount())}`;
  amt.classList.toggle('long', amt.textContent.length > 10);
  $$('.chip').forEach((c, i) => {
    const v = CHIPS[ui.tab][i];
    const lv = tierFor(v);
    c.innerHTML = auto ? `${v}x` : `${fmtAmt(v).replace(/\.0$/, '')}${lv ? `<i class="lv lv${lv + 1}">LV${lv + 1}</i>` : ''}`;
    c.classList.toggle('sel', auto ? v === ui.autoTarget : v === amount());
  });
  $('#amount').dataset.lv = tierFor(amount()) + 1;
  const locked = player.autoOn || game.phase !== 'idle';
  $('.left').classList.toggle('locked', locked);
  $('#balance-value').textContent = fmt(player.balance);
  renderBetButton();
}

function renderBetButton() {
  const btn = $('#bet');
  let main;
  let sub;
  let cash = false;
  let waiting = false;
  if (canCashOut()) {
    cash = true;
    main = 'CASH OUT';
    sub = `FUN ${fmt(floor2(player.active * game.m))}`;
  } else if (player.autoOn) {
    main = 'STOP';
    sub = `AUTO ${multText(ui.autoTarget)}`;
  } else if (ui.tab === 'auto') {
    main = 'AUTO BET';
    sub = `FUN ${fmtAmt(amount())} · ${multText(ui.autoTarget)}`;
    waiting = game.phase !== 'idle' || tier.busy;
  } else {
    main = 'BET';
    sub = `FUN ${fmtAmt(amount())}`;
    waiting = game.phase !== 'idle' || tier.busy;
  }
  btn.classList.toggle('np-cashout', cash);
  btn.classList.toggle('np-bet', !cash);
  btn.classList.toggle('pulse', cash);
  btn.classList.toggle('waiting', waiting);
  btn.classList.toggle('long', main.length > 5 && !cash);
  if ($('#bet-main').textContent !== main) $('#bet-main').textContent = main;
  if ($('#bet-sub').textContent !== sub) $('#bet-sub').textContent = sub;
}

/** single player: a round only starts when you pay for it */
function placeBet(now) {
  const a = amount();
  if (player.balance < a) {
    $('#balance').animate([{ color: '#ff5a40' }, { color: '' }], { duration: 700 });
    return false;
  }
  player.balance = floor2(player.balance - a);
  player.active = a;
  sound.play('bet', 0.8);
  startRound(now);
  return true;
}

function onBetButton() {
  if (canCashOut()) {
    cashOut(game.m);
    return;
  }
  if (game.phase === 'boot' || tier.busy) return;
  if (player.autoOn) player.autoOn = false;
  else if (ui.tab === 'auto') player.autoOn = game.phase !== 'idle' || placeBet(performance.now());
  else if (game.phase === 'idle') placeBet(performance.now());
  renderPanel();
}

function setAmount(idx) {
  ui.amountIdx = clamp(idx, 0, AMOUNTS.length - 1);
  renderPanel();
  tier.want = tierFor(amount());
  if (game.phase === 'idle' && !tier.busy && tier.want !== tier.i) switchTier();
}

function initPanel() {
  for (const t of $$('.tab')) t.addEventListener('click', () => { ui.tab = t.dataset.tab; renderPanel(); });
  $('#minus').addEventListener('click', () => {
    if (ui.tab !== 'auto') return setAmount(ui.amountIdx - 1);
    ui.autoTarget = stepAuto(ui.autoTarget, -1);
    renderPanel();
  });
  $('#plus').addEventListener('click', () => {
    if (ui.tab !== 'auto') return setAmount(ui.amountIdx + 1);
    ui.autoTarget = stepAuto(ui.autoTarget, 1);
    renderPanel();
  });
  $$('.chip').forEach((c, i) => c.addEventListener('click', () => {
    const v = CHIPS[ui.tab][i];
    if (ui.tab !== 'auto') return setAmount(AMOUNTS.indexOf(v));
    ui.autoTarget = v;
    renderPanel();
  }));
  $('#bet').addEventListener('click', onBetButton);
  $('#history-tab').addEventListener('click', () => $('#history-drawer').classList.toggle('open'));
  $('#history-drawer').addEventListener('click', () => $('#history-drawer').classList.remove('open'));
}

function heatClass(m) { return m >= 10 ? 'hot' : m >= 2 ? 'mid' : ''; }

function renderHistory(fresh) {
  const row = $('#history-row');
  row.replaceChildren(...history.slice(0, HISTORY_PILLS).map((h, i) => {
    const el = document.createElement('span');
    const hc = heatClass(h.crash);
    el.className = `pill np ${hc === 'hot' ? 'np-pill_hot' : 'np-pill'} ${hc}${fresh && i === 0 ? ' new' : ''}`;
    el.textContent = multText(h.crash);
    return el;
  }));
  // pills are as wide as their number: drop the ones that would be cut off at the edge
  for (const el of [...row.children]) if (el.offsetLeft + el.offsetWidth > row.clientWidth) el.remove();
  $('#history-list').replaceChildren(...history.slice(0, HISTORY_ROWS).map((h) => {
    const li = document.createElement('li');
    let you = '—';
    let cls = '';
    if (h.bet !== null) {
      if (h.cashedAt !== null) { you = `${multText(h.cashedAt)}  +${fmt(h.payout)}`; cls = 'win'; }
      else { you = `−${fmtAmt(h.bet)}`; cls = 'lose'; }
    }
    li.innerHTML = `<span class="r">#${h.id}</span><span class="c ${heatClass(h.crash)}">${multText(h.crash)}</span><span class="y ${cls}">${you}</span>`;
    return li;
  }));
}

/* ---------- header: multiplier + plate ---------- */
let plateCache = '';

function setPlate(text, cls = '') {
  const key = text + cls;
  if (key === plateCache) return;
  plateCache = key;
  $('#plate-text').textContent = text;
  $('#plate').className = `np np-plate ${cls}`;
}

function heatColor(m) {
  for (let i = HEAT.length - 1; i >= 0; i--) {
    if (m >= HEAT[i][0]) {
      const [m0, c0] = HEAT[i];
      const nxt = HEAT[i + 1];
      if (!nxt) return c0;
      const t = clamp(Math.log(m / m0) / Math.log(nxt[0] / m0));
      return c0.map((v, k) => Math.round(lerp(v, nxt[1][k], t)));
    }
  }
  return HEAT[0][1];
}

/* the display face has proportional digits: each character gets its own fixed cell so the number doesn't wobble */
let multShown = '';
function renderMult() {
  const m = game.m;
  const el = $('#mult');
  const text = multText(m);
  if (text !== multShown) {
    multShown = text;
    $('#mult-value').innerHTML = [...text].map((c) => (c === '.' ? '<i class="pt">.</i>' : c === 'x' ? '<i class="x">x</i>' : `<i>${c}</i>`)).join('');
  }
  if (game.phase === 'running' && !game.crashing) {
    const [r, g, b] = heatColor(m);
    el.style.setProperty('--heat', `rgb(${r},${g},${b})`);
    el.style.setProperty('--glow', `rgba(255,${Math.round(lerp(120, 20, clamp(Math.log(m) / Math.log(10))))},20,${(0.25 + 0.5 * clamp(Math.log(m) / Math.log(10))).toFixed(2)})`);
  }
}

/* ---------- rounds ---------- */
const game = { phase: 'boot', phaseAt: 0, m: 1, round: null, id: 4120, crashing: null };

/** between rounds: the stream sits on standby until the player bets (autoplay bets by itself) */
function startIdle(now) {
  game.phase = 'idle';
  game.phaseAt = now;
  game.m = 1;
  game.crashing = null;
  player.active = null;
  player.cashedAt = null;
  $('#mult').className = 'dim';
  $('#saved').classList.remove('on');
  setLive('standby');
  $('#rec-time').textContent = '00:00:00';
  stream.base = rand(900, 1700);
  stream.recBase = rand(240, 1400);
  vo.readySaid = false;
  renderPanel();
}

function scheduleFakes() {
  const out = [];
  let t = rand(...FAKE_FIRST) * FEAR.fakeGap;
  let gap = rand(...FAKE_GAP) * FEAR.fakeGap;
  while (t < 120000) {
    out.push({ t, kind: Math.random() < FAKE_GLITCH_ODDS ? 'glitch' : 'creature' });
    t += gap;
    gap = Math.max(2200, gap * FAKE_GAP_SHRINK * rand(0.85, 1.15));
  }
  return out;
}

function startRound(now) {
  game.phase = 'running';
  game.phaseAt = now;
  game.round = { id: ++game.id, crash: nextCrashPoint(), start: now, t: 0, fakes: scheduleFakes(), nextGlitch: now + rand(...GLITCH_GAP) * FEAR.glitchGap };
  game.m = 1;
  player.cashedAt = null;
  $('#mult').className = '';
  setLive('live');
  screenMsg(null);
  glitchBurst(0.5, 220);
  sound.play('static_s', 0.6);
  sound.nextAmbient = 0;
  Object.assign(vo, { first: true, hush: 0, thanked: false });
  renderPanel();
}

/** single player: cashing out ends the round there and then — he stops filming and runs */
function cashOut(at) {
  if (!canCashOut()) return;
  const m = floor2(at);
  const payout = floor2(player.active * m);
  const r = game.round;
  player.cashedAt = m;
  player.balance = floor2(player.balance + payout);
  r.payout = payout;
  game.m = m;
  endRound(r, 'safe');
  escape(r, m, payout).then(() => startIdle(performance.now()));
}

function endRound(r, how) {
  game.crashing = how;
  history.unshift({ id: r.id, crash: r.crash, bet: player.active, cashedAt: player.cashedAt, payout: r.payout || 0 });
  if (history.length > 50) history.pop();
  renderHistory(true);
  renderPanel();
}

async function escape(r, m, payout) {
  const close = r.crash / m <= CLOSE_CALL;
  sound.play('cashout', 0.9);
  if (close) {
    sound.play('sting', 0.6, { delay: 0.45 });
    say('close', VO_PRIO.event, 0.35);
  } else if (Math.random() < VO_ODDS.escape) say('escape', VO_PRIO.event, 0.2);
  $('#mult').className = 'escaped';
  setPlate(`ESCAPED · ${multText(m)}`, 'escaped');
  $('#saved').classList.add('on');
  chatBurst('escaped', 4, 160);
  showToast('ESCAPED', `+FUN ${fmt(payout)}`, close, ESCAPE_T.cut);
  $('#flash').animate([{ opacity: 0.35, background: '#ffd58a' }, { opacity: 0 }], { duration: 500 });
  // he turns away and runs: the picture swings off the thing, then the stream cuts
  phone.spike += 0.8;
  cine.shake = 9;
  glitchBurst(0.45, 300);
  await wait(ESCAPE_T.cut);
  glitchBurst(1, 420);
  sound.play('static_m', 0.6);
  chat.stop = true;
  chat.list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
  setLive('off');
  screenMsg('配信終了', 'おつかれさまでした');
  await wait(ESCAPE_T.reconnect);
  camZoom = CAM_ZOOM;
  playClip(CRE.idle);
  clearChat();
  chat.stop = false;
  screenMsg(null);
  glitchBurst(0.6, 300);
}

function doFake(kind) {
  if (kind === 'glitch') {
    glitchBurst(0.75, 420);
    sound.play('static_m', 0.65);
    sound.play('whisper', 0.55, { delay: 0.15 });
    chatBurst('glitch', 3);
    phone.spike += 0.5;
    voReact('glitch');
    return;
  }
  const t = weighted(CRE.tense);
  const ms = clipMs(t.clip);
  sound.hush(ms * 0.35);
  playClip(t.clip);
  t.sfx.forEach((s, i) => sound.play(s, 0.9, { delay: (t.sfxAt[i] * ms) / 1000 }));
  setTimeout(() => {
    if (game.crashing) return;
    glitchBurst(0.5, 260);
    phone.spike += 0.9;
    sound.nextBeat = performance.now() + 110;   // the heart skips
    chatBurst(t.line, 4, 140);
    voReact(t.line);
    stream.shown *= 1.06;
    $('#mult-value').animate([
      { transform: 'translate(0,0)', color: '#ff2a1a' }, { transform: 'translate(-8px,3px)' },
      { transform: 'translate(7px,-2px)' }, { transform: 'translate(0,0)', color: '' },
    ], { duration: 360 });
  }, ms * 0.28);
}

function update(now, dt) {
  runTweens(now);
  if (game.phase === 'idle') {
    const idle = now - game.phaseAt;
    if (!tier.busy) setPlate(`${player.autoOn ? 'AUTO' : 'READY'} · LV.${tier.i + 1} ${LOC.name}`);
    if (player.autoOn && !tier.busy && idle >= AUTO_NEXT && !placeBet(now)) {
      player.autoOn = false;
      renderPanel();
    }
    if (game.phase === 'idle' && !vo.readySaid && idle > 1800 && idle < 3800) {
      vo.readySaid = true;
      if (Math.random() < VO_ODDS.ready && !voBusy(now, 2.5)) say('ready', VO_PRIO.banter);
    }
  } else if (game.phase === 'running' && !game.crashing) {
    const r = game.round;
    r.t += dt;
    const t = r.t;
    const m = Math.exp(GROWTH_K * t);
    if (canCashOut() && player.autoOn && ui.autoTarget <= r.crash && m >= ui.autoTarget) cashOut(ui.autoTarget);
    if (m >= r.crash) {
      game.m = r.crash;
      crash(r);
    } else {
      game.m = floor2(m);
      while (r.fakes.length && r.fakes[0].t <= t) doFake(r.fakes.shift().kind);
      if (now >= r.nextGlitch) {
        glitchBurst(rand(0.25, 0.6), rand(90, 260));
        if (Math.random() < 0.5) sound.play('static_s', 0.35);
        r.nextGlitch = now + (rand(...GLITCH_GAP) * FEAR.glitchGap) / (1 + Math.log(game.m));
      }
      setPlate('REC · 録画中', 'rec');
      chatter(now);
      camZoom = lerp(camZoom, CAM_ZOOM * (1 + CAM_CREEP * clamp(Math.log(game.m) / Math.log(CAM_CREEP_AT))), 1 - Math.exp(-dt / 500));
    }
  }
  vignette.beat *= Math.exp(-dt / 200);
  cine.shake = cine.shake > 0.3 ? cine.shake * Math.exp(-dt / 350) : 0;
  updatePhone(now, dt);
  updateChat(now);
  updateStream(now, dt);
  sound.update(now);
  renderMult();
  if (game.phase === 'running') renderBetButton();
}

/* ---------- crash: it comes for you ---------- */
function crash(r) {
  const lost = player.active !== null;
  endRound(r, 'full');
  $('#mult').className = 'crashed';
  setPlate('CRASHED', 'crashed');
  crashFull(r, lost).then(() => startIdle(performance.now()));
}

function showToast(main, sub, call, ms) {
  const el = $('#toast');
  $('#toast-main').textContent = main;
  $('#toast-sub').textContent = sub;
  el.classList.toggle('call', call);
  el.classList.toggle('small', main.length > 8);
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([
    { opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.08 },
    { opacity: 1, transform: 'scale(1)', offset: 0.85 }, { opacity: 0, transform: 'scale(0.96)' },
  ], { duration: ms, easing: 'ease-out' });
}

async function crashFull(r, lost) {
  const t0 = performance.now();
  game.crashing = 'full';
  glitchBurst(1, 480);
  sound.play('static_m', 0.9);
  sound.play('rise', 1);
  phone.spike = 1.2;
  say('scream', VO_PRIO.scream, 0.1);
  chatBurst('crash', 7, 110);
  playClip(CRE.rise.clip, { from: CRE.rise.from, rate: CRE.rise.rate, then: null });

  // the hands give out and the phone falls: the stream becomes the room
  await until(t0 + CRASH_T.drop);
  chat.stop = true;
  worldCv.classList.remove('back');
  worldCv.classList.add('real');
  cine.worldLive = true;
  tweenTo(cine, 'worldMix', 1, 600, easeInOut);
  tweenTo(phone, 'drop', 1, CRASH_T.dropMs, (t) => t);
  sound.play('phone_drop', 0.8, { delay: 0.42 });

  await until(t0 + CRASH_T.charge);
  cine.cover = 'world';
  const ms = clipMs(CRE.charge.clip, CRE.charge.from, CRE.charge.rate);
  const charge = playClip(CRE.charge.clip, { from: CRE.charge.from, rate: CRE.charge.rate, then: null });
  sound.play('run', 1);
  sound.play('shriek', 1, { delay: (ms * 0.45) / 1000 });
  tweenTo(cine, 'dolly', CHARGE_DOLLY, ms, easeIn);
  tweenTo(cine, 'shake', 26, ms, easeIn);
  await charge;

  impact(r, lost);
  await wait(CRASH_T.hold);
  await tween($('#blackout'), [{ opacity: 0 }, { opacity: 1 }], { duration: CRASH_T.fade });
  resetScene();
  tween($('#blackout'), [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: 150 });
  phone.drop = 1;
  tweenTo(phone, 'drop', 0, CRASH_T.back, easeOut);
  screenMsg('配信準備中', 'RECONNECTING…');
  glitchBurst(0.9, 900);
  setTimeout(() => { if (game.phase === 'idle') screenMsg(null); }, 1800);
}

function impact(r, lost) {
  if (vo.prio === VO_PRIO.scream) stopVoice();   // cut off mid-scream
  sound.play('impact', 1);
  sound.play('splat', 0.9, { delay: 0.05 });
  sound.play('splat', 0.7, { delay: 0.24 });
  cine.shake = 60;
  $('#flash').animate([{ opacity: 1, background: '#fff' }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
  const box = $('#blood');
  BLOOD.forEach((b, k) => {
    const img = document.createElement('img');
    img.src = `../assets/fx/blood_${b.i}.webp`;
    const s = b.s * rand(0.9, 1.1);
    img.style.width = `${s}px`;
    img.style.left = `${b.x + rand(-40, 40) - s / 2}px`;
    img.style.top = `${b.y + rand(-40, 40) - s / 2}px`;
    box.append(img);
    const rot = b.r + rand(-12, 12);
    img.animate([
      { transform: `rotate(${rot}deg) scale(0.3)`, opacity: 0 },
      { transform: `rotate(${rot}deg) scale(1.08)`, opacity: 1, offset: 0.6 },
      { transform: `rotate(${rot}deg) scale(1)`, opacity: 1 },
    ], { duration: 220, delay: k * 45, easing: 'ease-out', fill: 'forwards' });
  });
  tween($('#drip'), [{ transform: 'translateY(-100%)', opacity: 1 }, { transform: 'translateY(0)', opacity: 1 }],
    { duration: 1500, delay: 120, easing: 'cubic-bezier(.5,0,.8,.6)' });
  tween($('#redwash'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
  $('#stamp-mult').textContent = multText(r.crash);
  $('#stamp-sub').textContent = lost ? `−FUN ${fmtAmt(player.active)}` : '';
  tween($('#stamp'), [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: 260, delay: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
}

function resetScene() {
  $('#blood').replaceChildren();
  for (const id of ['#drip', '#redwash', '#stamp', '#flash']) {
    const el = $(id);
    el.getAnimations().forEach((a) => a.cancel());
  }
  worldCv.classList.remove('real');
  worldCv.classList.add('back');
  Object.assign(cine, { worldLive: false, worldMix: 0, dolly: 0, shake: 0, cover: null, noSignal: false });
  worldDirty = true;
  camZoom = CAM_ZOOM;
  playClip(CRE.idle);
  clearChat();
  chat.stop = false;
  setLive('standby');
}

/* ---------- tier change: the stream cuts to a worse (or kinder) place ---------- */
const lightOf = (i) => CONTENT.locations[TIERS[i].location].light.color.join(',');

/** the light dies, the picture tears, and the new place comes up under a hard flash in its own colour */
async function switchTier() {
  tier.busy = true;
  renderBetButton();
  while (tier.want !== tier.i) {
    const to = tier.want;
    const up = to > tier.i;
    const ready = loadTier(to).then(() => true, () => false);
    sound.play('static_m', 0.75);
    sound.play(up ? 'crack' : 'creak', up ? 0.7 : 0.45);
    glitchBurst(1, TIER_T.out + 250);
    phone.spike += up ? 0.9 : 0.4;
    cine.shake = up ? 14 + 8 * to : 8;
    setPlate('MOVING…');
    tween($('#backdrop'), [{ opacity: 1 }, { opacity: 0.1 }], { duration: TIER_T.out });
    await tween($('#tierfx'), [{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.2, offset: 0.4 }, { opacity: 1 }],
      { duration: TIER_T.out, easing: 'linear' });
    const slow = setTimeout(() => screenMsg('移動中…', 'LOADING'), 200);
    const ok = await ready;
    clearTimeout(slow);
    screenMsg(null);
    if (!ok) {
      tier.want = tier.i;
      tween($('#tierfx'), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      tween($('#backdrop'), [{ opacity: 0.1 }, { opacity: 1 }], { duration: 300 });
      break;
    }

    const before = VO_DECKS;
    useTier(to);
    vo.fresh = true;
    for (const k of Object.keys(vo.decks)) if (String(before[k]) !== String(VO_DECKS[k])) delete vo.decks[k];
    playClip(CRE.idle);
    worldDirty = true;
    clearChat();
    applyTierLook();
    const c = lightOf(to);
    $('#tierlight').style.background = `radial-gradient(ellipse 75% 55% at 50% 42%, rgba(${c},0.95), rgba(${c},0.3) 55%, rgba(${c},0) 100%)`;
    tween($('#tierlight'), [{ opacity: 0 }, { opacity: 0.9, offset: 0.1 }, { opacity: 0.25, offset: 0.24 }, { opacity: 0.65, offset: 0.34 }, { opacity: 0 }],
      { duration: TIER_T.in + 400, easing: 'ease-out' });
    tween($('#tierfx'), [{ opacity: 1 }, { opacity: 0.1, offset: 0.2 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0 }], { duration: TIER_T.in });
    tween($('#backdrop'), [{ opacity: 0.1 }, { opacity: 1 }], { duration: TIER_T.in + 400 });
    sound.play(up ? 'sting' : 'static_s', up ? 0.5 + 0.15 * to : 0.4);
    if (up) sound.play('impact', 0.22 + 0.12 * to, { delay: 0.05 });
    cine.shake = up ? 22 + 12 * to : 10;
    phone.spike += up ? 0.5 + 0.3 * to : 0.2;
    sound.nextBeat = performance.now() + 120;
    glitchBurst(0.7, 380);
    showBanner(to);
    chatBurst('moved', 3, 260);
    if (!voBusy(performance.now())) say(up ? 'climb' : 'retreat', VO_PRIO.banter, 0.7);
    await wait(TIER_T.in);
  }
  tier.busy = false;
  renderPanel();
}

function showBanner(i) {
  const T = TIERS[i];
  const el = $('#tier-banner');
  $('#tb-lv').textContent = `LV.${i + 1}`;
  $('#tb-name').textContent = `${CONTENT.locations[T.location].name} · ${CONTENT.creatures[T.creature].name}`;
  $$('#tb-pips i').forEach((p, k) => p.classList.toggle('on', k <= i));
  el.style.setProperty('--c', `rgb(${lightOf(i)})`);
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([
    { opacity: 0, transform: 'scale(1.3)', filter: 'blur(8px)' },
    { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', offset: 0.1 },
    { opacity: 0.55, transform: 'translateX(-6px)', offset: 0.14 },
    { opacity: 1, transform: 'translateX(0)', offset: 0.18 },
    { opacity: 1, transform: 'scale(1)', offset: 0.8 },
    { opacity: 0, transform: 'scale(0.97)' },
  ], { duration: TIER_T.banner, easing: 'ease-out' });
}

/** what the tier changes outside the canvases: the PC backdrop and the stage's darkness */
function applyTierLook() {
  if (LOC.backdrop) $('#backdrop').style.backgroundImage = `url(${LOC.backdrop})`;
  $('#stage').dataset.tier = tier.i + 1;
  $('#stage').style.setProperty('--dark', FEAR.dark);
  $('#ambient').style.background = `radial-gradient(ellipse 80% 60% at 50% 38%, rgb(${lightOf(tier.i)}), transparent 80%)`;
}

/* ---------- tiny tween runner for plain values (driven by the frame loop) ---------- */
const tweens = [];

function tweenTo(obj, key, to, ms, ease = easeInOut) {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && tweens[i].key === key) tweens.splice(i, 1)[0].resolve();
  return new Promise((resolve) => tweens.push({ obj, key, from: obj[key], to, ms, ease, t0: performance.now(), resolve }));
}

function runTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const p = clamp((now - tw.t0) / tw.ms);
    tw.obj[tw.key] = lerp(tw.from, tw.to, tw.ease(p));
    if (p >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}

/* ---------- boot ---------- */
function fitStage() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  $('#stage').style.transform = `translate(${(innerWidth - 1080 * s) / 2}px, ${(innerHeight - 1920 * s) / 2}px) scale(${s})`;
}

function layoutPhone() {
  const screen = $('#screen');
  Object.assign(screen.style, { left: `${SCR.x}px`, top: `${SCR.y}px`, width: `${SCR.w}px`, height: `${SCR.h}px`, borderRadius: `${SCR.r}px` });
  camCv.width = SCR.w;
  camCv.height = SCR.h;
  const hands = $('#hands');
  Object.assign(hands.style, {
    left: `${SCREEN_AT.x - HANDS.screen.x}px`, top: `${SCREEN_AT.y - HANDS.screen.y}px`, width: `${HANDS.w}px`, height: `${HANDS.h}px`,
  });
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, now - (last || now));
  last = now;
  update(now, dt);
  render(now);
}

async function boot() {
  applyTierLook();
  fitStage();
  addEventListener('resize', fitStage);
  layoutPhone();
  makeNoise();
  sound.init();
  initPanel();
  initCheat();
  renderPanel();
  renderHistory(false);
  try {
    await loadAll((p) => {
      $('#load-bar').style.width = `${Math.round(p * 100)}%`;
      $('#load-text').textContent = `LOADING… ${Math.round(p * 100)}%`;
    });
  } catch (e) {
    $('#load-text').textContent = `LOAD FAILED: ${e.message}`;
    return;
  }
  await document.fonts.ready;
  TIERS.slice(1).reduce((p, _, k) => p.then(() => loadTier(k + 1)), Promise.resolve()).catch(() => {});
  setLive('standby');
  requestAnimationFrame(frame);
  $('#load-text').textContent = 'ヘッドホン推奨 · HEADPHONES RECOMMENDED';
  $('#start').hidden = false;
  $('#start').addEventListener('click', () => {
    sound.start();
    $('#loader').classList.add('out');
    startIdle(performance.now());
  }, { once: true });
}

boot();
