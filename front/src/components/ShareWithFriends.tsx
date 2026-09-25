import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getReaderProfiles } from "@/lib/socialSearch";

type ShareType = "folder" | "manga" | "volume" | "page";

type Props = {
  type: ShareType;
  title: string;
  path: string;
  folderId?: string;
  mangaId?: string;
  volumeId?: string;
  pageId?: string;
  contentLabel?: string;
  compact?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Friendship = { requester_id: string; addressee_id: string; status: string };
type RpcResult = { data: unknown; error: { message: string } | null };

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

function defaultMessage(type: ShareType, label?: string) {
  if (type === "folder") return "Separei esta pasta para você. Espero que goste!";
  if (type === "page") return "Separei esta página para você. Espero que goste!";
  if (type === "volume") return "Separei este volume para você. Espero que goste!";

  const normalized = label?.trim().toLowerCase();
  if (normalized === "livro") return "Separei este livro para você. Espero que goste!";
  if (normalized === "hq") return "Separei esta HQ para você. Espero que goste!";
  if (normalized === "gibi") return "Separei este gibi para você. Espero que goste!";
  return "Separei este mangá para você. Espero que goste!";
}

export function ShareWithFriends(props: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const suggestedMessage = useMemo(
    () => defaultMessage(props.type, props.contentLabel),
    [props.contentLabel, props.type],
  );
  const [message, setMessage] = useState(suggestedMessage);

  useEffect(() => {
    if (open) setMessage(suggestedMessage);
  }, [open, suggestedMessage]);

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["share-friends", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data: links, error } = await db
        .from("friendships")
        .select("requester_id,addressee_id,status")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;

      const ids = [
        ...new Set(
          ((links ?? []) as unknown as Friendship[]).map((item) =>
            item.requester_id === user!.id ? item.addressee_id : item.requester_id,
          ),
        ),
      ];
      if (!ids.length) return [];

      return (await getReaderProfiles(ids)) as Profile[];
    },
  });

  async function share(friend: Profile) {
    setSendingTo(friend.id);

    const { error } = await db.rpc("share_code_with_friend", {
      _receiver_id: friend.id,
      _share_type: props.type,
      _title: props.title,
      _path: props.path,
      _folder_id: props.folderId ?? null,
      _manga_id: props.mangaId ?? null,
      _volume_id: props.volumeId ?? null,
      _page_id: props.pageId ?? null,
      _message: message.trim(),
    });

    setSendingTo(null);

    if (error) {
      toast.error(error.message || "Não foi possível compartilhar.");
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["direct-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-direct-messages"] });
    setOpen(false);
    toast.success(`Código enviado para ${friend.display_name}`);
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={props.compact ? "icon" : "default"}
          aria-label="Compartilhar com amigos"
          className={props.triggerClassName}
        >
          <Share2 className="size-4" />
          {props.compact ? null : <span>{props.triggerLabel ?? "Compartilhar com amigo"}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar código com amigo</DialogTitle>
          <DialogDescription>
            {props.title}. O código enviado será de uso único e ficará válido por 12 horas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="share-message" className="text-sm font-medium">
            Mensagem
          </label>
          <Textarea
            id="share-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1500}
            rows={3}
            placeholder="Escreva uma mensagem para seu amigo…"
          />
          <p className="text-xs text-muted-foreground">
            O nome do conteúdo, o código e as instruções de uso serão acrescentados automaticamente.
          </p>
        </div>

        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {friends.map((friend) => (
            <button
              key={friend.id}
              type="button"
              disabled={!!sendingTo}
              onClick={() => void share(friend)}
              className="flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-muted disabled:opacity-60"
            >
              <Avatar>
                <AvatarImage src={friend.avatar_url ?? undefined} />
                <AvatarFallback>{friend.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{friend.display_name}</span>
              <Send className="size-4 text-primary" />
            </button>
          ))}

          {!isLoading && !friends.length ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Adicione amigos na Comunidade para compartilhar diretamente.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
