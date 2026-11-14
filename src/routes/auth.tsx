import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type View = "login" | "signup" | "forgot";

const fieldClass =
  "flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 focus-within:border-accent";
const inputClass =
  "w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/70";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted-foreground"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const MailIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
);
const LockIcon = () => (
  <Svg>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
const UserIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
const EyeIcon = ({ off }: { off: boolean }) => (
  <Svg>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="m4 4 16 16" />}
  </Svg>
);

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "var(--accent)" }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        {/* Marca */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent/90">
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12h4l3-8 4 16 3-8h6" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
            São Paulo, mais resiliente
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold leading-tight text-foreground/95">
          Sustenta
          <br />
          <span className="text-accent/90">Sampa</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {view === "forgot"
            ? "Informe seu e-mail para redefinir a senha."
            : "Entre para ver o mapa de calor e reportar alagamentos."}
        </p>

        {view !== "forgot" && (
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-accent/25 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setView(m);
                  setMsg(null);
                }}
                data-on={view === m}
                className="min-h-[48px] rounded-full text-xs font-bold uppercase tracking-widest text-foreground/70 data-[on=true]:bg-accent/90 data-[on=true]:text-background"
              >
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>
        )}

        {view === "forgot" ? (
          resetSent ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-2xl border border-accent p-3 text-center text-sm font-bold text-accent">
                Se esse e-mail estiver cadastrado, enviamos um link de redefinição. Confira sua
                caixa de entrada (e o spam).
              </p>
              <button
                type="button"
                onClick={() => {
                  setView("login");
                  setResetSent(false);
                }}
                className="min-h-[56px] w-full rounded-2xl border border-accent text-sm font-black uppercase tracking-widest text-accent"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={sendResetLink} className="mt-6 space-y-3">
              <label className={fieldClass}>
                <MailIcon />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail de cadastro"
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[56px] w-full rounded-2xl bg-accent/90 text-sm font-bold uppercase tracking-widest text-background disabled:opacity-60"
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
            <form onSubmit={submit} className="mt-6 space-y-3">
              {view === "signup" && (
                <label className={fieldClass}>
                  <UserIcon />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className={inputClass}
                  />
                </label>
              )}
              <label className={fieldClass}>
                <MailIcon />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className={inputClass}
                />
              </label>
              <label className={fieldClass}>
                <LockIcon />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (mín. 6 caracteres)"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="shrink-0"
                >
                  <EyeIcon off={showPassword} />
                </button>
              </label>

              {view === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot");
                      setMsg(null);
                    }}
                    className="text-sm font-semibold text-accent/80"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-[56px] w-full rounded-2xl bg-accent/90 text-sm font-bold uppercase tracking-widest text-background shadow-[0_0_18px_-8px_var(--accent)] disabled:opacity-60"
              >
                {busy ? "Aguarde..." : view === "login" ? "Entrar →" : "Criar conta →"}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-white/10" />
              ou continue com
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={google}
              className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-accent/30 text-xs font-bold uppercase tracking-widest text-accent/90"
            >
              <GoogleLogo />
              Continuar com Google
            </button>
          </>
        )}

        {msg && (
          <p className="mt-4 rounded-2xl border border-accent p-3 text-center text-sm font-bold text-accent">
            {msg}
          </p>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Juntos por uma cidade mais segura.
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground/70">
          <a href="/termos.html" className="underline-offset-2 hover:underline">
            Termos de uso
          </a>
          {" · "}
          <a href="/privacidade.html" className="underline-offset-2 hover:underline">
            Política de privacidade
          </a>
        </p>
      </div>
    </main>
  );
}
