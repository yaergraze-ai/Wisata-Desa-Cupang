export function AmbientBackground() {
  return (
    <div
      className="ambient-container"
      aria-hidden="true"
    >
      {/* Orb 1: Warm Radiant Sunrise Amber (kiri atas) */}
      <span className="ambient-orb ambient-orb-one" />
      {/* Orb 2: Electric Sapphire Blue (kanan tengah) */}
      <span className="ambient-orb ambient-orb-two" />
      {/* Orb 3: Cyan Alpine Azure (bawah tengah) */}
      <span className="ambient-orb ambient-orb-three" />
    </div>
  );
}
