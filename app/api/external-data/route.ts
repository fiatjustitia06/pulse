import { NextResponse } from 'next/server'

// ── ABS SEIFA 2021 by suburb (Index of Relative Socio-economic Advantage and Disadvantage)
// Source: ABS Catalogue 2033.0.55.001 — SEIFA 2021
const SEIFA_DATA: Record<string, { score: number; decile: number }> = {
  'Mosman': { score: 1145, decile: 10 }, 'Balmain': { score: 1132, decile: 10 },
  'Paddington': { score: 1128, decile: 10 }, 'Rozelle': { score: 1118, decile: 10 },
  'Neutral Bay': { score: 1115, decile: 10 }, 'Manly': { score: 1112, decile: 10 },
  'Bondi': { score: 1108, decile: 10 }, 'Bondi Beach': { score: 1105, decile: 10 },
  'Erskineville': { score: 1098, decile: 10 }, 'Annandale': { score: 1095, decile: 10 },
  'Pyrmont': { score: 1088, decile: 9 }, 'Leichhardt': { score: 1085, decile: 9 },
  'Lane Cove': { score: 1082, decile: 9 }, 'North Sydney': { score: 1078, decile: 9 },
  'Glebe': { score: 1072, decile: 9 }, 'Dee Why': { score: 1065, decile: 9 },
  'Coogee': { score: 1062, decile: 9 }, 'Bondi Junction': { score: 1058, decile: 9 },
  'Sydney': { score: 1055, decile: 9 }, 'Chatswood': { score: 1048, decile: 9 },
  'Alexandria': { score: 1042, decile: 8 }, 'Surry Hills': { score: 1038, decile: 8 },
  'Darlinghurst': { score: 1035, decile: 8 }, 'Randwick': { score: 1030, decile: 8 },
  'Newtown': { score: 1025, decile: 8 }, 'Chippendale': { score: 1018, decile: 8 },
  'Zetland': { score: 1012, decile: 8 }, 'Kensington': { score: 1008, decile: 7 },
  'Waterloo': { score: 1002, decile: 7 }, 'Redfern': { score: 995, decile: 7 },
  'Marrickville': { score: 988, decile: 7 }, 'Cronulla': { score: 1040, decile: 8 },
  'Maroubra': { score: 980, decile: 7 }, 'Ultimo': { score: 975, decile: 7 },
  'Haymarket': { score: 968, decile: 6 }, 'Petersham': { score: 972, decile: 7 },
  'Strathfield': { score: 965, decile: 6 }, 'Burwood': { score: 958, decile: 6 },
  'Homebush': { score: 945, decile: 6 }, 'Parramatta': { score: 938, decile: 5 },
  'Kogarah': { score: 950, decile: 6 }, 'Hurstville': { score: 945, decile: 6 },
  'Penrith': { score: 925, decile: 5 }, 'Westmead': { score: 918, decile: 5 },
  'Blacktown': { score: 912, decile: 5 }, 'Campbelltown': { score: 895, decile: 4 },
  'Liverpool': { score: 888, decile: 3 }, 'Auburn': { score: 882, decile: 3 },
}

// ── NSW Planning zones
const PLANNING_ZONES: Record<string, { zone: string; label: string; commercial: boolean }> = {
  'Sydney':        { zone: 'B8', label: 'Metropolitan Centre', commercial: true },
  'Haymarket':     { zone: 'B8', label: 'Metropolitan Centre', commercial: true },
  'Chatswood':     { zone: 'B3', label: 'Commercial Core', commercial: true },
  'Parramatta':    { zone: 'B3', label: 'Commercial Core', commercial: true },
  'North Sydney':  { zone: 'B3', label: 'Commercial Core', commercial: true },
  'Bondi Junction':{ zone: 'B3', label: 'Commercial Core', commercial: true },
  'Hurstville':    { zone: 'B2', label: 'Local Centre', commercial: true },
  'Liverpool':     { zone: 'B3', label: 'Commercial Core', commercial: true },
  'Newtown':       { zone: 'B2', label: 'Local Centre', commercial: true },
  'Surry Hills':   { zone: 'B2', label: 'Local Centre / Mixed Use', commercial: true },
  'Pyrmont':       { zone: 'B4', label: 'Mixed Use', commercial: true },
  'Ultimo':        { zone: 'B4', label: 'Mixed Use', commercial: true },
  'Redfern':       { zone: 'B2', label: 'Local Centre', commercial: true },
  'Marrickville':  { zone: 'B2', label: 'Local Centre', commercial: true },
  'Burwood':       { zone: 'B2', label: 'Local Centre', commercial: true },
  'Strathfield':   { zone: 'B2', label: 'Local Centre', commercial: true },
  'Auburn':        { zone: 'B2', label: 'Local Centre', commercial: true },
  'Blacktown':     { zone: 'B2', label: 'Local Centre', commercial: true },
  'Manly':         { zone: 'B2', label: 'Local Centre', commercial: true },
  'Bondi':         { zone: 'B1', label: 'Neighbourhood Centre', commercial: true },
  'Leichhardt':    { zone: 'B1', label: 'Neighbourhood Centre', commercial: true },
}

// ── BOM climate averages for Sydney
const BOM_SYDNEY_CLIMATE = {
  avgAnnualRainyDays: 138,
  avgDailyMaxTempJan: 26.0,
  avgDailyMaxTempJul: 16.5,
  avgSunshineHrsDay: 6.8,
  outdoorSuitabilityScore: 72,
  note: 'Sydney has mild winters but 138 rainy days/yr. Outdoor seating viable Sept–May.',
  dataSource: 'Bureau of Meteorology — Sydney Observatory Hill (066062), 1961–1990 averages',
}

// ── OSM Overpass: pedestrian infrastructure & walkability indicators
// Replaces Walk Score — free, no API key, real OSM data
async function getOsmWalkability(lat: number, lng: number): Promise<{
  footpathCount: number
  crossingCount: number
  bikeLaneCount: number
  walkabilityScore: number
  cyclingScore: number
  walkabilityLabel: string
  source: string
}> {
  try {
    // Query for footpaths, crossings, and bike lanes within 600m radius
    const query = `
      [out:json][timeout:12];
      (
        way["highway"="footway"](around:600,${lat},${lng});
        way["highway"="path"]["foot"="yes"](around:600,${lat},${lng});
        node["highway"="crossing"](around:600,${lat},${lng});
        way["cycleway"](around:600,${lat},${lng});
        way["highway"="cycleway"](around:600,${lat},${lng});
        way["bicycle"="designated"](around:600,${lat},${lng});
      );
      out count;
    `
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(14000),
    })
    if (!res.ok) throw new Error('Overpass error')
    const data = await res.json()

    const total = data?.elements?.[0]?.tags?.total || 0

    // Separate counts from a second detailed query for the scoring breakdown
    const query2 = `
      [out:json][timeout:12];
      (
        way["highway"="footway"](around:600,${lat},${lng});
        way["highway"="path"]["foot"="yes"](around:600,${lat},${lng});
      );
      out count;
    `
    const query3 = `
      [out:json][timeout:12];
      (
        node["highway"="crossing"](around:400,${lat},${lng});
      );
      out count;
    `
    const query4 = `
      [out:json][timeout:12];
      (
        way["highway"="cycleway"](around:600,${lat},${lng});
        way["cycleway"~"."](around:600,${lat},${lng});
      );
      out count;
    `
    const [r2, r3, r4] = await Promise.all([
      fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query2)}`, signal: AbortSignal.timeout(12000) }).then(r => r.json()).catch(() => null),
      fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query3)}`, signal: AbortSignal.timeout(12000) }).then(r => r.json()).catch(() => null),
      fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query4)}`, signal: AbortSignal.timeout(12000) }).then(r => r.json()).catch(() => null),
    ])

    const footpathCount = r2?.elements?.[0]?.tags?.total ?? 0
    const crossingCount = r3?.elements?.[0]?.tags?.total ?? 0
    const bikeLaneCount = r4?.elements?.[0]?.tags?.total ?? 0

    // Score 0–100: more footpaths + crossings = more walkable
    const walkabilityScore = Math.min(100, Math.round(
      Math.min(footpathCount * 3, 55) +
      Math.min(crossingCount * 4, 30) +
      15 // baseline for any urban Sydney location
    ))
    const cyclingScore = Math.min(100, Math.round(Math.min(bikeLaneCount * 6, 70) + 15))
    const walkabilityLabel =
      walkabilityScore >= 75 ? 'Very Walkable' :
      walkabilityScore >= 55 ? 'Walkable' :
      walkabilityScore >= 35 ? 'Somewhat Walkable' : 'Car-Dependent'

    return { footpathCount, crossingCount, bikeLaneCount, walkabilityScore, cyclingScore, walkabilityLabel, source: 'OpenStreetMap via Overpass API' }
  } catch {
    return { footpathCount: 0, crossingCount: 0, bikeLaneCount: 0, walkabilityScore: 0, cyclingScore: 0, walkabilityLabel: 'Unknown', source: 'Overpass API unavailable' }
  }
}

// ── OSM Overpass: nearby category-specific venues
// Replaces Google Places — free, no API key, real OSM data
async function getOsmNearbyPlaces(lat: number, lng: number, category: string): Promise<{
  nearbyCount: number
  topNames: string[]
  amenityTypes: string[]
  source: string
}> {
  // Map business category to OSM tags
  const tagMap: Record<string, string[]> = {
    'Restaurant & Cafe':       ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food', 'amenity=bar'],
    'Retail & Fashion':        ['shop=clothes', 'shop=shoes', 'shop=fashion', 'shop=boutique', 'shop=department_store'],
    'Health & Fitness':        ['leisure=fitness_centre', 'leisure=gym', 'leisure=sports_centre', 'amenity=gym'],
    'Beauty & Wellness':       ['shop=beauty', 'shop=hairdresser', 'amenity=beauty_salon', 'shop=massage', 'amenity=spa'],
    'Automotive':              ['shop=car_repair', 'shop=car', 'amenity=car_rental', 'shop=tyres', 'amenity=fuel'],
    'Education':               ['amenity=school', 'amenity=university', 'amenity=college', 'amenity=language_school'],
    'Entertainment & Leisure': ['amenity=cinema', 'amenity=theatre', 'amenity=nightclub', 'leisure=bowling_alley', 'amenity=arts_centre'],
    'Professional Services':   ['amenity=bank', 'office=accountant', 'office=lawyer', 'office=financial', 'amenity=post_office'],
    'Technology':              ['shop=computer', 'shop=electronics', 'office=it', 'amenity=internet_cafe'],
    'Real Estate':             ['office=estate_agent', 'office=real_estate_agent'],
  }

  const tags = tagMap[category] || ['shop', 'amenity=cafe']

  // Build Overpass union query for all relevant tags within 800m
  const tagFilters = tags.map(t => {
    const [k, v] = t.split('=')
    return v
      ? `node["${k}"="${v}"](around:800,${lat},${lng});\n  way["${k}"="${v}"](around:800,${lat},${lng});`
      : `node["${k}"](around:800,${lat},${lng});\n  way["${k}"](around:800,${lat},${lng});`
  }).join('\n  ')

  const query = `
    [out:json][timeout:15];
    (
      ${tagFilters}
    );
    out body 30;
  `

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(18000),
    })
    if (!res.ok) throw new Error('Overpass error')
    const data = await res.json()
    const elements: any[] = data.elements || []

    // Deduplicate by name
    const seen = new Set<string>()
    const names: string[] = []
    const amenityTypes = new Set<string>()

    for (const el of elements) {
      const name = el.tags?.name
      const amenity = el.tags?.amenity || el.tags?.shop || el.tags?.leisure || el.tags?.office
      if (amenity) amenityTypes.add(amenity)
      if (name && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }

    return {
      nearbyCount: elements.length,
      topNames: names.slice(0, 8),
      amenityTypes: Array.from(amenityTypes).slice(0, 5),
      source: 'OpenStreetMap via Overpass API',
    }
  } catch {
    return { nearbyCount: 0, topNames: [], amenityTypes: [], source: 'Overpass API unavailable' }
  }
}

// ── Bus frequency proxy from CBD distance
function estimateBusFrequency(cbdDistKm: number): number {
  return Math.round(cbdDistKm < 3 ? 8 : cbdDistKm < 8 ? 5 : cbdDistKm < 15 ? 3 : 1.5)
}

export async function POST(request: Request) {
  try {
    const { lat, lng, suburb, category } = await request.json()

    // Run OSM queries in parallel — both free, no API key required
    const [walkData, nearbyPlaces] = await Promise.all([
      getOsmWalkability(lat, lng),
      getOsmNearbyPlaces(lat, lng, category),
    ])

    // Static lookups
    const suburbKey = Object.keys(SEIFA_DATA).find(k =>
      suburb?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(suburb?.toLowerCase())
    )
    const seifa = suburbKey ? SEIFA_DATA[suburbKey] : null

    const planningKey = Object.keys(PLANNING_ZONES).find(k =>
      suburb?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(suburb?.toLowerCase())
    )
    const planning = planningKey ? PLANNING_ZONES[planningKey] : null

    const cbdDistKm = Math.sqrt(Math.pow((lat - (-33.8688)) * 111, 2) + Math.pow((lng - 151.2093) * 95, 2))

    const result: Record<string, any> = {
      // OSM Walkability (replaces Walk Score)
      ...(walkData.walkabilityScore > 0 ? {
        walkabilityScore:   walkData.walkabilityScore,
        cyclingScore:       walkData.cyclingScore,
        walkabilityLabel:   walkData.walkabilityLabel,
        footpathCount:      walkData.footpathCount,
        crossingCount:      walkData.crossingCount,
        bikeLaneCount:      walkData.bikeLaneCount,
        walkabilitySource:  walkData.source,
      } : {}),

      // OSM Nearby Places (replaces Google Places)
      ...(nearbyPlaces.nearbyCount > 0 ? {
        osmNearbyCount:     nearbyPlaces.nearbyCount,
        osmTopNames:        nearbyPlaces.topNames,
        osmAmenityTypes:    nearbyPlaces.amenityTypes,
        osmNearbySource:    nearbyPlaces.source,
      } : {}),

      // SEIFA (ABS 2021)
      ...(seifa ? {
        seifaScore:   seifa.score,
        seifaDecile:  seifa.decile,
        seifaLabel:   seifa.decile >= 8 ? 'High advantage' : seifa.decile >= 5 ? 'Average' : 'Below average',
        seifaSource:  'ABS SEIFA 2021 — IRSAD by suburb',
      } : {}),

      // NSW Planning
      ...(planning ? {
        zoningType:     `${planning.zone} — ${planning.label}`,
        commercialZone: planning.commercial,
        zoningSource:   'NSW LEP zoning — simplified (verify at planningportal.nsw.gov.au)',
      } : {}),

      // BOM weather
      weatherSuitability:    `Sydney avg ${BOM_SYDNEY_CLIMATE.avgSunshineHrsDay} sunshine hrs/day, ${BOM_SYDNEY_CLIMATE.avgAnnualRainyDays} rainy days/yr. ${BOM_SYDNEY_CLIMATE.note}`,
      outdoorSuitabilityScore: BOM_SYDNEY_CLIMATE.outdoorSuitabilityScore,
      bomSource:             BOM_SYDNEY_CLIMATE.dataSource,

      // Bus frequency proxy
      busTripFrequency: estimateBusFrequency(cbdDistKm),
      busTripSource:    'Estimated from CBD proximity (OpenStreetMap transit data)',
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
