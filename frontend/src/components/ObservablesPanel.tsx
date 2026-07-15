import type { Observables } from "../types/physics";

const educationalLabels: Array<[keyof Observables, string, string]> = [
  ["total_energy", "Energia total", "GeV*"],
  ["kinetic_energy", "Energia cinetica", "GeV*"],
  ["potential_energy", "Energia potencial", "GeV*"],
  ["energy_drift", "Deriva energia", "rel."],
  ["momentum_error", "Error momento", "rel."],
  ["electric_charge", "Carga electrica", "e"],
  ["baryon_number", "Numero barionico", ""]
];

const latticeLabels: Array<[keyof Observables, string, string]> = [
  ["acceptance_rate", "Aceptacion MC", ""],
  ["average_plaquette", "Plaqueta media", ""],
  ["wilson_loop", "Wilson loop", ""],
  ["polyakov_loop_abs", "|Polyakov|", ""],
  ["action", "Accion gauge", ""],
  ["fermion_logdet", "log det fermionico", ""],
  ["effective_action", "Accion efectiva", ""],
  ["chiral_condensates", "Condensado quiral", "por sabor"],
  ["fermion_condition_number", "Condicion de Dirac", ""]
];

function formatValue(value: unknown) {
  if (typeof value === "number") return value.toPrecision(4);
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "number" ? item.toPrecision(4) : String(item)).join(" / ");
  }
  return String(value);
}

export function ObservablesPanel({ observables }: { observables: Observables }) {
  const isLattice = observables.action !== undefined;
  const labels = isLattice ? latticeLabels : educationalLabels;
  return (
    <section className="panel observables" aria-labelledby="observables-heading">
      <div className="panel-heading">
        <h2 id="observables-heading">Observables</h2>
        <span className="unit-note">{isLattice ? "unidades de lattice bare" : "*unidades naturales educativas"}</span>
      </div>
      <div className="metric-grid">
        {labels
          .filter(([key]) => observables[key] !== undefined)
          .map(([key, label, unit]) => {
            const value = observables[key];
            const display = formatValue(value);
            return (
              <div className="metric" key={String(key)}>
                <span>{label}</span>
                <strong>
                  {display} <small>{unit}</small>
                </strong>
              </div>
            );
          })}
      </div>
    </section>
  );
}
