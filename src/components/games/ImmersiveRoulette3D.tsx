import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import { Camera, RotateCcw, Volume2, Coins, Sparkles, Check, ChevronRight } from "lucide-react";
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

// Standard European Roulette Wheel Numbers in sequential pocket order (37 pockets)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type BetType =
  | { kind: "number"; value: number }
  | { kind: "color"; value: "red" | "black" }
  | { kind: "even_odd"; value: "even" | "odd" }
  | { kind: "high_low"; value: "low" | "high" }
  | { kind: "dozen"; value: 1 | 2 | 3 }
  | { kind: "column"; value: 1 | 2 | 3 };

type BetEntry = { type: BetType; amount: number };

export function ImmersiveRoulette3D({
  bet,
  balance,
  busy,
  settle,
  isDeposited,
  onRequireDeposit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [selectedBets, setSelectedBets] = useState<Map<string, BetEntry>>(
    () => new Map<string, BetEntry>(),
  );
  const [chipValue, setChipValue] = useState<number>(50);
  const [lastWinningNumber, setLastWinningNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([14, 22, 0, 7, 31, 18]);
  const [cameraMode, setCameraMode] = useState<"table" | "overhead" | "close">("table");

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wheelRotorRef = useRef<THREE.Group | null>(null);
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const targetPocketAngleRef = useRef<number>(0);

  // Physics Simulation Variables
  const wheelAngle = useRef(0);
  const wheelSpeed = useRef(0.4);
  const ballState = useRef<"idle" | "raceway" | "drop" | "bounce" | "settled">("idle");
  const ballAngle = useRef(0);
  const ballSpeed = useRef(0);
  const ballRadius = useRef(2.45);
  const ballHeight = useRef(0.45);
  const ballBounces = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  /* ------------------- Initialize Realistic 3D European Roulette Wheel ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06090e);
    scene.fog = new THREE.FogExp2(0x06090e, 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 6.2, 5.8);
    camera.lookAt(0, 0, -0.2);
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

    // Warm Casino Lighting
    const ambient = new THREE.AmbientLight(0xfff5e6, 0.9);
    scene.add(ambient);

    const mainSpot = new THREE.SpotLight(0xfffaed, 3.8, 25, Math.PI / 3.5, 0.3, 1.2);
    mainSpot.position.set(0, 8.5, 3.0);
    mainSpot.castShadow = true;
    scene.add(mainSpot);

    const rimLight = new THREE.PointLight(0xd4af37, 1.5, 15);
    rimLight.position.set(0, 3, -4);
    scene.add(rimLight);

    // 1. Polished Mahogany Outer Bowl & Table Felt Mount
    const mahoganyMat = new THREE.MeshStandardMaterial({
      color: 0x240e06,
      roughness: 0.25,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.95,
      roughness: 0.12,
    });
    const darkBrassMat = new THREE.MeshStandardMaterial({
      color: 0x8a6d2b,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Outer Mahogany Tub Structure
    const outerTub = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.4, 0.6, 48), mahoganyMat);
    outerTub.position.y = -0.15;
    scene.add(outerTub);

    // Top Polished Brass Ring
    const brassRim = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 16, 64), goldMat);
    brassRim.rotation.x = Math.PI / 2;
    brassRim.position.y = 0.18;
    scene.add(brassRim);

    // Slanted Ball Raceway (Inner Track)
    const raceway = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.5, 0.45, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x140703, roughness: 0.3 }),
    );
    raceway.position.y = 0.05;
    scene.add(raceway);

    // 8 Diamond-shaped Brass Deflectors on the Raceway Slope
    for (let d = 0; d < 8; d++) {
      const defAngle = (d * Math.PI * 2) / 8;
      const deflector = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), goldMat);
      deflector.position.set(Math.cos(defAngle) * 2.7, 0.18, Math.sin(defAngle) * 2.7);
      deflector.rotation.y = defAngle;
      scene.add(deflector);
    }

    // 2. Center Rotating Rotor Group
    const rotorGroup = new THREE.Group();

    // Rotor Sloping Cone Base
    const rotorBase = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.4, 0.2, 48), darkBrassMat);
    rotorBase.position.y = -0.05;
    rotorGroup.add(rotorBase);

    // 37 Number Pockets
    const pocketAngleStep = (Math.PI * 2) / 37;
    for (let i = 0; i < 37; i++) {
      const num = WHEEL_NUMBERS[i];
      const isGreen = num === 0;
      const isRed = RED_NUMBERS.has(num);
      const color = isGreen ? 0x059669 : isRed ? 0xdc2626 : 0x18181b;

      const pocketMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 });
      const pocketMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.45), pocketMat);
      const a = i * pocketAngleStep;
      pocketMesh.position.set(Math.sin(a) * 1.95, 0.02, Math.cos(a) * 1.95);
      pocketMesh.rotation.y = a;
      rotorGroup.add(pocketMesh);

      // Gold Divider Frets
      const fret = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.52), goldMat);
      const fretA = a + pocketAngleStep / 2;
      fret.position.set(Math.sin(fretA) * 1.95, 0.05, Math.cos(fretA) * 1.95);
      fret.rotation.y = fretA;
      rotorGroup.add(fret);
    }

    // Center Golden Turret Spindle
    const turretCone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 0.6, 24), goldMat);
    turretCone.position.y = 0.22;
    rotorGroup.add(turretCone);

    const turretTop = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), goldMat);
    turretTop.position.y = 0.55;
    rotorGroup.add(turretTop);

    // 4-prong Brass Handles on Turret
    for (let arm = 0; arm < 4; arm++) {
      const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), goldMat);
      armMesh.rotation.z = Math.PI / 2;
      armMesh.rotation.y = (arm * Math.PI) / 2;
      armMesh.position.y = 0.52;
      rotorGroup.add(armMesh);
    }

    scene.add(rotorGroup);
    wheelRotorRef.current = rotorGroup;

    // 3. Realistic Ivory Roulette Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfffff5,
        roughness: 0.1,
        metalness: 0.05,
      }),
    );
    ballMesh.position.set(0, 0.42, 2.85);
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    ballMeshRef.current = ballMesh;

    // Animation & Physics Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Continuous Wheel Rotation
      wheelAngle.current += wheelSpeed.current * delta;
      if (wheelRotorRef.current) {
        wheelRotorRef.current.rotation.y = wheelAngle.current;
      }

      // Ball Physics Simulation
      if (ballMeshRef.current) {
        if (ballState.current === "raceway") {
          // Ball spins along outer rim (opposite to wheel)
          ballAngle.current += ballSpeed.current * delta;
          ballSpeed.current *= 0.991; // Air/friction decay

          ballMeshRef.current.position.set(
            Math.sin(ballAngle.current) * ballRadius.current,
            ballHeight.current,
            Math.cos(ballAngle.current) * ballRadius.current,
          );

          // Once speed drops below threshold, ball falls down the raceway
          if (Math.abs(ballSpeed.current) < 4.2) {
            ballState.current = "drop";
          }
        } else if (ballState.current === "drop") {
          ballAngle.current += ballSpeed.current * delta;
          ballSpeed.current *= 0.975;
          ballRadius.current = THREE.MathUtils.lerp(ballRadius.current, 1.95, delta * 3.5);
          ballHeight.current = THREE.MathUtils.lerp(ballHeight.current, 0.15, delta * 3.5);

          // Bouncing off frets
          const fretBounce = Math.abs(Math.sin(ballAngle.current * 18.5)) * 0.09;
          ballMeshRef.current.position.set(
            Math.sin(ballAngle.current) * ballRadius.current,
            ballHeight.current + fretBounce,
            Math.cos(ballAngle.current) * ballRadius.current,
          );

          if (ballRadius.current < 2.02 && Math.abs(ballSpeed.current) < 1.2) {
            ballState.current = "settled";
          }
        } else if (ballState.current === "settled") {
          // Ball locked in winning pocket, rotating synchronously with the rotor
          const pocketFinalAngle = wheelAngle.current + targetPocketAngleRef.current;
          ballMeshRef.current.position.set(
            Math.sin(pocketFinalAngle) * 1.95,
            0.08,
            Math.cos(pocketFinalAngle) * 1.95,
          );
        }
      }

      // Camera Director Movement
      if (cameraRef.current) {
        if (cameraMode === "overhead") {
          cameraRef.current.position.lerp(new THREE.Vector3(0, 6.8, 0.1), delta * 4);
          cameraRef.current.lookAt(0, 0, 0);
        } else if (cameraMode === "close") {
          cameraRef.current.position.lerp(new THREE.Vector3(0, 3.6, 2.9), delta * 4);
          cameraRef.current.lookAt(0, 0.1, 0);
        } else {
          cameraRef.current.position.lerp(new THREE.Vector3(0, 6.2, 5.8), delta * 4);
          cameraRef.current.lookAt(0, 0, -0.2);
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
  }, [cameraMode]);

  /* ------------------- Add / Modify Bet on Table ------------------- */
  const addBet = (key: string, type: BetType) => {
    if (spinning) return;
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    playSfx("chip");
    setSelectedBets((prev) => {
      const next = new Map<string, BetEntry>(prev);
      const cur = next.get(key);
      const newAmt = (cur?.amount || 0) + chipValue;
      if (newAmt <= balance) {
        next.set(key, { type, amount: newAmt });
      }
      return next;
    });
  };

  const clearBets = () => {
    if (spinning) return;
    playSfx("click");
    setSelectedBets(new Map<string, BetEntry>());
  };

  /* ------------------- Spin Roulette Wheel with Physics ------------------- */
  const spinWheel = async () => {
    if (spinning || busy) return;
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    const betEntries = Array.from(selectedBets.values()) as BetEntry[];
    const totalStake = betEntries.reduce((sum, b) => sum + b.amount, 0);
    if (totalStake === 0) {
      toast.error("Please place chips on the betting table!");
      return;
    }
    if (totalStake > balance) {
      toast.error("Insufficient coins for placed chips");
      return;
    }

    setSpinning(true);
    setCameraMode("close");
    playSfx("spin");

    // Launch Ball & Accelerate Rotor
    wheelSpeed.current = 1.6;
    ballSpeed.current = -12.5;
    ballRadius.current = 2.85;
    ballHeight.current = 0.42;
    ballState.current = "raceway";

    // Determine Winning Pocket (0 to 36)
    const winningIdx = Math.floor(Math.random() * 37);
    const winningNum = WHEEL_NUMBERS[winningIdx];
    const pocketAngleStep = (Math.PI * 2) / 37;
    targetPocketAngleRef.current = winningIdx * pocketAngleStep;

    // Simulate Ball Spin Audio & Deceleration
    await new Promise((r) => setTimeout(r, 2400));
    playSfx("ball_drop");

    await new Promise((r) => setTimeout(r, 1400));
    setLastWinningNumber(winningNum);
    setHistory((h) => [winningNum, ...h].slice(0, 8));

    // Calculate Payouts
    let totalWon = 0;
    const isRed = RED_NUMBERS.has(winningNum);
    const isEven = winningNum !== 0 && winningNum % 2 === 0;
    const isLow = winningNum >= 1 && winningNum <= 18;

    selectedBets.forEach(({ type, amount }) => {
      switch (type.kind) {
        case "number":
          if (type.value === winningNum) totalWon += amount * 36;
          break;
        case "color":
          if (
            winningNum !== 0 &&
            ((type.value === "red" && isRed) || (type.value === "black" && !isRed))
          ) {
            totalWon += amount * 2;
          }
          break;
        case "even_odd":
          if (
            winningNum !== 0 &&
            ((type.value === "even" && isEven) || (type.value === "odd" && !isEven))
          ) {
            totalWon += amount * 2;
          }
          break;
        case "high_low":
          if (
            winningNum !== 0 &&
            ((type.value === "low" && isLow) || (type.value === "high" && !isLow))
          ) {
            totalWon += amount * 2;
          }
          break;
        case "dozen": {
          const doz =
            winningNum >= 1 && winningNum <= 12 ? 1 : winningNum >= 13 && winningNum <= 24 ? 2 : 3;
          if (winningNum !== 0 && type.value === doz) {
            totalWon += amount * 3;
          }
          break;
        }
        case "column": {
          const col = winningNum % 3 === 1 ? 1 : winningNum % 3 === 2 ? 2 : 3;
          if (winningNum !== 0 && type.value === col) {
            totalWon += amount * 3;
          }
          break;
        }
      }
    });

    const roundMult = totalWon > 0 ? Math.round((totalWon / totalStake) * 100) / 100 : 0;

    if (roundMult > 0) {
      playSfx(roundMult >= 5 ? "bigwin" : "win");
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      toast.success(
        `🎉 Winning Number: ${winningNum} (${isRed ? "Red" : winningNum === 0 ? "Green" : "Black"}) · Won +${formatCoins(totalWon)}!`,
      );
    } else {
      playSfx("lose");
      toast.info(
        `Number was ${winningNum} (${isRed ? "Red" : winningNum === 0 ? "Green" : "Black"}).`,
      );
    }

    await settle(
      roundMult,
      { winningNumber: winningNum, bets: Array.from(selectedBets.entries()) },
      totalStake,
    );

    setTimeout(() => {
      setCameraMode("table");
      setSpinning(false);
    }, 1800);
  };

  const betValues = Array.from(selectedBets.values()) as BetEntry[];
  const totalCurrentStake: number = betValues.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D Roulette Stage - Crystal Clear Screen */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Small Camera Button on Side */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={() =>
              setCameraMode((m) => (m === "table" ? "close" : m === "close" ? "overhead" : "table"))
            }
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-md backdrop-blur-md hover:bg-surface-high transition active:scale-95"
            title="Change Camera Angle"
          >
            <Camera className="size-3.5 text-primary" />
            <span className="font-mono uppercase">{cameraMode}</span>
          </button>
        </div>

        {/* Winning Number / History Strip */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface-lowest/90 px-2.5 py-1 shadow backdrop-blur-md">
          <span className="text-[10px] font-mono text-muted-foreground">RECENT:</span>
          {history.map((num, i) => (
            <span
              key={`roul-hist-${i}-${num}`}
              className={`size-4 rounded-full flex items-center justify-center font-mono text-[9px] font-bold ${
                num === 0
                  ? "bg-emerald-600 text-white"
                  : RED_NUMBERS.has(num)
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800 text-white"
              }`}
            >
              {num}
            </span>
          ))}
        </div>
      </div>

      {/* Clean Casino Betting Felt (Standard Single-Grid Layout) */}
      <div className="rounded-xl border border-border bg-surface-high p-2.5">
        {/* Outside Bets Grid (1-18, EVEN, RED, BLACK, ODD, 19-36) */}
        <div className="grid grid-cols-6 gap-1 mb-1.5 text-xs font-bold">
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("low", { kind: "high_low", value: "low" })}
            className={`h-8 rounded-lg border text-[11px] transition ${
              selectedBets.has("low")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            1-18 {selectedBets.get("low") && `(${selectedBets.get("low")?.amount})`}
          </button>
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("even", { kind: "even_odd", value: "even" })}
            className={`h-8 rounded-lg border text-[11px] transition ${
              selectedBets.has("even")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            EVEN {selectedBets.get("even") && `(${selectedBets.get("even")?.amount})`}
          </button>
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("red", { kind: "color", value: "red" })}
            className={`h-8 rounded-lg border text-[11px] font-black transition ${
              selectedBets.has("red")
                ? "border-red-400 bg-red-600 text-white ring-2 ring-primary"
                : "border-red-900/60 bg-red-600/90 text-white hover:bg-red-600"
            }`}
          >
            RED {selectedBets.get("red") && `(${selectedBets.get("red")?.amount})`}
          </button>
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("black", { kind: "color", value: "black" })}
            className={`h-8 rounded-lg border text-[11px] font-black transition ${
              selectedBets.has("black")
                ? "border-zinc-400 bg-zinc-900 text-white ring-2 ring-primary"
                : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            BLACK {selectedBets.get("black") && `(${selectedBets.get("black")?.amount})`}
          </button>
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("odd", { kind: "even_odd", value: "odd" })}
            className={`h-8 rounded-lg border text-[11px] transition ${
              selectedBets.has("odd")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            ODD {selectedBets.get("odd") && `(${selectedBets.get("odd")?.amount})`}
          </button>
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("high", { kind: "high_low", value: "high" })}
            className={`h-8 rounded-lg border text-[11px] transition ${
              selectedBets.has("high")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            19-36 {selectedBets.get("high") && `(${selectedBets.get("high")?.amount})`}
          </button>
        </div>

        {/* Numbers Grid (0 to 36) */}
        <div className="grid grid-cols-13 gap-0.5 text-[10px] font-bold">
          {/* 0 Green */}
          <button
            type="button"
            disabled={spinning}
            onClick={() => addBet("num_0", { kind: "number", value: 0 })}
            className={`h-9 rounded-md font-mono font-black transition ${
              selectedBets.has("num_0")
                ? "bg-emerald-500 text-white ring-2 ring-primary scale-105 z-10"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            0{" "}
            {selectedBets.get("num_0") && (
              <div className="text-[8px] font-normal font-sans">
                ({selectedBets.get("num_0")?.amount})
              </div>
            )}
          </button>

          {/* 1 to 36 */}
          {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
            const isRed = RED_NUMBERS.has(n);
            const isSelected = selectedBets.has(`num_${n}`);
            const placedAmt = selectedBets.get(`num_${n}`)?.amount;
            return (
              <button
                key={n}
                type="button"
                disabled={spinning}
                onClick={() => addBet(`num_${n}`, { kind: "number", value: n })}
                className={`h-9 rounded-md font-mono transition flex flex-col items-center justify-center ${
                  isRed
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                } ${isSelected ? "ring-2 ring-primary scale-105 z-10 shadow-md font-black" : "border border-border/40"}`}
              >
                <span>{n}</span>
                {placedAmt && (
                  <span className="text-[7px] font-sans font-bold text-primary">{placedAmt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chip Values & Bottom Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Chip Values */}
        <div className="flex items-center gap-1.5">
          {[10, 50, 100, 500, 1000].map((val) => (
            <button
              key={val}
              type="button"
              disabled={spinning}
              onClick={() => setChipValue(val)}
              className={`size-9 rounded-full border text-[11px] font-mono font-bold transition ${
                chipValue === val
                  ? "border-primary bg-primary text-primary-foreground scale-110 shadow-md font-black"
                  : "border-border bg-surface-high text-muted-foreground hover:text-foreground"
              }`}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Clear and Spin Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={spinning || selectedBets.size === 0}
            onClick={clearBets}
            className="rounded-xl border border-border bg-surface-high px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={spinWheel}
            disabled={spinning || totalCurrentStake === 0 || totalCurrentStake > balance || busy}
            className="h-11 rounded-xl bg-primary px-6 font-display text-sm font-bold text-primary-foreground shadow-lg active:scale-98 disabled:opacity-50 transition"
          >
            {spinning ? "SPINNING..." : `SPIN · STAKE ${formatCoins(totalCurrentStake || bet)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
