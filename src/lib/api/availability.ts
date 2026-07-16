import { apiPost, apiGet } from "./api-client";

export interface Availability {
  id: number;
  specialist_id: number;
  date: string;
  status: "AVAILABLE" | "BUSY" | "OFF";
}

export interface SetAvailabilityPayload {
  specialist_id: number;
  date: string;
  status: "AVAILABLE" | "BUSY" | "OFF";
}

export interface ScheduleTemplatePayload {
  specialist_id: number;
  schedule: Record<string, "AVAILABLE" | "BUSY" | "OFF">;
}

export async function setAvailability(data: SetAvailabilityPayload): Promise<Availability> {
  return apiPost<Availability>("/api/availability/", data);
}

export async function listAvailability(params?: {
  specialist_id?: number;
  date_from?: string;
  date_to?: string;
}): Promise<Availability[]> {
  const searchParams = new URLSearchParams();
  if (params?.specialist_id) searchParams.set("specialist_id", String(params.specialist_id));
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  const qs = searchParams.toString();
  return apiGet<Availability[]>(`/api/availability/list/${qs ? `?${qs}` : ""}`);
}

export async function applyScheduleTemplate(data: ScheduleTemplatePayload): Promise<{ dates_updated: number }> {
  return apiPost<{ dates_updated: number }>("/api/availability/schedule-template/", data);
}
