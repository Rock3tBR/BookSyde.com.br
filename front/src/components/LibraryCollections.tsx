import { PreferredMangaCard } from "@/components/PreferredMangaCard";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Copy, DownloadCloud, FolderPlus, Import, Loader2, Pencil, Share2 } from "lucide-react";
import {
  LibraryFolderCard,
  FolderColorField,
  DEFAULT_FOLDER_COLOR,
} from "@/components/LibraryFolderCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { type MangaSummary } from "@/components/MangaCard";
import { ShareWithFriends } from "@/components/ShareWithFriends";
import { Button } from "@/components/ui/button";
import { downloadVolumeOffline, getOfflineVolume, getOfflineVolumeIds, removeOfflineVolume } from "@/lib/offlineVolumes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type FolderData = { id: string; name: string; color: string; creator_id: string | null };
type Workspace = {
  folders: FolderData[];
  items: { id: string; folder_id: string | null; manga: MangaSummary }[];
  codes: { code: string; folder_id: string; expires_at: string; used_at: string | null }[];
};
const EMPTY: Workspace = { folders: [], items: [], codes: [] };

export function LibraryCollections({
  mangas,
  loading,
  favoriteIds,
  onToggleFavorite,
}: {
  mangas: MangaSummary[];
  loading: boolean;
  favoriteIds: Set<string>;
  onToggleFavorite: (mangaId: string) => void;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id?: string } | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_FOLDER_COLOR);
  const [importName, setImportName] = useState("");
  const [importColor, setImportColor] = useState(DEFAULT_FOLDER_COLOR);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [code, setCode] = useState("");
  const [asFolder, setAsFolder] = useState(true);
  const [shareFolder, setShareFolder] = useState<FolderData | null>(null);
  const [offlineVolumeIds, setOfflineVolumeIds] = useState<string[]>([]);
  const [downloadingMangaId, setDownloadingMangaId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    const refreshOffline = () => setOfflineVolumeIds(getOfflineVolumeIds());
    refreshOffline();
    window.addEventListener("mangaka-offline-updated", refreshOffline);
    return () => window.removeEventListener("mangaka-offline-updated", refreshOffline);
  }, []);
  const workspace = useQuery({
    queryKey: ["library-workspace", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_library_workspace");
      if (error) throw error;
      return data as unknown as Workspace;
    },
  });
  const data = workspace.data ?? EMPTY;
  const all = [
    ...new Map([...mangas, ...data.items.map((i) => i.manga)].map((m) => [m.id, m])).values(),
  ];
  const allIds = all.map((m) => m.id);
  const ownedCreations = useQuery({
    queryKey: ["library-owned-creations", user?.id, allIds.join(",")],
    enabled: !!user && allIds.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("mangas")
        .select("id")
        .eq("creator_id", user!.id)
        .in("id", allIds);
      if (error) throw error;
      return new Set((rows ?? []).map((row) => row.id));
    },
  });
  const shareableMangaIds = ownedCreations.data ?? new Set<string>();
  const offlineMangaIds = useMemo(
    () =>
      new Set(
        offlineVolumeIds.flatMap((volumeId) => {
          const volume = getOfflineVolume(volumeId);
          return volume ? [volume.mangaId] : [];
        }),
      ),
    [offlineVolumeIds],
  );

  async function toggleBookOffline(manga: MangaSummary) {
    if (!user || manga.work_type !== "book") return;
    setDownloadingMangaId(manga.id);
    setDownloadProgress({ completed: 0, total: 0 });
    try {
      const { data: volumes, error } = await supabase
        .from("volumes")
        .select("id,number,page_count,file_format,published")
        .eq("manga_id", manga.id)
        .eq("published", true)
        .order("number");
      if (error) throw error;
      if (!volumes?.length) throw new Error("Este livro ainda não possui conteúdo publicado para baixar.");

      const currentOffline = new Set(getOfflineVolumeIds());
      const allDownloaded = volumes.every((volume) => currentOffline.has(volume.id));
      if (allDownloaded) {
        await Promise.all(volumes.map((volume) => removeOfflineVolume(volume.id)));
        setOfflineVolumeIds(getOfflineVolumeIds());
        toast.success(volumes.length > 1 ? "Livros removidos do modo offline." : "Livro removido do modo offline.");
        return;
      }

      let completedVolumes = 0;
      setDownloadProgress({ completed: 0, total: volumes.length });
      for (const volume of volumes) {
        if (currentOffline.has(volume.id)) {
          completedVolumes += 1;
          setDownloadProgress({ completed: completedVolumes, total: volumes.length });
          continue;
        }
        await downloadVolumeOffline({
          volumeId: volume.id,
          volumeNumber: volume.number,
          mangaId: manga.id,
          mangaSlug: manga.slug,
          mangaTitle: manga.title,
          workType: "book",
          fileFormat: volume.file_format === "epub" ? "epub" : "images",
        });
        completedVolumes += 1;
        setDownloadProgress({ completed: completedVolumes, total: volumes.length });
      }
      setOfflineVolumeIds(getOfflineVolumeIds());
      toast.success(volumes.length > 1 ? "Coleção disponível para leitura offline." : "Livro disponível para leitura offline.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o livro para leitura offline.");
    } finally {
      setDownloadingMangaId(null);
      setDownloadProgress(null);
    }
  }
  const folder = data.folders.find((f) => f.id === folderId);
  const nativeFolderIds = new Set(
    data.folders.filter((f) => f.creator_id === user?.id).map((f) => f.id),
  );
  const organized = new Set(
    data.items
      .filter((i) => i.folder_id && nativeFolderIds.has(i.folder_id))
      .map((i) => i.manga.id),
  );
  const rootItems = [
    ...new Map(
      [
        ...mangas.filter((m) => !organized.has(m.id)),
        ...data.items.filter((i) => !i.folder_id).map((i) => i.manga),
      ].map((m) => [m.id, m]),
    ).values(),
  ];
  const visible = folder
    ? data.items.filter((i) => i.folder_id === folder.id).map((i) => i.manga)
    : rootItems;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["library-workspace", user?.id] });
    await client.invalidateQueries({ queryKey: ["personal-library", user?.id] });
  };
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_library_folder", {
        _name: name.trim(),
        _color: color,
        _manga_ids: selected,
        ...(editor?.id ? { _folder_id: editor.id } : {}),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditor(null);
      await refresh();
      toast.success("Pasta salva na biblioteca.");
    },
  });
  const redeem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("redeem_library_share", {
        _code: code.trim(),
        _as_folder: asFolder,
        _folder_name: asFolder ? importName.trim() : null,
        _folder_color: asFolder ? importColor : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setImportOpen(false);
      setCode("");
      setFolderId(null);
      await refresh();
      toast.success(
        asFolder ? "Pasta adicionada à biblioteca." : "Conteúdo adicionado à biblioteca.",
      );
    },
  });
  const share = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("generate_library_share", { _folder_id: id });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  function edit(target?: FolderData) {
    save.reset();
    setSearch("");
    setName(target?.name ?? "");
    setColor(target?.color ?? DEFAULT_FOLDER_COLOR);
    setSelected(
      target ? data.items.filter((i) => i.folder_id === target.id).map((i) => i.manga.id) : [],
    );
    setEditor(target ? { id: target.id } : {});
  }
  const latestCode = data.codes
    .filter((s) => s.folder_id === shareFolder?.id)
    .sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-2.5 border-b border-border/50 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {folder ? (
            <Button variant="ghost" size="sm" className="mb-2 h-8 px-2" onClick={() => setFolderId(null)}>
              <ArrowLeft className="size-4" /> Biblioteca
            </Button>
          ) : null}
          <h2 className="font-display text-xl sm:text-2xl">{folder ? folder.name : "Suas obras"}</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {folder
              ? "Gerencie os títulos salvos dentro desta pasta."
              : "Pastas, favoritos e itens importados em um só lugar."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {folder ? (
            <>
              <Button variant="outline" size="sm" className="min-w-0" onClick={() => edit(folder)}>
                <Pencil className="size-4" /> Editar
              </Button>
              {folder.creator_id === user?.id &&
              data.items
                .filter((item) => item.folder_id === folder.id)
                .every((item) => shareableMangaIds.has(item.manga.id)) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0"
                  onClick={() => {
                    share.reset();
                    setShareFolder(folder);
                  }}
                >
                  <Share2 className="size-4" /> <span className="sm:hidden">Compartilhar</span><span className="hidden sm:inline">Compartilhar pasta</span>
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="min-w-0"
                onClick={() => edit()}
                disabled={workspace.isError || workspace.isPending}
              >
                <FolderPlus className="size-4" /> Nova pasta
              </Button>
              <Button
                size="sm"
                className="min-w-0"
                onClick={() => {
                  redeem.reset();
                  setImportName("");
                  setImportColor(DEFAULT_FOLDER_COLOR);
                  setAsFolder(true);
                  setImportOpen(true);
                }}
                disabled={workspace.isError || workspace.isPending}
              >
                <Import className="size-4" /> <span className="sm:hidden">Importar</span><span className="hidden sm:inline">Importar para biblioteca</span>
              </Button>
            </>
          )}
        </div>
      </div>
      {workspace.isError ? (
        <div role="alert" className="rounded-xl border p-4">
          Não foi possível carregar suas pastas.{" "}
          <Button variant="link" onClick={() => void workspace.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {loading || workspace.isPending ? (
        <p role="status">Carregando biblioteca…</p>
      ) : (
        <>
          {!folder && data.folders.length ? (
            <div className="grid grid-cols-2 justify-items-start gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4 2xl:grid-cols-5">
              {data.folders.map((f) => {
                const contents = data.items.filter((i) => i.folder_id === f.id);
                const canShareFolder =
                  f.creator_id === user?.id &&
                  contents.every((item) => shareableMangaIds.has(item.manga.id));
                return (
                  <div key={f.id} className="w-full max-w-[230px]">
                    <LibraryFolderCard
                      name={f.name}
                      color={f.color ?? DEFAULT_FOLDER_COLOR}
                      count={contents.length}
                      firstItem={contents[0]?.manga}
                      imported={f.creator_id !== user?.id}
                      onClick={() => setFolderId(f.id)}
                      onEdit={() => edit(f)}
                      onShare={
                        canShareFolder
                          ? () => {
                              share.reset();
                              setShareFolder(f);
                            }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="grid grid-cols-2 justify-items-start gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visible.map((m) => (
              <div key={m.id} className="relative w-full max-w-[220px]">
                <PreferredMangaCard
                  manga={m}
                  favorite={favoriteIds.has(m.id)}
                  onToggleFavorite={() => onToggleFavorite(m.id)}
                  coverFit="contain"
                  showPersonalization
                />
                {m.work_type === "book" ? (
                  <div className="absolute bottom-3 left-3 z-20">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9 rounded-full border-white/15 bg-black/70 text-white shadow-lg backdrop-blur hover:bg-black/85"
                      disabled={downloadingMangaId === m.id}
                      aria-label={offlineMangaIds.has(m.id) ? `Gerenciar leitura offline de ${m.title}` : `Baixar ${m.title} para leitura offline`}
                      title={
                        downloadingMangaId === m.id
                          ? downloadProgress?.total
                            ? `Baixando ${downloadProgress.completed}/${downloadProgress.total}`
                            : "Preparando download…"
                          : offlineMangaIds.has(m.id)
                            ? "Disponível offline — toque para remover ou completar"
                            : "Baixar para leitura offline"
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void toggleBookOffline(m);
                      }}
                    >
                      {downloadingMangaId === m.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <DownloadCloud className="size-4" />
                      )}
                    </Button>
                  </div>
                ) : null}
                {shareableMangaIds.has(m.id) ? (
                  <div className="absolute bottom-3 right-3 z-20">
                    <ShareWithFriends
                      type="manga"
                      title={m.title}
                      path={`/manga/${m.slug}`}
                      mangaId={m.id}
                      contentLabel={m.work_type}
                      compact
                      triggerClassName="size-9 rounded-full border-white/15 bg-black/70 text-white shadow-lg backdrop-blur hover:bg-black/85"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {!visible.length && (folder || !data.folders.length) ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              {folder
                ? "Esta pasta está vazia. Use Editar pasta para adicionar obras."
                : "Favorite uma obra no catálogo, comece uma leitura ou importe um código para preencher sua biblioteca."}
            </p>
          ) : null}
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Editar pasta" : "Nova pasta"}</DialogTitle>
            <DialogDescription>
              Escolha as obras da sua biblioteca para organizar nesta pasta.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nome da pasta</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <FolderColorField id="folder-color" value={color} onChange={setColor} />
            <div className="mx-auto w-40" aria-label="Prévia da pasta">
              <LibraryFolderCard
                name={name}
                color={color}
                count={selected.length}
                firstItem={all.find((m) => m.id === selected[0])}
              />
            </div>
            <Input
              aria-label="Buscar obras da biblioteca"
              placeholder="Buscar obras da biblioteca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[35dvh] space-y-1 overflow-y-auto">
              {all
                .filter((m) => m.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={(e) =>
                        setSelected((old) =>
                          e.target.checked ? [...old, m.id] : old.filter((id) => id !== m.id),
                        )
                      }
                    />
                    <span className="min-w-0 break-words text-sm">{m.title}</span>
                  </label>
                ))}
              {!all.length ? (
                <p className="text-sm text-muted-foreground">
                  Sua biblioteca ainda não tem obras. Você pode criar a pasta agora e adicionar
                  obras depois.
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.length} obra(s) selecionada(s). Códigos já gerados mantêm o conteúdo do
              momento da geração.
            </p>
            {save.error ? (
              <p role="alert" className="text-sm text-destructive">
                {save.error.message}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={save.isPending || !name.trim()}>
              {save.isPending ? "Salvando…" : "Salvar pasta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (!redeem.isPending) setImportOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar para biblioteca</DialogTitle>
            <DialogDescription>
              Insira o código recebido. Ele pode ser usado uma única vez, em até 12 horas após a
              geração.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              redeem.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="library-code">Código de compartilhamento</Label>
              <Input
                id="library-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Cole o código aqui"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Como deseja importar?</legend>
              <label className="flex items-start gap-3 rounded-xl border p-3">
                <input
                  type="radio"
                  name="import-mode"
                  checked={asFolder}
                  onChange={() => setAsFolder(true)}
                  className="mt-1"
                />
                <span>
                  <strong className="block text-sm">Adicionar a pasta</strong>
                  <span className="text-xs text-muted-foreground">
                    Agrupa as obras em uma pasta com o nome e a cor que você escolher.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border p-3">
                <input
                  type="radio"
                  name="import-mode"
                  checked={!asFolder}
                  onChange={() => setAsFolder(false)}
                  className="mt-1"
                />
                <span>
                  <strong className="block text-sm">Adicionar somente o conteúdo</strong>
                  <span className="text-xs text-muted-foreground">
                    Adiciona as obras diretamente à biblioteca, sem criar uma pasta.
                  </span>
                </span>
              </label>
            </fieldset>
            {asFolder ? (
              <div className="space-y-4 rounded-xl border p-4">
                <div className="space-y-2">
                  <Label htmlFor="import-folder-name">Nome da pasta</Label>
                  <Input
                    id="import-folder-name"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    maxLength={80}
                    placeholder="Ex.: Meus estudos"
                    required
                  />
                </div>
                <FolderColorField
                  id="import-folder-color"
                  value={importColor}
                  onChange={setImportColor}
                />
                <p className="text-xs text-muted-foreground">
                  O nome e a cor serão usados somente na sua cópia.
                </p>
              </div>
            ) : null}
            {redeem.error ? (
              <p role="alert" className="text-sm text-destructive">
                {redeem.error.message}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={redeem.isPending || !code.trim() || (asFolder && !importName.trim())}
            >
              {redeem.isPending ? "Importando…" : "Importar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!shareFolder}
        onOpenChange={(open) => {
          if (!open) setShareFolder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar pasta</DialogTitle>
            <DialogDescription>
              Somente você, criador desta pasta, pode consultar o código. Cada código vale por 12
              horas e permite uma única importação.
            </DialogDescription>
          </DialogHeader>
          <p className="break-words font-medium">{shareFolder?.name}</p>
          {latestCode ? (
            <div className="space-y-2 rounded-xl border p-3">
              <code className="block break-all select-all text-sm">{latestCode.code}</code>
              <p className="text-xs text-muted-foreground">
                {latestCode.used_at
                  ? "Código já utilizado"
                  : `Validade: ${new Date(latestCode.expires_at).toLocaleString("pt-BR")}`}
              </p>
              <Button
                variant="outline"
                disabled={
                  !!latestCode.used_at || new Date(latestCode.expires_at).getTime() <= Date.now()
                }
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(latestCode.code);
                    toast.success("Código copiado.");
                  } catch {
                    toast.error("Selecione e copie o código acima.");
                  }
                }}
              >
                <Copy /> Copiar código
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Gerar um novo código invalida o anterior. A pessoa recebe uma cópia das obras atuais;
            alterações posteriores na pasta não são sincronizadas.
          </p>

          {shareFolder ? (
            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="text-sm font-medium">Enviar diretamente para um amigo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Um código exclusivo de 12 horas será criado para esse amigo e enviado na conversa
                com uma mensagem que você pode personalizar.
              </p>
              <div className="mt-3">
                <ShareWithFriends
                  type="folder"
                  title={shareFolder.name}
                  path="/biblioteca"
                  folderId={shareFolder.id}
                  triggerLabel="Enviar para amigo"
                />
              </div>
            </div>
          ) : null}
          {share.error ? (
            <p role="alert" className="text-sm text-destructive">
              {share.error.message}
            </p>
          ) : null}
          <Button
            disabled={share.isPending}
            onClick={() => shareFolder && share.mutate(shareFolder.id)}
          >
            {share.isPending ? "Gerando…" : "Gerar código de compartilhamento"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
