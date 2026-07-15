import { Pause, Play, RotateCcw } from "lucide-react";
import { HelpPanel } from "../components/HelpPanel";
import { useGravityStore } from "../stores/useGravityStore";
import { GRAVITY_PRESETS } from "../simulations/gravityPresets";
import type { BodyKind } from "../types/gravity";

const HELP_ENTRIES = [
  {
    term: "Presets",
    description:
      "Sistema solar (juguete): 1 nucleo + planetas en orbita circular, estable. Estrellas binarias: 2 cuerpos comparables orbitando su centro de masa comun. Choque de galaxias: 2 nucleos con disco de estrellas cada uno, acercandose entre si."
  },
  {
    term: "G (constante gravitacional)",
    description:
      "Constante de visualizacion adimensional, no el valor SI real (6.674e-11): a la escala de esta escena, G real haria cualquier interaccion imperceptiblemente lenta/debil."
  },
  {
    term: "Softening",
    description:
      "Suavizado de Plummer: evita que la fuerza se vuelva infinita cuando dos cuerpos se acercan mucho. Valores mas altos hacen la simulacion mas estable pero menos precisa a corta distancia."
  },
  {
    term: "Fusion (acrecion)",
    description:
      "Cuando dos cuerpos se acercan mas que la suma de sus radios (multiplicada por el umbral), se fusionan en uno: conserva masa y momento lineal, no energia (se pierde en la colision, como en una acrecion real)."
  },
  {
    term: "Agregar cuerpo",
    description: "Clic derecho (sin arrastrar) sobre la escena agrega un cuerpo del tipo seleccionado en ese punto, con velocidad inicial cero."
  },
  {
    term: "Tope de cuerpos",
    description: `El calculo de fuerzas es O(n^2) por paso (cada par de cuerpos, cada frame) -- se limita a ${150} cuerpos para mantener la simulacion fluida.`
  }
];

const BODY_KIND_OPTIONS: Array<{ value: BodyKind; label: string }> = [
  { value: "core", label: "Nucleo/estrella grande" },
  { value: "star", label: "Estrella" },
  { value: "planet", label: "Planeta" },
  { value: "debris", label: "Escombro" }
];

export function GravityControls({ embedded = false }: { embedded?: boolean } = {}) {
  const bodies = useGravityStore((state) => state.bodies);
  const params = useGravityStore((state) => state.params);
  const presetId = useGravityStore((state) => state.presetId);
  const paused = useGravityStore((state) => state.paused);
  const speed = useGravityStore((state) => state.speed);
  const addBodyKind = useGravityStore((state) => state.addBodyKind);
  const setParams = useGravityStore((state) => state.setParams);
  const setSpeed = useGravityStore((state) => state.setSpeed);
  const togglePaused = useGravityStore((state) => state.togglePaused);
  const loadPreset = useGravityStore((state) => state.loadPreset);
  const setAddBodyKind = useGravityStore((state) => state.setAddBodyKind);
  const reset = useGravityStore((state) => state.reset);

  return (
    <section className="panel controls" aria-labelledby="gravity-controls-heading">
      <div className="panel-heading">
        <h2 id="gravity-controls-heading">Gravedad</h2>
        <span>N-body completo</span>
      </div>

      <div className="control-grid">
        <label>
          Preset
          <select value={presetId} onChange={(event) => loadPreset(event.target.value)}>
            {GRAVITY_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} title={preset.description}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          G
          <input
            type="number"
            min="0.05"
            max="4"
            step="0.05"
            value={params.G}
            onChange={(event) => setParams({ G: Number(event.target.value) })}
          />
        </label>
        <label>
          Softening
          <input
            type="number"
            min="0.01"
            max="2"
            step="0.01"
            value={params.softening}
            onChange={(event) => setParams({ softening: Number(event.target.value) })}
          />
        </label>
        <label>
          Umbral de fusion
          <input
            type="number"
            min="0.2"
            max="3"
            step="0.1"
            disabled={!params.mergeEnabled}
            value={params.mergeThresholdFactor}
            onChange={(event) => setParams({ mergeThresholdFactor: Number(event.target.value) })}
          />
        </label>
        <label>
          Velocidad
          <input
            type="number"
            min="0.1"
            max="4"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
        <label>
          Agregar cuerpo (clic derecho)
          <select value={addBodyKind} onChange={(event) => setAddBodyKind(event.target.value as BodyKind)}>
            {BODY_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="small-copy" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <input
          type="checkbox"
          checked={params.mergeEnabled}
          onChange={(event) => setParams({ mergeEnabled: event.target.checked })}
        />
        Fusion inelastica al contacto (acrecion)
      </label>

      <div className="toolbar">
        <button type="button" onClick={togglePaused}>
          {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? "Reanudar" : "Pausar"}
        </button>
        <button type="button" onClick={reset}>
          <RotateCcw size={16} /> Reiniciar preset
        </button>
        <span className="small-copy">Cuerpos: {bodies.length}</span>
      </div>

      <p className="small-copy">
        Gravedad newtoniana con suavizado de Plummer, integrada con Velocity Verlet (mismo
        integrador que el laboratorio de quarks). Fusion inelastica conserva masa y momento
        lineal, no energia. G y softening son constantes de visualizacion, no valores SI.
      </p>

      {!embedded && <HelpPanel title="Guia del sandbox de gravedad" entries={HELP_ENTRIES} />}
    </section>
  );
}
