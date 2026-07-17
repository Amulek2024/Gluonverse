// Construccion LCAO (Linear Combination of Atomic Orbitals) de orbitales moleculares de enlace
// sigma, con hibridacion sp/sp2/sp3 para atomos centrales con mas de un enlace. Formulas reales
// y estandar de quimica cuantica introductoria (no inventadas):
//   - Hibrido = c_s*s + c_p*p_direccional, con c_s=sqrt(caracter_s), c_p=sqrt(1-caracter_s).
//     El caracter %s estandar es 1/2 (sp), 1/3 (sp2) o 1/4 (sp3).
//   - Un orbital p "direccional" (que apunta a lo largo de un vector arbitrario, no solo los
//     ejes x/y/z) es la combinacion lineal real de px,py,pz proyectada sobre ese vector: la
//     misma matematica de siempre, solo generalizada a una direccion no-canonica.
//   - Orbital molecular sigma de enlace = psiA(r) + psiB(r) (interferencia constructiva entre
//     las amplitudes CON SIGNO de los dos atomos), la construccion LCAO real y estandar.
// Ver docs/approximations.md ("Molecular Orbitals (LCAO)") para el desglose completo de
// aproximaciones y limitaciones declaradas.
import {
  BOHR_RADIUS_ANGSTROM,
  computeElectronConfiguration,
  hydrogenicRadius,
  psiAmplitude,
  radialShape,
  slaterZEff
} from "./elements";

export type HybridizationLabel = "sp" | "sp2" | "sp3" | "p" | "s";

export interface AtomOrbitalBasis {
  valenceN: number;
  zEffS: number;
  zEffP: number;
  hydrogenicExtent: number;
}

// Capa de valencia = el mayor numero cuantico principal n presente en la configuracion
// electronica real del atomo (Aufbau). zEff de la subcapa s y p de esa capa, via las reglas de
// Slater (mismas que usa la vista Atomos), independientemente de si esa subcapa especifica esta
// poblada (p.ej. el Hidrogeno no tiene 1p, pero el caracter %s=1 en ese caso hace que su zEff-p
// nunca se use realmente, ver hybridAmplitude).
export function valenceOrbitalBasis(z: number): AtomOrbitalBasis {
  const config = computeElectronConfiguration(z);
  const valenceN = config.reduce((max, shell) => Math.max(max, shell.n), 1);
  const zEffS = slaterZEff(z, valenceN, 0, config);
  const zEffP = slaterZEff(z, valenceN, 1, config);
  const hydrogenicExtent = Math.max(hydrogenicRadius(valenceN, zEffS), hydrogenicRadius(valenceN, zEffP));
  return { valenceN, zEffS, zEffP, hydrogenicExtent };
}

// Clasifica el esquema de hibridacion de un atomo central a partir del angulo REAL entre sus
// direcciones de enlace (las mismas usadas para la geometria experimental de la molecula, ver
// utils/molecules.ts) -- en vez de una tabla fija por molecula, se infiere del mismo dato
// geometrico que en la quimica real motiva la clasificacion (angulos cercanos a 109.5 grados
// sugieren sp3, a 120 grados sp2, a 180 grados sp). Umbral simple de vecino-mas-cercano entre
// los 3 angulos canonicos; es una heuristica de clasificacion geometrica, no un calculo de
// primeros principios de la hibridacion real.
export function classifyHybridization(bondDirections: Array<[number, number, number]>): {
  label: HybridizationLabel;
  sCharacter: number;
} {
  if (bondDirections.length <= 1) return { label: "p", sCharacter: 0 };

  let angleSum = 0;
  let pairs = 0;
  for (let i = 0; i < bondDirections.length; i += 1) {
    for (let j = i + 1; j < bondDirections.length; j += 1) {
      const [ax, ay, az] = bondDirections[i];
      const [bx, by, bz] = bondDirections[j];
      const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
      angleSum += (Math.acos(dot) * 180) / Math.PI;
      pairs += 1;
    }
  }
  const avgAngle = angleSum / pairs;

  const candidates: Array<{ label: HybridizationLabel; angle: number; sCharacter: number }> = [
    { label: "sp", angle: 180, sCharacter: 1 / 2 },
    { label: "sp2", angle: 120, sCharacter: 1 / 3 },
    { label: "sp3", angle: 109.5, sCharacter: 1 / 4 }
  ];
  let best = candidates[0];
  let bestDiff = Math.abs(avgAngle - best.angle);
  for (const candidate of candidates.slice(1)) {
    const diff = Math.abs(avgAngle - candidate.angle);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return { label: best.label, sCharacter: best.sCharacter };
}

// Amplitud (CON SIGNO) de un orbital p apuntando a lo largo de una direccion arbitraria
// (normalizada), evaluado en un desplazamiento (x,y,z) relativo al nucleo del atomo. La parte
// angular es la proyeccion real de px/py/pz sobre esa direccion (direccion . vector_unitario),
// exactamente equivalente a las formas px/py/pz de siempre, solo no restringida a los ejes
// coordenados.
function directionalPAmplitude(
  n: number,
  direction: [number, number, number],
  x: number,
  y: number,
  z: number,
  a: number
): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-9) return 0;
  const radial = radialShape(n, 1, r, a);
  const projection = (direction[0] * x + direction[1] * y + direction[2] * z) / r;
  return radial * projection;
}

// Amplitud con signo de un orbital hibrido sp^n (o un p puro/s puro, casos limite con
// sCharacter=0 o 1) que apunta hacia `direction`, evaluada en un desplazamiento relativo al
// nucleo del atomo al que pertenece.
export function hybridAmplitude(
  basis: AtomOrbitalBasis,
  sCharacter: number,
  direction: [number, number, number],
  x: number,
  y: number,
  z: number
): number {
  const cs = Math.sqrt(sCharacter);
  const cp = Math.sqrt(Math.max(0, 1 - sCharacter));
  const aS = BOHR_RADIUS_ANGSTROM / basis.zEffS;
  const sPart = cs > 0 ? psiAmplitude(basis.valenceN, 0, 0, x, y, z, aS) : 0;
  const aP = BOHR_RADIUS_ANGSTROM / basis.zEffP;
  const pPart = cp > 0 ? directionalPAmplitude(basis.valenceN, direction, x, y, z, aP) : 0;
  return cs * sPart + cp * pPart;
}

export interface OrbitalSampler {
  sample: () => [number, number, number];
}

// Generalizacion de utils/elements.ts#createOrbitalSampler a una funcion de amplitud arbitraria
// (con signo) evaluada en coordenadas absolutas de la escena, en vez de un unico orbital
// hidrogenoide (n,l,m) centrado en el origen: necesario porque un orbital molecular de enlace
// es la SUMA de las amplitudes de dos atomos en posiciones distintas, no un unico orbital
// atomico. Mismo patron de muestreo por rechazo (caja cubica, densidad maxima precalculada).
export function createCustomOrbitalSampler(
  psi: (x: number, y: number, z: number) => number,
  center: [number, number, number],
  halfExtent: number
): OrbitalSampler {
  function randomPoint(): [number, number, number] {
    return [
      center[0] + (Math.random() * 2 - 1) * halfExtent,
      center[1] + (Math.random() * 2 - 1) * halfExtent,
      center[2] + (Math.random() * 2 - 1) * halfExtent
    ];
  }

  let maxDensity = 0;
  for (let i = 0; i < 300; i += 1) {
    const [x, y, z] = randomPoint();
    const amplitude = psi(x, y, z);
    const density = amplitude * amplitude;
    if (density > maxDensity) maxDensity = density;
  }
  maxDensity = maxDensity || 1e-9;
  const threshold = maxDensity * 1.3;

  return {
    sample: () => {
      let best: [number, number, number] = center;
      let bestDensity = -1;
      for (let i = 0; i < 300; i += 1) {
        const [x, y, z] = randomPoint();
        const amplitude = psi(x, y, z);
        const density = amplitude * amplitude;
        if (density > bestDensity) {
          bestDensity = density;
          best = [x, y, z];
        }
        if (density >= Math.random() * threshold) {
          return [x, y, z];
        }
      }
      return best;
    }
  };
}
