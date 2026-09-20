import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, Check, ChevronDown, Clock3, Filter, MapPin,
  Search, ShieldCheck, Star, SlidersHorizontal, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoStore, isWorkerBusy } from "@/contexts/DemoStoreContext";
import { BrandLockup } from "@/components/BrandMark";
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
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <WorkerAvatar worker={worker} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", letterSpacing: "-0.025em" }}>{worker.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{worker.service}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <MapPin size={13} style={{ flexShrink: 0 }} /> {worker.area}
        </span>
        <span>{worker.years} yrs experience · {worker.jobs} jobs · {worker.languages}</span>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
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

  const clearFilters = () => {
    setQuery(""); setCategory("All categories"); setCity("All cities");
    setAvailableNow(false); setEmergency(false);
  };
  const hasActiveFilters = query || category !== "All categories" || city !== "All cities" || availableNow || emergency;

  return (
    <div className="sahaay-landing" style={{ overflow: "visible" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="landing-header">
        <a href="/" className="landing-brand" aria-label="Co-Labour home">
          <BrandLockup />
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="/#services">Services</a>
          <a href="/#how-it-works">How it works</a>
          <a href="/#cooperatives">Cooperatives</a>
          <a href="/#welfare">Worker welfare</a>
        </nav>
        <div className="landing-header-actions">
          <button onClick={handleSignIn} style={{ fontWeight: 600, fontSize: 12, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-soft)", padding: "8px 14px" }}>
            Log in
          </button>
          <button
            onClick={handleSignUp}
            style={{
              background: "var(--forest)", color: "#fffdf8", border: 0, borderRadius: 999,
              padding: "10px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "background .18s",
            }}
          >
            Create account
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "52px clamp(20px,5vw,72px) 36px", maxWidth: 1320, margin: "0 auto" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--forest)", textTransform: "uppercase", marginBottom: 14 }}>
          MARKETPLACE
        </p>
        <h1 style={{ font: "700 clamp(36px,5vw,58px)/.95 'Manrope', sans-serif", letterSpacing: "-0.06em", margin: "0 0 14px", color: "var(--ink)" }}>
          Find a trusted worker
        </h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
          Every profile below belongs to a member of a Labour Cooperative Society.<br />
          Exact addresses stay private until a booking is confirmed.
        </p>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "280px 1fr", gap: 28,
        maxWidth: 1320, margin: "0 auto", padding: "0 clamp(20px,5vw,72px) 80px",
        alignItems: "start",
      }}>

        {/* Filter sidebar */}
        <aside style={{
          background: "var(--paper)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "22px 20px", position: "sticky", top: 94,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
              <SlidersHorizontal size={16} style={{ color: "var(--forest)" }} /> Filters
            </span>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 7 }}>Service or skill</span>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. wiring, cleaning"
                style={{
                  width: "100%", padding: "9px 11px 9px 33px",
                  border: "1px solid var(--border)", borderRadius: 9,
                  fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                  outline: "none",
                }}
              />
            </div>
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 7 }}>City</span>
            <div style={{ position: "relative" }}>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  width: "100%", padding: "9px 32px 9px 11px",
                  border: "1px solid var(--border)", borderRadius: 9,
                  fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                  appearance: "none", outline: "none", cursor: "pointer",
                }}
              >
                {MARKETPLACE_CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted-foreground)" }} />
            </div>
          </label>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 7 }}>Category</span>
            <div style={{ position: "relative" }}>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: "100%", padding: "9px 32px 9px 11px",
                  border: "1px solid var(--border)", borderRadius: 9,
                  fontSize: 12, color: "var(--ink)", background: "var(--ivory)",
                  appearance: "none", outline: "none", cursor: "pointer",
                }}
              >
                <option>All categories</option>
                {MARKETPLACE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted-foreground)" }} />
            </div>
          </label>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Verified only", value: verifiedOnly, set: setVerifiedOnly, disabled: true },
              { label: "Available now", value: availableNow, set: setAvailableNow, disabled: false },
              { label: "Emergency capable", value: emergency, set: setEmergency, disabled: false },
            ].map(({ label, value, set, disabled }) => (
              <label key={label} style={{ display: "flex", alignItems: "center", gap: 9, cursor: disabled ? "default" : "pointer" }}>
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
        </aside>

        {/* Results */}
        <div>
          {/* Results header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
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

          {/* Card grid — 2 columns */}
          {filtered.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
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
            <div style={{
              background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 16,
              padding: "48px 24px", textAlign: "center",
            }}>
              <Search size={28} style={{ color: "var(--muted-foreground)", marginBottom: 12, opacity: 0.5 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>No workers found</h3>
              <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13 }}>
                Try adjusting your filters or search a different area.
              </p>
              <button onClick={clearFilters} style={{ marginTop: 16, background: "var(--forest)", color: "#fffdf8", border: 0, borderRadius: 999, padding: "10px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Clear filters
              </button>
            </div>
          )}

          {/* Trust note */}
          <div style={{
            marginTop: 32, display: "flex", alignItems: "center", gap: 14,
            background: "var(--sage-soft)", borderRadius: 14, padding: "18px 22px",
            border: "1px solid rgba(23,107,98,.1)",
          }}>
            <ShieldCheck size={22} style={{ color: "var(--forest)", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 3 }}>Why every worker is verified</strong>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                Every profile is reviewed and approved by a registered Labour Cooperative admin before appearing here.
                Exact addresses and contact details are shared only after a booking is confirmed.
              </p>
            </div>
          </div>

          {/* CTA to sign up */}
          <div style={{
            marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--teal-soft)", borderRadius: 14, padding: "20px 24px",
            border: "1px solid rgba(23,107,98,.12)",
          }}>
            <div>
              <strong style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Ready to book?</strong>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>Sign in or create a free account to book and track verified workers.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSignIn} style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Log in
              </button>
              <button onClick={handleSignUp} style={{ background: "var(--forest)", color: "#fffdf8", border: 0, borderRadius: 999, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                Get started <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
