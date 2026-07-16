import { apiPost, apiGet, apiPatch } from "../api-client";

export interface Appointment {
  id: number;
  patient: number;
  specialist: number;
  hospital: number;
  reference_number: string;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  scheduled_at: string;
  created_at: string;
  updated_at: string;
  specialist_detail?: {
    id: number;
    full_name: string;
    specialization: string;
  };
  hospital_detail?: {
    id: number;
    name: string;
    address: string;
    phone: string;
  };
}

export interface CreateAppointmentPayload {
  specialist_id: number;
  hospital_id: number;
  scheduled_at: string;
}

export async function createAppointment(data: CreateAppointmentPayload): Promise<Appointment> {
  return apiPost<Appointment>("/api/appointments/", data);
}

export async function getMyAppointments(): Promise<Appointment[]> {
  return apiGet<Appointment[]>("/api/appointments/mine/");
}

export async function getHospitalAppointments(): Promise<Appointment[]> {
  return apiGet<Appointment[]>("/api/appointments/hospital/");
}

export async function updateAppointmentStatus(
  id: number,
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED",
): Promise<Appointment> {
  return apiPatch<Appointment>(`/api/appointments/${id}/status/`, { status });
}
