// Peep's voice: little gremlin noises synthesized with the Web Audio API, so
// there are no sound files to ship. Browsers only allow audio after the
// visitor interacts, so the context starts on the first click or key press.

export type PeepSound = "giggle" | "grunt" | "purr" | "squeal" | "grumble" | "chuckle" | "psst" | "eep" | "yawn";

const KEY = "peep-sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  if (master) master.gain.value = on ? 0.5 : 0;
}

/** Call from a user gesture. Safe to call often. */
export function unlockSound(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = soundOn() ? 0.5 : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function soundReady(): boolean {
  return !!ctx && ctx.state === "running";
}

/** One voiced syllable: a buzzy tone through a vowel-ish formant, with a pitch glide. */
function syllable(at: number, dur: number, from: number, to: number, opts: { type?: OscillatorType; formant?: number; vibrato?: number; gain?: number } = {}) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sawtooth";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + dur);
  if (opts.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 28;
    depth.gain.value = opts.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + dur + 0.05);
  }
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = opts.formant ?? 1200;
  formant.Q.value = 2.5;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 3800;
  const g = ctx.createGain();
  const peak = opts.gain ?? 0.5;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.025, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(formant).connect(low).connect(g).connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function noise(at: number, dur: number, freq: number, gain = 0.3) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(at);
}

export function playPeep(kind: PeepSound): void {
  if (!ctx || !master || !soundOn() || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.01;
  const r = () => 0.9 + Math.random() * 0.2; // no two noises quite alike
  switch (kind) {
    case "giggle":
      for (let i = 0; i < 5; i++) syllable(t + i * 0.085, 0.07, (720 + i * 60) * r(), (980 + i * 40) * r(), { type: "triangle", formant: 1500, vibrato: 30, gain: 0.45 });
      break;
    case "grunt":
      syllable(t, 0.18, 190 * r(), 120, { formant: 650, gain: 0.6 });
      break;
    case "purr":
      for (let i = 0; i < 6; i++) syllable(t + i * 0.11, 0.1, 85 * r(), 75, { formant: 420, gain: 0.35 });
      break;
    case "squeal":
      syllable(t, 0.16, 620 * r(), 1300, { type: "triangle", formant: 1700, vibrato: 40, gain: 0.5 });
      syllable(t + 0.17, 0.22, 900 * r(), 1650, { type: "triangle", formant: 1900, vibrato: 50, gain: 0.5 });
      break;
    case "grumble":
      for (let i = 0; i < 4; i++) syllable(t + i * 0.13, 0.14, (150 - i * 10) * r(), 105, { formant: 540, vibrato: 18, gain: 0.55 });
      break;
    case "chuckle":
      for (let i = 0; i < 3; i++) syllable(t + i * 0.13, 0.09, 260 * r(), 210, { type: "square", formant: 900, gain: 0.35 });
      break;
    case "psst":
      noise(t, 0.08, 5200, 0.25);
      noise(t + 0.12, 0.2, 4200, 0.35);
      syllable(t + 0.38, 0.14, 500 * r(), 900, { type: "triangle", formant: 1400, gain: 0.45 });
      break;
    case "eep":
      syllable(t, 0.12, 900 * r(), 1500, { type: "triangle", formant: 1800, gain: 0.5 });
      break;
    case "yawn":
      syllable(t, 0.7, 420 * r(), 180, { type: "triangle", formant: 800, gain: 0.35 });
      break;
  }
}
