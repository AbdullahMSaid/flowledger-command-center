import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getLocalPreviewUser, isLocalPreviewAuthEnabled, signOutOfLocalPreview } from "@/lib/localAuth";
import type { User } from "@supabase/supabase-js";

export function useAuth(redirectIfUnauthenticated = true) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLocalPreviewAuthEnabled) {
      setUser(getLocalPreviewUser());
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user && redirectIfUnauthenticated) {
        navigate("/login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user && redirectIfUnauthenticated) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectIfUnauthenticated]);

  const signOut = async () => {
    if (isLocalPreviewAuthEnabled) {
      signOutOfLocalPreview();
      setUser(null);
      navigate("/login");
      return;
    }
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    navigate("/login");
  };

  return { user, loading, signOut };
}
