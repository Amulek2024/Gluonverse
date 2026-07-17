import type { SandboxAtom } from "../types/sandbox";
import { elementByZ } from "../utils/elements";
import { canFormBond, covalentRadius } from "../utils/covalentRadii";

// Heuristica de PERCEPCION de enlaces por distancia: la misma tecnica estandar que usan
// herramientas de quimica computacional (OpenBabel, RDKit, ASE) para inferir enlaces a partir
// de solo coordenadas atomicas, sin conocer de antemano una lista de enlaces. Un par se marca
// como enlazado si su distancia real es menor a la suma de sus radios covalentes (Cordero 2008)
// multiplicada por un factor de tolerancia estandar.
//
// Limitaciones declaradas: (1) solo mira geometria, no verifica valencia disponible ni lleva
// una contabilidad de saturacion de enlaces -- un atomo puede aparecer enlazado con mas vecinos
// de los que su valencia real permitiria; (2) no distingue enlace covalente de ionico, usa la
// misma heuristica para ambos; (3) NO determina orden de enlace (simple/doble/triple), cada
// enlace detectado se dibuja igual; (4) los gases nobles (ver utils/covalentRadii.ts) nunca se
// marcan como enlazados, por definicion de este modelo.
const BOND_DETECTION_TOLERANCE = 1.3;

export interface DetectedBond {
  aIndex: number;
  bIndex: number;
  distance: number;
}

export function detectBonds(atoms: SandboxAtom[]): DetectedBond[] {
  const bonds: DetectedBond[] = [];
  for (let i = 0; i < atoms.length; i += 1) {
    const elA = elementByZ(atoms[i].z);
    if (!canFormBond(elA.group)) continue;
    for (let j = i + 1; j < atoms.length; j += 1) {
      const elB = elementByZ(atoms[j].z);
      if (!canFormBond(elB.group)) continue;

      const dx = atoms[j].position[0] - atoms[i].position[0];
      const dy = atoms[j].position[1] - atoms[i].position[1];
      const dz = atoms[j].position[2] - atoms[i].position[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const threshold = (covalentRadius(elA.z, elA.period) + covalentRadius(elB.z, elB.period)) * BOND_DETECTION_TOLERANCE;
      if (distance <= threshold) {
        bonds.push({ aIndex: i, bIndex: j, distance });
      }
    }
  }
  return bonds;
}
