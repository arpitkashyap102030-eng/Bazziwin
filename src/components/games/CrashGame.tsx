import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GameDef } from "@/lib/games";
import { formatCoins } from "@/lib/games";
import { useAppConfig } from "@/lib/appConfig";
import { useAviatorSync } from "@/lib/aviatorSync";
import { playSfx } from "@/lib/sound";
import { startAviatorEngine, updateAviatorEngine, stopAviatorEngine } from "@/lib/aviatorAudio";
import {
  MoreHorizontal,
  Minus,
  Plus,
  ShieldCheck,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

type Props = {
  game: GameDef;
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
  isDeposited?: boolean;
  onRequireDeposit?: () => void;
};

type Phase = "betting" | "flying" | "crashed";

type BetPanelState = {
  id: number;
  stake: number;
  queued: boolean;
  active: boolean;
  cashedAt: number | null;
  autoBet: boolean;
  autoCashout: boolean;
  autoCashoutVal: string;
  activeTab: "bet" | "auto";
};

type LivePlayer = {
  id: string;
  username: string;
  avatar: string;
  stake: number;
  cashoutTarget: number;
  cashedAt: number | null;
  winAmount: number | null;
};

const BETTING_MS = 5000;

// High quality avatar emojis / symbols
const AVATAR_ICONS = [
  "👍",
  "🥷",
  "🪖",
  "🦒",
  "👄",
  "✈️",
  "💀",
  "🐱",
  "🏎️",
  "🦅",
  "🚀",
  "🎯",
  "👑",
  "💎",
];

const PRESET_AMOUNTS = [100, 200, 500, 1000];

function generateBotPlayers(): LivePlayer[] {
  const stakes = [
    8000, 8000, 8000, 8000, 7000, 7000, 7000, 7000, 5000, 3000, 2000, 1000, 500, 200, 100, 50, 10,
  ];
  const charPool = "0123456789abcdef";
  const defaultTargets = [
    1.35, 2.1, 1.85, 4.2, 1.5, 3.1, 1.25, 2.8, 1.95, 5.0, 1.4, 2.05, 1.7, 3.5, 1.2, 2.45, 1.6,
  ];

  return stakes.map((stake, idx) => {
    const c = charPool[idx % charPool.length];
    const username = `1***${c}`;
    const avatar = AVATAR_ICONS[idx % AVATAR_ICONS.length];
    const cashoutTarget = defaultTargets[idx % defaultTargets.length];

    return {
      id: `bot-${idx}`,
      username,
      avatar,
      stake,
      cashoutTarget,
      cashedAt: null,
      winAmount: null,
    };
  });
}

export function CrashGame({
  game,
  bet,
  balance,
  busy,
  settle,
  isDeposited,
  onRequireDeposit,
}: Props) {
  const aviator = useAviatorSync();
  const {
    phase,
    multiplier: mult,
    countdownMs: countdown,
    history,
    flewAwayMultiplier: flewAwayMult,
  } = aviator;

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // History Dropdown / Modal ("जहां थ्री डॉट है, वहां हिस्ट्री चमके")
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "high" | "huge">("all");

  // Dual Bet Panels
  const [showSecondPanel, setShowSecondPanel] = useState(true);
  const [panels, setPanels] = useState<BetPanelState[]>([
    {
      id: 1,
      stake: Math.max(10, bet),
      queued: false,
      active: false,
      cashedAt: null,
      autoBet: false,
      autoCashout: false,
      autoCashoutVal: "2.00",
      activeTab: "bet",
    },
    {
      id: 2,
      stake: Math.max(10, bet),
      queued: false,
      active: false,
      cashedAt: null,
      autoBet: false,
      autoCashout: false,
      autoCashoutVal: "2.00",
      activeTab: "bet",
    },
  ]);

  // Live Multi-Player Bets
  const [livePlayers, setLivePlayers] = useState<LivePlayer[]>(() => generateBotPlayers());
  const [previousPlayers, setPreviousPlayers] = useState<LivePlayer[]>([]);
  const [activeBetsTab, setActiveBetsTab] = useState<"all" | "previous" | "top">("all");

  // Online Players Count
  const [onlineCount, setOnlineCount] = useState(547);

  // References
  const multRef = useRef(mult);
  multRef.current = mult;

  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  const settleRef = useRef(settle);
  settleRef.current = settle;

  const prevPhaseRef = useRef<Phase>(phase);

  useEffect(() => {
    return () => {
      stopAviatorEngine(false);
    };
  }, []);

  /* ---- Cash out a specific bet panel ---- */
  const cashOut = useCallback(
    (panelId: number) => {
      const p = panelsRef.current.find((x) => x.id === panelId);
      if (!p || !p.active || p.cashedAt !== null) return;
      const currentMult = multRef.current;

      setPanels((prev) =>
        prev.map((x) => (x.id === panelId ? { ...x, cashedAt: currentMult } : x)),
      );

      playSfx("cashout");
      toast.success(
        `🎉 Cashed out at ${currentMult.toFixed(2)}x (+₹${formatCoins(p.stake * currentMult)})`,
      );
      void settleRef.current(
        currentMult,
        { crashAt: flewAwayMult, cashedAt: currentMult },
        p.stake,
      );
    },
    [flewAwayMult],
  );

  const cashOutRef = useRef(cashOut);
  cashOutRef.current = cashOut;

  // React to phase transitions from the global synchronized loop
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (prevPhase !== "flying" && phase === "flying") {
      // Round Takeoff: Activate queued panel bets
      setPanels((prev) =>
        prev.map((p) => (p.queued ? { ...p, queued: false, active: true, cashedAt: null } : p)),
      );
      setLivePlayers(generateBotPlayers());
      setOnlineCount(Math.floor(450 + Math.random() * 650));

      if (soundEnabled) {
        startAviatorEngine();
      }
    } else if (prevPhase === "flying" && phase === "crashed") {
      // Plane Crashed: Stop engine and settle losers
      if (soundEnabled) {
        stopAviatorEngine(true);
        playSfx("lose");
      }

      // Mark remaining bots as lost or settled
      setLivePlayers((bots) => {
        const settled = bots.map((b) => ({
          ...b,
          cashedAt: b.cashedAt,
          winAmount: b.cashedAt ? b.stake * b.cashedAt : null,
        }));
        setPreviousPlayers(settled);
        return settled;
      });

      // Settle active player panels that did not cash out
      const losers = panelsRef.current.filter((p) => p.active && p.cashedAt === null);
      losers.forEach((p) => {
        void settleRef.current(0, { crashAt: flewAwayMult, cashedAt: null }, p.stake);
      });

      if (losers.length > 0) {
        toast.error(`Flew away at ${flewAwayMult.toFixed(2)}x`);
      }

      // Reset panel states while respecting auto-bet
      setPanels((prev) =>
        prev.map((p) => ({
          ...p,
          active: false,
          cashedAt: null,
          queued: p.autoBet ? true : false,
        })),
      );
    }
  }, [phase, flewAwayMult, soundEnabled]);

  // Audio update during flying & auto cashout checker
  useEffect(() => {
    if (phase === "flying") {
      if (soundEnabled) {
        updateAviatorEngine(mult);
      }

      // Auto-cashout checker
      panelsRef.current.forEach((p) => {
        if (p.active && p.cashedAt === null && p.autoCashout) {
          const target = parseFloat(p.autoCashoutVal);
          if (!isNaN(target) && target >= 1.01 && mult >= target) {
            cashOutRef.current(p.id);
          }
        }
      });

      // Update bot cashouts dynamically
      setLivePlayers((players) =>
        players.map((bot) => {
          if (bot.cashedAt === null && mult >= bot.cashoutTarget) {
            return {
              ...bot,
              cashedAt: bot.cashoutTarget,
              winAmount: Math.round(bot.stake * bot.cashoutTarget * 100) / 100,
            };
          }
          return bot;
        }),
      );
    }
  }, [mult, phase, soundEnabled]);

  /* ---- Panel helpers ---- */
  const toggleQueue = (panelId: number) => {
    const p = panels.find((x) => x.id === panelId);
    if (!p) return;
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    if (p.stake > balance) {
      toast.error("Insufficient INR balance");
      return;
    }
    setPanels((prev) => prev.map((x) => (x.id === panelId ? { ...x, queued: !x.queued } : x)));
    playSfx("chip");
  };

  const updateStake = (panelId: number, val: number) => {
    setPanels((prev) =>
      prev.map((x) =>
        x.id === panelId
          ? {
              ...x,
              stake: Math.max(10, Math.min(100000, Math.round(val || 10))),
            }
          : x,
      ),
    );
  };

  const adjustStake = (panelId: number, delta: number) => {
    setPanels((prev) =>
      prev.map((x) =>
        x.id === panelId
          ? {
              ...x,
              stake: Math.max(10, Math.min(100000, Math.round(x.stake + delta))),
            }
          : x,
      ),
    );
    playSfx("click");
  };

  const toggleAutoBet = (panelId: number) => {
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    setPanels((prev) =>
      prev.map((x) => {
        if (x.id !== panelId) return x;
        const next = !x.autoBet;
        return { ...x, autoBet: next, queued: next ? true : x.queued };
      }),
    );
  };

  const toggleAutoCashout = (panelId: number) => {
    setPanels((prev) =>
      prev.map((x) => (x.id === panelId ? { ...x, autoCashout: !x.autoCashout } : x)),
    );
  };

  const setAutoCashoutVal = (panelId: number, val: string) => {
    setPanels((prev) => prev.map((x) => (x.id === panelId ? { ...x, autoCashoutVal: val } : x)));
  };

  const setPanelTab = (panelId: number, tab: "bet" | "auto") => {
    setPanels((prev) => prev.map((x) => (x.id === panelId ? { ...x, activeTab: tab } : x)));
  };

  // Helper color for multiplier chip
  const getMultiplierColor = (m: number) => {
    if (m < 2.0) return "text-[#38bdf8] bg-[#0c2238] border-[#1e3a5f]"; // Cyan/Blue
    if (m < 10.0) return "text-[#c084fc] bg-[#22133b] border-[#431d68]"; // Purple/Violet
    return "text-[#f43f5e] bg-[#33111e] border-[#5e192f]"; // Rose/Red for high
  };

  // Flight curve math for SVG path
  const progress = Math.min(1, Math.log(mult) / Math.log(15));
  const planeX = 20 + progress * 290;
  const planeY = 165 - Math.pow(progress, 1.4) * 125;

  // Filtered history for modal
  const filteredHistory = history.filter((r) => {
    if (historyFilter === "high") return r.multiplier >= 2.0;
    if (historyFilter === "huge") return r.multiplier >= 10.0;
    return true;
  });

  // Calculate live bets summary
  const cashedCount = livePlayers.filter((p) => p.cashedAt !== null).length;
  const totalWinINR = livePlayers.reduce((acc, p) => acc + (p.winAmount || 0), 0);

  return (
    <div className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-2xl bg-[#0e1017] pb-10 font-sans text-white shadow-2xl">
      {/* 1. Header Bar with Aviator Branding & Sound */}
      <div className="flex items-center justify-between border-b border-[#1b1e2a] bg-[#12151e] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-black italic tracking-tighter text-[#e61c38] drop-shadow-[0_0_12px_rgba(230,28,56,0.6)]">
            Aviator
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex size-7 items-center justify-center rounded-lg bg-[#1a1e2b] text-slate-400 hover:text-white"
            title="Toggle Engine Music & Sound"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-emerald-400" />
            ) : (
              <VolumeX className="size-4 text-slate-500" />
            )}
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-[#23293c] bg-[#151924] px-2 py-0.5">
            <span className="font-mono text-xs font-bold text-emerald-400">
              {formatCoins(balance)}
            </span>
            <span className="font-mono text-[10px] font-semibold text-slate-400">INR</span>
          </div>
        </div>
      </div>

      {/* 2. Top Multiplier History Bar with Interactive Three-Dots Button ("जहां थ्री डॉट है, वहां हिस्ट्री चमके") */}
      <div className="relative flex items-center justify-between border-b border-[#1a1d29] bg-[#0c0e15] px-2 py-1.5">
        {/* Horizontal scrollable chips */}
        <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto pr-2">
          {history.slice(0, 10).map((r, idx) => (
            <button
              key={`top-chip-${r.id}-${idx}`}
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-black transition hover:scale-105 active:scale-95 ${getMultiplierColor(
                r.multiplier,
              )}`}
            >
              {r.multiplier.toFixed(2)}x
            </button>
          ))}
        </div>

        {/* The 3 Dots History Trigger Button with Glowing effect! */}
        <button
          type="button"
          onClick={() => {
            playSfx("click");
            setShowHistoryModal(true);
          }}
          className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-purple-500/40 bg-[#1e1330] text-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.35)] transition hover:scale-110 hover:shadow-[0_0_15px_rgba(147,51,234,0.7)] active:scale-95"
          title="Round History & Provably Fair"
        >
          <MoreHorizontal className="size-3.5" />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-purple-400 animate-ping" />
        </button>
      </div>

      {/* 3. Flight Radar Stage (The Sunburst Arena & Flying Red Plane) */}
      <div className="relative h-56 w-full overflow-hidden border-b border-[#1b1e2a] bg-[#000000]">
        {/* Subtle Dark Sunburst Angular Rays */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(circle at 10% 90%, #1e293b 0%, #090c15 60%, #000000 100%)",
          }}
        />

        {/* Rotating Sunburst light beams */}
        <div
          className={`pointer-events-none absolute -bottom-20 -left-20 size-[500px] opacity-15 ${
            phase === "flying" ? "animate-spin" : ""
          }`}
          style={{
            animationDuration: "40s",
            background:
              "conic-gradient(from 0deg, transparent 0deg 15deg, rgba(56, 189, 248, 0.15) 15deg 30deg, transparent 30deg 45deg, rgba(230, 28, 56, 0.15) 45deg 60deg, transparent 60deg 75deg, rgba(56, 189, 248, 0.15) 75deg 90deg, transparent 90deg 105deg, rgba(230, 28, 56, 0.15) 105deg 120deg, transparent 120deg 135deg, rgba(56, 189, 248, 0.15) 135deg 150deg, transparent 150deg 165deg, rgba(230, 28, 56, 0.15) 165deg 180deg, transparent 180deg 195deg, rgba(56, 189, 248, 0.15) 195deg 210deg, transparent 210deg 225deg, rgba(230, 28, 56, 0.15) 225deg 240deg, transparent 240deg 255deg, rgba(56, 189, 248, 0.15) 255deg 270deg, transparent 270deg 285deg, rgba(230, 28, 56, 0.15) 285deg 300deg, transparent 300deg 315deg, rgba(56, 189, 248, 0.15) 315deg 330deg, transparent 330deg 345deg, rgba(230, 28, 56, 0.15) 345deg 360deg)",
          }}
        />

        {/* Coordinate Grid Background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* SVG Flight Curve & Gradient Area */}
        <svg className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id="aviatorRedFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e61c38" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#e61c38" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#e61c38" stopOpacity="0.02" />
            </linearGradient>
            <filter id="redGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {phase !== "betting" && (
            <>
              {/* Filled Area beneath curve */}
              <path
                d={`M 0 190 Q ${planeX * 0.4} 190, ${planeX} ${planeY} L ${planeX} 190 Z`}
                fill="url(#aviatorRedFill)"
                opacity={phase === "crashed" ? 0.3 : 1}
                className="transition-opacity duration-300"
              />
              {/* Glowing Red Curve Stroke */}
              <path
                d={`M 0 190 Q ${planeX * 0.4} 190, ${planeX} ${planeY}`}
                fill="none"
                stroke="#e61c38"
                strokeWidth="3.5"
                filter="url(#redGlow)"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>

        {/* The Animated Red Propeller Plane */}
        {phase === "flying" && (
          <div
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: `${planeX}px`,
              top: `${planeY - 26}px`,
              transform: "translate(-30%, -30%)",
            }}
          >
            {/* Realistic Red Aviator Monoplane SVG */}
            <div className="relative size-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
              <svg
                viewBox="0 0 100 60"
                className="size-full"
                style={{
                  transform: "rotate(-6deg)",
                }}
              >
                {/* Propeller Blur Disc at Front */}
                <ellipse
                  cx="88"
                  cy="30"
                  rx="3.5"
                  ry="24"
                  fill="rgba(255, 255, 255, 0.7)"
                  className="animate-spin"
                  style={{ transformOrigin: "88px 30px", animationDuration: "0.08s" }}
                />
                {/* Airplane Fuselage */}
                <path
                  d="M 12 30 Q 30 20, 85 28 Q 88 30, 85 32 Q 30 38, 12 30 Z"
                  fill="#e61c38"
                  stroke="#b31227"
                  strokeWidth="1.5"
                />
                {/* Cockpit Canopy Glass */}
                <path
                  d="M 45 23 Q 56 16, 68 25 Z"
                  fill="#93c5fd"
                  stroke="#ffffff"
                  strokeWidth="1"
                  opacity="0.9"
                />
                {/* Main Wing Top */}
                <path
                  d="M 42 27 L 62 8 L 74 10 L 52 28 Z"
                  fill="#d11234"
                  stroke="#800a1c"
                  strokeWidth="1"
                />
                {/* Main Wing Bottom */}
                <path
                  d="M 40 32 L 58 48 L 70 46 L 50 31 Z"
                  fill="#b31227"
                  stroke="#800a1c"
                  strokeWidth="1"
                />
                {/* Tail Rudder Fin */}
                <path
                  d="M 12 30 L 8 12 L 20 18 L 22 29 Z"
                  fill="#d11234"
                  stroke="#800a1c"
                  strokeWidth="1"
                />
                {/* Nose Cone */}
                <ellipse cx="86" cy="30" rx="3" ry="5" fill="#facc15" />
                {/* Wing Star / White Accent Line */}
                <line
                  x1="32"
                  y1="29"
                  x2="78"
                  y2="29"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Flew Away Accelerated Plane Exit Animation */}
        {phase === "crashed" && (
          <div
            className="absolute transition-all duration-700 ease-in"
            style={{
              left: `${planeX + 160}px`,
              top: `${planeY - 140}px`,
              opacity: 0,
              transform: "rotate(-35deg) scale(1.4)",
            }}
          >
            <div className="size-16 text-[#e61c38]">✈️</div>
          </div>
        )}

        {/* Stage Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Phase 1: Waiting for next round (with Official UFC & SPRIBE Partner Brandings from screenshots!) */}
          {phase === "betting" && (
            <div className="flex flex-col items-center justify-center text-center p-3 animate-fade-in">
              {/* UFC Official Partner Banner */}
              <div className="flex items-center gap-2 rounded-xl bg-[#0c1220]/90 px-4 py-2 border border-[#1b2542] shadow-lg">
                <span className="font-display text-xl font-black italic tracking-wider text-rose-500 drop-shadow-sm">
                  UFC
                </span>
                <div className="h-5 w-px bg-slate-700" />
                <div className="text-left">
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Official Partners
                  </p>
                  <span className="font-display text-xs font-black italic text-[#e61c38]">
                    Aviator
                  </span>
                </div>
              </div>

              {/* Spribe Official Game Since 2019 Badge */}
              <div className="mt-2 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-[#081717]/80 px-3 py-0.5 text-[10px] font-bold text-emerald-400 shadow-sm">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>SPRIBE Official Game · Since 2019</span>
              </div>

              {/* Progress Countdown Bar */}
              <div className="mt-3 w-48">
                <div className="flex justify-between font-mono text-[10px] font-bold text-slate-400 mb-1">
                  <span>WAITING FOR NEXT ROUND</span>
                  <span className="text-white">{(countdown / 1000).toFixed(1)}s</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b233a]">
                  <div
                    className="h-full bg-gradient-to-r from-[#e61c38] to-[#f43f5e] transition-all duration-100"
                    style={{
                      width: `${((BETTING_MS - countdown) / BETTING_MS) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: In Flight Multiplier */}
          {phase === "flying" && (
            <div className="text-center animate-fade-in">
              <p className="font-display text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {mult.toFixed(2)}x
              </p>
            </div>
          )}

          {/* Phase 3: Flew Away State */}
          {phase === "crashed" && (
            <div className="text-center animate-pop">
              <p className="font-display text-base font-black uppercase tracking-widest text-[#e61c38] drop-shadow-[0_0_15px_#e61c38]">
                FLEW AWAY!
              </p>
              <p className="font-display text-4xl font-black text-[#e61c38]">
                {flewAwayMult.toFixed(2)}x
              </p>
            </div>
          )}
        </div>

        {/* Bottom Right: Live Online Players Avatars Overlay Chip */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full border border-[#22293d] bg-[#0c101c]/80 px-2.5 py-1 backdrop-blur-xs">
          <div className="flex -space-x-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-orange-500 text-[11px] ring-1 ring-black">
              🟠
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-slate-700 text-[11px] ring-1 ring-black">
              🦅
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-teal-600 text-[11px] ring-1 ring-black">
              🤿
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-slate-300">{onlineCount}</span>
        </div>
      </div>

      {/* 4. Dual Betting Control Panels (Panel 1 & Panel 2) */}
      <div className="p-2 space-y-2">
        {panels.slice(0, showSecondPanel ? 2 : 1).map((panel) => {
          const isFlying = phase === "flying";
          const isActive = panel.active;
          const isQueued = panel.queued;
          const isCashed = panel.cashedAt !== null;
          const canCashout = isActive && !isCashed && isFlying;

          return (
            <div
              key={`bet-panel-${panel.id}`}
              className="relative overflow-hidden rounded-2xl border border-[#212638] bg-[#141724] p-3 shadow-md"
            >
              {/* Header: Segmented Bet / Auto Switcher & Panel Toggle */}
              <div className="flex items-center justify-between">
                {/* Bet / Auto Tabs */}
                <div className="flex rounded-full bg-[#0a0d17] p-0.5 border border-[#1d2338]">
                  <button
                    type="button"
                    onClick={() => setPanelTab(panel.id, "bet")}
                    className={`rounded-full px-4 py-1 font-display text-xs font-bold transition ${
                      panel.activeTab === "bet"
                        ? "bg-[#252c42] text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Bet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelTab(panel.id, "auto")}
                    className={`rounded-full px-4 py-1 font-display text-xs font-bold transition ${
                      panel.activeTab === "auto"
                        ? "bg-[#252c42] text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Auto
                  </button>
                </div>

                {/* Panel 2 Toggle Icon */}
                {panel.id === 2 && (
                  <button
                    type="button"
                    onClick={() => setShowSecondPanel(false)}
                    className="flex size-6 items-center justify-center rounded-md bg-[#202538] text-slate-400 hover:text-white"
                    title="Hide second bet panel"
                  >
                    <Minus className="size-3.5" />
                  </button>
                )}
                {panel.id === 1 && !showSecondPanel && (
                  <button
                    type="button"
                    onClick={() => setShowSecondPanel(true)}
                    className="flex size-6 items-center justify-center rounded-md bg-[#202538] text-slate-400 hover:text-white"
                    title="Add second bet panel"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Panel Content */}
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 items-center">
                {/* Left Side: Stepper & Quick Amounts */}
                <div className="space-y-1.5">
                  {/* Stepper with - and + */}
                  <div className="flex items-center justify-between rounded-xl border border-[#262c42] bg-[#0a0d17] p-1">
                    <button
                      type="button"
                      disabled={isActive || isQueued}
                      onClick={() => adjustStake(panel.id, -10)}
                      className="flex size-8 items-center justify-center rounded-lg bg-[#1a1f30] text-slate-300 hover:bg-[#252d47] active:scale-95 disabled:opacity-40"
                    >
                      <Minus className="size-4" />
                    </button>

                    <div className="flex flex-col items-center">
                      <span className="font-mono text-base font-black text-white">
                        {panel.stake.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isActive || isQueued}
                      onClick={() => adjustStake(panel.id, 10)}
                      className="flex size-8 items-center justify-center rounded-lg bg-[#1a1f30] text-slate-300 hover:bg-[#252d47] active:scale-95 disabled:opacity-40"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>

                  {/* 4 Quick Preset Amount Chips */}
                  <div className="grid grid-cols-4 gap-1">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={`amt-${panel.id}-${amt}`}
                        type="button"
                        disabled={isActive || isQueued}
                        onClick={() => {
                          playSfx("chip");
                          updateStake(panel.id, amt);
                        }}
                        className="rounded-lg border border-[#21273d] bg-[#0d101c] py-1 font-mono text-[10.5px] font-bold text-slate-300 hover:bg-[#1a2033] active:scale-95 disabled:opacity-40"
                      >
                        {amt >= 1000 ? "1,000" : amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Side: Big Green Bet / Cashout Action Button */}
                <div className="h-full">
                  {canCashout ? (
                    // Glowing Bright Orange Cashout Button during active flight
                    <button
                      type="button"
                      onClick={() => cashOut(panel.id)}
                      className="flex h-full min-h-[76px] w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 p-2 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] transition hover:brightness-110 active:scale-95"
                    >
                      <span className="font-display text-base font-black tracking-wide">
                        Cash Out
                      </span>
                      <span className="font-mono text-sm font-black">
                        {(panel.stake * mult).toFixed(2)} INR
                      </span>
                    </button>
                  ) : (
                    // Standard Bet / Queue / Cashed button
                    <button
                      type="button"
                      disabled={isActive || (panel.stake > balance && !isQueued) || busy}
                      onClick={() => toggleQueue(panel.id)}
                      className={`flex h-full min-h-[76px] w-full flex-col items-center justify-center rounded-2xl p-2 transition active:scale-95 disabled:opacity-50 ${
                        isQueued
                          ? "border border-rose-500/50 bg-[#2d121c] text-rose-300 shadow-md"
                          : isActive
                            ? isCashed
                              ? "border border-emerald-500/40 bg-[#092218] text-emerald-300"
                              : "border border-amber-500/40 bg-[#2d210b] text-amber-300"
                            : "bg-[#22c55e] text-slate-950 hover:bg-[#16a34a] shadow-[0_4px_15px_rgba(34,197,94,0.4)]"
                      }`}
                    >
                      {isQueued ? (
                        <>
                          <span className="font-display text-sm font-black uppercase">Cancel</span>
                          <span className="font-mono text-[11px] font-bold">Waiting…</span>
                        </>
                      ) : isActive ? (
                        isCashed ? (
                          <>
                            <span className="font-display text-xs font-black text-emerald-400">
                              CASHED OUT
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-300">
                              {panel.cashedAt?.toFixed(2)}x
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-display text-xs font-black text-amber-400">
                              IN PLAY
                            </span>
                            <span className="font-mono text-xs font-bold text-amber-300">
                              {panel.stake.toFixed(2)} INR
                            </span>
                          </>
                        )
                      ) : panel.stake > balance ? (
                        <>
                          <span className="font-display text-xs font-black">Low Balance</span>
                          <span className="font-mono text-[10px]">Deposit INR</span>
                        </>
                      ) : (
                        <>
                          <span className="font-display text-base font-black tracking-wide">
                            Bet
                          </span>
                          <span className="font-mono text-sm font-black">
                            {panel.stake.toFixed(2)} INR
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Auto Tab Config Row */}
              {panel.activeTab === "auto" && (
                <div className="mt-2.5 flex items-center justify-between border-t border-[#1d2338] pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`auto-bet-${panel.id}`}
                      checked={panel.autoBet}
                      onChange={() => toggleAutoBet(panel.id)}
                      className="size-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`auto-bet-${panel.id}`}
                      className="font-display text-[11px] font-bold text-slate-300 cursor-pointer"
                    >
                      Auto Bet
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id={`auto-cash-${panel.id}`}
                      checked={panel.autoCashout}
                      onChange={() => toggleAutoCashout(panel.id)}
                      className="size-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`auto-cash-${panel.id}`}
                      className="font-display text-[11px] font-bold text-slate-300 cursor-pointer"
                    >
                      Auto Cash Out
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.01"
                      value={panel.autoCashoutVal}
                      onChange={(e) => setAutoCashoutVal(panel.id, e.target.value)}
                      className="h-6 w-14 rounded border border-[#2b334f] bg-[#0a0d17] text-center font-mono text-[11px] font-black text-emerald-400 focus:outline-none"
                    />
                    <span className="font-mono text-xs text-slate-400">x</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. Live Bets Multi-Player Table ("All Bets", "Previous", "Top") matching Screenshot */}
      <div className="mx-2 mt-1 overflow-hidden rounded-2xl border border-[#202538] bg-[#121522] shadow-md">
        {/* Table Tabs */}
        <div className="flex items-center justify-between border-b border-[#1c2235] bg-[#0c0f1a] p-1.5">
          <div className="grid grid-cols-3 gap-1 w-full max-w-[260px]">
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveBetsTab("all");
              }}
              className={`rounded-xl py-1 font-display text-xs font-bold transition ${
                activeBetsTab === "all"
                  ? "bg-[#252c42] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Bets
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveBetsTab("previous");
              }}
              className={`rounded-xl py-1 font-display text-xs font-bold transition ${
                activeBetsTab === "previous"
                  ? "bg-[#252c42] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveBetsTab("top");
              }}
              className={`rounded-xl py-1 font-display text-xs font-bold transition ${
                activeBetsTab === "top"
                  ? "bg-[#252c42] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Top
            </button>
          </div>
        </div>

        {/* Live Bets Header Status Card */}
        <div className="flex items-center justify-between border-b border-[#1b2033] bg-[#0e121f] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] ring-1 ring-black">
                👍
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-700 text-[10px] ring-1 ring-black">
                👤
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-600 text-[10px] ring-1 ring-black">
                🪖
              </span>
            </div>
            <div>
              <span className="font-mono text-xs font-bold text-white">
                {cashedCount}/{livePlayers.length}
              </span>
              <span className="font-mono text-[10px] text-slate-400 ml-1">Bets</span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-display text-sm font-black text-white">
              {totalWinINR > 0 ? formatCoins(totalWinINR) : "0.00"}
            </span>
            <span className="font-mono text-[10px] text-slate-400 ml-1">Total win INR</span>
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-4 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase text-slate-400 border-b border-[#181d2e] bg-[#0b0e17]">
          <span>Player</span>
          <span className="text-right">Bet INR</span>
          <span className="text-center">X</span>
          <span className="text-right">Win INR</span>
        </div>

        {/* Player Bet Rows */}
        <div className="divide-y divide-[#171c2c] max-h-64 overflow-y-auto no-scrollbar">
          {(activeBetsTab === "previous" ? previousPlayers : livePlayers).map((player, idx) => {
            const isCashed = player.cashedAt !== null;
            return (
              <div
                key={`player-${player.id}-${idx}`}
                className={`grid grid-cols-4 items-center px-3.5 py-2 text-xs transition ${
                  isCashed ? "bg-emerald-950/20" : "hover:bg-[#151929]"
                }`}
              >
                {/* Player Avatar & Masked Name */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1e253b] text-xs">
                    {player.avatar}
                  </span>
                  <span className="truncate font-mono text-slate-300">{player.username}</span>
                </div>

                {/* Bet Amount */}
                <span className="text-right font-mono text-slate-200">
                  {player.stake.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>

                {/* Cashout Multiplier */}
                <span
                  className={`text-center font-mono font-bold ${
                    isCashed ? "text-purple-400" : "text-slate-600"
                  }`}
                >
                  {isCashed ? `${player.cashedAt?.toFixed(2)}x` : "-"}
                </span>

                {/* Win Amount */}
                <span
                  className={`text-right font-mono font-black ${
                    isCashed ? "text-emerald-400" : "text-slate-600"
                  }`}
                >
                  {isCashed
                    ? player.winAmount?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "-"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Table Footer: Provably Fair & Powered by Spribe */}
        <div className="flex items-center justify-between border-t border-[#181d2e] bg-[#0a0d17] px-3.5 py-2 text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1 text-slate-300">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Provably Fair Game</span>
          </div>
          <div>
            Powered by <span className="font-bold text-white">SPRIBE</span>
          </div>
        </div>
      </div>

      {/* 6. Interactive Round History & Provably Fair Modal ("जहां थ्री डॉट है, वहां हिस्ट्री चमके") */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-purple-500/80 bg-[#0e1220] p-5 text-left text-white shadow-[0_0_40px_rgba(168,85,247,0.5)] animate-pop"
            style={{
              boxShadow: "0 0 35px rgba(168, 85, 247, 0.4)",
            }}
          >
            {/* Glowing Header */}
            <div className="flex items-center justify-between border-b border-[#212942] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-purple-400 animate-pulse" />
                <h3 className="font-display text-base font-black text-white">
                  Round Multiplier History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="flex size-7 items-center justify-center rounded-full bg-[#1e253d] text-slate-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex gap-1.5">
              {(["all", "high", "huge"] as const).map((tab) => (
                <button
                  key={`hist-tab-${tab}`}
                  type="button"
                  onClick={() => setHistoryFilter(tab)}
                  className={`flex-1 rounded-xl py-1.5 font-display text-xs font-bold uppercase transition ${
                    historyFilter === tab
                      ? "bg-purple-600 text-white shadow-md font-black"
                      : "bg-[#161c30] text-slate-400 hover:text-white"
                  }`}
                >
                  {tab === "all" ? "All Rounds" : tab === "high" ? "> 2.00x" : "> 10.00x"}
                </button>
              ))}
            </div>

            {/* Multipliers Grid */}
            <div className="mt-3 grid grid-cols-4 gap-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
              {filteredHistory.map((r, idx) => (
                <div
                  key={`modal-mult-${r.id}-${idx}`}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition hover:scale-105 ${getMultiplierColor(
                    r.multiplier,
                  )}`}
                >
                  <span className="font-mono text-xs font-black">{r.multiplier.toFixed(2)}x</span>
                  <span className="font-mono text-[9px] text-slate-400 mt-0.5">
                    {new Date(r.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Provably Fair verification card */}
            <div className="mt-4 rounded-xl border border-[#212942] bg-[#090c17] p-3 text-xs space-y-1 text-slate-300">
              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                <ShieldCheck className="size-3.5" />
                <span>SHA-512 Cryptographic Fairness</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                All game outcomes are calculated via combined server seed and 3 client seeds prior
                to the round start.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="mt-4 h-10 w-full rounded-xl bg-purple-600 font-display text-xs font-bold text-white shadow-lg transition hover:bg-purple-500 active:scale-95"
            >
              Close History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
