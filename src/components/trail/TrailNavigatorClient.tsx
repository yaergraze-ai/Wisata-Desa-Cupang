"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Map as MapInstance, Marker as MarkerInstance } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  computeTrailTelemetry,
  GUNUNG_BENDERA_TRAIL_POSTS,
  type GeoCoord,
  type TrailTelemetryResult,
} from "@/lib/geo";

export interface TrailNavigatorClientProps {
  offTrailThresholdM: number;
}

type MapLibreModule = typeof import("maplibre-gl");

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function subscribeOnline(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

interface OfflineMapManifest {
  name: string;
  bbox: [number, number, number, number];
  center: [number, number, number];
  pmtiles: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  fallbackOnlineTileUrl: string;
  attribution: string;
}

const MAP_CACHE_NAME = "wisata_cirebon_map_cache";

export function TrailNavigatorClient({
  offTrailThresholdM,
}: TrailNavigatorClientProps) {
  const t = useTranslations("Navigator");
  const tLegal = useTranslations("Legal");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MapInstance | null>(null);
  const maplibreglRef = useRef<MapLibreModule | null>(null);
  const userMarkerRef = useRef<MarkerInstance | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "active" | "denied">("idle");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoCoord | null>(null);
  const [userAccuracyM, setUserAccuracyM] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TrailTelemetryResult | null>(null);
  const [selectedPostCode, setSelectedPostCode] = useState<string>("TRAILHEAD");

  // Mode Tampilan Peta: Satelit HD (Default) vs Topografi
  const [mapLayerMode, setMapLayerMode] = useState<"satellite" | "topo">("satellite");
  // Orientasi Kamera: Arah Nanjak (Bawah ke Atas) vs Arah Utara
  const [cameraOrientation, setCameraOrientation] = useState<"climb" | "north">("climb");
  
  // State Integrasi Strava & Perekam GPS Real-Time
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthleteId, setStravaAthleteId] = useState("");
  const [showStravaModal, setShowStravaModal] = useState(false);
  const [stravaInputId, setStravaInputId] = useState("");
  const [isRecordingActivity, setIsRecordingActivity] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedPoints, setRecordedPoints] = useState<
    Array<{ lat: number; lng: number; time: string; ele: number }>
  >([]);

  // Offline map downloader state
  const [isCachedOffline, setIsCachedOffline] = useState(false);
  const [isDownloadingMap, setIsDownloadingMap] = useState(false);
  const [downloadProgressPct, setDownloadProgressPct] = useState(0);
  const [downloadBytesText, setDownloadBytesText] = useState("");

  // Cek apakah peta offline sudah ada di CacheStorage
  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    caches.open(MAP_CACHE_NAME).then((cache) => {
      cache.match("/maps/cirebon.pmtiles").then((matched) => {
        setIsCachedOffline(Boolean(matched));
      });
    }).catch(() => undefined);
  }, []);

  // Inisialisasi MapLibre GL 6 + PMTiles Protocol
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    async function initMap() {
      try {
        const [maplibreMod, pmtilesMod] = await Promise.all([
          import("maplibre-gl"),
          import("pmtiles"),
        ]);

        if (cancelled || !mapContainerRef.current) return;

        const maplibregl = ("default" in maplibreMod
          ? maplibreMod.default
          : maplibreMod) as unknown as MapLibreModule & {
          setWorkerUrl?: (url: string) => void;
        };
        maplibreglRef.current = maplibregl;
        const { Protocol } = pmtilesMod;

        // Pasang worker URL lokal dan protokol PMTiles
        if (typeof maplibregl.setWorkerUrl === "function") {
          maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
        }
        const protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);

        const centerLng = 108.3822;
        const centerLat = -6.7322;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
              "osm-raster": {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors | Wisata Cirebon",
              },
              "satellite-raster": {
                type: "raster",
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                attribution: "© Esri World Imagery | Wisata Desa Cupang",
              },
            },
            layers: [
              {
                id: "satellite-raster-layer",
                type: "raster",
                source: "satellite-raster",
                layout: {
                  visibility: "visible",
                },
                minzoom: 0,
                maxzoom: 19,
              },
              {
                id: "osm-raster-layer",
                type: "raster",
                source: "osm-raster",
                layout: {
                  visibility: "none",
                },
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: [centerLng, centerLat],
          zoom: 15.4,
          minZoom: 12,
          maxZoom: 18,
          pitch: 45,
          bearing: 195, // Orientasi pendakian dari bawah ke atas (Pintu masuk di bawah, Puncak 520 mdpl di atas)
        });

        mapInstanceRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          setMapLoaded(true);

          // 1. Tambahkan GeoJSON garis jalur Gunung Bendera
          const lineCoordinates = GUNUNG_BENDERA_TRAIL_POSTS.map((p) => [p.lng, p.lat]);

          map.addSource("trail-track", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { name: "Jalur Gunung Bendera" },
              geometry: {
                type: "LineString",
                coordinates: lineCoordinates,
              },
            },
          });

          // Bayangan luar jalur
          map.addLayer({
            id: "trail-track-casing",
            type: "line",
            source: "trail-track",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#08110E",
              "line-width": 8,
              "line-opacity": 0.85,
            },
          });

          // Garis jalur utama hijau zamrud terang
          map.addLayer({
            id: "trail-track-line",
            type: "line",
            source: "trail-track",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#2F8F83",
              "line-width": 4.5,
            },
          });

          // 2. Tambahkan Pin Marker untuk 6 Pos Resmi
          GUNUNG_BENDERA_TRAIL_POSTS.forEach((post) => {
            const el = document.createElement("div");
            el.className =
              "flex flex-col items-center cursor-pointer select-none group transition-transform hover:scale-110";
            el.innerHTML = `
              <div class="flex items-center gap-1 px-2 py-1 rounded-full border-2 border-[#F2A65A] bg-[#08110E]/90 text-[11px] font-black text-[#F4F1EA] shadow-xl">
                <span class="w-2 h-2 rounded-full ${post.code === "SUMMIT" ? "bg-red-500 animate-ping" : "bg-[#2F8F83]"}"></span>
                <span>${post.code}</span>
              </div>
              <div class="w-0.5 h-3 bg-[#F2A65A]"></div>
            `;

            el.addEventListener("click", () => {
              setSelectedPostCode(post.code);
              map.flyTo({ center: [post.lng, post.lat], zoom: 16.5, speed: 1.2 });
            });

            new maplibregl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([post.lng, post.lat])
              .addTo(map);
          });

          // Kontrol navigasi bawaan MapLibre
          map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
        });
      } catch (err) {
        console.error("Gagal memuat peta MapLibre:", err);
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handler update posisi GPS pengguna
  const handlePositionUpdate = useCallback(
    (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const coord: GeoCoord = { lat: latitude, lng: longitude };
      setUserLocation(coord);
      setUserAccuracyM(Math.round(accuracy));
      setGpsStatus("active");

      // Hitung telemetri jalur & deteksi deviasi keluar jalur
      const tel = computeTrailTelemetry(coord, GUNUNG_BENDERA_TRAIL_POSTS, offTrailThresholdM);
      setTelemetry(tel);

      // Getarkan perangkat jika keluar jalur (> thresholdMeters)
      if (tel.isOffTrail && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // Update marker pengguna pada peta secara sinkron (anti-duplikasi & anti-bug)
      const map = mapInstanceRef.current;
      const maplibregl = maplibreglRef.current;
      if (map && maplibregl && mapLoaded) {
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "user-gps-marker select-none pointer-events-none";
          el.innerHTML = `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
              <div class="absolute -inset-4 rounded-full bg-cyan-400/35 animate-ping"></div>
              <div class="absolute -inset-2 rounded-full bg-cyan-400/50 animate-pulse"></div>
              <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_18px_rgba(6,182,212,0.95)] text-white text-xs font-black">
                <i class="bi bi-geo-alt-fill text-[13px]"></i>
              </div>
            </div>
          `;
          userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([longitude, latitude])
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
      }

      // Catat koordinat jika perekaman aktivitas GPS sedang berjalan
      if (isRecordingActivity) {
        setRecordedPoints((prev) => [
          ...prev,
          {
            lat: latitude,
            lng: longitude,
            time: new Date().toISOString(),
            ele: tel?.nearestPost.elevationM ?? 120,
          },
        ]);
      }
    },
    [mapLoaded, offTrailThresholdM, isRecordingActivity]
  );

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    console.warn("Geolocation error:", err.message);
    setGpsStatus("denied");
  }, []);

  // Mulai pelacakan GPS
  const startGpsTracking = useCallback(() => {
    setShowPermissionDialog(false);
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }

    setGpsStatus("requesting");
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 4000,
      }
    );
  }, [handlePositionError, handlePositionUpdate]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Pusatkan peta ke posisi pengguna
  const handleRecenterToUser = useCallback(() => {
    if (!userLocation || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 16.5,
      speed: 1.2,
    });
  }, [userLocation]);

  // Unduh peta offline PMTiles dan simpan ke CacheStorage
  const handleDownloadOfflineMap = useCallback(async () => {
    if (isDownloadingMap || typeof window === "undefined" || !("caches" in window)) return;
    setIsDownloadingMap(true);
    setDownloadProgressPct(0);

    try {
      const manifestRes = await fetch("/maps/manifest.json");
      if (!manifestRes.ok) throw new Error("Manifest peta tidak ditemukan.");
      const manifest = (await manifestRes.json()) as OfflineMapManifest;

      const pmtilesRes = await fetch(manifest.pmtiles);
      if (!pmtilesRes.ok) throw new Error("Berkas PMTiles tidak dapat diunduh.");

      const contentLength = Number(pmtilesRes.headers.get("Content-Length")) || manifest.sizeBytes;
      const reader = pmtilesRes.body?.getReader();

      if (!reader) {
        const blob = await pmtilesRes.blob();
        const cache = await caches.open(MAP_CACHE_NAME);
        await cache.put(manifest.pmtiles, new Response(blob));
        await cache.put("/maps/manifest.json", new Response(JSON.stringify(manifest)));
        setIsCachedOffline(true);
        setIsDownloadingMap(false);
        return;
      }

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          const pct = Math.min(100, Math.round((receivedBytes / contentLength) * 100));
          setDownloadProgressPct(pct);
          setDownloadBytesText(`${Math.round(receivedBytes / 1024)} KB / ${Math.round(contentLength / 1024)} KB`);
        }
      }

      const totalBlob = new Blob(chunks as BlobPart[]);
      const cache = await caches.open(MAP_CACHE_NAME);
      await cache.put(manifest.pmtiles, new Response(totalBlob));
      await cache.put("/maps/manifest.json", new Response(JSON.stringify(manifest)));

      setIsCachedOffline(true);
    } catch (err) {
      console.error("Gagal mengunduh peta offline:", err);
    } finally {
      setIsDownloadingMap(false);
    }
  }, [isDownloadingMap]);

  // Hapus cache peta offline
  const handleDeleteOfflineMap = useCallback(async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    const cache = await caches.open(MAP_CACHE_NAME);
    await cache.delete("/maps/cirebon.pmtiles");
    await cache.delete("/maps/manifest.json");
    setIsCachedOffline(false);
  }, []);

  // Ganti Layer: Satelit HD / Topografi
  const toggleMapLayer = useCallback((mode: "satellite" | "topo") => {
    setMapLayerMode(mode);
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      map.setLayoutProperty(
        "satellite-raster-layer",
        "visibility",
        mode === "satellite" ? "visible" : "none"
      );
      map.setLayoutProperty(
        "osm-raster-layer",
        "visibility",
        mode === "topo" ? "visible" : "none"
      );
    } catch (e) {
      console.warn("Layer switch warning:", e);
    }
  }, []);

  // Ganti Orientasi: Arah Nanjak (Bawah ke Atas) vs Arah Utara
  const toggleOrientation = useCallback((orient: "climb" | "north") => {
    setCameraOrientation(orient);
    const map = mapInstanceRef.current;
    if (!map) return;
    if (orient === "climb") {
      map.easeTo({ bearing: 195, pitch: 45, duration: 800 });
    } else {
      map.easeTo({ bearing: 0, pitch: 0, duration: 800 });
    }
  }, []);

  // Pusatkan peta ke Jalur Pendakian Gunung Bendera
  const handleCenterToTrail = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo({
      center: [108.3822, -6.7322],
      zoom: 15.4,
      pitch: 45,
      bearing: 195,
      speed: 1.2,
    });
  }, []);

  // Unduh GPX Aktivitas Nyata yang Direkam Member
  const handleDownloadRecordedGpx = useCallback(() => {
    if (recordedPoints.length === 0) {
      alert("Belum ada titik GPS yang terekam. Pastikan izin GPS aktif dan mulai berjalan di trek.");
      return;
    }
    const trkpts = recordedPoints
      .map(
        (p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
        <ele>${p.ele}</ele>
        <time>${p.time}</time>
      </trkpt>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wisata Desa Cupang - Strava Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Sesi Pendakian Gunung Bendera 520 MDPL</name>
    <desc>Rekaman trek GPS nyata pendakian Desa Cupang</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>Pendakian Gunung Bendera (Sesi ${new Date().toLocaleDateString("id-ID")})</name>
    <type>Hiking</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([xml], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekaman-strava-gunung-bendera-${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedPoints]);

  // Ekspor & Unduh Berkas Jalur GPX untuk Strava & Garmin
  const handleDownloadGpx = useCallback(() => {
    const trackPointsXml = GUNUNG_BENDERA_TRAIL_POSTS.map(
      (p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
        <ele>${p.elevationM}</ele>
        <name>${p.name}</name>
      </trkpt>`
    ).join("\n");

    const waypointsXml = GUNUNG_BENDERA_TRAIL_POSTS.map(
      (p) => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
    <ele>${p.elevationM}</ele>
    <name>${p.code} - ${p.name}</name>
    <sym>Summit</sym>
  </wpt>`
    ).join("\n");

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wisata Alam Desa Cupang Cirebon" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Jalur Pendakian Gunung Bendera 520 MDPL - Desa Cupang</name>
    <desc>Jalur resmi pendakian tebing purba Batu Lawang dan puncak Gunung Bendera, Cirebon</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypointsXml}
  <trk>
    <name>Trek Gunung Bendera 520 MDPL</name>
    <type>Hiking</type>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jalur-gunung-bendera-520mdpl.gpx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const selectedPost = useMemo(
    () =>
      GUNUNG_BENDERA_TRAIL_POSTS.find((p) => p.code === selectedPostCode) ??
      GUNUNG_BENDERA_TRAIL_POSTS[0]!,
    [selectedPostCode]
  );

  return (
    <div className="space-y-6">
      {/* BANNER PERINGATAN KELUAR JALUR RESMI (>35m) (§6.F) */}
      {telemetry?.isOffTrail ? (
        <div
          data-testid="off-trail-alert-banner"
          className="rounded-2xl border-4 border-red-500 bg-[#2E0808] p-5 text-white shadow-2xl animate-pulse"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-2xl text-white">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-black uppercase tracking-tight text-red-200 sm:text-xl">
                {t("offTrailAlertTitle")}
              </h2>
              <p className="text-xs font-bold text-red-100 sm:text-sm">
                {t("offTrailAlertDesc", {
                  distance: telemetry.distanceToTrailM,
                  direction: telemetry.returnDirectionCode,
                  bearing: telemetry.returnBearingDeg,
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* HEADER NAVIGATOR & BADGE STATUS */}
      <section className="rounded-3xl border-2 border-kabut/20 bg-obsidian p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-telaga-500 bg-telaga-950 px-3 py-1 text-xs font-extrabold text-telaga-200 uppercase">
                <i className="bi bi-compass-fill" aria-hidden="true" />
                <span>{t("eyebrow")}</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                  isOnline
                    ? "bg-telaga-500/20 text-telaga-300 border border-telaga-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                )}
              >
                <i className={cn("bi", isOnline ? "bi-globe" : "bi-wifi-off")} aria-hidden="true" />
                <span>{isOnline ? t("onlineMapBadge") : t("offlineModeBadge")}</span>
              </span>
            </div>

            <h1 className="mt-2 font-heading text-2xl font-black text-kabut sm:text-3xl">
              {t("heading")}
            </h1>
            <p className="mt-1 text-xs text-kabut/80 max-w-2xl">{t("lead")}</p>
          </div>

          {/* Tombol Kontrol GPS & Tombol Beranda */}
          <div className="flex flex-wrap items-center gap-2">
            {gpsStatus === "active" ? (
              <button
                type="button"
                data-testid="recenter-gps-btn"
                onClick={handleRecenterToUser}
                className="btn-ui btn-fajar py-2.5 text-xs font-black"
              >
                <i className="bi bi-crosshair" aria-hidden="true" />
                <span>{t("recenterMapBtn")}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="enable-gps-btn"
                onClick={() => setShowPermissionDialog(true)}
                className="btn-ui btn-telaga py-2.5 text-xs font-black"
              >
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                <span>{t("gpsEnableBtn")}</span>
              </button>
            )}

            <Link href="/" className="btn-ui btn-glass py-2.5 text-xs font-bold">
              <i className="bi bi-arrow-left" aria-hidden="true" />
              <span>{tLegal("backHome")}</span>
            </Link>
          </div>
        </div>

        {/* Status GPS teks baris */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-kabut/10 pt-3 text-xs">
          <span className="font-bold text-kabut/75">{t("gpsStatusLabel")}</span>
          {gpsStatus === "active" ? (
            <span data-testid="gps-active-badge" className="font-bold text-telaga-300">
              <i className="bi bi-check-circle-fill mr-1" aria-hidden="true" />
              {t("gpsActiveStatus", { acc: userAccuracyM ?? 10 })}
            </span>
          ) : gpsStatus === "denied" ? (
            <span data-testid="gps-denied-badge" className="font-bold text-red-400">
              <i className="bi bi-exclamation-circle-fill mr-1" aria-hidden="true" />
              {t("gpsDenied")}
            </span>
          ) : (
            <span className="text-kabut/60">
              <i className="bi bi-dash-circle mr-1" aria-hidden="true" />
              {t("gpsInactiveStatus")}
            </span>
          )}
        </div>
      </section>

      {/* CONTAINER PETA MAPLIBRE GL PENUH */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-kabut/25 bg-black shadow-2xl">
        {/* BILAH KONTROL LAPISAN SATELIT & ORIENTASI NANJAK (§6.F) */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Toggle Layer: Satelit HD / Topografi */}
          <div className="inline-flex rounded-xl bg-obsidian/90 p-1 border border-white/20 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => toggleMapLayer("satellite")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                mapLayerMode === "satellite"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                  : "text-kabut/75 hover:text-white"
              )}
            >
              <i className="bi bi-broadcast text-xs" aria-hidden="true" />
              <span>Satelit HD</span>
            </button>
            <button
              type="button"
              onClick={() => toggleMapLayer("topo")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                mapLayerMode === "topo"
                  ? "bg-fajar text-obsidian shadow-sm"
                  : "text-kabut/75 hover:text-white"
              )}
            >
              <i className="bi bi-map" aria-hidden="true" />
              <span>Topografi</span>
            </button>
          </div>

          {/* Toggle Orientasi: Arah Nanjak (Bawah ke Atas) vs Arah Utara */}
          <div className="inline-flex rounded-xl bg-obsidian/90 p-1 border border-white/20 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => toggleOrientation("climb")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                cameraOrientation === "climb"
                  ? "bg-telaga text-white shadow-sm"
                  : "text-kabut/75 hover:text-white"
              )}
              title="Arah Pendakian: Pintu masuk di bawah, Puncak di atas"
            >
              <i className="bi bi-arrow-up-circle-fill text-fajar" aria-hidden="true" />
              <span>Arah Nanjak</span>
            </button>
            <button
              type="button"
              onClick={() => toggleOrientation("north")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                cameraOrientation === "north"
                  ? "bg-telaga text-white shadow-sm"
                  : "text-kabut/75 hover:text-white"
              )}
              title="Arah Utara Standar (North-Up)"
            >
              <i className="bi bi-compass" aria-hidden="true" />
              <span>Utara</span>
            </button>
          </div>

          {/* Pintasan Kamera Cepat */}
          <div className="inline-flex rounded-xl bg-obsidian/90 p-1 border border-white/20 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={handleCenterToTrail}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-kabut/85 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Fokuskan kamera ke Jalur Pendakian Gunung Bendera"
            >
              <i className="bi bi-geo-alt-fill text-amber-400" aria-hidden="true" />
              <span>Jalur 520 mdpl</span>
            </button>
            {userLocation ? (
              <button
                type="button"
                onClick={handleRecenterToUser}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/40 transition-all cursor-pointer"
                title="Pusatkan kamera ke lokasi GPS saya"
              >
                <i className="bi bi-crosshair text-cyan-400" aria-hidden="true" />
                <span>Posisi Saya</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Indikator Koordinat Real-Time di Kanan Atas Peta */}
        {userLocation ? (
          <div className="absolute top-3 right-14 z-10 hidden sm:flex items-center gap-1.5 rounded-xl border border-white/20 bg-obsidian/90 px-3 py-1.5 text-[11px] font-mono font-bold text-fajar shadow-xl backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {userLocation.lat.toFixed(5)}°, {userLocation.lng.toFixed(5)}°
            </span>
            <span className="text-kabut/50 font-normal">
              (±{userAccuracyM ?? 10}m)
            </span>
          </div>
        ) : null}

        <div
          ref={mapContainerRef}
          data-testid="maplibre-container"
          className="h-[480px] w-full sm:h-[560px]"
        />

        {/* Overlay Kontrol Cepat di Sudut Kiri Bawah Peta */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col gap-2">
          {telemetry ? (
            <div className="pointer-events-auto rounded-2xl border-2 border-kabut/30 bg-obsidian/90 p-3.5 text-xs shadow-xl backdrop-blur-md space-y-1">
              <p className="font-bold text-fajar">
                {t("nearestPost")}: <strong>{telemetry.nearestPost.name}</strong> ({t("distanceUnit", { meters: telemetry.distanceToNearestPostM })})
              </p>
              {telemetry.nextPost ? (
                <p className="text-kabut/90">
                  {t("nextPost")}: <strong>{telemetry.nextPost.name}</strong> {t("telemetryRemaining", { meters: telemetry.distanceToNextPostM, mins: telemetry.estimatedMinutesToNextPost })}
                </p>
              ) : (
                <p className="font-bold text-telaga-200">{t("atSummitBadge")}</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* PANEL TELEMETRI DAN PENGUNDUH PETA OFFLINE PMTILES */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* KARTU 1: TELEMETRI LENGKAP PENDAKI */}
        <section className="surface-solid-dark p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-black text-kabut">
              {t("telemetryHeading")}
            </h2>
            <span className="font-mono text-xs text-fajar">
              {t("deviationLimitLabel", { meters: offTrailThresholdM })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-kabut/15 bg-obsidian p-3">
              <span className="text-kabut/70">{t("currentElevation")}</span>
              <p className="mt-1 font-mono text-lg font-black text-fajar">
                {t("elevationDisplay", { elevation: telemetry ? telemetry.nearestPost.elevationM : selectedPost.elevationM })}
              </p>
            </div>

            <div className="rounded-xl border border-kabut/15 bg-obsidian p-3">
              <span className="text-kabut/70">{t("totalGain")}</span>
              <p className="mt-1 font-mono text-lg font-black text-telaga-200">
                {t("elevationGainValue")}
              </p>
            </div>

            <div className="rounded-xl border border-kabut/15 bg-obsidian p-3">
              <span className="text-kabut/70">{t("nearestPost")}</span>
              <p className="mt-1 font-heading text-sm font-bold text-kabut truncate">
                {telemetry ? telemetry.nearestPost.name : selectedPost.name}
              </p>
            </div>

            <div className="rounded-xl border border-kabut/15 bg-obsidian p-3">
              <span className="text-kabut/70">{t("nextPost")}</span>
              <p className="mt-1 font-heading text-sm font-bold text-kabut truncate">
                {telemetry?.nextPost ? telemetry.nextPost.name : t("summitTarget")}
              </p>
            </div>
          </div>

          {/* Bar Progres Jalur */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-extrabold text-kabut">
              <span>{t("trailProgress")}</span>
              <span className="font-mono text-fajar">
                {telemetry ? Math.round(telemetry.progressRatio * 100) : 0}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-kabut/20 bg-obsidian">
              <div
                className="h-full bg-gradient-to-r from-telaga-500 to-fajar transition-all duration-500"
                style={{
                  width: `${telemetry ? Math.round(telemetry.progressRatio * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </section>

        {/* KARTU 2: PENGUNDUH PETA OFFLINE PMTILES (§6.G) */}
        <section className="surface-solid-dark p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-fajar bg-obsidian text-fajar">
              <i className="bi bi-hdd-fill" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-base font-black text-kabut">
                {t("offlineMapHeading")}
              </h2>
              <p className="text-xs text-kabut/75">{t("offlineMapDesc")}</p>
            </div>
          </div>

          {isCachedOffline ? (
            <div className="rounded-2xl border-2 border-telaga-500/40 bg-hutan p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-telaga-200">
                <i className="bi bi-check-circle-fill text-fajar text-base" aria-hidden="true" />
                <span>{t("mapCachedSuccess")}</span>
              </div>
              <p className="text-xs text-kabut/75">
                {t("mapCachedDetail")}
              </p>
              <button
                type="button"
                data-testid="delete-map-cache-btn"
                onClick={handleDeleteOfflineMap}
                className="btn-ui btn-glass py-2 text-xs font-bold text-red-300"
              >
                <i className="bi bi-trash" aria-hidden="true" />
                <span>{t("deleteOfflineMapBtn")}</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-kabut/20 bg-obsidian p-4 space-y-3">
              {isDownloadingMap ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-fajar">
                    <span>{t("downloadingProgress", { pct: downloadProgressPct, loaded: downloadBytesText.split("/")[0]?.trim() || "0 KB", total: downloadBytesText.split("/")[1]?.trim() || "532 KB" })}</span>
                    <span>{downloadProgressPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-hutan">
                    <div
                      className="h-full bg-fajar transition-all duration-200"
                      style={{ width: `${downloadProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="download-offline-map-btn"
                  onClick={handleDownloadOfflineMap}
                  className="btn-ui btn-fajar w-full py-3 text-xs font-black"
                >
                  <i className="bi bi-cloud-arrow-down-fill text-sm" aria-hidden="true" />
                  <span>{t("downloadOfflineMapBtn")}</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* INTEGRASI STRAVA & EKSPOR JALUR GPX (§6.F & §10.2) */}
      <section className="surface-solid-dark p-6 rounded-3xl border border-white/10 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FC4C02]/15 border border-[#FC4C02]/40 text-[#FC4C02] shadow-md shadow-[#FC4C02]/10">
              <i className="bi bi-strava text-2xl" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-base font-bold text-kabut">
                  Integrasi Strava & Sinkronisasi Trek GPS
                </h2>
                <span className="rounded-full bg-[#FC4C02]/20 border border-[#FC4C02]/40 px-2 py-0.5 text-[10px] font-bold text-[#FC4C02]">
                  Strava Verified 520 MDPL
                </span>
              </div>
              <p className="text-xs text-kabut/70 mt-1 max-w-xl">
                Rekam langsung via aplikasi Strava, sinkronkan ID atlet member Anda, atau unduh rute resmi GPX terverifikasi untuk Garmin, Suunto, dan Coros.
              </p>
            </div>
          </div>

          {/* Tombol Aksi Strava */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadGpx}
              className="btn-ui btn-glass text-xs font-bold py-2.5 px-3 flex items-center gap-1.5 hover:text-fajar transition-all cursor-pointer"
              title="Unduh trek koordinat GPX resmi Gunung Bendera (120 - 520 mdpl)"
            >
              <i className="bi bi-download text-sm text-fajar" aria-hidden="true" />
              <span>Unduh Jalur GPX (.gpx)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                // Buka aplikasi Strava via deeplink
                window.location.href = "strava://record";
                setTimeout(() => {
                  window.open("https://www.strava.com/activities/new", "_blank");
                }, 1500);
              }}
              className="btn-ui bg-[#FC4C02] hover:bg-[#e04300] text-white py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-[#FC4C02]/30 cursor-pointer"
              title="Buka perekam aktivitas di aplikasi Strava ponsel"
            >
              <i className="bi bi-record-circle-fill text-white text-xs animate-pulse" aria-hidden="true" />
              <span>Buka di Strava</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStravaInputId(stravaAthleteId);
                setShowStravaModal(true);
              }}
              className={cn(
                "btn-ui py-2.5 px-3.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                stravaConnected
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25"
                  : "btn-glass text-kabut/85 hover:text-white"
              )}
            >
              <i className="bi bi-person-badge text-xs" aria-hidden="true" />
              <span>{stravaConnected ? `✓ ID: ${stravaAthleteId || "Terkoneksi"}` : "Hubungkan Akun"}</span>
            </button>
          </div>
        </div>

        {/* Live Trek GPS Logger Member (Rekam Aktivitas Mandiri) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm",
              isRecordingActivity
                ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
                : "bg-white/5 border-white/10 text-kabut/60"
            )}>
              <i className={cn("bi", isRecordingActivity ? "bi-record-fill" : "bi-stopwatch")} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-kabut">
                {isRecordingActivity ? "Perekaman Sesi GPS Berjalan" : "Perekam Jejak Pendakian Real-Time"}
              </p>
              <p className="text-[11px] text-kabut/65">
                {isRecordingActivity
                  ? `Durasi: ${Math.floor(recordingSeconds / 60)}m ${recordingSeconds % 60}s • ${recordedPoints.length} titik GPS tercatat`
                  : "Catat setiap koordinat langkah Anda di lereng Gunung Bendera lalu ekspor ke GPX untuk Strava"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isRecordingActivity ? (
              <button
                type="button"
                onClick={() => {
                  if (gpsStatus !== "active") {
                    startGpsTracking();
                  }
                  setIsRecordingActivity(true);
                  setRecordedPoints([]);
                  setRecordingSeconds(0);
                }}
                className="btn-ui btn-fajar py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <i className="bi bi-play-fill text-sm" aria-hidden="true" />
                <span>Mulai Rekam Aktivitas</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadRecordedGpx}
                  disabled={recordedPoints.length === 0}
                  className="btn-ui btn-glass py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="bi bi-download text-xs text-fajar" aria-hidden="true" />
                  <span>Unduh GPX Rekaman</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecordingActivity(false)}
                  className="btn-ui bg-red-600 hover:bg-red-500 text-white py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="bi bi-stop-fill text-xs" aria-hidden="true" />
                  <span>Selesai</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Informasi Status Real-Time Member di Jalur */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5 text-xs">
          <div className="rounded-xl border border-white/10 bg-obsidian/60 p-3">
            <span className="text-[11px] text-kabut/60">Status Lokasi Member</span>
            <p className="font-bold text-kabut mt-0.5 flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", userLocation ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
              <span>{userLocation ? "Aktif di Jalur" : "Menunggu Sinyal"}</span>
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-obsidian/60 p-3">
            <span className="text-[11px] text-kabut/60">Koordinat Saat Ini</span>
            <p className="font-mono text-xs font-bold text-fajar mt-0.5 truncate">
              {userLocation
                ? `${userLocation.lat.toFixed(5)}°, ${userLocation.lng.toFixed(5)}°`
                : "6.72873° S, 108.38206° E"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-obsidian/60 p-3">
            <span className="text-[11px] text-kabut/60">Segmen Resmi Strava</span>
            <p className="font-mono text-xs font-bold text-telaga-300 mt-0.5">
              2.25 km (+400m Gain)
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-obsidian/60 p-3">
            <span className="text-[11px] text-kabut/60">Target Elevasi</span>
            <p className="font-mono text-xs font-bold text-emerald-400 mt-0.5">
              520 mdpl (Puncak)
            </p>
          </div>
        </div>
      </section>

      {/* RINCIAN 6 POS RESMI JALUR PENDAKIAN */}
      <section className="surface-solid-dark p-6 space-y-4">
        <h2 className="font-heading text-lg font-black text-kabut">
          {t("postsListHeading")}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUNUNG_BENDERA_TRAIL_POSTS.map((post) => {
            const isSelected = selectedPostCode === post.code;
            return (
              <button
                key={post.code}
                type="button"
                data-testid={`trail-post-card-${post.code}`}
                onClick={() => {
                  setSelectedPostCode(post.code);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo({
                      center: [post.lng, post.lat],
                      zoom: 16.5,
                      speed: 1.2,
                    });
                  }
                }}
                className={cn(
                  "flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-fajar bg-fajar/15 shadow-lg"
                    : "border-kabut/15 bg-obsidian hover:border-kabut/40"
                )}
              >
                <div className="flex w-full items-center justify-between text-xs font-extrabold">
                  <span className="rounded bg-hutan px-2 py-0.5 text-fajar">
                    {post.code}
                  </span>
                  <span className="text-kabut/80">{t("elevationDisplay", { elevation: post.elevationM })}</span>
                </div>
                <h3 className="mt-2 font-heading text-sm font-black text-kabut">
                  {post.name}
                </h3>
                <p className="mt-1 font-mono text-[11px] text-telaga-300">
                  {post.lat.toFixed(6)}, {post.lng.toFixed(6)}
                </p>
                <p className="mt-2 text-xs font-bold text-fajar">
                  {post.order === 0
                    ? t("startPointBadge")
                    : t("segmentDetail", { meters: post.distFromPrevM, mins: post.minsFromPrev })}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* DIALOG PENJELASAN IZIN GPS RAMAH PENGGUNA SEBELUM watchPosition (§6.F) */}
      {/* MODAL KONEKSI ID ATLET STRAVA */}
      {showStravaModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm select-none">
          <div className="w-full max-w-md rounded-3xl border-2 border-[#FC4C02]/60 bg-obsidian p-6 text-kabut shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-[#FC4C02]">
                <i className="bi bi-strava text-2xl" aria-hidden="true" />
                <h3 className="font-heading text-base font-bold text-kabut">
                  Hubungkan Akun Strava
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStravaModal(false)}
                className="text-kabut/60 hover:text-white cursor-pointer"
              >
                <i className="bi bi-x-lg text-sm" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-kabut/75 leading-relaxed">
              Masukkan ID Atlet atau tautan profil Strava Anda (misal: <code>strava.com/athletes/12345678</code> atau nomor <code>12345678</code>) untuk menautkan statistik pendakian Anda dengan akun member Desa Cupang.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-kabut/90">ID / Username Strava</label>
              <input
                type="text"
                value={stravaInputId}
                onChange={(e) => setStravaInputId(e.target.value)}
                placeholder="Contoh: 12345678 atau syarofi_kunaedi"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-kabut focus:border-[#FC4C02] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowStravaModal(false)}
                className="btn-ui btn-glass text-xs py-2 px-3"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleaned = stravaInputId.trim().replace(/.*athletes\//, "");
                  if (!cleaned) {
                    alert("Silakan masukkan ID atau tautan profil Strava Anda.");
                    return;
                  }
                  setStravaAthleteId(cleaned);
                  setStravaConnected(true);
                  try {
                    localStorage.setItem("wdc_strava_athlete", cleaned);
                  } catch {
                    // ignore
                  }
                  setShowStravaModal(false);
                }}
                className="btn-ui bg-[#FC4C02] hover:bg-[#e04300] text-white text-xs font-bold py-2 px-4 cursor-pointer"
              >
                Simpan & Hubungkan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPermissionDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-fajar bg-obsidian p-6 text-kabut shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-fajar bg-hutan text-2xl text-fajar">
                <i className="bi bi-shield-check" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-lg font-black text-kabut">
                  {t("gpsPreDialogTitle")}
                </h3>
                <span className="text-xs text-telaga-200">
                  {t("privacyProtected")}
                </span>
              </div>
            </div>

            <p className="text-xs text-kabut/85 leading-relaxed">
              {t("gpsPreDialogDesc")}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPermissionDialog(false)}
                className="btn-ui btn-glass text-xs"
              >
                {t("cancelBtn")}
              </button>
              <button
                type="button"
                data-testid="confirm-enable-gps-btn"
                onClick={startGpsTracking}
                className="btn-ui btn-fajar text-xs font-black"
              >
                <i className="bi bi-geo-alt-fill mr-1" aria-hidden="true" />
                <span>{t("gpsEnableBtn")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
