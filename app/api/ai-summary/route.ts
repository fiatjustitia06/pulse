import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { pin, profile, scores, insights } = await req.json()

    const ins = insights || {}
    const geo  = ins.geographic   || {}
    const trn  = ins.transport    || {}
    const dem  = ins.demographics || {}
    const comp = ins.competition  || {}
    const rent = ins.rentValue    || {}
    const cult = (ins as any).culturalFit || {}
    const ext  = (ins as any).externalData || {}

    const prompt = `You are a Sydney commercial property and small business advisor. Analyse this location for the specific business below using ONLY the verified data provided. Use Australian English.

Business: ${profile.business_name} (${profile.category})
What they do: ${profile.description}
Budget: ${profile.budget}
Location: ${pin.address}${pin.suburb ? ', ' + pin.suburb : ''}

VERIFIED DATA:

Geographic (OpenStreetMap/Nominatim):
- Suburb: ${geo.suburb || 'Unknown'}, LGA: ${geo.lga || 'Unknown'}
- ${geo.proximityToCBD || '?'} km from Sydney CBD

Transport (OpenStreetMap Overpass):
- Nearest train: ${trn.nearestStation || 'None found within 1.5km'} (${((trn.stationDistance || 0) * 1000).toFixed(0)}m)
- Bus stops within 800m: ${trn.busRoutes || 0}
${trn.nearestLightRail ? '- Light rail: ' + trn.nearestLightRail : ''}
${ext.walkScore ? `- Walk Score: ${ext.walkScore}/100 (${ext.walkDescription || ''})` : ''}
${ext.transitScore ? `- Transit Score: ${ext.transitScore}/100` : ''}

Demographics (ABS 2021${!dem.suburbMatched ? ' — Greater Sydney avg' : ''}):
- Median household income: $${(dem.medianIncome || 0).toLocaleString()}/yr
- Median age: ${dem.medianAge || '?'} · Density: ${(dem.populationDensity || 0).toLocaleString()}/km²
- Annual growth: ${dem.growthRate || '?'}%/yr
${dem.topCultures ? '- Top cultures: ' + dem.topCultures.join(', ') : ''}
${ext.seifaScore ? `- SEIFA advantage index: ${ext.seifaScore} (${ext.seifaDecile ? 'decile ' + ext.seifaDecile + '/10' : ''})` : ''}

Cultural fit analysis:
- Score: ${cult.score || 'N/A'}/100 (${cult.fitLabel || ''})
${cult.warnings?.length ? '- Warnings: ' + cult.warnings.slice(0,2).join(' | ') : ''}
${cult.opportunities?.length ? '- Opportunities: ' + cult.opportunities.slice(0,2).join(' | ') : ''}

Competition (OpenStreetMap):
- Direct competitors within 800m: ${comp.directCompetitors || 0} (${comp.marketSaturation || 'Unknown'} saturation)
- Named: ${comp.competitorNames?.slice(0,4).join(', ') || 'none found'}
${ext.googlePlacesCount ? `- Google Places competitors: ${ext.googlePlacesCount} (avg rating ${ext.avgRating || 'N/A'})` : ''}

Rent (CBRE/JLL 2023 — indicative ±40%):
- Small (40–80 sqm): $${((rent as any).smallTenancyRent?.min || 0).toLocaleString()}–$${((rent as any).smallTenancyRent?.max || 0).toLocaleString()}/mo
- Medium (80–150 sqm): $${((rent as any).mediumTenancyRent?.min || 0).toLocaleString()}–$${((rent as any).mediumTenancyRent?.max || 0).toLocaleString()}/mo
${ext.domainListings ? `- Domain/REA active listings: ${ext.domainListings} nearby` : ''}

${ext.zoningType ? `Planning/Zoning (NSW Planning Portal): ${ext.zoningType}` : ''}
${ext.weatherSuitability ? `Weather suitability: ${ext.weatherSuitability}` : ''}
${ext.foodPremisesNearby ? `NSW Food Authority: ${ext.foodPremisesNearby} registered food premises within 500m` : ''}
${ext.busTripFrequency ? `TfNSW bus frequency: ${ext.busTripFrequency} services/hour at nearest stop` : ''}

Algorithm-computed component scores (0–100):
- Geographic: ${scores.geographic}
- Transport: ${scores.transport}  
- Foot traffic (amenity proxy): ${scores.footTraffic}
- Demographics: ${scores.demographics}
- Competition: ${scores.competition}
- Rent affordability: ${scores.rentValue}
- Market trend: ${scores.marketTrend}
- Cultural fit: ${scores.culturalFit || cult.score || 'N/A'}

YOUR TASKS:

1. Write a structured executive summary in this EXACT format:

## Verdict
One sentence overall assessment for THIS specific business at this location.

## What the data shows
- 3–4 bullets citing specific data. Reference business description relevance.

## Key concerns
- 2–3 specific data-backed concerns (rent figures, competitor count, cultural mismatch, etc.)

2. After the summary, output a JSON block with your overall score assessment:
<score>
{
  "overall": <number 0-100>,
  "rationale": "<one sentence explaining the score>"
}
</score>

Score criteria: Weight cultural fit, income match to business type, transport, competition, and rent affordability equally. Be honest — a poor fit should score below 50.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) throw new Error('AI API error')
    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Extract AI overall score from <score> block
    let aiOverall: number | null = null
    let aiRationale = ''
    const scoreMatch = text.match(/<score>\s*([\s\S]*?)\s*<\/score>/)
    if (scoreMatch) {
      try {
        const parsed = JSON.parse(scoreMatch[1])
        aiOverall = typeof parsed.overall === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.overall))) : null
        aiRationale = parsed.rationale || ''
      } catch {}
    }

    // Strip the <score> block from the summary text
    const summary = text.replace(/<score>[\s\S]*?<\/score>/g, '').trim()

    return NextResponse.json({ summary, aiOverall, aiRationale })
  } catch (err: any) {
    return NextResponse.json({ summary: '', aiOverall: null, aiRationale: '', error: err.message }, { status: 200 })
  }
}
