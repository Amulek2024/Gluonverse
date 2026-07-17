// Radios de van der Waals (Angstrom), tabla estandar de Bondi (1964) con extensiones de
// Mantina et al. (2009) para algunos elementos pesados -- valores reales medidos/tabulados, no
// inventados. Se usan como el parametro sigma del potencial Lennard-Jones del sandbox de
// interacciones (utils/atomInteraction.ts): la distancia de "contacto" a la que la repulsion de
// corto alcance empieza a dominar. Ver docs/approximations.md.
const VDW_RADIUS_ANGSTROM: Record<number, number> = {
  1: 1.2, 2: 1.4, 3: 1.82, 4: 1.53, 5: 1.92, 6: 1.7, 7: 1.55, 8: 1.52, 9: 1.47, 10: 1.54,
  11: 2.27, 12: 1.73, 13: 1.84, 14: 2.1, 15: 1.8, 16: 1.8, 17: 1.75, 18: 1.88,
  19: 2.75, 20: 2.31, 28: 1.63, 29: 1.4, 30: 1.39, 31: 1.87, 32: 2.11, 33: 1.85, 34: 1.9, 35: 1.85, 36: 2.02,
  37: 3.03, 38: 2.49, 46: 1.63, 47: 1.72, 48: 1.58, 49: 1.93, 50: 2.17, 51: 2.06, 52: 2.06, 53: 1.98, 54: 2.16,
  55: 3.43, 56: 2.68, 78: 1.75, 79: 1.66, 80: 1.55, 81: 1.96, 82: 2.02, 83: 2.07, 84: 1.97, 85: 2.02, 86: 2.2,
  87: 3.48, 88: 2.83, 92: 1.86
};

// Estimado generico por periodo (no un valor medido) para elementos sin radio de van der Waals
// tabulado (la mayoria de metales de transicion y todos los lantanidos/actinidos/superpesados):
// crece con el periodo siguiendo la tendencia real de la tabla periodica, declarado
// explicitamente como extrapolacion.
const DEFAULT_RADIUS_BY_PERIOD: Record<number, number> = {
  1: 1.5, 2: 1.6, 3: 1.9, 4: 2.0, 5: 2.1, 6: 2.2, 7: 2.3, 8: 2.2, 9: 2.3
};

export function vanDerWaalsRadius(z: number, period: number): number {
  return VDW_RADIUS_ANGSTROM[z] ?? DEFAULT_RADIUS_BY_PERIOD[period] ?? 2.0;
}
