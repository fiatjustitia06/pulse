# 🌿 Pulse — Sydney Business Location Intelligence

> AI-powered location analysis for Sydney businesses. Pin a spot on the map and get deep insights on foot traffic, demographics, competition, rent, and projected business growth.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in your Supabase SQL Editor
3. Enable **Email (magic link)** auth in Authentication → Providers
4. Enable **Anonymous sign-in** in Authentication → Providers (for demo access)

### 3. Configure environment
Copy `.env.local` and fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_claude_api_key   # optional — fallback summary used if absent
```

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🗺️ Features

| Page | Description |
|------|-------------|
| `/` | Landing page with animated road network background |
| `/auth` | Magic link sign-in + guest demo access |
| `/onboarding` | 3-step business profile form |
| `/dashboard` | Interactive Leaflet map of Sydney |
| `/analysis` | 10-step animated analysis loader |
| `/analysis/[id]` | Full report with 3 tabs: Overview, Deep Dive, Projections |

## 📊 Analysis Factors
- 🗺️ Geographic location & landmarks
- 🚇 Transport & accessibility (stations, buses, walk score)
- 🚶 Foot traffic estimation
- 👥 Demographics (age, income, density, growth)
- 🏪 Competitor landscape (via Overpass API)
- 💰 Rent & market value estimates
- 📈 Market trends & industry growth
- 🏗️ Future development pipeline
- 🎨 Culture & neighbourhood vibe
- ✨ AI executive summary (Claude Haiku)

## 🆓 Free APIs Used
| API | Purpose |
|-----|---------|
| OpenStreetMap + Leaflet | Interactive map tiles |
| Nominatim | Geocoding & address search |
| Overpass API | Nearby amenities & competitors |
| Claude Haiku | AI summary generation |
| Supabase | Database & auth (free tier) |

## 🎨 Design System
- **Background**: `#E2EFDE` Honeydew
- **Accent**: `#0A8754` Sea Green  
- **Text**: `#131515` Onyx
- **Supplementary**: `#B07156` Clay
- **Typography**: DM Serif Display + DM Sans + DM Mono

## 📦 Tech Stack
- Next.js 14 (App Router)
- React 18 + TypeScript
- Supabase (Auth + Database)
- Leaflet + React-Leaflet
- jsPDF (report export)
- Framer Motion
- Tailwind CSS

## 🏆 Hackathon Notes
- Guest/judge access: use **"Hackathon judge / guest demo"** button on sign-in page
- All map data is real-time from OpenStreetMap
- AI summary requires `ANTHROPIC_API_KEY` — a high-quality fallback is generated without it
- Analysis takes ~10 seconds (Overpass API latency)
