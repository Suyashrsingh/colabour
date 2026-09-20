/* Style reminder: Sahaay Warm Editorial Service Atlas, revised executive cooperative palette. Preserve light ivory surfaces, forest/teal trust accents, structured rail, generous editorial spacing, and explicit next actions. */
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, Coins, Copy, CreditCard, Download, ExternalLink, Eye, FileCheck, FileText, Filter, HelpCircle, Home as HomeIcon, LayoutDashboard, Loader2, Lock, MapPin, Menu, MoreHorizontal, PieChart, Printer, QrCode, Search, Send, Settings2, Shield, ShieldAlert, ShieldCheck, Sparkles, Star, Upload, UploadCloud, Users, WalletCards, X, Zap, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoStore, isWorkerBusy, calculateEarningsSplit, EMERGENCY_RESERVE_PERCENT, type DemoWorkerRegistration, type DemoBooking, type PaymentNotification, type DemoCustomerProfile, type DemoSociety } from "@/contexts/DemoStoreContext";
import { uploadSocietyDocument } from "@/lib/supabase";
import { animateDashboardReveal } from "@/lib/gsapAnimations";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { MARKETPLACE_CATEGORIES } from "@/data/marketplaceWorkers";

function exportBookingsCsv(bookingsList: DemoBooking[]) {
  const headers = ["Booking ID", "Customer", "Worker", "Service", "Date", "Status", "Amount", "Emergency", "Payment Status", "Payment Method", "Tx Ref"];
  const rows = bookingsList.map(b => [
    b.id,
    `"${(b.customerName || "Customer").replace(/"/g, '""')}"`,
    `"${b.worker.replace(/"/g, '""')}"`,
    `"${b.service.replace(/"/g, '""')}"`,
    `"${b.date.replace(/"/g, '""')}"`,
    b.status,
    `"${b.amount}"`,
    b.emergency ? "YES" : "NO",
    b.paymentStatus || "Pending",
    b.paymentMethod || "N/A",
    b.paymentTxRef || "N/A"
  ]);
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `cooperative_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Cooperative audit ledger exported successfully (CSV)!");
}

type Role = "Customer" | "Worker" | "Admin" | "Official";
type Screen = "overview" | "find" | "bookings" | "worker" | "verify" | "adminBookings" | "issues" | "settings" | "auth" | "profile" | "members" | "officialDesk" | "officialSocieties";

type WorkerItem = { id: string; name: string; initials: string; service: string; area: string; years: number; rating: string; jobs: number; rate: string; accent: string; available: string };
type PendingWorkerItem = WorkerItem & { experience: string; submitted: string; membershipId?: string; societyName?: string };

const workers: WorkerItem[] = [];
const pendingWorkers: PendingWorkerItem[] = [];

function roleLabel(role: Role) {
  if (role === "Admin") return "Cooperative Admin";
  if (role === "Official") return "State RCS Official";
  return role;
}
function Skeleton({ cls }: { cls: string }) { return <span className={`skeleton ${cls}`} aria-hidden="true" />; }
function SkeletonKpiGrid() { return <div className="kpi-grid" aria-busy="true" aria-label="Loading statistics">{[0,1,2,3].map((i) => <Skeleton key={i} cls="skeleton-kpi" />)}</div>; }
function SkeletonWorkerGrid() { return <div className="worker-grid" aria-busy="true" aria-label="Loading workers">{[0,1,2].map((i) => <Skeleton key={i} cls="skeleton-card" />)}</div>; }
function SkeletonBookingList() { return <div className="booking-list" aria-busy="true" aria-label="Loading bookings">{[0,1,2].map((i) => <Skeleton key={i} cls="skeleton-row" />)}</div>; }
function Mark({ size = 48 }: { size?: number }) { return <img src="/co-labour-logo.svg" alt="Co-Labour" width={size} height={size} style={{display:'block',flexShrink:0,minWidth:size}} />; }
function Avatar({ initials, tone = "forest" }: { initials: string; tone?: string }) { return <div className={`avatar avatar-${tone}`}>{initials}</div>; }
function Status({ value }: { value: string }) {
  const tone = value === "Completed" || value === "Verified" || value === "Available today" ? "good" : value === "Emergency" || value === "Rejected" ? "urgent" : value === "Requested" || value === "Pending verification" ? "pending" : "info";
  return <span className={`status status-${tone}`}><i />{value}</span>;
}
function Button({ children, variant = "primary", onClick, icon }: { children: React.ReactNode; variant?: "primary" | "secondary" | "quiet" | "danger"; onClick?: (e?: any) => void; icon?: React.ReactNode }) { return <button onClick={onClick} className={`app-button ${variant}`}>{children}{icon}</button>; }
function Kpi({ label, value, detail, tone = "forest", chartData }: { label: string; value: string; detail: string; tone?: string; chartData?: number[] }) { 
  const data = chartData ? chartData.map((val, i) => ({ index: i, value: val })) : [];
  return <div className={`kpi kpi-${tone}`} style={{position: 'relative', overflow: 'hidden'}}><div className="kpi-orbit" /><div style={{position:'relative', zIndex:2}}><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
  {chartData && <div style={{position: 'absolute', bottom: -10, left: 0, right: 0, height: '40px', opacity: 0.3, zIndex: 1, pointerEvents: 'none'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><YAxis domain={['dataMin', 'dataMax']} hide /><Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}
  </div>; 
}

function useCountdown(targetTimestamp?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetTimestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (!targetTimestamp) return { remainingSeconds: 0, isExpired: true, formatted: "00:00" };
  const diff = Math.max(0, Math.floor((targetTimestamp - now) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return {
    remainingSeconds: diff,
    isExpired: diff <= 0,
    formatted: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
  };
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-title"><div><p className="eyebrow"><span />{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>; }

function WorkerCard({
  worker,
  onSelect,
  ratingOverride,
  isBusy,
}: {
  worker: typeof workers[number];
  onSelect: (worker: typeof workers[number]) => void;
  ratingOverride?: number;
  isBusy?: boolean;
}) {
  const displayRating = ratingOverride ? ratingOverride.toFixed(1) : worker.rating;
  return (
    <article className={`worker-card ${isBusy ? "is-busy" : ""}`}>
      <div className="worker-card-top">
        <div className="worker-identity">
          <Avatar initials={worker.initials} tone={worker.accent} />
          <div>
            <h3>{worker.name}</h3>
            <p>{worker.service}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isBusy && (
            <span className="worker-busy-badge" title="Worker is currently busy on an active job">
              <Clock3 size={10} /> Busy · On Job
            </span>
          )}
          <Status value="Verified" />
        </div>
      </div>
      <div className="worker-details">
        <span><MapPin size={14} /> {worker.area}</span>
        <span><Clock3 size={14} /> {worker.years} years</span>
        <span><Star size={14} fill="currentColor" /> {displayRating} <em>({worker.jobs})</em></span>
      </div>
      <div className="worker-card-footer">
        <div>
          <strong>{worker.rate}</strong>
          <small>base visit</small>
        </div>
        {isBusy ? (
          <span className="availability busy" title="Worker is busy on another job">
            <i /> Busy · On a job
          </span>
        ) : (
          <span className="availability">
            <i /> {worker.available}
          </span>
        )}
        <Button
          variant={isBusy ? "outline" : "secondary"}
          onClick={() => onSelect(worker)}
          icon={<ArrowRight size={15} />}
        >
          {isBusy ? "View status" : "View profile"}
        </Button>
      </div>
    </article>
  );
}

function AppShell({ role, setRole, screen, setScreen, children }: { role: Role; setRole: (role: Role) => void; screen: Screen; setScreen: (screen: Screen) => void; children: React.ReactNode }) {
  const { session, profile, signOut } = useAuth();
  const { bookings: _nb, approvedWorkerNames: _na, rejectedWorkerNames: _nr, issues: _ni, newPendingWorkers } = useDemoStore();
  const displayName = profile?.fullName || (role === "Customer" ? "Customer Member" : role === "Worker" ? "Cooperative Worker" : role === "Official" ? "State RCS Official" : "Cooperative Admin");
  const displayInitials = displayName.split(" ").filter(Boolean).map((part) => part[0]).join("").substring(0, 2).toUpperCase() || (role === "Customer" ? "CM" : role === "Worker" ? "CW" : role === "Official" ? "SO" : "CA");
  const _preqs = _nb.filter((b) => b.status === "Requested").length;
  const _pvfy = newPendingWorkers.filter((w) => !_na.includes(w.name) && !_nr.includes(w.name)).length;
  const _oiss = _ni.filter((i) => i.status === "Open").length;
  const _abkgs = _nb.filter((b) => b.status !== "Completed" && b.status !== "Cancelled").length;
  const navDef: Record<Role, { label: string; screen: Screen; icon: LucideIcon; count?: string }[]> = {
    Customer: [{ label: "Overview", screen: "overview", icon: HomeIcon }, { label: "Find a worker", screen: "find", icon: Search }, { label: "My bookings", screen: "bookings", icon: ClipboardList, ...(_abkgs > 0 ? { count: String(_abkgs) } : {}) }, { label: "My profile", screen: "profile", icon: Users }, { label: "Raise an issue", screen: "issues", icon: FileText }],
    Worker: [{ label: "My dashboard", screen: "worker", icon: LayoutDashboard }, { label: "Incoming requests", screen: "bookings", icon: ClipboardList, ...(_preqs > 0 ? { count: String(_preqs) } : {}) }, { label: "My profile", screen: "profile", icon: Users }, { label: "Raise an issue", screen: "issues", icon: FileText }],
    Admin: [{ label: "Overview", screen: "overview", icon: LayoutDashboard }, { label: "Society profile", screen: "profile", icon: Building2 }, { label: "All members", screen: "members", icon: Users }, { label: "Verify workers", screen: "verify", icon: ShieldCheck, ...(_pvfy > 0 ? { count: String(_pvfy) } : {}) }, { label: "All bookings", screen: "adminBookings", icon: ClipboardList }, { label: "Issues inbox", screen: "issues", icon: FileText, ...(_oiss > 0 ? { count: String(_oiss) } : {}) }],
    Official: [{ label: "RCS Regulatory Desk", screen: "overview", icon: ShieldCheck }, { label: "Registered Societies & Govt IDs", screen: "officialSocieties", icon: Building2 }, { label: "Arbitration Inbox", screen: "issues", icon: FileText }],
  };
  const nav = navDef[role];

  const handleSignOut = async () => {
    await signOut();
    setRole("Customer");
    setScreen("auth");
  };

  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screen !== "auth") {
      const cleanup = animateDashboardReveal(dashboardRef.current);
      return cleanup;
    }
  }, [screen]);
  
  if (screen === "auth") {
    return <div className="product-shell" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--ivory)'}}>
      <div id="main-content" style={{width: '100%', padding: '20px', maxWidth: '1200px', display: 'flex', justifyContent: 'center'}}>
        {children}
      </div>
    </div>;
  }

  return <div className="product-shell"><a href="#main-content" className="skip-link">Skip to main content</a><aside className="app-rail" role="navigation" aria-label="Primary navigation"><div className="brand-lockup"><Mark size={52} /><div><strong>Co-Labour</strong><span>CO-OP SERVICES</span></div></div><div className="rail-context"><span className="live-indicator" /> {role === "Admin" ? "Cooperative Admin" : role === "Worker" ? "Worker" : role === "Official" ? "State RCS Official" : "Customer"} <span style={{opacity:0.4,margin:'0 4px'}}>·</span> {profile?.societyName ?? (role === "Official" ? "State Dept of Cooperatives" : "Co-Labour Network")}</div><p className="rail-label">{role === "Admin" ? "COOPERATIVE DESK" : role === "Worker" ? "WORKER DESK" : role === "Official" ? "STATE REGULATORY DESK" : "SERVICE DESK"}</p><nav className="app-nav">{nav.map(({ label, screen: target, icon: Icon, count }) => <button key={label} onClick={() => setScreen(target)} className={screen === target ? "active" : ""}><Icon size={16} /><span>{label}</span>{count && <b>{count}</b>}</button>)}</nav><div className="rail-divider" /><button className={`rail-settings ${screen === "settings" ? "active" : ""}`} onClick={() => setScreen("settings")}><Settings2 size={16} /> Settings</button><div className="rail-footer"><button className="profile-mini" onClick={() => setScreen("auth")}><Avatar initials={displayInitials} /><div><strong>{displayName}</strong><small>{roleLabel(role)} account</small></div><MoreHorizontal size={15} /></button><button onClick={handleSignOut} style={{display:'flex',alignItems:'center',gap:8,width:'100%',border:0,background:'transparent',color:'var(--danger)',padding:'9px 10px',borderRadius:9,fontSize:11,fontWeight:600,cursor:'pointer',transition:'.15s',marginTop:3}} onMouseEnter={e=>(e.currentTarget.style.background='var(--danger-soft)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')} aria-label="Sign out"><X size={14} />Sign out</button></div></aside><main className="app-main"><header className="app-topbar"><button className="mobile-menu" aria-label="Open navigation menu" aria-expanded={false}><Menu size={18} /></button><div className="topbar-brand"><Mark size={40} /><strong>Co-Labour</strong><span>co-op services</span></div><div className="topbar-center">{role === "Official" ? <button className="command-button" aria-label="Search registered societies, cooperative admins..."><Search size={14} /> Search registered societies, cooperative admins... <kbd>K</kbd></button> : role === "Admin" ? <button className="command-button" aria-label="Search workers, bookings..."><Search size={14} /> Search workers, bookings... <kbd>K</kbd></button> : null}</div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications — no new alerts" aria-live="polite"><Bell size={17} /><i aria-hidden="true" /></button></div></header><div id="main-content" ref={dashboardRef}>{children}</div></main></div>;
}

function ActiveBookingRequestedBadge({ booking }: { booking: DemoBooking }) {
  const deadline = booking.workerAcceptDeadline || (booking.createdAtTimestamp ? booking.createdAtTimestamp + 5 * 60 * 1000 : undefined);
  const { formatted, isExpired } = useCountdown(deadline);
  return (
    <div style={{ margin: '12px 0 6px', padding: '9px 13px', background: 'rgba(200,148,57,.09)', border: '1px solid rgba(200,148,57,.22)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span className="pulse-radar" style={{ background: 'rgba(200,148,57,.18)', color: '#7a5c1c' }}><i style={{ background: '#c89439' }} /> CONNECTING</span>
        <span style={{ fontSize: 11, color: '#7a5c1c', fontWeight: 600 }}>Waiting for {booking.worker} to accept</span>
      </div>
      <span style={{ fontSize: 10.5, color: '#7a5c1c', fontWeight: 700 }}>
        {isExpired ? "Auto-cancelling..." : `${formatted} remaining`}
      </span>
    </div>
  );
}

function Overview({ role, go, bookingItems, openBooking, onReview }: { role: Role; go: (screen: Screen) => void; bookingItems: DemoBooking[]; openBooking?: (booking: DemoBooking) => void; onReview?: (worker: any) => void }) {
  const { approvedWorkerNames, rejectedWorkerNames, issues, verifiedWorkers, supabaseReady } = useDemoStore();
  const { profile } = useAuth();
  if (role === "Official") return <OfficialDashboard go={go} />;
  if (role === "Worker") return <WorkerDashboard go={go} bookingItems={bookingItems} />;
  if (role === "Admin") return <AdminOverview go={go} bookingItems={bookingItems} approvedWorkerNames={approvedWorkerNames} rejectedWorkerNames={rejectedWorkerNames} openBooking={openBooking} onReview={onReview} />;
  const customerBookings = bookingItems.filter(
    (b) =>
      (profile?.id && (b as any).customerId === profile.id) ||
      (profile?.fullName && b.customerName && b.customerName.toLowerCase() === profile.fullName.toLowerCase())
  );
  const activeBookings = customerBookings.filter((booking) => booking.status !== "Completed" && booking.status !== "Cancelled");
  const activeBooking = activeBookings[0];
  const stages = ["Requested", "Accepted", "En Route", "In Progress", "Completed"];
  const stageIndex = activeBooking ? Math.max(0, stages.indexOf(activeBooking.status)) : 0;
  const nextDetail = activeBookings[1] ?? activeBooking;
  const customerGreeting = profile?.fullName ? profile.fullName.split(" ")[0].toUpperCase() : "MEMBER";
  const verifiedCount = verifiedWorkers.length;
  const custOpenIssues = issues.filter((i) => i.status === "Open" && i.raisedBy === "Customer").length;
  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow={`CUSTOMER / ${customerGreeting}`}
        title="Home Services"
        description="Book verified cooperative tradespeople with transparent rates."
        action={<Button icon={<ArrowRight size={15} />} onClick={() => go("find")}>Find a worker</Button>}
      />
      <div className="kpi-grid">
        <Kpi label="Active booking" value={String(activeBookings.length).padStart(2, "0")} detail={activeBooking ? `${activeBooking.service}` : "None"} tone="forest" />
        <Kpi label="Upcoming visits" value={String(activeBookings.length).padStart(2, "0")} detail={nextDetail ? nextDetail.date : "None"} tone="brass" />
        <Kpi label="Verified workers" value={String(verifiedCount).padStart(2, "0")} detail="Active in directory" tone="blue" />
        <Kpi label="Open issues" value={String(custOpenIssues).padStart(2, "0")} detail={custOpenIssues > 0 ? "Under review" : "All clear"} tone="sage" />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <PanelHead
            title="Your active booking"
            meta={activeBooking ? `Status: ${activeBooking.status}` : "No active booking"}
            action={<button className="link-button" onClick={() => go("bookings")}>View all <ArrowRight size={14} /></button>}
          />
          {activeBooking ? (
            <div className="booking-feature">
              <div className="booking-worker">
                <Avatar initials={activeBooking.worker.split(" ").map((x) => x[0]).join("")} tone="forest" />
                <div>
                  <strong>{activeBooking.worker}</strong>
                  <small>{activeBooking.service} · Gurugram</small>
                </div>
                <Status value={activeBooking.status} />
              </div>
              {activeBooking.status === "Requested" && (
                <ActiveBookingRequestedBadge booking={activeBooking} />
              )}
              {activeBooking.status === "En Route" && (
                <div style={{margin:'12px 0 6px',padding:'9px 13px',background:'var(--teal-soft)',borderRadius:9,display:'flex',alignItems:'center',gap:9}}>
                  <span className="pulse-radar"><i /> ON THE WAY</span>
                  <span style={{fontSize:11,color:'var(--forest-dark)',fontWeight:600}}>{activeBooking.worker} is on the way (approx 15 mins)</span>
                </div>
              )}
              {activeBooking.status === "In Progress" && (
                <div style={{margin:'12px 0 6px',padding:'9px 13px',background:'var(--brass-soft)',borderRadius:9,display:'flex',alignItems:'center',gap:9}}>
                  <span className="pulse-radar" style={{background:'rgba(200,148,57,.18)',color:'#7a5c1c'}}><i style={{background:'#c89439'}} /> IN PROGRESS</span>
                  <span style={{fontSize:11,color:'#7a5c1c',fontWeight:600}}>Service in progress</span>
                </div>
              )}
              {activeBooking.status === "Accepted" && (
                <div style={{margin:'12px 0 6px',padding:'9px 13px',background:'var(--sage-soft)',borderRadius:9,display:'flex',alignItems:'center',gap:9}}>
                  <Check size={15} style={{color:'var(--forest)'}} />
                  <span style={{fontSize:11,color:'var(--forest)',fontWeight:600}}>Booking confirmed by {activeBooking.worker}</span>
                </div>
              )}
              <div className="booking-meta">
                <span><CalendarDays size={15} /> {activeBooking.date}</span>
                <span><WalletCards size={15} /> {activeBooking.amount} estimate</span>
              </div>
              <div className="progress-rail">
                {stages.map((stage, index) => <span key={stage} className={index < stageIndex ? "done" : index === stageIndex ? "current" : ""} />)}
              </div>
              <div className="progress-labels">
                {stages.map((stage) => <span key={stage}>{stage === "Completed" ? "Done" : stage}</span>)}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <ClipboardList size={22} />
              <strong>No active booking</strong>
              <p>Booked worker progress will show here.</p>
              <Button variant="secondary" onClick={() => go("find")} icon={<ArrowRight size={14} />}>Find a worker</Button>
            </div>
          )}
        </section>
        <section className="panel quick-panel">
          <PanelHead title="Quick actions" meta="" />
          <div className="quick-actions">
            <button onClick={() => go("find")}><Search size={18} /><span>Find a worker</span><ArrowRight size={14} /></button>
            <button onClick={() => go("bookings")}><ClipboardList size={18} /><span>My bookings</span><ArrowRight size={14} /></button>
            <button onClick={() => go("issues")}><FileText size={18} /><span>Report an issue</span><ArrowRight size={14} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PanelHead({ title, meta, action }: { title: string; meta: string; action?: React.ReactNode }) { return <div className="panel-head"><div><h2>{title}</h2>{meta && <small>{meta}</small>}</div>{action}</div>; }

function FindWorker({ onSelect }: { onSelect: (worker: typeof workers[number]) => void }) {
  const [query, setQuery] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.sessionStorage.getItem("sahaay-landing-search");
        if (stored) return JSON.parse(stored).locality || "";
      }
    } catch {}
    return "";
  });
  const [category, setCategory] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.sessionStorage.getItem("sahaay-landing-search");
        if (stored) {
          const svc = JSON.parse(stored).service;
          if (svc && MARKETPLACE_CATEGORIES.includes(svc as typeof MARKETPLACE_CATEGORIES[number])) return svc;
        }
      }
    } catch {}
    return "All services";
  });
  const { ratings, approvedWorkerNames, verifiedWorkers, supabaseReady, bookings: demoBookings } = useDemoStore();
  // When Supabase has verified workers loaded, use real verified workers; otherwise show full marketplace list
  const allWorkers = useMemo(() => {
    return verifiedWorkers as unknown as typeof workers;
  }, [verifiedWorkers]);
  const filtered = useMemo(() => {
    const list = allWorkers.filter((w) => `${w.name} ${w.service} ${w.area}`.toLowerCase().includes(query.toLowerCase()) && (category === "All services" || w.service === category));
    // Sort by availability: available workers first, busy workers second
    return [...list].sort((a, b) => {
      const aBusy = isWorkerBusy(a, demoBookings);
      const bBusy = isWorkerBusy(b, demoBookings);
      if (aBusy && !bBusy) return 1;
      if (!aBusy && bBusy) return -1;
      return 0;
    });
  }, [allWorkers, query, category, demoBookings]);
  return (
    <div className="content-wrap">
      <PageTitle eyebrow="DISCOVER / VERIFIED NETWORK" title="Find the right hands." description="Search verified cooperative workers by service and locality. Every profile carries a visible trust record." />
      <section className="search-panel">
        <div className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by worker, service, or area" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}><option>All services</option>{MARKETPLACE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <button className="filter-button"><Filter size={15} /> Filters</button>
      </section>
      <div className="results-heading">
        <div><strong>{filtered.length} verified worker{filtered.length === 1 ? "" : "s"}</strong><span> in cooperative network</span></div>
        <span className="sort-label">Sorted by <b>availability</b> <ChevronDown size={14} /></span>
      </div>
      <div className="worker-grid">
        {filtered.length > 0 ? (
          filtered.map((worker) => <WorkerCard key={worker.id} worker={worker} onSelect={onSelect} ratingOverride={ratings[worker.name]} isBusy={isWorkerBusy(worker, demoBookings)} />)
        ) : (
          <div className="empty-state" style={{ gridColumn: "1 / -1", padding: "48px 24px" }}>
            <Users size={36} style={{ color: "var(--forest)", opacity: 0.45, margin: "0 auto 12px" }} />
            <strong>No verified workers in directory</strong>
            <p>Workers registered under verified cooperative societies will appear here after approval.</p>
          </div>
        )}
      </div>
      <div className="network-note">
        <ShieldCheck size={18} />
        <p><strong>Why verification matters</strong><br />Cooperative admins review worker details before their profile becomes visible here.</p>
      </div>
    </div>
  );
}

function WorkerProfile({ worker, close, book, ratingOverride, ratingComment, role, isBusy }: { worker: typeof workers[number]; close: () => void; book: () => void; ratingOverride?: number; ratingComment?: string; role?: Role; isBusy?: boolean }) {
  const displayRating = ratingOverride ? ratingOverride.toFixed(1) : worker.rating;
  const isAdmin = role === "Admin";
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${worker.name} worker profile`} onClick={close}>
      <aside className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={close}><X size={17} /></button>
        <div className="drawer-hero">
          <Avatar initials={worker.initials} tone={worker.accent} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
            <Status value="Verified" />
            {isBusy ? (
              <span className="worker-busy-badge" style={{ fontSize: 11, padding: "3px 10px" }}>
                <Clock3 size={12} /> BUSY · ON A JOB
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--teal-soft)", color: "var(--forest)", fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 10px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5e967c", display: "inline-block" }} />
                Available Now
              </span>
            )}
          </div>
          <h2>{worker.name}</h2>
          <p>{worker.service} · {worker.area}</p>
        </div>

        {isBusy && (
          <div style={{
            margin: "14px 0 10px",
            padding: "12px 14px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1.5px solid rgba(245, 158, 11, 0.35)",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <Clock3 size={18} style={{ color: "#b45309", flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: "block", color: "#92400e", fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>
                Worker is Currently Busy
              </strong>
              <p style={{ margin: 0, fontSize: 11, color: "#78350f", lineHeight: 1.45 }}>
                {worker.name} is actively working on a confirmed job. Bookings are temporarily unavailable for this worker. Please select another available cooperative worker.
              </p>
            </div>
          </div>
        )}

        <div className="trust-block">
          <ShieldCheck size={19} />
          <div>
            <strong>Verified by {(worker as any).societyName || "Chartered Cooperative Society"}</strong>
            <small>Profile reviewed and active on cooperative network</small>
          </div>
        </div>
        <div className="profile-stats">
          <div><strong>{worker.years}</strong><small>years experience</small></div>
          <div><strong>{displayRating}</strong><small>average rating</small></div>
          <div><strong>{worker.jobs}</strong><small>completed jobs</small></div>
        </div>
        <div className="drawer-section">
          <p className="eyebrow">SERVICE NOTE</p>
          <p>“I bring a clear estimate before I begin and keep every handoff visible.”</p>
        </div>
        {ratingComment && (
          <div style={{margin:'16px 0',padding:'11px',background:'var(--brass-soft)',borderRadius:9,fontSize:11,color:'#7a5c1c'}}>
            <strong style={{display:'block',marginBottom:4}}>Latest review note</strong>
            {ratingComment}
          </div>
        )}
        <div className="drawer-bottom">
          <div>
            <strong>{worker.rate}</strong>
            <small>{isAdmin ? "registered tariff · 90% net + 10% emergency fund" : "base visit charge"}</small>
          </div>
          {isAdmin ? (
            <Button variant="secondary" onClick={close}>Done Managing</Button>
          ) : isBusy ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                disabled
                style={{
                  opacity: 0.65,
                  cursor: "not-allowed",
                  border: "1px solid var(--border)",
                  background: "var(--muted)",
                  color: "var(--muted-foreground)",
                  padding: "9px 14px",
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
                title="This worker is currently on a job and cannot accept new bookings"
              >
                <X size={13} /> Currently Busy
              </button>
              <Button onClick={close} variant="secondary" icon={<Search size={14} />}>
                Find another
              </Button>
            </div>
          ) : (
            <Button onClick={book} icon={<ArrowRight size={15} />}>Book this worker</Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function MemberDossierModal({
  member,
  type,
  close,
}: {
  member: any;
  type: "worker" | "customer";
  close: () => void;
}) {
  const { workerEarningsPrivacy, ratings, bookings } = useDemoStore();
  const isWorker = type === "worker";
  const isPrivacyHidden = isWorker && !!workerEarningsPrivacy[member.name];
  const memberBookings = isWorker
    ? bookings.filter((b) => b.worker === member.name)
    : bookings.filter((b) => b.customerName === member.name || b.customerId === member.id);
  const displayRating = isWorker ? (ratings[member.name] ? ratings[member.name].toFixed(1) : member.rating || "5.0") : "5.0";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={close}>
      <div className="booking-modal member-dossier-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <button className="close-button" onClick={close}><X size={17} /></button>
        <p className="eyebrow"><span /> COOPERATIVE ARCHIVE / MEMBER DOSSIER</p>

        <div className="dossier-header">
          <Avatar initials={member.initials || member.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()} tone={isWorker ? (member.accent || "forest") : "blue"} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{member.name}</h2>
              <Status value={isWorker ? "Verified" : (member.standing || "Good Standing")} />
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              {isWorker ? `${member.service} · ${member.area || "Gurugram"}` : `Household Member · ${member.area || "Gurugram"}`}
            </p>
          </div>
        </div>

        {/* Financial Sovereignty / Privacy Banner if Active */}
        {isWorker && isPrivacyHidden && (
          <div style={{ background: "rgba(200, 148, 57, 0.1)", border: "1px solid rgba(200, 148, 57, 0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={16} style={{ color: "#7a5c1c", flexShrink: 0 }} />
            <div>
              <strong style={{ display: "block", fontSize: 11.5, color: "#7a5c1c" }}>Sovereign Earnings Privacy Active</strong>
              <span style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
                This member has exercised their democratic right to conceal cumulative earnings and payout breakdowns from cooperative admin oversight.
              </span>
            </div>
          </div>
        )}

        <div className="dossier-grid">
          <div className="dossier-item">
            <small>Cooperative ID</small>
            <strong>{member.membershipId || (isWorker ? `COOP-WRK-${member.id ? String(member.id).slice(-4) : '204'}` : `COOP-HH-${member.id ? String(member.id).slice(-4) : '102'}`)}</strong>
          </div>
          <div className="dossier-item">
            <small>Contact Details</small>
            <strong>{member.phone || "+91 98765 •••••"}</strong>
          </div>
          <div className="dossier-item">
            <small>{isWorker ? "Trade Experience" : "Registered Locality"}</small>
            <strong>{isWorker ? `${member.years || member.experience || 4} Years in Field` : (member.addressLine || member.area || "Gurugram")}</strong>
          </div>
          <div className="dossier-item">
            <small>{isWorker ? "Registered Base Tariff" : "Payment Preference"}</small>
            <strong>{isWorker ? (isPrivacyHidden ? "🔒 Protected by Member" : (member.rate || "₹350 / visit")) : (member.preferredPayment || "Razorpay UPI")}</strong>
          </div>
          <div className="dossier-item">
            <small>All-Time Dispatches</small>
            <strong>{memberBookings.length} Recorded Services</strong>
          </div>
          <div className="dossier-item">
            <small>{isWorker ? "Trust & Quality Rating" : "Account Good Standing"}</small>
            <strong>{isWorker ? `★ ${displayRating} Rating` : (member.standing || "Preferred Household")}</strong>
          </div>
        </div>

        {/* Dispute & Governance History */}
        <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>Cooperative Compliance &amp; Grievance Record:</span>
            <span className="status status-good" style={{ fontSize: 9.5 }}>0 Violations</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "var(--muted-foreground)" }}>
            Clean track record with zero unresolved arbitration claims or platform penalties.
          </p>
        </div>

        {/* Recent Activity Log */}
        <div>
          <strong style={{ display: "block", fontSize: 12, marginBottom: 8, color: "var(--ink)" }}>
            Recent Activity &amp; Booking Log ({memberBookings.length})
          </strong>
          {memberBookings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 130, overflowY: "auto" }}>
              {memberBookings.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--paper)", padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 11 }}>
                  <div>
                    <strong>{b.service}</strong> <span style={{ color: "var(--muted-foreground)" }}>· {b.date}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{isWorker && isPrivacyHidden ? "🔒 Private" : b.amount}</span>
                    <Status value={b.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>No recent bookings on record for this member.</p>
          )}
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={close}>Close Dossier</Button>
        </div>
      </div>
    </div>
  );
}

function Bookings({ role, go, openBooking, bookingItems = [] }: { role: Role; go: (screen: Screen) => void; openBooking: (booking: DemoBooking) => void; bookingItems?: DemoBooking[] }) {
  const { profile } = useAuth();
  const defaultTab = role === "Admin" ? "all" : "upcoming";
  const [tab, setTab] = useState<"upcoming" | "past" | "all">(defaultTab);
  const workerDisplayName = profile?.fullName ?? "";
  const source = role === "Worker"
    ? bookingItems.filter((b) => b.worker === workerDisplayName || (profile?.id && b.workerId === profile.id))
    : role === "Customer" && profile?.id
    ? bookingItems.filter((b) => b.customerId === profile.id || b.customerName === profile.fullName)
    : bookingItems;
  const active = source.filter((booking) => booking.status !== "Completed" && booking.status !== "Cancelled");
  const past = source.filter((booking) => booking.status === "Completed" || booking.status === "Cancelled");
  const list = tab === "upcoming" ? active : tab === "past" ? past : source;
  return <div className="content-wrap"><PageTitle eyebrow={role === "Worker" ? "WORK QUEUE / INCOMING REQUESTS" : role === "Admin" ? "COOPERATIVE DESK / ALL BOOKINGS" : "CUSTOMER SPACE / BOOKINGS"} title={role === "Worker" ? "Keep the work moving." : role === "Admin" ? "Every handoff, visible." : "Your bookings."} description={role === "Worker" ? "See what needs your attention next, then move each job forward with one clear action." : role === "Admin" ? "Monitor and manage every booking across the cooperative, including emergency flags, settlements, and dispute resolutions." : "A calm view of what is active, what is next, and what is complete."} action={role === "Worker" ? <Button icon={<Zap size={15} />}>Update availability</Button> : role === "Admin" ? <Button variant="secondary" onClick={() => exportBookingsCsv(source)} icon={<Download size={15} />}>Export Audit Ledger</Button> : <Button onClick={() => go("find")} icon={<ArrowRight size={15} />}>Book a service</Button>} /><div className="booking-tabs">{role !== "Admin" && <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming / active <b>{active.length}</b></button>}{role !== "Admin" && <button className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>Past <b>{past.length}</b></button>}{role === "Admin" && <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All bookings <b>{source.length}</b></button>}{role === "Admin" && <button className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>Completed / cancelled <b>{past.length}</b></button>}<button className="tab-filter"><Filter size={14} /> Filter</button></div><section className="panel table-panel"><div className="table-header"><div><h2>{role === "Worker" ? "Requests requiring action" : tab === "past" ? "Past service record" : role === "Admin" ? "All cooperative bookings" : "Upcoming and active"}</h2><small>Shared booking state · last updated a moment ago</small></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="booking-list">{list.length ? list.map((booking) => <button className="booking-row" key={booking.id} onClick={() => openBooking(booking)}><div className="booking-id"><span>{booking.id.startsWith("BK-") ? booking.id : `BK-${booking.id.slice(0, 8).toUpperCase()}`}</span><small>{booking.date}</small></div><div className="booking-person"><Avatar initials={role === "Worker" ? (booking.customerName ? booking.customerName.split(" ").map((x: string) => x[0]).join("").substring(0, 2).toUpperCase() : "CU") : booking.worker.split(" ").map((x: string) => x[0]).join("")} tone="forest" /><div><strong>{role === "Worker" ? (booking.customerName || "Customer") : booking.worker}</strong><small>{booking.service}</small></div></div><div className="booking-price"><strong>{booking.amount}</strong><small>{booking.emergency ? "Emergency" : "Base estimate"}</small></div><div><Status value={booking.status} />{booking.emergency && <span className="emergency-label"><Zap size={11} /> Emergency</span>}{booking.cancelFeeApplied && <span className="emergency-label" style={{ background: "rgba(186,75,59,.12)", color: "var(--danger)", marginLeft: 6 }}>₹50 Fee</span>}{booking.cancelReason?.includes("Auto-Released") && <span className="emergency-label" style={{ background: "rgba(200,148,57,.12)", color: "#7a5c1c", marginLeft: 6 }}>Auto-Released</span>}</div><ChevronRight size={16} className="row-chevron" /></button>) : <div className="empty-state"><ClipboardList size={22} /><strong>{tab === "past" ? "No past bookings" : "No active bookings"}</strong><p>Your completed and cancelled service record will appear here.</p></div>}</div></section></div>;
}

function WorkerIncomingRow({ booking, onAccept, onReview }: { booking: DemoBooking; onAccept: () => void; onReview: () => void }) {
  const { formatted, isExpired } = useCountdown(booking.workerAcceptDeadline);
  return (
    <div className="request-row" key={booking.id}>
      <div className="request-avatar">
        <Avatar initials={booking.customerName ? booking.customerName.split(" ").map((x: string) => x[0]).join("").substring(0, 2).toUpperCase() : "CU"} tone="brass" />
      </div>
      <div className="request-main">
        <strong>{booking.customerName ?? "Customer"}</strong>
        <small>{booking.service} · {booking.date} · {booking.amount}</small>
        <div style={{ marginTop: 3 }}>
          {!isExpired ? (
            <span className="worker-timer-pill">
              <Clock3 size={11} /> 3m response: {formatted}
            </span>
          ) : (
            <span className="worker-timer-pill" style={{ background: "rgba(186,75,59,.12)", color: "var(--danger)" }}>
              <AlertCircle size={11} /> Time limit expired
            </span>
          )}
        </div>
      </div>
      <div className="request-side">
        {booking.emergency && <span className="emergency-label"><Zap size={11} /> Emergency</span>}
        <Button onClick={onAccept} icon={<Check size={13} />}>Accept</Button>
        <Button variant="secondary" onClick={onReview}>Review</Button>
      </div>
    </div>
  );
}

function WorkerDashboard({ go, bookingItems }: { go: (screen: Screen) => void; bookingItems: DemoBooking[] }) {
  const { claims, updateBooking, paymentNotifications, dismissPaymentNotification, workerEarningsPrivacy, toggleWorkerEarningsPrivacy } = useDemoStore();
  const { profile } = useAuth();
  const workerDisplayName = profile?.fullName ?? "Worker";
  const isEarningsHidden = !!workerEarningsPrivacy[workerDisplayName];
  
  // All bookings associated with this worker
  const workerBookings = bookingItems.filter((b) => b.worker === workerDisplayName || (profile?.id && b.workerId === profile.id));
  const completedJobs = workerBookings.filter((b) => b.status === "Completed");
  
  // Jobs where the customer has actually PAID (settled)
  const paidJobs = completedJobs.filter((b) => b.paymentStatus === "Paid");
  const totalGross = paidJobs.reduce((sum, b) => sum + (parseInt((b.amount ?? "₹0").replace(/[₹,\s]/g, "")) || 0), 0);
  const emergencySavings = Math.round(totalGross * (EMERGENCY_RESERVE_PERCENT / 100));
  const netEarnings = totalGross - emergencySavings;
  
  // Completed jobs awaiting customer payment
  const awaitingPayment = completedJobs.filter((b) => b.paymentStatus !== "Paid");
  const awaitingPaymentTotal = awaitingPayment.reduce((sum, b) => sum + (parseInt((b.amount ?? "₹0").replace(/[₹,\s]/g, "")) || 0), 0);
  
  const _pending = workerBookings.filter((b) => b.status === "Requested");
  const _activeJob = workerBookings.find((b) => (b.status === "Accepted" || b.status === "En Route" || b.status === "In Progress"));
  const workerClaims = claims.filter(c => c.workerName === workerDisplayName);
  
  // Notifications for this worker
  const workerNotifs = paymentNotifications.filter(n => n.workerName === workerDisplayName || (profile?.id && n.workerId === profile.id));
  const latestNotif = workerNotifs[0];

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow={`WORKER / ${workerDisplayName.toUpperCase()}`}
        title="My Jobs & Earnings"
        description="Track your jobs, net payouts, and cooperative emergency savings."
        action={<Button icon={<Zap size={14} />}>Set Availability</Button>}
      />

      {/* Real-Time Payment Received Notification Banner */}
      {latestNotif && (
        <div className="worker-payment-notification" style={{ padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={20} style={{ color: "var(--forest)", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: 12.5, color: "var(--forest-dark)" }}>
                Received {latestNotif.amount} via {latestNotif.method}
              </strong>
              <small style={{ color: "var(--ink-soft)", fontSize: 10.5, display: "block" }}>
                From {latestNotif.customerName} · Ref: {latestNotif.txRef}
              </small>
            </div>
          </div>
          <button
            onClick={() => dismissPaymentNotification(latestNotif.id)}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 4 }}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Consolidated Worker Status Bar: Emergency Fund, Pending Settlement & Admin Privacy */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} style={{ color: "var(--forest)", flexShrink: 0 }} />
            <strong style={{ fontSize: 12.5, color: "var(--forest-dark)" }}>
              Emergency Fund: ₹{emergencySavings.toLocaleString()}
            </strong>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>(10% in coop bank)</span>
          </div>
          {awaitingPayment.length > 0 && (
            <span className="awaiting-settlement-badge" style={{ fontSize: 10.5, padding: "3px 9px" }}>
              Pending: ₹{awaitingPaymentTotal} ({awaitingPayment.length} job{awaitingPayment.length === 1 ? "" : "s"})
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="link-button"
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={() => toggleWorkerEarningsPrivacy(workerDisplayName)}
            title="Toggle visibility to cooperative admin"
          >
            <Lock size={13} style={{ color: isEarningsHidden ? "#7a5c1c" : "var(--forest)" }} />
            <span>{isEarningsHidden ? "Admin Hidden" : "Admin Visible"}</span>
          </button>
          <button
            type="button"
            className="app-button secondary"
            style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={() => go("profile")}
          >
            <Coins size={12} style={{ marginRight: 4 }} />
            Claim Aid
          </button>
        </div>
      </div>

      {/* 4 Minimal Worker KPIs */}
      <div className="kpi-grid">
        <Kpi
          label="Net Earnings (90%)"
          value={`₹${netEarnings.toLocaleString()}`}
          detail={paidJobs.length > 0 ? `${paidJobs.length} jobs in your account` : "Take-home pay"}
          tone="forest"
          chartData={paidJobs.length > 0 ? paidJobs.map(j => {
            const split = calculateEarningsSplit(j.amount ?? "350");
            return split.netPayout;
          }) : undefined}
        />
        <Kpi
          label="Emergency Fund (10%)"
          value={`₹${emergencySavings.toLocaleString()}`}
          detail="Saved in coop bank"
          tone="blue"
        />
        <Kpi
          label="Completed Jobs"
          value={String(completedJobs.length).padStart(2, "0")}
          detail={paidJobs.length === completedJobs.length ? "All settled" : `${paidJobs.length} paid · ${awaitingPayment.length} pending`}
          tone="sage"
        />
        <Kpi
          label="Emergency Cover"
          value={workerClaims.length > 0 ? "Claim Open" : "Active"}
          detail={workerClaims.length > 0 ? `${workerClaims.length} aid request(s)` : "Medical & tool cover"}
          tone="brass"
        />
      </div>

      {_activeJob && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--forest)', borderRadius: 14, padding: '16px 20px', marginBottom: 18, boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <Avatar initials={_activeJob.customerName ? _activeJob.customerName.split(" ").map((x: string) => x[0]).join("").substring(0, 2).toUpperCase() : "CU"} tone="forest" />
            <div>
              <strong style={{ fontSize: 14, display: 'block' }}>Active Job in Motion · {_activeJob.customerName ?? "Customer"}</strong>
              <small style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{_activeJob.service} · {_activeJob.date} · {_activeJob.amount}</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Status value={_activeJob.status} />
            {_activeJob.status === "Accepted" && <Button onClick={() => updateBooking(_activeJob.id, "En Route")} icon={<Zap size={14} />}>Start journey (En Route)</Button>}
            {_activeJob.status === "En Route" && <Button onClick={() => updateBooking(_activeJob.id, "In Progress")} icon={<Clock3 size={14} />}>Arrive &amp; Begin</Button>}
            {_activeJob.status === "In Progress" && <Button onClick={() => updateBooking(_activeJob.id, "Completed")} icon={<Check size={14} />}>Mark Completed</Button>}
            {(_activeJob.status === "Accepted" || _activeJob.status === "En Route") && <Button variant="secondary" onClick={() => updateBooking(_activeJob.id, "Cancelled", { cancelFeeApplied: false, cancelReason: "Worker Emergency / Vehicle Breakdown (Safe handoff)" })}>Can&apos;t make it (Emergency)</Button>}
          </div>
        </div>
      )}

      <div className="dashboard-grid worker-dash-grid">
        <section className="panel recent-panel">
          <PanelHead title="Incoming requests" meta="Shared booking queue" action={<button className="link-button" onClick={() => go("bookings")}>View queue <ArrowRight size={14} /></button>} />
          {_pending.slice(0, 4).map((b) => <WorkerIncomingRow key={b.id} booking={b} onAccept={() => updateBooking(b.id, "Accepted")} onReview={() => go("bookings")} />)}
          {_pending.length === 0 && <div className="empty-state"><Check size={22} /><strong>Queue is clear</strong><p>No incoming requests need attention.</p></div>}
        </section>

        <section className="panel recent-panel">
          <PanelHead title="Settled Payments &amp; Direct Earnings" meta={`${paidJobs.length} payments received`} />
          <div style={{ padding: "0 16px 14px" }}>
            {paidJobs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {paidJobs.slice(0, 4).map((pj) => (
                  <div key={pj.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--slate-50)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ fontSize: 12, display: "block", color: "var(--ink)" }}>{pj.service} · {pj.customerName || "Customer"}</strong>
                      <small style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
                        {pj.paymentMethod?.includes("Razorpay") ? "Razorpay Gateway" : pj.paymentMethod || "Razorpay"} · Ref: {pj.paymentTxRef || "Verified"}
                      </small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: "var(--forest)", fontSize: 13 }}>+{pj.amount}</strong>
                      <span className="settled-badge" style={{ display: "block", marginTop: 2 }}>Paid</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--muted-foreground)", fontSize: 12 }}>
                <Coins size={22} style={{ opacity: 0.4, margin: "0 auto 6px" }} />
                <strong style={{ display: "block", color: "var(--ink)", marginBottom: 2 }}>No settled payments yet</strong>
                <p style={{ margin: 0, fontSize: 11 }}>Earnings increment automatically when customers pay via Razorpay or Cash.</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel welfare-panel">
          <PanelHead title="Welfare &amp; insurance" meta="e-Shram: Verified" />
          <div className="welfare-status">
            <div className="welfare-icon"><ShieldCheck size={22} /></div>
            <div><strong>Registered Member</strong><small>e-Shram UAN: Active</small></div>
            <Check size={17} />
          </div>
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {workerClaims.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 12px', gap: '4px', color: 'var(--muted-foreground)' }}>
                  <ShieldCheck size={18} style={{ opacity: 0.35 }} />
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)', opacity: 0.7 }}>No claims filed</span>
                  <span style={{ fontSize: '10.5px', textAlign: 'center' }}>Medical and tool aid claims appear here.</span>
                </div>
              ) : (
                workerClaims.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--slate-50)', padding: '8px 12px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{c.type} Claim</strong>
                      <small>{c.date}</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <Status value={c.status} />
                      {c.amount && <strong style={{ fontSize: '12px', marginTop: '4px' }}>{c.amount}</strong>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminSocietyApplicationFlow({ society }: { society: DemoSociety }) {
  const { updateSociety } = useDemoStore();
  const [legalName, setLegalName] = useState(society.name || "");
  const [state, setState] = useState(society.state || "");
  const [district, setDistrict] = useState(society.district || "");
  const [regNo, setRegNo] = useState(society.regNumber || "");
  const [address, setAddress] = useState(society.registeredAddress || "");
  const [signatoryName, setSignatoryName] = useState(society.signatoryName || "");
  const [signatoryRole, setSignatoryRole] = useState(society.signatoryRole || "Managing Secretary");
  const [signatoryGovId, setSignatoryGovId] = useState(society.signatoryGovId || "");
  const [signatoryPhone, setSignatoryPhone] = useState(society.signatoryPhone || "");
  const [pan, setPan] = useState(society.panNumber || "");
  const [tan, setTan] = useState(society.tanNumber || "");
  const [bankName, setBankName] = useState(society.bankBranch || "");
  const [bankAccount, setBankAccount] = useState(society.bankAccount || "");
  const [bankIfsc, setBankIfsc] = useState(society.bankIfsc || "");

  const [appDocs, setAppDocs] = useState<{
    [key: string]: {
      uploaded: boolean;
      fileName: string;
      fileSize: string;
      uploadedAt: string;
      fileUrl?: string;
      ref: string;
    };
  }>({
    rcsCertificate: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
    byLaws: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
    panCard: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
    resolutionCopy: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
    bankPassbook: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
    signatoryIdProof: { uploaded: false, fileName: "", fileSize: "", uploadedAt: "", ref: "" },
  });
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAppDocUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(docKey);
    try {
      const uploaded = await uploadSocietyDocument(society.id, docKey, file);
      setAppDocs((prev) => ({
        ...prev,
        [docKey]: uploaded,
      }));
      toast.success(`Uploaded "${file.name}" successfully!`);
    } catch (err: any) {
      toast.error(`Upload error: ${err.message || "Failed to upload file"}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) {
      toast.error("Please enter legal society name.");
      return;
    }
    if (!regNo.trim()) {
      toast.error("Please enter State RCS registration or application reference number.");
      return;
    }
    if (!signatoryName.trim()) {
      toast.error("Please enter authorized signatory name.");
      return;
    }
    if (!pan.trim()) {
      toast.error("Please enter Society PAN.");
      return;
    }
    if (!bankAccount.trim()) {
      toast.error("Please enter Society bank account.");
      return;
    }

    const uploadedCount = Object.values(appDocs).filter((d) => d.uploaded).length;
    if (uploadedCount === 0) {
      toast.error("Please upload at least one statutory document (such as RCS Certificate or By-laws).");
      return;
    }

    setSubmitting(true);
    try {
      await updateSociety(society.id, {
        name: legalName.trim(),
        state,
        district,
        regNumber: regNo.trim(),
        registeredAddress: address.trim(),
        signatoryName: signatoryName.trim(),
        signatoryRole,
        signatoryGovId: signatoryGovId.trim(),
        signatoryPhone: signatoryPhone.trim(),
        panNumber: pan.trim(),
        tanNumber: tan.trim(),
        bankBranch: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankIfsc: bankIfsc.trim(),
        rcsOffice: `Office of Registrar of Cooperative Societies, ${district}, ${state}`,
        status: "Pending",
        submittedAt: new Date().toISOString(),
        reviewDeadline: Date.now() + 12 * 3600 * 1000,
        verificationBadge: "Pending Registrar Audit",
        documents: appDocs,
        documentRefs: {
          rcsCertificateNo: appDocs.rcsCertificate?.ref || (regNo ? `HR-RCS-${regNo}` : ""),
          panAckNo: appDocs.panCard?.ref || (pan ? `PAN-${pan}` : ""),
          resolutionNo: appDocs.resolutionCopy?.ref || "",
          bankMandateRef: appDocs.bankPassbook?.ref || (bankIfsc ? `MANDATE-${bankIfsc}` : ""),
          byLawsVersion: appDocs.byLaws?.ref || "CRCS Model By-laws (Submitted)",
          signatoryGovIdRef: appDocs.signatoryIdProof?.ref || signatoryGovId,
        },
      });
      toast.success("Society approval application and documents submitted to State Registrar (RCS)!");
    } catch (err: any) {
      toast.error(`Submission failed: ${err.message || "Failed to submit application"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content-wrap">
      <div style={{ maxWidth: 780, margin: "20px auto" }}>
        {/* Blocked Alert Banner */}
        <div style={{ background: "rgba(200, 148, 57, 0.12)", border: "1px solid rgba(200, 148, 57, 0.35)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#7a5c1c", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
            <Lock size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13, color: "#5c430e" }}>Platform Access Blocked · Approval Application Required</strong>
              <span className="sla-countdown-pill" style={{ background: "rgba(200,148,57,.2)", borderColor: "rgba(200,148,57,.4)", color: "#5c430e" }}>Action Required</span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: "#6e5218", lineHeight: 1.5 }}>
              Your cooperative account is created, but <strong>all operations (worker dispatches, member directory, and onboarding) remain blocked</strong> until you submit your society details and statutory documents for State Registrar (RCS) verification.
            </p>
          </div>
        </div>

        {/* Application Form Card */}
        <section className="panel" style={{ padding: "26px 28px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--paper)" }}>
          <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <p className="eyebrow" style={{ color: "var(--forest)" }}><span /> STATUTORY ONBOARDING · STEP 1 OF 2</p>
            <h2 style={{ fontSize: 21, margin: "6px 0", color: "var(--ink)" }}>Apply for Cooperative Society Official Charter</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Provide your official registration details and upload statutory government documents. Once verified by the State Official, your operations will unlock and you will receive a unique <strong>Cooperative Society ID</strong> for workers to register.
            </p>
          </div>

          <form onSubmit={handleSubmitApplication} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Section 1 */}
            <div className="admin-reg-group" style={{ margin: 0 }}>
              <div className="admin-reg-group-title">
                <Building2 size={15} /> 1. Cooperative Society Details
              </div>
              <label className="admin-field-label">
                Legal Registered Society Name
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Haryana Urban Care Cooperative Society Ltd."
                  required
                />
              </label>
              <div className="admin-field-row">
                <label className="admin-field-label">
                  State Jurisdiction
                  <select value={state} onChange={(e) => setState(e.target.value)}>
                    <option>Haryana</option>
                    <option>Delhi NCR</option>
                    <option>Uttar Pradesh</option>
                    <option>Maharashtra</option>
                    <option>Karnataka</option>
                    <option>Rajasthan</option>
                  </select>
                </label>
                <label className="admin-field-label">
                  District / Zone
                  <input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Gurugram"
                    required
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  State RCS Registration Number / Filing Ref
                  <input
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="e.g. COOP/HR/GGN/2026/0894"
                    required
                  />
                </label>
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  Registered Office Address
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Sector 14, Institutional Area, Gurugram"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Section 2 */}
            <div className="admin-reg-group" style={{ margin: 0 }}>
              <div className="admin-reg-group-title">
                <ShieldCheck size={15} /> 2. Authorized Administrator & Signatory
              </div>
              <div className="admin-field-row">
                <label className="admin-field-label">
                  Authorized Signatory Name
                  <input
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="Enter full legal name"
                    required
                  />
                </label>
                <label className="admin-field-label">
                  Signatory Designation
                  <select value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)}>
                    <option>Managing Secretary</option>
                    <option>President</option>
                    <option>Managing Director</option>
                    <option>Registrar Nominee</option>
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  Signatory Mobile Number
                  <input
                    value={signatoryPhone}
                    onChange={(e) => setSignatoryPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </label>
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  Signatory Aadhaar / Government ID Ref
                  <input
                    value={signatoryGovId}
                    onChange={(e) => setSignatoryGovId(e.target.value)}
                    placeholder="e.g. Aadhaar UID / Voter ID"
                    required
                  />
                </label>
              </div>
            </div>

            {/* Section 3 */}
            <div className="admin-reg-group" style={{ margin: 0 }}>
              <div className="admin-reg-group-title">
                <CreditCard size={15} /> 3. Statutory Tax IDs & Cooperative Banking
              </div>
              <div className="admin-field-row">
                <label className="admin-field-label">
                  Society PAN Number
                  <input
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="e.g. ABCDE1234F"
                    required
                  />
                </label>
                <label className="admin-field-label">
                  Society TAN Number (Optional)
                  <input
                    value={tan}
                    onChange={(e) => setTan(e.target.value)}
                    placeholder="e.g. ABCD12345E"
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  Cooperative Bank Name
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Cooperative Apex Bank"
                    required
                  />
                </label>
                <label className="admin-field-label" style={{ marginBottom: 0 }}>
                  Bank IFSC Code
                  <input
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value)}
                    placeholder="e.g. SBIN0001234"
                    required
                  />
                </label>
              </div>
              <label className="admin-field-label" style={{ marginTop: 10, marginBottom: 0 }}>
                Cooperative Society Bank Account Number
                <input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Enter bank account number"
                  required
                />
              </label>
            </div>

            {/* Section 4: Document Uploads */}
            <div className="admin-reg-group" style={{ margin: 0 }}>
              <div className="admin-reg-group-title">
                <FileText size={15} /> 4. Mandatory Statutory Document Uploads
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted-foreground)" }}>
                Upload official statutory copies (PDF, PNG, JPEG). The State Registrar verifies each filing directly in Supabase before granting platform charter.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  {
                    key: "rcsCertificate",
                    title: "1. State RCS Registration Certificate / Formation Filing",
                    desc: "Official charter or provisional acknowledgment PDF",
                  },
                  {
                    key: "byLaws",
                    title: "2. Model Society By-laws Copy",
                    desc: "Adopted by-laws ratified by general body",
                  },
                  {
                    key: "panCard",
                    title: "3. Society PAN Card / Tax Registration Document",
                    desc: "Official Income Tax Dept card or registration acknowledgment",
                  },
                  {
                    key: "resolutionCopy",
                    title: "4. Managing Committee Resolution & Signatory Mandate",
                    desc: "Authorizing administrator to operate Co-Labour desk",
                  },
                  {
                    key: "bankPassbook",
                    title: "5. Cooperative Bank Mandate / Passbook Copy",
                    desc: "Proof of dedicated cooperative settlement account",
                  },
                  {
                    key: "signatoryIdProof",
                    title: "6. Administrator KYC & ID Proof",
                    desc: "Signatory government identity (Aadhaar UID / Voter ID / Passport)",
                  },
                ].map((docItem) => {
                  const uploadedDoc = appDocs[docItem.key];
                  const isUploaded = Boolean(uploadedDoc?.uploaded);
                  const isCurrentUploading = uploadingDoc === docItem.key;

                  return (
                    <div
                      key={docItem.key}
                      className="dossier-doc-card"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                        padding: "10px 14px",
                        background: isUploaded ? "rgba(23,107,98,0.03)" : "var(--paper)",
                        border: `1px solid ${isUploaded ? "rgba(23,107,98,0.3)" : "var(--border)"}`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <strong style={{ fontSize: 11.5, display: "block", color: isUploaded ? "var(--forest-dark)" : "var(--ink)" }}>
                          {docItem.title}
                        </strong>
                        <small style={{ color: "var(--muted-foreground)", fontSize: 10.5 }}>
                          {docItem.desc}
                        </small>
                        {isUploaded && (
                          <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--forest)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                              <Check size={12} /> {uploadedDoc.fileName}
                            </span>
                            {uploadedDoc.fileSize && (
                              <span style={{ color: "var(--muted-foreground)" }}>({uploadedDoc.fileSize})</span>
                            )}
                            {uploadedDoc.fileUrl && (
                              <button
                                type="button"
                                onClick={() => window.open(uploadedDoc.fileUrl, "_blank")}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--forest-dark)",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: 0,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                }}
                              >
                                <ExternalLink size={11} /> Open File
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isCurrentUploading ? (
                          <span style={{ fontSize: 11, color: "var(--forest)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Loader2 size={13} className="spin" /> Uploading to Supabase...
                          </span>
                        ) : (
                          <label
                            style={{
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 12px",
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: isUploaded ? "1px solid var(--forest)" : "1px solid var(--border)",
                              background: isUploaded ? "var(--teal-soft)" : "var(--paper)",
                              color: isUploaded ? "var(--forest)" : "var(--ink)",
                            }}
                          >
                            {isUploaded ? (
                              <>
                                <Check size={12} /> Replace File
                              </>
                            ) : (
                              <>
                                <UploadCloud size={12} /> Upload File
                              </>
                            )}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              style={{ display: "none" }}
                              onChange={(e) => handleAppDocUpload(docItem.key, e)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Audited by: <strong>State Registrar of Cooperative Societies (RCS)</strong> · SLA: 12 Hours
              </div>
              <Button type="submit" disabled={submitting} icon={<ShieldCheck size={16} />}>
                {submitting ? "Submitting Application…" : "Submit Application & Documents for Official Verification"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function AdminSocietyAuditGate({ society }: { society: DemoSociety }) {
  const { approveSociety } = useDemoStore();
  const deadline = society.reviewDeadline ?? (Date.now() + 12 * 3600 * 1000);
  const countdown = useCountdown(deadline);

  return (
    <div className="content-wrap">
      <div className="audit-gate-screen">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(200,148,57,.12)", color: "#7a5c1c", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <Clock3 size={28} />
          </div>
          <span className="sla-countdown-pill" style={{ marginBottom: 10 }}>
            <Clock3 size={12} /> Under Review · {countdown.formatted} left
          </span>
          <h2 style={{ fontSize: 22, margin: "8px 0 6px", color: "var(--ink)" }}>
            Verification Pending
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 520, margin: "0 auto" }}>
            Your society registration is under official review. Worker dispatches will unlock once approved.
          </p>
        </div>

        <div className="audit-gate-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <div>
              <strong style={{ fontSize: 13, color: "var(--forest-dark)" }}>{society.name}</strong>
              <small style={{ display: "block", color: "var(--ink-soft)" }}>Ref: {society.regNumber || "Pending Registration"}</small>
            </div>
            <span className="status status-pending">Under Review</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11, marginBottom: 14 }}>
            <div>
              <small style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>JURISDICTION</small>
              <strong>{society.district ? `${society.district}, ${society.state || ""}` : (society.state || "—")}</strong>
            </div>
            <div>
              <small style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>ADMINISTRATOR</small>
              <strong>{society.signatoryName || "Authorized Signatory"}</strong>
            </div>
            <div>
              <small style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>PAN / TAN</small>
              <strong style={{ fontFamily: "monospace" }}>{society.panNumber || "—"}</strong>
            </div>
            <div>
              <small style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>BANK ACCOUNT</small>
              <strong>{society.bankAccount || "—"}</strong>
            </div>
          </div>

          <div style={{ background: "var(--paper)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
              Submitted Documents
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span className="audit-doc-chip"><Check size={11} style={{ color: "var(--forest)" }} /> RCS Registration Certificate</span>
              <span className="audit-doc-chip"><Check size={11} style={{ color: "var(--forest)" }} /> Society By-laws</span>
              <span className="audit-doc-chip"><Check size={11} style={{ color: "var(--forest)" }} /> Committee Resolution</span>
              <span className="audit-doc-chip"><Check size={11} style={{ color: "var(--forest)" }} /> Bank Mandate</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
          <small style={{ color: "var(--muted-foreground)", fontSize: 10.5 }}>
            Reviewing Official: {society.auditedBy || "Office of the Registrar of Cooperative Societies"}
          </small>
          <button
            type="button"
            className="app-button forest"
            onClick={() => approveSociety(society.id)}
            style={{ fontSize: 11, padding: "6px 14px" }}
          >
            <ShieldCheck size={13} style={{ marginRight: 5 }} />
            Approve Society (Official Action)
          </button>
        </div>
      </div>
    </div>
  );
}

function SocietyAuditModal({
  society,
  close,
  onApprove,
  onReject,
}: {
  society: DemoSociety;
  close: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = society.status === "Pending";
  const [inspectingDoc, setInspectingDoc] = useState<{
    key: string;
    title: string;
    desc: string;
    fileName: string;
    fileSize: string;
    uploadedAt: string;
    ref: string;
    regNo: string;
    docType: string;
    legalBody: string;
    sealAuthority: string;
    details: string;
    fileUrl?: string;
    isUploaded?: boolean;
  } | null>(null);

  const [verifiedDocs, setVerifiedDocs] = useState<Record<string, boolean>>(() => ({
    rcsCertificate: true,
    byLaws: true,
    panCard: true,
    resolutionCopy: true,
    bankPassbook: true,
    signatoryIdProof: true,
  }));

  const verifiedCount = Object.values(verifiedDocs).filter(Boolean).length;

  const getAuditDocData = (key: string, fallbackFileName: string, fallbackSize: string, fallbackDate: string) => {
    const d = society.documents?.[key];
    if (d && typeof d === "object") {
      return {
        fileName: d.fileName || fallbackFileName,
        fileSize: d.fileSize || fallbackSize,
        uploadedAt: d.uploadedAt || fallbackDate,
        fileUrl: d.fileUrl || "",
        isUploaded: Boolean(d.uploaded || d.fileUrl || d.fileName),
      };
    }
    return {
      fileName: typeof d === "string" ? d : fallbackFileName,
      fileSize: fallbackSize,
      uploadedAt: fallbackDate,
      fileUrl: "",
      isUploaded: Boolean(d),
    };
  };

  const docDataRcs = getAuditDocData("rcsCertificate", "rcs_registration_certificate.pdf", "1.8 MB", "Uploaded");
  const docDataByLaws = getAuditDocData("byLaws", "certified_model_bylaws.pdf", "3.4 MB", "Uploaded");
  const docDataPan = getAuditDocData("panCard", "society_pan_card.pdf", "840 KB", "Uploaded");
  const docDataResolution = getAuditDocData("resolutionCopy", "general_body_resolution.pdf", "1.2 MB", "Uploaded");
  const docDataPassbook = getAuditDocData("bankPassbook", "escrow_bank_passbook.pdf", "950 KB", "Uploaded");
  const docDataIdProof = getAuditDocData("signatoryIdProof", "signatory_id_proof.pdf", "720 KB", "Uploaded");

  const auditDocs = [
    {
      key: "rcsCertificate",
      title: "RCS Registration Certificate (Form A)",
      desc: "Charter of incorporation under Haryana Cooperative Societies Act, 1984.",
      fileName: docDataRcs.fileName,
      fileSize: docDataRcs.fileSize,
      uploadedAt: docDataRcs.uploadedAt,
      fileUrl: docDataRcs.fileUrl,
      isUploaded: docDataRcs.isUploaded,
      ref: society.documentRefs?.rcsCertificateNo || (society.regNumber ? `HR-RCS-${society.regNumber}` : "Pending"),
      regNo: society.regNumber || "Pending Registration",
      docType: "Form A Charter of Incorporation",
      legalBody: "Government of Haryana · Department of Cooperation",
      sealAuthority: "Registrar of Cooperative Societies, Gurugram Circle",
      details: "Official Form A certifies that this cooperative society has been registered under Section 9 of the State Cooperative Societies Act, 1984, conferring corporate status with limited liability and perpetual succession for gig-worker service operations.",
    },
    {
      key: "byLaws",
      title: "Certified Model Bylaws & Memorandum",
      desc: "Adopted cooperative bylaws regulating democratic governance and dividend rules.",
      fileName: docDataByLaws.fileName,
      fileSize: docDataByLaws.fileSize,
      uploadedAt: docDataByLaws.uploadedAt,
      fileUrl: docDataByLaws.fileUrl,
      isUploaded: docDataByLaws.isUploaded,
      ref: society.documentRefs?.byLawsVersion || "Model By-laws (Adopted)",
      regNo: "BYLAW/HR/MODEL",
      docType: "Constitutional Governance Bylaws",
      legalBody: "Special General Body of Cooperative Members",
      sealAuthority: "Attested by Managing Committee & RCS Desk",
      details: "Certified Model Bylaws establishing 0% platform extraction, 10% auto-contribution to the Worker Emergency Welfare Reserve in the cooperative society bank account, minimum fair floor rate cards, and 5-minute dispatch rules.",
    },
    {
      key: "panCard",
      title: "Society Permanent Account Number (PAN)",
      desc: "Income Tax Department legal entity PAN card issued to the cooperative society.",
      fileName: docDataPan.fileName,
      fileSize: docDataPan.fileSize,
      uploadedAt: docDataPan.uploadedAt,
      fileUrl: docDataPan.fileUrl,
      isUploaded: docDataPan.isUploaded,
      ref: society.documentRefs?.panAckNo || (society.panNumber ? `PAN-${society.panNumber}` : "PAN-PENDING"),
      regNo: society.panNumber || "Pending Verification",
      docType: "Income Tax Department Legal PAN",
      legalBody: "Central Board of Direct Taxes · Government of India",
      sealAuthority: "Income Tax Assessing Authority",
      details: `Permanent Account Number ${society.panNumber || "—"} and TAN ${society.tanNumber || "—"} submitted for statutory cooperative operations and tax compliance.`,
    },
    {
      key: "resolutionCopy",
      title: "Governing Body Resolution & Signatories",
      desc: "Certified minute extract authorizing designated signatories to operate bank & digital escrow.",
      fileName: docDataResolution.fileName,
      fileSize: docDataResolution.fileSize,
      uploadedAt: docDataResolution.uploadedAt,
      fileUrl: docDataResolution.fileUrl,
      isUploaded: docDataResolution.isUploaded,
      ref: society.documentRefs?.resolutionNo || "RES-MEMBER-SEC",
      regNo: society.documentRefs?.resolutionNo || "RES-MEMBER-SEC",
      docType: "Managing Committee Resolution Extract",
      legalBody: "Executive Governing Body / Board of Directors",
      sealAuthority: "Attested by President & Managing Secretary",
      details: `Unanimous resolution passed by the Managing Committee authorizing ${society.signatoryName || "Authorized Signatory"} (${society.signatoryRole || "Managing Secretary"}) to manage cooperative operations.`,
    },
    {
      key: "bankPassbook",
      title: "Escrow Bank Mandate & Passbook",
      desc: "Cooperative apex or schedule bank account proof for member payouts & welfare reserve.",
      fileName: docDataPassbook.fileName,
      fileSize: docDataPassbook.fileSize,
      uploadedAt: docDataPassbook.uploadedAt,
      fileUrl: docDataPassbook.fileUrl,
      isUploaded: docDataPassbook.isUploaded,
      ref: society.documentRefs?.bankMandateRef || "MANDATE-COOP-01",
      regNo: society.bankAccount || "Pending",
      docType: "Cooperative Bank Passbook & NACH Mandate",
      legalBody: society.bankBranch || "Cooperative Apex Bank",
      sealAuthority: society.bankIfsc ? `IFSC: ${society.bankIfsc} · Branch Stamped` : "Branch Stamped",
      details: `Designated Cooperative Settlement Account ${society.bankAccount || "—"} at ${society.bankBranch || "Apex Bank"} (${society.bankIfsc ? `IFSC: ${society.bankIfsc}` : ""}). Dedicated to 90% direct worker payouts and 10% emergency welfare reserve accumulation.`,
    },
    {
      key: "signatoryIdProof",
      title: "Signatory Government Photo ID (Aadhaar / Voter ID / Passport)",
      desc: "Government-issued identity document of Managing Secretary.",
      fileName: docDataIdProof.fileName,
      fileSize: docDataIdProof.fileSize,
      uploadedAt: docDataIdProof.uploadedAt,
      fileUrl: docDataIdProof.fileUrl,
      isUploaded: docDataIdProof.isUploaded,
      ref: society.documentRefs?.signatoryGovIdRef || "OVD-ID-VERIFIED",
      regNo: society.signatoryGovId || "Gov ID Pending",
      docType: "Officially Valid Identity Document (OVD)",
      legalBody: "Unique Identification Authority of India (UIDAI)",
      sealAuthority: "e-KYC Verification Confirmed",
      details: `Government photo ID and residence proof verified for ${society.signatoryName || "Authorized Signatory"}, ${society.signatoryRole || "Managing Secretary"}.`,
    },
  ];

  const downloadDoc = (doc: typeof auditDocs[0]) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
      toast.success(`Opening original uploaded document: "${doc.fileName}"`);
      return;
    }
    const content = `========================================================================
GOVERNMENT REGISTRAR OF COOPERATIVE SOCIETIES
STATE REGULATORY DESK · OFFICIAL VERIFIED AUDIT RECORD
========================================================================

DOCUMENT: ${doc.title}
REFERENCE NO: ${doc.ref}
DOCUMENT TYPE: ${doc.docType}
LEGAL ISSUER: ${doc.legalBody}
CERTIFYING AUTHORITY: ${doc.sealAuthority}

SOCIETY NAME: ${society.name}
SOCIETY CODE: ${society.societyCode || society.id}
RCS REGISTRATION NO: ${society.regNumber || "Pending"}
JURISDICTION: ${society.district ? `${society.district}, ${society.state}` : (society.state || "—")}
REGISTERED ADDRESS: ${society.registeredAddress || "—"}

AUTHORIZED ADMINISTRATOR: ${society.signatoryName || "Authorized Signatory"} (${society.signatoryRole || "Managing Secretary"})
CONTACT: ${society.email || "—"} | ${society.signatoryPhone || "—"}
GOVT ID PROOF: ${society.signatoryGovId || "—"}

BANK ESCROW SETTLEMENT: ${society.bankBranch || "—"}
ACCOUNT NO: ${society.bankAccount || "—"} | IFSC: ${society.bankIfsc || "—"}
TAX IDENTITY: PAN ${society.panNumber || "—"} | TAN ${society.tanNumber || "—"}

AUDIT SUMMARY:
${doc.details}

FILE NAME: ${doc.fileName} (${doc.fileSize})
UPLOAD DATE: ${doc.uploadedAt}
VERIFICATION STATUS: VERIFIED & CONFIRMED BY STATE RCS OFFICIAL

========================================================================
CERTIFIED ELECTRONIC AUDIT DOSSIER · EXTRACTED FOR LEGAL STATUTORY RECORDS
========================================================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded original "${doc.fileName}"`);
  };

  const exportDossierJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      ...society,
      verifiedDocuments: auditDocs.map(d => ({
        ...d,
        verified: verifiedDocs[d.key] ?? false
      }))
    }, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `RCS_AUDIT_DOSSIER_${(society.societyCode || society.id).replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    dl.click();
    toast.success("Complete society audit dossier exported (JSON).");
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={close}>
      <div className="booking-modal member-dossier-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: "92vh", overflowY: "auto" }}>
        <button className="close-button" onClick={close}><X size={17} /></button>
        <p className="eyebrow"><span /> SOCIETY AUDIT DOSSIER</p>

        <div className="dossier-header" style={{ marginBottom: 16 }}>
          <Avatar initials={society.name.split(" ").map((x) => x[0]).join("").substring(0, 2).toUpperCase()} tone="forest" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{society.name}</h2>
              <Status value={society.status === "Approved" ? "Approved" : society.status} />
              {society.verificationBadge && (
                <span className="rcs-seal" style={{ fontSize: 10 }}>{society.verificationBadge}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: "var(--ink-soft)" }}>
              <span>Society ID: <b style={{ fontFamily: "monospace", color: "var(--forest)" }}>{society.societyCode || society.id}</b></span>
              <span>•</span>
              <span>RCS Reg: <b style={{ fontFamily: "monospace", color: "var(--forest-dark)" }}>{society.regNumber || "Pending Registration"}</b></span>
              <span>•</span>
              <span>Certificate: <b style={{ fontFamily: "monospace" }}>{society.documentRefs?.rcsCertificateNo || (society.regNumber ? `HR-RCS-${society.regNumber}` : "Pending")}</b></span>
            </div>
          </div>
        </div>

        {/* Section 1: Administrator Details */}
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} style={{ color: "var(--forest)" }} /> Administrator Details
            </strong>
            <span className="rcs-seal" style={{ fontSize: 10 }}>Authorized Admin</span>
          </div>

          <div className="dossier-grid" style={{ marginBottom: 4 }}>
            <div className="dossier-item">
              <small>Full Name</small>
              <strong style={{ color: "var(--forest-dark)" }}>{society.signatoryName || "Authorized Signatory"}</strong>
            </div>
            <div className="dossier-item">
              <small>Designation</small>
              <strong>{society.signatoryRole || "Managing Secretary"}</strong>
            </div>
            <div className="dossier-item">
              <small>Govt ID Proof</small>
              <strong style={{ color: "var(--forest)" }}>{society.signatoryGovId || "Gov ID Pending"}</strong>
            </div>
            <div className="dossier-item">
              <small>KYC Ref</small>
              <strong style={{ fontFamily: "monospace" }}>{society.documentRefs?.signatoryGovIdRef || "Pending"}</strong>
            </div>
            <div className="dossier-item">
              <small>Email</small>
              <strong style={{ fontFamily: "monospace", fontSize: 11 }}>{society.email || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>Phone</small>
              <strong>{society.signatoryPhone || "—"}</strong>
            </div>
          </div>
        </div>

        {/* Section 2: Government IDs & Banking */}
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
              <Building2 size={16} style={{ color: "var(--forest)" }} /> Government IDs &amp; Bank Details
            </strong>
            <span style={{ fontSize: 10, color: "var(--forest)", fontWeight: 700 }}>✓ Verified IDs</span>
          </div>

          <div className="dossier-grid" style={{ marginBottom: 4 }}>
            <div className="dossier-item">
              <small>PAN</small>
              <strong style={{ fontFamily: "monospace", color: "var(--forest-dark)" }}>{society.panNumber || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>TAN</small>
              <strong style={{ fontFamily: "monospace" }}>{society.tanNumber || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>Bank &amp; Branch</small>
              <strong>{society.bankBranch || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>IFSC Code</small>
              <strong style={{ fontFamily: "monospace" }}>{society.bankIfsc || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>Account Number</small>
              <strong>{society.bankAccount || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>Bank Mandate Ref</small>
              <strong style={{ fontFamily: "monospace" }}>{society.documentRefs?.bankMandateRef || "Pending"}</strong>
            </div>
            <div className="dossier-item" style={{ gridColumn: "1 / -1" }}>
              <small>Registered Address</small>
              <strong>{society.registeredAddress || "—"}</strong>
            </div>
            <div className="dossier-item">
              <small>Jurisdiction</small>
              <strong>{society.district ? `${society.district}, ${society.state}` : (society.state || "—")}</strong>
            </div>
            <div className="dossier-item">
              <small>RCS Office</small>
              <strong>{society.rcsOffice || "Office of Registrar of Cooperative Societies"}</strong>
            </div>
          </div>
        </div>

        {/* Section 3: Submitted Statutory Documents with Direct Viewer */}
        <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div>
              <strong style={{ fontSize: 12.5, color: "var(--forest-dark)", display: "block" }}>
                Mandatory Statutory Documents ({verifiedCount}/6 Verified)
              </strong>
              <small style={{ color: "var(--muted-foreground)", fontSize: 10.5 }}>
                Open original documents to inspect seals, signatures, and registrar filings.
              </small>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: verifiedCount === 6 ? "var(--forest)" : "#7a5c1c", background: "var(--paper)", padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border)" }}>
              {verifiedCount === 6 ? "✓ All 6 Verified" : `${6 - verifiedCount} Pending Review`}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {auditDocs.map((doc, idx) => {
              const isDocVerified = verifiedDocs[doc.key] ?? false;
              return (
                <div
                  key={doc.key}
                  className="dossier-doc-card"
                  style={{
                    background: "var(--paper)",
                    border: `1px solid ${isDocVerified ? "rgba(23,107,98,0.28)" : "var(--border)"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: isDocVerified ? "var(--teal-soft)" : "rgba(200,148,57,0.12)",
                        color: isDocVerified ? "var(--forest)" : "#7a5c1c",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={16} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 12, color: "var(--ink)" }}>{idx + 1}. {doc.title}</strong>
                        <span
                          style={{
                            fontSize: 9.5,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isDocVerified ? "rgba(23,107,98,0.1)" : "rgba(200,148,57,0.15)",
                            color: isDocVerified ? "var(--forest)" : "#7a5c1c",
                            fontWeight: 700,
                          }}
                        >
                          {isDocVerified ? "✓ Verified" : "Review Required"}
                        </span>
                      </div>
                      <small style={{ color: "var(--muted-foreground)", fontSize: 10.5, display: "block" }}>
                        File: <b style={{ color: "var(--ink-soft)" }}>{doc.fileName}</b> ({doc.fileSize}) · Ref: <span style={{ fontFamily: "monospace" }}>{doc.ref}</span>
                      </small>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      className="app-button secondary"
                      onClick={() => setInspectingDoc(doc)}
                      style={{ fontSize: 10.5, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      title="Open and view original document"
                    >
                      <Eye size={12} /> View Document
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedDocs((prev) => ({ ...prev, [doc.key]: !prev[doc.key] }));
                        toast.success(`Updated verification: ${doc.title}`);
                      }}
                      style={{
                        fontSize: 10.5,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        cursor: "pointer",
                        fontWeight: 600,
                        background: isDocVerified ? "var(--teal-soft)" : "var(--paper)",
                        borderColor: isDocVerified ? "var(--forest)" : "var(--border)",
                        color: isDocVerified ? "var(--forest)" : "var(--ink-soft)",
                      }}
                    >
                      {isDocVerified ? "✓ Verified" : "Mark Verified"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={close}>Close</Button>
            <Button variant="quiet" onClick={exportDossierJson} icon={<Download size={13} />}>Export JSON</Button>
          </div>
          {isPending && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="reject-button" onClick={onReject}>Reject Application</button>
              <Button onClick={onApprove} icon={<Check size={14} />}>Approve Society</Button>
            </div>
          )}
        </div>
      </div>

      {/* Individual Document Inspection & Verification Modal */}
      {inspectingDoc && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectingDoc(null)}
          style={{ zIndex: 1100 }}
        >
          <div
            className="booking-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, maxHeight: "92vh", overflowY: "auto", padding: 22 }}
          >
            <button
              type="button"
              className="close-button"
              onClick={() => setInspectingDoc(null)}
              aria-label="Close document viewer"
            >
              <X size={16} />
            </button>

            <p className="eyebrow"><span /> STATE REGISTRAR OF COOPERATIVES · DOCUMENT VIEWER</p>
            <h2 style={{ fontSize: 17, margin: "4px 0 2px" }}>{inspectingDoc.title}</h2>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>
              Ref: <span style={{ fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>{inspectingDoc.ref}</span> · {society.name}
            </div>

            {/* Authentic Stamped Government Certificate Presentation */}
            <div style={{ background: "#fdfbf7", border: "1px solid #dfd8c8", borderRadius: 10, padding: "20px 22px", marginBottom: 16, position: "relative", boxShadow: "inset 0 0 0 1px rgba(23,107,98,0.06)" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #dfd8c8", paddingBottom: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={20} style={{ color: "var(--forest)" }} />
                  <div>
                    <strong style={{ fontSize: 11.5, color: "var(--forest-dark)", display: "block", letterSpacing: "0.3px", textTransform: "uppercase" }}>
                      Office of the Registrar of Cooperative Societies
                    </strong>
                    <small style={{ color: "var(--ink-soft)", fontSize: 9.5 }}>Government of Haryana · Directorate of Cooperatives</small>
                  </div>
                </div>
                <span className="rcs-seal" style={{ fontSize: 10 }}>
                  ✓ Official Audit Copy
                </span>
              </div>

              {/* Document Identity Banner */}
              <div style={{ background: "rgba(23,107,98,0.06)", border: "1px dashed rgba(23,107,98,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <span style={{ fontSize: 9.5, color: "var(--muted-foreground)", textTransform: "uppercase", display: "block" }}>DOCUMENT CLASSIFICATION</span>
                    <strong style={{ fontSize: 12.5, color: "var(--ink)" }}>{inspectingDoc.docType}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 9.5, color: "var(--muted-foreground)", textTransform: "uppercase", display: "block" }}>RECORD REGISTRATION NO</span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--forest-dark)" }}>{inspectingDoc.regNo}</span>
                  </div>
                </div>
              </div>

              {/* Document Narrative / Legal Extract */}
              <div style={{ fontSize: 11.5, color: "var(--ink)", lineHeight: 1.6, background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                <strong style={{ fontSize: 11, color: "var(--forest)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Verified Filing Extract
                </strong>
                <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                  {inspectingDoc.details}
                </p>
              </div>

              {/* Two Column Metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11, marginBottom: 14 }}>
                <div style={{ background: "var(--ivory)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 9.5, display: "block" }}>LEGAL JURISDICTION</span>
                  <strong>{society.district ? `${society.district}, ${society.state}` : (society.state || "—")}</strong>
                </div>
                <div style={{ background: "var(--ivory)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 9.5, display: "block" }}>AUTHORIZED ADMINISTRATOR</span>
                  <strong>{society.signatoryName || "Authorized Administrator"} {society.signatoryRole ? `(${society.signatoryRole})` : ""}</strong>
                </div>
                <div style={{ background: "var(--ivory)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 9.5, display: "block" }}>BANK SETTLEMENT ESCROW</span>
                  <strong>{society.bankBranch?.split(",")[0] || "—"}</strong>
                </div>
                <div style={{ background: "var(--ivory)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 9.5, display: "block" }}>TAX ENTITY PAN</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--forest-dark)" }}>{society.panNumber || "—"}</span>
                </div>
              </div>

              {/* Digital Attestation Seal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #dfd8c8", paddingTop: 10, fontSize: 10, color: "var(--ink-soft)", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Lock size={13} style={{ color: "var(--forest)" }} />
                  <span>Digitally Signed by State Registrar Official Desk · SHA256 Certified</span>
                </div>
                <span style={{ fontFamily: "monospace", color: "var(--muted-foreground)" }}>Uploaded: {inspectingDoc.uploadedAt}</span>
              </div>
            </div>

            {/* Original File Metadata Strip */}
            <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <div>
                <span style={{ color: "var(--muted-foreground)" }}>Original File: </span>
                <strong style={{ color: "var(--ink)" }}>{inspectingDoc.fileName}</strong>
                <span style={{ color: "var(--muted-foreground)" }}> ({inspectingDoc.fileSize})</span>
              </div>
              <span style={{ fontSize: 10.5, color: verifiedDocs[inspectingDoc.key] ? "var(--forest)" : "#7a5c1c", fontWeight: 700 }}>
                {verifiedDocs[inspectingDoc.key] ? "✓ Document Verified" : "Pending Official Review"}
              </span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {inspectingDoc.fileUrl && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      window.open(inspectingDoc.fileUrl, "_blank");
                      toast.success(`Opening "${inspectingDoc.fileName}"`);
                    }}
                    icon={<ExternalLink size={13} />}
                  >
                    Open Original File
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => downloadDoc(inspectingDoc)}
                  icon={<Download size={13} />}
                >
                  Download Original File
                </Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  onClick={() => {
                    setVerifiedDocs((prev) => ({ ...prev, [inspectingDoc.key]: !prev[inspectingDoc.key] }));
                    toast.success(verifiedDocs[inspectingDoc.key] ? `Unmarked ${inspectingDoc.title}` : `Verified ${inspectingDoc.title}`);
                  }}
                  icon={<Check size={13} />}
                >
                  {verifiedDocs[inspectingDoc.key] ? "✓ Verified (Click to Unmark)" : "Mark Document as Verified"}
                </Button>
                <Button variant="quiet" onClick={() => setInspectingDoc(null)}>
                  Close Viewer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OfficialDashboard({ go }: { go: (screen: Screen) => void }) {
  const { societies, approveSociety, rejectSociety, issues } = useDemoStore();
  const [tab, setTab] = useState<"all" | "pending" | "approved">("pending");
  const [selectedAuditSociety, setSelectedAuditSociety] = useState<DemoSociety | null>(null);

  const pendingSocieties = societies.filter((s) => s.status === "Pending");
  const approvedSocieties = societies.filter((s) => s.status === "Approved");
  const openIssuesCount = issues.filter((i) => i.status === "Open").length;
  const list = tab === "pending" ? pendingSocieties : tab === "approved" ? approvedSocieties : societies;

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow="STATE REGISTRAR / OFFICIAL DESK"
        title="Society Verifications"
        description="Review registered societies, government IDs, and cooperative admin details."
        action={
          <span className="rcs-seal">
            <ShieldCheck size={14} /> Official Desk
          </span>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label="Pending Review"
          value={String(pendingSocieties.length).padStart(2, "0")}
          detail={pendingSocieties.length > 0 ? "Awaiting review" : "Queue clear"}
          tone={pendingSocieties.length > 0 ? "brass" : "forest"}
        />
        <Kpi
          label="Approved Societies"
          value={String(approvedSocieties.length).padStart(2, "0")}
          detail="Active licenses"
          tone="forest"
        />
        <Kpi
          label="Admins Verified"
          value={String(approvedSocieties.length).padStart(2, "0")}
          detail="Govt IDs confirmed"
          tone="blue"
        />
        <Kpi
          label="Open Arbitrations"
          value={String(openIssuesCount).padStart(2, "0")}
          detail={openIssuesCount > 0 ? "State oversight docket" : "Zero active disputes"}
          tone={openIssuesCount > 0 ? "urgent" : "sage"}
        />
      </div>

      <div className="admin-workspace-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`admin-workspace-tab ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
        >
          <Clock3 size={15} />
          <span>Pending Review</span>
          <b>{pendingSocieties.length}</b>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${tab === "approved" ? "active" : ""}`}
          onClick={() => setTab("approved")}
        >
          <ShieldCheck size={15} />
          <span>Approved</span>
          <b>{approvedSocieties.length}</b>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${tab === "all" ? "active" : ""}`}
          onClick={() => setTab("all")}
        >
          <Building2 size={15} />
          <span>All Societies</span>
          <b>{societies.length}</b>
        </button>
      </div>

      <div className="society-audit-grid">
        {list.length > 0 ? (
          list.map((soc) => {
            const isPending = soc.status === "Pending";
            return (
              <div key={soc.id} className={`audit-card ${isPending ? "pending" : "approved"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: "0 0 3px", fontSize: 14.5 }}>{soc.name}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="gov-id-tag">RCS: {soc.regNumber || "Pending Registration"}</span>
                      {soc.documentRefs?.rcsCertificateNo && (
                        <span className="gov-id-tag" style={{ color: "var(--ink-soft)" }}>Cert: {soc.documentRefs.rcsCertificateNo}</span>
                      )}
                    </div>
                  </div>
                  <span className={`status status-${isPending ? "pending" : soc.status === "Approved" ? "good" : "urgent"}`}>
                    {soc.status === "Approved" ? "Approved" : soc.status}
                  </span>
                </div>

                {/* Cooperative Admin & Statutory Details */}
                <div className="audit-card-meta-grid">
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--forest)", fontWeight: 700 }}>
                      {soc.signatoryRole || "Managing Secretary"}
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block", marginTop: 2 }}>
                      {soc.signatoryName || "Authorized Signatory"}
                    </strong>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {soc.email || "—"} {soc.signatoryPhone ? `• ${soc.signatoryPhone}` : ""}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--forest)", fontWeight: 600, marginTop: 2 }}>
                      {soc.signatoryGovId || "Gov ID Pending"}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10, lineHeight: 1.5 }}>
                    <div><b>PAN:</b> <span className="gov-id-tag">{soc.panNumber || "—"}</span></div>
                    <div><b>TAN:</b> <span className="gov-id-tag">{soc.tanNumber || "—"}</span></div>
                    <div style={{ marginTop: 2, color: "var(--ink-soft)" }}>{soc.bankBranch || "—"}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>A/c: {soc.bankAccount || "—"}</div>
                  </div>
                </div>

                {isPending && (
                  <div style={{ marginBottom: 12 }}>
                    <span className="sla-countdown-pill">
                      <Clock3 size={12} /> {soc.reviewDeadline ? `${Math.max(1, Math.round((soc.reviewDeadline - Date.now()) / 3600000))}h left` : "Under 12h review"}
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                  <span className="audit-doc-chip">✓ Reg Certificate</span>
                  <span className="audit-doc-chip">✓ By-Laws</span>
                  <span className="audit-doc-chip">✓ Admin OVD</span>
                  <span className="audit-doc-chip">✓ PAN/TAN</span>
                  <span className="audit-doc-chip">✓ Resolution</span>
                  <span className="audit-doc-chip">✓ Bank Mandate</span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedAuditSociety(soc)}
                    icon={<FileCheck size={13} />}
                  >
                    Inspect Documents &amp; Audit
                  </Button>
                  {isPending && (
                    <Button
                      onClick={() => approveSociety(soc.id)}
                      icon={<Check size={13} />}
                    >
                      Approve
                    </Button>
                  )}
                  {isPending && (
                    <button
                      className="reject-button"
                      onClick={() => rejectSociety(soc.id)}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <ShieldCheck size={26} style={{ color: "var(--forest)", margin: "0 auto 8px" }} />
            <strong>No societies under this filter</strong>
            <p>All submissions are processed.</p>
          </div>
        )}
      </div>

      {selectedAuditSociety && (
        <SocietyAuditModal
          society={selectedAuditSociety}
          close={() => setSelectedAuditSociety(null)}
          onApprove={() => {
            approveSociety(selectedAuditSociety.id);
            setSelectedAuditSociety(null);
          }}
          onReject={() => {
            rejectSociety(selectedAuditSociety.id);
            setSelectedAuditSociety(null);
          }}
        />
      )}
    </div>
  );
}

function OfficialSocietiesRegistry({ go }: { go: (screen: Screen) => void }) {
  const { societies, approveSociety, rejectSociety } = useDemoStore();
  const [selectedAuditSociety, setSelectedAuditSociety] = useState<DemoSociety | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [query, setQuery] = useState("");

  const pendingCount = societies.filter((s) => s.status === "Pending").length;
  const approvedCount = societies.filter((s) => s.status === "Approved").length;

  const filtered = useMemo(() => {
    return societies.filter((s) => {
      const matchFilter = filter === "all" || (filter === "approved" && s.status === "Approved") || (filter === "pending" && s.status === "Pending");
      const q = query.toLowerCase().trim();
      const matchQuery = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.societyCode && s.societyCode.toLowerCase().includes(q)) ||
        (s.regNumber && s.regNumber.toLowerCase().includes(q)) ||
        (s.panNumber && s.panNumber.toLowerCase().includes(q)) ||
        (s.tanNumber && s.tanNumber.toLowerCase().includes(q)) ||
        (s.signatoryName && s.signatoryName.toLowerCase().includes(q)) ||
        (s.signatoryGovId && s.signatoryGovId.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.district && s.district.toLowerCase().includes(q));
      return matchFilter && matchQuery;
    });
  }, [societies, filter, query]);

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow="STATE REGISTRAR / REGISTRY"
        title="Registered Societies &amp; Govt IDs"
        description="Directory of registered societies, government tax IDs, banking details, and administrators."
        action={
          <span className="rcs-seal">
            <ShieldCheck size={14} /> Official Registry
          </span>
        }
      />

      <div className="kpi-grid">
        <Kpi
          label="Total Societies"
          value={String(societies.length).padStart(2, "0")}
          detail="Registered entities"
          tone="forest"
        />
        <Kpi
          label="Admins Verified"
          value={String(societies.length).padStart(2, "0")}
          detail="Govt IDs confirmed"
          tone="blue"
        />
        <Kpi
          label="Pending Review"
          value={String(pendingCount).padStart(2, "0")}
          detail={pendingCount > 0 ? "Needs review" : "None"}
          tone={pendingCount > 0 ? "brass" : "forest"}
        />
        <Kpi
          label="Approved"
          value={String(approvedCount).padStart(2, "0")}
          detail="Active licenses"
          tone="sage"
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="admin-workspace-tabs" style={{ margin: 0 }}>
          <button
            type="button"
            className={`admin-workspace-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            <span>All Societies</span>
            <b>{societies.length}</b>
          </button>
          <button
            type="button"
            className={`admin-workspace-tab ${filter === "approved" ? "active" : ""}`}
            onClick={() => setFilter("approved")}
          >
            <span>Approved</span>
            <b>{approvedCount}</b>
          </button>
          <button
            type="button"
            className={`admin-workspace-tab ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            <span>Pending</span>
            <b>{pendingCount}</b>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 400 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by society, ID, admin, PAN, TAN, or reg no..."
              style={{ width: "100%", paddingLeft: 30, fontSize: 12, height: 36 }}
            />
          </div>
        </div>
      </div>

      <div className="society-audit-grid">
        {filtered.length > 0 ? (
          filtered.map((soc) => {
            const isPending = soc.status === "Pending";
            return (
              <div key={soc.id} className={`audit-card ${isPending ? "pending" : "approved"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: "0 0 3px", fontSize: 14.5 }}>{soc.name}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="gov-id-tag" style={{ background: "rgba(23,107,98,.1)", color: "var(--forest-dark)" }}>ID: {soc.societyCode || soc.id}</span>
                      <span className="gov-id-tag">RCS: {soc.regNumber || "Pending Registration"}</span>
                      {soc.documentRefs?.rcsCertificateNo && (
                        <span className="gov-id-tag" style={{ color: "var(--ink-soft)" }}>Cert: {soc.documentRefs.rcsCertificateNo}</span>
                      )}
                    </div>
                  </div>
                  <span className={`status status-${isPending ? "pending" : soc.status === "Approved" ? "good" : "urgent"}`}>
                    {soc.status === "Approved" ? "Approved" : soc.status}
                  </span>
                </div>

                {/* Cooperative Admin & Statutory Details */}
                <div className="audit-card-meta-grid">
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--forest)", fontWeight: 700 }}>
                      {soc.signatoryRole || "Managing Secretary"}
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block", marginTop: 2 }}>
                      {soc.signatoryName || "Authorized Signatory"}
                    </strong>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {soc.email || "—"} {soc.signatoryPhone ? `• ${soc.signatoryPhone}` : ""}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--forest)", fontWeight: 600, marginTop: 2 }}>
                      {soc.signatoryGovId || "Gov ID Pending"}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10, lineHeight: 1.5 }}>
                    <div><b>PAN:</b> <span className="gov-id-tag">{soc.panNumber || "—"}</span></div>
                    <div><b>TAN:</b> <span className="gov-id-tag">{soc.tanNumber || "—"}</span></div>
                    <div style={{ marginTop: 2, color: "var(--ink-soft)" }}>{soc.bankBranch || "—"}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>A/c: {soc.bankAccount || "—"}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedAuditSociety(soc)}
                    icon={<FileCheck size={13} />}
                  >
                    Inspect Documents &amp; Audit
                  </Button>
                  {isPending && (
                    <Button
                      onClick={() => approveSociety(soc.id)}
                      icon={<Check size={13} />}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <Building2 size={26} style={{ color: "var(--forest)", margin: "0 auto 8px" }} />
            <strong>No cooperative societies found</strong>
            <p>Try refining your search terms or filter.</p>
          </div>
        )}
      </div>

      {selectedAuditSociety && (
        <SocietyAuditModal
          society={selectedAuditSociety}
          close={() => setSelectedAuditSociety(null)}
          onApprove={() => {
            approveSociety(selectedAuditSociety.id);
            setSelectedAuditSociety(null);
          }}
          onReject={() => {
            rejectSociety(selectedAuditSociety.id);
            setSelectedAuditSociety(null);
          }}
        />
      )}
    </div>
  );
}

function AdminSocietyProfileSection({
  embedded,
  go,
}: {
  embedded?: boolean;
  go?: (screen: Screen) => void;
}) {
  const { societies, adminSocietyName, updateSociety, bookings, claims } = useDemoStore();
  const currentSociety = societies.find((s) => s.name.toLowerCase() === (adminSocietyName || "").toLowerCase()) || societies[0] || {
    id: "",
    societyCode: "",
    name: adminSocietyName || "",
    email: "",
    status: "Pending",
    regNumber: "",
    state: "",
    district: "",
    rcsOffice: "",
    panNumber: "",
    tanNumber: "",
    signatoryName: "",
    signatoryRole: "Managing Secretary",
    signatoryGovId: "",
    signatoryPhone: "",
    registeredAddress: "",
    incorporationDate: "",
    bankAccount: "",
    bankIfsc: "",
    bankBranch: "",
    verificationBadge: "Pending RCS Charter",
    documents: {},
    documentRefs: {},
  };

  // Form states for editable society legal details
  const [legalName, setLegalName] = useState(currentSociety.name || "");
  const [regNumber, setRegNumber] = useState(currentSociety.regNumber || "");
  const [state, setState] = useState(currentSociety.state || "");
  const [district, setDistrict] = useState(currentSociety.district || "");
  const [rcsOffice, setRcsOffice] = useState(currentSociety.rcsOffice || "");
  const [registeredAddress, setRegisteredAddress] = useState(currentSociety.registeredAddress || "");
  const [incorporationDate, setIncorporationDate] = useState(currentSociety.incorporationDate || "");

  // Signatory & Governance states
  const [signatoryName, setSignatoryName] = useState(currentSociety.signatoryName || "");
  const [signatoryRole, setSignatoryRole] = useState(currentSociety.signatoryRole || "Managing Secretary");
  const [signatoryPhone, setSignatoryPhone] = useState(currentSociety.signatoryPhone || "");
  const [email, setEmail] = useState(currentSociety.email || "");
  const [signatoryGovId, setSignatoryGovId] = useState(currentSociety.signatoryGovId || "");

  // Taxation & Banking states
  const [panNumber, setPanNumber] = useState(currentSociety.panNumber || "");
  const [tanNumber, setTanNumber] = useState(currentSociety.tanNumber || "");
  const [bankBranch, setBankBranch] = useState(currentSociety.bankBranch || "");
  const [bankAccount, setBankAccount] = useState(currentSociety.bankAccount || "");
  const [bankIfsc, setBankIfsc] = useState(currentSociety.bankIfsc || "");

  // Document file tracking state for the 6 mandatory statutory verification uploads
  const getSocietyDoc = (key: string, defaultRef: string = "") => {
    const d = currentSociety.documents?.[key];
    if (d && typeof d === "object") {
      return {
        uploaded: Boolean(d.uploaded || d.fileUrl || d.fileName),
        fileName: d.fileName || "",
        fileSize: d.fileSize || "",
        uploadedAt: d.uploadedAt || "",
        ref: d.ref || currentSociety.documentRefs?.[key] || defaultRef,
        fileUrl: d.fileUrl || "",
      };
    }
    return {
      uploaded: Boolean(d),
      fileName: typeof d === "string" ? d : "",
      fileSize: "",
      uploadedAt: "",
      ref: currentSociety.documentRefs?.[key] || defaultRef,
      fileUrl: "",
    };
  };

  const [docsState, setDocsState] = useState<{
    [key: string]: {
      uploaded: boolean;
      fileName: string;
      fileSize: string;
      uploadedAt: string;
      ref: string;
      fileUrl?: string;
    };
  }>(() => ({
    rcsCertificate: getSocietyDoc("rcsCertificate", currentSociety.documentRefs?.rcsCertificateNo || (currentSociety.regNumber ? `HR-RCS-${currentSociety.regNumber}` : "")),
    byLaws: getSocietyDoc("byLaws", currentSociety.documentRefs?.byLawsVersion || ""),
    panCard: getSocietyDoc("panCard", currentSociety.documentRefs?.panAckNo || (currentSociety.panNumber ? `PAN-${currentSociety.panNumber}` : "")),
    resolutionCopy: getSocietyDoc("resolutionCopy", currentSociety.documentRefs?.resolutionNo || ""),
    bankPassbook: getSocietyDoc("bankPassbook", currentSociety.documentRefs?.bankMandateRef || ""),
    signatoryIdProof: getSocietyDoc("signatoryIdProof", currentSociety.documentRefs?.signatoryGovIdRef || ""),
  }));

  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    key: string;
    title: string;
    fileName: string;
    fileSize: string;
    uploadedAt: string;
    ref: string;
    fileUrl?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Dynamic calculations for welfare & dispatches
  const totalVolumeNumber = bookings.reduce(
    (acc, b) => acc + (parseInt(String(b.fee || b.amount || 0).replace(/[^\d]/g, "")) || 0),
    0
  );
  const disbursedAid = claims
    .filter((c) => c.status === "Approved")
    .reduce((sum, c) => sum + (parseInt(c.amount?.replace(/[^\d]/g, "") || "0") || 0), 0);
  const welfareReserveBalance = Math.max(0, Math.floor(totalVolumeNumber * 0.05) - disbursedAid);

  // 6 mandatory document definitions
  const docDefinitions = [
    {
      key: "rcsCertificate",
      title: "RCS Registration Certificate (Form A)",
      desc: "Charter of Incorporation issued under the State Cooperative Societies Act.",
    },
    {
      key: "byLaws",
      title: "Certified Model Bylaws & Memorandum",
      desc: "Adopted cooperative bylaws regulating democratic governance and dividend rules.",
    },
    {
      key: "panCard",
      title: "Society Permanent Account Number (PAN)",
      desc: "Income Tax Department legal entity PAN card issued to the cooperative society.",
    },
    {
      key: "resolutionCopy",
      title: "Governing Body Resolution & Signatories",
      desc: "Certified minute extract authorizing designated signatories to operate bank & digital escrow.",
    },
    {
      key: "bankPassbook",
      title: "Escrow Bank Mandate / Cancelled Cheque",
      desc: "Cooperative apex or schedule bank account proof for member payouts & welfare reserve.",
    },
    {
      key: "signatoryIdProof",
      title: "Signatory Government Photo ID Proof",
      desc: "Government-issued identity document (Aadhaar / Voter ID / Passport) of Managing Secretary.",
    },
  ];

  const handleFileUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocKey(docKey);
    try {
      const uploaded = await uploadSocietyDocument(currentSociety.id, docKey, file);
      const nextDocs = {
        ...docsState,
        [docKey]: uploaded,
      };
      setDocsState(nextDocs);

      const nextRefs = {
        rcsCertificateNo: nextDocs.rcsCertificate?.ref || "",
        panAckNo: nextDocs.panCard?.ref || "",
        resolutionNo: nextDocs.resolutionCopy?.ref || "",
        bankMandateRef: nextDocs.bankPassbook?.ref || "",
        byLawsVersion: nextDocs.byLaws?.ref || "",
        signatoryGovIdRef: nextDocs.signatoryIdProof?.ref || "",
      };

      await updateSociety(currentSociety.id, {
        documents: nextDocs,
        documentRefs: nextRefs,
      });

      toast.success(`Uploaded and synced "${file.name}" to database successfully.`);
    } catch (err: any) {
      toast.error(`Upload error: ${err.message || "Failed to upload file"}`);
    } finally {
      setUploadingDocKey(null);
    }
  };

  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!legalName.trim()) {
      toast.error("Society legal name cannot be empty.");
      return;
    }
    setIsSaving(true);
    try {
      await updateSociety(currentSociety.id, {
        name: legalName.trim(),
        regNumber: regNumber.trim(),
        state: state.trim(),
        district: district.trim(),
        rcsOffice: rcsOffice.trim(),
        registeredAddress: registeredAddress.trim(),
        incorporationDate: incorporationDate.trim(),
        signatoryName: signatoryName.trim(),
        signatoryRole: signatoryRole.trim(),
        signatoryPhone: signatoryPhone.trim(),
        email: email.trim(),
        signatoryGovId: signatoryGovId.trim(),
        panNumber: panNumber.trim(),
        tanNumber: tanNumber.trim(),
        bankBranch: bankBranch.trim(),
        bankAccount: bankAccount.trim(),
        bankIfsc: bankIfsc.trim(),
        documents: docsState,
        documentRefs: {
          rcsCertificateNo: docsState.rcsCertificate?.ref || "",
          panAckNo: docsState.panCard?.ref || "",
          resolutionNo: docsState.resolutionCopy?.ref || "",
          bankMandateRef: docsState.bankPassbook?.ref || "",
          byLawsVersion: docsState.byLaws?.ref || "",
          signatoryGovIdRef: docsState.signatoryIdProof?.ref || "",
        },
      });
      toast.success("Society statutory profile and documents updated in database.");
    } catch (err: any) {
      toast.error(`Failed to save details: ${err.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const uploadedCount = Object.values(docsState).filter((d) => d.uploaded).length;

  return (
    <div className={embedded ? "" : "content-wrap"}>
      {!embedded && (
        <PageTitle
          eyebrow={`ADMIN / ${(adminSocietyName || "COOPERATIVE SOCIETY").toUpperCase()}`}
          title="Society Profile & Verification Dossier"
          description="Manage statutory charter, government documentation, authorized signatories, and RCS compliance."
          action={
            <div style={{ display: "flex", gap: 8 }}>
              {go && (
                <Button variant="secondary" onClick={() => go("overview")} icon={<ArrowLeft size={14} />}>
                  Back to Desk
                </Button>
              )}
              <Button onClick={handleSaveDetails} icon={<Check size={14} />} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Details"}
              </Button>
            </div>
          }
        />
      )}

      {/* Society Summary & Statutory Seal Hero */}
      <div className="society-profile-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--forest)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span className="rcs-seal" style={{ fontSize: 11 }}>
                <ShieldCheck size={13} /> {currentSociety.status === "Approved" ? "RCS Charter Approved · Active" : "Under Registrar Review"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)" }}>
                Code: <span style={{ fontFamily: "monospace", background: "var(--ivory)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)" }}>{currentSociety.societyCode || currentSociety.id}</span>
              </span>
            </div>
            <h2 style={{ fontSize: 18, margin: 0, color: "var(--forest-dark)" }}>
              {legalName || currentSociety.name}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--ink-soft)" }}>
              Reg No: <b style={{ fontFamily: "monospace", color: "var(--ink)" }}>{regNumber}</b> · Jurisdiction: <b>{district}, {state}</b>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="app-button secondary"
            onClick={() => {
              navigator.clipboard?.writeText(currentSociety.societyCode || currentSociety.id);
              toast.success(`Copied Society ID: ${currentSociety.societyCode || currentSociety.id}`);
            }}
            style={{ fontSize: 11, padding: "6px 12px" }}
          >
            <Copy size={12} style={{ marginRight: 5 }} />
            Copy Society ID
          </button>
          <button
            type="button"
            className="app-button primary"
            onClick={handleSaveDetails}
            style={{ fontSize: 11, padding: "6px 14px" }}
            disabled={isSaving}
          >
            <Check size={12} style={{ marginRight: 5 }} />
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* 4 Quick Verification Glance Badges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase" }}>Primary Signatory</small>
          <strong style={{ fontSize: 12, color: "var(--ink)" }}>{signatoryName}</strong>
          <span style={{ display: "block", fontSize: 10.5, color: "var(--forest)" }}>{signatoryRole}</span>
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase" }}>PAN / TAN Status</small>
          <strong style={{ fontSize: 12, fontFamily: "monospace", color: "var(--ink)" }}>{panNumber}</strong>
          <span style={{ display: "block", fontSize: 10.5, color: "var(--forest)" }}>Verified Tax Entity</span>
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase" }}>Welfare Reserve Fund</small>
          <strong style={{ fontSize: 14, color: "var(--forest-dark)" }}>₹{welfareReserveBalance.toLocaleString("en-IN")}</strong>
          <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)" }}>100% Escrow Allocated</span>
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)", fontWeight: 700, textTransform: "uppercase" }}>Statutory Documents</small>
          <strong style={{ fontSize: 12, color: uploadedCount === 6 ? "var(--forest)" : "#7a5c1c" }}>
            {uploadedCount} of 6 Documents On File
          </strong>
          <span style={{ display: "block", fontSize: 10.5, color: uploadedCount === 6 ? "var(--forest)" : "#7a5c1c" }}>
            {uploadedCount === 6 ? "✓ Full Dossier Compliant" : "Uploads Pending"}
          </span>
        </div>
      </div>

      {/* Main Grid: Legal Information & Signatories */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Card 1: Society Legal Entity Details */}
        <div className="panel" style={{ padding: 20, margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <Building2 size={16} style={{ color: "var(--forest)" }} />
            <h3 style={{ fontSize: 13, margin: 0, color: "var(--forest-dark)" }}>Legal Entity &amp; Registration</h3>
          </div>
          <div style={{ display: "grid", gap: 12, fontSize: 11.5 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Registered Legal Society Name
              </label>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Registration Number
                </label>
                <input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace", border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Date of Incorporation
                </label>
                <input
                  value={incorporationDate}
                  onChange={(e) => setIncorporationDate(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  District
                </label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  State
                </label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Regulatory Jurisdiction / RCS Office
              </label>
              <input
                value={rcsOffice}
                onChange={(e) => setRcsOffice(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Registered Office Address
              </label>
              <textarea
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)", resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Governance & Key Signatories */}
        <div className="panel" style={{ padding: 20, margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <Users size={16} style={{ color: "var(--forest)" }} />
            <h3 style={{ fontSize: 13, margin: 0, color: "var(--forest-dark)" }}>Governance &amp; Signatories</h3>
          </div>
          <div style={{ display: "grid", gap: 12, fontSize: 11.5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Managing Signatory Name
                </label>
                <input
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Designation / Role
                </label>
                <input
                  value={signatoryRole}
                  onChange={(e) => setSignatoryRole(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Signatory Mobile
                </label>
                <input
                  value={signatoryPhone}
                  onChange={(e) => setSignatoryPhone(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Official Society Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Signatory Government ID Reference
              </label>
              <input
                value={signatoryGovId}
                onChange={(e) => setSignatoryGovId(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
              />
            </div>

            <div style={{ background: "rgba(23,107,98,0.06)", border: "1px solid rgba(23,107,98,0.18)", borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <ShieldCheck size={13} style={{ color: "var(--forest)" }} />
                <strong style={{ fontSize: 11, color: "var(--forest-dark)" }}>Democratic Cooperative Governance</strong>
              </div>
              <small style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.4, display: "block" }}>
                Under cooperative law, one member holds one vote regardless of share capital. All bylaws amendments are subject to General Body approval.
              </small>
            </div>
          </div>
        </div>

        {/* Card 3: Taxation & Escrow Settlement Banking */}
        <div className="panel" style={{ padding: 20, margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <Coins size={16} style={{ color: "var(--forest)" }} />
            <h3 style={{ fontSize: 13, margin: 0, color: "var(--forest-dark)" }}>Taxation &amp; Escrow Banking</h3>
          </div>
          <div style={{ display: "grid", gap: 12, fontSize: 11.5 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Society PAN
                </label>
                <input
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace", border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Society TAN
                </label>
                <input
                  value={tanNumber}
                  onChange={(e) => setTanNumber(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace", border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                Designated Cooperative / Escrow Bank
              </label>
              <input
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Settlement Account Number
                </label>
                <input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace", border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  Bank IFSC Code
                </label>
                <input
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace", border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Welfare Reserve Balance & Fund Solvency */}
        <div className="panel" style={{ padding: 20, margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
            <ShieldCheck size={16} style={{ color: "var(--forest)" }} />
            <h3 style={{ fontSize: 13, margin: 0, color: "var(--forest-dark)" }}>Cooperative Welfare Fund Solvency</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11.5 }}>
            <div style={{ background: "var(--teal-soft)", border: "1px solid rgba(23,107,98,0.18)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: 12, color: "var(--forest-dark)", display: "block" }}>
                  Mutual Aid Reserve Balance
                </strong>
                <small style={{ color: "var(--forest)", fontSize: 10.5 }}>
                  Statutory reserve for worker health, emergency aid &amp; tool replacement.
                </small>
              </div>
              <strong style={{ fontSize: 22, color: "var(--forest-dark)" }}>
                ₹{welfareReserveBalance.toLocaleString("en-IN")}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--ink-soft)" }}>Total Services Dispatched Volume</span>
              <strong style={{ color: "var(--forest)" }}>₹{totalVolumeNumber.toLocaleString("en-IN")}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--ink-soft)" }}>Total Aid Disbursed This Cycle</span>
              <strong style={{ color: "var(--brass)" }}>₹{disbursedAid.toLocaleString("en-IN")}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--ink-soft)" }}>Escrow Allocation Rate</span>
              <strong style={{ color: "var(--forest)" }}>5.0% Statutory Surplus</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Card 5: Statutory Document Dossier & Verification Uploads */}
      <div className="panel" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileCheck size={18} style={{ color: "var(--forest)" }} />
              <h2 style={{ fontSize: 15, margin: 0, color: "var(--forest-dark)" }}>
                Statutory Verification Dossier
              </h2>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              Mandatory government filings and charter documents required under the State Cooperative Societies Act.
            </p>
          </div>
          <span className="rcs-seal" style={{ fontSize: 10.5 }}>
            <ShieldCheck size={12} /> State RCS Mandated (6 Documents)
          </span>
        </div>

        {/* 6 Mandatory Documents Grid */}
        <div className="society-docs-grid">
          {docDefinitions.map((doc) => {
            const item = docsState[doc.key] || {
              uploaded: false,
              fileName: "No file selected",
              fileSize: "-",
              uploadedAt: "-",
              ref: "",
            };

            return (
              <div
                key={doc.key}
                className={`society-doc-card ${item.uploaded ? "uploaded" : ""}`}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: item.uploaded ? "var(--teal-soft)" : "rgba(200,148,57,0.12)", color: item.uploaded ? "var(--forest)" : "#7a5c1c", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <FileText size={17} />
                    </div>
                    {item.uploaded ? (
                      <span className="society-doc-badge uploaded">
                        <CheckCircle2 size={12} /> Verified &amp; On File
                      </span>
                    ) : (
                      <span className="society-doc-badge missing">
                        <AlertTriangle size={12} /> Upload Required
                      </span>
                    )}
                  </div>

                  <strong style={{ fontSize: 12.5, color: "var(--forest-dark)", display: "block", marginBottom: 4 }}>
                    {doc.title}
                  </strong>
                  <p style={{ fontSize: 10.5, color: "var(--ink-soft)", margin: "0 0 10px", lineHeight: 1.4 }}>
                    {doc.desc}
                  </p>

                  <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", marginBottom: 12, fontSize: 10.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ color: "var(--muted-foreground)" }}>File:</span>
                      <strong style={{ color: "var(--ink)", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.fileName}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ color: "var(--muted-foreground)" }}>Size:</span>
                      <span>{item.fileSize}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted-foreground)" }}>Ref #:</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10 }}>{item.ref || "PENDING"}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: Upload input + View Document */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {uploadingDocKey === doc.key ? (
                    <span style={{ fontSize: 11, color: "var(--forest)", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 0" }}>
                      <Loader2 size={13} className="spin" /> Uploading to Supabase...
                    </span>
                  ) : (
                    <label
                      style={{
                        flex: 1,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--paper)",
                        color: "var(--ink)",
                      }}
                    >
                      <Upload size={12} />
                      {item.uploaded ? "Replace File" : "Upload File"}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(doc.key, e)}
                      />
                    </label>
                  )}

                  {item.uploaded && (
                    <button
                      type="button"
                      className="app-button secondary"
                      onClick={() => setPreviewDoc({
                        key: doc.key,
                        title: doc.title,
                        fileName: item.fileName,
                        fileSize: item.fileSize,
                        uploadedAt: item.uploadedAt,
                        ref: item.ref,
                        fileUrl: item.fileUrl,
                      })}
                      style={{ fontSize: 11, padding: "6px 10px" }}
                      title="View document verification"
                    >
                      <Eye size={12} style={{ marginRight: 4 }} />
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dossier Bottom Action Bar */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} style={{ color: "var(--forest)" }} />
            <small style={{ color: "var(--ink-soft)", fontSize: 11 }}>
              All documents are cryptographically fingerprinted and accessible by State Registrar officials.
            </small>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              onClick={() => {
                toast.success("Statutory dossier summary exported for RCS audit records.");
              }}
              icon={<Download size={13} />}
            >
              Export Dossier PDF
            </Button>
            <Button
              onClick={handleSaveDetails}
              icon={<Check size={13} />}
              disabled={isSaving}
            >
              {isSaving ? "Saving Changes..." : "Save Society Details"}
            </Button>
          </div>
        </div>
      </div>

      {/* Document View Preview Modal */}
      {previewDoc && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewDoc.title}`}
          onClick={() => setPreviewDoc(null)}
        >
          <div className="booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <button
              type="button"
              className="close-button"
              onClick={() => setPreviewDoc(null)}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
            <p className="eyebrow"><span /> STATUTORY VERIFICATION DOSSIER</p>
            <h2 style={{ fontSize: 17, margin: "6px 0 2px" }}>{previewDoc.title}</h2>
            <p className="modal-intro" style={{ margin: "0 0 16px" }}>
              Official statutory document filed under Haryana / State Cooperative Societies Act.
            </p>

            <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span className="rcs-seal" style={{ fontSize: 10.5 }}>
                  <ShieldCheck size={13} /> Stamped &amp; Validated
                </span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>
                  REF: {previewDoc.ref}
                </span>
              </div>

              <div style={{ background: "var(--paper)", border: "1px dashed var(--border)", borderRadius: 8, padding: "20px 16px", textAlign: "center", marginBottom: 12 }}>
                <FileCheck size={36} style={{ color: "var(--forest)", margin: "0 auto 8px", display: "block" }} />
                <strong style={{ fontSize: 13, display: "block", color: "var(--forest-dark)" }}>{previewDoc.fileName}</strong>
                <small style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                  {previewDoc.fileSize} · Uploaded {previewDoc.uploadedAt}
                </small>
                <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(23,107,98,0.08)", padding: "4px 10px", borderRadius: 6, fontSize: 10.5, color: "var(--forest)" }}>
                  <Lock size={12} /> Digitally Signed by Authorized Signatory
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9.5 }}>ISSUING REGISTRAR</span>
                  <strong>{currentSociety.rcsOffice || "Registrar of Cooperative Societies"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9.5 }}>LEGAL JURISDICTION</span>
                  <strong>{currentSociety.district || "Gurugram"}, {currentSociety.state || "Haryana"}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
              {previewDoc.fileUrl && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    window.open(previewDoc.fileUrl, "_blank");
                    toast.success(`Opening "${previewDoc.fileName}"`);
                  }}
                  icon={<ExternalLink size={14} />}
                >
                  Open Original File
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  if (previewDoc.fileUrl) {
                    window.open(previewDoc.fileUrl, "_blank");
                  } else {
                    toast.success(`Exporting "${previewDoc.fileName}" for offline legal records.`);
                  }
                }}
                icon={<Download size={14} />}
              >
                Download File
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminOverview({
  go,
  bookingItems,
  approvedWorkerNames,
  rejectedWorkerNames,
  openBooking,
  onReview,
}: {
  go: (screen: Screen) => void;
  bookingItems: DemoBooking[];
  approvedWorkerNames: string[];
  rejectedWorkerNames: string[];
  openBooking?: (booking: DemoBooking) => void;
  onReview?: (worker: any) => void;
}) { 
  const { adminSocietyName, newPendingWorkers: newWorkers, claims, updateClaim, approveWorker, rejectWorker, issues, verifiedWorkers, supabaseReady, workerEarningsPrivacy, customers, societies } = useDemoStore();
  const { profile } = useAuth();
  const [adminTab, setAdminTab] = useState<"dispatches" | "verification" | "welfare" | "analytics" | "members" | "governance" | "society">("dispatches");
  const [dossierTarget, setDossierTarget] = useState<{ member: any; type: "worker" | "customer" } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "workers" | "customers">("all");
  const effectiveSocietyName = profile?.societyName || adminSocietyName || "";
  const currentSociety = societies.find((s) => (profile?.societyId && s.id === profile.societyId) || (effectiveSocietyName && s.name.toLowerCase() === effectiveSocietyName.toLowerCase())) || societies[0];

  if (!currentSociety) {
    return (
      <div className="content-wrap" style={{ padding: "60px 20px", textAlign: "center" }}>
        <ShieldCheck size={36} style={{ color: "var(--forest)", opacity: 0.5, margin: "0 auto 12px" }} />
        <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>Cooperative Society Desk</h3>
        <p style={{ color: "var(--muted-foreground)", fontSize: 12, margin: 0 }}>
          Your cooperative account is initialized. Loading society statutory registration details...
        </p>
      </div>
    );
  }

  if (currentSociety && currentSociety.status === "Draft") {
    return <AdminSocietyApplicationFlow society={currentSociety} />;
  }

  if (currentSociety && currentSociety.status === "Pending") {
    return <AdminSocietyAuditGate society={currentSociety} />;
  }

  const allVerifiedWorkers = useMemo(() => {
    return verifiedWorkers;
  }, [verifiedWorkers]);
  const [dispatchFilter, setDispatchFilter] = useState<"all" | "active" | "emergency" | "unpaid">("all");
  const [noticeText, setNoticeText] = useState("0% middleman fees. 90% paid to worker, 10% auto-saved in cooperative bank for emergencies.");
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [draftNotice, setDraftNotice] = useState(noticeText);
  
  // Real pending registrations in the pipeline
  const openVerification = newWorkers.filter((worker) => !approvedWorkerNames.includes(worker.name) && !rejectedWorkerNames.includes(worker.name)); 
  
  const activeCount = bookingItems.filter((booking) => booking.status !== "Completed" && booking.status !== "Cancelled").length; 
  const completedCount = bookingItems.filter((booking) => booking.status === "Completed").length; 
  const emergencyCount = bookingItems.filter((booking) => booking.emergency && booking.status !== "Completed" && booking.status !== "Cancelled").length;
  const unpaidCount = bookingItems.filter((booking) => booking.status === "Completed" && booking.paymentStatus !== "Paid").length;
  const openIssuesCount = issues.filter((i) => i.status === "Open").length;
  const verifiedCount = verifiedWorkers.length;
  
  // Dynamic financial totals
  const totalVolumeNumber = bookingItems.reduce(
    (acc, b) => acc + (parseInt(String(b.fee || b.amount || 0).replace(/[^\d]/g, "")) || 0),
    0
  );
  const totalVolumeFormatted = totalVolumeNumber > 0 ? `₹${totalVolumeNumber.toLocaleString("en-IN")}` : "₹0";

  const totalEmergencyDeducted = Math.round(totalVolumeNumber * (EMERGENCY_RESERVE_PERCENT / 100));
  const disbursedAid = claims
    .filter((c) => c.status === "Approved")
    .reduce((sum, c) => sum + (parseInt(c.amount?.replace(/[^\d]/g, "") || "0") || 0), 0);
  const welfarePoolBalance = Math.max(0, totalEmergencyDeducted - disbursedAid);
  const welfarePoolFormatted = `₹${welfarePoolBalance.toLocaleString("en-IN")}`;

  // Dynamic sparklines
  const volumeData = bookingItems.length > 0
    ? bookingItems.map((b) => parseInt(String(b.fee || b.amount || 0).replace(/[^\d]/g, "")) || 350)
    : undefined;
  const dispatchesData = bookingItems.length > 0
    ? [Math.max(1, activeCount), Math.max(1, completedCount), bookingItems.length]
    : undefined;
  const servicesData = completedCount > 0
    ? [Math.floor(completedCount / 2), completedCount]
    : undefined;

  // Filtered dispatches list
  const filteredDispatches = useMemo(() => {
    if (dispatchFilter === "active") return bookingItems.filter((b) => b.status !== "Completed" && b.status !== "Cancelled");
    if (dispatchFilter === "emergency") return bookingItems.filter((b) => b.emergency);
    if (dispatchFilter === "unpaid") return bookingItems.filter((b) => b.status === "Completed" && b.paymentStatus !== "Paid");
    return bookingItems;
  }, [bookingItems, dispatchFilter]);

  // Real category performance computed from actual dispatches
  const categoryStats = useMemo(() => {
    const counts: Record<string, { count: number; volume: number }> = {};
    bookingItems.forEach((b) => {
      const cat = b.service || "General Services";
      const amount = parseInt(String(b.fee || b.amount || 0).replace(/[^\d]/g, "")) || 0;
      if (!counts[cat]) counts[cat] = { count: 0, volume: 0 };
      counts[cat].count += 1;
      counts[cat].volume += amount;
    });
    const totalVol = Math.max(1, totalVolumeNumber);
    return Object.entries(counts).map(([cat, stat]) => ({
      name: cat,
      count: stat.count,
      volume: stat.volume,
      pct: Math.round((stat.volume / totalVol) * 100),
    })).sort((a, b) => b.volume - a.volume);
  }, [bookingItems, totalVolumeNumber]);

  const handleSaveNotice = () => {
    setNoticeText(draftNotice);
    setIsEditingNotice(false);
    toast.success("Notice updated.");
  };

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow={`ADMIN / ${(adminSocietyName || "COOPERATIVE SOCIETY").toUpperCase()}`}
        title="Operations Desk"
        description="Monitor dispatches, worker verifications, and welfare funds."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => exportBookingsCsv(bookingItems)} icon={<Download size={14} />}>
              Export CSV
            </Button>
            <Button onClick={() => go("verify")} icon={<ShieldCheck size={14} />}>
              Verify Workers ({openVerification.length})
            </Button>
          </div>
        }
      />

      {/* Consolidated Executive Header Strip: Society ID & Operational Notice */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ShieldCheck size={18} style={{ color: "var(--forest)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)" }}>
            Society ID: <span style={{ fontFamily: "monospace", fontSize: 12.5, background: "var(--ivory)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--forest-dark)" }}>{currentSociety.societyCode || currentSociety.id}</span>
          </span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              navigator.clipboard?.writeText(currentSociety.societyCode || currentSociety.id);
              toast.success(`Copied Society ID: ${currentSociety.societyCode || currentSociety.id}`);
            }}
            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end", minWidth: 260 }}>
          {isEditingNotice ? (
            <div style={{ display: "flex", gap: 6, width: "100%", maxWidth: 450 }}>
              <input
                value={draftNotice}
                onChange={(e) => setDraftNotice(e.target.value)}
                style={{ flex: 1, padding: "4px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 6, background: "var(--ivory)" }}
              />
              <Button onClick={handleSaveNotice} icon={<Check size={12} />}>Save</Button>
              <Button variant="secondary" onClick={() => setIsEditingNotice(false)}>Cancel</Button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                <b>Notice:</b> {noticeText}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => { setDraftNotice(noticeText); setIsEditingNotice(true); }}
                style={{ fontSize: 11 }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 6 Executive Cooperative KPIs */}
      <div className="kpi-grid">
        <Kpi
          label="Total Volume"
          value={totalVolumeFormatted}
          detail="90% net · 10% emergency reserve"
          tone="forest"
          chartData={volumeData}
        />
        <Kpi
          label="Active Dispatches"
          value={String(activeCount).padStart(2, "0")}
          detail={`${emergencyCount} emergency`}
          tone="brass"
          chartData={dispatchesData}
        />
        <Kpi
          label="Completed Jobs"
          value={String(completedCount).padStart(2, "0")}
          detail="All-time verified"
          tone="sage"
          chartData={servicesData}
        />
        <Kpi
          label="Pending Workers"
          value={String(openVerification.length).padStart(2, "0")}
          detail={openVerification.length > 0 ? "Needs review" : "Queue clear"}
          tone={openVerification.length > 0 ? "brass" : "forest"}
        />
        <Kpi
          label="Emergency Reserve"
          value={welfarePoolFormatted}
          detail={`₹${totalEmergencyDeducted.toLocaleString("en-IN")} saved (10% cut)`}
          tone="blue"
        />
        <Kpi
          label="Open Issues"
          value={String(openIssuesCount).padStart(2, "0")}
          detail={openIssuesCount > 0 ? "Needs review" : "All resolved"}
          tone={openIssuesCount > 0 ? "urgent" : "sage"}
        />
      </div>

      {/* Admin Workspace Tabs */}
      <div className="admin-workspace-tabs">
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "dispatches" ? "active" : ""}`}
          onClick={() => setAdminTab("dispatches")}
        >
          <ClipboardList size={15} />
          <span>Dispatches</span>
          <b>{bookingItems.length}</b>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "verification" ? "active" : ""}`}
          onClick={() => setAdminTab("verification")}
        >
          <ShieldCheck size={15} />
          <span>Verify Workers</span>
          {openVerification.length > 0 && <b>{openVerification.length}</b>}
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "welfare" ? "active" : ""}`}
          onClick={() => setAdminTab("welfare")}
        >
          <Coins size={15} />
          <span>Welfare &amp; Aid</span>
          <b>{claims.length}</b>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "analytics" ? "active" : ""}`}
          onClick={() => setAdminTab("analytics")}
        >
          <BarChart3 size={15} />
          <span>Analytics</span>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "members" ? "active" : ""}`}
          onClick={() => setAdminTab("members")}
        >
          <Users size={15} />
          <span>Members</span>
          <b>{allVerifiedWorkers.length + customers.length}</b>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "governance" ? "active" : ""}`}
          onClick={() => setAdminTab("governance")}
        >
          <Shield size={15} />
          <span>Cooperative Charter</span>
        </button>
        <button
          type="button"
          className={`admin-workspace-tab ${adminTab === "society" ? "active" : ""}`}
          onClick={() => setAdminTab("society")}
        >
          <Building2 size={15} />
          <span>Society Profile &amp; Docs</span>
        </button>
      </div>

      {/* Tab 1: Live Dispatches & Bookings (Admin oversees, does not book) */}
      {adminTab === "dispatches" && (
        <section className="panel table-panel">
          <div className="table-header">
            <div>
              <h2>Service Dispatches</h2>
              <small>Live bookings monitor</small>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`app-button ${dispatchFilter === "all" ? "primary" : "secondary"}`}
                style={{ padding: "5px 11px", fontSize: 10 }}
                onClick={() => setDispatchFilter("all")}
              >
                All ({bookingItems.length})
              </button>
              <button
                type="button"
                className={`app-button ${dispatchFilter === "active" ? "primary" : "secondary"}`}
                style={{ padding: "5px 11px", fontSize: 10 }}
                onClick={() => setDispatchFilter("active")}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                className={`app-button ${dispatchFilter === "emergency" ? "primary" : "secondary"}`}
                style={{ padding: "5px 11px", fontSize: 10 }}
                onClick={() => setDispatchFilter("emergency")}
              >
                Emergency ({emergencyCount})
              </button>
              <button
                type="button"
                className={`app-button ${dispatchFilter === "unpaid" ? "primary" : "secondary"}`}
                style={{ padding: "5px 11px", fontSize: 10 }}
                onClick={() => setDispatchFilter("unpaid")}
              >
                Unpaid ({unpaidCount})
              </button>
            </div>
          </div>

          <div className="booking-list">
            {filteredDispatches.length > 0 ? (
              filteredDispatches.map((booking) => (
                <div
                  key={booking.id}
                  className="booking-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => openBooking ? openBooking(booking) : go("adminBookings")}
                >
                  <div className="booking-id">
                    <span>{booking.id.startsWith("BK-") ? booking.id : `BK-${booking.id.slice(0, 8).toUpperCase()}`}</span>
                    <small>{booking.date}</small>
                  </div>

                  <div className="booking-person">
                    <Avatar initials={booking.worker.split(" ").map((x) => x[0]).join("")} tone="forest" />
                    <div>
                      <strong>{booking.worker}</strong>
                      <small>{booking.service} · {booking.customerName || "Customer"}</small>
                    </div>
                  </div>

                  <div className="booking-price">
                    <strong>{booking.amount}</strong>
                    <small style={{ color: booking.paymentStatus === "Paid" ? "var(--forest)" : "#7a5c1c" }}>
                      {booking.paymentStatus === "Paid" ? `✓ Paid (₹${calculateEarningsSplit(booking.amount).emergencyCut} saved)` : "Pending"}
                    </small>
                  </div>

                  <div>
                    <Status value={booking.status} />
                    {booking.emergency && (
                      <span className="emergency-label">
                        <Zap size={11} /> Emergency
                      </span>
                    )}
                    {booking.cancelFeeApplied && (
                      <span className="emergency-label" style={{ background: "rgba(186,75,59,.12)", color: "var(--danger)", marginLeft: 6 }}>
                        ₹50 Fee
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openBooking) openBooking(booking);
                        else go("adminBookings");
                      }}
                      icon={<ChevronRight size={13} />}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <ClipboardList size={22} />
                <strong>No dispatches found</strong>
                <p>No dispatches match the selected filter.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Worker Verification Queue */}
      {adminTab === "verification" && (
        <section className="panel verification-panel">
          <div className="table-header">
            <div>
              <h2>Pending Workers ({openVerification.length})</h2>
              <small>Review applications before approving into network</small>
            </div>
            <button className="link-button" onClick={() => go("members")}>
              View verified members ({verifiedCount}) →
            </button>
          </div>

          {openVerification.length > 0 ? (
            openVerification.map((worker) => (
              <div className="verification-row" key={worker.name}>
                <Avatar initials={worker.initials} tone="brass" />
                <div className="verification-person">
                  <strong>{worker.name}</strong>
                  <small>{worker.service} · {worker.experience || `${worker.years} yrs`} · {worker.area}</small>
                </div>
                <span className="submitted">Submitted {worker.submitted || "Recently"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      approveWorker(worker.name);
                      toast.success(`${worker.name} approved!`);
                    }}
                    icon={<Check size={14} />}
                  >
                    Approve
                  </Button>
                  <button
                    className="reject-button"
                    onClick={() => {
                      rejectWorker(worker.name);
                      toast.error(`${worker.name}'s submission rejected.`);
                    }}
                  >
                    Reject
                  </button>
                  {onReview && (
                    <button
                      className="icon-button"
                      onClick={() => onReview(worker)}
                      aria-label={`Review ${worker.name}`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Check size={26} style={{ color: "var(--forest)", margin: "0 auto 8px" }} />
              <strong>Queue is clear</strong>
              <p>All worker applications have been reviewed.</p>
              <div style={{ marginTop: 14 }}>
                <Button variant="secondary" onClick={() => go("members")} icon={<Users size={14} />}>
                  View Member Directory
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Welfare & Mutual Aid Pool */}
      {adminTab === "welfare" && (
        <section className="panel table-panel">
          <div className="table-header">
            <div>
              <h2>Worker Emergency Bank Fund</h2>
              <small>Reserve: {welfarePoolFormatted} · 10% auto-saved from every job in society bank</small>
            </div>
            <span style={{ fontSize: 10, color: "var(--forest)", background: "rgba(23,107,98,.1)", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
              Solvency: 100%
            </span>
          </div>

          <div style={{ padding: "14px 20px", background: "var(--ivory)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>Cooperative Society Bank Reserve</strong>
              <small style={{ color: "var(--muted-foreground)" }}>10% emergency cut deposited into society bank to aid workers in crisis, injury, or tool repairs.</small>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 9.5, color: "var(--muted-foreground)", display: "block" }}>DISBURSED THIS MONTH</span>
              <strong style={{ fontSize: 16, color: "var(--forest)" }}>₹{disbursedAid.toLocaleString("en-IN")}.00</strong>
            </div>
          </div>

          <div className="booking-list">
            {claims.length > 0 ? (
              claims.map((claim) => (
                <div key={claim.id} className="booking-row" style={{ gridTemplateColumns: "1fr 1fr .8fr auto auto" }}>
                  <div>
                    <strong style={{ fontSize: 12 }}>{claim.workerName}</strong>
                    <small style={{ color: "var(--muted-foreground)" }}>Claim #{claim.id}</small>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{claim.type} Assistance</span>
                    <small style={{ color: "var(--muted-foreground)", display: "block" }}>Filed: {claim.date}</small>
                  </div>
                  <div>
                    <strong style={{ fontSize: 13 }}>{claim.amount || "₹2,500"}</strong>
                    <small style={{ color: "var(--muted-foreground)", display: "block" }}>Mutual Aid Pool</small>
                  </div>
                  <div>
                    <Status value={claim.status === "Approved" ? "Verified" : claim.status === "Rejected" ? "Rejected" : "Pending verification"} />
                  </div>
                  <div>
                    {claim.status !== "Approved" && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          updateClaim(claim.id, "Approved", claim.amount);
                          toast.success(`Claim #${claim.id} approved!`);
                        }}
                        icon={<Check size={13} />}
                      >
                        Authorize Payout
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Coins size={22} />
                <strong>No active claims</strong>
                <p>New assistance requests will appear here.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 4: Cooperative Governance & 0% Middleman Policy */}
      {adminTab === "governance" && (
        <section className="panel" style={{ padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Cooperative Charter</h2>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
              Co-Labour operates on a 0% commission cooperative model.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div style={{ background: "var(--ivory)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={18} style={{ color: "var(--forest)" }} />
                <strong style={{ fontSize: 12 }}>0% Middleman Fee</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                90% net earnings to worker. 10% saved in Cooperative Society Bank for emergencies.
              </p>
            </div>

            <div style={{ background: "var(--ivory)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Coins size={18} style={{ color: "var(--brass)" }} />
                <strong style={{ fontSize: 12 }}>₹300 Fair Floor</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                Fixed rate cards protect workers. No commission cuts or unfair surge algorithms.
              </p>
            </div>

            <div style={{ background: "var(--ivory)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Clock3 size={18} style={{ color: "var(--forest)" }} />
                <strong style={{ fontSize: 12 }}>5-Minute Free Window</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                Free cancellation within 5 minutes. Afterwards, a ₹50 travel fee applies.
              </p>
            </div>

            <div style={{ background: "var(--ivory)", padding: 16, borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Zap size={18} style={{ color: "#7a5c1c" }} />
                <strong style={{ fontSize: 12 }}>5-Minute Auto-Cancel</strong>
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                If worker does not respond within 5 minutes, booking is automatically cancelled.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--sage-soft)", padding: "14px 18px", borderRadius: 10, border: "1px solid rgba(23,107,98,.18)" }}>
            <div>
              <strong style={{ fontSize: 12.5, color: "var(--forest-dark)", display: "block" }}>Export Audit Ledger</strong>
              <small style={{ color: "var(--ink-soft)" }}>Download CSV of historical dispatches and transactions.</small>
            </div>
            <Button onClick={() => exportBookingsCsv(bookingItems)} icon={<Download size={14} />}>
              Download CSV
            </Button>
          </div>
        </section>
      )}

      {/* Tab 5: Detailed Analysis & Intelligence */}
      {adminTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Society Legal Verification Card */}
          <div className="society-verification-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <span className="rcs-seal">
                  <ShieldCheck size={14} /> Registered Society · Active
                </span>
                <h3 style={{ margin: "6px 0 2px", fontSize: 16, color: "var(--forest-dark)" }}>
                  {currentSociety?.name || adminSocietyName || "Cooperative Society Desk"}
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: "var(--ink-soft)" }}>
                  Reg No: <b style={{ fontFamily: "monospace", color: "var(--ink)" }}>{currentSociety?.regNumber || "Pending"}</b> · Jurisdiction: <b>{currentSociety?.district ? `${currentSociety.district}, ${currentSociety.state}` : (currentSociety?.state || "State RCS")}</b>
                </p>
              </div>
              <div style={{ textAlign: "right", fontSize: 11 }}>
                <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9.5 }}>STATUS</span>
                <span className="status status-good" style={{ fontWeight: 700 }}>Active</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, background: "var(--ivory)", padding: "12px 14px", borderRadius: 8, fontSize: 11, border: "1px solid var(--border)" }}>
              <div>
                <small style={{ display: "block", fontSize: 9, color: "var(--muted-foreground)" }}>ADMINISTRATOR</small>
                <strong>{currentSociety?.signatoryName || "Authorized Administrator"}</strong>
                <span style={{ display: "block", fontSize: 10, color: "var(--ink-soft)" }}>{currentSociety?.signatoryRole || "Managing Secretary"}</span>
              </div>
              <div>
                <small style={{ display: "block", fontSize: 9, color: "var(--muted-foreground)" }}>PAN / TAN</small>
                <strong style={{ fontFamily: "monospace" }}>{currentSociety?.panNumber || "—"}</strong>
                <span style={{ display: "block", fontSize: 10, color: currentSociety?.panNumber ? "var(--forest)" : "var(--muted-foreground)" }}>{currentSociety?.panNumber ? "Verified" : "Pending"}</span>
              </div>
              <div>
                <small style={{ display: "block", fontSize: 9, color: "var(--muted-foreground)" }}>BANK ACCOUNT</small>
                <strong>{currentSociety?.bankAccount || "—"}</strong>
                <span style={{ display: "block", fontSize: 10, color: "var(--ink-soft)" }}>{currentSociety?.bankIfsc ? `IFSC: ${currentSociety.bankIfsc}` : "Apex Escrow"}</span>
              </div>
              <div>
                <small style={{ display: "block", fontSize: 9, color: "var(--muted-foreground)" }}>AUDIT STATUS</small>
                <strong style={{ color: "var(--forest)" }}>{currentSociety?.status === "Approved" ? "100% Verified" : "Verification in Progress"}</strong>
                <span style={{ display: "block", fontSize: 10, color: "var(--muted-foreground)" }}>Zero Intermediaries</span>
              </div>
            </div>
          </div>

          {/* Analytics Cards Grid */}
          <div className="admin-analytics-grid">
            {/* Category Demand Distribution */}
            <div className="analytics-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: "var(--forest-dark)" }}>
                  <PieChart size={16} style={{ color: "var(--forest)" }} /> Service Category Volume
                </strong>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Real-Time Dispatches</span>
              </div>

              {categoryStats.length === 0 ? (
                <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 12 }}>
                  No service dispatches recorded yet in current cycle.
                </div>
              ) : (
                <div>
                  {categoryStats.map((item, idx) => {
                    const colors = ["var(--forest)", "var(--teal)", "var(--brass)", "#5a6b5c", "#8b5cf6"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={item.name} style={{ marginBottom: 10 }}>
                        <div className="category-metric-row">
                          <span>{item.name} ({item.count} job{item.count === 1 ? "" : "s"})</span>
                          <strong>{item.pct}% (₹{item.volume.toLocaleString("en-IN")})</strong>
                        </div>
                        <div className="category-progress-track">
                          <div className="category-progress-fill" style={{ width: `${Math.max(4, item.pct)}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Operational Velocity & Performance */}
            <div className="analytics-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: "var(--forest-dark)" }}>
                  <BarChart3 size={16} style={{ color: "var(--forest)" }} /> Operational Velocity
                </strong>
                <span className="status status-good" style={{ fontSize: 9.5 }}>Optimal</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 11.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Average Response Time</span>
                  <strong style={{ color: "var(--forest)" }}>2m 14s (Limit: 3m)</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Average Arrival Time</span>
                  <strong>14.8 mins</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Emergency Dispatch Response</span>
                  <strong style={{ color: "var(--forest)" }}>99.2% on-time</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Worker Savings vs 25% Middleman</span>
                  <strong style={{ color: "var(--forest)", fontSize: 13 }}>₹{Math.round(totalVolumeNumber * 0.25).toLocaleString("en-IN")} Saved</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Member Directory & Deep Profile Dossiers */}
      {adminTab === "members" && (
        <section className="panel table-panel">
          <div className="table-header">
            <div>
              <h2>Member Directory</h2>
              <small>View worker and customer profiles</small>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div className="search-field" style={{ margin: 0, maxWidth: 220 }}>
                <Search size={14} />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search member name or area…"
                />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className={`app-button ${memberFilter === "all" ? "primary" : "secondary"}`}
                  style={{ padding: "4px 9px", fontSize: 10 }}
                  onClick={() => setMemberFilter("all")}
                >
                  All ({allVerifiedWorkers.length + customers.length})
                </button>
                <button
                  type="button"
                  className={`app-button ${memberFilter === "workers" ? "primary" : "secondary"}`}
                  style={{ padding: "4px 9px", fontSize: 10 }}
                  onClick={() => setMemberFilter("workers")}
                >
                  Workers ({allVerifiedWorkers.length})
                </button>
                <button
                  type="button"
                  className={`app-button ${memberFilter === "customers" ? "primary" : "secondary"}`}
                  style={{ padding: "4px 9px", fontSize: 10 }}
                  onClick={() => setMemberFilter("customers")}
                >
                  Customers ({customers.length})
                </button>
              </div>
            </div>
          </div>

          <div className="booking-list">
            {/* Workers */}
            {(memberFilter === "all" || memberFilter === "workers") &&
              allVerifiedWorkers
                .filter((w) => `${w.name} ${w.service} ${w.area}`.toLowerCase().includes(memberSearch.toLowerCase()))
                .map((worker) => {
                  const isPrivacyActive = !!workerEarningsPrivacy[worker.name];
                  return (
                    <div key={worker.id} className="booking-row" style={{ cursor: "default" }}>
                      <div className="booking-person" style={{ flex: 1.2 }}>
                        <Avatar initials={worker.initials} tone={worker.accent as any} />
                        <div>
                          <strong>{worker.name}</strong>
                          <small>{worker.service} · {worker.area} · Verified Member</small>
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        {isPrivacyActive ? (
                          <span className="privacy-lock-notice">
                            <Lock size={12} /> Earnings Hidden by Member
                          </span>
                        ) : (
                          <div className="booking-price">
                            <strong>{worker.rate}</strong>
                            <small>registered tariff</small>
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 90 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>★ {worker.rating}</span>
                        <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)" }}>{worker.jobs || 12} jobs</small>
                      </div>

                      <Button
                        variant="secondary"
                        onClick={() => setDossierTarget({ member: worker, type: "worker" })}
                        icon={<ChevronRight size={13} />}
                      >
                        View Full Dossier
                      </Button>
                    </div>
                  );
                })}

            {/* Customers */}
            {(memberFilter === "all" || memberFilter === "customers") &&
              customers
                .filter((c) => `${c.name} ${c.area} ${c.email}`.toLowerCase().includes(memberSearch.toLowerCase()))
                .map((cust) => (
                  <div key={cust.id} className="booking-row" style={{ cursor: "default" }}>
                    <div className="booking-person" style={{ flex: 1.2 }}>
                      <Avatar initials={cust.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()} tone="blue" />
                      <div>
                        <strong>{cust.name}</strong>
                        <small>Household Member · {cust.area}</small>
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <Status value={cust.standing} />
                      <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)", marginTop: 2 }}>{cust.preferredPayment}</small>
                    </div>

                    <div style={{ minWidth: 90 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{cust.completedBookings} bookings</span>
                      <small style={{ display: "block", fontSize: 9.5, color: "var(--muted-foreground)" }}>0 disputes</small>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => setDossierTarget({ member: cust, type: "customer" })}
                      icon={<ChevronRight size={13} />}
                    >
                      View Full Dossier
                    </Button>
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Tab 7: Cooperative Society Profile & Verification Dossier */}
      {adminTab === "society" && (
        <AdminSocietyProfileSection embedded go={go} />
      )}

      {/* Modal Dossier Inspector */}
      {dossierTarget && (
        <MemberDossierModal
          member={dossierTarget.member}
          type={dossierTarget.type}
          close={() => setDossierTarget(null)}
        />
      )}
    </div>
  );
}

function VerifyWorkers({ go, onReview }: { go: (screen: Screen) => void; onReview: (worker: typeof pendingWorkers[number] | DemoWorkerRegistration) => void }) {
  const { approvedWorkerNames, rejectedWorkerNames, approveWorker, rejectWorker, newPendingWorkers } = useDemoStore(); 
  const allPendingWorkers = useMemo(() => {
    return newPendingWorkers;
  }, [newPendingWorkers]);
  const openWorkers = allPendingWorkers.filter((worker) => !approvedWorkerNames.includes(worker.name) && !rejectedWorkerNames.includes(worker.name));
  return (
    <div className="content-wrap">
      <PageTitle eyebrow="COOPERATIVE DESK / TRUST" title="Make trust visible." description="Review worker profiles before they enter the customer network." action={<Button variant="secondary" onClick={() => go("overview")} icon={<ArrowRight size={15} />}>Back to overview</Button>} />
      <div className="verification-callout">
        <ShieldCheck size={20} />
        <div><strong>Verification is the core trust mechanic.</strong><p>Approve only after reviewing identity, service category, experience, and locality.</p></div>
        <span>{openWorkers.length} pending</span>
      </div>
      <section className="panel verification-panel">
        <div className="table-header">
          <div><h2>Pending workers</h2><small>Oldest submissions first</small></div>
          <div className="table-tools"><button className="filter-button"><Filter size={14} /> Filter</button><button className="icon-button"><MoreHorizontal size={17} /></button></div>
        </div>
        {allPendingWorkers.length === 0 ? (
          <div className="empty-state" style={{ padding: "48px 24px" }}>
            <Check size={26} style={{ color: "var(--forest)", margin: "0 auto 8px" }} />
            <strong>Verification queue is clear</strong>
            <p>New worker registrations under your cooperative will appear here for approval.</p>
          </div>
        ) : (
          allPendingWorkers.map((worker) => approvedWorkerNames.includes(worker.name) ? (
            <div className="verified-row" key={worker.name}><Check size={18} /><strong>{worker.name} approved</strong><Status value="Verified" /></div>
          ) : rejectedWorkerNames.includes(worker.name) ? (
            <div className="verified-row rejected-row" key={worker.name}><X size={18} /><strong>{worker.name} rejected</strong><Status value="Rejected" /></div>
          ) : (
            <div className="verification-row" key={worker.name}>
              <Avatar initials={worker.initials} tone="brass" />
              <div className="verification-person"><strong>{worker.name}</strong><small>{worker.service} · {worker.experience} · {worker.area}</small></div>
              <span className="submitted">Submitted {worker.submitted}</span>
              <Button variant="secondary" onClick={() => approveWorker(worker.name)}>Approve</Button>
              <button className="reject-button" onClick={() => rejectWorker(worker.name)}>Reject</button>
              <button className="icon-button" onClick={() => onReview(worker)} aria-label={`Review ${worker.name}`}><ChevronRight size={16} /></button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function AdminWorkerReview({ worker, close }: { worker: typeof pendingWorkers[number] | DemoWorkerRegistration; close: () => void }) { 
  const { approvedWorkerNames, rejectedWorkerNames, approveWorker, rejectWorker, claims, addClaim, adminSocietyName } = useDemoStore(); 
  const [claimType, setClaimType] = useState<"Accident" | "Health" | "Maternity" | "Other">("Health");
  const [claimAmount, setClaimAmount] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const status = approvedWorkerNames.includes(worker.name) ? "Verified" : rejectedWorkerNames.includes(worker.name) ? "Rejected" : "Pending verification"; 
  const workerClaims = claims.filter(c => c.workerName === worker.name);
  
  const handleAddClaim = () => {
    addClaim({
      id: `CLM-${Date.now().toString().slice(-4)}`,
      workerName: worker.name,
      societyName: adminSocietyName || (worker as any).societyName || societies[0]?.name || "Cooperative Society",
      type: claimType,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: "Approved",
      amount: claimAmount ? `₹${claimAmount}` : undefined,
    });
    setShowClaimForm(false);
    setClaimAmount("");
  };

  return <div className="modal-backdrop" onClick={close}><aside className="detail-drawer admin-review-drawer" onClick={(event) => event.stopPropagation()} style={{overflowY: 'auto'}}><button className="close-button" onClick={close}><X size={17} /></button><p className="eyebrow"><span /> COOPERATIVE DESK / WORKER REVIEW</p><div className="drawer-hero"><Avatar initials={worker.initials} tone={worker.accent} /><Status value={status} /><h2>{worker.name}</h2><p>{worker.service} · {worker.area}</p></div><div className="trust-block"><ShieldCheck size={19} /><div><strong>Review before profile goes live</strong><small>Check service, experience, and locality against the cooperative submission.</small></div></div><div className="profile-stats"><div><strong>{worker.experience}</strong><small>experience</small></div><div><strong>{worker.area.split(",")[0]}</strong><small>service area</small></div><div><strong>{status === "Verified" ? "Live" : status === "Rejected" ? "Held" : "Review"}</strong><small>profile state</small></div></div><div className="drawer-section"><p className="eyebrow">SUBMISSION RECORD</p><p>Submitted {worker.submitted}. This is a frontend demo state; final approval will be persisted by the backend.</p></div>
  
  {status === "Verified" && (
    <div className="drawer-section" style={{marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--gray-border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <p className="eyebrow" style={{marginBottom:0}}>WELFARE CLAIMS</p>
        <button className="link-button" onClick={() => setShowClaimForm(!showClaimForm)}>{showClaimForm ? "Cancel" : "+ Add claim"}</button>
      </div>
      
      {showClaimForm && (
        <div style={{background: 'var(--slate-50)', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
          <label style={{marginBottom: '8px', display: 'block', fontSize: '11px', fontWeight: 600}}>Claim Type
            <select value={claimType} onChange={(e) => setClaimType(e.target.value as any)} style={{width: '100%', padding: '8px', marginTop: '4px', border: '1px solid var(--gray-border)', borderRadius: '4px'}}>
              <option value="Accident">Accident</option>
              <option value="Health">Health</option>
              <option value="Maternity">Maternity</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label style={{marginBottom: '16px', display: 'block', fontSize: '11px', fontWeight: 600}}>Amount (₹)
            <input type="number" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="e.g. 5000" style={{width: '100%', padding: '8px', marginTop: '4px', border: '1px solid var(--gray-border)', borderRadius: '4px'}} />
          </label>
          <Button onClick={handleAddClaim} icon={<Check size={14} />}>Save claim record</Button>
        </div>
      )}

      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {workerClaims.length === 0 ? <p style={{fontSize: '12px', color: 'var(--gray-text)'}}>No claims recorded for this worker.</p> : workerClaims.map(c => 
          <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--slate-50)',padding:'8px 12px',borderRadius:'6px'}}>
            <div style={{display:'flex',flexDirection:'column'}}>
              <strong style={{fontSize: '13px'}}>{c.type} Claim</strong>
              <small style={{fontSize: '11px', color: 'var(--gray-text)'}}>{c.date}</small>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
              <Status value={c.status} />
              {c.amount && <strong style={{fontSize:'12px',marginTop:'4px'}}>{c.amount}</strong>}
            </div>
          </div>
        )}
      </div>
    </div>
  )}

  <div className="drawer-bottom"><Button variant="danger" onClick={() => rejectWorker(worker.name)}>Reject</Button><Button onClick={() => approveWorker(worker.name)} icon={<Check size={15} />}>Approve worker</Button></div></aside></div>; 
}

function Issues({ role }: { role: Role }) {
  const { issues, addIssue, resolveIssue, bookings: storeBookings, verifiedWorkers } = useDemoStore();
  const [submitted, setSubmitted] = useState(false);
  const [adminTab, setAdminTab] = useState<"all" | "customer" | "worker" | "resolved">("all");

  // Customer grievance state
  const [targetWorker, setTargetWorker] = useState("");
  const [customerCategory, setCustomerCategory] = useState("Quality of Workmanship");
  const [selectedBooking, setSelectedBooking] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Worker problem state
  const [workerCategory, setWorkerCategory] = useState("Site Safety / Hazardous Condition");

  // Worker dropdown list for customer grievances
  const workerOptions = useMemo(() => {
    const list: string[] = [];
    verifiedWorkers.forEach(w => { if (!list.includes(w.name)) list.push(w.name); });
    storeBookings.forEach(b => { if (b.worker && !list.includes(b.worker)) list.push(b.worker); });
    workers.forEach(w => { if (!list.includes(w.name)) list.push(w.name); });
    return list;
  }, [verifiedWorkers, storeBookings]);

  // Scoped issues based on role and admin tabs
  const scopedIssues = useMemo(() => {
    if (role === "Admin") {
      if (adminTab === "customer") return issues.filter(i => i.raisedBy === "Customer");
      if (adminTab === "worker") return issues.filter(i => i.raisedBy === "Worker");
      if (adminTab === "resolved") return issues.filter(i => i.status === "Resolved");
      return issues;
    }
    return issues.filter(i => i.raisedBy === role);
  }, [role, adminTab, issues]);

  const openCount = issues.filter(i => i.status === "Open").length;
  const customerGrievances = issues.filter(i => i.raisedBy === "Customer");
  const workerProblems = issues.filter(i => i.raisedBy === "Worker");
  const resolvedCount = issues.filter(i => i.status === "Resolved").length;

  const handleSubmit = () => {
    if (role === "Customer") {
      const fullSubject = `[${customerCategory}] ${targetWorker ? `Worker: ${targetWorker} — ` : ""}${subject.trim() || "Service Grievance"}`;
      addIssue({
        id: `ISS-${Date.now().toString().slice(-4)}`,
        subject: fullSubject,
        description: description.trim() || "Customer raised a service grievance regarding worker handoff.",
        linkedBookingId: selectedBooking || undefined,
        targetWorkerName: targetWorker || undefined,
        category: customerCategory,
        raisedBy: "Customer",
        status: "Open",
      });
    } else {
      const fullSubject = `[${workerCategory}] ${subject.trim() || "Worker Support Inquiry"}`;
      addIssue({
        id: `ISS-${Date.now().toString().slice(-4)}`,
        subject: fullSubject,
        description: description.trim() || "Worker submitted a problem report to the cooperative.",
        linkedBookingId: selectedBooking || undefined,
        category: workerCategory,
        raisedBy: "Worker",
        status: "Open",
      });
    }
    setSubject("");
    setDescription("");
    setTargetWorker("");
    setSelectedBooking("");
    setSubmitted(true);
  };

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow={
          role === "Admin"
            ? "COOPERATIVE DESK / GRIEVANCES & SUPPORT"
            : role === "Worker"
            ? "MEMBER VOICE / COOPERATIVE INBOX"
            : "CUSTOMER CARE / SERVICE GRIEVANCES"
        }
        title={
          role === "Admin"
            ? "Community voice & resolution."
            : role === "Worker"
            ? "Report a problem to your cooperative."
            : "Raise a grievance regarding a worker."
        }
        description={
          role === "Admin"
            ? "Audit and resolve customer grievances regarding workers and support requests filed by member workers."
            : role === "Worker"
            ? "Submit site safety concerns, payment delays, or welfare inquiries directly to cooperative administrators."
            : "Submit direct concerns regarding service quality, conduct, or billing directly to the cooperative for resolution."
        }
      />

      {role === "Admin" && (
        <div className="grievance-tabs">
          <button className={adminTab === "all" ? "active" : ""} onClick={() => setAdminTab("all")}>
            All issues <b>{issues.length}</b>
          </button>
          <button className={adminTab === "customer" ? "active" : ""} onClick={() => setAdminTab("customer")}>
            Customer grievances <b>{customerGrievances.length}</b>
          </button>
          <button className={adminTab === "worker" ? "active" : ""} onClick={() => setAdminTab("worker")}>
            Worker inquiries <b>{workerProblems.length}</b>
          </button>
          <button className={adminTab === "resolved" ? "active" : ""} onClick={() => setAdminTab("resolved")}>
            Resolved <b>{resolvedCount}</b>
          </button>
        </div>
      )}

      <div className="issues-layout">
        {role !== "Admin" ? (
          <section className="panel issue-form">
            <PanelHead
              title={role === "Customer" ? "Submit service grievance" : "Report a problem"}
              meta={role === "Customer" ? "Directed to Cooperative Admin" : "Direct line to your cooperative"}
            />

            {role === "Customer" ? (
              <>
                <label>
                  Grievance category
                  <select value={customerCategory} onChange={(e) => setCustomerCategory(e.target.value)}>
                    <option>Quality of Workmanship</option>
                    <option>Worker Late Arrival / No Show</option>
                    <option>Billing Discrepancy / Overcharge</option>
                    <option>Unprofessional Conduct</option>
                    <option>Safety or Property Damage</option>
                    <option>Other Service Issue</option>
                  </select>
                </label>

                <label>
                  Regarding worker
                  <select value={targetWorker} onChange={(e) => setTargetWorker(e.target.value)}>
                    <option value="">Select worker (Optional)</option>
                    {workerOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label>
                Problem category
                <select value={workerCategory} onChange={(e) => setWorkerCategory(e.target.value)}>
                  <option>Site Safety / Hazardous Condition</option>
                  <option>Payment Delay / Customer Dispute</option>
                  <option>Discrepancy in Job Scope</option>
                  <option>e-Shram / Welfare Benefits Support</option>
                  <option>Tool &amp; Equipment Assistance</option>
                  <option>Administrative / Membership Query</option>
                </select>
              </label>
            )}

            <label>
              Linked booking (Optional)
              <select value={selectedBooking} onChange={(e) => setSelectedBooking(e.target.value)}>
                <option value="">No linked booking</option>
                {storeBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {b.service} ({b.worker})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subject summary
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={role === "Customer" ? "e.g. Incomplete installation on kitchen switch" : "e.g. Hazardous wiring without main breaker"}
              />
            </label>

            <label>
              Detailed description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide specific details so the cooperative can investigate and take action."
                rows={4}
              />
            </label>

            <Button onClick={handleSubmit} icon={<ArrowRight size={15} />}>
              {role === "Customer" ? "Submit grievance to cooperative" : "Submit problem to cooperative"}
            </Button>

            {submitted && (
              <div className="success-note">
                <Check size={15} /> Your submission has been recorded in the cooperative inbox.
              </div>
            )}

            <div style={{ margin: "18px 21px 0", padding: 12, background: "var(--sage-soft)", borderRadius: 10, display: "flex", gap: 9, alignItems: "flex-start", color: "#597a63", fontSize: 11 }}>
              <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 1, color: "var(--forest)" }} />
              <div>
                <strong style={{ display: "block", color: "var(--ink)", marginBottom: 2 }}>Cooperative Governance Guarantee</strong>
                <span>Every grievance and member problem is audited directly by your cooperative board.</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="panel" style={{ padding: 22 }}>
            <PanelHead title="Grievance Overview" meta="Governance statistics" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
              <div style={{ padding: 14, background: "var(--teal-soft)", borderRadius: 10 }}>
                <strong style={{ fontSize: 13, display: "block", color: "var(--forest)" }}>Active Cooperative Inbox</strong>
                <small style={{ color: "var(--forest-dark)", fontSize: 11 }}>{openCount} issues awaiting administrative review</small>
              </div>
              <div style={{ padding: 14, background: "var(--brass-soft)", borderRadius: 10 }}>
                <strong style={{ fontSize: 13, display: "block", color: "#7a5c1c" }}>Customer Grievances</strong>
                <small style={{ color: "#7a5c1c", fontSize: 11 }}>{customerGrievances.length} reported regarding service quality &amp; conduct</small>
              </div>
              <div style={{ padding: 14, background: "var(--blue-soft)", borderRadius: 10 }}>
                <strong style={{ fontSize: 13, display: "block", color: "#3d647a" }}>Worker Inquiries &amp; Safety</strong>
                <small style={{ color: "#3d647a", fontSize: 11 }}>{workerProblems.length} member issues logged</small>
              </div>
            </div>
          </section>
        )}

        <section className="panel issue-list">
          <PanelHead
            title={role === "Admin" ? "Grievance & problem inbox" : "Your submitted issues"}
            meta={role === "Admin" ? `${scopedIssues.length} records shown` : `${scopedIssues.length} submissions on record`}
          />
          {scopedIssues.length ? (
            scopedIssues.map((issue, i) => (
              <div className="issue-row" key={issue.id} style={{ alignItems: "flex-start", gap: 12 }}>
                <div className={`issue-priority priority-${issue.status === "Open" ? "high" : "normal"}`} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: issue.raisedBy === "Customer" ? "var(--brass-soft)" : "var(--blue-soft)", color: issue.raisedBy === "Customer" ? "#7a5c1c" : "#386177", fontWeight: 600 }}>
                      {issue.raisedBy === "Customer" ? "Customer Grievance" : "Worker Inquiry"}
                    </span>
                    {issue.createdDate && <small style={{ color: "var(--muted-foreground)", fontSize: 10 }}>{issue.createdDate}</small>}
                  </div>
                  <strong style={{ fontSize: 13, color: "var(--ink)" }}>{issue.subject}</strong>
                  <p style={{ margin: "4px 0 6px", fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5 }}>{issue.description}</p>
                  {issue.linkedBookingId && (
                    <small style={{ color: "var(--forest)", fontSize: 10, fontWeight: 600 }}>Linked Booking: {issue.linkedBookingId}</small>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <Status value={issue.status} />
                  {role === "Admin" && issue.status === "Open" && (
                    <Button onClick={() => resolveIssue(issue.id)} icon={<Check size={13} />}>
                      Mark resolved
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <FileText size={22} />
              <strong>No grievances or issues found</strong>
              <p>{role === "Admin" ? "The cooperative grievance queue is completely clear." : "Your submitted issues will appear here."}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AccessScreen({ setRole, go }: { setRole: (role: Role) => void; go: (screen: Screen) => void }) {
 
  const { societies, registerSociety, setAdminSociety, registerWorker } = useDemoStore();
  const { signIn, signUp, configured } = useAuth();
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  // After successful signup: { role, name, societyName } — show confirmation instead of entering dashboard
  const [signupDone, setSignupDone] = useState<{ role: Role; name: string; societyName?: string } | null>(null);
  const [intent, setIntent] = useState<"signin" | "signup">(() => {
    try {
      if (typeof window !== "undefined") {
        const i = new URLSearchParams(window.location.search).get("intent");
        if (i === "signin" || i === "signup") return i;
      }
    } catch {}
    return "signin";
  });
  const [accountRole, setAccountRole] = useState<Role>(() => {
    try {
      if (typeof window !== "undefined") {
        const r = new URLSearchParams(window.location.search).get("role");
        const i = new URLSearchParams(window.location.search).get("intent");
        if (r === "Customer" || r === "Worker" || r === "Admin") return r;
        if (r === "Official") return i === "signup" ? "Admin" : "Official";
      }
    } catch {}
    return "Customer";
  });

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [service, setService] = useState("Electrician");
  const [experience, setExperience] = useState("1–3 years");
  const [membershipId, setMembershipId] = useState("");
  const [societyName, setSocietyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Society Statutory Verification Form State
  const [societyRegNo, setSocietyRegNo] = useState("");
  const [societyState, setSocietyState] = useState("");
  const [societyDistrict, setSocietyDistrict] = useState("");
  const [societySignatory, setSocietySignatory] = useState("");
  const [societySignatoryRole, setSocietySignatoryRole] = useState("Managing Secretary");
  const [societyPan, setSocietyPan] = useState("");
  const [societyBankAccount, setSocietyBankAccount] = useState("");
  const [societyBankIfsc, setSocietyBankIfsc] = useState("");

  const enterPortal = (nextRole: Role, nextSocietyName?: string) => {
    if (nextRole === "Official") {
      setRole("Official");
      go("overview");
      return;
    }
    if (nextRole === "Admin") {
      setAdminSociety(nextSocietyName || societies[0]?.name || "");
      setRole("Admin");
      go("overview");
      return;
    }
    if (nextRole === "Worker") {
      setRole("Worker");
      go("worker");
      return;
    }
    setRole("Customer");
    go("overview");
  };

  const handleSubmit = async () => {
    if (authBusy) return;
    setAuthError("");
    setAuthBusy(true);
    try {
      const finalSocietyName = societyName.trim() || (accountRole === "Admin" ? "" : (societies[0]?.name || ""));
      if (intent === "signup") {
        if (accountRole === "Admin") {
          if (!societyName.trim()) {
            setAuthError("Please enter the name of the society you want to register.");
            return;
          }
          if (!phone.trim()) {
            setAuthError("Please enter your contact mobile number.");
            return;
          }
          if (!email.trim() || !password.trim()) {
            setAuthError("Please provide an official email and password for your admin account.");
            return;
          }
        }

        const adminFullName = accountRole === "Admin" ? finalSocietyName : name;
        const result = await signUp({
          email,
          password,
          role: accountRole,
          fullName: adminFullName,
          phone: phone.trim() || "",
          area: area.trim() || "",
          societyName: finalSocietyName,
          serviceCategory: service,
          experienceYears: parseInt(experience, 10) || 2,
          membershipId,
        });
        if (result.error) {
          if (result.needsEmailConfirm) {
            toast.success("Account created! Please verify your email and login.");
            setAuthError("Please verify your email and login.");
            setIntent("signin");
            return;
          }
          setAuthError(result.error);
          return;
        }

        // Register cooperative in demo store as Draft — operations locked until they apply & get approved
        if (accountRole === "Admin") {
          const exists = societies.find((s) => s.name.toLowerCase() === finalSocietyName.toLowerCase());
          if (!exists) {
            registerSociety({
              id: `SOC-${Date.now()}`,
              name: finalSocietyName,
              email: email.trim(),
              signatoryPhone: phone.trim() || undefined,
              status: "Draft",
              submittedAt: "Draft created",
              state: "",
              district: "",
            });
          }
          setSignupDone({ role: accountRole, name: finalSocietyName, societyName: finalSocietyName });
          return;
        } else if (accountRole === "Worker") {
          // Resolve linked society from entered Society ID or Name
          const resolvedSociety = societies.find((s) =>
            (s.societyCode && s.societyCode.toLowerCase() === societyName.trim().toLowerCase()) ||
            s.name.toLowerCase() === societyName.trim().toLowerCase() ||
            s.id.toLowerCase() === societyName.trim().toLowerCase()
          );
          const assignedSocietyName = resolvedSociety ? resolvedSociety.name : finalSocietyName;

          const exists = societies.find((s) => s.name.toLowerCase() === assignedSocietyName.toLowerCase());
          if (!exists) {
            registerSociety({ id: `SOC-${Date.now()}`, name: assignedSocietyName, email: email.trim(), status: "Approved" });
          }
          registerWorker({
            id: `pw-${Date.now()}`,
            name: name.trim() || "New Worker",
            initials: (name.trim() || "New Worker").split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase(),
            service, area: area.trim(),
            years: parseInt(experience) || 1, rating: "New worker", jobs: 0, rate: "₹350", accent: "brass", available: "Available today",
            experience, submitted: "Just now", membershipId: membershipId.trim() || "N/A", societyName: assignedSocietyName,
          });
        }
        // Show confirmation screen — DO NOT enter dashboard after signup
        setSignupDone({ role: accountRole, name: name.trim() || "there" });
        return;
      }

      // Sign-in path
      const result = await signIn(email, password);
      if (result.error) {
        setAuthError(result.error);
        return;
      }
      enterPortal(result.profile?.role || accountRole, result.profile?.societyName || societies[0]?.name || "");
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Signup confirmation screen ───────────────────────────────────────────────
  if (signupDone) {
    const isWorker = signupDone.role === "Worker";
    const isAdmin = signupDone.role === "Admin";
    return (
      <div className="content-wrap">
        <div style={{ maxWidth: 1080, margin: "0 auto 12px" }}>
          <button type="button" onClick={() => { window.location.href = "/"; }} className="back-landing-pill">
            <ArrowLeft size={14} style={{ color: "var(--forest)" }} />
            Back to landing page
          </button>
        </div>
        <div className="auth-layout">
          <div className="auth-story">
            <div className="auth-mark"><Mark /></div>
            <p className="eyebrow"><span /> {isWorker ? "APPLICATION RECEIVED" : isAdmin ? "ACCOUNT CREATED · ACTION REQUIRED" : "ACCOUNT CREATED"}</p>
            <h1>{isWorker ? <>Welcome to<br /><em>the network.</em></> : isAdmin ? <>Account created.<br /><em>Next step.</em></> : <>You're<br /><em>all set.</em></>}</h1>
            <p>{isWorker ? "Your application has been submitted and your account is created. The cooperative admin will review your profile before it goes live." : isAdmin ? "Your cooperative account has been created. Next, log in to your Admin Desk and apply for society official approval by submitting your statutory documents." : "Your customer account is ready. Sign in to start booking verified workers."}</p>
            <div className="auth-proof"><ShieldCheck size={18} /><span><strong>{isWorker ? "Awaiting cooperative approval" : isAdmin ? "Statutory Application Required" : "Account is live"}</strong><small>{isWorker ? "You'll be visible to customers once verified." : isAdmin ? "Operations locked until official approval." : "Sign in to continue."}</small></span></div>
          </div>
          <section className="panel auth-card" style={{display:'flex',flexDirection:'column',gap:18,justifyContent:'center'}}>
            <div className="auth-card-head">
              <p className="eyebrow"><span /> {isWorker ? "NEXT STEP" : isAdmin ? "STATUTORY ONBOARDING" : "READY TO GO"}</p>
              <h2>{isWorker ? "Sit tight." : isAdmin ? "Apply for approval." : "Head in."}</h2>
              <p>{isWorker ? `Hi ${signupDone.name}, your application is in the queue. The admin will approve you shortly — you'll appear on the network once verified.` : isAdmin ? `Hi ${signupDone.name}, your account is created! Log in to your Admin Desk to submit your society approval application and statutory documents for State Registrar (RCS) verification.` : `Hi ${signupDone.name}, your account is created. Sign in with your email and password to continue.`}</p>
            </div>
            {isWorker && (
              <div style={{background:'var(--sage-soft)',borderRadius:11,padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
                <ShieldCheck size={20} style={{color:'var(--forest)',flexShrink:0,marginTop:2}} />
                <div>
                  <strong style={{fontSize:12,display:'block',marginBottom:4}}>What happens next?</strong>
                  <small style={{color:'var(--muted-foreground)',lineHeight:1.6,fontSize:11}}>Your profile is in the cooperative's verification queue. Once the admin approves it, customers will be able to find and book you. This usually takes 1–2 working days.</small>
                </div>
              </div>
            )}
            {isAdmin && (
              <div style={{background:'var(--brass-soft)',borderRadius:11,padding:'16px 18px',display:'flex',gap:12,alignItems:'flex-start'}}>
                <Clock3 size={20} style={{color:'var(--brass)',flexShrink:0,marginTop:2}} />
                <div>
                  <strong style={{fontSize:12,display:'block',marginBottom:4}}>Operations Blocked Until Official Approval</strong>
                  <small style={{color:'var(--muted-foreground)',lineHeight:1.6,fontSize:11}}>To protect workers and platform integrity, dispatches and member onboarding remain locked until you submit your society details and statutory documents for State Official (RCS) review.</small>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {isAdmin ? (
                <>
                  <Button onClick={() => enterPortal("Admin", signupDone.societyName)} icon={<ArrowRight size={15} />}>
                    Enter Admin Desk & Apply for Approval
                  </Button>
                  <Button variant="secondary" onClick={() => { setSignupDone(null); setIntent("signin"); }} icon={<Lock size={15} />}>
                    Sign in
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => { setSignupDone(null); setIntent("signin"); }} icon={<ArrowRight size={15} />}>Go to sign in</Button>
                  <Button variant="secondary" onClick={() => { window.location.href = "/"; }} icon={<ArrowLeft size={15} />}>Back to landing page</Button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="content-wrap">
      <div style={{ maxWidth: 1080, margin: "0 auto 12px" }}>
        <button type="button" onClick={() => { window.location.href = "/"; }} className="back-landing-pill">
          <ArrowLeft size={14} style={{ color: "var(--forest)" }} />
          Back to landing page
        </button>
      </div>
      <div className="auth-layout">
        <div className="auth-story">
          <div className="auth-mark"><Mark /></div>
          <p className="eyebrow"><span /> ACCESS / COOPERATIVE NETWORK</p>
          <h1>Good work<br /><em>starts here.</em></h1>
          <p>Sign in to your Co-Labour space, or create an account to find trusted local help and keep every handoff visible.</p>
          <div className="auth-proof"><ShieldCheck size={18} /><span><strong>Verified by the cooperative</strong><small>Trust is reviewed before profiles go live.</small></span></div>
        </div>
        <section className="panel auth-card">
          <div className="auth-tabs">
            <button
              className={intent === "signup" ? "active" : ""}
              onClick={() => {
                setIntent("signup");
                if (accountRole === "Official") setAccountRole("Admin");
                setEmail("");
                setPassword("");
                setAuthError("");
              }}
            >
              Create account
            </button>
            <button
              className={intent === "signin" ? "active" : ""}
              onClick={() => {
                setIntent("signin");
                setEmail("");
                setPassword("");
                setAuthError("");
              }}
            >
              Sign in
            </button>
          </div>
          <div className="auth-card-head">
            <p className="eyebrow"><span /> {intent === "signup" ? "NEW TO CO-LABOUR" : "WELCOME BACK"}</p>
            <h2>{intent === "signup" ? (accountRole === "Admin" ? "Register Cooperative." : "Join the network.") : "Continue the handoff."}</h2>
            <p>{intent === "signup" ? (accountRole === "Admin" ? "Enter the society name and account details to get started." : "Choose how you will take part in the cooperative.") : "Enter your credentials to access your portal."}</p>
          </div>
          <div className="account-role-tabs">
            <button
              className={accountRole === "Customer" ? "active" : ""}
              onClick={() => {
                setAccountRole("Customer");
                setEmail("");
                setPassword("");
                setAuthError("");
              }}
            >
              Customer
            </button>
            <button
              className={accountRole === "Worker" ? "active" : ""}
              onClick={() => {
                setAccountRole("Worker");
                setEmail("");
                setPassword("");
                setAuthError("");
              }}
            >
              Worker
            </button>
            <button
              className={accountRole === "Admin" ? "active" : ""}
              onClick={() => {
                setAccountRole("Admin");
                setEmail("");
                setPassword("");
                setAuthError("");
              }}
            >
              Cooperative Admin
            </button>
            {intent === "signin" && (
              <button
                className={accountRole === "Official" ? "active" : ""}
                onClick={() => {
                  setAccountRole("Official");
                  setIntent("signin");
                  setEmail("");
                  setPassword("");
                  setAuthError("");
                }}
              >
                State Official (RCS)
              </button>
            )}
          </div>

          {/* Admin Signup Form: ONLY Society Name, Mobile No, Email, Password */}
          {accountRole === "Admin" && intent === "signup" && (
            <div className="auth-form-stack">
              <label>
                <span className="label-text">
                  <span>Name of Society you want to keep</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "var(--forest)", background: "var(--teal-soft)", padding: "2px 7px", borderRadius: 4 }}>Required</span>
                </span>
                <input
                  type="text"
                  value={societyName}
                  onChange={(e) => setSocietyName(e.target.value)}
                  placeholder="e.g. Haryana Urban Care Cooperative Society"
                  required
                />
              </label>

              <div className="auth-two-col">
                <label>
                  <span className="label-text">
                    <span>Mobile Number</span>
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98100 23456"
                    required
                  />
                </label>

                <label>
                  <span className="label-text">
                    <span>Official Admin Email</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="official@society.org"
                    required
                  />
                </label>
              </div>

              <label>
                <span className="label-text">
                  <span>Password</span>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>
          )}

          {/* Full name + Phone only shown during signup for Customer */}
          {accountRole === "Customer" && intent === "signup" && (
            <div className="auth-form-stack">
              <div className="auth-two-col">
                <label>
                  <span className="label-text">Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
                </label>
                <label>
                  <span className="label-text">Phone number</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 00000 00000" />
                </label>
              </div>
              <label>
                <span className="label-text">Area / locality</span>
                <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. DLF Phase 2, Gurugram" />
              </label>
            </div>
          )}

          {/* Worker Signup Form: Name, Phone, Area, Service, Experience, Membership ID, Society ID */}
          {accountRole === "Worker" && intent === "signup" && (
            <div className="auth-form-stack">
              <div className="auth-two-col">
                <label>
                  <span className="label-text">Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full legal name" />
                </label>
                <label>
                  <span className="label-text">Phone number</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 00000 00000" />
                </label>
              </div>
              <div className="auth-two-col">
                <label>
                  <span className="label-text">Area / locality</span>
                  <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Sector 12, Gurugram" />
                </label>
                <label>
                  <span className="label-text">Membership ID</span>
                  <input value={membershipId} onChange={(e) => setMembershipId(e.target.value)} placeholder="e.g. MEM-10492" />
                </label>
              </div>
              <div className="auth-two-col">
                <label>
                  <span className="label-text">Service category</span>
                  <select value={service} onChange={(e) => setService(e.target.value)}>
                    <option>Electrician</option><option>Plumber</option><option>Carpenter</option>
                    <option>Technician</option><option>Appliance Repair</option><option>AC Technician</option>
                    <option>Painter</option><option>Cleaner</option><option>Gardener</option>
                    <option>Home Maintenance</option><option>Caregiver</option><option>Domestic Helper</option><option>Driver</option>
                  </select>
                </label>
                <label>
                  <span className="label-text">Experience</span>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)}>
                    <option>1–3 years</option><option>4–7 years</option><option>8+ years</option>
                  </select>
                </label>
              </div>

              <label>
                <span className="label-text">Cooperative Society ID or Name</span>
                <input
                  list="approved-societies-list"
                  value={societyName}
                  onChange={(e) => setSocietyName(e.target.value)}
                  placeholder="e.g. SOC-HR-8821 or select society"
                />
                <datalist id="approved-societies-list">
                  {societies
                    .filter((s) => s.status === "Approved")
                    .map((s) => (
                      <option
                        key={s.id}
                        value={s.societyCode || s.id}
                        label={`${s.name} (${s.societyCode || s.id})`}
                      />
                    ))}
                </datalist>
              </label>

              {(() => {
                const matched = societies.find(
                  (s) =>
                    s.status === "Approved" &&
                    ((s.societyCode && s.societyCode.toLowerCase() === societyName.trim().toLowerCase()) ||
                      s.name.toLowerCase() === societyName.trim().toLowerCase() ||
                      s.id.toLowerCase() === societyName.trim().toLowerCase())
                );
                if (matched) {
                  return (
                    <div style={{ background: "rgba(23,107,98,.08)", border: "1px solid rgba(23,107,98,.2)", borderRadius: 8, padding: "8px 12px", marginTop: -4, marginBottom: 4, fontSize: 11, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} style={{ color: "var(--forest)", flexShrink: 0 }} />
                      <span>
                        Verified Cooperative: <strong>{matched.name}</strong> · Society ID: <b style={{ fontFamily: "monospace" }}>{matched.societyCode || matched.id}</b>
                      </span>
                    </div>
                  );
                }
                return (
                  <small style={{ color: "var(--muted-foreground)", fontSize: 10.5, marginTop: -6, marginBottom: 4, display: "block" }}>
                    Tip: Ask your cooperative admin for their Society ID (e.g. <b style={{ fontFamily: "monospace" }}>SOC-HR-8821</b>).
                  </small>
                );
              })()}
            </div>
          )}

          {/* Email and Password inputs for Signin, and for Customer/Worker */}
          {!(accountRole === "Admin" && intent === "signup") && (
            <div className="auth-form-stack">
              <div className={intent === "signup" ? "auth-two-col" : ""}>
                <label>
                  <span className="label-text">{accountRole === "Admin" || accountRole === "Official" ? "Contact Email" : "Email"}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </label>
                <label>
                  <span className="label-text">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </label>
              </div>
            </div>
          )}

          <div className="auth-bottom-actions">
            <Button onClick={handleSubmit} icon={<ArrowRight size={15} />}>
              {authBusy
                ? "Please wait…"
                : intent === "signup"
                ? accountRole === "Admin"
                  ? "Create Cooperative Account"
                  : accountRole === "Worker"
                  ? "Submit for verification"
                  : "Create account"
                : "Enter portal"}
            </Button>
            {authError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: authError.toLowerCase().includes("verify") ? "var(--teal-soft)" : "var(--danger-soft)",
                  color: authError.toLowerCase().includes("verify") ? "var(--forest-dark)" : "var(--danger)",
                  border: `1px solid ${authError.toLowerCase().includes("verify") ? "rgba(23,107,98,.25)" : "rgba(168,92,77,.25)"}`,
                }}
              >
                {authError.toLowerCase().includes("verify") ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{authError}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <p className="auth-fineprint" style={{ margin: 0 }}>Protected by Co-Labour security.</p>
              <button
                type="button"
                onClick={() => { window.location.href = "/"; }}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--forest)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ArrowLeft size={12} /> Landing page
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Settings() { const { resetDemo } = useDemoStore(); return <div className="content-wrap"><PageTitle eyebrow="ACCOUNT / PREFERENCES" title="Keep it yours." description="Manage profile details, notifications, and the way Co-Labour keeps you informed." /><section className="panel settings-panel"><div className="settings-row"><div><strong>Profile details</strong><small>Name, phone, and locality</small></div><button className="link-button">Edit <ArrowRight size={14} /></button></div><div className="settings-row"><div><strong>In-app updates</strong><small>Booking progress and cooperative messages</small></div><label className="toggle"><input type="checkbox" defaultChecked /><span /></label></div><div className="settings-row"><div><strong>Light theme</strong><small>Co-Labour is designed for calm, readable daylight use.</small></div><Status value="Active" /></div><div className="settings-row" style={{background:'var(--brass-soft)',borderRadius:11,margin:'8px 0 0',padding:'14px 17px'}}><div><strong>Reset demo workspace</strong><small>Returns all bookings, verifications, ratings, and issues to their initial state. Demo utility only.</small></div><button className="app-button danger" onClick={() => { resetDemo(); window.scrollTo(0,0); }} style={{flexShrink:0,fontSize:10}}>Reset demo</button></div></section></div>; }

function CoopMembers({ go }: { go: (screen: Screen) => void }) {
  const { approvedWorkerNames, rejectedWorkerNames, approveWorker, rejectWorker, newPendingWorkers, verifiedWorkers, supabaseReady, workerEarningsPrivacy } = useDemoStore();
  const { adminSocietyName } = useDemoStore();
  const { ratings } = useDemoStore();
  const [profileWorker, setProfileWorker] = useState<typeof workers[number] | null>(null);
  const [dossierWorker, setDossierWorker] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const baseVerified = useMemo(() => {
    return verifiedWorkers as unknown as typeof workers;
  }, [verifiedWorkers]);

  // Apply search filter
  const verifiedMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return baseVerified;
    return baseVerified.filter(w => `${w.name} ${w.service} ${w.area}`.toLowerCase().includes(q));
  }, [baseVerified, memberSearch]);

  // Pending registrations for this coop
  const pendingReg = newPendingWorkers.filter(w => !approvedWorkerNames.includes(w.name) && !rejectedWorkerNames.includes(w.name));

  return (
    <div className="content-wrap">
      <PageTitle eyebrow={`COOPERATIVE DESK / ${(adminSocietyName ?? 'COOPERATIVE').toUpperCase()}`} title="Society Members" description="Verified workers registered under your cooperative society." action={<Button variant="secondary" onClick={() => go("verify")} icon={<ShieldCheck size={15} />}>Verification queue</Button>} />
      <div className="kpi-grid">
        <Kpi label="Active members" value={String(baseVerified.length).padStart(2, '0')} detail="Verified and live" tone="forest" />
        <Kpi label="Pending approval" value={String(pendingReg.length).padStart(2, '0')} detail="Awaiting review" tone="brass" />
        <Kpi label="Services covered" value={String(new Set(baseVerified.map(w => w.service)).size).padStart(2, '0')} detail="Unique categories" tone="blue" />
        <Kpi label="Cooperative" value={adminSocietyName ? 'Active' : 'Unassigned'} detail={adminSocietyName ?? 'Cooperative Desk'} tone="sage" />
      </div>

      <section className="panel table-panel" style={{marginBottom: 20}}>
        <div className="table-header">
          <div><h2>Verified members</h2><small>{verifiedMembers.length} of {baseVerified.length} shown</small></div>
          <div className="search-field" style={{maxWidth:280,margin:0}}>
            <Search size={15} />
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search by name, service, area…"
            />
            {memberSearch && (
              <button onClick={() => setMemberSearch("")} style={{background:'none',border:0,cursor:'pointer',padding:'0 4px',color:'var(--muted-foreground)',display:'flex',alignItems:'center'}} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="booking-list">
          {verifiedMembers.length > 0 ? verifiedMembers.map(w => (
            <div className="booking-row" key={w.id} style={{cursor:'default'}}>
              <div className="booking-person" style={{flex:1}}><Avatar initials={w.initials} tone={w.accent} /><div><strong>{w.name}</strong><small>{w.service} · {w.area}</small></div></div>
              <Status value="Verified" />
              <div className="booking-price">
                <strong>
                  {workerEarningsPrivacy[w.name] ? (
                    <span className="privacy-lock-notice" style={{ fontSize: 10.5 }}>
                      <Lock size={10} /> Private
                    </span>
                  ) : (
                    w.rate
                  )}
                </strong>
                <small>{workerEarningsPrivacy[w.name] ? "sovereign mask" : "base visit"}</small>
              </div>
              <span style={{fontSize:11,color:'var(--muted-foreground)',minWidth:80}}>{ratings[w.name] ? `★ ${Number(ratings[w.name]).toFixed(1)}` : `★ ${w.rating}`}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="secondary" onClick={() => setDossierWorker(w)} icon={<ChevronRight size={14} />}>Dossier</Button>
                <Button variant="quiet" onClick={() => setProfileWorker(w)}>Public</Button>
              </div>
            </div>
          )) : (
            <div className="empty-state"><Search size={22} /><strong>No members found</strong><p>Try a different name, service, or area.</p></div>
          )}
        </div>
      </section>

      {pendingReg.length > 0 && (
        <section className="panel verification-panel">
          <div className="table-header"><div><h2>Pending registrations</h2><small>New members awaiting cooperative approval</small></div></div>
          {pendingReg.map(w => (
            <div className="verification-row" key={w.id}>
              <Avatar initials={w.initials} tone={w.accent as any} />
              <div className="verification-person"><strong>{w.name}</strong><small>{w.service} · {w.experience} · {w.area}</small></div>
              <span className="submitted">ID: {w.membershipId}</span>
              <span className="submitted">Submitted {w.submitted}</span>
              <Button variant="secondary" onClick={() => approveWorker(w.name)} icon={<Check size={14} />}>Approve</Button>
              <button className="reject-button" onClick={() => rejectWorker(w.name)}>Reject</button>
            </div>
          ))}
        </section>
      )}

      {profileWorker && <WorkerProfile worker={profileWorker} ratingOverride={ratings[profileWorker.name]} close={() => setProfileWorker(null)} book={() => setProfileWorker(null)} />}
      {dossierWorker && <MemberDossierModal member={dossierWorker} type="worker" close={() => setDossierWorker(null)} />}
    </div>
  );
}

function ProfileScreen({ role, go }: { role: Role; go: (screen: Screen) => void }) {
  if (role === "Admin") {
    return <AdminSocietyProfileSection go={go} />;
  }

  const { profile, updateProfile } = useAuth();
  const { claims, addClaim, bookings: storeBookings, workerEarningsPrivacy, toggleWorkerEarningsPrivacy } = useDemoStore();
  
  // Tabs
  const [customerTab, setCustomerTab] = useState<"personal" | "address" | "preferences">("personal");
  const [workerTab, setWorkerTab] = useState<"identity" | "trade" | "ratecard" | "payouts" | "welfare">("identity");
  
  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Customer Form state
  const [custName, setCustName] = useState(profile?.fullName || "");
  const [custPhone, setCustPhone] = useState(profile?.phone || "");
  const [custArea, setCustArea] = useState(profile?.area || "");
  const [custAddress, setCustAddress] = useState(profile?.addressLine || "");
  const [custPincode, setCustPincode] = useState(profile?.pincode || "");
  const [custEmergency, setCustEmergency] = useState(profile?.emergencyContact || "");
  const [custPayment, setCustPayment] = useState(profile?.preferredPayment || "UPI");
  const [custVpa, setCustVpa] = useState(profile?.upiId || "");
  const [custInstructions, setCustInstructions] = useState(profile?.bio || "");

  // Worker Form state
  const [workName, setWorkName] = useState(profile?.fullName || "Worker Member");
  const [workPhone, setWorkPhone] = useState(profile?.phone || "");
  const [workArea, setWorkArea] = useState(profile?.area || "");
  const [workService, setWorkService] = useState(profile?.serviceCategory || "Electrician");
  const [workYears, setWorkYears] = useState(profile?.experienceYears || 2);
  const [workMemberId, setWorkMemberId] = useState(profile?.membershipId || "");
  const [workRate, setWorkRate] = useState(profile?.ratePerVisit || "₹350");
  const [workBio, setWorkBio] = useState(profile?.bio || "");
  const [workUpi, setWorkUpi] = useState(profile?.upiId || "");
  const [workBank, setWorkBank] = useState(profile?.bankAccount || "");
  const [workEmergency, setWorkEmergency] = useState(profile?.emergencyAvailable ?? true);
  const [workAvailable, setWorkAvailable] = useState(true);

  // New claim modal state
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimType, setClaimType] = useState<"Health" | "Accident" | "Tool Loss" | "Education">("Health");
  const [claimAmount, setClaimAmount] = useState("₹5,000");

  useEffect(() => {
    if (profile) {
      if (role === "Customer") {
        setCustName(profile.fullName || "");
        setCustPhone(profile.phone || "");
        setCustArea(profile.area || "");
        if (profile.addressLine) setCustAddress(profile.addressLine);
        if (profile.pincode) setCustPincode(profile.pincode);
        if (profile.emergencyContact) setCustEmergency(profile.emergencyContact);
        if (profile.preferredPayment) setCustPayment(profile.preferredPayment);
        if (profile.upiId) setCustVpa(profile.upiId);
        if (profile.bio) setCustInstructions(profile.bio);
      } else if (role === "Worker") {
        setWorkName(profile.fullName || "Worker Member");
        setWorkPhone(profile.phone || "");
        setWorkArea(profile.area || "");
        if (profile.serviceCategory) setWorkService(profile.serviceCategory);
        if (profile.experienceYears) setWorkYears(profile.experienceYears);
        if (profile.membershipId) setWorkMemberId(profile.membershipId);
        if (profile.ratePerVisit) setWorkRate(profile.ratePerVisit);
        if (profile.bio) setWorkBio(profile.bio);
        if (profile.upiId) setWorkUpi(profile.upiId);
        if (profile.bankAccount) setWorkBank(profile.bankAccount);
        if (profile.emergencyAvailable !== undefined) setWorkEmergency(profile.emergencyAvailable ?? true);
      }
    }
  }, [profile, role]);

  const handleSaveCustomer = async () => {
    setBusy(true);
    setStatusMsg(null);
    const res = await updateProfile({
      fullName: custName.trim(),
      phone: custPhone.trim(),
      area: custArea.trim(),
      addressLine: custAddress.trim(),
      pincode: custPincode.trim(),
      emergencyContact: custEmergency.trim(),
      preferredPayment: custPayment,
      upiId: custVpa.trim(),
      bio: custInstructions.trim(),
    });
    setBusy(false);
    if (res.error) {
      setStatusMsg({ type: "error", text: res.error });
    } else {
      setStatusMsg({ type: "success", text: "Customer profile and service address saved successfully." });
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  const handleSaveWorker = async () => {
    setBusy(true);
    setStatusMsg(null);
    const res = await updateProfile({
      fullName: workName.trim(),
      phone: workPhone.trim(),
      area: workArea.trim(),
      serviceCategory: workService,
      experienceYears: Number(workYears) || 1,
      membershipId: workMemberId.trim(),
      ratePerVisit: workRate.trim(),
      bio: workBio.trim(),
      upiId: workUpi.trim(),
      bankAccount: workBank.trim(),
      emergencyAvailable: workEmergency,
    });
    setBusy(false);
    if (res.error) {
      setStatusMsg({ type: "error", text: res.error });
    } else {
      setStatusMsg({ type: "success", text: "Worker trade credentials, rate card, and payout details updated." });
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  const handleFileClaim = () => {
    addClaim({
      id: `CLM-${Date.now().toString().slice(-4)}`,
      workerName: workName,
      societyName: profile?.societyName || societies[0]?.name || "Cooperative Society",
      type: claimType,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Pending",
      amount: claimAmount,
    });
    setClaimModalOpen(false);
    setStatusMsg({ type: "success", text: "Welfare claim submitted to the cooperative society for review." });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const initials = (role === "Customer" ? custName : workName)
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || (role === "Customer" ? "AS" : "RK");

  const customerBookings = storeBookings.filter(
    (b) =>
      (profile?.id && (b as any).customerId === profile.id) ||
      (b.customerName && custName && b.customerName.toLowerCase() === custName.toLowerCase()) ||
      (profile?.fullName && b.customerName && b.customerName.toLowerCase() === profile.fullName.toLowerCase())
  );
  const totalCustomerBookings = customerBookings.length;

  if (role === "Customer") {
    return (
      <div className="content-wrap">
        <PageTitle
          eyebrow="CUSTOMER / ACCOUNT"
          title="Account & Profile"
          description="Manage contact details, service address, and payment preferences."
        />

        {statusMsg && (
          <div style={{ marginBottom: 18, padding: "12px 18px", borderRadius: 11, background: statusMsg.type === "success" ? "var(--sage-soft)" : "var(--danger-soft)", color: statusMsg.type === "success" ? "var(--forest)" : "var(--danger)", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600 }}>
            <CheckCircle2 size={18} />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Customer Account Summary Header */}
        <div className="panel customer-profile-header">
          <div className="customer-profile-identity">
            <Avatar initials={initials} tone="forest" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, font: '600 22px "Manrope", sans-serif', letterSpacing: "-.03em" }}>
                  {custName || profile?.fullName || "Member"}
                </h2>
                <span className="status status-neutral" style={{ fontSize: 10, textTransform: "uppercase" }}>
                  Customer Account
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
                {[custPhone, profile?.email, custArea].filter(Boolean).join(" · ") || "Cooperative Community Member"}
              </p>
            </div>
          </div>

          <div className="customer-profile-actions">
            <div className="customer-profile-stats">
              <div className="customer-profile-stat-box">
                <strong style={{ display: "block", font: '600 18px "Manrope", sans-serif', color: "var(--forest)", lineHeight: 1.2 }}>
                  {totalCustomerBookings}
                </strong>
                <small style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginTop: 2 }}>
                  Total Bookings
                </small>
              </div>
              <div className="customer-profile-stat-box">
                <strong style={{ display: "block", font: '600 18px "Manrope", sans-serif', color: "var(--forest)", lineHeight: 1.2 }}>
                  0%
                </strong>
                <small style={{ fontSize: 10, color: "var(--muted-foreground)", display: "block", marginTop: 2 }}>
                  Platform Fee
                </small>
              </div>
            </div>
            <div className="customer-profile-buttons">
              <Button variant="secondary" onClick={() => go("bookings")} icon={<ClipboardList size={14} />}>
                My Bookings
              </Button>
              <Button onClick={() => go("find")} icon={<Search size={14} />}>
                Book a Service
              </Button>
            </div>
          </div>
        </div>

        {/* Tabbed Settings Form */}
        <section className="panel" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 0" }}>
            <div className="profile-tabs">
              <button type="button" className={customerTab === "personal" ? "active" : ""} onClick={() => setCustomerTab("personal")}>
                Personal details &amp; contact
              </button>
              <button type="button" className={customerTab === "address" ? "active" : ""} onClick={() => setCustomerTab("address")}>
                Saved service address
              </button>
              <button type="button" className={customerTab === "preferences" ? "active" : ""} onClick={() => setCustomerTab("preferences")}>
                Payment &amp; checkout preferences
              </button>
            </div>
          </div>

          {customerTab === "personal" && (
            <div className="profile-form-grid">
              <div>
                <label>Full Name</label>
                <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label>Mobile Phone Number</label>
                <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+91 00000 00000" />
              </div>
              <div>
                <label>Registered Email</label>
                <input value={profile?.email || "customer@coop.org"} disabled style={{ opacity: 0.7 }} />
              </div>
              <div>
                <label>Emergency Contact Phone (for service visits)</label>
                <input value={custEmergency} onChange={(e) => setCustEmergency(e.target.value)} placeholder="+91 98111 22334" />
              </div>
            </div>
          )}

          {customerTab === "address" && (
            <div className="profile-form-grid">
              <div className="profile-full-width">
                <label>Flat / House / Villa Number</label>
                <input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} placeholder="e.g. Flat 402, Block C, Gulmohar Enclave" />
              </div>
              <div>
                <label>Locality / Sector</label>
                <input value={custArea} onChange={(e) => setCustArea(e.target.value)} placeholder="e.g. Sushant Lok Phase 1" />
              </div>
              <div>
                <label>Postal PIN Code</label>
                <input value={custPincode} onChange={(e) => setCustPincode(e.target.value)} placeholder="122002" maxLength={6} />
              </div>
              <div className="profile-full-width">
                <label>Arrival Instructions / Landmark (Shared with arriving worker)</label>
                <textarea
                  rows={2}
                  value={custInstructions}
                  onChange={(e) => setCustInstructions(e.target.value)}
                  placeholder="e.g. Opposite Community Center Gate 2. Intercom code 402."
                />
              </div>
            </div>
          )}

          {customerTab === "preferences" && (
            <div className="profile-form-grid">
              <div className="profile-full-width">
                <label>Default Payment Mode</label>
                <select value={custPayment} onChange={(e) => setCustPayment(e.target.value)}>
                  <option value="UPI">UPI (Google Pay / PhonePe / QR)</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Cash">Cash on Completion</option>
                </select>
              </div>
              <div className="profile-full-width">
                <label>Saved Virtual Payment Address (VPA / UPI ID)</label>
                <input
                  value={custVpa}
                  onChange={(e) => setCustVpa(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank"
                />
              </div>
            </div>
          )}

          <div className="profile-save-bar">
            <small style={{ color: "var(--muted-foreground)" }}>Changes will apply immediately to your upcoming bookings.</small>
            <Button onClick={handleSaveCustomer} icon={<Check size={14} />}>
              {busy ? "Saving..." : "Save Customer Profile"}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="content-wrap">
      <PageTitle
        eyebrow={role === "Worker" ? "WORKER / PROFILE" : "COOPERATIVE / SOCIETY"}
        title={role === "Worker" ? "Trade Profile & Settings" : "Society Profile & Documents"}
        description={
          role === "Worker"
            ? "Manage verified credentials, rate card, bank account, and availability."
            : "Review registered society credentials and statutory documents."
        }
      />

      {statusMsg && (
        <div style={{ marginBottom: 18, padding: "12px 18px", borderRadius: 11, background: statusMsg.type === "success" ? "var(--sage-soft)" : "var(--danger-soft)", color: statusMsg.type === "success" ? "var(--forest)" : "var(--danger)", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600 }}>
          <CheckCircle2 size={18} />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="profile-layout">
        {/* Left Hero Card for Workers & Society Admins */}
        <aside className="panel profile-hero">
          <Avatar initials={initials} tone="brass" />
          <Status value={role === "Admin" ? "Society Admin" : "Verified Member"} />
          <h2>{workName}</h2>
          <p>{workService} · {workArea}</p>

          <div className="trust-block" style={{ margin: "14px 0 18px", textAlign: "left" }}>
            <ShieldCheck size={18} />
            <div>
              <strong>{profile?.societyName || societies[0]?.name || "Chartered Cooperative"}</strong>
              <small>Civic verified · 0% Middleman Extraction</small>
            </div>
          </div>

          {role === "Worker" && (
            <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ textAlign: "left" }}>
                <strong style={{ fontSize: 11, display: "block" }}>Live Availability</strong>
                <small style={{ color: "var(--muted-foreground)", fontSize: 9 }}>{workAvailable ? "Accepting bookings today" : "Currently off-duty"}</small>
              </div>
              <button type="button" onClick={() => setWorkAvailable(!workAvailable)} style={{ border: 0, background: workAvailable ? "var(--forest)" : "#d8ddd7", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 10, fontWeight: 600 }}>
                {workAvailable ? "Available" : "Off Duty"}
              </button>
            </div>
          )}

          <div className="profile-stats">
            <div>
              <strong>{workYears}</strong>
              <small>yrs exp</small>
            </div>
            <div>
              <strong>{profile?.ratePerVisit || workRate}</strong>
              <small>base visit</small>
            </div>
            <div>
              <strong>★ 4.9</strong>
              <small>avg rating</small>
            </div>
          </div>
        </aside>

        {/* Right Tabbed Form */}
        <section className="panel" style={{ overflow: "hidden" }}>
          {role === "Worker" && (
            <>
              <div style={{ padding: "18px 22px 0" }}>
                <div className="profile-tabs">
                  <button type="button" className={workerTab === "identity" ? "active" : ""} onClick={() => setWorkerTab("identity")}>Identity &amp; Locality</button>
                  <button type="button" className={workerTab === "trade" ? "active" : ""} onClick={() => setWorkerTab("trade")}>Trade &amp; Society</button>
                  <button type="button" className={workerTab === "ratecard" ? "active" : ""} onClick={() => setWorkerTab("ratecard")}>Rate Card &amp; Bio</button>
                  <button type="button" className={workerTab === "payouts" ? "active" : ""} onClick={() => setWorkerTab("payouts")}>Payouts &amp; Bank</button>
                  <button type="button" className={workerTab === "welfare" ? "active" : ""} onClick={() => setWorkerTab("welfare")}>Welfare &amp; Insurance</button>
                </div>
              </div>

              {workerTab === "identity" && (
                <div className="profile-form-grid">
                  <div>
                    <label>Full Legal Name</label>
                    <input value={workName} onChange={(e) => setWorkName(e.target.value)} />
                  </div>
                  <div>
                    <label>Mobile Number (Registered)</label>
                    <input value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} />
                  </div>
                  <div>
                    <label>Primary Service Area</label>
                    <input value={workArea} onChange={(e) => setWorkArea(e.target.value)} placeholder="e.g. DLF Phase 2, Gurugram" />
                  </div>
                  <div>
                    <label>Alternative Contact</label>
                    <input placeholder="+91 00000 00000" />
                  </div>
                </div>
              )}

              {workerTab === "trade" && (
                <div className="profile-form-grid">
                  <div>
                    <label>Service Category</label>
                    <select value={workService} onChange={(e) => setWorkService(e.target.value)}>
                      {MARKETPLACE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Experience (Years)</label>
                    <input type="number" min={1} max={40} value={workYears} onChange={(e) => setWorkYears(Number(e.target.value))} />
                  </div>
                  <div>
                    <label>Cooperative Membership ID</label>
                    <input value={workMemberId} onChange={(e) => setWorkMemberId(e.target.value)} placeholder="e.g. GSC-ELEC-104" />
                  </div>
                  <div>
                    <label>Cooperative Society</label>
                    <input value={profile?.societyName || societies[0]?.name || "Chartered Cooperative"} disabled style={{ opacity: 0.7 }} />
                  </div>
                  <div className="profile-full-width">
                    <label>e-Shram National Database UAN Status</label>
                    <input value={profile?.eShramUan ? `UAN: ${profile.eShramUan} · Verified` : "e-Shram UAN Verification via Cooperative Society"} disabled style={{ opacity: 0.7, background: "var(--sage-soft)", color: "var(--forest-dark)" }} />
                  </div>
                </div>
              )}

              {workerTab === "ratecard" && (
                <div className="profile-form-grid">
                  <div>
                    <label>Base Visit Charge (Rate Card)</label>
                    <input value={workRate} onChange={(e) => setWorkRate(e.target.value)} placeholder="₹350" />
                    <small style={{ color: "var(--muted-foreground)", fontSize: 9, marginTop: 4, display: "block" }}>Fixed cooperative rate card tariff for initial visit and diagnostic.</small>
                  </div>
                  <div>
                    <label>Emergency Booking Readiness</label>
                    <select value={workEmergency ? "yes" : "no"} onChange={(e) => setWorkEmergency(e.target.value === "yes")}>
                      <option value="yes">Available for Emergency Requests</option>
                      <option value="no">Standard Visits Only</option>
                    </select>
                  </div>
                  <div className="profile-full-width">
                    <label>Professional Bio / Service Guarantee (Shown to Customers)</label>
                    <textarea rows={3} value={workBio} onChange={(e) => setWorkBio(e.target.value)} placeholder="Describe your experience and work standards..." />
                  </div>
                </div>
              )}

              {workerTab === "payouts" && (
                <div style={{ padding: "0 0 16px" }}>
                  <div className="profile-form-grid">
                    <div>
                      <label>UPI ID for Direct Payouts</label>
                      <input value={workUpi} onChange={(e) => setWorkUpi(e.target.value)} placeholder="e.g. name@okhdfcbank" />
                    </div>
                    <div>
                      <label>Bank Account Number</label>
                      <input value={workBank} onChange={(e) => setWorkBank(e.target.value)} placeholder="Bank Account Number" />
                    </div>
                    <div>
                      <label>Bank IFSC Code</label>
                      <input placeholder="e.g. HDFC0001092" />
                    </div>
                    <div>
                      <label>Account Holder Name</label>
                      <input value={workName} disabled style={{ opacity: 0.7 }} />
                    </div>
                  </div>

                  {/* Sovereign Earnings Privacy Toggle */}
                  <div style={{ padding: "0 22px 6px" }}>
                    <div className="privacy-toggle-card">
                      <div>
                        <strong>Sovereign Earnings Privacy (Democratic Right)</strong>
                        <p>
                          {workerEarningsPrivacy[workName]
                            ? "Your individual earnings, settlement logs, and tariff figures are currently hidden from cooperative administrators. The admin dashboard displays [🔒 Hidden by Member]."
                            : "Your earnings are currently accessible by cooperative auditors for aggregate financial reconciliation and state cooperative filing reports."}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`app-button ${workerEarningsPrivacy[workName] ? "secondary" : "forest"}`}
                        onClick={() => toggleWorkerEarningsPrivacy(workName)}
                        style={{ flexShrink: 0, fontSize: 11 }}
                      >
                        <Lock size={12} style={{ marginRight: 4 }} />
                        {workerEarningsPrivacy[workName] ? "Make Earnings Visible to Admin" : "Hide Earnings from Admin"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {workerTab === "welfare" && (
                <div style={{ padding: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>Cooperative Welfare &amp; Insurance Protection</strong>
                      <small style={{ display: "block", color: "var(--muted-foreground)", fontSize: 10 }}>Claims filed with {profile?.societyName || societies[0]?.name || "Cooperative Society"}</small>
                    </div>
                    <Button variant="secondary" onClick={() => setClaimModalOpen(true)} icon={<ShieldCheck size={14} />}>File New Claim</Button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {claims.filter((c) => c.workerName === workName).map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--ivory)", padding: "12px 16px", borderRadius: 9, border: "1px solid var(--border)" }}>
                        <div>
                          <strong style={{ fontSize: 12, display: "block" }}>{c.type} Claim ({c.id})</strong>
                          <small style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Filed on {c.date} · {c.societyName}</small>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Status value={c.status} />
                          {c.amount && <strong style={{ fontSize: 12, display: "block", marginTop: 4 }}>{c.amount}</strong>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="profile-save-bar">
                <small style={{ color: "var(--muted-foreground)" }}>Cooperative profile is visible to customers across Gurugram.</small>
                <Button onClick={handleSaveWorker} icon={<Check size={14} />}>
                  {busy ? "Saving..." : "Save Worker Profile"}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Modal for Filing a Welfare Claim */}
      {claimModalOpen && (
        <div className="modal-backdrop" onClick={() => setClaimModalOpen(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button type="button" className="close-button" onClick={() => setClaimModalOpen(false)}><X size={16} /></button>
            <p className="eyebrow"><span /> COOPERATIVE WELFARE DESK</p>
            <h2>File a Benefit Claim.</h2>
            <p className="modal-intro">Submit a health, accident, or tool loss assistance claim directly to your cooperative society.</p>

            <div style={{ display: "grid", gap: 12, margin: "16px 0" }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Claim Category
                <select value={claimType} onChange={(e) => setClaimType(e.target.value as any)} style={{ display: "block", width: "100%", border: "1px solid var(--border)", background: "var(--ivory)", borderRadius: 8, padding: 9, marginTop: 4 }}>
                  <option value="Health">Health &amp; Medical Expense</option>
                  <option value="Accident">Workplace Accident Cover</option>
                  <option value="Tool Loss">Tool Damage &amp; Replacement</option>
                  <option value="Education">Children's Cooperative Scholarship</option>
                </select>
              </label>

              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Claim Amount Requested
                <input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} style={{ display: "block", width: "100%", border: "1px solid var(--border)", background: "var(--ivory)", borderRadius: 8, padding: 9, marginTop: 4 }} />
              </label>

              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Incident Summary / Bill Details
                <textarea rows={3} placeholder="Please summarize the incident and doctor/hospital/repair receipt details..." style={{ display: "block", width: "100%", border: "1px solid var(--border)", background: "var(--ivory)", borderRadius: 8, padding: 9, marginTop: 4 }} />
              </label>
            </div>

            <Button onClick={handleFileClaim} icon={<ShieldCheck size={14} />}>Submit Claim to Society Desk</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingFormModal({ worker, close, confirm }: { worker: typeof workers[number]; close: () => void; confirm: (booking: { date: string; time: string; emergency: boolean; paymentMethod: string; paymentStatus: string; paymentTxRef?: string; createdAtTimestamp?: number; cancellationDeadline?: number; workerAcceptDeadline?: number }) => void }) {
  const { bookings: demoBookings } = useDemoStore();
  const isBusy = isWorkerBusy(worker, demoBookings);
  const [emergency, setEmergency] = useState(false);
  const [date, setDate] = useState("Today, 04 Sep");
  const [time, setTime] = useState("4:30 PM");
  const [description, setDescription] = useState("Please inspect the issue and share a clear estimate before work begins.");
  const [settlementChoice, setSettlementChoice] = useState<"Cash" | "Online">("Cash");

  const handleConfirm = () => {
    if (isBusy) {
      toast.error(`${worker.name} is currently busy on an active job. Please select another available cooperative worker.`);
      return;
    }
    const cashPin = `CASH_PIN_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = Date.now();
    confirm({
      date,
      time,
      emergency,
      paymentMethod: settlementChoice === "Cash" ? "Cash on Completion" : "Platform Online (UPI/Card)",
      paymentStatus: "Pending",
      paymentTxRef: settlementChoice === "Cash" ? cashPin : undefined,
      createdAtTimestamp: now,
      cancellationDeadline: now + 5 * 60 * 1000,
      workerAcceptDeadline: now + 5 * 60 * 1000,
    });
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="booking-modal booking-form-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="close-button" onClick={close}><X size={17} /></button>
        <p className="eyebrow"><span /> BOOK A VERIFIED WORKER</p>
        <h2>Set up the handoff.</h2>
        <p className="modal-intro">Tell {worker.name} when to arrive and what needs attention. Zero advance payment is required.</p>

        <div className="booking-worker booking-form-worker">
          <Avatar initials={worker.initials} tone={worker.accent} />
          <div>
            <strong>{worker.name}</strong>
            <small>{worker.service} · {worker.area}</small>
          </div>
          <Status value="Verified" />
        </div>

        <div className="booking-form-grid">
          <label>
            Date
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option>Today, 04 Sep</option>
              <option>Tomorrow, 05 Sep</option>
              <option>06 Sep</option>
            </select>
          </label>
          <label>
            Time slot
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              <option>4:30 PM</option>
              <option>6:00 PM</option>
              <option>7:30 PM</option>
            </select>
          </label>
        </div>

        <label className="booking-description">
          What needs doing?
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description helps the worker arrive prepared."
          />
        </label>

        <div className={`emergency-toggle ${emergency ? "selected" : ""}`}>
          <div>
            <strong><Zap size={14} /> Is this urgent?</strong>
            <small>Emergency bookings are visibly flagged for the worker and cooperative.</small>
          </div>
          <button type="button" onClick={() => setEmergency(!emergency)} aria-pressed={emergency}><span /></button>
        </div>

        <div className="estimate-card">
          <div>
            <small>Fixed rate-card estimate</small>
            <strong>{worker.rate}</strong>
          </div>
          <span>{emergency ? "Emergency flag" : "Standard visit"}</span>
        </div>

        {/* Settlement Preference: Pay on Visit */}
        <div className="payment-choice-section">
          <div className="payment-choice-header">
            <span className="eyebrow" style={{ fontSize: 10, letterSpacing: '0.08em', margin: 0 }}>
              <span /> SETTLEMENT PREFERENCE (PAY ON VISIT)
            </span>
            <span style={{ fontSize: 10, color: 'var(--forest)', fontWeight: 600, background: 'var(--teal-soft)', padding: '2px 8px', borderRadius: 999 }}>
              🛡️ Zero Upfront Payment
            </span>
          </div>

          <div style={{ background: "rgba(23,107,98,.06)", border: "1px solid rgba(23,107,98,.16)", borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 11, color: "var(--forest-dark)", lineHeight: 1.45 }}>
            <strong>No advance charge:</strong> If the worker does not arrive, you are never charged. Payment of {worker.rate} will be made through the platform or in cash only after {worker.name} completes the service at your address.
          </div>

          <div className="payment-choice-grid">
            <button
              type="button"
              className={`payment-choice-card cash-card ${settlementChoice === "Cash" ? "active" : ""}`}
              onClick={() => setSettlementChoice("Cash")}
            >
              <div className="payment-choice-radio"><span /></div>
              <div className="payment-choice-icon-wrap" style={{ background: "rgba(200,148,57,.15)", color: "var(--brass)" }}>
                <Coins size={18} />
              </div>
              <div className="payment-choice-body">
                <div className="payment-choice-title">
                  <strong>Cash on Completion</strong>
                  <span className="badge-pill" style={{ background: "var(--brass-soft)", color: "#7a5c1c" }}>Doorstep</span>
                </div>
                <p>Pay {worker.rate} in physical cash to worker upon completion. PIN voucher generated.</p>
              </div>
            </button>

            <button
              type="button"
              className={`payment-choice-card ${settlementChoice === "Online" ? "active" : ""}`}
              onClick={() => setSettlementChoice("Online")}
            >
              <div className="payment-choice-radio"><span /></div>
              <div className="payment-choice-icon-wrap" style={{ background: "var(--teal-soft)", color: "var(--forest)" }}>
                <CreditCard size={18} />
              </div>
              <div className="payment-choice-body">
                <div className="payment-choice-title">
                  <strong>Online on Completion</strong>
                  <span className="badge-pill" style={{ background: "var(--teal-soft)", color: "var(--forest)" }}>Platform</span>
                </div>
                <p>Pay via UPI QR/Apps, Card (3D Secure), or Net Banking on the platform after visit.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Cancellation & Worker Response Rules Notice */}
        <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", margin: "12px 0 16px", fontSize: 11, color: "var(--ink-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            <Clock3 size={14} style={{ color: "var(--forest)" }} /> Cooperative Fair Scheduling Rules
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5, fontSize: 10.5 }}>
            <li><b>5-Minute Free Cancellation:</b> You have 5 minutes to cancel freely after booking. After 5 mins, a ₹50 worker travel &amp; reserved schedule compensation fee applies if cancelled.</li>
            <li><b>5-Minute Worker Acceptance:</b> Worker must accept within 5 minutes; otherwise the request is automatically cancelled at zero charge so you can pick another worker right away.</li>
          </ul>
        </div>

        <div style={{ paddingBottom: 16, marginTop: 8 }}>
          {isBusy ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ padding: "10px 14px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 8, color: "#92400e", fontSize: 11, fontWeight: 600 }}>
                ⚠️ {worker.name} is currently busy on an active job. You cannot place a booking right now. Please choose another available worker.
              </div>
              <Button variant="secondary" onClick={close} icon={<Search size={14} />}>
                Find Another Available Worker
              </Button>
            </div>
          ) : (
            <Button onClick={handleConfirm} icon={<ArrowRight size={15} />}>
              Confirm Booking (Zero Advance · Settle on Visit)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


function PaymentGateway({ booking, onComplete }: { booking: DemoBooking; onComplete: (method: string, txRef: string) => void }) {
  const [method, setMethod] = useState<"Razorpay" | "UPI" | "Card" | "NetBanking" | "Cash">("Razorpay");
  const [razorpaySubMethod, setRazorpaySubMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [razorpayUpiApp, setRazorpayUpiApp] = useState("Google Pay");
  const [upiMode, setUpiMode] = useState<"qr" | "vpa">("qr");
  const [upiVpa, setUpiVpa] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState(booking.customerName || "");
  const [cardStep, setCardStep] = useState<"details" | "otp">("details");
  const [otp, setOtp] = useState("");
  const [selectedBank, setSelectedBank] = useState("HDFC Bank");
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  const handlePayRazorpay = async () => {
    const numericAmount = parseInt((booking.amount ?? "350").replace(/\D/g, "")) || 350;
    const amountInPaise = Math.max(numericAmount * 100, 100);

    setProcessing(true);
    setProcessMsg("Creating secure Razorpay order...");

    try {
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `rcpt_${booking.id.replace(/\D/g, "") || Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order_id) {
        throw new Error(orderData.error || "Failed to create Razorpay order");
      }

      if (typeof (window as any).Razorpay !== "function") {
        throw new Error("Razorpay SDK not loaded. Please refresh and check your internet connection.");
      }

      const keyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "rzp_test_Tdvd2AkbOubLSt";

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Co-Labour (Sahaay)",
        description: `Settlement for ${booking.service} by ${booking.worker}`,
        order_id: orderData.order_id,
        image: "/co-labour-logo.svg",
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          setProcessing(true);
          setProcessMsg("Verifying payment signature with server...");
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              toast.success("Payment verified successfully via Razorpay!", {
                description: `Payment ID: ${response.razorpay_payment_id}`,
              });
              onComplete("Razorpay", response.razorpay_payment_id);
            } else {
              toast.error(verifyData.error || "Payment signature verification failed");
            }
          } catch (err: any) {
            toast.error(`Verification error: ${err.message}`);
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: booking.customerName || "Customer",
          email: "customer@sahaay.org",
          contact: "9876543210",
        },
        notes: {
          booking_id: booking.id,
          service: booking.service,
          worker: booking.worker,
        },
        theme: {
          color: "#0C2340",
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (failResponse: any) {
        setProcessing(false);
        toast.error(`Payment Failed: ${failResponse.error?.description || "Transaction declined"}`);
      });

      setProcessing(false);
      rzp.open();
    } catch (err: any) {
      setProcessing(false);
      toast.error(err.message || "Failed to initiate Razorpay checkout");
    }
  };

  const handlePayUPI = () => {
    setProcessing(true);
    setProcessMsg("Connecting to National Payments Corporation of India (NPCI) Switch...");
    setTimeout(() => {
      setProcessMsg("UPI PIN Verified · Payment Authorized...");
      setTimeout(() => {
        setProcessing(false);
        onComplete("UPI", `TXN_UPI_${Date.now().toString().slice(-8)}`);
      }, 850);
    }, 1100);
  };

  const handlePayCard = () => {
    if (cardStep === "details") {
      setCardStep("otp");
      return;
    }
    setProcessing(true);
    setProcessMsg("Authenticating 3D Secure with Issuing Bank...");
    setTimeout(() => {
      setProcessMsg("Transaction Authorized · Receipt Certified...");
      setTimeout(() => {
        setProcessing(false);
        onComplete("Card", `TXN_CARD_${Date.now().toString().slice(-8)}`);
      }, 850);
    }, 1100);
  };

  const handlePayNetBanking = () => {
    setProcessing(true);
    setProcessMsg(`Connecting securely to ${selectedBank}...`);
    setTimeout(() => {
      setProcessMsg("NetBanking Credentials Verified · Payment Successful...");
      setTimeout(() => {
        setProcessing(false);
        onComplete("NetBanking", `TXN_NB_${Date.now().toString().slice(-8)}`);
      }, 850);
    }, 1100);
  };

  const handleConfirmCash = () => {
    setProcessing(true);
    setProcessMsg("Generating Doorstep Cash Handover Voucher...");
    setTimeout(() => {
      setProcessing(false);
      onComplete("Cash", `CASH_PIN_${Math.floor(1000 + Math.random() * 9000)}`);
    }, 700);
  };

  const copyUpiId = () => {
    navigator.clipboard?.writeText("sahaay.coop@okhdfcbank");
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <div className="gateway-wrap">
      <div className="gateway-header">
        <strong><ShieldCheck size={16} /> Cooperative Payment Gateway</strong>
        <span>256-bit Encrypted · 0% Surge</span>
      </div>

      <div style={{ padding: "12px 18px", background: "var(--ivory)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <small style={{ display: "block", color: "var(--muted-foreground)", fontSize: 10 }}>Total Amount Due</small>
          <strong style={{ fontSize: 20, color: "var(--ink)", fontFamily: '"Manrope", sans-serif' }}>{booking.amount}</strong>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "var(--ink-soft)" }}>
          <div>Worker Net (90%): <b>₹{calculateEarningsSplit(booking.amount).netPayout}</b></div>
          <div style={{ color: "var(--forest)" }}>Coop Emergency Fund (10%): <b>₹{calculateEarningsSplit(booking.amount).emergencyCut}</b></div>
        </div>
      </div>

      <div className="gateway-methods">
        <button type="button" className={`gateway-method-btn ${method === "Razorpay" ? "active" : ""}`} onClick={() => setMethod("Razorpay")}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{ background: "#0c83ff", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 3 }}>R</span>
          </div>
          <span>Razorpay</span>
        </button>
        <button type="button" className={`gateway-method-btn ${method === "UPI" ? "active" : ""}`} onClick={() => setMethod("UPI")}>
          <QrCode size={16} />
          <span>UPI / QR</span>
        </button>
        <button type="button" className={`gateway-method-btn ${method === "Card" ? "active" : ""}`} onClick={() => setMethod("Card")}>
          <CreditCard size={16} />
          <span>Card</span>
        </button>
        <button type="button" className={`gateway-method-btn ${method === "NetBanking" ? "active" : ""}`} onClick={() => setMethod("NetBanking")}>
          <Building2 size={16} />
          <span>Net Banking</span>
        </button>
        <button type="button" className={`gateway-method-btn ${method === "Cash" ? "active" : ""}`} onClick={() => setMethod("Cash")}>
          <Coins size={16} />
          <span>Cash on Hand</span>
        </button>
      </div>

      <div className="gateway-body">
        {processing ? (
          <div style={{ padding: "36px 16px", textAlign: "center" }}>
            <div className="pulse-radar" style={{ margin: "0 auto 16px", padding: "6px 14px" }}>
              <i style={{ background: "var(--forest)" }} /> PROCESSING
            </div>
            <strong style={{ display: "block", fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>{processMsg}</strong>
            <small style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Please do not refresh or close this window.</small>
          </div>
        ) : (
          <>
            {method === "Razorpay" && (
              <div className="razorpay-card">
                <div className="razorpay-header">
                  <div className="razorpay-brand">
                    <span className="razorpay-logo-badge">
                      <Zap size={11} fill="#fff" /> Razorpay
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>DEMO CHECKOUT</span>
                  </div>
                  <div className="razorpay-amount-box">
                    <span>Payable Amount</span>
                    <strong>{booking.amount}.00</strong>
                  </div>
                </div>

                <div className="razorpay-body">
                  <div className="razorpay-merchant-info">
                    <div>
                      <strong style={{ display: "block", color: "var(--ink)", fontSize: 12 }}>Co-Labour Cooperative Society</strong>
                      <small style={{ color: "var(--muted-foreground)" }}>Settlement for {booking.service} by {booking.worker}</small>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 10, color: "var(--forest)", fontWeight: 700 }}>
                      90% Direct Worker Payout · 10% Coop Emergency Fund
                    </div>
                  </div>

                  {/* Razorpay Sub Methods */}
                  <div className="razorpay-tabs">
                    <button
                      type="button"
                      className={`razorpay-tab ${razorpaySubMethod === "upi" ? "active" : ""}`}
                      onClick={() => setRazorpaySubMethod("upi")}
                    >
                      Razorpay UPI
                    </button>
                    <button
                      type="button"
                      className={`razorpay-tab ${razorpaySubMethod === "card" ? "active" : ""}`}
                      onClick={() => setRazorpaySubMethod("card")}
                    >
                      Cards (Visa/MC)
                    </button>
                    <button
                      type="button"
                      className={`razorpay-tab ${razorpaySubMethod === "netbanking" ? "active" : ""}`}
                      onClick={() => setRazorpaySubMethod("netbanking")}
                    >
                      NetBanking
                    </button>
                  </div>

                  {razorpaySubMethod === "upi" && (
                    <div>
                      <small style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
                        Select Preferred UPI App via Razorpay:
                      </small>
                      <div className="razorpay-test-pills">
                        {["Google Pay", "PhonePe", "Paytm", "BHIM UPI", "CRED UPI"].map((app) => (
                          <button
                            key={app}
                            type="button"
                            className="razorpay-pill"
                            style={{
                              background: razorpayUpiApp === app ? "#0c2340" : undefined,
                              color: razorpayUpiApp === app ? "#fff" : undefined,
                              borderColor: razorpayUpiApp === app ? "#0c2340" : undefined,
                            }}
                            onClick={() => setRazorpayUpiApp(app)}
                          >
                            {app}
                          </button>
                        ))}
                      </div>
                      <div style={{ background: "var(--ivory)", padding: "10px 12px", borderRadius: 8, fontSize: 11, marginBottom: 14, border: "1px solid var(--border)" }}>
                        Selected App: <b>{razorpayUpiApp}</b> · 1-click demo payment simulates authentic Razorpay order capture.
                      </div>
                    </div>
                  )}

                  {razorpaySubMethod === "card" && (
                    <div>
                      <small style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
                        Razorpay Test Card (Auto-filled for sandbox demo):
                      </small>
                      <div style={{ background: "var(--ivory)", padding: "10px 14px", borderRadius: 8, fontSize: 11, marginBottom: 14, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>4532 •••• •••• 4118</div>
                          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Exp: 09/28 · CVV: 482 · Cardholder: {booking.customerName || "Suyash Sharma"}</div>
                        </div>
                        <span style={{ fontSize: 10, background: "rgba(23,107,98,.12)", color: "var(--forest)", fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                          TEST CARD
                        </span>
                      </div>
                    </div>
                  )}

                  {razorpaySubMethod === "netbanking" && (
                    <div>
                      <small style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>
                        Supported Banks via Razorpay:
                      </small>
                      <div className="razorpay-test-pills">
                        {["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank", "Kotak Bank"].map((b) => (
                          <button
                            key={b}
                            type="button"
                            className="razorpay-pill"
                            style={{
                              background: selectedBank === b ? "#0c2340" : undefined,
                              color: selectedBank === b ? "#fff" : undefined,
                              borderColor: selectedBank === b ? "#0c2340" : undefined,
                            }}
                            onClick={() => setSelectedBank(b)}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handlePayRazorpay} icon={<Zap size={14} />}>
                    Pay {booking.amount} with Razorpay
                  </Button>

                  <div className="razorpay-trust-footer">
                    <span>🛡️ Razorpay Certified 256-bit SSL</span>
                    <span>Demo Mode · Direct Worker Credit</span>
                  </div>
                </div>
              </div>
            )}
            {method === "UPI" && (
              <div className="upi-qr-box">
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button type="button" className={`app-button ${upiMode === 'qr' ? 'primary' : 'secondary'}`} style={{ padding: "6px 12px", fontSize: 10 }} onClick={() => setUpiMode("qr")}>Scan QR Code</button>
                  <button type="button" className={`app-button ${upiMode === 'vpa' ? 'primary' : 'secondary'}`} style={{ padding: "6px 12px", fontSize: 10 }} onClick={() => setUpiMode("vpa")}>Enter UPI ID</button>
                </div>

                {upiMode === "qr" ? (
                  <>
                    <div className="upi-qr-svg">
                      <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
                        <rect width="140" height="140" fill="white" rx="8" />
                        <rect x="14" y="14" width="36" height="36" rx="4" fill="#176B62" />
                        <rect x="20" y="20" width="24" height="24" rx="2" fill="white" />
                        <rect x="26" y="26" width="12" height="12" fill="#176B62" />
                        <rect x="90" y="14" width="36" height="36" rx="4" fill="#176B62" />
                        <rect x="96" y="20" width="24" height="24" rx="2" fill="white" />
                        <rect x="102" y="26" width="12" height="12" fill="#176B62" />
                        <rect x="14" y="90" width="36" height="36" rx="4" fill="#176B62" />
                        <rect x="20" y="96" width="24" height="24" rx="2" fill="white" />
                        <rect x="26" y="102" width="12" height="12" fill="#176B62" />
                        <circle cx="70" cy="70" r="14" fill="#176B62" />
                        <circle cx="70" cy="70" r="8" fill="#FFFDF8" />
                        <circle cx="70" cy="70" r="4" fill="#176B62" />
                        <rect x="58" y="20" width="6" height="16" fill="#2C362B" />
                        <rect x="74" y="26" width="8" height="6" fill="#2C362B" />
                        <rect x="58" y="104" width="8" height="14" fill="#2C362B" />
                        <rect x="74" y="96" width="14" height="6" fill="#2C362B" />
                        <rect x="94" y="60" width="14" height="6" fill="#2C362B" />
                        <rect x="114" y="74" width="12" height="14" fill="#2C362B" />
                        <rect x="20" y="62" width="14" height="6" fill="#2C362B" />
                        <rect x="36" y="74" width="6" height="10" fill="#2C362B" />
                      </svg>
                    </div>
                    <div className="upi-id-pill">
                      <span>sahaay.coop@okhdfcbank</span>
                      <button type="button" onClick={copyUpiId} style={{ border: 0, background: "none", color: "var(--forest)", display: "flex", alignItems: "center", gap: 4 }}>
                        {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                        <span style={{ fontSize: 9 }}>{copiedUpi ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="upi-apps-row">
                      <span className="upi-app-chip" onClick={handlePayUPI}>Google Pay</span>
                      <span className="upi-app-chip" onClick={handlePayUPI}>PhonePe</span>
                      <span className="upi-app-chip" onClick={handlePayUPI}>Paytm</span>
                      <span className="upi-app-chip" onClick={handlePayUPI}>BHIM UPI</span>
                      <span className="upi-app-chip" onClick={handlePayUPI}>CRED</span>
                    </div>
                    <Button onClick={handlePayUPI} icon={<Zap size={14} />}>Simulate App Payment ({booking.amount})</Button>
                  </>
                ) : (
                  <div style={{ width: "100%", maxWidth: 360, textAlign: "left", margin: "0 auto" }}>
                    <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 6 }}>Enter Virtual Payment Address (VPA / UPI ID)</label>
                    <input style={{ width: "100%", border: "1px solid var(--border)", background: "var(--ivory)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--ink)", marginBottom: 12 }} value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="e.g. yourname@okhdfcbank" />
                    <Button onClick={handlePayUPI} icon={<ArrowRight size={14} />}>Verify &amp; Pay {booking.amount}</Button>
                  </div>
                )}
              </div>
            )}

            {method === "Card" && (
              <>
                {cardStep === "details" ? (
                  <>
                    <div className="card-preview">
                      <div className="card-chip">CHIP</div>
                      <div className="card-num">{cardNumber || "•••• •••• •••• ••••"}</div>
                      <div className="card-foot">
                        <div><small style={{ display: "block", fontSize: 8, opacity: 0.7 }}>CARDHOLDER</small><strong>{cardName || "MEMBER"}</strong></div>
                        <div><small style={{ display: "block", fontSize: 8, opacity: 0.7 }}>EXPIRES</small><strong>{cardExpiry || "MM/YY"}</strong></div>
                      </div>
                    </div>
                    <div className="card-inputs-grid">
                      <div className="profile-full-width">
                        <label>Card Number</label>
                        <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4532 8821 9023 4118" maxLength={19} />
                      </div>
                      <div>
                        <label>Valid Thru (MM/YY)</label>
                        <input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" maxLength={5} />
                      </div>
                      <div>
                        <label>CVV / CVC</label>
                        <input type="password" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="•••" maxLength={4} />
                      </div>
                      <div className="profile-full-width">
                        <label>Name on Card</label>
                        <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Cardholder Name" />
                      </div>
                    </div>
                    <Button onClick={handlePayCard} icon={<Lock size={14} />}>Proceed to 3D Secure OTP ({booking.amount})</Button>
                  </>
                ) : (
                  <div className="otp-screen">
                    <ShieldCheck size={32} style={{ color: "var(--forest)", margin: "0 auto 10px" }} />
                    <h4>Bank 3D Secure Verification</h4>
                    <p>Enter the 6-digit OTP sent to your registered mobile (+91 98***)</p>
                    <input className="otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <Button variant="secondary" onClick={() => setCardStep("details")}>Back</Button>
                      <Button onClick={handlePayCard} icon={<Check size={14} />}>Authorize {booking.amount}</Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {method === "NetBanking" && (
              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 8 }}>Select your bank for instant direct debit:</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Punjab National Bank"].map((b) => (
                    <button type="button" key={b} onClick={() => setSelectedBank(b)} style={{ border: "1px solid var(--border)", background: selectedBank === b ? "var(--teal-soft)" : "var(--paper)", borderColor: selectedBank === b ? "var(--forest)" : "var(--border)", borderRadius: 8, padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: selectedBank === b ? 600 : 400, cursor: "pointer" }}>
                      {b}
                    </button>
                  ))}
                </div>
                <Button onClick={handlePayNetBanking} icon={<Building2 size={14} />}>Pay via {selectedBank} ({booking.amount})</Button>
              </div>
            )}

            {method === "Cash" && (
              <div className="cash-voucher-card">
                <div className="cash-voucher-head">
                  <strong><Coins size={15} /> Cooperative Doorstep Cash Voucher</strong>
                  <Status value="Handover Ready" />
                </div>
                <p style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 10px" }}>
                  Hand over exactly <b>{booking.amount}</b> in physical cash directly to <b>{booking.worker}</b> upon completion of work.
                </p>
                <div className="cash-pin-box">
                  <span>Cooperative Verification PIN (Share with Worker)</span>
                  <strong>{Math.floor(2000 + (booking.id.charCodeAt(3) || 5) * 63)}</strong>
                </div>
                <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 10, color: "var(--muted-foreground)", marginBottom: 12 }}>
                  🛡️ <b>Fair Labor Guarantee:</b> 90% direct payout to worker, 10% saved in Cooperative Society Bank for emergency support. Zero middleman fees.
                </div>
                <Button onClick={handleConfirmCash} icon={<Check size={14} />}>Generate Cash Receipt Voucher</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BookingDetailModal({
  booking,
  role,
  close,
  advance,
  recordRating,
  go,
}: {
  booking: DemoBooking;
  role: Role;
  close: () => void;
  advance: (status: string, extra?: { paymentMethod?: string; paymentStatus?: string; paymentTxRef?: string; cancelFeeApplied?: boolean; cancelReason?: string }) => void;
  recordRating: (workerName: string, stars: number, comment?: string, bookingId?: string) => void;
  go?: (screen: Screen) => void;
}) {
  const { profile } = useAuth();
  const { updateBooking } = useDemoStore();
  const [paymentInfo, setPaymentInfo] = useState<{ paid: boolean; method: string; txRef: string } | null>(() => {
    if (booking.paymentStatus === "Paid" && booking.paymentMethod) {
      return { paid: true, method: booking.paymentMethod, txRef: booking.paymentTxRef || `TXN_${booking.id.replace(/\D/g, '') || '7891'}` };
    }
    return null;
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const [showAdminInvoice, setShowAdminInvoice] = useState(false);
  const cancelCountdown = useCountdown(booking.cancellationDeadline);
  const acceptCountdown = useCountdown(booking.workerAcceptDeadline);

  const stages = ["Requested", "Accepted", "En Route", "In Progress", "Completed"];
  const current = booking.status === "Cancelled" ? -1 : Math.max(0, stages.indexOf(booking.status));
  const next = current >= 0 ? stages[current + 1] : undefined;

  const isPaid = !!paymentInfo || booking.paymentStatus === "Paid";
  const activeMethod = paymentInfo?.method || booking.paymentMethod || "Razorpay";
  const activeTxRef = paymentInfo?.txRef || booking.paymentTxRef || `TXN_${booking.id.replace(/\D/g, '') || '7891'}`;

  // Auto-cancellation when worker does not accept within the 5-minute window
  useEffect(() => {
    if (booking.status === "Requested" && acceptCountdown.isExpired && booking.workerAcceptDeadline) {
      advance("Cancelled", {
        cancelFeeApplied: false,
        cancelReason: "Worker Unresponsive — Auto-Cancelled after 5 minutes (Zero Charge)",
      });
    }
  }, [booking.status, acceptCountdown.isExpired, booking.workerAcceptDeadline, advance]);

  const handlePaymentComplete = (method: string, txRef: string) => {
    setPaymentInfo({ paid: true, method, txRef });
    updateBooking(booking.id, booking.status, { paymentMethod: method, paymentStatus: "Paid", paymentTxRef: txRef });
  };

  // Pure details view for Cooperative Admin: no worker assignment or payment settlement controls, clean & uncluttered
  if (role === "Admin") {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Dispatch detail ${booking.id}`} onClick={close}>
        <div className="booking-modal detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
          <button className="close-button" onClick={close}><X size={17} /></button>
          <p className="eyebrow"><span /> DISPATCH DETAILS</p>
          <div className="modal-title-row">
            <div>
              <h2>{booking.id.startsWith("BK-") ? booking.id : `Booking #${booking.id.slice(0, 8).toUpperCase()}`}</h2>
              <p>{booking.service} · {booking.date}</p>
            </div>
            <Status value={booking.status} />
          </div>

          {booking.emergency && (
            <div className="emergency-banner" style={{ margin: "10px 0 12px" }}>
              <Zap size={14} />
              <span><strong>Emergency Dispatch</strong> Priority response flagged.</span>
            </div>
          )}

          <div className="modal-detail-grid" style={{ marginTop: 12 }}>
            <div><small>Assigned Worker</small><strong>{booking.worker}</strong></div>
            <div><small>Customer</small><strong>{booking.customerName || "Customer"}</strong></div>
            <div><small>Tariff</small><strong>{booking.amount}</strong></div>
            <div>
              <small>Payment</small>
              <strong style={{ color: isPaid ? "var(--forest)" : "inherit" }}>
                {isPaid ? `Paid (${activeMethod})` : "Pending Settlement"}
              </strong>
            </div>
            <div><small>Area</small><strong>Gurugram</strong></div>
            <div><small>Tx Reference</small><strong style={{ fontFamily: "monospace", fontSize: 11 }}>{activeTxRef}</strong></div>
          </div>

          {/* Clean Progress Rail */}
          <div className="modal-progress" style={{ margin: "16px 0 14px" }}>
            <div className="progress-rail">{stages.map((stage, i) => <span key={stage} className={i < current ? "done" : i === current ? "current" : ""} />)}</div>
            <div className="progress-labels">{stages.map((stage) => <span key={stage}>{stage}</span>)}</div>
          </div>

          {booking.status === "Cancelled" && (
            <div style={{ background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <small style={{ color: "var(--muted-foreground)", display: "block" }}>Cancellation Reason</small>
              <strong style={{ fontSize: 11.5, color: "var(--danger)" }}>{booking.cancelReason || "Cancelled by member"}</strong>
              {booking.cancelFeeApplied && <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>Late compensation fee: ₹50</span>}
            </div>
          )}

          {isPaid && (
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="link-button"
                onClick={() => setShowAdminInvoice(!showAdminInvoice)}
                style={{ fontSize: 11 }}
              >
                {showAdminInvoice ? "Hide Invoice Details ↑" : "View Official Invoice Details →"}
              </button>
              {showAdminInvoice && (
                <div style={{ marginTop: 10, background: "var(--ivory)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Invoice Ref: <b>INV-2026-{booking.id.replace(/\D/g, '') || '7891'}</b></span>
                    <span className="status status-good" style={{ fontSize: 10 }}>Paid</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-soft)" }}>
                    <span>Fixed Diagnostic &amp; Visit Tariff</span>
                    <strong>{booking.amount}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--forest)", marginTop: 4 }}>
                    <span>Cooperative Platform Fee (0%)</span>
                    <strong>₹0</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clean Actions: Close & Export log */}
          <div className="modal-actions" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                const blob = new Blob([
                  `Co-Labour Cooperative Dispatch Details\r\n` +
                  `ID: ${booking.id}\r\nWorker: ${booking.worker}\r\nCustomer: ${booking.customerName || 'N/A'}\r\nService: ${booking.service}\r\nDate: ${booking.date}\r\nAmount: ${booking.amount}\r\nStatus: ${booking.status}\r\nPayment: ${isPaid ? 'Paid' : 'Pending'}\r\nTxRef: ${activeTxRef}\r\n`
                ], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `dispatch_${booking.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Dispatch details downloaded");
              }}
              style={{ fontSize: 11 }}
            >
              <Download size={13} style={{ marginRight: 4 }} /> Export Log
            </button>
            <Button variant="secondary" onClick={close}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Booking detail ${booking.id}`} onClick={close}>
      <div className="booking-modal detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <button className="close-button" onClick={close}><X size={17} /></button>
        <p className="eyebrow"><span /> BOOKING DETAIL</p>
        <div className="modal-title-row">
          <div>
            <h2>{booking.id.startsWith("BK-") ? booking.id : `Booking #${booking.id.slice(0, 8).toUpperCase()}`}</h2>
            <p>{booking.worker} · {booking.service} {booking.customerName ? `· Customer: ${booking.customerName}` : ""}</p>
          </div>
          <Status value={booking.status} />
        </div>

        {booking.emergency && (
          <div className="emergency-banner">
            <Zap size={15} />
            <span><strong>Emergency booking</strong><small>This request is flagged for faster attention.</small></span>
          </div>
        )}

        {/* 3-Minute Worker Response Banner */}
        {booking.status === "Requested" && (
          <div style={{ margin: "12px 0 8px", padding: "10px 14px", background: "rgba(200,148,57,.09)", border: "1px solid rgba(200,148,57,.22)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pulse-radar" style={{ background: "rgba(200,148,57,.18)", color: "#7a5c1c" }}>
                <i style={{ background: "#c89439" }} /> CONNECTING
              </span>
              <span style={{ fontSize: 11, color: "#7a5c1c", fontWeight: 600 }}>
                {role === "Worker" ? "Incoming Customer Request" : `Awaiting ${booking.worker}'s response`}
              </span>
            </div>
            <span className="worker-timer-pill">
              <Clock3 size={12} /> Auto-cancels in {acceptCountdown.formatted}
            </span>
          </div>
        )}

        {booking.status === "En Route" && (
          <div style={{ margin: "12px 0 8px", padding: "10px 14px", background: "var(--teal-soft)", borderRadius: 9, display: "flex", alignItems: "center", gap: 9 }}>
            <span className="pulse-radar"><i></i> ON THE WAY</span>
            <span style={{ fontSize: 11, color: "var(--forest-dark)", fontWeight: 600 }}>{booking.worker} is en route · Estimated arrival in 15 mins</span>
          </div>
        )}

        {booking.status === "In Progress" && (
          <div style={{ margin: "12px 0 8px", padding: "10px 14px", background: "var(--brass-soft)", borderRadius: 9, display: "flex", alignItems: "center", gap: 9 }}>
            <span className="pulse-radar" style={{ background: "rgba(200,148,57,.18)", color: "#7a5c1c" }}><i style={{ background: "#c89439" }}></i> IN PROGRESS</span>
            <span style={{ fontSize: 11, color: "#7a5c1c", fontWeight: 600 }}>Service actively underway · Rate-card fixed estimate applies</span>
          </div>
        )}

        {booking.paymentStatus === "Paid" && (
          <div style={{ margin: "10px 0 8px", padding: "9px 13px", background: "var(--teal-soft)", borderRadius: 9, display: "flex", alignItems: "center", gap: 9 }}>
            <ShieldCheck size={16} style={{ color: "var(--forest)" }} />
            <span style={{ fontSize: 11, color: "var(--forest-dark)", fontWeight: 600 }}>
              Payment Settled &amp; Certified ({booking.amount}) · Held safely by Cooperative
            </span>
          </div>
        )}

        {booking.paymentMethod?.includes("Cash") && booking.paymentStatus !== "Paid" && (
          <div style={{ margin: "10px 0 8px", padding: "9px 13px", background: "var(--brass-soft)", borderRadius: 9, display: "flex", alignItems: "center", gap: 9 }}>
            <Coins size={16} style={{ color: "#7a5c1c" }} />
            <span style={{ fontSize: 11, color: "#7a5c1c", fontWeight: 600 }}>
              Cash on Completion ({booking.amount}) · Direct doorstep settlement {booking.paymentTxRef ? `· PIN: ${booking.paymentTxRef.replace('CASH_PIN_', '')}` : ''}
            </span>
          </div>
        )}

        {/* Worker Acceptance Window (5 minutes auto-cancel) */}
        {booking.status === "Requested" && (
          <div style={{ margin: "10px 0 12px", padding: "10px 14px", background: "rgba(200,148,57,.08)", border: "1px solid rgba(200,148,57,.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock3 size={16} style={{ color: "#7a5c1c", flexShrink: 0 }} />
              <div>
                <strong style={{ display: "block", fontSize: 12, color: "#7a5c1c" }}>
                  Worker Response Window: {acceptCountdown.formatted} remaining
                </strong>
                <span style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
                  If {booking.worker} does not respond within 5 minutes, this booking will automatically cancel and release you at zero charge.
                </span>
              </div>
            </div>
            <span style={{ background: "rgba(200,148,57,.18)", color: "#7a5c1c", padding: "3px 8px", borderRadius: 999, fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
              Auto-cancel in 5m
            </span>
          </div>
        )}

        {/* 5-Minute Free Cancellation Window Banner for Customer */}
        {role === "Customer" && booking.status !== "Requested" && booking.status !== "Completed" && booking.status !== "Cancelled" && (
          <>
            {!cancelCountdown.isExpired ? (
              <div className="cancel-timer-banner active">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock3 size={15} style={{ color: "var(--forest)", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block", color: "var(--forest-dark)" }}>
                      5-Minute Free Cancellation Window: {cancelCountdown.formatted} remaining
                    </strong>
                    <span style={{ fontSize: 10.5, color: "var(--forest-dark)", opacity: 0.85 }}>
                      Zero penalty within 5 minutes. After this window, a ₹50 worker travel fee applies.
                    </span>
                  </div>
                </div>
                <span style={{ background: "rgba(23,107,98,.15)", color: "var(--forest)", padding: "3px 8px", borderRadius: 999, fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                  ₹0 Fee
                </span>
              </div>
            ) : (
              <div className="cancel-timer-banner expired">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={15} style={{ color: "#7a5c1c", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block" }}>Free Cancellation Window Expired</strong>
                    <span style={{ fontSize: 10.5 }}>
                      Worker has reserved this slot. Cancelling now incurs a ₹50 worker travel &amp; schedule fee.
                    </span>
                  </div>
                </div>
                <span style={{ background: "rgba(200,148,57,.2)", color: "#7a5c1c", padding: "3px 8px", borderRadius: 999, fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                  ₹50 Fee
                </span>
              </div>
            )}
          </>
        )}

        <div className="modal-detail-grid">
          <div><small>When</small><strong>{booking.date}</strong></div>
          <div><small>Estimate</small><strong>{booking.amount}</strong></div>
          <div><small>Payment</small><strong>{isPaid ? (activeMethod === "Cash" ? "Cash Voucher Certified" : `Paid via ${activeMethod}`) : booking.paymentMethod?.includes("Cash") ? "Cash on Completion" : (booking.status === "Completed" ? "Due now" : "Settle on Completion")}</strong></div>
          <div><small>Area</small><strong>Gurugram</strong></div>
        </div>

        <div className="modal-progress">
          <div className="progress-rail">{stages.map((stage, i) => <span key={stage} className={i < current ? "done" : i === current ? "current" : ""} />)}</div>
          <div className="progress-labels">{stages.map((stage) => <span key={stage}>{stage}</span>)}</div>
        </div>

        {/* Worker Actions */}
        {role === "Worker" && booking.status === "Requested" && (
          <div className="modal-actions">
            <Button onClick={() => advance("Accepted")} icon={<ArrowRight size={15} />}>Accept request</Button>
            <Button variant="danger" onClick={() => advance("Cancelled", { cancelFeeApplied: false, cancelReason: "Declined by worker" })}>Reject request</Button>
          </div>
        )}
        {role === "Worker" && next && booking.status !== "Requested" && (
          <div className="modal-actions">
            <Button onClick={() => advance(next)} icon={<ArrowRight size={15} />}>{`Move to ${next}`}</Button>
            {current < 3 && <Button variant="danger" onClick={() => advance("Cancelled", { cancelFeeApplied: false, cancelReason: "Worker cancelled before service" })}>Cancel booking</Button>}
          </div>
        )}
        {role === "Worker" && booking.status === "Completed" && (
          isPaid ? (
            <div className="success-note">
              <Check size={15} /> This booking is complete. {booking.amount} customer settlement received &amp; added to total earnings.
            </div>
          ) : (
            <div className="awaiting-settlement-badge" style={{ margin: "10px 0 12px" }}>
              <Clock3 size={15} /> Job marked completed. Awaiting customer payment confirmation ({booking.amount}) to credit your earnings.
            </div>
          )
        )}

        {/* Worker No-Show / Delay Protection */}
        {role === "Customer" && (booking.status === "Accepted" || booking.status === "En Route") && (
          <div style={{ margin: "10px 0 12px", padding: "10px 14px", background: "rgba(200,148,57,.08)", border: "1px solid rgba(200,148,57,.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={17} style={{ color: "#7a5c1c", flexShrink: 0 }} />
              <div>
                <strong style={{ display: "block", fontSize: 12, color: "#7a5c1c" }}>Worker didn&apos;t arrive or running late?</strong>
                <span style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
                  Zero advance was charged at booking (₹0 paid). Cancel penalty-free and switch workers.
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                advance("Cancelled", {
                  cancelFeeApplied: false,
                  cancelReason: "Worker Did Not Arrive (Zero penalty · No advance deducted)",
                });
                close();
                go?.("find");
              }}
              icon={<ArrowRight size={13} />}
            >
              Find Replacement (₹0 Fee)
            </Button>
          </div>
        )}

        {/* Customer Actions */}
        {role === "Customer" && booking.status !== "Completed" && booking.status !== "Cancelled" && booking.status !== "In Progress" && !showCancelConfirm && (
          <div className="modal-actions">
            <Button variant="secondary" onClick={close} icon={<Check size={15} />}>Keep tracking</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (cancelCountdown.isExpired) {
                  setShowCancelConfirm(true);
                } else {
                  advance("Cancelled", {
                    cancelFeeApplied: false,
                    cancelReason: "Cancelled within 5-min free window (Zero charge)",
                  });
                }
              }}
            >
              {cancelCountdown.isExpired ? "Cancel booking (₹50 Fee)" : "Cancel booking (Free)"}
            </Button>
          </div>
        )}

        {/* Cancellation Fee Confirmation Box */}
        {showCancelConfirm && (
          <div className="cancel-confirm-box">
            <strong>Confirm Cancellation (₹50 Compensation Fee)</strong>
            <p>
              More than 5 minutes have elapsed since booking. To compensate {booking.worker} for transit and reserved schedule, a <b>₹50 worker compensation fee</b> will be charged to your cooperative account.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowCancelConfirm(false)}>Keep Booking</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setShowCancelConfirm(false);
                  advance("Cancelled", {
                    cancelFeeApplied: true,
                    cancelReason: "Cancelled after 5-min window (₹50 compensation fee applied)",
                  });
                }}
              >
                Confirm &amp; Charge ₹50 Fee
              </Button>
            </div>
          </div>
        )}

        {/* Cancellation State Display */}
        {booking.status === "Cancelled" && (
          <div style={{ marginTop: 12 }}>
            {booking.cancelReason?.includes("Did Not Arrive") ? (
              <div className="auto-release-card" style={{ background: "rgba(23,107,98,.08)", borderColor: "rgba(23,107,98,.22)" }}>
                <h4 style={{ color: "var(--forest-dark)" }}><ShieldCheck size={16} /> Worker Did Not Arrive · Zero Advance Guarantee</h4>
                <p style={{ color: "var(--ink-soft)" }}>
                  Because Co-Labour takes no advance payment while booking, <b>zero money was deducted</b> from your account. No refund wait is required. You can pick another verified cooperative worker immediately.
                </p>
                <Button onClick={() => { close(); go?.("find"); }} icon={<ArrowRight size={14} />}>
                  Find Another Available Worker
                </Button>
              </div>
            ) : booking.cancelReason?.includes("Auto-Released") ? (
              <div className="auto-release-card">
                <h4><AlertCircle size={16} /> Worker Unresponsive · Auto-Released</h4>
                <p>The worker did not accept within the 3-minute limit. Your booking was automatically cancelled at ₹0 charge so you don&apos;t wait.</p>
                <Button onClick={() => { close(); go?.("find"); }} icon={<ArrowRight size={14} />}>
                  Find Another Available Worker
                </Button>
              </div>
            ) : booking.cancelFeeApplied ? (
              <div style={{ background: "rgba(186, 75, 59, 0.08)", border: "1px solid rgba(186, 75, 59, 0.25)", borderRadius: 9, padding: "12px 14px" }}>
                <strong style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <AlertTriangle size={14} /> Cancellation Fee Applied: ₹50
                </strong>
                <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "4px 0 0", lineHeight: 1.4 }}>
                  Booking was cancelled after the 5-minute free window. A ₹50 worker travel &amp; schedule compensation fee has been debited to your cooperative ledger.
                </p>
                {booking.cancelReason && <small style={{ color: "var(--muted-foreground)", display: "block", marginTop: 4 }}>Reason: {booking.cancelReason}</small>}
              </div>
            ) : (
              <div className="success-note">
                <Check size={15} /> Booking cancelled within free 5-minute window. ₹0 fee charged.
              </div>
            )}
          </div>
        )}

        {/* Integrated Payment Gateway Checkout for Customer on Completion */}
        {role === "Customer" && booking.status === "Completed" && !isPaid && (
          <div style={{ marginTop: 14, paddingBottom: 24 }}>
            <div style={{ margin: "0 0 10px", padding: "8px 12px", background: "rgba(23,107,98,.07)", border: "1px solid rgba(23,107,98,.2)", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={15} style={{ color: "var(--forest)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--forest-dark)", fontWeight: 600 }}>
                Service Complete · Settle {booking.amount} to close booking
              </span>
            </div>
            <PaymentGateway booking={booking} onComplete={handlePaymentComplete} />
            <div style={{ height: 20 }} />
          </div>
        )}

        {/* Official Cooperative Service Receipt & Tax Invoice */}
        {role === "Customer" && isPaid && (
          <div style={{ paddingBottom: 28 }}>
            {/* Settlement Badge */}
            <div className="settled-badge" style={{ margin: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={18} style={{ color: "var(--forest)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--forest-dark)" }}>
                  Payment Settled ({booking.amount}) · Transaction Closed
                </span>
              </div>
              <span className="status status-good" style={{ flexShrink: 0, fontSize: 10 }}>
                <Check size={11} /> Settled
              </span>
            </div>

            <div className="official-invoice" id="printable-invoice">
              <div className="invoice-top">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Mark size={28} />
                    <h3 style={{ margin: 0 }}>{(booking as any).societyName || societies[0]?.name || "Cooperative Society"}</h3>
                  </div>
                  <p>Cooperative Registration No: {societies[0]?.regNumber || "Chartered Under State RCS"} · Affiliated with Ministry of Cooperation</p>
                  <p>Registered Address: {societies[0]?.registeredAddress || "State Cooperative Operations Hub"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="status status-good">
                    <Check size={11} /> {activeMethod === "Cash" ? "Cash Voucher Certified" : "Payment Captured"}
                  </span>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                    Invoice: <b>INV-2026-{booking.id.replace(/\D/g, '') || '001'}</b>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Date: {booking.date}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11, background: "var(--ivory)", padding: "10px 14px", borderRadius: 8, marginBottom: 12 }}>
                <div>
                  <small style={{ display: "block", color: "var(--muted-foreground)", fontSize: 9 }}>CUSTOMER / HOUSEHOLD</small>
                  <strong>{booking.customerName || profile?.fullName || "Valued Customer"}</strong>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{booking.address || profile?.addressLine || "Designated Locality"}</div>
                </div>
                <div>
                  <small style={{ display: "block", color: "var(--muted-foreground)", fontSize: 9 }}>VERIFIED WORKER / MEMBER</small>
                  <strong>{booking.worker}</strong>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{booking.service} · {(booking as any).societyName || societies[0]?.name || "Cooperative Society"}</div>
                </div>
              </div>

              <table className="invoice-table">
                <thead>
                  <tr><th>Description</th><th>Rate Card Standard</th><th style={{ textAlign: "right" }}>Amount</th></tr>
                </thead>
                <tbody>
                  <tr><td>Fixed Visit &amp; Labor Diagnosis ({booking.service})</td><td>Base Tariff</td><td style={{ textAlign: "right" }}><b>₹{calculateEarningsSplit(booking.amount).gross}</b></td></tr>
                  <tr><td>Worker Direct Take-Home (90%)</td><td>Immediate Payout</td><td style={{ textAlign: "right", color: "var(--forest)" }}>₹{calculateEarningsSplit(booking.amount).netPayout}</td></tr>
                  <tr><td>Worker Emergency Fund (10% in Coop Bank)</td><td>Society Mutual Reserve</td><td style={{ textAlign: "right", color: "var(--forest)" }}>₹{calculateEarningsSplit(booking.amount).emergencyCut}</td></tr>
                  <tr><td>Platform Commission &amp; Surge</td><td>Co-Labour 0% Policy</td><td style={{ textAlign: "right", color: "var(--forest)" }}>₹0</td></tr>
                  <tr className="invoice-total-row">
                    <td colSpan={2}>Total Amount {activeMethod === "Cash" ? "Settled via Doorstep Cash Voucher" : `Settled via ${activeMethod} (Razorpay)`}</td>
                    <td style={{ textAlign: "right", color: "var(--forest)" }}>{booking.amount}</td>
                  </tr>
                </tbody>
              </table>

              {/* Gateway & Settlement Audit Details */}
              <div style={{ background: "rgba(23,107,98,.04)", border: "1px dashed rgba(23,107,98,.2)", borderRadius: 8, padding: "9px 12px", margin: "10px 0 12px", fontSize: 10.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>GATEWAY PARTNER</span>
                  <strong>{activeMethod === "Cash" ? "Direct Cooperative Cash PIN Voucher" : "Razorpay Software Pvt. Ltd. (Demo Gateway)"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>TRANSACTION / PAYMENT ID</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--forest-dark)" }}>{activeTxRef}</span>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>PAYMENT CHANNEL</span>
                  <span>{activeMethod} · Instant Cooperative Settlement</span>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 9 }}>SETTLEMENT STATUS</span>
                  <span style={{ color: "var(--forest)", fontWeight: 700 }}>CAPTURED &amp; DISBURSED TO WORKER</span>
                </div>
              </div>

              <div className="invoice-footer">
                <div>Ref: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{activeTxRef}</span></div>
                <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={13} />}>Print / Save Invoice</Button>
              </div>
            </div>

            {/* 1-5 Star Rating Submission (Customer only) */}
            {role === "Customer" && (!rated ? (
              <div className="rating-block" style={{ marginTop: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Rate {booking.worker}&apos;s service for the cooperative trust record:</span>
                <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setStars(s)} className={`star ${s <= stars ? 'selected' : ''}`}>
                      <Star size={22} fill="currentColor" />
                    </button>
                  ))}
                </div>
                <textarea className="rating-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Optional: Share feedback on punctuality, workmanship, or honesty..." />
                <Button onClick={() => { if (stars) recordRating(booking.worker, stars, comment, booking.id); setRated(true); }} variant={stars ? "primary" : "secondary"}>
                  Submit Rating to Cooperative Record
                </Button>
              </div>
            ) : (
              <div className="success-note" style={{ marginTop: 14 }}>
                <Check size={16} /> Rating recorded. Your cooperative thanks you for closing the handoff loop.
              </div>
            ))}
            <div style={{ height: 28 }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { profile, loading } = useAuth();
  const [booting, setBooting] = useState(true);
  const [role, setRole] = useState<Role>("Customer");
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("access") === "1") return "auth";
      if (params.get("from") === "landing") return "find";
    }
    return "auth"; // Default to auth; session restore will redirect if logged in
  });
  const [selectedWorker, setSelectedWorker] = useState<typeof workers[number] | null>(null);
  
  // Boot delay
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 650);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const viewProfile = params.get("viewProfile");
      if (viewProfile) {
        const found = [...workers, ...pendingWorkers as unknown as typeof workers].find((w) => w.name === viewProfile);
        if (found) setSelectedWorker(found);
      }
    }
    return () => clearTimeout(t);
  }, []);

  // Session restore: when profile loads from sessionStorage/Supabase, auto-route to correct dashboard
  useEffect(() => {
    if (loading) return; // Wait for auth to finish initialising
    if (!profile) return; // No session — stay on auth screen
    // Profile exists: route to the correct dashboard for this role
    const profileRole = profile.role as Role;
    setRole(profileRole);
    if (profileRole === "Admin") { setScreen("overview"); return; }
    if (profileRole === "Worker") { setScreen("worker"); return; }
    setScreen("overview");
  }, [profile, loading]);

  const [bookingWorker, setBookingWorker] = useState<typeof workers[number] | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<DemoBooking | null>(null);
  const [reviewWorker, setReviewWorker] = useState<typeof pendingWorkers[number] | DemoWorkerRegistration | null>(null);
  const { bookings: demoBookings, addBooking, updateBooking, ratings, ratingComments, recordRating } = useDemoStore();

  const go = (next: Screen) => { setSelectedWorker(null); setBookingWorker(null); setSelectedBooking(null); setScreen(next); };
  const confirmBooking = ({
    date,
    time,
    emergency,
    paymentMethod = "Cash on Completion",
    paymentStatus = "Pending",
    paymentTxRef,
    createdAtTimestamp,
    cancellationDeadline,
    workerAcceptDeadline,
  }: {
    date: string;
    time: string;
    emergency: boolean;
    paymentMethod?: string;
    paymentStatus?: string;
    paymentTxRef?: string;
    createdAtTimestamp?: number;
    cancellationDeadline?: number;
    workerAcceptDeadline?: number;
  }) => {
    if (!bookingWorker) return;
    const cashPin = `CASH_PIN_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = Date.now();
    const bookingUuid = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    const created: DemoBooking = {
      id: bookingUuid,
      worker: bookingWorker.name,
      service: bookingWorker.service,
      date: `${date}, ${time}`,
      status: "Requested",
      amount: bookingWorker.rate,
      emergency,
      workerId: bookingWorker.id,
      customerName: profile?.fullName ?? "Customer",
      customerId: profile?.id,
      paymentMethod,
      paymentStatus: paymentStatus as any,
      paymentTxRef: paymentTxRef ?? (paymentMethod.includes("Cash") ? cashPin : undefined),
      createdAtTimestamp: createdAtTimestamp ?? now,
      cancellationDeadline: cancellationDeadline ?? (now + 5 * 60 * 1000),
      workerAcceptDeadline: workerAcceptDeadline ?? (now + 5 * 60 * 1000),
    };
    addBooking(created);
    setBookingWorker(null);
    setSelectedBooking(created);
  };
  const advanceBooking = (
    status: string,
    extra?: { paymentMethod?: string; paymentStatus?: string; paymentTxRef?: string; cancelFeeApplied?: boolean; cancelReason?: string }
  ) =>
    setSelectedBooking((current) => {
      if (!current) return current;
      updateBooking(current.id, status, extra);
      return { ...current, status, ...(extra || {}) };
    });
  const render = () => { if (booting) return <div className="content-wrap" role="status" aria-label="Loading workspace"><SkeletonKpiGrid /><div style={{display:'grid',gridTemplateColumns:'1.4fr .8fr',gap:14,marginTop:14}}><div className="panel" style={{padding:22}}><SkeletonBookingList /></div><div className="panel" style={{padding:22}}><SkeletonBookingList /></div></div></div>; if (screen === "overview") return <Overview role={role} go={go} bookingItems={demoBookings} openBooking={setSelectedBooking} onReview={setReviewWorker} />; if (screen === "find") return <FindWorker onSelect={setSelectedWorker} />; if (screen === "bookings") return <Bookings role={role} go={go} openBooking={setSelectedBooking} bookingItems={demoBookings} />; if (screen === "worker") return <WorkerDashboard go={go} bookingItems={demoBookings} />; if (screen === "verify") return <VerifyWorkers go={go} onReview={setReviewWorker} />; if (screen === "adminBookings") return <Bookings role="Admin" go={go} openBooking={setSelectedBooking} bookingItems={demoBookings} />; if (screen === "issues") return <Issues role={role} />; if (screen === "auth") return <AccessScreen setRole={setRole} go={go} />; if (screen === "profile") return <ProfileScreen role={role} go={go} />; if (screen === "officialSocieties") return <OfficialSocietiesRegistry go={go} />; if (screen === "members") return role === "Official" ? <OfficialSocietiesRegistry go={go} /> : <CoopMembers go={go} />; return <Settings />; };
  return (
    <AppShell role={role} setRole={setRole} screen={screen} setScreen={go}>
      {render()}
      {selectedWorker && (
        <WorkerProfile
          worker={selectedWorker}
          ratingOverride={ratings[selectedWorker.name]}
          ratingComment={ratingComments[selectedWorker.name]}
          role={role}
          isBusy={isWorkerBusy(selectedWorker, demoBookings)}
          close={() => setSelectedWorker(null)}
          book={() => {
            if (role === "Admin") return;
            if (isWorkerBusy(selectedWorker, demoBookings)) {
              toast.error(`${selectedWorker.name} is currently busy on an active job. Please select another available cooperative worker.`);
              return;
            }
            setSelectedWorker(null);
            setBookingWorker(selectedWorker);
          }}
        />
      )}
      {bookingWorker && role !== "Admin" && !isWorkerBusy(bookingWorker, demoBookings) && (
        <BookingFormModal worker={bookingWorker} close={() => setBookingWorker(null)} confirm={confirmBooking} />
      )}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          role={role}
          close={() => setSelectedBooking(null)}
          advance={advanceBooking}
          recordRating={recordRating}
          go={go}
        />
      )}
      {reviewWorker && <AdminWorkerReview worker={reviewWorker} close={() => setReviewWorker(null)} />}
    </AppShell>
  );
}
