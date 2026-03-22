export type BusinessCategory =
  | 'Restaurant & Cafe' | 'Retail & Fashion' | 'Health & Fitness'
  | 'Professional Services' | 'Technology' | 'Entertainment & Leisure'
  | 'Education' | 'Beauty & Wellness' | 'Automotive' | 'Real Estate' | 'Other'

export type BudgetRange =
  | 'Under $50K' | '$50K – $150K' | '$150K – $500K' | '$500K – $1M' | 'Over $1M'

export interface BusinessProfile {
  id: string; user_id: string; business_name: string; owner_name: string
  category: BusinessCategory; description: string; budget: BudgetRange; created_at: string
}

export interface LocationPin {
  lat: number; lng: number; address: string; suburb?: string; postcode?: string
}

export interface LocationScores {
  overall: number; geographic: number; transport: number; footTraffic: number
  demographics: number; competition: number; marketTrend: number; rentValue: number
}

export interface GeographicInsight {
  suburb: string; lga: string; zone: string; nearbyLandmarks: string[]
  proximityToCBD: number; coastalProximity: number
  score: number; summary: string; dataSource: string
}

export interface TransportInsight {
  nearestStation: string; stationDistance: number; busRoutes: number
  walkScore: number; bikeScore: number; parkingAvailability: 'Limited'|'Moderate'|'Good'|'Excellent'
  nearestLightRail?: string | null; nearestFerry?: string | null
  allStations: { name: string; distanceM: number }[]
  score: number; summary: string; dataSource: string
}

export interface FootTrafficInsight {
  estimatedDailyPedestrians: null   // No free data — always null
  peakHours: string[]; weekendMultiplier: null; seasonalVariation: string
  nearbyActiveBusinesses: number    // Real: OSM count within 500m
  restaurantsWithin500m: number; shopsWithin500m: number
  score: number; summary: string; dataSource: string
}

export interface DemographicsInsight {
  medianAge: number; medianIncome: number; populationDensity: number; growthRate: number
  topAgeGroups: string[]; mainOccupations: string[]
  absDataYear: number; suburbMatched: boolean
  score: number; summary: string; dataSource: string
}

export interface CompetitorDetail {
  name: string; distanceM: number; type: string; osmId: number
}

export interface CompetitionInsight {
  directCompetitors: number; competitorNames: string[]
  competitorDetails: CompetitorDetail[]
  marketSaturation: 'Low'|'Medium'|'High'|'Very High'
  nearestCompetitor: number; competitiveAdvantage: string
  osmSearchUrl: string; googleMapsUrl: string
  score: number; summary: string; dataSource: string
}

export interface RentInsight {
  estimatedMonthlyRent: { min: number; max: number }
  pricePerSqm: number; marketTrend: string; affordabilityRating: number
  rentBandSource: string; verifyWith: string
  score: number; summary: string; dataSource: string
}

export interface MarketTrendInsight {
  industryGrowth: string; localDemand: string; onlineTrend: string
  score: number; summary: string; dataSource: string
}

export interface FutureDevelopInsight {
  plannedProjects: string[]; infrastructureUpgrades: string[]
  rezoningPlans: string; developmentImpact: string
  councilDaUrl: string; nswPlanningUrl: string
  score: number; summary: string; dataSource: string
}

export interface CultureInsight {
  neighbourhoodVibe: string; localEvents: string[]
  communityEngagement: string; touristAttraction: boolean
  score: number; summary: string; dataSource: string
}

export interface LocationInsights {
  geographic: GeographicInsight; transport: TransportInsight
  footTraffic: FootTrafficInsight; demographics: DemographicsInsight
  competition: CompetitionInsight; rentValue: RentInsight
  marketTrend: MarketTrendInsight; futureDevelo: FutureDevelopInsight
  culture: CultureInsight
}

// Revenue projections removed — cannot be justified without real trading data.
// Only rent cost context (from published market reports) is provided.
export interface BusinessProjections {
  year1Revenue: null; year3Revenue: null; year5Revenue: null
  monthlyFootTraffic: null; breakEvenMonths: null
  successProbability: null; growthTrajectory: null
  estimatedAnnualRent: number    // Modelled from CBRE/JLL market reports
  rentRangeLow: number; rentRangeHigh: number
  budgetVsRentYear1: number      // % of budget consumed by est. rent year 1
  keyRisks: string[]; keyOpportunities: string[]
  projectionCaveat: string; dataSource: string
}
