import * as THREE from "three";

// Shared PBR materials so every machine reads as the same steel/paint family.
export const steel = new THREE.MeshStandardMaterial({ color: "#8a9099", metalness: 0.85, roughness: 0.35 });
export const darkSteel = new THREE.MeshStandardMaterial({ color: "#3a404a", metalness: 0.8, roughness: 0.45 });
export const paintedGrey = new THREE.MeshStandardMaterial({ color: "#5c6470", metalness: 0.3, roughness: 0.7 });
export const paintedBlue = new THREE.MeshStandardMaterial({ color: "#2d5a8c", metalness: 0.25, roughness: 0.6 });
export const refractory = new THREE.MeshStandardMaterial({ color: "#7a6a5a", metalness: 0.05, roughness: 0.95 });
export const safetyYellow = new THREE.MeshStandardMaterial({ color: "#d9a300", metalness: 0.2, roughness: 0.6 });
export const concrete = new THREE.MeshStandardMaterial({ color: "#5e6066", metalness: 0.0, roughness: 0.95 });
export const rubber = new THREE.MeshStandardMaterial({ color: "#1f2227", metalness: 0.0, roughness: 0.9 });
export const glassy = new THREE.MeshPhysicalMaterial({
  color: "#9fc4e8",
  metalness: 0,
  roughness: 0.1,
  transmission: 0.6,
  transparent: true,
  opacity: 0.7,
});
export const water = new THREE.MeshStandardMaterial({
  color: "#1f5f7a",
  emissive: "#0f3d52",
  emissiveIntensity: 0.4,
  metalness: 0.1,
  roughness: 0.15,
  transparent: true,
  opacity: 0.85,
});

export function pipeMaterial(color = "#9aa3ad") {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.4 });
}
