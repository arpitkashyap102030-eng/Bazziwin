import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Shield,
  User,
  Plus,
  Hand,
  ArrowUpRight,
  Camera,
  HelpCircle,
  X,
  Layers,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatCoins } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
  isDeposited?: boolean;
  onRequireDeposit?: () => void;
};

type Card = {
  suit: "♠" | "♥" | "♦" | "♣";
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
  value: number;
};

const SUITS: ("♠" | "♥" | "♦" | "♣")[] = ["♠", "♥", "♦", "♣"];
const RANKS: { rank: Card["rank"]; value: number }[] = [
  { rank: "A", value: 11 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
];

function drawCard(): Card {
  const s = SUITS[Math.floor(Math.random() * SUITS.length)];
  const r = RANKS[Math.floor(Math.random() * RANKS.length)];
  return { suit: s, rank: r.rank, value: r.value };
}

function calculateHand(cards: Card[]): { score: number; isSoft: boolean } {
  let total = 0;
  let aces = 0;
  cards.forEach((c) => {
    total += c.value;
    if (c.rank === "A") aces++;
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { score: total, isSoft: aces > 0 };
}

/* Helper to render a card mesh on the 3D table surface */
function createCardMesh(card: Card, faceUp: boolean): THREE.Group {
  const cardGroup = new THREE.Group();

  // Card Base
  const baseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.01, 1.0),
    new THREE.MeshStandardMaterial({
      color: faceUp ? 0xfbfbfe : 0x1e3a8a,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );
  cardGroup.add(baseMesh);

  // Border Trim
  const borderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.008, 1.02),
    new THREE.MeshStandardMaterial({
      color: faceUp ? (card.suit === "♥" || card.suit === "♦" ? 0xdc2626 : 0x18181b) : 0xf59e0b,
      roughness: 0.4,
    }),
  );
  cardGroup.add(borderMesh);

  return cardGroup;
}

export function Blackjack3D({ bet, balance, busy, settle, isDeposited, onRequireDeposit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dealer_turn" | "finished">(
    "idle",
  );
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [dealerExpression, setDealerExpression] = useState<"neutral" | "smile" | "nod">("neutral");
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);
  const [activeStake, setActiveStake] = useState<number>(bet);
  const [cameraAngle, setCameraAngle] = useState<"front" | "close" | "overhead">("front");
  const [showRules, setShowRules] = useState<boolean>(false);

  // Three.js Scene References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dealerGroupRef = useRef<THREE.Group | null>(null);
  const dealerHeadRef = useRef<THREE.Group | null>(null);
  const dealerArmRef = useRef<THREE.Group | null>(null);
  const tableCardsGroupRef = useRef<THREE.Group | null>(null);

  /* Update camera position when cameraAngle changes */
  useEffect(() => {
    if (!cameraRef.current) return;
    if (cameraAngle === "front") {
      cameraRef.current.position.set(0, 3.4, 5.0);
      cameraRef.current.lookAt(0, 0.8, -0.6);
    } else if (cameraAngle === "close") {
      cameraRef.current.position.set(0, 2.6, 3.4);
      cameraRef.current.lookAt(0, 0.5, 0.2);
    } else if (cameraAngle === "overhead") {
      cameraRef.current.position.set(0, 6.2, 2.0);
      cameraRef.current.lookAt(0, 0, 0.2);
    }
  }, [cameraAngle]);

  /* ------------------- Initialize VIP 3D Blackjack Table ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 3.4, 5.0);
    camera.lookAt(0, 0.8, -0.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Warm Ambient and Table Spotlight
    const ambient = new THREE.AmbientLight(0xfffaed, 0.9);
    scene.add(ambient);

    const tableSpot = new THREE.SpotLight(0xfff3d6, 3.2, 20, Math.PI / 3, 0.35, 1.2);
    tableSpot.position.set(0, 6.5, 2.0);
    tableSpot.castShadow = true;
    scene.add(tableSpot);

    // 1. Semi-Circular Casino Green Table Felt with Gold Lettering Ring
    const tableFelt = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.6, 0.25, 36, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x064e3b,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    tableFelt.rotation.y = Math.PI;
    tableFelt.position.set(0, -0.12, 0);
    scene.add(tableFelt);

    // Gold Table Arc Rim Inlay
    const feltRim = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 3.65, 32, 1, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.8 }),
    );
    feltRim.rotation.x = -Math.PI / 2;
    feltRim.rotation.z = Math.PI;
    feltRim.position.set(0, 0.01, 0);
    scene.add(feltRim);

    // Mahogany Padded Armrest
    const armrest = new THREE.Mesh(
      new THREE.TorusGeometry(4.6, 0.24, 16, 36, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x27170e, roughness: 0.35, metalness: 0.15 }),
    );
    armrest.rotation.x = Math.PI / 2;
    armrest.rotation.z = Math.PI;
    armrest.position.set(0, 0.04, 0);
    scene.add(armrest);

    // Dealing Shoe
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.2, metalness: 0.85 }),
    );
    shoe.position.set(2.4, 0.18, -1.2);
    shoe.rotation.y = -Math.PI / 5.5;
    scene.add(shoe);

    // Group for dynamically rendered physical 3D cards on table
    const tableCardsGroup = new THREE.Group();
    scene.add(tableCardsGroup);
    tableCardsGroupRef.current = tableCardsGroup;

    // 2. Realistic 3D Dealer in Tuxedo & Waistcoat
    const dealerGroup = new THREE.Group();
    dealerGroup.position.set(0, 0.6, -3.2);

    // Tuxedo Torso & Vest
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.5, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 }),
    );
    torso.position.y = 0.95;
    dealerGroup.add(torso);

    // White Shirt Center
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 1.1, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
    );
    shirt.position.set(0, 1.05, 0);
    dealerGroup.add(shirt);

    // Gold/Red Bowtie
    const bowtie = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.18, 4),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    );
    bowtie.position.set(0, 1.6, 0.38);
    bowtie.rotation.z = Math.PI / 2;
    dealerGroup.add(bowtie);

    // Dealer Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.05, 0);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xe5b894, roughness: 0.6 }),
    );
    headGroup.add(headMesh);

    // Sleek Dark Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1f140e, roughness: 0.8 }),
    );
    hair.position.y = 0.05;
    headGroup.add(hair);

    dealerGroup.add(headGroup);
    dealerHeadRef.current = headGroup;

    // Dealer Arm with Cuff
    const armGroup = new THREE.Group();
    armGroup.position.set(0.75, 1.35, 0.1);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 }),
    );
    arm.position.set(0, -0.35, 0.25);
    arm.rotation.x = Math.PI / 4;
    armGroup.add(arm);

    dealerGroup.add(armGroup);
    dealerArmRef.current = armGroup;

    scene.add(dealerGroup);
    dealerGroupRef.current = dealerGroup;

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle breathing motion
      if (dealerGroupRef.current) {
        dealerGroupRef.current.position.y = 0.6 + Math.sin(elapsed * 1.8) * 0.015;
      }

      // Dealer Head Gestures
      if (dealerHeadRef.current) {
        if (dealerExpression === "smile") {
          dealerHeadRef.current.rotation.x = -0.08 + Math.sin(elapsed * 4) * 0.04;
          dealerHeadRef.current.rotation.y = Math.sin(elapsed * 2) * 0.08;
        } else if (dealerExpression === "nod") {
          dealerHeadRef.current.rotation.x = Math.sin(elapsed * 8) * 0.12;
        } else {
          dealerHeadRef.current.rotation.x = Math.sin(elapsed * 0.8) * 0.02;
          dealerHeadRef.current.rotation.y = Math.sin(elapsed * 0.5) * 0.04;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [dealerExpression]);

  /* ------------------- Update 3D Table Cards on State Change ------------------- */
  useEffect(() => {
    if (!tableCardsGroupRef.current) return;
    const group = tableCardsGroupRef.current;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Render Dealer 3D Cards
    dealerCards.forEach((c, idx) => {
      const isHidden = dealerHidden && idx === 1;
      const mesh = createCardMesh(c, !isHidden);
      mesh.position.set(-0.5 + idx * 0.8, 0.04 + idx * 0.005, -1.3);
      mesh.rotation.y = (idx - 0.5) * 0.05;
      group.add(mesh);
    });

    // Render Player 3D Cards
    playerCards.forEach((c, idx) => {
      const mesh = createCardMesh(c, true);
      const total = playerCards.length;
      const offset = (idx - (total - 1) / 2) * 0.75;
      mesh.position.set(offset, 0.05 + idx * 0.005, 0.5);
      mesh.rotation.y = offset * 0.06;
      group.add(mesh);
    });
  }, [dealerCards, playerCards, dealerHidden]);

  /* ------------------- Deal Initial Cards ------------------- */
  const startNewHand = async () => {
    if (gameState === "playing" || busy) return;
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    if (bet > balance) {
      toast.error("Insufficient coins for this bet");
      return;
    }

    setActiveStake(bet);
    setOutcomeMessage(null);
    setDealerExpression("nod");
    setDealerHidden(true);

    playSfx("deal");
    const p1 = drawCard();
    const d1 = drawCard();
    const p2 = drawCard();
    const d2 = drawCard();

    setPlayerCards([p1, p2]);
    setDealerCards([d1, d2]);
    setGameState("playing");

    const playerEval = calculateHand([p1, p2]);
    const dealerEval = calculateHand([d1, d2]);

    // Check Natural Blackjack (3:2 Payout)
    if (playerEval.score === 21) {
      setDealerHidden(false);
      setGameState("finished");
      if (dealerEval.score === 21) {
        setDealerExpression("smile");
        setOutcomeMessage("Push (Both Blackjack) — Bet returned");
        await settle(1.0, { outcome: "push", playerHand: [p1, p2], dealerHand: [d1, d2] }, bet);
      } else {
        setDealerExpression("smile");
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        playSfx("bigwin");
        setOutcomeMessage(`🎉 NATURAL BLACKJACK (3:2) — +${formatCoins(bet * 2.5)}`);
        await settle(
          2.5,
          { outcome: "blackjack", playerHand: [p1, p2], dealerHand: [d1, d2] },
          bet,
        );
      }
    }
  };

  /* ------------------- Player Hit ------------------- */
  const handleHit = async () => {
    if (gameState !== "playing") return;
    playSfx("deal");
    setDealerExpression("nod");

    const nextCard = drawCard();
    const updated = [...playerCards, nextCard];
    setPlayerCards(updated);

    const { score } = calculateHand(updated);
    if (score > 21) {
      setDealerHidden(false);
      setGameState("finished");
      playSfx("lose");
      setOutcomeMessage(`💥 Bust with ${score}! Dealer wins.`);
      await settle(
        0,
        { outcome: "bust", score, playerHand: updated, dealerHand: dealerCards },
        activeStake,
      );
    }
  };

  /* ------------------- Player Stand / Dealer Turn ------------------- */
  const handleStand = async () => {
    if (gameState !== "playing") return;
    setGameState("dealer_turn");
    setDealerHidden(false);
    playSfx("click");

    let curDealer = [...dealerCards];
    let dealerScore = calculateHand(curDealer).score;

    while (dealerScore < 17) {
      await new Promise((r) => setTimeout(r, 600));
      playSfx("deal");
      const nextCard = drawCard();
      curDealer = [...curDealer, nextCard];
      setDealerCards(curDealer);
      dealerScore = calculateHand(curDealer).score;
    }

    const playerScore = calculateHand(playerCards).score;
    setGameState("finished");

    if (dealerScore > 21) {
      setDealerExpression("smile");
      confetti({ particleCount: 50, spread: 50 });
      playSfx("win");
      setOutcomeMessage(
        `🎉 Dealer Busted with ${dealerScore}! You win +${formatCoins(activeStake * 2)}`,
      );
      await settle(2.0, { outcome: "win", playerScore, dealerScore }, activeStake);
    } else if (playerScore > dealerScore) {
      setDealerExpression("smile");
      playSfx("win");
      setOutcomeMessage(
        `✨ You Win (${playerScore} vs ${dealerScore})! +${formatCoins(activeStake * 2)}`,
      );
      await settle(2.0, { outcome: "win", playerScore, dealerScore }, activeStake);
    } else if (playerScore === dealerScore) {
      setOutcomeMessage(`🤝 Push (${playerScore} vs ${dealerScore}) — Bet returned`);
      await settle(1.0, { outcome: "push", playerScore, dealerScore }, activeStake);
    } else {
      playSfx("lose");
      setOutcomeMessage(`Dealer Wins (${dealerScore} vs ${playerScore})`);
      await settle(0, { outcome: "loss", playerScore, dealerScore }, activeStake);
    }
  };

  /* ------------------- Double Down ------------------- */
  const handleDouble = async () => {
    if (gameState !== "playing" || playerCards.length !== 2) return;
    const doubleStake = activeStake * 2;
    if (doubleStake > balance) {
      toast.error("Not enough coins to Double Down");
      return;
    }

    setActiveStake(doubleStake);
    playSfx("chip");
    playSfx("deal");

    const nextCard = drawCard();
    const updated = [...playerCards, nextCard];
    setPlayerCards(updated);
    const playerScore = calculateHand(updated).score;

    if (playerScore > 21) {
      setDealerHidden(false);
      setGameState("finished");
      playSfx("lose");
      setOutcomeMessage(`💥 Bust on Double Down with ${playerScore}!`);
      await settle(0, { outcome: "bust_double", playerScore }, doubleStake);
      return;
    }

    setGameState("dealer_turn");
    setDealerHidden(false);
    let curDealer = [...dealerCards];
    let dealerScore = calculateHand(curDealer).score;

    while (dealerScore < 17) {
      await new Promise((r) => setTimeout(r, 600));
      playSfx("deal");
      const dCard = drawCard();
      curDealer = [...curDealer, dCard];
      setDealerCards(curDealer);
      dealerScore = calculateHand(curDealer).score;
    }

    setGameState("finished");

    if (dealerScore > 21 || playerScore > dealerScore) {
      setDealerExpression("smile");
      confetti({ particleCount: 70, spread: 60 });
      playSfx("bigwin");
      setOutcomeMessage(`🔥 DOUBLE DOWN VICTORY! +${formatCoins(doubleStake * 2)}`);
      await settle(2.0, { outcome: "win_double", playerScore, dealerScore }, doubleStake);
    } else if (playerScore === dealerScore) {
      setOutcomeMessage(`🤝 Double Down Push (${playerScore})`);
      await settle(1.0, { outcome: "push_double", playerScore, dealerScore }, doubleStake);
    } else {
      playSfx("lose");
      setOutcomeMessage(`Dealer Wins (${dealerScore} vs ${playerScore})`);
      await settle(0, { outcome: "loss_double", playerScore, dealerScore }, doubleStake);
    }
  };

  const playerScore = calculateHand(playerCards).score;
  const visibleDealerCards =
    dealerHidden && dealerCards.length > 0 ? [dealerCards[0]] : dealerCards;
  const dealerScore = calculateHand(visibleDealerCards).score;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D First Person Perspective Viewport - Crystal Clear Screen */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Small Side Icons for Camera & Card Rules */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-md backdrop-blur-md hover:bg-surface-high transition active:scale-95"
            title="Card Deck & Blackjack Rules"
          >
            <BookOpen className="size-3.5 text-primary" />
            <span className="font-mono uppercase">Rules</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setCameraAngle((a) =>
                a === "front" ? "close" : a === "close" ? "overhead" : "front",
              )
            }
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-md backdrop-blur-md hover:bg-surface-high transition active:scale-95"
            title="Change Camera Angle"
          >
            <Camera className="size-3.5 text-primary" />
            <span className="font-mono uppercase">{cameraAngle}</span>
          </button>
        </div>

        {/* Dealer Hand Summary Tag */}
        {dealerCards.length > 0 && (
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="rounded-full border border-border bg-surface-lowest/90 px-3 py-1 font-mono text-xs font-bold text-foreground shadow backdrop-blur-md">
              Dealer: {dealerHidden ? `${dealerScore} + ?` : dealerScore}
            </span>
          </div>
        )}

        {/* Player Hand Summary Tag */}
        {playerCards.length > 0 && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="rounded-full border border-primary/40 bg-surface-lowest/95 px-3.5 py-1 font-mono text-xs font-black text-primary shadow-lg backdrop-blur-md">
              Your Total: {playerScore}{" "}
              {playerScore === 21 && playerCards.length === 2 ? "⚡ BLACKJACK!" : ""}
            </span>
          </div>
        )}

        {/* Result Message Modal */}
        {outcomeMessage && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-primary/40 bg-surface-lowest/95 p-3 text-center text-xs font-bold text-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in z-20">
            {outcomeMessage}
          </div>
        )}
      </div>

      {/* Rules & Deck Instructions Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-low p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  How to Play & Card Rules
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface-high hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 text-xs leading-relaxed text-muted-foreground">
              {/* 1. Deck Cards Present */}
              <div className="rounded-xl border border-border bg-surface-high p-3">
                <h4 className="font-display text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Layers className="size-4 text-primary" />
                  Standard 52-Card Deck
                </h4>
                <p className="mb-2">
                  Played with full standard deck comprising 4 suits (♠ Spades, ♥ Hearts, ♦ Diamonds,
                  ♣ Clubs):
                </p>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                  <div className="rounded-lg bg-surface-lowest p-1.5 border border-border text-center">
                    <span className="font-bold text-primary">Aces (A)</span>
                    <div className="text-[10px] text-muted-foreground">1 or 11 Points</div>
                  </div>
                  <div className="rounded-lg bg-surface-lowest p-1.5 border border-border text-center">
                    <span className="font-bold text-primary">Face (K, Q, J)</span>
                    <div className="text-[10px] text-muted-foreground">10 Points each</div>
                  </div>
                  <div className="rounded-lg bg-surface-lowest p-1.5 border border-border text-center">
                    <span className="font-bold text-primary">Numbers (2–10)</span>
                    <div className="text-[10px] text-muted-foreground">Face value</div>
                  </div>
                </div>
              </div>

              {/* 2. Objective & Dealer Rules */}
              <div className="rounded-xl border border-border bg-surface-high p-3">
                <h4 className="font-display text-xs font-bold text-foreground mb-1">
                  Game Objective
                </h4>
                <p>
                  Get a total closer to <strong className="text-foreground">21</strong> than the
                  dealer without going over (busting).
                </p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  <li>
                    <strong className="text-foreground">Dealer Rule:</strong> Dealer must hit on 16
                    and stands on all 17s.
                  </li>
                  <li>
                    <strong className="text-foreground">Hit:</strong> Draw an additional card to
                    increase your total.
                  </li>
                  <li>
                    <strong className="text-foreground">Stand:</strong> Keep current hand and pass
                    turn to the dealer.
                  </li>
                  <li>
                    <strong className="text-foreground">Double Down:</strong> Double your active
                    stake and receive exactly 1 final card.
                  </li>
                </ul>
              </div>

              {/* 3. Payout Multipliers */}
              <div className="rounded-xl border border-border bg-surface-high p-3">
                <h4 className="font-display text-xs font-bold text-foreground mb-1.5">
                  Payout Multipliers
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
                    <div className="text-primary font-bold">Blackjack</div>
                    <div className="text-[10px] text-muted-foreground">3:2 (2.5x Total)</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-lowest p-2">
                    <div className="font-bold text-foreground">Standard Win</div>
                    <div className="text-[10px] text-muted-foreground">1:1 (2.0x Total)</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-lowest p-2">
                    <div className="font-bold text-muted-foreground">Push (Tie)</div>
                    <div className="text-[10px] text-muted-foreground">1:1 (Refunded)</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-5 h-11 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground shadow transition active:scale-98"
            >
              Got It · Back to Table
            </button>
          </div>
        </div>
      )}

      {/* Clean Interactive Action Controls */}
      <div>
        {gameState === "idle" || gameState === "finished" ? (
          <button
            type="button"
            onClick={startNewHand}
            disabled={busy || bet > balance}
            className="h-12 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground shadow-lg active:scale-98 disabled:opacity-50 transition"
          >
            {gameState === "finished"
              ? "DEAL NEXT HAND"
              : `DEAL 3D HAND · STAKE ${formatCoins(bet)}`}
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleHit}
              disabled={gameState !== "playing"}
              className="flex h-12 flex-col items-center justify-center rounded-xl border border-border bg-surface-high font-display text-xs font-bold text-foreground hover:bg-surface-high/80 active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-4 text-primary" />
              HIT
            </button>

            <button
              type="button"
              onClick={handleStand}
              disabled={gameState !== "playing"}
              className="flex h-12 flex-col items-center justify-center rounded-xl border border-border bg-surface-high font-display text-xs font-bold text-foreground hover:bg-surface-high/80 active:scale-95 disabled:opacity-40"
            >
              <Hand className="size-4 text-red-400" />
              STAND
            </button>

            <button
              type="button"
              onClick={handleDouble}
              disabled={
                gameState !== "playing" || playerCards.length !== 2 || activeStake * 2 > balance
              }
              className="flex h-12 flex-col items-center justify-center rounded-xl bg-primary font-display text-xs font-bold text-primary-foreground shadow active:scale-95 disabled:opacity-40"
            >
              <ArrowUpRight className="size-4" />
              DOUBLE (2x)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
