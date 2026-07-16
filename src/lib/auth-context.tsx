import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMe, logout, isLoggedIn, type ApiUser } from "@/lib/api/auth";

export type AppRole = "patient" | "hospital_admin" | "super_admin";

const ROLE_MAP: Record<string, AppRole> = {
  PATIENT: "patient",
  HOSPITAL_ADMIN: "hospital_admin",
  SUPER_ADMIN: "super_admin",
};

interface AuthState {
  user: ApiUser | null;
  roles: AppRole[];
  hospitalId: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!isLoggedIn()) {
      setUser(null);
      setRoles([]);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      setRoles([ROLE_MAP[me.role] ?? "patient"]);
    } catch {
      setUser(null);
      setRoles([]);
      logout();
    }
  }, []);

  useEffect(() => {
    loadUser().finally(() => setLoading(false));
  }, [loadUser]);

  const refresh = async () => { await loadUser(); };

  const signOut = () => {
    logout();
    setUser(null);
    setRoles([]);
    window.location.href = "/";
  };

  return (
    <Ctx.Provider value={{
      user,
      roles,
      hospitalId: user?.hospital ?? null,
      loading,
      refresh,
      signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
