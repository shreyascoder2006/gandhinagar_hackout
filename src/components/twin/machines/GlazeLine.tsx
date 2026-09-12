import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../../types";
import { steel, darkSteel, paintedGrey, rubber, glassy } from "../materials";
import { Beacon } from "../effects";

// Glazing line: roller conveyor with animated tiles, engobe/glaze bell
// booths, a digital-print cabin, and a waste-glaze collection tray.
export default function GlazeLine({ severity }: { severity: Severity }) {
  const L = 7;
  const tiles = useRef<THREE.InstancedMesh>(null);
  const N = 14;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: N }, (_, i) => (i / N) * L), []);

  useFrame((_, dt) => {
    if (!tiles.current) return;
    for (let i = 0; i < N; i++) {
      offsets[i] = (offsets[i] + dt * 0.9) % L;
      dummy.position.set(-L / 2 + offsets[i], 0.83, 0);
      dummy.updateMatrix();
      tiles.current.setMatrixAt(i, dummy.matrix);
    }
    tiles.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* conveyor frame + rollers */}
      {[-0.55, 0.55].map((z, i) => (
        <mesh key={i} position={[0, 0.72, z]} material={darkSteel} castShadow>
          <boxGeometry args={[L, 0.14, 0.08]} />
        </mesh>
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-L / 2 + 0.3 + (i * (L - 0.6)) / 8, 0.35, 0]} material={darkSteel}>
          <boxGeometry args={[0.1, 0.7, 1.1]} />
        </mesh>
      ))}
      {Array.from({ length: 34 }).map((_, i) => (
        <mesh key={i} position={[-L / 2 + 0.1 + (i * (L - 0.2)) / 33, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]} material={rubber}>
          <cylinderGeometry args={[0.035, 0.035, 1.05, 8]} />
        </mesh>
      ))}

      {/* moving tiles */}
      <instancedMesh ref={tiles} args={[undefined, undefined, N]} castShadow>
        <boxGeometry args={[0.42, 0.03, 0.42]} />
        <meshStandardMaterial color="#d8cfc0" roughness={0.6} />
      </instancedMesh>

      {/* glaze bell booths */}
      {[-2.2, -0.6].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 1.35, 0]} material={paintedGrey} castShadow>
            <boxGeometry args={[0.9, 1.2, 1.5]} />
          </mesh>
          <mesh position={[0, 0.9, 0]} material={glassy}>
            <boxGeometry args={[0.7, 0.35, 1.52]} />
          </mesh>
          {/* bell applicator + supply pipe */}
          <mesh position={[0, 1.15, 0]} material={steel}>
            <cylinderGeometry args={[0.28, 0.06, 0.28, 24]} />
          </mesh>
          <mesh position={[0, 2.15, 0]} material={steel}>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
          </mesh>
          <mesh position={[0, 2.45, 0]} material={steel}>
            <cylinderGeometry args={[0.32, 0.32, 0.36, 20]} />
          </mesh>
        </group>
      ))}

      {/* digital print cabin */}
      <mesh position={[1.4, 1.4, 0]} material={paintedGrey} castShadow>
        <boxGeometry args={[1.5, 1.3, 1.6]} />
      </mesh>
      <mesh position={[1.4, 1.5, 0.81]}>
        <boxGeometry args={[0.5, 0.3, 0.01]} />
        <meshStandardMaterial color="#0b1f2e" emissive="#3ea6ff" emissiveIntensity={1.1} />
      </mesh>

      {/* glaze overspray collection tray (the recycling-loop opportunity) */}
      <mesh position={[-1.4, 0.16, 0]} material={steel}>
        <boxGeometry args={[2.6, 0.12, 1.3]} />
      </mesh>
      <mesh position={[-1.4, 0.23, 0]}>
        <boxGeometry args={[2.4, 0.02, 1.1]} />
        <meshStandardMaterial color="#b9c7b0" roughness={0.3} />
      </mesh>

      <Beacon position={[2.9, 1.25, 0.7]} severity={severity} />
    </group>
  );
}
