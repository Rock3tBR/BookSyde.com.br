// Estado mínimo dos envios. Não carrega EPUB, ZIP, PDFs nem processamento de imagem.
export type VolumeUploadStatus = {
  state: "idle" | "running" | "completed" | "error";
  progress: number;
  currentVolume: number | null;
  totalVolumes: number;
  message: string;
};

let status: VolumeUploadStatus = {
  state: "idle",
  progress: 0,
  currentVolume: null,
  totalVolumes: 0,
  message: "",
};

const listeners = new Set<() => void>();

export function getVolumeUploadStatus() {
  return status;
}

export function subscribeToVolumeUpload(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateStatus(
  next: VolumeUploadStatus,
) {
  status = next;

  listeners.forEach(
    (listener) =>
      listener(),
  );
}
