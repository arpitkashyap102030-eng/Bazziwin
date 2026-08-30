import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Coins, Flame, Trophy, LockKeyhole, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CATEGORIES, GAMES, formatCoins, type Category } from "@/lib/games";
import { usePlayer, usePublicWins, useSession } from "@/lib/player";
import { GameImage } from "@/components/GameImage";
import { HeroBannerCarousel } from "@/components/HeroBannerCarousel";
import heroCoins from "@/assets/hero-bonus-coins.png";
import inviteFriends from "@/assets/invite-friends.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BaaziWin — Play Crash, Mines & Skill Games" },
      {
        name: "description",
        content:
          "Play Aviator, Chicken Road 2, Tower Rush, Mines, JetX, CricketX and more on BaaziWin. Virtual coins only — no real money, pure skill entertainment.",
      },
      { property: "og:title", content: "BaaziWin — Play Crash, Mines & Skill Games" },
      {
        property: "og:description",
        content:
          "Thrilling arcade titles, instant welcome bonus, and live tournaments on BaaziWin.",
      },
    ],
  }),
  component: Home,
});

function JackpotCounter() {
  const [pot, setPot] = useState(3127798);
  useEffect(() => {
    const t = setInterval(() => setPot((p) => p + Math.floor(Math.random() * 9) + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const digits = String(pot).padStart(7, "0").split("");

  return (
    <div className="relative flex flex-[1.4] min-w-0 flex-col overflow-hidden rounded-xl border border-primary/30 bg-surface-high p-2.5">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 0%, var(--glow-primary), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-1">
        <Trophy className="size-3 shrink-0 text-primary" aria-hidden />
        <span className="label-mono truncate text-[9px] text-primary">Daily jackpot</span>
      </div>
      <div className="relative mt-2 flex items-center justify-center gap-[2px]">
        {digits.map((d, i) => (
          <span
            key={i}
            className="animate-tick rounded-[3px] bg-gradient-to-b from-foreground to-muted-foreground px-1 py-1 font-mono text-[13px] font-bold leading-none text-background"
          >
            {d}
          </span>
        ))}
      </div>
      <p className="relative mt-2 truncate text-center text-[9px] text-muted-foreground">
        Pool resets at midnight
      </p>
    </div>
  );
}

function Countdown() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    const tick = () => {
      const s = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
      setLeft(
        `${String(Math.floor(s / 3600)).padStart(2, "0")}h : ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m : ${String(s % 60).padStart(2, "0")}s`,
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{left}</span>;
}

function Home() {
  const { user } = useSession();
  const { data: player } = usePlayer();
  const { data: wins } = usePublicWins();
  const [cat, setCat] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only show wins for titles that actually exist in the catalogue.
  const liveWins = mounted
    ? (wins || []).filter((w) => GAMES.some((g) => g.slug === w.game_slug))
    : [];

  const list = cat === "all" ? GAMES : GAMES.filter((g) => g.categories.includes(cat as any));

  const allCategoryTabs = [{ id: "all", label: "All Games", icon: "✨" }, ...CATEGORIES];

  return (
    <AppShell>
      <h1 className="sr-only">BaaziWin — play crash, mines, roulette and skill games</h1>

      {/* Hero Banner Carousel */}
      <section className="px-3 pt-4">
        <HeroBannerCarousel user={user} />
      </section>

      {/* Pots */}
      <section className="mt-5 flex gap-2 px-3">
        <Link
          to={user ? "/wallet" : "/auth"}
          search={user ? undefined : { mode: "in" as const }}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent/30 bg-surface-high p-2.5 active:scale-[0.98]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 0%, var(--glow-accent), transparent 60%)",
            }}
          />
          <div className="relative flex items-center gap-1">
            <Coins className="size-3 shrink-0 text-accent" aria-hidden />
            <span className="label-mono truncate text-[9px] text-accent">Your coins</span>
          </div>
          {user ? (
            <>
              <p className="relative mt-2 truncate text-center font-mono text-xl font-bold tabular-nums text-accent">
                {player ? formatCoins(player.balance) : "—"}
              </p>
              <div className="relative mt-2 flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                <Clock className="size-2.5 shrink-0" aria-hidden />
                <Countdown />
              </div>
            </>
          ) : (
            <>
              <p className="relative mt-2 flex items-center justify-center gap-1 text-center font-display text-sm font-bold text-accent">
                <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
                Locked
              </p>
              <p className="relative mt-2 truncate text-center text-[9px] text-muted-foreground">
                Sign in to view balance
              </p>
            </>
          )}
        </Link>
        <JackpotCounter />
      </section>

      {/* Invite & Earn Banner */}
      <section className="mt-4 px-3">
        <Link
          to={user ? "/invite" : "/auth"}
          search={user ? undefined : { mode: "up" as const }}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 via-surface-high to-surface-high p-3 shadow-sm transition active:scale-[0.98] hover:border-primary/60"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle at 0% 50%, var(--glow-primary), transparent 60%)",
            }}
          />
          <img
            src={inviteFriends}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="relative size-14 shrink-0 object-contain drop-shadow-md"
          />
          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-sm font-black uppercase tracking-wide text-primary">
                Invite &amp; Earn
              </span>
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                +₹10 per friend
              </span>
            </div>
            {user ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Your code:{" "}
                <span className="font-mono text-xs font-bold text-foreground">
                  {player?.referral_code || "——————"}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Sign up to unlock your invite code
              </p>
            )}
          </div>
          <div className="relative flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground">
            {user ? "Share" : "Start"} <ArrowRight className="size-3.5" />
          </div>
        </Link>
      </section>

      {/* Colour Trading spotlight */}
      <section className="mt-6 px-3">
        <Link
          to="/game/$slug"
          params={{ slug: "color-trading" }}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-accent/40 bg-accent/10 p-3 active:scale-[0.98]"
        >
          <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-border">
            <GameImage
              src={GAMES.find((g) => g.slug === "color-trading")?.image}
              alt="Colour Trading"
              icon="🟢"
              fallbackTitle="Colour Trading"
              className="size-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <span className="label-mono rounded-full bg-emerald-500 px-2 py-0.5 text-slate-950 font-bold">
              Live now · 30s
            </span>
            <h2 className="mt-1 font-display text-lg font-bold">Win Go Bingo</h2>
            <p className="truncate text-xs text-muted-foreground">
              Jalwa Win Go 30s/1m/3m/5m — Colors, Numbers &amp; Big/Small.
            </p>
          </div>
        </Link>
      </section>

      {/* Recent wins */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-primary animate-pulse" aria-hidden />
            <h2 className="font-display text-lg font-bold">Recent Big Wins</h2>
          </div>
          <span className="label-mono text-[10px] text-emerald-400">🔥 High Multipliers</span>
        </div>
        {liveWins.length > 0 ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-2">
            {liveWins.map((w, idx) => {
              const g = GAMES.find((x) => x.slug === w.game_slug)!;
              return (
                <Link
                  key={`win-${w.id || idx}-${idx}`}
                  to="/game/$slug"
                  params={{ slug: w.game_slug }}
                  className="w-24 shrink-0 text-center group active:scale-95 transition"
                >
                  <div className="relative mb-1.5 size-24 overflow-hidden rounded-xl border border-border bg-surface-high shadow-sm group-hover:border-primary/50 transition">
                    <GameImage
                      src={g.image}
                      alt={g.name}
                      icon={String(g.config?.icon || "🎮")}
                      fallbackTitle={g.name}
                      className="size-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-1">
                      <span className="block truncate text-[9px] font-bold text-white">
                        {g.name}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md bg-primary/10 border border-primary/20 px-1 py-0.5">
                    <p className="font-mono text-xs font-black text-primary">
                      {Number(w.multiplier).toFixed(1)}x
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground font-medium">
                    {w.masked_player}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="px-3 text-sm text-muted-foreground">
            No big wins yet today — be the first on the board.
          </p>
        )}
      </section>

      {/* Category tabs */}
      <section className="mt-6 border-b border-border">
        <div className="no-scrollbar flex items-center justify-around overflow-x-auto px-3 py-3">
          {allCategoryTabs.map((c) => {
            const active = c.id === cat;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`relative flex shrink-0 flex-col items-center gap-1.5 px-3 ${
                  active ? "text-primary" : "text-muted-foreground opacity-70"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {c.icon}
                </span>
                <span className="label-mono">{c.label}</span>
                {active && (
                  <span className="absolute -bottom-2 h-[3px] w-3/5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <section className="mt-6 px-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold capitalize">
            {cat === "all" ? "All Games" : cat}: <span className="text-primary">{list.length}</span>
          </h2>
          <Link
            to="/explore"
            className="label-mono rounded-lg bg-surface-high px-4 py-2 text-muted-foreground"
          >
            More →
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing in this category yet. Try Crash or Table.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {list.map((g) => (
              <GameTile key={g.slug} slug={g.slug} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 px-4 pb-6 text-center text-xs leading-relaxed text-muted-foreground">
        BaaziWin is an entertainment gaming hub. Coins have no monetary value, cannot be purchased
        with real money, and cannot be exchanged for money or prizes.
      </p>
    </AppShell>
  );
}

export function GameTile({ slug }: { slug: string; key?: string }) {
  const g = GAMES.find((x) => x.slug === slug);
  if (!g) return null;
  const is3D = ["roulette3d", "horseracing3d", "plinko3d"].includes(g.engine);

  return (
    <Link
      to="/game/$slug"
      params={{ slug: g.slug }}
      className="flex flex-col active:scale-95 group"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-high group-hover:border-primary/50 transition shadow-sm">
        <GameImage
          src={g.image}
          alt={g.name}
          icon={String(g.config?.icon || "🎮")}
          fallbackTitle={g.name}
          className="size-full object-cover group-hover:scale-105 transition duration-300"
        />
        {/* Top 3D Badge if 3D */}
        {is3D && (
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
            <span className="rounded bg-gradient-to-r from-amber-500 to-red-600 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-white shadow-md">
              3D
            </span>
          </div>
        )}

        {/* Bottom Banner with clean game name */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-1.5 pt-4">
          <span className="block truncate text-[11px] font-black tracking-tight text-white drop-shadow-sm">
            {g.name}
          </span>
        </div>
      </div>
    </Link>
  );
}
