import { apiGet } from "./api-client";

export interface OverviewReport {
  hospitals: {
    total: number;
    pending: number;
    verified: number;
    suspended: number;
  };
  specialists: {
    total: number;
    active: number;
  };
  appointments: {
    total: number;
    requested: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  total_searches: number;
  top_specializations: Array<{ specialization: string; count: number }>;
}

export interface SearchReport {
  total_searches: number;
  top_searched_specializations: Array<{ specialization: string; count: number }>;
  recent_searches: Array<{
    latitude: number;
    longitude: number;
    specialization: string;
    results_count: number;
    created_at: string;
  }>;
}

export async function getOverviewReport(): Promise<OverviewReport> {
  return apiGet<OverviewReport>("/api/reports/overview/");
}

export async function getSearchReport(): Promise<SearchReport> {
  return apiGet<SearchReport>("/api/reports/searches/");
}
