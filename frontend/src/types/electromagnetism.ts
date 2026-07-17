// Set propio, no una reutilizacion de GravityBody: una carga tiene signo (atrae/repele segun
// signo relativo, al reves de la masa gravitacional que siempre atrae) y su aceleracion
// depende de su propia carga Y masa (relacion carga/masa, real e importante en
// electromagnetismo), no solo de la masa del otro cuerpo como en gravedad.

export interface ChargedBody {
  id: string;
  charge: number;
  mass: number;
  radius: number;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
}

export interface EMParams {
  coulombConstant: number;
  softening: number;
  // Campo magnetico externo UNIFORME, solo a lo largo del eje Z (no generado por el movimiento
  // de las propias cargas -- sin Biot-Savart, sin radiacion). Ver docs/approximations.md.
  bFieldZ: number;
  magnetismEnabled: boolean;
}

export interface EMPreset {
  id: string;
  label: string;
  description: string;
  build: (params: EMParams) => ChargedBody[];
}
