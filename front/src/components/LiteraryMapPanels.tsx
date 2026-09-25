import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  Bus,
  Car,
  Check,
  Clock3,
  ExternalLink,
  Footprints,
  ImagePlus,
  Layers3,
  Loader2,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Search,
  Star,
  Store,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchMapboxRoute,
  geocodeMapboxAddress,
  getMapboxAccessToken,
  loadMapboxGl,
  reverseGeocodeMapbox,
  type MapCoordinates,
  type MapboxRouteResult,
} from "@/lib/mapbox";
import { cn } from "@/lib/utils";

import { db, MAPBOX_TOKEN, DEFAULT_CENTER, INITIAL_ZOOM, NEARBY_ZOOM, LAST_LOCATION_STORAGE_KEY, LAST_LOCATION_MAX_AGE, Category, TravelMode, MapStyleMode, MAP_STYLE_STORAGE_KEY, MAP_STYLE_URLS, MAP_STYLE_OPTIONS, PlaceReview, LiteraryPlace, TravelOption, CATEGORY_OPTIONS, TRAVEL_META, isUsablePhotoUrl, placeInitials, distanceBetweenKm, formatDistanceKm, createMarkerFallback, createPopupFallback, categoryLabel, averageRating, routeOption, formatDuration, formatDistance, normalizeUrl } from "@/lib/literaryMapShared";

export function CategoryFilter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-background/45 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function PlaceVisual({
  place,
  className,
  large = false,
}: {
  place: LiteraryPlace;
  className?: string;
  large?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = isUsablePhotoUrl(place.photo_url) && !imageFailed;

  if (showPhoto) {
    return (
      <img
        src={place.photo_url!}
        alt={place.name}
        className={cn("object-cover", className)}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative isolate flex shrink-0 overflow-hidden border border-border/50 bg-[radial-gradient(circle_at_25%_20%,hsl(var(--primary)/.22),transparent_38%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--muted)/.58))]",
        className,
      )}
      aria-label={`${place.name} sem foto`}
      role="img"
    >
      <div className="absolute -right-5 -top-6 size-24 rounded-full border border-primary/10 bg-primary/5" />
      <div className="absolute -bottom-8 -left-7 size-28 rounded-full border border-foreground/5 bg-foreground/[0.025]" />

      <div
        className={cn(
          "relative z-10 flex h-full w-full flex-col items-center justify-center text-center",
          large ? "gap-3 p-6" : "gap-1.5 p-2",
        )}
      >
        <span
          className={cn(
            "grid place-items-center rounded-2xl border border-primary/20 bg-primary/10 font-display font-bold tracking-tight text-primary shadow-inner",
            large ? "size-16 text-xl" : "size-11 text-sm",
          )}
        >
          {placeInitials(place.name)}
        </span>

        {large ? (
          <>
            <div>
              <p className="text-sm font-semibold">Ponto literário</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Foto ainda não adicionada</p>
            </div>
            <Store className="size-4 text-muted-foreground/70" />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function PlaceListCard({
  place,
  active,
  distanceKm,
  onSelect,
  onRoute,
}: {
  place: LiteraryPlace;
  active: boolean;
  distanceKm: number | null;
  onSelect: () => void;
  onRoute: () => void;
}) {
  const verified = place.literary_place_confirmations.length > 0;
  const rating = averageRating(place);
  return (
    <article
      className={cn(
        "rounded-[1.35rem] border bg-card/60 p-3 transition",
        active
          ? "border-primary/60 shadow-[0_12px_34px_-22px_var(--primary)]"
          : "border-border/60 hover:border-border",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full gap-3 text-left">
        <PlaceVisual place={place} className="size-24 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-semibold">{place.name}</h2>
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full",
                verified ? "bg-emerald-500" : "bg-amber-500",
              )}
              title={verified ? "Confirmado" : "Aguardando confirmação"}
            />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {place.address}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />{" "}
              {rating ? rating.toFixed(1) : "Novo"}
            </span>
            <span>•</span>
            <span>{place.literary_place_reviews.length} avaliações</span>
            {distanceKm !== null ? (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                  <LocateFixed className="size-3" />
                  {formatDistanceKm(distanceKm)}
                </span>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {place.categories.slice(0, 4).map((category) => (
              <Badge
                key={category}
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-[10px]"
              >
                {categoryLabel(category)}
              </Badge>
            ))}
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <span
          className={cn(
            "text-[11px] font-semibold",
            verified ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {verified
            ? `Confirmado por ${place.literary_place_confirmations.length}`
            : "Aguardando validação"}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs"
          onClick={onRoute}
        >
          <Navigation className="size-3.5" /> Como chegar
        </Button>
      </div>
    </article>
  );
}

export function PlaceDetails({
  place,
  userId,
  rating,
  reviewBody,
  onRating,
  onReviewBody,
  onConfirm,
  onReview,
  onRoute,
  confirmPending,
  reviewPending,
}: {
  place: LiteraryPlace;
  userId: string | null;
  rating: number;
  reviewBody: string;
  onRating: (rating: number) => void;
  onReviewBody: (body: string) => void;
  onConfirm: () => void;
  onReview: () => void;
  onRoute: () => void;
  confirmPending: boolean;
  reviewPending: boolean;
}) {
  const verified = place.literary_place_confirmations.length > 0;
  const ownConfirmation =
    !!userId && place.literary_place_confirmations.some((item) => item.user_id === userId);
  const isCreator = !!userId && place.created_by === userId;
  const ratingAverage = averageRating(place);

  return (
    <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/65">
      <PlaceVisual place={place} large className="aspect-[16/8] w-full" />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">{place.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" /> {place.address}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-background/55 px-3 py-1.5 text-sm font-semibold">
            <Star className="size-4 fill-amber-400 text-amber-400" />{" "}
            {ratingAverage ? ratingAverage.toFixed(1) : "Novo"}
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex items-center gap-2 rounded-2xl border p-3 text-xs",
            verified
              ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
              : "border-amber-500/25 bg-amber-500/8 text-amber-300",
          )}
        >
          {verified ? <BadgeCheck className="size-4" /> : <Clock3 className="size-4" />}
          <span>
            {verified
              ? `Local confirmado por ${place.literary_place_confirmations.length} leitor${place.literary_place_confirmations.length === 1 ? "" : "es"}.`
              : "Este local ainda não foi confirmado por outro usuário."}
          </span>
        </div>

        {place.description ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{place.description}</p>
        ) : null}

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            O que você encontra aqui
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {place.categories.map((category) => (
              <div
                key={category}
                className="rounded-2xl border border-border/60 bg-background/35 p-3 text-sm font-semibold"
              >
                {CATEGORY_OPTIONS.find((item) => item.value === category)?.icon}{" "}
                {categoryLabel(category)}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button className="rounded-xl" onClick={onRoute}>
            <Navigation className="size-4" /> Como chegar
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={place.curated || confirmPending || ownConfirmation || isCreator}
            onClick={onConfirm}
          >
            {confirmPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {place.curated
              ? "Curadoria BookSyde"
              : isCreator
                ? "Seu cadastro"
                : ownConfirmation
                  ? "Você confirmou"
                  : "Confirmar local"}
          </Button>
        </div>

        {place.website_url || place.instagram_url ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {place.website_url ? (
              <ExternalLinkButton href={place.website_url}>Site</ExternalLinkButton>
            ) : null}
            {place.instagram_url ? (
              <ExternalLinkButton href={place.instagram_url}>Instagram</ExternalLinkButton>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 border-t border-border/55 pt-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            <h3 className="font-semibold">Avaliações e comentários</h3>
          </div>
          {place.curated ? (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              Este é um local inicial da curadoria BookSyde. As avaliações da comunidade ficam
              disponíveis para os locais cadastrados diretamente pelos usuários.
            </div>
          ) : (
            <>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onRating(value)}
                    aria-label={`${value} estrelas`}
                  >
                    <Star
                      className={cn(
                        "size-6",
                        value <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/45",
                      )}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewBody}
                onChange={(event) => onReviewBody(event.target.value)}
                maxLength={1200}
                rows={3}
                placeholder="Conte para outros leitores como é esse lugar..."
                className="mt-3 rounded-2xl"
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 rounded-full"
                disabled={reviewPending}
                onClick={onReview}
              >
                {reviewPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Star className="size-4" />
                )}
                Salvar avaliação
              </Button>
            </>
          )}

          <div className="mt-5 space-y-3">
            {place.literary_place_reviews.length ? (
              [...place.literary_place_reviews]
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                .slice(0, 8)
                .map((review) => (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-border/55 bg-background/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold">
                        {review.profiles?.display_name ?? "Leitor BookSyde"}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" /> {review.rating}
                      </span>
                    </div>
                    {review.body ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{review.body}</p>
                    ) : null}
                  </article>
                ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Ainda não há comentários. Seja o primeiro a avaliar.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DirectionsPanel({
  place,
  options,
  activeMode,
  loading,
  onMode,
  onClose,
}: {
  place: LiteraryPlace;
  options: Partial<Record<TravelMode, TravelOption>>;
  activeMode: TravelMode;
  loading: boolean;
  onMode: (mode: TravelMode) => void;
  onClose: () => void;
}) {
  const active = options[activeMode];
  return (
    <div className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 max-h-[min(48dvh,360px)] overflow-y-auto rounded-[1.35rem] border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[min(520px,calc(100%-40px))] sm:max-h-none sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Como chegar
          </p>
          <h3 className="mt-1 truncate font-semibold">{place.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Da sua localização atual até {place.address}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border/60 bg-background/45"
        >
          <X className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid min-h-28 place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
            {(Object.keys(TRAVEL_META) as TravelMode[]).map((mode) => {
              const meta = TRAVEL_META[mode];
              const Icon = meta.icon;
              const option = options[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!option}
                  onClick={() => onMode(mode)}
                  className={cn(
                    "rounded-2xl border px-2 py-2.5 text-center transition",
                    activeMode === mode
                      ? "border-primary/55 bg-primary/12 text-foreground"
                      : "border-border/60 bg-background/35 text-muted-foreground",
                  )}
                >
                  <Icon className="mx-auto size-4" />
                  <span className="mt-1 block text-[10px] font-bold sm:text-xs">{meta.label}</span>
                  <span className="mt-0.5 block text-[10px]">
                    {option ? formatDuration(option.durationSeconds) : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {active ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/55 bg-background/30 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-4">
                <strong>{formatDuration(active.durationSeconds)}</strong>
                <span className="text-muted-foreground">
                  {formatDistance(active.distanceMeters)}
                </span>
              </div>
              {active.approximate ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                  Estimativa
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                  Rota Mapbox
                </span>
              )}
            </div>
          ) : null}
          {activeMode === "motorcycle" || activeMode === "bus" ? (
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {activeMode === "motorcycle"
                ? "O Mapbox não possui perfil específico para moto; o trajeto usa a malha viária de carro e o tempo é uma estimativa."
                : "O Mapbox Directions não oferece transporte público; o trajeto exibido é uma estimativa visual baseada na rota viária."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AddPlaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<MapCoordinates | null>(null);
  const [findingAddress, setFindingAddress] = useState(false);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para adicionar um local.");
      if (!name.trim() || !address.trim()) throw new Error("Informe nome e endereço.");
      if (!coordinates) throw new Error("Localize o endereço antes de salvar.");
      if (!photo) throw new Error("Adicione uma foto real do local.");
      if (!categories.length) throw new Error("Marque pelo menos uma categoria.");

      const extension = (photo.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/${crypto.randomUUID()}.${extension || "jpg"}`;
      const { error: uploadError } = await supabase.storage
        .from("literary-place-photos")
        .upload(path, photo, {
          cacheControl: "3600",
          upsert: false,
          contentType: photo.type || "image/jpeg",
        });
      if (uploadError) throw uploadError;
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("literary-place-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        await supabase.storage.from("literary-place-photos").remove([path]);
        throw signedUrlError ?? new Error("Não foi possível preparar a foto do local.");
      }

      const { error } = await db.from("literary_places").insert({
        created_by: user.id,
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        photo_url: signedUrlData.signedUrl,
        categories,
        phone: phone.trim() || null,
        website_url: normalizeUrl(website),
        instagram_url: normalizeUrl(instagram),
      });
      if (error) {
        await supabase.storage.from("literary-place-photos").remove([path]);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["literary-places"] });
      toast.success("Local adicionado. Agora outro usuário pode confirmar a veracidade.");
      reset();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o local."),
  });

  async function findAddress() {
    if (!address.trim()) {
      toast.error("Digite o endereço que deseja localizar.");
      return;
    }
    setFindingAddress(true);
    try {
      const result = await geocodeMapboxAddress(address.trim());
      setCoordinates({ longitude: result.longitude, latitude: result.latitude });
      setAddress(result.address);
      toast.success("Endereço localizado no mapa.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Endereço não encontrado.");
    } finally {
      setFindingAddress(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não disponibilizou localização.");
      return;
    }
    setFindingAddress(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        void reverseGeocodeMapbox(current)
          .then((result) => {
            setCoordinates(current);
            setAddress(result.address);
            toast.success("Localização atual selecionada.");
          })
          .finally(() => setFindingAddress(false));
      },
      () => {
        setFindingAddress(false);
        toast.error("Não foi possível acessar sua localização.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function toggleCategory(category: Category) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function reset() {
    setName("");
    setAddress("");
    setDescription("");
    setPhone("");
    setWebsite("");
    setInstagram("");
    setCategories([]);
    setPhoto(null);
    setCoordinates(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !createMutation.isPending) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-[1.5rem]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Adicionar ao Mapa Literário</DialogTitle>
          <DialogDescription>
            Cadastre um lugar real. O pin ficará laranja até outro usuário confirmar o local.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <label className="group relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-[1.35rem] border border-dashed border-border bg-background/35 text-center">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Prévia do local"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="p-4 text-xs text-muted-foreground">
                <ImagePlus className="mx-auto mb-2 size-7" />
                Foto obrigatória
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              className="sr-only"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="space-y-3">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Nome do sebo ou loja"
            />
            <div className="space-y-2">
              <Input
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setCoordinates(null);
                }}
                maxLength={300}
                placeholder="Rua, número, bairro, cidade e estado"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={findingAddress || !MAPBOX_TOKEN}
                  onClick={() => void findAddress()}
                >
                  {findingAddress ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}{" "}
                  Localizar endereço
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={findingAddress}
                  onClick={useCurrentLocation}
                >
                  <LocateFixed className="size-4" /> Usar minha localização
                </Button>
              </div>
              <p
                className={cn(
                  "text-[11px]",
                  coordinates ? "text-emerald-400" : "text-muted-foreground",
                )}
              >
                {coordinates
                  ? `✓ Pin definido em ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                  : "O endereço precisa ser localizado para definir o pin."}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">O que é vendido neste local?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORY_OPTIONS.map((category) => {
              const active = categories.includes(category.value);
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => toggleCategory(category.value)}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm font-semibold transition",
                    active
                      ? "border-primary/50 bg-primary/12"
                      : "border-border/60 bg-background/35",
                  )}
                >
                  <span className="block text-lg">{category.icon}</span>
                  <span className="mt-1 block">{category.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1200}
          rows={3}
          placeholder="Descrição opcional: tipo de acervo, ambiente, informações úteis..."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={40}
            placeholder="Telefone (opcional)"
          />
          <Input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            maxLength={500}
            placeholder="Site (opcional)"
          />
          <Input
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            maxLength={500}
            placeholder="Instagram (opcional)"
          />
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-3 text-xs leading-5 text-amber-200">
          O pin ficará com borda laranja. Assim que outro usuário confirmar que o local existe, a
          borda passa para verde.
        </div>

        <Button
          className="w-full rounded-xl"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MapPin className="size-4" />
          )}
          Adicionar localização
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function MapSetupMessage() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-6 text-center">
      <div className="max-w-md rounded-[1.5rem] border border-border/70 bg-card/70 p-6">
        <MapPin className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 font-display text-xl font-bold">Mapa pronto para receber seu token</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Adicione seu token público do Mapbox em{" "}
          <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">
            VITE_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          no arquivo <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">.env</code> e
          reinicie o projeto.
        </p>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-[1.35rem] border border-dashed border-border/70 p-6 text-center">
      <div>
        <BookOpen className="mx-auto size-7 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ExternalLinkButton({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
    >
      <ExternalLink className="size-3.5" /> {children}
    </a>
  );
}

