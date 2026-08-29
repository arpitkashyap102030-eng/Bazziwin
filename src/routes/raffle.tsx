import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Ticket,
  Copy,
  Share2,
  Gift,
  Users,
  Trophy,
  Crown,
  Flame,
  ShieldCheck,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SignInGate } from "@/components/SignInGate";
import {
  useClaimReferral,
  useHistory,
  usePlayer,
  usePublicWins,
  useReferralCode,
  useSession,
} from "@/lib/player";
import { getGame, formatCoins } from "@/lib/games";

export const Route = createFileRoute("/raffle")({
  head: () => ({
    meta: [
      { title: "Referrals & Daily Tournaments — BaaziWin" },
      {
        name: "description",
        content:
          "Invite friends to earn bonus cash + lifetime turnover commission, and compete in the daily ₹1,000 cash tournament on BaaziWin.",
      },
      { property: "og:title", content: "Referrals & Daily Tournaments — BaaziWin" },
      {
        property: "og:description",
        content: "Earn referral bonuses and win from the daily leaderboard prize pool on BaaziWin.",
      },
    ],
  }),
  component: RaffleTournamentHub,
});

// Daily Tournament Mock & Live Ranking calculation
const TOURNAMENT_PRIZES = [
  { rank: 1, prize: "₹350", badge: "🥇 1st Place" },
  { rank: 2, prize: "₹200", badge: "🥈 2nd Place" },
  { rank: 3, prize: "₹150", badge: "🥉 3rd Place" },
  { rank: 4, prize: "₹75", badge: "4th" },
  { rank: 5, prize: "₹75", badge: "5th" },
  { rank: 6, prize: "₹30", badge: "6th" },
  { rank: 7, prize: "₹30", badge: "7th" },
  { rank: 8, prize: "₹30", badge: "8th" },
  { rank: 9, prize: "₹30", badge: "9th" },
  { rank: 10, prize: "₹30", badge: "10th" },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: "SkyWalker_99", avatar: "🚀", turnover: 28450, prize: "₹350" },
  { rank: 2, name: "Kolkata_Rider", avatar: "⚡", turnover: 19800, prize: "₹200" },
  { rank: 3, name: "Aviator_King", avatar: "👑", turnover: 16200, prize: "₹150" },
  { rank: 4, name: "MinesPro_77", avatar: "💎", turnover: 11400, prize: "₹75" },
  { rank: 5, name: "TigerBet_01", avatar: "🐯", turnover: 9650, prize: "₹75" },
  { rank: 6, name: "DesiTrader", avatar: "🔥", turnover: 7800, prize: "₹30" },
  { rank: 7, name: "LuckySpin_8", avatar: "🎯", turnover: 6450, prize: "₹30" },
  { rank: 8, name: "GoRush_Hero", avatar: "🦅", turnover: 5120, prize: "₹30" },
  { rank: 9, name: "ColorMaster", avatar: "🎨", turnover: 4300, prize: "₹30" },
  { rank: 10, name: "Vortex_Guru", avatar: "🐺", turnover: 3950, prize: "₹30" },
];

function ReferralCard() {
  const { data: player } = usePlayer();
  const { data: code } = useReferralCode();

  const refCode = code || player?.referral_code || "BAAZIWIN";
  const [link, setLink] = useState(`https://baaziwin.game/?ref=${refCode}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLink(`${window.location.origin}/?ref=${refCode}`);
    }
  }, [refCode]);

  const shareWhatsApp = () => {
    const text = `Play & Win on BaaziWin! Sign up with my link and get ₹10 instant bonus cash: ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareTelegram = () => {
    const text = `BaaziWin: Fast UPI Withdrawals & 90% RTP Games. Sign up for ₹10 Bonus Cash: ${link}`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      "_blank",
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-surface-low p-4 text-left shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 20%, var(--glow-primary), transparent 60%)",
        }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-slate-950 shadow-md">
            <Gift className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-black tracking-tight text-foreground">
              Refer &amp; Earn
            </h2>
            <p className="text-xs text-muted-foreground">
              Lifetime turnover commission &amp; cash bonuses
            </p>
          </div>
        </div>
        <span className="rounded-full bg-primary/20 border border-primary/40 px-3 py-1 font-mono text-xs font-black text-primary shadow-xs">
          0.5% - 1.0% Commission
        </span>
      </div>

      {/* Clear, Prominent 3-Tier Reward Breakdown */}
      <div className="relative mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-lowest p-3 text-center">
        <div className="flex flex-col items-center justify-center p-1">
          <span className="font-display text-xs font-extrabold text-foreground">Refer Bonus</span>
          <p className="my-1 font-mono text-xl font-black text-amber-400">₹20</p>
          <span className="text-[11px] font-bold text-muted-foreground leading-tight">
            Per Active Deposit
          </span>
        </div>
        <div className="flex flex-col items-center justify-center border-x border-border/80 p-1">
          <span className="font-display text-xs font-extrabold text-foreground">Refer Bonus</span>
          <p className="my-1 font-mono text-xl font-black text-emerald-400">₹10</p>
          <span className="text-[11px] font-bold text-muted-foreground leading-tight">
            On Sign Up
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-1">
          <span className="font-display text-xs font-extrabold text-foreground">
            Turnover Share
          </span>
          <p className="my-1 font-mono text-xl font-black text-primary">1.0%</p>
          <span className="text-[11px] font-bold text-muted-foreground leading-tight">
            Lifetime Commission
          </span>
        </div>
      </div>

      {/* Referral Code & Copy */}
      <div className="relative mt-3 rounded-xl border border-border bg-surface-lowest p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
            Your Referral Code
          </span>
          <span className="font-mono text-base font-black tracking-widest text-primary">
            {refCode}
          </span>
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Your referral link"
            className="h-10 flex-1 truncate rounded-lg border border-border bg-surface-high px-3 font-mono text-xs text-muted-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Referral link copied to clipboard!");
            }}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-high px-4 text-xs font-bold transition hover:bg-surface-high/80 active:scale-95"
          >
            <Copy className="size-4" /> Copy
          </button>
        </div>
      </div>

      {/* Share Buttons (WhatsApp / Telegram) */}
      <div className="relative mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-display text-xs font-bold text-white shadow-md transition hover:bg-emerald-500 active:scale-95"
        >
          <Share2 className="size-4" /> WhatsApp Share
        </button>
        <button
          type="button"
          onClick={shareTelegram}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 font-display text-xs font-bold text-white shadow-md transition hover:bg-sky-500 active:scale-95"
        >
          <Share2 className="size-4" /> Telegram Share
        </button>
      </div>

      {/* Referral Stats */}
      <div className="relative mt-3.5 flex items-center justify-between rounded-lg bg-surface-lowest/70 px-3 py-2 text-xs text-muted-foreground border border-border/50">
        <span className="flex items-center gap-1.5 font-medium">
          <Users className="size-4 text-primary" />
          <strong className="text-foreground font-mono">{player?.referral_count ?? 0}</strong>{" "}
          Friends Invited
        </span>
        <span className="font-mono text-xs font-bold text-foreground">
          Total Earned:{" "}
          <span className="font-mono text-primary font-black text-sm">
            ₹{player?.referral_earnings ?? 0}
          </span>
        </span>
      </div>
    </div>
  );
}

function RedeemCard() {
  const { data: player } = usePlayer();
  const claim = useClaimReferral();
  const [code, setCode] = useState("");

  if (player?.referred_by) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-surface-low to-emerald-950/20 p-4 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-emerald-300">
                Refer Welcome Bonus Claimed
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-400">
                ₹10 CASH
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your ₹10 sign-up welcome bonus is credited to your bonus wallet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            Have a Friend's Referral Code?
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter code to receive instant ₹10 welcome bonus cash
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
          +₹10 Bonus
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. REF1234"
          className="h-11 flex-1 rounded-xl border border-border bg-surface-lowest px-3.5 font-mono text-xs uppercase tracking-widest text-foreground outline-none transition focus:border-primary"
        />
        <button
          type="button"
          disabled={!code || claim.isPending}
          onClick={() =>
            claim
              .mutateAsync(code.trim())
              .then(() => toast.success("₹10 Bonus Cash added to your Bonus Wallet!"))
              .catch((e: Error) => toast.error(e.message))
          }
          className="h-11 rounded-xl bg-primary px-5 font-display text-xs font-bold text-slate-950 shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          {claim.isPending ? "..." : "Redeem"}
        </button>
      </div>
    </div>
  );
}

function DailyTournamentSection() {
  const { data: player } = usePlayer();
  const todayTurnover = player?.total_wagered || 0;

  return (
    <div className="mt-6 text-left">
      {/* Tournament Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Trophy className="size-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-foreground">
              Daily Leaderboard Tournament
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Top 10 players share daily cash pool
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-black text-amber-400">
          <Crown className="size-3.5" /> ₹1,000 Pool
        </div>
      </div>

      {/* User Current Standing */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{player?.avatar || "🐯"}</span>
          <div>
            <p className="font-display text-xs font-bold text-foreground">
              {player?.username || "You"}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              Today's Turnover: <span className="font-bold text-primary">₹{todayTurnover}</span>
            </p>
          </div>
        </div>
        <span className="rounded-lg border border-border bg-surface-high px-2.5 py-1 font-mono text-xs font-bold text-foreground">
          Rank: #12
        </span>
      </div>

      {/* Leaderboard Table */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface-low shadow-sm">
        <div className="flex items-center justify-between border-b border-border/80 bg-surface-high/60 px-3.5 py-2 font-mono text-[10px] uppercase text-muted-foreground">
          <span>Player</span>
          <div className="flex items-center gap-6">
            <span>Turnover</span>
            <span>Prize</span>
          </div>
        </div>

        <ul className="divide-y divide-border/60">
          {MOCK_LEADERBOARD.map((p, idx) => (
            <li
              key={p.rank}
              className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition ${
                idx < 3 ? "bg-surface-low hover:bg-surface-high/50" : "hover:bg-surface-high/30"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-black ${
                    idx === 0
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : idx === 1
                        ? "bg-slate-300 text-slate-950"
                        : idx === 2
                          ? "bg-amber-700 text-white"
                          : "bg-surface-high text-muted-foreground"
                  }`}
                >
                  {p.rank}
                </span>
                <span className="text-sm">{p.avatar}</span>
                <span className="truncate font-display text-xs font-bold text-foreground">
                  {p.name}
                </span>
              </div>

              <div className="flex items-center gap-6 text-right">
                <span className="font-mono text-xs text-muted-foreground">
                  ₹{p.turnover.toLocaleString()}
                </span>
                <span
                  className={`min-w-[50px] font-mono text-xs font-black ${
                    idx === 0
                      ? "text-amber-400"
                      : idx === 1
                        ? "text-slate-200"
                        : idx === 2
                          ? "text-amber-500"
                          : "text-primary"
                  }`}
                >
                  {p.prize}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 font-mono text-[10px]">
          <Clock className="size-3 text-muted-foreground" />
          Tournament resets daily at 12:00 AM midnight
        </span>
        <span className="font-mono text-[10px] font-bold text-emerald-400">
          100% Guaranteed Payout
        </span>
      </div>
    </div>
  );
}

function RaffleTournamentHub() {
  const { user } = useSession();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-3 py-5 pb-24 text-center">
        <div className="text-left">
          <h1 className="font-display text-2xl font-black text-foreground">
            Refer &amp; Tournaments
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Invite friends to earn lifetime commission and compete in daily tournaments
          </p>
        </div>

        {!user ? (
          <div className="mt-4">
            <SignInGate what="access referrals & tournament leaderboards" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <ReferralCard />
            <RedeemCard />
            <DailyTournamentSection />
          </div>
        )}
      </div>
    </AppShell>
  );
}
