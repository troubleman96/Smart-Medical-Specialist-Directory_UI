import { apiGet } from "./api-client";

export interface NearbyResult {
  hospital_id: number;
  hospital_name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  specialists: Array<{
    id: number;
    full_name: string;
    specialization: string;
    availability: string;
  }>;
}

export async function searchNearby(params: {
  lat: number;
  lng: number;
  specialization?: string;
  radius?: number;
}): Promise<NearbyResult[]> {
  const searchParams = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
  });
  if (params.specialization) searchParams.set("specialization", params.specialization);
  if (params.radius) searchParams.set("radius", String(params.radius));

  const token = localStorage.getItem("kindamba_tokens");
  const headers: Record<string, string> = {};
  if (token) {
    const parsed = JSON.parse(token);
    headers["Authorization"] = `Bearer ${parsed.access}`;
  }

  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/search/nearby/?${searchParams}`,
    { headers },
  );
  const body = await res.json();
  if (!body.success) throw new Error(body.message || "Search failed");
  return body.data;
}
