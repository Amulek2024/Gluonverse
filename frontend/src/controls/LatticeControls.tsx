import { Atom, Play } from "lucide-react";
import { currentConfig, useSimulationStore } from "../stores/useSimulationStore";
import { connectFrames, createSimulation, runSimulation, waitForSocket } from "../api/client";
import { useRef, useState } from "react";
import { HelpPanel } from "../components/HelpPanel";

const HELP_ENTRIES = [
  {
    term: "Fermiones",
    description:
      "Dinámicos (staggered): incluye el efecto de los quarks virtuales en el cálculo (más realista, más lento). Quenched: ignora ese efecto (más rápido, aproximación más cruda)."
  },
  {
    term: "Extensión espacial",
    description: "Tamaño de la red en las 3 dimensiones espaciales (2x2x2, 3x3x3 o 4x4x4). Redes más grandes son más costosas de calcular."
  },
  {
    term: "Extensión temporal Nt",
    description: "Tamaño de la red en la dimensión temporal (eje euclídeo). Afecta la resolución con la que se miden observables como el condensado quiral."
  },
  {
    term: "Beta",
    description:
      "Parámetro inverso del acoplamiento (β = 2N/g²). Valores altos de beta corresponden a un acoplamiento más débil (red más 'suave', cerca del continuo); valores bajos, a un acoplamiento fuerte."
  },
  {
    term: "Masa bare am",
    description: "Masa desnuda del fermión en unidades de la red. Solo aplica cuando se usan fermiones dinámicos; controla cuán pesados son los quarks simulados."
  },
  {
    term: "Iteraciones",
    description: "Número de pasos de la cadena de Markov (Metropolis-Hastings). Más iteraciones dan mejor estadística pero tardan más en ejecutarse."
  },
  {
    term: "Ejecutar Markov chain",
    description: "Lanza la simulación en el backend: genera y actualiza los enlaces SU(3) de la red según la acción de Wilson y el determinante fermiónico."
  }
];

export function LatticeControls({ embedded = false }: { embedded?: boolean } = {}) {
  const socketRef = useRef<WebSocket | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    latticeSize,
    latticeTemporalSize,
    latticeBeta,
    latticeIterations,
    latticeFermionMode,
    latticeMass,
    setLattice,
    setBackend,
    setSimulationId,
    applyFrame,
    setStatus
  } = useSimulationStore();

  async function runLattice() {
    setBusy(true);
    try {
      const created = await createSimulation({ ...currentConfig(), simulation_type: "gauge_lattice", dimensions: 4 });
      const id = String(created.simulation_id);
      setSimulationId(id);
      socketRef.current?.close();
      socketRef.current = connectFrames(id, applyFrame);
      await waitForSocket(socketRef.current);
      await runSimulation(id, latticeIterations, 1);
      setStatus("running");
      setBackend(true, "Lattice conectado por WebSocket");
    } catch (error) {
      setBackend(false, error instanceof Error ? error.message : "Backend no disponible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel controls" aria-labelledby="lattice-controls-heading">
      <div className="panel-heading">
        <h2 id="lattice-controls-heading">QCD de reticulo</h2>
        <span>4D euclidea</span>
      </div>
      <div className="control-grid">
        <label>
          Fermiones
          <select
            value={latticeFermionMode}
            onChange={(event) => {
              const mode = event.target.value as "quenched" | "dynamical_staggered";
              setLattice({
                latticeFermionMode: mode,
                ...(mode === "dynamical_staggered" && latticeSize === 4 ? { latticeSize: 2 } : {})
              });
            }}
          >
            <option value="dynamical_staggered">Dinamicos (staggered)</option>
            <option value="quenched">Quenched</option>
          </select>
        </label>
        <label>
          Extension espacial
          <select
            value={latticeSize}
            onChange={(event) => {
              const size = Number(event.target.value) as 2 | 3 | 4;
              setLattice({
                latticeSize: size,
                ...(latticeFermionMode === "dynamical_staggered" && size ** 3 * latticeTemporalSize > 64
                  ? { latticeTemporalSize: 2 }
                  : {})
              });
            }}
          >
            <option value={2}>2 x 2 x 2</option>
            <option value={3}>3 x 3 x 3</option>
            <option value={4} disabled={latticeFermionMode === "dynamical_staggered"}>4 x 4 x 4</option>
          </select>
        </label>
        <label>
          Extension temporal Nt
          <select
            value={latticeTemporalSize}
            onChange={(event) => setLattice({ latticeTemporalSize: Number(event.target.value) as 2 | 3 | 4 | 6 | 8 })}
          >
            {[2, 3, 4, 6, 8].map((extent) => (
              <option
                key={extent}
                value={extent}
                disabled={latticeFermionMode === "dynamical_staggered" && latticeSize ** 3 * extent > 64}
              >
                {extent}
              </option>
            ))}
          </select>
        </label>
        <label>
          Beta
          <input
            type="number"
            min="0.1"
            max="20"
            step="0.1"
            value={latticeBeta}
            onChange={(event) => setLattice({ latticeBeta: Number(event.target.value) })}
          />
        </label>
        <label>
          Masa bare am
          <input
            type="number"
            min="0.01"
            max="2"
            step="0.01"
            disabled={latticeFermionMode === "quenched"}
            value={latticeMass}
            onChange={(event) => setLattice({ latticeMass: Number(event.target.value) })}
          />
        </label>
        <label>
          Iteraciones
          <input
            type="number"
            min="1"
            max="2000"
            step="10"
            value={latticeIterations}
            onChange={(event) => setLattice({ latticeIterations: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="toolbar">
        <button type="button" disabled={busy} onClick={runLattice}>
          <Play size={17} /> {busy ? "Preparando..." : "Ejecutar Markov chain"}
        </button>
        <span className="small-copy"><Atom size={15} /> Volumen {latticeSize}^3 x {latticeTemporalSize}</span>
      </div>
      <p className="small-copy">
        Enlaces SU(3), accion de Wilson y determinante de dos sabores escalonados a potencial
        quimico cero. El calculo es 4D y cuantico-estadistico, pero el volumen es deliberadamente
        pequeno y no sustituye extrapolaciones al continuo.
      </p>
      {!embedded && <HelpPanel title="Guía del retículo QCD" entries={HELP_ENTRIES} />}
    </section>
  );
}
