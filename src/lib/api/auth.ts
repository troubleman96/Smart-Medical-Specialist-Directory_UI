import { apiPost, apiGet, setTokens, clearTokens } from "./api-client";

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  role: "PATIENT" | "HOSPITAL_ADMIN" | "SUPER_ADMIN";
  phone_number: string;
  hospital: number | null;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: ApiUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPatientPayload {
  username: string;
  email?: string;
  password: string;
  phone_number?: string;
}

export async function loginUser(payload: LoginPayload): Promise<AuthTokens> {
  const data = await apiPost<AuthTokens>("/api/auth/login/", payload);
  setTokens({ access: data.access, refresh: data.refresh });
  return data;
}

export async function registerPatient(payload: RegisterPatientPayload): Promise<AuthTokens> {
  const data = await apiPost<AuthTokens>("/api/auth/register/patient/", payload);
  setTokens({ access: data.access, refresh: data.refresh });
  return data;
}

export async function getMe(): Promise<ApiUser> {
  return apiGet<ApiUser>("/api/auth/me/");
}

export function logout() {
  clearTokens();
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("kindamba_tokens");
}
