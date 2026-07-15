import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { AdditiveBlending, Color, type BufferAttribute } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  buildElectronSlots,
  computeElectronConfiguration,
  createOrbitalSampler,
  elementByZ,
  hydrogenicRadius,
  neutronCount,
  slaterZEff,
  type ElectronSlot
} from "../utils/elements";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { getCircleSprite } from "../utils/pointSprite";
import { CameraFit } from "../components/CameraFit";

const SUBSHELL_COLOR: Record<string, string> = {
  s: "#4dd0e1",
  p: "#ffd166",
  d: "#b967ff",
  f: "#2bff7a"
};

// Distribucion de Fibonacci-sphere: reparte N puntos aproximadamente uniformes sobre una
// esfera. Solo se usa para dar forma visual al cluster de nucleones, no representa la
// disposicion real de nucleones dentro de un nucleo.
function fibonacciSpherePoints(count: number, radius: number): Array<[number, number, number]> {
  if (count <= 0) return [];
  if (count === 1) return [[0, 0, 0]];
  const points: Array<[number, number, number]> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
  }
  return points;
}

// Cuadricula de referencia espacial (analoga a la del laboratorio de quarks), escalada al
// radio real del atomo seleccionado para dar una nocion de tamano/distancia. 1 unidad de
// escena = 1 Angstrom (ver utils/elements.ts).
function DistanceGrid({ size, divisions }: { size: number; divisions: number }) {
  return <gridHelper args={[size, divisions, "#2a3548", "#1a2333"]} />;
}

function shellCirclePoints(radius: number, plane: "xy" | "xz" | "yz", segments = 64): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (2 * Math.PI * i) / segments;
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    if (plane === "xy") points.push([a, b, 0]);
    else if (plane === "xz") points.push([a, 0, b]);
    else points.push([0, a, b]);
  }
  return points;
}

// Marca la frontera de cada capa principal (n) con 3 anillos ortogonales, para separar
// visualmente las "capas" donde circulan los electrones (radio hidrogenoide de la subcapa s de
// cada n). Es un limite esquematico, no una orbita real ni un limite de probabilidad exacto.
function ShellPartitions({ radii }: { radii: number[] }) {
  return (
    <group>
      {radii.map((radius, index) => (
        <group key={index}>
          <Line points={shellCirclePoints(radius, "xy")} color="#6b7d99" transparent opacity={0.25} lineWidth={1} />
          <Line points={shellCirclePoints(radius, "xz")} color="#6b7d99" transparent opacity={0.25} lineWidth={1} />
          <Line points={shellCirclePoints(radius, "yz")} color="#6b7d99" transparent opacity={0.25} lineWidth={1} />
        </group>
      ))}
    </group>
  );
}

function Nucleus({ protonPositions, neutronPositions, nucleusRadius }: {
  protonPositions: Array<[number, number, number]>;
  neutronPositions: Array<[number, number, number]>;
  nucleusRadius: number;
}) {
  return (
    <group>
      {/* Aura translucida que marca el nucleo frente a la nube electronica; no es un tamano
          fisico (el nucleo real ya se dibuja mas grande de lo debido, ver DistanceGrid). */}
      <mesh>
        <sphereGeometry args={[nucleusRadius * 1.6, 24, 24]} />
        <meshBasicMaterial color="#ffb74d" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {protonPositions.map((position, index) => (
        <mesh key={`p-${index}`} position={position}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshStandardMaterial color="#ff8a65" emissive="#ff8a65" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {neutronPositions.map((position, index) => (
        <mesh key={`n-${index}`} position={position}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshStandardMaterial color="#9aa4b2" emissive="#9aa4b2" emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

interface OrbitalGroup {
  n: number;
  l: number;
  m: number;
  occupancy: number;
  subshellLabel: string;
}

// Agrupa los electrones por orbital real (n,l,m) en vez de tratarlos como puntos sueltos: un
// orbital ocupado por 1 o 2 electrones (regla de Hund/Pauli) es una unica nube de densidad.
function groupSlotsByOrbital(slots: ElectronSlot[]): OrbitalGroup[] {
  const map = new Map<string, OrbitalGroup>();
  for (const slot of slots) {
    const key = `${slot.n}-${slot.l}-${slot.m}`;
    const existing = map.get(key);
    if (existing) existing.occupancy += 1;
    else map.set(key, { n: slot.n, l: slot.l, m: slot.m, occupancy: 1, subshellLabel: slot.subshellLabel });
  }
  return Array.from(map.values());
}

// Puntos de muestra por electron en el orbital. Con rechazo desde |psi|^2 real, la propia
// densidad espacial de puntos ya seria proporcional a la probabilidad (incluye nodos radiales);
// el blending aditivo hace que las zonas densas se vean mas brillantes, como en un grafico de
// densidad de libro de texto, sin necesitar un mapa de color por intensidad aparte.
const SAMPLE_POINTS_PER_ELECTRON = 160;
// Los lobulos angulares (p/d/f) concentran su densidad en menos direcciones que una esfera s,
// asi que con el mismo numero de puntos se ven mas dispersos/debiles junto a la nube s (que
// ocupa el mismo volumen). Se compensa dando mas puntos por electron cuanto mayor es l.
const POINTS_PER_ELECTRON_BY_L = [1, 1.6, 2.1, 2.6];
// Fraccion "ideal" de puntos a re-muestrear cada frame por orbital (efecto "estatica de TV").
// Se combina con un presupuesto GLOBAL (ver GLOBAL_REFRESH_BUDGET) para que el costo por frame
// no crezca sin limite con la cantidad de orbitales: un atomo pesado como el Lawrencio (103
// electrones, 52 orbitales distintos) no debe re-muestrear 50x mas puntos/frame que el Hidrogeno.
const REFRESH_FRACTION_PER_FRAME = 0.55;
// Tope de puntos re-muestreados por frame sumando TODOS los orbitales visibles. Reparte
// equitativamente entre orbitales (presupuesto/orbitales), asi el costo de CPU se mantiene
// aprox. constante sin importar cuantos orbitales tenga el elemento seleccionado.
const GLOBAL_REFRESH_BUDGET_PER_FRAME = 700;

interface OrbitalRuntime {
  sampler: ReturnType<typeof createOrbitalSampler>;
  pointCount: number;
  offset: number;
  color: Color;
  cursor: number;
}

// Un draw call por orbital (hasta ~52 para un atomo pesado como el Lawrencio) satura al GPU de
// cambios de estado/shader independientemente de cuanta CPU se ahorre muestreando. Se combinan
// todos los orbitales en UN solo BufferGeometry (posicion + color por vertice) y un solo
// <points>, para que el costo de dibujo no crezca con la cantidad de orbitales del elemento.
function ElectronCloud({
  slots,
  zEffBySubshell,
  elementZ,
  paused
}: {
  slots: ElectronSlot[];
  zEffBySubshell: Map<string, number>;
  elementZ: number;
  paused: boolean;
}) {
  const groups = useMemo(() => groupSlotsByOrbital(slots), [slots]);

  const runtime = useMemo(() => {
    let offset = 0;
    const orbitals: OrbitalRuntime[] = groups.map((group) => {
      const zEff = zEffBySubshell.get(`${group.n}-${group.l}`) ?? elementZ;
      const lMultiplier = POINTS_PER_ELECTRON_BY_L[group.l] ?? 1;
      const pointCount = Math.round(group.occupancy * SAMPLE_POINTS_PER_ELECTRON * lMultiplier);
      const sampler = createOrbitalSampler(group.n, group.l, group.m, zEff);
      const color = new Color(SUBSHELL_COLOR[group.subshellLabel.slice(-1)] || "#4dd0e1");
      const entry: OrbitalRuntime = { sampler, pointCount, offset, color, cursor: 0 };
      offset += pointCount;
      return entry;
    });
    return { orbitals, totalPoints: offset };
  }, [groups, zEffBySubshell, elementZ]);

  const { positions, colors } = useMemo(() => {
    const positionArray = new Float32Array(runtime.totalPoints * 3);
    const colorArray = new Float32Array(runtime.totalPoints * 3);
    for (const orbital of runtime.orbitals) {
      for (let i = 0; i < orbital.pointCount; i += 1) {
        const [x, y, z] = orbital.sampler.sample();
        const index = orbital.offset + i;
        positionArray[index * 3] = x;
        positionArray[index * 3 + 1] = y;
        positionArray[index * 3 + 2] = z;
        colorArray[index * 3] = orbital.color.r;
        colorArray[index * 3 + 1] = orbital.color.g;
        colorArray[index * 3 + 2] = orbital.color.b;
      }
    }
    return { positions: positionArray, colors: colorArray };
  }, [runtime]);

  const positionAttrRef = useRef<BufferAttribute>(null);

  useFrame(() => {
    if (paused) return;
    const attr = positionAttrRef.current;
    const orbitalCount = runtime.orbitals.length;
    if (!attr || orbitalCount === 0) return;
    const array = attr.array as Float32Array;
    const fairShare = Math.floor(GLOBAL_REFRESH_BUDGET_PER_FRAME / orbitalCount);
    attr.clearUpdateRanges();
    for (const orbital of runtime.orbitals) {
      const idealRefresh = Math.round(orbital.pointCount * REFRESH_FRACTION_PER_FRAME);
      // Ventana contigua rotativa en vez de indices al azar: mismo muestreo aleatorio real por
      // punto (el orden de los puntos en el buffer ya es arbitrario), pero permite subir a la
      // GPU un solo rango contiguo por orbital en vez de cientos de escrituras sueltas.
      const refreshCount = Math.max(1, Math.min(idealRefresh, fairShare, orbital.pointCount));
      const start = orbital.cursor;
      const end = Math.min(start + refreshCount, orbital.pointCount);
      for (let local = start; local < end; local += 1) {
        const globalIndex = orbital.offset + local;
        const [x, y, z] = orbital.sampler.sample();
        array[globalIndex * 3] = x;
        array[globalIndex * 3 + 1] = y;
        array[globalIndex * 3 + 2] = z;
      }
      attr.addUpdateRange((orbital.offset + start) * 3, (end - start) * 3);
      orbital.cursor = end >= orbital.pointCount ? 0 : end;
    }
    attr.needsUpdate = true;
  });

  if (runtime.totalPoints === 0) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={positionAttrRef} attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        map={getCircleSprite()}
        alphaTest={0.01}
        size={0.062}
        sizeAttenuation
        transparent
        opacity={0.82}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export function AtomScene() {
  const [paused, setPaused] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const selectedElementZ = useSimulationStore((state) => state.selectedElementZ);
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  const setControlsSlot = useSimulationStore((state) => state.setControlsSlot);
  const applyPreset = useSimulationStore((state) => state.applyPreset);
  const setView = useSimulationStore((state) => state.setView);
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const { element, config, slots, protonPositions, neutronPositions, nucleusRadius } = useMemo(() => {
    const el = elementByZ(selectedElementZ);
    const cfg = computeElectronConfiguration(selectedElementZ);
    const electronSlots = buildElectronSlots(cfg);
    const neutrons = neutronCount(el);
    const massNumber = el.z + neutrons;
    // Radio visual acotado, no a escala real: el nucleo real es ~100,000 veces mas chico
    // que la nube electronica; mostrarlo a escala haria que fuera invisible.
    const radius = Math.min(Math.max(0.05 + 0.025 * Math.cbrt(massNumber), 0.05), 0.24);
    return {
      element: el,
      config: cfg,
      slots: electronSlots,
      protonPositions: fibonacciSpherePoints(el.z, radius),
      neutronPositions: fibonacciSpherePoints(neutrons, radius * 0.9),
      nucleusRadius: radius
    };
  }, [selectedElementZ]);

  const zEffBySubshell = useMemo(() => {
    const map = new Map<string, number>();
    for (const shell of config) {
      const key = `${shell.n}-${shell.l}`;
      if (!map.has(key)) {
        map.set(key, slaterZEff(element.z, shell.n, shell.l, config));
      }
    }
    return map;
  }, [config, element.z]);

  const gridInfo = useMemo(() => {
    let maxShellRadius = hydrogenicRadius(1, element.z);
    for (const shell of config) {
      const zEff = zEffBySubshell.get(`${shell.n}-${shell.l}`) ?? element.z;
      maxShellRadius = Math.max(maxShellRadius, hydrogenicRadius(shell.n, zEff));
    }
    const size = Math.max(1, maxShellRadius * 2.6);
    const rawStep = size / 10;
    const step = rawStep < 0.5 ? 0.5 : Math.round(rawStep * 2) / 2;
    const divisions = Math.max(4, Math.min(40, Math.round(size / step)));
    return { size, divisions, step: size / divisions };
  }, [config, zEffBySubshell, element.z]);

  // Distancia de camara proporcional al tamano del atomo actual (ver CameraFit): sin esto, la
  // distancia fija original dejaba a los atomos chicos como un punto invisible y a los grandes
  // con la camara metida dentro de la nube.
  const cameraDistance = Math.max(2.2, gridInfo.size * 0.85);

  const shellRadii = useMemo(() => {
    const principalNumbers = Array.from(new Set(config.map((shell) => shell.n))).sort((a, b) => a - b);
    return principalNumbers.map((n) => {
      const zEff = zEffBySubshell.get(`${n}-0`) ?? element.z;
      return hydrogenicRadius(n, zEff);
    });
  }, [config, zEffBySubshell, element.z]);

  return (
    <div
      ref={fullscreenRef}
      style={{ width: "100%", height: "100%", position: "relative", borderRadius: 8, overflow: "hidden", background: "#0b0f1a" }}
    >
      <Canvas camera={{ position: [3, 2, 4], fov: 50, near: 0.01, far: 20000 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b0f1a"]} />
        <ambientLight intensity={0.55} />
        <pointLight position={[3, 3, 4]} intensity={1.1} />
        <pointLight position={[-3, -2, -3]} intensity={0.4} color="#4dd0e1" />
        <CameraFit distance={cameraDistance} controlsRef={controlsRef} resetToken={cameraResetToken} />
        <DistanceGrid size={gridInfo.size} divisions={gridInfo.divisions} />
        <ShellPartitions radii={shellRadii} />
        <Nucleus protonPositions={protonPositions} neutronPositions={neutronPositions} nucleusRadius={nucleusRadius} />
        <ElectronCloud slots={slots} zEffBySubshell={zEffBySubshell} elementZ={element.z} paused={paused} />
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.12} minDistance={0.02} maxDistance={5000} zoomSpeed={1.1} panSpeed={0.8} rotateSpeed={0.7} />
      </Canvas>
      <div className="scene-hud" aria-hidden="true">
        <span>{element.name} ({element.symbol})</span>
        <span>Z = {element.z}</span>
        <span>Electrones: {slots.length}</span>
        <span>Nucleones: {protonPositions.length + neutronPositions.length}</span>
      </div>
      <div className="scene-legend" aria-hidden="true">
        <strong>Color de la nube = subcapa (s/p/d/f). Brillo = densidad |psi|^2 (revela nodos radiales). Nucleo: tamano no a escala real.</strong>
        <span>Cuadricula: cada celda ≈ {gridInfo.step.toFixed(2)} Å</span>
        <span><span className="legend-swatch" style={{ background: SUBSHELL_COLOR.s }} /> s</span>
        <span><span className="legend-swatch" style={{ background: SUBSHELL_COLOR.p }} /> p</span>
        <span><span className="legend-swatch" style={{ background: SUBSHELL_COLOR.d }} /> d</span>
        <span><span className="legend-swatch" style={{ background: SUBSHELL_COLOR.f }} /> f</span>
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
        className="scene-action-btn"
        onClick={() => {
          applyPreset("proton");
          setView("laboratorio");
        }}
        title="Ver un proton del nucleo a escala real, en el laboratorio de quarks"
      >
        Ver núcleo
      </button>
      <button
        type="button"
        className="scene-fullscreen-btn"
        style={{ top: "5.6rem" }}
        onClick={() => setPaused((value) => !value)}
        title={paused ? "Reanudar el muestreo de la nube electronica" : "Pausar el muestreo (util para ver la forma del orbital sin parpadeo)"}
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
