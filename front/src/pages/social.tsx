import { Route } from "@/routes/social";
import { MyFriendCode } from "@/components/MyFriendCode";
import { MarketplaceOrderMessage } from "@/components/MarketplaceOrderMessage";
import { FriendshipStatus } from "@/components/FriendshipStatus";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  HeartHandshake,
  MessageCircle,
  Search,
  Send,
  Store,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getReaderProfiles, normalizeReaderSearch, searchReaders } from "@/lib/socialSearch";

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_code?: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  share_type: "folder" | "manga" | "volume" | "page" | null;
  share_title: string | null;
  share_path: string | null;
  share_code: string | null;
  created_at: string;
  read_at: string | null;
  message_kind: "user" | "share" | "marketplace_order" | "marketplace_delivery";
  marketplace_order_id: string | null;
};

type MarketplaceOrderContact = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  created_at: string;
};

type DbError = { message: string };
type RpcResult = { data: unknown; error: DbError | null };

const socialDb = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

export function SocialPage() {
  const { user, loading } = useAuth();
  const { friend: friendFromUrl, order: orderFromUrl, payment: paymentFromUrl } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastFriendFromUrlRef = useRef<string>("");
  const [search, setSearch] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");

  const selectConversation = (profile: Profile | null) => {
    lastFriendFromUrlRef.current = profile?.id ?? "";
    setSelectedFriend(profile);
    void navigate({
      search: {
        friend: profile?.id ?? "",
        order: orderFromUrl ?? "",
        payment: paymentFromUrl ?? "",
      },
      replace: true,
    });
  };

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("friendships")
        .select("id,requester_id,addressee_id,status,created_at")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Friendship[];
    },
  });

  const { data: marketplaceOrders = [] } = useQuery({
    queryKey: ["marketplace-orders", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("marketplace_orders")
        .select("id,buyer_id,seller_id,status,created_at")
        .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MarketplaceOrderContact[];
    },
  });

  const marketplaceContactIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(
      marketplaceOrders.map((order) =>
        order.buyer_id === user.id ? order.seller_id : order.buyer_id,
      ),
    );
  }, [marketplaceOrders, user]);

  const relatedIds = useMemo(() => {
    if (!user) return [];
    return [
      ...new Set([
        ...friendships.map((item) =>
          item.requester_id === user.id ? item.addressee_id : item.requester_id,
        ),
        ...marketplaceContactIds,
      ]),
    ];
  }, [friendships, marketplaceContactIds, user]);

  const { data: relatedProfiles = [] } = useQuery({
    queryKey: ["social-profiles", relatedIds.join(",")],
    enabled: relatedIds.length > 0,
    queryFn: async () => {
      return getReaderProfiles(relatedIds);
    },
  });

  const profiles = useMemo(
    () => new Map(relatedProfiles.map((profile) => [profile.id, profile])),
    [relatedProfiles],
  );

  const accepted = friendships.filter((item) => item.status === "accepted");
  const incoming = friendships.filter(
    (item) => item.status === "pending" && item.addressee_id === user?.id,
  );

  const acceptedFriendIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(
      accepted.map((item) =>
        item.requester_id === user.id ? item.addressee_id : item.requester_id,
      ),
    );
  }, [accepted, user]);

  const chatContactIds = useMemo(
    () => new Set([...acceptedFriendIds, ...marketplaceContactIds]),
    [acceptedFriendIds, marketplaceContactIds],
  );

  useEffect(() => {
    if (!friendFromUrl || friendFromUrl === lastFriendFromUrlRef.current) return;
    lastFriendFromUrlRef.current = friendFromUrl;
    if (!chatContactIds.has(friendFromUrl)) return;
    const profile = profiles.get(friendFromUrl);
    if (profile) setSelectedFriend(profile);
  }, [chatContactIds, friendFromUrl, profiles]);

  const normalizedSearch = normalizeReaderSearch(search);

  const { data: searchResult, isFetching: searching, isError: searchFailed, error: searchError } = useQuery({
    queryKey: ["profile-search", user?.id, normalizedSearch],
    enabled: !!user && normalizedSearch.length >= 2,
    queryFn: () => searchReaders(normalizedSearch, user!.id, 12),
    retry: 1,
  });
  const results = searchResult?.profiles ?? [];

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["direct-messages", user?.id, selectedFriend?.id],
    enabled: !!user && !!selectedFriend,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("direct_messages")
        .select("id,sender_id,receiver_id,body,share_type,share_title,share_path,share_code,created_at,read_at,message_kind,marketplace_order_id")
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${selectedFriend!.id}),and(sender_id.eq.${selectedFriend!.id},receiver_id.eq.${user!.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DirectMessage[];
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`social-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["direct-messages"] });
          void queryClient.invalidateQueries({ queryKey: ["unread-direct-messages"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => void queryClient.invalidateQueries({ queryKey: ["friendships"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_orders" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
          void queryClient.invalidateQueries({ queryKey: ["marketplace-order"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_delivery_codes" },
        () => void queryClient.invalidateQueries({ queryKey: ["marketplace-order"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!user || !selectedFriend) return;

    void socialDb
      .rpc("mark_direct_messages_read", { _friend_id: selectedFriend.id })
      .then(({ error }) => {
        if (!error) {
          void queryClient.invalidateQueries({ queryKey: ["unread-direct-messages"] });
        }
      });
  }, [messages.length, queryClient, selectedFriend, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedFriend?.id]);

  const requestFriendship = useMutation({
    mutationFn: async (addresseeId: string) => {
      const { error } = await socialDb.rpc("send_friend_request", {
        _addressee_id: addresseeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast.success("Pedido de amizade enviado");
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível enviar o pedido."),
  });

  const answerFriendship = useMutation({
    mutationFn: async ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) => {
      const { error } = await socialDb.rpc("respond_friend_request", {
        _friendship_id: friendshipId,
        _accept: accept,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["friendships"] });
      toast.success(variables.accept ? "Amizade aceita" : "Pedido recusado");
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível responder ao pedido."),
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedFriend) throw new Error("Selecione uma conversa.");
      const { error } = await socialDb.rpc("send_direct_message", {
        _receiver_id: selectedFriend.id,
        _body: body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["direct-messages"] });
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível enviar a mensagem."),
  });

  const redeemSharedCode = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await socialDb.rpc("redeem_friend_share_code", { _code: code });
      if (error) throw error;
      return (data ?? {}) as { path?: string | null; share_type?: string | null };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["library-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["personal-library"] });
      toast.success("Código utilizado. O conteúdo foi adicionado à sua biblioteca.");
      if (data.path) window.location.assign(data.path);
    },
    onError: (error: DbError) =>
      toast.error(error.message || "Não foi possível utilizar este código."),
  });

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-16">Carregando…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Entre para acessar a comunidade</h1>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="w-full px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-4 sm:py-12 lg:px-6">
      <div className={selectedFriend ? "hidden lg:block" : "block"}>
        <p className="text-sm font-medium text-primary">Sua comunidade</p>
        <h1 className="font-display text-3xl sm:text-4xl">Amigos e conversas</h1>
      </div>

      <div className="mt-5 grid gap-4 sm:mt-7 sm:gap-5 lg:grid-cols-[340px_1fr]">
        <aside className={selectedFriend ? "hidden space-y-5 lg:block" : "space-y-5"}>
          <MyFriendCode />

          <section className="ink-panel rounded-2xl p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Search className="size-4" /> Encontrar leitores
            </h2>
            <Input
              className="mt-3"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou código…"
            />

            <div className="mt-3 grid gap-2">
              {results.map((profile) => {
                const friendship = friendships.find(
                  (item) => item.requester_id === profile.id || item.addressee_id === profile.id,
                );

                return (
                  <PersonRow
                    key={profile.id}
                    profile={profile}
                    action={
                      friendship && friendship.status !== "rejected" ? (
                        <FriendshipStatus status={friendship.status} />
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={requestFriendship.isPending}
                          onClick={() => requestFriendship.mutate(profile.id)}
                          aria-label={`Adicionar ${profile.display_name}`}
                        >
                          <UserPlus className="size-4" />
                        </Button>
                      )
                    }
                  />
                );
              })}

              {searching && normalizedSearch.length >= 2 ? (
                <p className="py-3 text-sm text-muted-foreground" role="status">Buscando leitores…</p>
              ) : null}
              {searchFailed ? (
                <p className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  Não foi possível buscar leitores: {searchError instanceof Error ? searchError.message : "verifique a conexão e as permissões do banco"}.
                </p>
              ) : null}
              {normalizedSearch.length >= 2 && !searching && !searchFailed && !results.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {searchResult?.needsMigration
                    ? "Busca de amigos não configurada no banco. Aplique a migração de descoberta de leitores no Supabase."
                    : "Nenhum usuário encontrado. Confira o nome ou código informado."}
                </p>
              ) : null}
            </div>
          </section>

          {incoming.length ? (
            <section className="ink-panel rounded-2xl p-4">
              <h2 className="font-semibold">Pedidos recebidos</h2>
              <div className="mt-3 grid gap-2">
                {incoming.map((item) => {
                  const profile = profiles.get(item.requester_id);
                  if (!profile) return null;

                  return (
                    <PersonRow
                      key={item.id}
                      profile={profile}
                      action={
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            disabled={answerFriendship.isPending}
                            onClick={() =>
                              answerFriendship.mutate({ friendshipId: item.id, accept: true })
                            }
                            aria-label="Aceitar"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={answerFriendship.isPending}
                            onClick={() =>
                              answerFriendship.mutate({ friendshipId: item.id, accept: false })
                            }
                            aria-label="Recusar"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {marketplaceContactIds.size ? (
            <section className="ink-panel rounded-2xl p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Store className="size-4" /> Marketplace
              </h2>
              <div className="mt-3 grid gap-2">
                {[...marketplaceContactIds].map((id) => {
                  const profile = profiles.get(id);
                  if (!profile) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`rounded-xl text-left transition ${selectedFriend?.id === id ? "bg-primary/15" : "hover:bg-muted/70"}`}
                      onClick={() => selectConversation(profile)}
                    >
                      <PersonRow
                        profile={profile}
                        action={<MessageCircle className="size-4 text-primary" />}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="ink-panel rounded-2xl p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <HeartHandshake className="size-4" /> Amigos
            </h2>
            <div className="mt-3 grid gap-2">
              {accepted.map((item) => {
                const id = item.requester_id === user.id ? item.addressee_id : item.requester_id;
                const profile = profiles.get(id);
                if (!profile) return null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-xl text-left transition ${selectedFriend?.id === id ? "bg-primary/15" : "hover:bg-muted/70"}`}
                    onClick={() => selectConversation(profile)}
                  >
                    <PersonRow
                      profile={profile}
                      action={<MessageCircle className="size-4 text-primary" />}
                    />
                  </button>
                );
              })}

              {!accepted.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Seus amigos aparecerão aqui.
                </p>
              ) : null}
            </div>
          </section>
        </aside>

        <section
          className={`ink-panel flex min-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-2xl sm:min-h-[560px] ${selectedFriend ? "flex" : "hidden lg:flex"}`}
        >
          {selectedFriend ? (
            <>
              <header className="flex items-center gap-2 border-b p-3 sm:p-4">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="lg:hidden"
                  onClick={() => selectConversation(null)}
                  aria-label="Voltar para amigos"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <PersonRow profile={selectedFriend} />
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 sm:gap-3 sm:p-4">
                {loadingMessages ? (
                  <p className="m-auto text-sm text-muted-foreground">Carregando conversa…</p>
                ) : null}

                {!loadingMessages && !messages.length ? (
                  <div className="m-auto max-w-xs text-center">
                    <MessageCircle className="mx-auto size-9 text-primary" />
                    <p className="mt-3 font-medium">Comece a conversa</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Envie uma mensagem para {selectedFriend.display_name}.
                    </p>
                  </div>
                ) : null}

                {messages.map((item) => {
                  const mine = item.sender_id === user.id;
                  return (
                    <div
                      key={item.id}
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[78%] sm:px-4 ${mine ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-muted"}`}
                    >
                      {item.share_title ? <p className="mb-1 font-semibold">{item.share_title}</p> : null}
                      {item.body ? <p className="whitespace-pre-wrap break-words">{item.body}</p> : null}
                      {item.marketplace_order_id ? (
                        <MarketplaceOrderMessage
                          orderId={item.marketplace_order_id}
                          currentUserId={user.id}
                          compact
                        />
                      ) : null}
                      {item.share_code && !mine ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-8 bg-background/70 text-foreground hover:bg-background"
                          disabled={redeemSharedCode.isPending}
                          onClick={() => redeemSharedCode.mutate(item.share_code!)}
                        >
                          {redeemSharedCode.isPending ? "Usando código…" : "Usar código e abrir"}
                        </Button>
                      ) : item.share_path ? (
                        <a
                          href={item.share_path}
                          className="mt-2 inline-block underline underline-offset-2"
                        >
                          Abrir compartilhamento
                        </a>
                      ) : null}
                      <p
                        className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/65" : "text-muted-foreground"}`}
                      >
                        {formatMessageTime(item.created_at)}
                      </p>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form
                className="flex gap-2 border-t p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = message.trim();
                  if (body && !sendMessage.isPending) sendMessage.mutate(body);
                }}
              >
                <Input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={4000}
                  placeholder="Escreva uma mensagem…"
                  aria-label="Mensagem"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!message.trim() || sendMessage.isPending}
                  aria-label="Enviar"
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="m-auto max-w-sm p-8 text-center">
              <MessageCircle className="mx-auto size-10 text-primary" />
              <h2 className="mt-4 font-display text-2xl">Escolha uma conversa</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Converse com amigos ou continue uma compra do marketplace.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PersonRow({ profile, action }: { profile: Profile; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-2">
      <Avatar>
        <AvatarImage src={profile.avatar_url ?? undefined} />
        <AvatarFallback>{profile.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{profile.display_name}</p>
        {profile.user_code ? (
          <p className="truncate text-xs text-muted-foreground">#{profile.user_code}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function formatMessageTime(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
