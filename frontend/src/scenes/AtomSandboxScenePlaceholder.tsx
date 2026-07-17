import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  buildElectronSlots,
  computeElectronConfiguration,
  elementByZ,
  hydrogenicRadius,
  neutronCount,
  slaterZEff,
  type ElectronSlot
} from "../utils/elements";
import { useAtomSandboxStore } from "../stores/useAtomSandboxStore";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { CameraFit } from "../components/CameraFit";
import { DistanceGrid, ElectronCloud, Nucleus, fibonacciSpherePoints } from "./AtomScenePlaceholder";
import { detectBonds } from "../simulations/bondDetection";
import type { SandboxAtom } from "../types/sandbox";

const BOND_LINE_COLOR = "#7ee787";

// Lineas entre pares con enlace detectado (ver simulations/bondDetection.ts): una sola linea
// por par, sin distincion de orden (simple/doble/triple) -- a diferencia de los enlaces fijos
// de la vista Moleculas, aqui no se conoce el orden real, solo que la geometria es compatible
// con un enlace.
function DetectedBondLines({ atoms }: { atoms: SandboxAtom[] }) {
  const bonds = useMemo(() => detectBonds(atoms), [atoms]);
  return (
    <>
      {bonds.map((bond) => (
        <Line
          key={`${atoms[bond.aIndex].id}-${atoms[bond.bIndex].id}`}
          points={[atoms[bond.aIndex].position, atoms[bond.bIndex].position]}
          color={BOND_LINE_COLOR}
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      ))}
    </>
  );
}

interface AtomChemistry {
  element: ReturnType<typeof elementByZ>;
  slots: ElectronSlot[];
  zEffBySubshell: Map<string, number>;
  nucleusRadius: number;
  protonPositions: Array<[number, number, number]>;
  neutronPositions: Array<[number, number, number]>;
  shellRadius: number;
}

// Datos quimicos por atomo (nucleo, nube electronica) memoizados por Z, NO por posicion: la
// posicion cambia cada frame por la fisica, y si estos datos se recalcularan junto con ella,
// ElectronCloud perderia su propia memoizacion interna y volveria a muestrear TODOS sus puntos
// desde cero en cada frame en vez de solo la fraccion presupuestada (ver AtomScenePlaceholder).
function buildChemistry(z: number): AtomChemistry {
  const element = elementByZ(z);
  const config = computeElectronConfiguration(z);
  const slots = buildElectronSlots(config);
  const neutrons = neutronCount(element);
  const massNumber = element.z + neutrons;
  const radius = Math.min(Math.max(0.05 + 0.025 * Math.cbrt(massNumber), 0.05), 0.24);

  const zEffBySubshell = new Map<string, number>();
  for (const shell of config) {
    const key = `${shell.n}-${shell.l}`;
    if (!zEffBySubshell.has(key)) {
      zEffBySubshell.set(key, slaterZEff(element.z, shell.n, shell.l, config));
    }
  }

  let maxShellRadius = hydrogenicRadius(1, element.z);
  for (const shell of config) {
    const zEff = zEffBySubshell.get(`${shell.n}-${shell.l}`) ?? element.z;
    maxShellRadius = Math.max(maxShellRadius, hydrogenicRadius(shell.n, zEff));
  }

  return {
    element,
    slots,
    zEffBySubshell,
    nucleusRadius: radius,
    protonPositions: fibonacciSpherePoints(element.z, radius),
    neutronPositions: fibonacciSpherePoints(neutrons, radius * 0.9),
    shellRadius: maxShellRadius
  };
}

function useChemistryByElement(atoms: SandboxAtom[]): Map<number, AtomChemistry> {
  const distinctZ = Array.from(new Set(atoms.map((atom) => atom.z))).sort((a, b) => a - b);
  const signature = distinctZ.join(",");
  return useMemo(() => {
    const map = new Map<number, AtomChemistry>();
    for (const z of distinctZ) map.set(z, buildChemistry(z));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

function SandboxAtoms({
  atoms,
  chemistryByElement,
  paused
}: {
  atoms: SandboxAtom[];
  chemistryByElement: Map<number, AtomChemistry>;
  paused: boolean;
}) {
  useFrame(() => {
    useAtomSandboxStore.getState().stepLocal();
  });

  return (
    <>
      {atoms.map((atom) => {
        const chemistry = chemistryByElement.get(atom.z);
        if (!chemistry) return null;
        return (
          <group key={atom.id} position={atom.position}>
            <Nucleus
              protonPositions={chemistry.protonPositions}
              neutronPositions={chemistry.neutronPositions}
              nucleusRadius={chemistry.nucleusRadius}
            />
            <ElectronCloud
              slots={chemistry.slots}
              zEffBySubshell={chemistry.zEffBySubshell}
              elementZ={chemistry.element.z}
              paused={paused}
            />
          </group>
        );
      })}
    </>
  );
}

export function AtomSandboxScene() {
  const [paused, setPaused] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const atoms = useAtomSandboxStore((state) => state.atoms);
  const simPaused = useAtomSandboxStore((state) => state.paused);
  const togglePaused = useAtomSandboxStore((state) => state.togglePaused);
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  const setControlsSlot = useSimulationStore((state) => state.setControlsSlot);
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const chemistryByElement = useChemistryByElement(atoms);

  // Encuadre basado en la CANTIDAD de atomos (raiz cuadrada, ya que se agregan formando un
  // cluster compacto -- cada atomo nuevo se coloca cerca de uno existente, ver
  // useAtomSandboxStore), no en las posiciones en vivo: si dependiera de ellas, la camara
  // pelearia con el zoom/pan manual del usuario en cada paso de la fisica.
  const boundingRadius = useMemo(() => {
    let maxExtent = 2;
    for (const [, chemistry] of chemistryByElement) {
      maxExtent = Math.max(maxExtent, chemistry.shellRadius);
    }
    return Math.max(maxExtent, 1.6 + Math.sqrt(atoms.length) * 1.3);
  }, [atoms.length, chemistryByElement]);

  const gridSize = Math.max(2, boundingRadius * 2.4);
  const gridDivisions = Math.max(4, Math.min(40, Math.round(gridSize / 0.5)));
  const cameraDistance = Math.max(2.6, gridSize * 0.85);

  const totalElectrons = useMemo(
    () => atoms.reduce((sum, atom) => sum + (chemistryByElement.get(atom.z)?.slots.length ?? 0), 0),
    [atoms, chemistryByElement]
  );
  const elementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const atom of atoms) {
      const symbol = chemistryByElement.get(atom.z)?.element.symbol ?? "?";
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [atoms, chemistryByElement]);
  const detectedBondCount = useMemo(() => detectBonds(atoms).length, [atoms]);

  return (
    <div
      ref={fullscreenRef}
      style={{ width: "100%", height: "100%", position: "relative", borderRadius: 8, overflow: "hidden", background: "#000000" }}
    >
      <Canvas camera={{ position: [3, 2, 4], fov: 50, near: 0.01, far: 20000 }} dpr={[1, 2]}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 3, 4]} intensity={1.1} />
        <pointLight position={[-3, -2, -3]} intensity={0.4} color="#4dd0e1" />
        <CameraFit distance={cameraDistance} controlsRef={controlsRef} resetToken={cameraResetToken} />
        <DistanceGrid size={gridSize} divisions={gridDivisions} />
        <SandboxAtoms atoms={atoms} chemistryByElement={chemistryByElement} paused={paused} />
        <DetectedBondLines atoms={atoms} />
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.12} minDistance={0.02} maxDistance={5000} zoomSpeed={1.1} panSpeed={0.8} rotateSpeed={0.7} />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>Atomos: {atoms.length}</span>
        <span>Electrones: {totalElectrons}</span>
        <span>Enlaces detectados: {detectedBondCount}</span>
        <span>{elementCounts.map(([symbol, count]) => `${symbol}×${count}`).join(" ") || "Sandbox vacio"}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>
          Lennard-Jones: radios covalentes si el par puede enlazar, van der Waals si es gas
          noble. Fisica: {simPaused ? "en pausa" : "corriendo"}.
        </strong>
        <span>
          <span className="legend-swatch" style={{ background: BOND_LINE_COLOR }} /> enlace
          detectado por proximidad
        </span>
      </div>
      <button
        type="button"
        className="scene-fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "3.1rem" }}
        onClick={togglePaused}
        title={simPaused ? "Reanudar la fisica del sandbox" : "Pausar la fisica del sandbox"}
      >
        {simPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "5.6rem" }}
        onClick={() => setPaused((value) => !value)}
        title={paused ? "Reanudar el muestreo de las nubes electronicas" : "Pausar el muestreo (util para ver la forma sin parpadeo)"}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "8.1rem" }}
        onClick={() => setCameraResetToken((value) => value + 1)}
        title="Reiniciar posicion de camara"
      >
        <RotateCcw size={16} />
      </button>
      <div className="scene-hint" aria-hidden="true">
        Rueda: zoom · Clic izq + arrastrar: rotar · Clic der + arrastrar: mover
      </div>
      {isFullscreen && (
        <FloatingPanel title="Parámetros" triggerLabel="Controles" triggerIcon={<Settings size={16} />} side="right" defaultOpen>
          <div ref={setControlsSlot} />
        </FloatingPanel>
      )}
    </div>
  );
}
