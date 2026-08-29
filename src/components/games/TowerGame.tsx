import { useState } from "react";
import { toast } from "sonner";
import type { GameDef } from "@/lib/games";
import { formatCoins, stepMultiplier } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  game: GameDef;
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>) => Promise<void>;
};

export function TowerGame({ game, bet, balance, busy, settle }: Props) {
  const floors = Number(game.config.floors ?? 8);
  const choices = Number(game.config.choices ?? 3);
  const traps = Number(game.config.traps ?? 1);
  const risk = traps / choices;

  const [running, setRunning] = useState(false);
  const [floor, setFloor] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, { pick: number; trap: number }>>({});

  const current = floor === 0 ? 1 : stepMultiplier(floor, risk);

  const begin = () => {
    if (bet > balance) return toast.error("Not enough coins");
    playSfx("start");
    setFloor(0);
    setRevealed({});
    setRunning(true);
  };

  const pick = async (index: number) => {
    const trap = Math.floor(Math.random() * choices);
    setRevealed((r) => ({ ...r, [floor]: { pick: index, trap } }));

    if (index === trap) {
      setRunning(false);
      await settle(0, { floor: floor + 1, hitTrap: true });
      toast.error(`The crate dropped on floor ${floor + 1}`);
      return;
    }

    playSfx("step");
    const next = floor + 1;
    setFloor(next);
    if (next >= floors) {
      const m = stepMultiplier(floors, risk);
      setRunning(false);
      await settle(m, { floor: next, topped: true });
      toast.success(`Topped the tower! ${m.toFixed(2)}x`);
    }
  };

  const cashOut = async () => {
    setRunning(false);
    await settle(current, { floor, cashed: true });
    toast.success(`Banked ${current.toFixed(2)}x — +${formatCoins(bet * current)}`);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-lowest p-3">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="label-mono text-muted-foreground">
            Floor {floor} / {floors}
          </span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-primary">
            {current.toFixed(2)}x
          </span>
        </div>

        <div className="flex flex-col-reverse gap-1.5">
          {Array.from({ length: floors }, (_, f) => {
            const active = running && f === floor;
            const rev = revealed[f];
            return (
              <div key={f} className="flex items-center gap-2">
                <span className="label-mono w-12 shrink-0 text-right text-muted-foreground">
                  {stepMultiplier(f + 1, risk).toFixed(2)}x
                </span>
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {Array.from({ length: choices }, (_, c) => {
                    const isTrap = rev && rev.trap === c;
                    const isPick = rev && rev.pick === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!active || busy}
                        onClick={() => void pick(c)}
                        className={`h-10 rounded-md border text-lg transition-colors ${
                          isTrap
                            ? "border-destructive bg-destructive/25"
                            : isPick
                              ? "border-accent bg-accent/20"
                              : active
                                ? "border-primary/60 bg-surface-high hover:bg-surface-highest"
                                : "border-border bg-surface"
                        } ${active ? "" : "opacity-60"}`}
                        aria-label={`Floor ${f + 1} crate ${c + 1}`}
                      >
                        {rev ? (isTrap ? "💣" : "📦") : active ? "❓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {running ? (
        <button
          onClick={() => void cashOut()}
          disabled={busy || floor === 0}
          className="h-14 w-full rounded-xl bg-accent font-display text-lg font-bold text-accent-foreground active:scale-[0.98] disabled:opacity-40"
        >
          {floor === 0
            ? "Pick a crate to start climbing"
            : `Cash out ${formatCoins(bet * current)}`}
        </button>
      ) : (
        <button
          onClick={begin}
          disabled={busy || bet > balance}
          className="h-14 w-full rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          {bet > balance ? "Not enough coins" : `Bet ${formatCoins(bet)}`}
        </button>
      )}
    </div>
  );
}
