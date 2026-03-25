import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth(redirectIfUnauthenticated = true) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
    await supabase.auth.signOut();
    navigate("/login");
  };

  return { user, loading, signOut };
}
