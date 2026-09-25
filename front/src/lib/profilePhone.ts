/** Normaliza um número brasileiro informado com DDD para E.164. */
export function normalizeBrazilianPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (!/^[1-9][0-9]{9,10}$/.test(national)) return null;
  return `+55${national}`;
}
