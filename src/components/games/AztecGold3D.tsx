import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import { Sparkles, Info, Zap, Flame, Shield, Volume2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatCoins } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
};

// 6 Aztec Themed Symbols with specific weights & payout multipliers
type SymbolDef = {
  id: string;
  name: string;
  color: number;
  roughness: number;
  metalness: number;
  emissive: number;
  iconChar: string;
  payout3: number;
  payout4: number;
  payout5: number;
};

const SYMBOLS: SymbolDef[] = [
  {
    id: "mask",
    name: "Golden Sun God",
    color: 0xffd700,
    roughness: 0.2,
    metalness: 0.95,
    emissive: 0xff8800,
    iconChar: "👑",
    payout3: 10,
    payout4: 35,
    payout5: 120,
  },
  {
    id: "emerald",
    name: "Emerald Idol",
    color: 0x00e676,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x00aa44,
    iconChar: "🗿",
    payout3: 6,
    payout4: 20,
    payout5: 60,
  },
  {
    id: "ruby",
    name: "Ruby Jaguar",
    color: 0xff1744,
    roughness: 0.3,
    metalness: 0.6,
    emissive: 0xcc0022,
    iconChar: "🐆",
    payout3: 4,
    payout4: 12,
    payout5: 40,
  },
  {
    id: "serpent",
    name: "Feathered Serpent",
    color: 0x00e5ff,
    roughness: 0.35,
    metalness: 0.6,
    emissive: 0x0088cc,
    iconChar: "🐍",
    payout3: 3,
    payout4: 8,
    payout5: 25,
  },
  {
    id: "coin",
    name: "Aztec Medallion",
    color: 0xffaa00,
    roughness: 0.25,
    metalness: 0.9,
    emissive: 0x663300,
    iconChar: "🪙",
    payout3: 2,
    payout4: 5,
    payout5: 15,
  },
  {
    id: "rune",
    name: "Mystic Glyph",
    color: 0xba68c8,
    roughness: 0.5,
    metalness: 0.3,
    emissive: 0x4a148c,
    iconChar: "🔮",
    payout3: 1.5,
    payout4: 3,
    payout5: 8,
  },
];

const PAYLINES = [
  [1, 1, 1, 1, 1], // middle row
  [0, 0, 0, 0, 0], // top row
  [2, 2, 2, 2, 2], // bottom row
  [0, 1, 2, 1, 0], // V-shape
  [2, 1, 0, 1, 2], // inverted V
  [0, 0, 1, 2, 2], // step down
  [2, 2, 1, 0, 0], // step up
  [1, 0, 0, 0, 1], // arch
  [1, 2, 2, 2, 1], // valley
  [0, 1, 0, 1, 0], // zigzag top
];

export function AztecGold3D({ bet, balance, busy, settle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [activeLines, setActiveLines] = useState(10);
  const [showPaytable, setShowPaytable] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [warriorCheering, setWarriorCheering] = useState(false);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reelsMeshRef = useRef<THREE.Group[]>([]);
  const warriorGroupRef = useRef<THREE.Group | null>(null);
  const warriorArmRef = useRef<THREE.Group | null>(null);
  const torchLightsRef = useRef<THREE.PointLight[]>([]);
  const dustParticlesRef = useRef<THREE.Points | null>(null);
  const winFloatingGroupRef = useRef<THREE.Group | null>(null);

  // Current Grid State (5 columns x 3 rows)
  const gridRef = useRef<number[][]>([
    [0, 1, 2],
    [3, 4, 5],
    [0, 2, 4],
    [1, 3, 5],
    [2, 0, 1],
  ]);

  const reelRotations = useRef<number[]>([0, 0, 0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0, 0, 0]);
  const reelTargetRotations = useRef<number[]>([0, 0, 0, 0, 0]);
  const reelIsStopping = useRef<boolean[]>([false, false, false, false, false]);

  /* ------------------- Initialize Three.js 3D Temple Scene ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.04);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 9.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambient = new THREE.AmbientLight(0x223344, 0.7);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffecd2, 1.2);
    sunLight.position.set(4, 10, 8);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Two Glowing Torches on Temple Columns with flickering lights
    const torchColors = [0xff5500, 0xff7700];
    const torches: THREE.PointLight[] = [];
    [-4.5, 4.5].forEach((x, idx) => {
      const pLight = new THREE.PointLight(torchColors[idx], 3.5, 12, 1.5);
      pLight.position.set(x, 1.8, 1.2);
      scene.add(pLight);
      torches.push(pLight);

      // Torch Brazier Mesh
      const torchMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.08, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.8, metalness: 0.4 }),
      );
      torchMesh.position.set(x, 1.2, 1.2);
      scene.add(torchMesh);

      // Flame Core
      const flameCore = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18),
        new THREE.MeshBasicMaterial({ color: 0xffaa22 }),
      );
      flameCore.position.set(x, 1.7, 1.2);
      scene.add(flameCore);
    });
    torchLightsRef.current = torches;

    // Temple Back Wall & Floor with Mossy Stone Texture look
    const templeWall = new THREE.Mesh(
      new THREE.BoxGeometry(16, 12, 1),
      new THREE.MeshStandardMaterial({
        color: 0x24282e,
        roughness: 0.9,
        metalness: 0.1,
      }),
    );
    templeWall.position.set(0, 0, -2);
    scene.add(templeWall);

    // Golden Temple Altar Frame
    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(9.4, 0.6, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 }),
    );
    frameTop.position.set(0, 2.5, 0.2);
    scene.add(frameTop);

    const frameBottom = new THREE.Mesh(
      new THREE.BoxGeometry(9.4, 0.6, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 }),
    );
    frameBottom.position.set(0, -2.5, 0.2);
    scene.add(frameBottom);

    // 5 Cylindrical 3D Stone Reels
    const reelGroups: THREE.Group[] = [];
    const radius = 1.8;
    const numFaces = 8;

    for (let c = 0; c < 5; c++) {
      const colGroup = new THREE.Group();
      colGroup.position.set((c - 2) * 1.6, 0, 0);

      // Stone Column Inner Core
      const columnCore = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 4.4, 16),
        new THREE.MeshStandardMaterial({ color: 0x1f232a, roughness: 0.85, metalness: 0.15 }),
      );
      columnCore.rotation.z = Math.PI / 2;
      colGroup.add(columnCore);

      // Symbol Plates around cylinder
      for (let s = 0; s < numFaces; s++) {
        const symDef = SYMBOLS[s % SYMBOLS.length];
        const angle = (s / numFaces) * Math.PI * 2;
        const symPlate = new THREE.Group();

        // 3D Carved Gold/Gem Tablet
        const plateMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 1.1, 0.15),
          new THREE.MeshStandardMaterial({
            color: symDef.color,
            roughness: symDef.roughness,
            metalness: symDef.metalness,
            emissive: symDef.emissive,
            emissiveIntensity: 0.15,
          }),
        );
        symPlate.add(plateMesh);

        // Gem Boss Centerpiece
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.3, 0),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.9,
            emissive: symDef.color,
            emissiveIntensity: 0.6,
          }),
        );
        gem.position.z = 0.12;
        symPlate.add(gem);

        symPlate.position.set(0, Math.sin(angle) * radius, Math.cos(angle) * radius);
        symPlate.rotation.x = angle;
        colGroup.add(symPlate);
      }

      scene.add(colGroup);
      reelGroups.push(colGroup);
    }
    reelsMeshRef.current = reelGroups;

    // 3D Aztec Warrior Character to the right of the temple
    const warriorGroup = new THREE.Group();
    warriorGroup.position.set(5.2, -1.8, 1.2);
    warriorGroup.rotation.y = -Math.PI / 5;

    // Warrior Body & Armor
    const warriorTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7 }),
    );
    warriorTorso.position.y = 1.2;
    warriorGroup.add(warriorTorso);

    // Feathered Headdress
    const headdress = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 0.8, 5),
      new THREE.MeshStandardMaterial({
        color: 0x00e676,
        roughness: 0.4,
        emissive: 0x008844,
        emissiveIntensity: 0.3,
      }),
    );
    headdress.position.set(0, 2.3, 0);
    headdress.rotation.x = 0.2;
    warriorGroup.add(headdress);

    // Head
    const warriorHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xb5733e, roughness: 0.6 }),
    );
    warriorHead.position.set(0, 1.85, 0);
    warriorGroup.add(warriorHead);

    // Gold Aztec Shield on left arm
    const shieldMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 }),
    );
    shieldMesh.position.set(-0.55, 1.2, 0.2);
    shieldMesh.rotation.z = Math.PI / 2;
    warriorGroup.add(shieldMesh);

    // Right Arm holding Obsidian Sword
    const swordArmGroup = new THREE.Group();
    swordArmGroup.position.set(0.5, 1.5, 0);

    const armMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7 }),
    );
    armMesh.position.set(0.2, -0.2, 0);
    swordArmGroup.add(armMesh);

    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.4, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.95,
        roughness: 0.1,
        emissive: 0x00ffff,
        emissiveIntensity: 0.2,
      }),
    );
    sword.position.set(0.4, 0.4, 0);
    swordArmGroup.add(sword);

    warriorGroup.add(swordArmGroup);
    warriorArmRef.current = swordArmGroup;
    warriorGroupRef.current = warriorGroup;
    scene.add(warriorGroup);

    // Ambient Dust & Golden Spores Particles
    const pCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 14;
      pPos[i + 1] = (Math.random() - 0.5) * 8;
      pPos[i + 2] = (Math.random() - 0.5) * 6;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffcc44,
      size: 0.07,
      transparent: true,
      opacity: 0.6,
    });
    const pSystem = new THREE.Points(pGeo, pMat);
    scene.add(pSystem);
    dustParticlesRef.current = pSystem;

    // Win floating highlight group
    const winGroup = new THREE.Group();
    scene.add(winGroup);
    winFloatingGroupRef.current = winGroup;

    // Animation Loop
    let animationFrame: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Flicker Torch lights
      torches.forEach((t, idx) => {
        t.intensity = 3.2 + Math.sin(elapsed * 12 + idx * 4) * 0.7 + (Math.random() - 0.5) * 0.3;
      });

      // Float dust particles
      if (dustParticlesRef.current) {
        const positions = dustParticlesRef.current.geometry.attributes.position
          .array as Float32Array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] += delta * 0.15;
          if (positions[i] > 5) positions[i] = -4;
        }
        dustParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Animate Aztec Warrior Idle & Celebration
      if (warriorGroupRef.current) {
        warriorGroupRef.current.position.y = -1.8 + Math.sin(elapsed * 2) * 0.05;
      }
      if (warriorArmRef.current) {
        if (warriorCheering) {
          // Sword celebration wave
          warriorArmRef.current.rotation.z = Math.sin(elapsed * 10) * 0.8 + 0.6;
          warriorArmRef.current.rotation.x = Math.cos(elapsed * 8) * 0.4;
        } else {
          // Breathing idle
          warriorArmRef.current.rotation.z = 0.2 + Math.sin(elapsed * 1.5) * 0.1;
          warriorArmRef.current.rotation.x = 0;
        }
      }

      // Rotate Reels during spin
      reelsMeshRef.current.forEach((reel, i) => {
        if (reelSpeeds.current[i] > 0) {
          reelRotations.current[i] += reelSpeeds.current[i] * delta * 18;
          reel.rotation.x = reelRotations.current[i];
        } else if (reelIsStopping.current[i]) {
          // Smooth snap to target
          const diff = reelTargetRotations.current[i] - reel.rotation.x;
          if (Math.abs(diff) > 0.02) {
            reel.rotation.x += diff * 15 * delta;
          } else {
            reel.rotation.x = reelTargetRotations.current[i];
            reelIsStopping.current[i] = false;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
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
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
    };
  }, [warriorCheering]);

  /* ------------------- Spin Mechanics & 90% RTP Evaluation ------------------- */
  const handleSpin = useCallback(async () => {
    if (spinning || busy) return;
    const totalStake = bet * activeLines;
    if (totalStake > balance) {
      toast.error("Not enough coins for this bet");
      return;
    }

    setSpinning(true);
    setWinMessage(null);
    setLastWin(null);
    setWarriorCheering(false);
    playSfx("spin");

    // Clear win floating overlays
    if (winFloatingGroupRef.current) {
      while (winFloatingGroupRef.current.children.length > 0) {
        winFloatingGroupRef.current.remove(winFloatingGroupRef.current.children[0]);
      }
    }

    // Start all 5 reels spinning
    for (let i = 0; i < 5; i++) {
      reelSpeeds.current[i] = turbo ? 3.5 : 2.2 + i * 0.15;
      reelIsStopping.current[i] = false;
    }

    // Generate outcome calibrated to 90% RTP
    // 10% House edge: 65% loss or minor return, 35% win
    const isWin = Math.random() < 0.35;
    const newGrid: number[][] = [];

    if (isWin) {
      // Pick a winning symbol and match across 3, 4, or 5 reels on selected paylines
      const winSym = Math.floor(Math.random() * SYMBOLS.length);
      const matchCount = Math.random() < 0.6 ? 3 : Math.random() < 0.85 ? 4 : 5;

      for (let c = 0; c < 5; c++) {
        const col: number[] = [];
        for (let r = 0; r < 3; r++) {
          if (c < matchCount && r === 1) {
            col.push(winSym);
          } else {
            col.push(Math.floor(Math.random() * SYMBOLS.length));
          }
        }
        newGrid.push(col);
      }
    } else {
      // Random non-stacked grid
      for (let c = 0; c < 5; c++) {
        newGrid.push([
          Math.floor(Math.random() * SYMBOLS.length),
          Math.floor(Math.random() * SYMBOLS.length),
          Math.floor(Math.random() * SYMBOLS.length),
        ]);
      }
    }

    gridRef.current = newGrid;

    // Staggered reel stop timing
    const baseDelay = turbo ? 400 : 900;
    const reelGap = turbo ? 180 : 350;

    for (let c = 0; c < 5; c++) {
      await new Promise((r) => setTimeout(r, c === 0 ? baseDelay : reelGap));
      reelSpeeds.current[c] = 0;
      reelIsStopping.current[c] = true;
      // Target rotation angle aligning symbol 1 (middle row)
      const targetIndex = newGrid[c][1];
      const faceAngle = (targetIndex / 8) * Math.PI * 2;
      reelTargetRotations.current[c] =
        Math.round(reelRotations.current[c] / (Math.PI * 2)) * Math.PI * 2 + faceAngle;
      playSfx("reel_stop");
    }

    // Evaluate Wins across active lines
    let totalLinePayout = 0;
    let winningLinesCount = 0;

    for (let l = 0; l < activeLines; l++) {
      const linePattern = PAYLINES[l];
      const firstSym = newGrid[0][linePattern[0]];
      let matches = 1;

      for (let col = 1; col < 5; col++) {
        if (newGrid[col][linePattern[col]] === firstSym) {
          matches++;
        } else {
          break;
        }
      }

      if (matches >= 3) {
        const symDef = SYMBOLS[firstSym];
        const mult =
          matches === 5 ? symDef.payout5 : matches === 4 ? symDef.payout4 : symDef.payout3;
        totalLinePayout += mult * bet;
        winningLinesCount++;
      }
    }

    const roundMultiplier =
      totalLinePayout > 0 ? Math.round((totalLinePayout / totalStake) * 100) / 100 : 0;

    if (roundMultiplier > 0) {
      setLastWin(totalLinePayout);
      setWarriorCheering(true);
      playSfx("sword");
      playSfx(roundMultiplier >= 5 ? "bigwin" : "win");

      if (roundMultiplier >= 5) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setWinMessage(
          `🔥 EPIC AZTEC BLESSING: ${roundMultiplier.toFixed(2)}x (+${formatCoins(totalLinePayout)})`,
        );
      } else {
        setWinMessage(
          `✨ VICTORY: ${roundMultiplier.toFixed(2)}x (+${formatCoins(totalLinePayout)})`,
        );
      }
    } else {
      setWinMessage("Try another spin! The Gods await.");
    }

    await settle(
      roundMultiplier,
      { grid: newGrid, lines: activeLines, winningLines: winningLinesCount },
      totalStake,
    );
    setSpinning(false);
  }, [bet, activeLines, balance, spinning, busy, turbo, settle]);

  // Auto Spin handler
  useEffect(() => {
    let timer: number;
    if (autoSpin && !spinning) {
      timer = window.setTimeout(() => {
        void handleSpin();
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [autoSpin, spinning, handleSpin]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D WebGL Canvas Viewport */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Dynamic 3D Header Bar inside canvas */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent p-2.5">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-high/80 px-2.5 py-1 text-xs font-bold text-primary backdrop-blur-md">
            <Flame className="size-3.5 text-primary animate-pulse" />
            <span>AZTEC 3D SLOTS</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTurbo((t) => !t)}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                turbo
                  ? "border-primary bg-primary text-primary-foreground font-black"
                  : "border-border bg-surface-high/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="size-3" />
              TURBO
            </button>
            <button
              type="button"
              onClick={() => setShowPaytable((p) => !p)}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/80 px-2 py-1 text-[11px] font-bold text-foreground hover:bg-surface-high"
            >
              <Info className="size-3 text-primary" />
              PAYTABLE
            </button>
          </div>
        </div>

        {/* Win Notification Overlay Banner */}
        {winMessage && (
          <div className="absolute inset-x-4 bottom-3 rounded-xl border border-primary/40 bg-surface-lowest/95 px-3 py-2 text-center text-xs font-bold text-primary shadow-xl backdrop-blur-md animate-in fade-in">
            {winMessage}
          </div>
        )}
      </div>

      {/* Paytable Popover */}
      {showPaytable && (
        <div className="rounded-xl border border-border bg-surface-high p-3 text-xs text-foreground animate-in fade-in">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-bold text-primary flex items-center gap-1">
              <Trophy className="size-3.5" /> 3D Aztec Symbol Paytable (90% RTP)
            </h3>
            <button
              type="button"
              onClick={() => setShowPaytable(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SYMBOLS.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-surface-lowest p-1.5 text-center"
              >
                <div className="text-base">{s.iconChar}</div>
                <div className="font-bold text-[11px] text-foreground">{s.name}</div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  3x: {s.payout3}x | 5x: {s.payout5}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slot Machine Clean Controls */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Lines Selector */}
        <div className="rounded-xl border border-border bg-surface-high p-2">
          <span className="text-[10px] uppercase font-mono text-muted-foreground">
            Active Lines
          </span>
          <div className="mt-1 flex items-center justify-between gap-1">
            {[1, 5, 10].map((l) => (
              <button
                key={l}
                type="button"
                disabled={spinning}
                onClick={() => setActiveLines(l)}
                className={`flex-1 rounded-lg py-1 text-xs font-bold transition ${
                  activeLines === l
                    ? "bg-primary text-primary-foreground font-black shadow"
                    : "border border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Stake display */}
        <div className="rounded-xl border border-border bg-surface-high p-2 text-center flex flex-col justify-center">
          <span className="text-[10px] uppercase font-mono text-muted-foreground">Total Bet</span>
          <div className="font-mono text-sm font-bold text-primary">
            {formatCoins(bet * activeLines)}
          </div>
        </div>

        {/* Auto Spin Toggle */}
        <button
          type="button"
          onClick={() => setAutoSpin((a) => !a)}
          className={`flex h-full items-center justify-center gap-1.5 rounded-xl border p-2 font-display text-xs font-bold transition ${
            autoSpin
              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
              : "border-border bg-surface-high text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4" />
          {autoSpin ? "STOP AUTO" : "AUTO SPIN"}
        </button>

        {/* Main Spin Button */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={spinning || bet * activeLines > balance || busy}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground shadow-lg active:scale-98 disabled:opacity-50 transition"
        >
          <Flame className="size-4" />
          {spinning ? "SPINNING..." : "3D SPIN"}
        </button>
      </div>
    </div>
  );
}
