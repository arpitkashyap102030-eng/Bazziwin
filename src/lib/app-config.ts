import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppConfig = {
  latest_version: string;
  apk_url: string;
  release_notes: string | null;
  force_update: boolean;
  upi_id: string;
  upi_payee_name: string;
};

/** Returns > 0 when `a` is newer than `b`. Tolerates missing/short segments. */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Never throws — on any network/db failure it resolves to null so the app opens normally. */
export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<AppConfig | null> => {
      try {
        const { data, error } = await (supabase as any)
          .from("app_config")
          .select("latest_version, apk_url, release_notes, force_update, upi_id, upi_payee_name")
          .eq("id", 1)
          .maybeSingle();
        if (error) return null;
        return (data as AppConfig | null) ?? null;
      } catch {
        return null;
      }
    },
  });
}
