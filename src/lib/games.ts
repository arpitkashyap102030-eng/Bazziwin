import aviator from "@/assets/cover-aviator.jpg";
import chickenRoad from "@/assets/cover-chicken-road.jpg";
import towerRush from "@/assets/cover-tower-rush.jpg";
import mines from "@/assets/cover-mines.jpg";
import jetx from "@/assets/cover-jetx.jpg";
import cricketx from "@/assets/cover-cricketx.jpg";
import dice from "@/assets/cover-dice.jpg";
import andarBahar from "@/assets/cover-andar-bahar.jpg";
import colorTrading from "@/assets/cover-wingo.jpg";
import dragonTower from "@/assets/cover-dragon-tower.jpg";
import goldMiner from "@/assets/cover-gold-miner.jpg";
import horses3D from "@/assets/cover-horses.jpg";
import plinko3D from "@/assets/cover-plinko.jpg";
import { getLocalAppConfig } from "./appConfig";

export type Engine =
  | "crash"
  | "road"
  | "tower"
  | "mines"
  | "dice"
  | "color"
  | "slot3d"
  | "roulette3d"
  | "blackjack3d"
  | "spacewarp3d"
  | "horseracing3d"
  | "plinko3d"
  | "andarbahar";
export type Category = "crash" | "table" | "hot" | "slot" | "live" | "fishing";

export type GameDef = {
  slug: string;
  name: string;
  studio: string;
  image: string;
  engine: Engine;
  categories: Category[];
  tagline: string;
  badge3d?: boolean;
  /** Engine tuning knobs so each title plays differently. */
  config: Record<string, number | string>;
};

export const GAMES: GameDef[] = [
  {
    slug: "chicken-road-2",
    name: "Chicken Road 2",
    studio: "Inout",
    image: chickenRoad,
    engine: "road",
    categories: ["crash", "hot"],
    tagline: "Cross lane by lane. Don't get flattened.",
    config: { lanes: 12, risk: 0.14, icon: "🐔" },
  },
  {
    slug: "mines",
    name: "Mines",
    studio: "Stake",
    image: mines,
    engine: "mines",
    categories: ["crash", "table", "hot"],
    tagline: "Dig for gems, dodge the bombs.",
    config: { grid: 25, icon: "💎" },
  },
  {
    slug: "andar-bahar",
    name: "Andar Bahar",
    studio: "Live Casino",
    image: andarBahar,
    engine: "andarbahar",
    categories: ["table", "live", "hot"],
    tagline: "Predict Inside (Andar) or Outside (Bahar) matching card with Crash & Classic modes.",
    config: { icon: "🎴" },
  },
  {
    slug: "color-trading",
    name: "Win Go Bingo",
    studio: "Baazi Live",
    image: colorTrading,
    engine: "color",
    categories: ["table", "hot", "live"],
    tagline: "Win Go Bingo 30s/1m/3m/5m — Predict color, number ball, and big/small.",
    config: { icon: "🟢" },
  },
  {
    slug: "aviator",
    name: "Aviator",
    studio: "Scribe",
    image: aviator,
    engine: "crash",
    categories: ["crash", "hot"],
    tagline: "Cash out before the plane flies away.",
    config: { speed: 0.055, theme: "plane", icon: "✈️" },
  },
  {
    slug: "jetx",
    name: "JetX",
    studio: "Smartsoft",
    image: jetx,
    engine: "crash",
    categories: ["crash"],
    tagline: "Neon jet, rising stakes.",
    config: { speed: 0.09, theme: "jet", icon: "🛩️" },
  },
  {
    slug: "cricketx",
    name: "CricketX",
    studio: "Smartsoft",
    image: cricketx,
    engine: "crash",
    categories: ["crash"],
    tagline: "Every ball lifts the multiplier.",
    config: { speed: 0.065, theme: "cricket", icon: "🏏" },
  },
  {
    slug: "virtual-horses-3d",
    name: "Virtual 3D Horse Racing",
    studio: "Baazi Sports",
    image: horses3D,
    engine: "horseracing3d",
    badge3d: true,
    categories: ["live", "hot", "table"],
    tagline: "Live circular stadium track, anatomical thoroughbreds & photo-finish suspense.",
    config: { rtp: 0.9, icon: "🏇" },
  },
  {
    slug: "plinko-3d",
    name: "Quantum Plinko 3D",
    studio: "Baazi Physics",
    image: plinko3D,
    engine: "plinko3d",
    badge3d: true,
    categories: ["table", "hot", "crash"],
    tagline: "Physics-governed brass pegboard, real collision impulses & up to 100x edge bins.",
    config: { rtp: 0.95, icon: "🎯" },
  },
  {
    slug: "dragon-tower",
    name: "Dragon Tower",
    studio: "Stake",
    image: dragonTower,
    engine: "tower",
    categories: ["table", "hot"],
    tagline: "Climb the dragon's tower, dodge the fire tile.",
    config: { floors: 9, choices: 4, traps: 1, icon: "🐉" },
  },
  {
    slug: "gold-miner",
    name: "Gold Miner",
    studio: "JILI",
    image: goldMiner,
    engine: "mines",
    categories: ["table", "slot", "hot"],
    tagline: "Dig gems from the gold cave, avoid the dynamite.",
    config: { grid: 25, icon: "⛏️" },
  },
  {
    slug: "tower-rush",
    name: "Tower Rush",
    studio: "GS",
    image: towerRush,
    engine: "tower",
    categories: ["crash", "table"],
    tagline: "Pick the safe crate on every floor.",
    config: { floors: 8, choices: 3, traps: 1, icon: "📦" },
  },
  {
    slug: "lucky-dice",
    name: "Lucky Dice",
    studio: "BaaziWin",
    image: dice,
    engine: "dice",
    categories: ["table", "hot"],
    tagline: "Set your odds, roll under the line.",
    config: { icon: "🎲" },
  },
];

export const COLOR_TRADING_SLUG = "color-trading";

/** Default 96% Return to Player (RTP) / 4% House Profit algorithm */
export const RTP = 0.96;
export const HOUSE_EDGE = 0.04;

export function getEffectiveRTP(): number {
  try {
    const config = getLocalAppConfig();
    if (config && typeof config.rtp_pct === "number" && config.rtp_pct > 0) {
      return Math.min(0.99, Math.max(0.01, config.rtp_pct / 100));
    }
  } catch {}
  return RTP;
}

export function getGame(slug: string): GameDef | undefined {
  if (slug === "bingo" || slug === "wingo" || slug === "win-go") {
    return GAMES.find((g) => g.slug === "color-trading");
  }
  return GAMES.find((g) => g.slug === slug);
}

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "hot", label: "Hot", icon: "🔥" },
  { id: "table", label: "Table", icon: "🎰" },
  { id: "live", label: "Live", icon: "📹" },
  { id: "slot", label: "Slot", icon: "🍒" },
  { id: "crash", label: "Crash", icon: "📈" },
  { id: "fishing", label: "Fishing", icon: "🎣" },
];

export function getGlobalGameMultiplier(): number {
  try {
    const config = getLocalAppConfig();
    if (
      config &&
      typeof config.global_game_multiplier === "number" &&
      config.global_game_multiplier > 0
    ) {
      return config.global_game_multiplier;
    }
  } catch {}
  return 1.0;
}

/** Dynamic algorithm crash point governed by Admin House Profit / RTP settings or manual flight targets */
export function rollCrashPoint(customRtp?: number, manualTarget?: number): number {
  if (typeof manualTarget === "number" && manualTarget >= 1.0) {
    return Math.round(manualTarget * 100) / 100;
  }

  try {
    const config = getLocalAppConfig();
    // 1. Manual crash target set by Admin takes absolute highest priority
    if (
      config &&
      config.crash_mode === "manual" &&
      typeof config.manual_crash_target === "number" &&
      config.manual_crash_target >= 1.0
    ) {
      return Math.round(config.manual_crash_target * 100) / 100;
    }
  } catch {}

  const globalMult = getGlobalGameMultiplier();
  const rand = Math.random(); // 0 to 1

  let mult: number;

  if (rand < 0.15) {
    // 15% Instant/Early takeoff bust (1.00x - 1.15x)
    mult = 1.0 + Math.random() * 0.15;
  } else if (rand < 0.75) {
    // 60% Low multiplier zone (1.16x - 2.10x)
    mult = 1.16 + Math.random() * 0.94;
  } else if (rand < 0.92) {
    // 17% Medium flight zone (2.11x - 4.80x)
    mult = 2.11 + Math.random() * 2.69;
  } else if (rand < 0.99) {
    // ~7% (1 in 12-14 rounds, exactly 10 se 15 baar me 1 baar) High flight to 10x - 16.5x
    mult = 10.0 + Math.random() * 6.5;
  } else {
    // 1% Rare mega flight (18x - 32x)
    mult = 18.0 + Math.random() * 14.0;
  }

  const finalMult = Math.round(mult * globalMult * 100) / 100;
  return Math.max(1.01, finalMult);
}

/** Multiplier for surviving `steps` independent hazards of probability `risk`, using active algorithm RTP. */
export function stepMultiplier(steps: number, risk: number, customRtp?: number): number {
  const r = typeof customRtp === "number" ? customRtp : getEffectiveRTP();
  const globalMult = getGlobalGameMultiplier();
  return Math.round((r / Math.pow(1 - risk, steps)) * globalMult * 100) / 100;
}

/** Mines payout after revealing `picks` safe tiles from `total` with `bombs` bombs, using active algorithm RTP. */
export function minesMultiplier(
  total: number,
  bombs: number,
  picks: number,
  customRtp?: number,
): number {
  const r = typeof customRtp === "number" ? customRtp : getEffectiveRTP();
  const globalMult = getGlobalGameMultiplier();
  let m = 1;
  for (let i = 0; i < picks; i++) {
    m *= (total - i) / (total - bombs - i);
  }
  return Math.round(m * r * globalMult * 100) / 100;
}

export function formatMoney(n: number): string {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCoins(n: number): string {
  return formatMoney(n);
}
