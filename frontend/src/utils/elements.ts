// Datos y formulas del modelo atomico. Ver docs/approximations.md ("Atomic Model") para el
// desglose completo de que es fisica real (formulas hidrogenoides, reglas de Slater, Aufbau)
// y que es simplificacion pedagogica (isotopo elegido por redondeo, tamano visual del nucleo).

export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  standardAtomicWeight: number;
  period: number;
  group: number;
  block: "s" | "p" | "d" | "f";
}

// [z, symbol, name, standardAtomicWeight, period, group, block]
type RawElement = [number, string, string, number, number, number, "s" | "p" | "d" | "f"];

const RAW_ELEMENTS: RawElement[] = [
  [1, "H", "Hidrogeno", 1.008, 1, 1, "s"],
  [2, "He", "Helio", 4.0026, 1, 18, "s"],
  [3, "Li", "Litio", 6.94, 2, 1, "s"],
  [4, "Be", "Berilio", 9.0122, 2, 2, "s"],
  [5, "B", "Boro", 10.81, 2, 13, "p"],
  [6, "C", "Carbono", 12.011, 2, 14, "p"],
  [7, "N", "Nitrogeno", 14.007, 2, 15, "p"],
  [8, "O", "Oxigeno", 15.999, 2, 16, "p"],
  [9, "F", "Fluor", 18.998, 2, 17, "p"],
  [10, "Ne", "Neon", 20.18, 2, 18, "p"],
  [11, "Na", "Sodio", 22.99, 3, 1, "s"],
  [12, "Mg", "Magnesio", 24.305, 3, 2, "s"],
  [13, "Al", "Aluminio", 26.982, 3, 13, "p"],
  [14, "Si", "Silicio", 28.085, 3, 14, "p"],
  [15, "P", "Fosforo", 30.974, 3, 15, "p"],
  [16, "S", "Azufre", 32.06, 3, 16, "p"],
  [17, "Cl", "Cloro", 35.45, 3, 17, "p"],
  [18, "Ar", "Argon", 39.95, 3, 18, "p"],
  [19, "K", "Potasio", 39.098, 4, 1, "s"],
  [20, "Ca", "Calcio", 40.078, 4, 2, "s"],
  [21, "Sc", "Escandio", 44.956, 4, 3, "d"],
  [22, "Ti", "Titanio", 47.867, 4, 4, "d"],
  [23, "V", "Vanadio", 50.942, 4, 5, "d"],
  [24, "Cr", "Cromo", 51.996, 4, 6, "d"],
  [25, "Mn", "Manganeso", 54.938, 4, 7, "d"],
  [26, "Fe", "Hierro", 55.845, 4, 8, "d"],
  [27, "Co", "Cobalto", 58.933, 4, 9, "d"],
  [28, "Ni", "Niquel", 58.693, 4, 10, "d"],
  [29, "Cu", "Cobre", 63.546, 4, 11, "d"],
  [30, "Zn", "Zinc", 65.38, 4, 12, "d"],
  [31, "Ga", "Galio", 69.723, 4, 13, "p"],
  [32, "Ge", "Germanio", 72.63, 4, 14, "p"],
  [33, "As", "Arsenico", 74.922, 4, 15, "p"],
  [34, "Se", "Selenio", 78.971, 4, 16, "p"],
  [35, "Br", "Bromo", 79.904, 4, 17, "p"],
  [36, "Kr", "Kripton", 83.798, 4, 18, "p"],
  [37, "Rb", "Rubidio", 85.468, 5, 1, "s"],
  [38, "Sr", "Estroncio", 87.62, 5, 2, "s"],
  [39, "Y", "Itrio", 88.906, 5, 3, "d"],
  [40, "Zr", "Zirconio", 91.224, 5, 4, "d"],
  [41, "Nb", "Niobio", 92.906, 5, 5, "d"],
  [42, "Mo", "Molibdeno", 95.95, 5, 6, "d"],
  [43, "Tc", "Tecnecio", 98, 5, 7, "d"],
  [44, "Ru", "Rutenio", 101.07, 5, 8, "d"],
  [45, "Rh", "Rodio", 102.91, 5, 9, "d"],
  [46, "Pd", "Paladio", 106.42, 5, 10, "d"],
  [47, "Ag", "Plata", 107.87, 5, 11, "d"],
  [48, "Cd", "Cadmio", 112.41, 5, 12, "d"],
  [49, "In", "Indio", 114.82, 5, 13, "p"],
  [50, "Sn", "Estano", 118.71, 5, 14, "p"],
  [51, "Sb", "Antimonio", 121.76, 5, 15, "p"],
  [52, "Te", "Telurio", 127.6, 5, 16, "p"],
  [53, "I", "Yodo", 126.9, 5, 17, "p"],
  [54, "Xe", "Xenon", 131.29, 5, 18, "p"],
  [55, "Cs", "Cesio", 132.91, 6, 1, "s"],
  [56, "Ba", "Bario", 137.33, 6, 2, "s"],
  [57, "La", "Lantano", 138.91, 6, 3, "d"],
  [58, "Ce", "Cerio", 140.12, 8, 4, "f"],
  [59, "Pr", "Praseodimio", 140.91, 8, 5, "f"],
  [60, "Nd", "Neodimio", 144.24, 8, 6, "f"],
  [61, "Pm", "Prometio", 145, 8, 7, "f"],
  [62, "Sm", "Samario", 150.36, 8, 8, "f"],
  [63, "Eu", "Europio", 151.96, 8, 9, "f"],
  [64, "Gd", "Gadolinio", 157.25, 8, 10, "f"],
  [65, "Tb", "Terbio", 158.93, 8, 11, "f"],
  [66, "Dy", "Disprosio", 162.5, 8, 12, "f"],
  [67, "Ho", "Holmio", 164.93, 8, 13, "f"],
  [68, "Er", "Erbio", 167.26, 8, 14, "f"],
  [69, "Tm", "Tulio", 168.93, 8, 15, "f"],
  [70, "Yb", "Iterbio", 173.05, 8, 16, "f"],
  [71, "Lu", "Lutecio", 174.97, 8, 17, "f"],
  [72, "Hf", "Hafnio", 178.49, 6, 4, "d"],
  [73, "Ta", "Tantalio", 180.95, 6, 5, "d"],
  [74, "W", "Wolframio", 183.84, 6, 6, "d"],
  [75, "Re", "Renio", 186.21, 6, 7, "d"],
  [76, "Os", "Osmio", 190.23, 6, 8, "d"],
  [77, "Ir", "Iridio", 192.22, 6, 9, "d"],
  [78, "Pt", "Platino", 195.08, 6, 10, "d"],
  [79, "Au", "Oro", 196.97, 6, 11, "d"],
  [80, "Hg", "Mercurio", 200.59, 6, 12, "d"],
  [81, "Tl", "Talio", 204.38, 6, 13, "p"],
  [82, "Pb", "Plomo", 207.2, 6, 14, "p"],
  [83, "Bi", "Bismuto", 208.98, 6, 15, "p"],
  [84, "Po", "Polonio", 209, 6, 16, "p"],
  [85, "At", "Astato", 210, 6, 17, "p"],
  [86, "Rn", "Radon", 222, 6, 18, "p"],
  [87, "Fr", "Francio", 223, 7, 1, "s"],
  [88, "Ra", "Radio", 226, 7, 2, "s"],
  [89, "Ac", "Actinio", 227, 7, 3, "d"],
  [90, "Th", "Torio", 232.04, 9, 4, "f"],
  [91, "Pa", "Protactinio", 231.04, 9, 5, "f"],
  [92, "U", "Uranio", 238.03, 9, 6, "f"],
  [93, "Np", "Neptunio", 237, 9, 7, "f"],
  [94, "Pu", "Plutonio", 244, 9, 8, "f"],
  [95, "Am", "Americio", 243, 9, 9, "f"],
  [96, "Cm", "Curio", 247, 9, 10, "f"],
  [97, "Bk", "Berkelio", 247, 9, 11, "f"],
  [98, "Cf", "Californio", 251, 9, 12, "f"],
  [99, "Es", "Einstenio", 252, 9, 13, "f"],
  [100, "Fm", "Fermio", 257, 9, 14, "f"],
  [101, "Md", "Mendelevio", 258, 9, 15, "f"],
  [102, "No", "Nobelio", 259, 9, 16, "f"],
  [103, "Lr", "Lawrencio", 266, 9, 17, "f"],
  [104, "Rf", "Rutherfordio", 267, 7, 4, "d"],
  [105, "Db", "Dubnio", 268, 7, 5, "d"],
  [106, "Sg", "Seaborgio", 269, 7, 6, "d"],
  [107, "Bh", "Bohrio", 270, 7, 7, "d"],
  [108, "Hs", "Hassio", 269, 7, 8, "d"],
  [109, "Mt", "Meitnerio", 278, 7, 9, "d"],
  [110, "Ds", "Darmstatio", 281, 7, 10, "d"],
  [111, "Rg", "Roentgenio", 282, 7, 11, "d"],
  [112, "Cn", "Copernicio", 285, 7, 12, "d"],
  [113, "Nh", "Nihonio", 286, 7, 13, "p"],
  [114, "Fl", "Flerovio", 289, 7, 14, "p"],
  [115, "Mc", "Moscovio", 290, 7, 15, "p"],
  [116, "Lv", "Livermorio", 293, 7, 16, "p"],
  [117, "Ts", "Teneso", 294, 7, 17, "p"],
  [118, "Og", "Oganeson", 294, 7, 18, "p"]
];

export const ELEMENTS: ElementData[] = RAW_ELEMENTS.map(
  ([z, symbol, name, standardAtomicWeight, period, group, block]) => ({
    z,
    symbol,
    name,
    standardAtomicWeight,
    period,
    group,
    block
  })
);

export function elementByZ(z: number): ElementData {
  const element = ELEMENTS[z - 1];
  if (!element) throw new Error(`No hay datos para Z=${z}`);
  return element;
}

// Aproximacion declarada: se usa el isotopo "tipico" via redondeo del peso atomico estandar
// IUPAC, no el isotopo mas abundante real (evita necesitar una tabla de abundancias isotopicas).
export function neutronCount(element: ElementData): number {
  return Math.max(0, Math.round(element.standardAtomicWeight) - element.z);
}

export const BOHR_RADIUS_ANGSTROM = 0.529177;
export const SUBSHELL_LETTERS = ["s", "p", "d", "f"] as const;

interface SubshellFill {
  n: number;
  l: number;
  count: number;
}

// Orden de Madelung (regla n+l, luego n creciente) hasta 7p, que cubre exactamente Z=1..118.
const MADELUNG_ORDER: Array<[number, number]> = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [4, 0],
  [3, 2],
  [4, 1],
  [5, 0],
  [4, 2],
  [5, 1],
  [6, 0],
  [4, 3],
  [5, 2],
  [6, 1],
  [7, 0],
  [5, 3],
  [6, 2],
  [7, 1]
];

function sub(...triples: number[]): SubshellFill[] {
  const result: SubshellFill[] = [];
  for (let i = 0; i < triples.length; i += 3) {
    result.push({ n: triples[i], l: triples[i + 1], count: triples[i + 2] });
  }
  return result;
}

const ARGON_CORE = sub(1, 0, 2, 2, 0, 2, 2, 1, 6, 3, 0, 2, 3, 1, 6);
const KRYPTON_CORE = [...ARGON_CORE, ...sub(3, 2, 10, 4, 0, 2, 4, 1, 6)];
const XENON_CORE = [...KRYPTON_CORE, ...sub(4, 2, 10, 5, 0, 2, 5, 1, 6)];
const RADON_CORE = [...XENON_CORE, ...sub(4, 3, 14, 5, 2, 10, 6, 0, 2, 6, 1, 6)];

function subFromKr(...triples: number[]): SubshellFill[] {
  return [...KRYPTON_CORE, ...sub(...triples)];
}
function subFromXe(...triples: number[]): SubshellFill[] {
  return [...XENON_CORE, ...sub(...triples)];
}
function subFromRn(...triples: number[]): SubshellFill[] {
  return [...RADON_CORE, ...sub(...triples)];
}

// Configuraciones electronicas irregulares conocidas (efectos de estabilidad de capas
// semi-llenas/llenas que la regla de Aufbau simple no predice). Para Z >= 104 la
// configuracion real es incierta/teorica; aqui se sigue el patron algoritmico estandar.
const ELECTRON_CONFIG_EXCEPTIONS: Record<number, SubshellFill[]> = {
  24: sub(1, 0, 2, 2, 0, 2, 2, 1, 6, 3, 0, 2, 3, 1, 6, 3, 2, 5, 4, 0, 1), // Cr
  29: sub(1, 0, 2, 2, 0, 2, 2, 1, 6, 3, 0, 2, 3, 1, 6, 3, 2, 10, 4, 0, 1), // Cu
  41: subFromKr(4, 2, 4, 5, 0, 1), // Nb
  42: subFromKr(4, 2, 5, 5, 0, 1), // Mo
  44: subFromKr(4, 2, 7, 5, 0, 1), // Ru
  45: subFromKr(4, 2, 8, 5, 0, 1), // Rh
  46: subFromKr(4, 2, 10), // Pd
  47: subFromKr(4, 2, 10, 5, 0, 1), // Ag
  57: subFromXe(5, 2, 1, 6, 0, 2), // La
  58: subFromXe(4, 3, 1, 5, 2, 1, 6, 0, 2), // Ce
  64: subFromXe(4, 3, 7, 5, 2, 1, 6, 0, 2), // Gd
  78: subFromXe(4, 3, 14, 5, 2, 9, 6, 0, 1), // Pt
  79: subFromXe(4, 3, 14, 5, 2, 10, 6, 0, 1), // Au
  89: subFromRn(6, 2, 1, 7, 0, 2), // Ac
  90: subFromRn(6, 2, 2, 7, 0, 2), // Th
  91: subFromRn(5, 3, 2, 6, 2, 1, 7, 0, 2), // Pa
  92: subFromRn(5, 3, 3, 6, 2, 1, 7, 0, 2), // U
  93: subFromRn(5, 3, 4, 6, 2, 1, 7, 0, 2), // Np
  96: subFromRn(5, 3, 7, 6, 2, 1, 7, 0, 2), // Cm
  103: subFromRn(5, 3, 14, 7, 0, 2, 7, 1, 1) // Lr
};

export function computeElectronConfiguration(z: number): SubshellFill[] {
  const exception = ELECTRON_CONFIG_EXCEPTIONS[z];
  if (exception) return exception;

  let remaining = z;
  const config: SubshellFill[] = [];
  for (const [n, l] of MADELUNG_ORDER) {
    if (remaining <= 0) break;
    const capacity = 2 * (2 * l + 1);
    const count = Math.min(capacity, remaining);
    config.push({ n, l, count });
    remaining -= count;
  }
  return config;
}

export function formatElectronConfiguration(config: SubshellFill[]): string {
  const superscripts: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹"
  };
  const sup = (n: number) =>
    String(n)
      .split("")
      .map((d) => superscripts[d])
      .join("");
  return config.map((shell) => `${shell.n}${SUBSHELL_LETTERS[shell.l]}${sup(shell.count)}`).join(" ");
}

function slaterGroupKey(n: number, l: number): string {
  return l <= 1 ? `${n}sp` : `${n}:${l}`;
}

// Reglas de Slater (apantallamiento de la carga nuclear). Aproximacion estandar de quimica
// cuantica para atomos multi-electron, no una solucion exacta de Hartree-Fock.
export function slaterZEff(z: number, targetN: number, targetL: number, config: SubshellFill[]): number {
  const targetIsSP = targetL <= 1;
  const targetKey = slaterGroupKey(targetN, targetL);

  const groupTotals = new Map<string, number>();
  for (const shell of config) {
    const key = slaterGroupKey(shell.n, shell.l);
    groupTotals.set(key, (groupTotals.get(key) || 0) + shell.count);
  }

  const sameGroupTotal = groupTotals.get(targetKey) || 1;
  let sigma = (sameGroupTotal - 1) * (targetN === 1 ? 0.3 : 0.35);

  for (const [key, count] of groupTotals) {
    if (key === targetKey) continue;
    const shellN = Number(key.split(/sp|:/)[0]);
    if (targetIsSP) {
      if (shellN === targetN - 1) sigma += count * 0.85;
      else if (shellN < targetN - 1) sigma += count * 1.0;
    } else if (shellN <= targetN) {
      sigma += count * 1.0;
    }
  }

  return Math.max(z - sigma, 1);
}

export function hydrogenicRadius(n: number, zEff: number): number {
  return (n * n * BOHR_RADIUS_ANGSTROM) / zEff;
}

export interface ElectronSlot {
  n: number;
  l: number;
  m: number;
  subshellLabel: string;
}

// Reparte los electrones de cada subcapa entre los orbitales m disponibles siguiendo la
// regla de Hund (llenar cada orbital una vez antes de aparear). El indice m aqui solo
// selecciona cual de los (2l+1) orbitales reales de la subcapa ocupa el electron; no es el
// numero cuantico magnetico literal (los orbitales reales son combinaciones de +-m).
export function buildElectronSlots(config: SubshellFill[]): ElectronSlot[] {
  const slots: ElectronSlot[] = [];
  for (const shell of config) {
    const numOrbitals = 2 * shell.l + 1;
    const perOrbital = new Array(numOrbitals).fill(0);
    let remaining = shell.count;
    for (let pass = 0; pass < 2 && remaining > 0; pass += 1) {
      for (let m = 0; m < numOrbitals && remaining > 0; m += 1) {
        if (perOrbital[m] <= pass) {
          perOrbital[m] += 1;
          remaining -= 1;
        }
      }
    }
    for (let m = 0; m < numOrbitals; m += 1) {
      for (let e = 0; e < perOrbital[m]; e += 1) {
        slots.push({ n: shell.n, l: shell.l, m, subshellLabel: `${shell.n}${SUBSHELL_LETTERS[shell.l]}` });
      }
    }
  }
  return slots;
}

function assocLaguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  if (k === 1) return 1 + alpha - x;
  let prev2 = 1;
  let prev1 = 1 + alpha - x;
  let current = prev1;
  for (let i = 2; i <= k; i += 1) {
    current = ((2 * i - 1 + alpha - x) * prev1 - (i - 1 + alpha) * prev2) / i;
    prev2 = prev1;
    prev1 = current;
  }
  return current;
}

function radialShape(n: number, l: number, r: number, a: number): number {
  const rho = (2 * r) / (n * a);
  const laguerre = assocLaguerre(n - l - 1, 2 * l + 1, rho);
  return Math.pow(r, l) * Math.exp(-rho / 2) * laguerre;
}

// Formas reales (no normalizadas) de los armonicos esfericos para l=0..3 (s,p,d,f), en
// funcion de los cosenos directores (x,y,z)/r. Formulas cerradas estandar.
function angularShape(l: number, m: number, x: number, y: number, z: number, r: number): number {
  if (r < 1e-9) return l === 0 ? 1 : 0;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;
  if (l === 0) return 1;
  if (l === 1) {
    if (m === 0) return nz;
    if (m === 1) return nx;
    return ny;
  }
  if (l === 2) {
    if (m === 0) return 3 * nz * nz - 1;
    if (m === 1) return nx * nz;
    if (m === 2) return ny * nz;
    if (m === 3) return nx * nx - ny * ny;
    return nx * ny;
  }
  if (m === 0) return nz * (5 * nz * nz - 3);
  if (m === 1) return nx * (5 * nz * nz - 1);
  if (m === 2) return ny * (5 * nz * nz - 1);
  if (m === 3) return nx * ny * nz;
  if (m === 4) return nz * (nx * nx - ny * ny);
  if (m === 5) return nx * (nx * nx - 3 * ny * ny);
  return ny * (3 * nx * nx - ny * ny);
}

function orbitalDensity(n: number, l: number, m: number, x: number, y: number, z: number, a: number): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  const radial = radialShape(n, l, r, a);
  const angular = angularShape(l, m, x, y, z, r);
  const psi = radial * angular;
  return psi * psi;
}

function computeOrbitalMaxDensity(n: number, l: number, m: number, a: number, rMax: number): number {
  let maxDensity = 0;
  for (let i = 0; i < 200; i += 1) {
    const x = (Math.random() * 2 - 1) * rMax;
    const y = (Math.random() * 2 - 1) * rMax;
    const z = (Math.random() * 2 - 1) * rMax;
    const density = orbitalDensity(n, l, m, x, y, z, a);
    if (density > maxDensity) maxDensity = density;
  }
  return maxDensity || 1e-9;
}

function sampleOrbitalPointFast(
  n: number,
  l: number,
  m: number,
  a: number,
  rMax: number,
  maxDensity: number
): [number, number, number] {
  const threshold = maxDensity * 1.3;
  let best: [number, number, number] = [0, 0, 0];
  let bestDensity = -1;
  for (let i = 0; i < 200; i += 1) {
    const x = (Math.random() * 2 - 1) * rMax;
    const y = (Math.random() * 2 - 1) * rMax;
    const z = (Math.random() * 2 - 1) * rMax;
    const density = orbitalDensity(n, l, m, x, y, z, a);
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

// Muestrea un punto 3D desde |psi_nlm|^2 real (rechazo en una caja cubica). Es una forma
// real de la funcion de onda hidrogenoide (con Z_eff de Slater), usada solo para dar forma
// a la nube; no esta normalizada a probabilidad total 1 (no hace falta para muestrear formas
// relativas). 1 unidad de escena = 1 Angstrom.
export function sampleOrbitalPoint(n: number, l: number, m: number, zEff: number): [number, number, number] {
  const a = BOHR_RADIUS_ANGSTROM / zEff;
  const rMax = Math.max(hydrogenicRadius(n, zEff) * 6, a * 4);
  const maxDensity = computeOrbitalMaxDensity(n, l, m, a, rMax);
  return sampleOrbitalPointFast(n, l, m, a, rMax, maxDensity);
}

export interface OrbitalSampler {
  sample: () => [number, number, number];
}

// Crea un muestreador reutilizable para un orbital: precalcula la densidad maxima una sola vez
// (sampleOrbitalPoint la recalcula en cada llamada) para poder generar nubes de cientos de
// puntos por orbital sin costo cuadratico. Con suficientes puntos, la nube revela la forma real
// de |psi|^2 -- incluidos sus nodos radiales -- en vez de mostrar solo 1-2 puntos por electron.
export function createOrbitalSampler(n: number, l: number, m: number, zEff: number): OrbitalSampler {
  const a = BOHR_RADIUS_ANGSTROM / zEff;
  const rMax = Math.max(hydrogenicRadius(n, zEff) * 6, a * 4);
  const maxDensity = computeOrbitalMaxDensity(n, l, m, a, rMax);
  return {
    sample: () => sampleOrbitalPointFast(n, l, m, a, rMax, maxDensity)
  };
}
