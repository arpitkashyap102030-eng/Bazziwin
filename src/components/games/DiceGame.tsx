import { useState } from "react";
import { toast } from "sonner";
import { formatCoins, HOUSE_EDGE } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>) => Promise<void>;
};

export function DiceGame({ bet, balance, busy, settle }: Props) {
  const [target, setTarget] = useState(50);
  const [roll, setRoll] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [rolling, setRolling] = useState(false);

  const chance = target / 100;
  const payout = Math.round((HOUSE_EDGE / chance) * 100) / 100;

  const play = async () => {
    playSfx("reveal");
    if (bet > balance) return toast.error("Not enough coins");
    setRolling(true);
    const result = Math.round(Math.random() * 10000) / 100;

    // brief suspense reel
    for (let i = 0; i < 8; i++) {
      setRoll(Math.round(Math.random() * 10000) / 100);
      await new Promise((r) => setTimeout(r, 45));
    }

    setRoll(result);
    const success = result < target;
    setWon(success);
    setRolling(false);
    await settle(success ? payout : 0, { target, roll: result });
    if (success) toast.success(`${result.toFixed(2)} < ${target} — +${formatCoins(bet * payout)}`);
    else toast.error(`${result.toFixed(2)} — no luck`);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-lowest p-4">
        <div className="grid place-items-center py-4">
          <p
            className={`font-display text-5xl font-extrabold tabular-nums ${
              won === null ? "text-foreground" : won ? "text-accent" : "text-destructive"
            }`}
          >
            {roll === null ? "00.00" : roll.toFixed(2)}
          </p>
          <p className="label-mono mt-2 text-muted-foreground">Roll under {target}.00 to win</p>
        </div>

        <div className="relative mt-4 h-3 rounded-full bg-destructive/40">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-accent"
            style={{ width: `${target}%` }}
          />
          {roll !== null && (
            <div
              className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
              style={{ left: `${roll}%` }}
              aria-hidden
            />
          )}
        </div>

        <input
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={rolling || busy}
          onChange={(e) => {
            setTarget(Number(e.target.value));
            setWon(null);
          }}
          aria-label="Win threshold"
          className="mt-4 w-full accent-[var(--color-primary)]"
        />

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Win chance" value={`${target}%`} />
          <Stat label="Payout" value={`${payout.toFixed(2)}x`} />
          <Stat label="To win" value={formatCoins(bet * payout)} />
        </div>
      </div>

      <button
        onClick={() => void play()}
        disabled={busy || rolling || bet > balance}
        className="h-14 w-full rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
      >
        {bet > balance ? "Not enough coins" : rolling ? "Rolling…" : `Roll ${formatCoins(bet)}`}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-high py-2">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
