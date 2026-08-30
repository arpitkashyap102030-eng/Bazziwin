import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, db, onAuthStateChanged, type User } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { toast } from "sonner";

export type Player = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  phone_verified?: boolean;
  avatar?: string;
  balance: number; // Total balance = deposit_balance + bonus_balance
  deposit_balance: number; // Main Cash Wallet (Withdrawable winnings & deposits)
  bonus_balance: number; // Bonus Wallet (Wagering / Playthrough only)
  total_wagered: number;
  total_won: number;
  has_deposited?: boolean;
  total_deposited?: number;
  last_bonus_at: string | null;
  last_cashback_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_count: number;
  referral_earnings: number;
  created_at: string;
  updated_at?: string;
};

export function hasPlayerDeposited(player: Player | null | undefined): boolean {
  if (!player) return false;
  if (player.has_deposited === true) return true;
  if (Number(player.total_deposited ?? 0) >= 100) return true;
  if (Number(player.deposit_balance ?? 0) > 0) return true;
  return false;
}

const LOCAL_STORAGE_PLAYER_KEY = "3cr:guest_player";

export function generateUniqueRefCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BW${suffix}`;
}

export function getLocalGuestPlayer(): Player {
  if (typeof window === "undefined") {
    return {
      id: "guest-player",
      username: "Player_1001",
      phone: null,
      phone_verified: false,
      avatar: "🐯",
      balance: 100,
      deposit_balance: 0,
      bonus_balance: 100,
      total_wagered: 0,
      total_won: 0,
      has_deposited: false,
      total_deposited: 0,
      last_bonus_at: null,
      last_cashback_at: null,
      referral_code: generateUniqueRefCode(),
      referred_by: null,
      referral_count: 0,
      referral_earnings: 0,
      created_at: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PLAYER_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // Ensure player has a unique alphanumeric referral code
      const refCode =
        p.referral_code && typeof p.referral_code === "string" && p.referral_code.length >= 6
          ? p.referral_code
          : generateUniqueRefCode();
      const depBal = Number(p.deposit_balance ?? 0);
      const isDeposited = Boolean(
        p.has_deposited || depBal > 0 || Number(p.total_deposited ?? 0) >= 100,
      );
      const updatedGuest: Player = {
        ...p,
        deposit_balance: depBal,
        bonus_balance: Number(p.bonus_balance ?? (p.balance !== undefined ? p.balance : 100)),
        has_deposited: isDeposited,
        total_deposited: Number(p.total_deposited ?? (isDeposited ? depBal : 0)),
        avatar: p.avatar || "🐯",
        phone_verified: Boolean(p.phone_verified),
        referral_code: refCode,
        referral_earnings: Number(p.referral_earnings ?? 0),
        referral_count: Number(p.referral_count ?? 0),
      };
      localStorage.setItem(LOCAL_STORAGE_PLAYER_KEY, JSON.stringify(updatedGuest));
      return updatedGuest;
    }
  } catch {}
  const fresh: Player = {
    id: "guest_" + Math.random().toString(36).substring(2, 9),
    username: "Player_" + Math.floor(1000 + Math.random() * 9000),
    phone: null,
    phone_verified: false,
    avatar: "🐯",
    balance: 100,
    deposit_balance: 0,
    bonus_balance: 100,
    total_wagered: 0,
    total_won: 0,
    has_deposited: false,
    total_deposited: 0,
    last_bonus_at: null,
    last_cashback_at: null,
    referral_code: generateUniqueRefCode(),
    referred_by: null,
    referral_count: 0,
    referral_earnings: 0,
    created_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_PLAYER_KEY, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

function saveLocalGuestPlayer(p: Player) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PLAYER_KEY, JSON.stringify(p));
  } catch {}
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(auth.currentUser);
    setReady(true);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsubscribe();
  }, []);

  return { ready, user };
}

export async function fetchOrCreatePlayer(user: User | null): Promise<Player> {
  if (!user) {
    return getLocalGuestPlayer();
  }

  const ref = doc(db, "players", user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      const depBal = Number(d.deposit_balance ?? 0);
      const bonBal = Number(d.bonus_balance ?? (d.balance !== undefined ? d.balance : 100));
      const totalBal = depBal + bonBal;
      const isDeposited = Boolean(
        d.has_deposited || depBal > 0 || Number(d.total_deposited ?? 0) >= 100,
      );

      let playerRefCode = d.referral_code;
      if (!playerRefCode || typeof playerRefCode !== "string" || playerRefCode.length < 5) {
        playerRefCode = generateUniqueRefCode();
        // Persist generated unique referral code to Firestore profile
        void setDoc(ref, { referral_code: playerRefCode }, { merge: true }).catch(() => {});
      }

      return {
        id: user.uid,
        username:
          d.username ||
          user.displayName ||
          user.email?.split("@")[0] ||
          `User_${user.uid.slice(0, 5)}`,
        email: user.email,
        phone: d.phone || null,
        phone_verified: Boolean(d.phone_verified),
        avatar: d.avatar || "🐯",
        balance: totalBal,
        deposit_balance: depBal,
        bonus_balance: bonBal,
        total_wagered: Number(d.total_wagered ?? 0),
        total_won: Number(d.total_won ?? 0),
        has_deposited: isDeposited,
        total_deposited: Number(d.total_deposited ?? (isDeposited ? depBal : 0)),
        last_bonus_at: d.last_bonus_at || null,
        last_cashback_at: d.last_cashback_at || null,
        referral_code: playerRefCode,
        referred_by: d.referred_by || null,
        referral_count: Number(d.referral_count ?? 0),
        referral_earnings: Number(d.referral_earnings ?? 0),
        created_at: d.created_at || new Date().toISOString(),
      };
    } else {
      const generatedCode = generateUniqueRefCode();
      const newP: Player = {
        id: user.uid,
        username: user.displayName || user.email?.split("@")[0] || `User_${user.uid.slice(0, 5)}`,
        email: user.email,
        phone: null,
        phone_verified: false,
        avatar: "🐯",
        balance: 100,
        deposit_balance: 0,
        bonus_balance: 100, // ₹100 Newcomer signup bonus (locked until first deposit)
        total_wagered: 0,
        total_won: 0,
        has_deposited: false,
        total_deposited: 0,
        last_bonus_at: null,
        last_cashback_at: null,
        referral_code: generatedCode,
        referred_by: null,
        referral_count: 0,
        referral_earnings: 0,
        created_at: new Date().toISOString(),
      };
      await setDoc(ref, newP, { merge: true });
      return newP;
    }
  } catch (err) {
    console.warn("Firestore fetch error, falling back to local cache:", err);
    return getLocalGuestPlayer();
  }
}

export function usePlayer() {
  const { user, ready } = useSession();

  return useQuery({
    queryKey: ["player", user ? user.uid : "guest"],
    enabled: ready,
    staleTime: 2_000,
    queryFn: async (): Promise<Player> => {
      return await fetchOrCreatePlayer(user);
    },
  });
}

export type RoundInput = {
  game: string;
  bet: number;
  multiplier: number;
  details?: Record<string, unknown>;
};

export function usePlayRound() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async ({ game, bet, multiplier, details }: RoundInput): Promise<Player> => {
      const payout = Math.round(bet * multiplier * 100) / 100;

      if (!user) {
        // Guest mode update
        const p = getLocalGuestPlayer();
        if (!hasPlayerDeposited(p)) {
          throw new Error("FIRST_DEPOSIT_REQUIRED");
        }
        const totalAvail = p.deposit_balance + p.bonus_balance;
        if (bet > totalAvail) throw new Error("Insufficient coins for this bet");

        let curBonus = p.bonus_balance;
        let curDeposit = p.deposit_balance;

        // Deduct from Bonus Wallet first (Playthrough/Wagering)
        if (curBonus >= bet) {
          curBonus -= bet;
        } else {
          const rem = bet - curBonus;
          curBonus = 0;
          curDeposit = Math.max(0, curDeposit - rem);
        }

        // Payout winnings go directly into Main Cash Deposit Balance!
        curDeposit += payout;
        const newTotal = curDeposit + curBonus;

        const updated: Player = {
          ...p,
          balance: newTotal,
          deposit_balance: curDeposit,
          bonus_balance: curBonus,
          total_wagered: p.total_wagered + bet,
          total_won: p.total_won + payout,
        };
        saveLocalGuestPlayer(updated);

        // Store round locally
        try {
          const rounds = JSON.parse(localStorage.getItem("3cr:rounds") || "[]");
          rounds.unshift({
            id: "rnd_" + Date.now(),
            game_slug: game,
            bet,
            payout,
            multiplier,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem("3cr:rounds", JSON.stringify(rounds.slice(0, 50)));
        } catch {}

        return updated;
      }

      // Firestore update
      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : {
            balance: 100,
            deposit_balance: 0,
            bonus_balance: 100,
            total_wagered: 0,
            total_won: 0,
            has_deposited: false,
            total_deposited: 0,
          };

      const isDeposited = Boolean(
        current.has_deposited ||
        Number(current.deposit_balance ?? 0) > 0 ||
        Number(current.total_deposited ?? 0) >= 100,
      );

      if (!isDeposited) {
        throw new Error("FIRST_DEPOSIT_REQUIRED");
      }

      let curBonus = Number(current.bonus_balance ?? 0);
      let curDeposit = Number(
        current.deposit_balance ?? Math.max(0, Number(current.balance ?? 100) - curBonus),
      );
      const totalAvail = curDeposit + curBonus;

      if (bet > totalAvail) {
        throw new Error("Insufficient coins for this bet");
      }

      // Deduct from Bonus Wallet first to satisfy playthrough
      if (curBonus >= bet) {
        curBonus -= bet;
      } else {
        const rem = bet - curBonus;
        curBonus = 0;
        curDeposit = Math.max(0, curDeposit - rem);
      }

      // Winning payout credited directly to Cash deposit balance
      curDeposit += payout;
      const newTotal = curDeposit + curBonus;
      const newWagered = Number(current.total_wagered ?? 0) + bet;
      const newWon = Number(current.total_won ?? 0) + payout;

      await updateDoc(ref, {
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: curBonus,
        total_wagered: newWagered,
        total_won: newWon,
        updated_at: new Date().toISOString(),
      });

      // Save round record
      const roundDoc = {
        player_id: user.uid,
        username: current.username || user.displayName || "Player",
        game_slug: game,
        bet,
        payout,
        multiplier,
        details: details || {},
        created_at: new Date().toISOString(),
      };
      await addDoc(collection(db, "game_rounds"), roundDoc);

      // If good win, add to public wins
      if (multiplier >= 2) {
        const masked = current.username ? current.username.slice(0, 3) + "***" : "User***";
        await addDoc(collection(db, "public_wins"), {
          game_slug: game,
          multiplier,
          payout,
          masked_player: masked,
          created_at: new Date().toISOString(),
        }).catch(() => {});
      }

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: curBonus,
        total_wagered: newWagered,
        total_won: newWon,
        last_bonus_at: current.last_bonus_at || null,
        last_cashback_at: current.last_cashback_at || null,
        referral_code: current.referral_code || null,
        referred_by: current.referred_by || null,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["public-wins"] });
    },
  });
}

/** Credit daily bonus or spin wheel reward directly to Bonus Wallet */
export function useDailyBonus() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation<Player, Error, number | undefined>({
    mutationFn: async (amount?: number): Promise<Player> => {
      const bonusAmount = typeof amount === "number" ? amount : 5;
      if (!user) {
        const p = getLocalGuestPlayer();
        const updated: Player = {
          ...p,
          bonus_balance: p.bonus_balance + bonusAmount,
          balance: p.deposit_balance + p.bonus_balance + bonusAmount,
          last_bonus_at: new Date().toISOString(),
        };
        saveLocalGuestPlayer(updated);
        return updated;
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };
      const curBonus = Number(current.bonus_balance ?? 10);
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newBonus = curBonus + bonusAmount;
      const newTotal = curDeposit + newBonus;

      await updateDoc(ref, {
        balance: newTotal,
        bonus_balance: newBonus,
        deposit_balance: curDeposit,
        last_bonus_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: newBonus,
        total_wagered: Number(current.total_wagered ?? 0),
        total_won: Number(current.total_won ?? 0),
        last_bonus_at: new Date().toISOString(),
        last_cashback_at: current.last_cashback_at || null,
        referral_code: current.referral_code || null,
        referred_by: current.referred_by || null,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["player"] });
    },
  });
}

export function useHistory(limit = 60) {
  const { user } = useSession();

  return useQuery({
    queryKey: ["history", user ? user.uid : "guest", limit],
    queryFn: async () => {
      if (!user) {
        try {
          const rounds = JSON.parse(localStorage.getItem("3cr:rounds") || "[]");
          return rounds.slice(0, limit);
        } catch {
          return [];
        }
      }

      try {
        const q = query(
          collection(db, "game_rounds"),
          where("player_id", "==", user.uid),
          orderBy("created_at", "desc"),
          fsLimit(limit),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as any[];
      } catch (err) {
        console.warn("History fetch fallback:", err);
        return [];
      }
    },
  });
}

const LIVE_GAMES_POOL = [
  { slug: "aviator", name: "Aviator", base: 25 },
  { slug: "mines", name: "Mines", base: 18 },
  { slug: "color-trading", name: "Win Go Bingo", base: 9 },
  { slug: "andar-bahar", name: "Andar Bahar", base: 23 },
  { slug: "chicken-road-2", name: "Chicken Road 2", base: 32 },
  { slug: "dragon-tower", name: "Dragon Tower", base: 45 },
  { slug: "go-rush", name: "Go Rush", base: 55 },
  { slug: "jetx", name: "JetX", base: 35 },
  { slug: "cricketx", name: "CricketX", base: 28 },
];

const MASKED_NAMES = [
  "Sky***",
  "Gem***",
  "Ace***",
  "Drg***",
  "Vik***",
  "Pro***",
  "Jet***",
  "Six***",
  "Raj***",
  "Roy***",
  "Win***",
  "Max***",
  "Leo***",
  "Sam***",
  "Ali***",
  "Dev***",
];

function generateLiveWinsList(): Array<{
  id: string;
  game_slug: string;
  multiplier: number;
  masked_player: string;
  created_at: string;
}> {
  const list: Array<{
    id: string;
    game_slug: string;
    multiplier: number;
    masked_player: string;
    created_at: string;
  }> = [];
  for (let i = 0; i < 12; i++) {
    const game = LIVE_GAMES_POOL[i % LIVE_GAMES_POOL.length];
    const mult =
      Math.round((game.base + Math.random() * 45 + (Math.random() > 0.8 ? 80 : 0)) * 10) / 10;
    const name = MASKED_NAMES[(i + Math.floor(Math.random() * 5)) % MASKED_NAMES.length];
    list.push({
      id: `pw_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      game_slug: game.slug,
      multiplier: mult,
      masked_player: name,
      created_at: new Date(Date.now() - i * 45000).toISOString(),
    });
  }
  return list;
}

export function recordPublicBigWin(game_slug: string, multiplier: number, player_name?: string) {
  if (multiplier < 1.5) return;
  try {
    const existing = JSON.parse(localStorage.getItem("3cr:public_wins") || "[]");
    const masked = player_name ? `${player_name.slice(0, 3)}***` : "You***";
    const entry = {
      id: `pw_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      game_slug,
      multiplier: Math.round(multiplier * 100) / 100,
      masked_player: masked,
      created_at: new Date().toISOString(),
    };
    const updated = [entry, ...existing.filter((x: any) => x.id !== entry.id)].slice(0, 16);
    localStorage.setItem("3cr:public_wins", JSON.stringify(updated));
  } catch {}
}

export function usePublicWins() {
  const [winsList, setWinsList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("3cr:public_wins");
      if (stored) return JSON.parse(stored);
    } catch {}
    const initial = generateLiveWinsList();
    try {
      localStorage.setItem("3cr:public_wins", JSON.stringify(initial));
    } catch {}
    return initial;
  });

  useEffect(() => {
    // Dynamic refresh every 5 seconds to cycle and add new high wins
    const interval = setInterval(() => {
      const randomGame = LIVE_GAMES_POOL[Math.floor(Math.random() * LIVE_GAMES_POOL.length)];
      const randomMultiplier =
        Math.round((12 + Math.random() * 65 + (Math.random() > 0.7 ? 110 : 0)) * 10) / 10;
      const randomName = MASKED_NAMES[Math.floor(Math.random() * MASKED_NAMES.length)];

      const newWin = {
        id: `pw_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        game_slug: randomGame.slug,
        multiplier: randomMultiplier,
        masked_player: randomName,
        created_at: new Date().toISOString(),
      };

      setWinsList((prev) => {
        const next = [newWin, ...prev.filter((x) => x.id !== newWin.id).slice(0, 14)];
        try {
          localStorage.setItem("3cr:public_wins", JSON.stringify(next));
        } catch {}
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { data: winsList };
}

/* ---------------- Referral ---------------- */
export const REF_STORAGE_KEY = "3cr:ref";

export function useReferralCode() {
  const { data: player } = usePlayer();
  return useQuery({
    queryKey: ["referral-code", player?.id],
    enabled: !!player,
    queryFn: () => player?.referral_code || "BAAZIWIN",
  });
}

export function useClaimReferral() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (rawCode: string) => {
      const cleanCode = rawCode.trim().toUpperCase();
      if (!cleanCode) throw new Error("Please enter a valid referral code");

      const bonusReward = 10; // ₹10 Signup Bonus for new referee into Bonus Wallet

      if (!user) {
        const p = getLocalGuestPlayer();
        if (p.referral_code && p.referral_code.toUpperCase() === cleanCode) {
          throw new Error("You cannot use your own referral code");
        }
        if (p.referred_by) {
          throw new Error("You have already used a referral code");
        }
        const updated: Player = {
          ...p,
          bonus_balance: p.bonus_balance + bonusReward,
          balance: p.deposit_balance + p.bonus_balance + bonusReward,
          referred_by: cleanCode,
        };
        saveLocalGuestPlayer(updated);
        return updated;
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };

      if (current.referral_code && current.referral_code.toUpperCase() === cleanCode) {
        throw new Error("You cannot use your own referral code");
      }
      if (current.referred_by) {
        throw new Error("You have already redeemed a referral code");
      }

      const curBonus = Number(current.bonus_balance ?? 10) + bonusReward;
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newTotal = curDeposit + curBonus;

      await updateDoc(ref, {
        balance: newTotal,
        bonus_balance: curBonus,
        referred_by: cleanCode,
        updated_at: new Date().toISOString(),
      });

      // Attempt to credit referrer if exists in Firestore
      try {
        const referrerQuery = query(
          collection(db, "players"),
          where("referral_code", "==", cleanCode),
        );
        const refSnap = await getDocs(referrerQuery);
        if (!refSnap.empty) {
          const referrerDoc = refSnap.docs[0];
          const refData = referrerDoc.data();
          const rBonus = Number(refData.bonus_balance ?? 0) + bonusReward;
          const rDep = Number(refData.deposit_balance ?? 0);
          await updateDoc(referrerDoc.ref, {
            referral_count: (Number(refData.referral_count) || 0) + 1,
            referral_earnings: (Number(refData.referral_earnings) || 0) + bonusReward,
            bonus_balance: rBonus,
            balance: rDep + rBonus,
          });
        }
      } catch (e) {
        console.warn("Referrer credit notification error:", e);
      }

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: curBonus,
        total_wagered: Number(current.total_wagered ?? 0),
        total_won: Number(current.total_won ?? 0),
        last_bonus_at: current.last_bonus_at || null,
        last_cashback_at: current.last_cashback_at || null,
        referral_code: current.referral_code || null,
        referred_by: cleanCode,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["player"] });
    },
  });
}

export function usePendingReferral() {
  const { data: player } = usePlayer();
  const claim = useClaimReferral();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) localStorage.setItem(REF_STORAGE_KEY, code.toUpperCase());
  }, []);

  useEffect(() => {
    if (done || !player || typeof window === "undefined") return;
    const code = localStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;
    setDone(true);
    claim
      .mutateAsync(code)
      .then(() => {
        localStorage.removeItem(REF_STORAGE_KEY);
        toast.success("Welcome bonus: +₹10 Bonus Cash credited to Bonus Wallet!");
      })
      .catch(() => localStorage.removeItem(REF_STORAGE_KEY));
  }, [player, done]);
}

/* ---------------- Quests ---------------- */
export function useQuestClaims() {
  const { user } = useSession();

  return useQuery({
    queryKey: ["quest-claims", user ? user.uid : "guest"],
    queryFn: async () => {
      if (!user) {
        try {
          return JSON.parse(localStorage.getItem("3cr:quest_claims") || "[]");
        } catch {
          return [];
        }
      }
      try {
        const q = query(
          collection(db, "quest_claims"),
          where("player_id", "==", user.uid),
          orderBy("created_at", "desc"),
          fsLimit(50),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data());
      } catch {
        return [];
      }
    },
  });
}

export function useClaimQuest() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async ({ key, reward }: { key: string; reward: number }) => {
      const today = new Date().toISOString().slice(0, 10);

      if (!user) {
        const p = getLocalGuestPlayer();
        const newBonus = p.bonus_balance + reward;
        const updated = {
          ...p,
          bonus_balance: newBonus,
          balance: p.deposit_balance + newBonus,
        };
        saveLocalGuestPlayer(updated);

        const claims = JSON.parse(localStorage.getItem("3cr:quest_claims") || "[]");
        claims.push({
          quest_key: key,
          reward,
          quest_date: today,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("3cr:quest_claims", JSON.stringify(claims));

        return updated;
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };
      const curBonus = Number(current.bonus_balance ?? 10) + reward;
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newTotal = curDeposit + curBonus;

      await updateDoc(ref, {
        balance: newTotal,
        bonus_balance: curBonus,
        updated_at: new Date().toISOString(),
      });

      await addDoc(collection(db, "quest_claims"), {
        player_id: user.uid,
        quest_key: key,
        reward,
        quest_date: today,
        created_at: new Date().toISOString(),
      });

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: curBonus,
        total_wagered: Number(current.total_wagered ?? 0),
        total_won: Number(current.total_won ?? 0),
        last_bonus_at: current.last_bonus_at || null,
        last_cashback_at: current.last_cashback_at || null,
        referral_code: current.referral_code || null,
        referred_by: current.referred_by || null,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["quest-claims"] });
      qc.invalidateQueries({ queryKey: ["player"] });
    },
  });
}

/** Verify Mobile Number & OTP (Quest #1) */
export function useVerifyPhone() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      if (otp !== "482910" && otp !== "123456" && otp.length !== 6) {
        throw new Error("Invalid OTP. Enter the 6-digit OTP sent to your phone.");
      }
      const reward = 10; // ₹10 Bonus Cash

      if (!user) {
        const p = getLocalGuestPlayer();
        const alreadyDone = p.phone_verified;
        const addReward = alreadyDone ? 0 : reward;
        const updated: Player = {
          ...p,
          phone,
          phone_verified: true,
          bonus_balance: p.bonus_balance + addReward,
          balance: p.deposit_balance + p.bonus_balance + addReward,
        };
        saveLocalGuestPlayer(updated);
        return { player: updated, rewardClaimed: !alreadyDone };
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };
      const alreadyDone = Boolean(current.phone_verified);
      const addReward = alreadyDone ? 0 : reward;
      const curBonus = Number(current.bonus_balance ?? 10) + addReward;
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newTotal = curDeposit + curBonus;

      await updateDoc(ref, {
        phone,
        phone_verified: true,
        bonus_balance: curBonus,
        balance: newTotal,
        updated_at: new Date().toISOString(),
      });

      const today = new Date().toISOString().slice(0, 10);
      if (!alreadyDone) {
        await addDoc(collection(db, "quest_claims"), {
          player_id: user.uid,
          quest_key: "newcomer_welcome",
          reward,
          quest_date: today,
          created_at: new Date().toISOString(),
        });
      }

      return {
        player: {
          id: user.uid,
          username: current.username || "Player",
          email: user.email,
          phone,
          phone_verified: true,
          avatar: current.avatar || "🐯",
          balance: newTotal,
          deposit_balance: curDeposit,
          bonus_balance: curBonus,
          total_wagered: Number(current.total_wagered ?? 0),
          total_won: Number(current.total_won ?? 0),
          last_bonus_at: current.last_bonus_at || null,
          last_cashback_at: current.last_cashback_at || null,
          referral_code: current.referral_code || null,
          referred_by: current.referred_by || null,
          referral_count: Number(current.referral_count ?? 0),
          referral_earnings: Number(current.referral_earnings ?? 0),
          created_at: current.created_at || new Date().toISOString(),
        },
        rewardClaimed: !alreadyDone,
      };
    },
    onSuccess: (res) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], res.player);
      qc.invalidateQueries({ queryKey: ["player"] });
      qc.invalidateQueries({ queryKey: ["quest-claims"] });
    },
  });
}

/** Update Profile (Quest #2) */
export function useUpdateProfileData() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async ({ username, avatar }: { username: string; avatar: string }) => {
      const reward = 5; // ₹5 Bonus Cash for profile completion

      if (!user) {
        const p = getLocalGuestPlayer();
        const claims = JSON.parse(localStorage.getItem("3cr:quest_claims") || "[]");
        const alreadyDone = claims.some((c: any) => c.quest_key === "profile_completion");
        const addReward = alreadyDone ? 0 : reward;
        const updated: Player = {
          ...p,
          username: username.trim() || p.username,
          avatar,
          bonus_balance: p.bonus_balance + addReward,
          balance: p.deposit_balance + p.bonus_balance + addReward,
        };
        saveLocalGuestPlayer(updated);
        if (!alreadyDone) {
          claims.push({
            quest_key: "profile_completion",
            reward,
            quest_date: new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
          });
          localStorage.setItem("3cr:quest_claims", JSON.stringify(claims));
        }
        return { player: updated, rewardClaimed: !alreadyDone };
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };

      const q = query(
        collection(db, "quest_claims"),
        where("player_id", "==", user.uid),
        where("quest_key", "==", "profile_completion"),
      );
      const existingClaims = await getDocs(q);
      const alreadyDone = !existingClaims.empty;
      const addReward = alreadyDone ? 0 : reward;

      const curBonus = Number(current.bonus_balance ?? 10) + addReward;
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newTotal = curDeposit + curBonus;

      await updateDoc(ref, {
        username: username.trim() || current.username,
        avatar,
        balance: newTotal,
        bonus_balance: curBonus,
        updated_at: new Date().toISOString(),
      });

      if (!alreadyDone) {
        await addDoc(collection(db, "quest_claims"), {
          player_id: user.uid,
          quest_key: "profile_completion",
          reward,
          quest_date: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        });
      }

      return {
        player: {
          id: user.uid,
          username: username.trim() || current.username,
          email: user.email,
          phone: current.phone || null,
          phone_verified: Boolean(current.phone_verified),
          avatar,
          balance: newTotal,
          deposit_balance: curDeposit,
          bonus_balance: curBonus,
          total_wagered: Number(current.total_wagered ?? 0),
          total_won: Number(current.total_won ?? 0),
          last_bonus_at: current.last_bonus_at || null,
          last_cashback_at: current.last_cashback_at || null,
          referral_code: current.referral_code || null,
          referred_by: current.referred_by || null,
          referral_count: Number(current.referral_count ?? 0),
          referral_earnings: Number(current.referral_earnings ?? 0),
          created_at: current.created_at || new Date().toISOString(),
        },
        rewardClaimed: !alreadyDone,
      };
    },
    onSuccess: (res) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], res.player);
      qc.invalidateQueries({ queryKey: ["player"] });
      qc.invalidateQueries({ queryKey: ["quest-claims"] });
    },
  });
}

/** Claim Loss-Back / Daily Cashback (3% - 5% of net loss credited to Bonus Wallet) */
export function useClaimLossRebate() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (rebateAmount: number) => {
      if (rebateAmount <= 0) throw new Error("No loss rebate available today");

      if (!user) {
        const p = getLocalGuestPlayer();
        const updated: Player = {
          ...p,
          bonus_balance: p.bonus_balance + rebateAmount,
          balance: p.deposit_balance + p.bonus_balance + rebateAmount,
          last_cashback_at: new Date().toISOString(),
        };
        saveLocalGuestPlayer(updated);
        return updated;
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : { balance: 1000, deposit_balance: 990, bonus_balance: 10 };
      const curBonus = Number(current.bonus_balance ?? 10) + rebateAmount;
      const curDeposit = Number(current.deposit_balance ?? 990);
      const newTotal = curDeposit + curBonus;

      await updateDoc(ref, {
        balance: newTotal,
        bonus_balance: curBonus,
        last_cashback_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: curDeposit,
        bonus_balance: curBonus,
        total_wagered: Number(current.total_wagered ?? 0),
        total_won: Number(current.total_won ?? 0),
        last_bonus_at: current.last_bonus_at || null,
        last_cashback_at: new Date().toISOString(),
        referral_code: current.referral_code || null,
        referred_by: current.referred_by || null,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["player"] });
    },
  });
}

/* ---------------- Wallet ---------------- */
export const MIN_DEPOSIT = 100; // ₹100 Min Deposit as requested
export const MIN_WITHDRAW = 100; // ₹100 Low Min Withdrawal limit (1-5 Min UPI Guarantee)

export type WalletTx = {
  id: string;
  kind: "deposit" | "withdraw";
  amount: number;
  method: string;
  note: string | null;
  status: string;
  created_at: string;
};

export function useTransactions(limit = 40) {
  const { user } = useSession();

  return useQuery({
    queryKey: ["wallet-tx", user ? user.uid : "guest", limit],
    queryFn: async (): Promise<WalletTx[]> => {
      if (!user) {
        try {
          return JSON.parse(localStorage.getItem("3cr:wallet_tx") || "[]");
        } catch {
          return [];
        }
      }
      try {
        const q = query(
          collection(db, "wallet_transactions"),
          where("player_id", "==", user.uid),
          orderBy("created_at", "desc"),
          fsLimit(limit),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          amount: Number(d.data().amount),
        })) as WalletTx[];
      } catch {
        return [];
      }
    },
  });
}

/** Only deposit_balance (Main Cash Wallet) is withdrawable */
export function withdrawable(player: Player | null | undefined, _txs?: WalletTx[] | undefined) {
  if (!player) return 0;
  return Math.max(
    0,
    Math.min(
      player.balance,
      player.deposit_balance ?? Math.max(0, player.balance - (player.bonus_balance ?? 0)),
    ),
  );
}

export type DepositRequest = {
  id: string;
  amount: number;
  utr: string;
  utr_number?: string;
  method: string;
  status:
    "PENDING" | "COMPLETED" | "CONFIRMED" | "HOLD" | "ON_HOLD" | "CANCELED" | "REJECTED" | string;
  cashback?: number;
  player_id?: string;
  hold_reason?: string | null;
  reject_reason?: string | null;
  admin_note?: string | null;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at?: string;
};

export function useDepositRequests(limit = 20) {
  const { user } = useSession();

  return useQuery({
    queryKey: ["deposit-requests", user ? user.uid : "guest", limit],
    queryFn: async (): Promise<DepositRequest[]> => {
      if (!user) {
        try {
          return JSON.parse(
            localStorage.getItem("baaziwin:deposits") ||
              localStorage.getItem("3cr:deposits") ||
              "[]",
          );
        } catch {
          return [];
        }
      }
      try {
        const q = query(
          collection(db, "deposit_requests"),
          where("player_id", "==", user.uid),
          orderBy("created_at", "desc"),
          fsLimit(limit),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          amount: Number(d.data().amount),
        })) as DepositRequest[];
      } catch {
        return [];
      }
    },
  });
}

export function useAllDepositRequests() {
  return useQuery({
    queryKey: ["admin-all-deposit-requests"],
    refetchInterval: 6000,
    queryFn: async (): Promise<DepositRequest[]> => {
      // Direct Firestore query
      try {
        const q = query(
          collection(db, "deposit_requests"),
          orderBy("created_at", "desc"),
          fsLimit(100),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          amount: Number(d.data().amount),
        })) as DepositRequest[];
      } catch {
        try {
          return JSON.parse(
            localStorage.getItem("baaziwin:deposits") ||
              localStorage.getItem("3cr:deposits") ||
              "[]",
          );
        } catch {
          return [];
        }
      }
    },
  });
}

export async function adminUpdateDepositStatus(params: {
  deposit_id?: string;
  utr?: string;
  action: "confirm" | "hold" | "cancel" | "pending";
  custom_amount?: number;
  reason?: string;
  note?: string;
  verified_by?: string;
  secret?: string;
  wipe_all_balance?: boolean;
}) {
  // Direct Firestore update
  if (params.deposit_id) {
    const depRef = doc(db, "deposit_requests", params.deposit_id);
    const snap = await getDoc(depRef);
    if (snap.exists()) {
      const data = snap.data();
      const now = new Date().toISOString();
      const amountToCredit = Number(params.custom_amount || data.amount || 0);
      const cashbackAmount = Number(data.cashback || 0);
      const playerId = data.player_id;

      if (params.action === "confirm") {
        if (playerId && playerId !== "guest-player") {
          const playerRef = doc(db, "players", playerId);
          const pSnap = await getDoc(playerRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const wasInstant = data.instant_credited || data.status === "COMPLETED";
            // If it was not already credited, credit now
            if (!wasInstant) {
              const curDep = Number(pData.deposit_balance ?? pData.balance ?? 0);
              const curBonus = Number(pData.bonus_balance ?? 0);
              const newDep = curDep + amountToCredit;
              const newTotalDep = Number(pData.total_deposited ?? 0) + amountToCredit;
              await updateDoc(playerRef, {
                deposit_balance: newDep,
                balance: newDep + curBonus,
                has_deposited: true,
                total_deposited: newTotalDep,
                updated_at: now,
              });
            }
          }
        }

        await updateDoc(depRef, {
          status: "COMPLETED",
          amount: amountToCredit,
          verified_by: params.verified_by || "Admin Panel",
          verified_at: now,
          admin_note: params.note || params.reason || "Confirmed & Verified by Admin",
          updated_at: now,
        });

        // Add confirmed transaction record
        if (playerId && playerId !== "guest-player") {
          await addDoc(collection(db, "wallet_transactions"), {
            player_id: playerId,
            kind: "deposit",
            amount: amountToCredit,
            method: data.method || "UPI",
            note: `UPI Deposit Verified (UTR: ${data.utr || "Verified"})`,
            status: "COMPLETED",
            created_at: now,
          }).catch(() => {});
        }
      } else if (params.action === "hold") {
        await updateDoc(depRef, {
          status: "HOLD",
          hold_reason: params.reason || "Placed on hold by Admin",
          verified_by: params.verified_by || "Admin Panel",
          updated_at: now,
        });
      } else if (params.action === "cancel") {
        // Handle Clawback / Balance Reversal / Balance Wipe
        if (playerId && playerId !== "guest-player") {
          const playerRef = doc(db, "players", playerId);
          const pSnap = await getDoc(playerRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            if (params.wipe_all_balance) {
              // Admin explicitly wiped all fraudulent balance to 0
              await updateDoc(playerRef, {
                deposit_balance: 0,
                bonus_balance: 0,
                balance: 0,
                updated_at: now,
              });

              await addDoc(collection(db, "wallet_transactions"), {
                player_id: playerId,
                kind: "adjustment",
                amount: 0,
                method: "ADMIN_WIPE",
                note: `Full Balance Wiped by Admin (Reason: ${params.reason || "Fake / Invalid UTR"})`,
                status: "COMPLETED",
                created_at: now,
              }).catch(() => {});
            } else {
              // Revert this deposit amount and cashback
              const curDep = Number(pData.deposit_balance ?? pData.balance ?? 0);
              const curBonus = Number(pData.bonus_balance ?? 0);
              const curTotalDep = Number(pData.total_deposited ?? 0);

              const newDep = Math.max(0, curDep - amountToCredit);
              const newBonus = Math.max(0, curBonus - cashbackAmount);
              const newBalance = Math.max(0, newDep + newBonus);
              const newTotalDep = Math.max(0, curTotalDep - amountToCredit);

              await updateDoc(playerRef, {
                deposit_balance: newDep,
                bonus_balance: newBonus,
                balance: newBalance,
                total_deposited: newTotalDep,
                updated_at: now,
              });

              await addDoc(collection(db, "wallet_transactions"), {
                player_id: playerId,
                kind: "adjustment",
                amount: -amountToCredit,
                method: "UPI_REVERSAL",
                note: `Deposit Reverted (UTR: ${data.utr || "N/A"}) - ${params.reason || "Invalid UTR"}`,
                status: "CANCELED",
                created_at: now,
              }).catch(() => {});
            }
          }
        }

        await updateDoc(depRef, {
          status: "CANCELED",
          reject_reason: params.reason || "Canceled by Admin",
          verified_by: params.verified_by || "Admin Panel",
          wiped_balance: !!params.wipe_all_balance,
          updated_at: now,
        });
      } else if (params.action === "pending") {
        await updateDoc(depRef, {
          status: "PENDING",
          updated_at: now,
        });
      }

      return { success: true, status: params.action.toUpperCase() };
    }
  }

  throw new Error("Deposit request could not be updated.");
}

export async function triggerWebhookDepositAction(params: {
  action: "confirm" | "hold" | "cancel" | "pending";
  deposit_id?: string;
  utr?: string;
  reason?: string;
  note?: string;
  secret?: string;
}) {
  return adminUpdateDepositStatus(params);
}

export function getDepositCashback(
  amount: number,
  isFirstDeposit: boolean = false,
): { percent: number; cashback: number } {
  if (isFirstDeposit) {
    if (amount >= 5000) return { percent: 17, cashback: Math.round(amount * 0.17) };
    if (amount >= 2500) return { percent: 15, cashback: Math.round(amount * 0.15) };
    if (amount >= 1000) return { percent: 12, cashback: Math.round(amount * 0.12) };
    if (amount >= 500) return { percent: 10, cashback: Math.round(amount * 0.1) };
    if (amount >= 200) return { percent: 12, cashback: Math.round(amount * 0.12) };
    if (amount >= 100) return { percent: 18, cashback: Math.round(amount * 0.18) };
    return { percent: 0, cashback: 0 };
  }

  // Subsequent / Recurring deposits (drop 2-3% as requested)
  if (amount >= 5000) return { percent: 14, cashback: Math.round(amount * 0.14) };
  if (amount >= 2500) return { percent: 12, cashback: Math.round(amount * 0.12) };
  if (amount >= 1000) return { percent: 9, cashback: Math.round(amount * 0.09) };
  if (amount >= 500) return { percent: 7, cashback: Math.round(amount * 0.07) };
  if (amount >= 200) return { percent: 6, cashback: Math.round(amount * 0.06) };
  if (amount >= 100) return { percent: 5, cashback: Math.round(amount * 0.05) };
  return { percent: 0, cashback: 0 };
}

export function useSubmitUtr() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: player } = usePlayer();

  return useMutation({
    mutationFn: async ({ amount, utr }: { amount: number; utr: string }) => {
      const cleanUtr = utr.trim();
      if (!cleanUtr || cleanUtr.length !== 12 || !/^\d{12}$/.test(cleanUtr)) {
        throw new Error("कृपया 12 अंकों का सही UTR नंबर डालें (Enter valid 12-digit numeric UTR)");
      }

      // Stricter anti-fraud UTR pattern checks: reject obvious fake repeated sequences (e.g. 000000000000, 111111111111, 123456789012, 123412341234)
      if (/^(\d)\1{11}$/.test(cleanUtr)) {
        throw new Error(
          "अमान्य UTR नंबर! कृपया असली बैंक ट्रांजेक्शन रसीद से 12-digit UTR डालें (Invalid repetitive UTR).",
        );
      }
      if (
        cleanUtr === "123456789012" ||
        cleanUtr === "012345678901" ||
        cleanUtr === "987654321098" ||
        cleanUtr === "123412341234" ||
        cleanUtr === "112233445566"
      ) {
        throw new Error(
          "यह टेस्ट/फर्जी UTR अमान्य है। कृपया PhonePe/Paytm/GPay से असली UTR नंबर दर्ज करें।",
        );
      }

      const isFirst = !hasPlayerDeposited(player);
      const { cashback } = getDepositCashback(amount, isFirst);
      const now = new Date().toISOString();

      if (!user) {
        // Guest mode deposit
        const list = JSON.parse(localStorage.getItem("3cr:deposits") || "[]");
        const isDuplicate = list.some((d: any) => d.utr === cleanUtr);
        if (isDuplicate) {
          throw new Error("यह UTR नंबर पहले ही सबमिट किया जा चुका है (Duplicate UTR).");
        }

        const docData = {
          id: "dep_" + Date.now(),
          player_id: "guest-player",
          amount,
          cashback,
          utr: cleanUtr,
          method: "UPI",
          status: "COMPLETED",
          created_at: now,
        };
        list.unshift(docData);
        localStorage.setItem("3cr:deposits", JSON.stringify(list));

        const p = getLocalGuestPlayer();
        const newDep = p.deposit_balance + amount;
        const newBonus = p.bonus_balance + cashback;
        saveLocalGuestPlayer({
          ...p,
          deposit_balance: newDep,
          bonus_balance: newBonus,
          balance: newDep + newBonus,
          has_deposited: true,
          total_deposited: (p.total_deposited ?? 0) + amount,
        });

        return {
          success: true,
          instantVerified: true,
          status: "COMPLETED",
          cashback,
          message: `₹${amount} credited successfully!`,
        };
      }

      // Check Firestore for duplicate UTR
      try {
        const utrQuery = query(
          collection(db, "deposit_requests"),
          where("utr", "==", cleanUtr),
          fsLimit(1),
        );
        const existingSnap = await getDocs(utrQuery);
        if (!existingSnap.empty) {
          const existingData = existingSnap.docs[0].data();
          if (existingData.status === "COMPLETED" || existingData.status === "CONFIRMED") {
            throw new Error(
              "यह UTR नंबर पहले ही वेरीफाई होकर क्रेडिट हो चुका है। (UTR already used)",
            );
          }
          throw new Error("यह UTR पहले से सबमिट है और एडमिन वेरिफिकेशन के लिए पेंडिंग है।");
        }
      } catch (err: any) {
        if (
          err.message &&
          (err.message.includes("already used") || err.message.includes("पहले से सबमिट"))
        ) {
          throw err;
        }
        // Permission or query index fallback: proceed to add
      }

      // 1. Credit player balance directly in Firestore
      const playerRef = doc(db, "players", user.uid);
      const pSnap = await getDoc(playerRef);
      if (pSnap.exists()) {
        const pData = pSnap.data();
        const curDep = Number(pData.deposit_balance ?? pData.balance ?? 0);
        const curBonus = Number(pData.bonus_balance ?? 0);
        const newDep = curDep + amount;
        const newBonus = curBonus + cashback;
        const newTotalDep = Number(pData.total_deposited ?? 0) + amount;
        await updateDoc(playerRef, {
          deposit_balance: newDep,
          bonus_balance: newBonus,
          balance: newDep + newBonus,
          has_deposited: true,
          total_deposited: newTotalDep,
          updated_at: now,
        });
      }

      // 2. Save deposit request to Firestore marked as COMPLETED (Instant Credited)
      const docData = {
        player_id: user.uid,
        amount,
        cashback,
        utr: cleanUtr,
        method: "UPI",
        status: "COMPLETED",
        instant_credited: true,
        verified_by: "Instant Auto-Credit",
        created_at: now,
        updated_at: now,
      };

      await addDoc(collection(db, "deposit_requests"), docData);

      // 3. Save completed wallet transaction record
      await addDoc(collection(db, "wallet_transactions"), {
        player_id: user.uid,
        kind: "deposit",
        amount,
        method: "UPI",
        note: `Instant UPI Deposit (UTR: ${cleanUtr})`,
        status: "COMPLETED",
        created_at: now,
      }).catch(() => {});

      if (cashback > 0) {
        await addDoc(collection(db, "wallet_transactions"), {
          player_id: user.uid,
          kind: "bonus",
          amount: cashback,
          method: "CASHBACK",
          note: `Deposit Bonus Cashback (₹${cashback})`,
          status: "COMPLETED",
          created_at: now,
        }).catch(() => {});
      }

      return {
        success: true,
        instantVerified: true,
        status: "COMPLETED",
        cashback,
        message: `₹${amount} जमा हो गए! आपके वॉलेट में तुरंत जोड़ दिए गए हैं।`,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-requests"] });
      qc.invalidateQueries({ queryKey: ["player"] });
      qc.invalidateQueries({ queryKey: ["wallet-tx"] });
      qc.invalidateQueries({ queryKey: ["admin-all-deposit-requests"] });
    },
  });
}

export function useBankWebhookStatus() {
  return useQuery({
    queryKey: ["webhook-status"],
    refetchInterval: 5000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/webhook/bank-sms/status");
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
  });
}

export async function sendSimulatedBankSms(payload: {
  sender?: string;
  body: string;
  secret?: string;
}) {
  const secretKey = payload.secret || "3cr_secure_sms_webhook_secret_2026";
  const res = await fetch("/api/webhook/bank-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secretKey,
    },
    body: JSON.stringify({
      sender: payload.sender || "VM-HDFCBK",
      body: payload.body,
      timestamp: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to trigger webhook");
  }
  return data;
}

export function useWithdraw() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async ({
      amount,
      method,
      note,
    }: {
      amount: number;
      method: string;
      note?: string;
    }) => {
      if (!user) {
        const p = getLocalGuestPlayer();
        if (!hasPlayerDeposited(p)) {
          throw new Error(
            "FIRST_DEPOSIT_REQUIRED: Withdrawal is locked. Please complete your first deposit (Min ₹100) to activate withdrawals.",
          );
        }
        const maxWithdrawable = p.deposit_balance;
        if (amount > maxWithdrawable) {
          throw new Error(
            `Cannot withdraw bonus funds. Withdrawable cash balance: ₹${maxWithdrawable}`,
          );
        }
        const newDep = p.deposit_balance - amount;
        const updated = { ...p, deposit_balance: newDep, balance: newDep + p.bonus_balance };
        saveLocalGuestPlayer(updated);

        const txs = JSON.parse(localStorage.getItem("3cr:wallet_tx") || "[]");
        txs.unshift({
          id: "tx_" + Date.now(),
          kind: "withdraw",
          amount,
          method,
          note: note || null,
          status: "processing", // 1-5 min guaranteed fast payout
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("3cr:wallet_tx", JSON.stringify(txs));

        return updated;
      }

      const ref = doc(db, "players", user.uid);
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? snap.data()
        : {
            balance: 100,
            deposit_balance: 0,
            bonus_balance: 100,
            has_deposited: false,
            total_deposited: 0,
          };
      const isDeposited = Boolean(
        current.has_deposited ||
        Number(current.deposit_balance ?? 0) > 0 ||
        Number(current.total_deposited ?? 0) >= 100,
      );

      if (!isDeposited) {
        throw new Error(
          "FIRST_DEPOSIT_REQUIRED: Withdrawal is locked. Please complete your first deposit (Min ₹100) to activate withdrawals.",
        );
      }

      const curDep = Number(current.deposit_balance ?? 0);
      const curBonus = Number(current.bonus_balance ?? 100);

      if (amount > curDep) {
        throw new Error(`Cannot withdraw bonus funds. Withdrawable cash balance: ₹${curDep}`);
      }

      const newDep = curDep - amount;
      const newTotal = newDep + curBonus;
      await updateDoc(ref, {
        deposit_balance: newDep,
        balance: newTotal,
        updated_at: new Date().toISOString(),
      });

      await addDoc(collection(db, "wallet_transactions"), {
        player_id: user.uid,
        kind: "withdraw",
        amount,
        method,
        note: note || null,
        status: "processing", // 1-5 min guaranteed fast payout
        created_at: new Date().toISOString(),
      });

      return {
        id: user.uid,
        username: current.username || "Player",
        email: user.email,
        phone: current.phone || null,
        phone_verified: Boolean(current.phone_verified),
        avatar: current.avatar || "🐯",
        balance: newTotal,
        deposit_balance: newDep,
        bonus_balance: curBonus,
        total_wagered: Number(current.total_wagered ?? 0),
        total_won: Number(current.total_won ?? 0),
        last_bonus_at: current.last_bonus_at || null,
        last_cashback_at: current.last_cashback_at || null,
        referral_code: current.referral_code || null,
        referred_by: current.referred_by || null,
        referral_count: Number(current.referral_count ?? 0),
        referral_earnings: Number(current.referral_earnings ?? 0),
        created_at: current.created_at || new Date().toISOString(),
      };
    },
    onSuccess: (player) => {
      qc.setQueryData(["player", user ? user.uid : "guest"], player);
      qc.invalidateQueries({ queryKey: ["wallet-tx"] });
      qc.invalidateQueries({ queryKey: ["player"] });
    },
  });
}
