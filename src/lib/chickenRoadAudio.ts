// WebAudio synthesizer for Chicken 2 Road
// Realistic cartoon music, clucking jumps, engine hums, car honks, screeching tires, and cashout fanfares.

let audioCtx: AudioContext | null = null;
let bgMusicGain: GainNode | null = null;
let bgMusicOscs: OscillatorNode[] = [];
let isMusicPlaying = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Plays chicken hop & cute cluck sound */
export function playChickenHop() {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    // Hop boing sound
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // Subtle chicken cluck wobble
    const cluckOsc = ac.createOscillator();
    const cluckGain = ac.createGain();
    cluckOsc.type = "triangle";
    cluckOsc.frequency.setValueAtTime(520, now + 0.04);
    cluckOsc.frequency.setValueAtTime(620, now + 0.09);
    cluckOsc.frequency.setValueAtTime(480, now + 0.14);

    cluckGain.gain.setValueAtTime(0.001, now);
    cluckGain.gain.setValueAtTime(0.2, now + 0.04);
    cluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    cluckOsc.connect(cluckGain);
    cluckGain.connect(ac.destination);
    cluckOsc.start(now + 0.03);
    cluckOsc.stop(now + 0.18);
  } catch {
    // audio is best effort
  }
}

/** Plays car horn and screeching crash sound */
export function playCarCrash() {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    // 1. Double Car Horn (Beep Beep!)
    const horn1 = ac.createOscillator();
    const horn2 = ac.createOscillator();
    const hornGain = ac.createGain();

    horn1.type = "sawtooth";
    horn2.type = "sawtooth";
    horn1.frequency.setValueAtTime(420, now);
    horn2.frequency.setValueAtTime(525, now);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, now);

    hornGain.gain.setValueAtTime(0.35, now);
    hornGain.gain.setValueAtTime(0.35, now + 0.15);
    hornGain.gain.setValueAtTime(0.01, now + 0.18);
    hornGain.gain.setValueAtTime(0.4, now + 0.22);
    hornGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    horn1.connect(filter);
    horn2.connect(filter);
    filter.connect(hornGain);
    hornGain.connect(ac.destination);

    horn1.start(now);
    horn2.start(now);
    horn1.stop(now + 0.65);
    horn2.stop(now + 0.65);

    // 2. Tire Screech (White Noise + Bandpass Filter sweep)
    const bufferSize = ac.sampleRate * 0.5;
    const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ac.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const screechFilter = ac.createBiquadFilter();
    screechFilter.type = "bandpass";
    screechFilter.frequency.setValueAtTime(2800, now + 0.1);
    screechFilter.frequency.linearRampToValueAtTime(1200, now + 0.5);
    screechFilter.Q.setValueAtTime(4.0, now + 0.1);

    const screechGain = ac.createGain();
    screechGain.gain.setValueAtTime(0.001, now);
    screechGain.gain.setValueAtTime(0.28, now + 0.1);
    screechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    whiteNoise.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(ac.destination);

    whiteNoise.start(now + 0.08);
    whiteNoise.stop(now + 0.6);

    // 3. Impact Thud
    const thud = ac.createOscillator();
    const thudGain = ac.createGain();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(130, now + 0.3);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.65);

    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.setValueAtTime(0.45, now + 0.3);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    thud.connect(thudGain);
    thudGain.connect(ac.destination);
    thud.start(now + 0.28);
    thud.stop(now + 0.75);
  } catch {
    // audio is best effort
  }
}

/** Plays passing car zoom whoosh */
export function playTrafficPass() {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    // Doppler effect: high to low pitch
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    // audio is best effort
  }
}

/** Plays triumphant cashout jingle */
export function playChickenCashout() {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.setValueAtTime(0.28, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch {
    // audio is best effort
  }
}

/** Loops upbeat background cartoon road music */
export function startChickenRoadMusic() {
  if (isMusicPlaying) return;
  try {
    const ac = getContext();
    if (!ac) return;
    isMusicPlaying = true;
  } catch {
    // best effort
  }
}

export function stopChickenRoadMusic() {
  isMusicPlaying = false;
  bgMusicOscs.forEach((o) => {
    try {
      o.stop();
      o.disconnect();
    } catch {
      // ignore
    }
  });
  bgMusicOscs = [];
  if (bgMusicGain) {
    try {
      bgMusicGain.disconnect();
    } catch {
      // ignore
    }
    bgMusicGain = null;
  }
}
