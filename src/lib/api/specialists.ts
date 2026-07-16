import { apiPost, apiGet, apiPatch, apiDelete } from "./api-client";

export interface Specialist {
  id: number;
  hospital: number;
  full_name: string;
  specialization: string;
  license_no: string;
  photo: string | null;
  is_active: boolean;
  created_by: number | null;
}

export interface CreateSpecialistPayload {
  full_name: string;
  specialization: string;
  license_no: string;
  photo?: File;
}

export interface UpdateSpecialistPayload {
  full_name?: string;
  specialization?: string;
  license_no?: string;
  is_active?: boolean;
}

export async function createSpecialist(data: CreateSpecialistPayload): Promise<Specialist> {
  return apiPost<Specialist>("/api/specialists/", data);
}

export async function updateSpecialist(id: number, data: UpdateSpecialistPayload): Promise<Specialist> {
  return apiPatch<Specialist>(`/api/specialists/${id}/`, data);
}

export async function deleteSpecialist(id: number): Promise<void> {
  return apiDelete<void>(`/api/specialists/${id}/delete/`);
}

export async function getHospitalSpecialists(): Promise<Specialist[]> {
  return apiGet<Specialist[]>("/api/specialists/mine/");
}

export async function getPublicSpecialist(id: number): Promise<Specialist & { hospital: { id: number; name: string; address: string; phone: string; latitude: number; longitude: number } }> {
  return apiGet(`/api/specialists/public/${id}/`);
}
