import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

// This is deliberately limited to a local Vite development preview. It is not
// a production authentication path and never grants access to Supabase data.
export const LOCAL_PREVIEW_EMAIL = "test@gmail.com";
const LOCAL_PREVIEW_PASSWORD = "test1";
const LOCAL_PREVIEW_SESSION_KEY = "flowledger.local.preview.session";
const LOCAL_PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000001";

export const isLocalPreviewAuthEnabled = import.meta.env.DEV && !isSupabaseConfigured;

const localPreviewUser = (): User => ({
  id: LOCAL_PREVIEW_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: LOCAL_PREVIEW_EMAIL,
  email_confirmed_at: new Date(0).toISOString(),
  phone: "",
  confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "local-preview", providers: ["local-preview"] },
  user_metadata: { local_preview: true },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
});

export const getLocalPreviewUser = (): User | null => {
  if (!isLocalPreviewAuthEnabled || typeof window === "undefined") return null;
  return window.localStorage.getItem(LOCAL_PREVIEW_SESSION_KEY) === "signed-in" ? localPreviewUser() : null;
};

export const signInToLocalPreview = (email: string, password: string) => {
  if (!isLocalPreviewAuthEnabled || email.trim().toLowerCase() !== LOCAL_PREVIEW_EMAIL || password !== LOCAL_PREVIEW_PASSWORD) {
    return false;
  }
  window.localStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, "signed-in");
  return true;
};

export const enterLocalPreview = () => {
  if (!isLocalPreviewAuthEnabled || typeof window === "undefined") return false;
  window.localStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, "signed-in");
  return true;
};

export const signOutOfLocalPreview = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
};
