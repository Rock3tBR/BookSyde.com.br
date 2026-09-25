import { Bus, Car, Footprints, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMapboxAccessToken, type MapCoordinates, type MapboxRouteResult } from "@/lib/mapbox";

export const db = supabase as any;
export const MAPBOX_TOKEN = getMapboxAccessToken();
export const DEFAULT_CENTER: [number, number] = [-47.8, -15.7];
export const INITIAL_ZOOM = 5.15;
export const NEARBY_ZOOM = 10.5;
export const LAST_LOCATION_STORAGE_KEY = "mangaka-literary-last-location-v1";
export const LAST_LOCATION_MAX_AGE = 6 * 60 * 60 * 1000;

export type Category = "manga" | "book" | "hq" | "gibi";
export type TravelMode = "car" | "motorcycle" | "walking" | "bus";
export type MapStyleMode = "default" | "3d" | "navigation";

export const MAP_STYLE_STORAGE_KEY = "mangaka-literary-map-style";
export const MAP_STYLE_URLS: Record<MapStyleMode, string> = {
  default: "mapbox://styles/mapbox/dark-v11",
  // Mapbox Standard is the real 3D basemap: buildings, landmarks and trees
  // are rendered as 3D objects and can be configured through the basemap import.
  "3d": "mapbox://styles/mapbox/standard",
  navigation: "mapbox://styles/mapbox/navigation-night-v1",
};

export const MAP_STYLE_OPTIONS: Array<{ value: MapStyleMode; label: string }> = [
  { value: "default", label: "Padrão" },
  { value: "3d", label: "3D" },
  { value: "navigation", label: "Navegação" },
];

export type PlaceReview = {
  id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
  profiles?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

export type LiteraryPlace = {
  id: string;
  created_by: string;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  categories: Category[];
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  created_at: string;
  // Alguns projetos já possuem esta coluna e outros ainda não aplicaram a
  // migração da curadoria. Mantê-la opcional evita quebrar a leitura dos
  // locais existentes enquanto a atualização do banco não foi feita.
  curated?: boolean;
  literary_place_confirmations: Array<{ user_id: string }>;
  literary_place_reviews: PlaceReview[];
};

export type TravelOption = {
  mode: TravelMode;
  label: string;
  durationSeconds: number;
  distanceMeters: number;
  coordinates: [number, number][];
  approximate: boolean;
};

export const CATEGORY_OPTIONS: Array<{ value: Category; label: string; icon: string }> = [
  { value: "manga", label: "Mangás", icon: "漫" },
  { value: "book", label: "Livros", icon: "📖" },
  { value: "hq", label: "HQs", icon: "💥" },
  { value: "gibi", label: "Gibis", icon: "📰" },
];

export const TRAVEL_META: Record<TravelMode, { label: string; icon: typeof Car }> = {
  car: { label: "Carro", icon: Car },
  motorcycle: { label: "Moto", icon: Navigation },
  walking: { label: "A pé", icon: Footprints },
  bus: { label: "Ônibus", icon: Bus },
};

export function isUsablePhotoUrl(value: string | null | undefined) {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

export function placeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "")
    .join("");
}

export function distanceBetweenKm(
  origin: MapCoordinates,
  place: Pick<LiteraryPlace, "latitude" | "longitude">,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const latitudeDelta = toRad(place.latitude - origin.latitude);
  const longitudeDelta = toRad(place.longitude - origin.longitude);
  const originLatitude = toRad(origin.latitude);
  const placeLatitude = toRad(place.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(placeLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function formatDistanceKm(value: number) {
  if (value < 1) return `${Math.max(1, Math.round(value * 1000))} m`;
  if (value < 10) return `${value.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(value)} km`;
}

export function createMarkerFallback(place: LiteraryPlace) {
  const visual = document.createElement("span");
  visual.className = "literary-map-marker-fallback";
  visual.setAttribute("aria-hidden", "true");

  const initials = document.createElement("span");
  initials.className = "literary-map-marker-initials";
  initials.textContent = placeInitials(place.name);

  visual.appendChild(initials);
  return visual;
}

export function createPopupFallback(place: LiteraryPlace) {
  const visual = document.createElement("div");
  visual.className = "literary-map-popup-fallback";

  const badge = document.createElement("span");
  badge.className = "literary-map-popup-fallback-badge";
  badge.textContent = placeInitials(place.name);

  const eyebrow = document.createElement("span");
  eyebrow.className = "literary-map-popup-fallback-label";
  eyebrow.textContent = "Ponto literário";

  visual.append(badge, eyebrow);
  return visual;
}

export function categoryLabel(category: Category) {
  if (category === "book") return "Livros";
  if (category === "hq") return "HQs";
  if (category === "gibi") return "Gibis";
  return "Mangás";
}

export function averageRating(place: LiteraryPlace) {
  if (!place.literary_place_reviews.length) return 0;
  return (
    place.literary_place_reviews.reduce((sum, review) => sum + review.rating, 0) /
    place.literary_place_reviews.length
  );
}

export function routeOption(
  mode: TravelMode,
  label: string,
  route: MapboxRouteResult,
  approximate: boolean,
): TravelOption {
  return {
    mode,
    label,
    durationSeconds: route.durationSeconds,
    distanceMeters: route.distanceMeters,
    coordinates: route.coordinates,
    approximate,
  };
}

export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1).replace(".", ",")} km`;
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function configureMapStyle(map: any, mode: MapStyleMode) {
    if (mode === "3d") {
      // Mapbox Standard's basemap import is the source of the 3D buildings,
      // landmarks and trees. Terrain adds elevation to the camera as well.
      try {
        map.setConfigProperty?.("basemap", "lightPreset", "dusk");
        map.setConfigProperty?.("basemap", "show3dObjects", true);
        map.setConfigProperty?.("basemap", "show3dBuildings", true);
        map.setConfigProperty?.("basemap", "show3dTrees", true);
        map.setConfigProperty?.("basemap", "show3dLandmarks", true);
        map.setConfigProperty?.("basemap", "show3dFacades", true);

        if (!map.getSource("mangaka-terrain")) {
          map.addSource("mangaka-terrain", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: "mangaka-terrain", exaggeration: 1.15 });
      } catch (error) {
        console.warn("[Mapbox] o basemap 3D não pôde ser configurado:", error);
      }

      map.easeTo({ pitch: 58, bearing: -12, duration: 650, essential: true });
      return;
    }

    try {
      map.setTerrain(null);
    } catch {
      // O estilo anterior pode já ter removido a fonte de relevo.
    }

    if (mode === "navigation") {
      map.easeTo({ pitch: 35, bearing: 0, duration: 500, essential: true });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 500, essential: true });
    }
  }


export async function fetchLiteraryPlaces() {
      const { data, error } = await db
        .from("literary_places")
        .select(
          "id, created_by, name, description, address, latitude, longitude, photo_url, categories, phone, website_url, instagram_url, created_at, literary_place_confirmations(user_id), literary_place_reviews(id, user_id, rating, body, created_at, profiles(display_name, avatar_url))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((place: LiteraryPlace) => ({
        ...place,
        // Relações podem vir nulas quando não há confirmações/avaliações.
        // A tela usa esses arrays em vários pontos, portanto normalizamos a
        // resposta antes da primeira renderização.
        literary_place_confirmations: place.literary_place_confirmations ?? [],
        literary_place_reviews: place.literary_place_reviews ?? [],
        categories: place.categories ?? [],
        curated: place.curated ?? false,
      })) as LiteraryPlace[];
}
