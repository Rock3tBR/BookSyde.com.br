import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

import { resolveCoverUrl } from "@/lib/media";

type StorageCoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  coverUrl: string | null | undefined;
  fallback?: ReactNode;
};

/**
 * Renderiza capas do BookSyde independentemente de como elas foram salvas.
 *
 * As capas privadas são persistidas no banco como `storage:<caminho>` e precisam
 * ser convertidas em URL assinada antes de serem usadas por uma tag <img>.
 */
export function StorageCoverImage({
  coverUrl,
  fallback = null,
  onError,
  ...imageProps
}: StorageCoverImageProps) {
  const [failed, setFailed] = useState(false);

  const { data: resolvedUrl } = useQuery({
    queryKey: ["storage-cover-image", coverUrl],
    queryFn: () => resolveCoverUrl(coverUrl ?? null),
    enabled: !!coverUrl,
    networkMode: "always",
    staleTime: 50 * 60 * 1000,
  });

  useEffect(() => {
    setFailed(false);
  }, [coverUrl, resolvedUrl]);

  if (!resolvedUrl || failed) return <>{fallback}</>;

  return (
    <img
      {...imageProps}
      src={resolvedUrl}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
