import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Copy,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  MessageCircle,
  Send,
  Flame,
  Gift,
  Users,
  RefreshCw,
  Info,
  ChevronRight,
  Sparkles,
  Terminal,
  Radio,
  ExternalLink,
  Code2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SignInGate } from "@/components/SignInGate";
import {
  MIN_DEPOSIT,
  MIN_WITHDRAW,
  getDepositCashback,
  useClaimLossRebate,
  useDepositRequests,
  useHistory,
  usePlayer,
  useSession,
  useSubmitUtr,
  useTransactions,
  useWithdraw,
  useBankWebhookStatus,
  sendSimulatedBankSms,
  withdrawable,
  hasPlayerDeposited,
} from "@/lib/player";
import { formatCoins } from "@/lib/games";
import { useAppConfig, getDepositQrForAmount } from "@/lib/appConfig";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/wallet")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as "deposit" | "withdraw") || "deposit",
      amount: Number(search.amount) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Wallet & Fast Cashout — BaaziWin" },
      {
        name: "description",
        content:
          "Deposit via UPI with instant automated credit and withdraw winnings in 1-5 minutes directly to your UPI ID or Bank Account on BaaziWin.",
      },
      { property: "og:title", content: "Wallet & Cashout — BaaziWin" },
      {
        property: "og:description",
        content:
          "Fast 1-5 min UPI withdrawals, low ₹100 limits, and daily loss cashback on BaaziWin.",
      },
    ],
  }),
  component: WalletPage,
});

const DEFAULT_UPI_VPA = "9286987657-1@naviaxis";
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2500, 5000];
const METHODS = ["UPI", "GPay", "PhonePe", "Paytm"] as const;

function onChangeSafeAmount(val: string, setter: (n: number) => void) {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 0) {
    setter(0);
  } else {
    setter(parsed);
  }
}

function DualWalletHeader({ player }: { player: ReturnType<typeof usePlayer>["data"] }) {
  const depositBal =
    player?.deposit_balance ?? Math.max(0, (player?.balance ?? 0) - (player?.bonus_balance ?? 0));
  const bonusBal = player?.bonus_balance ?? 0;
  const totalBal = depositBal + bonusBal;
  const isDeposited = hasPlayerDeposited(player);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-low p-4 shadow-md sm:p-5">
      {/* Top Total Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Total Account Balance
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              ₹{totalBal.toLocaleString()}
            </span>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              DIRECT ₹ REAL CASH
            </span>
          </div>
        </div>
        <div className="flex size-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm font-mono text-xl font-black">
          ₹
        </div>
      </div>

      {/* Dual Wallet Sub-Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {/* Main Cash (Withdrawable) */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 transition hover:border-emerald-500/50">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-400">
              Main Cash
            </span>
            <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
              <ShieldCheck className="size-3" /> Withdrawable
            </span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-foreground sm:text-2xl">
            ₹{depositBal.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Deposits &amp; Game Winnings</p>
        </div>

        {/* Bonus Wallet */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 transition hover:border-amber-500/50">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Bonus Wallet
            </span>
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
              <Gift className="size-3" /> Wagering
            </span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-amber-300 sm:text-2xl">
            ₹{bonusBal.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Quests, Spins &amp; Cashbacks</p>
        </div>
      </div>
    </div>
  );
}

function DepositForm() {
  const { data: appConfig } = useAppConfig();
  const { data: player } = usePlayer();
  const isFirstDeposit = !hasPlayerDeposited(player);
  const activeMinDeposit = appConfig?.min_deposit || MIN_DEPOSIT;
  const [amount, setAmount] = useState<number>(activeMinDeposit);
  const [utr, setUtr] = useState<string>("");
  const { data: requests } = useDepositRequests();
  const submitUtr = useSubmitUtr();

  const activeVpa = appConfig?.upi_vpa || DEFAULT_UPI_VPA;
  const activePayee = appConfig?.upi_payee_name || "BaaziWin VIP Gaming";

  const upiUrl = `upi://pay?pa=${encodeURIComponent(activeVpa)}&pn=${encodeURIComponent(activePayee)}&am=${amount}&cu=INR&tn=BaaziWin%20Direct%20Deposit`;
  const dynamicGeneratedQr = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiUrl)}&bgcolor=ffffff&color=090d16&margin=2`;

  // Dynamic QR Code based on selected amount (₹100, ₹200, ₹500, ₹1000, ₹2500, ₹5000)
  const qrDisplayUrl = getDepositQrForAmount(amount, appConfig) || dynamicGeneratedQr;

  const handleShare = () => {
    if (navigator.share) {
      void navigator
        .share({
          title: `BaaziWin ₹${amount} Deposit QR`,
          text: `Pay ₹${amount} on BaaziWin via UPI`,
          url: upiUrl,
        })
        .catch(() => {});
    } else {
      window.open(qrDisplayUrl, "_blank");
      toast.success("Opening QR Code image...");
    }
  };

  const handleDownloadQr = () => {
    window.open(qrDisplayUrl, "_blank");
    toast.success("Opening QR Code image...");
  };

  const cb = getDepositCashback(amount, isFirstDeposit);

  const submit = async () => {
    if (amount < activeMinDeposit)
      return toast.error(`Minimum deposit amount is ₹${activeMinDeposit}`);
    if (!utr || utr.trim().length !== 12 || !/^\d{12}$/.test(utr.trim())) {
      return toast.error("Please enter a valid 12-digit numeric UTR from your UPI App");
    }

    try {
      const res = await submitUtr.mutateAsync({ amount, utr: utr.trim() });
      if (res.instantVerified) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        if (res.cashback && res.cashback > 0) {
          toast.success(
            `⚡ Bank Verified! ₹${amount} credited to Main Cash + ₹${res.cashback} Cashback to Bonus Wallet! 🎉`,
          );
        } else {
          toast.success(`⚡ Bank Verified! ₹${amount} credited directly to your Main Cash wallet!`);
        }
      } else {
        toast.info(
          "Deposit request logged. As soon as your payment is verified, it will auto-credit instantly.",
        );
      }
      setUtr("");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit deposit. Please try again.");
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl border border-border/80 bg-surface-low p-4 shadow-md sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <ArrowDownToLine className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                Add Cash (Direct Deposit)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Direct 1:1 real money transactions (₹1 = ₹1 Real Cash)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gateway: Active
            </span>
          </div>
        </div>

        {/* Live Admin Cloud Announcement Banner */}
        {appConfig?.live_announcement && (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-surface-low to-amber-500/10 p-3 flex items-center gap-2 text-xs">
            <Zap className="size-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-semibold text-amber-200">{appConfig.live_announcement}</span>
          </div>
        )}

        {/* Extra Deposit Bonus if configured */}
        {(appConfig?.store_bonus_pct || 0) > 0 && (
          <div className="mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400 shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-emerald-300">Active Cashback Bonus: </span>
                <span className="text-muted-foreground">
                  Get{" "}
                  <strong className="text-emerald-400">
                    +{appConfig?.store_bonus_pct}% extra cash bonus
                  </strong>{" "}
                  on your deposit!
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-400 px-2.5 py-0.5 font-mono text-[10px] font-black text-slate-950">
              +{appConfig?.store_bonus_pct}% BONUS
            </span>
          </div>
        )}

        {/* Deposit Cashback Incentive Banner */}
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-amber-400 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-amber-300">
                {isFirstDeposit ? "🎁 First Deposit Bonus: " : "⚡ Reload Cashback: "}
              </span>
              <span className="text-muted-foreground">
                {isFirstDeposit
                  ? "₹100 (18%), ₹200 (12%), ₹500 (10%), ₹1,000 (12%), ₹2,500 (15%), ₹5,000 (17%)"
                  : "₹100 (5%), ₹200 (6%), ₹500 (7%), ₹1,000 (9%), ₹2,500 (12%), ₹5,000 (14%)"}
              </span>
            </div>
          </div>
          {cb.cashback > 0 && (
            <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[10px] font-black text-slate-950">
              +{cb.percent}% (+₹{cb.cashback} Free)
            </span>
          )}
        </div>

        {/* Quick Amount Selector */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Deposit Amount
            </label>
            <span className="font-mono text-[10px] text-emerald-400 font-bold">
              QR Auto-Updates on Click
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_AMOUNTS.map((amt) => {
              const itemCb = getDepositCashback(amt, isFirstDeposit);
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`relative rounded-xl border py-2 px-1 font-mono text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center ${
                    amount === amt
                      ? "border-primary bg-primary text-slate-950 shadow-md ring-2 ring-primary/40"
                      : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-sm font-extrabold">₹{amt.toLocaleString()}</span>
                  {itemCb.percent > 0 && (
                    <span
                      className={`mt-0.5 rounded px-1 py-0.2 font-mono text-[8.5px] font-black ${
                        amount === amt
                          ? "bg-slate-950 text-amber-300"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      +{itemCb.percent}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div className="mt-3 rounded-xl border border-border bg-surface-lowest p-3">
          <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Custom Amount (₹)
          </label>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount || ""}
              onChange={(e) => onChangeSafeAmount(e.target.value, setAmount)}
              className="w-full bg-transparent px-2 font-mono text-xl font-extrabold text-foreground outline-none"
              placeholder="100"
            />
            <span className="shrink-0 font-mono text-xs font-bold text-emerald-400">INR ₹</span>
          </div>
        </div>

        {/* Pure Dynamic QR Card */}
        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-primary/40 bg-white p-4 text-slate-900 shadow-xl text-center">
          <div className="flex items-center justify-center gap-1.5 pb-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-[11px] font-black text-emerald-800 uppercase tracking-wide">
              ₹{amount.toLocaleString()} Deposit QR Code
            </span>
          </div>

          {/* QR Code Graphic */}
          <div className="my-2 flex flex-col items-center justify-center">
            <div className="relative rounded-2xl border-2 border-slate-900 p-3 bg-white shadow-md">
              <img
                src={qrDisplayUrl}
                alt={`Deposit UPI QR ₹${amount}`}
                width={200}
                height={200}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = dynamicGeneratedQr;
                }}
                className="size-52 rounded-xl object-contain"
              />
            </div>
            <p className="mt-2.5 font-display text-sm font-black text-slate-900">
              Scan &amp; Pay ₹{amount.toLocaleString()} with any UPI App
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Google Pay, PhonePe, Paytm, Navi UPI, BHIM, CRED
            </p>

            {/* Direct Pay via UPI link */}
            <a
              href={upiUrl}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-display text-xs font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition"
            >
              <ExternalLink className="size-3.5" />
              <span>Pay ₹{amount.toLocaleString()} directly in UPI App</span>
            </a>
          </div>

          {/* Share & Download Buttons */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 mt-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 font-display text-xs font-bold text-slate-800 hover:bg-slate-200 active:scale-95 transition"
            >
              <Send className="size-3.5" /> Share QR
            </button>
            <button
              type="button"
              onClick={handleDownloadQr}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 font-display text-xs font-bold text-slate-800 hover:bg-slate-200 active:scale-95 transition"
            >
              <ArrowDownToLine className="size-3.5" /> View / Download QR
            </button>
          </div>

          {/* Supported UPI Apps Footer */}
          <div className="mt-3 rounded-xl bg-slate-50 p-2 text-center border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-600">
              Accepted from <span className="font-black text-indigo-700">Navi UPI</span>,{" "}
              <span className="font-black text-purple-700">PhonePe</span>,{" "}
              <span className="font-black text-sky-600">Paytm</span>,{" "}
              <span className="font-black text-emerald-700">GPay</span> &amp; all banks
            </p>
          </div>
        </div>

        {/* UTR Input Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Enter 12-Digit UPI Ref / UTR Number
            </label>
            <span className="font-mono text-[10px] text-primary font-bold">
              {utr.length}/12 Digits
            </span>
          </div>
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="e.g. 423987123456"
            maxLength={12}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-sm tracking-wider text-foreground outline-none transition focus:border-primary"
          />
        </div>

        <button
          type="button"
          disabled={submitUtr.isPending || utr.length !== 12}
          onClick={submit}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-md transition active:scale-95 disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          {submitUtr.isPending ? "Verifying with Bank..." : "Verify & Add Coins"}
        </button>
      </div>

      {/* Recent Deposits List */}
      {requests && requests.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-low p-4">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Recent Deposit Requests
          </h3>
          <ul className="mt-2.5 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-lowest">
            {requests.map((r, idx) => (
              <li
                key={`dep-${r.id || r.utr}-${idx}`}
                className="flex items-center justify-between p-3 text-xs"
              >
                <div>
                  <p className="font-mono font-bold text-foreground">Ref: {r.utr}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {new Date(r.created_at).toLocaleDateString()}
                    {r.verified_by ? ` · via ${r.verified_by}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-emerald-400">
                    +{formatCoins(r.amount)}
                  </p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${
                      r.status === "COMPLETED" || r.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {r.status === "COMPLETED" || r.status === "approved"
                      ? "Auto-Verified"
                      : "Pending SMS"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BankSmsWebhookSimulator({
  defaultAmount,
  defaultUtr,
}: {
  defaultAmount: number;
  defaultUtr: string;
}) {
  const [testBank, setTestBank] = useState("HDFC");
  const [testAmount, setTestAmount] = useState(defaultAmount || 500);
  const [testUtr, setTestUtr] = useState(
    defaultUtr && defaultUtr.length === 12
      ? defaultUtr
      : `4234${Math.floor(10000000 + Math.random() * 90000000)}`,
  );
  const [customSms, setCustomSms] = useState("");
  const [secretHeader, setSecretHeader] = useState("3cr_secure_sms_webhook_secret_2026");
  const [webhookLog, setWebhookLog] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  const bankTemplates: {
    [key: string]: { sender: string; generate: (amt: number, utr: string) => string };
  } = {
    HDFC: {
      sender: "VM-HDFCBK",
      generate: (amt, utr) =>
        `Your HDFC Bank A/c ending 8899 has been credited with INR ${amt}.00 on 22-08-2026 by UPI. UTR: ${utr}.`,
    },
    SBI: {
      sender: "SBIUPI",
      generate: (amt, utr) =>
        `Dear SBI User, A/C 1234 credited by Rs.${amt}.00 on 22Aug26 by UPI/baaziwin@upi/${utr}/UPI Ref ${utr}.`,
    },
    ICICI: {
      sender: "ICICIB",
      generate: (amt, utr) =>
        `ICICI Bank: Acct XX123 credited with Rs ${amt}.00 on 22-Aug-26. Info: UPI/${utr}/Transfer.`,
    },
    PhonePe: {
      sender: "PhonePe",
      generate: (amt, utr) => `Received Rs.${amt}.00 from John Doe via PhonePe. Txn ID: ${utr}.`,
    },
    Paytm: {
      sender: "PAYTM",
      generate: (amt, utr) =>
        `Payment of INR ${amt}.00 received in your Paytm Wallet. UPI Ref No: ${utr}.`,
    },
    Axis: {
      sender: "AXISBK",
      generate: (amt, utr) =>
        `Axis Bank: Rs. ${amt}.00 credited to A/C ending 4567 on 22-08-26 by UPI Ref: ${utr}.`,
    },
  };

  const activeTemplate = bankTemplates[testBank] || bankTemplates.HDFC;
  const currentSmsBody = customSms || activeTemplate.generate(testAmount, testUtr);

  const handleSendWebhook = async () => {
    setIsSending(true);
    setWebhookLog(null);
    try {
      const data = await sendSimulatedBankSms({
        sender: activeTemplate.sender,
        body: currentSmsBody,
        secret: secretHeader,
      });
      setWebhookLog(data);
      if (data.status === "matched_and_credited") {
        confetti({ particleCount: 80, spread: 60 });
        toast.success(`🎉 Webhook Match! Credited ₹${data.amount} to user wallet.`);
      } else if (data.status === "stored_unclaimed") {
        toast.info(
          `💾 Saved in Unclaimed Pool (Expires in 30 mins). Now submit UTR ${data.utr} to auto-match!`,
        );
      } else if (data.status === "duplicate_blocked") {
        toast.error(`🔒 Blocked: ${data.message}`);
      } else {
        toast.info(`Status: ${data.status} - ${data.reason || ""}`);
      }
    } catch (e: any) {
      setWebhookLog({ error: e.message });
      toast.error(e.message || "Webhook delivery failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-[#070d24] p-3 text-xs space-y-2.5 font-sans">
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="size-4 text-primary" />
          <span className="font-bold text-foreground text-xs">Automated SMS Webhook Simulator</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const fresh = `4234${Math.floor(10000000 + Math.random() * 90000000)}`;
            setTestUtr(fresh);
            setCustomSms("");
          }}
          className="rounded px-2 py-0.5 font-mono text-[10px] bg-surface-high text-primary hover:bg-surface-high/80"
        >
          New UTR
        </button>
      </div>

      {/* Preset Bank Buttons */}
      <div className="grid grid-cols-6 gap-1">
        {Object.keys(bankTemplates).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              setTestBank(b);
              setCustomSms("");
            }}
            className={`rounded-lg py-1 font-mono text-[10px] font-bold transition ${
              testBank === b
                ? "bg-primary text-slate-950"
                : "bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Inputs for Amount & UTR */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-mono text-[9px] uppercase text-muted-foreground">
            Test Amount (₹)
          </label>
          <input
            type="number"
            value={testAmount}
            onChange={(e) => {
              setTestAmount(Number(e.target.value));
              setCustomSms("");
            }}
            className="mt-0.5 h-8 w-full rounded-lg border border-border bg-surface-lowest px-2 font-mono text-xs text-foreground outline-none"
          />
        </div>
        <div>
          <label className="font-mono text-[9px] uppercase text-muted-foreground">
            Test UTR (12 Digits)
          </label>
          <input
            value={testUtr}
            onChange={(e) => {
              setTestUtr(e.target.value);
              setCustomSms("");
            }}
            className="mt-0.5 h-8 w-full rounded-lg border border-border bg-surface-lowest px-2 font-mono text-xs text-foreground outline-none"
          />
        </div>
      </div>

      {/* Live SMS Payload Preview */}
      <div>
        <label className="font-mono text-[9px] uppercase text-muted-foreground">
          Forwarded SMS Text
        </label>
        <textarea
          rows={2}
          value={currentSmsBody}
          onChange={(e) => setCustomSms(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-border bg-surface-lowest p-2 font-mono text-[11px] text-foreground outline-none resize-none"
        />
      </div>

      {/* Secret Key Header */}
      <div>
        <label className="font-mono text-[9px] uppercase text-muted-foreground">
          x-webhook-secret Header
        </label>
        <input
          value={secretHeader}
          onChange={(e) => setSecretHeader(e.target.value)}
          className="mt-0.5 h-7 w-full rounded-lg border border-border bg-surface-lowest px-2 font-mono text-[10px] text-muted-foreground outline-none"
        />
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        disabled={isSending}
        onClick={handleSendWebhook}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 font-display text-xs font-bold text-slate-950 shadow-sm transition active:scale-95 disabled:opacity-50"
      >
        <Send className="size-3.5" />
        {isSending ? "Forwarding SMS to Webhook..." : "POST to /api/webhook/bank-sms"}
      </button>

      {/* Webhook Response Log */}
      {webhookLog && (
        <div className="rounded-lg border border-border bg-slate-950 p-2 font-mono text-[10px] text-emerald-400 overflow-x-auto">
          <div className="text-muted-foreground font-bold mb-1">Server Response:</div>
          <pre>{JSON.stringify(webhookLog, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function WithdrawForm({ max, onSwitchToDeposit }: { max: number; onSwitchToDeposit: () => void }) {
  const { data: player } = usePlayer();
  const isDeposited = hasPlayerDeposited(player);
  const withdraw = useWithdraw();
  const [amount, setAmount] = useState(MIN_WITHDRAW);
  const [method, setMethod] = useState<(typeof METHODS)[number]>(METHODS[0]);
  const [upiDest, setUpiDest] = useState("");

  const submit = async () => {
    if (!isDeposited) {
      toast.error("Withdrawal locked! Please complete your first deposit (Min ₹100) first.");
      onSwitchToDeposit();
      return;
    }
    if (amount < MIN_WITHDRAW) return toast.error(`Minimum withdrawal amount is ₹${MIN_WITHDRAW}`);
    if (amount > max) return toast.error(`Amount exceeds withdrawable main cash balance (₹${max})`);
    if (!upiDest || upiDest.trim().length < 4)
      return toast.error("Please enter a valid UPI ID or Phone Number");

    try {
      await withdraw.mutateAsync({ amount, method: method.toLowerCase(), note: upiDest });
      toast.success("Withdrawal request submitted — Express payout in 1-5 minutes!");
      setUpiDest("");
    } catch (e: any) {
      toast.error(e.message || "Withdrawal request failed");
    }
  };

  if (!isDeposited) {
    return (
      <div className="space-y-4 text-left">
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-[#1c1815] via-surface-low to-surface-low p-5 text-center shadow-lg">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Lock className="size-7" />
          </div>

          <span className="mt-3 inline-block rounded-full bg-amber-400/20 px-3 py-0.5 font-mono text-[10px] font-black text-amber-300 border border-amber-500/30">
            🔒 विड्रॉल अभी लॉक है / WITHDRAWAL LOCKED
          </span>

          <h2 className="mt-2 font-display text-lg font-black text-white">
            First Deposit Required to Unlock Withdrawals
          </h2>

          <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
            सुरक्षा और नियमों के अनुसार, अपना <strong>₹100 वेलकम बोनस</strong> और फास्ट 1-5 मिनट UPI
            विड्रॉल सक्रिय करने के लिए पहले कम से कम <strong>₹100 का पहला डिपॉजिट</strong> करें।
          </p>

          {/* Tier Cards Preview */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-left">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
              <span className="font-mono text-[10px] text-amber-300 font-bold">
                +18% (₹18 Free)
              </span>
              <p className="font-display font-extrabold text-white text-sm">₹100</p>
              <p className="text-[9px] text-slate-400">Basic Tier</p>
            </div>
            <div className="rounded-xl border border-amber-400 bg-amber-500/15 p-2.5 relative ring-1 ring-amber-400">
              <span className="font-mono text-[10px] text-amber-300 font-bold">
                +10% (₹50 Free)
              </span>
              <p className="font-display font-extrabold text-white text-sm">₹500</p>
              <p className="text-[9px] text-amber-200">🔥 Popular</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
              <span className="font-mono text-[10px] text-amber-300 font-bold">
                +12% (₹120 Free)
              </span>
              <p className="font-display font-extrabold text-white text-sm">₹1,000</p>
              <p className="text-[9px] text-slate-400">⚡ Best Value</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchToDeposit}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 font-display text-sm font-extrabold text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition hover:brightness-110 active:scale-95"
          >
            <span>पहले डिपॉजिट करें (Deposit Now)</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl border border-border/80 bg-surface-low p-4 shadow-md sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Zap className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                Express UPI Withdrawal
              </h2>
              <p className="text-[11px] text-muted-foreground">
                1 to 5 minutes direct bank transfer
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
            1-5 Min Speed
          </span>
        </div>

        {/* Withdrawable Balance Info */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
          <span className="font-mono text-xs text-muted-foreground">Withdrawable Main Cash:</span>
          <span className="font-display text-xl font-bold text-emerald-400">
            ₹{max.toLocaleString()}
          </span>
        </div>

        {/* Amount Input */}
        <div className="mt-3 rounded-xl border border-border bg-surface-lowest p-3">
          <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Withdraw Amount (Min ₹100)
          </label>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount || ""}
              onChange={(e) => onChangeSafeAmount(e.target.value, setAmount)}
              className="w-full bg-transparent px-2 font-mono text-xl font-extrabold text-foreground outline-none"
              placeholder="100"
            />
            <button
              type="button"
              onClick={() => setAmount(max)}
              className="rounded-lg border border-border bg-surface-high px-2 py-1 font-mono text-xs font-bold text-primary hover:bg-surface-high/80"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Quick Percent Options */}
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setAmount(Math.max(MIN_WITHDRAW, Math.floor((max * pct) / 100)))}
              className="rounded-lg border border-border bg-surface-lowest py-1.5 font-mono text-xs font-bold text-foreground transition hover:border-emerald-500/50"
            >
              {pct === 100 ? "MAX" : `${pct}%`}
            </button>
          ))}
        </div>

        {/* Payout Channel */}
        <div className="mt-4">
          <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Select Payout Channel
          </label>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl border py-2 text-xs font-bold transition ${
                  method === m
                    ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm"
                    : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* UPI ID Input */}
        <div className="mt-3">
          <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Enter Your UPI ID / Mobile VPA
          </label>
          <input
            value={upiDest}
            onChange={(e) => setUpiDest(e.target.value)}
            placeholder="e.g. yourname@paytm or 9876543210@upi"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs text-foreground outline-none transition focus:border-emerald-500"
          />
        </div>

        <button
          type="button"
          disabled={withdraw.isPending || max < MIN_WITHDRAW}
          onClick={submit}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-display text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-md transition active:scale-95 disabled:opacity-50"
        >
          <Zap className="size-4" />
          {withdraw.isPending ? "Processing..." : "Withdraw Cash (1-5 Min Express)"}
        </button>
      </div>
    </div>
  );
}

function LossBackSection() {
  const { data: player } = usePlayer();
  const { data: history } = useHistory(100);
  const claimRebate = useClaimLossRebate();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRounds = (history || []).filter(
    (r) => r.created_at && r.created_at.startsWith(todayStr),
  );
  const wagered = todayRounds.reduce((acc, r) => acc + (Number(r.bet) || 0), 0);
  const won = todayRounds.reduce((acc, r) => acc + (Number(r.payout) || 0), 0);
  const netLoss = Math.max(0, wagered - won);
  const rebateAmount = Math.max(0, Math.floor(netLoss * 0.04)); // 4% Daily Loss Rebate

  const claimedToday = player?.last_cashback_at && player.last_cashback_at.startsWith(todayStr);

  const handleClaim = async () => {
    if (rebateAmount <= 0) return toast.error("No loss cashback available to claim today");
    try {
      await claimRebate.mutateAsync(rebateAmount);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      toast.success(`+₹${rebateAmount} loss cashback credited to your Bonus Wallet!`);
    } catch {
      toast.error("Failed to claim loss cashback");
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-surface-low p-4 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <RefreshCw className="size-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">
              Daily Loss-Back (4% Rebate)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Receive 4% cashback on net daily losses into your Bonus Wallet
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
          4% DAILY
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-lowest p-2.5 text-xs font-mono">
        <div>
          <span className="text-[10px] text-muted-foreground">Today's Net Loss</span>
          <p className="font-bold text-foreground">₹{netLoss.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground">Available Cashback (4%)</span>
          <p className="font-bold text-amber-400">₹{rebateAmount}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={rebateAmount <= 0 || Boolean(claimedToday) || claimRebate.isPending}
        onClick={handleClaim}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 font-display text-xs font-bold text-slate-950 transition active:scale-95 disabled:opacity-50"
      >
        {claimedToday ? (
          <>
            <CheckCircle2 className="size-3.5" /> Today's Cashback Claimed
          </>
        ) : (
          <>
            <Gift className="size-3.5" /> Claim ₹{rebateAmount} Cashback
          </>
        )}
      </button>
    </div>
  );
}

function DirectSupportSection() {
  return (
    <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <MessageCircle className="size-4" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            24/7 Direct Human Support
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Instant help from real support agents on Telegram or WhatsApp
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href="https://t.me/baaziwin_support"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-600 font-display text-xs font-bold text-white shadow-sm transition hover:bg-sky-500 active:scale-95"
        >
          <Send className="size-3.5" /> Telegram Support
        </a>
        <a
          href="https://wa.me/919286987657?text=Hi%20BaaziWin%20Support%2C%20I%20need%20help%20with%20my%20wallet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-display text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
        >
          <MessageCircle className="size-3.5" /> WhatsApp Support
        </a>
      </div>
    </div>
  );
}

function InviteWalletBanner() {
  const { data: player } = usePlayer();
  const referralCode = player?.referral_code || "BW88888";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied!");
    } catch {
      toast.error("Failed to copy code");
    }
  };

  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-surface-low to-surface-low p-4 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Users className="size-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">
              Invite &amp; Earn ₹10 Cash
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Give ₹10, Get ₹10 for every invited friend
            </p>
          </div>
        </div>
        <Link
          to="/invite"
          className="rounded-lg bg-primary px-3 py-1 font-display text-xs font-bold text-slate-950 shadow-sm transition active:scale-95"
        >
          View Section
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface-lowest p-2 px-3 text-xs">
        <div className="min-w-0">
          <span className="font-mono text-[10px] text-muted-foreground">Your Referral Code:</span>
          <p className="font-mono text-sm font-black text-primary truncate">{referralCode}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-high px-2.5 font-display text-xs font-bold text-foreground transition active:scale-95"
        >
          <Copy className="size-3.5" /> Copy Code
        </button>
      </div>
    </div>
  );
}

function HistorySection() {
  const { data: txs } = useTransactions(40);
  const { data: history } = useHistory(40);
  const [historyTab, setHistoryTab] = useState<"tx" | "game">("tx");

  return (
    <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
      {/* History Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">Activity &amp; Records</h3>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl border border-border bg-surface-lowest p-0.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setHistoryTab("tx")}
            className={`rounded-lg px-2.5 py-1 transition ${
              historyTab === "tx"
                ? "bg-primary text-slate-950 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deposits &amp; Cashouts
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab("game")}
            className={`rounded-lg px-2.5 py-1 transition ${
              historyTab === "game"
                ? "bg-primary text-slate-950 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Wins &amp; Losses
          </button>
        </div>
      </div>

      {/* Tab 1: Deposits & Withdrawals */}
      {historyTab === "tx" && (
        <div className="mt-3">
          {!txs || txs.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No deposit or withdrawal transactions found yet.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-lowest">
              {txs.map((tx, idx) => (
                <li
                  key={`tx-${tx.id || idx}-${idx}`}
                  className="flex items-center justify-between p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground capitalize">
                      {tx.kind === "withdraw" ? "UPI Cashout" : "UPI Deposit"}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {new Date(tx.created_at).toLocaleDateString()}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-mono text-sm font-bold ${
                        tx.kind === "withdraw" ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {tx.kind === "withdraw" ? "-" : "+"}₹{tx.amount}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${
                        tx.status === "completed" || tx.status === "success"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tab 2: Wins & Losses History */}
      {historyTab === "game" && (
        <div className="mt-3">
          {!history || history.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No game round history yet. Play games to track your win/loss records!
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-lowest">
              {history.map((r: any, idx: number) => {
                const bet = Number(r.bet) || 0;
                const payout = Number(r.payout) || 0;
                const won = payout > 0;
                const net = won ? payout - bet : -bet;
                const mult = Number(r.multiplier) || (won ? payout / bet : 0);

                return (
                  <li
                    key={`history-${r.id || r.game_slug}-${idx}`}
                    className="flex items-center justify-between p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-foreground capitalize">
                          {r.game_slug ? r.game_slug.replace(/-/g, " ") : "Arcade Game"}
                        </p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          (Bet ₹{bet})
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}{" "}
                        · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`font-mono text-sm font-bold ${
                            won ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {won ? `+₹${formatCoins(payout)}` : `-₹${formatCoins(bet)}`}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] font-black uppercase ${
                            won
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {won ? `${mult.toFixed(2)}x WIN` : "LOSS"}
                        </span>
                      </div>
                      <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                        Net:{" "}
                        {net >= 0 ? `+₹${formatCoins(net)}` : `-₹${formatCoins(Math.abs(net))}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function WalletPage() {
  const search = useSearch({ from: "/wallet" });
  const { user } = useSession();
  const { data: player } = usePlayer();
  const { data: txs } = useTransactions(40);
  const [tab, setTab] = useState<"deposit" | "withdraw">(() => search.tab || "deposit");

  useEffect(() => {
    if (search.tab) {
      setTab(search.tab);
    }
  }, [search.tab]);

  const withdrawableAmount = withdrawable(player, txs);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg space-y-4 px-3 py-5 pb-24 text-center">
        {/* Dual Wallet Display */}
        <DualWalletHeader player={player} />

        {!user ? (
          <SignInGate what="deposit or withdraw coins" />
        ) : (
          <>
            {/* Deposit / Withdraw Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface-low p-1">
              <button
                type="button"
                onClick={() => setTab("deposit")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                  tab === "deposit"
                    ? "bg-primary text-slate-950 shadow-sm font-extrabold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownToLine className="size-4" /> Add Coins (Deposit)
              </button>
              <button
                type="button"
                onClick={() => setTab("withdraw")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                  tab === "withdraw"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="size-4" /> 1-5 Min UPI Withdrawal
              </button>
            </div>

            {/* Active Form */}
            {tab === "deposit" ? (
              <DepositForm />
            ) : (
              <WithdrawForm max={withdrawableAmount} onSwitchToDeposit={() => setTab("deposit")} />
            )}

            {/* Loss-Back Rebate Section */}
            <LossBackSection />

            {/* Invite & Earn Referral Banner */}
            <InviteWalletBanner />

            {/* Direct 24/7 Human Support */}
            <DirectSupportSection />

            {/* Comprehensive History: Deposits, Withdrawals, and Game Wins/Losses */}
            <HistorySection />
          </>
        )}
      </div>
    </AppShell>
  );
}
