import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../../types";
import { steel, darkSteel, concrete, water, paintedGrey } from "../materials";
import { Beacon, Pipe } from "../effects";

// Effluent treatment: circular clarifier with rotating rake bridge,
// equalisation tank, filter press on a plinth, sludge skip, interconnecting pipes.
export default function EffluentPlant({ severity }: { severity: Severity }) {
  const bridge = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (bridge.current) bridge.current.rotation.y += dt * 0.25;
  });

  return (
    <group>
      {/* clarifier */}
      <group position={[-0.7, 0, 0.5]}>
        <mesh position={[0, 0.45, 0]} material={concrete} castShadow receiveShadow>
          <cylinderGeometry args={[1.35, 1.35, 0.9, 40, 1, true]} />
        </mesh>
        <mesh position={[0, 0.9, 0]} material={concrete}>
          <torusGeometry args={[1.35, 0.07, 8, 40]} />
        </mesh>
        <mesh position={[0, 0.78, 0]} material={water}>
          <cylinderGeometry args={[1.3, 1.3, 0.04, 40]} />
        </mesh>
        {/* centre column + rake bridge */}
        <mesh position={[0, 0.9, 0]} material={steel}>
          <cylinderGeometry args={[0.1, 0.1, 1.0, 12]} />
        </mesh>
        <group ref={bridge} position={[0, 1.22, 0]}>
          <mesh position={[0.7, 0, 0]} material={darkSteel} castShadow>
            <boxGeometry args={[1.4, 0.08, 0.35]} />
          </mesh>
          {[0.25, 0.75, 1.25].map((x, i) => (
            <mesh key={i} position={[x, 0.18, 0]} material={steel}>
              <cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />
            </mesh>
          ))}
          <mesh position={[0.75, 0.36, 0]} material={steel}>
            <boxGeometry args={[1.1, 0.02, 0.02]} />
          </mesh>
        </group>
      </group>

      {/* equalisation tank (rectangular) */}
      <group position={[1.1, 0, -0.6]}>
        <mesh position={[0, 0.5, 0]} material={concrete} castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.0, 1.6]} />
        </mesh>
        <mesh position={[0, 1.0, 0]} material={water}>
          <boxGeometry args={[1.3, 0.02, 1.4]} />
        </mesh>
        {/* dosing pump skid */}
        <mesh position={[0.95, 0.25, 0.4]} material={paintedGrey}>
          <boxGeometry args={[0.35, 0.5, 0.35]} />
        </mesh>
      </group>

      {/* filter press on plinth */}
      <group position={[1.1, 0, 1.15]}>
        <mesh position={[0, 0.1, 0]} material={concrete}>
          <boxGeometry args={[1.7, 0.2, 0.9]} />
        </mesh>
        {[-0.7, 0.7].map((x, i) => (
          <mesh key={i} position={[x, 0.65, 0]} material={darkSteel} castShadow>
            <boxGeometry args={[0.12, 0.9, 0.7]} />
          </mesh>
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[-0.55 + i * 0.1, 0.65, 0]} material={paintedGrey}>
            <boxGeometry args={[0.05, 0.75, 0.62]} />
          </mesh>
        ))}
        <mesh position={[0, 1.15, 0]} material={steel}>
          <cylinderGeometry args={[0.035, 0.035, 1.5, 8]} />
        </mesh>
      </group>

      {/* sludge skip — the landfilled stream flagged for symbiosis */}
      <group position={[-0.6, 0, -1.2]}>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[1.2, 0.6, 0.8]} />
          <meshStandardMaterial color="#8a5a2b" roughness={0.8} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.66, 0]}>
          <boxGeometry args={[1.05, 0.06, 0.65]} />
          <meshStandardMaterial color="#6b6258" roughness={1} />
        </mesh>
      </group>

      {/* interconnecting pipes */}
      <Pipe points={[[1.1, 1.05, -0.6], [0.4, 1.1, -0.2], [-0.7, 1.05, 0.2]]} radius={0.06} color="#7d858f" />
      <Pipe points={[[-0.7, 0.15, 0.5], [0.2, 0.15, 1.15], [1.1, 0.25, 1.15]]} radius={0.06} color="#7d858f" />

      <Beacon position={[1.95, 0.9, 1.15]} severity={severity} />
    </group>
  );
}
