// Radios covalentes (Angstrom), tabla estandar de Cordero et al. (2008, "Covalent radii
// revisited"), la referencia mas citada para este dato -- valores reales medidos/tabulados, no
// inventados. Se usan para (a) parametrizar la distancia de equilibrio del potencial de
// interaccion cuando dos atomos SI pueden formar enlace (ver simulations/atomInteraction.ts) y
// (b) el umbral de deteccion geometrica de enlaces (ver simulations/bondDetection.ts).
const COVALENT_RADIUS_ANGSTROM: Record<number, number> = {
  1: 0.31, 2: 0.28, 3: 1.28, 4: 0.96, 5: 0.84, 6: 0.76, 7: 0.71, 8: 0.66, 9: 0.57, 10: 0.58,
  11: 1.66, 12: 1.41, 13: 1.21, 14: 1.11, 15: 1.07, 16: 1.05, 17: 1.02, 18: 1.06,
  19: 2.03, 20: 1.76, 21: 1.7, 22: 1.6, 23: 1.53, 24: 1.39, 25: 1.39, 26: 1.32, 27: 1.26, 28: 1.24,
  29: 1.32, 30: 1.22, 31: 1.22, 32: 1.2, 33: 1.19, 34: 1.2, 35: 1.2, 36: 1.16,
  37: 2.2, 38: 1.95, 39: 1.9, 40: 1.75, 41: 1.64, 42: 1.54, 43: 1.47, 44: 1.46, 45: 1.42, 46: 1.39,
  47: 1.45, 48: 1.44, 49: 1.42, 50: 1.39, 51: 1.39, 52: 1.38, 53: 1.39, 54: 1.4,
  55: 2.44, 56: 2.15, 57: 2.07, 72: 1.75, 73: 1.7, 74: 1.62, 75: 1.51, 76: 1.44, 77: 1.41,
  78: 1.36, 79: 1.36, 80: 1.32, 81: 1.45, 82: 1.46, 83: 1.48, 84: 1.4, 85: 1.5, 86: 1.5,
  87: 2.6, 88: 2.21, 89: 2.15, 90: 2.06, 91: 2.0, 92: 1.96
};

// Estimado generico por periodo (no un valor medido) para elementos sin radio covalente
// tabulado (lantanidos, actinidos y superpesados): declarado explicitamente como
// extrapolacion, misma logica que el fallback de utils/vanDerWaals.ts.
const DEFAULT_COVALENT_RADIUS_BY_PERIOD: Record<number, number> = {
  1: 0.4, 2: 0.9, 3: 1.15, 4: 1.25, 5: 1.4, 6: 1.5, 7: 1.6, 8: 1.85, 9: 1.95
};

export function covalentRadius(z: number, period: number): number {
  return COVALENT_RADIUS_ANGSTROM[z] ?? DEFAULT_COVALENT_RADIUS_BY_PERIOD[period] ?? 1.5;
}

// Regla de compatibilidad de enlace deliberadamente simple: solo excluye a los gases nobles
// (grupo 18), el criterio clasico de "capa de valencia completa = no reactivo" que se enseña a
// nivel introductorio. Es una simplificacion declarada: gases nobles pesados (Xe, Kr, Rn) SI
// forman compuestos reales (p.ej. XeF2, KrF2) bajo condiciones especificas, que este sandbox no
// modela. Tampoco lleva una contabilidad de saturacion de valencia real: un atomo puede aparecer
// "enlazado" con mas vecinos de los que su valencia real permitiria.
export function canFormBond(group: number): boolean {
  return group !== 18;
}
