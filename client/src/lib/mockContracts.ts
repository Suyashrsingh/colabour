/* Style reminder: This file contains data contracts only. It must preserve Sahaay's role vocabulary, trust states, and booking state machine for a later backend replacement. */

export type UserRole = "customer" | "worker" | "admin";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type BookingStatus = "requested" | "accepted" | "en_route" | "in_progress" | "completed" | "cancelled";
export type PaymentMethod = "upi" | "card" | "cash";
export type PaymentStatus = "unpaid" | "paid_simulated" | "cash_on_completion";
export type IssueStatus = "open" | "resolved";

export type User = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  area?: string;
};

export type WorkerProfile = {
  id: string;
  userId: string;
  name: string;
  initials: string;
  serviceCategory: string;
  experienceYears: number;
  area: string;
  verificationStatus: VerificationStatus;
  uanStatus: string;
  avgRating: number | null;
  completedJobs: number;
  baseVisitCharge: number;
  availability: string;
};

export type Booking = {
  id: string;
  customerId: string;
  workerId: string;
  date: string;
  timeSlot: string;
  description: string;
  isEmergency: boolean;
  status: BookingStatus;
  priceEstimate: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
};

export type Rating = { bookingId: string; stars: 1 | 2 | 3 | 4 | 5; comment?: string };
export type Issue = { id: string; raisedBy: string; subject: string; description: string; linkedBookingId?: string; status: IssueStatus };

export const bookingStatusOrder: BookingStatus[] = ["requested", "accepted", "en_route", "in_progress", "completed"];

export const mockUsers: User[] = [
  { id: "user-customer-01", name: "Ananya Sharma", phone: "+91 98765 12045", role: "customer", area: "Sector 12, Gurugram" },
  { id: "user-worker-01", name: "Aarav Mehta", phone: "+91 98765 88421", role: "worker", area: "Sector 12, Gurugram" },
  { id: "user-admin-01", name: "Cooperative Admin", phone: "demo-admin", role: "admin" },
];

export const mockWorkerProfiles: WorkerProfile[] = [
  { id: "worker-01", userId: "user-worker-01", name: "Aarav Mehta", initials: "AM", serviceCategory: "Electrician", experienceYears: 8, area: "Sector 12, Gurugram", verificationStatus: "verified", uanStatus: "Registered · DEMO-88213", avgRating: 4.9, completedJobs: 128, baseVisitCharge: 300, availability: "Available today" },
  { id: "worker-02", userId: "user-worker-02", name: "Meera Joshi", initials: "MJ", serviceCategory: "Home cleaning", experienceYears: 6, area: "Sushant Lok, Gurugram", verificationStatus: "verified", uanStatus: "Registered · DEMO-66120", avgRating: 4.8, completedJobs: 94, baseVisitCharge: 450, availability: "Available tomorrow" },
];

export const mockBookings: Booking[] = [
  { id: "BK-2048", customerId: "user-customer-01", workerId: "worker-01", date: "04 Sep 2026", timeSlot: "4:30 PM", description: "Inspect an intermittent power issue.", isEmergency: false, status: "en_route", priceEstimate: 300, paymentMethod: null, paymentStatus: "unpaid" },
  { id: "BK-2041", customerId: "user-customer-01", workerId: "worker-02", date: "12 Sep 2026", timeSlot: "10:00 AM", description: "Two-bedroom home cleaning.", isEmergency: true, status: "requested", priceEstimate: 450, paymentMethod: null, paymentStatus: "unpaid" },
];

export const mockIssues: Issue[] = [
  { id: "issue-01", raisedBy: "user-worker-01", subject: "Worker unable to update status", description: "Status button did not advance after arrival.", linkedBookingId: "BK-2048", status: "open" },
];

export function canAdvanceBooking(current: BookingStatus, next: BookingStatus) {
  const currentIndex = bookingStatusOrder.indexOf(current);
  const nextIndex = bookingStatusOrder.indexOf(next);
  return currentIndex >= 0 && nextIndex === currentIndex + 1;
}

export function canCancelBooking(status: BookingStatus) {
  return status === "requested" || status === "accepted" || status === "en_route";
}

export const rateCard: Record<string, number> = {
  Electrician: 300,
  Plumber: 350,
  Carpenter: 400,
  "Home cleaning": 450,
  Caregiver: 500,
};

/**
 * Future API replacement contract:
 * - listVerifiedWorkers(filters)
 * - getWorkerProfile(workerId)
 * - createBooking(input)
 * - updateBookingStatus(bookingId, nextStatus)
 * - cancelBooking(bookingId)
 * - recordSimulatedPayment(bookingId, method)
 * - createRating(input)
 * - createIssue(input)
 * - approveWorker(workerId) / rejectWorker(workerId)
 *
 * Keep these names and response shapes stable when the backend is introduced.
 */
