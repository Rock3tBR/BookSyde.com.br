import { Route } from "@/routes/meu-perfil";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Mail, Palette, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AvatarEditor } from "@/components/AvatarEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { normalizeBrazilianPhone } from "@/lib/profilePhone";

export function MyProfilePage() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { data: contact, isLoading: loadingPhone, error: contactError, refetch: refetchContact } = useQuery({
    queryKey: ["private-profile-contact", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_contacts")
        .select("phone_e164")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  useEffect(() => {
    if (profile) setNickname(profile.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    if (!loadingPhone && !contactError) setPhone(contact?.phone_e164 ?? "");
  }, [contact?.phone_e164, loadingPhone, contactError]);

  if (loading || loadingProfile) {
    return <main className="px-4 py-10 text-sm text-muted-foreground">Carregando seu perfil…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Entre para acessar seu perfil</h1>
        <Button asChild className="mt-5"><Link to="/auth">Entrar</Link></Button>
      </main>
    );
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nickname.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 40) {
      toast.error("O apelido deve ter entre 2 e 40 caracteres.");
      return;
    }
    setSavingIdentity(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user!.id,
        display_name: name,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      toast.success("Apelido atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o apelido.");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.type !== "image/webp" || file.size > 5 * 1024 * 1024) {
      toast.error("Escolha uma imagem válida de até 5 MB.");
      return;
    }
    setSavingAvatar(true);
    try {
      const path = `${user!.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: "image/webp",
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = profile
        ? await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user!.id)
        : await supabase.from("profiles").upsert({
            id: user!.id,
            display_name: nickname.trim() || "Leitor",
            avatar_url: avatarUrl,
          });
      if (profileError) throw profileError;
      await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      toast.success("Foto atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = normalizeBrazilianPhone(phone);
    if (number === null) {
      toast.error("Digite um telefone brasileiro com DDD: 10 ou 11 dígitos.");
      return;
    }
    setSavingPhone(true);
    try {
      const { error } = await supabase.from("profile_contacts").upsert({
        user_id: user!.id,
        phone_e164: number || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["private-profile-contact", user!.id] });
      toast.success(number ? "Telefone salvo no perfil privado." : "Telefone removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o telefone.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <main className="mx-auto w-full px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-6 lg:px-7 xl:px-9">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-5">
        <aside className="rounded-[1.45rem] border border-border/70 bg-card/65 p-4 lg:sticky lg:top-[calc(6.5rem+env(safe-area-inset-top))]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">Sua conta</p>
          <h1 className="mt-1 font-display text-xl">Meu perfil</h1>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
            <Avatar className="size-12 shrink-0 border border-border/70">
              <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
              <AvatarFallback><UserRound className="size-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.display_name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Dados pessoais e segurança ficam aqui, separados das suas preferências.</p>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full justify-start rounded-xl">
            <Link to="/conta" search={{ tab: "reading" }}><Palette className="size-4" /> Personalização</Link>
          </Button>
        </aside>

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2 xl:gap-5">
          <section className="min-w-0 space-y-4 rounded-[1.45rem] border border-border/70 bg-card/65 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              <h2 className="font-display text-xl">Dados do perfil</h2>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-background/35 p-3 min-[380px]:flex-row min-[380px]:items-center">
              <Avatar className="size-16 border border-border/70">
                <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback><UserRound className="size-5" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Foto de perfil</p>
                <p className="text-xs text-muted-foreground">Ajuste o enquadramento antes de salvar.</p>
                <AvatarEditor disabled={savingAvatar} onSave={uploadAvatar} />
              </div>
            </div>
            <form className="space-y-3" onSubmit={(event) => void saveIdentity(event)}>
              <div className="space-y-1.5">
                <Label htmlFor="profile-nickname">Apelido</Label>
                <Input id="profile-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} minLength={2} autoComplete="nickname" required placeholder="Como quer ser chamado?" />
                <p className="text-xs text-muted-foreground">Nome exibido no header e nas áreas sociais.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">E-mail</Label>
                <Input id="profile-email" value={user.email ?? ""} disabled readOnly />
                <p className="text-xs text-muted-foreground">O e-mail não é alterado nesta página.</p>
              </div>
              <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={savingIdentity}>
                <Check className="size-4" /> {savingIdentity ? "Salvando…" : "Salvar apelido"}
              </Button>
            </form>
            <div className="border-t border-border/60 pt-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Phone className="size-4 text-primary" /> Telefone para contato</div>
              {contactError ? (
                <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  Não foi possível acessar o telefone. Confirme se a migração profile_contacts foi aplicada no Supabase.
                  <Button type="button" size="sm" variant="ghost" className="mt-2 block" onClick={() => void refetchContact()}>Tentar novamente</Button>
                </div>
              ) : null}
              <form onSubmit={(event) => void savePhone(event)} className="space-y-2">
                <Label htmlFor="profile-phone">Número com DDD (opcional)</Label>
                <Input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={24} disabled={loadingPhone || !!contactError} />
                <p className="text-xs leading-5 text-muted-foreground">Uso futuro: contato e recursos opcionais. Não é número de login e ainda não foi verificado por SMS. Somente sua conta pode consultar este registro.</p>
                <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto" disabled={savingPhone || loadingPhone || !!contactError}>
                  {savingPhone ? "Salvando…" : "Salvar telefone"}
                </Button>
              </form>
            </div>
          </section>

          <section className="min-w-0 space-y-4 rounded-[1.45rem] border border-border/70 bg-card/65 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-xl">Segurança</h2>
            </div>
            <div className="flex gap-3 rounded-xl border border-border/60 bg-background/35 p-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Conta autenticada</p>
                <p className="break-all text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <form onSubmit={(event) => void changePassword(event)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-password">Nova senha</Label>
                <Input id="profile-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-password-confirm">Confirmar senha</Label>
                <Input id="profile-password-confirm" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" required />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">A atualização da senha pode exigir autenticação recente conforme a configuração do Supabase. Não afeta suas obras, biblioteca ou compras.</p>
              <Button type="submit" className="w-full sm:w-auto" disabled={savingPassword || !newPassword || !confirmPassword}>
                <KeyRound className="size-4" /> {savingPassword ? "Atualizando…" : "Alterar senha"}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
