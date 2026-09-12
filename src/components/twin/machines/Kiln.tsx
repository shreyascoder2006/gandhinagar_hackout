import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../../types";
import { steel, darkSteel, refractory, paintedGrey, safetyYellow } from "../materials";
import { Smoke, Beacon, Flange, Pipe } from "../effects";

// Roller-hearth kiln: segmented modules along x, entry/exit hoods, roller
// stands, firing zone with a glowing inspection port, burner manifold, stack.
export default function Kiln({ severity }: { severity: Severity }) {
  const L = 8;
  const H = 1.5;
  const segs = 8;
  const glow = useRef<THREE.Mesh>(null);
  const flameColor = severity === "crit" ? "#ff5a1f" : severity === "warn" ? "#ff9a2e" : "#ffb347";

  useFrame((s) => {
    if (!glow.current) return;
    const m = glow.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 2.8 + Math.sin(s.clock.elapsedTime * 7) * 0.5 + Math.sin(s.clock.elapsedTime * 13) * 0.3;
  });

  return (
    <group>
      {/* roller stands / legs */}
      {Array.from({ length: segs + 1 }).map((_, i) => {
        const x = -L / 2 + (L / segs) * i;
        return (
          <group key={i} position={[x, 0, 0]}>
            {[-0.85, 0.85].map((z, j) => (
              <mesh key={j} position={[0, 0.3, z]} material={darkSteel} castShadow>
                <boxGeometry args={[0.16, 0.6, 0.16]} />
              </mesh>
            ))}
            <mesh position={[0, 0.58, 0]} material={darkSteel}>
              <boxGeometry args={[0.16, 0.08, 1.9]} />
            </mesh>
          </group>
        );
      })}

      {/* kiln modules */}
      {Array.from({ length: segs }).map((_, i) => {
        const x = -L / 2 + (L / segs) * i + L / segs / 2;
        const isFiring = i >= 3 && i <= 5;
        return (
          <group key={i} position={[x, 0.62 + H / 2, 0]}>
            <mesh material={isFiring ? refractory : paintedGrey} castShadow receiveShadow>
              <boxGeometry args={[L / segs - 0.06, H, 2.0]} />
            </mesh>
            {/* module frame ribs */}
            <mesh position={[0, 0, 1.02]} material={darkSteel}>
              <boxGeometry args={[0.08, H + 0.1, 0.06]} />
            </mesh>
            <mesh position={[0, 0, -1.02]} material={darkSteel}>
              <boxGeometry args={[0.08, H + 0.1, 0.06]} />
            </mesh>
            {/* burner pairs on firing modules */}
            {isFiring &&
              [-0.25, 0.25].map((dx, j) => (
                <mesh key={j} position={[dx, 0.1, 1.08]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
                  <cylinderGeometry args={[0.07, 0.09, 0.22, 10]} />
                </mesh>
              ))}
          </group>
        );
      })}

      {/* roof channel + insulation cover */}
      <mesh position={[0, 0.62 + H + 0.12, 0]} material={steel} castShadow>
        <boxGeometry args={[L - 0.1, 0.24, 1.7]} />
      </mesh>

      {/* inspection port glow in the firing zone */}
      <mesh ref={glow} position={[0.2, 0.62 + H * 0.45, 1.01]}>
        <boxGeometry args={[0.5, 0.22, 0.02]} />
        <meshStandardMaterial color={flameColor} emissive={flameColor} emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0.2, 1.4, 1.4]} color={flameColor} intensity={severity === "crit" ? 6 : 3} distance={4.5} decay={2} />

      {/* entry / exit hoods */}
      {[-1, 1].map((d) => (
        <group key={d} position={[(d * L) / 2 + d * 0.35, 0.62 + H / 2, 0]}>
          <mesh material={darkSteel} castShadow>
            <boxGeometry args={[0.7, H * 0.7, 1.6]} />
          </mesh>
          <mesh position={[0, -H * 0.3, 0]} material={safetyYellow}>
            <boxGeometry args={[0.72, 0.06, 1.62]} />
          </mesh>
        </group>
      ))}

      {/* exhaust duct along roof + stack */}
      <Pipe points={[[-3.2, 2.5, -0.4], [-1.0, 2.5, -0.4], [1.2, 2.5, -0.4], [2.6, 2.6, -0.4], [3.2, 3.0, -0.4], [3.2, 4.4, -0.4]]} radius={0.17} color="#6f7780" />
      <mesh position={[3.2, 5.0, -0.4]} material={darkSteel} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 1.4, 16]} />
      </mesh>
      <Flange position={[3.2, 4.4, -0.4]} radius={0.3} />
      <Smoke position={[3.2, 5.7, -0.4]} severity={severity} />

      {/* gas manifold along the front */}
      <Pipe points={[[-3.6, 0.9, 1.25], [-1.2, 0.9, 1.25], [1.6, 0.9, 1.25], [3.6, 0.9, 1.25]]} radius={0.06} color="#d9a300" />
      {[-2.2, 0, 2.2].map((x, i) => (
        <mesh key={i} position={[x, 0.9, 1.25]} rotation={[0, 0, Math.PI / 2]} material={steel}>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 10]} />
        </mesh>
      ))}

      {/* control cabinet + beacon */}
      <mesh position={[-4.5, 0.75, 1.3]} material={paintedGrey} castShadow>
        <boxGeometry args={[0.5, 1.5, 0.35]} />
      </mesh>
      <Beacon position={[-4.5, 1.72, 1.3]} severity={severity} />
    </group>
  );
}
