// Conversão e normalização de valores monetários informados em reais.
export function parsePriceCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

export function formatPriceCents(cents: number) {
  const safeCents = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return (safeCents / 100).toFixed(2).replace(".", ",");
}

export function sanitizePriceInput(value: string) {
  let normalized = value
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.]/g, "");

  // Se vier no padrão brasileiro (1.234,56), os pontos são separadores de milhar.
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "");
  } else if (normalized.includes(".")) {
    // Também aceita ponto como separador decimal e converte para vírgula na tela.
    const parts = normalized.split(".");
    const decimal = parts.pop() ?? "";
    normalized = `${parts.join("")},${decimal}`;
  }

  const [integerRaw = "", ...decimalParts] = normalized.split(",");
  const integer = integerRaw.replace(/\D/g, "");
  const hasDecimalSeparator = normalized.includes(",");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!hasDecimalSeparator) return integer;
  return `${integer},${decimal}`;
}

