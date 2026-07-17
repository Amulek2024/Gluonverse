import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Maximize, Minimize, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { AdditiveBlending, Vector3, type BufferAttribute } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  buildElectronSlots,
  computeElectronConfiguration,
  elementByZ,
  hydrogenicRadius,
  neutronCount,
  slaterZEff
} from "../utils/elements";
import { classifyHybridization, createCustomOrbitalSampler, hybridAmplitude, valenceOrbitalBasis } from "../utils/molecularOrbitals";
import { moleculeById } from "../utils/molecules";
import { useSimulationStore } from "../stores/useSimulationStore";
import { useFullscreen } from "../utils/useFullscreen";
import { FloatingPanel } from "../components/FloatingPanel";
import { CameraFit } from "../components/CameraFit";
import { getCircleSprite } from "../utils/pointSprite";
import { DistanceGrid, ElectronCloud, Nucleus, fibonacciSpherePoints } from "./AtomScenePlaceholder";

const BOND_COLOR_BY_ORDER: Record<number, string> = {
  1: "#94a3b8",
  2: "#ffd166",
  3: "#ff6b6b"
};

// Dibuja `order` lineas paralelas entre dos nucleos (convencion de Lewis para enlace
// simple/doble/triple): sigue siendo una notacion esquematica de libro de texto, no una
// medicion de densidad de enlace. El orbital de enlace real (LCAO) se dibuja aparte, ver
// BondOrbitalCloud -- pero solo representa la componente tipo sigma, asi que el orden de enlace
// (simple/doble/triple) NO se refleja en la forma de esa nube, solo en estas lineas.
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

const BOND_ORBITAL_COLOR = "#f5f3ff";
const BOND_ORBITAL_POINTS = 350;
const BOND_ORBITAL_REFRESH_FRACTION = 0.35;

// Nube de un orbital molecular de enlace (LCAO, ver utils/molecularOrbitals.ts): la suma de las
// amplitudes hibridas/atomicas de los dos nucleos del enlace, ya evaluada en coordenadas
// absolutas de la escena por el llamador (no recibe posiciones de nucleo, solo la funcion de
// densidad ya combinada). Mismo patron de remuestreo periodico parcial que ElectronCloud, pero
// sin agrupar por orbital (una sola nube por enlace).
function BondOrbitalCloud({
  psi,
  center,
  halfExtent,
  paused
}: {
  psi: (x: number, y: number, z: number) => number;
  center: [number, number, number];
  halfExtent: number;
  paused: boolean;
}) {
  const sampler = useMemo(
    () => createCustomOrbitalSampler(psi, center, halfExtent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center[0], center[1], center[2], halfExtent]
  );

  const { positions, colors } = useMemo(() => {
    const positionArray = new Float32Array(BOND_ORBITAL_POINTS * 3);
    const colorArray = new Float32Array(BOND_ORBITAL_POINTS * 3);
    for (let i = 0; i < BOND_ORBITAL_POINTS; i += 1) {
      const [x, y, z] = sampler.sample();
      positionArray[i * 3] = x;
      positionArray[i * 3 + 1] = y;
      positionArray[i * 3 + 2] = z;
      colorArray[i * 3] = 1;
      colorArray[i * 3 + 1] = 1;
      colorArray[i * 3 + 2] = 1;
    }
    return { positions: positionArray, colors: colorArray };
  }, [sampler]);

  const positionAttrRef = useRef<BufferAttribute>(null);
  const cursorRef = useRef(0);

  useFrame(() => {
    if (paused) return;
    const attr = positionAttrRef.current;
    if (!attr) return;
    const array = attr.array as Float32Array;
    const refreshCount = Math.max(1, Math.round(BOND_ORBITAL_POINTS * BOND_ORBITAL_REFRESH_FRACTION));
    const start = cursorRef.current;
    const end = Math.min(start + refreshCount, BOND_ORBITAL_POINTS);
    for (let i = start; i < end; i += 1) {
      const [x, y, z] = sampler.sample();
      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }
    attr.clearUpdateRanges();
    attr.addUpdateRange(start * 3, (end - start) * 3);
    attr.needsUpdate = true;
    cursorRef.current = end >= BOND_ORBITAL_POINTS ? 0 : end;
  });

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
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
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
  // vista Atomos (misma funcion de onda hidrogenoide real, mismo apantallamiento de Slater),
  // trasladado a su posicion de enlace real -- esta nube se sigue mostrando SIN modificar (no
  // se le resta densidad por los electrones que ademas participan en un enlace, ver
  // bondOrbitalClouds mas abajo), como una capa deliberadamente independiente.
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

  // LCAO por enlace: para cada enlace, combina las amplitudes (con signo) de los dos atomos
  // que lo forman, sobre una direccion real (el vector de enlace experimental, no un eje
  // canonico). Si un atomo tiene 2+ enlaces, su tipo de hibridacion (sp/sp2/sp3) se infiere del
  // angulo REAL entre sus enlaces (ver classifyHybridization); si tiene solo 1 enlace, usa su
  // orbital p puro (o el 1s puro para Hidrogeno, que no tiene subcapa p de valencia). Ver
  // utils/molecularOrbitals.ts y docs/approximations.md ("Molecular Orbitals (LCAO)").
  const bondOrbitalClouds = useMemo(() => {
    const bondDirectionsByAtom = new Map<number, Array<[number, number, number]>>();
    const addDirection = (atomIndex: number, direction: [number, number, number]) => {
      const list = bondDirectionsByAtom.get(atomIndex) ?? [];
      list.push(direction);
      bondDirectionsByAtom.set(atomIndex, list);
    };
    for (const bond of molecule.bonds) {
      const posA = molecule.atoms[bond.a].offset;
      const posB = molecule.atoms[bond.b].offset;
      const delta = new Vector3(posB[0] - posA[0], posB[1] - posA[1], posB[2] - posA[2]).normalize();
      addDirection(bond.a, [delta.x, delta.y, delta.z]);
      addDirection(bond.b, [-delta.x, -delta.y, -delta.z]);
    }

    const basisByAtom = molecule.atoms.map((atomSpec) => valenceOrbitalBasis(atomSpec.z));
    const sCharacterByAtom = molecule.atoms.map((atomSpec, index) => {
      const directions = bondDirectionsByAtom.get(index) ?? [];
      if (directions.length >= 2) return classifyHybridization(directions).sCharacter;
      // Un solo enlace: el Hidrogeno (sin subcapa p de valencia) usa su 1s puro; cualquier
      // otro atomo terminal usa su orbital p puro apuntando al vecino, sin hibridar.
      return basisByAtom[index].valenceN === 1 ? 1 : 0;
    });

    return molecule.bonds.map((bond) => {
      const posA = molecule.atoms[bond.a].offset;
      const posB = molecule.atoms[bond.b].offset;
      const delta = new Vector3(posB[0] - posA[0], posB[1] - posA[1], posB[2] - posA[2]);
      const bondLength = delta.length();
      const dirAB: [number, number, number] = bondLength > 1e-6 ? [delta.x / bondLength, delta.y / bondLength, delta.z / bondLength] : [1, 0, 0];
      const dirBA: [number, number, number] = [-dirAB[0], -dirAB[1], -dirAB[2]];
      const basisA = basisByAtom[bond.a];
      const basisB = basisByAtom[bond.b];
      const sCharA = sCharacterByAtom[bond.a];
      const sCharB = sCharacterByAtom[bond.b];

      const psi = (x: number, y: number, z: number) => {
        const ampA = hybridAmplitude(basisA, sCharA, dirAB, x - posA[0], y - posA[1], z - posA[2]);
        const ampB = hybridAmplitude(basisB, sCharB, dirBA, x - posB[0], y - posB[1], z - posB[2]);
        return ampA + ampB;
      };

      const center: [number, number, number] = [(posA[0] + posB[0]) / 2, (posA[1] + posB[1]) / 2, (posA[2] + posB[2]) / 2];
      const halfExtent = bondLength / 2 + Math.max(basisA.hydrogenicExtent, basisB.hydrogenicExtent) * 1.5;

      return { key: `${bond.a}-${bond.b}`, psi, center, halfExtent };
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
        {bondOrbitalClouds.map((cloud) => (
          <BondOrbitalCloud key={cloud.key} psi={cloud.psi} center={cloud.center} halfExtent={cloud.halfExtent} paused={paused} />
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
        <strong>
          Cada atomo es el mismo modelo hidrogenoide de la vista Atomos, trasladado a su posicion
          de enlace real. La nube blanca entre nucleos es un orbital molecular de enlace (LCAO),
          con hibridacion sp/sp2/sp3 inferida del angulo real de enlace en atomos con 2+ enlaces.
        </strong>
        <span><span className="legend-swatch" style={{ background: BOND_ORBITAL_COLOR }} /> orbital de enlace (LCAO)</span>
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
