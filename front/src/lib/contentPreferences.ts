import { WORK_TYPES, type WorkType } from "@/lib/publication";

export const ALL_WORK_TYPES = WORK_TYPES.map((item) => item.value) as WorkType[];

const STORAGE_KEY = "mangaka:visible-work-types";

type ProfileLike =
  | {
      visible_work_types?: string[] | null;
    }
  | null
  | undefined;

function normalizeWorkTypes(value: unknown): WorkType[] {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<WorkType>(ALL_WORK_TYPES);
  const unique = [...new Set(value.filter((item): item is string => typeof item === "string"))];

  return unique.filter((item): item is WorkType => allowed.has(item as WorkType));
}

function readStored(): WorkType[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeWorkTypes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getVisibleWorkTypes(profile?: ProfileLike): WorkType[] {
  const fromProfile = normalizeWorkTypes(profile?.visible_work_types);
  if (fromProfile.length) return fromProfile;

  const fromStorage = readStored();
  if (fromStorage.length) return fromStorage;

  return [...ALL_WORK_TYPES];
}

export function saveVisibleWorkTypes(workTypes: WorkType[]) {
  if (typeof window === "undefined") return;

  const normalized = normalizeWorkTypes(workTypes);
  if (!normalized.length) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("mangaka-content-preferences-updated"));
  } catch {
    // Falhas de localStorage não devem bloquear o restante da aplicação.
  }
}

export function isWorkTypeVisible(workType: WorkType, profile?: ProfileLike) {
  return getVisibleWorkTypes(profile).includes(workType);
}
