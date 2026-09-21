export const IRANIAN_LABOUR_LAW_SOURCE = "https://rc.majlis.ir/fa/law/show/99612";
export const IRANIAN_DIRECT_TAX_SOURCE = "https://rc.majlis.ir/fa/law/show/91488";
export const IRANIAN_1405_WAGE_RESOLUTION_SOURCE = "official-1405-wage-resolution";
export const IRANIAN_1405_SOCIAL_SECURITY_SOURCE = "official-1405-social-security-circular";
export const IRANIAN_1405_HOUSING_ALLOWANCE_SOURCE = "cabinet-resolution-9234-1405/02/15";

export const iranianLabourLawBaseline = {
  dailyWorkingHoursMaximum: 8,
  weeklyWorkingHoursMaximum: 44,
  nightStartMinute: 22 * 60,
  nightEndMinute: 6 * 60,
  nightPremium: 0.35,
  overtimePremium: 0.4,
  partTimePayBasis: "ACTUAL_HOURS" as const,
  paidFridayRest: true,
  articles: { partTime: 39, minimumWage: 41, ordinaryHours: 51, nightWindow: 53, nightPremium: 58, overtime: 59, weeklyRest: 62 },
};

export function validateIranianLabourBaseline(rules: Record<string, unknown>) {
  const dailyHours = rules.workingHoursPerDay;
  if (typeof dailyHours === "number" && dailyHours > iranianLabourLawBaseline.dailyWorkingHoursMaximum) return `workingHoursPerDay cannot exceed ${iranianLabourLawBaseline.dailyWorkingHoursMaximum} under Iranian Labour Law article 51.`;
  const weeklyHours = rules.weeklyWorkingHours;
  if (typeof weeklyHours === "number" && weeklyHours > iranianLabourLawBaseline.weeklyWorkingHoursMaximum) return `weeklyWorkingHours cannot exceed ${iranianLabourLawBaseline.weeklyWorkingHoursMaximum} under Iranian Labour Law article 51.`;
  const overtimeMultiplier = rules.overtimeMultiplier;
  if (typeof overtimeMultiplier === "number" && overtimeMultiplier < 1 + iranianLabourLawBaseline.overtimePremium) return "overtimeMultiplier cannot be below the 40% statutory premium in Iranian Labour Law article 59.";
  const nightMultiplier = rules.nightWorkMultiplier;
  if (nightMultiplier !== undefined && (typeof nightMultiplier !== "number" || nightMultiplier < 1 + iranianLabourLawBaseline.nightPremium)) return "nightWorkMultiplier cannot be below the 35% statutory premium in Iranian Labour Law article 58.";
  return null;
}

export const iranianPrivateSector1405Rules = {
  jurisdiction: "IR_PRIVATE_LABOUR_SOCIAL_SECURITY",
  currency: "IRR",
  workingDays: 30,
  workingHoursPerDay: 7.3333,
  weeklyWorkingHours: 44,
  overtimeMultiplier: 1.4,
  nightWorkMultiplier: 1.35,
  employeeInsuranceRate: 0.07,
  employerInsuranceRate: 0.23,
  employerUnemploymentInsuranceRate: 0.03,
  insuranceCeilingMultiplier: 7,
  minimumDailyWage: 5_541_850,
  minimumMonthlySalary: 166_255_500,
  seniorityDailyAmount: 166_667,
  consumerGoodsAllowance: 22_000_000,
  housingAllowance: 30_000_000,
  marriageAllowance: 5_000_000,
  childAllowancePerEligibleChild: 16_625_550,
  annualTaxExemption: 4_800_000_000,
  taxExemption: 4_800_000_000,
  taxAnnualized: true,
  taxBrackets: [
    { upTo: 4_800_000_000, rate: 0.1 },
    { upTo: 7_200_000_000, rate: 0.15 },
    { upTo: 9_600_000_000, rate: 0.2 },
    { upTo: 12_000_000_000, rate: 0.25 },
    { rate: 0.3 },
  ],
  specialTaxRates: { FACULTY_JUDGE: 0.1 },
  eidiMinimumDays: 60,
  eidiMaximumDays: 90,
  severanceMonthsPerYear: 1,
  sources: [
    { authority: "Iranian Parliament", reference: IRANIAN_LABOUR_LAW_SOURCE },
    { authority: "Iranian Parliament", reference: IRANIAN_DIRECT_TAX_SOURCE },
    { authority: "Supreme Labour Council", reference: IRANIAN_1405_WAGE_RESOLUTION_SOURCE },
    { authority: "Social Security Organization", reference: IRANIAN_1405_SOCIAL_SECURITY_SOURCE },
    { authority: "Cabinet", reference: IRANIAN_1405_HOUSING_ALLOWANCE_SOURCE, supersedes: "9,000,000 IRR housing allowance in the earlier circular" },
  ],
} as const;

export function calculateIranianEidi(lastDailyWage: number, serviceDays: number, rules = iranianPrivateSector1405Rules) {
  const fraction = Math.max(0, serviceDays) / 365;
  const minimum = lastDailyWage * rules.eidiMinimumDays * fraction;
  const maximum = rules.minimumDailyWage * rules.eidiMaximumDays * fraction;
  return { minimum: Math.min(minimum, maximum), maximum };
}

export function calculateIranianSeverance(lastMonthlyWage: number, serviceDays: number, rules = iranianPrivateSector1405Rules) {
  return Math.max(0, lastMonthlyWage) * rules.severanceMonthsPerYear * Math.max(0, serviceDays) / 365;
}
