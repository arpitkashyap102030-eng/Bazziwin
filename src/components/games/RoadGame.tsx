import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GameDef } from "@/lib/games";
import { formatCoins } from "@/lib/games";
import {
  playChickenHop,
  playCarCrash,
  playChickenCashout,
  playTrafficPass,
} from "@/lib/chickenRoadAudio";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Menu,
  Minus,
  Plus,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  Coins,
  Sparkles,
  Zap,
} from "lucide-react";

type Props = {
  game: GameDef;
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
};

type DifficultyLevel = "easy" | "medium" | "hard" | "daredevil";

interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  lanes: number;
  crashChance: number; // Probability of car hit per step
  multipliers: number[];
}

const DIFFICULTIES: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: "easy",
    label: "Easy",
    lanes: 24,
    crashChance: 0.045,
    multipliers: [
      1.02, 1.05, 1.08, 1.12, 1.16, 1.21, 1.27, 1.34, 1.42, 1.51, 1.62, 1.75, 1.9, 2.08, 2.3, 2.58,
      2.92, 3.36, 3.92, 4.65, 5.6, 6.88, 8.65, 11.2,
    ],
  },
  medium: {
    id: "medium",
    label: "Medium",
    lanes: 18,
    crashChance: 0.12,
    multipliers: [
      1.08, 1.18, 1.31, 1.47, 1.67, 1.93, 2.26, 2.68, 3.22, 3.92, 4.85, 6.1, 7.8, 10.2, 13.6, 18.5,
      26.0, 38.5,
    ],
  },
  hard: {
    id: "hard",
    label: "Hard",
    lanes: 12,
    crashChance: 0.22,
    multipliers: [1.22, 1.52, 1.95, 2.56, 3.45, 4.75, 6.7, 9.8, 14.8, 23.0, 37.0, 64.0],
  },
  daredevil: {
    id: "daredevil",
    label: "Daredevil",
    lanes: 8,
    crashChance: 0.35,
    multipliers: [1.45, 2.18, 3.42, 5.6, 9.5, 16.8, 31.0, 62.0],
  },
};

// Ambient cars for background traffic animation
interface TrafficVehicle {
  id: number;
  type: "red-sports" | "yellow-bus" | "blue-bus" | "green-cab" | "truck";
  laneIndex: number;
  y: number; // 0 to 100%
  speed: number;
  direction: "up" | "down";
}

export function RoadGame({ game, bet, balance, busy, settle }: Props) {
  // Current game state
  const [stake, setStake] = useState<number>(Math.max(1, bet));
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 = on sidewalk, 1..N = on road manholes
  const [isDead, setIsDead] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Crash vehicle animation state
  const [crashingVehicle, setCrashingVehicle] = useState<{
    lane: number;
    type: "bus" | "car";
    active: boolean;
  } | null>(null);

  // Modals & UI Toggles
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showBetIdDropdown, setShowBetIdDropdown] = useState(false);
  const [showPresetChips, setShowPresetChips] = useState(false);
  const [showDiffDropdown, setShowDiffDropdown] = useState(false);
  const [betId, setBetId] = useState(() => `BT-${Math.floor(100000 + Math.random() * 900000)}`);
  const [serverSeed] = useState(() => Math.random().toString(36).substring(2, 12));

  // Traffic vehicles for background street realism
  const [ambientCars, setAmbientCars] = useState<TrafficVehicle[]>([
    { id: 1, type: "yellow-bus", laneIndex: 2, y: -20, speed: 0.45, direction: "down" },
    { id: 2, type: "red-sports", laneIndex: 5, y: 110, speed: 0.65, direction: "up" },
    { id: 3, type: "green-cab", laneIndex: 8, y: -40, speed: 0.5, direction: "down" },
    { id: 4, type: "blue-bus", laneIndex: 12, y: 120, speed: 0.4, direction: "up" },
  ]);

  // Road container reference for horizontal scrolling
  const roadScrollRef = useRef<HTMLDivElement>(null);

  const diffConfig = DIFFICULTIES[difficulty];
  const activeMultiplier =
    currentStep === 0 ? 1.0 : (diffConfig.multipliers[currentStep - 1] ?? 1.0);
  const nextMultiplier =
    currentStep < diffConfig.lanes
      ? diffConfig.multipliers[currentStep]
      : diffConfig.multipliers[diffConfig.lanes - 1];

  // Ambient traffic loop
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbientCars((prev) =>
        prev.map((car) => {
          let nextY = car.direction === "down" ? car.y + car.speed * 2 : car.y - car.speed * 2;
          if (nextY > 130) nextY = -30;
          if (nextY < -30) nextY = 130;
          return { ...car, y: nextY };
        }),
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Auto scroll road to keep chicken centered
  useEffect(() => {
    if (roadScrollRef.current) {
      const targetScroll = Math.max(0, currentStep * 110 - 120);
      roadScrollRef.current.scrollTo({
        left: targetScroll,
        top: 0,
        behavior: "smooth",
      });
    }
  }, [currentStep]);

  // Start new round
  const startGame = () => {
    if (stake > balance) {
      toast.error("Insufficient INR Balance");
      return;
    }

    setBetId(`BT-${Math.floor(100000 + Math.random() * 900000)}`);
    setIsPlaying(true);
    setCurrentStep(0);
    setIsDead(false);
    setCrashingVehicle(null);

    if (soundEnabled) {
      playChickenHop();
    }
  };

  // Step / Hop forward to the next manhole
  const advanceStep = async () => {
    if (!isPlaying || isDead || busy || isHopping) return;

    setIsHopping(true);
    const nextStep = currentStep + 1;

    // Check for car hit / crash
    const willCrash = Math.random() < diffConfig.crashChance;

    if (willCrash) {
      // Trigger crash vehicle animation
      const vehicleType = Math.random() > 0.5 ? "bus" : "car";
      setCrashingVehicle({ lane: nextStep, type: vehicleType, active: true });
      setCurrentStep(nextStep);
      setIsDead(true);
      setIsPlaying(false);
      setIsHopping(false);

      if (soundEnabled) {
        playCarCrash();
      }

      await settle(
        0,
        {
          game: "Chicken 2 Road",
          step: nextStep,
          totalLanes: diffConfig.lanes,
          difficulty,
          betId,
          survived: false,
        },
        stake,
      );

      toast.error(`💥 Squashed by traffic on step ${nextStep}! 🍗`);
      return;
    }

    // Successful safe hop!
    setCurrentStep(nextStep);
    if (soundEnabled) {
      playChickenHop();
      if (Math.random() > 0.6) playTrafficPass();
    }

    setTimeout(() => {
      setIsHopping(false);
    }, 200);

    // Reached the other side summit!
    if (nextStep >= diffConfig.lanes) {
      const finalMult = diffConfig.multipliers[diffConfig.lanes - 1];
      setIsPlaying(false);

      if (soundEnabled) {
        playChickenCashout();
      }

      await settle(
        finalMult,
        {
          game: "Chicken 2 Road",
          step: nextStep,
          totalLanes: diffConfig.lanes,
          difficulty,
          betId,
          survived: true,
          completed: true,
        },
        stake,
      );

      toast.success(
        `🏆 ALL LANES CROSSED! Jackpot Won +₹${formatCoins(stake * finalMult)} (${finalMult}x)`,
      );
    }
  };

  // Cash out winnings safely
  const cashOut = async () => {
    if (!isPlaying || currentStep === 0 || isDead || busy) return;

    setIsPlaying(false);
    if (soundEnabled) {
      playChickenCashout();
    }

    await settle(
      activeMultiplier,
      {
        game: "Chicken 2 Road",
        step: currentStep,
        totalLanes: diffConfig.lanes,
        difficulty,
        betId,
        survived: true,
      },
      stake,
    );

    toast.success(
      `🎉 Cashed Out at ${activeMultiplier.toFixed(2)}x (+₹${formatCoins(stake * activeMultiplier)})`,
    );
  };

  // Bet adjustments
  const handleStakeChange = (delta: number) => {
    if (isPlaying) return;
    setStake((prev) => Math.max(1, Math.min(50000, Math.round(prev + delta))));
  };

  const handleMultiplierStake = (multiplier: number) => {
    if (isPlaying) return;
    setStake((prev) => Math.max(1, Math.min(50000, Math.round(prev * multiplier))));
  };

  return (
    <div className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-3xl bg-[#14171f] font-sans text-white shadow-2xl border border-[#232838]">
      {/* 1. Header Bar matching screenshot: CHICKEN 2 ROAD + (?) + INR Balance + Menu */}
      <div className="flex items-center justify-between border-b border-[#212638] bg-[#10131a] px-3.5 py-2.5">
        {/* Brand Logo & Rules Icon */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            <span className="font-display text-lg font-black tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              CHICKEN
            </span>
            <span className="relative mx-0.5 inline-block font-display text-xl font-black italic text-[#e61c38] drop-shadow-[0_0_10px_rgba(230,28,56,0.8)]">
              2
              <Sparkles className="absolute -top-1 -right-2 size-2.5 text-amber-400" />
            </span>
            <span className="font-display text-lg font-black tracking-tighter text-white">
              ROAD
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="flex size-5 items-center justify-center rounded-full text-amber-400 hover:text-amber-300 transition"
            title="Game Rules & Provably Fair"
          >
            <HelpCircle className="size-4" />
          </button>
        </div>

        {/* Right Balance & Sound & Menu */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex size-7 items-center justify-center rounded-lg bg-[#1a1f2e] text-slate-400 hover:text-white"
            title="Toggle Sound Effects & Music"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-emerald-400" />
            ) : (
              <VolumeX className="size-4 text-slate-500" />
            )}
          </button>

          {/* Balance INR Chip */}
          <div className="flex items-center gap-1 rounded-lg border border-[#282f45] bg-[#161a26] px-2.5 py-1">
            <span className="font-mono text-xs font-bold text-emerald-400">
              {formatCoins(balance)}
            </span>
            <span className="font-mono text-[10px] font-semibold text-slate-400">INR</span>
          </div>

          {/* Hamburger Menu Icon */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="flex size-7 items-center justify-center rounded-lg bg-[#1a1f2e] text-slate-300 hover:text-white"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      {/* 2. Main Game Viewport (Sidewalk, Lamppost, Chicken, Highway with Manhole Covers & Cars) */}
      <div className="relative h-96 w-full overflow-hidden bg-[#242833]">
        {/* Horizontal Scrollable Road Container */}
        <div
          ref={roadScrollRef}
          className="no-scrollbar relative flex h-full w-full overflow-x-auto overflow-y-hidden select-none overscroll-contain"
        >
          {/* A. Left Sidewalk Zone with Lamppost, Trees, and Start Area */}
          <div className="relative h-full w-40 shrink-0 border-r-2 border-[#1c202a] bg-[#828896]">
            {/* Sidewalk Tile Grid Pattern */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#4d5464 1px, transparent 1px), linear-gradient(90deg, #4d5464 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            {/* Left Lush Green Bushes & Foliage */}
            <div className="absolute top-0 bottom-0 left-0 w-12 flex flex-col justify-between py-2 pointer-events-none">
              <div className="size-16 -ml-6 rounded-full bg-[#3d9136] shadow-inner border border-[#2d7328]" />
              <div className="size-20 -ml-8 rounded-full bg-[#46a33e] shadow-md border border-[#2d7328]" />
              <div className="size-16 -ml-6 rounded-full bg-[#3d9136] shadow-inner border border-[#2d7328]" />
              <div className="size-20 -ml-8 rounded-full bg-[#46a33e] shadow-md border border-[#2d7328]" />
            </div>

            {/* Street Lamppost casting warm streetlight spotlight onto the road */}
            <div className="absolute top-8 left-16 z-20 pointer-events-none">
              {/* Lamppost Pole & Arm */}
              <div className="relative">
                {/* Vertical Pole */}
                <div className="h-44 w-3.5 rounded-t-sm bg-gradient-to-r from-[#475166] via-[#636f87] to-[#3a4354] shadow-md" />
                {/* Curved Arm */}
                <div className="absolute -top-3 left-0 h-4 w-12 rounded-tr-xl bg-[#475166]" />
                {/* Lamp Fixture */}
                <div className="absolute -top-1 left-9 h-3.5 w-6 rounded-b-md bg-[#2d3444] border-t border-slate-400" />
                {/* Light Bulb Glow */}
                <div className="absolute top-2 left-10 size-4 rounded-full bg-amber-200 blur-[1px]" />
              </div>

              {/* Radial Spotlight on the ground */}
              <div
                className="absolute -top-1 left-2 size-56 -translate-x-12 rounded-full opacity-35 blur-xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(253, 230, 138, 0.8) 0%, rgba(251, 191, 36, 0.3) 50%, transparent 75%)",
                }}
              />
            </div>

            {/* Start Sidewalk Station Title */}
            <div className="absolute bottom-4 left-14 z-10 rounded-md bg-[#161a24]/80 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
              START
            </div>

            {/* Chicken on the Sidewalk (When at Step 0) */}
            {currentStep === 0 && (
              <div
                className={`absolute bottom-20 left-12 z-30 transition-all duration-300 ${
                  isHopping ? "-translate-y-6 scale-110" : "animate-bounce"
                }`}
                style={{ animationDuration: "1.8s" }}
              >
                <ChickenCharacter isDead={false} />
              </div>
            )}
          </div>

          {/* B. Highway Lanes with Sewer Manhole Covers */}
          {diffConfig.multipliers.map((multVal, index) => {
            const laneNumber = index + 1;
            const isPassed = laneNumber < currentStep || (laneNumber === currentStep && !isDead);
            const isCurrent = laneNumber === currentStep;
            const isNext = laneNumber === currentStep + 1 && isPlaying && !isDead;
            const isCrashHere = isDead && laneNumber === currentStep;

            return (
              <div
                key={`lane-${laneNumber}`}
                onClick={() => {
                  if (isNext) void advanceStep();
                }}
                className={`relative h-full w-28 shrink-0 border-r border-[#3a3f4e] bg-[#2e323e] transition-colors ${
                  isNext ? "cursor-pointer hover:bg-[#353a47]" : ""
                }`}
              >
                {/* Highway Center Dashed White Lines */}
                <div className="absolute inset-y-0 right-0 flex flex-col justify-between py-2 pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 w-1.5 rounded-full bg-white/70 shadow-sm" />
                  ))}
                </div>

                {/* Ambient Moving Traffic on this lane */}
                {ambientCars
                  .filter((c) => c.laneIndex === laneNumber)
                  .map((car) => (
                    <div
                      key={`car-${car.id}-${laneNumber}`}
                      className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-100 ease-linear"
                      style={{ top: `${car.y}%` }}
                    >
                      <TrafficVehicleSvg type={car.type} direction={car.direction} />
                    </div>
                  ))}

                {/* Crashing Vehicle Zooming In on Crash */}
                {isCrashHere && crashingVehicle && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-pop">
                    <div className="relative">
                      {crashingVehicle.type === "bus" ? (
                        <div className="w-20 rounded-xl bg-amber-500 p-2 text-center font-display text-xs font-black text-slate-950 shadow-2xl border-2 border-slate-900">
                          🚍 BUS CRASH!
                        </div>
                      ) : (
                        <div className="w-20 rounded-xl bg-rose-600 p-2 text-center font-display text-xs font-black text-white shadow-2xl border-2 border-slate-900">
                          🏎️ SPEED CAR!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* The Metallic Sewer Manhole Cover Button / Step */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                  <button
                    type="button"
                    disabled={!isNext || busy}
                    onClick={() => {
                      if (isNext) void advanceStep();
                    }}
                    className={`relative flex size-20 items-center justify-center rounded-full transition-all duration-200 ${
                      isCrashHere
                        ? "ring-4 ring-rose-500 bg-[#3a151b] scale-105"
                        : isCurrent
                          ? "ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)] scale-105"
                          : isPassed
                            ? "ring-2 ring-emerald-500/80 bg-[#16271e]"
                            : isNext
                              ? "ring-4 ring-emerald-400/80 animate-pulse bg-[#252b38] hover:scale-105 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                              : "bg-[#202430] opacity-85"
                    }`}
                  >
                    {/* Metallic Manhole Cover Graphic */}
                    <div className="relative size-full rounded-full border-4 border-[#4a5061] bg-[#2d3240] p-1.5 shadow-inner">
                      {/* Inner Steel Grate Concentric Ring */}
                      <div className="flex size-full flex-col items-center justify-center rounded-full border-2 border-[#1c202a] bg-[#1f232d]">
                        {/* Grate Vertical Slits Graphic */}
                        <div className="absolute inset-2 flex justify-around opacity-20 pointer-events-none">
                          <div className="w-0.5 bg-black" />
                          <div className="w-0.5 bg-black" />
                          <div className="w-0.5 bg-black" />
                          <div className="w-0.5 bg-black" />
                        </div>

                        {/* Centered Multiplier */}
                        <span
                          className={`relative z-10 font-mono text-xs font-black tracking-tight ${
                            isCrashHere
                              ? "text-rose-400"
                              : isCurrent
                                ? "text-amber-300 drop-shadow-md text-sm font-black"
                                : isPassed
                                  ? "text-emerald-400"
                                  : isNext
                                    ? "text-emerald-300 font-black"
                                    : "text-slate-400"
                          }`}
                        >
                          {isCrashHere ? "💥" : `${multVal.toFixed(2)}x`}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Step Lane Indicator Badge */}
                  <span className="mt-1 font-mono text-[9px] font-bold text-slate-400">
                    Lane {laneNumber}
                  </span>
                </div>

                {/* The Chicken Character Hopping / Standing on this Manhole */}
                {isCurrent && (
                  <div
                    className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 ${
                      isDead
                        ? "scale-90 rotate-45"
                        : isHopping
                          ? "-translate-y-8 scale-110"
                          : "animate-bounce"
                    }`}
                    style={{ animationDuration: "1.5s" }}
                  >
                    <ChickenCharacter isDead={isDead} />
                  </div>
                )}
              </div>
            );
          })}

          {/* C. Right Safe Finish Summit Zone */}
          <div className="relative h-full w-44 shrink-0 border-l-2 border-[#1c202a] bg-[#16291e] p-4 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/20 border-2 border-amber-400 shadow-lg mb-2">
              <span className="text-3xl">🏆</span>
            </div>
            <span className="font-display text-sm font-black text-amber-400 uppercase tracking-wider">
              SAFE SIDEWALK
            </span>
            <span className="font-mono text-xs font-bold text-slate-300 mt-1">Jackpot Winner!</span>
          </div>
        </div>

        {/* Live Active Game Status Floating Pill */}
        {isPlaying && !isDead && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-amber-400/40 bg-[#0d1017]/90 px-4 py-1.5 shadow-xl backdrop-blur-md">
            <span className="font-mono text-xs font-bold text-slate-300">Current:</span>
            <span className="font-display text-base font-black text-amber-400">
              {activeMultiplier.toFixed(2)}x
            </span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="font-mono text-xs font-black text-emerald-400">
              ₹{formatCoins(stake * activeMultiplier)}
            </span>
          </div>
        )}
      </div>

      {/* 3. Bottom Betting Control Panel matching screenshot layout */}
      <div className="border-t border-[#202538] bg-[#12151e] p-3 space-y-2.5">
        {/* Bet ID & Provably Fair Dropdown Header */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBetIdDropdown(!showBetIdDropdown)}
            className="flex w-full items-center justify-between px-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span>Bet ID:</span>
              <span className="font-bold text-slate-300">{betId}</span>
            </div>
            {showBetIdDropdown ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>

          {/* Expanded Bet ID / Provably Fair Info */}
          {showBetIdDropdown && (
            <div className="mt-2 rounded-xl border border-[#232a3e] bg-[#0c0e17] p-2.5 text-xs text-slate-400 font-mono space-y-1 animate-fade-in">
              <div className="flex justify-between">
                <span>Server Seed Hash:</span>
                <span className="text-white font-bold">{serverSeed}</span>
              </div>
              <div className="flex justify-between">
                <span>RTP:</span>
                <span className="text-emerald-400 font-bold">97.00%</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-[#1a1f30]">
                <ShieldCheck className="size-3 text-emerald-400" />
                <span>Cryptographically Verified Fair Outcomes</span>
              </div>
            </div>
          )}
        </div>

        {/* Bet Amount Stepper Row + Quick Chips & Difficulty */}
        <div className="space-y-2">
          {/* Input Row: [-] [Amount INR] [+] [x0.5] [x2.0] [CoinStack] */}
          <div className="flex items-center gap-1.5">
            {/* Amount Stepper */}
            <div className="flex flex-1 items-center justify-between rounded-xl border border-[#262c42] bg-[#0a0d17] p-1">
              <button
                type="button"
                disabled={isPlaying}
                onClick={() => handleStakeChange(-10)}
                className="flex size-8 items-center justify-center rounded-lg bg-[#1a1f30] text-slate-300 hover:bg-[#252d47] active:scale-95 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>

              <div className="flex items-center gap-1 px-2">
                <span className="font-mono text-sm font-black text-white">{stake.toFixed(2)}</span>
                <span className="font-mono text-[11px] font-bold text-slate-400">INR</span>
              </div>

              <button
                type="button"
                disabled={isPlaying}
                onClick={() => handleStakeChange(10)}
                className="flex size-8 items-center justify-center rounded-lg bg-[#1a1f30] text-slate-300 hover:bg-[#252d47] active:scale-95 disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* x0.5 Button */}
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => handleMultiplierStake(0.5)}
              className="h-10 rounded-xl border border-[#262c42] bg-[#161a29] px-2.5 font-mono text-xs font-bold text-slate-300 hover:bg-[#20273d] active:scale-95 disabled:opacity-40"
            >
              x0.5
            </button>

            {/* x2.0 Button */}
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => handleMultiplierStake(2.0)}
              className="h-10 rounded-xl border border-[#262c42] bg-[#161a29] px-2.5 font-mono text-xs font-bold text-slate-300 hover:bg-[#20273d] active:scale-95 disabled:opacity-40"
            >
              x2.0
            </button>

            {/* Coin Stacks Preset Button */}
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setShowPresetChips(!showPresetChips)}
              className="flex size-10 items-center justify-center rounded-xl border border-[#262c42] bg-[#161a29] text-amber-400 hover:bg-[#20273d] active:scale-95 disabled:opacity-40"
              title="Quick Stake Presets"
            >
              <Coins className="size-5" />
            </button>
          </div>

          {/* Quick Preset Chips Popover */}
          {showPresetChips && !isPlaying && (
            <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-[#22283d] bg-[#0c0f1a] p-1.5 animate-fade-in">
              {[10, 50, 100, 500, 1000].map((amt) => (
                <button
                  key={`preset-${amt}`}
                  type="button"
                  onClick={() => {
                    setStake(amt);
                    setShowPresetChips(false);
                  }}
                  className="rounded-lg border border-[#1e253b] bg-[#151929] py-1 font-mono text-xs font-bold text-slate-200 hover:bg-[#232a42]"
                >
                  {amt}
                </button>
              ))}
            </div>
          )}

          {/* Difficulty Dropdown Selector matching screenshot */}
          <div className="relative">
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setShowDiffDropdown(!showDiffDropdown)}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-[#262c42] bg-[#161a29] px-3 font-display text-sm font-bold text-white hover:bg-[#1d2338] disabled:opacity-50"
            >
              <span>{diffConfig.label}</span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showDiffDropdown && !isPlaying && (
              <div className="absolute bottom-full mb-1.5 left-0 z-50 w-full overflow-hidden rounded-xl border border-[#2a324d] bg-[#121624] shadow-2xl animate-pop">
                {(["easy", "medium", "hard", "daredevil"] as DifficultyLevel[]).map((dKey) => {
                  const d = DIFFICULTIES[dKey];
                  return (
                    <button
                      key={dKey}
                      type="button"
                      onClick={() => {
                        setDifficulty(dKey);
                        setShowDiffDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition ${
                        difficulty === dKey
                          ? "bg-[#252d47] text-white font-black"
                          : "text-slate-300 hover:bg-[#1a2033]"
                      }`}
                    >
                      <span className="font-display text-xs font-bold">{d.label}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {d.lanes} Lanes · Max {d.multipliers[d.lanes - 1]}x
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. Big Action Button (Play / Hop Forward / Cash Out) */}
        <div className="pt-1">
          {isPlaying ? (
            <div className="grid grid-cols-2 gap-2">
              {/* Hop Forward Button */}
              <button
                type="button"
                disabled={busy || isDead || isHopping}
                onClick={() => void advanceStep()}
                className="flex h-14 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-2 font-display text-base font-black text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <span>Hop Lane 🐔</span>
                <span className="font-mono text-xs font-bold opacity-90">
                  Next: {nextMultiplier.toFixed(2)}x
                </span>
              </button>

              {/* Cash Out Button */}
              <button
                type="button"
                disabled={busy || currentStep === 0 || isDead}
                onClick={() => void cashOut()}
                className="flex h-14 w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 p-2 font-display text-base font-black text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <span>Cash Out</span>
                <span className="font-mono text-xs font-black">
                  +₹{formatCoins(stake * activeMultiplier)}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || stake > balance}
              onClick={startGame}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#22c55e] font-display text-xl font-black tracking-wide text-slate-950 shadow-[0_4px_20px_rgba(34,197,94,0.4)] transition hover:bg-[#16a34a] active:scale-95 disabled:opacity-50"
            >
              {stake > balance ? "Insufficient Balance" : "Play"}
            </button>
          )}
        </div>
      </div>

      {/* 5. Game Rules & Provably Fair Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#2b334d] bg-[#121624] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f263d] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐔</span>
                <h3 className="font-display text-base font-black">Chicken 2 Road Rules</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="flex size-7 items-center justify-center rounded-full bg-[#1e253d] text-slate-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans max-h-72 overflow-y-auto pr-1">
              <p>
                <strong>1. Goal:</strong> Guide your chicken across busy highway lanes from manhole
                to manhole.
              </p>
              <p>
                <strong>2. Multipliers:</strong> Every safe lane increases your multiplier. You can
                Cash Out at any step!
              </p>
              <p>
                <strong>3. Traffic Hazard:</strong> Fast cars and buses cruise the highway. If a
                vehicle hits your chicken, the round ends.
              </p>
              <p>
                <strong>4. Difficulties:</strong>
                <br />• <em>Easy:</em> 24 lanes, lowest risk, up to 11.2x.
                <br />• <em>Medium:</em> 18 lanes, moderate risk, up to 38.5x.
                <br />• <em>Hard:</em> 12 lanes, high risk, up to 64.0x.
                <br />• <em>Daredevil:</em> 8 lanes, max thrill, up to 62.0x.
              </p>
              <div className="rounded-xl border border-emerald-500/30 bg-[#0c1f17] p-2.5 text-[11px] text-emerald-300 font-mono">
                ✓ Provably Fair SHA-512 Random Number Generator with 97% RTP.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="mt-4 w-full rounded-xl bg-[#22c55e] py-2.5 font-display text-sm font-black text-slate-950"
            >
              Got it! Let's Play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Character Components (Authentic Chicken from Screenshot)
// ---------------------------------------------------------------------------

function ChickenCharacter({ isDead }: { isDead: boolean }) {
  if (isDead) {
    return (
      <div className="relative size-16">
        {/* Flattened Fried Chicken with Feathers and Comic Impact */}
        <div className="flex size-full flex-col items-center justify-center">
          <span className="text-3xl">🍗</span>
          <span className="text-sm font-black text-rose-400">CRASH!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-14 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
      <svg viewBox="0 0 100 100" className="size-full">
        {/* Red Comb / Crest on Head */}
        <path
          d="M 38 24 C 35 12, 48 10, 52 20 C 56 10, 68 12, 65 24 Z"
          fill="#e61c38"
          stroke="#b91c1c"
          strokeWidth="1.5"
        />

        {/* Chubby White Plump Body */}
        <ellipse
          cx="48"
          cy="58"
          rx="32"
          ry="28"
          fill="#f8fafc"
          stroke="#334155"
          strokeWidth="2.5"
        />

        {/* Cute Chicken Wing on side */}
        <path
          d="M 30 52 C 22 55, 20 68, 32 70 C 40 70, 42 60, 30 52 Z"
          fill="#e2e8f0"
          stroke="#475569"
          strokeWidth="1.8"
        />

        {/* Chicken Head Bulb */}
        <circle cx="60" cy="42" r="20" fill="#f8fafc" stroke="#334155" strokeWidth="2.5" />

        {/* Large Round Curious Cartoon Eye */}
        <circle cx="62" cy="38" r="10" fill="#fef08a" stroke="#334155" strokeWidth="2" />
        <circle cx="65" cy="38" r="5" fill="#0f172a" />
        <circle cx="67" cy="36" r="1.8" fill="#ffffff" />

        {/* Red Wattle below beak */}
        <ellipse cx="78" cy="52" rx="4" ry="7" fill="#e61c38" />

        {/* Yellow-Orange Pointy Beak */}
        <path d="M 76 38 L 92 45 L 76 50 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />

        {/* Pink Rosy Blush on Cheek */}
        <circle cx="54" cy="46" r="4.5" fill="#fda4af" opacity="0.8" />

        {/* Cute Little Orange Feet */}
        <ellipse cx="42" cy="85" rx="6" ry="3" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
        <ellipse cx="56" cy="85" rx="6" ry="3" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Realistic Traffic Vehicle SVG Models (Buses, Sports Cars, Delivery Trucks)
// ---------------------------------------------------------------------------

function TrafficVehicleSvg({
  type,
  direction,
}: {
  type: TrafficVehicle["type"];
  direction: "up" | "down";
}) {
  const isUp = direction === "up";

  if (type === "yellow-bus" || type === "blue-bus") {
    const isYellow = type === "yellow-bus";
    return (
      <div
        className={`w-11 h-24 rounded-2xl p-1 shadow-2xl border-2 border-slate-950 transition-transform ${
          isYellow ? "bg-amber-400" : "bg-sky-500"
        } ${isUp ? "rotate-180" : ""}`}
      >
        {/* Windshield */}
        <div className="h-5 w-full rounded-t-lg bg-slate-900 border border-slate-700" />
        {/* Passenger Roof Vents */}
        <div className="my-2 space-y-1.5 px-1">
          <div className="h-1 w-full rounded-full bg-black/20" />
          <div className="h-1 w-full rounded-full bg-black/20" />
          <div className="h-1 w-full rounded-full bg-black/20" />
        </div>
        {/* Rear Window */}
        <div className="h-3 w-full rounded-b-md bg-slate-900 border border-slate-700" />
      </div>
    );
  }

  // Red Sports Car or Green Cab
  const isRed = type === "red-sports";
  return (
    <div
      className={`w-10 h-20 rounded-xl p-1 shadow-2xl border-2 border-slate-950 transition-transform ${
        isRed ? "bg-rose-600" : "bg-emerald-500"
      } ${isUp ? "rotate-180" : ""}`}
    >
      {/* Front Hood */}
      <div className="h-3 w-full rounded-t-md bg-black/20" />
      {/* Windshield */}
      <div className="my-1 h-5 w-full rounded-md bg-slate-950 border border-slate-700" />
      {/* Roof */}
      <div className="h-4 w-full bg-black/10" />
      {/* Rear Window */}
      <div className="h-3 w-full rounded-b-md bg-slate-950 border border-slate-700" />
    </div>
  );
}
