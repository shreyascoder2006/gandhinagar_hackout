// Typed fetch client for the Induscope backend (backend/app/main.py).
// See backend/README.md for the endpoint list — every field returned here
// traces to a real computation (app/engine + app/intelligence over
// data-pipeline output), not a mock.

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8811";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(`POST ${path} failed: ${res.status} ${detail?.detail ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ApiCluster {
  id: string;
  name: string;
  district: string;
  lat: number;
  lon: number;
  dominant_sectors: string;
  source: string;
  confidence: string;
  factory_count: number;
  open_anomaly_count: number;
}

export interface ApiRecommendation {
  id: string;
  equipment_id: string;
  intervention_key: string;
  title: string;
  category: string;
  capex_inr: number;
  annual_saving_inr: number;
  co2_reduction_tpy: number;
  payback_months: number;
  confidence: "high" | "medium" | "low";
  description: string;
  circularity_gain_pct: number | null;
  rank: number;
}

export interface ApiEquipment {
  id: string;
  process_id: string;
  label: string;
  kind: string;
  share_of_energy: number;
  benchmark_kgco2e_per_t: number;
  benchmark_source: string;
  benchmark_confidence: string;
  co2e_tpy: number | null;
  share_of_total: number | null;
  actual_intensity: number | null;
  severity: "ok" | "warn" | "crit" | null;
  root_cause_text: string | null;
  recommendations: ApiRecommendation[];
}

export interface ApiFactory {
  id: string;
  name: string;
  cluster_id: string;
  sector: string;
  district: string;
  lat: number;
  lon: number;
  data_source: string;
  consent_to_share: boolean;
  output_tonnes_per_year: number | null;
  total_co2e_tpy: number;
  total_energy_mwh_per_year: number;
  total_waste_tpy: number;
  circularity_ratio: number;
  equipment: ApiEquipment[];
}

export interface ApiAnomaly {
  id: number;
  equipment_id: string;
  month: string;
  co2e_t: number;
  z_score: number;
  status: string;
}

export const api = {
  clusters: () => getJson<ApiCluster[]>("/api/clusters"),
  factories: () => getJson<ApiFactory[]>("/api/factories"),
  factory: (id: string) => getJson<ApiFactory>(`/api/factories/${id}`),
  anomalies: (factoryId: string) => getJson<ApiAnomaly[]>(`/api/factories/${factoryId}/anomalies`),
  onboardFactory: (payload: unknown) => postJson<{ id: string; total_co2e_t: number; anomaly_check_status: string }>("/api/factories", payload),
};
