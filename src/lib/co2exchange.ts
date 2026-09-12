import type { Factory } from "../types";
import { haversineKm } from "./symbiosis";

export interface Co2ExchangeDeal {
  id: string;
  providerId: string;
  recipientId: string;
  availableTpy: number;
  requestedTpy: number;
  matchedTpy: number;
  distanceKm: number;
  estimatedValueInr: number;
  useCase: string;
  captureSource: string;
  confidence: "screening";
}

const captureKinds = new Set(["kiln", "boiler", "furnace", "dryer"]);

export function co2Availability(factory: Factory): number {
  // Screening estimate only: capture-ready flue-gas processes × an illustrative 18% capture allocation.
  return Math.round(factory.nodes.filter((n) => captureKinds.has(n.kind)).reduce((total, n) => total + n.co2eTpy, 0) * 0.18);
}

export function co2Demand(factory: Factory): { tonnes: number; useCase: string } {
  if (factory.sector.startsWith("Building materials")) return { tonnes: Math.round(factory.outputTonnesPerMonth * 12 * 0.08), useCase: "mineral curing / carbonated aggregate" };
  if (factory.sector.startsWith("Chemicals")) return { tonnes: Math.round(factory.totalCo2eTpy * 0.09), useCase: "process feedstock / pH control" };
  if (factory.sector.startsWith("Ceramics")) return { tonnes: Math.round(factory.outputTonnesPerMonth * 12 * 0.025), useCase: "kiln atmosphere / process trials" };
  if (factory.sector.startsWith("Engineering")) return { tonnes: Math.round(factory.totalCo2eTpy * 0.04), useCase: "foundry shielding / mineralisation" };
  return { tonnes: Math.round(factory.totalCo2eTpy * 0.035), useCase: "industrial utilisation trial" };
}

export function co2Providers(factories: Factory[]): Factory[] {
  return factories.filter((f) => co2Availability(f) >= 500).sort((a, b) => co2Availability(b) - co2Availability(a));
}

export function co2Deals(provider: Factory, factories: Factory[]): Co2ExchangeDeal[] {
  const available = co2Availability(provider);
  const source = provider.nodes.filter((n) => captureKinds.has(n.kind)).sort((a, b) => b.co2eTpy - a.co2eTpy)[0];
  return factories.filter((recipient) => recipient.id !== provider.id).flatMap((recipient) => {
    const distance = haversineKm(provider.lat, provider.lon, recipient.lat, recipient.lon);
    const demand = co2Demand(recipient);
    if (distance > 90 || demand.tonnes < 100) return [];
    const matched = Math.min(available, demand.tonnes);
    return [{
      id: `${provider.id}→${recipient.id}:co2`, providerId: provider.id, recipientId: recipient.id,
      availableTpy: available, requestedTpy: demand.tonnes, matchedTpy: matched,
      distanceKm: Math.round(distance * 10) / 10,
      estimatedValueInr: matched * 1450,
      useCase: demand.useCase,
      captureSource: source?.label ?? "process flue gas",
      confidence: "screening" as const,
    }];
  }).sort((a, b) => (b.matchedTpy / (1 + b.distanceKm)) - (a.matchedTpy / (1 + a.distanceKm)));
}
