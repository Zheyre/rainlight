/* =========================================================
   Rainlight: rain scene, rain and thunder audio, affirmations
   ========================================================= */

const params = new URLSearchParams(location.search);
const STREAM_MODE = params.has('stream');          // ?stream=1 for the livestream
const FORCED_PERIOD = params.get('period');        // ?period=morning to preview a theme
const AFFIRMATION_SECONDS = 14;                     // how long each affirmation stays

/* Rain style settings shared by the picture and the sound */
const MOODS = {
  gentle: { drops: 260, speed: 0.8, windowDrops: 30, rain: 0.55, thunderEvery: [140, 260] },
  steady: { drops: 520, speed: 1.0, windowDrops: 45, rain: 0.8,  thunderEvery: [70, 150] },
  storm:  { drops: 900, speed: 1.35, windowDrops: 65, rain: 1.0, thunderEvery: [25, 60] }
};
let mood = MOODS.steady;

/* ---------- Time of day themes ---------- */
function currentPeriod() {
  if (FORCED_PERIOD) return FORCED_PERIOD;
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/* =========================================================
   1. THE SCENE (canvas)
   ========================================================= */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
let rain = [], windowDrops = [], bokeh = [], skyline = [];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildSkyline(); buildBokeh(); buildRain(); buildWindowDrops();
}

const rand = (a, b) => a + Math.random() * (b - a);

/* A soft city skyline far away, with warm lit windows */
function buildSkyline() {
  skyline = [];
  let x = -20;
  while (x < W + 20) {
    const w = rand(30, 90), h = rand(H * 0.08, H * 0.32);
    const lights = [];
    for (let i = 0; i < Math.floor(w * h / 900); i++) {
      if (Math.random() < 0.45) lights.push({ x: rand(4, w - 8), y: rand(8, h - 6), on: Math.random() < 0.8, t: rand(0, 100) });
    }
    skyline.push({ x, w, h, lights });
    x += w + rand(2, 14);
  }
}

/* Big blurry circles of light, like city lights seen through a wet window */
function buildBokeh() {
  bokeh = Array.from({ length: Math.round(W / 45) }, () => ({
    x: rand(0, W), y: rand(H * 0.35, H), r: rand(18, 70),
    hue: Math.random() < 0.5 ? 'glow' : (Math.random() < 0.5 ? 'warm' : 'accent'),
    a: rand(0.05, 0.18), dx: rand(-0.08, 0.08), phase: rand(0, Math.PI * 2)
  }));
}

function newDrop(top) {
  const z = rand(0.3, 1);                      // depth: far drops are smaller and slower
  return { x: rand(-W * 0.2, W), y: top ? rand(-H, 0) : rand(0, H), z,
           len: 10 + z * 22, v: (7 + z * 9) * mood.speed };
}
function buildRain() { rain = Array.from({ length: mood.drops }, () => newDrop(false)); }

function newWindowDrop() {
  return { x: rand(0, W), y: rand(-H * 0.2, H), r: rand(1.5, 5), v: 0, stick: rand(60, 400), trail: [] };
}
function buildWindowDrops() { windowDrops = Array.from({ length: mood.windowDrops }, newWindowDrop); }

function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
let colors = {};
function readColors() { colors = { glow: cssVar('--glow'), accent: cssVar('--accent'), warm: '#ffd59e', top: cssVar('--sky-top') }; }

let t = 0;
function draw() {
  t += 1;
  ctx.clearRect(0, 0, W, H);

  // Skyline silhouette
  const base = H;
  const dark = period === 'night' || period === 'evening';
  ctx.fillStyle = hexA(colors.top || '#0b0f2a', dark ? 0.8 : 0.45);
  skyline.forEach(b => {
    ctx.fillRect(b.x, base - b.h, b.w, b.h);
  });
  skyline.forEach(b => {
    b.lights.forEach(l => {
      if (!l.on || !dark) return;
      const flicker = 0.55 + 0.25 * Math.sin((t + l.t * 40) / 90);
      ctx.fillStyle = `rgba(255, 214, 150, ${0.35 * flicker})`;
      ctx.fillRect(b.x + l.x, base - b.h + l.y, 3, 4);
    });
  });

  // Bokeh lights
  bokeh.forEach(b => {
    b.x += b.dx; if (b.x < -80) b.x = W + 80; if (b.x > W + 80) b.x = -80;
    const pulse = b.a * (0.75 + 0.25 * Math.sin(t / 120 + b.phase));
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    const c = colors[b.hue] || '#ffffff';
    g.addColorStop(0, hexA(c, pulse)); g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  });

  // Falling rain streaks (slightly slanted)
  ctx.lineCap = 'round';
  rain.forEach(d => {
    d.y += d.v; d.x += d.v * 0.12;
    if (d.y > H) Object.assign(d, newDrop(true));
    ctx.strokeStyle = `rgba(210, 220, 255, ${0.12 + d.z * 0.28})`;
    ctx.lineWidth = 0.6 + d.z * 0.9;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.12, d.y - d.len); ctx.stroke();
  });

  // Drops sliding down the window glass
  windowDrops.forEach(w => {
    if (w.stick > 0) { w.stick -= 1; }
    else { w.v = Math.min(w.v + 0.04, 2.5 + w.r * 0.4); w.y += w.v; w.x += Math.sin((w.y + w.r * 50) / 40) * 0.3; }
    if (w.v > 0 && t % 3 === 0) { w.trail.push({ x: w.x, y: w.y }); if (w.trail.length > 25) w.trail.shift(); }
    if (w.y > H + 20) Object.assign(w, newWindowDrop(), { y: rand(-40, H * 0.6) });
    w.trail.forEach((p, i) => {
      ctx.fillStyle = `rgba(230, 235, 255, ${0.05 * i / w.trail.length})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, w.r * 0.45, 0, Math.PI * 2); ctx.fill();
    });
    const g = ctx.createRadialGradient(w.x - w.r * 0.3, w.y - w.r * 0.3, 0, w.x, w.y, w.r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(200,210,255,0.18)'); g.addColorStop(1, 'rgba(200,210,255,0.05)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill();
  });

  requestAnimationFrame(draw);
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* =========================================================
   2. THE SOUND (made live in the browser, no audio files needed)
   ========================================================= */
let audio = null;

function noiseBuffer(ctxA, seconds, type) {
  const len = ctxA.sampleRate * seconds;
  const buf = ctxA.createBuffer(2, len, ctxA.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        b0 = 0.99765 * b0 + white * 0.099046; b1 = 0.963 * b1 + white * 0.2965; b2 = 0.57 * b2 + white * 1.0526;
        d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      } else if (type === 'brown') {
        last = (last + 0.02 * white) / 1.02; d[i] = last * 3.2;
      } else d[i] = white * 0.4;
    }
  }
  return buf;
}

function startAudio() {
  if (audio) { audio.ctx.resume(); return; }
  const A = new (window.AudioContext || window.webkitAudioContext)();
  const master = A.createGain(); master.gain.value = 0.9; master.connect(A.destination);

  // Rain bed: pink noise, softened
  const rainGain = A.createGain(); rainGain.gain.value = 0; rainGain.connect(master);
  const bed = A.createBufferSource(); bed.buffer = noiseBuffer(A, 6, 'pink'); bed.loop = true;
  const bedLP = A.createBiquadFilter(); bedLP.type = 'lowpass'; bedLP.frequency.value = 5200;
  const bedHP = A.createBiquadFilter(); bedHP.type = 'highpass'; bedHP.frequency.value = 280;
  bed.connect(bedHP).connect(bedLP).connect(rainGain); bed.start();

  // Patter on the window: brighter noise that swells slowly
  const patter = A.createBufferSource(); patter.buffer = noiseBuffer(A, 5, 'white'); patter.loop = true;
  const patBP = A.createBiquadFilter(); patBP.type = 'bandpass'; patBP.frequency.value = 3200; patBP.Q.value = 0.7;
  const patGain = A.createGain(); patGain.gain.value = 0.12;
  const lfo = A.createOscillator(); lfo.frequency.value = 0.07;
  const lfoAmt = A.createGain(); lfoAmt.gain.value = 0.05; lfo.connect(lfoAmt).connect(patGain.gain); lfo.start();
  patter.connect(patBP).connect(patGain).connect(rainGain); patter.start();

  // Low rumble of rain on rooftops
  const roof = A.createBufferSource(); roof.buffer = noiseBuffer(A, 7, 'brown'); roof.loop = true;
  const roofLP = A.createBiquadFilter(); roofLP.type = 'lowpass'; roofLP.frequency.value = 400;
  const roofGain = A.createGain(); roofGain.gain.value = 0.35;
  roof.connect(roofLP).connect(roofGain).connect(rainGain); roof.start();

  // Thunder channel
  const thunderGain = A.createGain(); thunderGain.gain.value = +document.getElementById('thunder-vol').value; thunderGain.connect(master);
  const thunderBuf = noiseBuffer(A, 9, 'brown');

  audio = { ctx: A, master, rainGain, thunderGain, thunderBuf, dropTimer: null, thunderTimer: null };
  setRainVolume(); scheduleDrops(); scheduleThunder();
}

function setRainVolume() {
  if (!audio) return;
  const v = +document.getElementById('rain-vol').value * mood.rain;
  audio.rainGain.gain.setTargetAtTime(v, audio.ctx.currentTime, 0.8);
}

/* Individual drops tapping nearby: tiny clicks at random times */
function scheduleDrops() {
  clearTimeout(audio.dropTimer);
  const A = audio.ctx;
  const burst = A.createBufferSource(); burst.buffer = audio.thunderBuf;
  const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(1800, 6000); bp.Q.value = 6;
  const g = A.createGain(); const now = A.currentTime;
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(rand(0.15, 0.5), now + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, now + rand(0.03, 0.08));
  burst.connect(bp).connect(g).connect(audio.rainGain);
  burst.start(now, rand(0, 8), 0.1);
  audio.dropTimer = setTimeout(scheduleDrops, rand(15, 140) / mood.speed);
}

/* Thunder: lightning first, then the rumble a moment later */
function scheduleThunder() {
  clearTimeout(audio && audio.thunderTimer);
  const [a, b] = mood.thunderEvery;
  const wait = rand(a, b) * 1000;
  const timer = setTimeout(() => { thunder(); scheduleThunder(); }, wait);
  if (audio) audio.thunderTimer = timer; else visualThunderTimer = timer;
}
let visualThunderTimer = null;

function thunder() {
  const flash = document.getElementById('flash');
  const distance = Math.random();                      // 0 = close, 1 = far away
  if (distance < 0.75) { flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); }
  if (!audio || audio.ctx.state !== 'running') return;
  const A = audio.ctx, delay = 0.4 + distance * 2.5, now = A.currentTime + delay;
  const src = A.createBufferSource(); src.buffer = audio.thunderBuf;
  const lp = A.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900 - distance * 500, now); lp.frequency.exponentialRampToValueAtTime(90, now + 6);
  const g = A.createGain(); const peak = 1.6 - distance;
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(peak, now + 0.25 + distance * 0.6);
  g.gain.exponentialRampToValueAtTime(peak * 0.4, now + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, now + 7.5);
  src.connect(lp).connect(g).connect(audio.thunderGain); src.start(now, rand(0, 1.5), 8);
}

/* =========================================================
   3. AFFIRMATIONS
   ========================================================= */
const FALLBACK = {
  night: { name: 'Night', theme: 'Rest & Peace', affirmations: ['It is safe to rest now.', 'I release today and let the rain wash it away.'] }
};
let library = FALLBACK, queue = [], period = currentPeriod();
const affEl = document.getElementById('affirmation');
const labelEl = document.getElementById('theme-label');

async function loadAffirmations() {
  try {
    const res = await fetch('affirmations/affirmations.json', { cache: 'no-store' });
    if (res.ok) library = await res.json();
  } catch (e) { /* opened as a plain file: use the fallback list */ }
}

function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]); }

function applyPeriod() {
  period = currentPeriod();
  const set = library[period] || library.night || Object.values(library)[0];
  document.body.dataset.period = period;
  labelEl.textContent = `${set.name} · ${set.theme}`;
  queue = shuffle(set.affirmations);
  readColors();
}

function nextAffirmation() {
  if (currentPeriod() !== period) applyPeriod();
  if (!queue.length) queue = shuffle((library[period] || Object.values(library)[0]).affirmations);
  affEl.classList.add('hide');
  setTimeout(() => { affEl.textContent = queue.shift(); affEl.classList.remove('hide'); }, 2000);
}

/* =========================================================
   4. CONTROLS
   ========================================================= */
const player = document.getElementById('player');
const intro = document.getElementById('intro');

function play() { startAudio(); player.classList.add('playing'); }
function pause() { if (audio) audio.ctx.suspend(); player.classList.remove('playing'); }

document.getElementById('play-btn').addEventListener('click', () => player.classList.contains('playing') ? pause() : play());
document.getElementById('enter-btn').addEventListener('click', () => { intro.classList.add('gone'); play(); });
document.getElementById('quiet-btn').addEventListener('click', () => intro.classList.add('gone'));
document.getElementById('rain-vol').addEventListener('input', setRainVolume);
document.getElementById('thunder-vol').addEventListener('input', e => { if (audio) audio.thunderGain.gain.value = +e.target.value; });
document.getElementById('mood').addEventListener('change', e => {
  mood = MOODS[e.target.value];
  buildRain(); buildWindowDrops(); setRainVolume();
  document.getElementById('np-title').textContent = { gentle: 'Gentle rain on the window', steady: 'Soft rain on the window', storm: 'A storm rolling through the night' }[e.target.value];
  if (audio) scheduleThunder(); else { clearTimeout(visualThunderTimer); scheduleThunder(); }
});

function tickClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · your local time';
}

/* =========================================================
   START
   ========================================================= */
(async function init() {
  if (STREAM_MODE) { document.body.classList.add('stream'); intro.classList.add('gone'); }
  await loadAffirmations();
  applyPeriod();
  resize();
  window.addEventListener('resize', resize);
  draw();
  affEl.textContent = queue.shift();
  setInterval(nextAffirmation, AFFIRMATION_SECONDS * 1000);
  tickClock(); setInterval(tickClock, 15000);
  scheduleThunder();                                  // lightning shows even before sound starts
  if (STREAM_MODE) { try { play(); } catch (e) {} }   // OBS browser sources allow sound to start on its own
})();
