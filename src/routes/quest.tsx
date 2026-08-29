import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Phone,
  UserCheck,
  CheckCircle2,
  X,
  History,
  Bell,
  PiggyBank,
  Gift,
  ExternalLink,
  Flame,
  Plane,
  Palette,
  Bomb,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SignInGate } from "@/components/SignInGate";
import {
  useClaimQuest,
  useDepositRequests,
  useHistory,
  usePlayer,
  useQuestClaims,
  useSession,
  useUpdateProfileData,
  useVerifyPhone,
} from "@/lib/player";
import { playSfx } from "@/lib/sound";

export const Route = createFileRoute("/quest")({
  head: () => ({
    meta: [
      { title: "Quest & Rewards — BaaziWin" },
      {
        name: "description",
        content:
          "Complete daily quests, deposit frenzies, and progression tasks to earn instant bonus rewards on BaaziWin.",
      },
    ],
  }),
  component: QuestPage,
});

/* ---------------- CUSTOM HIGH QUALITY 3D GLOWING STICKERS ---------------- */

function PhoneBindSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
        {/* Hand */}
        <path
          d="M20 38 L30 48 L44 42 L48 30 L40 24 L28 28 Z"
          fill="#e0a97a"
          stroke="#b37849"
          strokeWidth="1.5"
        />
        {/* Phone Body */}
        <rect
          x="18"
          y="12"
          width="24"
          height="40"
          rx="5"
          fill="#1e293b"
          stroke="#38bdf8"
          strokeWidth="2"
        />
        {/* Phone Screen Glow */}
        <rect x="21" y="16" width="18" height="32" rx="3" fill="#0284c7" />
        <rect x="23" y="18" width="14" height="28" rx="2" fill="#38bdf8" fillOpacity="0.85" />
        {/* Home notch */}
        <circle cx="30" cy="50" r="1.5" fill="#94a3b8" />
      </svg>
      {/* Floating +₹7 Glowing Badge */}
      <span className="absolute -top-1 -right-1 flex items-center font-display text-[10px] font-black text-[#ffee00] drop-shadow-[0_0_8px_rgba(255,238,0,0.9)]">
        +₹7
      </span>
    </div>
  );
}

function NotificationGiftSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
        <rect
          x="18"
          y="12"
          width="24"
          height="40"
          rx="5"
          fill="#0f172a"
          stroke="#eab308"
          strokeWidth="2"
        />
        <rect x="21" y="16" width="18" height="32" rx="3" fill="#ca8a04" />
        {/* Notification Bell */}
        <path
          d="M30 22 C26 22 24 25 24 29 L23 35 L37 35 L36 29 C36 25 34 22 30 22 Z"
          fill="#fef08a"
        />
        <circle cx="30" cy="38" r="2" fill="#fef08a" />
      </svg>
      <span className="absolute -top-1 -right-1 flex items-center font-display text-[10px] font-black text-[#ffee00] drop-shadow-[0_0_8px_rgba(255,238,0,0.9)]">
        +₹7
      </span>
    </div>
  );
}

function FirstDepositSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_10px_rgba(234,179,8,0.4)]">
        {/* Back Coin */}
        <ellipse
          cx="26"
          cy="34"
          rx="14"
          ry="14"
          fill="#ca8a04"
          stroke="#fef08a"
          strokeWidth="1.5"
        />
        <text x="22" y="39" fontSize="14" fontWeight="bold" fill="#fef08a">
          ₹
        </text>
        {/* Front Coin */}
        <ellipse cx="40" cy="30" rx="16" ry="16" fill="#eab308" stroke="#fffbeb" strokeWidth="2" />
        <ellipse cx="40" cy="30" rx="12" ry="12" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        <text x="35" y="36" fontSize="16" fontWeight="bold" fill="#78350f">
          ₹
        </text>
        {/* Sparkles */}
        <polygon points="50,14 52,18 56,20 52,22 50,26 48,22 44,20 48,18" fill="#fff" />
      </svg>
    </div>
  );
}

function DepositFrenzySticker({ tier = 1 }: { tier?: number }) {
  const colors = [
    ["#10b981", "#059669"], // Tier 1: Green
    ["#06b6d4", "#0891b2"], // Tier 2: Cyan
    ["#3b82f6", "#2563eb"], // Tier 3: Blue
    ["#8b5cf6", "#7c3aed"], // Tier 4: Purple
    ["#f59e0b", "#d97706"], // Tier 5: Amber Gold
    ["#ec4899", "#db2777"], // Tier 6: Pink/Rose Gold
  ];
  const [c1, c2] = colors[(tier - 1) % colors.length];

  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
        {/* Outer Wheel */}
        <circle cx="32" cy="32" r="22" fill={c2} stroke="#fde047" strokeWidth="2" />
        {/* Wheel Segments */}
        <path d="M32 10 A22 22 0 0 1 54 32 L32 32 Z" fill={c1} />
        <path d="M54 32 A22 22 0 0 1 32 54 L32 32 Z" fill="#ec4899" />
        <path d="M32 54 A22 22 0 0 1 10 32 L32 32 Z" fill="#3b82f6" />
        <path d="M10 32 A22 22 0 0 1 32 10 L32 32 Z" fill="#eab308" />
        {/* Center Hub */}
        <circle cx="32" cy="32" r="8" fill="#1e1b18" stroke="#fde047" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="4" fill="#facc15" />
        {/* Gold coins at base */}
        <ellipse cx="20" cy="50" rx="8" ry="4" fill="#eab308" stroke="#78350f" strokeWidth="1" />
        <ellipse cx="28" cy="52" rx="7" ry="3.5" fill="#facc15" stroke="#78350f" strokeWidth="1" />
      </svg>
    </div>
  );
}

function SevenDayGiftsSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_10px_rgba(16,185,129,0.4)]">
        {/* Chest Base */}
        <rect
          x="12"
          y="24"
          width="40"
          height="26"
          rx="4"
          fill="#059669"
          stroke="#fde047"
          strokeWidth="2"
        />
        {/* Chest Lid */}
        <path d="M12 24 C12 16 52 16 52 24 Z" fill="#10b981" stroke="#fde047" strokeWidth="2" />
        {/* Gold Straps */}
        <rect x="20" y="18" width="5" height="32" fill="#facc15" />
        <rect x="39" y="18" width="5" height="32" fill="#facc15" />
        {/* Golden Lock */}
        <rect
          x="28"
          y="26"
          width="8"
          height="9"
          rx="2"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="1"
        />
        <circle cx="32" cy="29" r="1.5" fill="#854d0e" />
      </svg>
    </div>
  );
}

function LuckySpinSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_10px_rgba(244,63,94,0.4)]">
        <circle cx="32" cy="32" r="22" fill="#fb7185" stroke="#ffe4e6" strokeWidth="2" />
        <path d="M32 10 A22 22 0 0 1 54 32 L32 32 Z" fill="#facc15" />
        <path d="M54 32 A22 22 0 0 1 32 54 L32 32 Z" fill="#38bdf8" />
        <path d="M32 54 A22 22 0 0 1 10 32 L32 32 Z" fill="#a855f7" />
        <path d="M10 32 A22 22 0 0 1 32 10 L32 32 Z" fill="#f43f5e" />
        <circle cx="32" cy="32" r="7" fill="#ffffff" stroke="#f43f5e" strokeWidth="2" />
        <polygon points="32,20 35,26 29,26" fill="#f43f5e" />
      </svg>
    </div>
  );
}

function ExploreViewerSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_8px_rgba(56,189,248,0.4)]">
        {/* Radar / Viewer screen */}
        <rect
          x="12"
          y="14"
          width="40"
          height="36"
          rx="6"
          fill="#0f172a"
          stroke="#38bdf8"
          strokeWidth="2"
        />
        <circle
          cx="32"
          cy="32"
          r="12"
          fill="#0284c7"
          fillOpacity="0.4"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        <circle cx="32" cy="32" r="5" fill="#38bdf8" />
        {/* Radar sweep lines */}
        <line
          x1="32"
          y1="20"
          x2="32"
          y2="44"
          stroke="#7dd3fc"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <line
          x1="20"
          y1="32"
          x2="44"
          y2="32"
          stroke="#7dd3fc"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {/* Floating +₹10 Badge */}
        <text x="32" y="58" fontSize="9" fontWeight="900" textAnchor="middle" fill="#ffee00">
          VIEW x3
        </text>
      </svg>
    </div>
  );
}

function MultiGameSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_8px_rgba(244,63,94,0.4)]">
        {/* Gamepad shape */}
        <path
          d="M16 26 C12 26 10 36 14 46 C16 51 22 51 26 44 L32 38 L38 44 C42 51 48 51 50 46 C54 36 52 26 48 26 Z"
          fill="#1e1b4b"
          stroke="#818cf8"
          strokeWidth="2"
        />
        {/* D-pad */}
        <polygon
          points="22,30 24,30 24,34 26,34 26,36 24,36 24,40 22,40 22,36 20,36 20,34 22,34"
          fill="#a5b4fc"
        />
        {/* Buttons */}
        <circle cx="42" cy="32" r="2" fill="#f43f5e" />
        <circle cx="46" cy="36" r="2" fill="#22c55e" />
        <circle cx="38" cy="36" r="2" fill="#eab308" />
        <circle cx="42" cy="40" r="2" fill="#38bdf8" />
      </svg>
    </div>
  );
}

function ChampionCupSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_10px_rgba(234,179,8,0.5)]">
        {/* Trophy Base */}
        <rect
          x="22"
          y="48"
          width="20"
          height="6"
          rx="2"
          fill="#78350f"
          stroke="#facc15"
          strokeWidth="1"
        />
        <rect x="28" y="40" width="8" height="8" fill="#ca8a04" />
        {/* Trophy Cup */}
        <path
          d="M18 16 L46 16 L42 36 C40 42 24 42 22 36 Z"
          fill="#eab308"
          stroke="#fffbeb"
          strokeWidth="1.5"
        />
        {/* Handles */}
        <path d="M18 20 C10 20 10 30 18 32" fill="none" stroke="#facc15" strokeWidth="2" />
        <path d="M46 20 C54 20 54 30 46 32" fill="none" stroke="#facc15" strokeWidth="2" />
        {/* Star */}
        <polygon points="32,22 34,26 38,26 35,29 36,33 32,30 28,33 29,29 26,26 30,26" fill="#fff" />
      </svg>
    </div>
  );
}

function VipCashbackSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_8px_rgba(34,197,94,0.4)]">
        {/* Shield / Badge */}
        <polygon
          points="32,8 54,18 46,48 32,58 18,48 10,18"
          fill="#14532d"
          stroke="#22c55e"
          strokeWidth="2"
        />
        {/* Stars on top */}
        <polygon
          points="32,16 34,20 38,20 35,23 36,27 32,24 28,27 29,23 26,20 30,20"
          fill="#facc15"
        />
        <text x="18" y="42" fontSize="12" fontWeight="900" fill="#4ade80">
          VIP
        </text>
        <text x="38" y="42" fontSize="9" fontWeight="bold" fill="#fde047">
          x10
        </text>
      </svg>
    </div>
  );
}

function VipMoneyPotSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-12 drop-shadow-[0_4px_10px_rgba(234,179,8,0.5)]">
        {/* Red Bowl Base */}
        <ellipse cx="32" cy="48" rx="22" ry="7" fill="#7f1d1d" />
        <path
          d="M10 32 Q32 58 54 32 Q54 26 32 26 Q10 26 10 32 Z"
          fill="#b91c1c"
          stroke="#facc15"
          strokeWidth="2"
        />
        {/* Gold Ingot / Coins Overspill */}
        <ellipse cx="32" cy="24" rx="16" ry="7" fill="#facc15" stroke="#854d0e" strokeWidth="1.5" />
        <ellipse cx="26" cy="20" rx="10" ry="5" fill="#fef08a" />
        <ellipse cx="38" cy="20" rx="9" ry="4.5" fill="#fef08a" />
        <circle cx="32" cy="14" r="5" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        <text x="30" y="17" fontSize="7" fontWeight="bold" fill="#78350f">
          ₹
        </text>
      </svg>
    </div>
  );
}

function AviatorSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-11 drop-shadow-[0_4px_8px_rgba(239,68,68,0.4)]">
        <path
          d="M14 42 L28 34 L48 18 Q54 14 52 20 L44 32 L36 38 L14 42 Z"
          fill="#ef4444"
          stroke="#fee2e2"
          strokeWidth="1.5"
        />
        {/* Wings */}
        <polygon points="32,28 42,12 46,14 36,32" fill="#dc2626" />
        <polygon points="26,36 20,48 24,49 32,38" fill="#991b1b" />
        {/* Jet Flame */}
        <polygon points="14,42 6,46 10,40" fill="#facc15" />
      </svg>
    </div>
  );
}

function ColorDiscSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-11 drop-shadow-[0_4px_8px_rgba(168,85,247,0.4)]">
        <circle cx="32" cy="32" r="22" fill="#1e1b18" stroke="#facc15" strokeWidth="2" />
        <path d="M32 10 A22 22 0 0 1 54 32 L32 32 Z" fill="#22c55e" />
        <path d="M54 32 A22 22 0 0 1 10 32 L32 32 Z" fill="#ef4444" />
        <path d="M10 32 A22 22 0 0 1 32 10 L32 32 Z" fill="#a855f7" />
        <circle cx="32" cy="32" r="8" fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function MinesSticker() {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-11 drop-shadow-[0_4px_8px_rgba(234,179,8,0.4)]">
        <circle cx="32" cy="34" r="18" fill="#1e293b" stroke="#eab308" strokeWidth="2" />
        {/* Spikes */}
        <line x1="32" y1="16" x2="32" y2="8" stroke="#eab308" strokeWidth="3" />
        <line x1="14" y1="34" x2="6" y2="34" stroke="#eab308" strokeWidth="3" />
        <line x1="50" y1="34" x2="58" y2="34" stroke="#eab308" strokeWidth="3" />
        <line x1="18" y1="20" x2="12" y2="14" stroke="#eab308" strokeWidth="3" />
        <line x1="46" y1="20" x2="52" y2="14" stroke="#eab308" strokeWidth="3" />
        {/* Center skull/danger */}
        <circle cx="32" cy="34" r="6" fill="#ef4444" />
      </svg>
    </div>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */

const AVATARS = ["🐯", "🦁", "🐉", "🦅", "🐺", "👑", "⚡", "🚀", "💎", "🔥"];

function QuestPage() {
  const router = useRouter();
  const { user } = useSession();
  const { data: player } = usePlayer();
  const { data: history } = useHistory(100);
  const { data: claims } = useQuestClaims();
  const { data: deposits } = useDepositRequests();
  const claimQuest = useClaimQuest();
  const verifyPhone = useVerifyPhone();
  const updateProfile = useUpdateProfileData();

  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(player?.phone || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState(player?.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(player?.avatar || "🐯");

  // Notification state
  const [notificationAllowed, setNotificationAllowed] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationAllowed(true);
    }
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const claimedKeys = new Set(
    (claims || []).map((c: any) => (c.quest_date ? `${c.quest_key}_${c.quest_date}` : c.quest_key)),
  );

  const isClaimed = (key: string, isDaily = true) => {
    if (isDaily) return claimedKeys.has(`${key}_${todayStr}`) || claimedKeys.has(key);
    return claimedKeys.has(key) || (claims || []).some((c: any) => c.quest_key === key);
  };

  // Metrics from real gameplay & deposits
  const allRounds = history || [];
  const aviatorCount = allRounds.filter((r) =>
    ["aviator", "go-rush", "jetx", "cricketx", "space-blast"].includes(r.game_slug),
  ).length;
  const colorCount = allRounds.filter((r) => r.game_slug === "color-trading").length;
  const minesWins = allRounds.filter(
    (r) => r.game_slug === "mines" && (Number(r.multiplier) || 0) > 1,
  ).length;
  const totalWinsCount = allRounds.filter(
    (r) => (Number(r.payout) || 0) > (Number(r.bet) || 0),
  ).length;
  const uniqueGamesCount = new Set(allRounds.map((r) => r.game_slug)).size;

  const totalDepositAmount =
    (deposits || [])
      .filter((d) => d.status === "approved" || d.status === "COMPLETED")
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0) ||
    (player?.deposit_balance ?? 0);
  const hasDeposited = totalDepositAmount >= 100;

  // Explore Viewer click tracking
  const [exploreViews, setExploreViews] = useState(() => {
    try {
      return Number(localStorage.getItem("3cr:explore_views")) || 0;
    } catch {
      return 0;
    }
  });

  const handleOpenViewer = () => {
    const nextVal = exploreViews + 1;
    setExploreViews(nextVal);
    try {
      localStorage.setItem("3cr:explore_views", String(nextVal));
    } catch {}
    if (nextVal >= 3) {
      toast.success("Explore viewer task completed! You can now claim ₹10 reward.");
    } else {
      toast.info(`Viewed ${nextVal}/3 times. View ${3 - nextVal} more times to claim ₹10!`);
    }
    router.navigate({ to: "/explore" });
  };

  // Spinning wheel animation state for Lucky Spin ₹2
  const [isSpinning, setIsSpinning] = useState(false);

  const handleLuckySpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    playSfx("spin");
    toast.info("Spinning the lucky wheel...");
    setTimeout(async () => {
      setIsSpinning(false);
      await handleClaimReward("lucky_spin_2", 2);
    }, 1200);
  };

  // Check today's rounds for 7-day gifts
  const roundsCount = allRounds.length;
  const hasPlayed3Rounds = roundsCount >= 3;
  const hasPlayed1Round = roundsCount >= 1;

  /* ---------------- ALL AUTHENTIC QUESTS ---------------- */
  const QUEST_ITEMS = [
    // 1. First Deposit (Min ₹100)
    {
      id: "first_deposit",
      title: "First Deposit (Min ₹100)",
      headerRight: `${Math.min(100, totalDepositAmount)}/100`,
      sticker: <FirstDepositSticker />,
      description: "Complete your first deposit of ₹100 or more to claim ₹25 reward",
      progress: Math.min(100, totalDepositAmount),
      target: 100,
      reward: 25,
      isProgress: true,
      btnType: hasDeposited ? (isClaimed("first_deposit", false) ? "claimed" : "claim") : "deposit",
      btnText: hasDeposited ? "Claim" : "Deposit",
      linkTo: hasDeposited ? undefined : "/wallet",
    },
    // 2. Bind Phone Number (+₹10)
    {
      id: "bind_phone_number",
      title: "Bind Phone Number",
      headerRight: player?.phone_verified ? "Verified" : "Pending",
      sticker: <PhoneBindSticker />,
      description: "Verify your phone number with OTP to claim ₹10 reward",
      reward: 10,
      isProgress: false,
      btnType: player?.phone_verified
        ? isClaimed("bind_phone_number", false)
          ? "claimed"
          : "claim"
        : "bind",
      btnText: player?.phone_verified ? "Claim" : "Bind",
      onAction: () => setShowPhoneModal(true),
    },
    // 3. 7 Day Gifts - Requires 3 Game Rounds
    {
      id: "seven_day_gifts",
      title: "Daily Login & Play (3 Rounds)",
      headerRight: `${Math.min(3, roundsCount)}/3`,
      sticker: <SevenDayGiftsSticker />,
      description: "Play at least 3 game rounds today to claim your daily ₹15 gift",
      reward: 15,
      progress: Math.min(3, roundsCount),
      target: 3,
      isProgress: true,
      btnType: hasPlayed3Rounds
        ? isClaimed("seven_day_gifts", true)
          ? "claimed"
          : "claim"
        : "view",
      btnText: hasPlayed3Rounds ? "Claim" : "Play (3 Rounds)",
      linkTo: hasPlayed3Rounds ? undefined : "/explore",
    },
    // 4. Lucky Spin - Requires 1 Game Round
    {
      id: "lucky_spin_2",
      title: "Lucky Spin (Play 1 Game to Unlock)",
      headerRight: `${Math.min(1, roundsCount)}/1`,
      sticker: <LuckySpinSticker />,
      description: "Play any 1 game round to unlock the lucky spin wheel for ₹2 cash back",
      reward: 2,
      progress: Math.min(1, roundsCount),
      target: 1,
      isProgress: true,
      btnType: hasPlayed1Round ? (isClaimed("lucky_spin_2", true) ? "claimed" : "spin") : "view",
      btnText: hasPlayed1Round ? (isSpinning ? "Spinning..." : "Spin") : "Play 1 Game",
      linkTo: hasPlayed1Round ? undefined : "/explore",
      onAction: hasPlayed1Round ? handleLuckySpin : undefined,
    },
    // 5. Open Viewer 3 Times - ₹10
    {
      id: "explore_viewer_3",
      title: "Game Explorer - Open Viewer 3 Times",
      headerRight: `${Math.min(3, exploreViews)}/3`,
      sticker: <ExploreViewerSticker />,
      description: "Open and browse the game explorer 3 times to get ₹10 reward",
      reward: 10,
      progress: Math.min(3, exploreViews),
      target: 3,
      isProgress: true,
      btnType:
        exploreViews >= 3
          ? isClaimed("explore_viewer_3", true)
            ? "claimed"
            : "claim"
          : "view_action",
      btnText: exploreViews >= 3 ? "Claim" : "View",
      onAction: handleOpenViewer,
    },
    // 6. Deposit Frenzy 500 - ₹30
    {
      id: "deposit_frenzy_500",
      title: "Deposit Frenzy 1 (₹500+)",
      headerRight: `${Math.min(500, totalDepositAmount)}/500`,
      sticker: <DepositFrenzySticker tier={1} />,
      progress: Math.min(500, totalDepositAmount),
      target: 500,
      reward: 30,
      isProgress: true,
      btnType:
        totalDepositAmount >= 500
          ? isClaimed("deposit_frenzy_500", false)
            ? "claimed"
            : "claim"
          : "deposit",
      btnText: "Deposit",
      linkTo: totalDepositAmount >= 500 ? undefined : "/wallet",
    },
    // 7. Deposit Frenzy 1000 - ₹40
    {
      id: "deposit_frenzy_1000",
      title: "Deposit Frenzy 2 (₹1,000+)",
      headerRight: `${Math.min(1000, totalDepositAmount)}/1000`,
      sticker: <DepositFrenzySticker tier={2} />,
      progress: Math.min(1000, totalDepositAmount),
      target: 1000,
      reward: 40,
      isProgress: true,
      btnType:
        totalDepositAmount >= 1000
          ? isClaimed("deposit_frenzy_1000", false)
            ? "claimed"
            : "claim"
          : "deposit",
      btnText: "Deposit",
      linkTo: totalDepositAmount >= 1000 ? undefined : "/wallet",
    },
    // 8. Play 5 Different Games - ₹20
    {
      id: "play_5_games",
      title: "Arcade Variety - Play 5 Games",
      headerRight: `${Math.min(5, uniqueGamesCount)}/5`,
      sticker: <MultiGameSticker />,
      progress: Math.min(5, uniqueGamesCount),
      target: 5,
      reward: 20,
      isProgress: true,
      btnType:
        uniqueGamesCount >= 5 ? (isClaimed("play_5_games", true) ? "claimed" : "claim") : "view",
      btnText: uniqueGamesCount >= 5 ? "Claim" : "Play",
      linkTo: uniqueGamesCount >= 5 ? undefined : "/explore",
    },
    // 9. Deposit Frenzy 2000 - ₹50
    {
      id: "deposit_frenzy_2000",
      title: "Deposit Frenzy 3 (₹2,000+)",
      headerRight: `${Math.min(2000, totalDepositAmount)}/2000`,
      sticker: <DepositFrenzySticker tier={3} />,
      progress: Math.min(2000, totalDepositAmount),
      target: 2000,
      reward: 50,
      isProgress: true,
      btnType:
        totalDepositAmount >= 2000
          ? isClaimed("deposit_frenzy_2000", false)
            ? "claimed"
            : "claim"
          : "deposit",
      btnText: "Deposit",
      linkTo: totalDepositAmount >= 2000 ? undefined : "/wallet",
    },
    // 10. Deposit Frenzy 3000 - ₹70
    {
      id: "deposit_frenzy_3000",
      title: "Deposit Frenzy 4 (₹3,000+)",
      headerRight: `${Math.min(3000, totalDepositAmount)}/3000`,
      sticker: <DepositFrenzySticker tier={4} />,
      progress: Math.min(3000, totalDepositAmount),
      target: 3000,
      reward: 70,
      isProgress: true,
      btnType:
        totalDepositAmount >= 3000
          ? isClaimed("deposit_frenzy_3000", false)
            ? "claimed"
            : "claim"
          : "deposit",
      btnText: "Deposit",
      linkTo: totalDepositAmount >= 3000 ? undefined : "/wallet",
    },
    // 11. Deposit Frenzy 6000 - ₹100
    {
      id: "deposit_frenzy_6000",
      title: "Deposit Frenzy 5 (₹6,000+)",
      headerRight: `${Math.min(6000, totalDepositAmount)}/6000`,
      sticker: <DepositFrenzySticker tier={5} />,
      progress: Math.min(6000, totalDepositAmount),
      target: 6000,
      reward: 100,
      isProgress: true,
      btnType:
        totalDepositAmount >= 6000
          ? isClaimed("deposit_frenzy_6000", false)
            ? "claimed"
            : "claim"
          : "deposit",
      btnText: "Deposit",
      linkTo: totalDepositAmount >= 6000 ? undefined : "/wallet",
    },
    // 12. Aviator Pilot (0/5) - ₹15
    {
      id: "aviator_pilot",
      title: "Aviator Pilot - Play 5 Rounds",
      headerRight: `${Math.min(5, aviatorCount)}/5`,
      sticker: <AviatorSticker />,
      progress: Math.min(5, aviatorCount),
      target: 5,
      reward: 15,
      isProgress: true,
      btnType:
        aviatorCount >= 5 ? (isClaimed("aviator_pilot", true) ? "claimed" : "claim") : "view",
      btnText: aviatorCount >= 5 ? "Claim" : "Play",
      linkTo: aviatorCount >= 5 ? undefined : "/game/aviator",
    },
    // 13. Color Predictor (0/10) - ₹20
    {
      id: "color_predictor",
      title: "Color Predictor - Play 10 Rounds",
      headerRight: `${Math.min(10, colorCount)}/10`,
      sticker: <ColorDiscSticker />,
      progress: Math.min(10, colorCount),
      target: 10,
      reward: 20,
      isProgress: true,
      btnType:
        colorCount >= 10 ? (isClaimed("color_predictor", true) ? "claimed" : "claim") : "view",
      btnText: colorCount >= 10 ? "Claim" : "Play",
      linkTo: colorCount >= 10 ? undefined : "/game/color-trading",
    },
    // 14. Mines Explorer (0/3) - ₹25
    {
      id: "mines_explorer",
      title: "Mines Explorer - Win 3 Times",
      headerRight: `${Math.min(3, minesWins)}/3`,
      sticker: <MinesSticker />,
      progress: Math.min(3, minesWins),
      target: 3,
      reward: 25,
      isProgress: true,
      btnType: minesWins >= 3 ? (isClaimed("mines_explorer", true) ? "claimed" : "claim") : "view",
      btnText: minesWins >= 3 ? "Claim" : "Play",
      linkTo: minesWins >= 3 ? undefined : "/game/mines",
    },
    // 15. Arcade Champion - Win 5 Game Rounds - ₹30
    {
      id: "arcade_champion_5",
      title: "Arcade Champion - Win 5 Rounds",
      headerRight: `${Math.min(5, totalWinsCount)}/5`,
      sticker: <ChampionCupSticker />,
      progress: Math.min(5, totalWinsCount),
      target: 5,
      reward: 30,
      isProgress: true,
      btnType:
        totalWinsCount >= 5 ? (isClaimed("arcade_champion_5", true) ? "claimed" : "claim") : "view",
      btnText: totalWinsCount >= 5 ? "Claim" : "Play",
      linkTo: totalWinsCount >= 5 ? undefined : "/",
    },
  ];

  const handleClaimReward = async (questId: string, reward: number) => {
    const qItem = QUEST_ITEMS.find((q) => q.id === questId);
    if (qItem && qItem.btnType !== "claim" && qItem.btnType !== "spin") {
      toast.error("You must complete this task requirement first before claiming the bonus!");
      return;
    }

    try {
      await claimQuest.mutateAsync({ key: questId, reward });
      playSfx("win");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      toast.success(`+₹${reward} Bonus Cash credited to your Bonus Wallet! 🎉`);
    } catch {
      toast.error("Failed to claim reward.");
    }
  };

  const handleShare = async (questId: string, reward: number) => {
    const inviteLink = `${window.location.origin}/?ref=${player?.referral_code || "BAAZIWIN"}`;
    const shareText = `Play & Win on BaaziWin! Complete daily quests and win ₹1,700 bonus: ${inviteLink}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "BaaziWin", text: shareText, url: inviteLink });
      } catch {}
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
    }

    // Auto claim social share reward
    await handleClaimReward(questId, reward);
  };

  // Submit OTP Verification
  const handleVerifyOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!otpCode || otpCode.length !== 6) {
      toast.error("Please enter the 6-digit OTP code (Demo: 482910).");
      return;
    }
    try {
      const res = await verifyPhone.mutateAsync({ phone: phoneNumber, otp: otpCode });
      setShowPhoneModal(false);
      playSfx("win");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      if (res.rewardClaimed) {
        toast.success("Phone verified! +₹10 Bonus Cash added.");
      } else {
        toast.success("Phone number updated successfully.");
      }
    } catch (e: any) {
      toast.error(e.message || "OTP verification failed.");
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[#141311] pb-24 text-slate-100 font-sans">
        {/* ---------------- TOP APP BAR (Exact match to screenshot) ---------------- */}
        <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-white/5 bg-[#1a1815]/95 px-3 backdrop-blur-md">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.history.back()}
            className="flex size-9 items-center justify-center rounded-xl bg-[#2a2722] text-white/90 border border-white/5 transition hover:bg-[#38352e] active:scale-95"
            aria-label="Go Back"
          >
            <ChevronLeft className="size-5" />
          </button>

          {/* Title */}
          <h1 className="font-display text-base font-bold tracking-wide text-white">Quest</h1>

          {/* History Button */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1 rounded-xl bg-[#2e2a24] px-3 py-1.5 text-xs font-semibold text-white/90 border border-white/5 transition hover:bg-[#3a352e] active:scale-95"
          >
            <span>History</span>
            <ChevronRight className="size-3.5 text-white/60" />
          </button>
        </div>

        {/* ---------------- MAIN QUEST LIST ---------------- */}
        <div className="mx-auto w-full max-w-lg space-y-3 px-3 pt-3">
          {QUEST_ITEMS.map((q) => {
            const progressVal = q.progress ?? 0;
            const targetVal = q.target ?? 100;
            const progressPercent = Math.min(100, Math.round((progressVal / targetVal) * 100));

            return (
              <div
                key={q.id}
                className="overflow-hidden rounded-2xl border border-[#38342d]/80 bg-[#1c1b18] shadow-md transition"
              >
                {/* 1. Header Bar of Card (Charcoal Stone Header) */}
                <div className="flex items-center justify-between bg-[#2f2b25] px-4 py-2.5 text-xs font-bold text-white/90">
                  <span className="font-display tracking-wide">{q.title}</span>
                  {q.headerRight && (
                    <span className="font-mono text-white/80 font-bold">{q.headerRight}</span>
                  )}
                </div>

                {/* 2. Body Bar of Card */}
                <div className="flex items-center justify-between gap-3 p-3.5">
                  {/* Left: 3D Glowing Sticker */}
                  <div className="shrink-0">{q.sticker}</div>

                  {/* Middle: Subtitle & Progress */}
                  <div className="min-w-0 flex-1">
                    {q.isProgress ? (
                      <div>
                        <div className="flex items-center gap-1 text-xs text-stone-300">
                          <span>Deposit:</span>
                          <span className="font-mono font-bold text-[#ffee00] drop-shadow-[0_0_6px_rgba(255,238,0,0.6)]">
                            ₹{progressVal}.0
                          </span>
                          <span className="font-mono text-stone-400">/₹{targetVal}</span>
                        </div>
                        {/* Progress Bar (dark track with glowing cyan/blue/yellow bar) */}
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#121820] p-0.5 border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#67e8f9] shadow-[0_0_8px_rgba(56,189,248,0.7)] transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] sm:text-xs leading-tight text-stone-300">
                        {q.description}
                      </p>
                    )}
                  </div>

                  {/* Right: Glowing Action Button */}
                  <div className="shrink-0">
                    {q.btnType === "deposit" && (
                      <Link
                        to="/wallet"
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-[#ffee00] px-4 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95"
                      >
                        <PiggyBank className="size-4 shrink-0 fill-slate-950" />
                        <span>Deposit</span>
                      </Link>
                    )}

                    {q.btnType === "claim" && (
                      <button
                        type="button"
                        onClick={() => handleClaimReward(q.id, q.reward)}
                        className="flex items-center justify-center gap-1 rounded-xl bg-[#00e676] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(0,230,118,0.65)] transition hover:brightness-110 active:scale-95 animate-pulse"
                      >
                        <span>Claim</span>
                      </button>
                    )}

                    {q.btnType === "claimed" && (
                      <div className="flex items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        <span>Done</span>
                      </div>
                    )}

                    {q.btnType === "bind" && (
                      <button
                        type="button"
                        onClick={q.onAction}
                        className="rounded-xl bg-[#ffee00] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95"
                      >
                        Bind
                      </button>
                    )}

                    {q.btnType === "spin" && (
                      <button
                        type="button"
                        onClick={q.onAction}
                        disabled={isSpinning}
                        className={`rounded-xl bg-[#ffee00] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95 ${
                          isSpinning ? "opacity-75 animate-pulse" : ""
                        }`}
                      >
                        {q.btnText}
                      </button>
                    )}

                    {q.btnType === "view_action" && (
                      <button
                        type="button"
                        onClick={q.onAction}
                        className="rounded-xl bg-[#ffee00] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95"
                      >
                        {q.btnText}
                      </button>
                    )}

                    {q.btnType === "share" && (
                      <button
                        type="button"
                        onClick={() => handleShare(q.id, q.reward)}
                        className="rounded-xl bg-[#ffee00] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95"
                      >
                        Share
                      </button>
                    )}

                    {q.btnType === "view" && (
                      <Link
                        to={q.linkTo || "/"}
                        className="flex items-center justify-center rounded-xl bg-[#ffee00] px-5 py-2 text-xs font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition hover:brightness-110 active:scale-95"
                      >
                        <span>{q.btnText}</span>
                      </Link>
                    )}

                    {q.btnType === "timer" && (
                      <div className="rounded-xl bg-[#2b2721] border border-white/5 px-3 py-2 font-mono text-[11px] font-bold text-stone-400">
                        {q.btnText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------------- HISTORY DRAWER / MODAL ---------------- */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-[#3d3830] bg-[#1a1815] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-[#ffee00]" />
                  <h3 className="font-display text-base font-bold text-white">
                    Quest Claim History
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="rounded-lg p-1 text-stone-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
                {claims && claims.length > 0 ? (
                  claims.map((c: any, idx: number) => (
                    <div
                      key={`claim-${c.id || idx}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#26231e] p-2.5 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white capitalize">
                          {c.quest_key.replace(/_/g, " ")}
                        </p>
                        <p className="font-mono text-[10px] text-stone-400">
                          {c.claimed_at ? new Date(c.claimed_at).toLocaleDateString() : "Today"}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-black text-[#00e676]">
                        +₹{c.reward || 10} Bonus
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No quest rewards claimed yet. Complete tasks above to start earning!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PHONE & OTP MODAL ---------------- */}
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-[#3d3830] bg-[#1a1815] p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-[#ffee00]/20 text-[#ffee00]">
                    <Phone className="size-4" />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">Bind Phone Number</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="rounded-lg p-1 text-stone-400 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="mt-2 text-xs text-stone-300">
                Bind your 10-digit phone number for security and get{" "}
                <strong>+₹10 Bonus Cash</strong> instantly.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="font-mono text-[11px] uppercase text-stone-400">
                    Mobile Number (+91)
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-[#12110f] px-3">
                    <span className="mr-1 font-mono text-xs font-bold text-stone-400">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="9876543210"
                      className="h-10 w-full bg-transparent font-mono text-sm text-white outline-none"
                    />
                    {!otpSent && (
                      <button
                        type="button"
                        onClick={() => {
                          if (phoneNumber.length === 10) {
                            setOtpSent(true);
                            setOtpCode("482910");
                            toast.success("OTP sent: 482910 (auto-filled for quick bind)");
                          } else {
                            toast.error("Please enter a 10-digit phone number");
                          }
                        }}
                        className="rounded-lg bg-[#ffee00] px-2.5 py-1 text-[11px] font-black text-slate-950"
                      >
                        Send OTP
                      </button>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="font-mono text-[11px] uppercase text-stone-400">
                      6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="482910"
                      className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#12110f] px-3 font-mono text-center text-base tracking-widest text-white outline-none focus:border-[#ffee00]"
                    />
                    <p className="mt-1 font-mono text-[10px] text-[#00e676]">Demo OTP: 482910</p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={verifyPhone.isPending}
                  onClick={handleVerifyOtp}
                  className="mt-2 h-11 w-full rounded-xl bg-[#ffee00] font-display text-sm font-black text-slate-950 shadow-[0_0_16px_rgba(255,238,0,0.5)] transition active:scale-95 disabled:opacity-50"
                >
                  {verifyPhone.isPending ? "Binding Phone..." : "Bind & Claim +₹10"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
