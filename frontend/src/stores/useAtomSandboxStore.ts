import { create } from "zustand";
import type { SandboxAtom, SandboxParams } from "../types/sandbox";
import { pairSigma, stepAtomInteraction } from "../simulations/atomInteraction";

// Tienda separada de useSimulationStore/useGravityStore por el mismo motivo documentado en
// useGravityStore.ts: agregar/quitar atomos cambia el LARGO del arreglo de estado, y este
// sandbox necesita su propio par pausado/velocidad que no debe chocar con el de gravedad ni con
// dt/playbackSpeed del laboratorio de quarks. Solo se reutiliza el store compartido para lo
// verdaderamente transversal (activeView/controlsSlot).

const FIXED_DT = 0.01;

// Cada atomo agregado dibuja un nucleo completo + nube electronica con muestreo periodico
// (mismo costo por atomo que la vista Atomos): mas caro por unidad que los puntos de Gravedad,
// de ahi un tope mucho menor.
export const MAX_SANDBOX_ATOMS = 16;

export const DEFAULT_SANDBOX_PARAMS: SandboxParams = {
  attractionStrength: 2.5,
  damping: 0.03
};

let addedAtomSeq = 0;

function randomDirection(): [number, number, number] {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
}

// Coloca cada atomo nuevo cerca de uno existente (elegido al azar), a ~1.4x el sigma de ese par
// (misma pairSigma que usa la fisica, ver simulations/atomInteraction.ts): apenas mas alla del
// pozo de energia del potencial de Lennard-Jones (que esta en 1.122*sigma), donde la atraccion
// ya es significativa. Colocarlos muy lejos (varios sigma de distancia) haria la atraccion
// imperceptiblemente lenta -- la fuerza decae muy rapido con la distancia, igual que en la
// realidad.
function placeAtom(z: number, existing: SandboxAtom[]): [number, number, number] {
  if (existing.length === 0) return [0, 0, 0];
  const anchor = existing[Math.floor(Math.random() * existing.length)];
  const distance = pairSigma(z, anchor.z) * 1.4;
  const [dx, dy, dz] = randomDirection();
  return [anchor.position[0] + dx * distance, anchor.position[1] + dy * distance, anchor.position[2] + dz * distance];
}

interface AtomSandboxStoreState {
  atoms: SandboxAtom[];
  params: SandboxParams;
  paused: boolean;
  speed: number;
  cameraResetToken: number;
  selectedAtomId?: string;
  setParams: (patch: Partial<SandboxParams>) => void;
  setSpeed: (speed: number) => void;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  addAtom: (z: number) => void;
  removeAtom: (id: string) => void;
  selectAtom: (id: string | undefined) => void;
  clearAll: () => void;
  resetCamera: () => void;
  stepLocal: () => void;
}

export const useAtomSandboxStore = create<AtomSandboxStoreState>((set, get) => ({
  atoms: [],
  params: DEFAULT_SANDBOX_PARAMS,
  paused: false,
  speed: 1,
  cameraResetToken: 0,
  selectedAtomId: undefined,

  setParams: (patch) => set((state) => ({ params: { ...state.params, ...patch } })),
  setSpeed: (speed) => set({ speed: Math.max(0.1, Math.min(4, speed)) }),
  togglePaused: () => set((state) => ({ paused: !state.paused })),
  setPaused: (paused) => set({ paused }),

  addAtom: (z) => {
    const state = get();
    if (state.atoms.length >= MAX_SANDBOX_ATOMS) return;
    addedAtomSeq += 1;
    const atom: SandboxAtom = {
      id: `sandbox-atom-${addedAtomSeq}`,
      z,
      position: placeAtom(z, state.atoms),
      velocity: [0, 0, 0]
    };
    set((current) => ({ atoms: [...current.atoms, atom] }));
  },

  removeAtom: (id) =>
    set((state) => ({
      atoms: state.atoms.filter((atom) => atom.id !== id),
      selectedAtomId: state.selectedAtomId === id ? undefined : state.selectedAtomId
    })),

  selectAtom: (id) => set({ selectedAtomId: id }),

  clearAll: () =>
    set((state) => ({ atoms: [], selectedAtomId: undefined, cameraResetToken: state.cameraResetToken + 1 })),

  resetCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),

  stepLocal: () => {
    const { atoms, params, paused, speed } = get();
    if (paused || atoms.length < 2) return;
    const subSteps = Math.max(1, Math.round(speed));
    let current = atoms;
    for (let i = 0; i < subSteps; i += 1) {
      current = stepAtomInteraction(current, params, FIXED_DT);
    }
    set({ atoms: current });
  }
}));
