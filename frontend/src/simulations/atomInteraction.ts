import type { SandboxAtom, SandboxParams } from "../types/sandbox";
import { elementByZ } from "../utils/elements";
import { vanDerWaalsRadius } from "../utils/vanDerWaals";
import { canFormBond, covalentRadius } from "../utils/covalentRadii";

// Modulo hermano de gravity.ts/cornell.py: mismo patron de integrador (Velocity Verlet) y misma
// forma de potencial (Lennard-Jones) para TODO par de atomos, pero con dos regimenes de sigma
// (ver pairSigma): si ninguno de los dos es un gas noble, la distancia de equilibrio se
// parametriza con radios covalentes reales (Cordero 2008), como un sustituto declarado del
// pozo de energia real de un enlace (que en realidad tiene una forma distinta, tipo Morse, y
// una profundidad que varia por par de atomos, no calculada aqui). Si alguno es un gas noble
// (que no forma enlaces en este modelo, ver utils/covalentRadii.ts), se usa la distancia de
// van der Waals real -- interaccion generica no enlazante, sin transferencia de carga. En
// ningun caso se resuelve un orbital molecular, energia de enlace real, ni orden de enlace.
// Tope de magnitud de fuerza: salvaguarda puramente numerica (igual de declarada que
// energy_limit en cornell.py o el softening en gravity.ts), no parte del potencial de
// Lennard-Jones. Sin ella, si dos atomos llegan a cruzar muy cerca de la distancia minima
// regularizada, el termino repulsivo r^-12 puede disparar una aceleracion tan grande que un
// solo paso de dt discreto la integre mal e inyecte energia de forma no fisica (o directamente
// dispare un atomo fuera de la escena).
const MAX_FORCE_MAGNITUDE = 40;

// Razon estandar entre el parametro sigma de Lennard-Jones (donde el potencial cruza cero) y
// la distancia de equilibrio real (el minimo del pozo), 2^(1/6): una constante matematica del
// potencial LJ, no un ajuste inventado. Los radios tabulados (van der Waals o covalentes) se
// definen de forma que su SUMA ya es la distancia de contacto/enlace real esperada -- para que
// el equilibrio de este potencial (1.122*sigma) reproduzca esa suma en vez de una fraccion de
// ella, sigma debe ser la suma dividida por esta razon, no la suma promediada a secas.
const SIGMA_TO_EQUILIBRIUM_RATIO = Math.pow(2, 1 / 6);

export function pairSigma(zA: number, zB: number): number {
  const elA = elementByZ(zA);
  const elB = elementByZ(zB);
  const radiusSum = canFormBond(elA.group) && canFormBond(elB.group)
    ? covalentRadius(elA.z, elA.period) + covalentRadius(elB.z, elB.period)
    : vanDerWaalsRadius(elA.z, elA.period) + vanDerWaalsRadius(elB.z, elB.period);
  return radiusSum / SIGMA_TO_EQUILIBRIUM_RATIO;
}

function ljForceMagnitude(r: number, sigma: number, epsilon: number): number {
  const sr6 = Math.pow(sigma / r, 6);
  const sr12 = sr6 * sr6;
  // Positivo = repulsivo (empuja los atomos a separarse), negativo = atractivo.
  const raw = ((24 * epsilon) / r) * (2 * sr12 - sr6);
  return Math.max(-MAX_FORCE_MAGNITUDE, Math.min(MAX_FORCE_MAGNITUDE, raw));
}

function computeAccelerations(
  atoms: SandboxAtom[],
  params: SandboxParams
): Array<[number, number, number]> {
  const n = atoms.length;
  const accelerations: Array<[number, number, number]> = atoms.map(() => [0, 0, 0]);
  // Masa de visualizacion proporcional al peso atomico real (no SI): solo para que un atomo
  // pesado acelere menos que uno liviano ante la misma fuerza, igual de "ilustrativa, no SI"
  // que G en gravity.ts o coulomb_strength en cornell.py.
  const masses = atoms.map((atom) => Math.max(1, elementByZ(atom.z).standardAtomicWeight / 12));

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = atoms[j].position[0] - atoms[i].position[0];
      const dy = atoms[j].position[1] - atoms[i].position[1];
      const dz = atoms[j].position[2] - atoms[i].position[2];
      const sigma = pairSigma(atoms[i].z, atoms[j].z);

      // Distancia minima regularizada: sin esta cota, el termino repulsivo (potencia 12)
      // diverge numericamente en un solo paso de dt discreto si dos atomos llegan a
      // superponerse casi por completo (mismo motivo que el softening en gravity.ts).
      const rawDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dist = Math.max(rawDist, sigma * 0.55);
      const forceMag = ljForceMagnitude(dist, sigma, params.attractionStrength);
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      accelerations[i][0] -= (forceMag * nx) / masses[i];
      accelerations[i][1] -= (forceMag * ny) / masses[i];
      accelerations[i][2] -= (forceMag * nz) / masses[i];
      accelerations[j][0] += (forceMag * nx) / masses[j];
      accelerations[j][1] += (forceMag * ny) / masses[j];
      accelerations[j][2] += (forceMag * nz) / masses[j];
    }
  }

  return accelerations;
}

export function stepAtomInteraction(
  atoms: SandboxAtom[],
  params: SandboxParams,
  dt: number
): SandboxAtom[] {
  if (atoms.length < 2) return atoms;

  const currentAccel = computeAccelerations(atoms, params);
  const predicted = atoms.map((atom, i) => {
    const [ax, ay, az] = currentAccel[i];
    const position: [number, number, number] = [
      atom.position[0] + atom.velocity[0] * dt + 0.5 * ax * dt * dt,
      atom.position[1] + atom.velocity[1] * dt + 0.5 * ay * dt * dt,
      atom.position[2] + atom.velocity[2] * dt + 0.5 * az * dt * dt
    ];
    return { ...atom, position };
  });

  const nextAccel = computeAccelerations(predicted, params);
  // El amortiguamiento no es una fuerza fisica real: es una ayuda numerica/visual para que el
  // sistema se asiente cerca del pozo de energia en vez de oscilar indefinidamente (un LJ real
  // sin disipacion oscilaria para siempre), igual de declarado que el softening en gravity.ts.
  const dampingFactor = Math.max(0, 1 - params.damping);
  return predicted.map((atom, i) => {
    const velocity: [number, number, number] = [
      (atom.velocity[0] + 0.5 * (currentAccel[i][0] + nextAccel[i][0]) * dt) * dampingFactor,
      (atom.velocity[1] + 0.5 * (currentAccel[i][1] + nextAccel[i][1]) * dt) * dampingFactor,
      (atom.velocity[2] + 0.5 * (currentAccel[i][2] + nextAccel[i][2]) * dt) * dampingFactor
    ];
    return { ...atom, velocity };
  });
}
