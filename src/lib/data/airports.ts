// A small airport directory covering the routes in the sample fleets.
// `demand` is a 0..1 index of private charter demand used to price empty legs.

export interface Airport {
  icao: string;
  city: string;
  lat: number;
  lon: number;
  demand: number;
  // Months (1-12) where demand peaks, e.g. ski or beach season.
  peakMonths?: number[];
}

export const AIRPORTS: Record<string, Airport> = {
  KTEB: { icao: "KTEB", city: "Teterboro", lat: 40.85, lon: -74.06, demand: 1.0 },
  KHPN: { icao: "KHPN", city: "White Plains", lat: 41.07, lon: -73.71, demand: 0.9 },
  KBED: { icao: "KBED", city: "Boston", lat: 42.47, lon: -71.29, demand: 0.75 },
  KACK: { icao: "KACK", city: "Nantucket", lat: 41.25, lon: -70.06, demand: 0.7, peakMonths: [6, 7, 8] },
  KPBI: { icao: "KPBI", city: "Palm Beach", lat: 26.68, lon: -80.1, demand: 0.95, peakMonths: [12, 1, 2, 3] },
  KOPF: { icao: "KOPF", city: "Miami", lat: 25.91, lon: -80.28, demand: 0.9, peakMonths: [12, 1, 2, 3] },
  KFLL: { icao: "KFLL", city: "Fort Lauderdale", lat: 26.07, lon: -80.15, demand: 0.8, peakMonths: [12, 1, 2, 3] },
  KPDK: { icao: "KPDK", city: "Atlanta", lat: 33.88, lon: -84.3, demand: 0.7 },
  KBNA: { icao: "KBNA", city: "Nashville", lat: 36.12, lon: -86.68, demand: 0.65 },
  KCHS: { icao: "KCHS", city: "Charleston", lat: 32.9, lon: -80.04, demand: 0.55 },
  KDAL: { icao: "KDAL", city: "Dallas", lat: 32.85, lon: -96.85, demand: 0.8 },
  KHOU: { icao: "KHOU", city: "Houston", lat: 29.65, lon: -95.28, demand: 0.75 },
  KAUS: { icao: "KAUS", city: "Austin", lat: 30.19, lon: -97.67, demand: 0.7 },
  KMDW: { icao: "KMDW", city: "Chicago", lat: 41.79, lon: -87.75, demand: 0.8 },
  KAPA: { icao: "KAPA", city: "Denver", lat: 39.57, lon: -104.85, demand: 0.75 },
  KASE: { icao: "KASE", city: "Aspen", lat: 39.22, lon: -106.87, demand: 0.85, peakMonths: [12, 1, 2, 3, 7] },
  KEGE: { icao: "KEGE", city: "Vail/Eagle", lat: 39.64, lon: -106.92, demand: 0.7, peakMonths: [12, 1, 2, 3] },
  KSDL: { icao: "KSDL", city: "Scottsdale", lat: 33.62, lon: -111.91, demand: 0.75, peakMonths: [1, 2, 3, 4] },
  KLAS: { icao: "KLAS", city: "Las Vegas", lat: 36.08, lon: -115.15, demand: 0.85 },
  KVNY: { icao: "KVNY", city: "Van Nuys", lat: 34.21, lon: -118.49, demand: 0.95 },
  KSNA: { icao: "KSNA", city: "Orange County", lat: 33.68, lon: -117.87, demand: 0.8 },
  KSJC: { icao: "KSJC", city: "San Jose", lat: 37.36, lon: -121.93, demand: 0.75 },
  KSUN: { icao: "KSUN", city: "Sun Valley", lat: 43.5, lon: -114.3, demand: 0.6, peakMonths: [7, 8, 12, 1, 2] },
  KJAC: { icao: "KJAC", city: "Jackson Hole", lat: 43.61, lon: -110.74, demand: 0.7, peakMonths: [7, 8, 12, 1, 2] },
  KSAN: { icao: "KSAN", city: "San Diego", lat: 32.73, lon: -117.19, demand: 0.7 },
  KSLC: { icao: "KSLC", city: "Salt Lake City", lat: 40.79, lon: -111.98, demand: 0.6 },
};

export function airport(icao: string): Airport {
  const code = icao.trim().toUpperCase();
  return (
    AIRPORTS[code] ?? { icao: code, city: code, lat: 0, lon: 0, demand: 0.5 }
  );
}

export function isKnownAirport(icao: string): boolean {
  return icao.trim().toUpperCase() in AIRPORTS;
}

// Great-circle distance in nautical miles.
export function distanceNm(a: string, b: string): number {
  const A = airport(a);
  const B = airport(b);
  if (!A.lat && !A.lon) return 0;
  if (!B.lat && !B.lon) return 0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(B.lat - A.lat);
  const dLon = toRad(B.lon - A.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(A.lat)) * Math.cos(toRad(B.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(h));
}

// Block time: cruise leg plus ~0.3h for taxi, climb and descent.
export function estimateBlockHours(from: string, to: string, cruiseKtas: number): number {
  const nm = distanceNm(from, to);
  if (nm === 0) return 1.5;
  return Math.round((nm / (cruiseKtas * 0.92) + 0.3) * 10) / 10;
}

export function routeDemand(from: string, to: string, month: number): number {
  const a = airport(from);
  const b = airport(to);
  const seasonal = (ap: Airport) => (ap.peakMonths?.includes(month) ? 0.15 : 0);
  // Destination demand dominates: buyers book empty legs to where they want to go.
  const d = 0.35 * (a.demand + seasonal(a)) + 0.65 * (b.demand + seasonal(b));
  return Math.min(1, d);
}
