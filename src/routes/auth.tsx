import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type View = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) navigate({ to: "/", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (view === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg("Cadastro criado! Confirme seu e-mail para entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível enviar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMsg("Não foi possível entrar com Google.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-6">
        <h1 className="text-3xl font-black text-accent">SustentaSampa</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {view === "forgot"
            ? "Informe seu e-mail para redefinir a senha."
            : "Entre para ver o mapa de calor e reportar alagamentos."}
        </p>

        {view !== "forgot" && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setView(m);
                  setMsg(null);
                }}
                data-on={view === m}
                className="min-h-[56px] rounded-2xl border-4 border-border text-base font-black uppercase data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-background"
              >
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>
        )}

        {view === "forgot" ? (
          resetSent ? (
            <div className="mt-5 space-y-4">
              <p className="rounded-xl border-2 border-accent p-3 text-center text-sm font-bold text-accent">
                Se esse e-mail estiver cadastrado, enviamos um link de redefinição. Confira sua
                caixa de entrada (e o spam).
              </p>
              <button
                type="button"
                onClick={() => {
                  setView("login");
                  setResetSent(false);
                }}
                className="min-h-[56px] w-full rounded-2xl border-4 border-border text-base font-black uppercase text-foreground"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={sendResetLink} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail de cadastro"
                className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy}
                className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
              >
                {busy ? "Enviando..." : "Enviar link de redefinição"}
              </button>
              <button
                type="button"
                onClick={() => setView("login")}
                className="min-h-[48px] w-full rounded-xl text-sm font-bold text-muted-foreground"
              >
                Voltar
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={submit} className="mt-5 space-y-3">
              {view === "signup" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (mín. 6 caracteres)"
                className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
              />

              {view === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setView("forgot");
                    setMsg(null);
                  }}
                  className="block text-right text-sm font-bold text-accent underline"
                >
                  Esqueci minha senha
                </button>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
              >
                {busy ? "Aguarde..." : view === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>

            <button
              type="button"
              onClick={google}
              className="mt-3 min-h-[56px] w-full rounded-2xl border-4 border-accent text-base font-black uppercase text-accent"
            >
              Continuar com Google
            </button>
          </>
        )}

        {msg && (
          <p className="mt-4 rounded-xl border-2 border-accent p-3 text-center text-sm font-bold text-accent">
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
