export type SupportedLocale = "id" | "en";

const formatterId = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const formatterEn = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "IDR",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Format integer Rupiah sesuai aturan AGENTS.md §6:
 * - id: "Rp18.000" (tanpa spasi non-breaking agar konsisten di SSR/klien)
 * - en: "IDR 18,000"
 */
export function formatRupiah(
  amountInteger: number,
  locale: SupportedLocale = "id"
): string {
  if (!Number.isFinite(amountInteger) || !Number.isInteger(amountInteger)) {
    throw new Error("Jumlah uang harus berupa integer Rupiah.");
  }

  if (locale === "en") {
    return formatterEn.format(amountInteger).replace(/\u00a0/g, " ");
  }

  return formatterId.format(amountInteger).replace(/\s+/g, "");
}

export function formatNumber(
  value: number,
  locale: SupportedLocale = "id"
): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID").format(
    value
  );
}
