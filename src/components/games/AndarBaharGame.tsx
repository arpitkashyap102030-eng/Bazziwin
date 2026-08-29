import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Copy, HelpCircle, Minus, Plus, X, Play, CheckCircle2, AlertCircle } from "lucide-react";
import type { GameDef } from "@/lib/games";
import { formatCoins } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  game?: GameDef;
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
};

// Playing card types
type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
  suit: Suit;
  rank: Rank;
  isRed: boolean;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({
        suit: s,
        rank: r,
        isRed: s === "♥" || s === "♦",
      });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

type BetTarget = "andar" | "bahar" | "range1_10" | "range11_30" | "range31_36" | "range37_49";

interface LivePlayerBet {
  id: string;
  avatar: string;
  user: string;
  bet: number;
  cashout: string;
}

interface RoundHistory {
  id: string;
  side: "andar" | "bahar";
  multiplier: number;
  cardsCount: number;
  matchingRank: string;
  won: boolean;
}

export function AndarBaharGame({ bet, balance, busy, settle }: Props) {
  const [stake, setStake] = useState<number>(Math.max(10, bet));
  const [selectedSide, setSelectedSide] = useState<BetTarget>("andar");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"top" | "best" | "stats">("top");

  // Game Deal State
  const [jokerCard, setJokerCard] = useState<Card>({ suit: "♠", rank: "9", isRed: false });
  const [andarCards, setAndarCards] = useState<Card[]>([]);
  const [baharCards, setBaharCards] = useState<Card[]>([]);
  const [totalCardsDealt, setTotalCardsDealt] = useState<number>(0);
  const [currentStatusText, setCurrentStatusText] = useState<string>(
    "Select Inside or Outside to Place Bet",
  );
  const [lastRoundResult, setLastRoundResult] = useState<{
    won: boolean;
    winningSide: "andar" | "bahar";
    payout: number;
    cardsCount: number;
    multiplier: number;
  } | null>(null);

  // Modals & UI Toggles
  const [showRules, setShowRules] = useState<boolean>(false);
  const [roundId, setRoundId] = useState<string>("36573472");

  // Round History Pills (Clean, clear outcome records)
  const [historyPills, setHistoryPills] = useState<RoundHistory[]>([
    { id: "1", side: "bahar", multiplier: 2.0, cardsCount: 16, matchingRank: "K", won: true },
    { id: "2", side: "andar", multiplier: 1.88, cardsCount: 7, matchingRank: "7", won: false },
    { id: "3", side: "andar", multiplier: 1.88, cardsCount: 5, matchingRank: "A", won: true },
    { id: "4", side: "bahar", multiplier: 2.0, cardsCount: 12, matchingRank: "J", won: false },
  ]);

  // Live player bets list
  const [liveBets] = useState<LivePlayerBet[]>([
    { id: "1", avatar: "🌸", user: "9***6", bet: 1000, cashout: "1.88x" },
    { id: "2", avatar: "🧙‍♂️", user: "7***1", bet: 500, cashout: "--" },
    { id: "3", avatar: "💖", user: "8***4", bet: 2500, cashout: "2.00x" },
    { id: "4", avatar: "🌿", user: "9***9", bet: 300, cashout: "--" },
    { id: "5", avatar: "🛡️", user: "6***7", bet: 1500, cashout: "1.88x" },
    { id: "6", avatar: "🐱", user: "9***2", bet: 800, cashout: "--" },
  ]);

  // Deal round handler with pleasant, slowed down deal interval (700ms)
  const dealRound = async () => {
    if (isPlaying || busy) return;
    if (stake > balance) {
      toast.error("Insufficient INR Balance. Please deposit in your wallet.");
      return;
    }

    setIsPlaying(true);
    setLastRoundResult(null);
    setAndarCards([]);
    setBaharCards([]);
    setTotalCardsDealt(0);
    const newRoundId = String(Math.floor(30000000 + Math.random() * 9000000));
    setRoundId(newRoundId);

    playSfx("deal");
    const deck = generateDeck();
    const mainJoker = deck[0];
    setJokerCard(mainJoker);
    setCurrentStatusText(
      `Joker is ${mainJoker.rank}${mainJoker.suit}. Dealing cards alternately...`,
    );

    let deckIdx = 1;
    const tempAndar: Card[] = [];
    const tempBahar: Card[] = [];
    let matchFound = false;
    let winningSide: "andar" | "bahar" = "andar";
    let stepCount = 0;

    // Slowed down deal interval: 700ms for clear readability
    const dealInterval = setInterval(() => {
      if (deckIdx >= deck.length || matchFound) {
        clearInterval(dealInterval);
        return;
      }

      // Inside (Andar) gets 1st, 3rd, 5th card; Outside (Bahar) gets 2nd, 4th, 6th card
      const isAndarTurn = (deckIdx - 1) % 2 === 0;
      const dealtCard = deck[deckIdx];
      stepCount++;
      setTotalCardsDealt(stepCount);

      playSfx("tick");

      if (isAndarTurn) {
        tempAndar.push(dealtCard);
        setAndarCards([...tempAndar]);
        setCurrentStatusText(
          `Inside (Andar) dealt ${dealtCard.rank}${dealtCard.suit} (Card #${stepCount})`,
        );
      } else {
        tempBahar.push(dealtCard);
        setBaharCards([...tempBahar]);
        setCurrentStatusText(
          `Outside (Bahar) dealt ${dealtCard.rank}${dealtCard.suit} (Card #${stepCount})`,
        );
      }

      // Check if rank matches joker card rank
      if (dealtCard.rank === mainJoker.rank) {
        matchFound = true;
        winningSide = isAndarTurn ? "andar" : "bahar";
        clearInterval(dealInterval);

        // Side bets check
        let sideMultiplier = 0;
        if (selectedSide === "andar" && winningSide === "andar") sideMultiplier = 1.88;
        else if (selectedSide === "bahar" && winningSide === "bahar") sideMultiplier = 2.0;
        else if (selectedSide === "range1_10" && stepCount >= 1 && stepCount <= 10)
          sideMultiplier = 1.98;
        else if (selectedSide === "range11_30" && stepCount >= 11 && stepCount <= 30)
          sideMultiplier = 2.16;
        else if (selectedSide === "range31_36" && stepCount >= 31 && stepCount <= 36)
          sideMultiplier = 23.08;
        else if (selectedSide === "range37_49" && stepCount >= 37 && stepCount <= 49)
          sideMultiplier = 44.39;

        const userWon = sideMultiplier > 0;
        const totalPayout = userWon ? Math.round(stake * sideMultiplier) : 0;

        setTimeout(async () => {
          setLastRoundResult({
            won: userWon,
            winningSide,
            payout: totalPayout,
            cardsCount: stepCount,
            multiplier: sideMultiplier || (winningSide === "andar" ? 1.88 : 2.0),
          });

          // Add to history pills
          setHistoryPills((prev) => [
            {
              id: newRoundId,
              side: winningSide,
              multiplier: winningSide === "andar" ? 1.88 : 2.0,
              cardsCount: stepCount,
              matchingRank: mainJoker.rank,
              won: userWon,
            },
            ...prev.slice(0, 4),
          ]);

          if (userWon) {
            playSfx("bigwin");
            setCurrentStatusText(
              `🎉 YOU WON ₹${formatCoins(totalPayout)}! Match found on ${winningSide === "andar" ? "Inside (Andar)" : "Outside (Bahar)"}`,
            );
            toast.success(`🎉 WIN! +₹${formatCoins(totalPayout)} (${sideMultiplier}x)`);
          } else {
            playSfx("lose");
            setCurrentStatusText(
              `💔 Match on ${winningSide === "andar" ? "Inside (Andar)" : "Outside (Bahar)"}. Better luck next round!`,
            );
            toast.error(`💔 ${winningSide.toUpperCase()} won. Round completed.`);
          }

          setIsPlaying(false);
          await settle(
            userWon ? sideMultiplier : 0,
            {
              game: "Andar Bahar",
              joker: mainJoker,
              winningSide,
              totalCards: stepCount,
              selectedSide,
            },
            stake,
          );
        }, 650);
      }

      deckIdx++;
    }, 700);
  };

  const handleStakeChange = (delta: number) => {
    if (isPlaying) return;
    setStake((prev) => Math.max(10, Math.min(50000, Math.round(prev + delta))));
  };

  return (
    <div className="relative mx-auto w-full max-w-md select-none overflow-hidden rounded-3xl bg-[#14080c] font-sans text-white shadow-2xl border border-[#381622]">
      {/* 1. Clean, Clear Header Bar: Title, Rules (?) and Balance */}
      <div className="flex items-center justify-between border-b border-[#2d121c] bg-[#1a0a10] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-black italic tracking-wide text-white">
            Andar Bahar
          </h2>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            aria-label="Game Rules"
            className="flex size-5 items-center justify-center rounded-full bg-[#2a0e1a] text-slate-300 hover:text-white transition"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </div>

        {/* Real Wallet Balance */}
        <div className="rounded-xl border border-[#3b1926] bg-[#240e18] px-3 py-1 font-mono text-xs font-bold text-amber-300 shadow-inner">
          ₹{formatCoins(balance)}
        </div>
      </div>

      {/* 2. Round ID & Clean Multiplier History Bar */}
      <div className="flex items-center justify-between border-b border-[#240e18] bg-[#12060b] px-3.5 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-slate-500">ID:</span>
          <span className="text-slate-300 font-semibold">{roundId}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(roundId);
              toast.success("Round ID copied!");
            }}
            className="text-slate-400 hover:text-white transition"
          >
            <Copy className="size-3" />
          </button>
        </div>

        {/* Clear Outcome History Pills */}
        <div className="flex items-center gap-1.5">
          {historyPills.map((pill, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold shadow-xs ${
                pill.side === "bahar"
                  ? "bg-[#1e3a8a] text-sky-200 border border-blue-400/40"
                  : "bg-[#881337] text-rose-200 border border-rose-400/40"
              }`}
            >
              <span>{pill.side === "andar" ? "A" : "B"}</span>
              <span>{pill.multiplier.toFixed(2)}x</span>
              <span className="opacity-70 text-[9px]">({pill.cardsCount})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Main Casino Table Surface */}
      <div className="relative min-h-[19rem] bg-gradient-to-b from-[#2a0e1a] via-[#1a0810] to-[#12050b] p-3.5">
        {/* Dynamic Status / Multiplier Indicator Header */}
        <div className="text-center mb-1">
          {isPlaying ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-0.5">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-amber-300">
                Dealing Card #{totalCardsDealt} · Odds:{" "}
                {selectedSide === "andar" ? "1.88x" : "2.00x"}
              </span>
            </div>
          ) : lastRoundResult ? (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-mono text-xs font-bold border ${
                lastRoundResult.won
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-rose-500/20 border-rose-500/50 text-rose-300"
              }`}
            >
              {lastRoundResult.won ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>
                    WIN +₹{formatCoins(lastRoundResult.payout)} ({lastRoundResult.multiplier}x)
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-3.5" />
                  <span>
                    LOSS ({lastRoundResult.winningSide.toUpperCase()} won in{" "}
                    {lastRoundResult.cardsCount} cards)
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="font-display text-sm font-bold text-slate-300">
              {currentStatusText}
            </span>
          )}
        </div>

        {/* Joker / Cut Card Box (Fixed on Right) */}
        <div className="absolute right-3.5 top-14 z-20 flex flex-col items-center">
          <div className="text-[10px] font-bold text-amber-400 mb-1 tracking-wider uppercase">
            Joker
          </div>
          <div className="relative flex h-24 w-16 flex-col justify-between rounded-xl border-2 border-amber-400/70 bg-white p-1.5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between text-xs font-black">
              <span>{jokerCard.rank}</span>
              <span className={jokerCard.isRed ? "text-rose-600" : "text-slate-950"}>
                {jokerCard.suit}
              </span>
            </div>
            <div
              className={`text-center text-2xl font-black ${
                jokerCard.isRed ? "text-rose-600" : "text-slate-950"
              }`}
            >
              {jokerCard.suit}
            </div>
            <div className="text-right text-[10px] font-black">{jokerCard.rank}</div>
          </div>
          <span className="mt-1 font-mono text-[11px] font-bold text-slate-400">
            Target: {jokerCard.rank}
          </span>
        </div>

        {/* INSIDE (ANDAR) Row (Left Side / A) */}
        <div
          className={`relative mr-20 mt-1 min-h-[5.5rem] rounded-2xl border p-2 transition ${
            selectedSide === "andar"
              ? "border-rose-500/80 bg-[#2d0c18]/90 ring-1 ring-rose-500/50"
              : "border-[#3d1424]/60 bg-[#1e0a13]/80"
          }`}
        >
          {/* Watermark & Title */}
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-display text-xs font-extrabold text-rose-400">
              Inside (Andar) — 1.88x
            </span>
            {selectedSide === "andar" && (
              <span className="rounded bg-rose-500/30 px-1.5 py-0.2 font-mono text-[9px] font-bold text-rose-300">
                YOUR BET
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar min-h-[4rem]">
            {andarCards.length === 0 ? (
              <span className="text-[11px] font-medium text-rose-400/50 pl-1 italic">
                Awaiting cards...
              </span>
            ) : (
              andarCards.map((c, idx) => {
                const isMatch = c.rank === jokerCard.rank;
                return (
                  <div
                    key={`andar-${idx}`}
                    className={`flex h-16 w-11 shrink-0 flex-col justify-between rounded-lg border bg-white p-1 text-[10px] font-black text-slate-900 shadow-md transition ${
                      isMatch
                        ? "ring-2 ring-amber-400 border-amber-400 scale-105"
                        : "border-slate-300"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{c.rank}</span>
                      <span className={c.isRed ? "text-rose-600" : "text-slate-950"}>{c.suit}</span>
                    </div>
                    <div
                      className={`text-center text-sm ${
                        c.isRed ? "text-rose-600" : "text-slate-950"
                      }`}
                    >
                      {c.suit}
                    </div>
                    <div className="text-right">{c.rank}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* OUTSIDE (BAHAR) Row (Right Side / B) */}
        <div
          className={`relative mr-20 mt-2 min-h-[5.5rem] rounded-2xl border p-2 transition ${
            selectedSide === "bahar"
              ? "border-sky-500/80 bg-[#0d2044]/90 ring-1 ring-sky-500/50"
              : "border-[#1a284a]/60 bg-[#0d162a]/80"
          }`}
        >
          {/* Watermark & Title */}
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-display text-xs font-extrabold text-sky-400">
              Outside (Bahar) — 2.00x
            </span>
            {selectedSide === "bahar" && (
              <span className="rounded bg-sky-500/30 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-300">
                YOUR BET
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar min-h-[4rem]">
            {baharCards.length === 0 ? (
              <span className="text-[11px] font-medium text-sky-400/50 pl-1 italic">
                Awaiting cards...
              </span>
            ) : (
              baharCards.map((c, idx) => {
                const isMatch = c.rank === jokerCard.rank;
                return (
                  <div
                    key={`bahar-${idx}`}
                    className={`flex h-16 w-11 shrink-0 flex-col justify-between rounded-lg border bg-white p-1 text-[10px] font-black text-slate-900 shadow-md transition ${
                      isMatch
                        ? "ring-2 ring-amber-400 border-amber-400 scale-105"
                        : "border-slate-300"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{c.rank}</span>
                      <span className={c.isRed ? "text-rose-600" : "text-slate-950"}>{c.suit}</span>
                    </div>
                    <div
                      className={`text-center text-sm ${
                        c.isRed ? "text-rose-600" : "text-slate-950"
                      }`}
                    >
                      {c.suit}
                    </div>
                    <div className="text-right">{c.rank}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Betting Panel with Clear 1-Click Target Selectors + Bet Confirmation Button */}
      <div className="border-t border-[#2d121c] bg-[#12060b] p-4 space-y-3">
        {/* Stake Stepper Row */}
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-lowest p-2">
          <span className="text-xs font-bold text-muted-foreground pl-1">Bet Amount</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => handleStakeChange(-10)}
              className="flex size-8 items-center justify-center rounded-lg bg-[#240e18] text-slate-300 hover:bg-[#331422] transition active:scale-95 disabled:opacity-50"
            >
              <Minus className="size-4" />
            </button>
            <div className="min-w-20 text-center font-mono text-base font-extrabold text-white">
              ₹{stake}
            </div>
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => handleStakeChange(10)}
              className="flex size-8 items-center justify-center rounded-lg bg-[#240e18] text-slate-300 hover:bg-[#331422] transition active:scale-95 disabled:opacity-50"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {/* 1-Click Bet Selection: Inside (Andar) vs Outside (Bahar) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Select Target (1 Click)</span>
            <span className="text-amber-400 font-mono">
              Selected:{" "}
              {selectedSide === "andar"
                ? "Inside (Andar)"
                : selectedSide === "bahar"
                  ? "Outside (Bahar)"
                  : "Side Bet"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Inside (Andar) Selector */}
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedSide("andar")}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-95 ${
                selectedSide === "andar"
                  ? "border-rose-500 bg-[#3b0d1b] ring-2 ring-rose-500 shadow-lg shadow-rose-950/50"
                  : "border-[#381220] bg-[#240b15] hover:bg-[#2d0e1b]"
              }`}
            >
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="font-semibold">Inside</span>
                <span className="font-mono font-bold text-rose-300">1.88x</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-display text-base font-black italic text-rose-400">
                <span>Andar (A)</span>
                <span className="text-xl">🎴</span>
              </div>
            </button>

            {/* Outside (Bahar) Selector */}
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setSelectedSide("bahar")}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-95 ${
                selectedSide === "bahar"
                  ? "border-sky-500 bg-[#0d1e3d] ring-2 ring-sky-500 shadow-lg shadow-sky-950/50"
                  : "border-[#152445] bg-[#0c162d] hover:bg-[#101d3a]"
              }`}
            >
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="font-semibold">Outside</span>
                <span className="font-mono font-bold text-sky-300">2.00x</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-display text-base font-black italic text-sky-400">
                <span>Bahar (B)</span>
                <span className="text-xl">🎴</span>
              </div>
            </button>
          </div>
        </div>

        {/* Side Bets (Card Ranges) */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-slate-400">Side Bets (Card Counts)</div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { id: "range1_10", label: "1-10", payout: "1.98x" },
              { id: "range11_30", label: "11-30", payout: "2.16x" },
              { id: "range31_36", label: "31-36", payout: "23.08x" },
              { id: "range37_49", label: "37-49", payout: "44.39x" },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={isPlaying}
                onClick={() => setSelectedSide(r.id as BetTarget)}
                className={`rounded-xl border p-1.5 transition active:scale-95 ${
                  selectedSide === r.id
                    ? "border-emerald-400 bg-emerald-950 ring-2 ring-emerald-400"
                    : "border-emerald-500/30 bg-[#0b2416] hover:bg-[#103320]"
                }`}
              >
                <span className="block text-[8px] text-slate-400">{r.payout}</span>
                <span className="font-mono text-xs font-bold text-emerald-400">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Confirmation Bet & Deal Button */}
        <button
          type="button"
          disabled={isPlaying || busy}
          onClick={dealRound}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 font-display text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-emerald-950/40 transition hover:from-emerald-400 hover:to-emerald-500 active:scale-95 disabled:opacity-50"
        >
          {isPlaying ? (
            <span>Dealing Cards...</span>
          ) : (
            <>
              <Play className="size-4 fill-slate-950" />
              <span>Place Bet (₹{stake}) &amp; Deal</span>
            </>
          )}
        </button>
      </div>

      {/* 5. Bottom Tabs & Live Statistics Feed */}
      <div className="border-t border-[#2d121c] bg-[#0c0407] p-3 space-y-3">
        {/* Tabs: Top Bets | Best Bets | Stats */}
        <div className="flex border-b border-[#240e18] text-xs font-bold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab("top")}
            className={`flex-1 py-2 text-center transition ${
              activeTab === "top"
                ? "border-b-2 border-amber-400 text-white font-black"
                : "hover:text-slate-200"
            }`}
          >
            Top Bets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("best")}
            className={`flex-1 py-2 text-center transition ${
              activeTab === "best"
                ? "border-b-2 border-amber-400 text-white font-black"
                : "hover:text-slate-200"
            }`}
          >
            Best Bets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex-1 py-2 text-center transition ${
              activeTab === "stats"
                ? "border-b-2 border-amber-400 text-white font-black"
                : "hover:text-slate-200"
            }`}
          >
            Stats
          </button>
        </div>

        {/* Live Bets Feed */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="grid grid-cols-3 text-slate-500 px-2 text-[11px]">
            <div>User</div>
            <div className="text-center">Bet</div>
            <div className="text-right">Multiplier</div>
          </div>

          <div className="divide-y divide-[#1e0a14] max-h-36 overflow-y-auto pr-1">
            {liveBets.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-3 items-center px-2 py-1.5 text-slate-300"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{item.avatar}</span>
                  <span>{item.user}</span>
                </div>
                <div className="text-center font-bold">₹{item.bet}</div>
                <div className="text-right text-emerald-400 font-bold">{item.cashout}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-[#3d1424] bg-[#1a0a10] p-5 text-white shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#2d121c] pb-2.5">
              <h3 className="font-display text-base font-bold">Andar Bahar Rules</h3>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="size-7 rounded-full bg-[#2a0e1a] text-slate-300 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-2">
              <p>
                1. The dealer opens a <strong>Joker Card</strong> (Target rank).
              </p>
              <p>
                2. Select <strong>Inside (Andar) - 1.88x</strong> or{" "}
                <strong>Outside (Bahar) - 2.00x</strong>.
              </p>
              <p>
                3. Cards are dealt alternately: 1st card to Inside (Andar), 2nd to Outside
                (Bahar)...
              </p>
              <p>4. Whichever side matches the Joker card's rank first wins the round!</p>
              <p>
                5. Click <strong>Place Bet &amp; Deal</strong> to start.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="w-full rounded-xl bg-[#e11d48] py-2.5 font-display text-sm font-bold text-white shadow-md"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
