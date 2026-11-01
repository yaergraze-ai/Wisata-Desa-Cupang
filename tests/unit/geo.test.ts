import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  bearingToCardinal,
  calculateBearingDegrees,
  calculateHaversineDistanceMeters,
  computeTrailTelemetry,
  GUNUNG_BENDERA_TRAIL_POSTS,
  haversineDistanceM,
  projectPointToSegment,
} from "../../src/lib/geo";

describe("Geometri Jalur Gunung Bendera (Fase 6)", () => {
  it("memverifikasi koordinat 6 pos resmi Gunung Bendera lengkap dan berurutan", () => {
    expect(GUNUNG_BENDERA_TRAIL_POSTS).toHaveLength(6);
    expect(GUNUNG_BENDERA_TRAIL_POSTS[0]!.code).toBe("TRAILHEAD");
    expect(GUNUNG_BENDERA_TRAIL_POSTS[1]!.code).toBe("POS-1");
    expect(GUNUNG_BENDERA_TRAIL_POSTS[2]!.code).toBe("POS-2");
    expect(GUNUNG_BENDERA_TRAIL_POSTS[3]!.code).toBe("POS-3");
    expect(GUNUNG_BENDERA_TRAIL_POSTS[4]!.code).toBe("POS-4");
    expect(GUNUNG_BENDERA_TRAIL_POSTS[5]!.code).toBe("SUMMIT");
  });

  it("menghitung jarak Haversine antar-pos sesuai karakteristik topografi bukit", () => {
    const p0 = GUNUNG_BENDERA_TRAIL_POSTS[0]!;
    const p1 = GUNUNG_BENDERA_TRAIL_POSTS[1]!;
    const p2 = GUNUNG_BENDERA_TRAIL_POSTS[2]!;
    const p3 = GUNUNG_BENDERA_TRAIL_POSTS[3]!;
    const p4 = GUNUNG_BENDERA_TRAIL_POSTS[4]!;
    const p5 = GUNUNG_BENDERA_TRAIL_POSTS[5]!;

    const d01 = haversineDistanceM(p0, p1);
    expect(d01).toBeGreaterThan(270);
    expect(d01).toBeLessThan(310);

    const d12 = haversineDistanceM(p1, p2);
    expect(d12).toBeGreaterThan(80);
    expect(d12).toBeLessThan(110);

    const d23 = haversineDistanceM(p2, p3);
    expect(d23).toBeGreaterThan(120);
    expect(d23).toBeLessThan(160);

    const d34 = haversineDistanceM(p3, p4);
    expect(d34).toBeGreaterThan(45);
    expect(d34).toBeLessThan(75);

    const d45 = haversineDistanceM(p4, p5);
    expect(d45).toBeGreaterThan(260);
    expect(d45).toBeLessThan(310);

    // Alias konsisten
    expect(calculateHaversineDistanceMeters(p0, p1)).toBe(d01);
  });

  it("menghitung bearing kompas dan arah kardinal dengan akurat", () => {
    const p0 = GUNUNG_BENDERA_TRAIL_POSTS[0]!;
    const p1 = GUNUNG_BENDERA_TRAIL_POSTS[1]!;

    // Dari Pintu Masuk ke Pos 1 mengarah ke Selatan sedikit ke Timur
    const deg = bearingDegrees(p0, p1);
    expect(deg).toBeGreaterThan(160);
    expect(deg).toBeLessThan(190);
    expect(bearingToCardinal(deg)).toBe("S");

    // Alias konsisten
    expect(calculateBearingDegrees(p0, p1)).toBe(deg);

    // Kardinal 8 arah
    expect(bearingToCardinal(0)).toBe("N");
    expect(bearingToCardinal(45)).toBe("NE");
    expect(bearingToCardinal(90)).toBe("E");
    expect(bearingToCardinal(135)).toBe("SE");
    expect(bearingToCardinal(180)).toBe("S");
    expect(bearingToCardinal(225)).toBe("SW");
    expect(bearingToCardinal(270)).toBe("W");
    expect(bearingToCardinal(315)).toBe("NW");
  });

  it("memproyeksikan titik pengguna ke segmen garis secara tegak lurus", () => {
    const a = { lat: -6.731303, lng: 108.382303 };
    const b = { lat: -6.732029, lng: 108.38256 };
    // Titik tepat di tengah segmen a..b
    const mid = {
      lat: (a.lat + b.lat) / 2,
      lng: (a.lng + b.lng) / 2,
    };
    const proj = projectPointToSegment(mid, a, b);
    expect(proj.distanceM).toBeLessThan(0.1);
    expect(proj.t).toBeGreaterThan(0.45);
    expect(proj.t).toBeLessThan(0.55);
  });

  it("mendeteksi pengguna tepat di jalur (on-trail) dengan jarak deviasi < 5 meter", () => {
    const pos2 = GUNUNG_BENDERA_TRAIL_POSTS[2]!;
    const telemetry = computeTrailTelemetry(
      { lat: pos2.lat, lng: pos2.lng },
      GUNUNG_BENDERA_TRAIL_POSTS,
      35
    );
    expect(telemetry.isOffTrail).toBe(false);
    expect(telemetry.distanceToTrailM).toBeLessThan(2);
    expect(telemetry.nearestPost.code).toBe("POS-2");
    expect(telemetry.distanceToNearestPostM).toBeLessThan(2);
  });

  it("mendeteksi peringatan keluar jalur (>35 m) dan memberikan azimuth kembali ke jalur", () => {
    const pos3 = GUNUNG_BENDERA_TRAIL_POSTS[3]!;
    // Geser 70 meter ke arah barat (minus bujur)
    const deviatedUser = {
      lat: pos3.lat,
      lng: pos3.lng - 0.0007,
    };
    const telemetry = computeTrailTelemetry(
      deviatedUser,
      GUNUNG_BENDERA_TRAIL_POSTS,
      35
    );
    expect(telemetry.isOffTrail).toBe(true);
    expect(telemetry.distanceToTrailM).toBeGreaterThan(35);
    // Karena tersesat di barat, arah kembali harus ke arah Timur (E / NE / SE)
    expect(["E", "NE", "SE"]).toContain(telemetry.returnDirectionCode);
    expect(telemetry.returnBearingDeg).toBeGreaterThan(45);
    expect(telemetry.returnBearingDeg).toBeLessThan(135);
  });
});
