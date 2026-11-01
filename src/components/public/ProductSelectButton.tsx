"use client";

export function ProductSelectButton({
  packageCode,
  label,
  className,
}: {
  packageCode: "TIKET_PUTIH" | "REGULER_BL";
  label: string;
  className: string;
}) {
  function handleClick() {
    window.dispatchEvent(
      new CustomEvent("wisata:select-package", {
        detail: { packageCode },
      })
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("kalkulator-tiket")?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
