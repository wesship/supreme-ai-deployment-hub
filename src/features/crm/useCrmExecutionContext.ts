import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CrmExecutionContext {
  workspaceId: string;
  actorId: string;
  authenticated: boolean;
  loading: boolean;
}

const DEFAULT_WORKSPACE_ID =
  import.meta.env.VITE_PRIMETIME_DEFAULT_WORKSPACE_ID?.trim() || "d3vonn-main";

export function useCrmExecutionContext(): CrmExecutionContext {
  const [actorId, setActorId] = useState("development-user");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = (userId: string | undefined) => {
      if (!active) return;
      setActorId(userId || "development-user");
      setAuthenticated(Boolean(userId));
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      applySession(data.session?.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user.id);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    workspaceId: DEFAULT_WORKSPACE_ID,
    actorId,
    authenticated,
    loading,
  };
}
