import type { BodyKind, GravityBody, GravityParams, GravityPreset } from "../types/gravity";

const BODY_COLOR: Record<BodyKind, string> = {
  core: "#ffb74d",
  star: "#fff4cc",
  planet: "#4dd0e1",
  debris: "#9aa4b2"
};

// Masa/radio por defecto al agregar un cuerpo con clic en la escena (no ligado a ningun
// preset especifico, solo valores razonables por tipo).
export const DEFAULT_BODY_STATS: Record<BodyKind, { mass: number; radius: number }> = {
  core: { mass: 500, radius: 0.45 },
  star: { mass: 5, radius: 0.12 },
  planet: { mass: 2, radius: 0.08 },
  debris: { mass: 0.5, radius: 0.04 }
};

const PLANET_COLORS = ["#4dd0e1", "#8bc34a", "#ffd166", "#b967ff", "#ff8a65", "#7dffc0"];

let bodySeq = 0;
function nextId(prefix: string): string {
  bodySeq += 1;
  return `${prefix}-${bodySeq}`;
}

function makeBody(overrides: Partial<GravityBody> & Pick<GravityBody, "kind" | "mass" | "radius" | "position" | "velocity">): GravityBody {
  return {
    id: overrides.id ?? nextId(overrides.kind),
    color: overrides.color ?? BODY_COLOR[overrides.kind],
    ...overrides
  };
}

// Pequeno desplazamiento fuera del plano principal, solo para dar sensacion de profundidad 3D
// (mismo espiritu que withDepth() en useSimulationStore.ts) -- no representa una inclinacion
// orbital calculada.
function depthJitter(spread: number): number {
  return (Math.random() - 0.5) * 2 * spread;
}

function rotateAroundY(vector: [number, number, number], angleRad: number): [number, number, number] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const [x, y, z] = vector;
  return [x * cos - z * sin, y, x * sin + z * cos];
}

// Genera un disco de cuerpos livianos en orbita circular alrededor de un cuerpo central,
// opcionalmente inclinado (rotado) respecto al plano XY global, y con la velocidad total del
// nucleo sumada vectorialmente (los cuerpos orbitan en el marco de referencia del nucleo,
// mientras ese marco se desplaza en conjunto).
function buildOrbitingDisk(options: {
  kind: BodyKind;
  count: number;
  corePosition: [number, number, number];
  coreVelocity: [number, number, number];
  coreMass: number;
  radiusRange: [number, number];
  bodyMass: number;
  bodyRadius: number;
  tiltRadians: number;
  G: number;
  colorPalette?: string[];
}): GravityBody[] {
  const { kind, count, corePosition, coreVelocity, coreMass, radiusRange, bodyMass, bodyRadius, tiltRadians, G, colorPalette } = options;
  const [rMin, rMax] = radiusRange;
  const bodies: GravityBody[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const theta = goldenAngle * i;
    const r = rMin + ((rMax - rMin) * i) / Math.max(1, count - 1);
    const localOffset: [number, number, number] = [Math.cos(theta) * r, Math.sin(theta) * r, 0];
    const localVelocityDir: [number, number, number] = [-Math.sin(theta), Math.cos(theta), 0];
    const speed = Math.sqrt((G * coreMass) / r);

    const offset = rotateAroundY(localOffset, tiltRadians);
    const velocityDir = rotateAroundY(localVelocityDir, tiltRadians);

    const position: [number, number, number] = [
      corePosition[0] + offset[0],
      corePosition[1] + offset[1],
      corePosition[2] + offset[2]
    ];
    const velocity: [number, number, number] = [
      coreVelocity[0] + velocityDir[0] * speed,
      coreVelocity[1] + velocityDir[1] * speed,
      coreVelocity[2] + velocityDir[2] * speed
    ];
    const color = colorPalette ? colorPalette[i % colorPalette.length] : undefined;

    bodies.push(makeBody({ kind, mass: bodyMass, radius: bodyRadius, position, velocity, color }));
  }
  return bodies;
}

const CORE_MASS = 200;
const CORE_RADIUS = 0.5;

// Nota sobre estabilidad: con Velocity Verlet y un dt fijo (FIXED_DT en useGravityStore.ts),
// el cuerpo en orbita mas cercana al nucleo necesita suficientes pasos de integracion por
// periodo orbital (idealmente >=100) o la orbita se desestabiliza (inyeccion de energia
// numerica, caida en espiral, fusiones espurias). Masa y radio minimo de cada preset se
// eligieron para dejar ese margen a G=1/softening=0.15 por defecto.
function buildSolarSystemToy(params: GravityParams): GravityBody[] {
  bodySeq = 0;
  const core = makeBody({ kind: "core", mass: CORE_MASS, radius: CORE_RADIUS, position: [0, 0, 0], velocity: [0, 0, 0] });
  const planets = buildOrbitingDisk({
    kind: "planet",
    count: 5,
    corePosition: [0, 0, 0],
    coreVelocity: [0, 0, 0],
    coreMass: CORE_MASS,
    radiusRange: [1.8, 6.5],
    bodyMass: 1.5,
    bodyRadius: 0.08,
    tiltRadians: 0,
    G: params.G,
    colorPalette: PLANET_COLORS
  });
  // Pequeno jitter en z para que no queden perfectamente coplanares.
  const jittered = planets.map((planet) => ({
    ...planet,
    position: [planet.position[0], planet.position[1], planet.position[2] + depthJitter(0.3)] as [number, number, number]
  }));
  return [core, ...jittered];
}

const BINARY_STAR_MASS = 300;
const BINARY_STAR_RADIUS = 0.35;
const BINARY_SEPARATION_HALF = 2.2;

function buildBinaryStars(params: GravityParams): GravityBody[] {
  bodySeq = 0;
  const d = BINARY_SEPARATION_HALF;
  // Orbita circular de dos masas iguales alrededor del centro de masa comun (en el origen):
  // omega^2 = G*(m1+m2)/D^3 con D=2d: para masas iguales, v_cada_una = sqrt(G*m_cada_una/(4d)).
  const speed = Math.sqrt((params.G * BINARY_STAR_MASS) / (4 * d));
  // kind "core" (no "star"): son solo 2 cuerpos, se dibujan como esferas distinguibles en vez
  // de sumarse a la nube de puntos pensada para cuerpos livianos y numerosos.
  const starA = makeBody({
    kind: "core",
    mass: BINARY_STAR_MASS,
    radius: BINARY_STAR_RADIUS,
    position: [-d, 0, 0],
    velocity: [0, speed, 0]
  });
  const starB = makeBody({
    kind: "core",
    mass: BINARY_STAR_MASS,
    radius: BINARY_STAR_RADIUS,
    position: [d, 0, 0],
    velocity: [0, -speed, 0]
  });
  return [starA, starB];
}

const GALAXY_CORE_MASS = 80;
const GALAXY_CORE_SEPARATION = 20;
const GALAXY_APPROACH_SPEED = 0.15;
// Componente perpendicular a la aproximacion (parametro de impacto): sin esto, la atraccion
// mutua nucleo-nucleo (nada despreciable a esta masa/separacion) los hace caer en linea recta
// uno hacia el otro casi de inmediato. Con un parametro de impacto, en cambio, se cruzan de
// forma mas parecida a un encuentro real de galaxias (tipo Toomre) en vez de un choque frontal.
const GALAXY_IMPACT_SPEED = 0.35;
const GALAXY_STARS_PER_CORE = 35;

function buildGalaxyCollision(params: GravityParams): GravityBody[] {
  bodySeq = 0;
  const coreAPosition: [number, number, number] = [-GALAXY_CORE_SEPARATION / 2, 0, 0];
  const coreBPosition: [number, number, number] = [GALAXY_CORE_SEPARATION / 2, 0, 0];
  const coreAVelocity: [number, number, number] = [GALAXY_APPROACH_SPEED, GALAXY_IMPACT_SPEED, 0];
  const coreBVelocity: [number, number, number] = [-GALAXY_APPROACH_SPEED, -GALAXY_IMPACT_SPEED, 0];

  const coreA = makeBody({ kind: "core", mass: GALAXY_CORE_MASS, radius: CORE_RADIUS, position: coreAPosition, velocity: coreAVelocity });
  const coreB = makeBody({ kind: "core", mass: GALAXY_CORE_MASS, radius: CORE_RADIUS, position: coreBPosition, velocity: coreBVelocity });

  const diskA = buildOrbitingDisk({
    kind: "star",
    count: GALAXY_STARS_PER_CORE,
    corePosition: coreAPosition,
    coreVelocity: coreAVelocity,
    coreMass: GALAXY_CORE_MASS,
    radiusRange: [1.8, 3.5],
    bodyMass: 0.06,
    // Radio deliberadamente chico: con muestreo de radio lineal (35 estrellas entre 1.8 y 3.5,
    // paso ~0.05), un radio de contacto (2*bodyRadius*mergeThresholdFactor) mayor que ese paso
    // hace que estrellas en "capas" orbitales vecinas terminen fusionandose solo por alinearse
    // en angulo tarde o temprano (periodos orbitales ligeramente distintos garantizan esa
    // alineacion eventualmente) -- un artefacto geometrico, no una fusion real por choque.
    bodyRadius: 0.012,
    tiltRadians: 0,
    G: params.G
  });
  // El disco B se inclina respecto al plano XY para que las dos galaxias no luzcan como discos
  // perfectamente paralelos -- solo una eleccion visual, no una prediccion de orientacion real.
  const diskB = buildOrbitingDisk({
    kind: "star",
    count: GALAXY_STARS_PER_CORE,
    corePosition: coreBPosition,
    coreVelocity: coreBVelocity,
    coreMass: GALAXY_CORE_MASS,
    radiusRange: [1.8, 3.5],
    bodyMass: 0.06,
    // Radio deliberadamente chico: con muestreo de radio lineal (35 estrellas entre 1.8 y 3.5,
    // paso ~0.05), un radio de contacto (2*bodyRadius*mergeThresholdFactor) mayor que ese paso
    // hace que estrellas en "capas" orbitales vecinas terminen fusionandose solo por alinearse
    // en angulo tarde o temprano (periodos orbitales ligeramente distintos garantizan esa
    // alineacion eventualmente) -- un artefacto geometrico, no una fusion real por choque.
    bodyRadius: 0.012,
    tiltRadians: Math.PI / 3,
    G: params.G
  });

  return [coreA, coreB, ...diskA, ...diskB];
}

export const GRAVITY_PRESETS: GravityPreset[] = [
  {
    id: "solar_system_toy",
    label: "Sistema solar (juguete)",
    description: "Un nucleo masivo con varios planetas en orbita circular. Estable, casi nunca hay fusiones -- buen punto de partida.",
    build: buildSolarSystemToy
  },
  {
    id: "binary_stars",
    label: "Estrellas binarias",
    description: "Dos estrellas de masa comparable orbitando su centro de masa comun. El caso mas simple para revisar el integrador.",
    build: buildBinaryStars
  },
  {
    id: "galaxy_collision",
    label: "Choque de galaxias",
    description: "Dos nucleos galacticos con disco de estrellas cada uno, acercandose entre si. Full N-body: cada estrella siente la gravedad de ambos nucleos y de las demas estrellas.",
    build: buildGalaxyCollision
  }
];

export const DEFAULT_GRAVITY_PRESET_ID = "solar_system_toy";
