import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const db = supabase as unknown as { from: (table: string) => any };

export function MyFriendCode() {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ["my-friend-code", user?.id];
  const {
    data: code,
    isPending,
    isError,
  } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("user_code")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return (data as unknown as { user_code: string | null }).user_code;
    },
  });
  const generate = useMutation({
    mutationFn: async () => {
      const value = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
      const { error } = await db
        .from("profiles")
        .update({ user_code: value })
        .eq("id", user!.id)
        .select("user_code")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: key });
      toast.success("Código de amizade gerado!");
    },
    onError: () => toast.error("Não foi possível gerar seu código. Tente novamente."),
  });
  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o código abaixo.");
    }
  }
  return (
    <section className="rounded-xl border border-primary/20 p-3">
      <p className="mb-2 text-sm font-medium">Meu código de amizade</p>
      {code ? (
        <div className="flex items-center justify-between gap-2">
          <code className="select-all text-base font-semibold tracking-wider">#{code}</code>
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            <Copy className="size-4" /> Copiar
          </Button>
        </div>
      ) : null}
      <Button
        className="mt-2"
        size="sm"
        variant="outline"
        disabled={isPending || isError || generate.isPending}
        onClick={() => generate.mutate()}
      >
        <KeyRound className="size-4" />{" "}
        {generate.isPending ? "Gerando…" : code ? "Gerar novo código" : "Gerar meu código"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        {isError
          ? "Não foi possível carregar seu código."
          : code
            ? "Compartilhe seu código. Gerar um novo substitui o anterior."
            : "Gere seu código para receber pedidos de amizade."}
      </p>
    </section>
  );
}
