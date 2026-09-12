import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../../types";
import { steel, darkSteel, paintedBlue, paintedGrey, rubber } from "../materials";
import { Beacon, Flange, Pipe } from "../effects";

// Compressor house: two screw-compressor packages, twin horizontal air
// receivers, refrigerant dryer, header piping with valves, cooling fans.
export default function CompressorHouse({ severity }: { severity: Severity }) {
  const fanA = useRef<THREE.Mesh>(null);
  const fanB = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (fanA.current) fanA.current.rotation.y += dt * 9;
    if (fanB.current) fanB.current.rotation.y += dt * 7.5;
  });

  return (
    <group>
      {/* slab plinth */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.12, 2.8]} />
        <meshStandardMaterial color="#6a6d74" roughness={0.95} />
      </mesh>

      {/* compressor packages */}
      {[-0.8, 0.35].map((x, i) => (
        <group key={i} position={[x, 0.12, -0.7]}>
          <mesh position={[0, 0.55, 0]} material={paintedBlue} castShadow receiveShadow>
            <boxGeometry args={[1.0, 1.1, 1.1]} />
          </mesh>
          {/* louvre panel */}
          {[0.25, 0.4, 0.55, 0.7, 0.85].map((y, j) => (
            <mesh key={j} position={[0, y, 0.56]} material={darkSteel}>
              <boxGeometry args={[0.8, 0.03, 0.02]} />
            </mesh>
          ))}
          {/* top cooling fan */}
          <mesh position={[0, 1.13, 0]} material={darkSteel}>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 24]} />
          </mesh>
          <mesh ref={i === 0 ? fanA : fanB} position={[0, 1.17, 0]} material={steel}>
            <boxGeometry args={[0.6, 0.02, 0.08]} />
          </mesh>
          {/* control panel screen */}
          <mesh position={[0.3, 0.8, 0.565]}>
            <boxGeometry args={[0.22, 0.14, 0.01]} />
            <meshStandardMaterial color="#0b1f2e" emissive="#3ea6ff" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}

      {/* air receivers (horizontal) */}
      {[0.35, 1.0].map((z, i) => (
        <group key={i} position={[-0.2, 0.62, z]}>
          {[-0.8, 0.8].map((x, j) => (
            <mesh key={j} position={[x, -0.3, 0]} material={darkSteel}>
              <boxGeometry args={[0.12, 0.5, 0.5]} />
            </mesh>
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]} material={steel} castShadow>
            <capsuleGeometry args={[0.26, 1.7, 8, 20]} />
          </mesh>
          <Flange position={[0, 0.3, 0]} radius={0.08} />
          <mesh position={[0, 0.42, 0]} material={darkSteel}>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
          </mesh>
        </group>
      ))}

      {/* refrigerant dryer cabinet */}
      <mesh position={[1.25, 0.55, 0.65]} material={paintedGrey} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.7]} />
      </mesh>

      {/* header piping with isolation valves */}
      <Pipe points={[[-0.8, 1.15, -0.15], [-0.4, 1.35, 0.2], [0.35, 1.35, 0.2], [0.6, 1.35, 0.35], [1.25, 1.1, 0.65]]} radius={0.06} color="#9fb3c8" />
      <Pipe points={[[-1.05, 0.62, 0.35], [-1.35, 0.62, 0.35], [-1.35, 0.62, 1.0], [-1.05, 0.62, 1.0]]} radius={0.06} color="#9fb3c8" />
      {[-0.4, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 1.42, 0.2]} material={rubber}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
        </mesh>
      ))}

      <Beacon position={[1.25, 1.12, 0.65]} severity={severity} />
    </group>
  );
}
