import { createFileRoute } from "@tanstack/react-router";

const RELEASE_API = "https://api.github.com/repos/FSantos15/mangakalib/releases/latest";

type DesktopPlatform = "macos" | "windows" | "linux";

type ReleaseAsset = {
  name: string;
  url: string;
  content_type?: string;
  browser_download_url: string;
};

export const Route = createFileRoute("/api/desktop-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const requested = url.searchParams.get("platform");
        const platform = isPlatform(requested)
          ? requested
          : platformFromAgent(request.headers.get("user-agent") ?? "");

        if (!platform) {
          return Response.json(
            { error: "Não foi possível identificar o sistema operacional." },
            { status: 400 },
          );
        }

        const githubToken = process.env["GITHUB_RELEASE_TOKEN"];

        let releaseResponse: Response;
        try {
          releaseResponse = await fetch(RELEASE_API, {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "BookSyde-Download",
              ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
            },
            signal: AbortSignal.timeout(8_000),
          });
        } catch {
          return Response.json(
            { error: "O GitHub demorou para responder. Tente novamente." },
            { status: 504 },
          );
        }
        if (!releaseResponse.ok) {
          return Response.json(
            { error: "Nenhuma versão do BookSyde Desktop está disponível." },
            { status: 503 },
          );
        }

        const release = (await releaseResponse.json()) as { assets?: ReleaseAsset[] };
        const asset = release.assets?.find((candidate) =>
          matchesPlatform(candidate.name, platform),
        );
        if (!asset?.browser_download_url.startsWith("https://github.com/")) {
          return Response.json(
            { error: `Instalador indisponível para ${platform}.` },
            { status: 404 },
          );
        }

        if (url.searchParams.get("check") === "1") {
          return Response.json(
            {
              downloadUrl: githubToken
                ? `/api/desktop-download?platform=${platform}`
                : asset.browser_download_url,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        if (githubToken) {
          const assetResponse = await fetch(asset.url, {
            headers: {
              Accept: "application/octet-stream",
              Authorization: `Bearer ${githubToken}`,
              "User-Agent": "BookSyde-Download",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(30_000),
          });
          if (!assetResponse.ok || !assetResponse.body) {
            return Response.json(
              { error: "Não foi possível transferir o instalador." },
              { status: 502 },
            );
          }
          const safeName = asset.name.replace(/["\r\n]/g, "_");
          const headers = new Headers({
            "Content-Type": asset.content_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeName}"`,
            "Cache-Control": "private, no-store",
          });
          const contentLength = assetResponse.headers.get("content-length");
          if (contentLength) headers.set("Content-Length", contentLength);
          return new Response(assetResponse.body, { headers });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: asset.browser_download_url,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

function isPlatform(value: string | null): value is DesktopPlatform {
  return value === "macos" || value === "windows" || value === "linux";
}

function platformFromAgent(agent: string): DesktopPlatform | null {
  const normalized = agent.toLowerCase();
  if (normalized.includes("windows")) return "windows";
  if (normalized.includes("macintosh") || normalized.includes("mac os")) return "macos";
  if (normalized.includes("linux") && !normalized.includes("android")) return "linux";
  return null;
}

function matchesPlatform(name: string, platform: DesktopPlatform) {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".sig")) return false;
  if (platform === "macos") return normalized.endsWith(".dmg");
  if (platform === "windows") return normalized.endsWith(".exe");
  return normalized.endsWith(".appimage");
}
