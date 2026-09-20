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

export const MARKETPLACE_WORKERS: MarketplaceWorker[] = [
  // ── Gurugram (demo personas — keep for booking consistency) ──────────────
  { id: "w-01", name: "Aarav Mehta",      initials: "AM", service: "Electrician",      city: "Gurugram", area: "Sector 12, Gurugram",     years: 8,  rating: "4.9", jobs: 128, rate: "₹300", accent: "forest", available: "Available today",    languages: "Hindi, English", matchScore: 96 },
  { id: "w-02", name: "Meera Joshi",      initials: "MJ", service: "Home Cleaning",    city: "Gurugram", area: "Sushant Lok, Gurugram",   years: 6,  rating: "4.8", jobs: 94,  rate: "₹450", accent: "blue",   available: "Available tomorrow", languages: "Hindi, English", matchScore: 93 },
  { id: "w-03", name: "Rohan Singh",      initials: "RS", service: "Plumber",          city: "Gurugram", area: "Sector 14, Gurugram",     years: 11, rating: "4.7", jobs: 176, rate: "₹350", accent: "brass",  available: "Available today",    languages: "Hindi",          matchScore: 91 },
  { id: "w-04", name: "Riya Verma",       initials: "RV", service: "Caregiver",        city: "Gurugram", area: "DLF Phase 1, Gurugram",   years: 5,  rating: "4.6", jobs: 47,  rate: "₹500", accent: "sage",   available: "Available today",    languages: "Hindi, English", matchScore: 88 },

  // ── Mumbai (13 workers, one per category) ─────────────────────────────────
  { id: "m-01", name: "Priya Sharma",     initials: "PS", service: "Electrician",      city: "Mumbai",   area: "Andheri West, Mumbai",    years: 11, rating: "4.9", jobs: 386, rate: "₹349", accent: "forest", available: "Available today",    languages: "Hindi, Marathi, English", matchScore: 90 },
  { id: "m-02", name: "Rahul Nair",       initials: "RN", service: "Plumber",          city: "Mumbai",   area: "Bandra East, Mumbai",     years: 9,  rating: "4.7", jobs: 302, rate: "₹299", accent: "blue",   available: "Available today",    languages: "Hindi, Marathi", matchScore: 82 },
  { id: "m-03", name: "Sunita Patil",     initials: "SP", service: "Carpenter",        city: "Mumbai",   area: "Dadar, Mumbai",           years: 7,  rating: "4.6", jobs: 214, rate: "₹449", accent: "brass",  available: "Available today",    languages: "Marathi, Hindi", matchScore: 85 },
  { id: "m-04", name: "Imran Sheikh",     initials: "IS", service: "AC Technician",    city: "Mumbai",   area: "Kurla, Mumbai",           years: 8,  rating: "4.8", jobs: 341, rate: "₹499", accent: "sage",   available: "Available today",    languages: "Hindi, Urdu, Marathi", matchScore: 86 },
  { id: "m-05", name: "Deepa Rao",        initials: "DR", service: "Appliance Repair", city: "Mumbai",   area: "Thane, Mumbai",           years: 6,  rating: "4.5", jobs: 178, rate: "₹399", accent: "forest", available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 79 },
  { id: "m-06", name: "Kavita Desai",     initials: "KD", service: "Home Cleaning",    city: "Mumbai",   area: "Malad, Mumbai",           years: 12, rating: "5.0", jobs: 211, rate: "₹599", accent: "blue",   available: "Available today",    languages: "Hindi, Marathi, English", matchScore: 83 },
  { id: "m-07", name: "Anjali Kulkarni",  initials: "AK", service: "Caregiver",        city: "Mumbai",   area: "Borivali, Mumbai",        years: 9,  rating: "4.9", jobs: 163, rate: "₹549", accent: "brass",  available: "Available tomorrow", languages: "Marathi, Hindi", matchScore: 88 },
  { id: "m-08", name: "Suresh More",      initials: "SM", service: "Domestic Helper",  city: "Mumbai",   area: "Goregaon, Mumbai",        years: 5,  rating: "4.4", jobs: 97,  rate: "₹379", accent: "sage",   available: "Available today",    languages: "Marathi, Hindi", matchScore: 76 },
  { id: "m-09", name: "Vijay Pawar",      initials: "VP", service: "Painter",          city: "Mumbai",   area: "Kandivali, Mumbai",       years: 14, rating: "4.8", jobs: 258, rate: "₹499", accent: "forest", available: "Available today",    languages: "Marathi, Hindi", matchScore: 87 },
  { id: "m-10", name: "Rekha Gaikwad",    initials: "RG", service: "Gardener",         city: "Mumbai",   area: "Mulund, Mumbai",          years: 8,  rating: "4.7", jobs: 142, rate: "₹349", accent: "blue",   available: "Available tomorrow", languages: "Marathi, Hindi", matchScore: 84 },
  { id: "m-11", name: "Anil Jadhav",      initials: "AJ", service: "Home Maintenance", city: "Mumbai",   area: "Vikhroli, Mumbai",        years: 10, rating: "4.6", jobs: 189, rate: "₹449", accent: "brass",  available: "Available today",    languages: "Marathi, Hindi", matchScore: 81 },
  { id: "m-12", name: "Meena Bhosale",    initials: "MB", service: "Driver",           city: "Mumbai",   area: "Andheri East, Mumbai",    years: 7,  rating: "4.5", jobs: 324, rate: "₹299", accent: "sage",   available: "Available today",    languages: "Hindi, Marathi", matchScore: 78 },
  { id: "m-13", name: "Dinesh Kadam",     initials: "DK", service: "Technician",       city: "Mumbai",   area: "Chembur, Mumbai",         years: 6,  rating: "4.7", jobs: 156, rate: "₹399", accent: "forest", available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 80 },

  // ── Pune (13 workers, one per category) ──────────────────────────────────
  { id: "p-01", name: "Sanjay Mane",      initials: "SA", service: "Electrician",      city: "Pune",     area: "Kothrud, Pune",           years: 9,  rating: "4.8", jobs: 271, rate: "₹319", accent: "blue",   available: "Available today",    languages: "Marathi, Hindi", matchScore: 89 },
  { id: "p-02", name: "Pooja Shinde",     initials: "PS", service: "Plumber",          city: "Pune",     area: "Wakad, Pune",             years: 6,  rating: "4.6", jobs: 198, rate: "₹279", accent: "brass",  available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 84 },
  { id: "p-03", name: "Ravi Pawar",       initials: "RP", service: "Carpenter",        city: "Pune",     area: "Hinjewadi, Pune",         years: 11, rating: "4.9", jobs: 312, rate: "₹429", accent: "sage",   available: "Available tomorrow", languages: "Marathi, Hindi", matchScore: 91 },
  { id: "p-04", name: "Sneha Kulkarni",   initials: "SK", service: "AC Technician",    city: "Pune",     area: "Baner, Pune",             years: 5,  rating: "4.5", jobs: 143, rate: "₹479", accent: "forest", available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 82 },
  { id: "p-05", name: "Ajay Deshpande",   initials: "AD", service: "Appliance Repair", city: "Pune",     area: "Aundh, Pune",             years: 8,  rating: "4.7", jobs: 229, rate: "₹369", accent: "blue",   available: "Available today",    languages: "Marathi, Hindi", matchScore: 85 },
  { id: "p-06", name: "Nirmala Joshi",    initials: "NJ", service: "Home Cleaning",    city: "Pune",     area: "Pimpri, Pune",            years: 13, rating: "4.8", jobs: 334, rate: "₹549", accent: "brass",  available: "Available today",    languages: "Marathi, Hindi", matchScore: 87 },
  { id: "p-07", name: "Surekha Salve",    initials: "SS", service: "Caregiver",        city: "Pune",     area: "Hadapsar, Pune",          years: 7,  rating: "4.9", jobs: 187, rate: "₹499", accent: "sage",   available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 90 },
  { id: "p-08", name: "Ganesh Thorat",    initials: "GT", service: "Domestic Helper",  city: "Pune",     area: "Viman Nagar, Pune",       years: 4,  rating: "4.3", jobs: 88,  rate: "₹349", accent: "forest", available: "Available tomorrow", languages: "Marathi, Hindi", matchScore: 74 },
  { id: "p-09", name: "Nilesh Kale",      initials: "NK", service: "Painter",          city: "Pune",     area: "Kharadi, Pune",           years: 12, rating: "4.7", jobs: 276, rate: "₹469", accent: "blue",   available: "Available today",    languages: "Marathi, Hindi", matchScore: 86 },
  { id: "p-10", name: "Varsha Bhosale",   initials: "VB", service: "Gardener",         city: "Pune",     area: "Shivajinagar, Pune",      years: 6,  rating: "4.6", jobs: 119, rate: "₹329", accent: "brass",  available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 80 },
  { id: "p-11", name: "Pramod Waghmare",  initials: "PW", service: "Home Maintenance", city: "Pune",     area: "Deccan, Pune",            years: 9,  rating: "4.5", jobs: 201, rate: "₹419", accent: "sage",   available: "Available today",    languages: "Marathi, Hindi", matchScore: 79 },
  { id: "p-12", name: "Anita Kamble",     initials: "AK", service: "Driver",           city: "Pune",     area: "Sinhagad Road, Pune",     years: 8,  rating: "4.8", jobs: 412, rate: "₹279", accent: "forest", available: "Available today",    languages: "Marathi, Hindi", matchScore: 83 },
  { id: "p-13", name: "Omkar Jagtap",     initials: "OJ", service: "Technician",       city: "Pune",     area: "Magarpatta, Pune",        years: 7,  rating: "4.6", jobs: 178, rate: "₹379", accent: "blue",   available: "Available today",    languages: "Marathi, Hindi, English", matchScore: 81 },
];

export const MARKETPLACE_CATEGORIES = [
  "Electrician", "Plumber", "Carpenter", "AC Technician", "Appliance Repair",
  "Home Cleaning", "Caregiver", "Domestic Helper", "Painter", "Gardener",
  "Home Maintenance", "Driver", "Technician",
] as const;

export const MARKETPLACE_CITIES = ["All cities", "Gurugram", "Mumbai", "Pune"] as const;
