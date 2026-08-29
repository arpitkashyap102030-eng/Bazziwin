// Lightweight WebAudio sound engine — no asset files, works offline in the APK.

export type SfxName =
  | "click"
  | "chip"
  | "start"
  | "step"
  | "cashout"
  | "win"
  | "bigwin"
  | "lose"
  | "tick"
  | "reveal"
  | "bonus"
  | "error"
  | "spin"
  | "reel_stop"
  | "deal"
  | "ball_drop"
  | "explosion"
  | "gallop"
  | "sword"
  | "cheer";

const STORAGE_KEY = "3cr:sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
const listeners = new Set<(on: boolean) => void>();

export function isSoundOn() {
  return enabled;
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initSound() {
  if (typeof window === "undefined") return;
  enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  listeners.forEach((l) => l(enabled));
}

export function setSoundOn(on: boolean) {
  enabled = on;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  }
  listeners.forEach((l) => l(on));
  if (on) playSfx("click");
}

export function toggleSound() {
  setSoundOn(!enabled);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({ freq, to, dur = 0.12, type = "sine", gain = 0.6, delay = 0 }: ToneOpts) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function noise(dur = 0.25, gain = 0.35, delay = 0) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
}

export function playSfx(name: SfxName) {
  if (!enabled) return;
  try {
    switch (name) {
      case "click":
        tone({ freq: 620, to: 880, dur: 0.06, type: "triangle", gain: 0.25 });
        break;
      case "chip":
        tone({ freq: 900, to: 1400, dur: 0.07, type: "square", gain: 0.18 });
        break;
      case "start":
        tone({ freq: 320, to: 640, dur: 0.16, type: "sawtooth", gain: 0.3 });
        tone({ freq: 480, to: 960, dur: 0.18, type: "triangle", gain: 0.22, delay: 0.06 });
        break;
      case "step":
        tone({ freq: 520, to: 760, dur: 0.09, type: "square", gain: 0.22 });
        break;
      case "tick":
        // Crisp dual-frequency clock/ticking mechanism
        tone({ freq: 1400, to: 800, dur: 0.045, type: "sine", gain: 0.35 });
        tone({ freq: 2800, dur: 0.015, type: "triangle", gain: 0.2, delay: 0.005 });
        break;
      case "reveal":
        tone({ freq: 300, to: 1200, dur: 0.22, type: "triangle", gain: 0.28 });
        break;
      case "cashout":
        [660, 880, 1320].forEach((f, i) =>
          tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.3, delay: i * 0.06 }),
        );
        break;
      case "win":
        [523, 659, 784].forEach((f, i) =>
          tone({ freq: f, dur: 0.2, type: "triangle", gain: 0.32, delay: i * 0.07 }),
        );
        break;
      case "bigwin":
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          tone({ freq: f, dur: 0.26, type: "sawtooth", gain: 0.26, delay: i * 0.08 }),
        );
        tone({ freq: 1568, dur: 0.5, type: "triangle", gain: 0.3, delay: 0.45 });
        break;
      case "lose":
        tone({ freq: 320, to: 90, dur: 0.45, type: "sawtooth", gain: 0.3 });
        noise(0.3, 0.2);
        break;
      case "bonus":
        [784, 988, 1175, 1568].forEach((f, i) =>
          tone({ freq: f, dur: 0.22, type: "sine", gain: 0.3, delay: i * 0.09 }),
        );
        break;
      case "error":
        tone({ freq: 220, to: 160, dur: 0.2, type: "square", gain: 0.25 });
        break;
      case "spin":
        tone({ freq: 400, to: 800, dur: 0.15, type: "sawtooth", gain: 0.15 });
        break;
      case "reel_stop":
        tone({ freq: 300, to: 150, dur: 0.12, type: "triangle", gain: 0.35 });
        noise(0.08, 0.2);
        break;
      case "deal":
        noise(0.06, 0.25);
        tone({ freq: 800, to: 1200, dur: 0.05, type: "triangle", gain: 0.2 });
        break;
      case "ball_drop":
        tone({ freq: 1100, to: 950, dur: 0.04, type: "sine", gain: 0.3 });
        tone({ freq: 1400, dur: 0.03, type: "triangle", gain: 0.2, delay: 0.05 });
        break;
      case "explosion":
        noise(0.8, 0.45);
        tone({ freq: 140, to: 35, dur: 0.7, type: "sawtooth", gain: 0.4 });
        break;
      case "gallop":
        noise(0.05, 0.3);
        tone({ freq: 220, to: 160, dur: 0.08, type: "triangle", gain: 0.25 });
        break;
      case "sword":
        tone({ freq: 1200, to: 2400, dur: 0.18, type: "sawtooth", gain: 0.25 });
        break;
      case "cheer":
        [440, 554, 659, 880].forEach((f, i) =>
          tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.25, delay: i * 0.08 }),
        );
        noise(0.4, 0.15, 0.1);
        break;
    }
  } catch {
    // audio is best-effort only
  }
}

/** Win/lose feedback based on the round multiplier. */
export function playResult(multiplier: number) {
  if (multiplier <= 0) playSfx("lose");
  else if (multiplier >= 5) playSfx("bigwin");
  else playSfx("win");
}

/** Global delegated click sound for every button / link / input control. */
export function attachGlobalClickSfx() {
  if (typeof document === "undefined") return () => {};
  const handler = (e: Event) => {
    const target = e.target as HTMLElement | null;
    const el = target?.closest?.(
      'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, summary',
    ) as HTMLElement | null;
    if (!el) return;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
    if (el.dataset.sfx === "off") return;
    playSfx(el.dataset.sfx === "chip" ? "chip" : "click");
  };
  document.addEventListener("pointerdown", handler, true);
  return () => document.removeEventListener("pointerdown", handler, true);
}
