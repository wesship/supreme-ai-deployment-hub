import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthorizationDetails {
  client?: { name?: string };
  redirect_url?: string;
  redirect_to?: string;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?redirect=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const details = data as unknown as AuthorizationDetails | null;
      const immediate = details?.redirect_url ?? details?.redirect_to;
      if (immediate && !details?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(details);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = (data as unknown as AuthorizationDetails | null)?.redirect_url ??
      (data as unknown as AuthorizationDetails | null)?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070A0F] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-8 shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/55">
          D3VONN.IO
        </p>
        {error ? (
          <>
            <h1 className="mt-3 text-xl font-bold">Connection problem</h1>
            <p className="mt-2 text-sm text-white/70">
              Could not load this authorization request: {error}
            </p>
          </>
        ) : !details ? (
          <>
            <h1 className="mt-3 text-xl font-bold">Loading…</h1>
            <p className="mt-2 text-sm text-white/70">Preparing the connection request.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-xl font-bold">Connect {clientName} to your account</h1>
            <p className="mt-2 text-sm text-white/70">
              This lets {clientName} use D3VONN.IO as you — reading your deployed agents and
              marketplace data under your permissions.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-lg bg-[#7080FF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8290ff] disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
