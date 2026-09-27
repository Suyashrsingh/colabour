import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Navigation,
  Phone,
  ShieldCheck,
  MapPin,
  Clock,
  RotateCcw,
  Play,
  Pause,
  FastForward,
  CheckCircle2,
  Compass,
  Radio,
  Sparkles,
  ArrowRight,
} from "lucide-react";

declare const L: any;

interface CityOption {
  id: string;
  name: string;
  coords: [number, number];
  areaLabel: string;
}

const CITIES: CityOption[] = [
  {
    id: "gurugram",
    name: "Gurugram",
    coords: [28.4595, 77.0266],
    areaLabel: "DLF Phase 4 to Sector 29",
  },
  {
    id: "delhi",
    name: "Delhi NCR",
    coords: [28.6139, 77.209],
    areaLabel: "Connaught Place to Mandi House",
  },
  {
    id: "bengaluru",
    name: "Bengaluru",
    coords: [12.9352, 77.6245],
    areaLabel: "Koramangala 4th Block",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    coords: [19.0607, 72.8362],
    areaLabel: "Bandra West to Hill Road",
  },
];

// Generate realistic street waypoints between worker start and customer home
function generateWaypoints(dest: [number, number]): [number, number][] {
  const [dLat, dLng] = dest;
  const start: [number, number] = [dLat + 0.0135, dLng - 0.0155];

  return [
    start,
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
  const [perspective, setPerspective] = useState<"customer" | "worker">("customer");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFast, setIsFast] = useState(false);
  const [stepIndex, setStepIndex] = useState(1);
  const [callToast, setCallToast] = useState(false);

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
  const remainingKm = isArrived ? 0 : Math.max(0.1, Number(((1 - progressRatio) * 1.9).toFixed(1)));
  const remainingMins = isArrived ? 0 : Math.max(1, Math.round((1 - progressRatio) * 9));

  // Auto-movement simulation loop
  useEffect(() => {
    if (!isPlaying) return;

    const delay = isFast ? 1600 : 2800;
    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < totalSteps) {
          return prev + 1;
        }
        // When arrived, pause briefly and loop back
        return 0;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [isPlaying, isFast, totalSteps]);

  // Leaflet initialization & lifecycle
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

      // 100% Free CartoDB Voyager raster tiles over OpenStreetMap
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Custom markers
      // A. Destination Pin
      const customerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-home-pin">
            <div class="pin-pulse-halo"></div>
            <div class="pin-badge-home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span class="pin-label-callout">Destination Home</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
      });
      customerMarkerRef.current = L.marker(selectedCity.coords, { icon: customerIcon }).addTo(map);

      // B. Worker Marker with Live Radar Ring
      const workerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-worker-pin">
            <div class="worker-radar-ring"></div>
            <div class="pin-badge-worker">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span class="pin-label-callout worker">Arun (En Route)</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 38],
      });
      workerMarkerRef.current = L.marker(currentPos, { icon: workerIcon }).addTo(map);

      // C. Polylines
      const completedPoly = L.polyline(waypoints.slice(0, stepIndex + 1), {
        color: "#176b62",
        weight: 5,
        opacity: 0.92,
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

      // Fit bounds
      const bounds = L.latLngBounds(waypoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } catch (err) {
      console.warn("Leaflet demo init:", err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [selectedCity]);

  // Update marker position & polylines on step change
  useEffect(() => {
    if (!mapInstanceRef.current || !workerMarkerRef.current || typeof L === "undefined") return;

    try {
      const pos = waypoints[Math.min(stepIndex, totalSteps)];
      workerMarkerRef.current.setLatLng(pos);

      const el = workerMarkerRef.current.getElement();
      if (el) {
        const label = el.querySelector(".pin-label-callout.worker");
        if (label) {
          label.textContent = isArrived ? "Arun (Arrived!)" : `Arun (${remainingKm} km)`;
        }
      }

      if (completedPolylineRef.current) {
        completedPolylineRef.current.setLatLngs(waypoints.slice(0, stepIndex + 1));
      }
      if (activePolylineRef.current) {
        activePolylineRef.current.setLatLngs(waypoints.slice(stepIndex));
      }
    } catch (e) {
      // Ignore intermediate transitions
    }
  }, [stepIndex, waypoints, totalSteps, isArrived, remainingKm]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds(waypoints);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  const handleTriggerCall = () => {
    setCallToast(true);
    setTimeout(() => setCallToast(false), 3200);
  };

  return (
    <div className="landing-tracking-showcase">
      {/* ── Showcase Header ────────────────────────────────────────────── */}
      <div className="showcase-header">
        <div className="showcase-header-left">
          <div className="showcase-live-chip">
            <span className="live-pulsing-dot" />
            <strong>LIVE GPS TRACKING ENGINE</strong>
          </div>
          <h3>Watch how your worker arrives in real-time.</h3>
          <p>
            Zero guesswork. Track your cooperative professional from departure to doorstep on an interactive live map with radar precision.
          </p>
        </div>

        {/* City and View Mode Controls */}
        <div className="showcase-header-controls">
          <div className="showcase-control-group">
            <span className="control-label">Region:</span>
            <div className="city-toggle-pills">
              {CITIES.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  className={selectedCity.id === city.id ? "is-active" : ""}
                  onClick={() => {
                    setSelectedCity(city);
                    setStepIndex(1);
                  }}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          <div className="showcase-control-group">
            <span className="control-label">Perspective:</span>
            <div className="perspective-toggle">
              <button
                type="button"
                className={perspective === "customer" ? "is-active" : ""}
                onClick={() => setPerspective("customer")}
              >
                Customer View
              </button>
              <button
                type="button"
                className={perspective === "worker" ? "is-active" : ""}
                onClick={() => setPerspective("worker")}
              >
                Worker Turn-by-Turn
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Showcase Card Frame ────────────────────────────────────────── */}
      <div className="showcase-device-frame">
        {/* Top Telemetry Bar */}
        <div className="showcase-top-bar">
          <div className="showcase-telemetry-item">
            <span className="telemetry-dot" />
            <span>
              {isArrived ? (
                <strong className="status-arrived">ARRIVED AT DOORSTEP</strong>
              ) : (
                <strong>EN ROUTE ({selectedCity.areaLabel})</strong>
              )}
            </span>
          </div>

          <div className="showcase-eta-badge">
            <Clock size={13} />
            {isArrived ? (
              <span>At Destination</span>
            ) : (
              <span>
                <strong>~{remainingMins} mins</strong> ({remainingKm} km away)
              </span>
            )}
          </div>

          <div className="showcase-playback-controls">
            <button
              type="button"
              className="playback-btn"
              title={isPlaying ? "Pause simulation" : "Play simulation"}
              onClick={() => setIsPlaying((v) => !v)}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              type="button"
              className={`playback-btn ${isFast ? "is-fast" : ""}`}
              title="Toggle speed"
              onClick={() => setIsFast((v) => !v)}
            >
              <FastForward size={13} />
              <small>{isFast ? "2x" : "1x"}</small>
            </button>
            <button
              type="button"
              className="playback-btn"
              title="Reset route"
              onClick={() => setStepIndex(0)}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              className="playback-btn"
              title="Recenter map"
              onClick={handleRecenter}
            >
              <Compass size={13} />
            </button>
          </div>
        </div>

        {/* Live Leaflet Map Container */}
        <div className="showcase-map-container" ref={mapContainerRef}>
          {/* Glass Overlay Radar Status Indicator */}
          <div className="showcase-map-glass-badge">
            <Radio size={13} className="radar-icon-spin" />
            <span>Encrypted GPS • 2.5s telemetry interval</span>
          </div>

          {/* Arrived Celebration Banner */}
          {isArrived && (
            <div className="showcase-arrived-overlay">
              <CheckCircle2 size={18} />
              <span>Worker has arrived at your address</span>
            </div>
          )}
        </div>

        {/* Bottom Swiggy / Zomato Inspired Live Sheet */}
        <div className="showcase-bottom-sheet">
          <div className="sheet-worker-row">
            <div className="sheet-avatar">AK</div>
            <div className="sheet-worker-info">
              <div className="sheet-name-line">
                <h4>Arun Kumar</h4>
                <span className="coop-chip">
                  <ShieldCheck size={11} /> Co-op Verified
                </span>
              </div>
              <p>Electrician & Wireman • ★ 4.9 (124 jobs completed)</p>
            </div>

            <div className="sheet-action-btns">
              <button
                type="button"
                className="sheet-call-btn"
                onClick={handleTriggerCall}
              >
                <Phone size={14} />
                <span>Call Worker</span>
              </button>
            </div>
          </div>

          {callToast && (
            <div className="sheet-call-toast">
              <Phone size={14} />
              <span>Connecting encrypted voice call to Arun Kumar (+91 98765 43210)...</span>
            </div>
          )}

          {/* 3-Stage Progress Timeline */}
          <div className="showcase-trip-progress">
            <div className="progress-node done">
              <div className="node-icon">✓</div>
              <span>Request Accepted</span>
            </div>
            <div className="progress-bar-connector done" />
            <div className={`progress-node ${isArrived ? "done" : "active"}`}>
              <div className="node-icon">{isArrived ? "✓" : "2"}</div>
              <span>{isArrived ? "Route Completed" : "En Route (Live GPS)"}</span>
            </div>
            <div className={`progress-bar-connector ${isArrived ? "done" : ""}`} />
            <div className={`progress-node ${isArrived ? "active" : ""}`}>
              <div className="node-icon">3</div>
              <span>Doorstep Handshake</span>
            </div>
          </div>

          {/* Safety & Trust Banner */}
          <div className="sheet-trust-strip">
            <span className="trust-item">
              <ShieldCheck size={13} /> 100% Cooperative Insured
            </span>
            <span className="trust-item">
              <Sparkles size={13} /> Zero Commission Worker Pay
            </span>
            <span className="trust-item">
              <Navigation size={13} /> OpenStreetMap + Leaflet Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
