import { OrbitControls, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { LatticeCell } from "../types/physics";

interface Props {
  cells: LatticeCell[];
  size: number;
}

function energyColor(value: number) {
  if (value > 0.55) return "#FF5D73";
  if (value > 0.32) return "#F2B84B";
  return "#4DD0E1";
}

function Content({ cells, size }: Props) {
  const offset = (size - 1) / 2;
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 3]} intensity={2.4} />
      {cells.map((cell) => (
        <group key={`${cell.x}-${cell.y}`} position={[cell.x - offset, cell.energy_density * 0.45, cell.y - offset]}>
          <mesh>
            <boxGeometry args={[0.74, Math.max(0.05, cell.energy_density + 0.06), 0.74]} />
            <meshStandardMaterial
              color={energyColor(cell.energy_density)}
              emissive={energyColor(cell.energy_density)}
              emissiveIntensity={0.28}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
      {Array.from({ length: size + 1 }, (_, index) => (
        <group key={`grid-${index}`}>
          <mesh position={[index - offset - 0.5, 0, 0]}>
            <boxGeometry args={[0.01, 0.015, size]} />
            <meshBasicMaterial color="#2D3748" />
          </mesh>
          <mesh position={[0, 0, index - offset - 0.5]}>
            <boxGeometry args={[size, 0.015, 0.01]} />
            <meshBasicMaterial color="#2D3748" />
          </mesh>
        </group>
      ))}
      <Text position={[0, -0.32, offset + 0.9]} fontSize={0.08} color="#CBD5E1" anchorX="center">
        Altura = densidad energetica reducida por plaqueta
      </Text>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}

export function LatticeScene(props: Props) {
  return (
    <Canvas camera={{ position: [2.8, 3.4, 4.2], fov: 45 }} dpr={[1, 1.8]}>
      <Content {...props} />
    </Canvas>
  );
}

