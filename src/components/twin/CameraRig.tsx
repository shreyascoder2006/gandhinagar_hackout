import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import type { ProcessNode } from "../../types";

const OVERVIEW = { pos: [15.5, 11.5, 16.5] as const, target: [0, 0.8, 0] as const };

/**
 * Flies the camera to the selected machine (and back to overview on deselect).
 * Idle overview slowly orbits; any user drag pauses the orbit for a few seconds.
 */
export default function CameraRig({ selected }: { selected: ProcessNode | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  const idleUntil = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (selected) {
      const [x, , z] = selected.position;
      const [w, h, d] = selected.scale;
      // frame the whole footprint; stay under the eave line so trusses don't cut the view
      const dist = Math.max(w, d) * 1.35 + h * 0.9 + 3.4;
      // approach from outside the shed looking inward, so neighbouring units
      // sit behind the target instead of between it and the camera
      const len = Math.hypot(x, z) || 1;
      const dir = { x: (x / len) * 0.95, y: 0.32, z: (z / len) * 0.95 };
      c.setLookAt(x + dir.x * dist, Math.min(h * 0.5 + dir.y * dist, 5.0), z + dir.z * dist, x, h * 0.5, z, true);
    } else {
      c.setLookAt(...OVERVIEW.pos, ...OVERVIEW.target, true);
    }
  }, [selected]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const onStart = () => (idleUntil.current = performance.now() + 4000);
    c.addEventListener("controlstart", onStart);
    return () => c.removeEventListener("controlstart", onStart);
  }, []);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c || selected) return;
    if (performance.now() < idleUntil.current) return;
    c.azimuthAngle += dt * 0.06;
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={3}
      maxDistance={34}
      maxPolarAngle={Math.PI / 2.05}
      smoothTime={0.6}
      dollySpeed={0.6}
    />
  );
}
