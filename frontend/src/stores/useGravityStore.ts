import { create } from "zustand";
import type { BodyKind, GravityBody, GravityParams } from "../types/gravity";
import { stepGravity } from "../simulations/gravity";
import { GRAVITY_PRESETS, DEFAULT_GRAVITY_PRESET_ID } from "../simulations/gravityPresets";

// Tienda separada de useSimulationStore a proposito: fusionar cuerpos cambia el LARGO del
// arreglo de estado (ningun otro dominio hace eso), y este modulo necesita su propio trio
// pausado/velocidad/preset que chocaria en nombre con playbackSpeed/dt del laboratorio de
// quarks. Solo se reutiliza el store compartido para lo verdaderamente transversal
// (activeView/controlsSlot), no para el estado fisico de gravedad.

// dt fijo de la simulacion (no el delta real entre frames): mismo motivo que en el laboratorio
// de quarks -- un dt ligado al framerate real haria la simulacion inestable/no reproducible
// en maquinas mas lentas o mas rapidas. "speed" controla cuantos sub-pasos de este dt se
// ejecutan por frame renderizado.
const FIXED_DT = 0.01;

export const DEFAULT_GRAVITY_PARAMS: GravityParams = {
  G: 1,
  // Suficientemente grande para suprimir encuentros cercanos estrella-estrella espurios
  // (que inyectan energia y aceleran fusiones antes de tiempo) sin afectar de forma notoria
  // las orbitas dominadas por los nucleos (mucho mas separados que este radio).
  softening: 0.35,
  mergeEnabled: true,
  mergeThresholdFactor: 1
};

function findPreset(id: string) {
  return GRAVITY_PRESETS.find((preset) => preset.id === id) ?? GRAVITY_PRESETS[0];
}

let addedBodySeq = 0;

interface GravityStoreState {
  bodies: GravityBody[];
  // Instantanea de los cuerpos justo al cargar el preset actual (no se toca en stepLocal).
  // El encuadre de camara (CameraFit) se calcula a partir de esta, no de `bodies` en vivo --
  // si dependiera de las posiciones en movimiento, pelearia con el zoom/pan manual del usuario
  // en cada frame.
  initialBodies: GravityBody[];
  params: GravityParams;
  presetId: string;
  paused: boolean;
  speed: number;
  cameraResetToken: number;
  selectedBodyId?: string;
  addBodyKind: BodyKind;
  setAddBodyKind: (kind: BodyKind) => void;
  setParams: (patch: Partial<GravityParams>) => void;
  setSpeed: (speed: number) => void;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  loadPreset: (id: string) => void;
  addBody: (partial: Partial<GravityBody> & Pick<GravityBody, "position">) => void;
  removeBody: (id: string) => void;
  selectBody: (id: string | undefined) => void;
  resetCamera: () => void;
  reset: () => void;
  stepLocal: () => void;
}

const initialGravityBodies = findPreset(DEFAULT_GRAVITY_PRESET_ID).build(DEFAULT_GRAVITY_PARAMS);

export const useGravityStore = create<GravityStoreState>((set, get) => ({
  bodies: initialGravityBodies,
  initialBodies: initialGravityBodies,
  params: DEFAULT_GRAVITY_PARAMS,
  presetId: DEFAULT_GRAVITY_PRESET_ID,
  paused: false,
  speed: 1,
  cameraResetToken: 0,
  selectedBodyId: undefined,
  addBodyKind: "debris",
  setAddBodyKind: (kind) => set({ addBodyKind: kind }),

  setParams: (patch) => set((state) => ({ params: { ...state.params, ...patch } })),

  setSpeed: (speed) => set({ speed: Math.max(0.1, Math.min(4, speed)) }),

  togglePaused: () => set((state) => ({ paused: !state.paused })),
  setPaused: (paused) => set({ paused }),

  loadPreset: (id) => {
    const preset = findPreset(id);
    set((state) => {
      const bodies = preset.build(state.params);
      return {
        presetId: preset.id,
        bodies,
        initialBodies: bodies,
        selectedBodyId: undefined,
        cameraResetToken: state.cameraResetToken + 1
      };
    });
  },

  addBody: (partial) => {
    addedBodySeq += 1;
    const body: GravityBody = {
      id: `added-${addedBodySeq}`,
      kind: partial.kind ?? "debris",
      mass: partial.mass ?? 1,
      radius: partial.radius ?? 0.06,
      velocity: partial.velocity ?? [0, 0, 0],
      color: partial.color,
      position: partial.position
    } as GravityBody;
    set((state) => ({ bodies: [...state.bodies, body] }));
  },

  removeBody: (id) =>
    set((state) => ({
      bodies: state.bodies.filter((body) => body.id !== id),
      selectedBodyId: state.selectedBodyId === id ? undefined : state.selectedBodyId
    })),

  selectBody: (id) => set({ selectedBodyId: id }),

  resetCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),

  reset: () => {
    const { presetId, params } = get();
    const preset = findPreset(presetId);
    const bodies = preset.build(params);
    set((state) => ({ bodies, initialBodies: bodies, selectedBodyId: undefined, cameraResetToken: state.cameraResetToken + 1 }));
  },

  stepLocal: () => {
    const { bodies, params, paused, speed } = get();
    if (paused || bodies.length === 0) return;
    const subSteps = Math.max(1, Math.round(speed));
    let current = bodies;
    for (let i = 0; i < subSteps; i += 1) {
      const result = stepGravity(current, params, FIXED_DT);
      current = result.bodies;
    }
    set((state) => ({
      bodies: current,
      selectedBodyId: state.selectedBodyId && current.some((b) => b.id === state.selectedBodyId) ? state.selectedBodyId : undefined
    }));
  }
}));
