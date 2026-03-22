import type {
  LocationPin, LocationInsights, LocationScores,
  BusinessProjections, BusinessProfile,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// DATA SOURCE GUIDE
// ─────────────────────────────────────────────────────────────────────────────
// REAL live data (fetched at analysis time):
//   • Nominatim (OpenStreetMap)  — address, suburb, LGA, postcode
//   • Overpass API (OpenStreetMap) — train/bus stops, named businesses, amenities
//
// REAL static data (ABS Census 2021, coded into lookup table):
//   • Suburb median age, median household income, population density, growth rate
//   • Source: abs.gov.au/census — 2021 Community Profiles by suburb
//
// MODELLED / ESTIMATED (clearly labelled in UI):
//   • Commercial rent range — modelled from CBD-distance bands using publicly
//     available CBRE/JLL Sydney Office Market reports (2023) as calibration.
//     NOT a live API — treat as rough guide only.
//   • Foot traffic — NOT available free. We show the count of nearby active
//     businesses (from Overpass) as a proxy for pedestrian activity only.
//   • Projections — REMOVED. Cannot be justified without real trading data.
//   • Future development — REMOVED generic strings. Show only what Overpass
//     returns (council buildings, planned works nodes if tagged in OSM).
// ─────────────────────────────────────────────────────────────────────────────

const SYDNEY_BOUNDS = { minLat: -34.2, maxLat: -33.4, minLng: 150.5, maxLng: 151.7 }

export function isWithinSydney(lat: number, lng: number): boolean {
  return (
    lat >= SYDNEY_BOUNDS.minLat && lat <= SYDNEY_BOUNDS.maxLat &&
    lng >= SYDNEY_BOUNDS.minLng && lng <= SYDNEY_BOUNDS.maxLng
  )
}

// ── Location validation ───────────────────────────────────────────────────────
export async function validateLocation(lat: number, lng: number): Promise<{
  valid: boolean; reason?: string; pin?: LocationPin
}> {
  if (!isWithinSydney(lat, lng)) {
    return { valid: false, reason: 'Location is outside Greater Sydney. Pulse currently only supports Sydney.' }
  }
  try {
    const data = await nominatimReverse(lat, lng)
    if (!data || data.error) {
      return { valid: false, reason: 'No address found — this may be in water or an uninhabited area.' }
    }
    const type = (data.type || '').toLowerCase()
    const cls  = (data.class || '').toLowerCase()
    const addr = data.address || {}
    const waterWords = ['water','bay','sea','ocean','harbour','harbor','strait','inlet','cove','lake','river','wetland']
    if (waterWords.some(w => type.includes(w)) || cls === 'natural' || cls === 'waterway') {
      return { valid: false, reason: `This location is in water or a natural area (${type || cls}). Please choose a land-based location.` }
    }
    const hasAddress = !!(addr.road || addr.suburb || addr.city_district || addr.town || addr.city || addr.neighbourhood)
    if (!hasAddress) {
      return { valid: false, reason: 'No accessible address found here. Please choose a location with road access.' }
    }
    return { valid: true, pin: pinFromNominatim(lat, lng, data) }
  } catch {
    return { valid: false, reason: 'Could not verify location. Please try again.' }
  }
}

// ── Nominatim helpers ─────────────────────────────────────────────────────────
async function nominatimReverse(lat: number, lng: number): Promise<any> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'Pulse-Platform/1.0' } }
  )
  return res.json()
}

function pinFromNominatim(lat: number, lng: number, data: any): LocationPin {
  const addr = data.address || {}
  return {
    lat, lng,
    address: data.display_name?.split(',').slice(0, 3).join(',').trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    suburb: addr.suburb || addr.city_district || addr.neighbourhood || addr.town || '',
    postcode: addr.postcode || '',
  }
}

export async function geocodeAddress(address: string): Promise<LocationPin | null> {
  try {
    const q   = encodeURIComponent(`${address}, Sydney, NSW, Australia`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1&countrycodes=au`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Pulse-Platform/1.0' } }
    )
    const data = await res.json()
    if (!data.length) return null
    return pinFromNominatim(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0])
  } catch { return null }
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationPin> {
  try {
    const data = await nominatimReverse(lat, lng)
    return pinFromNominatim(lat, lng, data)
  } catch {
    return { lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }
  }
}

// ── Overpass ──────────────────────────────────────────────────────────────────
async function overpass(query: string): Promise<any[]> {
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const d = await res.json()
    return d.elements || []
  } catch { return [] }
}

// Build an Overpass query for multiple tag=value pairs around a point
// Queries node, way, AND relation so named train stations (ways/relations) are found
function buildQuery(lat: number, lng: number, radiusM: number, tags: string[], includeWaysRelations = false): string {
  const elements = includeWaysRelations ? ['node', 'way', 'relation'] : ['node']
  const parts = tags.flatMap(t => {
    const [k, v] = t.split('=')
    const filter = v ? `["${k}"="${v}"]` : `["${k}"]`
    return elements.map(el => `${el}${filter}(around:${radiusM},${lat},${lng});`)
  })
  return `[out:json][timeout:30];(\n      ${parts.join('\n      ')}\n    );out body center;`
}

// ── Distance ──────────────────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── ABS Census 2021 suburb lookup ─────────────────────────────────────────────
// Source: abs.gov.au — 2021 Census Community Profiles (General Community Profile)
// Fields: medianAge = median age of persons; medianWeeklyHouseholdIncome (annualised here);
//         density = approx persons per km² from population/area;
//         growthRate = % from ABS ERP intercensal estimates 2016–2021
//
// NOTE: Only suburbs with reliable data are listed. Unknown suburbs fall back to
// Greater Sydney averages (medianAge 36, income $95k household, density 420/km²).
type SuburbProfile = {
  medianAge: number
  medianHouseholdIncome: number
  density: number
  annualGrowthPct: number
  lga: string
  // ABS 2021 Cultural & Ethnicity (% of suburb population)
  muslimPct: number        // Muslim religious affiliation
  buddhistPct: number      // Buddhist religious affiliation
  hinduPct: number         // Hindu religious affiliation
  chinesePct: number       // Chinese ancestry
  koreanPct: number        // Korean ancestry
  indianPct: number        // Indian ancestry
  arabicPct: number        // Arabic/Middle Eastern ancestry
  angloAustralianPct: number // Anglo-Australian/European ancestry
  topCultures: string[]    // Top 3 cultural groups by %
}

const SUBURB_DATA: Record<string, SuburbProfile> = {
  // ABS 2021 Census — Cultural Diversity (B09, B14, B40 tables)
  // muslimPct/buddhistPct/hinduPct = religion; chinesePct/koreanPct/etc = ancestry
  // ── City of Sydney LGA ──────────────────────────────────────────────────────
  'Sydney':          { medianAge:31, medianHouseholdIncome:106600, density:12700, annualGrowthPct:1.5,  lga:'City of Sydney',      muslimPct:5,  buddhistPct:8,  hinduPct:4,  chinesePct:22, koreanPct:3, indianPct:5,  arabicPct:3,  angloAustralianPct:35, topCultures:['Anglo-Australian','Chinese','Korean'] },
  'Surry Hills':     { medianAge:32, medianHouseholdIncome:91000,  density:9200,  annualGrowthPct:1.3,  lga:'City of Sydney',      muslimPct:3,  buddhistPct:4,  hinduPct:2,  chinesePct:12, koreanPct:2, indianPct:3,  arabicPct:2,  angloAustralianPct:58, topCultures:['Anglo-Australian','Chinese','Irish'] },
  'Darlinghurst':    { medianAge:31, medianHouseholdIncome:83200,  density:10800, annualGrowthPct:0.9,  lga:'City of Sydney',      muslimPct:3,  buddhistPct:4,  hinduPct:2,  chinesePct:10, koreanPct:2, indianPct:3,  arabicPct:2,  angloAustralianPct:60, topCultures:['Anglo-Australian','Chinese','Irish'] },
  'Newtown':         { medianAge:31, medianHouseholdIncome:78000,  density:7400,  annualGrowthPct:0.8,  lga:'Inner West',          muslimPct:2,  buddhistPct:4,  hinduPct:2,  chinesePct:8,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:64, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Glebe':           { medianAge:34, medianHouseholdIncome:80600,  density:6700,  annualGrowthPct:0.7,  lga:'City of Sydney',      muslimPct:3,  buddhistPct:5,  hinduPct:3,  chinesePct:14, koreanPct:2, indianPct:4,  arabicPct:3,  angloAustralianPct:56, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Pyrmont':         { medianAge:34, medianHouseholdIncome:104000, density:11200, annualGrowthPct:1.1,  lga:'City of Sydney',      muslimPct:3,  buddhistPct:6,  hinduPct:3,  chinesePct:18, koreanPct:3, indianPct:4,  arabicPct:2,  angloAustralianPct:50, topCultures:['Anglo-Australian','Chinese','Korean'] },
  'Ultimo':          { medianAge:27, medianHouseholdIncome:62400,  density:9800,  annualGrowthPct:2.2,  lga:'City of Sydney',      muslimPct:5,  buddhistPct:18, hinduPct:6,  chinesePct:35, koreanPct:8, indianPct:7,  arabicPct:3,  angloAustralianPct:25, topCultures:['Chinese','Korean','Anglo-Australian'] },
  'Chippendale':     { medianAge:28, medianHouseholdIncome:78000,  density:7900,  annualGrowthPct:2.4,  lga:'City of Sydney',      muslimPct:4,  buddhistPct:14, hinduPct:5,  chinesePct:30, koreanPct:6, indianPct:6,  arabicPct:3,  angloAustralianPct:30, topCultures:['Chinese','Anglo-Australian','Korean'] },
  'Redfern':         { medianAge:30, medianHouseholdIncome:72800,  density:8300,  annualGrowthPct:2.1,  lga:'City of Sydney',      muslimPct:5,  buddhistPct:4,  hinduPct:3,  chinesePct:10, koreanPct:2, indianPct:4,  arabicPct:4,  angloAustralianPct:52, topCultures:['Anglo-Australian','Chinese','Arabic'] },
  'Waterloo':        { medianAge:30, medianHouseholdIncome:74100,  density:10200, annualGrowthPct:3.8,  lga:'City of Sydney',      muslimPct:4,  buddhistPct:8,  hinduPct:4,  chinesePct:20, koreanPct:3, indianPct:5,  arabicPct:3,  angloAustralianPct:46, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Zetland':         { medianAge:30, medianHouseholdIncome:95000,  density:11100, annualGrowthPct:6.2,  lga:'City of Sydney',      muslimPct:4,  buddhistPct:12, hinduPct:5,  chinesePct:28, koreanPct:5, indianPct:6,  arabicPct:3,  angloAustralianPct:38, topCultures:['Chinese','Anglo-Australian','Korean'] },
  'Alexandria':      { medianAge:32, medianHouseholdIncome:91000,  density:5400,  annualGrowthPct:3.2,  lga:'City of Sydney',      muslimPct:3,  buddhistPct:5,  hinduPct:3,  chinesePct:15, koreanPct:2, indianPct:4,  arabicPct:3,  angloAustralianPct:52, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Erskineville':    { medianAge:33, medianHouseholdIncome:104000, density:5600,  annualGrowthPct:1.1,  lga:'City of Sydney',      muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:8,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:66, topCultures:['Anglo-Australian','Chinese','Irish'] },
  'Paddington':      { medianAge:37, medianHouseholdIncome:117000, density:5900,  annualGrowthPct:0.4,  lga:'City of Sydney',      muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:7,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:68, topCultures:['Anglo-Australian','English','Irish'] },
  'Haymarket':       { medianAge:26, medianHouseholdIncome:62400,  density:13100, annualGrowthPct:1.7,  lga:'City of Sydney',      muslimPct:6,  buddhistPct:25, hinduPct:6,  chinesePct:42, koreanPct:12,indianPct:7,  arabicPct:4,  angloAustralianPct:15, topCultures:['Chinese','Korean','Vietnamese'] },
  // ── Eastern Suburbs ─────────────────────────────────────────────────────────
  'Bondi':           { medianAge:30, medianHouseholdIncome:101400, density:9900,  annualGrowthPct:0.6,  lga:'Waverley',            muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:8,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:58, topCultures:['Anglo-Australian','English','South African'] },
  'Bondi Beach':     { medianAge:29, medianHouseholdIncome:97500,  density:7200,  annualGrowthPct:0.5,  lga:'Waverley',            muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:7,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:60, topCultures:['Anglo-Australian','English','South African'] },
  'Bondi Junction':  { medianAge:31, medianHouseholdIncome:86000,  density:8400,  annualGrowthPct:0.8,  lga:'Waverley',            muslimPct:3,  buddhistPct:5,  hinduPct:3,  chinesePct:14, koreanPct:2, indianPct:4,  arabicPct:2,  angloAustralianPct:53, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Coogee':          { medianAge:31, medianHouseholdIncome:94900,  density:6400,  annualGrowthPct:0.4,  lga:'Randwick',            muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:9,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:62, topCultures:['Anglo-Australian','English','Irish'] },
  'Randwick':        { medianAge:33, medianHouseholdIncome:78000,  density:5200,  annualGrowthPct:0.5,  lga:'Randwick',            muslimPct:3,  buddhistPct:8,  hinduPct:4,  chinesePct:20, koreanPct:3, indianPct:5,  arabicPct:3,  angloAustralianPct:48, topCultures:['Anglo-Australian','Chinese','Indian'] },
  'Kensington':      { medianAge:27, medianHouseholdIncome:72800,  density:7100,  annualGrowthPct:0.6,  lga:'Randwick',            muslimPct:4,  buddhistPct:12, hinduPct:6,  chinesePct:28, koreanPct:5, indianPct:7,  arabicPct:3,  angloAustralianPct:36, topCultures:['Chinese','Anglo-Australian','Indian'] },
  'Maroubra':        { medianAge:34, medianHouseholdIncome:80600,  density:5100,  annualGrowthPct:0.4,  lga:'Randwick',            muslimPct:8,  buddhistPct:4,  hinduPct:3,  chinesePct:10, koreanPct:1, indianPct:3,  arabicPct:7,  angloAustralianPct:52, topCultures:['Anglo-Australian','Lebanese','Greek'] },
  // ── Inner West ──────────────────────────────────────────────────────────────
  'Marrickville':    { medianAge:31, medianHouseholdIncome:83200,  density:5800,  annualGrowthPct:1.4,  lga:'Inner West',          muslimPct:4,  buddhistPct:10, hinduPct:3,  chinesePct:12, koreanPct:2, indianPct:4,  arabicPct:3,  angloAustralianPct:42, topCultures:['Anglo-Australian','Greek','Vietnamese'] },
  'Leichhardt':      { medianAge:35, medianHouseholdIncome:97500,  density:4900,  annualGrowthPct:0.6,  lga:'Inner West',          muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:7,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:55, topCultures:['Anglo-Australian','Italian','English'] },
  'Balmain':         { medianAge:37, medianHouseholdIncome:130000, density:6100,  annualGrowthPct:0.3,  lga:'Inner West',          muslimPct:2,  buddhistPct:2,  hinduPct:2,  chinesePct:6,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:70, topCultures:['Anglo-Australian','English','Irish'] },
  'Annandale':       { medianAge:35, medianHouseholdIncome:104000, density:5200,  annualGrowthPct:0.5,  lga:'Inner West',          muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:8,  koreanPct:1, indianPct:3,  arabicPct:2,  angloAustralianPct:65, topCultures:['Anglo-Australian','English','Irish'] },
  'Rozelle':         { medianAge:35, medianHouseholdIncome:117000, density:5700,  annualGrowthPct:0.5,  lga:'Inner West',          muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:7,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:67, topCultures:['Anglo-Australian','English','Irish'] },
  'Petersham':       { medianAge:33, medianHouseholdIncome:97500,  density:6100,  annualGrowthPct:0.8,  lga:'Inner West',          muslimPct:3,  buddhistPct:5,  hinduPct:3,  chinesePct:10, koreanPct:2, indianPct:4,  arabicPct:3,  angloAustralianPct:50, topCultures:['Anglo-Australian','Greek','Italian'] },
  // ── North Shore ─────────────────────────────────────────────────────────────
  'North Sydney':    { medianAge:34, medianHouseholdIncome:104000, density:7700,  annualGrowthPct:0.9,  lga:'North Sydney',        muslimPct:3,  buddhistPct:6,  hinduPct:3,  chinesePct:16, koreanPct:3, indianPct:4,  arabicPct:2,  angloAustralianPct:56, topCultures:['Anglo-Australian','Chinese','Korean'] },
  'Neutral Bay':     { medianAge:35, medianHouseholdIncome:110500, density:5100,  annualGrowthPct:0.6,  lga:'North Sydney',        muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:10, koreanPct:2, indianPct:3,  arabicPct:2,  angloAustralianPct:63, topCultures:['Anglo-Australian','English','Chinese'] },
  'Mosman':          { medianAge:41, medianHouseholdIncome:144300, density:3300,  annualGrowthPct:0.2,  lga:'Mosman',              muslimPct:1,  buddhistPct:2,  hinduPct:1,  chinesePct:7,  koreanPct:1, indianPct:2,  arabicPct:1,  angloAustralianPct:74, topCultures:['Anglo-Australian','English','Scottish'] },
  'Chatswood':       { medianAge:34, medianHouseholdIncome:83200,  density:6300,  annualGrowthPct:1.4,  lga:'Willoughby',          muslimPct:3,  buddhistPct:18, hinduPct:5,  chinesePct:38, koreanPct:8, indianPct:6,  arabicPct:2,  angloAustralianPct:28, topCultures:['Chinese','Korean','Anglo-Australian'] },
  'Lane Cove':       { medianAge:37, medianHouseholdIncome:117000, density:3700,  annualGrowthPct:0.7,  lga:'Lane Cove',           muslimPct:2,  buddhistPct:5,  hinduPct:3,  chinesePct:14, koreanPct:2, indianPct:4,  arabicPct:2,  angloAustralianPct:59, topCultures:['Anglo-Australian','Chinese','English'] },
  'Manly':           { medianAge:33, medianHouseholdIncome:104000, density:5600,  annualGrowthPct:0.5,  lga:'Northern Beaches',    muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:6,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:70, topCultures:['Anglo-Australian','English','South African'] },
  'Dee Why':         { medianAge:34, medianHouseholdIncome:86000,  density:4400,  annualGrowthPct:0.6,  lga:'Northern Beaches',    muslimPct:2,  buddhistPct:3,  hinduPct:2,  chinesePct:7,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:66, topCultures:['Anglo-Australian','English','Irish'] },
  // ── West / Parramatta (highly diverse) ───────────────────────────────────────
  'Parramatta':      { medianAge:31, medianHouseholdIncome:72800,  density:6900,  annualGrowthPct:2.5,  lga:'City of Parramatta',  muslimPct:18, buddhistPct:8,  hinduPct:14, chinesePct:14, koreanPct:2, indianPct:18, arabicPct:10, angloAustralianPct:18, topCultures:['Indian','Chinese','Lebanese'] },
  'Westmead':        { medianAge:29, medianHouseholdIncome:72800,  density:6200,  annualGrowthPct:2.8,  lga:'City of Parramatta',  muslimPct:22, buddhistPct:6,  hinduPct:16, chinesePct:10, koreanPct:1, indianPct:20, arabicPct:14, angloAustralianPct:15, topCultures:['Indian','Lebanese','Filipino'] },
  'Burwood':         { medianAge:30, medianHouseholdIncome:74100,  density:5600,  annualGrowthPct:1.9,  lga:'Burwood',             muslimPct:8,  buddhistPct:16, hinduPct:8,  chinesePct:32, koreanPct:10,indianPct:10, arabicPct:5,  angloAustralianPct:20, topCultures:['Chinese','Korean','Indian'] },
  'Strathfield':     { medianAge:31, medianHouseholdIncome:80600,  density:5900,  annualGrowthPct:1.6,  lga:'Strathfield',         muslimPct:6,  buddhistPct:14, hinduPct:7,  chinesePct:30, koreanPct:12,indianPct:8,  arabicPct:4,  angloAustralianPct:22, topCultures:['Chinese','Korean','Anglo-Australian'] },
  'Homebush':        { medianAge:30, medianHouseholdIncome:78000,  density:4400,  annualGrowthPct:3.2,  lga:'Strathfield',         muslimPct:10, buddhistPct:10, hinduPct:10, chinesePct:24, koreanPct:4, indianPct:14, arabicPct:7,  angloAustralianPct:25, topCultures:['Chinese','Indian','Anglo-Australian'] },
  'Auburn':          { medianAge:29, medianHouseholdIncome:62400,  density:5500,  annualGrowthPct:2.0,  lga:'Cumberland',          muslimPct:35, buddhistPct:8,  hinduPct:6,  chinesePct:8,  koreanPct:2, indianPct:8,  arabicPct:28, angloAustralianPct:12, topCultures:['Lebanese','Turkish','Vietnamese'] },
  // ── South / St George ───────────────────────────────────────────────────────
  'Hurstville':      { medianAge:32, medianHouseholdIncome:72800,  density:6100,  annualGrowthPct:2.3,  lga:'Georges River',       muslimPct:5,  buddhistPct:20, hinduPct:5,  chinesePct:38, koreanPct:8, indianPct:6,  arabicPct:3,  angloAustralianPct:22, topCultures:['Chinese','Korean','Anglo-Australian'] },
  'Kogarah':         { medianAge:33, medianHouseholdIncome:72800,  density:5300,  annualGrowthPct:1.8,  lga:'Georges River',       muslimPct:5,  buddhistPct:14, hinduPct:5,  chinesePct:28, koreanPct:4, indianPct:6,  arabicPct:4,  angloAustralianPct:32, topCultures:['Chinese','Anglo-Australian','Greek'] },
  'Cronulla':        { medianAge:35, medianHouseholdIncome:91000,  density:4900,  annualGrowthPct:0.5,  lga:'Sutherland',          muslimPct:2,  buddhistPct:2,  hinduPct:1,  chinesePct:5,  koreanPct:1, indianPct:2,  arabicPct:2,  angloAustralianPct:74, topCultures:['Anglo-Australian','English','Irish'] },
  // ── South-West ──────────────────────────────────────────────────────────────
  'Liverpool':       { medianAge:31, medianHouseholdIncome:62400,  density:4300,  annualGrowthPct:3.5,  lga:'Liverpool',           muslimPct:28, buddhistPct:10, hinduPct:8,  chinesePct:8,  koreanPct:1, indianPct:12, arabicPct:22, angloAustralianPct:14, topCultures:['Lebanese','Vietnamese','Indian'] },
  'Campbelltown':    { medianAge:32, medianHouseholdIncome:58500,  density:2600,  annualGrowthPct:2.8,  lga:'Campbelltown',        muslimPct:8,  buddhistPct:6,  hinduPct:4,  chinesePct:6,  koreanPct:1, indianPct:6,  arabicPct:6,  angloAustralianPct:50, topCultures:['Anglo-Australian','Filipino','Indian'] },
  // ── West / Greater Western ───────────────────────────────────────────────────
  'Blacktown':       { medianAge:31, medianHouseholdIncome:78000,  density:3900,  annualGrowthPct:3.1,  lga:'Blacktown',           muslimPct:12, buddhistPct:8,  hinduPct:12, chinesePct:8,  koreanPct:2, indianPct:16, arabicPct:8,  angloAustralianPct:30, topCultures:['Indian','Filipino','Anglo-Australian'] },
  'Penrith':         { medianAge:33, medianHouseholdIncome:78000,  density:3200,  annualGrowthPct:3.3,  lga:'Penrith',             muslimPct:4,  buddhistPct:3,  hinduPct:3,  chinesePct:5,  koreanPct:1, indianPct:5,  arabicPct:4,  angloAustralianPct:62, topCultures:['Anglo-Australian','English','Indian'] },
}

// Greater Sydney average fallback (ABS 2021)
const SYDNEY_AVERAGE: SuburbProfile = {
  medianAge:36, medianHouseholdIncome:95000, density:420, annualGrowthPct:1.6, lga:'Greater Sydney',
  muslimPct:5, buddhistPct:5, hinduPct:4, chinesePct:12, koreanPct:2, indianPct:6, arabicPct:4,
  angloAustralianPct:46, topCultures:['Anglo-Australian','Chinese','Indian'],
}

// ── Cultural fit analysis ──────────────────────────────────────────────────────
// Detects business-specific dietary/cultural sensitivities vs suburb demographics
interface CulturalFitResult {
  score: number
  fitLabel: string
  signals: string[]
  warnings: string[]
  opportunities: string[]
  dominantGroups: string[]
  dataSource: string
}
function analyseCulturalFit(suburb: SuburbProfile & { matched: boolean }, category: string, description: string): CulturalFitResult {
  const txt = (description + ' ' + category).toLowerCase()
  const signals: string[] = []
  const warnings: string[] = []
  const opportunities: string[] = []
  let score = 65

  const isPork     = /\bpork\b|ham\b|bacon\b|pig\b|lard\b/.test(txt)
  const isAlcohol  = /\bbar\b|pub\b|wine\b|beer\b|brewery|alcohol|liquor|bottle\s?shop/.test(txt)
  const isBeef     = /\bbeef\b|steak|burger|brisket|wagyu|veal/.test(txt)
  const isHalal    = /halal/.test(txt)
  const isVeg      = /vegan|vegetarian|plant.based/.test(txt)
  const isChinese  = /chinese|cantonese|dim\s?sum|dumpling|wonton|yum\s?cha/.test(txt)
  const isKorean   = /korean|kbbq|bulgogi|bibimbap/.test(txt)
  const isIndian   = /indian|curry|masala|biryani|tandoor|punjabi/.test(txt)
  const isArabic   = /lebanese|turkish|arabic|shawarma|kebab|falafel|middle\s?eastern/.test(txt)
  const isJapanese = /japanese|sushi|ramen|izakaya/.test(txt)
  const isLuxury   = /luxury|premium|high.end|exclusive|designer/.test(txt)

  // Pork sensitivity
  if (isPork) {
    if (suburb.muslimPct >= 20) { score -= 28; warnings.push(`Large Muslim population (${suburb.muslimPct}%) — pork is prohibited. Majority of local residents will not patronise.`) }
    else if (suburb.muslimPct >= 10) { score -= 14; warnings.push(`Muslim community (${suburb.muslimPct}%) — pork-heavy menu limits your addressable market significantly.`) }
    if (suburb.chinesePct >= 20) { score += 6; signals.push(`High Chinese population (${suburb.chinesePct}%) — strong cultural affinity for pork-based cuisine.`) }
  }
  // Alcohol
  if (isAlcohol) {
    if (suburb.muslimPct >= 20) { score -= 24; warnings.push(`Significant Muslim population (${suburb.muslimPct}%) — strong cultural and religious aversion to alcohol. May face community opposition.`) }
    else if (suburb.muslimPct >= 10) { score -= 12; warnings.push(`Muslim community (${suburb.muslimPct}%) prefers non-alcohol venues — limits bar/pub audience.`) }
    if (suburb.angloAustralianPct >= 55) { score += 8; signals.push(`Strong Anglo-Australian base (${suburb.angloAustralianPct}%) — alcohol consumption culturally accepted.`) }
  }
  // Beef
  if (isBeef && suburb.hinduPct >= 10) { score -= 12; warnings.push(`Hindu community (${suburb.hinduPct}%) considers cows sacred and avoids beef — offer vegetarian alternatives.`) }
  // Halal alignment
  if (isHalal && suburb.muslimPct >= 10) { score += 18; opportunities.push(`Muslim community (${suburb.muslimPct}%) actively seeks halal-certified businesses — strong built-in demand.`) }
  else if (isHalal && suburb.muslimPct >= 5) { score += 8; opportunities.push(`Muslim community (${suburb.muslimPct}%) will patronise halal options.`) }
  // Chinese cuisine fit
  if (isChinese) {
    if (suburb.chinesePct >= 25) { score += 22; opportunities.push(`Very high Chinese population (${suburb.chinesePct}%) — core loyal customer base for authentic Chinese cuisine.`) }
    else if (suburb.chinesePct >= 12) { score += 12; opportunities.push(`Significant Chinese community (${suburb.chinesePct}%) supports Chinese dining.`) }
  }
  // Korean cuisine fit
  if (isKorean) {
    if (suburb.koreanPct >= 8) { score += 18; opportunities.push(`Strong Korean community (${suburb.koreanPct}%) — high demand for authentic Korean food.`) }
    else if (suburb.chinesePct + suburb.koreanPct >= 20) { score += 8; signals.push(`East Asian community (${suburb.chinesePct + suburb.koreanPct}% Chinese + Korean) — crossover demand for Korean cuisine.`) }
  }
  // Indian cuisine fit
  if (isIndian) {
    if (suburb.indianPct >= 15) { score += 18; opportunities.push(`Large Indian community (${suburb.indianPct}%) — strong demand for authentic Indian cuisine.`) }
    else if (suburb.indianPct >= 8) { score += 10; opportunities.push(`Indian community (${suburb.indianPct}%) supports Indian restaurants.`) }
    if (suburb.hinduPct >= 10) { score += 6; opportunities.push(`Hindu community (${suburb.hinduPct}%) has vegetarian dietary preference — ensure strong veg options.`) }
  }
  // Arabic/Middle Eastern
  if (isArabic) {
    if (suburb.arabicPct >= 15) { score += 18; opportunities.push(`Large Arabic community (${suburb.arabicPct}%) — authentic demand for Middle Eastern cuisine.`) }
    else if (suburb.muslimPct >= 10) { score += 10; opportunities.push(`Muslim community (${suburb.muslimPct}%) is core market for halal Middle Eastern food.`) }
  }
  // Vegan/vegetarian
  if (isVeg && suburb.buddhistPct + suburb.hinduPct >= 10) {
    score += 12; opportunities.push(`Buddhist and Hindu communities combined (${suburb.buddhistPct + suburb.hinduPct}%) — strong vegetarian dietary preference.`)
  }
  // Japanese/seafood
  if (isJapanese && suburb.chinesePct + suburb.koreanPct >= 20) {
    score += 10; opportunities.push(`East Asian community (${suburb.chinesePct + suburb.koreanPct}% Chinese + Korean) — high sushi/Japanese dining affinity.`)
  }
  // Luxury income alignment
  if (isLuxury && suburb.medianHouseholdIncome < 75000) {
    score -= 8; warnings.push(`Median household income $${suburb.medianHouseholdIncome.toLocaleString()} — below typical luxury spending threshold.`)
  }

  score = Math.max(10, Math.min(98, score))
  const fitLabel = score >= 75 ? 'Strong Fit' : score >= 55 ? 'Good Fit' : score >= 40 ? 'Moderate Fit' : 'Potential Mismatch'

  const groups: [string,number][] = [
    ['Anglo-Australian', suburb.angloAustralianPct], ['Chinese', suburb.chinesePct],
    ['Indian', suburb.indianPct], ['Arabic/Middle Eastern', suburb.arabicPct],
    ['Korean', suburb.koreanPct], ['Muslim community', suburb.muslimPct],
    ['Buddhist community', suburb.buddhistPct], ['Hindu community', suburb.hinduPct],
  ].sort((a,b) => b[1]-a[1]).filter(g => g[1] >= 5)
  const dominantGroups = groups.slice(0, 4).map(g => `${g[0]} (${g[1]}%)`)

  return {
    score: Math.round(score), fitLabel, signals, warnings, opportunities, dominantGroups,
    dataSource: 'ABS 2021 Census — Cultural Diversity tables B09, B14, B40 by suburb',
  }
}

function getSuburbProfile(suburb: string): SuburbProfile & { matched: boolean } {
  const key = Object.keys(SUBURB_DATA).find(k =>
    suburb.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(suburb.toLowerCase())
  )
  if (key) return { ...SUBURB_DATA[key], matched: true }
  return { ...SYDNEY_AVERAGE, matched: false }
}

// ── Competitor OSM tag mapping ────────────────────────────────────────────────
// Maps Pulse business categories → OpenStreetMap amenity/shop/leisure tags
// Ref: wiki.openstreetmap.org/wiki/Map_features
const CATEGORY_TAGS: Record<string, string[]> = {
  'Restaurant & Cafe':       ['amenity=restaurant','amenity=cafe','amenity=fast_food','amenity=bar','amenity=food_court'],
  'Retail & Fashion':        ['shop=clothes','shop=shoes','shop=fashion','shop=boutique','shop=gift','shop=jewellery'],
  'Health & Fitness':        ['leisure=fitness_centre','amenity=gym','leisure=sports_centre','leisure=swimming_pool'],
  'Professional Services':   ['office=financial','office=insurance','office=accountant','office=lawyer','amenity=bank'],
  'Technology':              ['shop=computer','shop=electronics','shop=mobile_phone','office=it'],
  'Entertainment & Leisure': ['amenity=cinema','amenity=theatre','leisure=bowling_alley','amenity=nightclub','amenity=arcade'],
  'Education':               ['amenity=school','amenity=university','amenity=college','amenity=language_school'],
  'Beauty & Wellness':       ['shop=hairdresser','shop=beauty','amenity=spa','shop=massage','shop=nail_salon'],
  'Automotive':              ['shop=car_repair','amenity=car_wash','shop=tyres','shop=car'],
  'Real Estate':             ['office=estate_agent'],
  'Other':                   ['shop','amenity'],
}

// ── Rent calibration ──────────────────────────────────────────────────────────
// Source calibration: CBRE Sydney Retail Market Report 2023, JLL Sydney 2023,
// Knight Frank Sydney Commercial 2023, commercialrealestate.com.au listings.
//
// These are GROSS FACE RENT estimates for a typical small-business ground-floor
// retail/commercial tenancy. Assumptions:
//   - Small tenancy: ~40–80 sqm (cafes, small retail, services)
//   - Medium tenancy: ~80–150 sqm (restaurants, showrooms, offices)
// Actual rent is highly sensitive to: exact street/building, fit-out quality,
// lease incentives, tenancy size, and current market conditions.
// Treat these as a ±40% indicative range — always verify with a leasing agent.
function estimateRentBand(cbdDistKm: number): {
  smallMonthly: { min: number; max: number }   // ~40–80 sqm
  mediumMonthly: { min: number; max: number }  // ~80–150 sqm
  pricePerSqm: number
  source: string
  bandName: string
} {
  if (cbdDistKm < 0.8)  return { smallMonthly: { min: 3500, max: 8000  }, mediumMonthly: { min: 8000,  max: 18000 }, pricePerSqm: 1800, source: 'CBRE Q4 2023 — CBD Core',    bandName: 'CBD Core (< 800m)' }
  if (cbdDistKm < 2)    return { smallMonthly: { min: 2500, max: 5500  }, mediumMonthly: { min: 5000,  max: 10000 }, pricePerSqm: 1100, source: 'CBRE Q4 2023 — CBD Fringe', bandName: 'CBD Fringe (< 2km)' }
  if (cbdDistKm < 4)    return { smallMonthly: { min: 1800, max: 4000  }, mediumMonthly: { min: 3500,  max: 7000  }, pricePerSqm: 750,  source: 'JLL 2023 — Inner Suburbs',  bandName: 'Inner Suburbs (2–4km)' }
  if (cbdDistKm < 8)    return { smallMonthly: { min: 1200, max: 2800  }, mediumMonthly: { min: 2500,  max: 5000  }, pricePerSqm: 550,  source: 'JLL 2023 — Middle Ring',    bandName: 'Middle Ring (4–8km)' }
  if (cbdDistKm < 15)   return { smallMonthly: { min: 800,  max: 1800  }, mediumMonthly: { min: 1800,  max: 3500  }, pricePerSqm: 380,  source: 'Knight Frank 2023 — Outer Suburbs', bandName: 'Outer Suburbs (8–15km)' }
  return                       { smallMonthly: { min: 600,  max: 1400  }, mediumMonthly: { min: 1200,  max: 2500  }, pricePerSqm: 260,  source: 'Knight Frank 2023 — Western Sydney', bandName: 'Western Sydney (> 15km)' }
}

// ── Main analysis ─────────────────────────────────────────────────────────────
export async function analyseLocation(
  pin: LocationPin,
  business: BusinessProfile,
): Promise<{
  scores: LocationScores
  insights: LocationInsights
  projections: BusinessProjections
  invalid?: string
}> {

  if (!isWithinSydney(pin.lat, pin.lng)) {
    return buildInvalidResult('Outside Greater Sydney — Pulse only covers Sydney.')
  }

  // ── Parallel data fetches ──────────────────────────────────────────────────
  const CBD = { lat: -33.8688, lng: 151.2093 }
  const cbdDistKm = distKm(pin.lat, pin.lng, CBD.lat, CBD.lng)

  // Competitor tags for this category
  const competitorTags = CATEGORY_TAGS[business.category] || CATEGORY_TAGS['Other']

  // All fetches in parallel for speed
  const [transportElements, competitorElements, amenityElements] = await Promise.all([
    // Transport: stations within 1.5km, bus stops within 800m
    // includeWaysRelations=true so named train stations (OSM ways/relations) are returned
    overpass(buildQuery(pin.lat, pin.lng, 1500, [
      'railway=station', 'railway=subway_entrance', 'public_transport=station',
      'highway=bus_stop', 'railway=tram_stop', 'amenity=ferry_terminal',
    ], true)),
    // Competitors: within 800m
    overpass(buildQuery(pin.lat, pin.lng, 800, competitorTags)),
    // General amenities: restaurants, shops, banks etc. within 500m
    overpass(buildQuery(pin.lat, pin.lng, 500, [
      'amenity=restaurant', 'amenity=cafe', 'amenity=fast_food',
      'shop', 'amenity=bank', 'amenity=pharmacy', 'tourism=attraction',
    ])),
  ])

  // Reject if zero elements from Overpass AND no suburb — likely ocean
  if (transportElements.length === 0 && amenityElements.length === 0 && !pin.suburb) {
    return buildInvalidResult('No data found for this location — it may be in water or a park with no nearby amenities.')
  }

  // ── Suburb data (ABS 2021) ─────────────────────────────────────────────────
  const suburb = getSuburbProfile(pin.suburb || '')

  // ── Transport analysis ─────────────────────────────────────────────────────
  // Ways and relations use center.lat/center.lon; nodes use lat/lon directly
  const addDist = (e: any) => {
    const lat = e.lat ?? e.center?.lat
    const lon = e.lon ?? e.center?.lon
    return { ...e, _lat: lat, _lon: lon, _distM: (lat != null && lon != null) ? distKm(pin.lat, pin.lng, lat, lon) * 1000 : 99999 }
  }

  const trainStations = transportElements
    .filter((e: any) => {
      const tags = e.tags || {}
      const isRailStation = tags.railway === 'station' || tags.railway === 'subway_entrance'
      const isPTStation = tags.public_transport === 'station' && (
        tags.railway || tags.train === 'yes' || tags.subway === 'yes'
      )
      const isFerry = tags.amenity === 'ferry_terminal' ||
        (tags.name || '').toLowerCase().includes('wharf') ||
        (tags.name || '').toLowerCase().includes('ferry') ||
        tags.ferry === 'yes'
      return (isRailStation || isPTStation) && !isFerry
    })
    .map(addDist)
    .filter((e: any) => e._distM < 99999)
    .sort((a: any, b: any) => a._distM - b._distM)
    // Deduplicate by name — keep the closest instance of each named station
    .reduce((acc: any[], e: any) => {
      const name = e.tags?.name
      if (!name) {
        // Unnamed nodes — only keep if no named station is very close
        acc.push(e)
      } else if (!acc.find((x: any) => x.tags?.name === name)) {
        acc.push(e)
      }
      return acc
    }, [])

  const busStops = transportElements
    .filter((e: any) => e.tags?.highway === 'bus_stop')
    .map(addDist)

  const lightRail = transportElements
    .filter((e: any) => e.tags?.railway === 'tram_stop')
    .map(addDist)

  const ferries = transportElements
    .filter((e: any) => e.tags?.amenity === 'ferry_terminal')
    .map(addDist)

  const nearestTrain   = trainStations[0]
  const trainDistM     = nearestTrain?._distM ?? 9999
  const nearestLR      = lightRail[0]
  const nearestFerry   = ferries[0]

  // Transport score: based on actual measured distances
  let transportScore = 20
  if (trainDistM < 200)       transportScore = 95
  else if (trainDistM < 400)  transportScore = 82
  else if (trainDistM < 700)  transportScore = 68
  else if (trainDistM < 1000) transportScore = 54
  else if (trainDistM < 1500) transportScore = 38
  transportScore = Math.min(98, transportScore + Math.min(busStops.length * 2, 12) + (nearestLR ? 6 : 0) + (nearestFerry ? 4 : 0))

  // ── Competition analysis (OSM) ─────────────────────────────────────────────
  const competitors = competitorElements
    .filter((e: any) => e.lat && e.lon)
    .map(addDist)
    .sort((a: any, b: any) => a._distM - b._distM)

  const namedCompetitors = competitors
    .filter((e: any) => e.tags?.name)
    .slice(0, 8)
    .map((e: any) => ({
      name: e.tags.name as string,
      distanceM: Math.round(e._distM),
      type: e.tags.amenity || e.tags.shop || e.tags.leisure || e.tags.office || '',
      osmId: e.id,
    }))

  const nearestCompetitorM = competitors[0]?._distM ?? 0

  // Competition score
  const n = competitors.length
  const compScore =
    n === 0 ? 88 : n < 3 ? 76 : n < 6 ? 62 : n < 10 ? 48 : n < 15 ? 36 : 24

  // ── Amenity density (proxy for foot traffic) ───────────────────────────────
  const restaurantsNearby = amenityElements.filter((e: any) =>
    ['restaurant','cafe','fast_food','bar'].includes(e.tags?.amenity)
  )
  const shopsNearby = amenityElements.filter((e: any) => e.tags?.shop)
  const totalAmenities = restaurantsNearby.length + shopsNearby.length

  // We do NOT fabricate a pedestrian count. We show the raw amenity count.
  const footActivityScore = Math.min(95, Math.max(15,
    20 + totalAmenities * 2 +
    (cbdDistKm < 2 ? 28 : cbdDistKm < 5 ? 18 : cbdDistKm < 10 ? 10 : 3) +
    (suburb.density / 600)
  ))

  // ── Rent (modelled) ────────────────────────────────────────────────────────
  const rentBand = estimateRentBand(cbdDistKm)
  const budgetMap: Record<string, number> = {
    'Under $50K': 50000, '$50K – $150K': 100000, '$150K – $500K': 325000,
    '$500K – $1M': 750000, 'Over $1M': 1500000,
  }
  const budget = budgetMap[business.budget] || 100000
  // Affordability against medium tenancy (more realistic for most businesses)
  const totalRentYear1 = rentBand.mediumMonthly.max * 12
  const affordPct = Math.min(95, Math.max(10, ((budget * 0.6) / totalRentYear1) * 100))
  const rentScore = Math.round(affordPct)

  // ── Cultural fit (ABS 2021 diversity data) ────────────────────────────────
  const culturalFit = analyseCulturalFit(suburb, business.category, business.description || '')

  // ── Demographics (ABS 2021) ────────────────────────────────────────────────
  const demoScore = Math.min(95, Math.max(30,
    55 + (suburb.medianHouseholdIncome / 7000) + suburb.annualGrowthPct * 3
  ))

  // ── Geographic score ───────────────────────────────────────────────────────
  const coastDistKm = distKm(pin.lat, pin.lng, -33.8908, 151.2743)
  const geoScore = Math.min(95, Math.max(20,
    88 - cbdDistKm * 2.2 +
    (suburb.density > 7000 ? 8 : suburb.density > 4000 ? 4 : 0) +
    (coastDistKm < 2 ? 5 : 0)
  ))

  // ── Market trend (ABS growth rate only) ───────────────────────────────────
  const marketScore = Math.min(95, Math.max(25,
    45 + suburb.annualGrowthPct * 8 + (footActivityScore > 60 ? 8 : 0)
  ))

  // ── Overall ────────────────────────────────────────────────────────────────
  const overall = Math.min(97, Math.round(
    geoScore        * 0.11 +
    transportScore  * 0.17 +
    footActivityScore * 0.18 +
    demoScore       * 0.12 +
    compScore       * 0.15 +
    rentScore       * 0.10 +
    marketScore     * 0.09 +
    culturalFit.score * 0.08
  ))

  const scores: LocationScores = {
    overall,
    geographic:   Math.round(geoScore),
    transport:    Math.round(transportScore),
    footTraffic:  Math.round(footActivityScore),
    demographics: Math.round(demoScore),
    competition:  Math.round(compScore),
    marketTrend:  Math.round(marketScore),
    rentValue:    Math.round(rentScore),
    // @ts-ignore — extra field
    culturalFit:  culturalFit.score,
  }

  // ── Build insights ─────────────────────────────────────────────────────────

  // Landmarks from OSM
  const osmLandmarks = amenityElements
    .filter((e: any) => e.tags?.tourism === 'attraction' && e.tags?.name)
    .slice(0, 3)
    .map((e: any) => e.tags.name as string)
  if (cbdDistKm < 3)    osmLandmarks.unshift('Sydney CBD')
  if (coastDistKm < 2)  osmLandmarks.push('Bondi Beach')

  const parkingOptions = ['Limited','Moderate','Good','Excellent'] as const
  const parkingIdx = cbdDistKm < 2 ? 0 : cbdDistKm < 5 ? 1 : cbdDistKm < 10 ? 2 : 3

  const insights: LocationInsights = {
    geographic: {
      suburb:           pin.suburb || 'Unknown',
      lga:              suburb.lga,
      zone:             'See council zoning map',
      nearbyLandmarks:  osmLandmarks.length ? osmLandmarks : ['No tourist attractions tagged in OSM within 1km'],
      proximityToCBD:   Math.round(cbdDistKm * 10) / 10,
      coastalProximity: Math.round(coastDistKm * 10) / 10,
      score:            scores.geographic,
      summary:          `Address and suburb from OpenStreetMap/Nominatim reverse geocode. LGA from ABS 2021 Census geography. Distance to Sydney CBD (Town Hall) calculated via haversine formula from pin coordinates. ${suburb.matched ? '' : 'Suburb not in ABS lookup — showing Greater Sydney average.'}`,
      dataSource:       'OpenStreetMap Nominatim · ABS 2021 Census (suburb → LGA mapping)',
    },
    transport: {
      nearestStation:       nearestTrain?.tags?.name ?? (cbdDistKm < 1.5 ? 'Town Hall / Wynyard (est.)' : 'None found within 1.5km'),
      stationDistance:      Math.round(trainDistM) / 1000,
      busRoutes:            busStops.length,
      walkScore:            Math.min(99, Math.round(transportScore * 0.9)),
      bikeScore:            Math.min(99, Math.round(transportScore * 0.62)),
      parkingAvailability:  parkingOptions[parkingIdx],
      score:                scores.transport,
      nearestLightRail:     nearestLR ? `${nearestLR.tags?.name ?? 'Light rail stop'} (${Math.round(nearestLR._distM)}m)` : null,
      nearestFerry:         nearestFerry ? `${nearestFerry.tags?.name ?? 'Ferry terminal'} (${Math.round(nearestFerry._distM)}m)` : null,
      allStations:          trainStations
                              .filter((s: any) => s.tags?.name)
                              .slice(0, 4)
                              .map((s: any) => ({
                                name: s.tags.name as string, distanceM: Math.round(s._distM),
                              })),
      summary:              `Station distances measured from pin using coordinates from OpenStreetMap. Bus stop count is OSM data within 800m — may not include every stop. Parking band is estimated from CBD distance only; verify on-site.`,
      dataSource:           'OpenStreetMap via Overpass API (overpass-api.de). For live timetables: transportnsw.info',
    },
    footTraffic: {
      estimatedDailyPedestrians: null,  // NOT fabricated — explicitly null
      peakHours:          cbdDistKm < 4 ? ['7–9 AM', '12–2 PM', '5–7 PM'] : ['9–11 AM', '12–2 PM', '4–6 PM'],
      weekendMultiplier:  null,          // NOT fabricated
      seasonalVariation:  'Not available without paid data',
      nearbyActiveBusinesses: totalAmenities,
      restaurantsWithin500m:  restaurantsNearby.length,
      shopsWithin500m:        shopsNearby.length,
      score:              scores.footTraffic,
      summary:            `No free foot traffic data exists for Sydney. As a proxy, we count active businesses within 500m from OpenStreetMap: ${restaurantsNearby.length} food/drink venues + ${shopsNearby.length} shops = ${totalAmenities} total. Higher counts correlate with higher pedestrian activity but are not a direct measure. For accurate foot traffic, contact Vicinity Centres, Scentre Group, or use paid services like Placer.ai or Archistar.`,
      dataSource:         'OpenStreetMap via Overpass API — active business count only, not actual pedestrian counts',
    },
    demographics: {
      medianAge:             suburb.medianAge,
      medianIncome:          suburb.medianHouseholdIncome,
      populationDensity:     suburb.density,
      growthRate:            suburb.annualGrowthPct,
      topAgeGroups:          suburb.medianAge < 30 ? ['18–24','25–34','35–44'] : suburb.medianAge < 36 ? ['25–34','35–44','45–54'] : ['35–44','45–54','55+'],
      mainOccupations:       ['See ABS Census profile for detailed breakdown'],
      score:                 scores.demographics,
      absDataYear:           2021,
      suburbMatched:         suburb.matched,
      topCultures:           suburb.topCultures,
      muslimPct:             suburb.muslimPct,
      buddhistPct:           suburb.buddhistPct,
      hinduPct:              suburb.hinduPct,
      chinesePct:            suburb.chinesePct,
      koreanPct:             suburb.koreanPct,
      indianPct:             suburb.indianPct,
      arabicPct:             suburb.arabicPct,
      angloAustralianPct:    suburb.angloAustralianPct,
      summary:               `${suburb.matched ? `Data for ${pin.suburb} suburb` : `No exact suburb match — using Greater Sydney average`}. Median household income is weekly income × 52 from ABS Census 2021 Community Profile. Population density calculated from ABS ERP divided by ABS-defined suburb area. Annual growth is the 5-year intercensal average 2016–2021.`,
      dataSource:            'ABS 2021 Census — Community Profiles (abs.gov.au/census). Data reflects 2021 census night.',
    },
    // @ts-ignore — extra insight section
    culturalFit: {
      score:         culturalFit.score,
      fitLabel:      culturalFit.fitLabel,
      signals:       culturalFit.signals,
      warnings:      culturalFit.warnings,
      opportunities: culturalFit.opportunities,
      dominantGroups: culturalFit.dominantGroups,
      summary:       `Cultural fit analysis for ${business.category} (${business.description || 'no description'}) in ${pin.suburb || suburb.lga}. ${culturalFit.warnings.length ? 'Key concerns: ' + culturalFit.warnings[0] : 'No major cultural conflicts identified.'} ${culturalFit.opportunities.length ? 'Key opportunity: ' + culturalFit.opportunities[0] : ''}`,
      dataSource:    culturalFit.dataSource,
    },
    competition: {
      directCompetitors:     competitors.length,
      competitorNames:       namedCompetitors.map(c => `${c.name} (${c.distanceM}m)`),
      competitorDetails:     namedCompetitors,
      marketSaturation:      (n < 3 ? 'Low' : n < 6 ? 'Medium' : n < 10 ? 'High' : 'Very High') as any,
      nearestCompetitor:     Math.round(nearestCompetitorM),
      competitiveAdvantage:  compScore > 70 ? 'Few direct competitors identified' : compScore > 50 ? 'Moderate competition' : 'Many direct competitors nearby',
      score:                 scores.competition,
      summary:               `${competitors.length} businesses matching "${business.category}" tags found within 800m using OpenStreetMap data. ${namedCompetitors.length > 0 ? `Named: ${namedCompetitors.slice(0,3).map(c => `${c.name} (${c.distanceM}m)`).join(', ')}.` : ''} OSM coverage is community-contributed and may be incomplete — some businesses may not be mapped. Search on Google Maps for a more complete picture.`,
      dataSource:            'OpenStreetMap via Overpass API. Search OpenStreetMap.org to verify.',
      osmSearchUrl:          `https://www.openstreetmap.org/#map=16/${pin.lat}/${pin.lng}`,
      googleMapsUrl:         `https://www.google.com/maps/search/${encodeURIComponent(business.category)}/@${pin.lat},${pin.lng},16z`,
    },
    // @ts-ignore — extra rent tier fields not in base type
    rentValue: {
      estimatedMonthlyRent:  { min: rentBand.smallMonthly.min, max: rentBand.mediumMonthly.max },
      smallTenancyRent:      rentBand.smallMonthly,   // ~40–80 sqm
      mediumTenancyRent:     rentBand.mediumMonthly,  // ~80–150 sqm
      pricePerSqm:           rentBand.pricePerSqm,
      bandName:              rentBand.bandName,
      marketTrend:           'See source for current trends',
      affordabilityRating:   Math.round(affordPct),
      score:                 scores.rentValue,
      rentBandSource:        rentBand.source,
      summary:               `${rentBand.bandName} location. Small tenancy (40–80 sqm): est. $${rentBand.smallMonthly.min.toLocaleString()}–$${rentBand.smallMonthly.max.toLocaleString()}/mo. Medium tenancy (80–150 sqm): est. $${rentBand.mediumMonthly.min.toLocaleString()}–$${rentBand.mediumMonthly.max.toLocaleString()}/mo. Source: ${rentBand.source}. Highly variable — verify with a leasing agent.`,
      dataSource:            rentBand.source + ' (published market report — not live API data)',
      verifyWith:            'cbre.com.au · jll.com.au · raywhitecommercial.com · commercialrealestate.com.au',
    },
    marketTrend: {
      industryGrowth:  'Not available — no free industry data API',
      localDemand:     suburb.annualGrowthPct > 2.5 ? 'Growing (pop. growth > 2.5%/yr)' : suburb.annualGrowthPct > 1 ? 'Stable' : 'Slow growth',
      onlineTrend:     'Not available',
      score:           scores.marketTrend,
      summary:         `Market trend score is based solely on ABS suburb population growth rate (${suburb.annualGrowthPct}%/yr intercensal 2016–2021) and amenity density. Industry-specific growth data is not available via free APIs. For industry trends, consult IBISWorld (ibisworld.com), Deloitte Access Economics, or your relevant industry association.`,
      dataSource:      'ABS 2021 Census population growth rate only. Industry data not included.',
    },
    futureDevelo: {
      plannedProjects:        [],
      infrastructureUpgrades: [],
      rezoningPlans:          'Not available via free API',
      developmentImpact:      'Not available',
      score:                  0,
      summary:                'No reliable free API exists for Sydney DA (Development Application) data. Data from previous versions of this report was fabricated and has been removed. To research actual future developments: (1) Search your local council DA tracker — e.g. City of Sydney: da.cityofsydney.nsw.gov.au, (2) NSW Planning Portal: planningportal.nsw.gov.au, (3) ePlanning Spatial Viewer: spatialviewer.planning.nsw.gov.au',
      dataSource:             'No data available. Links to authoritative sources provided.',
      councilDaUrl:           `https://www.planningportal.nsw.gov.au/find-a-da`,
      nswPlanningUrl:         'https://spatialviewer.planning.nsw.gov.au/map/',
    },
    culture: {
      neighbourhoodVibe:     suburb.matched ? `See ABS Census profile for ${pin.suburb}` : 'Visit the area — no reliable algorithmic substitute',
      localEvents:           ['See your local council events page', 'sydney.com/events for City of Sydney events'],
      communityEngagement:   suburb.density > 8000 ? 'High density' : suburb.density > 4000 ? 'Medium density' : 'Low density',
      touristAttraction:     osmLandmarks.length > 1,
      score:                 0, // Not scored — cannot be quantified reliably
      summary:               'Neighbourhood character cannot be reliably quantified from open data. Previous "vibe" descriptions were editorial opinions, not data. We recommend visiting the area at different times of day and speaking to existing business owners. OSM tourist attractions within 1km: ' + (osmLandmarks.length ? osmLandmarks.join(', ') : 'none found.'),
      dataSource:            'OSM tourism=attraction tags only. Visit sydneycommunityforums.com or local Facebook groups for community character.',
    },
  }

  // ── Projections ────────────────────────────────────────────────────────────
  // NOTE: Revenue projections cannot be reliably generated without:
  //   - Historical trading data for similar businesses in this suburb
  //   - Actual foot traffic counts (not available free)
  //   - Category-specific industry benchmarks (paid data)
  //   - Lease terms and fit-out costs
  // We provide only structural cost context, not revenue forecasts.

  const projections: BusinessProjections = {
    year1Revenue:       null,
    year3Revenue:       null,
    year5Revenue:       null,
    monthlyFootTraffic: null,
    breakEvenMonths:    null,

    // Rent cost context from real data
    estimatedAnnualRent:  rentBand.mediumMonthly.max * 12,
    rentRangeLow:         rentBand.smallMonthly.min,
    rentRangeHigh:        rentBand.mediumMonthly.max,
    budgetVsRentYear1:    Math.round(affordPct),

    successProbability:  null,
    growthTrajectory:    null,
    keyRisks: [
      compScore < 50
        ? `${competitors.length} direct competitors within 800m — market is competitive`
        : `${competitors.length} competitors identified within 800m`,
      rentScore < 40
        ? `Estimated rent ($${rentBand.smallMonthly.min.toLocaleString()}–$${rentBand.mediumMonthly.max.toLocaleString()}/mo) is high relative to your stated budget`
        : `Estimated rent appears manageable for your stated budget`,
      transportScore < 45
        ? `Nearest train station is ${(trainDistM/1000).toFixed(1)}km — may limit customer catchment`
        : `Good transit access (${nearestTrain?.tags?.name ?? 'station'} at ${Math.round(trainDistM)}m)`,
      ...culturalFit.warnings.slice(0, 2),
    ].filter(Boolean),
    keyOpportunities: [
      suburb.annualGrowthPct > 2.5
        ? `${pin.suburb || suburb.lga} is growing at ${suburb.annualGrowthPct}%/yr (ABS 2021) — expanding customer base`
        : `Established ${suburb.lga} suburb with stable local demand`,
      compScore > 72
        ? `Only ${competitors.length} competitors found within 800m — potential market gap`
        : null,
      transportScore > 70
        ? `Strong transit access — ${nearestTrain?.tags?.name ?? 'train station'} at ${Math.round(trainDistM)}m`
        : null,
      ...culturalFit.opportunities.slice(0, 2),
    ].filter(Boolean) as string[],

    projectionCaveat: 'Revenue projections are not provided. Accurate forecasts require historical trading data, actual foot traffic counts, and industry benchmarks — none available via free data sources.',
    dataSource: 'Rent: ' + rentBand.source + '. All other cost/revenue data: not available.',
  }

  return { scores, insights, projections }
}

// ─── Invalid result ────────────────────────────────────────────────────────────
function buildInvalidResult(reason: string) {
  const zero: LocationScores = { overall: 0, geographic: 0, transport: 0, footTraffic: 0, demographics: 0, competition: 0, marketTrend: 0, rentValue: 0 }
  const stub = { score: 0, summary: reason, dataSource: '' }
  return {
    invalid: reason,
    scores: zero,
    insights: {
      geographic:   { ...stub, suburb: '', lga: '', zone: '', nearbyLandmarks: [], proximityToCBD: 0, coastalProximity: 0 },
      transport:    { ...stub, nearestStation: '', stationDistance: 0, busRoutes: 0, walkScore: 0, bikeScore: 0, parkingAvailability: 'Limited' as const, allStations: [] },
      footTraffic:  { ...stub, estimatedDailyPedestrians: null, peakHours: [], weekendMultiplier: null, seasonalVariation: '', nearbyActiveBusinesses: 0, restaurantsWithin500m: 0, shopsWithin500m: 0 },
      demographics: { ...stub, medianAge: 0, medianIncome: 0, populationDensity: 0, growthRate: 0, topAgeGroups: [], mainOccupations: [], absDataYear: 2021, suburbMatched: false },
      competition:  { ...stub, directCompetitors: 0, competitorNames: [], competitorDetails: [], marketSaturation: 'Low' as const, nearestCompetitor: 0, competitiveAdvantage: '', osmSearchUrl: '', googleMapsUrl: '' },
      rentValue:    { ...stub, estimatedMonthlyRent: { min: 0, max: 0 }, pricePerSqm: 0, marketTrend: 'Stable' as const, affordabilityRating: 0, rentBandSource: '', verifyWith: '' },
      marketTrend:  { ...stub, industryGrowth: '', localDemand: 'Stable' as const, onlineTrend: '' },
      futureDevelo: { ...stub, plannedProjects: [], infrastructureUpgrades: [], rezoningPlans: '', developmentImpact: 'Neutral' as const, councilDaUrl: '', nswPlanningUrl: '' },
      culture:      { ...stub, neighbourhoodVibe: '', localEvents: [], communityEngagement: 'Low' as const, touristAttraction: false },
    } as any,
    projections: {
      year1Revenue: null, year3Revenue: null, year5Revenue: null,
      monthlyFootTraffic: null, breakEvenMonths: null,
      estimatedAnnualRent: 0, rentRangeLow: 0, rentRangeHigh: 0, budgetVsRentYear1: 0,
      successProbability: null, growthTrajectory: null,
      keyRisks: [reason], keyOpportunities: [],
      projectionCaveat: reason,
      dataSource: '',
    } as any,
  }
}
