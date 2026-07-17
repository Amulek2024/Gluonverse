import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { AdditiveBlending, Color, DoubleSide, type BufferAttribute, type BufferGeometry } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useGravityStore } from "../stores/useGravityStore";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { CameraFit } from "../components/CameraFit";
import { getCircleSprite } from "../utils/pointSprite";
import { DEFAULT_BODY_STATS } from "../simulations/gravityPresets";
import type { GravityBody } from "../types/gravity";

// Tope duro de capacidad del buffer de puntos (ver plan): el cuerpo del arreglo solo encoge
// (fusiones), nunca crece salvo por clic del usuario -- se reserva de una vez a esta capacidad
// para no tener que recrear el BufferGeometry cuando el conteo cambia.
export const MAX_BODY_CAPACITY = 150;

const colorRGBCache = new Map<string, [number, number, number]>();
function colorToRGB(hex: string): [number, number, number] {
  const cached = colorRGBCache.get(hex);
  if (cached) return cached;
  const c = new Color(hex);
  const rgb: [number, number, number] = [c.r, c.g, c.b];
  colorRGBCache.set(hex, rgb);
  return rgb;
}

function boundingRadius(bodies: GravityBody[]): number {
  let maxR = 1.5;
  for (const body of bodies) {
    const r = Math.sqrt(body.position[0] ** 2 + body.position[1] ** 2 + body.position[2] ** 2) + body.radius;
    if (r > maxR) maxR = r;
  }
  return maxR;
}

function DistanceGrid({ size }: { size: number }) {
  return <gridHelper args={[size, 20, "#2a3548", "#1a2333"]} />;
}

// Cuerpos "core" (nucleos/estrellas grandes, pocos por preset) se dibujan como esferas
// distinguibles en vez de sumarse a la nube de puntos pensada para cuerpos livianos y
// numerosos (star/planet/debris).
function CoreBodies({
  bodies,
  selectedId,
  onSelect
}: {
  bodies: GravityBody[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const cores = bodies.filter((body) => body.kind === "core");
  return (
    <group>
      {cores.map((body) => (
        <mesh
          key={body.id}
          position={body.position}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(body.id);
          }}
        >
          <sphereGeometry args={[body.radius, 24, 24]} />
          <meshStandardMaterial
            color={body.color}
            emissive={body.color}
            emissiveIntensity={body.id === selectedId ? 0.95 : 0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

// Un solo BufferGeometry/draw-call para todos los cuerpos livianos, con capacidad fija y
// setDrawRange para que fusiones (que solo encogen el conteo activo) no requieran recrear el
// buffer. A diferencia de la nube orbital de Atomos, aqui TODAS las posiciones cambian cada
// paso (no es un subconjunto que "parpadea"), asi que se reescribe el rango activo entero cada
// vez que cambian los cuerpos, en un solo rango contiguo.
function PointBodies({ bodies }: { bodies: GravityBody[] }) {
  const geometryRef = useRef<BufferGeometry>(null);
  const positionAttrRef = useRef<BufferAttribute>(null);
  const colorAttrRef = useRef<BufferAttribute>(null);

  const buffers = useMemo(
    () => ({
      positions: new Float32Array(MAX_BODY_CAPACITY * 3),
      colors: new Float32Array(MAX_BODY_CAPACITY * 3)
    }),
    []
  );

  const lightBodies = useMemo(() => bodies.filter((body) => body.kind !== "core"), [bodies]);

  useEffect(() => {
    const posAttr = positionAttrRef.current;
    const colorAttr = colorAttrRef.current;
    const geometry = geometryRef.current;
    if (!posAttr || !colorAttr) return;
    const posArray = posAttr.array as Float32Array;
    const colorArray = colorAttr.array as Float32Array;
    const count = Math.min(lightBodies.length, MAX_BODY_CAPACITY);
    for (let i = 0; i < count; i += 1) {
      const body = lightBodies[i];
      posArray[i * 3] = body.position[0];
      posArray[i * 3 + 1] = body.position[1];
      posArray[i * 3 + 2] = body.position[2];
      const [r, g, b] = colorToRGB(body.color);
      colorArray[i * 3] = r;
      colorArray[i * 3 + 1] = g;
      colorArray[i * 3 + 2] = b;
    }
    posAttr.clearUpdateRanges();
    posAttr.addUpdateRange(0, count * 3);
    posAttr.needsUpdate = true;
    colorAttr.clearUpdateRanges();
    colorAttr.addUpdateRange(0, count * 3);
    colorAttr.needsUpdate = true;
    geometry?.setDrawRange(0, count);
  }, [lightBodies]);

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute ref={positionAttrRef} attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute ref={colorAttrRef} attach="attributes-color" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        map={getCircleSprite()}
        alphaTest={0.01}
        size={0.2}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

// Plano invisible que capta clic derecho (sin arrastre) para agregar un cuerpo en ese punto,
// igual que "clic der para agregar un quark" en el laboratorio de quarks (GluonScenePlaceholder).
function AddBodyPlane({ onAdd }: { onAdd: (position: [number, number, number]) => void }) {
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

function GravityBodies() {
  const bodies = useGravityStore((state) => state.bodies);
  const selectedBodyId = useGravityStore((state) => state.selectedBodyId);
  const selectBody = useGravityStore((state) => state.selectBody);

  // stepLocal() ya revisa "paused" internamente (fuente unica de verdad en el store), asi que
  // no se necesita gatillar aqui: pausar simplemente hace que cada llamada sea un no-op.
  useFrame(() => {
    useGravityStore.getState().stepLocal();
  });

  return (
    <>
      <CoreBodies bodies={bodies} selectedId={selectedBodyId} onSelect={selectBody} />
      <PointBodies bodies={bodies} />
    </>
  );
}

export function GravityScene() {
  const paused = useGravityStore((state) => state.paused);
  const togglePaused = useGravityStore((state) => state.togglePaused);
  const initialBodies = useGravityStore((state) => state.initialBodies);
  const cameraResetTokenFromStore = useGravityStore((state) => state.cameraResetToken);
  const bodyCount = useGravityStore((state) => state.bodies.length);
  const presetId = useGravityStore((state) => state.presetId);
  const params = useGravityStore((state) => state.params);
  const addBodyKind = useGravityStore((state) => state.addBodyKind);
  const addBody = useGravityStore((state) => state.addBody);
  const resetCamera = useGravityStore((state) => state.resetCamera);

  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  const setControlsSlot = useSimulationStore((state) => state.setControlsSlot);

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Basado en initialBodies (instantanea al cargar el preset), no en los cuerpos en vivo: si
  // dependiera de las posiciones en movimiento, CameraFit pelearia con el zoom/pan manual del
  // usuario en cada paso de la simulacion.
  const cameraDistance = useMemo(() => Math.max(3, boundingRadius(initialBodies) * 2.1), [initialBodies]);
  const gridSize = useMemo(() => Math.max(4, boundingRadius(initialBodies) * 3), [initialBodies]);

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
        <AddBodyPlane
          onAdd={(position) => {
            if (useGravityStore.getState().bodies.length >= MAX_BODY_CAPACITY) return;
            const stats = DEFAULT_BODY_STATS[addBodyKind];
            addBody({ kind: addBodyKind, position, mass: stats.mass, radius: stats.radius, velocity: [0, 0, 0] });
          }}
        />
        <GravityBodies />
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
        <span>Cuerpos: {bodyCount}</span>
        <span>G = {params.G} · softening = {params.softening.toFixed(2)}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>Gravedad newtoniana N-body completa. Fusion {params.mergeEnabled ? "activada" : "desactivada"}.</strong>
        <span><span className="legend-swatch" style={{ background: "#ffb74d" }} /> nucleo/estrella grande</span>
        <span><span className="legend-swatch" style={{ background: "#fff4cc" }} /> estrella</span>
        <span><span className="legend-swatch" style={{ background: "#4dd0e1" }} /> planeta</span>
        <span><span className="legend-swatch" style={{ background: "#9aa4b2" }} /> escombro</span>
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
      <div className="scene-hint" aria-hidden="true">
        Rueda: zoom · Clic izq + arrastrar: rotar · Clic der + arrastrar: mover · Clic der (sin arrastrar): agregar cuerpo
      </div>
      {isFullscreen && (
        <FloatingPanel title="Parámetros" triggerLabel="Controles" triggerIcon={<Settings size={16} />} side="right" defaultOpen>
          <div ref={setControlsSlot} />
        </FloatingPanel>
      )}
    </div>
  );
}
