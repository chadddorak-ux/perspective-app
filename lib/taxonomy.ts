// Shared vocabulary for both sides of the marketplace. Opportunities and
// sponsor profiles are described with the same ids so they can be compared.

export const CAUSES = {
  // Education & youth
  "early-childhood": "Early childhood",
  "education-literacy": "Education & literacy",
  "stem-education": "STEM education",
  "youth-development": "Youth development",
  "college-access": "College access & scholarships",
  // Health
  "health-wellness": "Health & wellness",
  "mental-health": "Mental health",
  "disease-research": "Disease research & patient support",
  disability: "Disability inclusion",
  "addiction-recovery": "Addiction & recovery",
  // Basic needs & community
  "food-security": "Food security",
  housing: "Housing & homelessness",
  poverty: "Poverty & human services",
  "community-development": "Community development",
  "disaster-relief": "Disaster relief & preparedness",
  "public-safety": "Public safety & first responders",
  // Environment & animals
  environment: "Environment & climate",
  "animal-welfare": "Animal welfare",
  // Arts, culture & sports
  "arts-culture": "Arts & culture",
  "sports-recreation": "Sports & recreation",
  "journalism-media": "Journalism & public media",
  // Equity & rights
  "racial-equity": "Racial equity",
  "women-girls": "Women & girls",
  lgbtq: "LGBTQ+ communities",
  "immigrants-refugees": "Immigrants & refugees",
  "civil-rights": "Civil rights & legal aid",
  "veterans-military": "Veterans & military families",
  // Economy & work
  "workforce-development": "Workforce & careers",
  "financial-literacy": "Financial health & literacy",
  "small-business": "Small business & entrepreneurship",
  "technology-ai": "Technology & AI",
  "digital-inclusion": "Digital access & inclusion",
  // Global, civic & faith
  international: "International development",
  "civic-engagement": "Civic engagement",
  "faith-based": "Faith-based service",
  aging: "Aging & seniors",
} as const;
export type CauseId = keyof typeof CAUSES;

export const CAUSE_GROUPS: { label: string; ids: CauseId[] }[] = [
  { label: "Education & youth", ids: ["early-childhood", "education-literacy", "stem-education", "youth-development", "college-access"] },
  { label: "Health", ids: ["health-wellness", "mental-health", "disease-research", "disability", "addiction-recovery"] },
  { label: "Basic needs & community", ids: ["food-security", "housing", "poverty", "community-development", "disaster-relief", "public-safety"] },
  { label: "Environment & animals", ids: ["environment", "animal-welfare"] },
  { label: "Arts, culture & sports", ids: ["arts-culture", "sports-recreation", "journalism-media"] },
  { label: "Equity & rights", ids: ["racial-equity", "women-girls", "lgbtq", "immigrants-refugees", "civil-rights", "veterans-military"] },
  { label: "Economy & work", ids: ["workforce-development", "financial-literacy", "small-business", "technology-ai", "digital-inclusion"] },
  { label: "Global, civic & faith", ids: ["international", "civic-engagement", "faith-based", "aging"] },
];

// NTEE major groups (the IRS nonprofit classification), so listings can be
// matched against IRS Business Master File records later.
export const CAUSE_NTEE: Record<CauseId, string> = {
  "early-childhood": "B", "education-literacy": "B", "stem-education": "B", "youth-development": "O", "college-access": "B",
  "health-wellness": "E", "mental-health": "F", "disease-research": "G", disability: "P", "addiction-recovery": "F",
  "food-security": "K", housing: "L", poverty: "P", "community-development": "S", "disaster-relief": "M", "public-safety": "M",
  environment: "C", "animal-welfare": "D", "arts-culture": "A", "sports-recreation": "N", "journalism-media": "A",
  "racial-equity": "R", "women-girls": "R", lgbtq: "R", "immigrants-refugees": "P", "civil-rights": "R", "veterans-military": "W",
  "workforce-development": "J", "financial-literacy": "S", "small-business": "S", "technology-ai": "U", "digital-inclusion": "S",
  international: "Q", "civic-engagement": "W", "faith-based": "X", aging: "P",
};

// Causes that commonly travel together. A sponsor focused on one is often
// open to the other, so adjacency earns partial credit when scoring.
export const CAUSE_ADJACENCY: Partial<Record<CauseId, CauseId[]>> = {
  "early-childhood": ["education-literacy", "health-wellness", "poverty"],
  "education-literacy": ["early-childhood", "youth-development", "stem-education", "college-access"],
  "stem-education": ["technology-ai", "education-literacy", "workforce-development", "youth-development", "women-girls"],
  "youth-development": ["education-literacy", "sports-recreation", "mental-health", "stem-education"],
  "college-access": ["education-literacy", "workforce-development", "racial-equity", "financial-literacy"],
  "health-wellness": ["mental-health", "sports-recreation", "food-security", "disease-research", "aging"],
  "mental-health": ["health-wellness", "addiction-recovery", "youth-development", "veterans-military", "lgbtq"],
  "disease-research": ["health-wellness", "aging", "disability"],
  disability: ["health-wellness", "sports-recreation", "civil-rights", "veterans-military"],
  "addiction-recovery": ["mental-health", "health-wellness", "housing"],
  "food-security": ["poverty", "health-wellness", "community-development"],
  housing: ["poverty", "community-development", "disaster-relief", "veterans-military"],
  poverty: ["food-security", "housing", "financial-literacy", "community-development"],
  "community-development": ["housing", "small-business", "racial-equity", "civic-engagement"],
  "disaster-relief": ["public-safety", "housing", "community-development", "food-security"],
  "public-safety": ["disaster-relief", "community-development", "veterans-military"],
  environment: ["community-development", "health-wellness", "animal-welfare"],
  "animal-welfare": ["environment", "community-development"],
  "arts-culture": ["youth-development", "community-development", "journalism-media", "education-literacy"],
  "sports-recreation": ["youth-development", "health-wellness", "disability"],
  "journalism-media": ["civic-engagement", "arts-culture"],
  "racial-equity": ["civil-rights", "community-development", "college-access", "education-literacy"],
  "women-girls": ["stem-education", "racial-equity", "civil-rights", "small-business"],
  lgbtq: ["civil-rights", "mental-health", "health-wellness"],
  "immigrants-refugees": ["civil-rights", "workforce-development", "education-literacy", "international"],
  "civil-rights": ["racial-equity", "immigrants-refugees", "lgbtq", "civic-engagement"],
  "veterans-military": ["workforce-development", "mental-health", "housing", "disability"],
  "workforce-development": ["stem-education", "college-access", "financial-literacy", "veterans-military", "small-business"],
  "financial-literacy": ["workforce-development", "poverty", "small-business", "youth-development"],
  "small-business": ["community-development", "workforce-development", "financial-literacy"],
  "technology-ai": ["stem-education", "workforce-development", "digital-inclusion"],
  "digital-inclusion": ["technology-ai", "education-literacy", "aging", "poverty"],
  international: ["immigrants-refugees", "health-wellness", "disaster-relief"],
  "civic-engagement": ["community-development", "journalism-media", "civil-rights"],
  "faith-based": ["poverty", "food-security", "community-development"],
  aging: ["health-wellness", "digital-inclusion", "disease-research"],
};

export const AUDIENCES = {
  "k5-students": "Elementary students (K–5)",
  "teen-students": "Middle & high school students",
  "young-adults": "College students & young adults",
  families: "Families & parents",
  educators: "Teachers & school leaders",
  professionals: "Professionals & executives",
  "small-business-owners": "Small business owners",
  women: "Women",
  lgbtq: "LGBTQ+ people",
  "people-with-disabilities": "People with disabilities",
  immigrants: "Immigrants & refugees",
  veterans: "Veterans & service members",
  seniors: "Seniors",
  patients: "Patients & caregivers",
  underserved: "Low-income & underserved",
  rural: "Rural communities",
  "sports-fans": "Sports & outdoor enthusiasts",
  "arts-patrons": "Arts & culture audiences",
  "pet-owners": "Pet owners",
  "faith-communities": "Faith communities",
  "general-public": "General public",
} as const;
export type AudienceId = keyof typeof AUDIENCES;

// What a sponsor wants to get out of a partnership.
export const OBJECTIVES = {
  "brand-visibility": "Brand visibility",
  "customer-reach": "Customer reach & product activation",
  "cause-marketing": "Cause marketing & co-branding",
  content: "Content & storytelling",
  "talent-pipeline": "Talent pipeline & recruiting",
  "employee-engagement": "Employee volunteering & giving",
  "community-impact": "Community impact / ESG",
  relationships: "Access to decision-makers",
  "thought-leadership": "Thought leadership & speaking",
  "local-presence": "Local market presence",
} as const;
export type ObjectiveId = keyof typeof OBJECTIVES;

export const SUPPORT_TYPES = {
  cash: "Cash sponsorship",
  "in-kind": "In-kind goods or services",
  "pro-bono": "Pro bono expertise",
  volunteers: "Volunteers",
  mentors: "Mentors & speakers",
  matching: "Matching gifts",
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

export const INDUSTRIES = {
  "consumer-goods": "Consumer packaged goods",
  "food-beverage": "Food & beverage",
  restaurants: "Restaurants & fast food",
  alcohol: "Alcohol",
  retail: "Retail & grocery",
  apparel: "Apparel & footwear",
  beauty: "Beauty & personal care",
  "sports-fitness": "Sports & fitness",
  outdoor: "Outdoor & recreation",
  pets: "Pet products & services",
  tech: "Technology & software",
  telecom: "Telecom & internet",
  financial: "Banking & financial services",
  insurance: "Insurance",
  healthcare: "Healthcare providers",
  pharma: "Pharma & biotech",
  automotive: "Automotive",
  "aerospace-defense": "Aerospace & defense",
  manufacturing: "Manufacturing & industrial",
  utilities: "Utilities & renewable energy",
  "oil-gas": "Oil & gas",
  "real-estate": "Real estate & construction",
  "travel-hospitality": "Travel & hospitality",
  "media-entertainment": "Media & entertainment",
  logistics: "Transportation & logistics",
  "professional-services": "Professional services",
  "education-services": "Education services",
  "gaming-gambling": "Gaming & sports betting",
  "tobacco-cannabis": "Tobacco, vape & cannabis",
  firearms: "Firearms",
} as const;
export type IndustryId = keyof typeof INDUSTRIES;

// Industries organizations most often decline as sponsors (youth, health and
// recovery programs especially). Shown first in the "won't accept" picker.
export const SENSITIVE_INDUSTRIES: IndustryId[] = [
  "alcohol", "tobacco-cannabis", "gaming-gambling", "firearms", "oil-gas", "restaurants", "pharma",
];

// Causes a brand in each industry is naturally credible on. Used to give
// partial credit and to suggest causes during sponsor intake.
export const INDUSTRY_AFFINITY: Record<IndustryId, CauseId[]> = {
  "consumer-goods": ["health-wellness", "environment", "food-security", "women-girls"],
  "food-beverage": ["food-security", "health-wellness", "sports-recreation"],
  restaurants: ["food-security", "youth-development", "community-development"],
  alcohol: ["arts-culture", "environment", "community-development"],
  retail: ["food-security", "community-development", "education-literacy"],
  apparel: ["sports-recreation", "youth-development", "environment"],
  beauty: ["women-girls", "lgbtq", "mental-health"],
  "sports-fitness": ["sports-recreation", "youth-development", "health-wellness", "disability"],
  outdoor: ["environment", "sports-recreation", "veterans-military"],
  pets: ["animal-welfare"],
  tech: ["technology-ai", "stem-education", "digital-inclusion", "workforce-development"],
  telecom: ["digital-inclusion", "education-literacy", "disaster-relief"],
  financial: ["financial-literacy", "small-business", "housing", "community-development"],
  insurance: ["disaster-relief", "public-safety", "health-wellness", "financial-literacy"],
  healthcare: ["health-wellness", "mental-health", "aging", "disease-research"],
  pharma: ["disease-research", "health-wellness", "stem-education"],
  automotive: ["workforce-development", "sports-recreation", "public-safety"],
  "aerospace-defense": ["stem-education", "veterans-military", "workforce-development"],
  manufacturing: ["workforce-development", "stem-education", "community-development"],
  utilities: ["environment", "community-development", "poverty"],
  "oil-gas": ["workforce-development", "stem-education", "disaster-relief"],
  "real-estate": ["housing", "community-development", "small-business"],
  "travel-hospitality": ["arts-culture", "workforce-development", "disaster-relief"],
  "media-entertainment": ["arts-culture", "journalism-media", "civic-engagement"],
  logistics: ["disaster-relief", "food-security", "veterans-military"],
  "professional-services": ["civil-rights", "small-business", "immigrants-refugees", "college-access"],
  "education-services": ["education-literacy", "college-access", "early-childhood"],
  "gaming-gambling": ["sports-recreation", "community-development"],
  "tobacco-cannabis": ["civil-rights", "community-development"],
  firearms: ["public-safety", "veterans-military", "environment"],
};

export const ORG_TYPES = {
  "501c3": "501(c)(3) nonprofit",
  "fiscally-sponsored": "Fiscally sponsored project",
  school: "School or district",
  government: "Government / municipality",
  other: "Other (e.g. 501(c)(4), 501(c)(6), community group)",
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
