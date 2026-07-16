import { apiPost, apiGet, apiPatch, apiGetPaginated } from "../api-client";

export interface Hospital {
  id: number;
  name: string;
  registration_no: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  email: string;
  status: "PENDING" | "VERIFIED" | "SUSPENDED";
  created_at: string;
  updated_at: string;
}

export interface RegisterHospitalPayload {
  name: string;
  registration_no?: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  email?: string;
  admin_phone_number: string;
  admin_password: string;
  admin_username?: string;
  admin_email?: string;
}

export async function registerHospital(payload: RegisterHospitalPayload): Promise<Hospital> {
  return apiPost<Hospital>("/api/hospitals/register/", payload);
}

export async function getMyHospital(): Promise<Hospital> {
  return apiGet<Hospital>("/api/hospitals/me/");
}

export async function updateMyHospital(data: Partial<Hospital>): Promise<Hospital> {
  return apiPatch<Hospital>("/api/hospitals/me/", data);
}

export async function verifyHospital(
  id: number,
  status: "VERIFIED" | "SUSPENDED",
): Promise<Hospital> {
  return apiPatch<Hospital>(`/api/hospitals/${id}/verify/`, { status });
}

export async function listHospitals(): Promise<Hospital[]> {
  const result = await apiGetPaginated<Hospital>("/api/hospitals/");
  return result.items;
}
