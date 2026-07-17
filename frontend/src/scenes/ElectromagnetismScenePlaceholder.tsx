import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { DoubleSide } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useElectromagnetismStore } from "../stores/useElectromagnetismStore";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { CameraFit } from "../components/CameraFit";
import type { ChargedBody } from "../types/electromagnetism";

function DistanceGrid({ size }: { size: number }) {
  return <gridHelper args={[size, 20, "#2a3548", "#1a2333"]} />;
}

function boundingRadius(bodies: ChargedBody[]): number {
  let maxR = 1.5;
  for (const body of bodies) {
    const r = Math.sqrt(body.position[0] ** 2 + body.position[1] ** 2 + body.position[2] ** 2) + body.radius;
    if (r > maxR) maxR = r;
  }
  return maxR;
}

function ChargeSpheres({ bodies, selectedId, onSelect }: { bodies: ChargedBody[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <group>
      {bodies.map((body) => (
        <mesh
          key={body.id}
          position={body.position}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(body.id);
          }}
        >
          <sphereGeometry args={[body.radius, 24, 24]} />
          <meshStandardMaterial color={body.color} emissive={body.color} emissiveIntensity={body.id === selectedId ? 0.95 : 0.55} />
        </mesh>
      ))}
    </group>
  );
}

const FIELD_GRID_STEPS = 7;
const FIELD_ARROW_LENGTH_FRACTION = 0.16;

// Lineas cortas de direccion del campo electrico neto (E = suma sobre cargas de k*qi*r_hat/r^2)
// muestreado en una grilla en el plano z=0: longitud FIJA (no proporcional a la magnitud, para
// evitar flechas gigantes junto a una carga) que solo indica direccion, con opacidad segun
// magnitud relativa. Recalculado cada vez que cambian las cargas (posicion o carga), no cada
// frame de fisica -- ver el useMemo en ElectromagnetismScene.
function FieldArrows({ bodies, coulombConstant, extent }: { bodies: ChargedBody[]; coulombConstant: number; extent: number }) {
  const arrows = useMemo(() => {
    if (bodies.length === 0) return [];
    const step = (extent * 2) / (FIELD_GRID_STEPS - 1);
    const arrowLength = step * FIELD_ARROW_LENGTH_FRACTION * (FIELD_GRID_STEPS - 1);
    const result: Array<{ key: string; points: Array<[number, number, number]>; opacity: number }> = [];
    let maxMag = 1e-9;
    const rawVectors: Array<{ x: number; y: number; ex: number; ey: number; mag: number }> = [];

    for (let ix = 0; ix < FIELD_GRID_STEPS; ix += 1) {
      for (let iy = 0; iy < FIELD_GRID_STEPS; iy += 1) {
        const x = -extent + ix * step;
        const y = -extent + iy * step;
        let ex = 0;
        let ey = 0;
        for (const body of bodies) {
          const dx = x - body.position[0];
          const dy = y - body.position[1];
          const dz = -body.position[2];
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < 0.04) continue;
          const dist = Math.sqrt(distSq);
          const factor = (coulombConstant * body.charge) / (distSq * dist);
          ex += factor * dx;
          ey += factor * dy;
        }
        const mag = Math.sqrt(ex * ex + ey * ey);
        if (mag > maxMag) maxMag = mag;
        rawVectors.push({ x, y, ex, ey, mag });
      }
    }

    for (const vector of rawVectors) {
      if (vector.mag < 1e-9) continue;
      const nx = vector.ex / vector.mag;
      const ny = vector.ey / vector.mag;
      const opacity = 0.15 + 0.55 * Math.min(1, Math.log10(1 + vector.mag) / Math.log10(1 + maxMag));
      result.push({
        key: `${vector.x.toFixed(2)}-${vector.y.toFixed(2)}`,
        points: [
          [vector.x, vector.y, 0],
          [vector.x + nx * arrowLength, vector.y + ny * arrowLength, 0]
        ],
        opacity
      });
    }
    return result;
  }, [bodies, coulombConstant, extent]);

  return (
    <group>
      {arrows.map((arrow) => (
        <Line key={arrow.key} points={arrow.points} color="#7ba7d1" lineWidth={1} transparent opacity={arrow.opacity} />
      ))}
    </group>
  );
}

function AddChargePlane({ onAdd }: { onAdd: (position: [number, number, number]) => void }) {
  const rightDownRef = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      onPointerDown={(event) => {
        if (event.nativeEvent.button === 2) {
          rightDownRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
        }
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        const down = rightDownRef.current;
        const moved = down ? Math.hypot(event.nativeEvent.clientX - down.x, event.nativeEvent.clientY - down.y) : 0;
        if (moved < 6) {
          onAdd([event.point.x, event.point.y, event.point.z]);
        }
      }}
    >
      <planeGeometry args={[8000, 8000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

function ChargedBodies() {
  const bodies = useElectromagnetismStore((state) => state.bodies);
  const selectedBodyId = useElectromagnetismStore((state) => state.selectedBodyId);
  const selectBody = useElectromagnetismStore((state) => state.selectBody);

  useFrame(() => {
    useElectromagnetismStore.getState().stepLocal();
  });

  return <ChargeSpheres bodies={bodies} selectedId={selectedBodyId} onSelect={selectBody} />;
}

export function ElectromagnetismScene() {
  const paused = useElectromagnetismStore((state) => state.paused);
  const togglePaused = useElectromagnetismStore((state) => state.togglePaused);
  const initialBodies = useElectromagnetismStore((state) => state.initialBodies);
  const bodies = useElectromagnetismStore((state) => state.bodies);
  const cameraResetTokenFromStore = useElectromagnetismStore((state) => state.cameraResetToken);
  const presetId = useElectromagnetismStore((state) => state.presetId);
  const params = useElectromagnetismStore((state) => state.params);
  const addChargeSign = useElectromagnetismStore((state) => state.addChargeSign);
  const addBody = useElectromagnetismStore((state) => state.addBody);
  const resetCamera = useElectromagnetismStore((state) => state.resetCamera);

  const [showField, setShowField] = useState(true);
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  const setControlsSlot = useSimulationStore((state) => state.setControlsSlot);

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Piso mas alto que en Gravedad (3/4): a diferencia de las orbitas acotadas de Gravedad, el
  // preset de repulsion se expande sin limite, asi que un piso mas generoso deja ver el
  // "estallido" inicial completo antes de que las cargas salgan del encuadre.
  const cameraDistance = useMemo(() => Math.max(5, boundingRadius(initialBodies) * 2.1), [initialBodies]);
  const gridSize = useMemo(() => Math.max(7, boundingRadius(initialBodies) * 3), [initialBodies]);
  const fieldExtent = useMemo(() => Math.max(2, boundingRadius(initialBodies) * 1.3), [initialBodies]);

  const positiveCount = useMemo(() => bodies.filter((body) => body.charge > 0).length, [bodies]);
  const negativeCount = useMemo(() => bodies.filter((body) => body.charge < 0).length, [bodies]);

  return (
    <div
      ref={fullscreenRef}
      style={{ width: "100%", height: "100%", position: "relative", borderRadius: 8, overflow: "hidden", background: "#000000" }}
    >
      <Canvas camera={{ position: [3, 2, 4], fov: 50, near: 0.01, far: 20000 }} dpr={[1, 2]}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.45} />
        <pointLight position={[5, 4, 6]} intensity={1.2} />
        <pointLight position={[-5, -3, -4]} intensity={0.4} color="#4dd0e1" />
        <CameraFit distance={cameraDistance} controlsRef={controlsRef} resetToken={cameraResetTokenFromStore} />
        <DistanceGrid size={gridSize} />
        {showField && <FieldArrows bodies={bodies} coulombConstant={params.coulombConstant} extent={fieldExtent} />}
        <AddChargePlane
          onAdd={(position) => {
            addBody({ position, charge: addChargeSign });
          }}
        />
        <ChargedBodies />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.12}
          minDistance={0.02}
          maxDistance={5000}
          zoomSpeed={1.1}
          panSpeed={0.8}
          rotateSpeed={0.7}
        />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>Preset: {presetId}</span>
        <span>Cargas: {positiveCount}+ / {negativeCount}-</span>
        <span>{params.magnetismEnabled ? `Campo B = ${params.bFieldZ.toFixed(2)} (eje Z)` : "Campo B: apagado"}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>
          Coulomb real entre cargas (k, softening ilustrativos). Lorentz (v x B) solo si el
          campo magnetico esta activo; B es uniforme, no generado por las cargas.
        </strong>
        <span><span className="legend-swatch" style={{ background: "#ff6b6b" }} /> carga positiva</span>
        <span><span className="legend-swatch" style={{ background: "#4dd0e1" }} /> carga negativa</span>
        <span><span className="legend-swatch" style={{ background: "#7ba7d1" }} /> direccion del campo E (longitud fija)</span>
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
        title={paused ? "Reanudar la simulacion" : "Pausar la simulacion"}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "5.6rem" }}
        onClick={resetCamera}
        title="Reiniciar posicion de camara"
      >
        <RotateCcw size={16} />
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "8.1rem" }}
        onClick={() => setShowField((value) => !value)}
        title={showField ? "Ocultar lineas de campo electrico" : "Mostrar lineas de campo electrico"}
      >
        E
      </button>
      <div className="scene-hint" aria-hidden="true">
        Rueda: zoom · Clic izq + arrastrar: rotar · Clic der + arrastrar: mover · Clic der (sin arrastrar): agregar carga
      </div>
      {isFullscreen && (
        <FloatingPanel title="Parámetros" triggerLabel="Controles" triggerIcon={<Settings size={16} />} side="right" defaultOpen>
          <div ref={setControlsSlot} />
        </FloatingPanel>
      )}
    </div>
  );
}
