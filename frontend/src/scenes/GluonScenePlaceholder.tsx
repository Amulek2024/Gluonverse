import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Billboard } from "@react-three/drei/core/Billboard";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Text } from "@react-three/drei/core/Text";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Maximize, Minimize, Settings } from "lucide-react";
import { DoubleSide, type Group } from "three";
import type { ParticleState } from "../types/physics";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";

interface GluonSceneProps {
  particles: ParticleState[];
  selectedId?: string;
  showFields?: boolean;
  reducedMotion?: boolean;
  onSelect?: (id?: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  red: "#ff3b3b",
  green: "#2bff7a",
  blue: "#3b8cff",
  "anti-red": "#ff8fa3",
  "anti-green": "#7dffc0",
  "anti-blue": "#7db3ff"
};

const SELECTION_COLOR = "#ffffff";

// Visualization convention only: quarks are point-like in the Standard Model (no measured
// radius), so this maps mass (constituent up ~0.336 GeV to top ~172.76 GeV) on a log scale
// to a bounded on-screen size purely for "heavier quark = bigger dot" legibility.
const MIN_QUARK_MASS = 0.336;
const MAX_QUARK_MASS = 172.76;
const MIN_RADIUS = 0.06;
const MAX_RADIUS = 0.16;

function massToRadius(mass: number): number {
  const clampedMass = Math.min(Math.max(mass, MIN_QUARK_MASS), MAX_QUARK_MASS);
  const t =
    (Math.log(clampedMass) - Math.log(MIN_QUARK_MASS)) / (Math.log(MAX_QUARK_MASS) - Math.log(MIN_QUARK_MASS));
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

// Electric-charge cue, independent of the QCD color_charge hue: warm gold for
// positive charge, cool violet for negative, gray for neutral (e.g. gluons).
function chargeColor(electricCharge: number): string {
  if (electricCharge > 1e-9) return "#ffd166";
  if (electricCharge < -1e-9) return "#b967ff";
  return "#9aa4b2";
}

function Particle({
  particle,
  selected,
  onSelect
}: {
  particle: ParticleState;
  selected: boolean;
  onSelect?: (id?: string) => void;
}) {
  const radius = massToRadius(particle.mass);
  const color = COLOR_MAP[particle.color_charge] || "#4dd0e1";
  const position: [number, number, number] = [
    particle.position[0] || 0,
    particle.position[1] || 0,
    particle.position[2] || 0
  ];

  const chargeRingColor = chargeColor(particle.electric_charge);

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(particle.id);
        }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={particle.is_antiparticle ? 0.5 : 0.85}
        />
      </mesh>
      <Billboard>
        <mesh>
          <ringGeometry args={[radius + 0.015, radius + 0.03, 32]} />
          <meshBasicMaterial color={chargeRingColor} transparent opacity={0.9} side={DoubleSide} depthWrite={false} />
        </mesh>
      </Billboard>
      {selected && (
        <Billboard>
          <mesh>
            <ringGeometry args={[radius + 0.045, radius + 0.06, 32]} />
            <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.85} side={DoubleSide} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}

function Trajectory({ particle, selected }: { particle: ParticleState; selected: boolean }) {
  const points = useMemo(
    () => particle.trajectory?.map((p) => [p[0] || 0, p[1] || 0, p[2] || 0] as [number, number, number]) ?? [],
    [particle.trajectory]
  );
  const color = COLOR_MAP[particle.color_charge] || "#4dd0e1";
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={selected ? SELECTION_COLOR : color}
      lineWidth={selected ? 1.8 : 1.2}
      transparent
      opacity={selected ? 0.85 : 0.55}
    />
  );
}

function FieldGrid({ visible }: { visible?: boolean }) {
  if (!visible) return null;
  const lines: Array<[[number, number, number], [number, number, number]]> = [];
  const extent = 1.2;
  const step = 0.3;
  for (let i = -extent; i <= extent; i += step) {
    lines.push([
      [i, -extent, 0],
      [i, extent, 0]
    ]);
    lines.push([
      [-extent, i, 0],
      [extent, i, 0]
    ]);
  }
  return (
    <group>
      {lines.map((segment, index) => (
        <Line key={index} points={segment} color="#4dd0e1" transparent opacity={0.08} />
      ))}
    </group>
  );
}

function SceneContents({
  particles,
  selectedId,
  showFields,
  onSelect,
  onAddParticle
}: {
  particles: ParticleState[];
  selectedId?: string;
  showFields?: boolean;
  onSelect?: (id?: string) => void;
  onAddParticle?: (position: [number, number, number]) => void;
}) {
  const groupRef = useRef<Group>(null);
  const rightDownRef = useRef<{ x: number; y: number } | null>(null);
  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 3, 4]} intensity={1.1} />
      <pointLight position={[-3, -2, -3]} intensity={0.4} color="#4dd0e1" />
      <mesh
        onClick={() => onSelect?.(undefined)}
        onPointerDown={(event) => {
          if (event.nativeEvent.button === 2) {
            rightDownRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
          }
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          const down = rightDownRef.current;
          const moved = down
            ? Math.hypot(event.nativeEvent.clientX - down.x, event.nativeEvent.clientY - down.y)
            : 0;
          if (moved < 6) {
            onAddParticle?.([event.point.x, event.point.y, event.point.z]);
          }
        }}
      >
        <planeGeometry args={[8000, 8000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
      <FieldGrid visible={showFields} />
      {particles.map((particle) => (
        <Trajectory key={`traj-${particle.id}`} particle={particle} selected={particle.id === selectedId} />
      ))}
      {particles.map((particle) => (
        <Particle key={particle.id} particle={particle} selected={particle.id === selectedId} onSelect={onSelect} />
      ))}
      {particles.length === 0 && (
        <Text position={[0, 0, 0]} fontSize={0.12} color="#4dd0e1" anchorX="center" anchorY="middle">
          Sin particulas. Agrega un quark o un preset.
        </Text>
      )}
    </group>
  );
}

export function GluonScene({ particles: initialParticles, selectedId, showFields, reducedMotion, onSelect }: GluonSceneProps) {
  const {
    particles,
    observables,
    step,
    simulatedTime,
    showFields: storeShowFields,
    cameraResetToken,
    setControlsSlot,
    addParticle
  } = useSimulationStore();
  const particlesToShow = particles.length > 0 ? particles : initialParticles;
  const fieldsVisible = storeShowFields ?? showFields;
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    controlsRef.current?.reset();
  }, [cameraResetToken]);

  return (
    <div
      ref={fullscreenRef}
      style={{ width: "100%", height: "100%", position: "relative", borderRadius: 8, overflow: "hidden", background: "#000000" }}
    >
      <Canvas
        camera={{ position: [1.6, 1.2, 1.8], fov: 50, near: 0.01, far: 20000 }}
        dpr={[1, 2]}
        onPointerMissed={() => onSelect?.(undefined)}
      >
        <color attach="background" args={["#000000"]} />
        <SceneContents
          particles={particlesToShow}
          selectedId={selectedId}
          showFields={fieldsVisible}
          onSelect={onSelect}
          onAddParticle={addParticle}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping={!reducedMotion}
          dampingFactor={0.12}
          minDistance={0.02}
          maxDistance={5000}
          zoomSpeed={1.1}
          panSpeed={0.8}
          rotateSpeed={0.7}
        />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>Paso {step}</span>
        <span>t = {simulatedTime.toFixed(4)}</span>
        <span>E = {observables.total_energy.toFixed(6)} GeV*</span>
        <span>Particulas: {particlesToShow.length}</span>
      </div>
      <button
        type="button"
        className="scene-fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
      <div className="scene-hint" aria-hidden="true">
        Rueda: zoom · Clic izq + arrastrar: rotar · Clic der + arrastrar: mover · Clic der (sin arrastrar): agregar quark
      </div>
      {isFullscreen && (
        <FloatingPanel title="Parámetros" triggerLabel="Controles" triggerIcon={<Settings size={16} />} side="left" defaultOpen>
          <div ref={setControlsSlot} />
        </FloatingPanel>
      )}
    </div>
  );
}
