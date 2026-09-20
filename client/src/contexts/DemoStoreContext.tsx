/* Style reminder: This store preserves the Sahaay role vocabulary and booking state machine.
 * Supabase-backed when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
 * Falls back to localStorage when not configured — original demo behaviour preserved.
 * Interface is IDENTICAL to the previous version so all Home.tsx consumers work unchanged,
 * except FindWorker + VerifyWorkers which also gain verifiedWorkers + supabaseReady.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentNotification = {
  id: string;
  bookingId: string;
  amount: string;
  customerName: string;
  workerName: string;
  workerId?: string;
  method: string;
  txRef: string;
  timestamp: number;
};

export type DemoBooking = {
  id: string;
  worker: string;
  service: string;
  date: string;
  status: string;
  amount: string;
  emergency: boolean;
  workerId?: string;   // UUID — populated when sourced from Supabase
  customerId?: string; // UUID — populated when sourced from Supabase
  customerName?: string;
  societyName?: string;
  paymentMethod?: string;
  paymentStatus?: "Paid" | "Pending" | "Cash on Completion" | string;
  paymentTxRef?: string;
  createdAtTimestamp?: number;
  cancellationDeadline?: number;
  workerAcceptDeadline?: number;
  cancelFeeApplied?: boolean;
  cancelReason?: string;
};

export type DemoIssue = {
  id: string;
  subject: string;
  description: string;
  linkedBookingId?: string;
  targetWorkerName?: string;
  category?: string;
  raisedBy: "Customer" | "Worker" | "Admin";
  status: "Open" | "Resolved";
  societyName?: string;
  createdDate?: string;
};

export type DemoSociety = {
  id: string;
  societyCode?: string;
  name: string;
  email: string;
  status: "Draft" | "Pending" | "Approved" | "Suspended" | "Rejected";
  regNumber?: string;
  state?: string;
  district?: string;
  rcsOffice?: string;
  panNumber?: string;
  tanNumber?: string;
  signatoryName?: string;
  signatoryRole?: string;
  signatoryGovId?: string;
  signatoryPhone?: string;
  registeredAddress?: string;
  incorporationDate?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  verifiedAt?: string;
  verificationBadge?: "Verified RCS Charter" | "National Cooperative Portal Verified" | "Pending Registrar Audit";
  submittedAt?: string;
  reviewDeadline?: number;
  documents?: Record<string, any>;
  documentRefs?: Record<string, string>;
  auditedBy?: string;
  auditNotes?: string;
};

export type DemoCustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
  addressLine: string;
  memberSince: string;
  totalBookings: number;
  completedBookings: number;
  disputeCount: number;
  standing: "Good Standing" | "Preferred Household" | "Under Review";
  preferredPayment: string;
  notes?: string;
};

export type DemoClaim = {
  id: string;
  workerName: string;
  societyName: string;
  type: "Accident" | "Health" | "Maternity" | "Tool Loss" | "Education" | "Other" | string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
  amount?: string;
};

export type DemoWorkerRegistration = {
  id: string;
  name: string;
  initials: string;
  service: string;
  area: string;
  years: number;
  rating: string;
  jobs: number;
  rate: string;
  accent: "forest" | "blue" | "brass" | "sage";
  available: string;
  experience: string;
  submitted: string;
  membershipId: string;
  societyName: string;
};

/** Shape of a verified worker sourced from Supabase — matches the hardcoded workers[] array shape in Home.tsx */
export type SupabaseWorker = {
  id: string;
  name: string;
  initials: string;
  service: string;
  area: string;
  years: number;
  rating: string;
  jobs: number;
  rate: string;
  accent: string;
  available: string;
};

/**
 * Returns true if the worker is currently occupied with an active job or marked unavailable/busy.
 * Active job states: 'Requested', 'Accepted', 'En Route', 'In Progress'.
 */
export function isWorkerBusy(
  worker: { name: string; id?: string; available?: string } | null | undefined,
  bookingsList: DemoBooking[]
): boolean {
  if (!worker) return false;
  const workerNameClean = worker.name ? worker.name.trim().toLowerCase() : "";
  const workerIdClean = worker.id;

  const hasActiveJob = (bookingsList || []).some((b) => {
    const isSameWorker =
      (b.worker && b.worker.trim().toLowerCase() === workerNameClean) ||
      (workerIdClean && b.workerId && b.workerId === workerIdClean);
    if (!isSameWorker) return false;
    return (
      b.status === "Requested" ||
      b.status === "Accepted" ||
      b.status === "En Route" ||
      b.status === "In Progress"
    );
  });

  if (hasActiveJob) return true;

  if (worker.available) {
    const lower = worker.available.toLowerCase();
    if (
      lower.includes("busy") ||
      lower.includes("working") ||
      lower.includes("on a job") ||
      lower.includes("off duty") ||
      lower.includes("off-duty") ||
      lower.includes("unavailable")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Cooperative Emergency Welfare Deduction:
 * 10% (within 5-10% statutory range) is deducted from gross worker earnings and 
 * deposited into the Cooperative Society Bank Account to support workers in emergencies.
 */
export const EMERGENCY_RESERVE_PERCENT = 10;

export function calculateEarningsSplit(amountStr: string | number, percent: number = EMERGENCY_RESERVE_PERCENT) {
  const gross = typeof amountStr === "number" ? amountStr : (parseInt(String(amountStr || "").replace(/[^\d]/g, "")) || 0);
  const emergencyCut = Math.round((gross * percent) / 100);
  const netPayout = gross - emergencyCut;
  return { gross, emergencyCut, netPayout, percent };
}

// ── Context value type ────────────────────────────────────────────────────────

type DemoStoreValue = {
  bookings: DemoBooking[];
  approvedWorkerNames: string[];
  rejectedWorkerNames: string[];
  ratings: Record<string, number>;
  ratingComments: Record<string, string>;
  issues: DemoIssue[];
  societies: DemoSociety[];
  claims: DemoClaim[];
  adminSocietyName: string | null;
  newPendingWorkers: DemoWorkerRegistration[];
  /** Verified workers fetched from Supabase. Empty array when Supabase is not configured. */
  verifiedWorkers: SupabaseWorker[];
  /** True once the initial Supabase data load has completed. */
  supabaseReady: boolean;
  paymentNotifications: PaymentNotification[];
  dismissPaymentNotification: (id: string) => void;

  workerEarningsPrivacy: Record<string, boolean>;
  toggleWorkerEarningsPrivacy: (workerName: string, hide?: boolean) => void;
  customers: DemoCustomerProfile[];

  addBooking: (booking: DemoBooking) => void;
  updateBooking: (id: string, status: string, extra?: { paymentMethod?: string; paymentStatus?: string; paymentTxRef?: string; cancelFeeApplied?: boolean; cancelReason?: string }) => void;
  approveWorker: (name: string) => void;
  rejectWorker: (name: string) => void;
  recordRating: (workerName: string, stars: number, comment?: string, bookingId?: string) => void;
  addIssue: (issue: DemoIssue) => void;
  resolveIssue: (id: string) => void;
  registerSociety: (society: DemoSociety) => void;
  updateSociety: (id: string, updates: Partial<DemoSociety>) => void;
  approveSociety: (societyId: string, signatoryOfficial?: string) => void;
  rejectSociety: (societyId: string, reason?: string) => void;
  setAdminSociety: (name: string | null) => void;
  registerWorker: (worker: DemoWorkerRegistration) => void;
  addClaim: (claim: DemoClaim) => void;
  updateClaim: (id: string, status: "Pending" | "Approved" | "Rejected", amount?: string) => void;
  resetDemo: () => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RATE_CARD: Record<string, string> = {
  Electrician: "₹300",
  Plumber: "₹350",
  Carpenter: "₹400",
  Caregiver: "₹500",
  "Home cleaning": "₹450",
  "Domestic Help": "₹400",
  General: "₹350",
};
const ACCENT_LIST = ["forest", "blue", "brass", "sage"] as const;

function toInitials(name: string): string {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase();
}
function accentFor(index: number): typeof ACCENT_LIST[number] {
  return ACCENT_LIST[index % ACCENT_LIST.length];
}

// ── Initial State ─────────────────────────────────────────────────────────────

const initialBookings: DemoBooking[] = [];
const initialApprovedWorkerNames: string[] = [];
const initialRejectedWorkerNames: string[] = [];
const initialRatings: Record<string, number> = {};
const initialRatingComments: Record<string, string> = {};
const initialIssues: DemoIssue[] = [];
const initialSocieties: DemoSociety[] = [];
const initialCustomers: DemoCustomerProfile[] = [];
const initialClaims: DemoClaim[] = [];
const initialNewPendingWorkers: DemoWorkerRegistration[] = [];

// ── localStorage helpers ──────────────────────────────────────────────────────

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isDemo = false;

  // ── Database state ────────────────────────────────────────────────────────
  const [bookings, setBookings]                     = useState<DemoBooking[]>([]);
  const [approvedWorkerNames, setApprovedWorkerNames] = useState<string[]>([]);
  const [rejectedWorkerNames, setRejectedWorkerNames] = useState<string[]>([]);
  const [ratings, setRatings]                       = useState<Record<string, number>>({});
  const [ratingComments, setRatingComments]         = useState<Record<string, string>>({});
  const [issues, setIssues]                         = useState<DemoIssue[]>([]);
  const [societies, setSocieties]                   = useState<DemoSociety[]>([]);
  const [claims, setClaims]                         = useState<DemoClaim[]>([]);
  const [adminSocietyName, setAdminSocietyName]     = useState<string | null>(null);
  const [newPendingWorkers, setNewPendingWorkers]   = useState<DemoWorkerRegistration[]>([]);
  const [paymentNotifications, setPaymentNotifications] = useState<PaymentNotification[]>([]);
  const [workerEarningsPrivacy, setWorkerEarningsPrivacy] = useState<Record<string, boolean>>({});
  const [customers, setCustomers]                   = useState<DemoCustomerProfile[]>([]);

  // ── Supabase-only state ───────────────────────────────────────────────────
  const [verifiedWorkers, setVerifiedWorkers] = useState<SupabaseWorker[]>([]);
  const [supabaseReady, setSupabaseReady]     = useState(false);
  const cancelledRef = useRef(false);

  const toggleWorkerEarningsPrivacy = useCallback((workerName: string, hide?: boolean) => {
    setWorkerEarningsPrivacy(cur => {
      const nextVal = hide !== undefined ? hide : !cur[workerName];
      const updated = { ...cur, [workerName]: nextVal };
      toast.success(nextVal ? `Earnings privacy enabled for ${workerName}. Redacted from Admin view.` : `Earnings transparency enabled for ${workerName}.`);
      return updated;
    });
  }, []);

  const dismissPaymentNotification = useCallback((id: string) => {
    setPaymentNotifications(cur => cur.filter(n => n.id !== id));
  }, []);

  // When switching FROM a demo session TO a real account: re-init state from DB
  useEffect(() => {
    if (!isDemo) {
      // Clear local demo state so the real account starts fresh
      setBookings([]);
      setIssues([]);
      setClaims([]);
      setRatings({});
      setRatingComments({});
      setAdminSocietyName(null);
      setNewPendingWorkers([]);
      setApprovedWorkerNames([]);
      setRejectedWorkerNames([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // ── Supabase data loading functions ──────────────────────────────────────

  const loadBookings = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("bookings")
      .select("id, date, time_slot, status, price_estimate, is_emergency, worker_id, customer_id, payment_method, payment_status, payment_tx_ref, cancellation_deadline, worker_accept_deadline, cancel_fee_applied, cancel_reason, created_at")
      .order("created_at", { ascending: false });
    if (!data || cancelledRef.current) return;

    const workerIds = Array.from(new Set(data.map(b => b.worker_id).filter(Boolean)));
    const customerIds = Array.from(new Set(data.map(b => b.customer_id).filter(Boolean)));
    if (workerIds.length === 0) { setBookings([]); return; }

    const allUserIds = Array.from(new Set(workerIds.concat(customerIds)));
    const [{ data: userRows }, { data: profileRows }] = await Promise.all([
      supabase.from("users").select("id, full_name").in("id", allUserIds),
      supabase.from("worker_profiles").select("user_id, service_category").in("user_id", workerIds),
    ]);
    if (cancelledRef.current) return;

    const userMap = Object.fromEntries((userRows ?? []).map(u => [u.id, u.full_name]));
    const profileMap = Object.fromEntries((profileRows ?? []).map(p => [p.user_id, p.service_category]));

    setBookings(data.map(b => ({
      id: b.id,
      worker: userMap[b.worker_id] ?? "Unknown Worker",
      customerName: userMap[b.customer_id] ?? "Customer",
      service: profileMap[b.worker_id] ?? "Service",
      date: `${b.date}, ${b.time_slot}`,
      status: b.status,
      amount: b.price_estimate,
      emergency: b.is_emergency,
      workerId: b.worker_id,
      customerId: b.customer_id,
      paymentMethod: b.payment_method ?? undefined,
      paymentStatus: b.payment_status ?? undefined,
      paymentTxRef: b.payment_tx_ref ?? undefined,
      createdAtTimestamp: b.created_at ? new Date(b.created_at).getTime() : undefined,
      cancellationDeadline: b.cancellation_deadline ? Number(b.cancellation_deadline) : (b.created_at ? new Date(b.created_at).getTime() + 5 * 60 * 1000 : undefined),
      workerAcceptDeadline: b.worker_accept_deadline ? Number(b.worker_accept_deadline) : (b.created_at ? new Date(b.created_at).getTime() + 5 * 60 * 1000 : undefined),
      cancelFeeApplied: Boolean(b.cancel_fee_applied),
      cancelReason: b.cancel_reason ?? undefined,
    })));
  }, []);

  const loadVerifiedWorkers = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("worker_profiles")
      .select("user_id, service_category, experience_years, area, avg_rating, jobs_completed, rate_per_visit, users(full_name)")
      .eq("verification_status", "Verified");
    if (!data || cancelledRef.current) return;

    setVerifiedWorkers(data.map((p, i) => {
      const name = (p.users as unknown as { full_name: string } | null)?.full_name ?? "Unknown Worker";
      return {
        id: p.user_id,
        name,
        initials: toInitials(name),
        service: p.service_category,
        area: p.area ?? "Gurugram",
        years: p.experience_years ?? 1,
        rating: p.avg_rating ? Number(p.avg_rating).toFixed(1) : "New worker",
        jobs: p.jobs_completed ?? 0,
        rate: p.rate_per_visit ?? RATE_CARD[p.service_category] ?? "₹350",
        accent: accentFor(i),
        available: "Available today",
      };
    }));
  }, []);

  const loadPendingWorkers = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("worker_profiles")
      .select("user_id, service_category, experience_years, area, membership_id, created_at, verification_status, users(full_name, phone), societies(name)")
      .eq("verification_status", "Pending");
    if (!data || cancelledRef.current) return;

    setNewPendingWorkers(data.map((p, i) => {
      const name = (p.users as unknown as { full_name: string } | null)?.full_name ?? "New Worker";
      const society = (p.societies as unknown as { name: string } | null)?.name ?? "Unknown Society";
      return {
        id: p.user_id,
        name,
        initials: toInitials(name),
        service: p.service_category,
        area: p.area ?? "Gurugram",
        years: p.experience_years ?? 1,
        rating: "New worker",
        jobs: 0,
        rate: RATE_CARD[p.service_category] ?? "₹350",
        accent: accentFor(i),
        available: "Available today",
        experience: `${p.experience_years ?? 1} years`,
        submitted: new Date(p.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
        membershipId: p.membership_id ?? "N/A",
        societyName: society,
      };
    }));
  }, []);

  const loadIssues = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("issues")
      .select("id, subject, description, linked_booking_id, status, created_at, raised_by, users!raised_by(role, full_name)")
      .order("created_at", { ascending: false });
    if (!data || cancelledRef.current) return;

    setIssues(data.map(i => ({
      id: i.id,
      subject: i.subject,
      description: i.description ?? "",
      linkedBookingId: i.linked_booking_id ?? undefined,
      raisedBy: ((i.users as unknown as { role: string } | null)?.role ?? "Customer") as DemoIssue["raisedBy"],
      status: i.status as "Open" | "Resolved",
      createdDate: i.created_at ? new Date(i.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Recently",
    })));
  }, []);

  const loadClaims = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("claims")
      .select("id, type, date, status, amount, worker_id, society_id, users!worker_id(full_name), societies(name)")
      .order("created_at", { ascending: false });
    if (!data || cancelledRef.current) return;

    setClaims(data.map(c => ({
      id: c.id,
      workerName: (c.users as unknown as { full_name: string } | null)?.full_name ?? "Unknown Worker",
      societyName: (c.societies as unknown as { name: string } | null)?.name ?? "",
      type: c.type as DemoClaim["type"],
      date: c.date,
      status: c.status as DemoClaim["status"],
      amount: c.amount ?? undefined,
    })));
  }, []);

  const loadSocieties = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("societies")
      .select("id, name, admin_email, status, society_code, state, district, reg_no, signatory_name, signatory_phone, signatory_role, pan, bank_account, bank_ifsc, review_deadline, documents, rcs_office, signatory_gov_id, registered_address, incorporation_date, tan, bank_branch, verified_at, verification_badge, submitted_at, audited_by, audit_notes, document_refs");
    if (!data || cancelledRef.current) return;

    setSocieties(data.map(s => {
      const defaultDocs = {
        rcsCertificate: s.status === "Approved",
        byLaws: s.status === "Approved",
        panCard: Boolean(s.pan),
        resolutionCopy: s.status === "Approved",
        bankPassbook: Boolean(s.bank_account),
        signatoryIdProof: Boolean(s.signatory_name),
      };
      return {
        id: s.id,
        societyCode: s.society_code || undefined,
        name: s.name,
        email: s.admin_email,
        status: (s.status as DemoSociety["status"]) || "Approved",
        regNumber: s.reg_no || undefined,
        state: s.state || "",
        district: s.district || "",
        rcsOffice: s.rcs_office || (s.state ? `Office of the Registrar of Cooperative Societies, Sahakar Bhawan, ${s.district || s.state}` : undefined),
        panNumber: s.pan || undefined,
        tanNumber: s.tan || undefined,
        signatoryName: s.signatory_name || undefined,
        signatoryRole: s.signatory_role || "Chief Promoter / President",
        signatoryGovId: s.signatory_gov_id || undefined,
        signatoryPhone: s.signatory_phone || undefined,
        registeredAddress: s.registered_address || undefined,
        incorporationDate: s.incorporation_date || undefined,
        bankAccount: s.bank_account || undefined,
        bankIfsc: s.bank_ifsc || undefined,
        bankBranch: s.bank_branch || undefined,
        verifiedAt: s.verified_at || undefined,
        verificationBadge: (s.verification_badge as DemoSociety["verificationBadge"]) || (s.status === "Approved" ? "Verified RCS Charter" : s.status === "Pending" ? "Pending Registrar Audit" : undefined),
        submittedAt: s.submitted_at || undefined,
        reviewDeadline: s.review_deadline ? Number(s.review_deadline) : undefined,
        auditedBy: s.audited_by || undefined,
        auditNotes: s.audit_notes || undefined,
        documents: (s.documents && typeof s.documents === "object" && !Array.isArray(s.documents)) ? s.documents : defaultDocs,
        documentRefs: (s.document_refs && typeof s.document_refs === "object" && !Array.isArray(s.document_refs)) ? s.document_refs : {
          rcsCertificateNo: s.reg_no ? `HR-RCS-${s.reg_no}` : "",
          panAckNo: s.pan ? `PAN-${s.pan}-ACK` : "",
          resolutionNo: s.status === "Approved" ? "RCS-RES-CHARTER" : "",
          bankMandateRef: s.bank_account ? `MANDATE-${s.bank_account.slice(-4)}` : "",
          byLawsVersion: s.status === "Approved" ? "CRCS Model By-laws" : "",
          signatoryGovIdRef: s.signatory_name ? `ID-${s.signatory_name.replace(/\s+/g, "").toUpperCase().slice(0, 6)}` : "",
        },
      };
    }));
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!supabase) return;
    const { data: custUsers } = await supabase
      .from("users")
      .select("id, full_name, phone, area, address_line, preferred_payment, created_at")
      .eq("role", "Customer");
    if (!custUsers || cancelledRef.current) return;

    setCustomers(custUsers.map(c => ({
      id: c.id,
      name: c.full_name || "Customer",
      phone: c.phone || "",
      email: "",
      area: c.area || "",
      addressLine: c.address_line || "",
      memberSince: c.created_at ? new Date(c.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Recent",
      totalBookings: 0,
      completedBookings: 0,
      disputeCount: 0,
      standing: "Good Standing",
      preferredPayment: c.preferred_payment || "UPI",
    })));
  }, []);

  const loadRatings = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("ratings")
      .select("stars, comment, worker_id, users!worker_id(full_name)");
    if (!data || cancelledRef.current) return;

    const rMap: Record<string, number> = {};
    const cMap: Record<string, string> = {};
    for (const r of data) {
      const name = (r.users as unknown as { full_name: string } | null)?.full_name;
      if (name) {
        rMap[name] = r.stars;
        if (r.comment) cMap[name] = r.comment;
      }
    }
    setRatings(rMap);
    setRatingComments(cMap);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadBookings(),
      loadVerifiedWorkers(),
      loadPendingWorkers(),
      loadIssues(),
      loadClaims(),
      loadSocieties(),
      loadCustomers(),
      loadRatings(),
    ]);
  }, [loadBookings, loadVerifiedWorkers, loadPendingWorkers, loadIssues, loadClaims, loadSocieties, loadCustomers, loadRatings]);

  // ── Supabase initialization + Realtime subscriptions ─────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    cancelledRef.current = false;

    const init = async () => {
      await loadAll();
      if (!cancelledRef.current) setSupabaseReady(true);
    };

    init();

    // Re-load whenever the auth session changes (sign-in / sign-out)
    const { data: authListener } = supabase!.auth.onAuthStateChange(async (_event, session) => {
      if (cancelledRef.current) return;
      if (session) {
        await loadAll();
        setSupabaseReady(true);
      } else {
        setSupabaseReady(false);
      }
    });

    // Realtime: reload bookings and worker profiles on any change
    const channel = supabase!
      .channel("sahaay-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (!cancelledRef.current) loadBookings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => {
        if (!cancelledRef.current) {
          loadVerifiedWorkers();
          loadPendingWorkers();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => {
        if (!cancelledRef.current) loadIssues();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, () => {
        if (!cancelledRef.current) loadClaims();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "societies" }, () => {
        if (!cancelledRef.current) loadSocieties();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => {
        if (!cancelledRef.current) loadRatings();
      })
      .subscribe();

    return () => {
      cancelledRef.current = true;
      authListener.subscription.unsubscribe();
      supabase!.removeChannel(channel);
    };
  }, [loadAll, loadBookings, loadVerifiedWorkers, loadPendingWorkers, loadIssues, loadClaims, loadSocieties, loadRatings]);

  // ── Global Auto-Cancellation ─────────────────────────────────────────────
  // If a booking is "Requested" and the worker does not respond within 5 minutes,
  // automatically cancel the booking and release the customer with zero penalty.
  useEffect(() => {
    const checkExpirations = () => {
      const now = Date.now();
      setBookings((prevBookings) => {
        let changed = false;
        const updated = prevBookings.map((b) => {
          if (b.status !== "Requested") return b;
          const deadline = b.workerAcceptDeadline || (b.createdAtTimestamp ? b.createdAtTimestamp + 5 * 60 * 1000 : null);
          if (deadline && now >= deadline) {
            changed = true;
            const cancelReason = "Worker Unresponsive — Auto-Cancelled after 5 minutes (Zero Charge)";
            if (supabase && b.id) {
              supabase.from("bookings").update({
                status: "Cancelled",
                cancel_fee_applied: false,
                cancel_reason: cancelReason,
              }).eq("id", b.id).then(() => {});
            }
            toast.info(`Booking #${b.id.slice(0, 8).toUpperCase()} automatically cancelled: Worker did not respond within 5 minutes. No penalty applied.`);
            return {
              ...b,
              status: "Cancelled",
              cancelFeeApplied: false,
              cancelReason,
            };
          }
          return b;
        });
        return changed ? updated : prevBookings;
      });
    };

    const interval = setInterval(checkExpirations, 2000);
    return () => clearInterval(interval);
  }, []);

function normalizePaymentMethod(method?: string): "UPI" | "Card" | "Cash" | "NetBanking" {
  if (!method) return "Cash";
  if (method === "UPI" || method.includes("UPI")) return "UPI";
  if (method === "Razorpay" || method.includes("Razorpay") || method === "Card" || method.includes("Card")) return "Card";
  if (method === "NetBanking" || method.includes("NetBanking") || method.includes("Net Banking")) return "NetBanking";
  return "Cash";
}

  // ── Mutations — Supabase-backed when configured, localStorage fallback ────

  const addBooking = useCallback(async (booking: DemoBooking) => {
    const now = Date.now();
    const finalCancellationDeadline = booking.cancellationDeadline ?? (now + 5 * 60 * 1000);
    const finalWorkerAcceptDeadline = booking.workerAcceptDeadline ?? (now + 5 * 60 * 1000);
    const bookingWithDeadlines: DemoBooking = {
      ...booking,
      createdAtTimestamp: booking.createdAtTimestamp ?? now,
      cancellationDeadline: finalCancellationDeadline,
      workerAcceptDeadline: finalWorkerAcceptDeadline,
    };

    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Resolve worker UUID from name
        let workerId = booking.workerId;
        if (!workerId) {
          const { data: wu } = await supabase
            .from("users").select("id").eq("full_name", booking.worker).maybeSingle();
          workerId = wu?.id;
        }
        if (workerId) {
          const { data: cu } = await supabase
            .from("users").select("society_id, full_name").eq("id", session.user.id).maybeSingle();
          let societyId = (cu as { society_id: string | null } | null)?.society_id ?? null;
          if (!societyId) {
            const { data: wp } = await supabase
              .from("worker_profiles").select("society_id").eq("user_id", workerId).maybeSingle();
            societyId = wp?.society_id ?? null;
          }
          const customerName = (cu as { full_name?: string } | null)?.full_name ?? booking.customerName ?? "Customer";
          const [datePart, ...timeParts] = booking.date.split(", ");

          const isValidUuid = booking.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id);

          const insertPayload: Record<string, unknown> = {
            customer_id: session.user.id,
            worker_id: workerId,
            society_id: societyId,
            date: datePart?.trim() ?? booking.date,
            time_slot: timeParts.join(", ").trim() || "TBD",
            description: "Service request",
            is_emergency: booking.emergency,
            status: "Requested",
            price_estimate: booking.amount,
            payment_method: normalizePaymentMethod(booking.paymentMethod),
            payment_status: booking.paymentStatus === "Paid" ? "Paid" : "Pending",
            cancellation_deadline: finalCancellationDeadline,
            worker_accept_deadline: finalWorkerAcceptDeadline,
            cancel_fee_applied: Boolean(booking.cancelFeeApplied),
            cancel_reason: booking.cancelReason ?? null,
            payment_tx_ref: booking.paymentTxRef ?? null,
          };
          if (isValidUuid) {
            insertPayload.id = booking.id;
          }

          const { data: newRow } = await supabase
            .from("bookings")
            .insert(insertPayload)
            .select("id")
            .single();
          if (newRow) {
            setBookings(cur => [{ ...booking, id: newRow.id, workerId, customerId: session.user.id, customerName }, ...cur.filter(b => b.id !== booking.id && b.id !== newRow.id)]);
            return;
          }
        }
      }
    }
    // localStorage fallback
    setBookings(cur => [booking, ...cur.filter(b => b.id !== booking.id)]);
  }, []);

  const updateBooking = useCallback(async (id: string, status: string, extra?: { paymentMethod?: string; paymentStatus?: string; paymentTxRef?: string; cancelFeeApplied?: boolean; cancelReason?: string }) => {
    // Optimistic UI update first
    setBookings(cur => {
      const next = cur.map(b => b.id === id ? { ...b, status, ...(extra ?? {}) } : b);
      if (extra?.paymentStatus === "Paid") {
        const bk = cur.find(b => b.id === id);
        if (bk) {
          const notif: PaymentNotification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            bookingId: id,
            amount: bk.amount,
            customerName: bk.customerName || "Customer",
            workerName: bk.worker,
            workerId: bk.workerId,
            method: extra.paymentMethod || bk.paymentMethod || "Razorpay",
            txRef: extra.paymentTxRef || `pay_${Date.now().toString().slice(-8)}`,
            timestamp: Date.now(),
          };
          setPaymentNotifications(prev => [notif, ...prev.filter(n => n.bookingId !== id)]);
          const split = calculateEarningsSplit(bk.amount);
          toast.success(`Payment Received: ${bk.amount} from ${bk.customerName || "Customer"}!`, {
            description: `Settled via ${notif.method} (${notif.txRef}) · ₹${split.netPayout} to worker, ₹${split.emergencyCut} saved in coop bank`,
            duration: 6000,
          });
        }
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      const updatePayload: Record<string, unknown> = { status: status as never };
      if (extra?.paymentStatus) updatePayload.payment_status = extra.paymentStatus === "Paid" ? "Paid" : "Pending";
      if (extra?.paymentMethod) {
        updatePayload.payment_method = normalizePaymentMethod(extra.paymentMethod);
      }
      if (extra?.paymentTxRef !== undefined) updatePayload.payment_tx_ref = extra.paymentTxRef;
      if (typeof extra?.cancelFeeApplied === "boolean") updatePayload.cancel_fee_applied = extra.cancelFeeApplied;
      if (extra?.cancelReason !== undefined) updatePayload.cancel_reason = extra.cancelReason;
      await supabase.from("bookings").update(updatePayload).eq("id", id);
    }
  }, []);

  const approveWorker = useCallback(async (name: string) => {
    if (isSupabaseConfigured && supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
      let workerId: string | null = null;
      if (isUuid) {
        workerId = name;
      } else {
        const found = newPendingWorkers.find(w => w.name === name || w.id === name);
        if (found?.id) {
          workerId = found.id;
        } else {
          const { data: wu } = await supabase
            .from("users").select("id").eq("full_name", name).maybeSingle();
          workerId = wu?.id ?? null;
        }
      }
      if (workerId) {
        await supabase
          .from("worker_profiles")
          .update({ verification_status: "Verified" })
          .eq("user_id", workerId);
        await Promise.all([loadPendingWorkers(), loadVerifiedWorkers()]);
      }
    }
    setApprovedWorkerNames(cur => cur.includes(name) ? cur : [...cur, name]);
    setRejectedWorkerNames(cur => cur.filter(n => n !== name));
  }, [newPendingWorkers, loadPendingWorkers, loadVerifiedWorkers]);

  const rejectWorker = useCallback(async (name: string) => {
    if (isSupabaseConfigured && supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
      let workerId: string | null = null;
      if (isUuid) {
        workerId = name;
      } else {
        const found = newPendingWorkers.find(w => w.name === name || w.id === name);
        if (found?.id) {
          workerId = found.id;
        } else {
          const { data: wu } = await supabase
            .from("users").select("id").eq("full_name", name).maybeSingle();
          workerId = wu?.id ?? null;
        }
      }
      if (workerId) {
        await supabase
          .from("worker_profiles")
          .update({ verification_status: "Rejected" })
          .eq("user_id", workerId);
        await Promise.all([loadPendingWorkers(), loadVerifiedWorkers()]);
      }
    }
    setRejectedWorkerNames(cur => cur.includes(name) ? cur : [...cur, name]);
    setApprovedWorkerNames(cur => cur.filter(n => n !== name));
  }, [newPendingWorkers, loadPendingWorkers, loadVerifiedWorkers]);

  const recordRating = useCallback(async (workerName: string, stars: number, comment = "", bookingId?: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        let targetBookingId = (bookingId && bookingId.length > 8 && !bookingId.startsWith("BK-")) ? bookingId : null;
        const { data: wu } = await supabase
          .from("users").select("id").eq("full_name", workerName).maybeSingle();
        if (wu) {
          if (!targetBookingId) {
            const { data: bk } = await supabase
              .from("bookings")
              .select("id")
              .eq("customer_id", session.user.id)
              .eq("worker_id", wu.id)
              .eq("status", "Completed")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            targetBookingId = bk?.id ?? null;
          }
          if (targetBookingId) {
            await supabase.from("ratings").upsert({
              booking_id: targetBookingId,
              worker_id: wu.id,
              customer_id: session.user.id,
              stars,
              comment,
            });
            // Recompute average
            const { data: allRatings } = await supabase
              .from("ratings").select("stars").eq("worker_id", wu.id);
            if (allRatings && allRatings.length > 0) {
              const avg = allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length;
              await supabase
                .from("worker_profiles")
                .update({ avg_rating: Math.round(avg * 10) / 10 })
                .eq("user_id", wu.id);
            }
          }
        }
      }
    }
    setRatings(cur => ({ ...cur, [workerName]: stars }));
    setRatingComments(cur => ({ ...cur, [workerName]: comment }));
  }, []);

  const addIssue = useCallback(async (issue: DemoIssue) => {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: cu } = await supabase
          .from("users").select("society_id").eq("id", session.user.id).maybeSingle();
        let societyId = (cu as { society_id: string | null } | null)?.society_id ?? null;
        const validBookingUuid = (issue.linkedBookingId && issue.linkedBookingId.length > 8 && !issue.linkedBookingId.startsWith("BK-")) ? issue.linkedBookingId : null;
        if (!societyId && validBookingUuid) {
          const { data: bk } = await supabase.from("bookings").select("society_id").eq("id", validBookingUuid).maybeSingle();
          societyId = bk?.society_id ?? null;
        }
        if (!societyId && issue.targetWorkerName) {
          const { data: tw } = await supabase.from("users").select("id").eq("full_name", issue.targetWorkerName).maybeSingle();
          if (tw) {
            const { data: twp } = await supabase.from("worker_profiles").select("society_id").eq("user_id", tw.id).maybeSingle();
            societyId = twp?.society_id ?? null;
          }
        }
        if (!societyId) {
          const { data: firstSoc } = await supabase.from("societies").select("id").limit(1).maybeSingle();
          societyId = firstSoc?.id ?? null;
        }
        await supabase.from("issues").insert({
          raised_by: session.user.id,
          society_id: societyId,
          subject: issue.subject,
          description: issue.description,
          linked_booking_id: validBookingUuid,
          status: "Open",
        });
        await loadIssues();
        return;
      }
    }
    setIssues(cur => [issue, ...cur.filter(i => i.id !== issue.id)]);
  }, [loadIssues]);

  const resolveIssue = useCallback(async (id: string) => {
    // Optimistic UI
    setIssues(cur => cur.map(i => i.id === id ? { ...i, status: "Resolved" } : i));
    if (isSupabaseConfigured && supabase) {
      await supabase.from("issues").update({ status: "Resolved" }).eq("id", id);
    }
  }, []);

  const addClaim = useCallback(async (claim: DemoClaim) => {
    if (isSupabaseConfigured && supabase) {
      const [{ data: wu }, { data: soc }] = await Promise.all([
        supabase.from("users").select("id").eq("full_name", claim.workerName).maybeSingle(),
        supabase.from("societies").select("id").eq("name", claim.societyName).maybeSingle(),
      ]);
      if (wu) {
        await supabase.from("claims").insert({
          worker_id: wu.id,
          society_id: soc?.id ?? null,
          type: claim.type,
          date: claim.date,
          status: claim.status,
          amount: claim.amount ?? null,
        });
        await loadClaims();
        return;
      }
    }
    setClaims(cur => [claim, ...cur.filter(c => c.id !== claim.id)]);
  }, [loadClaims]);

  const updateClaim = useCallback(async (id: string, status: "Pending" | "Approved" | "Rejected", amount?: string) => {
    // Optimistic UI
    setClaims(cur => cur.map(c => c.id === id ? { ...c, status, amount: amount ?? c.amount } : c));
    if (isSupabaseConfigured && supabase) {
      await supabase.from("claims").update({ status, ...(amount ? { amount } : {}) }).eq("id", id);
    }
  }, []);

  const registerSociety = useCallback(async (society: DemoSociety) => {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from("societies").insert({
        name: society.name,
        admin_email: society.email,
        status: society.status || "Draft",
        society_code: society.societyCode,
        state: society.state || "",
        district: society.district || "",
        rcs_office: society.rcsOffice || "",
        reg_no: society.regNumber || "",
        signatory_name: society.signatoryName || "",
        signatory_phone: society.signatoryPhone || "",
        signatory_role: society.signatoryRole || "Managing Secretary",
        signatory_gov_id: society.signatoryGovId || "",
        registered_address: society.registeredAddress || "",
        incorporation_date: society.incorporationDate || "",
        pan: society.panNumber || "",
        tan: society.tanNumber || "",
        bank_branch: society.bankBranch || "",
        bank_account: society.bankAccount || "",
        bank_ifsc: society.bankIfsc || "",
        review_deadline: society.reviewDeadline,
        documents: society.documents || {},
        document_refs: society.documentRefs || {},
      }).select().maybeSingle();
      if (data) {
        await loadSocieties();
        return;
      }
    }
    setSocieties(cur => [society, ...cur.filter(s => s.id !== society.id)]);
  }, [loadSocieties]);

  const updateSociety = useCallback(async (id: string, updates: Partial<DemoSociety>) => {
    setSocieties(cur => cur.map(s => (s.id === id || s.name.toLowerCase() === id.toLowerCase()) ? { ...s, ...updates } : s));
    if (isSupabaseConfigured && supabase) {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.societyCode !== undefined) dbUpdates.society_code = updates.societyCode;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.district !== undefined) dbUpdates.district = updates.district;
      if (updates.regNumber !== undefined) dbUpdates.reg_no = updates.regNumber;
      if (updates.signatoryName !== undefined) dbUpdates.signatory_name = updates.signatoryName;
      if (updates.signatoryPhone !== undefined) dbUpdates.signatory_phone = updates.signatoryPhone;
      if (updates.signatoryRole !== undefined) dbUpdates.signatory_role = updates.signatoryRole;
      if (updates.signatoryGovId !== undefined) dbUpdates.signatory_gov_id = updates.signatoryGovId;
      if (updates.registeredAddress !== undefined) dbUpdates.registered_address = updates.registeredAddress;
      if (updates.incorporationDate !== undefined) dbUpdates.incorporation_date = updates.incorporationDate;
      if (updates.rcsOffice !== undefined) dbUpdates.rcs_office = updates.rcsOffice;
      if (updates.panNumber !== undefined) dbUpdates.pan = updates.panNumber;
      if (updates.tanNumber !== undefined) dbUpdates.tan = updates.tanNumber;
      if (updates.bankBranch !== undefined) dbUpdates.bank_branch = updates.bankBranch;
      if (updates.bankAccount !== undefined) dbUpdates.bank_account = updates.bankAccount;
      if (updates.bankIfsc !== undefined) dbUpdates.bank_ifsc = updates.bankIfsc;
      if (updates.reviewDeadline !== undefined) dbUpdates.review_deadline = updates.reviewDeadline;
      if (updates.verifiedAt !== undefined) dbUpdates.verified_at = updates.verifiedAt;
      if (updates.verificationBadge !== undefined) dbUpdates.verification_badge = updates.verificationBadge;
      if (updates.submittedAt !== undefined) dbUpdates.submitted_at = updates.submittedAt;
      if (updates.auditedBy !== undefined) dbUpdates.audited_by = updates.auditedBy;
      if (updates.auditNotes !== undefined) dbUpdates.audit_notes = updates.auditNotes;
      if (updates.documents !== undefined) dbUpdates.documents = updates.documents;
      if (updates.documentRefs !== undefined) dbUpdates.document_refs = updates.documentRefs;

      if (Object.keys(dbUpdates).length > 0) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const query = supabase.from("societies").update(dbUpdates);
        if (isUuid) {
          await query.eq("id", id);
        } else {
          await query.ilike("name", id);
        }
        await loadSocieties();
      }
    }
  }, [loadSocieties]);

  const approveSociety = useCallback(async (societyId: string, signatoryOfficial = "State Registrar of Cooperative Societies") => {
    const soc = societies.find(s => s.id === societyId || s.name.toLowerCase() === societyId.toLowerCase());
    const generatedCode = soc?.societyCode || `SOC-${(soc?.state ? soc.state.substring(0, 2) : "HR").toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verifiedAt = new Date().toISOString().slice(0, 10);
    const verificationBadge = "Verified RCS Charter";

    setSocieties(cur => cur.map(s => {
      if (s.id === societyId || s.name.toLowerCase() === societyId.toLowerCase()) {
        return {
          ...s,
          societyCode: generatedCode,
          status: "Approved" as const,
          verifiedAt,
          verificationBadge: verificationBadge as const,
          auditedBy: signatoryOfficial,
        };
      }
      return s;
    }));

    if (isSupabaseConfigured && supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(societyId);
      const query = supabase.from("societies").update({
        society_code: generatedCode,
        status: "Approved",
        verified_at: verifiedAt,
        verification_badge: verificationBadge,
        audited_by: signatoryOfficial,
      });
      if (isUuid) {
        await query.eq("id", societyId);
      } else {
        await query.ilike("name", societyId);
      }
      await loadSocieties();
    }

    toast.success("Cooperative Society Charter Granted! Entity verified under State Act.");
  }, [societies, loadSocieties]);

  const rejectSociety = useCallback(async (societyId: string, reason = "Statutory documentation discrepancy flagged by Registrar") => {
    setSocieties(cur => cur.map(s => {
      if (s.id === societyId || s.name.toLowerCase() === societyId.toLowerCase()) {
        return {
          ...s,
          status: "Rejected" as const,
          auditNotes: reason,
        };
      }
      return s;
    }));

    if (isSupabaseConfigured && supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(societyId);
      const query = supabase.from("societies").update({
        status: "Rejected",
        audit_notes: reason,
      });
      if (isUuid) {
        await query.eq("id", societyId);
      } else {
        await query.ilike("name", societyId);
      }
      await loadSocieties();
    }

    toast.error("Society registration rejected. Regulatory audit notice issued.");
  }, [loadSocieties]);

  const setAdminSociety = useCallback((name: string | null) => {
    setAdminSocietyName(name);
  }, []);

  const registerWorker = useCallback((worker: DemoWorkerRegistration) => {
    // Supabase worker_profiles are created by the auth trigger on signup — local state mirrors UI
    setNewPendingWorkers(cur => [worker, ...cur.filter(w => w.id !== worker.id)]);
  }, []);

  const resetDemo = useCallback(() => {
    setBookings(initialBookings);
    setApprovedWorkerNames(initialApprovedWorkerNames);
    setRejectedWorkerNames(initialRejectedWorkerNames);
    setRatings(initialRatings);
    setRatingComments(initialRatingComments);
    setIssues(initialIssues);
    setSocieties(initialSocieties);
    setClaims(initialClaims);
    setAdminSocietyName(null);
    setNewPendingWorkers(initialNewPendingWorkers);
    setWorkerEarningsPrivacy(initialWorkerEarningsPrivacy);
    setCustomers(initialCustomers);
    toast.info("Demo store reset to initial state.");
  }, []);

  // ── Memoised context value ────────────────────────────────────────────────
  const value = useMemo<DemoStoreValue>(() => ({
    bookings,
    approvedWorkerNames,
    rejectedWorkerNames,
    ratings,
    ratingComments,
    issues,
    societies,
    claims,
    adminSocietyName,
    newPendingWorkers,
    verifiedWorkers,
    supabaseReady,
    paymentNotifications,
    dismissPaymentNotification,
    workerEarningsPrivacy,
    toggleWorkerEarningsPrivacy,
    customers,
    addBooking,
    updateBooking,
    approveWorker,
    rejectWorker,
    recordRating,
    addIssue,
    resolveIssue,
    registerSociety,
    updateSociety,
    approveSociety,
    rejectSociety,
    setAdminSociety,
    registerWorker,
    addClaim,
    updateClaim,
    resetDemo,
  }), [
    bookings, approvedWorkerNames, rejectedWorkerNames, ratings, ratingComments,
    issues, societies, claims, adminSocietyName, newPendingWorkers,
    verifiedWorkers, supabaseReady, paymentNotifications, dismissPaymentNotification,
    workerEarningsPrivacy, toggleWorkerEarningsPrivacy, customers,
    addBooking, updateBooking, approveWorker, rejectWorker, recordRating,
    addIssue, resolveIssue, registerSociety, updateSociety, approveSociety, rejectSociety, setAdminSociety, registerWorker,
    addClaim, updateClaim, resetDemo,
  ]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const value = useContext(DemoStoreContext);
  if (!value) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return value;
}
