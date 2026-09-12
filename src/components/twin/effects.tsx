import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Severity } from "../../types";
import { severityColor } from "../../lib/severity";
import { pipeMaterial } from "./materials";

/** Rising smoke particles from a stack. Density scales with severity. */
export function Smoke({ position, severity, rate = 1 }: { position: [number, number, number]; severity: Severity; rate?: number }) {
  const count = severity === "crit" ? 160 : severity === "warn" ? 90 : 40;
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      life[i] = Math.random();
      vel[i * 3] = (Math.random() - 0.5) * 0.15;
      vel[i * 3 + 1] = 0.35 + Math.random() * 0.35;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    return { pos, life, vel };
  }, [count]);

  useFrame((_, dt) => {
    const p = data.pos;
    for (let i = 0; i < count; i++) {
      data.life[i] += dt * 0.28 * rate;
      if (data.life[i] > 1) {
        data.life[i] = 0;
        p[i * 3] = (Math.random() - 0.5) * 0.12;
        p[i * 3 + 1] = 0;
        p[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      }
      const t = data.life[i];
      p[i * 3] += (data.vel[i * 3] + 0.12) * dt * (1 + t * 2);
      p[i * 3 + 1] += data.vel[i * 3 + 1] * dt * 2.2;
      p[i * 3 + 2] += data.vel[i * 3 + 2] * dt;
    }
    if (ref.current) ref.current.geometry.attributes.position.needsUpdate = true;
  });

  const color = severity === "crit" ? "#7a7a7a" : "#9a9a9a";
  return (
    <points key={count} ref={ref} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.42} transparent opacity={0.28} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Ground status ring + status beacon lamp shown on every machine. */
export function StatusRing({ radius, severity, selected }: { radius: number; severity: Severity; selected: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const color = severityColor[severity];
  useFrame((s) => {
    if (!ref.current) return;
    const pulse = severity === "crit" ? (Math.sin(s.clock.elapsedTime * 3.2) + 1) / 2 : severity === "warn" ? (Math.sin(s.clock.elapsedTime * 1.6) + 1) / 2 : 0.2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = (selected ? 0.55 : 0.28) + pulse * 0.3;
  });
  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius * 0.92, radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[radius * 0.92, 48]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.16 : 0.07} />
      </mesh>
    </group>
  );
}

export function Beacon({ position, severity }: { position: [number, number, number]; severity: Severity }) {
  const ref = useRef<THREE.Mesh>(null);
  const color = severityColor[severity];
  useFrame((s) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    const t = severity === "ok" ? 1 : (Math.sin(s.clock.elapsedTime * (severity === "crit" ? 6 : 3)) + 1) / 2;
    m.emissiveIntensity = 1.2 + t * 3.5;
  });
  return (
    <group position={position}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />
        <meshStandardMaterial color="#2a2e36" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <pointLight color={color} intensity={severity === "ok" ? 0.6 : 2.2} distance={3.5} decay={2} />
    </group>
  );
}

/** Pipe run along a set of waypoints. */
export function Pipe({ points, radius = 0.09, color }: { points: [number, number, number][]; radius?: number; color?: string }) {
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05);
    return new THREE.TubeGeometry(curve, Math.max(16, points.length * 12), radius, 10, false);
  }, [points, radius]);
  const mat = useMemo(() => pipeMaterial(color), [color]);
  return <mesh geometry={geom} material={mat} castShadow />;
}

/** Simple flange rings so pipes look assembled, not extruded. */
export function Flange({ position, rotation = [0, 0, 0], radius = 0.14 }: { position: [number, number, number]; rotation?: [number, number, number]; radius?: number }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius, radius, 0.06, 16]} />
      <meshStandardMaterial color="#6e7680" metalness={0.8} roughness={0.4} />
    </mesh>
  );
}
