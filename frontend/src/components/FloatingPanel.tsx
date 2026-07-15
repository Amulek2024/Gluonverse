import { Minus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

interface FloatingPanelProps {
  title: string;
  triggerLabel: string;
  triggerIcon: ReactNode;
  side?: "left" | "right";
  defaultOpen?: boolean;
  children: ReactNode;
}

export function FloatingPanel({
  title,
  triggerLabel,
  triggerIcon,
  side = "left",
  defaultOpen = false,
  children
}: FloatingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);
  const sideClass = side === "left" ? "floating-panel-left" : "floating-panel-right";

  if (!open) {
    return (
      <button
        type="button"
        className={`floating-panel-fab ${sideClass}`}
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        title={`Abrir ${title}`}
      >
        {triggerIcon} {triggerLabel}
      </button>
    );
  }

  return (
    <aside className={`floating-panel ${sideClass} ${minimized ? "minimized" : ""}`} aria-label={title}>
      <div className="floating-panel-heading">
        <span>
          {triggerIcon} {title}
        </span>
        <div className="floating-panel-actions">
          <button type="button" onClick={() => setMinimized((value) => !value)} title={minimized ? "Expandir" : "Minimizar"}>
            <Minus size={14} />
          </button>
          <button type="button" onClick={() => setOpen(false)} title="Cerrar">
            <X size={14} />
          </button>
        </div>
      </div>
      {!minimized && <div className="floating-panel-body">{children}</div>}
    </aside>
  );
}
