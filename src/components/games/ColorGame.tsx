import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { formatCoins, HOUSE_EDGE } from "@/lib/games";
import { playSfx } from "@/lib/sound";
import { recordPublicBigWin } from "@/lib/player";
import { useColorTradingSync } from "@/lib/colorSync";
import { HelpCircle, FileText, ChevronLeft, X, Trophy, Check } from "lucide-react";
import confetti from "canvas-confetti";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
  isDeposited?: boolean;
  onRequireDeposit?: () => void;
};

export type PickType =
  | { kind: "color"; value: "green" | "violet" | "red"; label: string; payout: number }
  | { kind: "number"; value: number; label: string; payout: number }
  | { kind: "size"; value: "big" | "small"; label: string; payout: number };

const GREEN_NUMBERS = [1, 3, 7, 9];
const RED_NUMBERS = [2, 4, 6, 8];

/** Determine colors for drawn ball (0 and 5 are split dual-color) */
export function getBallColors(n: number): ("green" | "red" | "violet")[] {
  if (n === 0) return ["red", "violet"];
  if (n === 5) return ["green", "violet"];
  return GREEN_NUMBERS.includes(n) ? ["green"] : ["red"];
}

export function getBallSize(n: number): "big" | "small" {
  return n >= 5 ? "big" : "small";
}

/** Calculate payout multiplier based on pick and drawn number */
export function calculatePayout(pick: PickType, n: number): number {
  if (pick.kind === "number") {
    return pick.value === n ? 9.0 : 0;
  }
  if (pick.kind === "size") {
    return pick.value === getBallSize(n) ? 2.0 : 0;
  }
  const cols = getBallColors(n);
  if (!cols.includes(pick.value)) return 0;
  if (pick.value === "violet") {
    return 4.5;
  }
  // If ball is 0 or 5 (split with violet), plain green/red pays 1.5x (half payout), pure color pays 3x
  return cols.includes("violet") ? 1.5 : 3.0;
}

export type HistoryRecord = {
  id: string;
  period: string;
  number: number;
  size: "big" | "small";
  colors: ("green" | "red" | "violet")[];
  timestamp: number;
};

export type PlayerBet = {
  id: string;
  period: string;
  pick: PickType;
  amount: number;
  settled: boolean;
  won?: boolean;
  payout?: number;
  resultNumber?: number;
};

const INITIAL_PERIOD = "20260823100050999";
let periodCounter = 50999;

function generatePeriodString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  periodCounter += 1;
  return `${yyyy}${mm}${dd}1000${periodCounter}`;
}

const GAME_MODES = [
  { id: "30s", label: "WinGo 30sec", duration: 30 },
  { id: "1m", label: "WinGo 1 Min", duration: 60 },
  { id: "3m", label: "WinGo 3 Min", duration: 180 },
  { id: "5m", label: "WinGo 5 Min", duration: 300 },
];

const MULTIPLIER_PRESETS = [1, 5, 10, 20, 50, 100];
const UNIT_STAKES = [1, 10, 100, 1000];

export function ColorGame({ balance, settle, isDeposited, onRequireDeposit }: Props) {
  const [mode, setMode] = useState("30s");
  const currentDuration = GAME_MODES.find((m) => m.id === mode)?.duration || 30;

  // Cloud & Wall-Clock Global Synced Engine
  const {
    period: currentPeriod,
    secondsRemaining,
    resolveResultForPeriod,
  } = useColorTradingSync(mode, currentDuration);

  // Active bets placed by the player for current & previous periods
  const [activeBets, setActiveBets] = useState<PlayerBet[]>([]);
  const [betHistory, setBetHistory] = useState<PlayerBet[]>([]);

  // Selected pick on the board & bottom betting sheet state
  const [selectedPick, setSelectedPick] = useState<PickType | null>(null);
  const [betDrawerOpen, setBetDrawerOpen] = useState(false);
  const [unitStake, setUnitStake] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Modals
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "chart" | "my">("history");
  const [historyPage, setHistoryPage] = useState(1);

  // Big Win Modal State
  const [winModalData, setWinModalData] = useState<{
    amount: number;
    multiplier: number;
    resultNumber: number;
    period: string;
    pickLabel: string;
  } | null>(null);

  // Game History List (matching authentic WinGo history)
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([
    {
      id: "h-1",
      period: "20260823100050997",
      number: 0,
      size: "small",
      colors: ["red", "violet"],
      timestamp: 1724400000000,
    },
    {
      id: "h-2",
      period: "20260823100050996",
      number: 4,
      size: "small",
      colors: ["red"],
      timestamp: 1724399970000,
    },
    {
      id: "h-3",
      period: "20260823100050995",
      number: 5,
      size: "big",
      colors: ["green", "violet"],
      timestamp: 1724399940000,
    },
    {
      id: "h-4",
      period: "20260823100050994",
      number: 3,
      size: "small",
      colors: ["green"],
      timestamp: 1724399910000,
    },
    {
      id: "h-5",
      period: "20260823100050993",
      number: 4,
      size: "small",
      colors: ["red"],
      timestamp: 1724399880000,
    },
    {
      id: "h-6",
      period: "20260823100050992",
      number: 8,
      size: "big",
      colors: ["red"],
      timestamp: 1724399850000,
    },
    {
      id: "h-7",
      period: "20260823100050991",
      number: 7,
      size: "big",
      colors: ["green"],
      timestamp: 1724399820000,
    },
    {
      id: "h-8",
      period: "20260823100050990",
      number: 1,
      size: "small",
      colors: ["green"],
      timestamp: 1724399790000,
    },
    {
      id: "h-9",
      period: "20260823100050989",
      number: 2,
      size: "small",
      colors: ["red"],
      timestamp: 1724399760000,
    },
    {
      id: "h-10",
      period: "20260823100050988",
      number: 9,
      size: "big",
      colors: ["green"],
      timestamp: 1724399730000,
    },
  ]);

  // Keep refs for callbacks
  const activeBetsRef = useRef(activeBets);
  activeBetsRef.current = activeBets;
  const prevPeriodRef = useRef(currentPeriod);
  const resolveRef = useRef(resolveResultForPeriod);
  resolveRef.current = resolveResultForPeriod;

  // Resolution of drawing when timer reaches 0 / period rolls over
  const handleDrawResolution = useCallback(
    (periodToResolve: string) => {
      const {
        number: drawnNumber,
        colors: drawnColors,
        size: drawnSize,
      } = resolveRef.current(periodToResolve);

      const newRecord: HistoryRecord = {
        id: `rec-${periodToResolve}`,
        period: periodToResolve,
        number: drawnNumber,
        size: drawnSize,
        colors: drawnColors,
        timestamp: Date.now(),
      };

      setHistoryList((prev) => {
        if (prev.some((x) => x.period === periodToResolve)) return prev;
        return [newRecord, ...prev.slice(0, 49)];
      });

      // Check player bets for this resolved period
      const betsForPeriod = activeBetsRef.current.filter((b) => b.period === periodToResolve);

      if (betsForPeriod.length > 0) {
        let totalWon = 0;
        let maxMultiplier = 0;
        let winningPickLabel = "";

        const settledBatch = betsForPeriod.map((b) => {
          const mult = calculatePayout(b.pick, drawnNumber);
          const won = mult > 0;
          const payout = won ? b.amount * mult : 0;
          if (won) {
            totalWon += payout;
            if (mult > maxMultiplier) {
              maxMultiplier = mult;
              winningPickLabel = b.pick.label;
            }
          }
          return {
            ...b,
            settled: true,
            won,
            payout,
            resultNumber: drawnNumber,
          };
        });

        // Settle in player balance
        settledBatch.forEach((b) => {
          const mult = calculatePayout(b.pick, drawnNumber);
          const payout = mult > 0 ? b.amount * mult : 0;
          void settle(
            mult,
            {
              game: "color-trading",
              period: periodToResolve,
              pick: `${b.pick.kind}:${b.pick.value}`,
              result: drawnNumber,
              payout,
            },
            b.amount,
          );
        });

        setBetHistory((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const uniqueToAdd = settledBatch.filter((x) => !existingIds.has(x.id));
          return [...uniqueToAdd, ...prev];
        });

        setActiveBets((prev) => prev.filter((b) => b.period !== periodToResolve));

        if (totalWon > 0) {
          playSfx("bigwin");
          recordPublicBigWin("color-trading", maxMultiplier);
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
            colors: ["#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#ffffff"],
          });
          setWinModalData({
            amount: totalWon,
            multiplier: maxMultiplier,
            resultNumber: drawnNumber,
            period: periodToResolve,
            pickLabel: winningPickLabel,
          });
          toast.success(`🎉 Draw: ${drawnNumber}! You won ₹${formatCoins(totalWon)}!`);
        } else {
          playSfx("lose");
          toast.error(`Draw: ${drawnNumber} (${drawnColors.join("+")}). Better luck next round!`);
        }
      }
    },
    [settle],
  );

  // Synchronized resolution on period change or when countdown hits 0
  useEffect(() => {
    if (prevPeriodRef.current !== currentPeriod) {
      handleDrawResolution(prevPeriodRef.current);
      prevPeriodRef.current = currentPeriod;
    }
  }, [currentPeriod, handleDrawResolution]);

  // Audio tick on 5 seconds countdown
  useEffect(() => {
    if (secondsRemaining <= 5 && secondsRemaining > 0) {
      playSfx("tick");
    }
  }, [secondsRemaining]);

  // Select pick on the board -> Immediately open bottom drawer as shown in screenshot!
  const handleSelectPick = (pick: PickType) => {
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    if (secondsRemaining <= 5) {
      toast.error("Betting is locked in the final 5 seconds.");
      return;
    }
    playSfx("click");
    setSelectedPick(pick);
    setBetDrawerOpen(true);
  };

  // Place bet from drawer
  const handlePlaceBetNow = () => {
    if (isDeposited === false && onRequireDeposit) {
      setBetDrawerOpen(false);
      onRequireDeposit();
      return;
    }
    if (!selectedPick) {
      toast.error("Please select a Color or Number ball first!");
      return;
    }
    if (secondsRemaining <= 5) {
      toast.error("Time is up! Bet cannot be placed in the final 5 seconds.");
      return;
    }
    const totalAmount = unitStake * quantity * multiplier;
    if (totalAmount <= 0) {
      toast.error("Invalid bet amount");
      return;
    }
    if (totalAmount > balance && balance > 0) {
      toast.error(`Insufficient balance (₹${balance.toFixed(2)}) for ₹${totalAmount} bet.`);
      return;
    }

    const newBet: PlayerBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      period: currentPeriod,
      pick: selectedPick,
      amount: totalAmount,
      settled: false,
    };

    setActiveBets((prev) => [...prev, newBet]);
    playSfx("chip");
    toast.success(
      `Bet Confirmed! ₹${totalAmount} on ${selectedPick.label} for Period ${currentPeriod.slice(-5)}`,
    );
    setBetDrawerOpen(false);
  };

  // Determine theme color for drawer based on selection
  const getDrawerColorTheme = () => {
    if (!selectedPick)
      return {
        bg: "from-rose-500 to-red-600",
        color: "#e63946",
        text: "text-rose-400",
        activeBg: "bg-rose-500",
      };
    if (selectedPick.kind === "color") {
      if (selectedPick.value === "green")
        return {
          bg: "from-emerald-500 to-green-600",
          color: "#10b981",
          text: "text-emerald-400",
          activeBg: "bg-emerald-500",
        };
      if (selectedPick.value === "violet")
        return {
          bg: "from-purple-500 to-violet-600",
          color: "#8b3df5",
          text: "text-purple-400",
          activeBg: "bg-purple-600",
        };
      return {
        bg: "from-rose-500 to-red-600",
        color: "#e63946",
        text: "text-rose-400",
        activeBg: "bg-rose-500",
      };
    }
    if (selectedPick.kind === "number") {
      const colors = getBallColors(selectedPick.value);
      if (colors.includes("green") && !colors.includes("red")) {
        return {
          bg: "from-emerald-500 to-green-600",
          color: "#10b981",
          text: "text-emerald-400",
          activeBg: "bg-emerald-500",
        };
      }
      if (colors.includes("violet") && !colors.includes("green") && !colors.includes("red")) {
        return {
          bg: "from-purple-500 to-violet-600",
          color: "#8b3df5",
          text: "text-purple-400",
          activeBg: "bg-purple-600",
        };
      }
      return {
        bg: "from-[#ff5964] to-[#f43f5e]",
        color: "#f43f5e",
        text: "text-rose-400",
        activeBg: "bg-[#f43f5e]",
      };
    }
    if (selectedPick.value === "big") {
      return {
        bg: "from-amber-500 to-yellow-600",
        color: "#f59e0b",
        text: "text-amber-400",
        activeBg: "bg-amber-500",
      };
    }
    return {
      bg: "from-blue-500 to-indigo-600",
      color: "#3b82f6",
      text: "text-blue-400",
      activeBg: "bg-blue-500",
    };
  };

  const drawerTheme = getDrawerColorTheme();
  const isLockingSeconds = secondsRemaining <= 5;

  // Split timer digits
  const minDigits = String(Math.floor(secondsRemaining / 60))
    .padStart(2, "0")
    .split("");
  const secDigits = String(secondsRemaining % 60)
    .padStart(2, "0")
    .split("");

  // Last 5 history records for ticket card
  const last5Records = historyList.slice(0, 5);

  return (
    <div className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-2xl bg-[#080d22] pb-16 font-sans text-white shadow-2xl">
      {/* 1. Top Navigation Bar (Clean, no Jalwa/chat clutter) */}
      <div className="flex items-center justify-between border-b border-[#141b3a] bg-[#090f26] px-3.5 py-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <span className="font-display text-lg font-black tracking-wide text-white">
            Win<span className="text-emerald-400">Go</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowHowToPlay(true)}
          className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 active:scale-95"
          aria-label="Rules"
        >
          <HelpCircle className="size-5 text-slate-300" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* 2. WinGo Mode Selector (30sec / 1 Min / 3 Min / 5 Min) */}
        <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-[#060a1c] p-1 border border-[#141d40]">
          {GAME_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  playSfx("click");
                  setMode(m.id);
                  setSecondsRemaining(m.duration);
                }}
                className={`flex h-11 flex-col items-center justify-center rounded-lg text-center transition active:scale-95 ${
                  active
                    ? "bg-[#2fe2aa] text-slate-950 font-black shadow-md"
                    : "bg-[#0c132e] text-[#5eead4] hover:bg-[#121c45] font-bold"
                }`}
              >
                <span className="text-[11px] leading-tight">{m.label.split(" ")[0]}</span>
                <span className="text-[10px] opacity-90 leading-tight">
                  {m.label.split(" ").slice(1).join(" ")}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Top Ticket Card (Mint Gradient with Scalloped Edge & Digital Countdown) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2ee2a9] via-[#2bd9a2] to-[#25cb96] p-3 text-slate-950 shadow-lg">
          {/* Left and right circular notches */}
          <div className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-[#080d22]" />
          <div className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-[#080d22]" />

          <div className="grid grid-cols-2 gap-2">
            {/* Left Half: How to play + Mode + Last 5 Balls */}
            <div className="pr-1 text-left">
              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-900/40 bg-slate-950/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 transition hover:bg-slate-950/20 active:scale-95"
              >
                <FileText className="size-3" />
                <span>How to play</span>
              </button>

              <p className="mt-1 font-display text-xs font-bold text-slate-950">
                {GAME_MODES.find((m) => m.id === mode)?.label}
              </p>

              {/* Last 5 Drawn Balls */}
              <div className="mt-2 flex items-center gap-1.5">
                {last5Records.map((rec, i) => {
                  const colors = rec.colors;
                  const isDual = colors.length === 2;
                  return (
                    <div
                      key={`top-ball-${rec.id || i}`}
                      className="flex size-6 items-center justify-center rounded-full border border-white/50 text-[11px] font-black text-white shadow-sm"
                      style={{
                        background: isDual
                          ? colors[0] === "green"
                            ? "linear-gradient(135deg, #10b981 50%, #9333ea 50%)"
                            : "linear-gradient(135deg, #ef4444 50%, #9333ea 50%)"
                          : colors[0] === "green"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {rec.number}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Half: Digital Time Remaining + Period Number */}
            <div className="flex flex-col items-end justify-between pl-1 border-l border-slate-900/15">
              <span className="font-display text-[11px] font-bold text-slate-900">
                Time remaining
              </span>

              {/* Digital Countdown Timer Boxes */}
              <div className="flex items-center gap-1 font-mono font-black">
                <div className="flex size-6 items-center justify-center rounded bg-[#091129] text-xs text-[#2fe2aa] shadow-inner">
                  {minDigits[0]}
                </div>
                <div className="flex size-6 items-center justify-center rounded bg-[#091129] text-xs text-[#2fe2aa] shadow-inner">
                  {minDigits[1]}
                </div>
                <span className="text-sm font-black text-slate-900">:</span>
                <div className="flex size-6 items-center justify-center rounded bg-[#091129] text-xs text-[#2fe2aa] shadow-inner">
                  {secDigits[0]}
                </div>
                <div className="flex size-6 items-center justify-center rounded bg-[#091129] text-xs text-[#2fe2aa] shadow-inner">
                  {secDigits[1]}
                </div>
              </div>

              {/* Period Number */}
              <p className="font-mono text-[10px] font-bold tracking-tight text-slate-900/80">
                {currentPeriod}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Main Betting Board Area */}
        <div className="relative overflow-hidden rounded-2xl border border-[#141d40] bg-[#0c132e] p-3 shadow-md space-y-3">
          {/* Row 1: Green / Violet / Red */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isLockingSeconds}
              onClick={() =>
                handleSelectPick({
                  kind: "color",
                  value: "green",
                  label: "Green",
                  payout: 3,
                })
              }
              className="relative h-11 rounded-xl bg-[#18b368] font-display text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              Green
            </button>

            <button
              type="button"
              disabled={isLockingSeconds}
              onClick={() =>
                handleSelectPick({
                  kind: "color",
                  value: "violet",
                  label: "Violet",
                  payout: 4.5,
                })
              }
              className="relative h-11 rounded-xl bg-[#8b3df5] font-display text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              Violet
            </button>

            <button
              type="button"
              disabled={isLockingSeconds}
              onClick={() =>
                handleSelectPick({
                  kind: "color",
                  value: "red",
                  label: "Red",
                  payout: 3,
                })
              }
              className="relative h-11 rounded-xl bg-[#e63946] font-display text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              Red
            </button>
          </div>

          {/* Row 2: 10 Number Balls (0-9) */}
          <div className="grid grid-cols-5 gap-2.5 rounded-xl bg-[#080d21] p-2.5 border border-[#161f42]">
            {Array.from({ length: 10 }, (_, n) => {
              const colors = getBallColors(n);
              const isDual = colors.length === 2;
              return (
                <button
                  key={`ball-btn-${n}`}
                  type="button"
                  disabled={isLockingSeconds}
                  onClick={() =>
                    handleSelectPick({
                      kind: "number",
                      value: n,
                      label: `${n}`,
                      payout: 9,
                    })
                  }
                  className="group relative flex aspect-square flex-col items-center justify-center rounded-full p-1 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <div
                    className="relative flex size-full items-center justify-center rounded-full shadow-lg"
                    style={{
                      background: isDual
                        ? colors[0] === "green"
                          ? "linear-gradient(135deg, #10b981 50%, #9333ea 50%)"
                          : "linear-gradient(135deg, #ef4444 50%, #9333ea 50%)"
                        : colors[0] === "green"
                          ? "radial-gradient(circle at 35% 30%, #4ade80 0%, #16a34a 60%, #14532d 100%)"
                          : "radial-gradient(circle at 35% 30%, #f87171 0%, #dc2626 60%, #7f1d1d 100%)",
                      border: "2px solid rgba(255, 255, 255, 0.35)",
                      boxShadow:
                        "0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
                    }}
                  >
                    <span className="font-display text-lg font-black text-white drop-shadow-md">
                      {n}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Row 3: Big / Small */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLockingSeconds}
              onClick={() =>
                handleSelectPick({
                  kind: "size",
                  value: "big",
                  label: "Big",
                  payout: 2,
                })
              }
              className="h-10 rounded-xl bg-[#e69123] font-display text-sm font-black text-slate-950 shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              Big
            </button>

            <button
              type="button"
              disabled={isLockingSeconds}
              onClick={() =>
                handleSelectPick({
                  kind: "size",
                  value: "small",
                  label: "Small",
                  payout: 2,
                })
              }
              className="h-10 rounded-xl bg-[#3a69b5] font-display text-sm font-black text-white shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              Small
            </button>
          </div>

          {/* 5-second Lockout Overlay */}
          {isLockingSeconds && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b1ed9] backdrop-blur-[2px] animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-32 w-24 items-center justify-center rounded-2xl border-2 border-[#162a5e] bg-[#0c1a45] shadow-2xl">
                  <span className="font-mono text-6xl font-black text-[#2ee2a9] drop-shadow-[0_0_20px_#2ee2a9aa]">
                    0
                  </span>
                </div>
                <div className="flex h-32 w-24 items-center justify-center rounded-2xl border-2 border-[#162a5e] bg-[#0c1a45] shadow-2xl">
                  <span className="font-mono text-6xl font-black text-[#2ee2a9] drop-shadow-[0_0_20px_#2ee2a9aa]">
                    {secondsRemaining}
                  </span>
                </div>
              </div>
              <p className="mt-2 font-display text-xs font-bold uppercase tracking-wider text-slate-300">
                Drawing in {secondsRemaining}s…
              </p>
            </div>
          )}
        </div>

        {/* 5. Game Record History Tabs */}
        <div className="overflow-hidden rounded-2xl border border-[#141d40] bg-[#0c132e]">
          {/* Tab Navigation */}
          <div className="flex border-b border-[#141d40] bg-[#080d21] text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2.5 text-center transition ${
                activeTab === "history"
                  ? "border-b-2 border-[#2fe2aa] text-[#2fe2aa]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Game History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chart")}
              className={`flex-1 py-2.5 text-center transition ${
                activeTab === "chart"
                  ? "border-b-2 border-[#2fe2aa] text-[#2fe2aa]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Chart
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("my")}
              className={`flex-1 py-2.5 text-center transition ${
                activeTab === "my"
                  ? "border-b-2 border-[#2fe2aa] text-[#2fe2aa]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              My Bets ({activeBets.length + betHistory.length})
            </button>
          </div>

          {/* TAB 1: Game History List */}
          {activeTab === "history" && (
            <div>
              <div className="grid grid-cols-4 bg-[#080d21] p-2 text-center text-[10px] font-bold text-slate-400">
                <span>Period</span>
                <span>Number</span>
                <span>Big/Small</span>
                <span>Color</span>
              </div>
              <div className="divide-y divide-[#141d40]">
                {historyList.slice((historyPage - 1) * 10, historyPage * 10).map((r) => {
                  const colors = r.colors;
                  const isDual = colors.length === 2;
                  return (
                    <div
                      key={`hist-row-${r.id || r.period}`}
                      className="grid grid-cols-4 items-center p-2 text-center text-xs font-mono"
                    >
                      <span className="text-[11px] text-slate-300">{r.period.slice(-5)}</span>
                      <div className="flex justify-center">
                        <div
                          className="flex size-6 items-center justify-center rounded-full text-xs font-black text-white shadow-sm"
                          style={{
                            background: isDual
                              ? colors[0] === "green"
                                ? "linear-gradient(135deg, #10b981 50%, #9333ea 50%)"
                                : "linear-gradient(135deg, #ef4444 50%, #9333ea 50%)"
                              : colors[0] === "green"
                                ? "#10b981"
                                : "#ef4444",
                          }}
                        >
                          {r.number}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold capitalize ${r.size === "big" ? "text-amber-400" : "text-sky-400"}`}
                      >
                        {r.size}
                      </span>
                      <div className="flex justify-center gap-1">
                        {colors.map((c) => (
                          <div
                            key={c}
                            className={`size-2.5 rounded-full ${
                              c === "green"
                                ? "bg-emerald-500"
                                : c === "red"
                                  ? "bg-rose-500"
                                  : "bg-purple-500"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-[#141d40] bg-[#080d21] p-2 text-xs">
                <span className="text-[10px] text-slate-400">
                  Page {historyPage} of {Math.max(1, Math.ceil(historyList.length / 10))}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="flex size-6 items-center justify-center rounded bg-[#10193d] text-slate-300 disabled:opacity-30"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    disabled={historyPage >= Math.ceil(historyList.length / 10)}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="flex size-6 items-center justify-center rounded bg-[#10193d] text-slate-300 disabled:opacity-30"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Trend Chart */}
          {activeTab === "chart" && (
            <div className="p-3 space-y-2">
              {historyList.slice(0, 8).map((r, idx) => (
                <div
                  key={`chart-row-${r.id || r.period}-${idx}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-12 font-mono text-[10px] text-slate-400">
                    {r.period.slice(-4)}
                  </span>
                  <div className="grid flex-1 grid-cols-10 gap-1 text-center">
                    {Array.from({ length: 10 }, (_, n) => (
                      <div
                        key={`cell-${r.period}-${n}`}
                        className={`flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                          n === r.number
                            ? r.colors[0] === "green"
                              ? "bg-emerald-500 text-slate-950 font-black ring-1 ring-white"
                              : "bg-rose-500 text-white font-black ring-1 ring-white"
                            : "bg-[#080d21] text-slate-600"
                        }`}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: My History */}
          {activeTab === "my" && (
            <div className="divide-y divide-[#141d40]">
              {activeBets.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <p className="font-bold text-white">
                      {b.pick.label} · Period {b.period.slice(-4)}
                    </p>
                    <p className="font-mono text-[10px] text-amber-400">Waiting for draw…</p>
                  </div>
                  <span className="font-mono font-black text-white">₹{b.amount}</span>
                </div>
              ))}
              {betHistory.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div>
                    <p className="font-bold text-white">
                      {b.pick.label} · Period {b.period.slice(-4)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      Stake: ₹{b.amount} · Result: {b.resultNumber ?? "-"}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-black ${b.won ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {b.won ? `+₹${formatCoins(b.payout || 0)}` : `-₹${b.amount}`}
                  </span>
                </div>
              ))}
              {activeBets.length === 0 && betHistory.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No bets placed yet. Tap any ball or color above!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. BOTTOM DRAWER / BETTING SHEET (MATCHING EXACTLY USER SCREENSHOT) */}
      {betDrawerOpen && selectedPick && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBetDrawerOpen(false);
          }}
        >
          <div className="relative w-full max-w-md mx-auto overflow-hidden rounded-t-[28px] bg-[#070e24] shadow-2xl animate-in slide-in-from-bottom duration-200 border-t border-[#1e2a5a]">
            {/* Top Curved Colored Tab Header (Red/Green/Violet) */}
            <div
              className={`relative bg-gradient-to-r ${drawerTheme.bg} px-4 pt-3 pb-3 text-center text-white`}
              style={{
                borderTopLeftRadius: "28px",
                borderTopRightRadius: "28px",
              }}
            >
              {/* Header Title: Mode */}
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold tracking-wide text-white/95">
                  {GAME_MODES.find((m) => m.id === mode)?.label}
                </span>
                <span className="font-mono text-xs font-bold text-white/90">
                  {secondsRemaining}s left
                </span>
              </div>

              {/* White Pill: Current Selection */}
              <div className="mt-2 inline-flex min-w-[200px] items-center justify-center rounded-lg bg-white px-6 py-1.5 shadow-md">
                <span className="font-display text-sm font-black text-slate-900">
                  Select {selectedPick.label}
                </span>
              </div>

              {/* Quick Switch Row inside drawer: Color / Number switcher */}
              <div className="mt-3 flex items-center justify-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    playSfx("click");
                    setSelectedPick({ kind: "color", value: "green", label: "Green", payout: 3 });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    selectedPick.kind === "color" && selectedPick.value === "green"
                      ? "bg-emerald-400 text-slate-950 shadow-md ring-2 ring-white"
                      : "bg-emerald-700/80 text-white hover:bg-emerald-600"
                  }`}
                >
                  Green
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx("click");
                    setSelectedPick({
                      kind: "color",
                      value: "violet",
                      label: "Violet",
                      payout: 4.5,
                    });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    selectedPick.kind === "color" && selectedPick.value === "violet"
                      ? "bg-purple-400 text-slate-950 shadow-md ring-2 ring-white"
                      : "bg-purple-700/80 text-white hover:bg-purple-600"
                  }`}
                >
                  Violet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx("click");
                    setSelectedPick({ kind: "color", value: "red", label: "Red", payout: 3 });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                    selectedPick.kind === "color" && selectedPick.value === "red"
                      ? "bg-rose-400 text-slate-950 shadow-md ring-2 ring-white"
                      : "bg-rose-700/80 text-white hover:bg-rose-600"
                  }`}
                >
                  Red
                </button>
                <div className="h-4 w-px bg-white/30 mx-0.5" />
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={`quick-n-${n}`}
                    type="button"
                    onClick={() => {
                      playSfx("click");
                      setSelectedPick({ kind: "number", value: n, label: `${n}`, payout: 9 });
                    }}
                    className={`size-6 rounded-full flex items-center justify-center text-[11px] font-black transition ${
                      selectedPick.kind === "number" && selectedPick.value === n
                        ? "bg-white text-slate-950 shadow-lg ring-2 ring-white scale-110"
                        : "bg-black/30 text-white hover:bg-black/50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Navy Blue Body */}
            <div className="bg-[#070e24] px-4 pt-4 pb-3 space-y-4">
              {/* Row 1: Balance chips */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Balance</span>
                <div className="flex items-center gap-1.5">
                  {UNIT_STAKES.map((u) => {
                    const active = unitStake === u;
                    return (
                      <button
                        key={`unit-chip-${u}`}
                        type="button"
                        onClick={() => {
                          playSfx("click");
                          setUnitStake(u);
                        }}
                        className={`min-w-[50px] h-8.5 rounded-lg text-xs font-bold transition ${
                          active
                            ? `${drawerTheme.activeBg} text-white shadow-md font-black ring-1 ring-white/50`
                            : "bg-[#0e193d] text-[#4d71b8] hover:bg-[#142352]"
                        }`}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Quantity Stepper */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSfx("click");
                      setQuantity((q) => Math.max(1, q - 1));
                    }}
                    className={`flex size-8.5 items-center justify-center rounded-lg ${drawerTheme.activeBg} text-lg font-black text-white active:scale-95 shadow-sm hover:brightness-110`}
                  >
                    -
                  </button>

                  <div className="flex h-8.5 min-w-[72px] items-center justify-center rounded-lg bg-[#0c1433] px-3 font-mono text-sm font-bold text-white border border-[#1b254d]">
                    {quantity}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playSfx("click");
                      setQuantity((q) => q + 1);
                    }}
                    className={`flex size-8.5 items-center justify-center rounded-lg ${drawerTheme.activeBg} text-lg font-black text-white active:scale-95 shadow-sm hover:brightness-110`}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Row 3: Multiplier Shortcuts (X1, X5, X10, X20, X50, X100) */}
              <div className="grid grid-cols-6 gap-1.5">
                {MULTIPLIER_PRESETS.map((m) => {
                  const active = multiplier === m;
                  return (
                    <button
                      key={`mult-btn-${m}`}
                      type="button"
                      onClick={() => {
                        playSfx("chip");
                        setMultiplier(m);
                      }}
                      className={`h-8 rounded-lg font-mono text-xs font-bold transition ${
                        active
                          ? `${drawerTheme.activeBg} text-white shadow-md font-black ring-1 ring-white/50`
                          : "bg-[#0e193d] text-[#4d71b8] hover:bg-[#142352]"
                      }`}
                    >
                      X{m}
                    </button>
                  );
                })}
              </div>

              {/* Row 4: Pre-sale rules agreement */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAgreedTerms(!agreedTerms)}
                  className={`flex size-5 items-center justify-center rounded-full transition ${
                    agreedTerms ? "bg-[#10b981] text-slate-950" : "bg-slate-700 text-transparent"
                  }`}
                >
                  <Check className="size-3.5 stroke-[3]" />
                </button>
                <span
                  className="text-slate-300 select-none cursor-pointer"
                  onClick={() => setAgreedTerms(!agreedTerms)}
                >
                  I agree{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHowToPlay(true);
                    }}
                    className="text-rose-400 hover:underline font-medium"
                  >
                    《Pre-sale rules》
                  </button>
                </span>
              </div>
            </div>

            {/* Row 5: Bottom Action Bar - CANCEL & CONFIRM OPTION */}
            <div className="grid grid-cols-3 h-14 border-t border-[#141e44] bg-[#070e24]">
              {/* Left Option: Cancel */}
              <button
                type="button"
                onClick={() => {
                  playSfx("click");
                  setBetDrawerOpen(false);
                }}
                className="col-span-1 flex items-center justify-center bg-[#0a122e] font-display text-sm font-bold text-slate-300 transition hover:bg-[#111e4d] hover:text-white active:scale-95 border-r border-[#141e44]"
              >
                Cancel
              </button>

              {/* Right Option: Confirm / Total amount */}
              <button
                type="button"
                disabled={
                  !agreedTerms || (balance > 0 && unitStake * quantity * multiplier > balance)
                }
                onClick={handlePlaceBetNow}
                className={`col-span-2 flex items-center justify-center bg-gradient-to-r ${drawerTheme.bg} font-display text-sm font-black text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-50`}
              >
                Total amount ₹{(unitStake * quantity * multiplier).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Big Win Celebration Modal */}
      {winModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-[#1a1208] via-[#140e06] to-[#0d0904] p-6 text-center shadow-[0_0_60px_rgba(245,158,11,0.5)]">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-xl ring-4 ring-amber-400/40 animate-bounce">
              <Trophy className="size-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-black text-amber-400">WINNER!</h2>
            <p className="mt-1 font-mono text-3xl font-black text-emerald-400">
              +₹{formatCoins(winModalData.amount)}
            </p>
            <p className="mt-2 text-xs text-stone-300">
              Period {winModalData.period.slice(-5)} · Draw {winModalData.resultNumber} (
              {winModalData.multiplier}X)
            </p>
            <button
              type="button"
              onClick={() => setWinModalData(null)}
              className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 font-display text-base font-black text-slate-950 shadow-xl transition hover:brightness-110 active:scale-95"
            >
              Collect ₹{formatCoins(winModalData.amount)}
            </button>
          </div>
        </div>
      )}

      {/* 8. How To Play Rules Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#141d40] bg-[#0c132e] p-5 text-left text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#141d40] pb-3">
              <h3 className="font-display text-base font-bold text-white">
                WinGo Rules &amp; Payouts
              </h3>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="flex size-7 items-center justify-center rounded-full bg-[#162045] text-slate-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-slate-300 max-h-80 overflow-y-auto pr-1">
              <p>
                <strong>1. Game Period:</strong> A lottery draw takes place every 30s, 1m, 3m, or
                5m.
              </p>
              <p>
                <strong>2. Color Prediction:</strong>
                <br />• <strong>Green (1, 3, 7, 9):</strong> Pays <strong>3.0x</strong> (1.5x if 5
                drawn)
                <br />• <strong>Red (2, 4, 6, 8):</strong> Pays <strong>3.0x</strong> (1.5x if 0
                drawn)
                <br />• <strong>Violet (0, 5):</strong> Pays <strong>4.5x</strong>
              </p>
              <p>
                <strong>3. Number (0-9):</strong> Exact number prediction pays <strong>9.0x</strong>
                .
              </p>
              <p>
                <strong>4. Big / Small:</strong>
                <br />• Big (5-9) pays 2.0x
                <br />• Small (0-4) pays 2.0x
              </p>
              <p>
                <strong>5. Pre-Sale Rules:</strong> Betting is locked during the final 5 seconds
                before draw.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              className="mt-4 h-10 w-full rounded-xl bg-[#2fe2aa] font-display text-xs font-bold text-slate-950"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
