import type { ChargedBody, EMParams, EMPreset } from "../types/electromagnetism";

let bodySeq = 0;
function nextId(prefix: string): string {
  bodySeq += 1;
  return `${prefix}-${bodySeq}`;
}

function makeBody(overrides: Partial<ChargedBody> & Pick<ChargedBody, "charge" | "mass" | "radius" | "position" | "velocity">): ChargedBody {
  const color = overrides.color ?? (overrides.charge >= 0 ? "#ff6b6b" : "#4dd0e1");
  return { id: overrides.id ?? nextId(overrides.charge >= 0 ? "pos" : "neg"), color, ...overrides };
}

const NUCLEUS_CHARGE = 50;
const NUCLEUS_MASS = 300;
const ELECTRON_ORBIT_RADIUS = 2.2;

// Modelo clasico (pre-cuantico) de un "electron" orbitando un "nucleo" solo por atraccion de
// Coulomb, analogo circular al preset binary_stars/solar_system_toy de Gravedad (v = sqrt(k*
// |q1*q2|/(m*r)) para que la fuerza centripeta cuadre con la atraccion electrostatica). Es
// deliberadamente el modelo de Rutherford/Bohr clasico que la fisica del siglo XX demostro
// INESTABLE: una carga acelerada (como lo esta constantemente una orbita circular) irradia
// energia electromagnetica segun la teoria clasica de Maxwell y caeria en espiral hacia el
// nucleo en una fraccion de segundo -- por eso hizo falta la mecanica cuantica (ver la vista
// Atomos, que usa el modelo real de nube de probabilidad, no una orbita). Esta simulacion NO
// modela radiacion, asi que la orbita se mantiene estable indefinidamente, algo que se declara
// explicitamente como fisicamente incorrecto para una carga real.
function buildClassicalAtom(params: EMParams): ChargedBody[] {
  bodySeq = 0;
  const electronCharge = -1;
  const electronMass = 1;
  const speed = Math.sqrt((params.coulombConstant * Math.abs(NUCLEUS_CHARGE * electronCharge)) / (electronMass * ELECTRON_ORBIT_RADIUS));
  const nucleus = makeBody({ charge: NUCLEUS_CHARGE, mass: NUCLEUS_MASS, radius: 0.4, position: [0, 0, 0], velocity: [0, 0, 0], color: "#ff6b6b" });
  const electron = makeBody({
    charge: electronCharge,
    mass: electronMass,
    radius: 0.1,
    position: [ELECTRON_ORBIT_RADIUS, 0, 0],
    velocity: [0, speed, 0],
    color: "#4dd0e1"
  });
  return [nucleus, electron];
}

const REPULSION_CHARGE = 1.5;
const REPULSION_RING_RADIUS = 1;

// N cargas del mismo signo muy juntas, en reposo: se repelen y salen disparadas hacia afuera.
// Demostracion directa de repulsion electrostatica, sin nada mas en juego.
function buildLikeChargesExplosion(): ChargedBody[] {
  bodySeq = 0;
  const count = 5;
  const bodies: ChargedBody[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count;
    const position: [number, number, number] = [Math.cos(angle) * REPULSION_RING_RADIUS, Math.sin(angle) * REPULSION_RING_RADIUS, 0];
    bodies.push(makeBody({ charge: REPULSION_CHARGE, mass: 1, radius: 0.12, position, velocity: [0, 0, 0], color: "#ff6b6b" }));
  }
  return bodies;
}

const CYCLOTRON_RADIUS = 2;
const CYCLOTRON_SPEED = 2;
const CYCLOTRON_CHARGE = 1;
const CYCLOTRON_MASS = 1;

// Una sola carga con velocidad en el plano XY, dentro de un campo magnetico uniforme a lo largo
// de Z: la fuerza de Lorentz (perpendicular a v y a B) la obliga a girar en circulo perfecto
// (movimiento de ciclotron), sin necesitar ninguna otra carga ni fuerza electrica. El radio de
// giro real es r = m*v/(|q|*B); B se elige aqui para que ese radio coincida con
// CYCLOTRON_RADIUS a la velocidad y carga elegidas. El signo de la velocidad inicial (-Y, no
// +Y) importa: con carga y B positivos, F=q(v x B) en +Y apunta hacia AFUERA del origen en la
// posicion inicial (+X,0,0) -- una orbita real, pero centrada en otro punto, no en el origen.
// -Y hace que la fuerza inicial apunte hacia el origen, para una orbita centrada ahi (mas facil
// de leer visualmente y de encuadrar con la camara).
function buildCyclotron(): ChargedBody[] {
  bodySeq = 0;
  const charge = makeBody({
    charge: CYCLOTRON_CHARGE,
    mass: CYCLOTRON_MASS,
    radius: 0.12,
    position: [CYCLOTRON_RADIUS, 0, 0],
    velocity: [0, -CYCLOTRON_SPEED, 0],
    color: "#ffd166"
  });
  return [charge];
}

export function cyclotronBField(): number {
  return (CYCLOTRON_MASS * CYCLOTRON_SPEED) / (Math.abs(CYCLOTRON_CHARGE) * CYCLOTRON_RADIUS);
}

export const EM_PRESETS: EMPreset[] = [
  {
    id: "classical_atom",
    label: "Atomo clasico (inestable)",
    description:
      "Un 'electron' orbitando un 'nucleo' solo por atraccion de Coulomb -- el modelo de Rutherford/Bohr clasico, que la fisica real demostro inestable (una carga en orbita irradia energia y caeria en espiral). Esta simulacion no modela radiacion, asi que aqui la orbita es estable.",
    build: buildClassicalAtom
  },
  {
    id: "like_charges_explosion",
    label: "Cargas iguales (repulsion)",
    description: "Varias cargas del mismo signo, muy juntas y en reposo: se repelen y salen disparadas. Demostracion directa de repulsion electrostatica.",
    build: buildLikeChargesExplosion
  },
  {
    id: "cyclotron",
    label: "Ciclotron (campo magnetico)",
    description: "Una carga en movimiento dentro de un campo magnetico uniforme: la fuerza de Lorentz la obliga a girar en circulo perfecto, sin ninguna otra carga de por medio.",
    build: buildCyclotron
  }
];

export const DEFAULT_EM_PRESET_ID = "classical_atom";
