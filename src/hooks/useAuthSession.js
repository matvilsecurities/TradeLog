import { useEffect, useState } from "react";
import { getSession, supabase } from "../supabase.js";

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getSession()
      .then((nextSession) => {
        if (mounted) setSession(nextSession);
      })
      .catch((error) => {
        console.error("Failed to restore Supabase session:", error);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    if (!supabase) return () => { mounted = false; };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, authLoading };
}
