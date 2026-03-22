import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { pin, profile, scores, insights, projections } = await req.json()

    const prompt = `You are a commercial property and business location analyst specialising in the Sydney market. 
    
Analyse the following location data and write a professional, specific, and actionable business location report summary for ${profile.business_name} (${profile.category}).

LOCATION: ${pin.address}, ${pin.suburb || 'Sydney'} NSW ${pin.postcode || ''}
BUSINESS: ${profile.description}
BUDGET: ${profile.budget}

SCORES (out of 100):
- Overall: ${scores.overall}
- Geographic: ${scores.geographic}
- Transport: ${scores.transport}  
- Foot Traffic: ${scores.footTraffic}
- Demographics: ${scores.demographics}
- Competition: ${scores.competition}
- Market Trend: ${scores.marketTrend}
- Rent/Value: ${scores.rentValue}

KEY INSIGHTS:
- Suburb vibe: ${insights.culture?.neighbourhoodVibe}
- Proximity to CBD: ${insights.geographic?.proximityToCBD}km
- Nearest station: ${insights.transport?.nearestStation} (${insights.transport?.stationDistance}km)
- Daily pedestrians: ~${insights.footTraffic?.estimatedDailyPedestrians?.toLocaleString()}
- Direct competitors nearby: ${insights.competition?.directCompetitors}
- Market saturation: ${insights.competition?.marketSaturation}
- Est. monthly rent: $${insights.rentValue?.estimatedMonthlyRent?.min?.toLocaleString()}–$${insights.rentValue?.estimatedMonthlyRent?.max?.toLocaleString()}
- Population growth: ${insights.demographics?.growthRate}% p.a.
- Future development impact: ${insights.futureDevelo?.developmentImpact}

PROJECTIONS:
- Year 1 revenue: $${projections.year1Revenue?.min?.toLocaleString()}–$${projections.year1Revenue?.max?.toLocaleString()}
- Break-even: ~${projections.breakEvenMonths} months
- Success probability: ${projections.successProbability}%
- Growth trajectory: ${projections.growthTrajectory}

Write a 3-4 paragraph executive summary that:
1. Opens with a direct verdict on whether this is a good location
2. Highlights the 2-3 strongest factors and explains why they matter for this specific business
3. Addresses the 1-2 biggest risks honestly
4. Closes with a specific strategic recommendation

Tone: Professional, direct, Sydney-specific. Avoid generic language. Reference actual suburb names and specific local market context. Do not use bullet points — write in flowing paragraphs.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ summary: generateFallback(profile, pin, scores) })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ summary: generateFallback(profile, pin, scores) })
    }

    const data = await response.json()
    const summary = data.content?.[0]?.text || generateFallback(profile, pin, scores)

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summary API error:', err)
    return NextResponse.json({ summary: '' }, { status: 500 })
  }
}

function generateFallback(profile: any, pin: any, scores: any): string {
  const score = scores.overall
  const rating = score >= 75 ? 'strong' : score >= 60 ? 'solid' : score >= 45 ? 'moderate' : 'challenging'
  const suburb = pin.suburb || 'this Sydney location'
  return `${suburb} presents a ${rating} opportunity for ${profile.business_name}, with an overall location score of ${score}/100. ${scores.transport > 65 ? `Strong public transport connectivity broadens the catchment area significantly.` : `Transport access is reasonable, though the location relies more on local foot traffic than transit-driven customers.`} ${scores.footTraffic > 60 ? `Foot traffic levels are promising, with consistent pedestrian activity throughout the week.` : `Foot traffic is moderate, meaning marketing investment will be critical in the early months to drive awareness.`}

The competitive landscape shows ${scores.competition > 65 ? `manageable competition — a genuine opportunity gap exists for a well-executed business in the ${profile.category} space.` : `a saturated market that will demand clear differentiation and a strong value proposition to win market share.`} Demographic alignment is ${scores.demographics > 65 ? 'excellent' : 'reasonable'}, with the local population profile ${scores.demographics > 60 ? 'closely matching your target customer.' : 'requiring targeted marketing to build a loyal base.'}

Based on your ${profile.budget} budget and current market rents, this location appears ${scores.rentValue > 55 ? 'financially viable with manageable overheads.' : 'tight on affordability — early cash flow planning will be essential.'} The recommendation is to ${score >= 65 ? 'proceed with this location, subject to lease terms and final due diligence.' : score >= 50 ? 'consider this location carefully, weighing it against alternatives before committing.' : 'explore alternative locations before committing — the risk profile is elevated at this site.'}`
}
