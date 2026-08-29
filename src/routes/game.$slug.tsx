import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { BetPanel } from "@/components/BetPanel";
import { FirstDepositModal } from "@/components/FirstDepositModal";
import { CrashGame } from "@/components/games/CrashGame";
import { RoadGame } from "@/components/games/RoadGame";
import { TowerGame } from "@/components/games/TowerGame";
import { MinesGame } from "@/components/games/MinesGame";
import { DiceGame } from "@/components/games/DiceGame";
import { ColorGame } from "@/components/games/ColorGame";
import { ImmersiveRoulette3D } from "@/components/games/ImmersiveRoulette3D";
import { Blackjack3D } from "@/components/games/Blackjack3D";
import { VirtualHorseRacing3D } from "@/components/games/VirtualHorseRacing3D";
import { Plinko3D } from "@/components/games/Plinko3D";
import { AndarBaharGame } from "@/components/games/AndarBaharGame";
import { GameImage } from "@/components/GameImage";
import { GAMES, getGame, formatCoins } from "@/lib/games";
import { usePlayRound, usePlayer, useSession, useHistory, hasPlayerDeposited } from "@/lib/player";
import { playResult, playSfx } from "@/lib/sound";

export const Route = createFileRoute("/game/$slug")({
  loader: ({ params }) => {
    const game = getGame(params.slug);
    if (!game) throw notFound();
    return { name: game.name, tagline: game.tagline, studio: game.studio };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Play on BaaziWin` },
          {
            name: "description",
            content: `${loaderData.tagline} Play with virtual coins on BaaziWin.`,
          },
          { property: "og:title", content: `${loaderData.name} — BaaziWin` },
          { property: "og:description", content: loaderData.tagline },
        ]
      : [],
  }),
  component: GamePage,
});

function GamePage() {
  const { slug } = Route.useParams();
  const game = getGame(slug)!;
  const { user } = useSession();
  const { data: player } = usePlayer();
  const play = usePlayRound();
  const { data: history } = useHistory(8);
  const [bet, setBet] = useState(50);
  const [cooldown, setCooldown] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const timer = useRef<number | null>(null);

  const isDeposited = hasPlayerDeposited(player);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const startCooldown = () => {
    if (game.engine === "crash") return;
    setCooldown(2);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) {
          window.clearInterval(timer.current);
          timer.current = null;
        }
        return Math.max(0, c - 1);
      });
    }, 1000);
  };

  const balance = player?.balance ?? 100;

  const settle = async (multiplier: number, details: Record<string, unknown>, stake?: number) => {
    if (!isDeposited) {
      setShowDepositModal(true);
      return;
    }
    try {
      await play.mutateAsync({ game: slug, bet: stake ?? bet, multiplier, details });
      startCooldown();
      playResult(multiplier);
    } catch (err: any) {
      if (err?.message?.includes("FIRST_DEPOSIT_REQUIRED")) {
        setShowDepositModal(true);
        return;
      }
      playSfx("error");
      toast.error(err instanceof Error ? err.message : "Round could not be recorded");
    }
  };

  const engineProps = {
    bet,
    balance,
    busy: play.isPending || cooldown > 0,
    settle,
    isDeposited,
    onRequireDeposit: () => setShowDepositModal(true),
  };
  const related = GAMES.filter((g) => g.slug !== slug).slice(0, 6);

  return (
    <AppShell>
      <div className="px-2 py-3">
        {/* First Deposit Modal (Appears only when user places a bet without depositing) */}
        <FirstDepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          gameTitle={game.name}
        />

        {/* Game Header Bar */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-low p-2">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 90% 10%, var(--glow-primary), transparent 55%)",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <Link
              to="/"
              aria-label="Back to lobby"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground active:scale-95"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-border">
              <GameImage
                src={game.image}
                alt={game.name}
                icon={String(game.config?.icon || "🎮")}
                fallbackTitle={game.name}
                className="size-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-base font-extrabold text-foreground">
                {game.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Game Engine Stage */}
        <div className="mt-2 space-y-2">
          {game.engine === "crash" && <CrashGame game={game} {...engineProps} />}
          {game.engine === "road" && <RoadGame game={game} {...engineProps} />}
          {game.engine === "tower" && <TowerGame game={game} {...engineProps} />}
          {game.engine === "mines" && <MinesGame {...engineProps} />}
          {game.engine === "dice" && <DiceGame {...engineProps} />}
          {game.engine === "color" && <ColorGame {...engineProps} />}
          {game.engine === "roulette3d" && <ImmersiveRoulette3D {...engineProps} />}
          {game.engine === "blackjack3d" && <Blackjack3D {...engineProps} />}
          {game.engine === "horseracing3d" && <VirtualHorseRacing3D {...engineProps} />}
          {game.engine === "plinko3d" && <Plinko3D {...engineProps} />}
          {game.engine === "andarbahar" && <AndarBaharGame game={game} {...engineProps} />}

          {cooldown > 0 && (
            <p className="label-mono rounded-lg border border-border bg-surface-high py-2 text-center text-muted-foreground animate-pulse">
              Next round in {cooldown}s…
            </p>
          )}

          {["tower", "dice", "plinko3d"].includes(game.engine) && (
            <BetPanel bet={bet} onBet={setBet} balance={balance} disabled={play.isPending} />
          )}
        </div>

        {/* Guest prompt (if not signed in with Firebase) */}
        {!user && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/10 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-primary shrink-0" />
              <p className="text-xs text-foreground truncate">
                Playing as Guest. Sign in to save progress!
              </p>
            </div>
            <Link
              to="/auth"
              search={{ mode: "up" }}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-95"
            >
              Sign up
            </Link>
          </div>
        )}

        {/* Player's recent rounds */}
        {history && history.length > 0 && (
          <section className="mt-6">
            <h2 className="label-mono mb-2 text-muted-foreground">Recent rounds</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-low">
              {history.map((h, i) => (
                <li key={h.id || i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate text-xs text-muted-foreground">
                    {getGame(h.game_slug)?.name ?? h.game_slug}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      Number(h.payout) > Number(h.bet) ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {Number(h.payout) > 0 ? "+" : ""}
                    {formatCoins(Number(h.payout) - Number(h.bet))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related Games */}
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold">More games</h2>
          <div className="grid grid-cols-3 gap-2">
            {related.map((g) => (
              <Link
                key={g.slug}
                to="/game/$slug"
                params={{ slug: g.slug }}
                className="flex flex-col active:scale-95 transition-transform"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-high">
                  <GameImage
                    src={g.image}
                    alt={g.name}
                    icon={String(g.config?.icon || "🎮")}
                    fallbackTitle={g.name}
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 py-0.5 font-mono text-[9px] font-bold text-accent">
                    {g.engine}
                  </span>
                </div>
                <span className="mt-1 truncate text-xs font-semibold">{g.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
