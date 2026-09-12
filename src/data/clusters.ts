// Gujarat industrial clusters — centroids from OpenStreetMap industrial-area
// polygons (approximate). Used for the regulator map and symbiosis distances.
export interface Cluster {
  id: string;
  name: string;
  district: string;
  lat: number;
  lon: number;
  dominantSectors: string[];
}

// Kept in sync with data-pipeline/clean/clusters.csv (Phase 1's corrected,
// sourced 9-cluster list — see data-pipeline/sources.md #5). This file used
// to have only the original 6 clusters; 3 real ones (Vatva, Dahej, Alang)
// were added upstream but this static display list was never updated to
// match, so the regulator rollup silently dropped ~36 factories from its
// per-cluster breakdown (they still counted in cohort-wide totals, since
// those sum the full factory list directly — only the cluster-grouped view
// was wrong). Fixed here rather than left as a display gap.
export const clusters: Cluster[] = [
  { id: "morbi", name: "Morbi", district: "Morbi", lat: 22.82, lon: 70.84, dominantSectors: ["Ceramics"] },
  { id: "vapi", name: "Vapi", district: "Valsad", lat: 20.37, lon: 72.9, dominantSectors: ["Chemicals", "Dyes & pigments"] },
  { id: "ankleshwar", name: "Ankleshwar", district: "Bharuch", lat: 21.63, lon: 73.0, dominantSectors: ["Chemicals", "Pharma"] },
  { id: "surat", name: "Surat", district: "Surat", lat: 21.17, lon: 72.83, dominantSectors: ["Textiles"] },
  { id: "rajkot", name: "Rajkot", district: "Rajkot", lat: 22.3, lon: 70.8, dominantSectors: ["Engineering", "Foundry"] },
  { id: "jamnagar", name: "Jamnagar", district: "Jamnagar", lat: 22.47, lon: 70.07, dominantSectors: ["Brass parts", "Petrochemicals"] },
  { id: "vatva", name: "Vatva", district: "Ahmedabad", lat: 22.96, lon: 72.62, dominantSectors: ["Chemicals", "Textiles"] },
  { id: "dahej", name: "Dahej", district: "Bharuch", lat: 21.7, lon: 72.57, dominantSectors: ["Chemicals", "Petrochemicals"] },
  { id: "alang", name: "Alang", district: "Bhavnagar", lat: 21.43, lon: 72.19, dominantSectors: ["Ship recycling", "Metal recovery"] },
];

export const clusterById = Object.fromEntries(clusters.map((c) => [c.id, c])) as Record<string, Cluster>;
