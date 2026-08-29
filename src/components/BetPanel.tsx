import { Minus, Plus } from "lucide-react";
import { formatMoney } from "@/lib/games";

const CHIPS = [10, 20, 50, 100, 200, 500, 1000];

export function BetPanel({
  bet,
  onBet,
  balance,
  disabled,
}: {
  bet: number;
  onBet: (n: number) => void;
  balance: number;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(10, Math.min(100000, Math.round(n)));

  return (
    <div className="rounded-xl border border-border bg-surface-low p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label-mono text-muted-foreground">Bet Stake (₹)</span>
        <span className="label-mono font-bold text-foreground">
          Balance ₹{formatMoney(balance)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onBet(clamp(bet / 2))}
          aria-label="Halve stake"
          className="grid size-11 place-items-center rounded-lg border border-border bg-surface-high font-mono font-bold text-foreground transition active:scale-95 disabled:opacity-40"
        >
          ½
        </button>

        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-primary">
            ₹
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={bet}
            disabled={disabled}
            onChange={(e) => onBet(clamp(Number(e.target.value) || 10))}
            className="h-11 w-full rounded-lg border border-border bg-surface-lowest pl-7 pr-3 text-center font-mono text-lg font-black text-primary outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onBet(clamp(bet * 2))}
          aria-label="Double stake"
          className="grid size-11 place-items-center rounded-lg border border-border bg-surface-high font-mono font-bold text-foreground transition active:scale-95 disabled:opacity-40"
        >
          2×
        </button>
      </div>

      {/* Direct Money Betting Options */}
      <div className="mt-2.5 space-y-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Quick Money Management (₹)
        </span>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onBet(c)}
              className={`rounded-lg border py-2 font-mono text-xs font-bold transition active:scale-95 disabled:opacity-40 ${
                bet === c
                  ? "border-primary bg-primary text-slate-950 font-black shadow-sm"
                  : "border-border bg-surface-high text-foreground hover:bg-surface-highest"
              }`}
            >
              ₹{c >= 1000 ? `${c / 1000}k` : c}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBet(clamp(balance))}
            className="rounded-lg border border-primary/50 bg-primary/20 py-2 font-mono text-xs font-black text-primary transition active:scale-95 disabled:opacity-40 hover:bg-primary/30"
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}
