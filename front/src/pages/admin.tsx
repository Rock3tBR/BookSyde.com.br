import { importDriveFolder } from "@/lib/driveImport";
import { PublicationCover } from "@/components/PublicationCover";
import { Route } from "@/routes/admin";
import { formatPriceCents, parsePriceCents, sanitizePriceInput } from "@/lib/priceInput";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { StudioNavigation, type StudioSection } from "@/components/StudioNavigation";
import { LiveWorkPreview } from "@/components/LiveWorkPreview";
import { MarketplaceAdminPanel } from "@/components/MarketplaceAdminPanel";
import { AdminUsersPanel, type ManagedUser, type AdminUserAction, type NewAccountInput } from "@/components/AdminUsersPanel";
import { WORK_TYPES, unitLabel, validatePublicationFiles, type WorkType, type UnitKind } from "@/lib/publication";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Trash2,
  Search,
  ImageIcon,
  BookOpen,
  CheckCircle2,
  FileUp,
  Globe2,
  ImagePlus,
  Layers3,
  Link2,
  LockKeyhole,
  Store,
  Pencil,
  Info,
  ExternalLink,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { parsePublicationZip, prepareBatchCovers, validateBatchPublication, naturalFileCompare, type BatchPublication } from "@/lib/publicationBatch";
import { BatchPublicationReview } from "@/components/BatchPublicationReview";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useIsCreator, useIsEditora } from "@/lib/auth";
import type { MangaProcessingMode } from "@/lib/imageProcessing";
import { STORAGE_PREFIX } from "@/lib/media";
import { extractEpubCover } from "@/lib/epub";
import { syncMarketplaceSellerStatus } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import {
  getVolumeUploadStatus,
  startVolumeUpload,
  subscribeToVolumeUpload,
} from "@/lib/volumeUpload";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isValidCatalogPrice(cents: number) {
  return Number.isFinite(cents) && (cents === 0 || cents >= 100);
}

function getVisibilityLabel(visibility: "public" | "private" | "invite") {
  if (visibility === "public") return "Público";
  if (visibility === "invite") return "Somente convite";
  return "Privado";
}

function getWorkTypeLabel(workType?: string | null) {
  return WORK_TYPES.find((type) => type.value === workType)?.label ?? "Obra";
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

type WorkPrivateFields = {
  id: string;
  invite_token: string;
  licensed_purchase_url: string | null;
  licensed_store_name: string | null;
};

// Dados internos não devem ser lidos diretamente de public.mangas:
// o esquema restringe SELECT nessas colunas. A RPC só retorna obras
// pertencentes ao usuário autenticado (ou a um administrador).
async function loadPrivateWorkFields(ids: string[]): Promise<Map<string, WorkPrivateFields>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc("booksyde_private_work_fields", {
    p_work_ids: ids,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("Instale o SQL_CORRIGIR_CRIACAO_OBRAS.sql no Supabase usado pelo Booksyde.");
    }
    throw new Error(`Não foi possível consultar os dados privados das obras: ${error.message}`);
  }
  return new Map((data ?? []).map((work) => [work.id, work]));
}

export function AdminPage() {
  const { obra } = Route.useSearch();
  return <AdminWorkspace mode="admin" obra={obra} section="dashboard" />;
}

export function AdminWorkspace({
  mode,
  obra = "",
  initialTab,
  section = "dashboard",
}: {
  section?: "dashboard" | "users" | "catalog" | "marketplace" | "donations";
  mode: "admin" | "studio";
  obra?: string;
  initialTab?: "catalog" | "mangas" | "volumes";
}) {
  const { user, session, loading } = useAuth();
  const { data: isAdmin, isLoading: checkingRole, error: adminRoleError } = useIsAdmin();
  const { data: isCreator, isLoading: checkingCreator, error: creatorRoleError } = useIsCreator();
  const { data: isEditora, isLoading: checkingEditora, error: editoraRoleError } = useIsEditora();
  const queryClient = useQueryClient();
  const [studioSection, setStudioSection] = useState<StudioSection>(initialTab ?? (obra ? "volumes" : "catalog"));
  const [creationStep, setCreationStep] = useState<1 | 2 | 3 | 4>(1);
  const [creationStepError, setCreationStepError] = useState("");
  const creationWizardRef = useRef<HTMLElement | null>(null);

  // manga form
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [editCover, setEditCover] = useState<File | null>(null);
  const [editVolumeCover, setEditVolumeCover] = useState<File | null>(null);
  const [unitKind, setUnitKind] = useState<UnitKind>("volume");
  const [volumeToDelete, setVolumeToDelete] = useState<{
    id: string;
    number: number;
    unit_kind: UnitKind;
  } | null>(null);
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("29,90");
  const creationPriceCents = useMemo(() => parsePriceCents(price), [price]);
  const [creationDestination, setCreationDestination] = useState<"catalog" | "marketplace">("marketplace");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [isCollection, setIsCollection] = useState(false);
  type BookFileFormat = "epub" | "pdf";
  const [singleBookFile, setSingleBookFile] = useState<File | null>(null);
  const [creationMode, setCreationMode] = useState<"single" | "multiple">("single");
  const [batchZip, setBatchZip] = useState<File | null>(null);
  const [batchReading, setBatchReading] = useState(false);
  const [batchWorks, setBatchWorks] = useState<BatchPublication[]>([]);
  const [batchWorkType, setBatchWorkType] = useState<WorkType>("book");
  const batchReadId = useRef(0);
  const [bookFileFormat, setBookFileFormat] = useState<BookFileFormat | null>(null);
  const [extractingEpubCover, setExtractingEpubCover] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private" | "invite">("private");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rightsBasis, setRightsBasis] = useState<"" | "author" | "publisher" | "licensed_distributor">("");
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [mangaToDelete, setMangaToDelete] = useState<{ id: string; title: string } | null>(null);
  const [mangaToEdit, setMangaToEdit] = useState<{
    id: string;
    slug: string;
    invite_token: string;
    title: string;
    description: string;
    author: string;
    work_type: WorkType;
    synopsis: string;
    category: string;
    genres: string;
    is_collection: boolean;
    visibility: "public" | "private" | "invite";
    price_cents: number;
    catalog_sale_enabled: boolean;
    distribution_channel: "catalog" | "marketplace" | "unlisted";
    licensed_purchase_url: string;
    licensed_store_name: string;
  } | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteDetails, setDeleteDetails] = useState("");
  const [donationQr, setDonationQr] = useState<File | null>(null);
  const [donationLink, setDonationLink] = useState("");
  const [donationMessage, setDonationMessage] = useState("Ajude a manter o BookSyde online.");

  useEffect(() => {
    if (!mangaToEdit) {
      setEditPrice("");
      return;
    }

    setEditPrice(formatPriceCents(mangaToEdit.price_cents));
  }, [mangaToEdit?.id]);

  // Somente Admin pode publicar no Catálogo oficial.
  // Editora continua restrita a Livro/direitos de editora, mas publica pelo Marketplace.
  const isEditoraLocked = mode === "studio" && !!isEditora && !isAdmin;

  useEffect(() => {
    if (mode === "studio" && !isAdmin) setCreationDestination("marketplace");
    if (!isEditoraLocked) return;
    setWorkType("book");
    setRightsBasis("publisher");
    setAcceptedTerms(true);
    setPrice((current) => parsePriceCents(current) >= 100 ? current : "29,90");
  }, [isEditoraLocked, isAdmin, mode]);

  // volume form
  const [mangaId, setMangaId] = useState(obra ?? "");
  const [publicationSearch, setPublicationSearch] = useState("");
  const [publicationTypeFilter, setPublicationTypeFilter] = useState<WorkType | "all">("all");
  const [showWorkInfo, setShowWorkInfo] = useState(false);
  const workDetailsRef = useRef<HTMLElement | null>(null);
  const [volumeNumber, setVolumeNumber] = useState("1");
  const [volumeCovers, setVolumeCovers] = useState<Array<File | null>>([]);
  const [extractingCollectionCovers, setExtractingCollectionCovers] = useState(false);
  const [volumeFiles, setVolumeFiles] = useState<File[]>([]);
  const [driveProgress, setDriveProgress] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [volumeToEdit, setVolumeToEdit] = useState<{
    id: string;
    number: number;
    title: string;
    unit_kind: UnitKind;
    published: boolean;
  } | null>(null);
  const [processingMode, setProcessingMode] = useState<MangaProcessingMode>("auto");
  const [removeMargins, setRemoveMargins] = useState(true);
  const [maxImageDimension, setMaxImageDimension] = useState(2400);
  const [retainVolumeSource, setRetainVolumeSource] = useState(true);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const volumeUpload = useSyncExternalStore(
    subscribeToVolumeUpload,
    getVolumeUploadStatus,
    getVolumeUploadStatus,
  );

  const { data: mangas = [], error: mangasError } = useQuery({
    queryKey: ["workspace-mangas", mode, user?.id, isAdmin],
    enabled: !!isAdmin || !!isCreator || !!isEditora,
    queryFn: async () => {
      let query = supabase
        .from("mangas")
        .select(
          "id, slug, title, description, author, synopsis, category, genres, cover_url, is_collection, creator_id, visibility, work_type, price_cents, catalog_sale_enabled, distribution_channel, created_at",
        )
        .order("title");
      if (mode === "studio") query = query.eq("creator_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      const privateFields = await loadPrivateWorkFields((data ?? []).map((work) => work.id));
      return (data ?? []).map((work) => ({
        ...work,
        invite_token: privateFields.get(work.id)?.invite_token ?? "",
        licensed_purchase_url: privateFields.get(work.id)?.licensed_purchase_url ?? null,
        licensed_store_name: privateFields.get(work.id)?.licensed_store_name ?? null,
      }));
    },
  });

  const { data: studioCatalogVolumes = [] } = useQuery({
    queryKey: ["studio-catalog-volumes", mangas.map((manga) => manga.id).join(",")],
    enabled: !!mangas.length && (mode === "studio" || mode === "admin"),
    queryFn: async () => {
      if (!mangas.length) return [];
      const { data, error } = await supabase
        .from("volumes")
        .select("manga_id,unit_kind,page_count,published")
        .in(
          "manga_id",
          mangas.map((manga) => manga.id),
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: studioVolumes = [] } = useQuery({
    queryKey: ["studio-volumes", mangaId],
    enabled: mode === "studio" && !!mangaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volumes")
        .select("id,number,title,published,page_count,unit_kind,file_format")
        .eq("manga_id", mangaId)
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sugere a próxima posição livre ao mudar a obra ou concluir um upload.
  // O índice é global porque o banco não admite volume e capítulo com o mesmo número.
  const nextVolumeNumber = studioVolumes.length
    ? Math.max(...studioVolumes.map((volume) => volume.number)) + 1
    : 1;
  useEffect(() => {
    setVolumeNumber(String(nextVolumeNumber));
  }, [mangaId, nextVolumeNumber]);

  const selectedWork = mangas.find((manga) => manga.id === mangaId);
  const selectedWorkType = selectedWork?.work_type as WorkType | undefined;
  const isSelectedBookCollection = selectedWorkType === "book" && Boolean(selectedWork?.is_collection);
  const collectionBookCoversReady =
    !isSelectedBookCollection ||
    (volumeFiles.length > 0 &&
      volumeFiles.every((file, index) => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension !== "epub" && extension !== "pdf") return false;
        return Boolean(volumeCovers[index]);
      }));
  const catalogStatsByManga = useMemo(() => {
    const base = new Map<
      string,
      { volumeCount: number; chapterCount: number; pageCount: number; publishedCount: number }
    >();
    for (const volume of studioCatalogVolumes) {
      const current =
        base.get(volume.manga_id) ??
        ({ volumeCount: 0, chapterCount: 0, pageCount: 0, publishedCount: 0 } as const);
      base.set(volume.manga_id, {
        volumeCount: current.volumeCount + (volume.unit_kind === "chapter" ? 0 : 1),
        chapterCount: current.chapterCount + (volume.unit_kind === "chapter" ? 1 : 0),
        pageCount: current.pageCount + (volume.page_count ?? 0),
        publishedCount: current.publishedCount + (volume.published ? 1 : 0),
      });
    }
    return base;
  }, [studioCatalogVolumes]);
  const selectedWorkStats = selectedWork
    ? catalogStatsByManga.get(selectedWork.id) ?? {
        volumeCount: 0,
        chapterCount: 0,
        pageCount: 0,
        publishedCount: 0,
      }
    : null;
  const filteredPublicationWorks = useMemo(() => {
    const term = publicationSearch.trim().toLocaleLowerCase("pt-BR");
    return mangas.filter((manga) => {
      if (publicationTypeFilter !== "all" && manga.work_type !== publicationTypeFilter) return false;
      if (!term) return true;
      return [manga.title, manga.author, manga.category]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term);
    });
  }, [mangas, publicationSearch, publicationTypeFilter]);
  useEffect(() => {
    setShowWorkInfo(false);
    setSelectedVolumeIds(new Set());
    setBulkDeleteOpen(false);
  }, [mangaId]);

  function selectPublication(id: string) {
    setMangaId(id);
    // No celular, o detalhe fica após a lista. Levamos o foco visual até ele,
    // sem alterar a escala do viewport nem abrir o teclado.
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => workDetailsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }

  function editPublication(manga: (typeof mangas)[number]) {
    setMangaToEdit({
      id: manga.id,
      slug: manga.slug,
      invite_token: manga.invite_token,
      title: manga.title,
      description: manga.description,
      author: manga.author,
      synopsis: manga.synopsis,
      category: manga.category,
      work_type: manga.work_type as WorkType,
      genres: manga.genres.join(", "),
      is_collection: manga.is_collection,
      visibility: manga.visibility as "public" | "private" | "invite",
      price_cents: manga.price_cents ?? 1990,
      catalog_sale_enabled: !!manga.catalog_sale_enabled,
      distribution_channel:
        manga.distribution_channel === "catalog"
          ? "catalog"
          : manga.distribution_channel === "marketplace"
            ? "marketplace"
            : "unlisted",
      licensed_purchase_url: manga.licensed_purchase_url ?? "",
      licensed_store_name: manga.licensed_store_name ?? "",
    });
  }
  useEffect(() => {
    if (volumeUpload.state === "completed" || volumeUpload.state === "error")
      void queryClient.invalidateQueries();
  }, [volumeUpload.state, queryClient]);
  useEffect(() => {
    setEditCover(null);
  }, [mangaToEdit?.id]);
  useEffect(() => {
    setEditVolumeCover(null);
  }, [volumeToEdit?.id]);
  useEffect(() => {
    if (workType === "manga") setIsCollection(false);
    if (workType !== "book") setSingleBookFile(null);
  }, [workType]);
  useEffect(() => {
    if (!cover) {
      setCoverPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(cover);
    setCoverPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [cover]);
  useEffect(() => {
    if (selectedWorkType === "book") setUnitKind("volume");
    setVolumeFiles([]);
    setVolumeCovers([]);
    setUploadInputKey((key) => key + 1);
  }, [mangaId, selectedWorkType]);
  useEffect(() => {
    if (!mangas.length) return;
    if (!mangaId || !mangas.some((manga) => manga.id === mangaId)) {
      setMangaId(mangas[0]!.id);
    }
  }, [mangas, mangaId]);
  async function uploadCover(file: File) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024)
      throw new Error("Use uma capa JPG, PNG, WebP ou GIF de até 10 MB.");
    const path = `${user!.id}/cover-${crypto.randomUUID()}`;
    const { error } = await supabase.storage
      .from("manga-covers")
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    return `${STORAGE_PREFIX}${path}`;
  }
  const bulkDeleteVolumes = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedVolumeIds);
      if (!ids.length) return { deleted: 0, warnings: [] as string[] };
      const { data } = await supabase.auth.getSession();
      const warnings: string[] = [];
      for (const volumeId of ids) {
        const response = await fetch("/api/admin-mangas", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session?.access_token}`,
          },
          body: JSON.stringify({ volumeId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha ao apagar uma publicação.");
        if (result.warning) warnings.push(result.warning);
      }
      return { deleted: ids.length, warnings };
    },
    onSuccess: ({ deleted, warnings }) => {
      setSelectedVolumeIds(new Set());
      setBulkDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["studio-volumes", mangaId] });
      toast.success(`${deleted} publicaç${deleted === 1 ? "ão apagada" : "ões apagadas"}`);
      if (warnings.length) toast.warning(warnings[0]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteVolume = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin-mangas", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ volumeId: volumeToDelete!.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      setVolumeToDelete(null);
      void queryClient.invalidateQueries();
      toast.success("Publicação apagada");
      if (result.warning) toast.warning(result.warning);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { data: managedUsers = [], isLoading: loadingUsers, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-users", user?.id],
    enabled: mode === "admin" && !!isAdmin && !!session?.access_token,
    queryFn: async () => {
      // Usar o MESMO cliente autenticado do login evita a dependência das
      // variáveis do servidor para uma simples listagem. A função SQL valida
      // auth.uid() + papel admin antes de ler auth.users; nunca usar service_role
      // aqui. Execute sql/repair/05_listagem_usuarios_admin.sql no projeto usado
      // pelas variáveis VITE_SUPABASE_* caso a função ainda não exista.
      const { data, error } = await supabase.rpc("booksyde_admin_list_users");
      if (error) {
        console.error("[admin-users] Erro na RPC:", error.code, error.message);
        if (error.code === "PGRST202" || error.code === "42883") {
          throw new Error("Função de listagem ausente neste projeto Supabase. Execute sql/repair/05_listagem_usuarios_admin.sql no SQL Editor do MESMO projeto usado pelo login.");
        }
        if (error.code === "42501") {
          throw new Error("Sem permissão para listar usuários. Confira se sua conta tem o papel admin em public.user_roles e se a função permite EXECUTE para authenticated.");
        }
        if (error.code === "42P01" || error.code === "42703" || error.code === "42704") {
          throw new Error(`O banco usado pelo login está sem alguma tabela, coluna ou tipo exigido pela listagem (erro ${error.code}). Confira a instalação do esquema do Booksyde.`);
        }
        throw new Error(`Supabase: ${error.message} (${error.code || "erro desconhecido"}).`);
      }
      if (!Array.isArray(data)) {
        throw new Error("O Supabase retornou um formato inesperado; verifique a função booksyde_admin_list_users.");
      }
      return data as ManagedUser[];
    },
    retry: 1,
  });

  const manageUser = useMutation({
    mutationFn: async (input: AdminUserAction) => {
      if (input.action === "set_account_type") {
        if (!input.userId || !input.accountType) throw new Error("Selecione um usuário e o tipo de conta.");
        const { data, error } = await supabase.rpc("booksyde_admin_set_account_type", {
          p_user_id: input.userId,
          p_account_type: input.accountType,
        });
        if (error) {
          if (error.code === "PGRST202" || error.code === "42883") {
            throw new Error("Execute sql/repair/07_alterar_tipo_conta.sql no Supabase do login e recarregue a página.");
          }
          throw new Error(`Não foi possível alterar a conta: ${error.message} (${error.code ?? "sem código"}).`);
        }
        if (!data || typeof data !== "object" || Array.isArray(data) || data["ok"] !== true) {
          throw new Error("O Supabase não confirmou a alteração do tipo de conta.");
        }
        return input.action;
      }
      const response = await fetch("/api/admin-users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("A rota administrativa não está respondendo como API. Verifique o servidor da hospedagem.");
      }
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o usuário.");
      return input.action;
    },
    onSuccess: async (action) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(
        action === "reset_password" ? "E-mail de troca de senha enviado" : "Usuário atualizado",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [createdAccount, setCreatedAccount] = useState<{ email: string; temporaryPassword: string } | null>(
    null,
  );

  const createUserAccount = useMutation({
    mutationFn: async (input: NewAccountInput) => {
      const response = await fetch("/api/admin-users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create_user", ...input }),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("A rota administrativa não está respondendo como API. Verifique o servidor da hospedagem.");
      }
      const payload = (await response.json()) as {
        error?: string;
        email?: string;
        temporaryPassword?: string;
      };
      if (!response.ok || !payload.email || !payload.temporaryPassword) {
        throw new Error(payload.error ?? "Não foi possível criar a conta.");
      }
      return { email: payload.email, temporaryPassword: payload.temporaryPassword };
    },
    onSuccess: async ({ email, temporaryPassword }) => {
      setCreatedAccount({ email, temporaryPassword });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Conta criada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    // Se o admin sair da tela sem clicar em "Ok, já copiei", a senha
    // temporária não deve continuar em memória além da sessão desta página.
    return () => setCreatedAccount(null);
  }, []);

  const deleteManga = useMutation({
    mutationFn: async () => {
      // Execute a RPC no mesmo cliente Supabase usado pelo login. Isso evita
      // rejeitar uma sessão válida quando o endpoint SSR está apontando para
      // credenciais/ambiente diferentes (ex.: preview/Lovable vs produção).
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.user) {
          throw new Error("Sua sessão expirou. Entre novamente para apagar a obra.");
        }
      }

      const { error } = await supabase.rpc("booksyde_delete_publication", {
        p_manga_id: mangaToDelete!.id,
        p_reason: mode === "studio" ? "creator_request" : deleteReason || null,
        p_details: deleteDetails || null,
      });

      if (error) {
        const missing = error.code === "PGRST202" || error.code === "42883";
        throw new Error(
          missing
            ? "A função de exclusão ainda não está disponível no Supabase. Execute o SQL de correção e recarregue o schema."
            : error.message || "Não foi possível apagar a obra.",
        );
      }
    },
    onSuccess: () => {
      setMangaToDelete(null);
      setDeleteReason("");
      setDeleteDetails("");
      void queryClient.invalidateQueries({ queryKey: ["workspace-mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["mangas"] });
      toast.success(mode === "studio" ? "Sua obra foi apagada" : "Obra apagada e remoção registrada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateManga = useMutation({
    mutationFn: async () => {
      if (!mangaToEdit) throw new Error("Selecione uma obra.");
      const coverUrl = editCover ? await uploadCover(editCover) : undefined;

      if (
        !mangaToEdit.title.trim() ||
        !mangaToEdit.description.trim() ||
        !mangaToEdit.author.trim() ||
        !mangaToEdit.synopsis.trim() ||
        !mangaToEdit.category.trim()
      ) {
        throw new Error("Preencha nome, descrição, sinopse, autor e categoria.");
      }

      // A combinação visibility + distribution_channel define onde a obra aparece.
      // Público -> Catálogo | Marketplace -> privado no catálogo | Convite/Privado -> não listado.
      const normalizedVisibility = mangaToEdit.visibility;
      const normalizedDistributionChannel =
        normalizedVisibility === "public"
          ? "catalog"
          : normalizedVisibility === "invite"
            ? "unlisted"
            : mangaToEdit.distribution_channel === "marketplace"
              ? "marketplace"
              : "unlisted";

      const editingCatalog =
        normalizedVisibility === "public" && normalizedDistributionChannel === "catalog";
      const editingMarketplace = normalizedDistributionChannel === "marketplace";
      const editingRestricted =
        normalizedVisibility === "invite" ||
        (normalizedVisibility === "private" && normalizedDistributionChannel === "unlisted");

      const rawEditPrice = Math.max(0, Math.round(mangaToEdit.price_cents));
      const effectiveEditPrice =
        editingCatalog && mode === "studio" && !isAdmin
          ? 0
          : editingMarketplace
            ? Math.max(100, rawEditPrice)
            : editingRestricted
              ? 0
              : rawEditPrice;

      if (editingMarketplace && rawEditPrice < 100) {
        throw new Error("No Marketplace informe um preço a partir de R$ 1,00.");
      }

      if (editingCatalog && isAdmin && !isValidCatalogPrice(effectiveEditPrice)) {
        throw new Error("No Catálogo use R$ 0,00 para leitura gratuita ou pelo menos R$ 1,00 para venda.");
      }

      if (editingCatalog && isAdmin && effectiveEditPrice >= 100) {
        const sellerStatus = await syncMarketplaceSellerStatus();
        if (!sellerStatus.chargesEnabled) {
          throw new Error("A conta Stripe principal não está pronta para receber vendas.");
        }
      }

      let licensedPurchaseUrl: string | null = null;
      if (mode === "admin") {
        const purchaseUrlValue = mangaToEdit.licensed_purchase_url.trim();
        if (purchaseUrlValue) {
          const normalized = /^https?:\/\//i.test(purchaseUrlValue)
            ? purchaseUrlValue
            : `https://${purchaseUrlValue}`;
          const parsed = new URL(normalized);
          if (parsed.protocol !== "https:") {
            throw new Error("O link de compra licenciada precisa usar https://");
          }
          licensedPurchaseUrl = parsed.toString();
        }
      }

      const { data, error } = await supabase
        .from("mangas")
        .update({
          title: mangaToEdit.title.trim(),
          description: mangaToEdit.description.trim(),
          work_type: mangaToEdit.work_type,
          ...(coverUrl ? { cover_url: coverUrl } : {}),
          author: mangaToEdit.author.trim(),
          synopsis: mangaToEdit.synopsis.trim(),
          category: mangaToEdit.category.trim(),
          is_collection:
            mangaToEdit.work_type === "manga" ? false : mangaToEdit.is_collection,
          genres: mangaToEdit.genres
            .split(",")
            .map((genre) => genre.trim())
            .filter(Boolean),
          price_cents: effectiveEditPrice,
          catalog_sale_enabled:
            Boolean(isAdmin) && editingCatalog && effectiveEditPrice >= 100,
          visibility: normalizedVisibility,
          distribution_channel: normalizedDistributionChannel,
          ...(mode === "admin"
            ? {
                licensed_purchase_url: licensedPurchaseUrl,
                licensed_store_name: mangaToEdit.licensed_store_name.trim() || null,
              }
            : {}),
        })
        .eq("id", mangaToEdit.id)
        .select("id, slug, visibility, distribution_channel")
        .single();

      if (error) throw error;
      return { ...data, invite_token: mangaToEdit.invite_token };
    },
    onSuccess: (updated) => {
      const inviteLink =
        updated.visibility === "invite"
          ? `${window.location.origin}/manga/${updated.slug}?invite=${updated.invite_token}`
          : "";

      setLastInviteLink(inviteLink);
      setMangaToEdit(null);
      setEditCover(null);
      void queryClient.invalidateQueries({ queryKey: ["workspace-mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["manga"] });
      void queryClient.invalidateQueries({ queryKey: ["personal-library"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace-catalog"] });

      toast.success(
        updated.visibility === "invite"
          ? "Obra atualizada: agora o acesso é somente por convite."
          : updated.visibility === "private" && updated.distribution_channel === "unlisted"
            ? "Obra atualizada: agora ela está privada."
            : "Obra atualizada",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const updateVolume = useMutation({
    mutationFn: async () => {
      if (!volumeToEdit) throw new Error("Selecione uma publicação.");
      if (!Number.isInteger(volumeToEdit.number) || volumeToEdit.number < 0)
        throw new Error("Informe um número inteiro maior ou igual a zero.");
      const coverUrl = editVolumeCover ? await uploadCover(editVolumeCover) : undefined;
      const { error } = await supabase
        .from("volumes")
        .update({
          number: volumeToEdit.number,
          unit_kind: volumeToEdit.unit_kind,
          ...(coverUrl ? { cover_url: coverUrl } : {}),
          title: volumeToEdit.title.trim(),
          published: volumeToEdit.published,
        })
        .eq("id", volumeToEdit.id)
        .select("id")
        .single();
      if (error?.code === "23505") throw new Error("Este número já está ocupado por um volume ou capítulo desta obra.");
      if (error) throw error;
    },
    onSuccess: () => {
      setVolumeToEdit(null);
      void queryClient.invalidateQueries();
      toast.success("Volume atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveDonation = useMutation({
    mutationFn: async () => {
      const linkValue = donationLink.trim();
      let linkUrl: string | undefined;
      if (linkValue) {
        const normalizedLink = /^https?:\/\//i.test(linkValue) ? linkValue : `https://${linkValue}`;
        const parsedLink = new URL(normalizedLink);
        if (parsedLink.protocol !== "https:") {
          throw new Error("Use uma URL segura iniciada por https://");
        }
        linkUrl = parsedLink.toString();
      }
      let qrUrl: string | undefined;
      if (donationQr) {
        const path = `livepix-${Date.now()}-${donationQr.name}`;
        const { error } = await supabase.storage
          .from("donations")
          .upload(path, donationQr, { contentType: donationQr.type, upsert: true });
        if (error) throw error;
        qrUrl = supabase.storage.from("donations").getPublicUrl(path).data.publicUrl;
      }
      const current = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "donations")
        .maybeSingle();
      const oldValue =
        current.data?.value &&
        typeof current.data.value === "object" &&
        !Array.isArray(current.data.value)
          ? current.data.value
          : {};
      const { error } = await supabase.from("site_settings").upsert({
        key: "donations",
        value: {
          ...oldValue,
          enabled: true,
          message: donationMessage,
          ...(linkUrl ? { link_url: linkUrl } : {}),
          ...(qrUrl ? { qr_url: qrUrl } : {}),
        },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDonationQr(null);
      void queryClient.invalidateQueries({ queryKey: ["donations"] });
      toast.success("Área de doação atualizada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMangaVisibility = useMutation({
    mutationFn: async (payload: { id: string; visibility: "public" | "private" }) => {
      const { error } = await supabase
        .from("mangas")
        .update({ visibility: payload.visibility })
        .eq("id", payload.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: (_, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["manga"] });
      toast.success(payload.visibility === "private" ? "Obra privada" : "Obra pública");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleSingleBookFile(file: File | null) {
    setSingleBookFile(file);

    if (!file) {
      setBookFileFormat(null);
      setCover(null);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "epub" && extension !== "pdf") {
      setSingleBookFile(null);
      setBookFileFormat(null);
      setExtractingEpubCover(false);
      setBookFileFormat(null);
      setCover(null);
      toast.error("Selecione um arquivo EPUB ou PDF.");
      return;
    }

    const detectedFormat: BookFileFormat = extension;
    setBookFileFormat(detectedFormat);

    if (detectedFormat === "pdf") {
      setCover(null);
      return;
    }

    try {
      setExtractingEpubCover(true);
      const epubCover = await extractEpubCover(file);
      if (!epubCover) {
        setCover(null);
        toast.error("Não foi possível encontrar uma capa dentro deste EPUB.");
        return;
      }
      setCover(epubCover);
      toast.success("EPUB identificado e capa extraída automaticamente.");
    } catch (error) {
      console.error(error);
      setCover(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível extrair a capa do EPUB.");
    } finally {
      setExtractingEpubCover(false);
    }
  }

  async function handleVolumeFilesChange(files: File[]) {
    files = [...files].sort((a, b) => naturalFileCompare(a.name, b.name));
    setVolumeFiles(files);
    setVolumeCovers([]);

    if (!isSelectedBookCollection) {
      return;
    }

    const invalid = files.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return extension !== "epub" && extension !== "pdf";
    });

    if (invalid) {
      setVolumeFiles([]);
      setVolumeCovers([]);
      toast.error(`Em coleções de livros, use apenas EPUB ou PDF. Arquivo inválido: ${invalid.name}`);
      return;
    }

    setExtractingCollectionCovers(true);

    const nextCovers: Array<File | null> = Array(files.length).fill(null);

    try {
      await Promise.all(
        files.map(async (file, index) => {
          const extension = file.name.split(".").pop()?.toLowerCase();
          if (extension !== "epub") return;

          try {
            const extracted = await extractEpubCover(file);
            if (!extracted) {
              toast.error(`Não foi possível encontrar uma capa dentro de ${file.name}.`);
              return;
            }
            nextCovers[index] = extracted;
          } catch (error) {
            console.error(error);
            toast.error(
              error instanceof Error
                ? `${file.name}: ${error.message}`
                : `Não foi possível extrair a capa de ${file.name}.`,
            );
          }
        }),
      );

      setVolumeCovers(nextCovers);
    } finally {
      setExtractingCollectionCovers(false);
    }
  }

  function moveVolumeFile(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= volumeFiles.length || extractingCollectionCovers) return;
    const files = [...volumeFiles];
    const covers = volumeFiles.map((_, i) => volumeCovers[i] ?? null);
    [files[index], files[target]] = [files[target]!, files[index]!];
    [covers[index], covers[target]] = [covers[target]!, covers[index]!];
    setVolumeFiles(files);
    setVolumeCovers(covers);
  }

  function setCollectionBookCover(index: number, file: File | null) {
    setVolumeCovers((current) => {
      const next = Array.from({ length: volumeFiles.length }, (_, position) => current[position] ?? null);
      next[index] = file;
      return next;
    });
  }

  async function handleBatchZip(file: File | null) {
    const readId = ++batchReadId.current;
    setBatchZip(file);
    setBatchWorks([]);
    if (!file) { setBatchReading(false); return; }
    setBatchReading(true);
    try {
      const parsed = await parsePublicationZip(file, batchWorkType);
      await prepareBatchCovers(parsed);
      if (readId !== batchReadId.current) return;
      setBatchWorks(parsed);
      toast.success(`${parsed.length} obra(s) identificada(s) no ZIP. Revise a ordem antes de enviar.`);
    } catch (error) {
      if (readId !== batchReadId.current) return;
      setBatchWorks([]);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o ZIP.");
    } finally {
      if (readId === batchReadId.current) setBatchReading(false);
    }
  }

  const createBatchWorks = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login novamente.");
      if (!batchWorks.length) throw new Error("Selecione e valide um ZIP primeiro.");
      if (!acceptedTerms) throw new Error("Aceite o termo de responsabilidade.");
      if (mode === "studio" && !rightsBasis) throw new Error("Informe a base de direitos das obras.");
      if (mode === "studio" && creationDestination === "catalog" && !isAdmin) throw new Error("Somente administradores podem publicar no Catálogo oficial.");
      const invalidPaidPrice = batchWorks.find((book) => book.priceCents > 0 && book.priceCents < 100);
      if (invalidPaidPrice) throw new Error(`${invalidPaidPrice.title}: preços pagos devem ser de pelo menos R$ 1,00.`);
      batchWorks.forEach(validateBatchPublication);
      const created: string[] = [];
      for (let index = 0; index < batchWorks.length; index += 1) {
        const book = batchWorks[index]!;
        const coverUrl = await uploadCover(book.cover!);
        const baseSlug = slugify(book.title) || `livro-${index + 1}`;
        const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
        const visibility = creationDestination === "catalog" ? "public" : "private";
        const effectivePrice = Math.max(0, book.priceCents);
        const { data, error } = await supabase.from("mangas").insert({
          work_type: book.workType, title: book.title, description: book.description, author: book.author,
          synopsis: book.synopsis, category: book.categories[0] ?? getWorkTypeLabel(book.workType), genres: book.categories,
          is_collection: book.isCollection, price_cents: effectivePrice,
          catalog_sale_enabled: Boolean(isAdmin) && creationDestination === "catalog" && effectivePrice >= 100,
          cover_url: coverUrl, creator_id: user.id, visibility,
          distribution_channel: creationDestination, slug,
          terms_accepted_at: new Date().toISOString(), terms_version: "creator-terms-2026-09-01",
          rights_basis: rightsBasis || null, rights_confirmed_at: rightsBasis ? new Date().toISOString() : null,
        }).select("id").single();
        if (error || !data) throw new Error(`${book.title}: ${error?.message ?? "falha ao criar a obra"}`);
        startVolumeUpload({ mangaId: data.id, unitKind: book.unitKind, workType: book.workType, firstNumber: book.units[0]!.number,
          numbers: book.units.map((unit) => unit.number), files: book.units.map((unit) => unit.file), covers: book.units.map((unit) => unit.cover),
          processing: { mode: "original", removeMargins: false, maxDimension: maxImageDimension }, retainSource: true });
        created.push(book.title);
        // Do not duplicate works already queued if a later item fails and the user retries.
        setBatchWorks((current) => current.filter((item) => item !== book));
      }
      return created;
    },
    onSuccess: (created) => {
      setBatchZip(null); setBatchWorks([]);
      void queryClient.invalidateQueries({ queryKey: ["workspace-mangas"] });
      void queryClient.invalidateQueries({ queryKey: ["mangas"] });
      toast.success(`${created.length} obra(s) criada(s). Os arquivos estão sendo processados.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const creationSteps = ["Informações", "Arquivo e capa", "Sinopse e acesso", "Revisão"] as const;
  const livePreviewProps = {
    title,
    author,
    category,
    description,
    synopsis,
    workType,
    coverUrl: coverPreviewUrl,
    destination: creationDestination,
    priceCents: creationPriceCents,
    freeCatalog: creationDestination === "catalog" && !isAdmin,
    isCollection,
    fileFormat: workType === "book" && !isCollection ? bookFileFormat : null,
  };

  function validateCreationStep(step: 1 | 2 | 3 | 4): string | null {
    if (step === 1) {
      if (!workType) return "Selecione o tipo de obra.";
      if (!title.trim()) return "Informe o nome da obra.";
      if (!author.trim()) return "Informe o autor.";
      if (!category.trim()) return "Informe a categoria.";
      if (!description.trim()) return "Preencha a descrição.";
    }
    if (step === 2) {
      if (extractingEpubCover) return "Aguarde a extração da capa do EPUB.";
      if (workType === "book" && !isCollection) {
        if (!bookFileFormat) return "Selecione o formato EPUB ou PDF.";
        if (!singleBookFile) return "Selecione o arquivo do livro.";
        if (singleBookFile.name.split(".").pop()?.toLowerCase() !== bookFileFormat) {
          return `Selecione um arquivo ${bookFileFormat.toUpperCase()} válido.`;
        }
      }
      if (!cover) return "Selecione uma capa para a obra (ou um EPUB com capa).";
    }
    if (step === 3) {
      if (!synopsis.trim()) return "Preencha a sinopse.";
      if (mode === "studio" && creationDestination === "marketplace" &&
          (!Number.isFinite(creationPriceCents) || creationPriceCents < 100)) {
        return "Para vender no Marketplace, informe um preço a partir de R$ 1,00.";
      }
      if (((mode === "studio" && creationDestination === "catalog" && isAdmin) ||
          (mode === "admin" && visibility === "public")) && !isValidCatalogPrice(creationPriceCents)) {
        return "No Catálogo, informe R$ 0,00 ou um valor a partir de R$ 1,00.";
      }
    }
    if (step === 4) {
      if (mode === "studio" && !rightsBasis) return "Selecione como você possui os direitos da obra.";
      if (!acceptedTerms) return "É necessário aceitar o termo de responsabilidade.";
    }
    return null;
  }

  function moveCreationStep(direction: -1 | 1) {
    if (createManga.isPending) return;
    if (direction === 1) {
      const error = validateCreationStep(creationStep);
      if (error) {
        setCreationStepError(error);
        return;
      }
    }
    setCreationStepError("");
    setCreationStep((current) => Math.min(4, Math.max(1, current + direction)) as 1 | 2 | 3 | 4);
    // Só reposiciona quando uma mudança de etapa deixa o topo do formulário fora
    // da área visível. Evita o salto/scroll artificial em telas onde tudo cabe.
    requestAnimationFrame(() => {
      const wizard = creationWizardRef.current;
      if (!wizard) return;
      const top = wizard.getBoundingClientRect().top;
      if (top < 104 || top > window.innerHeight - 120) {
        wizard.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });
  }

  const createManga = useMutation({
    mutationFn: async () => {
      if (!workType) throw new Error("Selecione o tipo de obra.");
      if (!title.trim()) throw new Error("Informe o nome da obra.");
      if (!description.trim()) throw new Error("Informe a descrição da obra.");
      if (!synopsis.trim()) throw new Error("Informe a sinopse da obra.");
      if (!author.trim()) throw new Error("Informe o autor da obra.");
      if (!category.trim()) throw new Error("Informe a categoria da obra.");
      if (!acceptedTerms) throw new Error("Aceite o termo de responsabilidade.");
      if (mode === "studio" && !rightsBasis) {
        throw new Error("Informe com qual base você possui os direitos para comercializar esta obra.");
      }

      const collection = workType === "manga" ? false : isCollection;
      if (workType === "book" && !collection) {
        if (!singleBookFile) throw new Error("Selecione o arquivo deste livro.");
        if (!bookFileFormat) throw new Error("Selecione o formato do livro.");
        const extension = singleBookFile.name.split(".").pop()?.toLowerCase();
        if (extension !== bookFileFormat) {
          throw new Error(`O arquivo selecionado não corresponde ao formato ${bookFileFormat.toUpperCase()}.`);
        }
        if (bookFileFormat === "pdf" && !cover) throw new Error("Selecione uma capa para o arquivo PDF.");
        if (bookFileFormat === "epub" && !cover) throw new Error("Não foi possível identificar a capa deste EPUB.");
        validatePublicationFiles("book", [singleBookFile], 1);
      } else if (!cover) {
        throw new Error("Selecione uma capa para a obra.");
      }

      const baseSlug = slugify(title) || "obra";
      const cents = parsePriceCents(price);
      if (mode === "studio" && !isAdmin && creationDestination === "catalog") {
        throw new Error("Somente administradores podem publicar no Catálogo oficial.");
      }
      const isMarketplaceDestination = mode === "studio" && creationDestination === "marketplace";
      const creationVisibility =
        mode === "studio"
          ? creationDestination === "catalog"
            ? "public"
            : "private"
          : visibility;
      const distributionChannel =
        mode === "studio"
          ? creationDestination
          : creationVisibility === "public"
            ? "catalog"
            : "unlisted";
      const isCatalogDestination = distributionChannel === "catalog" && creationVisibility === "public";
      const isAdminCatalogSale = Boolean(isAdmin) && isCatalogDestination && Number.isFinite(cents) && cents >= 100;
      const isPaidSale = isMarketplaceDestination || isAdminCatalogSale;

      if (isMarketplaceDestination && (!Number.isFinite(cents) || cents < 100)) {
        throw new Error("Informe um preço válido a partir de R$ 1,00 para vender no Marketplace.");
      }

      if (isCatalogDestination && isAdmin && !isValidCatalogPrice(cents)) {
        throw new Error("No Catálogo use R$ 0,00 para leitura gratuita ou pelo menos R$ 1,00 para venda.");
      }

      // Criadores comuns podem publicar gratuitamente no Catálogo. Somente
      // contas Admin vendem diretamente ali usando a Stripe principal.
      const effectivePriceCents =
        isCatalogDestination && !isAdmin
          ? 0
          : Number.isFinite(cents)
            ? Math.max(0, cents)
            : 0;

      // Vendas feitas pelo Admin — inclusive pelo Catálogo — usam a conta
      // Stripe principal do BookSyde, a mesma conexão usada nos planos.
      if (isPaidSale && isAdmin) {
        const sellerStatus = await syncMarketplaceSellerStatus();
        if (!sellerStatus.chargesEnabled) {
          throw new Error("A conta Stripe principal não está pronta para receber vendas.");
        }
      }

      // Só envie a capa ao Storage após validar preço, destino e conta Stripe.
      // Erros nessas validações não devem deixar arquivos órfãos.
      const coverUrl = await uploadCover(cover!);
      const payload = {
        work_type: workType,
        title: title.trim(),
        description: description.trim(),
        author: author.trim(),
        synopsis: synopsis.trim(),
        category: category.trim(),
        is_collection: collection,
        genres: [],
        price_cents: effectivePriceCents,
        catalog_sale_enabled:
          Boolean(isAdmin) && distributionChannel === "catalog" && effectivePriceCents >= 100,
        cover_url: coverUrl,
        creator_id: user!.id,
        visibility: creationVisibility,
        distribution_channel: distributionChannel,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "creator-terms-2026-09-01",
        rights_basis: mode === "studio" ? rightsBasis : null,
        rights_confirmed_at: mode === "studio" ? new Date().toISOString() : null,
      };

      // O slug é único no banco. Se outra obra (inclusive privada, que o
      // usuário não pode consultar por RLS) já usar o mesmo slug, fazemos
      // novas tentativas sem obrigar o criador a trocar o título.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug =
          attempt === 0
            ? baseSlug
            : `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

        const { data, error } = await supabase
          .from("mangas")
          .insert({ ...payload, slug })
          .select("id, slug, visibility, work_type, is_collection, distribution_channel")
          .single();

        if (!error && data) {
          // Obra já foi gravada: uma falha ao buscar o token NÃO deve transformar
          // o cadastro bem-sucedido em erro (nem incentivar um segundo INSERT).
          let inviteToken = "";
          if (data.visibility === "invite") {
            try {
              inviteToken = (await loadPrivateWorkFields([data.id])).get(data.id)?.invite_token ?? "";
            } catch (privateError) {
              console.error("[publication] A obra foi criada, mas o convite não foi carregado:", privateError);
            }
          }
          return { ...data, invite_token: inviteToken };
        }

        const errorCode = (error as { code?: string } | null)?.code;
        const isSlugConflict = errorCode === "23505" && /slug/i.test(error?.message ?? "");
        if (!isSlugConflict || attempt === 4) {
          // Evita deixar uma capa órfã caso a criação da obra falhe.
          if (coverUrl.startsWith(STORAGE_PREFIX)) {
            await supabase.storage
              .from("manga-covers")
              .remove([coverUrl.slice(STORAGE_PREFIX.length)])
              .catch(() => undefined);
          }
          throw error ?? new Error("Não foi possível criar a obra.");
        }
      }

      throw new Error("Não foi possível gerar um endereço único para a obra.");
    },
    onSuccess: (created) => {
      let startedSingleBookUpload = false;
      if (created.work_type === "book" && !created.is_collection && singleBookFile) {
        try {
          startVolumeUpload({
            mangaId: created.id,
            unitKind: "volume",
            workType: "book",
            firstNumber: 1,
            files: [singleBookFile],
            // PDF precisa reaproveitar a capa escolhida no cadastro. EPUB
            // também pode usar a capa já extraída, evitando processá-la duas vezes.
            covers: [cover],
            processing: {
              mode: "original",
              removeMargins: false,
              maxDimension: maxImageDimension,
            },
            retainSource: true,
          });
          startedSingleBookUpload = true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `A obra foi criada, mas o arquivo não iniciou: ${error.message}`
              : "A obra foi criada, mas o arquivo não iniciou.",
          );
        }
      }

      setTitle("");
      setDescription("");
      setWorkType("");
      setAuthor("");
      setSynopsis("");
      setCategory("");
      setCreationDestination("marketplace");
      setCover(null);
      setIsCollection(false);
      setSingleBookFile(null);
      setAcceptedTerms(false);
      setRightsBasis("");
      setCreationStep(1);
      setCreationStepError("");
      setLastInviteLink(
        created.visibility === "invite"
          ? `${window.location.origin}/manga/${created.slug}?invite=${created.invite_token}`
          : "",
      );
      queryClient.invalidateQueries({ queryKey: ["workspace-mangas"] });
      queryClient.invalidateQueries({ queryKey: ["mangas"] });
      if (created.visibility === "invite" && !created.invite_token) {
        toast.warning("Obra criada. Reabra o cadastro para consultar o link de convite.");
      }
      toast.success(
        mode === "studio"
          ? creationDestination === "catalog"
            ? startedSingleBookUpload
              ? "Obra criada no Catálogo. O arquivo está sendo processado em segundo plano."
              : "Obra criada e publicada no Catálogo."
            : startedSingleBookUpload
              ? "Obra criada. O arquivo está sendo processado; configure o anúncio no Marketplace."
              : "Obra criada. Adicione volumes e configure o anúncio no Marketplace."
          : startedSingleBookUpload
            ? "Livro cadastrado. O arquivo está sendo enviado em segundo plano."
            : created.visibility === "public"
              ? "Obra pública criada e adicionada ao Catálogo."
              : "Obra cadastrada",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function beginVolumeUpload() {
    try {
      if (!selectedWorkType) throw new Error("Selecione uma obra.");
      if (selectedWorkType === "book" && !selectedWork?.is_collection && studioVolumes.length) {
        throw new Error("Este é um livro único e já possui um arquivo cadastrado.");
      }

      if (selectedWorkType === "book" && !selectedWork?.is_collection && volumeFiles.length) {
        const extension = volumeFiles[0]!.name.split(".").pop()?.toLowerCase();
        if (extension === "pdf" && !volumeCovers[0]) {
          throw new Error(`Selecione uma capa para o PDF ${volumeFiles[0]!.name}.`);
        }
      }

      if (isSelectedBookCollection) {
        if (extractingCollectionCovers) {
          throw new Error("Aguarde a extração das capas dos EPUBs terminar.");
        }

        volumeFiles.forEach((file, index) => {
          const extension = file.name.split(".").pop()?.toLowerCase();
          if (extension !== "epub" && extension !== "pdf") {
            throw new Error(`Em coleções de livros, use apenas EPUB ou PDF. Arquivo inválido: ${file.name}`);
          }

          if (!volumeCovers[index]) {
            if (extension === "pdf") {
              throw new Error(`Selecione uma capa para o PDF ${file.name}.`);
            }
            throw new Error(`Não foi possível identificar a capa do EPUB ${file.name}.`);
          }
        });
      }

      const effectiveUnitKind: UnitKind = selectedWorkType === "book" ? "volume" : unitKind;
      const effectiveFirstNumber =
        selectedWorkType === "book" && !selectedWork?.is_collection
          ? 1
          : volumeNumber.trim() === "" ? Number.NaN : Number(volumeNumber);
      startVolumeUpload({
        mangaId,
        unitKind: effectiveUnitKind,
        workType: selectedWorkType,
        firstNumber: effectiveFirstNumber,
        files: volumeFiles,
        covers: volumeCovers,
        processing: {
          mode: processingMode,
          removeMargins,
          maxDimension: maxImageDimension,
        },
        retainSource: selectedWorkType === "book" ? true : retainVolumeSource,
      });
      setVolumeFiles([]);
      setVolumeCovers([]);
      setUploadInputKey((key) => key + 1);
      toast.success("Envio iniciado. Você já pode continuar usando o site.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o envio.");
    }
  }

  if (loading || checkingRole || checkingCreator || checkingEditora) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Verificando…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Área restrita</h1>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  }

  const roleError = adminRoleError || creatorRoleError || editoraRoleError;
  if (roleError) {
    return <main className="mx-auto max-w-md px-4 py-20 text-center" role="alert">
      <h1 className="font-display text-2xl">Não foi possível verificar seu acesso</h1>
      <p className="mt-2 text-sm text-muted-foreground">{roleError.message}</p>
    </main>;
  }

  if ((mode === "admin" && !isAdmin) || (mode === "studio" && !isAdmin && !isCreator && !isEditora)) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Sem permissão</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "admin"
            ? "Esta área é exclusiva para administradores."
            : "Esta área é exclusiva para criadores e administradores."}
        </p>
      </main>
    );
  }

  const workspace = (
    <main className={mode === "admin" ? "w-full min-w-0" : "mx-auto w-full min-w-0 max-w-[1600px] px-3 pt-2 pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-3 sm:pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:px-8"}>
      {mode === "studio" ? (
        <h1 data-tour="studio-header" className="sr-only">Estúdio BookSyde</h1>
      ) : section === "dashboard" ? null : (
        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Painel de controle</p>
            <h1 className="font-display text-[1.75rem] leading-tight sm:text-3xl">
              {({ dashboard: "Dashboard", users: "Usuários", catalog: "Moderação de obras", marketplace: "Marketplace", donations: "Doações" }[section])}
            </h1>
          </div>
        </div>
      )}

      <Tabs
        orientation={mode === "studio" ? "vertical" : "horizontal"}
        value={mode === "admin" ? section : studioSection}
        onValueChange={(next) => {
          if (mode === "studio" && (next === "catalog" || next === "mangas" || next === "volumes")) {
            setStudioSection(next);
          }
        }}
        className={mode === "studio" ? "grid min-w-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-5" : "min-w-0"}
      >
        {mode === "studio" ? <StudioNavigation current={studioSection} /> : null}
        <div className="min-w-0">

        {mode === "admin" && isAdmin ? <TabsContent value="dashboard" className="mt-6 min-w-0"><AdminDashboard /></TabsContent> : null}
        {mode === "admin" || mode === "studio" ? (
          <TabsContent value="catalog" className={mode === "studio" ? "mt-0 min-w-0" : "mt-6 min-w-0"}>
            {mangasError ? <p role="alert" className="mb-3 text-sm text-destructive">
              Não foi possível carregar as obras: {mangasError.message}
            </p> : null}
            <section className="ink-panel min-w-0 space-y-3 rounded-[1.25rem] p-3.5 sm:p-5">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                {mode === "admin" ? (
                  <div className="min-w-0">
                    <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                      <ShieldCheck className="size-4" /> Controle de publicações
                    </p>
                    <h2 className="font-display text-xl sm:text-2xl">Moderação de obras</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Consulte, edite e modere as obras cadastradas, inclusive as privadas.
                    </p>
                  </div>
                ) : (
                  <h2 className="sr-only">Minhas obras</h2>
                )}
                <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1.5 text-xs">
                  {mangas.length} {mangas.length === 1 ? "obra" : "obras"}
                </Badge>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
                <label className="relative block min-w-0">
                  <span className="sr-only">Buscar obra</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={publicationSearch}
                    onChange={(event) => setPublicationSearch(event.target.value)}
                    placeholder="Buscar título, autor ou categoria…"
                    className="min-w-0 pl-9 text-base sm:text-sm"
                  />
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Filtrar por tipo de obra</span>
                  <select
                    value={publicationTypeFilter}
                    onChange={(event) => setPublicationTypeFilter(event.target.value as WorkType | "all")}
                    className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:text-sm"
                  >
                    <option value="all">Todos os tipos</option>
                    {WORK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {mangas.length ? (
                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2 px-0.5 text-xs text-muted-foreground">
                      <span>Selecione uma obra</span>
                      <span aria-live="polite">{filteredPublicationWorks.length} resultados</span>
                    </div>
                    {filteredPublicationWorks.length ? (
                      <div
                        className="grid min-w-0 auto-rows-max grid-cols-1 content-start gap-2 sm:grid-cols-2 sm:gap-3 2xl:grid-cols-3"
                        aria-label="Lista de obras"
                      >
                        {filteredPublicationWorks.map((manga) => {
                          const isSelected = manga.id === selectedWork?.id;
                          return (
                            <button
                              key={manga.id}
                              type="button"
                              onClick={() => selectPublication(manga.id)}
                              aria-label={`Selecionar ${manga.title}`}
                              aria-pressed={isSelected}
                              className={`group flex min-h-[108px] min-w-0 items-start gap-3 rounded-2xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-[116px] ${
                                isSelected
                                  ? "border-primary/70 bg-primary/10 ring-1 ring-primary/25"
                                  : "border-border/65 bg-background/35 hover:border-primary/45 hover:bg-card"
                              }`}
                            >
                              <div className="w-[62px] shrink-0 overflow-hidden rounded-lg bg-muted sm:w-[70px] [&_.book-cover]:rounded-lg">
                                <PublicationCover coverUrl={manga.cover_url} title={manga.title} workType={manga.work_type} />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                                <span className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">
                                  {manga.title}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {manga.author || "Autor não informado"}
                                </span>
                                <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                                  <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
                                    {getWorkTypeLabel(manga.work_type)}
                                  </span>
                                  <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
                                    {getVisibilityLabel(manga.visibility as "public" | "private" | "invite")}
                                  </span>
                                </div>
                              </div>
                              {isSelected ? <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
                        Nenhuma obra encontrada. Experimente outros filtros.
                      </div>
                    )}
                  </div>

                  <aside ref={workDetailsRef} aria-label="Obra selecionada" className="min-w-0 scroll-mt-24 xl:sticky xl:top-24">
                    {selectedWork ? (
                      <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background/60">
                        <div className="flex min-w-0 items-start gap-4 border-b border-border/60 p-4">
                          <div className="w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-32 [&_.book-cover]:rounded-xl">
                            <PublicationCover coverUrl={selectedWork.cover_url} title={selectedWork.title} workType={selectedWork.work_type} />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Obra selecionada</p>
                            <h3 className="line-clamp-3 break-words font-display text-lg leading-snug sm:text-xl">
                              {selectedWork.title}
                            </h3>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {selectedWork.author || "Autor não informado"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-[10px]">{getWorkTypeLabel(selectedWork.work_type)}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {getVisibilityLabel(selectedWork.visibility as "public" | "private" | "invite")}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-2">
                          <Button className="min-h-11 min-w-0 px-2 text-xs sm:text-sm" onClick={() => editPublication(selectedWork)}>
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button
                            variant="destructive"
                            className="min-h-11 min-w-0 px-2 text-xs sm:text-sm"
                            onClick={() => setMangaToDelete({ id: selectedWork.id, title: selectedWork.title })}
                          >
                            <Trash2 className="size-4" /> Apagar
                          </Button>
                          <Button
                            variant="outline"
                            className="min-h-11 min-w-0 px-2 text-xs sm:text-sm"
                            aria-expanded={showWorkInfo}
                            aria-controls="workspace-work-info"
                            onClick={() => setShowWorkInfo((visible) => !visible)}
                          >
                            <Info className="size-4" /> Info
                          </Button>
                          <Button variant="outline" asChild className="min-h-11 min-w-0 px-2 text-xs sm:text-sm">
                            <Link
                              to="/manga/$slug"
                              params={{ slug: selectedWork.slug }}
                              search={{ invite: selectedWork.visibility === "invite" ? selectedWork.invite_token : "" }}
                            >
                              <ExternalLink className="size-4" /> Abrir obra
                            </Link>
                          </Button>
                        </div>

                        {mode === "studio" ? (
                          <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-3">
                            <Button variant="secondary" size="sm" asChild>
                              <Link to="/studio" search={{ obra: selectedWork.id, aba: "volumes" }}>
                                <Layers3 className="size-4" /> Gerenciar conteúdo
                              </Link>
                            </Button>
                            {selectedWork.distribution_channel === "marketplace" ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link to="/marketplace" search={{ seller: user?.id ?? "", connect: "", similarTo: "" }}>
                                  <Store className="size-4" /> Ver no Marketplace
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        {showWorkInfo ? (
                          <div id="workspace-work-info" className="space-y-4 border-t border-border/60 p-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl bg-card/65 p-3">
                                <p className="text-[11px] text-muted-foreground">Criado em</p>
                                <p className="mt-1 break-words font-semibold">{formatDateLabel(selectedWork.created_at)}</p>
                              </div>
                              <div className="rounded-xl bg-card/65 p-3">
                                <p className="text-[11px] text-muted-foreground">Categoria</p>
                                <p className="mt-1 break-words font-semibold">{selectedWork.category || "Não informada"}</p>
                              </div>
                              {([
                                ["Volumes", selectedWorkStats?.volumeCount ?? 0],
                                ["Capítulos", selectedWorkStats?.chapterCount ?? 0],
                                ["Publicados", selectedWorkStats?.publishedCount ?? 0],
                                ["Páginas", selectedWorkStats?.pageCount ?? 0],
                              ] as const).map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-card/65 p-3">
                                  <p className="text-[11px] text-muted-foreground">{label}</p>
                                  <p className="mt-1 font-semibold">{value}</p>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Descrição</p>
                              <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                                {selectedWork.description?.trim() || "Sem descrição cadastrada."}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Sinopse</p>
                              <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                                {selectedWork.synopsis?.trim() || "Sem sinopse cadastrada."}
                              </p>
                            </div>
                            {selectedWork.genres.length ? (
                              <div>
                                <p className="text-sm font-semibold">Gêneros</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {selectedWork.genres.map((genre) => <Badge key={genre} variant="outline">{genre}</Badge>)}
                                </div>
                              </div>
                            ) : null}
                            {mode === "admin" && selectedWork.distribution_channel === "catalog" ? (
                              <div className="rounded-xl border border-border/60 p-3">
                                <p className="text-sm font-semibold">Compra licenciada</p>
                                {selectedWork.licensed_purchase_url ? (
                                  <p className="mt-1 break-all text-xs text-muted-foreground">
                                    {selectedWork.licensed_store_name || "Fonte licenciada"}: {selectedWork.licensed_purchase_url}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-muted-foreground">Nenhum link oficial cadastrado.</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                        Selecione uma obra para ver suas ações.
                      </div>
                    )}
                  </aside>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhuma obra cadastrada.
                </div>
              )}
            </section>
          </TabsContent>
        ) : null}

        {mode === "studio" ? (
          <TabsContent value="mangas" className="mt-0 min-w-0">
            <section ref={creationWizardRef} className="ink-panel min-w-0 scroll-mt-24 rounded-2xl p-3 sm:p-4">
              <h2 className="sr-only">Criar obra</h2>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-background/35 p-2">
                <button type="button" onClick={() => setCreationMode("single")} className={`rounded-xl px-4 py-3 text-left transition ${creationMode === "single" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className="block text-sm font-semibold">Unitário</span><span className="text-xs opacity-75">Cadastrar uma obra por vez</span></button>
                <button type="button" onClick={() => setCreationMode("multiple")} className={`rounded-xl px-4 py-3 text-left transition ${creationMode === "multiple" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className="block text-sm font-semibold">Múltiplos</span><span className="text-xs opacity-75">Importar obras e arquivos por ZIP</span></button>
              </div>
              {creationMode === "multiple" ? (
                <div className="space-y-4">
                  <fieldset disabled={batchReading || createBatchWorks.isPending} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                    <legend className="px-1 text-sm font-semibold">Tipo das obras do ZIP</legend>
                    <div className="flex flex-wrap gap-2">{WORK_TYPES.map((type) => <Button key={type.value} type="button" variant={batchWorkType === type.value ? "default" : "outline"} aria-pressed={batchWorkType === type.value} onClick={() => { setBatchWorkType(type.value); setBatchZip(null); setBatchWorks([]); batchReadId.current += 1; }}>{type.label}</Button>)}</div>
                    <p className="mt-3 text-xs text-muted-foreground">Uma pasta por obra, com nome.txt, descricao.txt, categorias.txt, sinopse.txt, escritor.txt e preco.txt. Para misturar tipos no mesmo ZIP, inclua tipo.txt com manga, hq, gibi ou livro em cada pasta.</p>
                    <p className="mt-2 text-xs text-muted-foreground">{batchWorkType === "book" ? "Inclua colecao.txt com sim ou nao. Livros aceitam EPUB e PDF; coleções podem usar a pasta colecoes/." : "Inclua unidade.txt com capitulo ou volume. PDF, CBZ, CBR e ZIP são aceitos; cada subpasta de imagens também pode ser um capítulo ou volume."}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Use capa.jpg, capa.png ou capa.webp para uma capa própria. Sem ela, tentamos a capa do EPUB ou a primeira página do arquivo. Limite: 500 MB por ZIP e 1 GB descompactado.</p>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-background/70 p-3 text-xs">{batchWorkType === "book" ? "Minha coleção/\n  nome.txt\n  descricao.txt\n  categorias.txt\n  sinopse.txt\n  escritor.txt\n  preco.txt\n  colecao.txt → sim\n  colecoes/\n    1.epub\n    2.pdf" : "Minha obra/\n  nome.txt\n  descricao.txt\n  categorias.txt\n  sinopse.txt\n  escritor.txt\n  preco.txt\n  unidade.txt → capitulo\n  capitulos/\n    3.pdf\n    4.cbz\n    5.zip\n    10/\n      1.jpg\n      2.jpg"}</pre>
                    <p className="mt-2 text-xs text-muted-foreground">Ordem automática: 3 → 4 → 5 → 10. Revise e reorganize abaixo antes de enviar.</p>
                  </fieldset>
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                    <Label>Arquivo .zip *</Label>
                    <Input key={batchWorkType} aria-label="Arquivo ZIP de obras" disabled={batchReading || createBatchWorks.isPending} className="mt-2" type="file" accept=".zip,application/zip" onChange={(event) => void handleBatchZip(event.target.files?.[0] ?? null)} />
                    {batchReading ? <p className="mt-2 text-xs text-muted-foreground">Lendo ZIP e extraindo capas…</p> : null}
                    {batchZip && !batchReading ? <p className="mt-2 text-xs font-medium">{batchZip.name} · {batchWorks.length} obra(s) válida(s)</p> : null}
                    <fieldset disabled={batchReading || createBatchWorks.isPending}><BatchPublicationReview works={batchWorks} onChange={setBatchWorks} /></fieldset>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                    <p className="text-sm font-semibold">Publicação do lote</p><p className="mt-1 text-xs text-muted-foreground">Cada obra usa seus próprios metadados e arquivos. Destino e declaração de direitos abaixo valem para todo o lote.</p>
                    <div className="mt-3"><div><Label>Destino</Label><div className="mt-2 flex gap-2">{isAdmin ? <Button type="button" variant={creationDestination === "catalog" ? "default" : "outline"} onClick={() => setCreationDestination("catalog")}>Catálogo</Button> : null}<Button type="button" variant={creationDestination === "marketplace" ? "default" : "outline"} onClick={() => setCreationDestination("marketplace")}>Marketplace</Button></div></div></div>
                    <div className="mt-4"><Label>Direitos</Label><div className="mt-2 flex flex-wrap gap-2">{[["author","Sou autor(a)"],["publisher","Editora autorizada"],["licensed_distributor","Possuo licença"]].map(([value,label]) => <Button key={value} type="button" size="sm" variant={rightsBasis === value ? "default" : "outline"} onClick={() => setRightsBasis(value as typeof rightsBasis)}>{label}</Button>)}</div></div>
                    <label className="mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm"><Checkbox checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)}/><span>Li e aceito o termo de responsabilidade para todas as obras deste lote.</span></label>
                    <Button className="mt-4 w-full" disabled={!batchWorks.length || batchReading || createBatchWorks.isPending} onClick={() => createBatchWorks.mutate()}>{createBatchWorks.isPending ? "Criando obras…" : `Criar ${batchWorks.length || ""} obra(s)`}</Button>
                  </div>
                </div>
              ) : <>
              <nav aria-label="Progresso da criação de obra" className="mb-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                {creationSteps.map((label, index) => {
                  const number = index + 1;
                  const active = creationStep === number;
                  const completed = creationStep > number;
                  return (
                    <div key={label} aria-current={active ? "step" : undefined} className="min-w-0">
                      <div className={`h-1 rounded-full ${active || completed ? "bg-primary" : "bg-border/75"}`} />
                      <div className={`mt-2 flex items-center gap-1.5 text-[11px] sm:text-xs ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        <span className="shrink-0 tabular-nums">{String(number).padStart(2, "0")}</span>
                        <span className="hidden truncate sm:inline">{label}</span>
                        <span className="sr-only sm:hidden">{label}</span>
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* No celular a prévia é expansível: não rouba espaço do formulário. */}
              <details className="group mb-3 rounded-xl border border-border/70 bg-background/35 xl:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><BookOpen className="size-4 text-primary" /> Visualizar prévia ao vivo</span>
                  <span className="text-xs text-muted-foreground group-open:hidden">Mostrar</span>
                  <span className="hidden text-xs text-muted-foreground group-open:inline">Ocultar</span>
                </summary>
                <div className="border-t border-border/60 p-2 sm:p-3">
                  <LiveWorkPreview {...livePreviewProps} />
                </div>
              </details>

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_290px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0">
                  <div className={`rounded-2xl border border-border/70 bg-background/35 p-3 ${creationStep !== 1 ? "hidden" : ""}`}>
                    <div className="mb-2 flex items-start gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                      <div>
                        <h3 className="font-semibold">Informações principais</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Escolha o formato e preencha os dados que identificam a obra.</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <Label>Tipo de obra *</Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {WORK_TYPES.map((type) => {
                            const selected = workType === type.value;
                            const disabled = isEditoraLocked && type.value !== "book";
                            return (
                              <button
                                type="button"
                                key={type.value}
                                disabled={disabled}
                                onClick={() => setWorkType(type.value)}
                                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                  disabled
                                    ? "cursor-not-allowed border-border/40 bg-background/20 opacity-40"
                                    : selected
                                      ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
                                      : "border-border/70 bg-background/45 hover:border-primary/35 hover:bg-muted/50"
                                }`}
                              >
                                <span className="text-sm font-semibold">{type.label}</span>
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {type.value === "manga"
                                    ? "Leitura oriental"
                                    : type.value === "book"
                                      ? "Livro ou coleção"
                                      : type.value === "hq"
                                        ? "Quadrinhos / HQ"
                                        : "Gibi / coletânea"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {isEditoraLocked ? (
                          <p className="text-xs text-muted-foreground">
                            Contas Editora publicam apenas no formato Livro.
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Nome *</Label>
                          <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Ex.: Harry Potter"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Autor *</Label>
                          <Input
                            value={author}
                            onChange={(event) => setAuthor(event.target.value)}
                            placeholder="Nome do autor"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Categoria *</Label>
                          <Input
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            placeholder="Ex.: Fantasia"
                          />
                        </div>

                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Descrição *</Label>
                          <span className="text-[11px] text-muted-foreground">Resumo curto</span>
                        </div>
                        <Textarea
                          rows={2}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Uma descrição curta para apresentar a obra."
                        />
                      </div>

                    </div>
                  </div>

                  <div className={`rounded-2xl border border-border/70 bg-background/35 p-3 sm:p-4 ${creationStep !== 2 ? "hidden" : ""}`}>
                    <div className="mb-3 flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      <div>
                        <h3 className="font-semibold">Estrutura e arquivos</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Defina se a obra agrupa vários conteúdos e envie a capa principal.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {workType === "book" || workType === "hq" || workType === "gibi" ? (
                        <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-card/45 p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Layers3 className="size-4 text-primary" />
                              <Label htmlFor="collection-toggle" className="text-sm font-medium">
                                Esta obra é uma coleção?
                              </Label>
                            </div>
                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                              Ative para sagas, séries ou coletâneas que terão vários livros, volumes ou edições dentro do mesmo cadastro.
                            </p>
                          </div>
                          <Switch
                            id="collection-toggle"
                            checked={isCollection}
                            onCheckedChange={setIsCollection}
                          />
                        </div>
                      ) : null}

                      {workType === "book" && !isCollection ? (
                        <div className="space-y-3">
                          <div>
                            <Label className="mb-2 block">Formato do livro *</Label>
                            <div className="grid grid-cols-2 gap-3">
                              {(["epub", "pdf"] as const).map((format) => (
                                <button
                                  key={format}
                                  type="button"
                                  onClick={() => {
                                    setBookFileFormat(format);
                                    setSingleBookFile(null);
                                    setCover(null);
                                  }}
                                  className={`rounded-xl border p-4 text-left transition ${
                                    bookFileFormat === format
                                      ? "border-primary bg-primary/10"
                                      : "border-border/70 bg-card/45 hover:border-primary/40"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {format === "epub" ? <BookOpen className="size-5 text-primary" /> : <FileUp className="size-5 text-primary" />}
                                    <div>
                                      <p className="text-sm font-semibold">{format.toUpperCase()}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {format === "epub" ? "Capa extraída automaticamente" : "Necessário enviar uma capa"}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                            <div className="mb-3 flex items-start gap-3">
                              <FileUp className="mt-0.5 size-5 text-primary" />
                              <div>
                                <Label>Arquivo do livro *</Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {bookFileFormat === "epub"
                                    ? "Selecione um EPUB. A capa será extraída automaticamente."
                                    : bookFileFormat === "pdf"
                                      ? "Selecione um PDF. Depois envie a capa."
                                      : "Selecione um EPUB ou PDF. O formato será identificado automaticamente."}
                                </p>
                              </div>
                            </div>
                            <Input
                              type="file"
                              accept={bookFileFormat === "epub" ? ".epub,application/epub+zip" : bookFileFormat === "pdf" ? ".pdf,application/pdf" : ".epub,.pdf,application/epub+zip,application/pdf"}
                              onChange={(event) => void handleSingleBookFile(event.target.files?.[0] ?? null)}
                            />
                            {singleBookFile ? (
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-background/55 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2 text-xs">
                                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                  <span className="truncate">{singleBookFile.name}</span>
                                </div>
                                {bookFileFormat ? <Badge variant="outline">{bookFileFormat.toUpperCase()}</Badge> : null}
                              </div>
                            ) : null}
                            {extractingEpubCover ? <p className="mt-2 text-xs text-muted-foreground">Identificando a capa do EPUB…</p> : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4">
                        {workType !== "book" || isCollection || bookFileFormat === "pdf" ? (
                          <div className="rounded-xl border border-dashed border-border/80 bg-background/45 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <ImagePlus className="size-4 text-primary" />
                              <div>
                                <Label>Capa *</Label>
                                {bookFileFormat === "pdf" ? <p className="mt-0.5 text-[11px] text-muted-foreground">Arquivos PDF precisam de uma capa.</p> : null}
                              </div>
                            </div>
                            <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
                            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP ou GIF de até 10 MB.</p>
                            {cover ? <p className="mt-2 truncate text-xs font-medium">{cover.name}</p> : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                              <ImagePlus className="mt-0.5 size-5 text-primary" />
                              <div>
                                <p className="text-sm font-medium">Capa automática</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {extractingEpubCover ? "Extraindo a capa do arquivo EPUB…" : cover ? "A capa foi identificada dentro do EPUB." : "Selecione o EPUB para identificar a capa automaticamente."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}


                      </div>
                    </div>
                  </div>

                  <div className={`rounded-2xl border border-border/70 bg-background/35 p-3 sm:p-4 ${creationStep !== 3 ? "hidden" : ""}`}>
                    <div className="mb-3 flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                      <div>
                        <h3 className="font-semibold">Sinopse e publicação</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Descreva sua obra e defina onde ela será publicada.</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Sinopse *</Label>
                          <span className="text-[11px] text-muted-foreground">Pode ser mais detalhada</span>
                        </div>
                        <Textarea
                          rows={3}
                          value={synopsis}
                          onChange={(event) => setSynopsis(event.target.value)}
                          placeholder="Conte sobre a história, universo e proposta da obra."
                        />
                      </div>
                    </div>

                    {mode === "studio" ? (
                      <div className={`grid gap-3 ${isEditoraLocked ? "" : "sm:grid-cols-2"}`}>
{isAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCreationDestination("catalog");
                            if (!isAdmin) setPrice("0,00");
                          }}
                          className={`rounded-xl border p-4 text-left transition ${
                            creationDestination === "catalog"
                              ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                              : "border-border/70 bg-background/45 hover:border-primary/35 hover:bg-muted/50"
                          }`}
                        >
                          <Globe2
                            className={`size-5 ${
                              creationDestination === "catalog" ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <span className="mt-3 block text-sm font-semibold">Catálogo</span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                            {isAdmin
                              ? "A obra fica pública. Com preço acima de R$ 0,00, o botão Comprar usa a Stripe principal; com R$ 0,00, a leitura é gratuita."
                              : "A obra fica pública e gratuita no Catálogo. Para cobrar pela obra, use o Marketplace."}
                          </span>
                        </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => {
                              setCreationDestination("marketplace");
                              if (!Number.isFinite(creationPriceCents) || creationPriceCents < 100) {
                                setPrice("29,90");
                              }
                            }}
                            className={`rounded-xl border p-4 text-left transition ${
                              creationDestination === "marketplace"
                                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                                : "border-border/70 bg-background/45 hover:border-primary/35 hover:bg-muted/50"
                            }`}
                          >
                            <Store
                              className={`size-5 ${
                                creationDestination === "marketplace" ? "text-primary" : "text-muted-foreground"
                              }`}
                            />
                            <span className="mt-3 block text-sm font-semibold">Marketplace</span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              A obra vira um anúncio pago e o conteúdo é liberado ao comprador após o pagamento.
                            </span>
                          </button>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(
                          [
                            ["public", "Público", "Vai para o Catálogo", Globe2],
                            ["private", "Privado", "Somente você", LockKeyhole],
                            ["invite", "Por convite", "Somente pelo link", Link2],
                          ] as const
                        ).map(([value, label, descriptionText, Icon]) => (
                          <button
                            type="button"
                            key={value}
                            onClick={() => {
                              setVisibility(value);
                            }}
                            className={`rounded-xl border p-4 text-left transition ${
                              visibility === value
                                ? "border-primary bg-primary/10"
                                : "border-border/70 bg-background/45 hover:border-primary/35 hover:bg-muted/50"
                            }`}
                          >
                            <Icon className={`size-4 ${visibility === value ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="mt-3 block text-sm font-semibold">{label}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{descriptionText}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-4">
                        <div className="space-y-1.5 rounded-xl border border-border/60 bg-card/25 p-3">
                          <Label>Preço (R$)</Label>
                          <Input
                            value={price}
                            onChange={(event) => setPrice(event.target.value)}
                            inputMode="decimal"
                            disabled={mode === "studio" && creationDestination === "catalog" && !isAdmin}
                          />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {mode === "studio"
                              ? creationDestination === "marketplace"
                                ? "Obrigatório. Este será o preço inicial do anúncio no Marketplace."
                                : isAdmin
                                  ? "Catálogo do Admin: R$ 0,00 libera leitura gratuita; a partir de R$ 1,00 exibe o botão Comprar e usa a Stripe principal."
                                  : "No Catálogo de criadores a publicação é gratuita. Para vender, use o Marketplace."
                              : visibility === "public"
                                ? "Catálogo do Admin: R$ 0,00 = leitura gratuita; a partir de R$ 1,00 = compra direta pela Stripe principal."
                                : "Este preço só é usado quando a obra estiver à venda."}
                          </p>
                        </div>
                    </div>

                    {mode === "admin" && visibility === "public" ? (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <span className="text-sm font-semibold">Venda automática pelo Catálogo</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          O preço controla o acesso: R$ 0,00 libera leitura; qualquer preço válido a partir de R$ 1,00 exibe Comprar e usa a Stripe principal.
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className={`rounded-2xl border border-border/70 bg-background/35 p-3 sm:p-4 ${creationStep !== 4 ? "hidden" : ""}`}>
                    <div className="mb-4 flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                      <div>
                        <h3 className="font-semibold">Revisão e responsabilidade</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Revise os dados e confirme o termo para concluir.</p>
                      </div>
                    </div>

                    <div className="mb-3 flex min-w-0 gap-3 rounded-xl border border-border/60 bg-card/30 p-3">
                      {coverPreviewUrl ? (
                        <img src={coverPreviewUrl} alt="Capa da obra" className="h-24 w-16 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="grid h-24 w-16 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><ImageIcon className="size-7" /></div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Confira antes de publicar</p>
                        <h4 className="truncate font-display text-lg">{title.trim() || "Sem título"}</h4>
                        <p className="truncate text-xs text-muted-foreground">{author.trim() || "Autor não informado"}</p>
                        <p className="text-xs text-muted-foreground">{getWorkTypeLabel(workType)} · {category || "Sem categoria"}</p>
                        <p className="text-xs text-muted-foreground">{mode === "studio" ? (creationDestination === "catalog" ? "Catálogo" : "Marketplace") : getVisibilityLabel(visibility)} · {mode === "studio" && creationDestination === "catalog" && !isAdmin ? "Grátis" : `R$ ${formatPriceCents(creationPriceCents)}`}</p>
                        {singleBookFile ? <p className="truncate text-xs text-muted-foreground" title={singleBookFile.name}>Arquivo: {singleBookFile.name}</p> : null}
                      </div>
                    </div>

                    {mode === "studio" ? (
                      <div className="mb-4 rounded-xl border border-border/70 bg-card/35 p-4">
                        {isEditoraLocked ? (
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div>
                              <p className="text-sm font-semibold">Editora autorizada</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Contas Editora publicam sempre com esta base de direitos, registrada
                                automaticamente para moderação.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold">Como você pode comercializar esta obra?</p>
                                <p className="mt-1 text-xs text-muted-foreground">Escolha uma opção. Essa declaração fica registrada para moderação e proteção do Marketplace.</p>
                              </div>
                              <Link to="/termos-vendedor" className="mt-2 text-xs font-semibold text-primary hover:underline sm:mt-0">Ver termos do vendedor</Link>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              {[
                                ["author", "Sou autor(a)", "Criei a obra e detenho os direitos necessários."],
                                ["publisher", "Editora autorizada", "Represento uma editora ou distribuidor autorizado."],
                                ["licensed_distributor", "Possuo licença", "Tenho licença válida para distribuir e vender."],
                              ].map(([value, label, helper]) => {
                                const selected = rightsBasis === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setRightsBasis(value as "author" | "publisher" | "licensed_distributor")}
                                    className={`min-h-20 rounded-xl border p-3 text-left transition ${
                                      selected
                                        ? "border-primary bg-primary/10 ring-1 ring-primary/25"
                                        : "border-border/65 bg-background/30 hover:border-primary/30"
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                      <CheckCircle2 className={`size-4 ${selected ? "text-primary" : "text-muted-foreground/55"}`} /> {label}
                                    </span>
                                    <span className="mt-2 block text-[11px] leading-5 text-muted-foreground">{helper}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    <div className="rounded-xl border bg-card/35 p-4">
                      <div className="text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Termo de responsabilidade do criador</strong>
                        <p className="mt-2">
                          Declaro possuir as licenças, autorizações e demais direitos necessários para hospedar e disponibilizar todo conteúdo enviado. Comprometo-me a não enviar material ilícito, pirateado ou que viole direitos autorais, de imagem, privacidade ou outros direitos de terceiros. Reconheço que sou responsável pelo conteúdo enviado e concordo em colaborar com pedidos de verificação e remoção.
                        </p>
                      </div>
                      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        />
                        <span>Li, compreendi e aceito o termo de responsabilidade.</span>
                      </label>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">Os dados poderão ser editados depois da publicação.</p>
                  </div>

                  <div role="status" aria-live="polite" className={creationStepError ? "mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" : "sr-only"}>
                    {creationStepError}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/65 pt-4">
                    <Button type="button" variant="outline" onClick={() => moveCreationStep(-1)} disabled={creationStep === 1 || createManga.isPending} className="min-w-24 rounded-xl">
                      <ArrowLeft className="size-4" /> Voltar
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{creationStep} de 4</span>
                    {creationStep < 4 ? (
                      <Button type="button" onClick={() => moveCreationStep(1)} className="min-w-24 rounded-xl">
                        Próximo <ArrowRight className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={createManga.isPending}
                        onClick={() => {
                          for (const step of [1, 2, 3, 4] as const) {
                            const error = validateCreationStep(step);
                            if (error) {
                              setCreationStep(step);
                              setCreationStepError(error);
                              return;
                            }
                          }
                          setCreationStepError("");
                          createManga.mutate();
                        }}
                        className="min-w-32 rounded-xl"
                      >
                        {createManga.isPending ? "Criando…" : "Criar obra"}
                      </Button>
                    )}
                  </div>

                  {lastInviteLink ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-sm font-medium">Link privado de convite</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{lastInviteLink}</p>
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(lastInviteLink);
                          toast.success("Link copiado");
                        }}
                      >
                        Copiar link
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="hidden min-w-0 xl:sticky xl:top-28 xl:block xl:self-start">
                  <LiveWorkPreview {...livePreviewProps} />
                </div>
              </div>
              </>}
            </section>
          </TabsContent>
        ) : null}

        {mode === "studio" ? (
          <TabsContent value="volumes" data-tour="studio-content" className="mt-0 min-w-0">
            <section className="ink-panel rounded-2xl p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="sr-only">Adicionar conteúdo</h2>
                {selectedWork ? (
                  <Badge variant="outline" className="ml-auto w-fit">
                    {studioVolumes.length} conteúdo{studioVolumes.length === 1 ? "" : "s"} cadastrado{studioVolumes.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
                <div className="rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    <div>
                      <h3 className="font-semibold">Escolha a obra</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Pesquise e clique na obra que receberá o novo conteúdo.</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="relative block">
                      <span className="sr-only">Buscar obra</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={publicationSearch}
                        onChange={(event) => setPublicationSearch(event.target.value)}
                        placeholder="Buscar obra…"
                        className="pl-9"
                      />
                    </label>
                    <select
                      value={publicationTypeFilter}
                      onChange={(event) => setPublicationTypeFilter(event.target.value as WorkType | "all")}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">Todos os tipos</option>
                      {WORK_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 grid max-h-[660px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                    {filteredPublicationWorks.map((manga) => {
                      const isSelected = mangaId === manga.id;
                      return (
                        <button
                          type="button"
                          key={manga.id}
                          onClick={() => setMangaId(manga.id)}
                          aria-label={`Selecionar ${manga.title}`}
                          aria-pressed={isSelected}
                          className={`group relative overflow-hidden rounded-xl border bg-card/45 text-left transition ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border/70 bg-card/45 hover:-translate-y-0.5 hover:border-primary/35"
                          }`}
                        >
                          <div className="aspect-[7/10] overflow-hidden bg-muted [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none">
                            <PublicationCover coverUrl={manga.cover_url} title={manga.title} workType={manga.work_type} />
                          </div>
                          {isSelected ? (
                            <span className="pointer-events-none absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                              <CheckCircle2 className="size-4" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {!filteredPublicationWorks.length ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                        Nenhuma obra encontrada com esses filtros.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="xl:sticky xl:top-24 xl:self-start">
                  {selectedWork ? (
                    <div className="rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5">
                      <div className="mb-5 flex items-start gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                        <div>
                          <h3 className="font-semibold">Configure o conteúdo</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">Revise a obra selecionada e prepare os arquivos para envio.</p>
                        </div>
                      </div>

                      <div className="mb-5 flex gap-4 rounded-xl border border-border/70 bg-card/45 p-3">
                        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm [&_.book-cover]:h-full [&_.book-cover]:w-full [&_.book-cover]:rounded-none">
                          <PublicationCover coverUrl={selectedWork.cover_url} title={selectedWork.title} workType={selectedWork.work_type} />
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{getWorkTypeLabel(selectedWork.work_type)}</Badge>
                            {selectedWork.is_collection ? <Badge variant="outline">Coleção</Badge> : null}
                          </div>
                          <h4 className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-tight">{selectedWork.title}</h4>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{selectedWork.author || "Autor não informado"}</p>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {selectedWorkType === "book"
                              ? selectedWork.is_collection
                                ? "Adicione um ou mais livros em EPUB ou PDF à coleção."
                                : "Livro único: apenas um arquivo EPUB ou PDF pode ficar associado a esta obra."
                              : "Adicione volumes ou capítulos usando os formatos compatíveis."}
                          </p>
                        </div>
                      </div>

                      {selectedWorkType === "book" && !selectedWork.is_collection && studioVolumes.length ? (
                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                            <div>
                              <p className="text-sm font-semibold">Livro já possui arquivo</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Este livro é único e já possui um EPUB cadastrado. Para substituir o arquivo, remova a publicação atual e envie o novo EPUB.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {selectedWorkType !== "book" ? (
                              <div className="space-y-2 sm:col-span-2">
                                <Label>Cadastrar como</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {(["volume", "chapter"] as UnitKind[]).map((kind) => (
                                    <button
                                      type="button"
                                      key={kind}
                                      onClick={() => setUnitKind(kind)}
                                      className={`rounded-xl border p-3 text-left transition ${
                                        unitKind === kind
                                          ? "border-primary bg-primary/10"
                                          : "border-border/70 bg-background/45 hover:border-primary/35"
                                      }`}
                                    >
                                      <span className="text-sm font-semibold">{unitLabel(kind)}</span>
                                      <span className="mt-1 block text-[11px] text-muted-foreground">
                                        {kind === "volume" ? "Edição ou volume completo" : "Capítulo individual"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-border/70 bg-card/40 p-3 sm:col-span-2">
                                <p className="text-xs text-muted-foreground">Tipo de publicação</p>
                                <p className="mt-1 text-sm font-semibold">Livro · EPUB ou PDF</p>
                              </div>
                            )}

                            {(selectedWorkType !== "book" || selectedWork.is_collection) ? (
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label>{selectedWorkType === "book" ? "Número inicial do livro" : `Número inicial do ${unitKind === "chapter" ? "capítulo" : "volume"}`}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={volumeNumber}
                                  onChange={(event) => setVolumeNumber(event.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Ao enviar vários arquivos, a numeração continuará automaticamente a partir deste número.</p>
                              </div>
                            ) : null}
                          </div>

                          <div hidden={selectedWorkType === "book"} className="rounded-xl border border-border/70 bg-card/35 p-4">
                            <div className="mb-3">
                              <Label htmlFor="processing-mode">Processamento das páginas</Label>
                              <p className="mt-1 text-xs text-muted-foreground">O processamento acontece neste dispositivo antes do envio.</p>
                            </div>
                            <select
                              id="processing-mode"
                              value={processingMode}
                              onChange={(event) => setProcessingMode(event.target.value as MangaProcessingMode)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="auto">Automático — otimizar e detectar páginas duplas</option>
                              <option value="manga">Mangá — páginas duplas da direita para esquerda</option>
                              <option value="original">Original — somente extrair, sem alterar páginas</option>
                            </select>

                            {processingMode !== "original" ? (
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 bg-background/45 px-3 text-sm">
                                  <Checkbox checked={removeMargins} onCheckedChange={(checked) => setRemoveMargins(checked === true)} />
                                  Remover margens vazias
                                </label>
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium">Resolução máxima</span>
                                  <select
                                    value={maxImageDimension}
                                    onChange={(event) => setMaxImageDimension(Number(event.target.value))}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  >
                                    <option value={1600}>1600 px · arquivo menor</option>
                                    <option value={2400}>2400 px · recomendado</option>
                                    <option value={3200}>3200 px · alta qualidade</option>
                                  </select>
                                </label>
                              </div>
                            ) : null}

                            <label className="mt-3 flex items-start gap-3 rounded-lg border border-border/70 bg-background/45 p-3 text-sm">
                              <Checkbox
                                className="mt-0.5"
                                checked={retainVolumeSource}
                                onCheckedChange={(checked) => setRetainVolumeSource(checked === true)}
                              />
                              <span>
                                Guardar arquivo original
                                <span className="mt-0.5 block text-xs text-muted-foreground">Mantém o arquivo para download e integração com o Desktop.</span>
                              </span>
                            </label>
                          </div>

                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-start gap-3"><Link2 className="mt-0.5 size-5 text-primary"/><div className="min-w-0 flex-1"><Label>Importar pasta do Google Drive</Label><p className="mt-1 text-xs text-muted-foreground">Compartilhe a pasta e os PDFs como "Qualquer pessoa com o link". O navegador verifica as páginas antes de salvar. Se um volume tiver zero páginas, reimporte a pasta para reparar automaticamente. Mantenha esta tela aberta até concluir.</p></div></div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input aria-label="Link da pasta do Google Drive" disabled={driveSyncing} value={driveFolderUrl} onChange={(e)=>setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..."/><Button type="button" variant="outline" disabled={!driveFolderUrl.trim()||driveSyncing} onClick={async()=>{try{setDriveSyncing(true);const j=await importDriveFolder({mangaId,folderUrl:driveFolderUrl,unitKind},setDriveProgress);toast.success(`${j.found} arquivo(s) encontrados · ${j.created} criado(s) · ${j.updated} atualizado(s) · ${j.skipped} preservado(s)`);setDriveFolderUrl("");await queryClient.invalidateQueries({queryKey:["studio-volumes",mangaId]});}catch(e){toast.error(e instanceof Error?e.message:"Falha ao importar pasta.");}finally{setDriveSyncing(false);setDriveProgress("");void queryClient.invalidateQueries({queryKey:["studio-volumes",mangaId]});void queryClient.invalidateQueries({queryKey:["studio-catalog-volumes"]});}}}>{driveSyncing?"Importando…":"Importar pasta"}</Button></div>{driveProgress ? <p role="status" className="mt-2 text-sm">{driveProgress}</p> : null}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {isSelectedBookCollection ? (
                              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                                <div className="flex items-start gap-3">
                                  <ImagePlus className="mt-0.5 size-5 text-primary" />
                                  <div>
                                    <Label>Capas dos livros</Label>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                      EPUB: a capa é extraída automaticamente do próprio arquivo. PDF: você precisa selecionar uma capa para cada livro.
                                    </p>
                                    {extractingCollectionCovers ? (
                                      <p className="mt-2 text-xs font-medium text-primary">Extraindo capas dos EPUBs…</p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-border/80 bg-background/45 p-4">
                                <div className="mb-3 flex items-start gap-2">
                                  <ImagePlus className="mt-0.5 size-4 text-primary" />
                                  <div>
                                    <Label>{selectedWorkType === "book" ? "Capa do arquivo" : "Capas das publicações"}</Label>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      {selectedWorkType === "book" ? "Obrigatória para PDF" : "Opcional"}
                                    </p>
                                  </div>
                                </div>
                                <Input
                                  key={`covers-${uploadInputKey}`}
                                  type="file"
                                  accept="image/*"
                                  multiple={selectedWorkType !== "book"}
                                  onChange={(event) => setVolumeCovers(Array.from(event.target.files ?? []))}
                                />
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  {selectedWorkType === "book"
                                    ? "EPUB usa a capa do próprio arquivo. Para PDF, selecione uma capa antes de iniciar o envio."
                                    : "Sem capa manual, a primeira página será usada automaticamente."}
                                </p>
                                {volumeCovers.filter(Boolean).length ? (
                                  <p className="mt-2 text-xs font-medium">
                                    {volumeCovers.filter(Boolean).length} capa{volumeCovers.filter(Boolean).length === 1 ? "" : "s"} selecionada{volumeCovers.filter(Boolean).length === 1 ? "" : "s"}
                                  </p>
                                ) : null}
                              </div>
                            )}

                            <div className="rounded-xl border border-dashed border-primary/35 bg-primary/5 p-4">
                              <div className="mb-3 flex items-start gap-2">
                                <FileUp className="mt-0.5 size-4 text-primary" />
                                <div>
                                  <Label>
                                    {selectedWorkType === "book"
                                      ? selectedWork.is_collection
                                        ? "Arquivos dos livros"
                                        : "Arquivo do livro"
                                      : unitKind === "chapter"
                                        ? "Arquivos dos capítulos"
                                        : "Arquivos dos volumes"}
                                  </Label>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">Obrigatório</p>
                                </div>
                              </div>
                              <Input
                                key={`volumes-${uploadInputKey}`}
                                type="file"
                                accept={
                                  selectedWorkType === "book"
                                    ? ".epub,.pdf,application/epub+zip,application/pdf"
                                    : ".pdf,.cbr,.cbz,.zip,.epub,.mobi,.azw3,.azw,.prc,application/pdf,application/epub+zip"
                                }
                                multiple={selectedWorkType !== "book" || selectedWork.is_collection}
                                onChange={(event) => void handleVolumeFilesChange(Array.from(event.target.files ?? []))}
                              />
                              <p className="mt-2 text-xs text-muted-foreground">
                                {selectedWorkType === "book"
                                  ? "Livros aceitam EPUB ou PDF."
                                  : "PDF, CBR, CBZ, ZIP, EPUB, MOBI, AZW/AZW3 e PRC."}
                              </p>
                            </div>
                          </div>

                          {volumeFiles.length ? (
                            <div className="rounded-xl border border-border/70 bg-card/35 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fila de envio · use as setas para ordenar</p>
                                <Badge variant="secondary">{volumeFiles.length} arquivo{volumeFiles.length === 1 ? "" : "s"}</Badge>
                              </div>
                              <ol className="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
                                {volumeFiles.map((file, fileIndex) => {
                                  const number = selectedWorkType === "book" && !selectedWork.is_collection
                                    ? 1
                                    : volumeNumber.trim() === "" ? "—" : Number(volumeNumber) + fileIndex;
                                  const label = selectedWorkType === "book" ? "Livro" : unitLabel(unitKind);
                                  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
                                  const assignedCover = volumeCovers[fileIndex] ?? null;
                                  return (
                                    <li key={`${file.name}-${file.lastModified}`} className="rounded-lg bg-background/50 px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{number}</span>
                                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                        {isSelectedBookCollection ? <Badge variant="outline">{extension.toUpperCase()}</Badge> : null}
                                        <span className="hidden shrink-0 text-muted-foreground sm:inline">{label}</span>
                                        <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" aria-label={`Mover ${file.name} para cima`} disabled={fileIndex === 0 || extractingCollectionCovers} onClick={() => moveVolumeFile(fileIndex, -1)}>↑</Button>
                                        <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" aria-label={`Mover ${file.name} para baixo`} disabled={fileIndex === volumeFiles.length - 1 || extractingCollectionCovers} onClick={() => moveVolumeFile(fileIndex, 1)}>↓</Button>
                                      </div>

                                      {isSelectedBookCollection && extension === "epub" ? (
                                        <div className="mt-2 flex items-center gap-2 pl-7">
                                          <CheckCircle2 className={`size-4 ${assignedCover ? "text-primary" : "text-muted-foreground"}`} />
                                          <span className={assignedCover ? "text-foreground" : "text-muted-foreground"}>
                                            {extractingCollectionCovers
                                              ? "Identificando capa do EPUB…"
                                              : assignedCover
                                                ? "Capa extraída automaticamente do EPUB"
                                                : "Capa não encontrada no EPUB"}
                                          </span>
                                        </div>
                                      ) : null}

                                      {isSelectedBookCollection && extension === "pdf" ? (
                                        <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-[1fr_auto] sm:items-center">
                                          <div>
                                            <p className={`font-medium ${assignedCover ? "text-foreground" : "text-destructive"}`}>
                                              {assignedCover ? `Capa: ${assignedCover.name}` : "Este PDF precisa de uma capa."}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">JPG, PNG, WebP ou GIF.</p>
                                          </div>
                                          <Input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="h-9 sm:max-w-64"
                                            onChange={(event) => setCollectionBookCover(fileIndex, event.target.files?.[0] ?? null)}
                                          />
                                        </div>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          ) : null}

                          <Button
                            className="w-full"
                            disabled={
                              !mangaId ||
                              !volumeFiles.length ||
                              extractingCollectionCovers ||
                              !collectionBookCoversReady
                            }
                            onClick={beginVolumeUpload}
                          >
                            <FileUp className="size-4" />
                            {extractingCollectionCovers ? "Identificando capas…" : "Iniciar envio em segundo plano"}
                          </Button>

                          {volumeUpload.state === "running" ? (
                            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                              O envio está em andamento. Novos lotes entram na fila automaticamente e até dois são processados ao mesmo tempo.
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-border/80 bg-background/20 p-8 text-center">
                      <div className="max-w-xs">
                        <Layers3 className="mx-auto size-10 text-muted-foreground/50" />
                        <h3 className="mt-4 font-semibold">Selecione uma obra</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Escolha uma obra na galeria ao lado para configurar o novo volume, capítulo ou livro.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedWork ? (
                <div className="mt-6 rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg">Conteúdo cadastrado</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedWorkType === "book" ? "Livros vinculados a esta obra." : "Volumes e capítulos já vinculados a esta obra."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {studioVolumes.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedVolumeIds((current) =>
                              current.size === studioVolumes.length
                                ? new Set()
                                : new Set(studioVolumes.map((volume) => volume.id)),
                            )
                          }
                        >
                          {selectedVolumeIds.size === studioVolumes.length ? "Desmarcar todos" : "Selecionar todos"}
                        </Button>
                      ) : null}
                      {selectedVolumeIds.size > 0 ? (
                        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                          <Trash2 className="size-4" /> Excluir selecionados ({selectedVolumeIds.size})
                        </Button>
                      ) : null}
                      <Badge variant="secondary">{studioVolumes.length} item{studioVolumes.length === 1 ? "" : "s"}</Badge>
                    </div>
                  </div>

                  {studioVolumes.length ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {studioVolumes.map((volume) => (
                        <div key={volume.id} className={cn("rounded-xl border bg-card/45 p-4 transition-colors", selectedVolumeIds.has(volume.id) ? "border-primary ring-1 ring-primary/30" : "border-border/70")}>
                          <div className="flex items-start justify-between gap-3">
                            <Checkbox
                              className="mt-0.5 shrink-0"
                              checked={selectedVolumeIds.has(volume.id)}
                              aria-label={`Selecionar publicação ${volume.number}`}
                              onCheckedChange={(checked) => {
                                setSelectedVolumeIds((current) => {
                                  const next = new Set(current);
                                  if (checked) next.add(volume.id); else next.delete(volume.id);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  {selectedWorkType === "book" ? `Livro ${volume.number}` : `${unitLabel(volume.unit_kind)} ${volume.number}`}
                                </p>
                                <Badge variant={volume.published ? "secondary" : "outline"} className="text-[10px]">
                                  {volume.published ? "Publicado" : "Oculto"}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{volume.title || "Sem título"}</p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{volume.page_count} pág.</span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVolumeToEdit({
                                id: volume.id,
                                number: volume.number,
                                title: volume.title,
                                published: volume.published,
                                unit_kind: volume.unit_kind as UnitKind,
                              })}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setVolumeToDelete({
                                id: volume.id,
                                number: volume.number,
                                unit_kind: volume.unit_kind as UnitKind,
                              })}
                            >
                              Apagar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhuma publicação cadastrada nesta obra.
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </TabsContent>
        ) : null}

        {mode === "admin" && isAdmin ? (
          <TabsContent value="users" className="mt-6">
            <AdminUsersPanel
              users={managedUsers}
              currentUserId={user.id}
              loading={loadingUsers}
              error={usersError instanceof Error ? usersError.message : usersError ? "Erro inesperado na listagem." : null}
              pending={manageUser.isPending}
              onRetry={() => void refetchUsers()}
              onAction={(action) => manageUser.mutate(action)}
              onCreateAccount={(input) => createUserAccount.mutate(input)}
              creatingAccount={createUserAccount.isPending}
              createdAccount={createdAccount}
              onDismissCreatedAccount={() => setCreatedAccount(null)}
            />
          </TabsContent>
        ) : null}
        {mode === "admin" && isAdmin ? (
          <TabsContent value="marketplace" className="mt-6">
            <MarketplaceAdminPanel />
          </TabsContent>
        ) : null}
        {mode === "admin" && isAdmin ? (
          <TabsContent value="donations" className="mt-6">
            <section className="ink-panel space-y-4 rounded-xl p-4 sm:p-6">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg">
                  <Heart className="size-5 text-primary" /> Doações via LivePix
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cole a URL pública do LivePix. O QR Code é opcional.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Input
                  value={donationMessage}
                  onChange={(event) => setDonationMessage(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="livepix-url">URL do LivePix</Label>
                <Input
                  id="livepix-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://livepix.gg/seu-link"
                  value={donationLink}
                  onChange={(event) => setDonationLink(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O botão de doação funcionará diretamente por este endereço, sem depender do
                  armazenamento de imagens.
                </p>
              </div>
              <div className="space-y-2">
                <Label>QR Code do LivePix (opcional)</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setDonationQr(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                disabled={!donationLink.trim() || saveDonation.isPending}
                onClick={() => saveDonation.mutate()}
              >
                Salvar área de doação
              </Button>
            </section>
          </TabsContent>
        ) : null}
        </div>
      </Tabs>
      <Dialog
        open={!!mangaToEdit}
        onOpenChange={(open) => {
          if (!open) setMangaToEdit(null);
        }}
      >
        <DialogContent className="max-w-xl [&_select]:text-base [&_textarea]:text-base [&_input]:text-base sm:[&_select]:text-sm sm:[&_textarea]:text-sm sm:[&_input]:text-sm">
          <DialogHeader>
            <DialogTitle>Editar obra</DialogTitle>
            <DialogDescription>
              Atualize apresentação, classificação e acesso da obra.
            </DialogDescription>
          </DialogHeader>
          {mangaToEdit ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span>Tipo de obra</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={mangaToEdit.work_type}
                  onChange={(event) => {
                    const nextType = event.target.value as WorkType;
                    setMangaToEdit({
                      ...mangaToEdit,
                      work_type: nextType,
                      is_collection: nextType === "manga" ? false : mangaToEdit.is_collection,
                    });
                  }}
                >
                  {WORK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span>Nova capa</span>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setEditCover(event.target.files?.[0] ?? null)}
                />
              </label>
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={mangaToEdit.title}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Autor *</Label>
                <Input
                  value={mangaToEdit.author}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, author: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição *</Label>
                <Textarea
                  rows={2}
                  value={mangaToEdit.description}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Input
                  value={mangaToEdit.category}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, category: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gêneros / tags</Label>
                <Input
                  value={mangaToEdit.genres}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, genres: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sinopse *</Label>
                <Textarea
                  rows={4}
                  value={mangaToEdit.synopsis}
                  onChange={(event) =>
                    setMangaToEdit({ ...mangaToEdit, synopsis: event.target.value })
                  }
                />
              </div>
              {mangaToEdit.work_type === "book" ||
              mangaToEdit.work_type === "hq" ||
              mangaToEdit.work_type === "gibi" ? (
                <label className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
                  <div>
                    <span className="text-sm font-medium">Coleção</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Ative quando a obra agrupar vários livros ou edições.
                    </span>
                  </div>
                  <Switch
                    checked={mangaToEdit.is_collection}
                    onCheckedChange={(checked) =>
                      setMangaToEdit({ ...mangaToEdit, is_collection: checked })
                    }
                  />
                </label>
              ) : null}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={12}
                  placeholder="0,00"
                  value={editPrice}
                  disabled={
                    (mode === "studio" && mangaToEdit.distribution_channel === "catalog" && !isAdmin) ||
                    mangaToEdit.visibility === "invite" ||
                    (mangaToEdit.visibility === "private" &&
                      mangaToEdit.distribution_channel === "unlisted")
                  }
                  onChange={(event) => {
                    const nextValue = sanitizePriceInput(event.target.value);
                    const cents = parsePriceCents(nextValue);

                    setEditPrice(nextValue);
                    setMangaToEdit({
                      ...mangaToEdit,
                      price_cents: Number.isFinite(cents) ? Math.max(0, cents) : 0,
                    });
                  }}
                  onBlur={() => {
                    const parsed = parsePriceCents(editPrice);
                    const cents = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

                    setEditPrice(formatPriceCents(cents));
                    setMangaToEdit((current) =>
                      current ? { ...current, price_cents: cents } : current,
                    );
                  }}
                />
                {mode === "studio" ? (
                  <p className="text-xs text-muted-foreground">
                    {mangaToEdit.visibility === "invite"
                      ? "Obras por convite não ficam à venda e não aparecem nas áreas públicas."
                      : mangaToEdit.visibility === "private" &&
                          mangaToEdit.distribution_channel === "unlisted"
                        ? "Obras privadas ficam visíveis somente para você e administradores."
                        : mangaToEdit.distribution_channel === "catalog"
                          ? isAdmin
                            ? "R$ 0,00 deixa a obra gratuita; a partir de R$ 1,00 ativa a compra direta pela Stripe principal."
                            : "Obras de criadores no Catálogo são gratuitas; use o Marketplace para vender."
                          : "Alterar o preço aqui também atualiza o anúncio do Marketplace."}
                  </p>
                ) : mangaToEdit.visibility === "public" ? (
                  <p className="text-xs text-muted-foreground">
                    R$ 0,00 libera leitura gratuita. A partir de R$ 1,00, o Catálogo exibe Comprar e entrega os códigos após o pagamento.
                  </p>
                ) : null}
              </div>
              {mode === "admin" ? (
                <>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Link oficial / licenciado para compra</Label>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="https://loja-oficial.com/produto/..."
                      value={mangaToEdit.licensed_purchase_url}
                      onChange={(event) =>
                        setMangaToEdit({ ...mangaToEdit, licensed_purchase_url: event.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Use a página oficial da editora, distribuidora ou loja autorizada. Se ficar vazio, o usuário verá um botão para buscar onde comprar oficialmente.
                    </p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nome da loja / fonte licenciada</Label>
                    <Input
                      placeholder="Ex.: Panini, editora oficial, loja autorizada"
                      value={mangaToEdit.licensed_store_name}
                      onChange={(event) =>
                        setMangaToEdit({ ...mangaToEdit, licensed_store_name: event.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{mode === "studio" ? "Destino" : "Visibilidade"}</Label>
                {mode === "studio" ? (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={
                      mangaToEdit.visibility === "invite"
                        ? "invite"
                        : mangaToEdit.visibility === "private" &&
                            mangaToEdit.distribution_channel === "unlisted"
                          ? "private"
                          : mangaToEdit.distribution_channel === "catalog"
                            ? "catalog"
                            : "marketplace"
                    }
                    onChange={(event) => {
                      const accessMode = event.target.value as
                        | "catalog"
                        | "marketplace"
                        | "invite"
                        | "private";

                      if (accessMode === "catalog") {
                        const nextPriceCents = isAdmin ? mangaToEdit.price_cents : 0;
                        setEditPrice(formatPriceCents(nextPriceCents));
                        setMangaToEdit({
                          ...mangaToEdit,
                          visibility: "public",
                          distribution_channel: "catalog",
                          price_cents: nextPriceCents,
                          catalog_sale_enabled: isAdmin && nextPriceCents >= 100,
                        });
                        return;
                      }

                      if (accessMode === "marketplace") {
                        const nextPriceCents =
                          mangaToEdit.price_cents < 100 ? 2990 : mangaToEdit.price_cents;
                        setEditPrice(formatPriceCents(nextPriceCents));
                        setMangaToEdit({
                          ...mangaToEdit,
                          visibility: "private",
                          distribution_channel: "marketplace",
                          price_cents: nextPriceCents,
                          catalog_sale_enabled: false,
                        });
                        return;
                      }

                      setEditPrice("0,00");
                      setMangaToEdit({
                        ...mangaToEdit,
                        visibility: accessMode === "invite" ? "invite" : "private",
                        distribution_channel: "unlisted",
                        price_cents: 0,
                        catalog_sale_enabled: false,
                      });
                    }}
                  >
                    <option value="catalog">Catálogo — público</option>
                    <option value="marketplace">Marketplace — venda paga</option>
                    <option value="invite">Somente por convite — não listado</option>
                    <option value="private">Privado — somente você</option>
                  </select>
                ) : (
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={mangaToEdit.visibility}
                    onChange={(event) => {
                      const nextVisibility = event.target.value as
                        | "public"
                        | "private"
                        | "invite";
                      const nextPriceCents =
                        nextVisibility === "public" ? mangaToEdit.price_cents : 0;

                      setEditPrice(formatPriceCents(nextPriceCents));
                      setMangaToEdit({
                        ...mangaToEdit,
                        visibility: nextVisibility,
                        price_cents: nextPriceCents,
                        catalog_sale_enabled:
                          nextVisibility === "public"
                            ? mangaToEdit.catalog_sale_enabled
                            : false,
                      });
                    }}
                  >
                    <option value="public">Público — Catálogo</option>
                    <option value="private">Privado</option>
                    <option value="invite">Por convite</option>
                  </select>
                )}
              </div>

              {mangaToEdit.visibility === "invite" ? (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Link de convite</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/manga/${mangaToEdit.slug}?invite=${mangaToEdit.invite_token}`
                          : `/manga/${mangaToEdit.slug}?invite=${mangaToEdit.invite_token}`}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        A obra deixa o Catálogo e o Marketplace. Só o dono, administradores e usuários que resgatarem este convite poderão acessar.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/manga/${mangaToEdit.slug}?invite=${mangaToEdit.invite_token}`;
                        void navigator.clipboard.writeText(link);
                        toast.success("Link de convite copiado");
                      }}
                    >
                      <Link2 className="size-4" /> Copiar convite
                    </Button>
                  </div>
                </div>
              ) : null}

              <Button
                className="sm:col-span-2"
                disabled={
                  !mangaToEdit.title.trim() ||
                  !mangaToEdit.description.trim() ||
                  !mangaToEdit.author.trim() ||
                  !mangaToEdit.synopsis.trim() ||
                  !mangaToEdit.category.trim() ||
                  updateManga.isPending
                }
                onClick={() => updateManga.mutate()}
              >
                Salvar alterações
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!bulkDeleteVolumes.isPending) setBulkDeleteOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {selectedVolumeIds.size} publicações?</DialogTitle>
            <DialogDescription>Esta ação remove todas as publicações selecionadas e não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={bulkDeleteVolumes.isPending} onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={bulkDeleteVolumes.isPending} onClick={() => bulkDeleteVolumes.mutate()}>
              {bulkDeleteVolumes.isPending ? "Excluindo…" : "Excluir selecionados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!volumeToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteVolume.isPending) setVolumeToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Apagar {volumeToDelete ? unitLabel(volumeToDelete.unit_kind) : "publicação"}{" "}
              {volumeToDelete?.number}?
            </DialogTitle>
            <DialogDescription>
              Esta ação remove a publicação, suas páginas e o arquivo original. Não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="destructive"
            disabled={deleteVolume.isPending}
            onClick={() => deleteVolume.mutate()}
          >
            {deleteVolume.isPending ? "Apagando…" : "Confirmar exclusão"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!volumeToEdit}
        onOpenChange={(open) => {
          if (!open) setVolumeToEdit(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar volume ou capítulo</DialogTitle>
            <DialogDescription>
              Altere a identificação e a disponibilidade deste volume.
            </DialogDescription>
          </DialogHeader>
          {volumeToEdit ? (
            <div className="grid gap-4">
              <label className="space-y-2">
                <span>Capa</span>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setEditVolumeCover(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="space-y-2">
                <span>Organização</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={volumeToEdit.unit_kind}
                  onChange={(event) =>
                    setVolumeToEdit({ ...volumeToEdit, unit_kind: event.target.value as UnitKind })
                  }
                >
                  <option value="volume">Volume</option>
                  <option value="chapter">Capítulo</option>
                </select>
              </label>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input
                  type="number"
                  min={0}
                  value={volumeToEdit.number}
                  onChange={(event) =>
                    setVolumeToEdit({
                      ...volumeToEdit,
                      number: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Título opcional</Label>
                <Input
                  value={volumeToEdit.title}
                  onChange={(event) =>
                    setVolumeToEdit({ ...volumeToEdit, title: event.target.value })
                  }
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-4">
                <Checkbox
                  checked={volumeToEdit.published}
                  onCheckedChange={(checked) =>
                    setVolumeToEdit({ ...volumeToEdit, published: checked === true })
                  }
                />
                <span className="text-sm font-medium">Disponível para leitura</span>
              </label>
              <Button
                disabled={!Number.isInteger(volumeToEdit.number) || volumeToEdit.number < 0 || updateVolume.isPending}
                onClick={() => updateVolume.mutate()}
              >
                Salvar volume
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!mangaToDelete}
        onOpenChange={(open) => {
          if (!open) setMangaToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar {mangaToDelete?.title}?</DialogTitle>
            <DialogDescription>
              {mode === "studio"
                ? "Esta ação remove permanentemente a sua obra, volumes, páginas e arquivos associados."
                : "Esta ação remove a obra, volumes, páginas e arquivos. O motivo ficará registrado."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "admin" ? (
              <>
                <Label>Motivo</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="copyright">Violação de direitos autorais</option>
                  <option value="illegal_content">Conteúdo ilícito</option>
                  <option value="creator_request">Solicitação do criador</option>
                  <option value="duplicate">Obra duplicada</option>
                  <option value="quality">Arquivo corrompido ou qualidade inadequada</option>
                  <option value="terms_violation">Violação dos termos da plataforma</option>
                  <option value="other">Outro motivo</option>
                </select>
                <Label>Detalhes</Label>
                <Textarea
                  value={deleteDetails}
                  onChange={(event) => setDeleteDetails(event.target.value)}
                  placeholder="Explique a decisão de remoção…"
                />
              </>
            ) : (
              <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-muted-foreground">
                Você está apagando uma obra criada pela sua conta. Esta ação é permanente e também remove o conteúdo associado.
              </p>
            )}
            <Button
              variant="destructive"
              className="w-full"
              disabled={(mode === "admin" && !deleteReason) || deleteManga.isPending}
              onClick={() => deleteManga.mutate()}
            >
              <Trash2 className="size-4" /> Apagar permanentemente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
  return mode === "admin" ? <ManagementNavigation area="admin">{workspace}</ManagementNavigation> : workspace;
}

export function AdminDashboardRoutePage() {
  return <AdminWorkspace mode="admin" section="dashboard" />;
}

export function AdminModerationRoutePage() {
  return <AdminWorkspace mode="admin" section="catalog" />;
}

export function AdminUsersRoutePage() {
  return <AdminWorkspace mode="admin" section="users" />;
}

export function AdminDonationsRoutePage() {
  return <AdminWorkspace mode="admin" section="donations" />;
}
