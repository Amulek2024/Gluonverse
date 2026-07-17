import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  buildElectronSlots,
  computeElectronConfiguration,
  elementByZ,
  hydrogenicRadius,
  neutronCount,
  slaterZEff
} from "../utils/elements";
import { moleculeById } from "../utils/molecules";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { CameraFit } from "../components/CameraFit";
import { DistanceGrid, ElectronCloud, Nucleus, fibonacciSpherePoints } from "./AtomScenePlaceholder";

const BOND_COLOR_BY_ORDER: Record<number, string> = {
  1: "#94a3b8",
  2: "#ffd166",
  3: "#ff6b6b"
};

// Dibuja `order` lineas paralelas entre dos nucleos (convencion de Lewis para enlace
// simple/doble/triple): es una notacion esquematica, no una medicion de densidad de enlace ni
// una orbital molecular real (este simulador no calcula orbitales moleculares, ver
// MoleculeControls).
function Bond({ from, to, order }: { from: [number, number, number]; to: [number, number, number]; order: number }) {
  const lines = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const direction = end.clone().sub(start).normalize();
    const arbitrary = Math.abs(direction.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const perpendicular = new Vector3().crossVectors(direction, arbitrary).normalize();
    const spacing = 0.09;
    return Array.from({ length: order }, (_, index) => {
      const t = index - (order - 1) / 2;
      const shift = perpendicular.clone().multiplyScalar(t * spacing);
      return {
        points: [
          [start.x + shift.x, start.y + shift.y, start.z + shift.z],
          [end.x + shift.x, end.y + shift.y, end.z + shift.z]
        ] as Array<[number, number, number]>
      };
    });
  }, [from, to, order]);

  return (
    <group>
      {lines.map((line, index) => (
        <Line key={index} points={line.points} color={BOND_COLOR_BY_ORDER[order] ?? "#94a3b8"} lineWidth={2} />
      ))}
    </group>
  );
}

export function MoleculeScene() {
  const [paused, setPaused] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const selectedMoleculeId = useSimulationStore((state) => state.selectedMoleculeId);
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  const setControlsSlot = useSimulationStore((state) => state.setControlsSlot);
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const molecule = useMemo(() => moleculeById(selectedMoleculeId), [selectedMoleculeId]);

  // Cada atomo reutiliza exactamente el mismo modelo hibrido nucleo+nube electronica de la
  // vista Atomos (misma funcion de onda hidrogenoide real, mismo apantallamiento de Slater);
  // solo se traslada a su posicion de enlace. No se recalculan orbitales moleculares
  // compartidos entre atomos.
  const atoms = useMemo(() => {
    return molecule.atoms.map((atomSpec) => {
      const element = elementByZ(atomSpec.z);
      const config = computeElectronConfiguration(atomSpec.z);
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
        offset: atomSpec.offset,
        slots,
        zEffBySubshell,
        nucleusRadius: radius,
        protonPositions: fibonacciSpherePoints(element.z, radius),
        neutronPositions: fibonacciSpherePoints(neutrons, radius * 0.9),
        shellRadius: maxShellRadius
      };
    });
  }, [molecule]);

  const totalElectrons = useMemo(() => atoms.reduce((sum, atom) => sum + atom.slots.length, 0), [atoms]);
  const totalNucleons = useMemo(
    () => atoms.reduce((sum, atom) => sum + atom.protonPositions.length + atom.neutronPositions.length, 0),
    [atoms]
  );

  // Radio de encuadre = distancia del atomo mas lejano al centro molecular, mas su propio
  // radio de nube electronica (igual que gridInfo en AtomScenePlaceholder, pero sobre la
  // extension conjunta de todos los atomos en vez de uno solo).
  const boundingRadius = useMemo(() => {
    let maxExtent = 1;
    for (const atom of atoms) {
      const [x, y, z] = atom.offset;
      const centerDistance = Math.sqrt(x * x + y * y + z * z);
      maxExtent = Math.max(maxExtent, centerDistance + atom.shellRadius);
    }
    return maxExtent;
  }, [atoms]);

  const gridSize = Math.max(1.5, boundingRadius * 2.6);
  const gridDivisions = Math.max(4, Math.min(40, Math.round(gridSize / 0.5)));
  const cameraDistance = Math.max(2.4, gridSize * 0.85);

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
        {molecule.bonds.map((bond, index) => (
          <Bond key={index} from={molecule.atoms[bond.a].offset} to={molecule.atoms[bond.b].offset} order={bond.order} />
        ))}
        {atoms.map((atom, index) => (
          <group key={index} position={atom.offset}>
            <Nucleus protonPositions={atom.protonPositions} neutronPositions={atom.neutronPositions} nucleusRadius={atom.nucleusRadius} />
            <ElectronCloud slots={atom.slots} zEffBySubshell={atom.zEffBySubshell} elementZ={atom.element.z} paused={paused} />
          </group>
        ))}
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.12} minDistance={0.02} maxDistance={5000} zoomSpeed={1.1} panSpeed={0.8} rotateSpeed={0.7} />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>{molecule.name} ({molecule.formula})</span>
        <span>Atomos: {atoms.length}</span>
        <span>Electrones: {totalElectrons}</span>
        <span>Nucleones: {totalNucleons}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>Cada atomo es el mismo modelo hidrogenoide de la vista Atomos, trasladado a su posicion de enlace real. Sin orbitales moleculares compartidos.</strong>
        <span><span className="legend-swatch" style={{ background: BOND_COLOR_BY_ORDER[1] }} /> enlace simple</span>
        <span><span className="legend-swatch" style={{ background: BOND_COLOR_BY_ORDER[2] }} /> enlace doble</span>
        <span><span className="legend-swatch" style={{ background: BOND_COLOR_BY_ORDER[3] }} /> enlace triple</span>
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
        style={{ top: "5.6rem" }}
        onClick={() => setPaused((value) => !value)}
        title={paused ? "Reanudar el muestreo de las nubes electronicas" : "Pausar el muestreo (util para ver la forma de la molecula sin parpadeo)"}
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
