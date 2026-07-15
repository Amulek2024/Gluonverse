import { OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { fieldFragmentShader, fieldVertexShader } from "../shaders/fieldShader";
import type { ParticleState } from "../types/physics";
import { visualColor } from "../utils/particles";

interface GluonSceneProps {
  particles: ParticleState[];
  selectedId?: string;
  showFields: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

function ParticleMesh({
  particle,
  selected,
  onSelect
}: {
  particle: ParticleState;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const color = visualColor(particle.color_charge);
  const scale = particle.is_antiparticle ? 0.115 : 0.13;
  return (
    <group position={particle.position}>
      <mesh onClick={() => onSelect(particle.id)} castShadow>
        <sphereGeometry args={[scale, 32, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.7 : 0.32}
          roughness={0.35}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[scale * (selected ? 1.9 : 1.55), 32, 16]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.18 : 0.08} />
      </mesh>
      <Text
        position={[0, scale + 0.16, 0]}
        fontSize={0.08}
        color="#F8FAFC"
        anchorX="center"
        anchorY="middle"
      >
        {particle.flavor}
      </Text>
    </group>
  );
}

function VectorLine({
  start,
  vector,
  color
}: {
  start: [number, number, number];
  vector: [number, number, number];
  color: string;
}) {
  const end: [number, number, number] = [
    start[0] + vector[0] * 0.6,
    start[1] + vector[1] * 0.6,
    start[2] + vector[2] * 0.6
  ];
  const points = useMemo(
    () => [new THREE.Vector3(...start), new THREE.Vector3(...end)],
    [start[0], start[1], start[2], end[0], end[1], end[2]]
  );
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

function FluxTube({ a, b }: { a: ParticleState; b: ParticleState }) {
  const start = useMemo(() => new THREE.Vector3(...a.position), [a.position]);
  const end = useMemo(() => new THREE.Vector3(...b.position), [b.position]);
  const { midpoint, length, quaternion } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const len = Math.max(direction.length(), 0.001);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    return { midpoint: mid, length: len, quaternion: quat };
  }, [start, end]);
  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.025, 0.025, length, 18, 1, true]} />
      <meshStandardMaterial
        color="#4DD0E1"
        emissive="#4DD0E1"
        emissiveIntensity={0.55}
        transparent
        opacity={0.36}
      />
    </mesh>
  );
}

function FieldDisc({ visible, reducedMotion }: { visible: boolean; reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current && !reducedMotion) {
      material.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });
  if (!visible) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
      <planeGeometry args={[4.5, 4.5, 96, 96]} />
      <shaderMaterial
        ref={material}
        vertexShader={fieldVertexShader}
        fragmentShader={fieldFragmentShader}
        transparent
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
          uIntensity: { value: 0.45 }
        }}
      />
    </mesh>
  );
}

function SceneContent({ particles, selectedId, showFields, reducedMotion, onSelect }: GluonSceneProps) {
  return (
    <>
      <color attach="background" args={["#070A10"]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[3.2, 3.5, 2.5]} intensity={3.2} color="#FFFFFF" />
      <pointLight position={[-2.5, -1.8, -2.2]} intensity={1.2} color="#4DD0E1" />
      <gridHelper args={[4.2, 18, "#2D3748", "#172033"]} position={[0, -0.35, 0]} />
      <FieldDisc visible={showFields} reducedMotion={reducedMotion} />
      {showFields &&
        particles.slice(0, 5).map((particleA, index) =>
          particles.slice(index + 1, 6).map((particleB) => (
            <FluxTube key={`${particleA.id}-${particleB.id}`} a={particleA} b={particleB} />
          ))
        )}
      {particles.map((particle) => (
        <ParticleMesh
          key={particle.id}
          particle={particle}
          selected={particle.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      {particles.map((particle) => (
        <VectorLine
          key={`${particle.id}-velocity`}
          start={particle.position}
          vector={particle.velocity}
          color="#F2B84B"
        />
      ))}
      <Text position={[0, -0.62, 1.65]} fontSize={0.075} color="#CBD5E1" anchorX="center">
        Escala visual arbitraria: tamanos y tubos son metaforas graficas.
      </Text>
      <OrbitControls makeDefault enableDamping={!reducedMotion} dampingFactor={0.08} />
    </>
  );
}

export function GluonScene(props: GluonSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 3.2], fov: 48 }}
      dpr={[1, 1.8]}
      shadows
      aria-label="Escena 3D interactiva de quarks y campos aproximados"
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
