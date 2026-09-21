export const IRANIAN_LABOUR_LAW_SOURCE = "https://rc.majlis.ir/fa/law/show/99612";
export const IRANIAN_DIRECT_TAX_SOURCE = "https://rc.majlis.ir/fa/law/show/91488";

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
