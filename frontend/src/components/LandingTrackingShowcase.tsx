import React, { useEffect, useRef, useState, useMemo } from "react";
import { Phone, Clock, RotateCcw, Play, Pause, CheckCircle2 } from "lucide-react";

declare const L: any;

interface CityOption {
  id: string;
  name: string;
  coords: [number, number];
}

const CITIES: CityOption[] = [
  { id: "gurugram", name: "Gurugram", coords: [28.4595, 77.0266] },
  { id: "delhi", name: "Delhi", coords: [28.6139, 77.209] },
  { id: "bengaluru", name: "Bengaluru", coords: [12.9352, 77.6245] },
  { id: "mumbai", name: "Mumbai", coords: [19.0607, 72.8362] },
];

function generateWaypoints(dest: [number, number]): [number, number][] {
  const [dLat, dLng] = dest;
  return [
    [dLat + 0.0135, dLng - 0.0155],
    [dLat + 0.0118, dLng - 0.0125],
    [dLat + 0.0092, dLng - 0.0112],
    [dLat + 0.0075, dLng - 0.0068],
    [dLat + 0.0042, dLng - 0.0035],
    [dLat + 0.0018, dLng - 0.0012],
    dest,
  ];
}

export function LandingTrackingShowcase() {
  const [selectedCity, setSelectedCity] = useState<CityOption>(CITIES[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [stepIndex, setStepIndex] = useState(1);
  const [called, setCalled] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const workerMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const activePolylineRef = useRef<any>(null);
  const completedPolylineRef = useRef<any>(null);

  const waypoints = useMemo(() => generateWaypoints(selectedCity.coords), [selectedCity]);
  const totalSteps = waypoints.length - 1;
  const currentPos = waypoints[Math.min(stepIndex, totalSteps)];
  const isArrived = stepIndex >= totalSteps;

  const progressRatio = stepIndex / totalSteps;
  const remainingKm = isArrived ? 0 : Math.max(0.1, Number(((1 - progressRatio) * 1.8).toFixed(1)));
  const remainingMins = isArrived ? 0 : Math.max(1, Math.round((1 - progressRatio) * 8));

  // Auto-movement loop
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < totalSteps ? prev + 1 : 0));
    }, 2600);

    return () => clearInterval(timer);
  }, [isPlaying, totalSteps]);

  // Leaflet initialization: 100% Free OpenStreetMap with zero API keys
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof L === "undefined") return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
      }).setView(selectedCity.coords, 14);

      mapInstanceRef.current = map;

      // Free Standard OpenStreetMap (no API key required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      // Customer Destination Pin
      const customerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-home-pin">
            <div class="pin-pulse-halo"></div>
            <div class="pin-badge-home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span class="pin-label-callout">Destination</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
      });
      customerMarkerRef.current = L.marker(selectedCity.coords, { icon: customerIcon }).addTo(map);

      // Worker Marker with radar pulse
      const workerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-worker-pin">
            <div class="worker-radar-ring"></div>
            <div class="pin-badge-worker">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span class="pin-label-callout worker">Worker</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 38],
      });
      workerMarkerRef.current = L.marker(currentPos, { icon: workerIcon }).addTo(map);

      // Polylines
      const completedPoly = L.polyline(waypoints.slice(0, stepIndex + 1), {
        color: "#176b62",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      completedPolylineRef.current = completedPoly;

      const remainingPoly = L.polyline(waypoints.slice(stepIndex), {
        color: "#c89439",
        weight: 4,
        opacity: 0.8,
        dashArray: "6, 8",
        lineCap: "round",
      }).addTo(map);
      activePolylineRef.current = remainingPoly;

      const bounds = L.latLngBounds(waypoints);
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });

      setTimeout(() => map.invalidateSize(), 200);
    } catch (err) {
      console.warn("Leaflet error:", err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [selectedCity]);

  // Update marker & route lines
  useEffect(() => {
    if (!mapInstanceRef.current || !workerMarkerRef.current || typeof L === "undefined") return;

    try {
      const pos = waypoints[Math.min(stepIndex, totalSteps)];
      workerMarkerRef.current.setLatLng(pos);

      const el = workerMarkerRef.current.getElement();
      if (el) {
        const label = el.querySelector(".pin-label-callout.worker");
        if (label) {
          label.textContent = isArrived ? "Arrived" : `${remainingKm} km`;
        }
      }

      if (completedPolylineRef.current) {
        completedPolylineRef.current.setLatLngs(waypoints.slice(0, stepIndex + 1));
      }
      if (activePolylineRef.current) {
        activePolylineRef.current.setLatLngs(waypoints.slice(stepIndex));
      }
    } catch (e) {
      // Ignore
    }
  }, [stepIndex, waypoints, totalSteps, isArrived, remainingKm]);

  return (
    <div className="landing-tracking-showcase">
      {/* ── Minimal Header ────────────────────────────────────────────── */}
      <div className="showcase-header-simple">
        <div>
          <div className="showcase-tag">
            <span className="live-pulsing-dot" /> Live Map
          </div>
          <h3>Track worker in real time</h3>
        </div>

        <div className="showcase-cities">
          {CITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={selectedCity.id === c.id ? "is-active" : ""}
              onClick={() => {
                setSelectedCity(c);
                setStepIndex(1);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clean Map Card ────────────────────────────────────────────── */}
      <div className="showcase-device-frame">
        {/* Top Status */}
        <div className="showcase-top-bar">
          <div className="showcase-eta-badge">
            <Clock size={13} />
            <span>
              {isArrived ? (
                <strong style={{ color: "#10b981" }}>Arrived at destination</strong>
              ) : (
                <>
                  <strong>{remainingMins} mins away</strong> ({remainingKm} km)
                </>
              )}
            </span>
          </div>

          <div className="showcase-playback-controls">
            <button
              type="button"
              className="playback-btn"
              title={isPlaying ? "Pause" : "Play"}
              onClick={() => setIsPlaying((v) => !v)}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button
              type="button"
              className="playback-btn"
              title="Reset"
              onClick={() => setStepIndex(0)}
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Map Viewport */}
        <div className="showcase-map-container" ref={mapContainerRef}>
          {isArrived && (
            <div className="showcase-arrived-overlay">
              <CheckCircle2 size={16} />
              <span>Worker has arrived</span>
            </div>
          )}
        </div>

        {/* Minimal Bottom Bar */}
        <div className="showcase-bottom-bar-simple">
          <div className="simple-worker-info">
            <div className="sheet-avatar">AK</div>
            <div>
              <strong>Arun Kumar</strong>
              <small>Electrician • Verified</small>
            </div>
          </div>

          <button
            type="button"
            className="sheet-call-btn"
            onClick={() => {
              setCalled(true);
              setTimeout(() => setCalled(false), 2500);
            }}
          >
            <Phone size={13} />
            <span>{called ? "Calling..." : "Call"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
