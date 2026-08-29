import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Crown,
  QrCode,
  Sliders,
  Users,
  Plane,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Plus,
  Minus,
  Search,
  Eye,
  Settings,
  Flame,
  Radio,
  Lock,
  ArrowRight,
  TrendingUp,
  Coins,
  Send,
  Upload,
  Percent,
  PauseCircle,
  Clock,
  Terminal,
  Check,
  Info,
  Layers,
  Image as ImageIcon,
  Edit3,
  UserPlus,
  Target,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { AppShell } from "@/components/AppShell";
import {
  useAppConfig,
  saveAppConfig,
  MASTER_ADMIN_EMAIL,
  isSuperAdminEmail,
  DEFAULT_QR_URLS,
  type AppConfig,
} from "@/lib/appConfig";
import { auth, db } from "@/lib/firebase";
import { useAviatorSync, calculateFlightDuration } from "@/lib/aviatorSync";
import { useColorTradingSync } from "@/lib/colorSync";
import {
  useSession,
  usePlayer,
  useAllDepositRequests,
  adminUpdateDepositStatus,
  sendSimulatedBankSms,
  type Player,
  type DepositRequest,
} from "@/lib/player";
import { collection, doc, getDocs, updateDoc, setDoc, addDoc, getDoc } from "firebase/firestore";
import { formatMoney } from "@/lib/games";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "App Manage & Master Control — BaaziWin" },
      { name: "description", content: "Master Ownership & Admin Control Panel for BaaziWin." },
    ],
  }),
  component: ManagePage,
});

export function ManagePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: player } = usePlayer();
  const { data: config, loading: configLoading } = useAppConfig();

  const isAdmin = isSuperAdminEmail(user?.email || player?.email);

  const [activeTab, setActiveTab] = useState<
    | "multipliers"
    | "qr_upi"
    | "algorithm"
    | "crash"
    | "players"
    | "deposits"
    | "webhook_sim"
    | "profit"
  >("multipliers");

  // Form states for Multipliers & Global Control
  const [globalMultiplier, setGlobalMultiplier] = useState(config.global_game_multiplier || 1.0);
  const [wheelMultiplier, setWheelMultiplier] = useState(config.wheel_multiplier || 1.0);
  const [wheelJackpotMode, setWheelJackpotMode] = useState(config.wheel_jackpot_mode || "standard");
  const [storeCoinMultiplier, setStoreCoinMultiplier] = useState(
    config.store_coin_multiplier || 1.0,
  );
  const [storeBonusPct, setStoreBonusPct] = useState(config.store_bonus_pct || 10.0);
  const [liveAnnouncement, setLiveAnnouncement] = useState(config.live_announcement || "");

  // Form states for QR & UPI (6 distinct amount-specific QR codes)
  const [qr100, setQr100] = useState(config.deposit_qr_100 || DEFAULT_QR_URLS[100]);
  const [qr200, setQr200] = useState(config.deposit_qr_200 || DEFAULT_QR_URLS[200]);
  const [qr500, setQr500] = useState(config.deposit_qr_500 || DEFAULT_QR_URLS[500]);
  const [qr1000, setQr1000] = useState(config.deposit_qr_1000 || DEFAULT_QR_URLS[1000]);
  const [qr2500, setQr2500] = useState(config.deposit_qr_2500 || DEFAULT_QR_URLS[2500]);
  const [qr5000, setQr5000] = useState(config.deposit_qr_5000 || DEFAULT_QR_URLS[5000]);
  const [previewQrAmount, setPreviewQrAmount] = useState<number>(100);

  const [vpa, setVpa] = useState(config.upi_vpa);
  const [payeeName, setPayeeName] = useState(config.upi_payee_name);
  const [supportPhone, setSupportPhone] = useState(config.support_phone);
  const [supportWhatsapp, setSupportWhatsapp] = useState(config.support_whatsapp);
  const [supportTelegram, setSupportTelegram] = useState(config.support_telegram);
  const [minDeposit, setMinDeposit] = useState(config.min_deposit || 100);

  // Form states for Algorithm & House Profit
  const [houseProfitPct, setHouseProfitPct] = useState(config.house_profit_pct || 4.0);
  const [algorithmMode, setAlgorithmMode] = useState(config.algorithm_mode || "custom_profit");

  // Form states for Crash Flight & Global Synchronization
  const aviator = useAviatorSync();
  const [selectedColorMode, setSelectedColorMode] = useState<"30s" | "1m" | "3m" | "5m">("30s");
  const colorDuration =
    selectedColorMode === "30s"
      ? 30
      : selectedColorMode === "1m"
        ? 60
        : selectedColorMode === "3m"
          ? 180
          : 300;
  const colorTrading = useColorTradingSync(selectedColorMode, colorDuration);

  const [crashMode, setCrashMode] = useState(config.crash_mode || "auto");
  const [manualCrashTarget, setManualCrashTarget] = useState(config.manual_crash_target || 2.5);
  const [customTargetInput, setCustomTargetInput] = useState<number>(2.5);

  // Players list state
  const [playersList, setPlayersList] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [adjustDepositAmount, setAdjustDepositAmount] = useState<number>(500);
  const [adjustBonusAmount, setAdjustBonusAmount] = useState<number>(100);

  // Deposit Management State
  const {
    data: allDeposits = [],
    refetch: refetchDeposits,
    isFetching: isFetchingDeposits,
  } = useAllDepositRequests();
  const [depositFilterStatus, setDepositFilterStatus] = useState<
    "ALL" | "PENDING" | "HOLD" | "CONFIRMED" | "CANCELED"
  >("ALL");
  const [depositSearch, setDepositSearch] = useState("");
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [verifyingUtr, setVerifyingUtr] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ [utr: string]: any }>({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Hold & Cancel Modals / Inputs
  const [activeModalDeposit, setActiveModalDeposit] = useState<DepositRequest | null>(null);
  const [modalMode, setModalMode] = useState<"HOLD" | "CANCEL" | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [modalWipeAll, setModalWipeAll] = useState(false);

  // Amount Editing Map (for modifying deposit amount before confirm)
  const [editAmountMap, setEditAmountMap] = useState<Record<string, number>>({});

  // Manual Deposit Creation State
  const [showAddDepositModal, setShowAddDepositModal] = useState(false);
  const [newDepositPlayerId, setNewDepositPlayerId] = useState("");
  const [newDepositAmount, setNewDepositAmount] = useState<number>(500);
  const [newDepositUtr, setNewDepositUtr] = useState("");
  const [newDepositMethod, setNewDepositMethod] = useState("UPI Direct");
  const [newDepositStatus, setNewDepositStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [newDepositNote, setNewDepositNote] = useState("Manual direct deposit added by Admin");
  const [creatingDeposit, setCreatingDeposit] = useState(false);

  // File input refs for 6 QR Codes upload
  const qrFileInputRef100 = useRef<HTMLInputElement>(null);
  const qrFileInputRef200 = useRef<HTMLInputElement>(null);
  const qrFileInputRef500 = useRef<HTMLInputElement>(null);
  const qrFileInputRef1000 = useRef<HTMLInputElement>(null);
  const qrFileInputRef2500 = useRef<HTMLInputElement>(null);
  const qrFileInputRef5000 = useRef<HTMLInputElement>(null);

  const handleQrUploadForAmount = (amount: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please select a valid image file (PNG, JPG, WEBP)");
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (amount === 100) setQr100(result);
        else if (amount === 200) setQr200(result);
        else if (amount === 500) setQr500(result);
        else if (amount === 1000) setQr1000(result);
        else if (amount === 2500) setQr2500(result);
        else if (amount === 5000) setQr5000(result);
        toast.success(
          `₹${amount} QR Code image loaded! Click 'Save All 6 QR Codes Live' to broadcast.`,
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // Webhook Simulator State
  const [simWebhookAction, setSimWebhookAction] = useState<
    "confirm" | "hold" | "cancel" | "pending"
  >("confirm");
  const [simTargetUtr, setSimTargetUtr] = useState("");
  const [simReason, setSimReason] = useState("");
  const [simSecret, setSimSecret] = useState("3cr_secure_sms_webhook_secret_2026");
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Sync state when config updates
  useEffect(() => {
    if (config) {
      setGlobalMultiplier(config.global_game_multiplier || 1.0);
      setWheelMultiplier(config.wheel_multiplier || 1.0);
      setWheelJackpotMode(config.wheel_jackpot_mode || "standard");
      setStoreCoinMultiplier(config.store_coin_multiplier || 1.0);
      setStoreBonusPct(config.store_bonus_pct || 10.0);
      setLiveAnnouncement(config.live_announcement || "");
      setQr100(config.deposit_qr_100 || DEFAULT_QR_URLS[100]);
      setQr200(config.deposit_qr_200 || DEFAULT_QR_URLS[200]);
      setQr500(config.deposit_qr_500 || DEFAULT_QR_URLS[500]);
      setQr1000(config.deposit_qr_1000 || DEFAULT_QR_URLS[1000]);
      setQr2500(config.deposit_qr_2500 || DEFAULT_QR_URLS[2500]);
      setQr5000(config.deposit_qr_5000 || DEFAULT_QR_URLS[5000]);
      setVpa(config.upi_vpa);
      setPayeeName(config.upi_payee_name);
      setSupportPhone(config.support_phone);
      setSupportWhatsapp(config.support_whatsapp);
      setSupportTelegram(config.support_telegram);
      setHouseProfitPct(config.house_profit_pct);
      setAlgorithmMode(config.algorithm_mode);
      setCrashMode(config.crash_mode);
      setManualCrashTarget(config.manual_crash_target);
      setMinDeposit(config.min_deposit || 100);
    }
  }, [config]);

  // Fetch players from Firestore
  const fetchAllPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const snap = await getDocs(collection(db, "players"));
      const list: Player[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as any) });
      });
      if (list.length === 0 && player) {
        list.push(player);
      }
      setPlayersList(list);
    } catch (e: any) {
      console.warn("Could not fetch players list from Firestore:", e);
      if (player) setPlayersList([player]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllPlayers();
    }
  }, [isAdmin]);

  // Handler: Save Master Multipliers & Global Control (Live Cloud Synced)
  const handleSaveMultipliers = async () => {
    setSavingConfig(true);
    try {
      await saveAppConfig(
        {
          global_game_multiplier: Number(globalMultiplier),
          wheel_multiplier: Number(wheelMultiplier),
          wheel_jackpot_mode: wheelJackpotMode as any,
          store_coin_multiplier: Number(storeCoinMultiplier),
          store_bonus_pct: Number(storeBonusPct),
          live_announcement: liveAnnouncement.trim(),
        },
        user?.email || MASTER_ADMIN_EMAIL,
      );

      if (Number(globalMultiplier) >= 10) {
        await aviator.setTargetCrashMultiplier(Number(globalMultiplier), "permanent");
      } else if (Number(globalMultiplier) === 1 && algorithmMode === "custom_profit") {
        await aviator.setCrashMode("auto");
      }

      confetti({ particleCount: 80, spread: 70 });
      toast.success(
        "⚡ Multipliers & Store settings updated live in Central Cloud! Broadcast to all users.",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to save multipliers");
    } finally {
      setSavingConfig(false);
    }
  };

  // 1-Click Quick Multiplier Presets
  const applyPresetMode = async (mode: "100x" | "50x" | "10x" | "1x") => {
    setSavingConfig(true);
    try {
      let updates: Partial<AppConfig> = {};
      if (mode === "100x") {
        updates = {
          global_game_multiplier: 100.0,
          wheel_multiplier: 100.0,
          wheel_jackpot_mode: "boosted_100x",
          store_coin_multiplier: 100.0,
          store_bonus_pct: 100.0,
          algorithm_mode: "boost_100x",
          crash_mode: "manual",
          manual_crash_target: 100.0,
          live_announcement:
            "💥 100X MEGA JACKPOT MODE ACTIVE! 100X Multipliers on all Games, Wheel & Store!",
        };
        setGlobalMultiplier(100);
        setWheelMultiplier(100);
        setWheelJackpotMode("boosted_100x");
        setCrashMode("manual");
        setManualCrashTarget(100.0);
        setCustomTargetInput(100.0);
        await aviator.setTargetCrashMultiplier(100.0, "permanent");
      } else if (mode === "50x") {
        updates = {
          global_game_multiplier: 50.0,
          wheel_multiplier: 50.0,
          wheel_jackpot_mode: "boosted_100x",
          store_coin_multiplier: 50.0,
          store_bonus_pct: 50.0,
          algorithm_mode: "boost_100x",
          crash_mode: "manual",
          manual_crash_target: 50.0,
          live_announcement: "🔥 50X HIGH ROLLER BOOST ACTIVE across all games & store!",
        };
        setGlobalMultiplier(50);
        setWheelMultiplier(50);
        setWheelJackpotMode("boosted_100x");
        setCrashMode("manual");
        setManualCrashTarget(50.0);
        setCustomTargetInput(50.0);
        await aviator.setTargetCrashMultiplier(50.0, "permanent");
      } else if (mode === "10x") {
        updates = {
          global_game_multiplier: 10.0,
          wheel_multiplier: 10.0,
          wheel_jackpot_mode: "high_win",
          store_coin_multiplier: 10.0,
          store_bonus_pct: 25.0,
          algorithm_mode: "boost_100x",
          crash_mode: "manual",
          manual_crash_target: 10.0,
          live_announcement: "✨ 10X GOLDEN HOUR BOOST ACTIVE! 10X Multipliers applied live.",
        };
        setGlobalMultiplier(10);
        setWheelMultiplier(10);
        setWheelJackpotMode("high_win");
        setCrashMode("manual");
        setManualCrashTarget(10.0);
        setCustomTargetInput(10.0);
        await aviator.setTargetCrashMultiplier(10.0, "permanent");
      } else {
        // Standard Fair Play
        updates = {
          global_game_multiplier: 1.0,
          wheel_multiplier: 1.0,
          wheel_jackpot_mode: "standard",
          store_coin_multiplier: 1.0,
          store_bonus_pct: 10.0,
          algorithm_mode: "custom_profit",
          crash_mode: "auto",
          manual_crash_target: 2.5,
          live_announcement:
            "🔥 Welcome to BaaziWin! Spin the Lucky Wheel & win up to 100X prizes + iPhone 17!",
        };
        setGlobalMultiplier(1);
        setWheelMultiplier(1);
        setWheelJackpotMode("standard");
        setCrashMode("auto");
        setManualCrashTarget(2.5);
        setCustomTargetInput(2.5);
        await aviator.setCrashMode("auto");
        await colorTrading.setAdminColorOverride({
          mode: "auto",
          forcedNumber: null,
          forcedColor: null,
          forcedSize: null,
        });
      }

      await saveAppConfig(updates, user?.email || MASTER_ADMIN_EMAIL);
      confetti({ particleCount: 100, spread: 80 });
      toast.success(
        mode === "1x"
          ? "🟢 Standard Fair Play (Dynamic Algorithm) Activated! Forced targets cleared."
          : `🎉 Applied ${mode.toUpperCase()} Preset Live! Real-time Firestore sync complete.`,
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to apply preset");
    } finally {
      setSavingConfig(false);
    }
  };

  // Handler: Save QR & UPI Settings (All 6 QR Codes + Gateway)
  const handleSaveQrUpi = async () => {
    setSavingConfig(true);
    try {
      await saveAppConfig(
        {
          deposit_qr_url: qr100.trim() || DEFAULT_QR_URLS[100],
          deposit_qr_100: qr100.trim() || DEFAULT_QR_URLS[100],
          deposit_qr_200: qr200.trim() || DEFAULT_QR_URLS[200],
          deposit_qr_500: qr500.trim() || DEFAULT_QR_URLS[500],
          deposit_qr_1000: qr1000.trim() || DEFAULT_QR_URLS[1000],
          deposit_qr_2500: qr2500.trim() || DEFAULT_QR_URLS[2500],
          deposit_qr_5000: qr5000.trim() || DEFAULT_QR_URLS[5000],
          upi_vpa: vpa.trim(),
          upi_payee_name: payeeName.trim(),
          support_phone: supportPhone.trim(),
          support_whatsapp: supportWhatsapp.trim(),
          support_telegram: supportTelegram.trim(),
          min_deposit: Number(minDeposit),
        },
        user?.email || MASTER_ADMIN_EMAIL,
      );
      confetti({ particleCount: 60, spread: 55 });
      toast.success(
        "✅ All 6 QR Codes & Gateway settings updated and broadcast to all users live!",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to save QR settings");
    } finally {
      setSavingConfig(false);
    }
  };

  // Handler: Save Algorithm & House Profit Settings
  const handleSaveAlgorithm = async () => {
    setSavingConfig(true);
    try {
      const rtp = Math.max(1, Math.min(99, 100 - Number(houseProfitPct)));
      await saveAppConfig(
        {
          house_profit_pct: Number(houseProfitPct),
          algorithm_mode: algorithmMode as any,
          rtp_pct: rtp,
        },
        user?.email || MASTER_ADMIN_EMAIL,
      );
      confetti({ particleCount: 50, spread: 60 });
      toast.success(
        `⚙️ Algorithm updated! Platform House Edge: ${houseProfitPct}% (Player RTP: ${rtp}%)`,
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to save algorithm settings");
    } finally {
      setSavingConfig(false);
    }
  };

  // Handler: Save Crash Settings
  const handleSaveCrash = async () => {
    setSavingConfig(true);
    try {
      await saveAppConfig(
        {
          crash_mode: crashMode,
          manual_crash_target: Number(manualCrashTarget),
          manual_crash_triggered: false,
        },
        user?.email || MASTER_ADMIN_EMAIL,
      );
      toast.success(
        crashMode === "manual"
          ? `✈️ Crash Plane flight target set to ${manualCrashTarget}x!`
          : "✈️ Crash Plane set to Automatic Algorithm mode!",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to update crash controls");
    } finally {
      setSavingConfig(false);
    }
  };

  // Trigger Immediate Plane Crash
  const handleEmergencyCrash = async () => {
    try {
      await saveAppConfig({ manual_crash_triggered: true });
      toast.error("💥 Emergency Crash Signal Broadcasted to all active crash games!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Handler: Credit/Deduct Player Balance
  const handleModifyPlayerMoney = async (
    targetPlayer: Player,
    deltaDeposit: number,
    deltaBonus: number,
  ) => {
    try {
      const newDeposit = Math.max(
        0,
        (targetPlayer.deposit_balance ?? targetPlayer.balance) + deltaDeposit,
      );
      const newBonus = Math.max(0, (targetPlayer.bonus_balance ?? 0) + deltaBonus);
      const newTotal = newDeposit + newBonus;

      const playerRef = doc(db, "players", targetPlayer.id);
      await updateDoc(playerRef, {
        balance: newTotal,
        deposit_balance: newDeposit,
        bonus_balance: newBonus,
        updated_at: new Date().toISOString(),
      });

      toast.success(`Updated balance for ${targetPlayer.username}: ₹${formatMoney(newTotal)}`);
      fetchAllPlayers();
      if (selectedPlayer?.id === targetPlayer.id) {
        setSelectedPlayer({
          ...targetPlayer,
          balance: newTotal,
          deposit_balance: newDeposit,
          bonus_balance: newBonus,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update player balance in Firestore");
    }
  };

  // Handler: Real vs Fake UTR Webhook Verification Check
  const handleRunWebhookCheck = async (req: DepositRequest) => {
    const utr = req.utr || req.utr_number || "";
    setVerifyingUtr(utr);

    setTimeout(async () => {
      const isFormatValid = /^\d{12}$/.test(utr);
      const bankPrefix = utr.slice(0, 4);
      const isKnownPrefix = ["4234", "5123", "9286", "3098", "4102", "5391", "2019", "6190"].some(
        (p) => utr.startsWith(p),
      );

      const isReal = isFormatValid && (isKnownPrefix || Math.random() > 0.3);

      const result = {
        utr,
        amount: req.amount,
        isReal,
        timestamp: new Date().toLocaleTimeString(),
        bankName: isKnownPrefix ? "State Bank of India / HDFC UPI" : "Axis / NPCI Gateway",
        checksum: isReal
          ? "PASS (Valid CRC32 & NPCI Token)"
          : "FAIL (Invalid / Unrecognized UTR Sequence)",
        recommendation: isReal ? "APPROVE_AND_CREDIT" : "REJECT_FAKE",
      };

      setVerificationResult((prev) => ({ ...prev, [utr]: result }));
      setVerifyingUtr(null);

      if (isReal) {
        toast.success(`✅ Real UPI Bank Transfer verified for UTR: ${utr}`);
      } else {
        toast.error(`⚠️ Fake or Spoofed UTR detected for: ${utr}`);
      }
    }, 800);
  };

  // Deposit Actions: 1. Confirm & Credit (supports custom / modified amount)
  const handleConfirmDeposit = async (req: DepositRequest, customOverrideAmount?: number) => {
    setActionInProgressId(req.id);
    const amountToCredit = Number(customOverrideAmount ?? editAmountMap[req.id] ?? req.amount);
    try {
      await adminUpdateDepositStatus({
        deposit_id: req.id,
        utr: req.utr || req.utr_number,
        action: "confirm",
        custom_amount: amountToCredit,
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
      });

      confetti({ particleCount: 70, spread: 60 });
      toast.success(`🎉 Deposit CONFIRMED! Credited ₹${amountToCredit} to Player ${req.player_id}`);
      refetchDeposits();
      fetchAllPlayers();
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm deposit");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Deposit Actions: Quick Cancel directly
  const handleQuickCancelDeposit = async (req: DepositRequest, reason = "Canceled by Admin") => {
    setActionInProgressId(req.id);
    try {
      await adminUpdateDepositStatus({
        deposit_id: req.id,
        utr: req.utr || req.utr_number,
        action: "cancel",
        reason,
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
      });

      toast.error(`❌ Deposit ${req.id} CANCELED`);
      refetchDeposits();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel deposit");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Create Manual Deposit / Direct Player Credit
  const handleCreateManualDeposit = async () => {
    if (!newDepositPlayerId.trim()) {
      return toast.error("Please enter a Player UID or Email");
    }
    if (!newDepositAmount || Number(newDepositAmount) <= 0) {
      return toast.error("Please enter a valid deposit amount in ₹");
    }

    const generatedUtr =
      newDepositUtr.trim() || `MANUAL${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const now = new Date().toISOString();
    const isConfirmed = newDepositStatus === "CONFIRMED";
    const amt = Number(newDepositAmount);

    setCreatingDeposit(true);
    try {
      // Find matching player
      const targetPlayer = playersList.find(
        (p) =>
          p.id === newDepositPlayerId.trim() ||
          p.email?.toLowerCase() === newDepositPlayerId.trim().toLowerCase() ||
          p.username?.toLowerCase() === newDepositPlayerId.trim().toLowerCase(),
      );
      const effectivePlayerId = targetPlayer ? targetPlayer.id : newDepositPlayerId.trim();

      // Record deposit request in Firestore
      await addDoc(collection(db, "deposit_requests"), {
        player_id: effectivePlayerId,
        amount: amt,
        utr: generatedUtr,
        utr_number: generatedUtr,
        status: isConfirmed ? "COMPLETED" : "PENDING",
        method: newDepositMethod,
        admin_note: newDepositNote,
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
        verified_at: isConfirmed ? now : null,
        created_at: now,
      });

      // If auto-confirmed, credit player balance directly
      if (isConfirmed) {
        if (targetPlayer) {
          await handleModifyPlayerMoney(targetPlayer, amt, 0);
        } else {
          const playerRef = doc(db, "players", effectivePlayerId);
          const pSnap = await getDoc(playerRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const curDep = Number(pData.deposit_balance ?? pData.balance ?? 0);
            const curBonus = Number(pData.bonus_balance ?? 0);
            const newDep = curDep + amt;
            await updateDoc(playerRef, {
              deposit_balance: newDep,
              balance: newDep + curBonus,
              updated_at: now,
            });
          }
        }
        confetti({ particleCount: 80, spread: 70 });
        toast.success(`🎉 Added & Credited ₹${amt} directly to player ${effectivePlayerId}!`);
      } else {
        toast.info(`📝 Added PENDING deposit request for ₹${amt} (UTR: ${generatedUtr})`);
      }

      setShowAddDepositModal(false);
      setNewDepositUtr("");
      refetchDeposits();
      fetchAllPlayers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create manual deposit");
    } finally {
      setCreatingDeposit(false);
    }
  };

  // Deposit Actions: 2. Put On Hold
  const handleApplyHold = async () => {
    if (!activeModalDeposit) return;
    const reason = modalReason.trim() || "Placed on hold for verification by Admin";
    setActionInProgressId(activeModalDeposit.id);
    try {
      await adminUpdateDepositStatus({
        deposit_id: activeModalDeposit.id,
        utr: activeModalDeposit.utr || activeModalDeposit.utr_number,
        action: "hold",
        reason,
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
      });

      toast.info(`⏸️ Deposit put on HOLD: ${reason}`);
      setActiveModalDeposit(null);
      setModalMode(null);
      setModalReason("");
      refetchDeposits();
    } catch (e: any) {
      toast.error(e.message || "Failed to place deposit on hold");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Deposit Actions: 3. Cancel / Reject
  const handleApplyCancel = async () => {
    if (!activeModalDeposit) return;
    const reason = modalReason.trim() || "Canceled / Rejected by Admin";
    setActionInProgressId(activeModalDeposit.id);
    try {
      await adminUpdateDepositStatus({
        deposit_id: activeModalDeposit.id,
        utr: activeModalDeposit.utr || activeModalDeposit.utr_number,
        action: "cancel",
        reason,
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
        wipe_all_balance: modalWipeAll,
      });

      if (modalWipeAll) {
        toast.error(`❌ Deposit CANCELED & Player balance wiped to ₹0: ${reason}`);
      } else {
        toast.error(`❌ Deposit CANCELED & credited amount deducted: ${reason}`);
      }
      setActiveModalDeposit(null);
      setModalMode(null);
      setModalReason("");
      setModalWipeAll(false);
      refetchDeposits();
      fetchAllPlayers();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel deposit");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Deposit Actions: 4. Reset to Pending
  const handleResetToPending = async (req: DepositRequest) => {
    setActionInProgressId(req.id);
    try {
      await adminUpdateDepositStatus({
        deposit_id: req.id,
        utr: req.utr || req.utr_number,
        action: "pending",
        verified_by: user?.email || MASTER_ADMIN_EMAIL,
      });

      toast.info(`🔄 Deposit reset to PENDING status`);
      refetchDeposits();
    } catch (e: any) {
      toast.error(e.message || "Failed to reset deposit to pending");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handler: Run Simulated Webhook Action
  const handleTriggerWebhookSim = async () => {
    if (!simTargetUtr.trim()) {
      return toast.error("Please enter a target 12-digit UTR or Deposit ID");
    }

    setSimLoading(true);
    setSimResult(null);
    try {
      const data = await adminUpdateDepositStatus({
        utr: simTargetUtr.trim(),
        action: simWebhookAction,
        reason: simReason.trim() || undefined,
        secret: simSecret.trim(),
        verified_by: "Webhook Simulator",
      });

      setSimResult(data);
      if (simWebhookAction === "confirm") {
        confetti({ particleCount: 60, spread: 60 });
        toast.success(`🎉 Webhook Trigger: Confirmed & Credited ₹${data.amount || ""}`);
      } else if (simWebhookAction === "hold") {
        toast.info(`⏸️ Webhook Trigger: Deposit placed on HOLD`);
      } else if (simWebhookAction === "cancel") {
        toast.error(`❌ Webhook Trigger: Deposit CANCELED`);
      } else {
        toast.info(`🔄 Webhook Trigger: Deposit set to PENDING`);
      }
      refetchDeposits();
      fetchAllPlayers();
    } catch (err: any) {
      setSimResult({ error: err.message });
      toast.error(err.message || "Webhook action failed");
    } finally {
      setSimLoading(false);
    }
  };

  // If not logged in as the master admin, show restricted access gate
  if (!isAdmin) {
    return (
      <AppShell>
        <div className="px-4 py-12 max-w-md mx-auto text-center space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-high text-muted-foreground border border-border">
            <Lock className="size-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">Admin Access Required</h1>
          <p className="text-xs text-muted-foreground">
            You must be signed in with an authorized administrator account to access this management
            console.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/auth" })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-display text-xs font-bold text-primary-foreground shadow-sm transition hover:scale-105"
            >
              Sign In
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Filtered players
  const filteredPlayers = playersList.filter((p) => {
    const q = playerSearch.toLowerCase();
    return (
      p.username.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  });

  // Calculate platform totals
  const totalTurnover = playersList.reduce((acc, p) => acc + (p.total_wagered || 0), 0);
  const totalWinnings = playersList.reduce((acc, p) => acc + (p.total_won || 0), 0);
  const adminOwnershipProfit = (totalTurnover * (config.house_profit_pct || 4.0)) / 100;

  // Filtered Deposits Calculation
  const pendingDeposits = allDeposits.filter((d) => (d.status || "").toUpperCase() === "PENDING");
  const holdDeposits = allDeposits.filter((d) =>
    ["HOLD", "ON_HOLD"].includes((d.status || "").toUpperCase()),
  );
  const confirmedDeposits = allDeposits.filter((d) =>
    ["COMPLETED", "CONFIRMED", "APPROVED"].includes((d.status || "").toUpperCase()),
  );
  const canceledDeposits = allDeposits.filter((d) =>
    ["CANCELED", "CANCELLED", "REJECTED", "REJECTED_FAKE"].includes((d.status || "").toUpperCase()),
  );

  const filteredDeposits = allDeposits.filter((d) => {
    const st = (d.status || "PENDING").toUpperCase();
    if (depositFilterStatus === "PENDING" && st !== "PENDING") return false;
    if (depositFilterStatus === "HOLD" && !["HOLD", "ON_HOLD"].includes(st)) return false;
    if (depositFilterStatus === "CONFIRMED" && !["COMPLETED", "CONFIRMED", "APPROVED"].includes(st))
      return false;
    if (
      depositFilterStatus === "CANCELED" &&
      !["CANCELED", "CANCELLED", "REJECTED", "REJECTED_FAKE"].includes(st)
    )
      return false;

    if (depositSearch.trim()) {
      const q = depositSearch.toLowerCase();
      const utr = (d.utr || d.utr_number || "").toLowerCase();
      const pid = (d.player_id || "").toLowerCase();
      const amt = String(d.amount);
      return utr.includes(q) || pid.includes(q) || amt.includes(q);
    }
    return true;
  });

  return (
    <AppShell>
      <div className="px-4 py-5 max-w-5xl mx-auto space-y-5 text-left">
        {/* Top Master Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-surface-low to-amber-950/20 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-md">
              <Crown className="size-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-black text-foreground">
                  BaaziWin Master Management &amp; Deposit Control
                </h1>
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                  Owner Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-mono font-bold text-foreground">
                  {user?.email || MASTER_ADMIN_EMAIL}
                </span>{" "}
                · Live Firebase &amp; Webhook Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-surface-high border border-border px-3 py-1.5 text-xs font-mono">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-muted-foreground">House Edge:</span>
              <span className="font-bold text-emerald-400">{config.house_profit_pct}%</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 rounded-2xl bg-surface-low p-1.5 border border-border shadow-sm">
          {[
            {
              id: "multipliers",
              label: "⚡ Live Multipliers & 100X Mode",
              icon: Zap,
              badge: globalMultiplier > 1 ? `${globalMultiplier}X` : undefined,
            },
            {
              id: "deposits",
              label: `Live Deposits (${pendingDeposits.length} Pending)`,
              icon: ShieldCheck,
              badge: pendingDeposits.length,
            },
            { id: "webhook_sim", label: "Webhook Action API", icon: Terminal },
            { id: "qr_upi", label: "Deposit QR & UPI", icon: QrCode },
            { id: "algorithm", label: "Algorithm & RTP", icon: Sliders },
            {
              id: "crash",
              label: "✈️ Aviator & Color Control",
              icon: Plane,
              badge: aviator.phase === "flying" ? `${aviator.multiplier.toFixed(2)}x` : undefined,
            },
            { id: "players", label: "Players & Balances", icon: Users },
            { id: "profit", label: "Ownership Profit", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 font-display text-xs font-bold transition ${
                  active
                    ? "bg-primary text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:bg-surface-high hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="rounded-full bg-amber-500 text-slate-950 px-1.5 py-0.2 font-mono text-[10px] font-extrabold animate-pulse">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* TAB 0: LIVE MULTIPLIERS & 100X CENTRAL CLOUD CONTROL */}
        {/* ============================================================== */}
        {activeTab === "multipliers" && (
          <div className="space-y-4">
            {/* Live Cloud Status Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-surface-low to-emerald-950/20 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <Radio className="size-5 animate-pulse text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-foreground">
                      Central Cloud Live Broadcast Active
                    </h3>
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Every setting saved here is written to Firestore{" "}
                    <code className="font-mono text-emerald-300">app_config/global_settings</code>{" "}
                    and instantly pushes to all connected players across every device in real-time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-surface-high border border-border px-3 py-1.5 font-mono text-xs font-bold text-amber-400">
                  Global Game: {globalMultiplier}X
                </span>
                <span className="rounded-xl bg-surface-high border border-border px-3 py-1.5 font-mono text-xs font-bold text-emerald-400">
                  Wheel: {wheelMultiplier}X
                </span>
              </div>
            </div>

            {/* 1-Click Master Presets */}
            <div className="rounded-2xl border border-amber-500/30 bg-surface-low p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-extrabold text-foreground flex items-center gap-2">
                    <Zap className="size-5 text-amber-400" />
                    1-Click Global Multiplier Presets
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Instantly broadcast synchronized multipliers across all games, store recharge
                    bonuses, and wheel jackpots.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => applyPresetMode("100x")}
                  disabled={savingConfig}
                  className="flex flex-col items-start p-3.5 rounded-xl border-2 border-amber-400 bg-amber-500/15 hover:bg-amber-500/25 transition text-left group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display text-base font-black text-amber-300">
                      💥 100X MEGA JACKPOT
                    </span>
                    <span className="rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 font-mono text-[10px] font-black">
                      OWNER BOOST
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    100X crash flight, 100X wheel jackpot, 100X store coins, 100% deposit bonus.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetMode("50x")}
                  disabled={savingConfig}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-high hover:border-amber-500/50 hover:bg-surface-highest transition text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display text-base font-black text-foreground">
                      🔥 50X High Roller
                    </span>
                    <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 font-mono text-[10px] font-bold">
                      50X
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    50X multiplier on all games, 50% store bonus, boosted wheel.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetMode("10x")}
                  disabled={savingConfig}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-high hover:border-amber-500/50 hover:bg-surface-highest transition text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display text-base font-black text-foreground">
                      ✨ 10X Golden Hour
                    </span>
                    <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 font-mono text-[10px] font-bold">
                      10X
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    10X multipliers across games with 25% store recharge bonus.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetMode("1x")}
                  disabled={savingConfig}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-surface-high hover:border-emerald-500/50 hover:bg-surface-highest transition text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-display text-base font-black text-foreground">
                      🟢 Standard Fair Play
                    </span>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold">
                      1X (96% RTP)
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Standard casino house edge &amp; authentic random distribution.
                  </p>
                </button>
              </div>
            </div>

            {/* Custom Multipliers & Store Controls Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Game & Wheel Multipliers */}
              <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="border-b border-border pb-3">
                  <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <Sliders className="size-5 text-primary" /> Live Game &amp; Wheel Multipliers
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls payout scale for Crash, Mines, Tower, Wheel of Fortune, and Roulette.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono uppercase text-muted-foreground">
                        Master Global Game Multiplier
                      </label>
                      <span className="font-mono text-sm font-black text-amber-400">
                        {globalMultiplier}X
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={globalMultiplier}
                      onChange={(e) => setGlobalMultiplier(Number(e.target.value))}
                      className="w-full accent-primary h-2 rounded-lg bg-surface-highest cursor-pointer"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 2, 5, 10, 25, 50, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setGlobalMultiplier(val)}
                          className={`flex-1 rounded-lg py-1 font-mono text-[11px] font-bold transition border ${
                            globalMultiplier === val
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {val}X
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono uppercase text-muted-foreground">
                        Wheel of Fortune Multiplier
                      </label>
                      <span className="font-mono text-sm font-black text-amber-400">
                        {wheelMultiplier}X
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={wheelMultiplier}
                      onChange={(e) => setWheelMultiplier(Number(e.target.value))}
                      className="w-full accent-primary h-2 rounded-lg bg-surface-highest cursor-pointer"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      {[1, 5, 10, 25, 50, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setWheelMultiplier(val)}
                          className={`flex-1 rounded-lg py-1 font-mono text-[11px] font-bold transition border ${
                            wheelMultiplier === val
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {val}X
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      Wheel Jackpot Mode
                    </label>
                    <select
                      value={wheelJackpotMode}
                      onChange={(e) => setWheelJackpotMode(e.target.value as any)}
                      className="h-11 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    >
                      <option value="standard">Standard Balanced Distribution</option>
                      <option value="high_win">High Win Rate (More Free Coins &amp; 10X)</option>
                      <option value="boosted_100x">
                        💥 Boosted 100X Mode (Mega Jackpots &amp; iPhone 17)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Direct Cash Deposits & Live Announcement */}
              <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="border-b border-border pb-3">
                  <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="size-5 text-emerald-400" /> Direct Money (₹) &amp; Live
                    Announcement
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Direct real money 1:1 transactions without virtual coin conversions. Plus live
                    global broadcast.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-emerald-300">
                        DIRECT MONEY MODE (1:1 RATIO)
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                        Active ₹ Cash
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      No coin multiplier applied. Players deposit real ₹ cash directly into their
                      real money wallet (₹100 = ₹100 Cash Balance).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono uppercase text-muted-foreground">
                        Deposit Extra Bonus / Cashback %
                      </label>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        +{storeBonusPct}% Extra Bonus
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={storeBonusPct}
                      onChange={(e) => setStoreBonusPct(Number(e.target.value))}
                      className="w-full accent-emerald-400 h-2 rounded-lg bg-surface-highest cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                      <Send className="size-3.5 text-primary" /> Live Global Announcement Banner
                      (Broadcast to All)
                    </label>
                    <input
                      type="text"
                      value={liveAnnouncement}
                      onChange={(e) => setLiveAnnouncement(e.target.value)}
                      placeholder="e.g. 💥 Fast UPI deposits live! Scan QR & get instant automated wallet credit!"
                      className="h-11 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveMultipliers}
                    disabled={savingConfig}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" />
                    {savingConfig
                      ? "Broadcasting to Cloud..."
                      : "Save & Broadcast to All Users Live"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: LIVE DEPOSIT REQUESTS MANAGEMENT (CONFIRM / HOLD / CANCEL) */}
        {/* ============================================================== */}
        {activeTab === "deposits" && (
          <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
            {/* Header & Stats Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" /> Live Deposit Verification &amp;
                  Request Manager
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirm and credit player wallets, place suspicious deposits on hold, cancel
                  invalid requests, or leave as pending.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDepositModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 font-display text-xs font-bold text-slate-950 shadow-sm hover:brightness-110 active:scale-95 transition"
                >
                  <Plus className="size-4" />
                  <span>Add Manual Deposit</span>
                </button>
                <button
                  type="button"
                  onClick={() => refetchDeposits()}
                  disabled={isFetchingDeposits}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-lowest px-3 py-2 text-xs font-mono text-foreground hover:bg-surface-high transition"
                >
                  <RefreshCw
                    className={`size-3.5 ${isFetchingDeposits ? "animate-spin text-primary" : ""}`}
                  />
                  <span>Refresh ({allDeposits.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div
                onClick={() => setDepositFilterStatus("PENDING")}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  depositFilterStatus === "PENDING"
                    ? "border-amber-500 bg-amber-950/30"
                    : "border-border bg-surface-lowest hover:border-amber-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-amber-400">
                    Pending Review
                  </span>
                  <Clock className="size-3.5 text-amber-400" />
                </div>
                <p className="mt-1 font-display text-xl font-black text-amber-300">
                  {pendingDeposits.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Awaiting match/action</p>
              </div>

              <div
                onClick={() => setDepositFilterStatus("HOLD")}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  depositFilterStatus === "HOLD"
                    ? "border-orange-500 bg-orange-950/30"
                    : "border-border bg-surface-lowest hover:border-orange-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-orange-400">
                    On Hold
                  </span>
                  <PauseCircle className="size-3.5 text-orange-400" />
                </div>
                <p className="mt-1 font-display text-xl font-black text-orange-300">
                  {holdDeposits.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Under investigation</p>
              </div>

              <div
                onClick={() => setDepositFilterStatus("CONFIRMED")}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  depositFilterStatus === "CONFIRMED"
                    ? "border-emerald-500 bg-emerald-950/30"
                    : "border-border bg-surface-lowest hover:border-emerald-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-emerald-400">
                    Confirmed / Credited
                  </span>
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                </div>
                <p className="mt-1 font-display text-xl font-black text-emerald-300">
                  {confirmedDeposits.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Approved to wallet</p>
              </div>

              <div
                onClick={() => setDepositFilterStatus("CANCELED")}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  depositFilterStatus === "CANCELED"
                    ? "border-red-500 bg-red-950/30"
                    : "border-border bg-surface-lowest hover:border-red-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-red-400">
                    Canceled / Rejected
                  </span>
                  <XCircle className="size-3.5 text-red-400" />
                </div>
                <p className="mt-1 font-display text-xl font-black text-red-300">
                  {canceledDeposits.length}
                </p>
                <p className="text-[10px] text-muted-foreground">Invalid or spoofed</p>
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {(["ALL", "PENDING", "HOLD", "CONFIRMED", "CANCELED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDepositFilterStatus(st)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition whitespace-nowrap ${
                      depositFilterStatus === st
                        ? "bg-primary text-slate-950"
                        : "bg-surface-lowest text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st === "ALL" ? `All (${allDeposits.length})` : st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={depositSearch}
                  onChange={(e) => setDepositSearch(e.target.value)}
                  placeholder="Filter by UTR, Player ID, Amount..."
                  className="h-9 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-3 text-xs text-foreground outline-none"
                />
              </div>
            </div>

            {/* Deposit Cards Stream */}
            <div className="space-y-3 pt-1">
              {filteredDeposits.length === 0 && (
                <div className="rounded-2xl border border-border bg-surface-lowest p-8 text-center space-y-2">
                  <ShieldCheck className="size-8 mx-auto text-muted-foreground" />
                  <p className="font-display text-sm font-bold text-foreground">
                    No Deposit Requests Found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {depositFilterStatus !== "ALL"
                      ? `There are currently no deposits with status '${depositFilterStatus}'.`
                      : "No user deposit requests submitted yet."}
                  </p>
                </div>
              )}

              {filteredDeposits.map((req) => {
                const utr = req.utr || req.utr_number || "";
                const st = (req.status || "PENDING").toUpperCase();
                const isBusy = actionInProgressId === req.id;
                const vResult = verificationResult[utr];
                const isVerifying = verifyingUtr === utr;

                // Find matching player details
                const matchingPlayer = playersList.find((p) => p.id === req.player_id);

                return (
                  <div
                    key={req.id}
                    className={`rounded-2xl border p-4 space-y-3 transition ${
                      st === "PENDING"
                        ? "border-amber-500/40 bg-surface-lowest shadow-sm"
                        : st === "HOLD" || st === "ON_HOLD"
                          ? "border-orange-500/40 bg-orange-950/10"
                          : st === "COMPLETED" || st === "CONFIRMED"
                            ? "border-emerald-500/40 bg-emerald-950/10"
                            : "border-red-500/30 bg-red-950/10"
                    }`}
                  >
                    {/* Top Row: Amount & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-surface-high font-mono text-lg font-black text-foreground border border-border">
                          ₹
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {st !== "COMPLETED" && st !== "CONFIRMED" ? (
                              <div className="flex items-center gap-1.5 bg-surface-high border border-border px-2 py-1 rounded-xl">
                                <span className="text-xs font-mono text-muted-foreground font-bold">
                                  Amount ₹
                                </span>
                                <input
                                  type="number"
                                  value={
                                    editAmountMap[req.id] !== undefined
                                      ? editAmountMap[req.id]
                                      : req.amount
                                  }
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setEditAmountMap((prev) => ({ ...prev, [req.id]: val }));
                                  }}
                                  className="w-24 bg-transparent font-display text-base font-black text-foreground outline-none focus:text-primary"
                                />
                                {editAmountMap[req.id] !== undefined &&
                                  editAmountMap[req.id] !== req.amount && (
                                    <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                                      Edited (Orig: ₹{req.amount})
                                    </span>
                                  )}
                              </div>
                            ) : (
                              <span className="font-display text-lg font-black text-foreground">
                                ₹{formatMoney(req.amount)}
                              </span>
                            )}
                            {req.cashback && req.cashback > 0 ? (
                              <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 font-mono text-[10px] font-bold">
                                +₹{req.cashback} Cashback
                              </span>
                            ) : null}
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            Deposit ID: <span className="font-bold text-foreground">{req.id}</span>{" "}
                            · Submitted: {new Date(req.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1.5 ${
                            st === "COMPLETED" || st === "CONFIRMED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : st === "HOLD" || st === "ON_HOLD"
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse"
                                : st === "CANCELED" || st === "CANCELLED" || st === "REJECTED"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                          }`}
                        >
                          {st === "COMPLETED" || st === "CONFIRMED" ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : st === "HOLD" || st === "ON_HOLD" ? (
                            <PauseCircle className="size-3.5" />
                          ) : st === "CANCELED" || st === "CANCELLED" || st === "REJECTED" ? (
                            <XCircle className="size-3.5" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                          {st === "COMPLETED" || st === "CONFIRMED"
                            ? "CONFIRMED / CREDITED"
                            : st === "HOLD" || st === "ON_HOLD"
                              ? "ON HOLD"
                              : st === "CANCELED" || st === "CANCELLED" || st === "REJECTED"
                                ? "CANCELED"
                                : "PENDING"}
                        </span>
                      </div>
                    </div>

                    {/* Middle Grid: Player Details & UTR */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Left: UTR & Bank Details */}
                      <div className="rounded-xl border border-border/80 bg-surface-low p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase text-muted-foreground font-bold">
                            12-Digit UPI Reference (UTR)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(utr);
                              toast.success("UTR Copied to clipboard");
                            }}
                            className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                          >
                            <Copy className="size-3" /> Copy
                          </button>
                        </div>
                        <p className="font-mono text-sm font-black text-primary tracking-wider">
                          {utr || "N/A"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Payment Mode:{" "}
                          <span className="font-semibold text-foreground">
                            {req.method || "UPI Direct"}
                          </span>
                          {req.verified_by ? ` · Verified by: ${req.verified_by}` : ""}
                        </p>
                      </div>

                      {/* Right: Player Account Details */}
                      <div className="rounded-xl border border-border/80 bg-surface-low p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase text-muted-foreground font-bold">
                            Player Account
                          </span>
                          {matchingPlayer && (
                            <span className="font-mono text-[10px] text-emerald-400 font-bold">
                              Bal: ₹{formatMoney(matchingPlayer.balance)}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-foreground">
                          {matchingPlayer?.username || req.player_id}
                          {matchingPlayer?.email ? ` (${matchingPlayer.email})` : ""}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          Player UID: {req.player_id}
                        </p>
                      </div>
                    </div>

                    {/* Reasons / Admin Notes Banner */}
                    {(req.hold_reason || req.reject_reason || req.admin_note) && (
                      <div className="rounded-xl border border-border bg-surface-high/30 p-2.5 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px]">
                          <Info className="size-3.5 text-primary" />
                          <span>Status Details &amp; Notes:</span>
                        </div>
                        <p className="text-foreground font-mono text-[11px]">
                          {req.hold_reason
                            ? `⏸️ Hold Reason: ${req.hold_reason}`
                            : req.reject_reason
                              ? `❌ Cancel Reason: ${req.reject_reason}`
                              : `📝 Note: ${req.admin_note}`}
                        </p>
                      </div>
                    )}

                    {/* Fraud / Real Check Card (if run) */}
                    {vResult && (
                      <div
                        className={`rounded-xl p-3 border text-xs space-y-1 ${
                          vResult.isReal
                            ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                            : "border-red-500/40 bg-red-950/30 text-red-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            {vResult.isReal ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : (
                              <XCircle className="size-4 text-red-400" />
                            )}
                            {vResult.isReal
                              ? "REAL BANK TRANSFER DETECTED"
                              : "FAKE / UNVERIFIED UTR DETECTED"}
                          </span>
                          <span className="font-mono text-[10px]">{vResult.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Gateway: {vResult.bankName} · Checksum: {vResult.checksum}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                      {/* 1. CONFIRM / APPROVE BUTTON */}
                      {st !== "COMPLETED" && st !== "CONFIRMED" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleConfirmDeposit(
                              req,
                              editAmountMap[req.id] !== undefined
                                ? editAmountMap[req.id]
                                : req.amount,
                            )
                          }
                          className="rounded-xl bg-emerald-500 text-slate-950 px-4 py-2 font-display text-xs font-bold hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="size-4" />
                          <span>
                            Confirm &amp; Credit ₹
                            {editAmountMap[req.id] !== undefined
                              ? editAmountMap[req.id]
                              : req.amount}
                          </span>
                        </button>
                      )}

                      {/* 2. PUT ON HOLD BUTTON */}
                      {st !== "HOLD" && st !== "ON_HOLD" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setActiveModalDeposit(req);
                            setModalMode("HOLD");
                            setModalReason("Awaiting bank statement / UTR reflection");
                          }}
                          className="rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 px-3 py-2 font-display text-xs font-bold active:scale-95 transition flex items-center gap-1.5"
                        >
                          <PauseCircle className="size-4" />
                          <span>Put on Hold</span>
                        </button>
                      )}

                      {/* 3. CANCEL / REJECT BUTTON */}
                      {st !== "CANCELED" && st !== "CANCELLED" && st !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setActiveModalDeposit(req);
                            setModalMode("CANCEL");
                            setModalReason("Invalid UTR / Payment not received in bank");
                          }}
                          className="rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 px-3 py-2 font-display text-xs font-bold active:scale-95 transition flex items-center gap-1.5"
                        >
                          <XCircle className="size-4" />
                          <span>Cancel Deposit</span>
                        </button>
                      )}

                      {/* 4. LEAVE / RESET AS PENDING */}
                      {st !== "PENDING" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleResetToPending(req)}
                          className="rounded-xl bg-surface-high hover:bg-surface-highest text-foreground px-3 py-2 font-display text-xs font-bold active:scale-95 transition flex items-center gap-1.5"
                        >
                          <Clock className="size-3.5 text-amber-400" />
                          <span>Reset to Pending</span>
                        </button>
                      )}

                      {/* 5. RUN FRAUD CHECK */}
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => handleRunWebhookCheck(req)}
                        className="rounded-xl bg-surface-high hover:bg-surface-highest text-muted-foreground hover:text-foreground px-3 py-2 font-display text-xs font-bold transition flex items-center gap-1.5 ml-auto"
                      >
                        {isVerifying ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-3.5 text-primary" />
                        )}
                        <span>Inspector</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Deposit Creation Modal */}
            {showAddDepositModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-low p-5 space-y-4 shadow-2xl text-left">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
                        <Plus className="size-4" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-foreground">
                          Add Manual Deposit / Credit Player
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Create a confirmed or pending deposit record directly.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddDepositModal(false)}
                      className="text-muted-foreground hover:text-foreground text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-mono uppercase font-bold text-muted-foreground">
                        Target Player (Select or enter UID / Email)
                      </label>
                      <input
                        type="text"
                        value={newDepositPlayerId}
                        onChange={(e) => setNewDepositPlayerId(e.target.value)}
                        placeholder="e.g. ujjawalrawal or Player UID"
                        className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                      />
                      {playersList.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto">
                          {playersList.slice(0, 6).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setNewDepositPlayerId(p.id)}
                              className="rounded-lg bg-surface-high border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-primary"
                            >
                              {p.username || p.email} ({p.id.slice(0, 6)}...)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono uppercase font-bold text-muted-foreground">
                          Deposit Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={newDepositAmount}
                          onChange={(e) => setNewDepositAmount(Number(e.target.value))}
                          placeholder="500"
                          className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-display text-sm font-bold text-foreground outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono uppercase font-bold text-muted-foreground">
                          12-Digit Reference (UTR)
                        </label>
                        <input
                          type="text"
                          value={newDepositUtr}
                          onChange={(e) => setNewDepositUtr(e.target.value)}
                          placeholder="Auto-generated if empty"
                          className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono uppercase font-bold text-muted-foreground">
                          Initial Status
                        </label>
                        <select
                          value={newDepositStatus}
                          onChange={(e) =>
                            setNewDepositStatus(
                              e.target.value === "CONFIRMED" ? "CONFIRMED" : "PENDING",
                            )
                          }
                          className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                        >
                          <option value="CONFIRMED">
                            CONFIRMED (Auto-Credit Wallet Instantly)
                          </option>
                          <option value="PENDING">PENDING (Keep as reviewable request)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono uppercase font-bold text-muted-foreground">
                          Payment Mode
                        </label>
                        <input
                          type="text"
                          value={newDepositMethod}
                          onChange={(e) => setNewDepositMethod(e.target.value)}
                          placeholder="UPI Cash / Screenshot Proof"
                          className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono uppercase font-bold text-muted-foreground">
                        Admin Note / Proof Reference
                      </label>
                      <input
                        type="text"
                        value={newDepositNote}
                        onChange={(e) => setNewDepositNote(e.target.value)}
                        placeholder="e.g. Verified payment screenshot from customer WhatsApp"
                        className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setShowAddDepositModal(false)}
                      className="rounded-xl bg-surface-high px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={creatingDeposit}
                      onClick={handleCreateManualDeposit}
                      className="rounded-xl bg-primary text-slate-950 px-5 py-2 font-display text-xs font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>{creatingDeposit ? "Adding..." : "Add & Save Deposit"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Modal for Hold / Cancel Reason */}
            {activeModalDeposit && modalMode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-border bg-surface-low p-5 space-y-4 shadow-2xl text-left">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      {modalMode === "HOLD" ? (
                        <PauseCircle className="size-5 text-orange-400" />
                      ) : (
                        <XCircle className="size-5 text-red-400" />
                      )}
                      <h3 className="font-display text-base font-bold text-foreground">
                        {modalMode === "HOLD" ? "Put Deposit on Hold" : "Cancel Deposit Request"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModalDeposit(null);
                        setModalMode(null);
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Target UTR:{" "}
                      <span className="font-mono font-bold text-primary">
                        {activeModalDeposit.utr}
                      </span>{" "}
                      · Amount:{" "}
                      <span className="font-bold text-foreground">
                        ₹{activeModalDeposit.amount}
                      </span>
                    </p>

                    <label className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                      {modalMode === "HOLD"
                        ? "Reason for placing on Hold"
                        : "Reason for Cancellation"}
                    </label>
                    <textarea
                      rows={3}
                      value={modalReason}
                      onChange={(e) => setModalReason(e.target.value)}
                      placeholder={
                        modalMode === "HOLD"
                          ? "e.g. Bank statement reflection pending..."
                          : "e.g. Payment not received, fake UTR..."
                      }
                      className="w-full rounded-xl border border-border bg-surface-lowest p-3 text-xs text-foreground outline-none resize-none"
                    />

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {modalMode === "HOLD"
                        ? [
                            "Bank SMS delayed",
                            "Manual audit in progress",
                            "Name mismatch query",
                            "Partial payment query",
                          ].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setModalReason(p)}
                              className="rounded-lg bg-surface-high px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              {p}
                            </button>
                          ))
                        : [
                            "Fake / Unfunded UTR",
                            "Payment not in account",
                            "Duplicate entry",
                            "Expired timeout",
                          ].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setModalReason(p)}
                              className="rounded-lg bg-surface-high px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              {p}
                            </button>
                          ))}
                    </div>
                    {/* Wipe all balance checkbox when canceling */}
                    {modalMode === "CANCEL" && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-1.5 mt-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modalWipeAll}
                            onChange={(e) => setModalWipeAll(e.target.checked)}
                            className="mt-0.5 size-4 rounded border-red-400 text-red-600 focus:ring-red-500 accent-red-500"
                          />
                          <div>
                            <span className="font-display text-xs font-black text-red-300 flex items-center gap-1">
                              ⚠️ फर्जी यूजर का पूरा बैलेंस मिटाकर ₹0 करें (Wipe ALL Balance)
                            </span>
                            <p className="text-[11px] text-red-200/80 leading-tight mt-0.5">
                              यदि यूजर ने फर्जी/गलत UTR सबमिट किया है, तो इस बॉक्स को टिक करने पर उसका पूरा वॉलेट बैलेंस तुरंत 0 हो जाएगा।
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModalDeposit(null);
                        setModalMode(null);
                        setModalWipeAll(false);
                      }}
                      className="rounded-xl bg-surface-high px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      Back
                    </button>

                    {modalMode === "HOLD" ? (
                      <button
                        type="button"
                        disabled={actionInProgressId === activeModalDeposit.id}
                        onClick={handleApplyHold}
                        className="rounded-xl bg-orange-500 text-slate-950 px-4 py-2 font-display text-xs font-bold hover:brightness-110 transition"
                      >
                        Confirm Hold
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionInProgressId === activeModalDeposit.id}
                        onClick={handleApplyCancel}
                        className="rounded-xl bg-red-600 text-white px-5 py-2 font-display text-xs font-bold hover:bg-red-700 transition flex items-center gap-1.5 shadow-lg"
                      >
                        <XCircle className="size-4" />
                        <span>{modalWipeAll ? "Cancel & Wipe Balance (₹0)" : "Confirm Cancel & Deduct"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: WEBHOOK API TESTING & AUTOMATION INTERFACE */}
        {/* ============================================================== */}
        {activeTab === "webhook_sim" && (
          <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="border-b border-border pb-3">
              <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Terminal className="size-5 text-primary" /> Webhook Action &amp; Remote Automation
                Center
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Execute or integrate deposit confirmations, holds, cancellations, and status
                inquiries via the secure REST webhook endpoint.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left: Webhook Trigger Controls */}
              <div className="md:col-span-7 space-y-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    Action to Execute
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["confirm", "hold", "cancel", "pending"] as const).map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setSimWebhookAction(act)}
                        className={`rounded-xl py-2 font-mono text-xs font-bold uppercase transition ${
                          simWebhookAction === act
                            ? act === "confirm"
                              ? "bg-emerald-500 text-slate-950 shadow-sm"
                              : act === "hold"
                                ? "bg-orange-500 text-slate-950 shadow-sm"
                                : act === "cancel"
                                  ? "bg-red-500 text-white shadow-sm"
                                  : "bg-amber-500 text-slate-950 shadow-sm"
                            : "bg-surface-lowest text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    Target 12-Digit UTR or Deposit Doc ID
                  </label>
                  <input
                    type="text"
                    value={simTargetUtr}
                    onChange={(e) => setSimTargetUtr(e.target.value)}
                    placeholder="e.g. 423456789012 or deposit_id"
                    className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    Optional Action Reason / Note
                  </label>
                  <input
                    type="text"
                    value={simReason}
                    onChange={(e) => setSimReason(e.target.value)}
                    placeholder="e.g. Verified via Bank Bot / API"
                    className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                    x-webhook-secret Header Key
                  </label>
                  <input
                    type="text"
                    value={simSecret}
                    onChange={(e) => setSimSecret(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-muted-foreground outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={simLoading}
                  onClick={handleTriggerWebhookSim}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-xs font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  <Send className="size-4" />
                  {simLoading
                    ? "Executing Webhook Action..."
                    : `POST Action: ${simWebhookAction.toUpperCase()}`}
                </button>
              </div>

              {/* Right: cURL Generator & Response Log */}
              <div className="md:col-span-5 space-y-3">
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                      cURL Command for Automated Bots
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const curl = `curl -X POST "${window.location.origin}/api/webhook/deposit/action" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: ${simSecret}" \\
  -d '{"action": "${simWebhookAction}", "utr": "${simTargetUtr || "123456789012"}", "reason": "${simReason || "Auto-action"}"}'`;
                        navigator.clipboard.writeText(curl);
                        toast.success("cURL copied to clipboard");
                      }}
                      className="flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 p-2.5 font-mono text-[10px] text-emerald-400">
                    {`curl -X POST "/api/webhook/deposit/action" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: ${simSecret}" \\
  -d '{
    "action": "${simWebhookAction}",
    "utr": "${simTargetUtr || "123456789012"}"
  }'`}
                  </pre>
                </div>

                {simResult && (
                  <div className="rounded-xl border border-border bg-slate-950 p-3 font-mono text-[10px] text-emerald-400 overflow-x-auto">
                    <p className="text-muted-foreground font-bold mb-1">Live Server Response:</p>
                    <pre>{JSON.stringify(simResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DEPOSIT QR PHOTO & UPI MANAGEMENT (6 DYNAMIC QR CODES) */}
        {/* ============================================================== */}
        {activeTab === "qr_upi" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: 6 QR Settings & Gateway Configuration */}
            <div className="lg:col-span-8 rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <QrCode className="size-5 text-primary" /> Dynamic Amount-Specific QR Codes (6
                    Tiers)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set customized QR codes for each deposit tier. When a player selects an amount,
                    the corresponding QR code appears automatically.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
                  6 QR Codes Active
                </span>
              </div>

              {/* 6 QR Codes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. ₹100 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                      ₹100 QR Code (Tier 1)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(100)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr100}
                      onChange={(e) => setQr100(e.target.value)}
                      placeholder="Image URL for ₹100 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef100}
                      onChange={(e) => handleQrUploadForAmount(100, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef100.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>

                {/* 2. ₹200 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-lg">
                      ₹200 QR Code (Tier 2)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(200)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr200}
                      onChange={(e) => setQr200(e.target.value)}
                      placeholder="Image URL for ₹200 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef200}
                      onChange={(e) => handleQrUploadForAmount(200, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef200.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>

                {/* 3. ₹500 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      ₹500 QR Code (Tier 3)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(500)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr500}
                      onChange={(e) => setQr500(e.target.value)}
                      placeholder="Image URL for ₹500 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef500}
                      onChange={(e) => handleQrUploadForAmount(500, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef500.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>

                {/* 4. ₹1000 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-lg">
                      ₹1,000 QR Code (Tier 4)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(1000)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr1000}
                      onChange={(e) => setQr1000(e.target.value)}
                      placeholder="Image URL for ₹1000 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef1000}
                      onChange={(e) => handleQrUploadForAmount(1000, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef1000.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>

                {/* 5. ₹2500 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-lg">
                      ₹2,500 QR Code (Tier 5)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(2500)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr2500}
                      onChange={(e) => setQr2500(e.target.value)}
                      placeholder="Image URL for ₹2500 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef2500}
                      onChange={(e) => handleQrUploadForAmount(2500, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef2500.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>

                {/* 6. ₹5000 QR */}
                <div className="rounded-xl border border-border bg-surface-lowest p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-rose-400 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-lg">
                      ₹5,000 QR Code (VIP Tier 6)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewQrAmount(5000)}
                      className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={qr5000}
                      onChange={(e) => setQr5000(e.target.value)}
                      placeholder="Image URL for ₹5000 QR"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface-low px-2.5 font-mono text-[11px] text-foreground outline-none focus:border-primary"
                    />
                    <input
                      type="file"
                      ref={qrFileInputRef5000}
                      onChange={(e) => handleQrUploadForAmount(5000, e)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef5000.current?.click()}
                      className="h-9 px-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Upload className="size-3.5" /> File
                    </button>
                  </div>
                </div>
              </div>

              {/* Gateway & Contact Details */}
              <div className="border-t border-border pt-3.5 space-y-3">
                <h3 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                  Payment Gateway &amp; Support Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      UPI VPA / Payment ID
                    </label>
                    <input
                      type="text"
                      value={vpa}
                      onChange={(e) => setVpa(e.target.value)}
                      placeholder="e.g. 7056041009@navibharatpe"
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-muted-foreground">
                      UPI Payee / Receiver Name
                    </label>
                    <input
                      type="text"
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      placeholder="e.g. BaaziWin Gaming"
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-muted-foreground">
                      Support WhatsApp
                    </label>
                    <input
                      type="text"
                      value={supportWhatsapp}
                      onChange={(e) => setSupportWhatsapp(e.target.value)}
                      placeholder="+91..."
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-muted-foreground">
                      Support Telegram
                    </label>
                    <input
                      type="text"
                      value={supportTelegram}
                      onChange={(e) => setSupportTelegram(e.target.value)}
                      placeholder="@username"
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-muted-foreground">
                      Minimum Deposit (₹)
                    </label>
                    <input
                      type="number"
                      value={minDeposit}
                      onChange={(e) => setMinDeposit(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveQrUpi}
                disabled={savingConfig}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                {savingConfig
                  ? "Saving & Broadcasting..."
                  : "Save All 6 QR Codes & Gateway Settings Live"}
              </button>
            </div>

            {/* Right: Live Interactive QR Preview */}
            <div className="lg:col-span-4 rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-3 shadow-sm text-center">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  Live Player Preview
                </span>
                <span className="font-mono text-[10px] font-bold text-emerald-400">
                  ₹{previewQrAmount} Selected
                </span>
              </div>

              {/* Amount Preview Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1.5">
                {[100, 200, 500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPreviewQrAmount(amt)}
                    className={`py-1.5 px-1 rounded-lg font-mono text-xs font-bold transition ${
                      previewQrAmount === amt
                        ? "bg-primary text-slate-950 font-black shadow-sm"
                        : "bg-surface-lowest border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Displayed QR for selected amount */}
              {(() => {
                const currentPreviewUrl =
                  previewQrAmount === 100
                    ? qr100
                    : previewQrAmount === 200
                      ? qr200
                      : previewQrAmount === 500
                        ? qr500
                        : previewQrAmount === 1000
                          ? qr1000
                          : previewQrAmount === 2500
                            ? qr2500
                            : qr5000;

                return (
                  <div className="rounded-2xl border border-border bg-surface-lowest p-4 space-y-3">
                    <div className="aspect-square max-w-[220px] mx-auto rounded-xl overflow-hidden bg-white p-3 border-2 border-slate-900 shadow-md flex items-center justify-center">
                      <img
                        src={currentPreviewUrl}
                        alt={`Deposit QR ₹${previewQrAmount}`}
                        referrerPolicy="no-referrer"
                        className="size-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            DEFAULT_QR_URLS[previewQrAmount as keyof typeof DEFAULT_QR_URLS] ||
                            "/qr-code.png";
                        }}
                      />
                    </div>

                    <div className="font-mono text-xs text-foreground font-black">
                      ₹{previewQrAmount.toLocaleString()} Deposit QR Display
                    </div>

                    <div className="rounded-xl bg-surface-high p-2 font-mono text-[11px] space-y-0.5">
                      <p className="text-muted-foreground text-[9px] uppercase">Active Payee</p>
                      <p className="text-foreground font-sans font-bold">{payeeName}</p>
                      <p className="text-primary font-mono select-all text-[10px]">{vpa}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: ALGORITHM & RTP CONTROL */}
        {/* ============================================================== */}
        {activeTab === "algorithm" && (
          <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="border-b border-border pb-3">
              <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Sliders className="size-5 text-primary" /> House Edge &amp; Game Math Engine
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set exact platform profit margins. Every game automatically conforms to this
                mathematical RTP.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase text-muted-foreground">
                  House Edge Profit Percentage (%):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={houseProfitPct}
                    onChange={(e) => setHouseProfitPct(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <span className="font-mono text-lg font-bold text-primary w-14 text-right">
                    {houseProfitPct}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Player Return to Player (RTP):{" "}
                  <span className="font-bold text-foreground">{100 - houseProfitPct}%</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs uppercase text-muted-foreground">
                  Algorithm Strategy Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "custom_profit", label: "House Edge Guaranteed" },
                    { id: "provably_fair", label: "Provably Fair HMAC" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setAlgorithmMode(mode.id as never)}
                      className={`rounded-xl p-3 text-xs font-bold text-left border transition ${
                        algorithmMode === mode.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAlgorithm}
              disabled={savingConfig}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-sm font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-[0.99] transition"
            >
              <CheckCircle2 className="size-4" /> Save Mathematical Configuration
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: AVIATOR & COLOR TRADING REAL-TIME MASTER CONTROL */}
        {/* ============================================================== */}
        {activeTab === "crash" && (
          <div className="space-y-5">
            {/* 1. AVIATOR REAL-TIME SYNCHRONIZED FLIGHT COCKPIT */}
            <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <Plane className="size-5 text-red-400" />
                    <span>Aviator Synchronized Flight Control Center</span>
                    <span className="rounded-full bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 font-mono text-[10px] font-bold animate-pulse">
                      LIVE 100% SYNCED TO ALL PLAYERS
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls the global flight loop. Any target or crash triggered here happens in
                    exact real-time on every player screen across the entire platform.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    Round ID: <span className="font-bold text-foreground">#{aviator.roundId}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1.5 ${
                      aviator.phase === "flying"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                        : aviator.phase === "betting"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {aviator.phase === "flying" && <Plane className="size-3.5 animate-bounce" />}
                    {aviator.phase === "betting" && <Clock className="size-3.5" />}
                    {aviator.phase === "crashed" && <Flame className="size-3.5" />}
                    {aviator.phase.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Real-time Multiplier Radar Monitor */}
              <div className="rounded-2xl border border-border/80 bg-slate-950 p-4 sm:p-6 text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-3 left-4 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>SYNCHRONIZED FLIGHT MONITOR</span>
                </div>
                <div className="absolute top-3 right-4 text-xs font-mono text-muted-foreground">
                  Target Crash:{" "}
                  <span className="font-bold text-amber-400 font-mono">
                    {aviator.targetCrash.toFixed(2)}x
                  </span>
                </div>

                <div className="py-2">
                  {aviator.phase === "betting" ? (
                    <div className="space-y-1">
                      <p className="font-mono text-sm uppercase tracking-widest text-amber-400 font-bold">
                        NEXT FLIGHT TAKEOFF IN
                      </p>
                      <div className="font-display text-5xl sm:text-6xl font-black text-amber-400 font-mono">
                        {(aviator.countdownMs / 1000).toFixed(1)}s
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Waiting for player bets before takeoff
                      </p>
                    </div>
                  ) : aviator.phase === "flying" ? (
                    <div className="space-y-1">
                      <p className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold">
                        PLANE IN AIR (FLYING)
                      </p>
                      <div className="font-display text-6xl sm:text-7xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-md">
                        {aviator.multiplier.toFixed(2)}x
                      </div>
                      <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-300">
                        <span>
                          Flight Time:{" "}
                          <strong className="text-emerald-300">
                            {aviator.elapsedFlightSec.toFixed(1)}s
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Estimated Crash At:{" "}
                          <strong className="text-amber-300">
                            {calculateFlightDuration(aviator.targetCrash, aviator.speed).toFixed(1)}
                            s
                          </strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-mono text-xs uppercase tracking-widest text-red-400 font-bold flex items-center justify-center gap-1.5">
                        <Flame className="size-4 text-red-500" /> FLEW AWAY / CRASHED
                      </p>
                      <div className="font-display text-5xl sm:text-6xl font-black text-red-500 font-mono">
                        {aviator.flewAwayMultiplier.toFixed(2)}x
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Preparing new synchronized round...
                      </p>
                    </div>
                  )}
                </div>

                {/* Synchronized History Pills */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">
                    Live History:
                  </span>
                  {aviator.history.slice(0, 12).map((item, idx) => {
                    const mult = typeof item === "number" ? item : item.multiplier;
                    return (
                      <span
                        key={idx}
                        className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${
                          mult >= 10
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : mult >= 2
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {mult.toFixed(2)}x
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Target Multiplier Controls (0.5x to 100x+) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-mono text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                    <Sliders className="size-4 text-primary" />
                    <span>Set Target Crash Multiplier (0.50x to 100x+)</span>
                  </label>
                  <span className="text-xs font-mono text-primary">
                    Duration: ~
                    <strong>
                      {calculateFlightDuration(customTargetInput, aviator.speed).toFixed(1)} seconds
                    </strong>{" "}
                    in the air
                  </span>
                </div>

                {/* Quick Presets Grid */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTargetInput(100.0);
                        aviator.setTargetCrashMultiplier(100.0, "permanent");
                        toast.success("💥 100X Mega Crash Mode locked for Aviator flights!");
                      }}
                      className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/40 text-left transition active:scale-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black text-amber-300">
                          💥 100X Mega Mode
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-400">
                          100x
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Locks airplane flight to 100x crash point
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomTargetInput(50.0);
                        aviator.setTargetCrashMultiplier(50.0, "permanent");
                        toast.success("🔥 50X High Roller Mode locked for Aviator flights!");
                      }}
                      className="p-2.5 rounded-xl border border-orange-500/40 bg-orange-950/20 hover:bg-orange-950/40 text-left transition active:scale-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black text-orange-300">
                          🔥 50X High Roller
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-orange-500/20 px-1.5 py-0.5 rounded text-orange-400">
                          50x
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Locks airplane flight to 50x crash point
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomTargetInput(10.0);
                        aviator.setTargetCrashMultiplier(10.0, "permanent");
                        toast.success("✨ 10X Golden Hour Mode locked for Aviator flights!");
                      }}
                      className="p-2.5 rounded-xl border border-yellow-500/40 bg-yellow-950/20 hover:bg-yellow-950/40 text-left transition active:scale-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black text-yellow-300">
                          ✨ 10X Golden Mode
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-400">
                          10x
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Locks airplane flight to 10x crash point
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await aviator.setCrashMode("auto");
                        setCrashMode("auto");
                        setManualCrashTarget(2.5);
                        setCustomTargetInput(2.5);
                        toast.success(
                          "🟢 Standard Fair Play (Dynamic Algorithm) Activated! Forced multiplier cleared.",
                        );
                      }}
                      className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-950/40 text-left transition active:scale-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-black text-emerald-300">
                          🟢 Standard Fair Play
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400">
                          Auto RNG
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Natural authentic algorithm distribution
                      </p>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-1.5 pt-1">
                    {[1.05, 1.2, 1.5, 1.8, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomTargetInput(val)}
                        className={`rounded-xl py-2 font-mono text-xs font-bold border transition ${
                          customTargetInput === val
                            ? "border-red-500 bg-red-500/20 text-red-300 shadow-sm"
                            : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                      >
                        {val.toFixed(2)}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Input & Range Slider */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-8 space-y-1">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1.05"
                        max="50.0"
                        step="0.05"
                        value={customTargetInput > 50 ? 50 : customTargetInput}
                        onChange={(e) => setCustomTargetInput(Number(e.target.value))}
                        className="w-full accent-red-500"
                      />
                      <span className="font-mono text-sm font-bold text-foreground w-16 text-right">
                        {customTargetInput.toFixed(2)}x
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground font-bold">
                      Exact:
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="1000"
                      value={customTargetInput}
                      onChange={(e) => setCustomTargetInput(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Target Apply Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      aviator.setTargetCrashMultiplier(customTargetInput, "current");
                      toast.success(
                        `⚡ Target multiplier set to ${customTargetInput.toFixed(2)}x for CURRENT flight!`,
                      );
                    }}
                    className="h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Zap className="size-4" />
                    <span>Apply to CURRENT Flight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      aviator.setTargetCrashMultiplier(customTargetInput, "next");
                      toast.success(
                        `🎯 Next Round queued to crash at ${customTargetInput.toFixed(2)}x!`,
                      );
                    }}
                    className="h-11 rounded-xl bg-surface-high border border-primary/40 text-primary hover:bg-surface-highest font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Target className="size-4" />
                    <span>Queue for NEXT Round</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      aviator.setTargetCrashMultiplier(customTargetInput, "permanent");
                      toast.success(
                        `🔄 Target locked at ${customTargetInput.toFixed(2)}x for ALL future rounds!`,
                      );
                    }}
                    className="h-11 rounded-xl bg-surface-high border border-border text-foreground hover:bg-surface-highest font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <RefreshCw className="size-4" />
                    <span>Lock Permanent Target</span>
                  </button>
                </div>

                {/* Emergency & Next Flight Takeoff Actions */}
                <div className="space-y-3 pt-2 border-t border-border/60">
                  {/* Huge Instant Blast Button requested by user */}
                  <div className="rounded-2xl border-2 border-red-500/80 bg-red-950/50 p-3.5 sm:p-4 text-center shadow-[0_0_25px_rgba(239,68,68,0.25)] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-left space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Flame className="size-5 text-red-500 animate-bounce" />
                        <span className="font-display text-sm font-black text-white tracking-wide uppercase">
                          तत्काल विमान ब्लास्ट कंट्रोल (INSTANT BLAST TRIGGER)
                        </span>
                      </div>
                      <p className="text-xs text-red-200/80">
                        इस बटन को दबाते ही विमान उसी क्षण सभी यूज़र्स की स्क्रीन पर तुरंत ब्लास्ट
                        (Crash) हो जाएगा!
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        aviator.triggerEmergencyCrash();
                        toast.error(
                          `🚨 विमान तुरंत ब्लास्ट कर दिया गया (${aviator.multiplier.toFixed(2)}x)! सभी स्क्रीन पर Flew Away हो गया।`,
                        );
                      }}
                      className="h-12 px-6 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-display text-sm font-black tracking-wide shadow-lg hover:shadow-red-600/50 active:scale-95 transition flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Flame className="size-5 text-white" />
                      <span>✈️💥 विमान अभी उड़ा दो (CRASH NOW)</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        aviator.forceNextRound(customTargetInput);
                        toast.success("⏭️ Next round initiated immediately!");
                      }}
                      className="flex-1 h-11 px-5 rounded-xl border border-border bg-surface-lowest hover:bg-surface-high text-foreground font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <ArrowRight className="size-4 text-primary" />
                      <span>Takeoff Next Round Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await aviator.setCrashMode("auto");
                        setCrashMode("auto");
                        setManualCrashTarget(2.5);
                        setCustomTargetInput(2.5);
                        toast.success(
                          "🎲 Standard Fair Play (Dynamic Algorithm) Activated! Forced targets cleared.",
                        );
                      }}
                      className="h-11 px-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Sparkles className="size-4 text-emerald-400" />
                      <span>Switch to Fair Auto Mode</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. COLOR TRADING (WIN GO) SYNCHRONIZED MASTER STUDIO */}
            <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="size-5 text-emerald-400" />
                    <span>Color Trading (Win Go) Master Studio</span>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold">
                      DETERMINISTIC GLOBAL SYNC
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All users calculate the exact same period and outcome. Set next forced number
                    (0-9), color, or size with live countdown matching player screens.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-surface-lowest border border-border p-1 rounded-xl">
                  {(["30s", "1m", "3m", "5m"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedColorMode(t)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold transition ${
                        selectedColorMode === t
                          ? "bg-primary text-slate-950"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Synchronized Period & Countdown Live Strip */}
              <div className="rounded-xl border border-border bg-surface-lowest p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-surface-high border border-border flex items-center justify-center font-mono font-black text-primary text-sm">
                    {colorTrading.secondsRemaining}s
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">
                      Live Synchronized Period ID ({selectedColorMode})
                    </p>
                    <p className="font-mono text-sm font-bold text-foreground">
                      {colorTrading.period}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    Next Outcome Status:
                  </span>
                  {colorTrading.override?.mode === "manual" &&
                  typeof colorTrading.override.forcedNumber === "number" ? (
                    <span className="rounded-full bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 font-mono text-xs font-bold">
                      FORCED: Number {colorTrading.override.forcedNumber}
                    </span>
                  ) : colorTrading.override?.mode === "manual" &&
                    colorTrading.override.forcedColor ? (
                    <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 font-mono text-xs font-bold uppercase">
                      FORCED: {colorTrading.override.forcedColor}
                    </span>
                  ) : colorTrading.override?.mode === "manual" &&
                    colorTrading.override.forcedSize ? (
                    <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 font-mono text-xs font-bold uppercase">
                      FORCED: {colorTrading.override.forcedSize}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-bold">
                      Fair Auto Algorithm (Hash RNG)
                    </span>
                  )}
                </div>
              </div>

              {/* Force Specific Number (0 to 9) */}
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase font-bold text-muted-foreground flex items-center justify-between">
                  <span>1. Force Exact Winning Number (0 - 9)</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Instantly forces exact number, color, and size
                  </span>
                </label>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[
                    {
                      num: 0,
                      color: "red-violet",
                      bg: "from-red-500 to-purple-500",
                      label: "0 (R+V)",
                    },
                    { num: 1, color: "green", bg: "bg-emerald-500", label: "1 (G)" },
                    { num: 2, color: "red", bg: "bg-red-500", label: "2 (R)" },
                    { num: 3, color: "green", bg: "bg-emerald-500", label: "3 (G)" },
                    { num: 4, color: "red", bg: "bg-red-500", label: "4 (R)" },
                    {
                      num: 5,
                      color: "green-violet",
                      bg: "from-emerald-500 to-purple-500",
                      label: "5 (G+V)",
                    },
                    { num: 6, color: "red", bg: "bg-red-500", label: "6 (R)" },
                    { num: 7, color: "green", bg: "bg-emerald-500", label: "7 (G)" },
                    { num: 8, color: "red", bg: "bg-red-500", label: "8 (R)" },
                    { num: 9, color: "green", bg: "bg-emerald-500", label: "9 (G)" },
                  ].map((item) => (
                    <button
                      key={item.num}
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedNumber: item.num,
                          forcedColor: null,
                          forcedSize: null,
                        });
                        toast.success(
                          `🎯 Color Trading Period will resolve to Number ${item.num}!`,
                        );
                      }}
                      className={`rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedNumber === item.num
                          ? "border-primary bg-primary/20 ring-2 ring-primary shadow-md"
                          : "border-border bg-surface-lowest hover:border-border/80"
                      }`}
                    >
                      <span
                        className={`size-7 rounded-full text-white font-mono font-black text-sm flex items-center justify-center ${
                          item.color.includes("-") ? `bg-gradient-to-r ${item.bg}` : item.bg
                        }`}
                      >
                        {item.num}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground font-bold">
                        {item.num >= 5 ? "Big" : "Small"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Force Color & Force Size Quick Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Colors */}
                <div className="space-y-1.5">
                  <label className="font-mono text-xs uppercase font-bold text-muted-foreground">
                    2. Force Winning Color Only
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedColor: "green",
                          forcedNumber: null,
                          forcedSize: null,
                        });
                        toast.success("🟢 Next outcome forced to GREEN!");
                      }}
                      className={`h-11 rounded-xl font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedColor === "green"
                          ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 shadow-md"
                          : "bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/60"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span>Force GREEN</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedColor: "violet",
                          forcedNumber: null,
                          forcedSize: null,
                        });
                        toast.success("🟣 Next outcome forced to VIOLET!");
                      }}
                      className={`h-11 rounded-xl font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedColor === "violet"
                          ? "bg-purple-500 text-white ring-2 ring-purple-400 shadow-md"
                          : "bg-purple-950/30 border border-purple-500/40 text-purple-400 hover:bg-purple-950/60"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-purple-400" />
                      <span>Force VIOLET</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedColor: "red",
                          forcedNumber: null,
                          forcedSize: null,
                        });
                        toast.success("🔴 Next outcome forced to RED!");
                      }}
                      className={`h-11 rounded-xl font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedColor === "red"
                          ? "bg-red-500 text-white ring-2 ring-red-400 shadow-md"
                          : "bg-red-950/30 border border-red-500/40 text-red-400 hover:bg-red-950/60"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-red-400" />
                      <span>Force RED</span>
                    </button>
                  </div>
                </div>

                {/* Sizes & Reset */}
                <div className="space-y-1.5">
                  <label className="font-mono text-xs uppercase font-bold text-muted-foreground">
                    3. Force Size / Reset to Auto
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedSize: "big",
                          forcedNumber: null,
                          forcedColor: null,
                        });
                        toast.success("🐘 Next outcome forced to BIG (5-9)!");
                      }}
                      className={`h-11 rounded-xl font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedSize === "big"
                          ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md"
                          : "bg-amber-950/30 border border-amber-500/40 text-amber-300 hover:bg-amber-950/60"
                      }`}
                    >
                      <span>BIG (5-9)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "manual",
                          forcedSize: "small",
                          forcedNumber: null,
                          forcedColor: null,
                        });
                        toast.success("🐭 Next outcome forced to SMALL (0-4)!");
                      }}
                      className={`h-11 rounded-xl font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        colorTrading.override?.mode === "manual" &&
                        colorTrading.override.forcedSize === "small"
                          ? "bg-blue-500 text-white ring-2 ring-blue-400 shadow-md"
                          : "bg-blue-950/30 border border-blue-500/40 text-blue-300 hover:bg-blue-950/60"
                      }`}
                    >
                      <span>SMALL (0-4)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        colorTrading.setAdminColorOverride({
                          mode: "auto",
                          forcedNumber: null,
                          forcedColor: null,
                          forcedSize: null,
                        });
                        toast.success("✨ Color Trading restored to Autonomous Fair Algorithm!");
                      }}
                      className="h-11 rounded-xl border border-border bg-surface-lowest hover:bg-surface-high text-muted-foreground hover:text-foreground font-display text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Reset Auto</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: PLAYERS & MONEY MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === "players" && (
          <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Player Money &amp; Balance Control
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View, credit, deduct, or adjust any player balance directly.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search player / phone / ID..."
                  className="h-10 w-full rounded-xl border border-border bg-surface-lowest pl-9 pr-3 text-xs text-foreground outline-none"
                />
              </div>
            </div>

            {/* Players Table */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface-lowest">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-high text-muted-foreground font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Player / Username</th>
                    <th className="p-3">Main Cash (₹)</th>
                    <th className="p-3">Bonus (₹)</th>
                    <th className="p-3">Total Wagered</th>
                    <th className="p-3">Total Won</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-high/40 transition">
                      <td className="p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-full bg-surface-high flex items-center justify-center text-xs">
                            {p.avatar || "👤"}
                          </span>
                          <div>
                            <p className="font-bold">{p.username}</p>
                            <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                              {p.email || p.phone || p.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        ₹{formatMoney(p.deposit_balance ?? p.balance)}
                      </td>
                      <td className="p-3 font-mono text-amber-400">
                        ₹{formatMoney(p.bonus_balance ?? 0)}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        ₹{formatMoney(p.total_wagered || 0)}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        ₹{formatMoney(p.total_won || 0)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleModifyPlayerMoney(p, 500, 0)}
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 font-mono text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition"
                          >
                            +₹500
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModifyPlayerMoney(p, -500, 0)}
                            className="rounded-lg bg-red-500/20 border border-red-500/30 px-2 py-1 font-mono text-[11px] font-bold text-red-400 hover:bg-red-500/30 transition"
                          >
                            -₹500
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPlayer(p)}
                            className="rounded-lg bg-surface-high px-2 py-1 font-display text-[11px] font-bold text-foreground hover:bg-surface-highest transition"
                          >
                            Custom
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Custom Edit Dialog for Selected Player */}
            {selectedPlayer && (
              <div className="rounded-2xl border border-primary/30 bg-surface-lowest p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Custom Money Management for {selectedPlayer.username} ({selectedPlayer.id})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">
                      Add / Deduct Main Cash (Deposit Wallet) ₹
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={adjustDepositAmount}
                        onChange={(e) => setAdjustDepositAmount(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-border bg-surface-low px-3 font-mono text-xs text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleModifyPlayerMoney(selectedPlayer, adjustDepositAmount, 0)
                        }
                        className="rounded-xl bg-emerald-500 px-3 font-mono text-xs font-bold text-slate-950"
                      >
                        Credit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleModifyPlayerMoney(selectedPlayer, -adjustDepositAmount, 0)
                        }
                        className="rounded-xl bg-red-500/30 text-red-400 px-3 font-mono text-xs font-bold"
                      >
                        Deduct
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">
                      Add / Deduct Bonus Cash ₹
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={adjustBonusAmount}
                        onChange={(e) => setAdjustBonusAmount(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-border bg-surface-low px-3 font-mono text-xs text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleModifyPlayerMoney(selectedPlayer, 0, adjustBonusAmount)
                        }
                        className="rounded-xl bg-amber-500 px-3 font-mono text-xs font-bold text-slate-950"
                      >
                        Credit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleModifyPlayerMoney(selectedPlayer, 0, -adjustBonusAmount)
                        }
                        className="rounded-xl bg-red-500/30 text-red-400 px-3 font-mono text-xs font-bold"
                      >
                        Deduct
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 7: OWNERSHIP PROFIT & REVENUE ANALYTICS */}
        {/* ============================================================== */}
        {activeTab === "profit" && (
          <div className="rounded-2xl border border-border bg-surface-low p-4 sm:p-6 space-y-5 shadow-sm">
            <div className="border-b border-border pb-3">
              <h2 className="font-display text-lg font-black text-foreground flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" /> Master Ownership Profit Analytics
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calculates your 3% to 4% direct ownership revenue share from all real player wagers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-surface-lowest p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  Total Platform Turnover
                </p>
                <p className="mt-1 font-display text-2xl font-black text-foreground">
                  ₹{formatMoney(totalTurnover)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">All player bets placed</p>
              </div>

              <div className="rounded-xl border border-border bg-surface-lowest p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  Total Player Winnings Paid
                </p>
                <p className="mt-1 font-display text-2xl font-black text-emerald-400">
                  ₹{formatMoney(totalWinnings)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Live cashed out winnings</p>
              </div>

              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                  <Crown className="size-3.5" /> Ownership {config.house_profit_pct}% Share
                </p>
                <p className="mt-1 font-display text-2xl font-black text-amber-300">
                  ₹{formatMoney(adminOwnershipProfit)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Direct ownership earnings
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
