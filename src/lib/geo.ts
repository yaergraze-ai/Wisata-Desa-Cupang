export interface GeoCoord {
  lat: number;
  lng: number;
}

export interface TrailPointNode extends GeoCoord {
  order: number;
  code: string;
  name: string;
  elevationM: number;
  distFromPrevM: number;
  minsFromPrev: number;
}

export type CardinalDirectionCode =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export interface TrailTelemetryResult {
  distanceToTrailM: number;
  isOffTrail: boolean;
  projectedPoint: GeoCoord;
  returnBearingDeg: number;
  returnDirectionCode: CardinalDirectionCode;
  nearestPost: TrailPointNode;
  distanceToNearestPostM: number;
  nextPost: TrailPointNode | null;
  distanceToNextPostM: number;
  estimatedMinutesToNextPost: number;
  progressRatio: number;
}

export const calculateHaversineDistanceMeters = haversineDistanceM;
export const calculateBearingDegrees = bearingDegrees;

export const GUNUNG_BENDERA_TRAIL_POSTS: TrailPointNode[] = [
  {
    order: 0,
    code: "TRAILHEAD",
    name: "Pintu Gunung Bendera",
    lat: -6.7287300041484785,
    lng: 108.382065227753,
    elevationM: 365,
    distFromPrevM: 0,
    minsFromPrev: 0,
  },
  {
    order: 1,
    code: "POS-1",
    name: "Pos 1",
    lat: -6.731303051407472,
    lng: 108.38230336912525,
    elevationM: 410,
    distFromPrevM: 290,
    minsFromPrev: 12,
  },
  {
    order: 2,
    code: "POS-2",
    name: "Pos 2",
    lat: -6.732029541218015,
    lng: 108.38256010969788,
    elevationM: 438,
    distFromPrevM: 95,
    minsFromPrev: 6,
  },
  {
    order: 3,
    code: "POS-3",
    name: "Pos 3",
    lat: -6.733036871907536,
    lng: 108.38324270590506,
    elevationM: 472,
    distFromPrevM: 140,
    minsFromPrev: 8,
  },
  {
    order: 4,
    code: "POS-4",
    name: "Pos 4",
    lat: -6.733372648339432,
    lng: 108.38289821809958,
    elevationM: 490,
    distFromPrevM: 60,
    minsFromPrev: 4,
  },
  {
    order: 5,
    code: "SUMMIT",
    name: "Puncak Gunung Bendera",
    lat: -6.73529125216858,
    lng: 108.38117851090418,
    elevationM: 520,
    distFromPrevM: 285,
    minsFromPrev: 15,
  },
];

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Jarak lingkaran besar Haversine dalam meter antara dua titik koordinat WGS84.
 */
export function haversineDistanceM(a: GeoCoord, b: GeoCoord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bearing kompas awal (0° = Utara, 90° = Timur, 180° = Selatan, 270° = Barat) dari `from` menuju `to`.
 */
export function bearingDegrees(from: GeoCoord, to: GeoCoord): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function bearingToCardinal(deg: number): CardinalDirectionCode {
  const dirs: CardinalDirectionCode[] = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[idx] ?? "N";
}

/**
 * Proyeksi titik `p` ke segmen garis `a -> b` memakai proyeksi equirectangular lokal
 * (sangat presisi pada skala jalur < 5 km), lalu menghitung jarak Haversine sebenarnya.
 */
export function projectPointToSegment(
  p: GeoCoord,
  a: GeoCoord,
  b: GeoCoord
): { projected: GeoCoord; distanceM: number; t: number } {
  const meanLatRad = toRad((a.lat + b.lat + p.lat) / 3);
  const cosLat = Math.cos(meanLatRad);

  const ax = 0;
  const ay = 0;
  const bx = toRad(b.lng - a.lng) * cosLat * EARTH_RADIUS_M;
  const by = toRad(b.lat - a.lat) * EARTH_RADIUS_M;
  const px = toRad(p.lng - a.lng) * cosLat * EARTH_RADIUS_M;
  const py = toRad(p.lat - a.lat) * EARTH_RADIUS_M;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 1e-9) {
    t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  }

  const projected: GeoCoord = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };

  return {
    projected,
    distanceM: haversineDistanceM(p, projected),
    t,
  };
}

/**
 * Menghitung telemetri lengkap pendaki terhadap polyline jalur Gunung Bendera (§5.8).
 */
export function computeTrailTelemetry(
  position: GeoCoord,
  orderedPoints: readonly TrailPointNode[],
  offTrailThresholdM: number = 35
): TrailTelemetryResult {
  if (orderedPoints.length < 2) {
    throw new Error("Jalur minimal membutuhkan 2 titik koordinat.");
  }

  const sorted = [...orderedPoints].sort((a, b) => a.order - b.order);

  // Hitung panjang kumulatif tiap segmen jalur
  const segmentLengthsM: number[] = [];
  let totalTrailM = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const nxt = sorted[i + 1]!;
    const segLen = haversineDistanceM(cur, nxt);
    segmentLengthsM.push(segLen);
    totalTrailM += segLen;
  }

  let bestDistanceM = Number.POSITIVE_INFINITY;
  let bestProjected: GeoCoord = sorted[0]!;
  let bestSegmentIndex = 0;
  let bestSegmentT = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const proj = projectPointToSegment(position, a, b);
    if (proj.distanceM < bestDistanceM) {
      bestDistanceM = proj.distanceM;
      bestProjected = proj.projected;
      bestSegmentIndex = i;
      bestSegmentT = proj.t;
    }
  }

  // Cari pos terdekat dari titik pengguna saat ini
  let nearestPost = sorted[0]!;
  let distanceToNearestPostM = haversineDistanceM(position, nearestPost);
  for (const pt of sorted) {
    const d = haversineDistanceM(position, pt);
    if (d < distanceToNearestPostM) {
      distanceToNearestPostM = d;
      nearestPost = pt;
    }
  }

  // Hitung jarak sepanjang jalur hingga proyeksi pengguna
  let coveredAlongTrailM = 0;
  for (let i = 0; i < bestSegmentIndex; i++) {
    coveredAlongTrailM += segmentLengthsM[i] ?? 0;
  }
  coveredAlongTrailM += (segmentLengthsM[bestSegmentIndex] ?? 0) * bestSegmentT;

  // Tentukan pos berikutnya di arah pendakian menuju puncak
  const atSummit =
    bestSegmentIndex === sorted.length - 2 && bestSegmentT >= 0.96;
  const nextPostIndex = atSummit ? null : bestSegmentIndex + 1;
  const nextPost = nextPostIndex !== null ? sorted[nextPostIndex] ?? null : null;

  let distanceToNextPostM = 0;
  let estimatedMinutesToNextPost = 0;
  if (nextPost && nextPostIndex !== null) {
    const remainingOnCurrentSeg =
      (segmentLengthsM[bestSegmentIndex] ?? 0) * (1 - bestSegmentT);
    distanceToNextPostM = Math.round(remainingOnCurrentSeg);
    const fullSegMins = nextPost.minsFromPrev > 0 ? nextPost.minsFromPrev : 5;
    estimatedMinutesToNextPost = Math.max(
      1,
      Math.round(fullSegMins * (1 - bestSegmentT))
    );
  }

  const returnBearingDeg =
    bestDistanceM < 0.5 ? 0 : bearingDegrees(position, bestProjected);

  return {
    distanceToTrailM: Math.round(bestDistanceM * 10) / 10,
    isOffTrail: bestDistanceM > offTrailThresholdM,
    projectedPoint: bestProjected,
    returnBearingDeg: Math.round(returnBearingDeg),
    returnDirectionCode: bearingToCardinal(returnBearingDeg),
    nearestPost,
    distanceToNearestPostM: Math.round(distanceToNearestPostM),
    nextPost,
    distanceToNextPostM,
    estimatedMinutesToNextPost,
    progressRatio:
      totalTrailM > 0
        ? Math.min(1, Math.max(0, coveredAlongTrailM / totalTrailM))
        : 0,
  };
}
