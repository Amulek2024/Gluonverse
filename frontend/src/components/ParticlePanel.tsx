import type { ParticleState } from "../types/physics";
import { colorPattern, visualColor } from "../utils/particles";

export function ParticlePanel({
  particles,
  selectedId,
  onSelect
}: {
  particles: ParticleState[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel particle-panel" aria-labelledby="particles-heading">
      <div className="panel-heading">
        <h2 id="particles-heading">Particulas</h2>
        <span>{particles.length} estados</span>
      </div>
      <div className="particle-list">
        {particles.map((particle) => (
          <button
            className={`particle-row ${particle.id === selectedId ? "selected" : ""}`}
            key={particle.id}
            type="button"
            onClick={() => onSelect(particle.id)}
          >
            <span
              className={`swatch ${colorPattern(particle.color_charge)}`}
              style={{ backgroundColor: visualColor(particle.color_charge) }}
              aria-hidden="true"
            />
            <span>
              <strong>{particle.flavor}</strong>
              <small>{particle.color_charge}</small>
            </span>
            <span className="mono">{particle.energy.toExponential(2)}</span>
          </button>
        ))}
      </div>
      {selectedId && (
        <pre className="particle-json">
          {JSON.stringify(
            particles.find((particle) => particle.id === selectedId),
            null,
            2
          )}
        </pre>
      )}
    </section>
  );
}

