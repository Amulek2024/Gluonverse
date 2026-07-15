import { HelpCircle, Minus, X } from "lucide-react";
import { useState } from "react";

export interface HelpEntry {
  term: string;
  description: string;
}

interface HelpPanelProps {
  title: string;
  entries: HelpEntry[];
}

export function HelpPanel({ title, entries }: HelpPanelProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="help-fab"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        title="Abrir ayuda: que hace cada control"
      >
        <HelpCircle size={18} /> Ayuda
      </button>
    );
  }

  return (
    <aside className={`help-panel ${minimized ? "minimized" : ""}`} aria-label={`Ayuda: ${title}`}>
      <div className="help-panel-heading">
        <span>
          <HelpCircle size={16} /> {title}
        </span>
        <div className="help-panel-actions">
          <button type="button" onClick={() => setMinimized((value) => !value)} title={minimized ? "Expandir ayuda" : "Minimizar ayuda"}>
            <Minus size={14} />
          </button>
          <button type="button" onClick={() => setOpen(false)} title="Cerrar ayuda">
            <X size={14} />
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="help-panel-body">
          {entries.map((entry) => (
            <div key={entry.term} className="help-entry">
              <strong>{entry.term}</strong>
              <p>{entry.description}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
