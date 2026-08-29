import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import {
  Users,
  Copy,
  Check,
  Share2,
  Gift,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Send,
  MessageCircle,
  Award,
  Trophy,
  TrendingUp,
  Flame,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { AppShell } from "@/components/AppShell";
import { SignInGate } from "@/components/SignInGate";
import { useClaimReferral, usePlayer, useSession } from "@/lib/player";
import { playSfx } from "@/lib/sound";

interface ReferralWinRecord {
  id: string;
  name: string;
  avatar: string;
  amount: number;
  invites: number;
  timeAgo: string;
  badge?: string;
}

const TOP_REFERRAL_CHAMPIONS = [
  {
    rank: 1,
    name: "Vikram S. (Agent 01)",
    amount: 58400,
    invites: 5840,
    state: "Punjab",
    avatar: "👑",
  },
  {
    rank: 2,
    name: "Rohit K. (Super Inviter)",
    amount: 42100,
    invites: 4210,
    state: "Maharashtra",
    avatar: "🥈",
  },
  { rank: 3, name: "Amit Sharma", amount: 33800, invites: 3380, state: "Delhi", avatar: "🥉" },
  { rank: 4, name: "Pooja Verma", amount: 24500, invites: 2450, state: "Gujarat", avatar: "⭐" },
  { rank: 5, name: "Sunil Rathi", amount: 18900, invites: 1890, state: "Rajasthan", avatar: "⭐" },
];

const INITIAL_LIVE_WINS: ReferralWinRecord[] = [
  {
    id: "rw-1",
    name: "Rahul S. (98***42)",
    avatar: "👤",
    amount: 1250,
    invites: 125,
    timeAgo: "1m ago",
    badge: "Instant Payout",
  },
  {
    id: "rw-2",
    name: "Deepak M. (70***81)",
    avatar: "👤",
    amount: 450,
    invites: 45,
    timeAgo: "3m ago",
    badge: "Bonus Cash",
  },
  {
    id: "rw-3",
    name: "Ankit V. (91***19)",
    avatar: "👤",
    amount: 2100,
    invites: 210,
    timeAgo: "6m ago",
    badge: "Agent Commission",
  },
  {
    id: "rw-4",
    name: "Suresh P. (88***65)",
    avatar: "👤",
    amount: 890,
    invites: 89,
    timeAgo: "9m ago",
    badge: "Instant Payout",
  },
  {
    id: "rw-5",
    name: "Karan B. (99***03)",
    avatar: "👤",
    amount: 3400,
    invites: 340,
    timeAgo: "12m ago",
    badge: "Top Earner",
  },
  {
    id: "rw-6",
    name: "Priya N. (97***54)",
    avatar: "👤",
    amount: 620,
    invites: 62,
    timeAgo: "15m ago",
    badge: "Bonus Cash",
  },
  {
    id: "rw-7",
    name: "Manish J. (84***77)",
    avatar: "👤",
    amount: 1800,
    invites: 180,
    timeAgo: "18m ago",
    badge: "Agent Commission",
  },
];

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite Friends & Earn Real Cash — BaaziWin" },
      {
        name: "description",
        content:
          "Share your unique referral code with friends. Give ₹10, Get ₹10 instant bonus cash on every friend signup.",
      },
      { property: "og:title", content: "Invite & Earn — BaaziWin" },
      {
        property: "og:description",
        content:
          "Get ₹10 Bonus Cash + 5% turnover commission for every friend you invite to BaaziWin.",
      },
    ],
  }),
  component: InvitePage,
});

export function InvitePage() {
  const { user } = useSession();
  const { data: player } = usePlayer();
  const claim = useClaimReferral();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [activeTab, setActiveTab] = useState<"live" | "top">("live");
  const [liveWins, setLiveWins] = useState<ReferralWinRecord[]>(INITIAL_LIVE_WINS);

  const referralCode = player?.referral_code || "BW88888";
  const [shareUrl, setShareUrl] = useState(`https://baaziwin.game/?ref=${referralCode}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/?ref=${referralCode}`);
    }
  }, [referralCode]);

  const shareMessage = `🎰 Join me on BaaziWin! Use my exclusive referral code *${referralCode}* to get ₹10 Free Welcome Bonus Cash instantly! Play Aviator, Mines & Win Go Bingo 👉 ${shareUrl}`;

  // Periodically insert fresh simulated wins into live win history
  useEffect(() => {
    const NAMES = [
      "Aakash G.",
      "Manoj T.",
      "Vikas R.",
      "Sameer K.",
      "Kavita S.",
      "Naveen B.",
      "Rajesh H.",
    ];
    const AMOUNTS = [120, 350, 780, 1450, 2200, 500, 950, 3100];

    const timer = setInterval(() => {
      const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
      const randomAmt = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
      const randomInvites = Math.floor(randomAmt / 10);
      const prefix = Math.floor(70 + Math.random() * 29);
      const suffix = Math.floor(10 + Math.random() * 89);

      const newRecord: ReferralWinRecord = {
        id: `rw-${Date.now()}`,
        name: `${randomName} (${prefix}***${suffix})`,
        avatar: "👤",
        amount: randomAmt,
        invites: randomInvites,
        timeAgo: "Just now",
        badge: randomAmt > 1000 ? "Super Earner" : "Instant Payout",
      };

      setLiveWins((prev) => [newRecord, ...prev.slice(0, 8)]);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      playSfx("click");
      toast.success("Referral code copied to clipboard!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Could not copy referral code");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      playSfx("click");
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy invite link");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join BaaziWin & Get ₹10 Bonus Cash",
          text: `Use my referral code ${referralCode} to claim ₹10 Free Cash on BaaziWin!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  const handleApplyFriendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return toast.error("Please enter a referral code");
    try {
      await claim.mutateAsync(inputCode);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      playSfx("win");
      toast.success("Referral code applied! +₹10 Bonus Cash added to your Bonus Wallet!");
      setInputCode("");
    } catch (err: any) {
      playSfx("error");
      toast.error(err?.message || "Failed to apply referral code");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg space-y-4 px-3 py-5 pb-24 text-center">
        {/* Header Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Gift className="size-3.5" /> Refer &amp; Earn Unlimited Cash
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Invite Friends, Get <span className="text-primary">₹10 Free</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Share your unique code. When your friend registers, you both get ₹10 Bonus Cash
            instantly.
          </p>
        </div>

        {!user && <SignInGate what="view your unique referral code and track referral rewards" />}

        {/* Unique Referral Code Card */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-surface-low p-5 shadow-lg">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 20%, var(--glow-primary), transparent 70%)",
            }}
          />

          <div className="relative space-y-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Your Unique Referral Code
            </span>

            {/* Glowing Big Code Box */}
            <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-primary/50 bg-surface-lowest px-4 py-3 shadow-inner">
              <span className="select-all font-mono text-2xl font-black tracking-widest text-primary sm:text-3xl">
                {referralCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-display text-xs font-black uppercase text-slate-950 shadow-sm transition hover:scale-105 active:scale-95"
              >
                {copiedCode ? (
                  <>
                    <Check className="size-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy Code
                  </>
                )}
              </button>
            </div>

            {/* Direct Invite Link Box */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-lowest p-1.5 pl-3">
              <span className="truncate font-mono text-xs text-muted-foreground text-left flex-1">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-high px-2.5 text-xs font-bold text-foreground transition hover:bg-surface-highest active:scale-95"
              >
                {copiedLink ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedLink ? "Copied" : "Copy Link"}
              </button>
            </div>

            {/* Social Share Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 font-display text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
                  `🎰 Join BaaziWin! Use code ${referralCode} for ₹10 instant bonus cash!`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-600 font-display text-xs font-bold text-white shadow-sm transition hover:bg-sky-500 active:scale-95"
              >
                <Send className="size-4" /> Telegram
              </a>

              <button
                type="button"
                onClick={handleNativeShare}
                className="col-span-2 sm:col-span-1 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-high font-display text-xs font-bold text-foreground transition hover:bg-surface-highest active:scale-95"
              >
                <Share2 className="size-4 text-primary" /> More Options
              </button>
            </div>
          </div>
        </div>

        {/* Live Referral Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 text-primary" />
              <span className="font-mono text-[10px] font-bold uppercase">Friends Invited</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-black text-foreground">
              {player?.referral_count ?? 0}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Total signups with your code</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="size-4 text-amber-400" />
              <span className="font-mono text-[10px] font-bold uppercase">Bonus Earned</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-black text-amber-400">
              ₹{(player?.referral_earnings ?? 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Credited to Bonus Wallet</p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* REFERRAL WINNING HISTORY & TOP CHAMPIONS SECTION */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-md space-y-3">
          {/* Top Banner Stats */}
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
                <Trophy className="size-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-black text-foreground">
                  Referral Winning History
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Live verified payouts to our player community
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>₹9,48,200+ Paid</span>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="flex rounded-xl bg-surface-lowest p-1 border border-border">
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveTab("live");
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-display text-xs font-bold transition ${
                activeTab === "live"
                  ? "bg-primary text-slate-950 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flame className="size-3.5" /> Live Recent Wins
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveTab("top");
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-display text-xs font-bold transition ${
                activeTab === "top"
                  ? "bg-primary text-slate-950 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="size-3.5" /> Top Agents (All Time)
            </button>
          </div>

          {/* Tab 1: Live Recent Wins */}
          {activeTab === "live" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-muted-foreground px-1">
                <span>User / Mobile</span>
                <span>Reward Won</span>
              </div>

              <div className="divide-y divide-border/60 rounded-xl bg-surface-lowest border border-border overflow-hidden">
                {liveWins.map((win, idx) => (
                  <div
                    key={win.id}
                    className={`flex items-center justify-between p-2.5 transition ${
                      idx === 0 ? "bg-primary/5" : "hover:bg-surface-high/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-high text-xs font-bold text-foreground">
                        {win.avatar}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-mono text-xs font-bold text-foreground">
                            {win.name}
                          </p>
                          {win.badge && (
                            <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-400">
                              {win.badge}
                            </span>
                          )}
                        </div>
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" /> {win.timeAgo} · {win.invites} active
                          referrals
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-black text-emerald-400">
                        +₹{win.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Top Referrers Leaderboard */}
          {activeTab === "top" && (
            <div className="space-y-1.5">
              <div className="divide-y divide-border/60 rounded-xl bg-surface-lowest border border-border overflow-hidden">
                {TOP_REFERRAL_CHAMPIONS.map((champ) => (
                  <div
                    key={`champ-${champ.rank}`}
                    className="flex items-center justify-between p-2.5 hover:bg-surface-high/50 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-black ${
                          champ.rank === 1
                            ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300"
                            : champ.rank === 2
                              ? "bg-slate-300 text-slate-950"
                              : champ.rank === 3
                                ? "bg-amber-700 text-white"
                                : "bg-surface-high text-muted-foreground"
                        }`}
                      >
                        {champ.rank}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="truncate font-display text-xs font-bold text-foreground">
                          {champ.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {champ.invites.toLocaleString()} Friends Invited · {champ.state}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-black text-amber-400">
                        ₹{champ.amount.toLocaleString()}
                      </span>
                      <p className="text-[9px] font-mono text-muted-foreground">Total Paid</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Enter Friend's Code Section */}
        <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Award className="size-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                Have a Friend's Referral Code?
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Enter their code to get instant ₹10 Bonus Cash in your wallet
              </p>
            </div>
          </div>

          {player?.referred_by ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              <span className="text-muted-foreground">Referred by friend:</span>
              <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> {player.referred_by}
              </span>
            </div>
          ) : (
            <form onSubmit={handleApplyFriendCode} className="mt-3 flex gap-2">
              <input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. BW9X2K4"
                maxLength={12}
                className="h-11 flex-1 rounded-xl border border-border bg-surface-lowest px-3 font-mono text-xs uppercase tracking-wider text-foreground outline-none transition focus:border-primary"
              />
              <button
                type="submit"
                disabled={claim.isPending || !inputCode.trim()}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 font-display text-xs font-bold text-slate-950 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {claim.isPending ? "Applying..." : "Claim ₹10"}
              </button>
            </form>
          )}
        </div>

        {/* How It Works (3 Steps) */}
        <div className="rounded-2xl border border-border bg-surface-low p-4 text-left shadow-sm">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> How Referral Program Works
          </h3>

          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                1
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">Share your code</p>
                <p className="text-muted-foreground">
                  Send your unique referral code or direct link to your friends on WhatsApp or
                  Telegram.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                2
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">Friend signs up &amp; claims</p>
                <p className="text-muted-foreground">
                  Your friend enters your code and gets ₹10 instant Welcome Bonus Cash.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                3
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">You receive ₹10 + Commissions</p>
                <p className="text-muted-foreground">
                  ₹10 Bonus Cash is credited directly to your Bonus Wallet with no maximum invite
                  limit!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fair Terms */}
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface-lowest p-3 text-left text-[11px] text-muted-foreground">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>
            Referral bonus is 100% usable to play all games. Multiple accounts from identical
            devices or IPs are prohibited.
          </span>
        </div>
      </div>
    </AppShell>
  );
}
