import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { rollCrashPoint } from "./games";

export type AviatorPhase = "betting" | "flying" | "crashed";

export interface AviatorHistoryItem {
  id: string;
  round_id: number;
  multiplier: number;
  timestamp: number;
  serverSeed: string;
  clientSeed: string;
}

export interface AviatorLiveState {
  round_id: number;
  phase: AviatorPhase;
  phase_start_time: number; // Unix timestamp in ms
  betting_duration_ms: number; // usually 5000ms
  crash_multiplier: number; // e.g. 2.45, 5.00, 10.00
  crashed_duration_ms: number; // usually 2500ms
  speed: number; // standard 0.065
  crash_mode: "auto" | "manual";
  manual_target: number; // e.g. 5.00
  next_target: number | null; // Pre-queued target for the very next round
  emergency_crash: boolean;
  history: AviatorHistoryItem[];
  updated_at: string;
}

const DEFAULT_AVIATOR_HISTORY: AviatorHistoryItem[] = [
  {
    id: "r-7",
    round_id: 10840,
    multiplier: 1.89,
    timestamp: Date.now() - 180000,
    serverSeed: "a7e12f...48b",
    clientSeed: "cli_892",
  },
  {
    id: "r-6",
    round_id: 10839,
    multiplier: 2.14,
    timestamp: Date.now() - 150000,
    serverSeed: "b89f01...12c",
    clientSeed: "cli_891",
  },
  {
    id: "r-5",
    round_id: 10838,
    multiplier: 5.48,
    timestamp: Date.now() - 120000,
    serverSeed: "c12d45...90e",
    clientSeed: "cli_890",
  },
  {
    id: "r-4",
    round_id: 10837,
    multiplier: 1.25,
    timestamp: Date.now() - 90000,
    serverSeed: "d90e23...34f",
    clientSeed: "cli_889",
  },
  {
    id: "r-3",
    round_id: 10836,
    multiplier: 3.22,
    timestamp: Date.now() - 60000,
    serverSeed: "e34f67...78a",
    clientSeed: "cli_888",
  },
  {
    id: "r-2",
    round_id: 10835,
    multiplier: 10.42,
    timestamp: Date.now() - 30000,
    serverSeed: "f78a89...12b",
    clientSeed: "cli_887",
  },
];

export const INITIAL_AVIATOR_STATE: AviatorLiveState = {
  round_id: 10841,
  phase: "betting",
  phase_start_time: Date.now(),
  betting_duration_ms: 5000,
  crash_multiplier: 2.45,
  crashed_duration_ms: 2500,
  speed: 0.065,
  crash_mode: "auto",
  manual_target: 2.5,
  next_target: null,
  emergency_crash: false,
  history: DEFAULT_AVIATOR_HISTORY,
  updated_at: new Date().toISOString(),
};

const AVIATOR_DOC_REF = "aviator_live";
const LOCAL_STORAGE_KEY = "baaziwin:aviator_live_state";

/**
 * Calculates flight duration in seconds required to reach a specific multiplier.
 * Mathematical formula: t = ln(multiplier) / (speed * 2.85)
 */
export function calculateFlightDuration(multiplier: number, speed: number = 0.065): number {
  if (multiplier <= 1.0) return 0.1;
  const k = speed * 2.85;
  const duration = Math.log(multiplier) / k;
  return Math.max(0.2, Math.round(duration * 100) / 100);
}

/**
 * Calculates multiplier from elapsed flight time in seconds.
 * Mathematical formula: multiplier = exp(speed * t * 2.85)
 */
export function calculateMultiplierAtTime(tSec: number, speed: number = 0.065): number {
  if (tSec <= 0) return 1.0;
  const k = speed * 2.85;
  return Math.round(Math.exp(k * tSec) * 100) / 100;
}

/**
 * Local helper to get current cached state
 */
export function getLocalAviatorState(): AviatorLiveState {
  if (typeof window === "undefined") return INITIAL_AVIATOR_STATE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return { ...INITIAL_AVIATOR_STATE, ...JSON.parse(raw) };
    }
  } catch {}
  return INITIAL_AVIATOR_STATE;
}

/**
 * Advance to next round autonomously and persist to Firestore
 */
export async function advanceToNextRound(
  currentState: AviatorLiveState,
  overrideTarget?: number | null,
): Promise<AviatorLiveState> {
  const nextRoundId = (currentState.round_id || 10000) + 1;

  // Determine crash multiplier for the new round
  let targetMult: number;
  if (overrideTarget && overrideTarget >= 1.0) {
    targetMult = Math.round(overrideTarget * 100) / 100;
  } else if (currentState.next_target && currentState.next_target >= 1.0) {
    targetMult = Math.round(currentState.next_target * 100) / 100;
  } else if (
    currentState.crash_mode === "manual" &&
    typeof currentState.manual_target === "number" &&
    currentState.manual_target >= 1.0
  ) {
    // Strictly preserve the Admin's manual target (e.g. 4.00x, 5.00x)
    targetMult = Math.round(currentState.manual_target * 100) / 100;
  } else {
    targetMult = rollCrashPoint();
  }

  // Ensure minimum 1.01x
  targetMult = Math.max(1.01, targetMult);

  const newState: AviatorLiveState = {
    ...currentState,
    round_id: nextRoundId,
    phase: "betting",
    phase_start_time: Date.now(),
    crash_multiplier: targetMult,
    next_target: null, // Consumed for next round
    emergency_crash: false,
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
    await setDoc(docRef, newState, { merge: true });
  } catch (e) {
    console.warn("Failed to sync new aviator round to Firestore:", e);
  }

  return newState;
}

/**
 * Hook providing 100% globally synchronized Aviator game loop state.
 * Any client or Admin panel sees the exact same flight, countdown, and multiplier.
 */
export function useAviatorSync() {
  const [remoteState, setRemoteState] = useState<AviatorLiveState>(() => getLocalAviatorState());
  const [liveMultiplier, setLiveMultiplier] = useState(1.0);
  const [countdownMs, setCountdownMs] = useState(5000);
  const [activePhase, setActivePhase] = useState<AviatorPhase>("betting");
  const [elapsedFlightSec, setElapsedFlightSec] = useState(0);

  const stateRef = useRef(remoteState);
  stateRef.current = remoteState;

  const isAdvancingRef = useRef(false);

  // 1. Subscribe to Firestore `game_state/aviator_live`
  useEffect(() => {
    try {
      const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
      const unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<AviatorLiveState>;
            const merged: AviatorLiveState = {
              ...INITIAL_AVIATOR_STATE,
              ...data,
            };
            setRemoteState(merged);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            } catch {}
          } else {
            // First time initialization in cloud
            setDoc(docRef, INITIAL_AVIATOR_STATE).catch(() => {});
          }
        },
        (err) => {
          console.warn("Aviator live sync fallback to local:", err);
        },
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Aviator listener error:", e);
    }
  }, []);

  // 2. Ultra-precise deterministic flight loop ticking at ~60fps
  useEffect(() => {
    let animFrame: number;

    const tick = () => {
      const state = stateRef.current;
      const now = Date.now();
      const bettingDuration = state.betting_duration_ms || 5000;
      const speed = state.speed || 0.065;
      const crashMult = state.crash_multiplier || 2.45;
      const totalFlightDurationSec = calculateFlightDuration(crashMult, speed);
      const flightDurationMs = totalFlightDurationSec * 1000;
      const crashedDuration = state.crashed_duration_ms || 2500;

      const timeSincePhaseStart = now - state.phase_start_time;

      if (state.emergency_crash || state.phase === "crashed") {
        // Emergency crash or forced bust triggered by admin
        setActivePhase("crashed");
        setLiveMultiplier(crashMult);
        setCountdownMs(0);
        setElapsedFlightSec(totalFlightDurationSec);

        // Auto transition after crashed duration if expired
        if (timeSincePhaseStart >= bettingDuration + flightDurationMs + crashedDuration) {
          if (!isAdvancingRef.current) {
            isAdvancingRef.current = true;
            advanceToNextRound(state).finally(() => {
              setTimeout(() => {
                isAdvancingRef.current = false;
              }, 1000);
            });
          }
        }
      } else if (timeSincePhaseStart < bettingDuration) {
        // Phase: Betting countdown
        setActivePhase("betting");
        const remaining = Math.max(0, bettingDuration - timeSincePhaseStart);
        setCountdownMs(remaining);
        setLiveMultiplier(1.0);
        setElapsedFlightSec(0);
      } else if (timeSincePhaseStart < bettingDuration + flightDurationMs) {
        // Phase: Flying
        setActivePhase("flying");
        setCountdownMs(0);
        const flightTimeMs = timeSincePhaseStart - bettingDuration;
        const flightTimeSec = flightTimeMs / 1000;
        setElapsedFlightSec(Math.round(flightTimeSec * 10) / 10);
        const currentM = calculateMultiplierAtTime(flightTimeSec, speed);
        setLiveMultiplier(Math.min(crashMult, currentM));
      } else if (timeSincePhaseStart < bettingDuration + flightDurationMs + crashedDuration) {
        // Phase: Crashed (showing flew away)
        setActivePhase("crashed");
        setLiveMultiplier(crashMult);
        setCountdownMs(0);
        setElapsedFlightSec(totalFlightDurationSec);

        // Record history if not yet recorded
        if (state.history.length === 0 || state.history[0].round_id !== state.round_id) {
          const newHistItem: AviatorHistoryItem = {
            id: `r-${state.round_id}`,
            round_id: state.round_id,
            multiplier: crashMult,
            timestamp: now,
            serverSeed: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
            clientSeed: `cli_${Math.floor(Math.random() * 900 + 100)}`,
          };
          const updatedHistory = [newHistItem, ...state.history.slice(0, 40)];
          stateRef.current = { ...state, history: updatedHistory };
          setRemoteState((prev) => ({ ...prev, history: updatedHistory }));

          // Persist history update silently
          try {
            const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
            updateDoc(docRef, { history: updatedHistory }).catch(() => {});
          } catch {}
        }
      } else {
        // Round time expired: Auto-advance to next round!
        if (!isAdvancingRef.current) {
          isAdvancingRef.current = true;
          advanceToNextRound(state).finally(() => {
            setTimeout(() => {
              isAdvancingRef.current = false;
            }, 1000);
          });
        }
      }

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // 3. Admin Control Action Handlers
  const setTargetCrashMultiplier = useCallback(
    async (target: number, mode: "current" | "next" | "permanent" = "permanent") => {
      const rounded = Math.max(1.01, Math.round(target * 100) / 100);
      const now = Date.now();
      const state = stateRef.current;

      let updates: Partial<AviatorLiveState>;
      if (mode === "current") {
        const timeSinceStart = now - state.phase_start_time;
        const isFlying = timeSinceStart >= (state.betting_duration_ms || 5000);
        const flightTimeSec = isFlying
          ? (timeSinceStart - (state.betting_duration_ms || 5000)) / 1000
          : 0;
        const currentM = calculateMultiplierAtTime(flightTimeSec, state.speed || 0.065);

        if (isFlying && rounded <= currentM) {
          // Current flight already past or equal to target -> Crash immediately at current multiplier
          updates = {
            emergency_crash: true,
            phase: "crashed",
            crash_multiplier: currentM,
            manual_target: rounded,
            crash_mode: "manual",
            updated_at: new Date().toISOString(),
          };
        } else {
          // Apply to ongoing/current round
          updates = {
            crash_multiplier: rounded,
            manual_target: rounded,
            crash_mode: "manual",
            emergency_crash: false,
            updated_at: new Date().toISOString(),
          };
        }
      } else if (mode === "next") {
        updates = {
          next_target: rounded,
          manual_target: rounded,
          crash_mode: "manual",
          updated_at: new Date().toISOString(),
        };
      } else {
        // Permanent lock for all rounds
        updates = {
          crash_multiplier: activePhase === "betting" ? rounded : state.crash_multiplier,
          manual_target: rounded,
          crash_mode: "manual",
          next_target: null,
          updated_at: new Date().toISOString(),
        };
      }

      setRemoteState((prev) => ({ ...prev, ...updates }));
      try {
        const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
        await setDoc(docRef, updates, { merge: true });

        // Also keep app_config in sync so nothing reverts
        const configDocRef = doc(db, "app_config", "global_settings");
        await updateDoc(configDocRef, {
          crash_mode: "manual",
          manual_crash_target: rounded,
        }).catch(() => {});
      } catch (err) {
        console.error("Failed to update crash target in Firestore:", err);
      }
    },
    [activePhase],
  );

  const setCrashMode = useCallback(
    async (mode: "auto" | "manual") => {
      const dynamicNextRoll =
        mode === "auto" ? rollCrashPoint() : stateRef.current.manual_target || 2.5;
      const updates: Partial<AviatorLiveState> = {
        crash_mode: mode,
        next_target: null,
        emergency_crash: false,
        updated_at: new Date().toISOString(),
      };

      if (mode === "auto") {
        // If betting, update the current round crash multiplier to dynamic roll right away
        if (activePhase === "betting") {
          updates.crash_multiplier = dynamicNextRoll;
        }
      }

      setRemoteState((prev) => ({ ...prev, ...updates }));
      try {
        const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
        await setDoc(docRef, updates, { merge: true });

        const configDocRef = doc(db, "app_config", "global_settings");
        await updateDoc(configDocRef, {
          crash_mode: mode,
          manual_crash_target: mode === "auto" ? 2.5 : stateRef.current.manual_target || 2.5,
        }).catch(() => {});
      } catch (err) {
        console.error("Failed to update crash mode:", err);
      }
    },
    [activePhase],
  );

  // Instant Emergency Blast: crashes the plane instantly at the exact current multiplier
  const triggerEmergencyCrash = useCallback(async () => {
    const state = stateRef.current;
    const now = Date.now();
    const currentMult = Math.max(1.0, Math.round(liveMultiplier * 100) / 100);
    const speed = state.speed || 0.065;
    const bettingDuration = state.betting_duration_ms || 5000;
    const flightDurMs = calculateFlightDuration(currentMult, speed) * 1000;

    const updates: Partial<AviatorLiveState> = {
      emergency_crash: true,
      phase: "crashed",
      crash_multiplier: currentMult,
      phase_start_time: now - bettingDuration - flightDurMs,
      updated_at: new Date().toISOString(),
    };

    setRemoteState((prev) => ({ ...prev, ...updates }));
    try {
      const docRef = doc(db, "game_state", AVIATOR_DOC_REF);
      await setDoc(docRef, updates, { merge: true });
    } catch (err) {
      console.error("Failed to trigger emergency crash:", err);
    }
  }, [liveMultiplier]);

  const forceNextRound = useCallback(async (target?: number) => {
    const state = stateRef.current;
    await advanceToNextRound(state, target);
  }, []);

  return {
    roundId: remoteState.round_id,
    phase: activePhase,
    countdownMs,
    countdownSec: Math.ceil(countdownMs / 1000),
    multiplier: liveMultiplier,
    targetCrash: remoteState.crash_multiplier,
    flewAwayMultiplier: remoteState.crash_multiplier,
    crashMode: remoteState.crash_mode,
    manualTarget: remoteState.manual_target,
    nextTarget: remoteState.next_target,
    history: remoteState.history || DEFAULT_AVIATOR_HISTORY,
    flightDurationSec: calculateFlightDuration(remoteState.crash_multiplier, remoteState.speed),
    elapsedFlightSec,
    speed: remoteState.speed || 0.065,
    setTargetCrashMultiplier,
    setCrashMode,
    triggerEmergencyCrash,
    forceNextRound,
  };
}
