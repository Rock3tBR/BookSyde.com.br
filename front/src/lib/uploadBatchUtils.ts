// Funções puras compartilháveis para preparação dos lotes de upload.
export async function mapWithConcurrency<
  T,
  R,
>(
  items: T[],
  concurrency: number,
  worker: (
    item: T,
    index: number,
  ) => Promise<R>,
) {
  const results =
    new Array<R>(
      items.length,
    );

  let nextIndex = 0;

  async function runWorker() {
    while (
      nextIndex <
      items.length
    ) {
      const currentIndex =
        nextIndex++;

      results[
        currentIndex
      ] = await worker(
        items[
          currentIndex
        ]!,
        currentIndex,
      );
    }
  }

  const workers =
    await Promise.allSettled(
      Array.from(
        {
          length: Math.min(
            concurrency,
            items.length,
          ),
        },
        runWorker,
      ),
    );

  const failed =
    workers.find(
      (result) =>
        result.status ===
        "rejected",
    );

  if (
    failed?.status ===
    "rejected"
  ) {
    throw failed.reason;
  }

  return results;
}

export function chunk<T>(
  items: T[],
  size: number,
) {
  return Array.from(
    {
      length: Math.ceil(
        items.length /
          size,
      ),
    },
    (_, index) =>
      items.slice(
        index * size,
        (index + 1) *
          size,
      ),
  );
}

export function extensionForType(
  type: string,
) {
  if (
    type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    type ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    type ===
    "image/gif"
  ) {
    return "gif";
  }

  return "jpg";
}
