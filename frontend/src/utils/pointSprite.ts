import { CanvasTexture } from "three";

// THREE.PointsMaterial dibuja cada punto como un sprite cuadrado por defecto; este mapa
// circular con gradiente radial (blanco solido en el centro, transparente en el borde) hace
// que se vean como puntos/circulos suaves en vez de cuadrados, y que el blending aditivo forme
// un glow redondo en vez de bordes duros. Compartido entre escenas basadas en nubes de puntos
// (atomos, gravedad) -- no tiene contenido especifico de ningun dominio.
let circleSpriteCache: CanvasTexture | null = null;
export function getCircleSprite(): CanvasTexture {
  if (circleSpriteCache) return circleSpriteCache;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  circleSpriteCache = new CanvasTexture(canvas);
  return circleSpriteCache;
}
