import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import ProcessNodeMesh from "./ProcessNodeMesh";
import FactoryShell from "./FactoryShell";
import CameraRig from "./CameraRig";
import { Pipe, Flange } from "./effects";
import { useFactoryStore } from "../../store/useFactoryStore";
import { severityColor, severityLabel } from "../../lib/severity";
import type { Factory } from "../../types";

export default function FactoryTwin({ factory }: { factory: Factory }) {
  const selectedNodeId = useFactoryStore((s) => s.selectedNodeId);
  const select = useFactoryStore((s) => s.select);
  const selected = factory.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [15.5, 11.5, 16.5], fov: 36, near: 0.1, far: 120 }}
        onPointerMissed={() => select(null)}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#0a0e14"]} />
        <fog attach="fog" args={["#0a0e14", 22, 46]} />

        <hemisphereLight args={["#b9c7dd", "#1a1d23", 0.55]} />
        <directionalLight
          position={[10, 14, 6]}
          intensity={1.4}
          color="#dfe7f5"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0004}
        />

        <Suspense fallback={null}>
          <Environment preset="warehouse" environmentIntensity={0.35} />
          <FactoryShell />

          {/* inter-unit process piping: slip → dryer → kiln → glaze; effluent to ETP */}
          <Pipe points={[[3.6, 4.6, -2.6], [3.6, 4.6, -3.4], [1.0, 4.6, -3.6], [-1.0, 4.6, -3.6], [-3.4, 4.6, -3.6], [-4.6, 4.6, -3.2], [-4.6, 3.0, -3.2]]} radius={0.13} color="#7d858f" />
          <Flange position={[1.0, 4.6, -3.6]} rotation={[0, 0, Math.PI / 2]} radius={0.2} />
          <Flange position={[-3.4, 4.6, -3.6]} rotation={[0, 0, Math.PI / 2]} radius={0.2} />
          <Pipe points={[[6.4, 1.2, 2.6], [6.9, 1.2, 2.6], [6.9, 3.6, 2.6], [6.9, 3.6, -2.2], [6.2, 3.6, -2.6]]} radius={0.06} color="#9fb3c8" />
          <Pipe points={[[-4.2, 0.15, 1.4], [-5.2, 0.15, 1.6], [-5.8, 0.15, 2.2]]} radius={0.07} color="#6b7f75" />

          {factory.nodes.map((node) => (
            <ProcessNodeMesh
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              anySelected={selectedNodeId !== null}
              onSelect={select}
            />
          ))}

          <EffectComposer multisampling={4}>
            <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={0.75} />
          </EffectComposer>
        </Suspense>

        <CameraRig selected={selected} />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)]/80 px-3 py-2 text-xs text-[color:var(--color-muted)] backdrop-blur">
          Schematic twin · sector-typical layout, not CAD
        </div>
        <div className="flex gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)]/80 px-3 py-1.5 text-[11px] backdrop-blur">
          {(["crit", "warn", "ok"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[color:var(--color-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: severityColor[s], boxShadow: `0 0 6px ${severityColor[s]}` }} />
              {severityLabel[s]}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <div className="absolute right-4 top-4 flex items-center gap-3">
          <div className="rounded-lg border px-3 py-1.5 text-xs backdrop-blur" style={{ borderColor: severityColor[selected.severity], background: "rgba(16,21,31,0.85)" }}>
            Inspecting <span className="font-semibold">{selected.label}</span>
          </div>
          <button
            onClick={() => select(null)}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)]/90 px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] backdrop-blur hover:bg-[color:var(--color-panel-2)]"
          >
            ← Overview
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-panel)]/70 px-3 py-1 text-[10px] text-[color:var(--color-muted)] backdrop-blur">
        Drag to orbit · scroll to zoom · click a unit to inspect
      </div>
    </div>
  );
}
