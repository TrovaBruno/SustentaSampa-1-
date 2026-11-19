export type Place = { label: string; lat: number; lng: number };

/** Busca bairros/ruas/cidades no Brasil (Nominatim/OSM). Chamar só ao enviar a busca (limite de 1 req/s). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("geocode failed");
  const arr = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return arr.map((r) => ({
    label: r.display_name.split(",").slice(0, 3).join(",").trim(),
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
