import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import type { ClusterRollup, StateRollup } from "../../lib/rollup";
import { clusterById } from "../../data/clusters";
import type { Factory } from "../../types";

function deviationColor(pct: number): string {
  if (pct < 10) return "#22c55e";
  if (pct < 25) return "#f5a524";
  return "#ef4444";
}

interface Props {
  state: StateRollup;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  factories: Factory[];
  selectedFactoryId: string | null;
  onFactorySelect: (id: string | null) => void;
}

function ClusterFocus({ cluster }: { cluster: ClusterRollup | null }) {
  const map = useMap();
  useEffect(() => {
    if (cluster) map.flyTo([cluster.cluster.lat, cluster.cluster.lon], 12, { duration: 0.85 });
    else map.flyTo([21.9, 71.9], 7, { duration: 0.85 });
  }, [cluster?.cluster.id]);
  return null;
}

function factoryIcon(index: number, color: string) {
  return divIcon({
    className: "factory-marker-wrap",
    iconSize: [44, 56],
    iconAnchor: [22, 52],
    html: `<div class="factory-marker" style="--build-delay:${index * 95}ms;--factory-glow:${color}"><i></i><b></b><em></em></div>`,
  });
}

export default function ClusterMap({ state, selectedId, onSelect, factories, selectedFactoryId, onFactorySelect }: Props) {
  const max = Math.max(...state.clusters.map((c) => c.avoidableCo2eTpy), 1);
  const selectedCluster = state.clusters.find((c) => c.cluster.id === selectedId) ?? null;
  const clusterFactories = selectedCluster ? factories.filter((f) => f.cluster.startsWith(selectedCluster.cluster.name)) : [];

  // symbiosis lines between clusters (only cross-cluster, aggregated)
  const links = new Map<string, number>();
  for (const m of state.matches) {
    const a = state.clusterOf[m.sourceId];
    const b = state.clusterOf[m.targetId];
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    links.set(key, (links.get(key) ?? 0) + 1);
  }

  return (
    <MapContainer center={[21.9, 71.9]} zoom={7} className="h-full w-full" zoomControl={false} attributionControl={false} style={{ background: "#0a0e14" }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClusterFocus cluster={selectedCluster} />

      {[...links.entries()].map(([key, n]) => {
        const [a, b] = key.split("|").map((id) => clusterById[id]);
        return <Polyline key={key} positions={[[a.lat, a.lon], [b.lat, b.lon]]} pathOptions={{ color: "#3ea6ff", weight: 1 + n, opacity: 0.45, dashArray: "6 6" }} />;
      })}

      {state.clusters.map((c: ClusterRollup) => {
        const r = 14 + Math.sqrt(c.avoidableCo2eTpy / max) * 34;
        const color = deviationColor(c.avgDeviationPct);
        const sel = selectedId === c.cluster.id;
        return (
          <CircleMarker
            key={c.cluster.id}
            center={[c.cluster.lat, c.cluster.lon]}
            radius={r}
            pathOptions={{ color: sel ? "#ffffff" : color, weight: sel ? 3 : 1.5, fillColor: color, fillOpacity: sel ? 0.55 : 0.32 }}
            eventHandlers={{ click: () => onSelect(sel ? null : c.cluster.id) }}
          >
            <Tooltip direction="top" offset={[0, -r]} opacity={1} permanent={false}>
              <div style={{ fontSize: 12 }}>
                <b>{c.cluster.name}</b> · {c.factories} units
                <br />
                Avoidable {c.avoidableCo2eTpy.toLocaleString("en-IN")} tCO₂e/yr · +{c.avgDeviationPct}% vs benchmark
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {clusterFactories.map((f, index) => {
        const hotspot = f.nodes.some((n) => n.severity === "crit");
        const color = hotspot ? "#ef4444" : "#3ea6ff";
        const privateName = `Participant factory ${String(index + 1).padStart(2, "0")} (private)`;
        return (
          <Marker
            key={f.id}
            position={[f.lat, f.lon]}
            icon={factoryIcon(index, color)}
            zIndexOffset={selectedFactoryId === f.id ? 500 : index}
            eventHandlers={{ click: () => onFactorySelect(selectedFactoryId === f.id ? null : f.id) }}
          >
            <Tooltip direction="top" offset={[0, -48]} opacity={1}>
              <div style={{ fontSize: 12 }}>
                <b>{f.consentToShare ? f.name : privateName}</b><br />
                {f.totalCo2eTpy.toLocaleString("en-IN")} tCO₂e/yr · {f.nodes.filter((n) => n.severity === "crit").length} hotspots
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
