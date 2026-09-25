const bucket = process.env["R2_BUCKET_NAME"] || "booksyde-files";
const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}
async function sha256(value: string) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
function enc(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }

function getR2Endpoint() {
  const raw = process.env["R2_ENDPOINT"]?.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("R2_ENDPOINT não configurado no servidor.");

  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
  catch { throw new Error("R2_ENDPOINT inválido. Use https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com"); }

  // O endpoint S3 da API é sempre <account-id>.r2.cloudflarestorage.com.
  // r2.dev e domínios customizados são URLs públicas e não aceitam assinatura S3.
  if (!/^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/i.test(url.hostname)) {
    throw new Error("R2_ENDPOINT inválido para a API S3. Copie o endpoint do R2 em Cloudflare > R2 > Manage R2 API Tokens; ele termina em .r2.cloudflarestorage.com.");
  }

  // Aceita também endpoint copiado com /bucket no final sem duplicar o bucket.
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url;
}

async function presign(method: "GET" | "PUT" | "DELETE", key: string, expires: number) {
  const accessKey = process.env["R2_ACCESS_KEY_ID"]?.trim();
  const secret = process.env["R2_SECRET_ACCESS_KEY"]?.trim();
  if (!accessKey || !secret) throw new Error("Credenciais do Cloudflare R2 não configuradas no servidor.");
  const base = getR2Endpoint();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const cleanKey = key.replace(/^\/+/, "");
  const path = `/${enc(bucket)}/${cleanKey.split("/").map(enc).join("/")}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const canonical = `${method}\n${path}\n${query}\nhost:${base.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(canonical)}`;
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, "auto");
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));
  return `${base.origin}${path}?${query}&X-Amz-Signature=${signature}`;
}

export function signR2Upload(key: string) { return presign("PUT", key, 900); }
export function signR2Download(key: string) { return presign("GET", key, 3600); }
export async function deleteR2Objects(keys: string[]) {
  for (const key of keys) {
    const response = await fetch(await presign("DELETE", key, 300), { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error(`Falha ao excluir ${key} do R2 (${response.status}).`);
  }
}
