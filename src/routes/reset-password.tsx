import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // O link do e-mail traz um token na URL que o Supabase troca por uma
    // sessão temporária de recuperação. Esperamos esse evento antes de
    // liberar o formulário.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 6) {
      setMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMsg("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg("Não foi possível redefinir a senha. Peça um novo link e tente de novo.");
    } else {
      setDone(true);
      setTimeout(() => navigate({ to: "/", replace: true }), 2000);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-6">
        <h1 className="text-3xl font-black text-accent">Nova senha</h1>

        {done ? (
          <p className="mt-5 rounded-xl border-2 border-accent p-3 text-center text-sm font-bold text-accent">
            Senha redefinida! Entrando...
          </p>
        ) : !ready ? (
          <p className="mt-5 text-base text-muted-foreground">
            Verificando o link de redefinição...
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirme a nova senha"
              className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}

        {msg && (
          <p className="mt-4 rounded-xl border-2 border-danger p-3 text-center text-sm font-bold text-danger">
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
