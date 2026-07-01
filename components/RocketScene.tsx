"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles, Float, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { DEST_META } from "@/lib/destinations";

type Phase = "idle" | "launching" | "result";

// ---- world layout (Y is up) -------------------------------------------------
const BASE_Y = 0;
const CRASH_Y = 6.2;

type PlanetCfg = {
  y: number;
  x: number;
  z: number;
  r: number;
  color: string;
  name: string;
  ring?: boolean;
};

// Keyed by multiplier — matches lib/destinations.ts.
const PLANETS: Record<number, PlanetCfg> = {
  2: { y: 7, x: 2.0, z: -1.5, r: 0.85, color: "#d2531a", name: "Mars" },
  3: { y: 10, x: -2.4, z: -2, r: 1.35, color: "#c08a4a", name: "Jupiter" },
  5: { y: 13, x: 2.6, z: -1.5, r: 1.05, color: "#d2a23c", name: "Saturn", ring: true },
  10: { y: 16, x: -1.2, z: -2.5, r: 1.6, color: "#3a5cf0", name: "Neptune" },
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t;

// ---- gradient space backdrop (deep blue/purple) -----------------------------
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(256, 150, 40, 256, 300, 520);
    g.addColorStop(0, "#3b2a86");
    g.addColorStop(0.35, "#1d2f80");
    g.addColorStop(0.7, "#0a1140");
    g.addColorStop(1, "#03050f");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 7, -22]} scale={[90, 90, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---- crypto coin (canvas-textured face) -------------------------------------
function makeCoinTexture(symbol: string) {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(s * 0.38, s * 0.32, 12, s * 0.5, s * 0.5, s * 0.62);
  g.addColorStop(0, "#ffefb8");
  g.addColorStop(0.5, "#f5b50a");
  g.addColorStop(1, "#b9790a");
  x.fillStyle = g;
  x.beginPath();
  x.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = "rgba(255,244,210,0.65)";
  x.lineWidth = 9;
  x.beginPath();
  x.arc(s / 2, s / 2, s / 2 - 30, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#fff7e0";
  x.font = "bold 150px system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.shadowColor = "rgba(120,70,0,0.5)";
  x.shadowBlur = 10;
  x.fillText(symbol, s / 2, s / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Coin({
  symbol,
  position,
  scale = 1,
  speed = 0.8,
}: {
  symbol: string;
  position: [number, number, number];
  scale?: number;
  speed?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const face = useMemo(() => makeCoinTexture(symbol), [symbol]);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * speed;
  });
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.1}>
      <group ref={ref} position={position} scale={scale}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.12, 56]} />
          <meshStandardMaterial attach="material-0" color="#e0a420" metalness={1} roughness={0.3} envMapIntensity={1.2} />
          <meshStandardMaterial attach="material-1" map={face} metalness={0.85} roughness={0.32} envMapIntensity={1.1} />
          <meshStandardMaterial attach="material-2" map={face} metalness={0.85} roughness={0.32} envMapIntensity={1.1} />
        </mesh>
      </group>
    </Float>
  );
}

// ---- rocket -----------------------------------------------------------------
function RocketModel({
  phase,
  multiplier,
  rocketY,
  onExplode,
}: {
  phase: Phase;
  multiplier: number | null;
  rocketY: React.MutableRefObject<number>;
  onExplode: (y: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const flameInner = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const engineLight = useRef<THREE.PointLight>(null);
  const startMs = useRef(0);
  const exploded = useRef(false);

  // Swept fin blade (radial-vertical profile, extruded thin).
  const finGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.16);
    s.lineTo(0.55, -0.5);
    s.lineTo(0.55, -0.74);
    s.lineTo(0, -0.6);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    g.translate(0, 0, -0.03);
    return g;
  }, []);

  const won = phase === "result" && (multiplier ?? 0) > 0;
  const crashed = phase === "result" && multiplier === 0;
  const planet = won ? PLANETS[multiplier as number] : null;
  const durSec =
    ((won ? DEST_META[multiplier as number] : DEST_META[0])?.durMs ?? 1700) / 1000;
  const targetY = planet ? planet.y - planet.r - 0.6 : CRASH_Y;
  const targetX = planet ? planet.x * 0.45 : 0;

  useEffect(() => {
    if (phase === "result") {
      startMs.current = performance.now();
      exploded.current = false;
    }
    if (phase === "idle") exploded.current = false;
  }, [phase, multiplier]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    let flamePower = 0;
    g.visible = true;

    if (phase === "idle") {
      g.position.set(0, BASE_Y + Math.sin(t * 1.6) * 0.04, 0);
      g.rotation.z = Math.sin(t * 0.8) * 0.015;
      g.scale.setScalar(1);
      flamePower = 0.22;
    } else if (phase === "launching") {
      g.position.set((Math.random() - 0.5) * 0.05, BASE_Y, (Math.random() - 0.5) * 0.04);
      g.rotation.z = (Math.random() - 0.5) * 0.02;
      g.scale.setScalar(1);
      flamePower = 1.5;
    } else if (won) {
      const p = Math.min((performance.now() - startMs.current) / (durSec * 1000), 1);
      const e = easeOut(p);
      g.position.y = THREE.MathUtils.lerp(BASE_Y, targetY, e);
      g.position.x = THREE.MathUtils.lerp(0, targetX, e) + Math.sin(t * 9) * 0.02 * (1 - p);
      g.position.z = 0;
      g.scale.setScalar(THREE.MathUtils.lerp(1, 0.5, e));
      g.rotation.z = Math.sin(t * 7) * 0.03 * (1 - p);
      flamePower = 1.7 * (1 - p * 0.25);
    } else if (crashed) {
      const p = Math.min((performance.now() - startMs.current) / (durSec * 1000), 1);
      if (p < 0.64) {
        const pp = p / 0.64;
        g.position.set(0, THREE.MathUtils.lerp(BASE_Y, CRASH_Y, easeOut(pp)), 0);
        g.rotation.z = 0;
        g.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, pp));
        flamePower = 1.6;
      } else {
        const pp = (p - 0.64) / 0.36;
        g.position.y = CRASH_Y + Math.sin(pp * Math.PI) * 0.25 - easeIn(pp) * 1.8;
        g.position.x = Math.sin(pp * 18) * 0.15 * pp;
        g.rotation.z = pp * 6;
        g.scale.setScalar(0.72 * Math.max(0, 1 - pp * 1.4));
        g.visible = pp < 0.55;
        flamePower = 0;
        if (!exploded.current && pp > 0.18) {
          exploded.current = true;
          onExplode(CRASH_Y);
        }
      }
    }

    rocketY.current = g.position.y;

    // flame flicker
    const flick = 0.78 + Math.random() * 0.4;
    if (flame.current) {
      flame.current.scale.set(flamePower * 0.95, flamePower * 1.15 * flick, flamePower * 0.95);
      flame.current.visible = flamePower > 0.02;
    }
    if (flameInner.current) {
      flameInner.current.scale.set(flamePower * 0.55, flamePower * 0.85 * flick, flamePower * 0.55);
      flameInner.current.visible = flamePower > 0.02;
    }
    if (glow.current) {
      const k = flamePower * (0.85 + Math.random() * 0.2);
      glow.current.scale.setScalar(k);
      glow.current.visible = flamePower > 0.02;
    }
    if (engineLight.current) engineLight.current.intensity = flamePower * 7 * flick;
  });

  return (
    <group ref={group}>
      {/* nose cone — tall + pointed */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <coneGeometry args={[0.34, 1.05, 44]} />
        <meshPhysicalMaterial color="#e01b14" metalness={0.5} roughness={0.2} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.5} />
      </mesh>
      {/* nose tip cap */}
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#fff" metalness={1} roughness={0.1} />
      </mesh>
      {/* body */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.37, 1.45, 40]} />
        <meshPhysicalMaterial color="#ec2a20" metalness={0.55} roughness={0.24} clearcoat={1} clearcoatRoughness={0.14} envMapIntensity={1.4} />
      </mesh>
      {/* chrome bands */}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.12, 40]} />
        <meshStandardMaterial color="#eef2f8" metalness={1} roughness={0.06} envMapIntensity={1.8} />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.375, 0.375, 0.1, 40]} />
        <meshStandardMaterial color="#eef2f8" metalness={1} roughness={0.06} envMapIntensity={1.8} />
      </mesh>

      {/* porthole on +Z face — large single window like the logo */}
      <group position={[0, 0.42, 0.31]}>
        {/* chrome rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.23, 0.05, 20, 44]} />
          <meshStandardMaterial color="#dfe5f0" metalness={1} roughness={0.08} envMapIntensity={1.8} />
        </mesh>
        {/* glass lens */}
        <mesh position={[0, 0, -0.02]}>
          <sphereGeometry args={[0.21, 32, 32]} />
          <meshPhysicalMaterial color="#5bb4ff" emissive="#2e7fff" emissiveIntensity={0.6} metalness={0.3} roughness={0.05} clearcoat={1} transmission={0.2} />
        </mesh>
        {/* highlight */}
        <mesh position={[-0.07, 0.07, 0.14]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* rivets */}
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0.02]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshStandardMaterial color="#cfd6e2" metalness={1} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      {/* fins — 4 swept blades */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
          <mesh geometry={finGeo} position={[0.26, -0.05, 0]} castShadow>
            <meshPhysicalMaterial color="#c11810" metalness={0.5} roughness={0.28} clearcoat={1} clearcoatRoughness={0.16} envMapIntensity={1.3} />
          </mesh>
        </group>
      ))}

      {/* nozzle */}
      <mesh position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 0.26, 28]} />
        <meshStandardMaterial color="#aab0c2" metalness={1} roughness={0.25} envMapIntensity={1.6} />
      </mesh>

      {/* exhaust */}
      <mesh ref={glow} position={[0, -0.95, 0]} visible={false}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ff8a2a" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={flame} position={[0, -1.15, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
        <coneGeometry args={[0.24, 1.1, 24]} />
        <meshBasicMaterial color="#ff6a12" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={flameInner} position={[0, -1.0, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
        <coneGeometry args={[0.14, 0.85, 18]} />
        <meshBasicMaterial color="#fff2b0" transparent opacity={0.98} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={engineLight} position={[0, -1.1, 0]} color="#ff9a3a" intensity={0} distance={7} />
    </group>
  );
}

// ---- planets ----------------------------------------------------------------
function Planet({ cfg, isTarget }: { cfg: PlanetCfg; isTarget: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.12;
  });
  return (
    <group position={[cfg.x, cfg.y, cfg.z]} scale={isTarget ? 1 : 0.62}>
      <mesh ref={ref}>
        <sphereGeometry args={[cfg.r, 48, 48]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={isTarget ? 0.4 : 0.12}
          roughness={0.8}
          metalness={0.25}
          envMapIntensity={0.8}
          opacity={isTarget ? 1 : 0.5}
          transparent={!isTarget}
        />
      </mesh>
      {cfg.ring && (
        <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
          <ringGeometry args={[cfg.r * 1.35, cfg.r * 2.1, 64]} />
          <meshStandardMaterial
            color="#f3e0a8"
            emissive="#f3e0a8"
            emissiveIntensity={isTarget ? 0.45 : 0.1}
            side={THREE.DoubleSide}
            transparent
            opacity={isTarget ? 0.9 : 0.35}
          />
        </mesh>
      )}
      {isTarget && (
        <>
          <pointLight color={cfg.color} intensity={2.6} distance={9} />
          <mesh scale={1.18}>
            <sphereGeometry args={[cfg.r, 32, 32]} />
            <meshBasicMaterial color={cfg.color} transparent opacity={0.14} side={THREE.BackSide} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ---- earth + pad ------------------------------------------------------------
function Earth() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.04;
  });
  return (
    <group position={[0, -6.7, -1]}>
      <mesh ref={ref}>
        <sphereGeometry args={[6, 64, 64]} />
        <meshStandardMaterial color="#2f86d6" emissive="#0b2f63" emissiveIntensity={0.3} roughness={0.9} metalness={0.1} />
      </mesh>
      {/* warm city-light rim near the horizon */}
      <mesh scale={1.012}>
        <sphereGeometry args={[6, 64, 64]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.06} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* atmosphere */}
      <mesh scale={1.06}>
        <sphereGeometry args={[6, 48, 48]} />
        <meshBasicMaterial color="#7ab8ff" transparent opacity={0.16} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Pad() {
  return (
    <mesh position={[0, -0.94, 0]}>
      <cylinderGeometry args={[0.6, 0.75, 0.18, 24]} />
      <meshStandardMaterial color="#3a4456" metalness={0.7} roughness={0.4} envMapIntensity={1.2} />
    </mesh>
  );
}

// ---- asteroid (crash marker) ------------------------------------------------
function Asteroid({ hit }: { hit: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.x = s.clock.elapsedTime * 0.5;
    ref.current.rotation.y = s.clock.elapsedTime * 0.7;
  });
  return (
    <mesh ref={ref} position={[0.5, CRASH_Y + 0.4, -0.5]} scale={hit ? 0.9 : 0.7}>
      <icosahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial color="#6b5a48" roughness={1} metalness={0.1} flatShading />
    </mesh>
  );
}

// ---- explosion --------------------------------------------------------------
function Boom({ trigger }: { trigger: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const startMs = useRef(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger > 0) {
      startMs.current = performance.now();
      setActive(true);
    }
  }, [trigger]);

  useFrame(() => {
    if (!active || !mesh.current) return;
    const t = (performance.now() - startMs.current) / 1000;
    const k = Math.min(t / 0.75, 1);
    mesh.current.scale.setScalar(0.3 + k * 2.8);
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
    if (light.current) light.current.intensity = Math.max(0, (1 - k) * 12);
    if (k >= 1) setActive(false);
  });

  return (
    <group position={[0, CRASH_Y, 0]} visible={active}>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#ff7b2e" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#ff7b2e" intensity={0} distance={14} />
    </group>
  );
}

// ---- camera rig -------------------------------------------------------------
function CameraRig({ rocketY }: { rocketY: React.MutableRefObject<number> }) {
  const look = useRef(new THREE.Vector3(0, 1, 0));
  useFrame((state) => {
    const cam = state.camera;
    const wantY = rocketY.current + 1.6;
    cam.position.y += (wantY - cam.position.y) * 0.05;
    look.current.y += (rocketY.current + 1.0 - look.current.y) * 0.06;
    cam.lookAt(look.current);
  });
  return null;
}

// ---- scene contents ---------------------------------------------------------
function SceneContents({ phase, multiplier }: { phase: Phase; multiplier: number | null }) {
  const rocketY = useRef(BASE_Y);
  const [boom, setBoom] = useState(0);
  const crashed = phase === "result" && multiplier === 0;
  const showField = phase !== "idle";

  useEffect(() => {
    if (phase !== "result") setBoom(0);
  }, [phase]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 6]} intensity={1.6} color="#fff4e6" />
      <directionalLight position={[-6, 2, -4]} intensity={0.6} color="#5a7cff" />

      {/* reflections for the glossy chrome / coins (offline studio env) */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 6, -6]} scale={[12, 12, 1]} color="#9ab4ff" />
        <Lightformer intensity={3} position={[6, 3, 3]} scale={[6, 6, 1]} color="#ffffff" />
        <Lightformer intensity={2.4} position={[-6, 1, 3]} scale={[6, 6, 1]} color="#ffd9b0" />
        <Lightformer intensity={1.5} form="ring" position={[0, -3, 4]} scale={[5, 5, 1]} color="#ff7a4d" />
      </Environment>

      <Backdrop />
      <Stars radius={70} depth={50} count={2600} factor={4} saturation={0} fade speed={1} />
      <Sparkles count={45} scale={[12, 20, 6]} size={3} speed={0.3} color="#bcd4ff" opacity={0.6} />

      {/* floating crypto coins */}
      <Coin symbol="₿" position={[-3.1, 2.4, 1]} scale={1.05} speed={0.7} />
      <Coin symbol="Ξ" position={[3.2, 0.6, 0.4]} scale={0.95} speed={-0.6} />
      <Coin symbol="₿" position={[2.6, 3.6, -1]} scale={0.6} speed={0.9} />
      <Coin symbol="₿" position={[-2.4, -1.4, 1.4]} scale={0.5} speed={-0.8} />

      {Object.entries(PLANETS).map(([m, cfg]) => (
        <Planet key={cfg.name} cfg={cfg} isTarget={phase === "result" && Number(m) === multiplier} />
      ))}

      {showField && <Asteroid hit={crashed} />}

      <Earth />
      <Pad />

      <RocketModel
        phase={phase}
        multiplier={multiplier}
        rocketY={rocketY}
        onExplode={() => setBoom((b) => b + 1)}
      />

      <Boom trigger={boom} />
      <CameraRig rocketY={rocketY} />

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

export default function RocketScene({
  phase,
  multiplier,
}: {
  phase: Phase;
  multiplier: number | null;
}) {
  return (
    <Canvas
      camera={{ position: [0, 1.6, 11], fov: 52 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <SceneContents phase={phase} multiplier={multiplier} />
    </Canvas>
  );
}
