import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getLocalPreviewUser, isLocalPreviewAuthEnabled, signOutOfLocalPreview } from "@/lib/localAuth";
import type { User } from "@supabase/supabase-js";

let cachedUser: User | null | undefined;
let sessionRequest: Promise<User | null> | null = null;
let authVersion = 0;

const getCurrentUser = () => {
  if (cachedUser !== undefined) return Promise.resolve(cachedUser);
  if (!sessionRequest) {
    const requestVersion = authVersion;
    sessionRequest = supabase.auth.getSession().then(({ data: { session } }) => {
      if (requestVersion === authVersion) cachedUser = session?.user ?? null;
      return cachedUser ?? null;
    }).catch(() => null).finally(() => { sessionRequest = null; });
  }
  return sessionRequest;
};

export function useAuth(redirectIfUnauthenticated = true) {
  const [user, setUser] = useState<User | null>(() => cachedUser ?? null);
  const [loading, setLoading] = useState(() => isSupabaseConfigured && cachedUser === undefined);
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
      const nextUser = session?.user ?? null;
      authVersion += 1;
      cachedUser = nextUser;
      setUser(nextUser);
      setLoading(false);
      if (!nextUser && redirectIfUnauthenticated) {
        navigate("/login");
      }
    });

    getCurrentUser().then((nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (!nextUser && redirectIfUnauthenticated) {
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
      authVersion += 1;
      cachedUser = null;
      await supabase.auth.signOut();
    }
    navigate("/login");
  };

  return { user, loading, signOut };
}
