import React, { useEffect, useRef, useState, useMemo } from "react";
import { Navigation, Phone, ShieldCheck, MapPin, Zap, Clock, RotateCcw, AlertTriangle, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

declare const L: any;

interface LiveTrackingMapProps {
  bookingId: string;
  workerName: string;
  customerName?: string;
  service: string;
  status: string; // "Requested" | "Accepted" | "En Route" | "In Progress" | "Completed" | "Cancelled"
  area?: string;
  isWorkerPerspective?: boolean;
  onUpdateStatus?: (status: string) => void;
  onClose?: () => void;
}

// Coordinate helper for key demo regions
function getBaseCoordinates(area?: string): [number, number] {
  const lower = (area || "").toLowerCase();
  if (lower.includes("mumbai") || lower.includes("andheri") || lower.includes("bandra")) {
    return [19.0760, 72.8777]; // Mumbai
  }
  if (lower.includes("pune") || lower.includes("kothrud") || lower.includes("wakad")) {
    return [18.5204, 73.8567]; // Pune
  }
  // Default: Gurugram DLF / Sector 29 corridor
  return [28.4595, 77.0266];
}

// Generate realistic road waypoints between worker start and customer home
function generateWaypoints(dest: [number, number]): [number, number][] {
  const [dLat, dLng] = dest;
  // Worker starting ~2.2 km away
  const start: [number, number] = [dLat + 0.0145, dLng - 0.0175];
  
  // 6 intermediate turns mimicking local street grid
  return [
    start,
    [dLat + 0.0125, dLng - 0.0140],
    [dLat + 0.0098, dLng - 0.0125],
    [dLat + 0.0080, dLng - 0.0075],
    [dLat + 0.0045, dLng - 0.0040],
    [dLat + 0.0020, dLng - 0.0015],
    dest,
  ];
}

export function LiveTrackingMap({
  bookingId,
  workerName,
  customerName = "Customer",
  service,
  status,
  area = "Gurugram",
  isWorkerPerspective = false,
  onUpdateStatus,
}: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const workerMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const activePolylineRef = useRef<any>(null);
  const completedPolylineRef = useRef<any>(null);

  const [stepIndex, setStepIndex] = useState(() => (status === "In Progress" || status === "Completed" ? 6 : status === "En Route" ? 2 : 0));
  const [isSimulating, setIsSimulating] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const destCoords = useMemo(() => getBaseCoordinates(area), [area]);
  const waypoints = useMemo(() => generateWaypoints(destCoords), [destCoords]);

  const totalSteps = waypoints.length - 1;
  const currentPos = waypoints[Math.min(stepIndex, totalSteps)];
  const isEnRoute = status === "En Route";
  const isInProgress = status === "In Progress" || status === "Completed";
  
  // Calculate dynamic ETA and remaining distance
  const progressRatio = stepIndex / totalSteps;
  const remainingKm = isInProgress ? 0 : Math.max(0.1, Number(((1 - progressRatio) * 2.2).toFixed(1)));
  const remainingMins = isInProgress ? 0 : Math.max(1, Math.round((1 - progressRatio) * 12));

  // Live real-time movement ticker when En Route (Swiggy/Zomato style)
  useEffect(() => {
    if (!isEnRoute || !isSimulating) return;

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < totalSteps) {
          return prev + 1;
        }
        return prev;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [isEnRoute, isSimulating, totalSteps]);

  // Leaflet initialization & lifecycle management
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof L === "undefined") return;

    // Clean up existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Initialize Leaflet map
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView(destCoords, 14);

      mapInstanceRef.current = map;

      // 2. Add high-resolution, light CartoDB Voyager tiles (100% Free & OpenStreetMap data)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Custom Zoom control at top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // 3. Create Custom Markers
      // A. Customer Home Marker
      const customerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-home-pin">
            <div class="pin-pulse-halo"></div>
            <div class="pin-badge-home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span class="pin-label-callout">${isWorkerPerspective ? (customerName || "Customer Destination") : "Your Location"}</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
      });

      const customerMarker = L.marker(destCoords, { icon: customerIcon }).addTo(map);
      customerMarkerRef.current = customerMarker;

      // B. Worker Marker with Live Pulse Radar
      const workerIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="tracking-worker-pin">
            <div class="worker-radar-ring"></div>
            <div class="pin-badge-worker">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span class="pin-label-callout worker">${workerName.split(" ")[0]} (${remainingKm > 0 ? `${remainingKm} km` : "Arrived"})</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 38],
      });

      const workerMarker = L.marker(currentPos, { icon: workerIcon }).addTo(map);
      workerMarkerRef.current = workerMarker;

      // 4. Draw Route Polylines
      // Completed portion (solid forest teal)
      const completedCoords = waypoints.slice(0, stepIndex + 1);
      const completedPoly = L.polyline(completedCoords, {
        color: "#176b62",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      completedPolylineRef.current = completedPoly;

      // Remaining portion (dashed brass gold route ahead)
      const remainingCoords = waypoints.slice(stepIndex);
      const remainingPoly = L.polyline(remainingCoords, {
        color: "#c89439",
        weight: 4,
        opacity: 0.75,
        dashArray: "6, 8",
        lineCap: "round",
      }).addTo(map);
      activePolylineRef.current = remainingPoly;

      // 5. Fit bounds with smooth padding so both points are in view
      const bounds = L.latLngBounds(waypoints);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });

      // Invalidate size to guarantee crisp tile render
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } catch (err) {
      console.warn("Leaflet map initialization notice:", err);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [destCoords]);

  // Update Worker Marker & Polylines when stepIndex changes
  useEffect(() => {
    if (!mapInstanceRef.current || !workerMarkerRef.current || typeof L === "undefined") return;

    try {
      const pos = waypoints[Math.min(stepIndex, totalSteps)];
      workerMarkerRef.current.setLatLng(pos);

      // Update marker label text dynamically
      const el = workerMarkerRef.current.getElement();
      if (el) {
        const label = el.querySelector(".pin-label-callout.worker");
        if (label) {
          label.textContent = `${workerName.split(" ")[0]} (${remainingKm > 0 ? `${remainingKm} km` : "Arrived"})`;
        }
      }

      // Update polylines
      if (completedPolylineRef.current) {
        completedPolylineRef.current.setLatLngs(waypoints.slice(0, stepIndex + 1));
      }
      if (activePolylineRef.current) {
        activePolylineRef.current.setLatLngs(waypoints.slice(stepIndex));
      }
    } catch (e) {
      // Ignore intermediate updates
    }
  }, [stepIndex, waypoints, totalSteps, workerName, remainingKm]);

  // Recenter map view
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds(waypoints);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  return (
    <div className="live-tracking-card">
      {/* ── Top Header Strip (Swiggy / Zomato Inspired Live Header) ───────── */}
      <div className="tracking-top-strip">
        <div className="tracking-live-tag">
          <span className="live-pulsing-dot" />
          <strong>LIVE GPS TRACKING</strong>
        </div>

        <div className="tracking-eta-pill">
          <Clock size={13} style={{ color: "var(--forest)" }} />
          <span>
            {isInProgress
              ? "Service in progress at doorstep"
              : isEnRoute
              ? `Arriving in ~${remainingMins} mins · ${remainingKm} km away`
              : "Confirmed · Waiting for journey start"}
          </span>
        </div>

        <div className="tracking-controls">
          <button
            type="button"
            className="tracking-icon-btn"
            onClick={handleRecenter}
            title="Recenter on Route"
            aria-label="Recenter Map"
          >
            <Navigation size={13} />
          </button>
          <button
            type="button"
            className="tracking-icon-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse map" : "Expand map"}
            aria-label="Toggle map size"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Interactive Leaflet Map Surface (Free OSM CartoDB Engine) ─────── */}
      <div
        ref={mapContainerRef}
        className="tracking-map-viewport"
        style={{ height: expanded ? "380px" : "240px" }}
      />

      {/* ── Swiggy / Zomato Bottom Status & Dispatch Panel ─────────────────── */}
      <div className="tracking-bottom-tray">
        <div className="tray-worker-meta">
          <div className="tray-avatar">
            <span className="tray-avatar-initials">
              {workerName.split(" ").map((x) => x[0]).join("").substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ fontSize: 13, color: "var(--ink)" }}>{workerName}</strong>
              <span className="coop-badge-tag">
                <ShieldCheck size={11} /> Co-op Verified
              </span>
            </div>
            <small style={{ color: "var(--muted-foreground)", fontSize: 11, display: "block", marginTop: 2 }}>
              {service} · Assigned Tradesperson
            </small>
          </div>
        </div>

        {/* Live Trip Status Line */}
        <div className="tray-trip-steps">
          <div className={`trip-step ${status === "Accepted" ? "active" : "done"}`}>
            <span className="step-circle">{stepIndex > 0 ? "✓" : "1"}</span>
            <span>Accepted</span>
          </div>
          <div className="trip-step-line" />
          <div className={`trip-step ${isEnRoute ? "active" : isInProgress ? "done" : ""}`}>
            <span className="step-circle">{isInProgress ? "✓" : "2"}</span>
            <span>On the way</span>
          </div>
          <div className="trip-step-line" />
          <div className={`trip-step ${isInProgress ? "active done" : ""}`}>
            <span className="step-circle">3</span>
            <span>Doorstep</span>
          </div>
        </div>

        {/* Action Controls for Customer & Worker */}
        <div className="tray-actions">
          {isWorkerPerspective ? (
            <div style={{ display: "flex", gap: 8, width: "100%", flexWrap: "wrap" }}>
              {status === "Accepted" && onUpdateStatus && (
                <button
                  type="button"
                  className="app-button"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => onUpdateStatus("En Route")}
                >
                  <Navigation size={13} style={{ marginRight: 5 }} />
                  Start Journey (En Route)
                </button>
              )}
              {status === "En Route" && onUpdateStatus && (
                <button
                  type="button"
                  className="app-button"
                  style={{ flex: 1, justifyContent: "center", background: "var(--forest)" }}
                  onClick={() => onUpdateStatus("In Progress")}
                >
                  <CheckCircle2 size={13} style={{ marginRight: 5 }} />
                  Arrived & Begin Service
                </button>
              )}
              <a
                href="tel:9999999999"
                className="app-button secondary"
                style={{ padding: "8px 12px", textDecoration: "none" }}
              >
                <Phone size={13} style={{ marginRight: 4 }} />
                Call Customer
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="safety-trust-chip">
                  <ShieldCheck size={12} style={{ color: "var(--forest)" }} /> 100% Verified
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  Speed: {isEnRoute ? "24 km/h" : "At site"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href="tel:9999999999"
                  className="app-button secondary"
                  style={{ padding: "6px 12px", fontSize: 11, textDecoration: "none" }}
                >
                  <Phone size={12} style={{ marginRight: 4 }} />
                  Call {workerName.split(" ")[0]}
                </a>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setStepIndex(0);
                    setIsSimulating(true);
                  }}
                  title="Re-play live movement"
                  style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                >
                  <RotateCcw size={11} style={{ marginRight: 2 }} />
                  Re-track
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
