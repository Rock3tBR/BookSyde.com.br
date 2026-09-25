import { Route } from "@/routes/mapa-literario";
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

import { configureMapStyle, fetchLiteraryPlaces, db, MAPBOX_TOKEN, DEFAULT_CENTER, INITIAL_ZOOM, NEARBY_ZOOM, LAST_LOCATION_STORAGE_KEY, LAST_LOCATION_MAX_AGE, Category, TravelMode, MapStyleMode, MAP_STYLE_STORAGE_KEY, MAP_STYLE_URLS, MAP_STYLE_OPTIONS, PlaceReview, LiteraryPlace, TravelOption, CATEGORY_OPTIONS, TRAVEL_META, isUsablePhotoUrl, placeInitials, distanceBetweenKm, formatDistanceKm, createMarkerFallback, createPopupFallback, categoryLabel, averageRating, routeOption, formatDuration, formatDistance, normalizeUrl } from "@/lib/literaryMapShared";
import { CategoryFilter, PlaceVisual, PlaceListCard, PlaceDetails, DirectionsPanel, AddPlaceDialog, MapSetupMessage, EmptyState } from "@/components/LiteraryMapPanels";

export function LiteraryMapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const mapStyleRef = useRef<MapStyleMode>("default");
  const initialViewportAppliedRef = useRef(false);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>("default");
  const [mapStyleLoading, setMapStyleLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<MapCoordinates | null>(null);
  const [travelOptions, setTravelOptions] = useState<Partial<Record<TravelMode, TravelOption>>>({});
  const [activeTravelMode, setActiveTravelMode] = useState<TravelMode>("car");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [userLocation, setUserLocation] = useState<MapCoordinates | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);

  const placesQuery = useQuery({
    queryKey: ["literary-places"],
    queryFn: fetchLiteraryPlaces,
  });

  const places = placesQuery.data ?? [];
  const filteredPlaces = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");

    const result = places.filter((place) => {
      const categoryMatches = activeCategory === "all" || place.categories.includes(activeCategory);
      if (!categoryMatches) return false;
      if (!normalized) return true;

      return `${place.name} ${place.address} ${place.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized);
    });

    if (!userLocation) return result;

    return [...result].sort(
      (a, b) => distanceBetweenKm(userLocation, a) - distanceBetweenKm(userLocation, b),
    );
  }, [activeCategory, places, query, userLocation]);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as {
        latitude?: number;
        longitude?: number;
        savedAt?: number;
      };

      if (
        typeof saved.latitude !== "number" ||
        typeof saved.longitude !== "number" ||
        typeof saved.savedAt !== "number" ||
        Date.now() - saved.savedAt > LAST_LOCATION_MAX_AGE
      ) {
        window.localStorage.removeItem(LAST_LOCATION_STORAGE_KEY);
        return;
      }

      setUserLocation({
        latitude: saved.latitude,
        longitude: saved.longitude,
      });
    } catch {
      window.localStorage.removeItem(LAST_LOCATION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;

    void navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (permission.state === "granted") {
          focusNearby(false);
        }
      })
      .catch(() => {
        // Alguns navegadores não implementam Permissions API para geolocalização.
      });
  }, []);

  useEffect(() => {
    if (
      !mapReady ||
      !userLocation ||
      query.trim() ||
      activeCategory !== "all" ||
      selectedPlaceId ||
      directionsOpen
    ) {
      return;
    }

    mapRef.current?.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: NEARBY_ZOOM,
      duration: 850,
      essential: true,
    });
  }, [activeCategory, directionsOpen, mapReady, query, selectedPlaceId, userLocation]);

  function focusNearby(showFeedback = true) {
    if (!navigator.geolocation) {
      if (showFeedback) {
        toast.error("Seu navegador não oferece suporte à localização.");
      }
      return;
    }

    setLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation: MapCoordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setUserLocation(nextLocation);
        setLocatingUser(false);

        try {
          window.localStorage.setItem(
            LAST_LOCATION_STORAGE_KEY,
            JSON.stringify({
              ...nextLocation,
              savedAt: Date.now(),
            }),
          );
        } catch {
          // O mapa continua funcionando mesmo com storage bloqueado.
        }

        mapRef.current?.flyTo({
          center: [nextLocation.longitude, nextLocation.latitude],
          zoom: NEARBY_ZOOM,
          duration: 900,
          essential: true,
        });

        if (showFeedback) {
          toast.success("Locais mais próximos primeiro.");
        }
      },
      (error) => {
        setLocatingUser(false);

        if (!showFeedback) return;

        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Permita o acesso à localização para ver os locais mais próximos.");
          return;
        }

        toast.error("Não conseguimos obter sua localização agora.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }

  useEffect(() => {
    const savedStyle = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
    if (savedStyle === "default" || savedStyle === "3d" || savedStyle === "navigation") {
      setMapStyle(savedStyle);
      mapStyleRef.current = savedStyle;
    }
  }, []);

  useEffect(() => {
    if (!selectedPlace || !user) {
      setReviewRating(5);
      setReviewBody("");
      return;
    }
    const ownReview = selectedPlace.literary_place_reviews.find(
      (review) => review.user_id === user.id,
    );
    setReviewRating(ownReview?.rating ?? 5);
    setReviewBody(ownReview?.body ?? "");
  }, [selectedPlace, user]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.error("[Mapbox] VITE_MAPBOX_ACCESS_TOKEN ausente no bundle de produção.");
      return;
    }
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void loadMapboxGl()
      .then((mapboxgl) => {
        if (cancelled || !mapContainerRef.current) return;
        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        if (!mapboxgl.supported?.() && mapboxgl.supported) {
          setMapError("Este navegador não suporta o mapa (WebGL indisponível).");
          return;
        }
        const initialStyle = mapStyleRef.current;
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLE_URLS[initialStyle],
          center: DEFAULT_CENTER,
          zoom: INITIAL_ZOOM,
          pitch: initialStyle === "3d" ? 58 : initialStyle === "navigation" ? 35 : 0,
          bearing: initialStyle === "3d" ? -12 : 0,
          attributionControl: true,
          ...(initialStyle === "3d"
            ? {
                config: {
                  basemap: {
                    lightPreset: "dusk",
                    show3dObjects: true,
                    show3dBuildings: true,
                    show3dTrees: true,
                    show3dLandmarks: true,
                    show3dFacades: true,
                  },
                },
              }
            : {}),
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
        map.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserHeading: true,
          }),
          "top-right",
        );
        map.on("load", () => {
          if (cancelled) return;
          configureMapStyle(map, mapStyleRef.current);
          setMapReady(true);
          map.resize();
        });
        map.on("error", (event: any) => {
          const message = String(
            event?.error?.message ?? event?.error ?? "Erro desconhecido do Mapbox",
          );
          console.error("[Mapbox] erro do mapa:", event?.error ?? event);
          if (/token|401|403|unauthorized/i.test(message)) {
            setMapError("O token público do Mapbox não foi aceito neste domínio.");
          } else if (/network|failed to fetch|load/i.test(message)) {
            setMapError("Falha de rede ao carregar os dados do mapa.");
          }
        });
        mapRef.current = map;

        // O container pode iniciar com altura/largura zero (mobile, PWA, abas
        // ocultas). Recalculamos sempre que o tamanho real muda.
        if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
          observer = new ResizeObserver(() => map.resize());
          observer.observe(mapContainerRef.current);
        }
      })
      .catch((error) => {
        console.error("[Mapbox] falha ao carregar o Mapbox GL JS:", error);
        setMapError(error instanceof Error ? error.message : "Não foi possível carregar o mapa.");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      originMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
      setMapReady(false);
    };
  }, []);

  function changeMapStyle(nextStyle: MapStyleMode) {
    const map = mapRef.current;
    if (!map || nextStyle === mapStyleRef.current || mapStyleLoading) return;

    const previousStyle = mapStyleRef.current;
    mapStyleRef.current = nextStyle;
    setMapStyle(nextStyle);
    setMapStyleLoading(true);
    setMapError(null);
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, nextStyle);

    try {
      if (previousStyle === "3d") map.setTerrain(null);
      map.setStyle(MAP_STYLE_URLS[nextStyle]);
      map.once("style.load", () => {
        configureMapStyle(map, nextStyle);
        // setStyle rebuilds the renderer; mobile browsers especially need an
        // explicit resize before custom markers/layers are drawn again.
        window.requestAnimationFrame(() => map.resize());
        setMapStyleLoading(false);
        if (routeOrigin && selectedPlace) {
          const option = travelOptions[activeTravelMode];
          if (option) drawRoute(option, routeOrigin, selectedPlace);
        }
      });
    } catch (error) {
      console.error(`[Mapbox] falha ao ativar o estilo ${nextStyle}:`, error);
      mapStyleRef.current = previousStyle;
      setMapStyle(previousStyle);
      setMapStyleLoading(false);
      window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, previousStyle);
      setMapError("Não foi possível carregar esse estilo de mapa. Tente novamente.");
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;
    const id = window.setTimeout(() => mapRef.current?.resize(), 60);
    return () => window.clearTimeout(id);
  }, [mobileView, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    filteredPlaces.forEach((place) => {
      const verified = place.literary_place_confirmations.length > 0;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "literary-map-marker";
      element.title = place.name;
      element.setAttribute("aria-label", `Abrir ${place.name}`);
      element.style.borderColor = verified ? "#22c55e" : "#f59e0b";

      if (isUsablePhotoUrl(place.photo_url)) {
        const image = document.createElement("img");
        image.src = place.photo_url!;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => {
          image.replaceWith(createMarkerFallback(place));
        });
        element.appendChild(image);
      } else {
        element.appendChild(createMarkerFallback(place));
      }

      const pin = document.createElement("span");
      pin.className = "literary-map-marker-tail";
      pin.style.borderTopColor = verified ? "#22c55e" : "#f59e0b";
      element.appendChild(pin);

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedPlaceId(place.id);
        setMobileView("map");
        map.flyTo({
          center: [place.longitude, place.latitude],
          zoom: Math.max(map.getZoom(), 14),
          essential: true,
        });
        showPlacePopup(place);
      });

      const marker = new mapboxgl.Marker({ element, anchor: "bottom" })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (!directionsOpen && filteredPlaces.length) {
      const isInitialBrowse = !query.trim() && activeCategory === "all" && !selectedPlaceId;

      // Com os locais da curadoria espalhados pelo Brasil, ajustar os limites de
      // todos os pins faria o mapa abrir distante demais. Na primeira abertura
      // preservamos um zoom maior e centralizado no Brasil; fitBounds fica para
      // buscas/filtros, quando o usuário já está procurando um grupo específico.
      if (isInitialBrowse && !initialViewportAppliedRef.current) {
        initialViewportAppliedRef.current = true;
        if (userLocation) {
          map.jumpTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: NEARBY_ZOOM,
          });
        } else {
          map.jumpTo({ center: DEFAULT_CENTER, zoom: INITIAL_ZOOM });
        }
      } else if (!isInitialBrowse) {
        const bounds = new mapboxgl.LngLatBounds();
        filteredPlaces.forEach((place) => bounds.extend([place.longitude, place.latitude]));
        const onlyPlace = filteredPlaces.length === 1 ? filteredPlaces[0] : undefined;
        if (onlyPlace) {
          map.flyTo({ center: [onlyPlace.longitude, onlyPlace.latitude], zoom: 14 });
        } else {
          map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 650 });
        }
      }
    }
  }, [
    filteredPlaces,
    mapReady,
    directionsOpen,
    query,
    activeCategory,
    selectedPlaceId,
    userLocation,
  ]);

  useEffect(() => {
    const option = travelOptions[activeTravelMode];
    if (!option || !routeOrigin || !selectedPlace || !mapReady) return;
    drawRoute(option, routeOrigin, selectedPlace);
  }, [activeTravelMode, mapReady, routeOrigin, selectedPlace, travelOptions]);

  function showPlacePopup(place: LiteraryPlace) {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    popupRef.current?.remove();

    const node = document.createElement("div");
    node.className = "literary-map-popup-card";

    if (isUsablePhotoUrl(place.photo_url)) {
      const image = document.createElement("img");
      image.className = "literary-map-popup-image";
      image.src = place.photo_url!;
      image.alt = place.name;
      image.addEventListener("error", () => {
        image.replaceWith(createPopupFallback(place));
      });
      node.appendChild(image);
    } else {
      node.appendChild(createPopupFallback(place));
    }

    const title = document.createElement("strong");
    title.className = "literary-map-popup-title";
    title.textContent = place.name;
    node.appendChild(title);

    const address = document.createElement("p");
    address.className = "literary-map-popup-address";
    address.textContent = place.address;
    node.appendChild(address);

    const categories = document.createElement("div");
    categories.className = "literary-map-popup-categories";
    place.categories.forEach((category) => {
      const badge = document.createElement("span");
      badge.textContent = categoryLabel(category);
      categories.appendChild(badge);
    });
    node.appendChild(categories);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "literary-map-popup-route";
    button.textContent = "Como chegar";
    button.addEventListener("click", () => void startDirections(place));
    node.appendChild(button);

    const popup = new mapboxgl.Popup({ offset: 28, maxWidth: "330px", closeButton: true })
      .setLngLat([place.longitude, place.latitude])
      .setDOMContent(node)
      .addTo(map);
    popupRef.current = popup;
  }

  function selectPlace(place: LiteraryPlace) {
    setSelectedPlaceId(place.id);
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: [place.longitude, place.latitude],
        zoom: Math.max(map.getZoom(), 14),
        essential: true,
      });
      showPlacePopup(place);
    }
  }

  async function startDirections(place: LiteraryPlace) {
    if (!MAPBOX_TOKEN) {
      toast.error("Adicione VITE_MAPBOX_ACCESS_TOKEN no arquivo .env para calcular rotas.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Seu navegador não disponibilizou a localização atual.");
      return;
    }

    setSelectedPlaceId(place.id);
    setDirectionsLoading(true);
    setDirectionsOpen(true);
    setMobileView("map");
    popupRef.current?.remove();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        setRouteOrigin(origin);
        void calculateTravelOptions(origin, place);
      },
      () => {
        setDirectionsLoading(false);
        setDirectionsOpen(false);
        toast.error("Permita o acesso à sua localização para mostrar o trajeto.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function calculateTravelOptions(origin: MapCoordinates, place: LiteraryPlace) {
    const destination = { longitude: place.longitude, latitude: place.latitude };
    try {
      const drivingPromise = fetchMapboxRoute(origin, destination, "driving-traffic").catch(() =>
        fetchMapboxRoute(origin, destination, "driving"),
      );
      const walkingPromise = fetchMapboxRoute(origin, destination, "walking");
      const [driving, walking] = await Promise.all([drivingPromise, walkingPromise]);

      const options: Record<TravelMode, TravelOption> = {
        car: routeOption("car", "Carro", driving, false),
        motorcycle: {
          ...routeOption("motorcycle", "Moto", driving, true),
          durationSeconds: Math.max(60, Math.round(driving.durationSeconds * 0.82)),
        },
        walking: routeOption("walking", "A pé", walking, false),
        bus: {
          ...routeOption("bus", "Ônibus", driving, true),
          durationSeconds: Math.max(
            driving.durationSeconds + 8 * 60,
            Math.round(driving.durationSeconds * 1.55 + 8 * 60),
          ),
        },
      };
      setTravelOptions(options);
      setActiveTravelMode("car");
    } catch (error) {
      setDirectionsOpen(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível calcular o trajeto.");
    } finally {
      setDirectionsLoading(false);
    }
  }

  function drawRoute(option: TravelOption, origin: MapCoordinates, place: LiteraryPlace) {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !map.isStyleLoaded()) return;

    const geojson = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: option.coordinates },
    };

    const source = map.getSource("literary-route");
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource("literary-route", { type: "geojson", data: geojson });
      map.addLayer({
        id: "literary-route-shadow",
        type: "line",
        source: "literary-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#08090d", "line-width": 10, "line-opacity": 0.65 },
      });
      map.addLayer({
        id: "literary-route-line",
        type: "line",
        source: "literary-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#53b9ea", "line-width": 6, "line-opacity": 0.95 },
      });
    }

    originMarkerRef.current?.remove();
    const originElement = document.createElement("div");
    originElement.className = "literary-map-origin-marker";
    originMarkerRef.current = new mapboxgl.Marker({ element: originElement })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(map);

    const bounds = new mapboxgl.LngLatBounds();
    option.coordinates.forEach((coordinate) => bounds.extend(coordinate));
    bounds.extend([place.longitude, place.latitude]);
    bounds.extend([origin.longitude, origin.latitude]);
    map.fitBounds(bounds, {
      padding: { top: 90, right: 70, bottom: 130, left: 70 },
      maxZoom: 16,
      duration: 700,
    });
  }

  function clearDirections() {
    setDirectionsOpen(false);
    setTravelOptions({});
    setRouteOrigin(null);
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    const map = mapRef.current;
    if (map?.getLayer("literary-route-line")) map.removeLayer("literary-route-line");
    if (map?.getLayer("literary-route-shadow")) map.removeLayer("literary-route-shadow");
    if (map?.getSource("literary-route")) map.removeSource("literary-route");
    if (selectedPlace) {
      map?.flyTo({
        center: [selectedPlace.longitude, selectedPlace.latitude],
        zoom: 14,
        essential: true,
      });
      showPlacePopup(selectedPlace);
    }
  }

  const confirmMutation = useMutation({
    mutationFn: async (place: LiteraryPlace) => {
      if (place.curated) throw new Error("Este local já foi verificado pela curadoria BookSyde.");
      if (!user) throw new Error("Entre na sua conta para confirmar um local.");
      if (place.created_by === user.id)
        throw new Error("Você não pode confirmar o local que cadastrou.");
      const { error } = await db.from("literary_place_confirmations").insert({
        place_id: place.id,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["literary-places"] });
      toast.success("Local confirmado pela comunidade.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar."),
  });

  const reviewMutation = useMutation({
    mutationFn: async (place: LiteraryPlace) => {
      if (place.curated)
        throw new Error(
          "Avaliações da comunidade ficam disponíveis nos locais cadastrados pelos usuários.",
        );
      if (!user) throw new Error("Entre na sua conta para avaliar.");
      const { error } = await db.from("literary_place_reviews").upsert(
        {
          place_id: place.id,
          user_id: user.id,
          rating: reviewRating,
          body: reviewBody.trim(),
        },
        { onConflict: "place_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["literary-places"] });
      toast.success("Sua avaliação foi salva.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível avaliar."),
  });

  return (
    <main className="mx-auto w-full px-2 pb-6 sm:px-4 lg:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[1.5rem] border border-border/65 bg-card/55 shadow-[0_24px_80px_-48px_rgba(0,0,0,.9)] lg:min-h-[calc(100dvh-118px)] lg:rounded-[2rem]">
        <div data-tour="map-header" className="border-b border-border/60 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="grid size-10 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    Mapa Literário
                  </h1>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    Sebos, livrarias e lojas indicados e validados pela comunidade.
                  </p>
                </div>
              </div>
            </div>
            <Button
              data-tour="map-add"
              className="rounded-full"
              onClick={() => {
                if (!user) {
                  void navigate({ to: "/auth" });
                  return;
                }
                setAddOpen(true);
              }}
            >
              <Plus className="size-4" /> Adicionar local
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(360px,44%)_minmax(0,56%)]">
          <aside
            data-tour="map-list"
            className={cn(
              "min-h-[620px] border-border/60 bg-background/22 lg:block lg:border-r",
              mobileView === "map" && "hidden",
            )}
          >
            <div className="sticky top-0 z-10 border-b border-border/55 bg-card/92 p-4 backdrop-blur-xl sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar local ou endereço..."
                  className="h-11 rounded-2xl pl-10"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <CategoryFilter
                  active={activeCategory === "all"}
                  onClick={() => setActiveCategory("all")}
                >
                  Todos
                </CategoryFilter>
                {CATEGORY_OPTIONS.map((category) => (
                  <CategoryFilter
                    key={category.value}
                    active={activeCategory === category.value}
                    onClick={() => setActiveCategory(category.value)}
                  >
                    {category.label}
                  </CategoryFilter>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={userLocation ? "secondary" : "outline"}
                  className="h-8 shrink-0 rounded-full px-3 text-xs"
                  disabled={locatingUser}
                  onClick={() => focusNearby(true)}
                >
                  {locatingUser ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="size-3.5" />
                  )}
                  {userLocation ? "Mais próximos" : "Perto de mim"}
                </Button>
              </div>
            </div>

            <div className="max-h-[calc(100dvh-260px)] overflow-y-auto p-3 sm:p-4 lg:max-h-[calc(100dvh-238px)]">
              {placesQuery.isError ? (
                <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs leading-5 text-amber-200">
                  Os locais não puderam ser carregados agora. Tente novamente em instantes.
                </div>
              ) : null}

              {filteredPlaces.length ? (
                <div className="space-y-3">
                  {filteredPlaces.map((place) => (
                    <PlaceListCard
                      key={place.id}
                      place={place}
                      active={selectedPlaceId === place.id}
                      distanceKm={userLocation ? distanceBetweenKm(userLocation, place) : null}
                      onSelect={() => selectPlace(place)}
                      onRoute={() => void startDirections(place)}
                    />
                  ))}
                </div>
              ) : placesQuery.isLoading ? (
                <div className="grid min-h-52 place-items-center text-sm text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <EmptyState
                  title="Nenhum local encontrado"
                  description="Tente outro filtro ou seja o primeiro a adicionar um local nessa região."
                />
              )}

              {selectedPlace ? (
                <PlaceDetails
                  place={selectedPlace}
                  userId={user?.id ?? null}
                  rating={reviewRating}
                  reviewBody={reviewBody}
                  onRating={setReviewRating}
                  onReviewBody={setReviewBody}
                  onConfirm={() => {
                    if (!user) void navigate({ to: "/auth" });
                    else confirmMutation.mutate(selectedPlace);
                  }}
                  onReview={() => {
                    if (!user) void navigate({ to: "/auth" });
                    else reviewMutation.mutate(selectedPlace);
                  }}
                  onRoute={() => void startDirections(selectedPlace)}
                  confirmPending={confirmMutation.isPending}
                  reviewPending={reviewMutation.isPending}
                />
              ) : null}
            </div>
          </aside>

          <section
            data-tour="map-canvas"
            className={cn(
              "relative min-h-[calc(100dvh-188px)] bg-muted/20 lg:block lg:min-h-[calc(100dvh-198px)]",
              mobileView === "list" && "hidden lg:block",
            )}
          >
            <div ref={mapContainerRef} className="literary-map absolute inset-0" />

            {mapReady ? (
              <div
                className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-4.5rem)] items-center gap-0.5 overflow-x-auto rounded-2xl border border-border/70 bg-card/95 p-1 shadow-lg backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:left-4 sm:top-4"
                role="group"
                aria-label="Estilo do mapa"
              >
                <span
                  className="grid size-8 shrink-0 place-items-center text-muted-foreground"
                  aria-hidden="true"
                >
                  {mapStyleLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Layers3 className="size-4" />
                  )}
                </span>
                {MAP_STYLE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={mapStyle === option.value ? "default" : "ghost"}
                    disabled={mapStyleLoading}
                    className="h-9 shrink-0 rounded-xl px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
                    onClick={() => changeMapStyle(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {!MAPBOX_TOKEN ? (
              <MapSetupMessage />
            ) : mapError ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-background/92 p-6 text-center backdrop-blur-sm">
                <div className="max-w-sm">
                  <MapPin className="mx-auto size-10 text-primary" />
                  <h2 className="mt-4 text-lg font-semibold">Mapa indisponível</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{mapError}</p>
                </div>
              </div>
            ) : !mapReady ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-sm">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            ) : null}

            {directionsOpen && selectedPlace ? (
              <DirectionsPanel
                place={selectedPlace}
                options={travelOptions}
                activeMode={activeTravelMode}
                loading={directionsLoading}
                onMode={setActiveTravelMode}
                onClose={clearDirections}
              />
            ) : null}
          </section>
        </div>
      </section>

      <div className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-30 flex rounded-2xl border border-border/70 bg-card/95 p-1 shadow-2xl backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold sm:text-sm",
            mobileView === "list" ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          <Store className="size-4" /> Lista
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileView("map");
            window.setTimeout(() => mapRef.current?.resize(), 80);
          }}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold sm:text-sm",
            mobileView === "map" ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          <MapPin className="size-4" /> Mapa
        </button>
      </div>

      <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} />
    </main>
  );
}

