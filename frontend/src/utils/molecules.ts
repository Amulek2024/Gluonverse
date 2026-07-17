// Datos estaticos de geometria molecular: longitudes y angulos de enlace son valores
// experimentales de tablas de quimica estandar (no un calculo de estructura electronica
// molecular ni una simulacion de fuerzas de enlace). 1 unidad de escena = 1 Angstrom, la
// misma convencion usada en la vista Atomos (ver utils/elements.ts).
export interface MoleculeAtomSpec {
  z: number;
  offset: [number, number, number];
}

export interface MoleculeBond {
  a: number;
  b: number;
  order: 1 | 2 | 3;
}

export interface MoleculeData {
  id: string;
  formula: string;
  name: string;
  atoms: MoleculeAtomSpec[];
  bonds: MoleculeBond[];
}

export const MOLECULES: MoleculeData[] = [
  {
    id: "h2",
    formula: "H2",
    name: "Hidrogeno molecular",
    atoms: [
      { z: 1, offset: [-0.37, 0, 0] },
      { z: 1, offset: [0.37, 0, 0] }
    ],
    bonds: [{ a: 0, b: 1, order: 1 }]
  },
  {
    id: "n2",
    formula: "N2",
    name: "Nitrogeno molecular",
    atoms: [
      { z: 7, offset: [-0.55, 0, 0] },
      { z: 7, offset: [0.55, 0, 0] }
    ],
    bonds: [{ a: 0, b: 1, order: 3 }]
  },
  {
    id: "o2",
    formula: "O2",
    name: "Oxigeno molecular",
    atoms: [
      { z: 8, offset: [-0.605, 0, 0] },
      { z: 8, offset: [0.605, 0, 0] }
    ],
    bonds: [{ a: 0, b: 1, order: 2 }]
  },
  {
    id: "hcl",
    formula: "HCl",
    name: "Cloruro de hidrogeno",
    atoms: [
      { z: 1, offset: [-0.635, 0, 0] },
      { z: 17, offset: [0.635, 0, 0] }
    ],
    bonds: [{ a: 0, b: 1, order: 1 }]
  },
  {
    id: "co",
    formula: "CO",
    name: "Monoxido de carbono",
    atoms: [
      { z: 6, offset: [-0.565, 0, 0] },
      { z: 8, offset: [0.565, 0, 0] }
    ],
    bonds: [{ a: 0, b: 1, order: 3 }]
  },
  {
    id: "h2o",
    formula: "H2O",
    name: "Agua",
    atoms: [
      { z: 8, offset: [0, 0, 0] },
      { z: 1, offset: [0.587, 0.759, 0] },
      { z: 1, offset: [0.587, -0.759, 0] }
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 }
    ]
  },
  {
    id: "co2",
    formula: "CO2",
    name: "Dioxido de carbono",
    atoms: [
      { z: 6, offset: [0, 0, 0] },
      { z: 8, offset: [-1.16, 0, 0] },
      { z: 8, offset: [1.16, 0, 0] }
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 0, b: 2, order: 2 }
    ]
  },
  {
    id: "nh3",
    formula: "NH3",
    name: "Amoniaco",
    atoms: [
      { z: 7, offset: [0, 0, 0] },
      { z: 1, offset: [0.937, 0, -0.378] },
      { z: 1, offset: [-0.469, 0.812, -0.378] },
      { z: 1, offset: [-0.469, -0.812, -0.378] }
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 }
    ]
  },
  {
    id: "ch4",
    formula: "CH4",
    name: "Metano",
    atoms: [
      { z: 6, offset: [0, 0, 0] },
      { z: 1, offset: [0.629, 0.629, 0.629] },
      { z: 1, offset: [0.629, -0.629, -0.629] },
      { z: 1, offset: [-0.629, 0.629, -0.629] },
      { z: 1, offset: [-0.629, -0.629, 0.629] }
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }
    ]
  },
  {
    id: "so2",
    formula: "SO2",
    name: "Dioxido de azufre",
    atoms: [
      { z: 16, offset: [0, 0, 0] },
      { z: 8, offset: [0.726, 1.232, 0] },
      { z: 8, offset: [0.726, -1.232, 0] }
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 0, b: 2, order: 2 }
    ]
  }
];

export function moleculeById(id: string): MoleculeData {
  return MOLECULES.find((molecule) => molecule.id === id) ?? MOLECULES[0];
}
