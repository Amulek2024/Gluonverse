import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const CAMERA_DIRECTION = new Vector3(3, 2, 4).normalize();

// Reencuadra la camara a una distancia proporcional al tamano actual de la escena (radio del
// atomo, extension de los cuerpos gravitacionales, etc.) cada vez que ese tamano cambia --
// sin esto, una distancia de camara fija deja escenas chicas como un punto invisible y escenas
// grandes con la camara metida adentro. `resetToken` no participa en el calculo, solo dispara
// el efecto de nuevo para un boton "reiniciar vista".
export function CameraFit({
  distance,
  controlsRef,
  resetToken
}: {
  distance: number;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  resetToken: number;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    if ("updateProjectionMatrix" in camera) camera.updateProjectionMatrix();
    const controls = controlsRef.current;
    if (controls) {
      // Tambien recentra el punto de orbita: un pan (clic derecho + arrastrar) lo mueve del
      // origen, y sin esto la camara "resetea" posicion pero sigue orbitando/mirando un punto
      // descuadrado en vez de la escena.
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, distance, controlsRef, resetToken]);
  return null;
}
