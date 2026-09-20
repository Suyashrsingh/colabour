import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase, supabaseConfigError } from "@/lib/supabase";

export type AuthRole = "Customer" | "Worker" | "Admin" | "Official";

export type AuthProfile = {
  id: string;
  role: AuthRole;
  fullName: string;
  phone: string | null;
  area: string | null;
  addressLine?: string | null;
  pincode?: string | null;
  emergencyContact?: string | null;
  preferredPayment?: string | null;
  societyId: string | null;
  societyName: string | null;
  // Worker profile fields
  serviceCategory?: string | null;
  experienceYears?: number | null;
  membershipId?: string | null;
  ratePerVisit?: string | null;
  bio?: string | null;
  upiId?: string | null;
  bankAccount?: string | null;
  emergencyAvailable?: boolean | null;
  verificationStatus?: string | null;
  uanStatus?: string | null;
};

export type SignUpInput = {
  email: string;
  password: string;
  role: AuthRole;
  fullName: string;
  phone: string;
  area: string;
  societyName: string;
  serviceCategory: string;
  experienceYears: number;
  membershipId: string;
};

type AuthContextValue = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsEmailConfirm?: boolean; profile?: AuthProfile | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile?: AuthProfile | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<AuthProfile>) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);


type UserRow = {
  id: string;
  role: AuthRole;
  full_name: string;
  phone: string | null;
  area: string | null;
  address_line?: string | null;
  pincode?: string | null;
  emergency_contact?: string | null;
  preferred_payment?: string | null;
  society_id: string | null;
  societies: { name: string } | null;
};

type WorkerProfileRow = {
  service_category?: string | null;
  experience_years?: number | null;
  membership_id?: string | null;
  rate_per_visit?: string | null;
  bio?: string | null;
  upi_id?: string | null;
  bank_account?: string | null;
  emergency_available?: boolean | null;
  verification_status?: string | null;
  uan_status?: string | null;
};

function mapProfile(row: UserRow, wp?: WorkerProfileRow | null): AuthProfile {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    area: row.area,
    addressLine: row.address_line ?? null,
    pincode: row.pincode ?? null,
    emergencyContact: row.emergency_contact ?? null,
    preferredPayment: row.preferred_payment ?? "UPI",
    societyId: row.society_id,
    societyName: row.societies?.name ?? null,
    // Worker specific
    serviceCategory: wp?.service_category ?? null,
    experienceYears: wp?.experience_years ?? null,
    membershipId: wp?.membership_id ?? null,
    ratePerVisit: wp?.rate_per_visit ?? "₹350",
    bio: wp?.bio ?? null,
    upiId: wp?.upi_id ?? null,
    bankAccount: wp?.bank_account ?? null,
    emergencyAvailable: wp?.emergency_available ?? true,
    verificationStatus: wp?.verification_status ?? "Verified",
    uanStatus: wp?.uan_status ?? "UAN: Active · e-Shram",
  };
}

async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, role, full_name, phone, area, address_line, pincode, emergency_contact, preferred_payment, society_id, societies(name)")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;

  let wp: WorkerProfileRow | null = null;
  if (data.role === "Worker") {
    const { data: wpData } = await supabase
      .from("worker_profiles")
      .select("service_category, experience_years, membership_id, rate_per_visit, bio, upi_id, bank_account, emergency_available, verification_status, uan_status")
      .eq("user_id", userId)
      .maybeSingle();
    wp = wpData;
  }

  return mapProfile(data as unknown as UserRow, wp);
}

async function fetchProfileWithRetry(userId: string, attempts = 10): Promise<AuthProfile | null> {
  for (let i = 0; i < attempts; i += 1) {
    const row = await fetchProfile(userId);
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!supabase) { setProfile(null); return; }
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) { setProfile(null); return; }
    setProfile(await fetchProfile(userId));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Restore Supabase session from localStorage on mount
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user.id) {
        setProfile(await fetchProfile(data.session.user.id));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Only react to genuine auth state changes — NOT the transient SIGNED_OUT
    // that Supabase fires briefly during page-load token refresh.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        return;
      }
      if (nextSession) {
        setSession(nextSession);
        setProfile(await fetchProfile(nextSession.user.id));
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) return { error: supabaseConfigError };
    const email = input.email.trim();
    const password = input.password;
    if (!email || !password) return { error: "Email and password are required." };
    if (password.length < 6) return { error: "Password must be at least 6 characters." };

    const societyName =
      input.role === "Admin" || input.role === "Worker"
        ? input.societyName?.trim() || ""
        : "";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: input.role,
          full_name: input.fullName?.trim() || "",
          phone: input.phone?.trim() || "",
          area: input.area?.trim() || "",
          society_name: societyName,
          service_category: input.serviceCategory,
          experience_years: input.experienceYears ? String(input.experienceYears) : "1",
          membership_id: input.membershipId?.trim() || "",
        },
      },
    });

    if (error) return { error: error.message };
    if (data.user && !data.session) {
      return {
        error: "Please verify your email and login.",
        needsEmailConfirm: true,
      };
    }
    let nextProfile: AuthProfile | null = null;
    if (data.session?.user.id) {
      setSession(data.session);
      nextProfile = await fetchProfileWithRetry(data.session.user.id);
      setProfile(nextProfile);
    }
    return { error: null, profile: nextProfile };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!supabase) return { error: supabaseConfigError };
    if (!normalizedEmail || !password) return { error: "Email and password are required." };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return { error: error.message };
    if (data.session?.user.id) {
      setSession(data.session);
      const nextProfile = await fetchProfileWithRetry(data.session.user.id);
      setProfile(nextProfile);
      if (!nextProfile) {
        return { error: "Signed in, but no profile row was found. Re-run the SQL migration so the auth trigger exists." };
      }
      return { error: null, profile: nextProfile };
    }
    return { error: null, profile: null };
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    setSession(null);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (updates: Partial<AuthProfile>): Promise<{ error: string | null }> => {
    if (!profile) return { error: "Not signed in" };
    const nextProfile: AuthProfile = { ...profile, ...updates };

    if (!supabase) {
      setProfile(nextProfile);
      return { error: null };
    }

    try {
      const userUpdates: Record<string, any> = {};
      if (updates.fullName !== undefined) userUpdates.full_name = updates.fullName;
      if (updates.phone !== undefined) userUpdates.phone = updates.phone;
      if (updates.area !== undefined) userUpdates.area = updates.area;
      if (updates.addressLine !== undefined) userUpdates.address_line = updates.addressLine;
      if (updates.pincode !== undefined) userUpdates.pincode = updates.pincode;
      if (updates.emergencyContact !== undefined) userUpdates.emergency_contact = updates.emergencyContact;
      if (updates.preferredPayment !== undefined) userUpdates.preferred_payment = updates.preferredPayment;

      if (Object.keys(userUpdates).length > 0) {
        const { error: uErr } = await supabase.from("users").update(userUpdates).eq("id", profile.id);
        if (uErr) return { error: uErr.message };
      }

      if (profile.role === "Worker") {
        const wpUpdates: Record<string, any> = {};
        if (updates.serviceCategory !== undefined) wpUpdates.service_category = updates.serviceCategory;
        if (updates.experienceYears !== undefined) wpUpdates.experience_years = updates.experienceYears;
        if (updates.membershipId !== undefined) wpUpdates.membership_id = updates.membershipId;
        if (updates.ratePerVisit !== undefined) wpUpdates.rate_per_visit = updates.ratePerVisit;
        if (updates.bio !== undefined) wpUpdates.bio = updates.bio;
        if (updates.upiId !== undefined) wpUpdates.upi_id = updates.upiId;
        if (updates.bankAccount !== undefined) wpUpdates.bank_account = updates.bankAccount;
        if (updates.emergencyAvailable !== undefined) wpUpdates.emergency_available = updates.emergencyAvailable;

        if (Object.keys(wpUpdates).length > 0) {
          const { error: wpErr } = await supabase.from("worker_profiles").update(wpUpdates).eq("user_id", profile.id);
          if (wpErr) return { error: wpErr.message };
        }
      }

      setProfile(nextProfile);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to update profile" };
    }
  }, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured: isSupabaseConfigured,
      session,
      profile,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [loading, session, profile, signUp, signIn, signOut, refreshProfile, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
