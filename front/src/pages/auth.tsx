import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import "./auth.css";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [resetRequested, setResetRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [confirmationRequested, setConfirmationRequested] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [callbackPending, setCallbackPending] = useState(true);

  useEffect(() => {
    let active = true;
    // The SDK processes the callback once, including restoring its session.
    // Await its cached result instead of exchanging a one-use code twice.
    void supabase.auth
      .initialize()
      .then(({ error }) => {
        if (!active) return;
        if (error) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          const query = new URLSearchParams(window.location.search);
          const code = params.get("error_code") || query.get("error_code");
          const expired = code === "otp_expired";
          setCallbackError(
            expired
              ? "Este link de confirmação expirou ou já foi usado. Entre na sua conta ou solicite um novo e-mail."
              : "Não foi possível concluir o acesso. Tente entrar novamente ou solicite um novo link.",
          );
          setConfirmationRequested(expired);
          // Remove callback credentials and errors from the address/history.
          window.history.replaceState(window.history.state, "", window.location.pathname);
        }
        setCallbackPending(false);
      })
      .catch(() => {
        if (!active) return;
        setCallbackError("Não foi possível concluir o acesso. Tente novamente.");
        setCallbackPending(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function resendConfirmation() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      setCallbackError("");
      toast.success("Se a conta estiver aguardando confirmação, você receberá um novo e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("booksyde:remembered-email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      /* O login continua disponível se o armazenamento estiver bloqueado. */
    }
  }, []);

  function saveEmailPreference() {
    try {
      if (rememberEmail) localStorage.setItem("booksyde:remembered-email", email);
      else localStorage.removeItem("booksyde:remembered-email");
    } catch {
      /* Não impede o acesso. */
    }
  }

  async function requestPasswordReset() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success(
        "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o e-mail. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setRecoveryMode(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (
      user &&
      !callbackPending &&
      !callbackError &&
      !recoveryMode &&
      !window.location.hash.includes("type=recovery")
    )
      navigate({ to: "/", replace: true });
  }, [user, navigate, recoveryMode, callbackPending, callbackError]);

  async function updatePassword() {
    if (newPassword.length < 6) {
      toast.error("Use uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso");
    setRecoveryMode(false);
    navigate({ to: "/", replace: true });
  }

  async function signIn() {
    saveEmailPreference();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (error.code === "email_not_confirmed") setConfirmationRequested(true);
      toast.error(error.message);
      return;
    }
    setCallbackError("");
    toast.success("Bem-vindo de volta!");
  }

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setConfirmationRequested(true);
      toast.success("Conta criada! Confirme seu e-mail para entrar.");
      return;
    }
    setCallbackError("");
    toast.success("Conta criada!");
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar com o Google. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const title = recoveryMode
    ? "Uma nova senha"
    : confirmationRequested
      ? "Confirme seu e-mail"
      : resetRequested
        ? "Esqueceu sua senha?"
        : mode === "signup"
          ? "Sua história começa aqui"
          : "Bem-vindo de volta";
  const subtitle =
    callbackError ||
    (recoveryMode
      ? "Escolha uma nova senha para voltar à sua estante."
      : confirmationRequested
        ? "Abra o link que enviamos. Se precisar, solicite outro e-mail de confirmação."
        : resetRequested
          ? "Tudo bem. Enviaremos um link para você recuperar o acesso."
          : mode === "signup"
            ? "Crie sua conta e descubra um mundo de boas histórias."
            : "Entre para continuar sua jornada literária com o BookSyde.");

  function passwordField(
    id: string,
    value: string,
    onChange: (value: string) => void,
    isNew = false,
  ) {
    return (
      <div className="auth-field">
        <label htmlFor={id}>{isNew && recoveryMode ? "Nova senha" : "Senha"}</label>
        <div className="auth-input-wrap">
          <LockKeyhole size={20} aria-hidden="true" />
          <input
            id={id}
            type={showPassword ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={isNew ? "Pelo menos 6 caracteres" : "Sua senha"}
            required
            minLength={isNew ? 6 : undefined}
            autoComplete={isNew ? "new-password" : "current-password"}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
            <span>{showPassword ? "Ocultar" : "Mostrar"}</span>
          </button>
        </div>
      </div>
    );
  }

  function emailField(id: string) {
    return (
      <div className="auth-field">
        <label htmlFor={id}>E-mail</label>
        <div className="auth-input-wrap">
          <Mail size={20} aria-hidden="true" />
          <input
            id={id}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <main className="booksyde-auth">
      <svg width="0" height="0" aria-hidden="true" className="auth-clip-defs">
        <defs>
          <clipPath id="auth-bookshelf-clip" clipPathUnits="objectBoundingBox">
            <path d="M .6 0 C .61 .07 .57 .11 .48 .11 H .23 C -.01 .11 -.02 .395 .22 .395 H .30 C .4 .395 .4 .49 .3 .49 H .19 C .055 .49 .045 .61 .16 .61 C .29 .61 .28 .735 .12 .735 C -.05 .735 -.03 .91 .12 .91 H .18 C .28 .91 .31 .96 .3 1 H 1 V 0 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="auth-art" aria-hidden="true">
        <img src="/booksyde-auth-bookshelf.png" alt="" fetchPriority="high" />
        <div className="auth-art-quote">
          <span />
          Livros tornam
          <br />
          tudo mais possível.
        </div>
      </div>
      <div className="auth-paper-dot auth-paper-dot-top" aria-hidden="true" />
      <div className="auth-paper-dot auth-paper-dot-bottom" aria-hidden="true" />

      <header className="auth-header">
        <Link to="/" className="auth-brand" aria-label="BookSyde — início">
          <BrandLogo imageClassName="auth-brand-icon" />
          <span>BOOKSYDE</span>
        </Link>
        <nav aria-label="Navegação principal" className="auth-nav">
          <Link to="/">Início</Link>
          <Link to="/marketplace">Explorar</Link>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button">Sobre</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Boas histórias, sempre por perto.</DialogTitle>
                <DialogDescription>
                  O BookSyde é sua biblioteca digital para descobrir livros, mangás e HQs, organizar
                  suas leituras e conhecer novos criadores.
                </DialogDescription>
              </DialogHeader>
              <Button asChild>
                <Link to="/marketplace">Explorar obras</Link>
              </Button>
            </DialogContent>
          </Dialog>
        </nav>
      </header>

      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">{title}</h1>
        <p className="auth-subtitle" role={callbackError ? "alert" : undefined}>
          {subtitle}
        </p>
        {recoveryMode ? (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void updatePassword();
            }}
          >
            {passwordField("new-password", newPassword, setNewPassword, true)}
            <button className="auth-submit" disabled={busy}>
              {busy ? "Atualizando…" : "Atualizar senha"}
            </button>
          </form>
        ) : confirmationRequested ? (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void resendConfirmation();
            }}
          >
            {emailField("confirmation-email")}
            <button className="auth-submit" disabled={busy}>
              {busy ? "Enviando…" : "Reenviar confirmação"}
            </button>
            <button
              type="button"
              className="auth-back"
              onClick={() => {
                setConfirmationRequested(false);
                setCallbackError("");
                setMode("signin");
              }}
            >
              Voltar para entrar
            </button>
          </form>
        ) : resetRequested ? (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void requestPasswordReset();
            }}
          >
            {emailField("recovery-email")}
            <button className="auth-submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviar link de recuperação"}
            </button>
            <button type="button" className="auth-back" onClick={() => setResetRequested(false)}>
              Voltar para entrar
            </button>
          </form>
        ) : (
          <>
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setShowPassword(false);
              }}
              className="auth-tabs"
            >
              <TabsList className="auth-tabs-list" aria-label="Acesso à conta">
                <TabsTrigger value="signin" disabled={busy}>
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" disabled={busy}>
                  Criar conta
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void signIn();
                  }}
                >
                  {emailField("email")}
                  {passwordField("password", password, setPassword)}
                  <div className="auth-options">
                    <label className="auth-remember">
                      <input
                        type="checkbox"
                        checked={rememberEmail}
                        onChange={(event) => {
                          setRememberEmail(event.target.checked);
                          if (!event.target.checked) {
                            try {
                              localStorage.removeItem("booksyde:remembered-email");
                            } catch {
                              /* Sem armazenamento. */
                            }
                          }
                        }}
                      />
                      Lembrar e-mail
                    </label>
                    <button type="button" disabled={busy} onClick={() => setResetRequested(true)}>
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy ? "Entrando…" : "Entrar"}
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void signUp();
                  }}
                >
                  <div className="auth-field">
                    <label htmlFor="name">Como quer ser chamado?</label>
                    <div className="auth-input-wrap">
                      <UserRound size={20} aria-hidden="true" />
                      <input
                        id="name"
                        autoComplete="name"
                        value={name}
                        placeholder="Seu nome"
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                  </div>
                  {emailField("email-up")}
                  {passwordField("password-up", password, setPassword, true)}
                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy ? "Criando conta…" : "Criar conta"}
                  </button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="auth-divider">
              <span />
              ou continue com
              <span />
            </div>
            <button
              type="button"
              className="auth-google"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <GoogleMark />
              Continuar com o Google
            </button>
          </>
        )}
        <p className="auth-legal">
          Ao continuar, você concorda com nossos
          <br className="auth-legal-break" /> <Link to="/termos">Termos de Uso</Link> e{" "}
          <Link to="/privacidade">Política de Privacidade.</Link>
        </p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.8 23.8 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}
