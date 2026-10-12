import { api } from "~/utils/api";

/** Whether the current user is an NSPV admin (CORAGGIO_ADMIN_EMAILS). */
export function useIsNspvAdmin() {
  const { data } = api.coraggio.admin.me.useQuery(undefined, {
    staleTime: Infinity,
  });
  return data?.isAdmin ?? false;
}
