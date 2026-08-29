import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import {
  ChevronLeft,
  RotateCw,
  HelpCircle,
  FileText,
  BookOpen,
  Share2,
  Copy,
  Check,
  X,
  Sparkles,
  Trophy,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useDailyBonus, usePlayer } from "@/lib/player";
import { formatCoins } from "@/lib/games";
import { playSfx } from "@/lib/sound";
import { useAppConfig } from "@/lib/appConfig";

// 8 Slices matching UI design
export const WHEEL_SLICES = [
  {
    id: 0,
    amount: 100000,
    label: "IPHONE 17",
    isPhone: true,
    prob: 0.0, // Strict 0% - never hits
    bgColor: "#c026d3", // Magenta/Violet
    textColor: "#ffffff",
  },
  {
    id: 1,
    amount: 5,
    label: "₹5",
    prob: 0.35, // 35% chance
    bgColor: "#8b5cf6", // Purple
    textColor: "#ffffff",
  },
  {
    id: 2,
    amount: 10,
    label: "₹10",
    prob: 0.10, // 10% chance
    bgColor: "#0284c7", // Sky Blue
    textColor: "#ffffff",
  },
  {
    id: 3,
    amount: 50,
    label: "₹50",
    prob: 0.0, // Strict 0% - never hits
    bgColor: "#06b6d4", // Cyan
    textColor: "#ffffff",
  },
  {
    id: 4,
    amount: 100,
    label: "₹100",
    prob: 0.0, // Strict 0% - never hits
    bgColor: "#22c55e", // Green
    textColor: "#ffffff",
  },
  {
    id: 5,
    amount: 1000,
    label: "₹1,000",
    prob: 0.0, // Strict 0% - never hits
    bgColor: "#eab308", // Yellow
    textColor: "#ffffff",
  },
  {
    id: 6,
    amount: 5000,
    label: "₹5,000",
    prob: 0.0, // Strict 0% - never hits
    bgColor: "#f97316", // Orange
    textColor: "#ffffff",
  },
  {
    id: 7,
    amount: 2,
    label: "₹2",
    prob: 0.55, // 55% chance
    bgColor: "#ec4899", // Pink/Rose
    textColor: "#ffffff",
  },
];

interface SpinHistoryItem {
  id: string;
  time: string;
  type: string;
  prize: string;
}

export const Route = createFileRoute("/wheel")({
  head: () => ({
    meta: [
      { title: "Wheel Spin — BaaziWin" },
      {
        name: "description",
        content: "Spin the lucky wheel to win iPhone 17 and instant cash rewards on BaaziWin.",
      },
    ],
  }),
  component: Wheel,
});

function Wheel() {
  const { data: player } = usePlayer();
  const { data: config } = useAppConfig();
  const bonus = useDailyBonus();
  const wheelMult = config.wheel_multiplier || 1.0;
  const isBoosted = config.wheel_jackpot_mode === "boosted_100x" || wheelMult >= 10;

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<(typeof WHEEL_SLICES)[0] | null>(null);
  const [activeModal, setActiveModal] = useState<
    "description" | "details" | "rules" | "referral" | null
  >(null);
  const [copied, setCopied] = useState(false);

  // History entries
  const [history, setHistory] = useState<SpinHistoryItem[]>([
    {
      id: "1",
      time: "2026-08-23 07:15:20",
      type: "Daily Free Spin",
      prize: "₹5.00 Cash",
    },
    {
      id: "2",
      time: "2026-08-22 19:42:08",
      type: "Recharge Spin",
      prize: "₹10.00 Cash",
    },
  ]);

  const last = player?.last_bonus_at ? new Date(player.last_bonus_at).getTime() : 0;
  const readyAt = last + 24 * 3600 * 1000;
  const ready = Date.now() >= readyAt;
  const spinsAvailable = ready ? 1 : 0;

  const referralCode = player?.id ? `VIP-${player.id.substring(0, 6).toUpperCase()}` : "VIP-777888";
  const [referralLink, setReferralLink] = useState(`https://baaziwin.game/?ref=${referralCode}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReferralLink(`${window.location.origin}/?ref=${referralCode}`);
    }
  }, [referralCode]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpin = async () => {
    if (spinning || !ready) {
      if (!ready) {
        toast.info("Daily free spin used. Recharge or invite friends to get more spins!");
      }
      return;
    }

    // Weighted selection strictly limited to micro-prizes (₹2, ₹5, ₹10)
    // iPhone 17, ₹5000, ₹1000, ₹100, ₹50 will never be picked
    let targetIdx = 7; // default ₹2
    const rand = Math.random();

    if (rand < 0.55) {
      targetIdx = 7; // ₹2 (55%)
    } else if (rand < 0.90) {
      targetIdx = 1; // ₹5 (35%)
    } else {
      targetIdx = 2; // ₹10 (10%)
    }

    const basePrize = WHEEL_SLICES[targetIdx];
    const finalAmount = basePrize.isPhone
      ? basePrize.amount
      : Math.round(basePrize.amount * wheelMult);
    const selectedPrize = {
      ...basePrize,
      amount: finalAmount,
      label: basePrize.isPhone ? "IPHONE 17" : `₹${finalAmount.toLocaleString()}`,
    };

    setWonPrize(null);
    setSpinning(true);

    // 8 slices => 45 degrees per slice
    // Pointer is at the top (0 degrees). Slices are indexed 0..7.
    // Slice 0 is centered around angle 0 (top). Slice 1 is at 45 deg clockwise, etc.
    const sliceAngle = 360 / 8; // 45 deg
    const fullSpins = 6 + Math.floor(Math.random() * 2);
    // To land slice targetIdx at the top pointer (0 deg), we rotate counter-clockwise by targetIdx * 45
    const targetAngle = fullSpins * 360 + (360 - targetIdx * sliceAngle);

    setRotation((prev) => {
      const base = Math.ceil(prev / 360) * 360;
      return base + targetAngle;
    });

    playSfx("spin");
    const tickInterval = setInterval(() => {
      playSfx("tick");
    }, 160);

    setTimeout(async () => {
      clearInterval(tickInterval);
      setSpinning(false);
      setWonPrize(selectedPrize);

      if (selectedPrize.isPhone || selectedPrize.amount >= 1000) {
        playSfx("bigwin");
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
        });
      } else {
        playSfx("win");
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      // Add to local history table
      const now = new Date();
      const timeStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;
      setHistory((prev) => [
        {
          id: String(Date.now()),
          time: timeStr,
          type: "Daily Free Spin",
          prize: selectedPrize.isPhone ? "IPHONE 17 Pro" : `${selectedPrize.label} Cash`,
        },
        ...prev,
      ]);

      try {
        if (!selectedPrize.isPhone) {
          await bonus.mutateAsync(selectedPrize.amount);
        }
        toast.success(`🎉 You won ${selectedPrize.label}!`);
      } catch {
        toast.error("Error crediting reward. Please contact support.");
      }
    }, 4500);
  };

  return (
    <AppShell>
      {/* Deep midnight blue page matching Screenshot 1 */}
      <div className="min-h-screen bg-[#070b1a] pb-24 text-white">
        {/* Top App Header with back arrow & title */}
        <div className="relative flex items-center justify-between border-b border-[#141d38] bg-[#070b1a] px-4 py-3">
          <Link
            to="/"
            className="flex items-center text-slate-300 hover:text-white"
            aria-label="Back to home"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight text-white">Wheel Spin</h1>
          <button
            type="button"
            onClick={() => setActiveModal("referral")}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            <Share2 className="size-4" />
          </button>
        </div>

        <div className="mx-auto max-w-md px-3 pt-3 space-y-4">
          {/* Live Cloud Multiplier Active Banner */}
          {(wheelMult > 1 || config.wheel_jackpot_mode === "boosted_100x") && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-[#0d142d] to-amber-500/20 p-3 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-400 animate-pulse shrink-0" />
                <div>
                  <div className="font-display text-xs font-black text-amber-300">
                    💥 {wheelMult}X JACKPOT MULTIPLIER ACTIVE!
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Admin cloud boost live: win up to ₹{(5000 * wheelMult).toLocaleString()} Cash
                    &amp; iPhone 17!
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 font-mono text-[10px] font-black animate-bounce">
                {wheelMult}X
              </span>
            </div>
          )}

          {/* Card: Today Recharge & Spins Count */}
          <div className="rounded-2xl border border-[#1b2647] bg-[#0d142d] p-3.5 shadow-lg space-y-3">
            <div className="text-center font-display text-sm font-bold text-slate-300">Today</div>

            {/* Total Recharge Row */}
            <div className="flex items-center justify-between rounded-xl bg-[#080d20] px-3.5 py-2 border border-[#182242]">
              <span className="text-xs font-semibold text-slate-300">Total Recharge</span>
              <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/80 to-teal-400/80 px-3 py-1 text-xs font-black text-slate-950 shadow">
                <span>₹0.00</span>
                <RotateCw className="size-3 cursor-pointer hover:rotate-180 transition-transform duration-500" />
              </div>
            </div>

            {/* Number of spins Row */}
            <div className="flex items-center justify-between rounded-xl bg-[#080d20] px-3.5 py-2.5 border border-[#182242]">
              <span className="text-xs font-semibold text-slate-300">Number of spins</span>
              <span className="font-mono text-sm font-black text-rose-500">{spinsAvailable}/1</span>
            </div>
          </div>

          {/* THE WHEEL CONTAINER matching Screenshot 1 */}
          <div className="relative mx-auto my-3 flex size-80 items-center justify-center select-none">
            {/* Outer Golden Border with Light Bulbs */}
            <div className="absolute inset-0 rounded-full border-8 border-[#f59e0b] bg-gradient-to-b from-[#fbbf24] via-[#d97706] to-[#b45309] p-1.5 shadow-[0_0_35px_rgba(245,158,11,0.45)] flex items-center justify-center">
              {/* 16 White Light Bulbs around the perimeter */}
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i * 360) / 16;
                const rad = (angle * Math.PI) / 180;
                // Position on outer rim radius (~152px)
                const x = 145 + 140 * Math.sin(rad);
                const y = 145 - 140 * Math.cos(rad);
                return (
                  <div
                    key={i}
                    className="absolute size-3 rounded-full bg-white shadow-[0_0_8px_#ffffff] border border-amber-200"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      animation: `pulse 1.5s infinite ease-in-out ${i * 0.1}s`,
                    }}
                  />
                );
              })}

              {/* Inner Rotating SVG Wheel */}
              <div
                className="relative size-full overflow-hidden rounded-full shadow-inner transition-transform"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: spinning ? "4500ms" : "0ms",
                  transitionTimingFunction: "cubic-bezier(0.1, 0.85, 0.15, 1)",
                }}
              >
                <svg viewBox="0 0 100 100" className="size-full">
                  <defs>
                    {/* Slices gradients */}
                    <linearGradient id="phoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#d946ef" />
                    </linearGradient>
                    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0891b2" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#16a34a" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                    <linearGradient id="yellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ca8a04" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ea580c" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#db2777" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                  </defs>

                  {/* 8 Pie Sectors (45 deg each centered at 0, 45, 90, 135, 180, 225, 270, 315) */}
                  {/* Slice 0: -22.5 to +22.5 deg (Top, iPhone) */}
                  <path
                    d="M 50,50 L 30.86,3.8 A 50,50 0 0,1 69.14,3.8 Z"
                    fill="url(#phoneGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 1: +22.5 to +67.5 deg (₹5) */}
                  <path
                    d="M 50,50 L 69.14,3.8 A 50,50 0 0,1 96.2,30.86 Z"
                    fill="url(#purpleGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 2: +67.5 to +112.5 deg (₹10) */}
                  <path
                    d="M 50,50 L 96.2,30.86 A 50,50 0 0,1 96.2,69.14 Z"
                    fill="url(#blueGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 3: +112.5 to +157.5 deg (₹50) */}
                  <path
                    d="M 50,50 L 96.2,69.14 A 50,50 0 0,1 69.14,96.2 Z"
                    fill="url(#cyanGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 4: +157.5 to +202.5 deg (₹100) */}
                  <path
                    d="M 50,50 L 69.14,96.2 A 50,50 0 0,1 30.86,96.2 Z"
                    fill="url(#greenGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 5: +202.5 to +247.5 deg (₹1000) */}
                  <path
                    d="M 50,50 L 30.86,96.2 A 50,50 0 0,1 3.8,69.14 Z"
                    fill="url(#yellowGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 6: +247.5 to +292.5 deg (₹5000) */}
                  <path
                    d="M 50,50 L 3.8,69.14 A 50,50 0 0,1 3.8,30.86 Z"
                    fill="url(#orangeGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  {/* Slice 7: +292.5 to +337.5 deg (₹2) */}
                  <path
                    d="M 50,50 L 3.8,30.86 A 50,50 0 0,1 30.86,3.8 Z"
                    fill="url(#pinkGrad)"
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />

                  {/* Slice Labels & Icons matching Screenshot 1 */}
                  {/* Slice 0: IPHONE 17 */}
                  <g transform="rotate(0, 50, 50)">
                    <text
                      x="50"
                      y="11"
                      fill="#ffffff"
                      fontSize="3.8"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      IPHONE 17
                    </text>
                    {/* Gold iPhone Device vector */}
                    <rect
                      x="46"
                      y="14"
                      width="8"
                      height="14"
                      rx="1.5"
                      fill="#f59e0b"
                      stroke="#78350f"
                      strokeWidth="0.4"
                    />
                    <rect x="47.5" y="15.5" width="5" height="11" rx="0.8" fill="#1e1e1e" />
                    <circle cx="49" cy="17.5" r="0.8" fill="#f59e0b" />
                    <circle cx="51" cy="17.5" r="0.8" fill="#f59e0b" />
                    <circle cx="50" cy="19.5" r="0.8" fill="#f59e0b" />
                  </g>

                  {/* Slice 1: ₹5 */}
                  <g transform="rotate(45, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="4.2"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹5
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 2: ₹10 */}
                  <g transform="rotate(90, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="4.2"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹10
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 3: ₹50 */}
                  <g transform="rotate(135, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="4.2"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹50
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 4: ₹100 */}
                  <g transform="rotate(180, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="4"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹100
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 5: ₹1,000 */}
                  <g transform="rotate(225, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="3.8"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹1,000
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 6: ₹5,000 */}
                  <g transform="rotate(270, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="3.8"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹5,000
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>

                  {/* Slice 7: ₹2 */}
                  <g transform="rotate(315, 50, 50)">
                    <text
                      x="50"
                      y="13"
                      fill="#ffffff"
                      fontSize="4.2"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      ₹2
                    </text>
                    <GoldRupeeCoin x="50" y="21" r="5.5" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Central "GO" Button with Upward Golden Pointer matching Screenshot 1 */}
            <div className="absolute z-20 flex flex-col items-center">
              {/* Golden Triangle Pointer pointing straight UP */}
              <div className="h-0 w-0 border-x-[12px] border-b-[22px] border-x-transparent border-b-[#f59e0b] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />

              {/* Big Red & Gold Circular GO Button */}
              <button
                type="button"
                disabled={spinning || bonus.isPending}
                onClick={handleSpin}
                className="relative -mt-2 flex size-20 items-center justify-center rounded-full border-4 border-[#f59e0b] bg-gradient-to-br from-[#ef4444] via-[#dc2626] to-[#991b1b] shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-80"
              >
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-amber-300/40 bg-gradient-to-b from-[#f87171] to-[#b91c1c] shadow-inner">
                  <span className="font-display text-2xl font-black italic tracking-wider text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
                    GO
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Won Prize Banner */}
          {wonPrize && (
            <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-3 text-center shadow-lg animate-pop">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                <Trophy className="size-4 text-amber-400" />
                <span>CONGRATULATIONS!</span>
              </div>
              <p className="mt-1 font-display text-2xl font-black text-amber-200">
                {wonPrize.label}
              </p>
              <p className="text-[11px] text-slate-300">
                Reward successfully credited to your wallet!
              </p>
            </div>
          )}

          {/* 3 Green Event Action Badges matching Screenshot 1 */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Event Description */}
            <button
              type="button"
              onClick={() => setActiveModal("description")}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#142838] bg-[#0a1828] p-3 text-center transition hover:bg-[#0f233a] active:scale-95"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-md">
                <HelpCircle className="size-6 font-bold" />
              </div>
              <span className="text-[11px] font-bold text-slate-200">Event Description</span>
            </button>

            {/* Event Details */}
            <button
              type="button"
              onClick={() => setActiveModal("details")}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#142838] bg-[#0a1828] p-3 text-center transition hover:bg-[#0f233a] active:scale-95"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-md">
                <FileText className="size-6 font-bold" />
              </div>
              <span className="text-[11px] font-bold text-slate-200">Event Details</span>
            </button>

            {/* Activity Rules */}
            <button
              type="button"
              onClick={() => setActiveModal("rules")}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[#142838] bg-[#0a1828] p-3 text-center transition hover:bg-[#0f233a] active:scale-95"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-md">
                <BookOpen className="size-6 font-bold" />
              </div>
              <span className="text-[11px] font-bold text-slate-200">Activity Rules</span>
            </button>
          </div>

          {/* History Section matching Screenshot 1 */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 px-1">
              <div className="flex size-5 items-center justify-center rounded bg-teal-400 text-slate-950">
                <FileText className="size-3.5" />
              </div>
              <h2 className="font-display text-sm font-bold text-white">History</h2>
            </div>

            {/* Table with blue header */}
            <div className="overflow-hidden rounded-xl border border-[#1b2545] bg-[#0a0e20]">
              {/* Blue Header Bar */}
              <div className="grid grid-cols-3 bg-[#1d4ed8] px-3 py-2 text-center text-xs font-bold text-white">
                <div>Spin time</div>
                <div>Reward type</div>
                <div>prize</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#141b36] font-mono text-[11px]">
                {history.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-3 px-3 py-2.5 text-center text-slate-300"
                  >
                    <div className="text-[10px] text-slate-400 truncate">{row.time}</div>
                    <div className="text-slate-300 font-sans text-xs">{row.type}</div>
                    <div className="font-bold text-emerald-400">{row.prize}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Clean Modals for Description, Details, Rules & Referral */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#26335a] bg-[#0c1228] p-5 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1b2647] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-teal-400 text-slate-950">
                    {activeModal === "referral" ? (
                      <Share2 className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </div>
                  <h3 className="font-display text-base font-black capitalize">
                    {activeModal === "referral"
                      ? "Referral & Earn Spins"
                      : activeModal === "description"
                        ? "Event Description"
                        : activeModal === "details"
                          ? "Event Details"
                          : "Activity Rules"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex size-7 items-center justify-center rounded-full bg-[#182344] text-slate-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans max-h-72 overflow-y-auto pr-1">
                {activeModal === "description" && (
                  <>
                    <p>
                      <strong>🌟 Lucky Wheel Spin:</strong> Every registered member is eligible for
                      1 Free Daily Spin every 24 hours.
                    </p>
                    <p>
                      <strong>📱 Grand Jackpot:</strong> Spin to win the brand-new{" "}
                      <span className="font-bold text-amber-300">iPhone 17 Pro</span> or instant
                      cash bonuses up to ₹5,000 directly into your wallet.
                    </p>
                    <p>
                      <strong>⚡ Instant Payout:</strong> Cash prizes are automatically credited to
                      your game balance immediately upon winning.
                    </p>
                  </>
                )}

                {activeModal === "details" && (
                  <>
                    <p>
                      <strong>1. Recharge Bonus Spins:</strong> For every ₹100 recharge, you receive
                      +1 extra lucky spin!
                    </p>
                    <p>
                      <strong>2. Reward Tiers:</strong>
                      <br />• iPhone 17 (Ultra Rare)
                      <br />• ₹5,000 / ₹1,000 High Roll Cash
                      <br />• ₹100 / ₹50 / ₹10 / ₹5 / ₹2 Instant Rewards
                    </p>
                    <p>
                      <strong>3. Fair Gaming:</strong> All spin outcomes are calculated using an
                      audited cryptographic RNG algorithm.
                    </p>
                  </>
                )}

                {activeModal === "rules" && (
                  <>
                    <p>
                      <strong>• Rule 1:</strong> 1 free spin available per user account every 24
                      hours.
                    </p>
                    <p>
                      <strong>• Rule 2:</strong> Multiple duplicate accounts per device will be
                      disqualified from claiming jackpot items.
                    </p>
                    <p>
                      <strong>• Rule 3:</strong> In case of winning an iPhone 17, our support team
                      will reach out within 24 hours for shipping details.
                    </p>
                  </>
                )}

                {activeModal === "referral" && (
                  <div className="space-y-3">
                    <p>
                      Invite your friends to register and earn{" "}
                      <strong>1 Free Spin + ₹50 Bonus</strong> for each active friend!
                    </p>
                    <div className="rounded-xl border border-[#23315a] bg-[#070b18] p-3 space-y-2 font-mono">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Your Referral Code:</span>
                        <span className="font-bold text-amber-400">{referralCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={referralLink}
                          className="w-full rounded-lg bg-[#111833] px-2.5 py-1.5 text-[11px] text-slate-200 border border-[#1b264a] outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 shrink-0"
                        >
                          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full rounded-xl bg-teal-400 py-2.5 font-display text-sm font-black text-slate-950 transition hover:bg-teal-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Golden Indian Rupee Coin SVG Component matching Screenshot 1
// ---------------------------------------------------------------------------
function GoldRupeeCoin({ x, y, r }: { x: string; y: string; r: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r={r} fill="#fbbf24" stroke="#d97706" strokeWidth="0.6" />
      <circle cx="0" cy="0" r={Number(r) - 0.8} fill="#f59e0b" />
      <text
        x="0"
        y="1.8"
        fill="#78350f"
        fontSize={Number(r) * 1.2}
        fontWeight="900"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        ₹
      </text>
    </g>
  );
}
