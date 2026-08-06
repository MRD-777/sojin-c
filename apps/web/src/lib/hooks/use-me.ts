"use client";
// ============================================
// useMe — the first React Query consumer (Session S2)
//
// GET /users/me through the GENERIC client (not auth-client): the client's
// interceptors give us Bearer-attach + silent refresh-on-401. This is exactly
// what makes a hard reload recoverable — when the in-memory token is gone but
// the httpOnly refresh cookie is still valid, the first 401 triggers a silent
// refresh inside the interceptor, so useMe resolves and the session is restored
// without kicking the user out.
//
// retry:false — the interceptor already owns refresh + a single retry on 401.
// A second React Query retry would add nothing but latency before the guard's
// redirect, so we opt out of RQ's default retry here.
// ============================================
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http-shared";
import { useAuthStore, type AuthUser } from "@/store/use-auth-store";

/** Stable key so callers can invalidate/read the cached session identity. */
export const ME_QUERY_KEY = ["me"] as const;

export function useMe() {
  const setSession = useAuthStore((s) => s.setSession);

  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<AuthUser> => {
      const res = await client.get("/users/me");
      return unwrap<AuthUser>(res.data);
    },
    retry: false,
  });

  // DP2 — hydrate the store on success so store.user stays the single UI
  // source of truth. React Query v5 removed useQuery's onSuccess callback, so
  // we mirror data → store via an effect that runs only when the identity
  // changes. The access token is already in the store (login/refresh set it);
  // we read it at commit time via getState so this effect never depends on it.
  const user = query.data;
  useEffect(() => {
    if (!user) return;
    const token = useAuthStore.getState().accessToken;
    if (token) setSession({ accessToken: token, user });
  }, [user, setSession]);

  return query;
}
