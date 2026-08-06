"use client";
// ============================================
// useClients — CLIENT users for the Create-project selector (S3)
//
// Feeds the client dropdown that supplies the required clientId on
// CreateProjectInput. staleTime is generous (the client roster changes rarely
// relative to a form session) so opening the Create form repeatedly doesn't
// refetch. retry:false — interceptor owns 401→refresh, same as the others.
// ============================================
import { useQuery } from "@tanstack/react-query";
import { listClients } from "@/lib/api/users-client";

export const CLIENTS_QUERY_KEY = ["clients"] as const;

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: listClients,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
