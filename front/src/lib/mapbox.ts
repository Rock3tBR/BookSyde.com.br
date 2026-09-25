export type MapCoordinates = {
  longitude: number;
  latitude: number;
};

export type MapboxRouteProfile = "driving-traffic" | "driving" | "walking" | "cycling";

export type MapboxRouteResult = {
  coordinates: [number, number][];
  durationSeconds: number;
  distanceMeters: number;
};

export type GeocodedAddress = MapCoordinates & {
  address: string;
};

const MAPBOX_GL_VERSION = "3.30.0";
const MAPBOX_SCRIPT_ID = "mangaka-mapbox-gl-script";
const MAPBOX_STYLE_ID = "mangaka-mapbox-gl-style";
let mapboxPromise: Promise<any> | null = null;

declare global {
  interface Window {
    mapboxgl?: any;
  }
}

export function getMapboxAccessToken() {
  // Acesso por ponto é obrigatório: o build de produção substitui exatamente
  // este texto pelo valor da variável. Colchetes não são substituídos.
  return String(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "").trim();
}

export async function loadMapboxGl() {
  if (typeof window === "undefined") {
    throw new Error("O mapa só pode ser carregado no navegador.");
  }

  if (window.mapboxgl) return window.mapboxgl;
  if (mapboxPromise) return mapboxPromise;

  mapboxPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(MAPBOX_STYLE_ID)) {
      const style = document.createElement("link");
      style.id = MAPBOX_STYLE_ID;
      style.rel = "stylesheet";
      style.href = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`;
      document.head.appendChild(style);
    }

    const existingScript = document.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      const poll = window.setInterval(() => {
        if (!window.mapboxgl) return;
        window.clearInterval(poll);
        resolve(window.mapboxgl);
      }, 25);
      window.setTimeout(() => {
        window.clearInterval(poll);
        if (window.mapboxgl) resolve(window.mapboxgl);
        else reject(new Error("Não foi possível carregar o Mapbox GL JS."));
      }, 12000);
      return;
    }

    const script = document.createElement("script");
    script.id = MAPBOX_SCRIPT_ID;
    script.async = true;
    script.src = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`;
    script.onload = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("O Mapbox GL JS foi carregado sem disponibilizar a API."));
    };
    script.onerror = () => reject(new Error("Não foi possível carregar o Mapbox GL JS."));
    document.head.appendChild(script);
  });

  try {
    return await mapboxPromise;
  } catch (error) {
    mapboxPromise = null;
    throw error;
  }
}

export async function fetchMapboxRoute(
  origin: MapCoordinates,
  destination: MapCoordinates,
  profile: MapboxRouteProfile,
): Promise<MapboxRouteResult> {
  const token = getMapboxAccessToken();
  if (!token) throw new Error("Configure VITE_MAPBOX_ACCESS_TOKEN para usar rotas.");

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
    alternatives: "false",
    steps: "false",
    language: "pt-BR",
  });

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Não foi possível calcular a rota (${response.status}).`);
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      geometry?: { coordinates?: [number, number][] };
      duration?: number;
      distance?: number;
    }>;
  };

  const route = payload.routes?.[0];
  const routeCoordinates = route?.geometry?.coordinates;
  if (!route || !routeCoordinates?.length) {
    throw new Error("Nenhuma rota foi encontrada entre os dois pontos.");
  }

  return {
    coordinates: routeCoordinates,
    durationSeconds: Number(route.duration ?? 0),
    distanceMeters: Number(route.distance ?? 0),
  };
}

export async function geocodeMapboxAddress(query: string): Promise<GeocodedAddress> {
  const token = getMapboxAccessToken();
  if (!token) throw new Error("Configure VITE_MAPBOX_ACCESS_TOKEN para buscar endereços.");

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    limit: "1",
    language: "pt",
    country: "br",
    autocomplete: "false",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
  if (!response.ok) throw new Error("Não foi possível localizar esse endereço.");

  const payload = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        full_address?: string;
        name?: string;
        place_formatted?: string;
      };
    }>;
  };

  const feature = payload.features?.[0];
  const point = feature?.geometry?.coordinates;
  if (!feature || !point) throw new Error("Endereço não encontrado.");

  const properties = feature.properties ?? {};
  const address =
    properties.full_address ??
    [properties.name, properties.place_formatted].filter(Boolean).join(", ") ??
    query;

  return {
    longitude: point[0],
    latitude: point[1],
    address: address || query,
  };
}

export async function reverseGeocodeMapbox(
  coordinates: MapCoordinates,
): Promise<GeocodedAddress> {
  const token = getMapboxAccessToken();
  if (!token) {
    return { ...coordinates, address: `${coordinates.latitude}, ${coordinates.longitude}` };
  }

  const params = new URLSearchParams({
    longitude: String(coordinates.longitude),
    latitude: String(coordinates.latitude),
    access_token: token,
    limit: "1",
    language: "pt",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`);
  if (!response.ok) {
    return { ...coordinates, address: `${coordinates.latitude}, ${coordinates.longitude}` };
  }

  const payload = (await response.json()) as {
    features?: Array<{
      properties?: {
        full_address?: string;
        name?: string;
        place_formatted?: string;
      };
    }>;
  };
  const properties = payload.features?.[0]?.properties ?? {};
  const address =
    properties.full_address ??
    [properties.name, properties.place_formatted].filter(Boolean).join(", ");

  return {
    ...coordinates,
    address: address || `${coordinates.latitude}, ${coordinates.longitude}`,
  };
}
