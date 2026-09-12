import type { Severity, Confidence } from "../types";

export const severityColor: Record<Severity, string> = {
  ok: "#22c55e",
  warn: "#f5a524",
  crit: "#ef4444",
};

export const severityLabel: Record<Severity, string> = {
  ok: "On benchmark",
  warn: "Elevated",
  crit: "Hotspot",
};

export const confidenceLabel: Record<Confidence, string> = {
  high: "High confidence (85–98%)",
  medium: "Medium confidence (65–84%)",
  low: "Low confidence — modelled (45–64%)",
};

export function formatInr(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatTonnes(n: number): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} t`;
}

export function pctVsBenchmark(actual: number, benchmark: number): number {
  return Math.round(((actual - benchmark) / benchmark) * 100);
}
