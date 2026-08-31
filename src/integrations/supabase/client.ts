import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copie .env.example para .env e preencha.",
  );
}

// Cliente único, 100% client-side, sem nenhuma camada de "broker" de sessão.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
