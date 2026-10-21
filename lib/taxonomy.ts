// Shared vocabulary for both sides of the marketplace. Opportunities and
// sponsor profiles are described with the same ids so they can be compared.

export const CAUSES = {
  "stem-education": "STEM education",
  "aviation-aerospace": "Aviation & aerospace",
  "technology-ai": "Technology & AI",
  "workforce-development": "Workforce & careers",
  "youth-development": "Youth development",
  "education-literacy": "Education & literacy",
  "health-wellness": "Health & wellness",
  "mental-health": "Mental health",
  "arts-culture": "Arts & culture",
  "environment": "Environment & sustainability",
  "food-security": "Food security",
  "housing": "Housing & homelessness",
  "veterans-military": "Veterans & military families",
  "racial-equity": "Racial equity & inclusion",
  "women-girls": "Women & girls",
  "financial-literacy": "Financial literacy",
  "sports-recreation": "Sports & recreation",
  "community-development": "Community development",
  "disaster-relief": "Disaster relief",
  "animal-welfare": "Animal welfare",
} as const;
export type CauseId = keyof typeof CAUSES;

// Causes that commonly travel together. A sponsor focused on one is often
// open to the other, so adjacency earns partial credit when scoring.
export const CAUSE_ADJACENCY: Partial<Record<CauseId, CauseId[]>> = {
  "stem-education": ["technology-ai", "aviation-aerospace", "workforce-development", "education-literacy", "youth-development"],
  "aviation-aerospace": ["stem-education", "workforce-development", "veterans-military"],
  "technology-ai": ["stem-education", "workforce-development"],
  "workforce-development": ["stem-education", "youth-development", "financial-literacy", "veterans-military"],
  "youth-development": ["education-literacy", "stem-education", "sports-recreation", "mental-health"],
  "education-literacy": ["youth-development", "stem-education"],
  "health-wellness": ["mental-health", "sports-recreation", "food-security"],
  "mental-health": ["health-wellness", "youth-development", "veterans-military"],
  "food-security": ["health-wellness", "housing", "community-development"],
  "housing": ["community-development", "food-security", "disaster-relief"],
  "veterans-military": ["workforce-development", "mental-health", "aviation-aerospace"],
  "racial-equity": ["community-development", "education-literacy", "women-girls"],
  "women-girls": ["stem-education", "racial-equity"],
  "financial-literacy": ["workforce-development", "youth-development", "community-development"],
  "sports-recreation": ["youth-development", "health-wellness"],
  "community-development": ["housing", "racial-equity", "financial-literacy"],
  "disaster-relief": ["housing", "community-development"],
  "arts-culture": ["youth-development", "community-development"],
  "environment": ["community-development", "health-wellness"],
};

export const AUDIENCES = {
  "k5-students": "Elementary students (K–5)",
  "teen-students": "Middle & high school students (6–12)",
  "young-adults": "College students & young adults",
  "families": "Families & parents",
  "educators": "Teachers & school leaders",
  "professionals": "Professionals & executives",
  "veterans": "Veterans & service members",
  "seniors": "Seniors",
  "underserved": "Underserved & low-income communities",
  "general-public": "General public",
} as const;
export type AudienceId = keyof typeof AUDIENCES;

// What a sponsor wants to get out of a partnership.
export const OBJECTIVES = {
  "brand-visibility": "Brand visibility",
  "talent-pipeline": "Talent pipeline & recruiting",
  "community-impact": "Community impact / ESG",
  "employee-engagement": "Employee volunteering",
  "customer-reach": "Customer reach & product activation",
  "relationships": "Access to decision-makers",
  "thought-leadership": "Thought leadership & speaking",
  "local-presence": "Local market presence",
} as const;
export type ObjectiveId = keyof typeof OBJECTIVES;

export const SUPPORT_TYPES = {
  cash: "Cash sponsorship",
  "in-kind": "In-kind goods or services",
  volunteers: "Volunteers",
  mentors: "Mentors & speakers",
  introductions: "Introductions",
  media: "Media & promotion",
} as const;
export type SupportTypeId = keyof typeof SUPPORT_TYPES;

export const SPONSOR_TYPES = {
  brand: "Brand / corporation",
  "small-business": "Local business",
  foundation: "Foundation",
  individual: "Individual donor",
  government: "Government / agency",
} as const;
export type SponsorTypeId = keyof typeof SPONSOR_TYPES;

export const ORG_TYPES = {
  "501c3": "501(c)(3) nonprofit",
  "fiscally-sponsored": "Fiscally sponsored project",
  school: "School or district",
  government: "Government / municipality",
  other: "Other organization",
} as const;
export type OrgTypeId = keyof typeof ORG_TYPES;

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Census-style regions, used when a sponsor says it gives "in the Southeast".
export const REGIONS: Record<string, string[]> = {
  Southeast: ["FL", "GA", "AL", "SC", "NC", "TN", "MS", "LA", "KY", "VA", "WV", "AR"],
  Northeast: ["NY", "NJ", "PA", "MA", "CT", "RI", "VT", "NH", "ME", "MD", "DE", "DC"],
  Midwest: ["IL", "IN", "MI", "OH", "WI", "MN", "IA", "MO", "KS", "NE", "ND", "SD"],
  Southwest: ["TX", "OK", "NM", "AZ"],
  West: ["CA", "OR", "WA", "NV", "UT", "CO", "ID", "MT", "WY", "AK", "HI"],
};

export function label<T extends Record<string, string>>(dict: T, id: string): string {
  return (dict as Record<string, string>)[id] ?? id;
}
