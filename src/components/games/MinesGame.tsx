import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  HelpCircle,
  Menu,
  Minus,
  Plus,
  RotateCw,
  Coins,
  ShieldCheck,
  X,
  Sparkles,
} from "lucide-react";
import { formatCoins, minesMultiplier } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
  isDeposited?: boolean;
  onRequireDeposit?: () => void;
};

const TOTAL = 25;
const MINE_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 24];

function pickBombs(count: number): Set<number> {
  const s = new Set<number>();
  while (s.size < count) {
    s.add(Math.floor(Math.random() * TOTAL));
  }
  return s;
}

export function MinesGame({ bet, balance, busy, settle, isDeposited, onRequireDeposit }: Props) {
  const [stake, setStake] = useState<number>(Math.max(1, bet));
  const [bombs, setBombs] = useState<number>(3);
  const [running, setRunning] = useState<boolean>(false);
  const [field, setField] = useState<Set<number>>(new Set());
  const [opened, setOpened] = useState<number[]>([]);
  const [blown, setBlown] = useState<number | null>(null);
  const [autoGame, setAutoGame] = useState<boolean>(false);

  // UI Popovers & Modals
  const [showMinesDropdown, setShowMinesDropdown] = useState<boolean>(false);
  const [showGameIdModal, setShowGameIdModal] = useState<boolean>(false);
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string>(
    () => `MN-${Math.floor(100000 + Math.random() * 900000)}`,
  );
  const [serverSeed] = useState<string>(() => Math.random().toString(36).substring(2, 12));

  const picks = opened.length;
  const currentMultiplier = picks === 0 ? 1.0 : minesMultiplier(TOTAL, bombs, picks);
  const nextMultiplier = minesMultiplier(TOTAL, bombs, picks + 1);
  const nextPayout = stake * nextMultiplier;

  // Start new Mines round
  const startGame = () => {
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    if (stake > balance) {
      toast.error("Insufficient INR Balance");
      return;
    }

    playSfx("start");
    setGameId(`MN-${Math.floor(100000 + Math.random() * 900000)}`);
    setField(pickBombs(bombs));
    setOpened([]);
    setBlown(null);
    setRunning(true);
    setShowMinesDropdown(false);
    setShowPresets(false);
  };

  // Pick a tile
  const reveal = async (i: number) => {
    if (!running || opened.includes(i) || busy) return;

    // Hit a mine!
    if (field.has(i)) {
      playSfx("explosion");
      setBlown(i);
      setRunning(false);

      await settle(
        0,
        {
          game: "Mines",
          bombs,
          picks,
          hit: i,
          gameId,
        },
        stake,
      );

      toast.error(`💥 Boom! Mine detonated on tile ${i + 1}`);
      return;
    }

    // Safe Gem
    playSfx("step");
    const nextOpened = [...opened, i];
    setOpened(nextOpened);

    // Cleared all non-bomb tiles!
    if (nextOpened.length === TOTAL - bombs) {
      playSfx("bigwin");
      const finalMult = minesMultiplier(TOTAL, bombs, nextOpened.length);
      setRunning(false);

      await settle(
        finalMult,
        {
          game: "Mines",
          bombs,
          picks: nextOpened.length,
          cleared: true,
          gameId,
        },
        stake,
      );

      toast.success(
        `🏆 ALL GEMS FOUND! +₹${formatCoins(stake * finalMult)} (${finalMult.toFixed(2)}x)`,
      );
    }
  };

  // Pick a random unrevealed tile
  const handleRandomPick = () => {
    if (!running) {
      startGame();
      return;
    }
    const unrevealed: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      if (!opened.includes(i)) unrevealed.push(i);
    }
    if (unrevealed.length > 0) {
      const randomTile = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      void reveal(randomTile);
    }
  };

  // Cash out safe winnings
  const cashOut = async () => {
    if (!running || picks === 0 || busy) return;

    playSfx("cashout");
    setRunning(false);

    await settle(
      currentMultiplier,
      {
        game: "Mines",
        bombs,
        picks,
        gameId,
      },
      stake,
    );

    toast.success(
      `🎉 Cashed Out at ${currentMultiplier.toFixed(2)}x (+₹${formatCoins(stake * currentMultiplier)})`,
    );
  };

  // Handle stake adjustments
  const handleStakeChange = (delta: number) => {
    if (running) return;
    setStake((prev) => Math.max(1, Math.min(50000, Math.round(prev + delta))));
  };

  return (
    <div className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-3xl bg-[#082977] font-sans text-white shadow-2xl border border-[#164bb8]">
      {/* 1. Header Bar matching Screenshot 2: MINES */}
      <div className="flex items-center justify-between border-b border-[#123e9c] bg-[#07246c] px-4 py-2.5">
        <h2 className="font-display text-lg font-black tracking-wider text-white">MINES</h2>

        {/* Live balance display */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#1c55d0] bg-[#0c318a] px-3 py-1">
          <span className="text-amber-400 text-sm">🪙</span>
          <span className="font-mono text-xs font-bold text-white">₹{formatCoins(balance)}</span>
        </div>
      </div>

      {/* 2. Top Info Row: Green "Game ID: ▾" & Yellow "Next: XX.XX INR" pill */}
      <div className="flex items-center justify-between gap-2 bg-[#092e85] px-3.5 py-2.5">
        {/* Game ID Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowGameIdModal(true)}
            className="flex items-center gap-1 rounded-lg bg-[#0e7445] px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-[#128a53] transition"
          >
            <span>Game ID: {gameId}</span>
            <ChevronDown className="size-3.5" />
          </button>
        </div>

        {/* Next Payout Yellow Pill matching Screenshot 2 */}
        <div className="flex items-center gap-1 rounded-full bg-[#eab308] px-3.5 py-1 text-xs font-black text-slate-950 shadow-md">
          <span>Next:</span>
          <span>
            {running ? `${nextPayout.toFixed(2)} INR` : `${(stake * 1.1).toFixed(2)} INR`}
          </span>
        </div>
      </div>

      {/* 3. 5x5 Mines Grid matching Screenshot 2 (Rich blue recessed tiles) */}
      <div className="p-3.5">
        <div className="grid grid-cols-5 gap-2.5 rounded-2xl bg-[#062060] p-3 shadow-inner border border-[#123d9b]">
          {Array.from({ length: TOTAL }).map((_, i) => {
            const isOpen = opened.includes(i);
            const isBlown = blown === i;
            const isExposedMine = !running && blown !== null && field.has(i);

            return (
              <button
                key={i}
                type="button"
                disabled={!running || isOpen || busy}
                onClick={() => void reveal(i)}
                className={`relative flex aspect-square items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${
                  isBlown
                    ? "bg-rose-600 ring-2 ring-rose-400 shadow-lg scale-105"
                    : isOpen
                      ? "bg-emerald-600/90 ring-2 ring-emerald-400 shadow-md scale-100"
                      : isExposedMine
                        ? "bg-[#1c305c] opacity-60"
                        : "bg-[#0f3c9e] hover:bg-[#164abf] shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_3px_6px_rgba(0,0,0,0.3)] border border-[#1a52cc]"
                }`}
              >
                {/* Tile Center recessed circle or revealed icon */}
                {isOpen ? (
                  <div className="flex flex-col items-center justify-center animate-pop">
                    <span className="text-2xl drop-shadow-md">💎</span>
                  </div>
                ) : isBlown || isExposedMine ? (
                  <div className="flex flex-col items-center justify-center animate-pop">
                    <span className="text-2xl">💣</span>
                  </div>
                ) : (
                  /* Center Circular Indentation Dot matching Screenshot 2 */
                  <div className="size-4 rounded-full bg-[#09276d] shadow-inner opacity-80 border border-[#061c52]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Controls Row: [RANDOM] [Auto Game Toggle] [Mines: 3 ▾] matching Screenshot 2 */}
      <div className="flex items-center justify-between px-3.5 pb-2">
        {/* RANDOM Button */}
        <button
          type="button"
          disabled={busy}
          onClick={handleRandomPick}
          className="rounded-full bg-[#0a358c] px-4 py-1.5 font-display text-xs font-bold text-white shadow hover:bg-[#1043aa] active:scale-95 border border-[#164dbf]"
        >
          RANDOM
        </button>

        {/* Auto Game Switch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => setAutoGame(!autoGame)}
            className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${
              autoGame ? "bg-emerald-500" : "bg-[#0e2c6d] border border-[#1c4ab0]"
            }`}
          >
            <span
              className={`inline-block size-4.5 rounded-full bg-white transition-transform ${
                autoGame ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-slate-200">Auto Game</span>
        </div>

        {/* Mines Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            disabled={running}
            onClick={() => setShowMinesDropdown(!showMinesDropdown)}
            className="flex items-center gap-1.5 rounded-full bg-[#0a358c] px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-[#1043aa] border border-[#164dbf] disabled:opacity-50"
          >
            <span>Mines: {bombs}</span>
            <ChevronDown className="size-3.5" />
          </button>

          {/* Mines Popover Menu */}
          {showMinesDropdown && !running && (
            <div className="absolute bottom-full mb-1.5 right-0 z-50 grid grid-cols-4 gap-1 rounded-2xl border border-[#2055cb] bg-[#071f5c] p-2 shadow-2xl">
              {MINE_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setBombs(m);
                    setShowMinesDropdown(false);
                  }}
                  className={`rounded-lg py-1.5 px-2 font-mono text-xs font-bold transition ${
                    bombs === m
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-[#0b2d7a] text-slate-200 hover:bg-[#123e9e]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Bottom Betting Container matching Screenshot 2 */}
      <div className="border-t border-[#123e9e] bg-[#062266] p-3.5 space-y-3">
        {/* Stake Input Row: [-] [Bet 10.00 INR] [🪙] [+] */}
        <div className="flex items-center justify-between rounded-full border border-[#184bbd] bg-[#082b7c] p-1 shadow-inner">
          {/* Minus Button */}
          <button
            type="button"
            disabled={running}
            onClick={() => handleStakeChange(-10)}
            className="flex size-9 items-center justify-center rounded-full bg-[#0c379a] text-slate-200 hover:bg-[#1546bd] active:scale-95 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>

          {/* Bet Text */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold text-slate-300">Bet</span>
            <span className="font-mono text-sm font-black text-white">{stake.toFixed(2)} INR</span>
          </div>

          {/* Coin stack preset icon */}
          <button
            type="button"
            disabled={running}
            onClick={() => setShowPresets(!showPresets)}
            className="flex size-9 items-center justify-center rounded-full bg-[#0c379a] text-amber-400 hover:bg-[#1546bd] active:scale-95 disabled:opacity-40"
            title="Stake Presets"
          >
            <Coins className="size-5" />
          </button>

          {/* Plus Button */}
          <button
            type="button"
            disabled={running}
            onClick={() => handleStakeChange(10)}
            className="flex size-9 items-center justify-center rounded-full bg-[#0c379a] text-slate-200 hover:bg-[#1546bd] active:scale-95 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* Quick Presets Popover */}
        {showPresets && !running && (
          <div className="grid grid-cols-5 gap-1 rounded-xl border border-[#1a4fce] bg-[#082b7c] p-1.5 animate-fade-in">
            {[10, 50, 100, 500, 1000].map((amt) => (
              <button
                key={`preset-${amt}`}
                type="button"
                onClick={() => {
                  setStake(amt);
                  setShowPresets(false);
                }}
                className="rounded-lg bg-[#0e3796] py-1 font-mono text-xs font-bold text-white hover:bg-[#1649c0]"
              >
                {amt}
              </button>
            ))}
          </div>
        )}

        {/* Action Button Row: [🔄] + [ ▶ BET ] (or CASHOUT) matching Screenshot 2 */}
        <div className="flex items-center gap-2">
          {/* Blue Re-Bet / Refresh Circle */}
          <button
            type="button"
            disabled={running}
            onClick={startGame}
            className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[#1a4fce] bg-[#0c389c] text-slate-200 shadow-md hover:bg-[#1447bf] active:scale-95 disabled:opacity-40"
            title="Re-Bet"
          >
            <RotateCw className="size-6" />
          </button>

          {/* Big Green Pill [ ▶ BET ] or Cashout Button */}
          {running ? (
            <button
              type="button"
              disabled={busy || picks === 0}
              onClick={cashOut}
              className="flex h-14 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 font-display text-lg font-black text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <span>
                CASH OUT +₹{formatCoins(stake * currentMultiplier)} ({currentMultiplier.toFixed(2)}
                x)
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || stake > balance}
              onClick={startGame}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#16a34a] font-display text-xl font-black tracking-wider text-white shadow-[0_4px_15px_rgba(22,163,74,0.4)] transition hover:bg-[#15803d] active:scale-95 disabled:opacity-50"
            >
              <span>▶</span>
              <span>{stake > balance ? "INSUFFICIENT BALANCE" : "BET"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Bottom Bar: (?) Help, 0.04 INR, ☰ Menu matching Screenshot 2 */}
      <div className="flex items-center justify-between border-t border-[#123e9e] bg-[#041c54] px-4 py-2 text-xs">
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="flex size-6 items-center justify-center rounded-full bg-[#f59e0b] text-slate-950 font-black hover:bg-amber-300"
        >
          ?
        </button>

        <span className="font-mono text-xs font-bold text-slate-300">{balance.toFixed(2)} INR</span>

        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="flex size-6 items-center justify-center text-slate-300 hover:text-white"
        >
          <Menu className="size-4" />
        </button>
      </div>

      {/* Game ID & Provably Fair Modal */}
      {showGameIdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-[#2055cb] bg-[#07246c] p-5 text-white shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#143e9e] pb-2.5">
              <h3 className="font-display text-base font-bold">Game Verification</h3>
              <button
                type="button"
                onClick={() => setShowGameIdModal(false)}
                className="size-7 rounded-full bg-[#0c318a] text-slate-300 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="font-mono text-xs text-slate-300 space-y-2">
              <div className="flex justify-between">
                <span>Game ID:</span>
                <span className="text-white font-bold">{gameId}</span>
              </div>
              <div className="flex justify-between">
                <span>Server Seed:</span>
                <span className="text-emerald-400 font-bold">{serverSeed}</span>
              </div>
              <div className="flex justify-between">
                <span>RTP:</span>
                <span className="text-amber-400 font-bold">97.00%</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGameIdModal(false)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 font-display text-sm font-bold text-slate-950"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-[#2055cb] bg-[#07246c] p-5 text-white shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#143e9e] pb-2.5">
              <h3 className="font-display text-base font-bold">Mines Game Rules</h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="size-7 rounded-full bg-[#0c318a] text-slate-300 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-2">
              <p>1. Pick any tile on the 5x5 grid to find sparkling diamonds (💎).</p>
              <p>2. Each diamond increases your multiplier and payout value.</p>
              <p>
                3. You can click <strong>CASH OUT</strong> at any time to bank your profit.
              </p>
              <p>4. If you hit a hidden mine (💣), the round ends and the bet is lost.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 font-display text-sm font-bold text-slate-950"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
