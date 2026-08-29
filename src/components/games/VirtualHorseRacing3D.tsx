import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import confetti from "canvas-confetti";
import { Camera, Trophy, Sparkles, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatCoins } from "@/lib/games";
import { playSfx } from "@/lib/sound";

type Props = {
  bet: number;
  balance: number;
  busy: boolean;
  settle: (multiplier: number, details: Record<string, unknown>, stake?: number) => Promise<void>;
};

// 10 Numbered Horses (0 to 9) categorized like Color Trading (Win Go)
export type HorseRunner = {
  id: number; // 0 to 9
  name: string;
  colorType: "green" | "red" | "violet";
  sizeType: "small" | "big"; // 0-4 Small, 5-9 Big
  silkHex: number;
  silkCss: string;
  coatHex: number;
  maneHex: number;
};

export const RUNNERS_10: HorseRunner[] = [
  {
    id: 0,
    name: "No. 0 Shadow",
    colorType: "violet",
    sizeType: "small",
    silkHex: 0x8b5cf6,
    silkCss: "bg-purple-600",
    coatHex: 0x18181b,
    maneHex: 0x09090b,
  },
  {
    id: 1,
    name: "No. 1 Emerald",
    colorType: "green",
    sizeType: "small",
    silkHex: 0x10b981,
    silkCss: "bg-emerald-600",
    coatHex: 0x543825,
    maneHex: 0x271910,
  },
  {
    id: 2,
    name: "No. 2 Scarlet",
    colorType: "red",
    sizeType: "small",
    silkHex: 0xef4444,
    silkCss: "bg-red-600",
    coatHex: 0x3d2010,
    maneHex: 0x1a0c05,
  },
  {
    id: 3,
    name: "No. 3 Clover",
    colorType: "green",
    sizeType: "small",
    silkHex: 0x10b981,
    silkCss: "bg-emerald-600",
    coatHex: 0x7c4a27,
    maneHex: 0x3b1f0c,
  },
  {
    id: 4,
    name: "No. 4 Crimson",
    colorType: "red",
    sizeType: "small",
    silkHex: 0xef4444,
    silkCss: "bg-red-600",
    coatHex: 0xb45309,
    maneHex: 0x78350f,
  },
  {
    id: 5,
    name: "No. 5 Mystic",
    colorType: "violet",
    sizeType: "big",
    silkHex: 0x8b5cf6,
    silkCss: "bg-purple-600",
    coatHex: 0x2d1b38,
    maneHex: 0x170b1f,
  },
  {
    id: 6,
    name: "No. 6 Ruby",
    colorType: "red",
    sizeType: "big",
    silkHex: 0xef4444,
    silkCss: "bg-red-600",
    coatHex: 0xd97706,
    maneHex: 0x92400e,
  },
  {
    id: 7,
    name: "No. 7 Jade",
    colorType: "green",
    sizeType: "big",
    silkHex: 0x10b981,
    silkCss: "bg-emerald-600",
    coatHex: 0x452a19,
    maneHex: 0x201108,
  },
  {
    id: 8,
    name: "No. 8 Flame",
    colorType: "red",
    sizeType: "big",
    silkHex: 0xef4444,
    silkCss: "bg-red-600",
    coatHex: 0x61361c,
    maneHex: 0x2b1509,
  },
  {
    id: 9,
    name: "No. 9 Basil",
    colorType: "green",
    sizeType: "big",
    silkHex: 0x10b981,
    silkCss: "bg-emerald-600",
    coatHex: 0x8a5b3a,
    maneHex: 0x472a16,
  },
];

type BetType =
  | { kind: "color"; value: "green" | "red" | "violet" }
  | { kind: "size"; value: "big" | "small" }
  | { kind: "number"; value: number };

type PlacedBet = {
  key: string;
  type: BetType;
  amount: number;
};

/* Construct an anatomically proportioned 3D Thoroughbred Horse */
function createHorseModel(horse: HorseRunner): {
  group: THREE.Group;
  frontLeftLeg: THREE.Group;
  frontRightLeg: THREE.Group;
  backLeftLeg: THREE.Group;
  backRightLeg: THREE.Group;
  neckGroup: THREE.Group;
  tailMesh: THREE.Mesh;
} {
  const root = new THREE.Group();

  const coatMat = new THREE.MeshStandardMaterial({
    color: horse.coatHex,
    roughness: 0.65,
    metalness: 0.15,
  });
  const maneMat = new THREE.MeshStandardMaterial({
    color: horse.maneHex,
    roughness: 0.85,
    metalness: 0.1,
  });
  const silkMat = new THREE.MeshStandardMaterial({
    color: horse.silkHex,
    roughness: 0.35,
    metalness: 0.25,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x26170d, roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b0, roughness: 0.5 });
  const hoofMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
    metalness: 0.4,
  });

  // 1. Barrel / Main Torso
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.2, 12), coatMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.15, 0);
  root.add(barrel);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), coatMat);
  chest.position.set(0, 1.15, 0.55);
  root.add(chest);

  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), coatMat);
  rump.position.set(0, 1.18, -0.55);
  root.add(rump);

  // 2. Neck & Head
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 1.25, 0.6);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.8, 10), coatMat);
  neck.position.set(0, 0.32, 0.22);
  neck.rotation.x = -Math.PI / 4.2;
  neckGroup.add(neck);

  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.18), maneMat);
  mane.position.set(0, 0.38, 0.12);
  mane.rotation.x = -Math.PI / 4.2;
  neckGroup.add(mane);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.36), coatMat);
  skull.position.set(0, 0.68, 0.52);
  neckGroup.add(skull);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.3), coatMat);
  muzzle.position.set(0, 0.62, 0.76);
  muzzle.rotation.x = 0.25;
  neckGroup.add(muzzle);

  // Ears
  [-0.08, 0.08].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), coatMat);
    ear.position.set(ex, 0.88, 0.48);
    ear.rotation.x = 0.2;
    neckGroup.add(ear);
  });

  root.add(neckGroup);

  // 3. Saddle & Jockey with Number
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.65), silkMat);
  saddle.position.set(0, 1.38, 0);
  root.add(saddle);

  const jockeyTorso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.24), silkMat);
  jockeyTorso.position.set(0, 1.62, 0.08);
  jockeyTorso.rotation.x = 0.45;
  root.add(jockeyTorso);

  const jockeyHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), skinMat);
  jockeyHead.position.set(0, 1.88, 0.22);
  root.add(jockeyHead);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), silkMat);
  helmet.position.set(0, 1.9, 0.22);
  root.add(helmet);

  // Helper for articulated horse leg
  const createLeg = (isBack: boolean) => {
    const legGroup = new THREE.Group();
    const upperRadius = isBack ? 0.14 : 0.1;
    const upperLen = 0.52;
    const lowerLen = 0.5;

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(upperRadius, 0.08, upperLen, 8),
      coatMat,
    );
    thigh.position.y = -upperLen / 2;
    legGroup.add(thigh);

    const lowerGroup = new THREE.Group();
    lowerGroup.position.y = -upperLen;

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, lowerLen, 8), coatMat);
    shin.position.y = -lowerLen / 2;
    lowerGroup.add(shin);

    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.12), hoofMat);
    hoof.position.set(0, -lowerLen, 0.02);
    lowerGroup.add(hoof);

    legGroup.add(lowerGroup);
    return legGroup;
  };

  const frontLeftLeg = createLeg(false);
  frontLeftLeg.position.set(-0.2, 1.05, 0.45);
  root.add(frontLeftLeg);

  const frontRightLeg = createLeg(false);
  frontRightLeg.position.set(0.2, 1.05, 0.45);
  root.add(frontRightLeg);

  const backLeftLeg = createLeg(true);
  backLeftLeg.position.set(-0.22, 1.08, -0.45);
  root.add(backLeftLeg);

  const backRightLeg = createLeg(true);
  backRightLeg.position.set(0.22, 1.08, -0.45);
  root.add(backRightLeg);

  // Flowing Tail
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 8), maneMat);
  tailMesh.position.set(0, 1.15, -0.75);
  tailMesh.rotation.x = -Math.PI / 3;
  root.add(tailMesh);

  return {
    group: root,
    frontLeftLeg,
    frontRightLeg,
    backLeftLeg,
    backRightLeg,
    neckGroup,
    tailMesh,
  };
}

export function VirtualHorseRacing3D({ bet, balance, busy, settle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [racing, setRacing] = useState(false);
  const [cameraMode, setCameraMode] = useState<"side" | "overhead" | "finish" | "jockey">("side");
  const [chipValue, setChipValue] = useState<number>(50);
  const [bets, setBets] = useState<Map<string, PlacedBet>>(() => new Map<string, PlacedBet>());
  const [lastWinner, setLastWinner] = useState<HorseRunner | null>(null);
  const [history, setHistory] = useState<number[]>([3, 7, 0, 2, 8, 5, 1, 6]);

  // Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const horsesDataRef = useRef<
    Array<{
      def: HorseRunner;
      model: ReturnType<typeof createHorseModel>;
      laneX: number;
      zPos: number;
      speed: number;
      gallopPhase: number;
    }>
  >([]);

  const raceProgressRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const leadHorseZRef = useRef<number>(-35);

  const TRACK_START_Z = -35;
  const TRACK_FINISH_Z = 35;
  const TRACK_LENGTH = TRACK_FINISH_Z - TRACK_START_Z; // 70 units straight

  /* ------------------- Initialize 3D Straight Turf Track ------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1622);
    scene.fog = new THREE.FogExp2(0x0a1622, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(16, 12, -20);
    camera.lookAt(0, 1.5, -10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Natural Sunlight & Stadium Floodlights
    const sunLight = new THREE.DirectionalLight(0xfff8e7, 3.2);
    sunLight.position.set(25, 40, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambientLight);

    // 1. Straight Turf Track Ground & Lanes (10 Straight Lanes: X from -9 to +9)
    const turfMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a1f, // Rich green turf
      roughness: 0.8,
      metalness: 0.05,
    });
    const trackGround = new THREE.Mesh(new THREE.PlaneGeometry(24, 120), turfMat);
    trackGround.rotation.x = -Math.PI / 2;
    trackGround.position.set(0, 0, 0);
    scene.add(trackGround);

    // 10 Lane Dividers (White Chalk Stripes)
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (let lane = -5; lane <= 5; lane++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 90), chalkMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(lane * 2.0, 0.01, 0);
      scene.add(stripe);
    }

    // Outer White Running Rail Fences
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    [-10.2, 10.2].forEach((rx) => {
      const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 100, 8), railMat);
      topRail.rotation.x = Math.PI / 2;
      topRail.position.set(rx, 1.1, 0);
      scene.add(topRail);

      // Posts along fence
      for (let z = -45; z <= 45; z += 6) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), railMat);
        post.position.set(rx, 0.6, z);
        scene.add(post);
      }
    });

    // 2. Starting Gate Stalls at Z = -35
    const gateFrameMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.2,
    });
    const startGantry = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 0.8), gateFrameMat);
    startGantry.position.set(0, 3.2, TRACK_START_Z);
    scene.add(startGantry);

    // 3. 10 Numbered Finishing Holes / Stalls at Z = 35
    const finishArchMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.15,
    });
    const finishBanner = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 0.5), finishArchMat);
    finishBanner.position.set(0, 4.0, TRACK_FINISH_Z);
    scene.add(finishBanner);

    // 10 Numbered Finishing Catch Gates / Holes (0 to 9)
    for (let i = 0; i < 10; i++) {
      const laneX = (i - 4.5) * 2.0;
      const runner = RUNNERS_10[i];
      const stallMat = new THREE.MeshStandardMaterial({
        color: runner.silkHex,
        roughness: 0.3,
        metalness: 0.4,
      });

      const gateHole = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 16), stallMat);
      gateHole.position.set(laneX, 0.08, TRACK_FINISH_Z + 1.2);
      scene.add(gateHole);
    }

    // 4. Build 10 Realistic 3D Horses in 10 Straight Lanes
    const horsesData: Array<{
      def: HorseRunner;
      model: ReturnType<typeof createHorseModel>;
      laneX: number;
      zPos: number;
      speed: number;
      gallopPhase: number;
    }> = [];

    RUNNERS_10.forEach((runner, i) => {
      const laneX = (i - 4.5) * 2.0;
      const model = createHorseModel(runner);
      model.group.position.set(laneX, 0, TRACK_START_Z);
      model.group.rotation.y = 0; // Running straight along +Z
      scene.add(model.group);

      horsesData.push({
        def: runner,
        model,
        laneX,
        zPos: TRACK_START_Z,
        speed: 0,
        gallopPhase: i * 0.7,
      });
    });

    horsesDataRef.current = horsesData;

    // Animation & Render Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Animate Horse Legs, Spine, and Gallop
      let maxZ = TRACK_START_Z;

      horsesDataRef.current.forEach((h, idx) => {
        h.gallopPhase += delta * (h.speed > 0 ? h.speed * 0.95 : 3.0);
        const gallop = Math.sin(h.gallopPhase);
        const gallopCos = Math.cos(h.gallopPhase);

        // Front legs kick forward & back
        h.model.frontLeftLeg.rotation.x = gallop * 0.75;
        h.model.frontRightLeg.rotation.x = -gallop * 0.75;

        // Hind legs drive powerfully
        h.model.backLeftLeg.rotation.x = -gallopCos * 0.85;
        h.model.backRightLeg.rotation.x = gallopCos * 0.85;

        // Bobbing neck & swishing tail
        h.model.neckGroup.rotation.x = Math.sin(h.gallopPhase * 2) * 0.08;
        h.model.tailMesh.rotation.z = Math.sin(h.gallopPhase * 1.5) * 0.2;

        // Vertical galloping suspension bounce
        const verticalBounce = Math.abs(gallop) * 0.14;
        h.model.group.position.set(h.laneX, verticalBounce, h.zPos);

        if (h.zPos > maxZ) {
          maxZ = h.zPos;
        }
      });

      leadHorseZRef.current = maxZ;

      // Clean Dynamic Multi-Angle Camera
      if (cameraRef.current) {
        if (cameraMode === "side") {
          // Smooth side tracking tracking the leading horse pack
          const targetCamPos = new THREE.Vector3(14, 7, maxZ - 6);
          cameraRef.current.position.lerp(targetCamPos, delta * 3.5);
          cameraRef.current.lookAt(0, 1.8, maxZ + 4);
        } else if (cameraMode === "overhead") {
          // High birds-eye perspective of all 10 straight lanes
          const targetCamPos = new THREE.Vector3(0, 24, maxZ - 2);
          cameraRef.current.position.lerp(targetCamPos, delta * 3.5);
          cameraRef.current.lookAt(0, 0, maxZ + 10);
        } else if (cameraMode === "finish") {
          // Head-on straight track finish line camera facing the oncoming horses
          const targetCamPos = new THREE.Vector3(0, 3.2, TRACK_FINISH_Z + 10);
          cameraRef.current.position.lerp(targetCamPos, delta * 4);
          cameraRef.current.lookAt(0, 1.4, TRACK_FINISH_Z - 5);
        } else if (cameraMode === "jockey") {
          // Dynamic over-the-shoulder jockey cam
          const leadHorse = horsesDataRef.current[0];
          const targetCamPos = new THREE.Vector3(leadHorse.laneX, 3.2, leadHorse.zPos - 3.5);
          cameraRef.current.position.lerp(targetCamPos, delta * 5);
          cameraRef.current.lookAt(leadHorse.laneX, 1.5, leadHorse.zPos + 12);
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

  /* ------------------- Bet Placement Handlers ------------------- */
  const addBet = (key: string, type: BetType) => {
    if (racing) return;
    playSfx("chip");
    setBets((prev) => {
      const next = new Map<string, PlacedBet>(prev);
      const cur = next.get(key);
      const newAmt = (cur?.amount || 0) + chipValue;
      if (newAmt <= balance) {
        next.set(key, { key, type, amount: newAmt });
      }
      return next;
    });
  };

  const clearBets = () => {
    if (racing) return;
    playSfx("click");
    setBets(new Map<string, PlacedBet>());
  };

  /* ------------------- Straight Track Derby Race Execution ------------------- */
  const startRace = async () => {
    if (racing || busy) return;
    const betList = Array.from(bets.values()) as PlacedBet[];
    const totalStake = betList.reduce((sum, b) => sum + b.amount, 0);

    if (totalStake === 0) {
      toast.error("Please place your bet on a Color, Size, or Horse Number!");
      return;
    }
    if (totalStake > balance) {
      toast.error("Insufficient coins for placed bets");
      return;
    }

    setRacing(true);
    playSfx("spin");
    playSfx("cheer");

    // Reset horse positions to starting gate
    horsesDataRef.current.forEach((h) => {
      h.zPos = TRACK_START_Z;
      h.speed = 14 + Math.random() * 4;
    });

    // Determine winning horse runner (0 to 9) with authentic organic drift
    const winningHorseIndex = Math.floor(Math.random() * 10);
    const winningRunner = RUNNERS_10[winningHorseIndex];

    const raceStartTime = performance.now();
    const raceDuration = 4800; // 4.8s straight track sprint

    const raceStep = () => {
      const now = performance.now();
      const elapsed = now - raceStartTime;
      const progress = Math.min(elapsed / raceDuration, 1.0);

      horsesDataRef.current.forEach((h, idx) => {
        // Winning horse surges ahead smoothly in the final stretch
        const isWinner = idx === winningHorseIndex;
        const speedBonus = isWinner ? progress * 6.5 : Math.sin(progress * 8 + idx) * 2.2;
        h.speed = 13.5 + speedBonus;

        h.zPos =
          TRACK_START_Z +
          progress * TRACK_LENGTH * (isWinner ? 1.0 : 0.94 + Math.sin(idx * 2) * 0.04);
      });

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(raceStep);
      } else {
        // Photo Finish at Stalls
        finishRace(winningRunner, betList, totalStake);
      }
    };

    animFrameRef.current = requestAnimationFrame(raceStep);
  };

  /* ------------------- Settle Straight Race Bets ------------------- */
  const finishRace = async (winner: HorseRunner, betList: PlacedBet[], totalStake: number) => {
    setLastWinner(winner);
    setHistory((prev) => [winner.id, ...prev].slice(0, 8));

    let totalWon = 0;

    betList.forEach(({ type, amount }) => {
      if (type.kind === "color") {
        if (type.value === winner.colorType) {
          const mult = winner.colorType === "violet" ? 4.5 : 2.0;
          totalWon += amount * mult;
        }
      } else if (type.kind === "size") {
        if (type.value === winner.sizeType) {
          totalWon += amount * 2.0;
        }
      } else if (type.kind === "number") {
        if (type.value === winner.id) {
          totalWon += amount * 9.0;
        }
      }
    });

    const finalMultiplier = totalWon > 0 ? Math.round((totalWon / totalStake) * 100) / 100 : 0;

    if (finalMultiplier > 0) {
      playSfx(finalMultiplier >= 4.5 ? "bigwin" : "win");
      confetti({ particleCount: 80, spread: 70 });
      toast.success(
        `🏆 ${winner.name} won hole #${winner.id} (${winner.colorType.toUpperCase()})! Won +${formatCoins(totalWon)}!`,
      );
    } else {
      playSfx("lose");
      toast.info(`Hole #${winner.id} (${winner.name}) won the race.`);
    }

    await settle(
      finalMultiplier,
      { winner: winner.id, winnerName: winner.name, color: winner.colorType },
      totalStake,
    );

    setTimeout(() => {
      setRacing(false);
    }, 1200);
  };

  const totalCurrentStake = (Array.from(bets.values()) as PlacedBet[]).reduce(
    (s, b) => s + b.amount,
    0,
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-low p-3 shadow-xl">
      {/* 3D Straight Track Viewport - Completely Clear Screen */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-black">
        <div ref={containerRef} className="size-full" />

        {/* Small Camera Button on Side */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={() =>
              setCameraMode((m) =>
                m === "side"
                  ? "finish"
                  : m === "finish"
                    ? "overhead"
                    : m === "overhead"
                      ? "jockey"
                      : "side",
              )
            }
            className="flex items-center gap-1 rounded-lg border border-border bg-surface-high/85 px-2 py-1 text-[11px] font-bold text-foreground shadow-md backdrop-blur-md hover:bg-surface-high transition active:scale-95"
            title="Change Camera Angle"
          >
            <Camera className="size-3.5 text-primary" />
            <span className="font-mono uppercase">{cameraMode}</span>
          </button>
        </div>

        {/* Minimalist History Pills Strip on Bottom Left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border border-border bg-surface-lowest/90 px-2 py-1 shadow backdrop-blur-md">
          <span className="text-[10px] font-mono text-muted-foreground mr-1">RECENT:</span>
          {history.map((num, i) => {
            const r = RUNNERS_10[num];
            return (
              <span
                key={`hist-${i}-${num}`}
                className={`size-4 rounded-full flex items-center justify-center font-mono text-[9px] font-black text-white ${
                  r?.colorType === "violet"
                    ? "bg-purple-600"
                    : r?.colorType === "green"
                      ? "bg-emerald-600"
                      : "bg-red-600"
                }`}
              >
                {num}
              </span>
            );
          })}
        </div>
      </div>

      {/* Color Trading Horse Betting Board */}
      <div className="rounded-xl border border-border bg-surface-high p-3 flex flex-col gap-2.5">
        {/* Color Trading 3 Major Colors (Green 2x, Violet 4.5x, Red 2x) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Green (1, 3, 7, 9) */}
          <button
            type="button"
            disabled={racing}
            onClick={() => addBet("color_green", { kind: "color", value: "green" })}
            className={`h-11 rounded-xl font-display text-xs font-bold text-white transition flex flex-col items-center justify-center ${
              bets.has("color_green")
                ? "bg-emerald-600 ring-2 ring-primary scale-102 shadow-lg"
                : "bg-emerald-700 hover:bg-emerald-600"
            }`}
          >
            <span>GREEN 2x</span>
            {bets.get("color_green") && (
              <span className="text-[10px] font-mono font-normal">
                ({bets.get("color_green")?.amount})
              </span>
            )}
          </button>

          {/* Violet (0, 5) */}
          <button
            type="button"
            disabled={racing}
            onClick={() => addBet("color_violet", { kind: "color", value: "violet" })}
            className={`h-11 rounded-xl font-display text-xs font-bold text-white transition flex flex-col items-center justify-center ${
              bets.has("color_violet")
                ? "bg-purple-600 ring-2 ring-primary scale-102 shadow-lg"
                : "bg-purple-700 hover:bg-purple-600"
            }`}
          >
            <span>VIOLET 4.5x</span>
            {bets.get("color_violet") && (
              <span className="text-[10px] font-mono font-normal">
                ({bets.get("color_violet")?.amount})
              </span>
            )}
          </button>

          {/* Red (2, 4, 6, 8) */}
          <button
            type="button"
            disabled={racing}
            onClick={() => addBet("color_red", { kind: "color", value: "red" })}
            className={`h-11 rounded-xl font-display text-xs font-bold text-white transition flex flex-col items-center justify-center ${
              bets.has("color_red")
                ? "bg-red-600 ring-2 ring-primary scale-102 shadow-lg"
                : "bg-red-700 hover:bg-red-600"
            }`}
          >
            <span>RED 2x</span>
            {bets.get("color_red") && (
              <span className="text-[10px] font-mono font-normal">
                ({bets.get("color_red")?.amount})
              </span>
            )}
          </button>
        </div>

        {/* Big / Small 2x Selection */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={racing}
            onClick={() => addBet("size_small", { kind: "size", value: "small" })}
            className={`h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              bets.has("size_small")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>SMALL (0–4) 2x</span>
            {bets.get("size_small") && (
              <span className="font-mono">({bets.get("size_small")?.amount})</span>
            )}
          </button>

          <button
            type="button"
            disabled={racing}
            onClick={() => addBet("size_big", { kind: "size", value: "big" })}
            className={`h-9 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              bets.has("size_big")
                ? "border-primary bg-primary text-primary-foreground font-black"
                : "border-border bg-surface-lowest text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>BIG (5–9) 2x</span>
            {bets.get("size_big") && (
              <span className="font-mono">({bets.get("size_big")?.amount})</span>
            )}
          </button>
        </div>

        {/* 10 Horse Finishing Gate Numbers (0 to 9) - 9x Payout */}
        <div className="grid grid-cols-10 gap-1">
          {RUNNERS_10.map((r) => {
            const isSelected = bets.has(`num_${r.id}`);
            const placedAmt = bets.get(`num_${r.id}`)?.amount;
            return (
              <button
                key={r.id}
                type="button"
                disabled={racing}
                onClick={() => addBet(`num_${r.id}`, { kind: "number", value: r.id })}
                className={`h-11 rounded-lg text-white font-mono font-bold flex flex-col items-center justify-center transition ${
                  r.colorType === "violet"
                    ? "bg-purple-700 hover:bg-purple-600"
                    : r.colorType === "green"
                      ? "bg-emerald-700 hover:bg-emerald-600"
                      : "bg-red-700 hover:bg-red-600"
                } ${isSelected ? "ring-2 ring-primary scale-105 z-10 shadow-lg font-black" : "border border-border/30"}`}
              >
                <span className="text-sm">{r.id}</span>
                <span className="text-[8px] font-sans opacity-90">{placedAmt || "9x"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chip Selector & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Chip Values */}
        <div className="flex items-center gap-1.5">
          {[10, 50, 100, 500, 1000].map((val) => (
            <button
              key={`chip-${val}`}
              type="button"
              disabled={racing}
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

        {/* Clear & Start Straight Race */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={racing || bets.size === 0}
            onClick={clearBets}
            className="rounded-xl border border-border bg-surface-high px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={startRace}
            disabled={racing || totalCurrentStake === 0 || totalCurrentStake > balance || busy}
            className="h-11 rounded-xl bg-primary px-5 font-display text-sm font-bold text-primary-foreground shadow-lg active:scale-98 disabled:opacity-50 transition"
          >
            {racing
              ? "HORSES SPRINTING..."
              : `START RACE · STAKE ${formatCoins(totalCurrentStake || bet)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
