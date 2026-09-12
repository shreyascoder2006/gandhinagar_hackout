import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Role = "sme" | "consultant" | "regulator";

interface RoleState {
  role: Role;
  organizationId: string | null;
  tier: "free" | "pro"; // mirrors the organization's real backend tier once known
  setRole: (role: Role) => void;
  setOrganizationId: (id: string | null) => void;
  setTier: (tier: "free" | "pro") => void;
}

// No real auth — a demo role switch (SME / Consultant / Regulator) that
// gates which nav items/features are visible, plus a tier the freemium
// "Pro" gate checks. Persisted so a refresh doesn't drop the demo persona.
export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: "consultant",
      organizationId: "demo-consultancy",
      tier: "free",
      setRole: (role) => set({ role }),
      setOrganizationId: (organizationId) => set({ organizationId }),
      setTier: (tier) => set({ tier }),
    }),
    { name: "induscope-role-store", storage: createJSONStorage(() => localStorage) }
  )
);
