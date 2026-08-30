import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import { Sparkles, Camera, Play, Volume2, HelpCircle, Layers, RefreshCw } from "lucide-react";
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

type RiskLevel = "low" | "medium" | "high";

const MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [16, 9, 2, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 2, 9, 16],
  medium: [33, 14, 4, 2, 1.3, 0.7, 0.4, 0.7, 1.3, 2, 4, 14, 33],
  high: [100, 30, 10, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 10, 30, 100],
};

const ROWS = 12;
const PEG_SPACING_X = 0.55;
const PEG_SPACING_Y = 0.5;

export function Plinko3D({ bet, balance, busy, settle, isDeposited, onRequireDeposit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [dropping, setDropping] = useState<boolean>(false);
  const [lastOutcome, setLastOutcome] = useState<{ mult: number; bin: number } | null>(null);
  const [cameraAngle, setCameraAngle] = useState<"front" | "side" | "top">("front");
  const [activeStake, setActiveStake] = useState<number>(bet);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const activeBallsRef = useRef<
    {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      x: number;
      y: number;
      z: number;
      targetBin: number;
      step: number;
      totalSteps: number;
    }[]
  >([]);

  /* Update active stake when bet changes */
  useEffect(() => {
    setActiveStake(bet);
  }, [bet]);

  /* ------------------- Camera Angle Switcher ------------------- */
  useEffect(() => {
    if (!cameraRef.current) return;
    if (cameraAngle === "front") {
      cameraRef.current.position.set(0, 0, 8.5);
      cameraRef.current.lookAt(0, -0.5, 0);
    } else if (cameraAngle === "side") {
      cameraRef.current.position.set(3.2, 1.5, 7.5);
      cameraRef.current.lookAt(0, -0.5, 0);
    } else if (cameraAngle === "top") {
      cameraRef.current.position.set(0, 4.0, 7.0);
      cameraRef.current.lookAt(0, -0.8, 0);
    }
  }, [cameraAngle]);

  /* ------------------- Initialize 3D Plinko Physics Board ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.5);
    camera.lookAt(0, -0.5, 0);
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
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Warm Ambient and Spotlight
    const ambientLight = new THREE.AmbientLight(0xfffaed, 0.9);
    scene.add(ambientLight);

    const topSpot = new THREE.SpotLight(0x38bdf8, 3.5, 20, Math.PI / 3, 0.4);
    topSpot.position.set(0, 5, 4);
    scene.add(topSpot);

    // 1. Backboard Glass & Metallic Perimeter
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.3,
    });
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(7.2, 7.8, 0.2), boardMat);
    backboard.position.set(0, -0.4, -0.15);
    scene.add(backboard);

    // 2. Brass Pegs Grid (Pyramid)
    const pegGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12);
    const pegMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
    });

    for (let r = 0; r < ROWS; r++) {
      const pegsInRow = r + 3;
      const startX = -((pegsInRow - 1) * PEG_SPACING_X) / 2;
      const posY = 2.4 - r * PEG_SPACING_Y;

      for (let c = 0; c < pegsInRow; c++) {
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.rotation.x = Math.PI / 2;
        peg.position.set(startX + c * PEG_SPACING_X, posY, 0);
        scene.add(peg);
      }
    }

    // 3. Multiplier Slot Base Shelves
    const binCount = MULTIPLIERS[risk].length;
    const binWidth = (7.0 - 0.4) / binCount;

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Update active falling balls physics
      for (let i = activeBallsRef.current.length - 1; i >= 0; i--) {
        const ball = activeBallsRef.current[i];
        ball.step++;

        const t = ball.step / ball.totalSteps;
        const progress = Math.min(t, 1.0);

        // Fall trajectory calculation
        const startY = 3.0;
        const endY = -3.2;
        const currentY = startY + (endY - startY) * progress;

        // X trajectory with randomized deflections towards target bin
        const binTargetX = -2.8 + (ball.targetBin / (binCount - 1)) * 5.6;
        const bounceWobble = Math.sin(progress * Math.PI * (ROWS - 1)) * 0.15;
        const currentX = binTargetX * progress + bounceWobble * (1 - progress);

        ball.mesh.position.set(currentX, currentY, 0.05);

        if (ball.step >= ball.totalSteps) {
          // Ball reached slot
          scene.remove(ball.mesh);
          activeBallsRef.current.splice(i, 1);
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
  }, [risk]);

  /* ------------------- Drop Physics Ball ------------------- */
  const dropBall = async () => {
    if (dropping || busy || !sceneRef.current) return;
    if (isDeposited === false && onRequireDeposit) {
      onRequireDeposit();
      return;
    }
    if (activeStake > balance) {
      toast.error("Insufficient coins for this bet");
      return;
    }
    setDropping(true);
    playSfx("chip");

    const multipliers = MULTIPLIERS[risk];
    const binCount = multipliers.length;

    // Weighted Gaussian Randomness towards center bins, rare edge jackpots
    let rSum = 0;
    for (let i = 0; i < binCount; i++) {
      rSum += Math.random();
    }
    const targetBin = Math.min(Math.floor(rSum), binCount - 1);
    const winMult = multipliers[targetBin];

    // Create 3D Glowing Ball Mesh
    const ballGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      metalness: 0.4,
      roughness: 0.2,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set((Math.random() - 0.5) * 0.2, 3.0, 0.05);
    sceneRef.current.add(ballMesh);

    activeBallsRef.current.push({
      mesh: ballMesh,
      vx: 0,
      vy: 0,
      vz: 0,
      x: 0,
      y: 3.0,
      z: 0.05,
      targetBin,
      step: 0,
      totalSteps: 120, // 2 seconds
    });

    // Simulate bouncing clicks
    for (let s = 1; s <= 6; s++) {
      setTimeout(() => {
        playSfx("deal");
      }, s * 280);
    }

    setTimeout(async () => {
      setDropping(false);
      setLastOutcome({ mult: winMult, bin: targetBin });

      if (winMult >= 2.0) {
        confetti({ particleCount: 70, spread: 60 });
        playSfx("bigwin");
        toast.success(
          `🎯 PLINKO JACKPOT! Multiplier ${winMult}x · Won +${formatCoins(activeStake * winMult)}`,
        );
      } else if (winMult >= 1.0) {
        playSfx("win");
        toast.success(`Plinko Win! ${winMult}x · +${formatCoins(activeStake * winMult)}`);
      } else {
        playSfx("lose");
      }

      await settle(winMult, { risk, targetBin, mult: winMult }, activeStake);
    }, 2200);
  };

  const multipliers = MULTIPLIERS[risk];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D Physics Stage */}
      <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Small Side Camera & Risk Controls */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setCameraAngle((a) => (a === "front" ? "side" : a === "side" ? "top" : "front"))
            }
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-md backdrop-blur-md hover:bg-surface-high transition active:scale-95"
            title="Change Camera Angle"
          >
            <Camera className="size-3.5 text-primary" />
            <span className="font-mono uppercase">{cameraAngle}</span>
          </button>
        </div>

        {/* Multiplier Bins Floor Display */}
        <div className="absolute bottom-1 inset-x-2 flex items-center justify-between gap-0.5 pointer-events-none">
          {multipliers.map((m, idx) => (
            <div
              key={`bin-${idx}-${m}`}
              className={`flex-1 rounded py-1 text-center font-mono text-[9px] font-black border transition ${
                lastOutcome?.bin === idx
                  ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg"
                  : m >= 10
                    ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                    : m >= 2
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-border bg-surface-high/90 text-muted-foreground"
              }`}
            >
              {m}x
            </div>
          ))}
        </div>
      </div>

      {/* Risk Selectors */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase text-muted-foreground">Physics Risk:</span>
        <div className="flex gap-1">
          {(["low", "medium", "high"] as RiskLevel[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRisk(r)}
              disabled={dropping}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition ${
                risk === r
                  ? "bg-primary text-primary-foreground shadow"
                  : "border border-border bg-surface-high text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Drop Ball Action CTA */}
      <button
        type="button"
        onClick={dropBall}
        disabled={dropping || busy || activeStake > balance}
        className="h-12 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground shadow-lg transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Play className="size-4 fill-current" />
        {dropping ? "SPHERE IN MOTION…" : `DROP 3D SPHERE · STAKE ${formatCoins(activeStake)}`}
      </button>
    </div>
  );
}
