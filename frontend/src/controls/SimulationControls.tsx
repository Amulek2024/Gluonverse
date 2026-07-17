import {
  Gauge,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Square
} from "lucide-react";
import { currentConfig, useSimulationStore } from "../stores/useSimulationStore";
import {
  cancelSimulation,
  connectFrames,
  createSimulation,
  exportSimulation,
  pauseSimulation,
  resumeSimulation,
  runSimulation
} from "../api/client";
import { useRef, useState } from "react";
import { HelpPanel } from "../components/HelpPanel";

const HELP_ENTRIES = [
  {
    term: "Backend",
    description:
      "Ejecuta la simulación en el servidor Python. Crea una configuración nueva, conecta por WebSocket y calcula todos los pasos en el servidor. Más lento pero preciso."
  },
  {
    term: "Paso",
    description:
      "Avanza un único paso de integración local en el navegador (un intervalo dt), usando el integrador seleccionado (Velocity Verlet o Leapfrog)."
  },
  {
    term: "Pausa / Reanudar",
    description: "Detiene o continúa la simulación sin borrar el estado actual, para poder inspeccionar o ajustar parámetros."
  },
  {
    term: "Stop",
    description: "Cancela la simulación backend en progreso. En modo local (Paso) no tiene efecto."
  },
  {
    term: "Reset",
    description: "Vuelve al estado inicial: reinicia las partículas a sus posiciones originales y borra el historial de energía y pasos."
  },
  {
    term: "Paso temporal (dt)",
    description:
      "Tamaño del paso de tiempo de la simulación. Valores pequeños (0.001) son más precisos pero lentos; valores grandes (0.05) son rápidos pero pueden ser inexactos. Rango recomendado: 0.0001–0.05."
  },
  {
    term: "Velocidad visual (x1-x4)",
    description:
      "Controla solo la velocidad de la animación en pantalla (1x normal, 4x cuádruple). No afecta los cálculos físicos ni el resultado de la simulación."
  },
  {
    term: "Integrador numérico",
    description:
      "Velocity Verlet es el estándar, con mejor conservación de energía. Leapfrog es una alternativa útil para comparar y verificar resultados."
  },
  {
    term: "Coulomb a (a/r)",
    description:
      "Coeficiente 'a' del potencial V(r) = a/r + b*r. Representa la atracción de corto alcance, similar a Coulomb. Aumentar el valor hace la atracción más fuerte a distancias cortas. Rango típico: 0.1–1.0."
  },
  {
    term: "String tension b (b*r)",
    description:
      "Coeficiente 'b' del potencial V(r) = a/r + b*r. Representa el confinamiento a larga distancia, como una cuerda elástica que tira de las partículas. Rango típico: 0.5–2.0."
  },
  {
    term: "Softening ε (suavizado)",
    description:
      "Radio de suavizado para evitar que la fuerza sea infinita cuando r=0. Valores pequeños (0.01) dan resultados más agudos; valores grandes (0.1) suavizan más las fuerzas a corta distancia."
  },
  {
    term: "Profundidad 3D (z)",
    description:
      "Controla qué tan repartidas están las partículas en el eje Z al crear un preset o agregar un quark. En 0 todas quedan en un mismo plano (z=0); valores mayores las distribuyen en un volumen 3D real, sorteando z entre -valor y +valor."
  },
  {
    term: "Repulsión de corto alcance (no-QCD)",
    description:
      "El potencial de Cornell (a/r + b*r) es puramente atractivo a cualquier distancia, así que nada impide que dos partículas se superpongan. Esta casilla agrega un núcleo repulsivo de muy corto alcance solo para evitar ese traspaso visual. Es una adición fenomenológica, no forma parte de QCD ni del potencial de Cornell real."
  },
  {
    term: "Intensidad repulsión",
    description:
      "Qué tan fuerte es el núcleo repulsivo de corto alcance. Solo tiene efecto si 'Repulsión de corto alcance' está activada. Valores altos mantienen más distancia mínima entre partículas."
  },
  {
    term: "Meson / Proton / Neutron / SU(3) 4x4",
    description:
      "Configuraciones predefinidas: Mesón (quark + antiquark), Protón (dos quarks up + un down), Neutrón (un up + dos down) y SU(3) 4x4 (retículo 4D con enlaces gauge dinámicos)."
  },
  {
    term: "+ Quark",
    description: "Agrega una nueva partícula (quark o antiquark) con posición y velocidad aleatoria a la simulación actual."
  },
  {
    term: "Campos",
    description: "Muestra u oculta los tubos de flujo de campo gluónico. Es solo una ayuda visual y no afecta la física calculada."
  },
  {
    term: "CSV / HDF5",
    description:
      "Exporta los datos de la simulación actual (trayectorias, energía, observables) en formato CSV o HDF5. Solo disponible cuando hay una simulación en el backend."
  }
];

export function SimulationControls({ embedded = false }: { embedded?: boolean } = {}) {
  const socketRef = useRef<WebSocket | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    status,
    simulationId,
    dt,
    playbackSpeed,
    depthSpread,
    integrator,
    potential,
    setStatus,
    setSimulationId,
    setBackend,
    setDt,
    setPlaybackSpeed,
    setDepthSpread,
    setIntegrator,
    setPotential,
    applyPreset,
    addParticle,
    reset,
    stepLocal,
    applyFrame,
    toggleFields
  } = useSimulationStore();

  async function runBackend() {
    setBusy(true);
    try {
      const created = await createSimulation(currentConfig());
      const id = String(created.simulation_id);
      setSimulationId(id);
      socketRef.current?.close();
      socketRef.current = connectFrames(id, applyFrame);
      await runSimulation(id, currentConfig().steps, 4);
      setStatus("running");
      setBackend(true, "Backend conectado por WebSocket");
    } catch (error) {
      setBackend(false, error instanceof Error ? error.message : "Backend no disponible");
    } finally {
      setBusy(false);
    }
  }

  async function pauseOrResume() {
    if (!simulationId) {
      setStatus(status === "running" ? "paused" : "running");
      return;
    }
    if (status === "running") {
      await pauseSimulation(simulationId);
      setStatus("paused");
    } else {
      await resumeSimulation(simulationId);
      setStatus("running");
    }
  }

  async function cancel() {
    if (simulationId) await cancelSimulation(simulationId);
    setStatus("canceled");
  }

  async function exportCurrent(format: "csv" | "hdf5" | "json") {
    if (!simulationId) return;
    await exportSimulation(simulationId, format);
  }

  return (
    <section className="panel controls" aria-labelledby="controls-heading">
      <div className="panel-heading">
        <h2 id="controls-heading">Control</h2>
        <span>{status}</span>
      </div>
      <div className="toolbar toolbar-grid">
        <button
          type="button"
          onClick={runBackend}
          disabled={busy}
          title="Ejecutar simulación en el backend Python (servidor). Crea una nueva configuración, conecta con WebSocket y procesa todos los pasos en el servidor de una vez. Más lento pero preciso."
        >
          <Play size={17} /> Backend
        </button>
        <button
          type="button"
          onClick={() => { setStatus("running"); stepLocal(); }}
          title="Ejecutar un único paso de integración local (en el navegador). Avanza la simulación un intervalo dt. Usa Velocity Verlet o Leapfrog según configuración."
        >
          <Gauge size={17} /> Paso
        </button>
        <button
          type="button"
          onClick={pauseOrResume}
          title={status === "running" ? "Pausar: detiene la simulación sin borrar el estado. Permite inspeccionar o ajustar parámetros." : "Reanudar: continúa la simulación desde donde se pausó."}
        >
          {status === "running" ? <Pause size={17} /> : <Play size={17} />} {status === "running" ? "Pausa" : "Reanudar"}
        </button>
        <button
          type="button"
          onClick={cancel}
          title="Cancelar: detiene la simulación backend en progreso. En modo local (Paso), no tiene efecto."
        >
          <Square size={16} /> Stop
        </button>
        <button
          type="button"
          onClick={reset}
          title="Reset: vuelve al estado inicial. Reinicia partículas a sus posiciones originales, borra historial de energía y pasos."
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>
      <div className="control-grid">
        <label title="dt = tamaño del paso temporal. Valores pequeños (0.001) son más precisos pero lentos. Grandes (0.05) son rápidos pero pueden ser inexactos. Rango: 0.0001–0.05">
          Paso temporal (dt)
          <input
            type="number"
            min="0.0001"
            max="0.05"
            step="0.0005"
            value={dt}
            onChange={(event) => setDt(Number(event.target.value))}
            title="Cada click en 'Paso' avanza t en dt unidades. Tipo de paso: Velocity Verlet o Leapfrog."
          />
        </label>
        <label title="Velocidad de reproducción visual: 1x = normal, 2x = el doble, 0.25x = cuarto. SOLO afecta la velocidad de visualización, NO los cálculos de física.">
          Velocidad visual (x1-x4)
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            title="Usalo para ver los movimientos más lentamente o más rápidamente sin cambiar la física real."
          />
        </label>
        <label title="Algoritmo numérico: Velocity Verlet = estándar, mejor energía. Leapfrog = alternativa, útil para verificación.">
          Integrador numérico
          <select
            value={integrator}
            onChange={(event) => setIntegrator(event.target.value as "velocity_verlet" | "leapfrog")}
            title="Velocity Verlet es más estable energéticamente. Leapfrog es para comparación y retículo."
          >
            <option value="velocity_verlet">Velocity Verlet (estándar)</option>
            <option value="leapfrog">Leapfrog (comparativo)</option>
          </select>
        </label>
        <label title="Coeficiente a en V(r) = a/r + b*r. La parte a/r es como Coulomb: atrae partículas a corta distancia. Valores típicos: 0.1–1.0">
          Coulomb a (a/r)
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={potential.coulomb_strength}
            onChange={(event) => setPotential({ coulomb_strength: Number(event.target.value) })}
            title="Término de corto alcance en el potencial. Aumentar = atracción más fuerte."
          />
        </label>
        <label title="Coeficiente b en V(r) = a/r + b*r. La parte b*r es lineal: modela confinamiento a larga distancia (como una cuerda que tira). Valores típicos: 0.5–2.0">
          String tension b (b*r)
          <input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={potential.string_tension}
            onChange={(event) => setPotential({ string_tension: Number(event.target.value) })}
            title="Término de largo alcance. Aumentar = más atracción a distancia (como cuerda elástica)."
          />
        </label>
        <label title="Radio de suavizado para evitar división por cero en r=0. Valores pequeños (0.01) = más agudo. Grandes (0.1) = más suave. Previene fuerzas infinitas.">
          Softening ε (suavizado)
          <input
            type="number"
            min="0.001"
            max="1"
            step="0.001"
            value={potential.softening}
            onChange={(event) => setPotential({ softening: Number(event.target.value) })}
            title="Regularización: aumentar para suavizar fuerzas muy grandes a r pequeño."
          />
        </label>
        <label title="Dispersión en el eje Z al crear partículas (presets y +Quark). 0 = todo en un plano. Valores altos = partículas repartidas en volumen 3D real.">
          Profundidad 3D (z)
          <input
            type="number"
            min="0"
            max="2"
            step="0.05"
            value={depthSpread}
            onChange={(event) => setDepthSpread(Number(event.target.value))}
            title="Al aplicar un preset o agregar un quark, la posición z se sortea entre -valor y +valor."
          />
        </label>
        <label
          className="checkbox-field"
          title="Añade un núcleo repulsivo de muy corto alcance, solo para que las partículas no se atraviesen visualmente. No es parte del potencial de Cornell ni de QCD real: es un agregado fenomenológico."
        >
          <input
            type="checkbox"
            checked={potential.repulsion_enabled}
            onChange={(event) => setPotential({ repulsion_enabled: event.target.checked })}
          />
          Repulsión de corto alcance (no-QCD)
        </label>
        <label title="Intensidad del núcleo repulsivo fenomenológico. Solo tiene efecto si la casilla de arriba está activada. Valores típicos: 0.01–0.1.">
          Intensidad repulsión
          <input
            type="number"
            min="0"
            max="5"
            step="0.01"
            disabled={!potential.repulsion_enabled}
            value={potential.repulsion_strength}
            onChange={(event) => setPotential({ repulsion_strength: Number(event.target.value) })}
            title="Mayor valor = núcleo repulsivo más fuerte, mantiene más distancia mínima entre partículas."
          />
        </label>
      </div>
      <div className="segmented" aria-label="Presets configurados">
        <button type="button" onClick={() => applyPreset("meson")} title="Mesón: 1 quark rojo + 1 antiquark anti-rojo unidos por potencial Cornell. Estado ligado educativo.">
          Meson
        </button>
        <button type="button" onClick={() => applyPreset("proton")} title="Protón: 2 quarks up rojos + 1 quark down en triple: r,g,b aprox. Barión estable aproximado.">
          Proton
        </button>
        <button type="button" onClick={() => applyPreset("neutron")} title="Neutrón: 1 quark up + 2 down en triple SU(3). Carga neutra, similar a protón en estructura de color.">
          Neutron
        </button>
        <button type="button" onClick={() => applyPreset("lattice")} title="SU(3) 4x4: retículo 4D (2³ espacial × 4 temporal) con links gauge SU(3) dinámicos para QCD.">
          SU(3) 4x4
        </button>
      </div>
      <div className="toolbar toolbar-grid">
        <button
          type="button"
          onClick={() => addParticle()}
          title="Agregar 1 quark o antiquark nuevo con posición/velocidad aleatoria a la simulación actual."
        >
          <Plus size={16} /> Quark
        </button>
        <button
          type="button"
          onClick={toggleFields}
          title="Mostrar/ocultar tubos de flujo de campo gluónico (solo visualización, no afecta la física)."
        >
          <SlidersHorizontal size={16} /> Campos
        </button>
        <button
          type="button"
          disabled={!simulationId}
          onClick={() => exportCurrent("csv")}
          title="Exportar: trayectorias de partículas, energía, observables en CSV. Solo funciona con simulación backend."
        >
          <Save size={16} /> CSV
        </button>
        <button
          type="button"
          disabled={!simulationId}
          onClick={() => exportCurrent("hdf5")}
          title="Exportar: simulación completa en HDF5 (comprimido). Incluye configuración completa, datos científicos, metadatos."
        >
          <Save size={16} /> HDF5
        </button>
      </div>
      {!embedded && <HelpPanel title="Guía del laboratorio" entries={HELP_ENTRIES} />}
    </section>
  );
}

