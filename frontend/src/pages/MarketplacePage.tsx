import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, Check, ChevronDown, Clock3, Filter, MapPin,
  Search, ShieldCheck, Star, SlidersHorizontal, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoStore, isWorkerBusy } from "@/contexts/DemoStoreContext";
import { BrandLockup } from "@/components/BrandMark";
import LandingHeader from "@/components/LandingHeader";
import { MARKETPLACE_CATEGORIES, MARKETPLACE_CITIES, type MarketplaceWorker } from "@/data/marketplaceWorkers";
import "@/landing-page.css";

// ── Accent colours matching the app shell avatar system ──────────────────────
const ACCENT: Record<string, string> = {
  forest: "#176b62",
  blue:   "#6d96a9",
  brass:  "#a97d36",
  sage:   "#7d9c85",
};

function WorkerAvatar({ worker }: { worker: MarketplaceWorker }) {
  const bg = ACCENT[worker.accent] ?? ACCENT.forest;
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      background: bg, color: "#fffdf8",
      display: "grid", placeItems: "center",
      fontSize: 14, fontWeight: 700,
      flexShrink: 0,
    }}>
      {worker.initials}
    </div>
  );
}

function StarRating({ rating }: { rating: string }) {
  const n = parseFloat(rating);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#c89439", fontWeight: 700, fontSize: 13 }}>
      <Star size={13} fill="currentColor" />
      {rating}
    </span>
  );
}

function WorkerCard({ worker, onBook, isBusy }: { worker: MarketplaceWorker; onBook: () => void; isBusy?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <article
      style={{
        background: isBusy ? "linear-gradient(180deg, #fffdfa 0%, #fffaf0 100%)" : "var(--paper)",
        border: isBusy ? "1.5px solid rgba(217, 119, 6, 0.38)" : "1px solid var(--border)",
        borderRadius: 16, padding: "20px 22px",
        display: "flex", flexDirection: "column", gap: 14,
        boxShadow: hover ? "0 12px 28px rgba(44,54,43,.09)" : "0 4px 12px rgba(44,54,43,.04)",
        transition: "box-shadow .2s, transform .2s",
        transform: hover ? "translateY(-2px)" : "none",
        width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <WorkerAvatar worker={worker} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", letterSpacing: "-0.025em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{worker.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{worker.service}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <StarRating rating={worker.rating} />
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>({worker.jobs})</span>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "var(--sage-soft)", color: "#4a7c5f",
          fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "4px 9px",
        }}>
          <Check size={11} /> Verified
        </span>
        {isBusy ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(245, 158, 11, 0.14)", color: "#b45309",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 9px",
          }}>
            <Clock3 size={11} /> Busy · On a job
          </span>
        ) : (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "var(--teal-soft)", color: "var(--forest)",
            fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "4px 9px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5e967c", display: "inline-block" }} />
            {worker.available}
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 4, wordBreak: "break-word" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <MapPin size={13} style={{ flexShrink: 0 }} /> {worker.area}
        </span>
        <span>{worker.years} yrs experience · {worker.jobs} jobs · {worker.languages}</span>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--ink)", letterSpacing: "-0.04em" }}>{worker.rate}/visit</div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>
            Match score {worker.matchScore}
          </div>
        </div>
        {isBusy ? (
          <button
            type="button"
            disabled
            style={{
              background: "rgba(0,0,0,0.06)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "9px 15px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: 0.7,
            }}
            title="This worker is currently on an active job and cannot accept new bookings"
          >
            <Clock3 size={12} /> Busy on job
          </button>
        ) : (
          <button
            onClick={onBook}
            style={{
              background: "var(--forest)", color: "#fffdf8",
              border: 0, borderRadius: 999, padding: "10px 18px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
              transition: "background .18s, transform .15s",
              transform: hover ? "scale(1.03)" : "none",
            }}
            aria-label={`View and book ${worker.name}`}
          >
            View &amp; book <ArrowRight size={14} />
          </button>
        )}
      </div>
    </article>
  );
}

export default function MarketplacePage() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { bookings, verifiedWorkers } = useDemoStore();

  // Read initial filter from URL params (passed by landing page search)
  const initParams = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { service: p.get("service") ?? "", locality: p.get("locality") ?? "" };
    } catch { return { service: "", locality: "" }; }
  }, []);

  const [query, setQuery]       = useState(initParams.locality || initParams.service);
  const [category, setCategory] = useState(initParams.service && MARKETPLACE_CATEGORIES.includes(initParams.service as typeof MARKETPLACE_CATEGORIES[number]) ? initParams.service : "All categories");
  const [city, setCity]         = useState<string>("All cities");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [availableNow, setAvailableNow] = useState(false);
  const [emergency, setEmergency]       = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter workers from real verified workers
  const filtered = useMemo(() => {
    let list: MarketplaceWorker[] = verifiedWorkers.map((w) => ({
      id: w.id,
      name: w.name,
      initials: w.initials,
      service: w.service,
      area: w.area,
      city: "Gurugram",
      years: w.years,
      rating: w.rating,
      jobs: w.jobs,
      rate: w.rate,
      accent: (["blue", "forest", "brass", "sage"].includes(w.accent) ? w.accent : "forest") as "blue" | "forest" | "brass" | "sage",
      available: w.available,
      languages: "Hindi, English",
      matchScore: 90,
      responseTime: "< 15 mins",
      tier: "Verified Cooperative Member",
      reviews: [],
    }));
    if (city !== "All cities") list = list.filter(w => w.city === city);
    if (category !== "All categories") list = list.filter(w => w.service === category);
    if (availableNow) list = list.filter(w => w.available === "Available today" && !isWorkerBusy(w, bookings));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(w =>
        `${w.name} ${w.service} ${w.area} ${w.city} ${w.languages}`.toLowerCase().includes(q)
      );
    }
    // Available workers first, then by match score
    return [...list].sort((a, b) => {
      const aBusy = isWorkerBusy(a, bookings);
      const bBusy = isWorkerBusy(b, bookings);
      if (aBusy && !bBusy) return 1;
      if (!aBusy && bBusy) return -1;
      return b.matchScore - a.matchScore;
    });
  }, [verifiedWorkers, query, category, city, availableNow, emergency, bookings]);

  const handleBook = () => {
    if (profile) {
      setLocation("/app?from=marketplace");
      return;
    }
    // Not signed in — prompt sign in
    setLocation("/app?access=1&intent=signin");
  };

  const handleSignIn  = () => setLocation("/app?access=1&intent=signin");
  const handleSignUp  = () => setLocation("/app?access=1&intent=signup");

  const [mobileFiltersCollapsed, setMobileFiltersCollapsed] = useState(false);

  const clearFilters = () => {
    setQuery(""); setCategory("All categories"); setCity("All cities");
    setAvailableNow(false); setEmergency(false);
  };
  const hasActiveFilters = Boolean(query || category !== "All categories" || city !== "All cities" || availableNow || emergency);

  return (
    <div className="sahaay-landing marketplace-root">
      <LandingHeader currentPath="marketplace" onSignIn={handleSignIn} onCreateAccount={handleSignUp} />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="marketplace-hero">
        <p className="marketplace-eyebrow">
          MARKETPLACE
        </p>
        <h1 className="marketplace-title">
          Find a trusted worker
        </h1>
        <p className="marketplace-subtitle">
          Every profile below belongs to a member of a Labour Cooperative Society.<br />
          Exact addresses stay private until a booking is confirmed.
        </p>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="marketplace-layout">

        {/* Filter sidebar */}
        <aside className="marketplace-sidebar">
          <div className="marketplace-sidebar-header">
            <span className="marketplace-sidebar-title">
              <SlidersHorizontal size={16} style={{ color: "var(--forest)" }} /> Filters
              {hasActiveFilters && (
                <span style={{ fontSize: 10, background: "var(--forest)", color: "#fffdf8", padding: "2px 7px", borderRadius: 99, fontWeight: 700 }}>
                  Active
                </span>
              )}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="marketplace-sidebar-clear">
                  <X size={12} /> Clear
                </button>
              )}
              <button
                type="button"
                className="marketplace-mobile-toggle-btn"
                onClick={() => setMobileFiltersCollapsed(!mobileFiltersCollapsed)}
                aria-label={mobileFiltersCollapsed ? "Show filter options" : "Hide filter options"}
              >
                <span>{mobileFiltersCollapsed ? "Show filters" : "Hide filters"}</span>
                <ChevronDown size={13} style={{ transform: mobileFiltersCollapsed ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
            </div>
          </div>

          {!mobileFiltersCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Service or skill</span>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. wiring, cleaning, pune"
                    style={{
                      width: "100%", padding: "9px 11px 9px 33px",
                      border: "1px solid var(--border)", borderRadius: 9,
                      fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>City</span>
                  <div style={{ position: "relative" }}>
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      style={{
                        width: "100%", padding: "9px 28px 9px 11px",
                        border: "1px solid var(--border)", borderRadius: 9,
                        fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                        appearance: "none", outline: "none", cursor: "pointer", boxSizing: "border-box",
                      }}
                    >
                      {MARKETPLACE_CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted-foreground)" }} />
                  </div>
                </label>

                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>Category</span>
                  <div style={{ position: "relative" }}>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      style={{
                        width: "100%", padding: "9px 28px 9px 11px",
                        border: "1px solid var(--border)", borderRadius: 9,
                        fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                        appearance: "none", outline: "none", cursor: "pointer", boxSizing: "border-box",
                      }}
                    >
                      <option>All categories</option>
                      {MARKETPLACE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted-foreground)" }} />
                  </div>
                </label>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
                {[
                  { label: "Verified only", value: verifiedOnly, set: setVerifiedOnly, disabled: true },
                  { label: "Available now", value: availableNow, set: setAvailableNow, disabled: false },
                  { label: "Emergency capable", value: emergency, set: setEmergency, disabled: false },
                ].map(({ label, value, set, disabled }) => (
                  <label key={label} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer" }}>
                    <div
                      onClick={() => !disabled && set(!value)}
                      style={{
                        width: 17, height: 17, borderRadius: 5,
                        border: `2px solid ${value ? "var(--forest)" : "var(--border)"}`,
                        background: value ? "var(--forest)" : "transparent",
                        display: "grid", placeItems: "center",
                        transition: "all .15s", cursor: disabled ? "default" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {value && <Check size={10} color="#fffdf8" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: value ? 600 : 400 }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Results */}
        <div className="marketplace-results">
          {/* Results header */}
          <div className="marketplace-results-header">
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              <strong style={{ color: "var(--ink)" }}>{filtered.length} workers</strong> match your filters
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sort by</span>
              <select style={{
                border: "1px solid var(--border)", borderRadius: 8, padding: "6px 28px 6px 10px",
                fontSize: 11, color: "var(--ink)", background: "var(--paper)", outline: "none",
                cursor: "pointer",
              }}>
                <option>Best match</option>
                <option>Highest rated</option>
                <option>Most jobs</option>
                <option>Lowest price</option>
              </select>
            </div>
          </div>

          {/* Card grid — responsive 2 columns on desktop, 1 on mobile */}
          {filtered.length > 0 ? (
            <div className="marketplace-cards-grid">
              {filtered.map(worker => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onBook={handleBook}
                  isBusy={isWorkerBusy(worker, bookings)}
                />
              ))}
            </div>
          ) : (
            <div className="marketplace-empty-state">
              <Search size={28} style={{ color: "var(--muted-foreground)", marginBottom: 12, opacity: 0.5 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>No workers found</h3>
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
                Try adjusting your filters or search a different area or service category.
              </p>
              <button onClick={clearFilters} className="landing-button landing-button--small" style={{ marginTop: 18, cursor: "pointer" }}>
                Clear filters
              </button>
            </div>
          )}

          {/* Trust note */}
          <div className="marketplace-trust-banner">
            <ShieldCheck size={22} style={{ color: "var(--forest)", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 3, color: "var(--ink)" }}>Why every worker is verified</strong>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                Every profile is reviewed and approved by a registered Labour Cooperative admin before appearing here.
                Exact addresses and contact details are shared only after a booking is confirmed.
              </p>
            </div>
          </div>

          {/* CTA to sign up */}
          <div className="marketplace-cta-banner">
            <div>
              <strong style={{ fontSize: 14, display: "block", marginBottom: 4, color: "var(--ink)" }}>Ready to book?</strong>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>Sign in or create a free account to book and track verified workers.</p>
            </div>
            <div className="marketplace-cta-actions">
              <button onClick={handleSignIn} style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Log in
              </button>
              <button onClick={handleSignUp} className="landing-button landing-button--small" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                Get started <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
