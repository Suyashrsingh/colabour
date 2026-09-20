// ── Shared marketplace worker data ────────────────────────────────────────────
// 26 profiles across 13 service categories × 2 cities (Mumbai + Pune)
// Also includes the 4 original Gurugram demo workers to keep booking data consistent

export type MarketplaceWorker = {
  id: string;
  name: string;
  initials: string;
  service: string;
  city: string;
  area: string;
  years: number;
  rating: string;
  jobs: number;
  rate: string;
  accent: "forest" | "blue" | "brass" | "sage";
  available: string;
  languages: string;
  matchScore: number;
};

export const MARKETPLACE_WORKERS: MarketplaceWorker[] = [];


export const MARKETPLACE_CATEGORIES = [
  "Electrician", "Plumber", "Carpenter", "AC Technician", "Appliance Repair",
  "Home Cleaning", "Caregiver", "Domestic Helper", "Painter", "Gardener",
  "Home Maintenance", "Driver", "Technician",
] as const;

export const MARKETPLACE_CITIES = ["All cities", "Gurugram", "Mumbai", "Pune"] as const;
