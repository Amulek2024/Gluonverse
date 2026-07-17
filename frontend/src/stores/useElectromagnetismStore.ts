import { create } from "zustand";
import type { ChargedBody, EMParams } from "../types/electromagnetism";
import { stepElectromagnetism } from "../simulations/electromagnetism";
import { cyclotronBField, DEFAULT_EM_PRESET_ID, EM_PRESETS } from "../simulations/electromagnetismPresets";

// Tienda separada de useSimulationStore/useGravityStore por el mismo motivo documentado en
// useGravityStore.ts: agregar/quitar cargas cambia el LARGO del arreglo de estado, y este
// dominio necesita su propio trio pausado/velocidad/preset. Solo se reutiliza el store
// compartido para lo verdaderamente transversal (activeView/controlsSlot).

const FIXED_DT = 0.01;

export const DEFAULT_EM_PARAMS: EMParams = {
  coulombConstant: 1,
  softening: 0.3,
  bFieldZ: 0,
  magnetismEnabled: false
};

function findPreset(id: string) {
  return EM_PRESETS.find((preset) => preset.id === id) ?? EM_PRESETS[0];
}

let addedChargeSeq = 0;

interface ElectromagnetismStoreState {
  bodies: ChargedBody[];
  initialBodies: ChargedBody[];
  params: EMParams;
  presetId: string;
  paused: boolean;
  speed: number;
  cameraResetToken: number;
  selectedBodyId?: string;
  addChargeSign: 1 | -1;
  setAddChargeSign: (sign: 1 | -1) => void;
  setParams: (patch: Partial<EMParams>) => void;
  setSpeed: (speed: number) => void;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  loadPreset: (id: string) => void;
  addBody: (partial: Partial<ChargedBody> & Pick<ChargedBody, "position">) => void;
  removeBody: (id: string) => void;
  selectBody: (id: string | undefined) => void;
  resetCamera: () => void;
  reset: () => void;
  stepLocal: () => void;
}

const initialEMBodies = findPreset(DEFAULT_EM_PRESET_ID).build(DEFAULT_EM_PARAMS);

export const useElectromagnetismStore = create<ElectromagnetismStoreState>((set, get) => ({
  bodies: initialEMBodies,
  initialBodies: initialEMBodies,
  params: DEFAULT_EM_PARAMS,
  presetId: DEFAULT_EM_PRESET_ID,
  paused: false,
  speed: 1,
  cameraResetToken: 0,
  selectedBodyId: undefined,
  addChargeSign: 1,
  setAddChargeSign: (sign) => set({ addChargeSign: sign }),

  setParams: (patch) => set((state) => ({ params: { ...state.params, ...patch } })),
  setSpeed: (speed) => set({ speed: Math.max(0.1, Math.min(4, speed)) }),
  togglePaused: () => set((state) => ({ paused: !state.paused })),
  setPaused: (paused) => set({ paused }),

  loadPreset: (id) => {
    const preset = findPreset(id);
    set((state) => {
      // El preset de ciclotron solo tiene sentido con el campo magnetico encendido y a la
      // intensidad que hace coincidir el radio de giro visible; los demas presets no tocan el
      // campo magnetico (el usuario puede combinarlo libremente, p.ej. agregar un campo B al
      // atomo clasico para ver como se distorsiona la orbita).
      const params =
        preset.id === "cyclotron" ? { ...state.params, bFieldZ: cyclotronBField(), magnetismEnabled: true } : state.params;
      const bodies = preset.build(params);
      return {
        presetId: preset.id,
        params,
        bodies,
        initialBodies: bodies,
        selectedBodyId: undefined,
        cameraResetToken: state.cameraResetToken + 1
      };
    });
  },

  addBody: (partial) => {
    addedChargeSeq += 1;
    const sign = get().addChargeSign;
    const body: ChargedBody = {
      id: `added-${addedChargeSeq}`,
      charge: partial.charge ?? sign,
      mass: partial.mass ?? 1,
      radius: partial.radius ?? 0.1,
      velocity: partial.velocity ?? [0, 0, 0],
      color: partial.color ?? (sign >= 0 ? "#ff6b6b" : "#4dd0e1"),
      position: partial.position
    };
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
      current = stepElectromagnetism(current, params, FIXED_DT);
    }
    set({ bodies: current });
  }
}));
