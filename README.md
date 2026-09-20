# Co-Labour (Sahaay) — Sovereign Cooperative Gig Services Platform

> A democratic, cooperative-first alternative to aggregator gig-platforms. Built with zero platform extraction (0% commission), 90% direct payout to worker members, 10% statutory emergency welfare reserve, and real-time State Registrar of Cooperative Societies (RCS) regulatory verification.

---

## 🏛️ System Architecture & Core Principles

Co-Labour operates under the statutory framework of the State Cooperative Societies Act, establishing four integrated portals:

1. **Marketplace & Customer Portal:** Transparent service discovery, booking dispatches, instant emergency service requests, and cooperative audit invoice generation.
2. **Worker Member Operations Desk:** Sovereign gig-worker hub featuring verified society badges, direct earnings tracker, SOS dispatch, and instant emergency welfare aid claims.
3. **Cooperative Society Admin Desk:** Statutory society profile management, member directory, job assignment dispatch ledger, and statutory document verification upload pipeline.
4. **State Registrar (RCS) Regulatory Desk:** Official government audit desk for reviewing society charter applications, verifying statutory documents (PAN, bylaws, bank mandates, committee resolutions), and stamping digital credentials.

---

## 📁 Project Structure

```text
colabour/
├── frontend/                   # React 19 + Vite Frontend
│   ├── public/                 # Static brand assets & logos
│   └── src/
│       ├── components/         # Reusable UI components & Radix primitives
│       │   └── ui/             # Design-system buttons, inputs, dialogs
│       ├── contexts/           # Global React Context providers
│       │   ├── AuthContext.tsx         # Supabase Authentication
│       │   ├── DemoStoreContext.tsx    # Live database store & real-time synchronization
│       │   └── ThemeContext.tsx        # System appearance
│       ├── data/               # Marketplace taxonomy & categories
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities, Supabase client, GSAP animations
│       │   ├── supabase.ts             # Supabase client & Storage document uploader
│       │   ├── gsapAnimations.ts       # GSAP timelines & dashboard reveals
│       │   └── utils.ts                # Class merging & formatters
│       ├── pages/              # Application pages & dashboard routes
│       │   ├── Home.tsx                # Unified cooperative application hub
│       │   ├── LandingPage.tsx         # Public marketing & hero experience
│       │   └── MarketplacePage.tsx     # Direct worker booking marketplace
│       ├── App.tsx             # Root router & application wrapper
│       ├── index.css           # Executive Cooperative Light design system tokens
│       └── main.tsx            # Application entry point
├── backend/                    # Express.js Backend API
│   ├── index.ts                # API server & static middleware
│   └── razorpay.ts             # Payment endpoints & verification
├── shared/                     # Shared TypeScript schemas & database interfaces
│   └── schema.ts               # Entity definitions
├── supabase/                   # Database migrations & RLS policies
│   └── migrations/             # SQL schema definitions & security policies
├── patches/                    # Patched vendor dependencies
├── .env.example                # Template for environment configuration
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript compiler configuration
└── vite.config.ts              # Vite bundler configuration
```

---

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, GSAP, Recharts
- **Backend:** Node.js, Express.js
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Supabase Auth)
- **Storage:** Supabase Storage (`society-documents` bucket for statutory compliance)
- **Payments:** Razorpay integration ready

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**

### 1. Clone the Repository

```bash
git clone https://github.com/Suyashrsingh/colabour.git
cd colabour
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Populate the required credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-supabase-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Database Setup

Run the SQL migration scripts located in `supabase/migrations/` inside your Supabase SQL Editor:
1. `001_initial_schema.sql` — Base tables (`societies`, `users`, `worker_profiles`, `bookings`, `claims`, `issues`, `ratings`).
2. `002_rls_policies.sql` — Row Level Security policies for cooperative access control.
3. Create a public Storage bucket named `society-documents` with public read access.

### 5. Run the Application

```bash
# Start Vite development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 📜 License

MIT License. Designed and engineered for worker-owned cooperative economies.
