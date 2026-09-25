import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { resolveCoverUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type Props = {
  coverUrl: string | null | undefined;
  title: string;
  className?: string;
  pageTenUrl?: string | null;
  pageStatus?: string;
  pageLabel?: string;
  previewDescription?: string | null;
};

const WIDTH = 420;
const HEIGHT = 560;
const STRIPS = 56;
type Point = { x: number; y: number };

/** Plain text only: no publication HTML or arbitrary SVG gets injected. */
function wrapPreviewText(value: string): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > 40 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
    if (lines.length >= 13) break;
  }
  if (line && lines.length < 13) lines.push(line);
  if (lines.length === 13 && words.join(" ").length > lines.join(" ").length) {
    lines[12] = `${lines[12]?.slice(0, 35).trimEnd() ?? ""}…`;
  }
  return lines;
}

// Orthographic projection of a curved sheet. Artwork follows the same surface
// as the paper, so its printed lines bend into the binding as well.
function project(u: number, v: number, side: number, layer = 1): Point {
  const distance = side === -1 ? 1 - u : u;
  const x = side * distance * (WIDTH + (1 - layer) * 22);
  const y = (v - 0.5) * HEIGHT;
  const arch = 95 * (1 - Math.exp(-distance * 8)) * (1 - distance);
  const z = 6 + layer * (16 + arch + distance * 24);
  return { x: 525 + x * 0.98 - y * 0.28, y: 355 + x * 0.16 + y * 0.72 - z };
}

function outline(side: number, layer = 1) {
  const edge = Array.from({ length: STRIPS + 1 }, (_, i) => i / STRIPS);
  return [
    ...edge.map((u) => project(u, 0, side, layer)),
    ...edge.reverse().map((u) => project(u, 1, side, layer)),
  ]
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

function CurvedSheet({
  side,
  url,
  label,
  status,
  description,
  id,
}: {
  side: number;
  url: string | null | undefined;
  label: string;
  status: string;
  description?: string | null;
  id: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!url && failedUrl !== url;
  const previewLines = !showImage && description?.trim() ? wrapPreviewText(description) : [];
  const lighting: [number, string, number][] =
    side === -1
      ? [
          [0, "#635038", 0.12],
          [0.35, "#fff8e8", 0.06],
          [0.7, "#fff9ea", 0.16],
          [0.91, "#493723", 0.12],
          [1, "#302519", 0.49],
        ]
      : [
          [0, "#302519", 0.45],
          [0.09, "#493723", 0.16],
          [0.3, "#fff9ea", 0.15],
          [0.7, "#fff8e8", 0.03],
          [1, "#635038", 0.13],
        ];
  return (
    <g data-book-sheet={side === -1 ? "left" : "right"}>
      <defs>
        <g id={`${id}-print`}>
          {showImage ? (
            <image
              href={url}
              x="18"
              y="20"
              width={WIDTH - 36}
              height={HEIGHT - 40}
              preserveAspectRatio="xMidYMid meet"
              onError={() => setFailedUrl(url)}
            >
              <title>{label}</title>
            </image>
          ) : previewLines.length ? (
            <g aria-label="Sinopse de apresentação">
              <text x="42" y="75" fontSize="12" letterSpacing="2.1" fill="#95734b" fontFamily="var(--font-display)">
                CONHEÇA ESTA OBRA
              </text>
              <path d="M42 93 H378" stroke="#c5b495" strokeWidth="1" />
              {previewLines.map((line, index) => (
                <text key={`${index}-${line}`} x="42" y={137 + index * 24} fill="#473a2b" fontSize="15" fontFamily="var(--font-display)">
                  {line}
                </text>
              ))}
              <path d="M42 485 H378" stroke="#c5b495" strokeWidth="1" />
              <text x={WIDTH / 2} y="512" textAnchor="middle" fill="#85735e" fontSize="11" fontFamily="var(--font-display)">
                Sinopse · Acesse a obra para ler mais
              </text>
            </g>
          ) : (
            <text
              x={WIDTH / 2}
              y={HEIGHT / 2}
              textAnchor="middle"
              fill="#756956"
              fontSize="17"
              fontFamily="var(--font-display)"
            >
              {status}
            </text>
          )}
        </g>
        <linearGradient
          id={`${id}-light`}
          gradientUnits="userSpaceOnUse"
          x1={side === -1 ? -WIDTH : 0}
          x2={side === -1 ? 0 : WIDTH}
          y1="0"
          y2="0"
          gradientTransform="matrix(.98 .16 -.28 .72 525 355)"
        >
          {lighting.map(([offset, color, opacity]) => (
            <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </linearGradient>
      </defs>
      <polygon points={outline(side)} fill="#e9dfca" stroke="#c7b89e" strokeWidth="1" />
      {Array.from({ length: STRIPS }, (_, i) => {
        const u = i / STRIPS;
        const next = (i + 1) / STRIPS;
        const a = project(u, 0, side);
        const b = project(next, 0, side);
        const c = project(u, 1, side);
        const scaleX = (b.x - a.x) / (WIDTH / STRIPS);
        const skewY = (b.y - a.y) / (WIDTH / STRIPS);
        const skewX = (c.x - a.x) / HEIGHT;
        const scaleY = (c.y - a.y) / HEIGHT;
        const matrix = `matrix(${scaleX} ${skewY} ${skewX} ${scaleY} ${a.x - scaleX * u * WIDTH} ${a.y - skewY * u * WIDTH})`;
        return (
          <g key={i} transform={matrix}>
            <clipPath id={`${id}-${i}`}>
              <rect x={u * WIDTH} width={WIDTH / STRIPS + 1.2} height={HEIGHT} />
            </clipPath>
            <use href={`#${id}-print`} clipPath={`url(#${id}-${i})`} />
          </g>
        );
      })}
      <polygon points={outline(side)} fill={`url(#${id}-light)`} pointerEvents="none" />
    </g>
  );
}

export function OpenBook3DModel({
  coverUrl,
  title,
  className,
  pageTenUrl,
  pageStatus = "Página 10 indisponível",
  pageLabel = `Página 10 de ${title}`,
  previewDescription,
}: Props) {
  const id = `book-${useId().replace(/:/g, "")}`;
  const { data: resolvedCover } = useQuery({
    queryKey: ["storage-cover-image", coverUrl],
    queryFn: () => resolveCoverUrl(coverUrl ?? null),
    enabled: !!coverUrl,
    staleTime: 50 * 60 * 1000,
  });
  return (
    <div className={cn("open-book-stage", className)}>
      <svg
        className="open-book-model"
        viewBox="0 0 1050 700"
        role="img"
        aria-label={`Livro aberto de ${title}: capa à esquerda; ${pageLabel} à direita`}
      >
        <defs>
          <linearGradient id={`${id}-cover`} x2="0.3" y2="1">
            <stop stopColor="#985552" />
            <stop offset="1" stopColor="#542827" />
          </linearGradient>
          <filter id={`${id}-shadow`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <ellipse
          cx="530"
          cy="524"
          rx="397"
          ry="64"
          fill="#000"
          opacity=".24"
          filter={`url(#${id}-shadow)`}
          transform="rotate(9 530 524)"
        />
        <g aria-hidden="true">
          {[-1, 1].map((side) => (
            <polygon
              key={side}
              points={outline(side, 0)}
              fill={`url(#${id}-cover)`}
              stroke="#683331"
              strokeWidth="12"
              strokeLinejoin="round"
              transform="translate(0 7)"
            />
          ))}
          {Array.from({ length: 24 }, (_, i) => {
            const layer = i / 24;
            return [-1, 1].map((side) => (
              <polygon
                key={`${i}-${side}`}
                points={outline(side, layer)}
                fill={i % 3 === 0 ? "#d5c7af" : "#e2d6c0"}
                stroke={i % 3 === 0 ? "#b5a48b" : "#c7b89e"}
                strokeWidth=".8"
              />
            ));
          })}
        </g>
        <CurvedSheet
          side={-1}
          url={resolvedCover}
          label={`Capa de ${title}`}
          status="Capa indisponível"
          id={`${id}-left`}
        />
        <CurvedSheet
          side={1}
          url={pageTenUrl}
          label={pageLabel}
          status={pageStatus}
          description={previewDescription}
          id={`${id}-right`}
        />
      </svg>
    </div>
  );
}
