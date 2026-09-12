import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../../types";
import { steel, darkSteel, paintedGrey, refractory } from "../materials";
import { Smoke, Beacon, Flange, Pipe } from "../effects";

// Packaged fire-tube steam boiler / thermic-fluid heater: horizontal drum on
// saddles, front burner with sight-glass glow, economiser box, feed pumps, stack.
export default function Boiler({ severity }: { severity: Severity }) {
  const glow = useRef<THREE.Mesh>(null);
  const flame = severity === "crit" ? "#ff5a1f" : severity === "warn" ? "#ff9a2e" : "#ffb347";
  useFrame((s) => {
    if (glow.current) (glow.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6 + Math.sin(s.clock.elapsedTime * 9) * 0.5;
  });

  return (
    <group>
      {/* saddles */}
      {[-1.2, 1.2].map((x, i) => (
        <mesh key={i} position={[x, 0.35, 0]} material={darkSteel} castShadow>
          <boxGeometry args={[0.5, 0.7, 1.9]} />
        </mesh>
      ))}
      {/* drum */}
      <mesh position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} material={paintedGrey} castShadow receiveShadow>
        <capsuleGeometry args={[0.85, 2.6, 8, 28]} />
      </mesh>
      {[-0.9, 0, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} material={darkSteel}>
          <torusGeometry args={[0.87, 0.04, 8, 40]} />
        </mesh>
      ))}
      {/* front plate + burner */}
      <mesh position={[2.15, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} material={refractory}>
        <cylinderGeometry args={[0.7, 0.7, 0.2, 28]} />
      </mesh>
      <mesh position={[2.55, 1.35, 0]} rotation={[0, 0, Math.PI / 2]} material={darkSteel} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.6, 16]} />
      </mesh>
      <mesh ref={glow} position={[2.26, 1.35, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 12]} />
        <meshStandardMaterial color={flame} emissive={flame} emissiveIntensity={3} />
      </mesh>
      <pointLight position={[2.6, 1.4, 0.6]} color={flame} intensity={severity === "crit" ? 5 : 2.5} distance={4} decay={2} />

      {/* steam header + safety valves on top */}
      <Pipe points={[[-1.4, 2.25, 0], [-1.4, 2.6, 0], [0.4, 2.6, 0], [1.4, 2.6, 0]]} radius={0.09} color="#9fb3c8" />
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 2.45, 0]} material={steel}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 10]} />
        </mesh>
      ))}

      {/* economiser box + flue to stack */}
      <mesh position={[-2.4, 1.6, -0.4]} material={paintedGrey} castShadow>
        <boxGeometry args={[0.9, 1.6, 1.0]} />
      </mesh>
      <Pipe points={[[-1.6, 1.9, -0.4], [-2.0, 1.9, -0.4]]} radius={0.22} color="#6f7780" />
      <mesh position={[-2.4, 3.6, -0.4]} material={darkSteel} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 2.4, 16]} />
      </mesh>
      <Flange position={[-2.4, 2.45, -0.4]} radius={0.28} />
      <Smoke position={[-2.4, 4.85, -0.4]} severity={severity} />

      {/* feed-water pumps */}
      {[0.6, 1.1].map((z, i) => (
        <group key={i} position={[-0.6 + i * 0.7, 0, z + 0.5]}>
          <mesh position={[0, 0.2, 0]} material={darkSteel}>
            <boxGeometry args={[0.45, 0.4, 0.3]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
            <cylinderGeometry args={[0.12, 0.12, 0.4, 12]} />
          </mesh>
        </group>
      ))}

      <Beacon position={[2.55, 2.0, 0]} severity={severity} />
    </group>
  );
}
