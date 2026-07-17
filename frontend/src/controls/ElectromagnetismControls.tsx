import { Pause, Play, RotateCcw } from "lucide-react";
import { HelpPanel } from "../components/HelpPanel";
import { useElectromagnetismStore } from "../stores/useElectromagnetismStore";
import { EM_PRESETS } from "../simulations/electromagnetismPresets";

const HELP_ENTRIES = [
  {
    term: "Presets",
    description:
      "Atomo clasico: un 'electron' orbitando un 'nucleo' solo por Coulomb (modelo de Rutherford/Bohr, real pero declarado inestable -- ver 'Por que el atomo clasico es 'incorrecto''). Cargas iguales: repulsion pura entre cargas del mismo signo. Ciclotron: una carga girando en un campo magnetico uniforme, sin ninguna otra carga de por medio."
  },
  {
    term: "Ley de Coulomb",
    description: "F = k*q1*q2/r^2, la fuerza real entre dos cargas. k es una constante de visualizacion adimensional, no el valor SI real (8.99x10^9 N*m^2/C^2)."
  },
  {
    term: "Fuerza de Lorentz y campo magnetico",
    description:
      "Si el campo magnetico esta activo, cada carga en movimiento tambien siente F = q*(v x B), con B UNIFORME a lo largo del eje Z (no generado por las cargas -- sin ecuaciones de Biot-Savart, sin radiacion electromagnetica). Se integra con el metodo de Boris (el estandar en fisica de plasmas para esta fuerza dependiente de la velocidad), no con Velocity Verlet."
  },
  {
    term: "Por que el 'atomo clasico' es incorrecto",
    description:
      "Una carga en orbita esta constantemente acelerando, y la electrodinamica clasica (Maxwell) dice que una carga acelerada irradia energia electromagnetica -- un electron orbitando clasicamente caeria en espiral al nucleo en una fraccion de segundo. Este simulador no modela radiacion, asi que la orbita se mantiene estable indefinidamente: es exactamente el problema historico que la mecanica cuantica tuvo que resolver (ver la vista Atomos, con el modelo real de nube de probabilidad)."
  },
  {
    term: "Lineas de campo electrico",
    description: "Muestran solo la DIRECCION del campo E neto en una grilla de puntos (longitud fija, no proporcional a la magnitud, para no saturar la escena cerca de una carga). La opacidad si sube con la magnitud relativa."
  },
  {
    term: "Agregar carga",
    description: "Clic derecho (sin arrastrar) sobre la escena agrega una carga del signo seleccionado en ese punto, con velocidad inicial cero."
  }
];

export function ElectromagnetismControls({ embedded = false }: { embedded?: boolean } = {}) {
  const bodies = useElectromagnetismStore((state) => state.bodies);
  const params = useElectromagnetismStore((state) => state.params);
  const presetId = useElectromagnetismStore((state) => state.presetId);
  const paused = useElectromagnetismStore((state) => state.paused);
  const speed = useElectromagnetismStore((state) => state.speed);
  const addChargeSign = useElectromagnetismStore((state) => state.addChargeSign);
  const setParams = useElectromagnetismStore((state) => state.setParams);
  const setSpeed = useElectromagnetismStore((state) => state.setSpeed);
  const togglePaused = useElectromagnetismStore((state) => state.togglePaused);
  const loadPreset = useElectromagnetismStore((state) => state.loadPreset);
  const setAddChargeSign = useElectromagnetismStore((state) => state.setAddChargeSign);
  const reset = useElectromagnetismStore((state) => state.reset);

  return (
    <section className="panel controls" aria-labelledby="em-controls-heading">
      <div className="panel-heading">
        <h2 id="em-controls-heading">Electromagnetismo</h2>
        <span>{bodies.length} cargas</span>
      </div>

      <div className="control-grid">
        <label>
          Preset
          <select value={presetId} onChange={(event) => loadPreset(event.target.value)}>
            {EM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id} title={preset.description}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          k (constante de Coulomb)
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={params.coulombConstant}
            onChange={(event) => setParams({ coulombConstant: Number(event.target.value) })}
          />
        </label>
        <label>
          Softening
          <input
            type="number"
            min="0.05"
            max="1"
            step="0.01"
            value={params.softening}
            onChange={(event) => setParams({ softening: Number(event.target.value) })}
          />
        </label>
        <label>
          Campo B (eje Z)
          <input
            type="number"
            min="-5"
            max="5"
            step="0.05"
            disabled={!params.magnetismEnabled}
            value={params.bFieldZ}
            onChange={(event) => setParams({ bFieldZ: Number(event.target.value) })}
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
          Agregar carga (clic derecho)
          <select value={addChargeSign} onChange={(event) => setAddChargeSign(Number(event.target.value) as 1 | -1)}>
            <option value={1}>Positiva</option>
            <option value={-1}>Negativa</option>
          </select>
        </label>
      </div>

      <label className="small-copy" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <input
          type="checkbox"
          checked={params.magnetismEnabled}
          onChange={(event) => setParams({ magnetismEnabled: event.target.checked })}
        />
        Campo magnetico activo (fuerza de Lorentz)
      </label>

      <div className="toolbar">
        <button type="button" onClick={togglePaused}>
          {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? "Reanudar" : "Pausar"}
        </button>
        <button type="button" onClick={reset}>
          <RotateCcw size={16} /> Reiniciar preset
        </button>
        <span className="small-copy">Cargas: {bodies.length}</span>
      </div>

      <p className="small-copy">
        Ley de Coulomb real entre cargas, integrada con el metodo de Boris (fuerza de Lorentz
        dependiente de la velocidad, campo magnetico uniforme opcional a lo largo de Z). k,
        softening y B son constantes de visualizacion, no valores SI. Sin radiacion
        electromagnetica: una carga acelerada no pierde energia aqui, a diferencia de la
        electrodinamica real.
      </p>

      {!embedded && <HelpPanel title="Guia de electromagnetismo" entries={HELP_ENTRIES} />}
    </section>
  );
}
