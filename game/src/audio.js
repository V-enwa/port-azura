// WebAudio synthesis: engine hum, gunshots, explosions, sirens, pickups, UI clicks, and a
// 3-station radio. All sounds are procedurally generated; no external audio files.

let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  return audioCtx;
}

function playTone(freq, duration, type, vol, ramp) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol || 0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration);
}

function playNoise(duration, vol, filterFreq) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol || 0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq || 2000, t);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + duration);
}

let engineNode = null;
let engineGain = null;

export function startEngine(rpm) {
  const c = ctx();
  if (!c) return;
  if (!engineNode) {
    engineNode = c.createOscillator();
    engineGain = c.createGain();
    engineGain.gain.setValueAtTime(0, c.currentTime);
    engineNode.type = 'sawtooth';
    engineNode.connect(engineGain);
    engineGain.connect(c.destination);
    engineNode.start();
    setEngineRPM(rpm || 30);
    setEngineVol(0.06);
  }
}

export function stopEngine() {
  if (engineNode) {
    try { engineNode.stop(); } catch (_) {}
    engineNode = null;
    engineGain = null;
  }
}

export function setEngineRPM(rpm) {
  if (engineNode) engineNode.frequency.setTargetAtTime(rpm * 2 + 50, ctx().currentTime, 0.05);
}

export function setEngineVol(vol) {
  if (engineGain) engineGain.gain.setTargetAtTime(vol, ctx().currentTime, 0.05);
}

export function playGunshot(weaponIdx) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const vol = 0.2;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(weaponIdx >= 3 ? 80 : weaponIdx >= 2 ? 200 : 400, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);
  playNoise(0.08, vol * 0.7, weaponIdx >= 3 ? 800 : weaponIdx >= 2 ? 1500 : 3000);
}

export function playExplosion() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.5);
  playNoise(0.3, 0.25, 500);
}

export function playPickup() {
  playTone(880, 0.1, 'square', 0.1);
  setTimeout(() => playTone(1320, 0.15, 'square', 0.1), 100);
}

export function playUIClick() {
  playTone(660, 0.05, 'square', 0.08);
}

export function playSiren(on) {
  const c = ctx();
  if (!c) return;
  if (!sirenOsc) {
    sirenOsc = c.createOscillator();
    sirenGain = c.createGain();
    sirenOsc.type = 'sawtooth';
    sirenOsc.connect(sirenGain);
    sirenGain.connect(c.destination);
    sirenOsc.start();
  }
  if (on) {
    sirenGain.gain.setTargetAtTime(0.08, c.currentTime, 0.05);
    sirenMod = setInterval(() => {
      if (sirenOsc) sirenOsc.frequency.setTargetAtTime(sirenLow ? 900 : 600, c.currentTime, 0.1);
      sirenLow = !sirenLow;
    }, 500);
  } else {
    sirenGain.gain.setTargetAtTime(0, c.currentTime, 0.05);
    if (sirenMod) { clearInterval(sirenMod); sirenMod = null; }
  }
}

let sirenOsc = null;
let sirenGain = null;
let sirenLow = true;
let sirenMod = null;

let radioStations = [
  { name: 'Coast FM', seq: [262, 330, 392, 330, 294, 262, 294, 330], noteLen: 0.25 },
  { name: 'Neon Nights', seq: [196, 247, 294, 247, 196, 220, 247, 294], noteLen: 0.2 },
  { name: 'Dusk Drive', seq: [330, 294, 262, 294, 330, 392, 330, 294], noteLen: 0.3 },
];
let radioStationIdx = 0;
let radioOn = false;
let radioNoteIdx = 0;
let radioTimer = 0;
let radioOsc = null;
let radioGain = null;

export function toggleRadio() {
  const c = ctx();
  if (!c) return;
  if (radioOn) {
    radioOn = false;
    if (radioOsc) { try { radioOsc.stop(); } catch (_) {} radioOsc = null; }
    if (radioGain) radioGain.gain.setTargetAtTime(0, c.currentTime, 0.02);
  } else {
    radioOn = true;
    radioNoteIdx = 0;
    radioTimer = 0;
    if (!radioOsc) {
      radioOsc = c.createOscillator();
      radioGain = c.createGain();
      radioOsc.type = 'triangle';
      radioGain.gain.setValueAtTime(0, c.currentTime);
      radioOsc.connect(radioGain);
      radioGain.connect(c.destination);
      radioOsc.start();
      radioGain.gain.setTargetAtTime(0.03, c.currentTime, 0.02);
    }
  }
}

export function cycleRadioStation() {
  radioStationIdx = (radioStationIdx + 1) % radioStations.length;
  radioNoteIdx = 0;
  radioTimer = 0;
}

export function updateRadio(dt) {
  if (!radioOn || !radioOsc) return;
  radioTimer += dt;
  const station = radioStations[radioStationIdx];
  if (radioTimer >= station.noteLen) {
    radioTimer -= station.noteLen;
    radioNoteIdx = (radioNoteIdx + 1) % station.seq.length;
    radioOsc.frequency.setTargetAtTime(station.seq[radioNoteIdx], ctx().currentTime, 0.02);
  }
}

export function getRadioName() {
  return radioOn ? `${radioStations[radioStationIdx].name}` : '';
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}