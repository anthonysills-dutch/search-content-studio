export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
] as const;

/** Countries, with the location codes search data uses. */
export const COUNTRIES = [
  { code: "US", name: "United States", location: 2840 },
  { code: "GB", name: "United Kingdom", location: 2826 },
  { code: "CA", name: "Canada", location: 2124 },
  { code: "AU", name: "Australia", location: 2036 },
  { code: "IE", name: "Ireland", location: 2372 },
  { code: "DE", name: "Germany", location: 2276 },
  { code: "FR", name: "France", location: 2250 },
  { code: "ES", name: "Spain", location: 2724 },
  { code: "IT", name: "Italy", location: 2380 },
  { code: "NL", name: "Netherlands", location: 2528 },
  { code: "BR", name: "Brazil", location: 2076 },
  { code: "MX", name: "Mexico", location: 2484 },
  { code: "IN", name: "India", location: 2356 },
] as const;

export const languageCodes = LANGUAGES.map((l) => l.code) as [string, ...string[]];
export const countryCodes = COUNTRIES.map((c) => c.code) as [string, ...string[]];

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
