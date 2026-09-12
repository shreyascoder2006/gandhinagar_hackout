import { useEffect, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ProcessNode } from "../../types";
import { severityColor } from "../../lib/severity";
import { StatusRing } from "./effects";
import Kiln from "./machines/Kiln";
import SprayDryer from "./machines/SprayDryer";
import CompressorHouse from "./machines/CompressorHouse";
import GlazeLine from "./machines/GlazeLine";
import EffluentPlant from "./machines/EffluentPlant";
import Boiler from "./machines/Boiler";

interface Props {
  node: ProcessNode;
  isSelected: boolean;
  anySelected: boolean;
  onSelect: (id: string) => void;
}

function Machine({ node }: { node: ProcessNode }) {
  switch (node.kind) {
    case "kiln":
      return <Kiln severity={node.severity} />;
    case "dryer":
      return <SprayDryer severity={node.severity} />;
    case "compressor":
      return <CompressorHouse severity={node.severity} />;
    case "effluent":
      return <EffluentPlant severity={node.severity} />;
    case "boiler":
      return <Boiler severity={node.severity} />;
    case "furnace":
      return <Kiln severity={node.severity} />;
    default:
      return <GlazeLine severity={node.severity} />;
  }
}

export default function ProcessNodeMesh({ node, isSelected, anySelected, onSelect }: Props) {
  const group = useRef<THREE.Group>(null);
  const color = severityColor[node.severity];
  const [w, h, d] = node.scale;
  const dimmed = anySelected && !isSelected;

  // Fade non-selected machines when inspecting one, so the focus reads clearly.
  useEffect(() => {
    if (!group.current) return;
    group.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      for (const mat of mats) {
        if (mat instanceof THREE.PointsMaterial) continue; // keep smoke as-is
        const isGlass = mat instanceof THREE.MeshPhysicalMaterial;
        if (!isGlass) mat.transparent = dimmed;
        mat.opacity = dimmed ? 0.28 : isGlass ? 0.7 : 1;
        mat.needsUpdate = true;
      }
    });
  }, [dimmed]);

  return (
    <group position={[node.position[0], 0, node.position[2]]}>
      {/* invisible pick volume so the whole machine is clickable */}
      <mesh
        position={[0, h / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <boxGeometry args={[w + 0.4, h + 0.4, d + 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={group}>
        <Machine node={node} />
      </group>

      <StatusRing radius={Math.max(w, d) * 0.62} severity={node.severity} selected={isSelected} />

      {!anySelected && (
      <Html position={[0, h + 0.9, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <div
          onClick={() => onSelect(node.id)}
          className="cursor-pointer select-none whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium backdrop-blur-sm transition-opacity"
          style={{
            borderColor: color,
            color: "#e6ebf5",
            background: "rgba(10,14,20,0.8)",
            boxShadow: isSelected ? `0 0 14px ${color}` : "none",
            opacity: dimmed ? 0.35 : 1,
          }}
        >
          {node.label} · {Math.round(node.shareOfTotal * 100)}%
        </div>
      </Html>
      )}
    </group>
  );
}
