import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Settings } from "lucide-react";
import type { LatticeCell } from "../types/physics";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";

interface LatticeSceneProps {
  cells: LatticeCell[];
  size: number;
}

function energyColor(normalized: number) {
  const hue = 150 - normalized * 150;
  return `hsl(${hue}, ${50 + normalized * 50}%, ${30 + normalized * 20}%)`;
}

function LatticeCells({ cells, gridSize }: { cells: LatticeCell[]; gridSize: number }) {
  const maxEnergy = useMemo(() => Math.max(...cells.map((c) => Math.abs(c.energy_density || 0)), 1e-9), [cells]);
  const half = (gridSize - 1) / 2;

  return (
    <group>
      {cells.map((cell, index) => {
        const normalized = Math.min(Math.abs(cell.energy_density || 0) / maxEnergy, 1);
        const x = (cell.x ?? 0) - half;
        const y = (cell.y ?? 0) - half;
        return (
          <mesh key={index} position={[x, y, 0]}>
            <boxGeometry args={[0.82, 0.82, 0.2 + normalized * 0.6]} />
            <meshStandardMaterial color={energyColor(normalized)} emissive={energyColor(normalized)} emissiveIntensity={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function LatticeWireGrid({ gridSize }: { gridSize: number }) {
  const half = (gridSize - 1) / 2;
  return (
    <gridHelper
      args={[gridSize, gridSize, "#4dd0e1", "#1f2937"]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -half - 0.5]}
    />
  );
}

export function LatticeScene({ cells: initialCells, size }: LatticeSceneProps) {
  const { latticeCells, latticeSize, step, observables, setControlsSlot } = useSimulationStore();
  const cellsToShow = latticeCells.length > 0 ? latticeCells : initialCells;
  const gridSize = latticeSize || size || 4;
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();

  return (
    <div
      ref={fullscreenRef}
      style={{ width: "100%", height: "100%", position: "relative", borderRadius: 8, overflow: "hidden", background: "#000000" }}
    >
      <Canvas
        camera={{ position: [gridSize * 1.4, gridSize * 1.1, gridSize * 1.6], fov: 50, near: 0.01, far: 20000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[gridSize, gridSize, gridSize]} intensity={1.1} />
        <pointLight position={[-gridSize, -gridSize, gridSize]} intensity={0.4} color="#5be49b" />
        <LatticeWireGrid gridSize={gridSize} />
        <LatticeCells cells={cellsToShow} gridSize={gridSize} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.12}
          minDistance={0.1}
          maxDistance={5000}
          zoomSpeed={1.1}
          panSpeed={0.8}
          rotateSpeed={0.7}
        />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>Lattice {gridSize}^3 x {gridSize}</span>
        <span>Paso {step}</span>
        <span>Celdas: {cellsToShow.length}</span>
        <span>Accion: {(observables.average_plaquette ?? observables.action ?? 0).toFixed(6)}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>Color y altura de cada celda = densidad de energia local</strong>
        <span><span className="legend-swatch" style={{ background: "hsl(150, 50%, 30%)" }} /> Baja energia</span>
        <span><span className="legend-swatch" style={{ background: "hsl(0, 100%, 50%)" }} /> Alta energia</span>
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
        Rueda: zoom · Clic izq + arrastrar: rotar · Clic der + arrastrar: mover
      </div>
      {isFullscreen && (
        <FloatingPanel title="Parámetros" triggerLabel="Controles" triggerIcon={<Settings size={16} />} side="left" defaultOpen>
          <div ref={setControlsSlot} />
        </FloatingPanel>
      )}
    </div>
  );
}
