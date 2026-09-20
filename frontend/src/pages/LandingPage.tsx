import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Eye,
  Handshake,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { BrandLockup } from "@/components/BrandMark";
import LandingHeader from "@/components/LandingHeader";
import { useDemoStore } from "@/contexts/DemoStoreContext";
import { initLandingAnimations } from "@/lib/gsapAnimations";
import "@/landing-page.css";

export type LandingSearch = {
  service: string;
  locality: string;
};

export type LandingPageProps = {
  heroImageSrc?: string;
  onSearch?: (search: LandingSearch) => void;
  onSignIn?: () => void;
  onCreateAccount?: () => void;
  onJoinWorker?: () => void;
  onAdminAccess?: () => void;
  onViewProfile?: (workerName: string) => void;
};

const DEFAULT_HERO_IMAGE = "/landing-assets/sahaay-worker-hero.jpg";

const services = [
  {
    number: "01",
    category: "REPAIRS",
    title: "Electrician",
    description: "Wiring, repairs and safety inspections.",
    action: "Find an electrician",
    icon: Zap,
    tone: "forest",
    badge: "24×7",
    price: "₹349",
    duration: "1–3 hours",
  },
  {
    number: "02",
    category: "REPAIRS",
    title: "Plumber",
    description: "Leaks, fittings and drainage.",
    action: "Find a plumber",
    icon: Wrench,
    tone: "blue",
    badge: "24×7",
    price: "₹299",
    duration: "1–2 hours",
  },
  {
    number: "03",
    category: "REPAIRS",
    title: "Carpenter",
    description: "Furniture, fittings and repair.",
    action: "Find a carpenter",
    icon: BriefcaseBusiness,
    tone: "brass",
    badge: null,
    price: "₹449",
    duration: "2–5 hours",
  },
  {
    number: "04",
    category: "HOME CARE",
    title: "Painter",
    description: "Interior and exterior painting.",
    action: "Find a painter",
    icon: Sparkles,
    tone: "sage",
    badge: null,
    price: "₹18/sq ft",
    duration: "1–5 days",
  },
  {
    number: "05",
    category: "HOME CARE",
    title: "Cleaner",
    description: "Deep cleaning and sanitisation.",
    action: "Book a cleaner",
    icon: Sparkles,
    tone: "forest",
    badge: null,
    price: "₹249",
    duration: "2–6 hours",
  },
  {
    number: "06",
    category: "EVERYDAY HELP",
    title: "Domestic Helper",
    description: "Daily household assistance.",
    action: "Find a helper",
    icon: Handshake,
    tone: "brass",
    badge: null,
    price: "₹199",
    duration: "2–8 hours",
  },
  {
    number: "07",
    category: "CARE",
    title: "Caregiver",
    description: "Elder, patient and child care.",
    action: "Explore caregivers",
    icon: Handshake,
    tone: "peach",
    badge: "24×7",
    price: "₹599",
    duration: "4–12 hours",
  },
  {
    number: "08",
    category: "EVERYDAY HELP",
    title: "Driver",
    description: "Personal and commercial driving.",
    action: "Book a driver",
    icon: MapPin,
    tone: "blue",
    badge: "24×7",
    price: "₹279",
    duration: "3–10 hours",
  },
  {
    number: "09",
    category: "HOME CARE",
    title: "Gardener",
    description: "Landscaping and plant care.",
    action: "Find a gardener",
    icon: Sparkles,
    tone: "sage",
    badge: null,
    price: "₹259",
    duration: "2–4 hours",
  },
  {
    number: "10",
    category: "REPAIRS",
    title: "Technician",
    description: "Electronics and equipment repair.",
    action: "Find a technician",
    icon: Wrench,
    tone: "forest",
    badge: "24×7",
    price: "₹379",
    duration: "1–3 hours",
  },
  {
    number: "11",
    category: "REPAIRS",
    title: "Appliance Repair",
    description: "Washing machines, fridges, ovens.",
    action: "Book repair",
    icon: Wrench,
    tone: "blue",
    badge: "24×7",
    price: "₹399",
    duration: "1–2 hours",
  },
  {
    number: "12",
    category: "REPAIRS",
    title: "AC Technician",
    description: "Servicing, gas refill, installation.",
    action: "Book AC service",
    icon: Zap,
    tone: "sage",
    badge: "24×7",
    price: "₹499",
    duration: "1–3 hours",
  },
  {
    number: "13",
    category: "HOME CARE",
    title: "Home Maintenance",
    description: "Annual upkeep bundles and scheduled visits.",
    action: "View packages",
    icon: BriefcaseBusiness,
    tone: "brass",
    badge: null,
    price: "₹1,999",
    duration: "Scheduled visits",
  },
] as const;

const trustPoints = [
  {
    number: "01",
    title: "Verified",
    copy: "Worker profiles are reviewed by the cooperative before discovery.",
    icon: ShieldCheck,
    tone: "sage",
  },
  {
    number: "02",
    title: "Clear",
    copy: "Fixed base-visit estimates appear before booking.",
    icon: BriefcaseBusiness,
    tone: "brass",
  },
  {
    number: "03",
    title: "Visible",
    copy: "Track the handoff from request to completion.",
    icon: Eye,
    tone: "blue",
  },
  {
    number: "04",
    title: "Cooperative",
    copy: "Work, welfare, and support stay connected.",
    icon: Users,
    tone: "forest",
  },
] as const;

const workflow = [
  ["01", "Search", "Choose a service and share your locality."],
  ["02", "Trust", "Compare verified profiles, experience, availability, and rating."],
  ["03", "Book", "See the fixed rate-card estimate before you confirm."],
  ["04", "Track", "Follow Requested, Accepted, En Route, In Progress, and Completed."],
  ["05", "Close the loop", "Pay in simulation for the demo, receive an on-screen receipt, and rate the worker."],
] as const;

function LandingSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="landing-eyebrow">
      <span />
      {children}
    </p>
  );
}

export default function LandingPage({
  heroImageSrc = DEFAULT_HERO_IMAGE,
  onSearch,
  onSignIn,
  onCreateAccount,
  onJoinWorker,
  onAdminAccess,
  onViewProfile,
}: LandingPageProps) {
  const { verifiedWorkers } = useDemoStore();
  const [service, setService] = useState("");
  const [locality, setLocality] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("All services");
  const [showAllServices, setShowAllServices] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const serviceDropdownRef = useRef<HTMLLabelElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = initLandingAnimations(landingRef.current);
    return cleanup;
  }, []);

  // Close dropdown when clicking outside the service field
  useEffect(() => {
    if (!serviceDropdownOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target as Node)) {
        setServiceDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setServiceDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [serviceDropdownOpen]);

  const submitSearch = () => {
    if (!service) {
      setSearchMessage("Choose a service to see who can help.");
      return;
    }

    const nextSearch = { service, locality: locality.trim() };
    setSearchMessage(
      `${service}${locality.trim() ? ` · ${locality.trim()}` : ""} is ready to search.`,
    );
    onSearch?.(nextSearch);
  };

  const filteredServices = services.filter((item) => {
    if (activeFilter === "All services") return true;
    if (activeFilter === "Repairs") return item.category === "REPAIRS";
    if (activeFilter === "Home care") return item.category === "HOME CARE";
    if (activeFilter === "Care") return item.category === "CARE";
    if (activeFilter === "Everyday help") return item.category === "EVERYDAY HELP";
    return true;
  });
  const visibleServices = showAllServices ? filteredServices : filteredServices.slice(0, 8);

  const handleAnchor = () => setMenuOpen(false);

  return (
    <div className="sahaay-landing" ref={landingRef}>
      <LandingHeader currentPath="landing" onSignIn={onSignIn} onCreateAccount={onCreateAccount} />

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <LandingSectionLabel>Cooperative services / Your local network</LandingSectionLabel>
            <h1 className="landing-hero-heading">Find the right hands for the work waiting at home.</h1>
            <p className="landing-hero-description">
              Book skilled local workers through a cooperative network built around visible verification, clear estimates, and every handoff in view.
            </p>

            <div className="landing-search-card" aria-label="Find a worker">
              <div className="landing-search-fields">
                <label className="landing-search-field" ref={serviceDropdownRef}>
                  <BriefcaseBusiness size={17} />
                  <div className="landing-custom-select-wrap">
                    <small>Service</small>
                    <button
                      type="button"
                      className={`landing-custom-select-button ${service ? 'has-val' : ''}`}
                      onClick={() => setServiceDropdownOpen(v => !v)}
                    >
                      {service || "What do you need help with?"}
                      <ChevronDown size={14} className="dropdown-caret" style={{ transform: serviceDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    {serviceDropdownOpen && (
                      <div className="landing-custom-dropdown" role="listbox">
                        <div className="dropdown-group">
                          <strong>Repairs</strong>
                          {["Electrician", "Plumber", "Carpenter", "Technician", "Appliance Repair", "AC Technician"].map(opt => (
                            <button key={opt} type="button" onClick={() => { setService(opt); setServiceDropdownOpen(false); setSearchMessage(""); }}>{opt}</button>
                          ))}
                        </div>
                        <div className="dropdown-group">
                          <strong>Home Care</strong>
                          {["Painter", "Cleaner", "Gardener", "Home Maintenance"].map(opt => (
                            <button key={opt} type="button" onClick={() => { setService(opt); setServiceDropdownOpen(false); setSearchMessage(""); }}>{opt}</button>
                          ))}
                        </div>
                        <div className="dropdown-group">
                          <strong>Care &amp; Everyday</strong>
                          {["Caregiver", "Domestic Helper", "Driver"].map(opt => (
                            <button key={opt} type="button" onClick={() => { setService(opt); setServiceDropdownOpen(false); setSearchMessage(""); }}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </label>
                <label className="landing-search-field">
                  <MapPin size={17} />
                  <span>
                    <small>Locality</small>
                    <input value={locality} onChange={(event) => { setLocality(event.target.value); setSearchMessage(""); }} placeholder="Enter your area" />
                  </span>
                </label>
                <button type="button" className="landing-button landing-search-button" onClick={submitSearch}>
                  Find a worker <ArrowRight size={16} />
                </button>
              </div>
              <div className="landing-search-helper">
                <ShieldCheck size={14} />
                <span>Verified cooperative workers <i /> Fixed estimates before booking <i /> Locality matching for the MVP</span>
              </div>
              {searchMessage && <p className="landing-search-message" role="status">{searchMessage}</p>}
            </div>
          </div>

        </section>

        <section className="landing-trust-strip" aria-label="Co-Labour trust principles">
          <div className="landing-trust-strip-inner">
            {trustPoints.map(({ number, title, copy, icon: Icon, tone }) => (
              <article className={`landing-trust-point landing-trust-point--${tone}`} key={number}>
                <div className="landing-trust-icon"><Icon size={22} /></div>
                <div><span>{number}</span><strong>{title}</strong><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-services" id="services">
          <div className="landing-section-heading landing-section-heading--split">
            <div>
              <LandingSectionLabel>Service atlas</LandingSectionLabel>
              <h2>A capable hand for the next task.</h2>
            </div>
            <p>From urgent repairs to everyday care, find cooperative workers who make the next step clear.</p>
          </div>
          <div className="landing-filter-row" aria-label="Service filters">
            {["All services", "Repairs", "Home care", "Care", "Everyday help"].map((filter) => (
              <button type="button" key={filter} className={activeFilter === filter ? "is-active" : ""} onClick={() => { setActiveFilter(filter); setShowAllServices(false); }}>{filter}</button>
            ))}
          </div>
          <div className="landing-service-grid">
            {visibleServices.map(({ number, category, title, description, action, icon: Icon, tone, badge, price, duration }) => (
              <article className={`landing-service-card landing-service-card--${tone}`} key={number}>
                <div className="landing-service-card-top">
                  <span>{number} / {category}</span>
                  {badge && <span className="landing-service-badge">{badge}</span>}
                </div>
                <div className="landing-service-illustration"><Icon size={44} strokeWidth={1.35} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="landing-service-pricing">
                  <div className="landing-service-pricing-row">
                    <span className="landing-price-label">Starting at</span>
                    <strong className="landing-price-value">{price}</strong>
                  </div>
                  <div className="landing-service-pricing-row">
                    <span className="landing-price-label">Typical duration</span>
                    <span className="landing-price-duration">{duration}</span>
                  </div>
                </div>
                <button type="button" className="landing-link-button" onClick={() => { setService(title); document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {action} <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
          {filteredServices.length > 8 && (
            <div className="landing-services-show-more">
              <button type="button" className="landing-show-more-btn" onClick={() => setShowAllServices(v => !v)}>
                {showAllServices ? `Show less` : `View all ${filteredServices.length} services`} <ArrowRight size={14} style={{ transform: showAllServices ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>
          )}
        </section>

        <section className="landing-section landing-workflow" id="how-it-works">
          <div className="landing-section-heading">
            <LandingSectionLabel>The handoff</LandingSectionLabel>
            <h2>Every step earns its place.</h2>
            <p>Co-Labour keeps the important details visible from the first search to the finished job.</p>
          </div>
          <div className="landing-workflow-track">
            {workflow.map(([number, title, copy]) => (
              <article key={number} className="landing-workflow-step">
                <span>{number}</span>
                <div><h3>{title}</h3><p>{copy}</p></div>
              </article>
            ))}
          </div>
          <div className="landing-honesty-note"><MapPin size={16} /><span>Locality matching is a plain-text MVP experience today—not live GPS-radius matching.</span></div>
        </section>

        <section className="landing-network-section" id="workers">
          <article className="landing-network-panel landing-network-panel--worker">
            <LandingSectionLabel>For skilled workers</LandingSectionLabel>
            <h2>Bring your work into view.</h2>
            <p>Join through your cooperative, show the skills and locality you serve, receive visible booking requests, and keep earnings and welfare information close to the work.</p>
            <div className="landing-capability-list"><span><Check size={14} /> Verified profile</span><span><Check size={14} /> Booking queue</span><span><Check size={14} /> Welfare visibility</span></div>
            <button type="button" className="landing-link-button landing-link-button--light" onClick={onJoinWorker || onCreateAccount}>Join as a worker <ArrowRight size={15} /></button>
          </article>
          <article className="landing-network-panel landing-network-panel--cooperative" id="cooperatives">
            <LandingSectionLabel>For cooperative societies</LandingSectionLabel>
            <h2>Coordinate the people behind the service.</h2>
            <p>Verify members, monitor bookings, resolve issues, and keep welfare support connected to the workers your society stands behind.</p>
            <div className="landing-capability-list"><span><Check size={14} /> Member verification</span><span><Check size={14} /> Booking oversight</span><span><Check size={14} /> Welfare claims</span></div>
            <button type="button" className="landing-link-button" onClick={onAdminAccess || onCreateAccount}>Talk to the cooperative desk <ArrowRight size={15} /></button>
          </article>
        </section>

        <section className="landing-section landing-profiles">
          <div className="landing-section-heading landing-section-heading--split">
            <div><LandingSectionLabel>Before you book</LandingSectionLabel><h2>Trust has details.</h2></div>
            <p>A Co-Labour profile puts the practical information in the open: service, locality, experience, availability, verification, and rating.</p>
          </div>
          <div className="landing-profile-grid">
            {verifiedWorkers.length > 0 ? (
              verifiedWorkers.slice(0, 3).map((w) => (
                <article className="landing-profile-card" key={w.id || w.name}>
                  <div className="landing-profile-avatar">{w.initials || w.name.slice(0, 2).toUpperCase()}</div>
                  <div className="landing-profile-heading">
                    <div>
                      <h3>{w.name}</h3>
                      <p>{w.service}</p>
                    </div>
                    <span><ShieldCheck size={14} /> Verified</span>
                  </div>
                  <div className="landing-profile-details">
                    <span><MapPin size={13} /> {w.area}</span>
                    <span>{w.years} yrs</span>
                    <span>★ {w.rating || "5.0"}</span>
                  </div>
                  <button
                    type="button"
                    className="landing-link-button"
                    onClick={() => {
                      if (onViewProfile) {
                        onViewProfile(w.name);
                      } else {
                        setService(w.service);
                        document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                  >
                    View profile <ChevronRight size={15} />
                  </button>
                </article>
              ))
            ) : (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "36px 20px", background: "var(--paper)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                <ShieldCheck size={32} style={{ color: "var(--forest)", margin: "0 auto 10px" }} />
                <h3 style={{ fontSize: 16, margin: "0 0 6px", color: "var(--ink)", fontWeight: 700 }}>Verified Cooperative Members Directory</h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 auto", maxWidth: 460, lineHeight: 1.5 }}>
                  RCS-certified workers will appear here automatically as registrations are accredited by the State Regulatory Authority.
                </p>
              </div>
            )}
          </div>
          <p className="landing-empty-rating"><ShieldCheck size={15} /><strong>No ratings yet?</strong> Ratings appear after a completed booking, so feedback stays connected to real work.</p>
        </section>

        <section className="landing-closing-cta">
          <div><LandingSectionLabel>Ready for the next handoff?</LandingSectionLabel><h2>Start with the work in front of you.</h2><p>Search for a trusted local worker, join as a cooperative member, or sign in to continue where you left off.</p></div>
          <div className="landing-closing-actions"><button type="button" className="landing-button landing-button--paper" onClick={() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" })}>Find a service <ArrowRight size={16} /></button><button type="button" className="landing-button landing-button--outline" onClick={onCreateAccount}>Join the network <ArrowRight size={16} /></button></div>
        </section>
      </main>

      <footer className="landing-footer">
        <BrandLockup />
        <p>Built for visible trust, fair coordination, and local service.</p>
        <nav aria-label="Footer navigation"><a href="#services">Find a service</a><a href="#how-it-works">How it works</a><a href="#workers">For workers</a><a href="#cooperatives">For cooperatives</a><button type="button" onClick={onSignIn}>Sign in</button><button type="button" onClick={onCreateAccount}>Create account</button></nav>
        <small>Co-Labour frontend demo · simulated payment and welfare data</small>
      </footer>
    </div>
  );
}