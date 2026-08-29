import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getBallColors, getBallSize, type HistoryRecord } from "@/components/games/ColorGame";

export interface ColorTradingOverride {
  forcedNumber?: number | null; // 0 to 9
  forcedColor?: "green" | "violet" | "red" | null;
  forcedSize?: "big" | "small" | null;
  mode?: "auto" | "manual";
  targetPeriod?: string | null;
}

export interface ColorTradingState {
  overrides: Record<string, ColorTradingOverride>; // per mode ("30s", "1m", etc)
  history: Record<string, HistoryRecord[]>; // per mode history
  updated_at: string;
}

const COLOR_DOC_REF = "color_trading_live";
const LOCAL_STORAGE_COLOR_KEY = "baaziwin:color_trading_state";

const DEFAULT_COLOR_STATE: ColorTradingState = {
  overrides: {
    "30s": { mode: "auto" },
    "1m": { mode: "auto" },
    "3m": { mode: "auto" },
    "5m": { mode: "auto" },
  },
  history: {},
  updated_at: new Date().toISOString(),
};

/**
 * Deterministic generation of current period string from global UTC time
 */
export function getSynchronizedPeriodString(durationSec: number): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  const startOfDay = Date.UTC(yyyy, d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  const now = Date.now();
  const secondsSinceMidnight = Math.floor((now - startOfDay) / 1000);
  const periodIndex = Math.floor(secondsSinceMidnight / durationSec) + 1;

  const paddedIndex = String(periodIndex).padStart(5, "0");
  return `${yyyy}${mm}${dd}1000${paddedIndex}`;
}

/**
 * Deterministic calculation of remaining seconds in the current synchronized round
 */
export function getSynchronizedSecondsLeft(durationSec: number): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const remainder = nowSec % durationSec;
  return durationSec - remainder;
}

/**
 * Deterministic algorithm result for a given period if no admin override is set.
 * Guarantees every player worldwide calculates the EXACT same number even offline!
 */
export function getDeterministicResultForPeriod(periodStr: string): number {
  let hash = 0;
  for (let i = 0; i < periodStr.length; i++) {
    hash = (hash << 5) - hash + periodStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10;
}

export function getLocalColorState(): ColorTradingState {
  if (typeof window === "undefined") return DEFAULT_COLOR_STATE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COLOR_KEY);
    if (raw) {
      return { ...DEFAULT_COLOR_STATE, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_COLOR_STATE;
}

/**
 * Global reactive hook for synchronized Color Trading
 */
export function useColorTradingSync(modeId: string = "30s", durationSec: number = 30) {
  const [colorState, setColorState] = useState<ColorTradingState>(() => getLocalColorState());
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getSynchronizedSecondsLeft(durationSec),
  );
  const [currentPeriod, setCurrentPeriod] = useState(() =>
    getSynchronizedPeriodString(durationSec),
  );

  const stateRef = useRef(colorState);
  stateRef.current = colorState;

  // 1. Firestore cloud sync for overrides & history
  useEffect(() => {
    try {
      const docRef = doc(db, "game_state", COLOR_DOC_REF);
      const unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<ColorTradingState>;
            const merged: ColorTradingState = {
              ...DEFAULT_COLOR_STATE,
              ...data,
            };
            setColorState(merged);
            try {
              localStorage.setItem(LOCAL_STORAGE_COLOR_KEY, JSON.stringify(merged));
            } catch {}
          } else {
            setDoc(docRef, DEFAULT_COLOR_STATE).catch(() => {});
          }
        },
        (err) => {
          console.warn("Color trading listener fallback:", err);
        },
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Color trading subscribe error:", e);
    }
  }, []);

  // 2. Exact wall-clock timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      const left = getSynchronizedSecondsLeft(durationSec);
      const period = getSynchronizedPeriodString(durationSec);
      setSecondsRemaining(left);
      setCurrentPeriod(period);
    }, 500);

    return () => clearInterval(interval);
  }, [durationSec]);

  // 3. Resolve result for a period (respecting admin overrides if present)
  const resolveResultForPeriod = useCallback(
    (
      periodStr: string,
    ): { number: number; colors: ("green" | "red" | "violet")[]; size: "big" | "small" } => {
      const override = stateRef.current.overrides?.[modeId];

      let num: number;
      if (
        override?.mode === "manual" &&
        typeof override.forcedNumber === "number" &&
        override.forcedNumber >= 0 &&
        override.forcedNumber <= 9
      ) {
        num = override.forcedNumber;
      } else if (override?.mode === "manual" && override.forcedColor) {
        if (override.forcedColor === "green") {
          const greens = [1, 3, 7, 9];
          num = greens[Math.floor(Math.random() * greens.length)];
        } else if (override.forcedColor === "red") {
          const reds = [2, 4, 6, 8];
          num = reds[Math.floor(Math.random() * reds.length)];
        } else {
          // violet
          num = Math.random() < 0.5 ? 0 : 5;
        }
      } else if (override?.mode === "manual" && override.forcedSize) {
        num =
          override.forcedSize === "big"
            ? 5 + Math.floor(Math.random() * 5)
            : Math.floor(Math.random() * 5);
      } else {
        num = getDeterministicResultForPeriod(periodStr);
      }

      return {
        number: num,
        colors: getBallColors(num),
        size: getBallSize(num),
      };
    },
    [modeId],
  );

  // 4. Admin override setter
  const setAdminColorOverride = useCallback(
    async (override: ColorTradingOverride) => {
      const updatedOverrides = {
        ...(stateRef.current.overrides || {}),
        [modeId]: override,
      };
      const newState: ColorTradingState = {
        ...stateRef.current,
        overrides: updatedOverrides,
        updated_at: new Date().toISOString(),
      };

      setColorState(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_COLOR_KEY, JSON.stringify(newState));
        const docRef = doc(db, "game_state", COLOR_DOC_REF);
        await setDoc(docRef, newState, { merge: true });
      } catch (err) {
        console.error("Failed to update color trading override:", err);
      }
    },
    [modeId],
  );

  return {
    period: currentPeriod,
    secondsRemaining,
    override: colorState.overrides?.[modeId] || { mode: "auto" },
    history: colorState.history?.[modeId] || [],
    resolveResultForPeriod,
    setAdminColorOverride,
  };
}
