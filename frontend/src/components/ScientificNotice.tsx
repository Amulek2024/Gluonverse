import { AlertTriangle } from "lucide-react";

export function ScientificNotice({ scope = "educational" }: { scope?: "educational" | "lattice" | "atomos" | "moleculas" | "gravedad" }) {
  const message =
    scope === "lattice"
      ? "QCD de reticulo 4D en volumen finito. Los observables se calculan, pero la red pequena no permite extrapolacion al continuo ni dinamica en tiempo real."
      : scope === "atomos"
        ? "Modelo semiclasico educativo: nube electronica muestreada de la funcion de onda hidrogenoide real con carga nuclear efectiva de Slater, no una solucion de Hartree-Fock/DFT de multi-electron. El nucleo se muestra a un tamano fijo, no a escala real."
        : scope === "moleculas"
          ? "Cada atomo reutiliza el modelo hidrogenoide de la vista Atomos, colocado en su posicion de enlace real (longitudes/angulos experimentales). No se calculan orbitales moleculares compartidos ni fuerzas de enlace: la geometria es fija, no simulada."
          : scope === "gravedad"
            ? "Gravedad newtoniana N-body real (no restringida a un par de cuerpos fijos), con constantes de visualizacion (G, softening), no valores SI. La fusion al contacto es un modelo simplificado de acrecion, no una simulacion de colision real."
            : "Modelo efectivo educativo. Las particulas y los campos visibles son metaforas graficas, no una solucion de las ecuaciones de QCD.";
  return (
    <div className="notice" role="note">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
