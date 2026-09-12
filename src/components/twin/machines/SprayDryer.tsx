import type { Severity } from "../../../types";
import { steel, darkSteel, paintedBlue, paintedGrey } from "../materials";
import { Smoke, Beacon, Flange, Pipe } from "../effects";

// Spray-drying tower: cylindrical chamber on legs, conical hopper, hot-air
// inlet duct, twin cyclones, exhaust stack, access platform with railing.
export default function SprayDryer({ severity }: { severity: Severity }) {
  const R = 1.0;
  const towerH = 3.0;
  const coneH = 1.2;
  const legH = 1.1;
  const baseY = legH + coneH;

  return (
    <group>
      {/* legs */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * R * 0.95, (legH + coneH) / 2, Math.sin(a) * R * 0.95]} material={darkSteel} castShadow>
            <boxGeometry args={[0.16, legH + coneH, 0.16]} />
          </mesh>
        );
      })}

      {/* hopper cone */}
      <mesh position={[0, legH + coneH / 2, 0]} material={steel} castShadow>
        <cylinderGeometry args={[R, 0.22, coneH, 32]} />
      </mesh>
      {/* outlet + rotary valve */}
      <mesh position={[0, legH - 0.2, 0]} material={darkSteel}>
        <cylinderGeometry args={[0.18, 0.18, 0.4, 16]} />
      </mesh>

      {/* main chamber */}
      <mesh position={[0, baseY + towerH / 2, 0]} material={paintedBlue} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, towerH, 40]} />
      </mesh>
      {/* stiffening rings */}
      {[0.3, 0.6, 0.9].map((t, i) => (
        <mesh key={i} position={[0, baseY + towerH * t, 0]} material={darkSteel}>
          <torusGeometry args={[R + 0.02, 0.04, 8, 48]} />
        </mesh>
      ))}
      {/* top dome */}
      <mesh position={[0, baseY + towerH, 0]} material={paintedBlue} castShadow>
        <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* hot-air inlet duct from the burner (comes in low on the side) */}
      <Pipe points={[[-2.2, 0.6, 0.9], [-1.7, 0.6, 0.9], [-1.4, 1.4, 0.7], [-1.2, baseY + towerH * 0.85, 0.3], [-R + 0.05, baseY + towerH * 0.9, 0.1]]} radius={0.2} color="#7d858f" />
      {/* burner box */}
      <mesh position={[-2.6, 0.55, 0.9]} material={paintedGrey} castShadow>
        <boxGeometry args={[0.9, 0.8, 0.7]} />
      </mesh>
      <mesh position={[-2.6, 1.05, 0.9]} material={darkSteel}>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
      </mesh>

      {/* twin cyclones + exhaust */}
      {[0.85, 1.35].map((z, i) => (
        <group key={i} position={[1.55, 0, z]}>
          <mesh position={[0, 2.6, 0]} material={steel} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.1, 24]} />
          </mesh>
          <mesh position={[0, 1.6, 0]} material={steel} castShadow>
            <cylinderGeometry args={[0.3, 0.08, 0.9, 24]} />
          </mesh>
          <Pipe points={[[R - 0.1, baseY + towerH * 0.7, z * 0.3], [0.9, baseY + towerH * 0.7, z * 0.7], [0, 3.15, 0]]} radius={0.11} color="#7d858f" />
        </group>
      ))}
      <Pipe points={[[1.55, 3.15, 1.1], [1.55, 3.6, 1.1], [1.85, 4.0, 1.1], [1.85, 5.8, 1.1]]} radius={0.14} color="#6f7780" />
      <Flange position={[1.85, 4.9, 1.1]} radius={0.22} />
      <Smoke position={[1.85, 5.9, 1.1]} severity={severity} rate={0.8} />

      {/* access platform + railing at chamber mid-height */}
      <mesh position={[0, baseY + 0.4, 0]} material={darkSteel}>
        <cylinderGeometry args={[R + 0.55, R + 0.55, 0.06, 40, 1, false]} />
      </mesh>
      <mesh position={[0, baseY + 0.9, 0]} material={steel}>
        <torusGeometry args={[R + 0.55, 0.03, 6, 48]} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * (R + 0.55), baseY + 0.65, Math.sin(a) * (R + 0.55)]} material={steel}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          </mesh>
        );
      })}
      {/* ladder */}
      <mesh position={[0, (baseY + 0.4) / 2, R + 0.75]} material={steel}>
        <boxGeometry args={[0.36, baseY + 0.4, 0.04]} />
      </mesh>

      <Beacon position={[0, baseY + towerH + R + 0.35, 0]} severity={severity} />
    </group>
  );
}
