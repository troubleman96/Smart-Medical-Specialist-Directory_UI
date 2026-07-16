import { apiPost, apiGet, setTokens, clearTokens } from "../api-client";

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  role: "PATIENT" | "HOSPITAL_ADMIN" | "SUPER_ADMIN";
  phone_number: string;
  phone_verified: boolean;
  hospital: number | null;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: ApiUser;
}

export interface LoginPayload {
  phone_number: string;
  password: string;
}

export interface RegisterPatientPayload {
  phone_number: string;
  password: string;
  username?: string;
  email?: string;
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

export async function verifyOtp(code: string): Promise<ApiUser> {
  return apiPost<ApiUser>("/api/auth/verify-otp/", { code });
}

export async function resendOtp(): Promise<void> {
  await apiPost<void>("/api/auth/resend-otp/");
}

export function logout() {
  clearTokens();
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("kindamba_tokens");
}
