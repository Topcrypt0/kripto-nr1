"use client";

// Lightweight synthesized SFX via the Web Audio API — no audio files to host.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Must be called from a user gesture (e.g. the launch click) to unlock audio. */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

function noiseBuffer(c: AudioContext, dur: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Engine ignition: rising rumble + whoosh. */
export function playLaunch() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.3);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 1.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 1.3);

  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(560, t + 1.1);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.12, t + 0.2);
  og.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 1.2);
}

/** Victory: ascending chime. */
export function playWin() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = c.createGain();
    const st = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.3, st + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
    o.connect(g).connect(c.destination);
    o.start(st);
    o.stop(st + 0.55);
  });
}

/** Crash: filtered noise burst + low boom. */
export function playCrash() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.7);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1400, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + 0.7);

  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.6);
}
