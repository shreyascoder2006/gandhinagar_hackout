import { useMemo } from "react";
import * as THREE from "three";
import { darkSteel, steel } from "./materials";

const W = 18; // floor width  (x)
const D = 13; // floor depth  (z)
const H = 5.5; // column height

// Procedural concrete floor with bay lines and yellow walkway markings,
// generated on a canvas so there are no external texture assets to load.
function useFloorTexture() {
  return useMemo(() => {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4a4d54";
    ctx.fillRect(0, 0, size, size);
    // speckle
    for (let i = 0; i < 26000; i++) {
      const v = 60 + Math.random() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v + 6},${Math.random() * 0.35})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
    // bay expansion joints
    ctx.strokeStyle = "rgba(20,22,26,0.7)";
    ctx.lineWidth = 3;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo((size / 6) * i, 0); ctx.lineTo((size / 6) * i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (size / 6) * i); ctx.lineTo(size, (size / 6) * i); ctx.stroke();
    }
    // yellow walkway border
    ctx.strokeStyle = "rgba(217,163,0,0.85)";
    ctx.lineWidth = 8;
    ctx.setLineDash([40, 22]);
    ctx.strokeRect(70, 70, size - 140, size - 140);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

export default function FactoryShell() {
  const floorTex = useFloorTexture();
  const cols: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += W / 3) for (const z of [-D / 2, D / 2]) cols.push([x, z]);

  return (
    <group>
      {/* floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTex} roughness={0.95} metalness={0} />
      </mesh>
      {/* outside apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#2b2e35" roughness={1} />
      </mesh>

      {/* steel columns */}
      {cols.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H / 2, 0]} material={darkSteel} castShadow>
            <boxGeometry args={[0.28, H, 0.28]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={steel}>
            <boxGeometry args={[0.6, 0.12, 0.6]} />
          </mesh>
        </group>
      ))}

      {/* eave beams along the long walls */}
      {[-D / 2, D / 2].map((z, i) => (
        <mesh key={i} position={[0, H, z]} material={darkSteel} castShadow>
          <boxGeometry args={[W, 0.22, 0.22]} />
        </mesh>
      ))}

      {/* roof trusses — open frame so the camera can look in from above */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = -W / 2 + (W / 6) * i;
        return (
          <group key={i} position={[x, H, 0]}>
            <mesh material={darkSteel}>
              <boxGeometry args={[0.12, 0.12, D]} />
            </mesh>
            {/* apex chord */}
            <mesh position={[0, 0.9, 0]} material={darkSteel}>
              <boxGeometry args={[0.1, 0.1, D * 0.85]} />
            </mesh>
            {/* diagonals */}
            {Array.from({ length: 6 }).map((_, j) => {
              const z = -D / 2 + (D / 6) * j + D / 12;
              return (
                <mesh key={j} position={[0, 0.45, z]} rotation={[j % 2 ? 0.55 : -0.55, 0, 0]} material={darkSteel}>
                  <boxGeometry args={[0.06, 1.15, 0.06]} />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* roof-mounted high-bay lamps */}
      {[-6, 0, 6].map((x, i) => (
        <group key={i}>
          <mesh position={[x, H - 0.35, 0]}>
            <cylinderGeometry args={[0.28, 0.4, 0.3, 16]} />
            <meshStandardMaterial color="#e8e2c8" emissive="#ffe9b0" emissiveIntensity={1.6} />
          </mesh>
          <spotLight position={[x, H - 0.4, 0]} angle={0.95} penumbra={0.6} intensity={22} distance={16} color="#ffe6b8" castShadow />
        </group>
      ))}
    </group>
  );
}
