import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import {
  Lock,
  Sparkles,
  Gift,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAppConfig, getDepositQrForAmount, DEFAULT_UPI_VPA } from "@/lib/appConfig";
import { useSubmitUtr } from "@/lib/player";
import { playSfx } from "@/lib/sound";

export type FirstDepositModalProps = {
  isOpen: boolean;
  onClose: () => void;
  gameTitle?: string;
};

const DEPOSIT_TIERS = [
  {
    amount: 100,
    cashback: 18,
    total: 118,
    badge: "18% Bonus",
    highlight: false,
  },
  {
    amount: 200,
    cashback: 24,
    total: 224,
    badge: "12% Bonus",
    highlight: false,
  },
  {
    amount: 500,
    cashback: 50,
    total: 550,
    badge: "10% Bonus",
    highlight: false,
  },
  {
    amount: 1000,
    cashback: 120,
    total: 1120,
    badge: "🔥 12% Bonus",
    highlight: true,
  },
  {
    amount: 2500,
    cashback: 375,
    total: 2875,
    badge: "15% Bonus",
    highlight: false,
  },
  {
    amount: 5000,
    cashback: 850,
    total: 5850,
    badge: "⚡ 17% VIP Bonus",
    highlight: false,
  },
];

export function FirstDepositModal({ isOpen, onClose, gameTitle }: FirstDepositModalProps) {
  const navigate = useNavigate();
  const { data: appConfig } = useAppConfig();
  const submitUtr = useSubmitUtr();

  const [selectedTier, setSelectedTier] = useState<number>(100);
  const [activeMode, setActiveMode] = useState<"tiers" | "qr">("tiers");
  const [utr, setUtr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeVpa = appConfig?.upi_vpa || DEFAULT_UPI_VPA;
  const activePayee = appConfig?.upi_payee_name || "BaaziWin VIP Gaming";

  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(activePayee)}&am=${selectedTier}&cu=INR&tn=BaaziWin%20First%20Deposit`;
  const qrDisplayUrl = getDepositQrForAmount(selectedTier, appConfig);

  const selectedTierData = DEPOSIT_TIERS.find((t) => t.amount === selectedTier) || DEPOSIT_TIERS[0];

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(activeVpa);
    setCopied(true);
    playSfx("click");
    toast.success("UPI ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceedToQrMode = (amountToDeposit: number) => {
    setSelectedTier(amountToDeposit);
    setActiveMode("qr");
    playSfx("click");
  };

  const handleOpenInWallet = () => {
    playSfx("click");
    onClose();
    navigate({
      to: "/wallet",
      search: { tab: "deposit", amount: selectedTier } as any,
    });
  };

  const handleSubmitUtr = async () => {
    if (!utr || utr.trim().length !== 12 || !/^\d{12}$/.test(utr.trim())) {
      toast.error("कृपया 12 अंकों का सही UTR नंबर डालें (Enter valid 12-digit UTR)");
      return;
    }

    try {
      const res = await submitUtr.mutateAsync({ amount: selectedTier, utr: utr.trim() });
      playSfx("win");
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

      if (res.instantVerified) {
        toast.success(`⚡ डिपॉजिट वेरिफाइड! ₹${selectedTier} आपके वॉलेट में जुड़ गया है! 🎉`);
      } else {
        toast.success(
          "✅ डिपॉजिट रिक्वेस्ट सबमिट हो गई है! कुछ ही पलों में राशि वॉलेट में जुड़ जाएगी।",
        );
      }
      setUtr("");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit deposit. Please try again or contact support.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card with smooth scrolling */}
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-[#181512] via-[#11100e] to-[#0a0908] text-slate-100 shadow-[0_0_60px_rgba(245,158,11,0.25)]">
        {/* Glow Header Accent */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-56 rounded-full bg-amber-500/20 blur-3xl" />

        {/* Modal Header Bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-amber-500/20 bg-amber-950/20 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md">
              <Lock className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-amber-400/20 px-2 py-0.2 font-mono text-[10px] font-black text-amber-300 border border-amber-500/30">
                  🎁 Welcome Bonus Active
                </span>
              </div>
              <h2 className="font-display text-sm sm:text-base font-black tracking-tight text-white">
                {gameTitle ? `${gameTitle} — First Deposit` : "पहला डिपॉजिट आवश्यक (First Deposit)"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="relative z-10 grid grid-cols-2 gap-1 border-b border-white/10 bg-black/40 p-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveMode("tiers");
              playSfx("click");
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-display text-xs font-bold transition ${
              activeMode === "tiers"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Gift className="size-3.5" />
            <span>1. बोनस प्लान चुनें</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode("qr");
              playSfx("click");
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 font-display text-xs font-bold transition ${
              activeMode === "qr"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <QrCode className="size-3.5" />
            <span>2. Scan &amp; Pay (₹{selectedTier})</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* VIEW 1: TIERS SELECTION */}
          {activeMode === "tiers" && (
            <div className="space-y-4">
              {/* ₹100 Welcome Gift Notification Banner */}
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent p-3 sm:p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Sparkles className="size-5" />
                  </div>
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-amber-300">
                      🎁 आपका ₹100 वेलकम कैश बैलेंस सुरक्षित है!
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      रियल मनी गेम्स अनलॉक करने और अपना ₹100 वेलकम बोनस क्लेम करने के लिए नीचे से
                      कोई भी राशि चुनें और तुरंत डिपॉजिट करें।
                    </p>
                  </div>
                </div>
              </div>

              {/* Tier Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  <span>डिपॉजिट प्लान चुनें</span>
                  <span className="text-amber-400">+ Extra Cash Bonus</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEPOSIT_TIERS.map((tier) => {
                    const isSelected = selectedTier === tier.amount;
                    return (
                      <button
                        key={tier.amount}
                        type="button"
                        onClick={() => {
                          setSelectedTier(tier.amount);
                          playSfx("chip");
                        }}
                        className={`rounded-2xl border p-3 text-left transition-all relative ${
                          isSelected
                            ? "border-amber-400 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-2 ring-amber-400"
                            : "border-white/10 bg-white/5 hover:bg-white/10 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                isSelected
                                  ? "border-amber-400 bg-amber-400 text-slate-950"
                                  : "border-white/30 bg-transparent"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="size-3.5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-display text-base font-black text-white">
                                  ₹{tier.amount.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-[10px] text-amber-300 font-mono font-bold">
                                + ₹{tier.cashback} Bonus
                              </p>
                            </div>
                          </div>

                          {tier.badge && (
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-black ${
                                tier.highlight
                                  ? "bg-amber-400 text-slate-950 shadow-sm"
                                  : "bg-white/10 text-slate-300 border border-white/10"
                              }`}
                            >
                              {tier.badge}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px] text-slate-400">
                          <span>कुल खेलने को मिलेगा:</span>
                          <strong className="text-emerald-400 font-mono font-bold">
                            ₹{tier.total}
                          </strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Benefits list */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-300 font-medium">
                <div className="flex items-center gap-1.5 rounded-xl bg-white/5 p-2 border border-white/5">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                  <span>100% बैंक सुरक्षित ट्रांसफर</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-white/5 p-2 border border-white/5">
                  <Zap className="size-4 text-amber-400 shrink-0" />
                  <span>तुरंत UPI विड्रॉल सक्रिय</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleProceedToQrMode(selectedTier)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 font-display text-sm font-black text-slate-950 shadow-[0_4px_25px_rgba(245,158,11,0.4)] transition hover:brightness-110 active:scale-[0.98]"
                >
                  <QrCode className="size-4" />
                  <span>Scan &amp; Pay ₹{selectedTier.toLocaleString()}</span>
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenInWallet}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 font-display text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  <Wallet className="size-3.5 text-primary" />
                  <span>Open Full Wallet Page</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: INSTANT QR CODE SCAN & PAY DIRECTLY IN MODAL */}
          {activeMode === "qr" && (
            <div className="space-y-4 text-center">
              {/* Selected Tier Banner */}
              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-amber-300">
                    ₹{selectedTier.toLocaleString()} Deposit
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">
                    (+₹{selectedTierData.cashback} Cashback)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMode("tiers")}
                  className="text-[10px] text-primary hover:underline font-mono font-bold"
                >
                  Change Amount
                </button>
              </div>

              {/* Amount Quick Pills */}
              <div className="grid grid-cols-6 gap-1">
                {DEPOSIT_TIERS.map((t) => (
                  <button
                    key={t.amount}
                    type="button"
                    onClick={() => {
                      setSelectedTier(t.amount);
                      playSfx("chip");
                    }}
                    className={`py-1 rounded-lg font-mono text-[10.5px] font-bold transition ${
                      selectedTier === t.amount
                        ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                        : "bg-surface-lowest border border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    ₹{t.amount >= 1000 ? `${t.amount / 1000}k` : t.amount}
                  </button>
                ))}
              </div>

              {/* Clean Dynamic QR Code Card */}
              <div className="relative mx-auto max-w-[240px] rounded-3xl border-2 border-slate-800 bg-white p-3 shadow-xl">
                <div className="aspect-square w-full flex items-center justify-center overflow-hidden rounded-2xl bg-white">
                  <img
                    src={qrDisplayUrl}
                    alt={`UPI QR ₹${selectedTier}`}
                    referrerPolicy="no-referrer"
                    className="size-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiIntentUrl)}&bgcolor=ffffff&color=090d16&margin=2`;
                    }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[11px] font-black text-slate-900">
                  Scan &amp; Pay ₹{selectedTier.toLocaleString()}
                </p>
              </div>

              {/* Direct UPI Intent Button */}
              <a
                href={upiIntentUrl}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 font-display text-xs font-bold text-slate-950 shadow-md hover:brightness-110 active:scale-[0.98] transition"
              >
                <ExternalLink className="size-4" />
                <span>Pay ₹{selectedTier.toLocaleString()} via GPay / PhonePe / Paytm</span>
              </a>

              {/* Copy UPI VPA Address */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <div className="text-left truncate mr-2">
                  <p className="text-[10px] text-slate-400 uppercase font-mono">Payee UPI ID</p>
                  <p className="font-mono font-bold text-amber-300 truncate select-all">
                    {activeVpa}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyVpa}
                  className="flex items-center gap-1 shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition"
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>

              {/* Submit 12-Digit UTR Input Box */}
              <div className="rounded-2xl border border-amber-500/30 bg-black/40 p-3 text-left space-y-2">
                <label className="text-[11px] font-mono uppercase font-bold text-slate-300 flex items-center justify-between">
                  <span>12-Digit UPI UTR / Reference No.</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Auto-Credited</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={12}
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 12-digit UTR (e.g. 508210...)"
                    className="h-11 flex-1 rounded-xl border border-white/20 bg-surface-lowest px-3 font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400 tracking-wider"
                  />
                  <button
                    type="button"
                    disabled={submitUtr.isPending || utr.length !== 12}
                    onClick={handleSubmitUtr}
                    className="h-11 px-4 rounded-xl bg-amber-500 font-display text-xs font-black text-slate-950 hover:brightness-110 active:scale-95 transition disabled:opacity-40 whitespace-nowrap shadow-md"
                  >
                    {submitUtr.isPending ? "Verifying..." : "Submit UTR"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  पेमेंट के बाद अपने UPI ऍप (GPay / PhonePe / Paytm) से 12 अंकों का{" "}
                  <strong>UTR Number</strong> यहाँ डालें और Submit करें।
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="relative z-10 border-t border-white/10 bg-black/50 px-4 py-2.5 text-center font-mono text-[10px] text-slate-400">
          ⚡ 24x7 Instant Deposit • 100% Safe &amp; Verified UPI Gateways
        </div>
      </div>
    </div>
  );
}
