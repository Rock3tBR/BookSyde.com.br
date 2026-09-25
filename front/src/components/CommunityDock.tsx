import { MyFriendCode } from "@/components/MyFriendCode";
import { FriendshipStatus } from "@/components/FriendshipStatus";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, MessageCircle, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getReaderProfiles, normalizeReaderSearch, searchReaders } from "@/lib/socialSearch";

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_code: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
};

type DbError = { message: string };
type RpcResult = { data: unknown; error: DbError | null };

const socialDb = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

export function CommunityDock() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("friendships")
        .select("id,requester_id,addressee_id,status")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Friendship[];
    },
  });

  const incoming = friendships.filter(
    (friendship) => friendship.status === "pending" && friendship.addressee_id === user?.id,
  );
  const notified = useRef(new Set<string>());

  useEffect(() => {
    notified.current.clear();
  }, [user?.id]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fresh = incoming.filter((friendship) => !notified.current.has(friendship.id));
    if (!fresh.length) return;

    fresh.forEach((friendship) => notified.current.add(friendship.id));
    toast.info(
      fresh.length === 1
        ? "Você tem um pedido de amizade"
        : `Você tem ${fresh.length} novos pedidos de amizade`,
    );
  }, [incoming]);

  const friendIds = friendships
    .filter((friendship) => friendship.status === "accepted")
    .map((friendship) =>
      friendship.requester_id === user?.id ? friendship.addressee_id : friendship.requester_id,
    );

  const { data: friends = [] } = useQuery({
    queryKey: ["dock-profiles", friendIds.join(",")],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      return getReaderProfiles(friendIds);
    },
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unread-direct-messages", user?.id],
    enabled: !!user,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("direct_messages")
        .select("id,sender_id")
        .eq("receiver_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; sender_id: string }>;
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`community-dock-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => void client.invalidateQueries({ queryKey: ["friendships"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => void client.invalidateQueries({ queryKey: ["unread-direct-messages"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, user]);

  const normalizedSearch = normalizeReaderSearch(search);

  const { data: searchResult, isFetching: searching, isError: searchFailed, error: searchError } = useQuery({
    queryKey: ["dock-search", user?.id, normalizedSearch],
    enabled: !!user && normalizedSearch.length >= 2,
    queryFn: () => searchReaders(normalizedSearch, user!.id, 8),
    retry: 1,
  });
  const results = searchResult?.profiles ?? [];

  const add = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await socialDb.rpc("send_friend_request", {
        _addressee_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado");
      void client.invalidateQueries({ queryKey: ["friendships"] });
    },
    onError: (error: DbError) => {
      void client.invalidateQueries({ queryKey: ["friendships"] });
      toast.error(error.message || "Não foi possível enviar o pedido.");
    },
  });

  if (!user || pathname === "/auth" || pathname.startsWith("/ler/")) return null;

  const Row = ({ person, action }: { person: Person; action?: boolean }) => {
    const friendship = friendships.find(
      (item) => item.requester_id === person.id || item.addressee_id === person.id,
    );

    return (
      <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
        <Avatar>
          <AvatarImage src={person.avatar_url ?? undefined} />
          <AvatarFallback>{person.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{person.display_name}</p>
          {person.user_code ? (
            <p className="text-xs text-muted-foreground">#{person.user_code}</p>
          ) : null}
        </div>
        {friendship && friendship.status !== "rejected" ? (
          friendship.status === "accepted" ? (
            <MessageCircle className="size-4 text-primary" />
          ) : (
            <FriendshipStatus status={friendship.status} />
          )
        ) : action ? (
          <Button
            size="icon"
            variant="outline"
            disabled={add.isPending}
            aria-label={`Adicionar ${person.display_name}`}
            onClick={() => add.mutate(person.id)}
          >
            <UserPlus className="size-4" />
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/94 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(0_0_0/0.16)] backdrop-blur-xl">
        <div className="mx-auto flex h-11 w-full items-center px-3 text-[11px] text-muted-foreground sm:h-12 sm:px-6 sm:text-xs lg:px-8 xl:px-10 2xl:px-12">
          <div className="hidden min-w-0 items-center gap-2 min-[360px]:flex">
            <span className="truncate font-medium text-foreground/90">BookSyde</span>
            <span>|</span>
            <span className="text-emerald-400">Online</span>
          </div>

          <SheetTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted/50 hover:text-primary sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
              aria-label="Abrir amigos e conversas"
            >
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">Amigos e conversas</span>
              <span className="sm:hidden">Amigos</span>

              {incoming.length > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-500">
                  <Bell className="size-3.5" />
                  {incoming.length}
                </span>
              ) : null}

              {unreadMessages.length > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {unreadMessages.length}
                </span>
              ) : null}
            </button>
          </SheetTrigger>
        </div>
      </div>

      <SheetContent
        side="right"
        className="flex h-dvh w-full max-w-full flex-col border-l border-border/50 sm:w-[430px] sm:max-w-[430px]"
      >
        <SheetHeader>
          <SheetTitle>Comunidade</SheetTitle>
          <SheetDescription>Amigos e conversas</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <MyFriendCode />

          {incoming.length > 0 ? (
            <Link
              to="/social"
              search={{ friend: "" }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-500"
            >
              <Bell className="size-4 shrink-0" />
              {incoming.length} pedido(s) de amizade — Ver pedidos
            </Link>
          ) : null}

          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou código #ABC123"
            />
          </div>

          {normalizedSearch.length >= 2 ? (
            <div className="mt-3 grid gap-1">
              {results.map((person) => {
                const isFriend = friendIds.includes(person.id);
                return isFriend ? (
                  <Link
                    key={person.id}
                    to="/social"
                    search={{ friend: person.id }}
                    onClick={() => setOpen(false)}
                  >
                    <Row person={person} />
                  </Link>
                ) : (
                  <Row key={person.id} person={person} action />
                );
              })}
              {searching ? <p className="p-3 text-sm text-muted-foreground" role="status">Buscando leitores…</p> : null}
              {searchFailed ? (
                <p className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  Busca indisponível: {searchError instanceof Error ? searchError.message : "verifique a conexão e as permissões do banco"}.
                </p>
              ) : null}
              {!searching && !searchFailed && !results.length ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {searchResult?.needsMigration
                    ? "Busca de amigos não configurada. Aplique a migração no Supabase."
                    : "Nenhum leitor encontrado. Confira o nome ou código."}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 flex-1 overflow-auto">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Amigos ({friends.length})
              </p>

              <div className="grid gap-1">
                {friends.map((person) => {
                  const unread = unreadMessages.filter(
                    (messageItem) => messageItem.sender_id === person.id,
                  ).length;

                  return (
                    <Link
                    key={person.id}
                    to="/social"
                    search={{ friend: person.id }}
                    onClick={() => setOpen(false)}
                  >
                      <div className="relative">
                        <Row person={person} />
                        {unread > 0 ? (
                          <span className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {unread}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {!friends.length ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  Adicione amigos para começar uma conversa.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <Button className="mt-auto shrink-0" variant="outline" asChild>
          <Link to="/social" search={{ friend: "" }} onClick={() => setOpen(false)}>
            Abrir conversas
          </Link>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
