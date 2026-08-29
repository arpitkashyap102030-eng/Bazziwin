// Synthesized WebAudio sound engine for Aviator
// Provides realistic propeller engine hum, dynamic pitch shifting, flight music risers, and sound effects.

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Flight engine nodes
let engineOsc: OscillatorNode | null = null;
let engineSub: OscillatorNode | null = null;
let propLfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let engineGain: GainNode | null = null;
let musicOsc1: OscillatorNode | null = null;
let musicOsc2: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Starts the realistic airplane propeller engine and uplifting flight synth music */
export function startAviatorEngine() {
  try {
    const ac = getContext();
    if (!ac || !masterGain) return;

    // Stop any existing sounds
    stopAviatorEngine(false);

    const now = ac.currentTime;

    // 1. Engine Main Tone (Propeller fundamental ~95Hz)
    engineOsc = ac.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.setValueAtTime(95, now);

    // 2. Sub-bass engine rumble
    engineSub = ac.createOscillator();
    engineSub.type = "triangle";
    engineSub.frequency.setValueAtTime(48, now);

    // 3. Propeller Blade Tremolo LFO (chops sound at ~28Hz like rotating 3-blade prop)
    propLfo = ac.createOscillator();
    propLfo.type = "sine";
    propLfo.frequency.setValueAtTime(28, now);

    lfoGain = ac.createGain();
    lfoGain.gain.setValueAtTime(0.35, now);
    propLfo.connect(lfoGain.gain);

    // 4. Low-pass filter for engine warmth
    engineFilter = ac.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.setValueAtTime(380, now);
    engineFilter.Q.setValueAtTime(2.5, now);

    // Engine Gain Envelope
    engineGain = ac.createGain();
    engineGain.gain.setValueAtTime(0.0001, now);
    engineGain.gain.exponentialRampToValueAtTime(0.28, now + 0.3);

    // Connect Engine
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);

    engineOsc.start(now);
    engineSub.start(now);
    propLfo.start(now);

    // 5. Ambient Flight Synth Music / Thrilling Arpeggiator Riser
    musicGain = ac.createGain();
    musicGain.gain.setValueAtTime(0.0001, now);
    musicGain.gain.exponentialRampToValueAtTime(0.18, now + 0.5);

    musicOsc1 = ac.createOscillator();
    musicOsc1.type = "sine";
    musicOsc1.frequency.setValueAtTime(220, now); // A3

    musicOsc2 = ac.createOscillator();
    musicOsc2.type = "triangle";
    musicOsc2.frequency.setValueAtTime(330, now); // E4

    musicOsc1.connect(musicGain);
    musicOsc2.connect(musicGain);
    musicGain.connect(masterGain);

    musicOsc1.start(now);
    musicOsc2.start(now);
  } catch (err) {
    console.warn("Aviator engine audio start failed:", err);
  }
}

/** Dynamically updates the airplane engine and flight music pitch based on multiplier */
export function updateAviatorEngine(multiplier: number) {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    const pitchFactor = Math.min(4.5, 1 + Math.log(Math.max(1, multiplier)) * 0.7);

    // Increase engine propeller frequency with multiplier
    if (engineOsc) {
      engineOsc.frequency.setTargetAtTime(95 * pitchFactor, now, 0.05);
    }
    if (engineSub) {
      engineSub.frequency.setTargetAtTime(48 * pitchFactor, now, 0.05);
    }
    if (propLfo) {
      propLfo.frequency.setTargetAtTime(28 * pitchFactor, now, 0.05);
    }
    if (engineFilter) {
      engineFilter.frequency.setTargetAtTime(Math.min(2200, 380 + pitchFactor * 350), now, 0.05);
    }

    // Music chords rise as multiplier climbs
    if (musicOsc1 && musicOsc2) {
      const baseFreq = 220 * pitchFactor;
      musicOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
      musicOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.08);
    }
  } catch {
    // audio is best effort
  }
}

/** Stops the engine when round ends or when the plane flies away */
export function stopAviatorEngine(crashed: boolean) {
  try {
    const ac = getContext();
    if (!ac) return;
    const now = ac.currentTime;

    if (crashed) {
      // Whoosh / flew away pitch-down sound effect
      if (engineGain) {
        engineGain.gain.setValueAtTime(engineGain.gain.value, now);
        engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      }
      if (musicGain) {
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      }
      if (engineOsc) {
        engineOsc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
      }
    } else {
      if (engineGain) {
        engineGain.gain.setValueAtTime(engineGain.gain.value, now);
        engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      }
      if (musicGain) {
        musicGain.gain.setValueAtTime(musicGain.gain.value, now);
        musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      }
    }

    setTimeout(() => {
      try {
        engineOsc?.stop();
        engineSub?.stop();
        propLfo?.stop();
        musicOsc1?.stop();
        musicOsc2?.stop();

        engineOsc?.disconnect();
        engineSub?.disconnect();
        propLfo?.disconnect();
        lfoGain?.disconnect();
        engineFilter?.disconnect();
        engineGain?.disconnect();
        musicOsc1?.disconnect();
        musicOsc2?.disconnect();
        musicGain?.disconnect();

        engineOsc = null;
        engineSub = null;
        propLfo = null;
        lfoGain = null;
        engineFilter = null;
        engineGain = null;
        musicOsc1 = null;
        musicOsc2 = null;
        musicGain = null;
      } catch {
        // cleanup ignore
      }
    }, 450);
  } catch {
    // audio is best effort
  }
}
