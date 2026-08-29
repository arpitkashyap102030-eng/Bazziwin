import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import { Rocket, Sparkles, Zap, AlertTriangle, ShieldCheck, Flame, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatCoins, rollCrashPoint } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
};

type BetSlotState = {
  stake: number;
  autoCashout: number;
  active: boolean;
  cashed: boolean;
  payout: number;
};

export function SpaceWarp3D({ bet, balance, busy, settle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "launching" | "flying" | "crashed">("idle");
  const [currentMult, setCurrentMult] = useState(1.0);
  const [screenCracked, setScreenCracked] = useState(false);

  // Dual Betting Slots
  const [slot1, setSlot1] = useState<BetSlotState>({
    stake: bet,
    autoCashout: 2.0,
    active: false,
    cashed: false,
    payout: 0,
  });
  const [slot2, setSlot2] = useState<BetSlotState>({
    stake: Math.max(10, Math.floor(bet / 2)),
    autoCashout: 5.0,
    active: false,
    cashed: false,
    payout: 0,
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const shipGroupRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const thrusterFlameRef = useRef<THREE.Mesh[]>([]);
  const explosionGroupRef = useRef<THREE.Group | null>(null);
  const explosionParticlesRef = useRef<
    { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3 }[]
  >([]);

  const flightStartRef = useRef(0);
  const crashPointRef = useRef(2.0);
  const animFrameRef = useRef<number | null>(null);

  /* ------------------- Initialize Three.js 3D Space Warp Environment ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040a);
    scene.fog = new THREE.FogExp2(0x02040a, 0.02);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, 1.2, 5.5);
    camera.lookAt(0, 2.0, 0);
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

    // Deep Space Lighting
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambient);

    const blueNebulaLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
    blueNebulaLight.position.set(5, 8, 5);
    scene.add(blueNebulaLight);

    const magentaLight = new THREE.PointLight(0xff007f, 2.0, 20);
    magentaLight.position.set(-6, -4, 2);
    scene.add(magentaLight);

    // Warp Starfield (1,200 stretch stars)
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 60;
      starPos[i + 1] = (Math.random() - 0.5) * 60;
      starPos[i + 2] = (Math.random() - 0.5) * 120;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.14,
      transparent: true,
      opacity: 0.8,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
    starsRef.current = starField;

    // High-Tech 3D Spaceship Model
    const shipGroup = new THREE.Group();
    shipGroup.position.set(0, 0, 0);

    // Fuselage Core
    const fuselage = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 2.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe0e6ed,
        roughness: 0.2,
        metalness: 0.85,
      }),
    );
    fuselage.rotation.x = Math.PI / 2;
    shipGroup.add(fuselage);

    // Cockpit Canopy Glow
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00bcd4,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
      }),
    );
    canopy.position.set(0, 0.22, 0.4);
    shipGroup.add(canopy);

    // Dual Swept Wings
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.04, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.4, metalness: 0.7 }),
      );
      wing.position.set(side * 0.9, 0, -0.4);
      wing.rotation.z = side * 0.1;
      shipGroup.add(wing);

      // Wingtip Plasma Thruster Pods
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8),
        new THREE.MeshStandardMaterial({
          color: 0x00e5ff,
          emissive: 0x0077ff,
          emissiveIntensity: 0.5,
        }),
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 1.5, 0, -0.4);
      shipGroup.add(pod);
    });

    // Dual Ion Plasma Thrusters
    const flames: THREE.Mesh[] = [];
    [-0.28, 0.28].forEach((x) => {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 }),
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, 0, -1.2);
      shipGroup.add(nozzle);

      // Thruster Fire Plume
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 1.4, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 }),
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, 0, -1.8);
      shipGroup.add(flame);
      flames.push(flame);
    });
    thrusterFlameRef.current = flames;

    scene.add(shipGroup);
    shipGroupRef.current = shipGroup;

    // Explosion Fragment Container
    const explosionGroup = new THREE.Group();
    scene.add(explosionGroup);
    explosionGroupRef.current = explosionGroup;

    // Render Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Dynamic Warp Star Stream
      if (starsRef.current) {
        const positions = starsRef.current.geometry.attributes.position.array as Float32Array;
        const speed = phase === "flying" ? currentMult * 8 : phase === "launching" ? 3 : 0.8;
        for (let i = 2; i < positions.length; i += 3) {
          positions[i] += delta * speed * 4;
          if (positions[i] > 30) positions[i] = -90;
        }
        starsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Ship Hover / Shake Physics
      if (shipGroupRef.current) {
        if (phase === "flying") {
          const shake = Math.min(0.08, currentMult * 0.005);
          shipGroupRef.current.position.set(
            (Math.random() - 0.5) * shake,
            1.2 + Math.sin(elapsed * 4) * 0.08,
            0,
          );
          shipGroupRef.current.rotation.z = Math.sin(elapsed * 2) * 0.08;
          shipGroupRef.current.rotation.x = -0.15;

          // Animate fire plumes
          flames.forEach((f) => {
            f.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.8, 1 + Math.random() * 0.3);
          });
        } else if (phase === "launching") {
          shipGroupRef.current.position.y = -0.5 + Math.sin(elapsed * 10) * 0.04;
        } else if (phase === "idle") {
          shipGroupRef.current.position.set(0, 0.4 + Math.sin(elapsed * 2) * 0.05, 0);
          shipGroupRef.current.rotation.set(0, 0, 0);
          flames.forEach((f) => f.scale.set(0.4, 0.4, 0.4));
        }
      }

      // Update Explosive Debris flying towards camera
      if (explosionParticlesRef.current.length > 0) {
        explosionParticlesRef.current.forEach((p) => {
          p.mesh.position.addScaledVector(p.vel, delta);
          p.mesh.rotation.x += p.rotVel.x * delta;
          p.mesh.rotation.y += p.rotVel.y * delta;
          p.mesh.rotation.z += p.rotVel.z * delta;
        });
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
  }, [phase, currentMult]);

  /* ------------------- Launch Space Flight ------------------- */
  const launchFlight = async () => {
    if (phase === "flying" || phase === "launching" || busy) return;

    const totalStake = (slot1.active ? slot1.stake : 0) + (slot2.active ? slot2.stake : 0);
    if (totalStake === 0) {
      // Auto-activate Slot 1 with current bet
      slot1.active = true;
      setSlot1((s) => ({ ...s, active: true, cashed: false, payout: 0 }));
    }
    if (totalStake > balance) {
      toast.error("Insufficient coins for active slots");
      return;
    }

    setPhase("launching");
    setScreenCracked(false);
    setCurrentMult(1.0);
    playSfx("start");

    // Clear previous explosion debris
    if (explosionGroupRef.current) {
      while (explosionGroupRef.current.children.length > 0) {
        explosionGroupRef.current.remove(explosionGroupRef.current.children[0]);
      }
    }
    explosionParticlesRef.current = [];

    // 90% RTP Provably Fair Crash Point
    const crashTarget = rollCrashPoint();
    crashPointRef.current = crashTarget;

    await new Promise((r) => setTimeout(r, 600));
    setPhase("flying");
    flightStartRef.current = performance.now();

    const flightLoop = () => {
      const now = performance.now();
      const elapsedSec = (now - flightStartRef.current) / 1000;
      // Exponential curve: e^(0.065 * t)
      const mult = Math.floor(Math.exp(0.065 * elapsedSec * 1.6) * 100) / 100;
      setCurrentMult(mult);

      // Auto Cashout Check for Slot 1
      setSlot1((s) => {
        if (s.active && !s.cashed && s.autoCashout > 1.0 && mult >= s.autoCashout) {
          playSfx("cashout");
          toast.success(
            `Slot 1 Auto Cashed @ ${s.autoCashout.toFixed(2)}x (+${formatCoins(s.stake * s.autoCashout)})`,
          );
          return { ...s, cashed: true, payout: s.stake * s.autoCashout };
        }
        return s;
      });

      // Auto Cashout Check for Slot 2
      setSlot2((s) => {
        if (s.active && !s.cashed && s.autoCashout > 1.0 && mult >= s.autoCashout) {
          playSfx("cashout");
          toast.success(
            `Slot 2 Auto Cashed @ ${s.autoCashout.toFixed(2)}x (+${formatCoins(s.stake * s.autoCashout)})`,
          );
          return { ...s, cashed: true, payout: s.stake * s.autoCashout };
        }
        return s;
      });

      // Check Crash
      if (mult >= crashTarget) {
        triggerCrash(crashTarget);
      } else {
        animFrameRef.current = requestAnimationFrame(flightLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(flightLoop);
  };

  /* ------------------- Trigger Space Crash Explosion ------------------- */
  const triggerCrash = async (finalMult: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setPhase("crashed");
    setScreenCracked(true);
    playSfx("explosion");

    // Spawn 3D High-Energy Explosive Debris chunks flying towards camera
    if (sceneRef.current && explosionGroupRef.current) {
      for (let i = 0; i < 28; i++) {
        const debrisMesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.15),
          new THREE.MeshStandardMaterial({
            color: Math.random() < 0.5 ? 0xff3d00 : 0xffa000,
            emissive: 0xff1100,
            emissiveIntensity: 0.9,
            roughness: 0.3,
            metalness: 0.9,
          }),
        );
        debrisMesh.position.set(0, 1.2, 0);
        explosionGroupRef.current.add(debrisMesh);

        explosionParticlesRef.current.push({
          mesh: debrisMesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            3 + Math.random() * 8, // Toward camera!
          ),
          rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        });
      }
    }

    // Settle Round Payouts
    let totalWin = 0;
    let totalStakeUsed = 0;

    if (slot1.active) {
      totalStakeUsed += slot1.stake;
      if (slot1.cashed) totalWin += slot1.payout;
    }
    if (slot2.active) {
      totalStakeUsed += slot2.stake;
      if (slot2.cashed) totalWin += slot2.payout;
    }

    const roundMultiplier =
      totalStakeUsed > 0 ? Math.round((totalWin / totalStakeUsed) * 100) / 100 : 0;
    await settle(roundMultiplier, { crashPoint: finalMult, slot1, slot2 }, totalStakeUsed);
  };

  /* ------------------- Manual Eject / Cashout ------------------- */
  const cashoutSlot = (slotNum: 1 | 2) => {
    if (phase !== "flying") return;
    if (slotNum === 1 && slot1.active && !slot1.cashed) {
      const payout = slot1.stake * currentMult;
      setSlot1((s) => ({ ...s, cashed: true, payout }));
      playSfx("cashout");
      toast.success(`Slot 1 Ejected @ ${currentMult.toFixed(2)}x (+${formatCoins(payout)})`);
    } else if (slotNum === 2 && slot2.active && !slot2.cashed) {
      const payout = slot2.stake * currentMult;
      setSlot2((s) => ({ ...s, cashed: true, payout }));
      playSfx("cashout");
      toast.success(`Slot 2 Ejected @ ${currentMult.toFixed(2)}x (+${formatCoins(payout)})`);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D Space Warp Viewport */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Header HUD */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent p-2.5">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-high/80 px-2.5 py-1 text-xs font-bold text-primary backdrop-blur-md">
            <Rocket className="size-3.5" />
            <span>3D SPACE WARP</span>
          </div>

          <div className="rounded-md border border-border bg-surface-high/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            CRASH 3D · 90% RTP
          </div>
        </div>

        {/* Screen Crack Overlay on Crash */}
        {screenCracked && (
          <div className="pointer-events-none absolute inset-0 bg-red-950/20 backdrop-blur-[1px] animate-in fade-in">
            <svg className="size-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M 50,50 L 20,10 M 50,50 L 80,15 M 50,50 L 90,70 M 50,50 L 15,85 M 50,50 L 35,40 M 50,50 L 65,60"
                stroke="#ef4444"
                strokeWidth="0.6"
                fill="none"
              />
              <path
                d="M 20,10 L 10,25 M 80,15 L 95,30 M 90,70 L 75,90 M 15,85 L 30,95"
                stroke="#ffffff"
                strokeWidth="0.3"
                fill="none"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-6 flex items-center justify-center">
              <div className="rounded-xl border border-red-500/60 bg-surface-lowest/95 px-4 py-2 text-center text-xs font-black text-red-400 shadow-2xl backdrop-blur-md">
                💥 WARP BREACH @ {crashPointRef.current.toFixed(2)}x
              </div>
            </div>
          </div>
        )}

        {/* Live Multiplier Digital Display */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`font-display text-4xl sm:text-5xl font-black tracking-tight ${
              phase === "crashed"
                ? "text-red-500"
                : phase === "flying"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            {currentMult.toFixed(2)}x
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {phase === "flying"
              ? "WARP ASCENT ACTIVE"
              : phase === "crashed"
                ? "WARP OVERLOAD"
                : "READY FOR LAUNCH"}
          </span>
        </div>
      </div>

      {/* Dual Betting Controls */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Slot 1 Panel */}
        <div className="rounded-xl border border-border bg-surface-high p-2.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-foreground flex items-center gap-1">
              <Rocket className="size-3.5 text-primary" /> Slot 1
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Auto: {slot1.autoCashout > 1 ? `${slot1.autoCashout}x` : "Off"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-[9px] text-muted-foreground block font-mono">BET</span>
              <input
                type="number"
                disabled={phase === "flying"}
                value={slot1.stake}
                onChange={(e) => setSlot1((s) => ({ ...s, stake: Number(e.target.value) }))}
                className="w-full h-8 rounded-lg bg-surface-lowest border border-border px-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block font-mono">AUTO EJECT</span>
              <input
                type="number"
                step="0.1"
                disabled={phase === "flying"}
                value={slot1.autoCashout}
                onChange={(e) => setSlot1((s) => ({ ...s, autoCashout: Number(e.target.value) }))}
                className="w-full h-8 rounded-lg bg-surface-lowest border border-border px-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {phase === "flying" ? (
            <button
              type="button"
              onClick={() => cashoutSlot(1)}
              disabled={!slot1.active || slot1.cashed}
              className={`w-full h-10 rounded-xl font-display text-xs font-black transition ${
                slot1.cashed
                  ? "border border-border bg-surface-lowest text-muted-foreground"
                  : "bg-primary text-primary-foreground shadow-lg active:scale-95"
              }`}
            >
              {slot1.cashed
                ? `CASHED (+${formatCoins(slot1.payout)})`
                : `EJECT (+${formatCoins(slot1.stake * currentMult)})`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSlot1((s) => ({ ...s, active: !s.active }))}
              className={`w-full h-10 rounded-xl font-display text-xs font-bold border transition ${
                slot1.active
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                  : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
              }`}
            >
              {slot1.active ? "SLOT 1 ACTIVE (READY)" : "ENABLE SLOT 1"}
            </button>
          )}
        </div>

        {/* Slot 2 Panel */}
        <div className="rounded-xl border border-border bg-surface-high p-2.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-foreground flex items-center gap-1">
              <Zap className="size-3.5 text-primary" /> Slot 2
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Auto: {slot2.autoCashout > 1 ? `${slot2.autoCashout}x` : "Off"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-[9px] text-muted-foreground block font-mono">BET</span>
              <input
                type="number"
                disabled={phase === "flying"}
                value={slot2.stake}
                onChange={(e) => setSlot2((s) => ({ ...s, stake: Number(e.target.value) }))}
                className="w-full h-8 rounded-lg bg-surface-lowest border border-border px-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block font-mono">AUTO EJECT</span>
              <input
                type="number"
                step="0.5"
                disabled={phase === "flying"}
                value={slot2.autoCashout}
                onChange={(e) => setSlot2((s) => ({ ...s, autoCashout: Number(e.target.value) }))}
                className="w-full h-8 rounded-lg bg-surface-lowest border border-border px-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {phase === "flying" ? (
            <button
              type="button"
              onClick={() => cashoutSlot(2)}
              disabled={!slot2.active || slot2.cashed}
              className={`w-full h-10 rounded-xl font-display text-xs font-black transition ${
                slot2.cashed
                  ? "border border-border bg-surface-lowest text-muted-foreground"
                  : "bg-primary text-primary-foreground shadow-lg active:scale-95"
              }`}
            >
              {slot2.cashed
                ? `CASHED (+${formatCoins(slot2.payout)})`
                : `EJECT (+${formatCoins(slot2.stake * currentMult)})`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSlot2((s) => ({ ...s, active: !s.active }))}
              className={`w-full h-10 rounded-xl font-display text-xs font-bold border transition ${
                slot2.active
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                  : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
              }`}
            >
              {slot2.active ? "SLOT 2 ACTIVE (READY)" : "ENABLE SLOT 2"}
            </button>
          )}
        </div>
      </div>

      {/* Main Launch Button */}
      <button
        type="button"
        onClick={launchFlight}
        disabled={phase === "flying" || phase === "launching" || busy}
        className="h-12 w-full rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground shadow-lg active:scale-98 disabled:opacity-50 transition"
      >
        {phase === "flying" ? "WARP ASCENT IN PROGRESS..." : "INITIATE 3D SPACE LAUNCH"}
      </button>
    </div>
  );
}
