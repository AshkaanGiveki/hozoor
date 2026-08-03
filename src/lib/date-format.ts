const longFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" });
const shortFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "2-digit", month: "2-digit", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" });

type DateInput = Date | string | number;

function asDate(value: DateInput) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

function parts(value: DateInput, formatter: Intl.DateTimeFormat) {
  const result = Object.fromEntries(formatter.formatToParts(asDate(value)).map((part) => [part.type, part.value]));
  return { day: result.day ?? "", month: result.month ?? "", year: result.year ?? "" };
}

/** Always renders a Jalali date in day-month-year order. */
export function formatJalaliDate(value: DateInput) {
  const { day, month, year } = parts(value, longFormatter);
  return `${day} ${month} ${year}`;
}

/** Numeric Jalali date for dense tables and filters: day/month/year. */
export function formatJalaliShortDate(value: DateInput) {
  const { day, month, year } = parts(value, shortFormatter);
  return `${day}/${month}/${year}`;
}

export function formatJalaliLongDate(value: DateInput) {
  return `${weekdayFormatter.format(asDate(value))}، ${formatJalaliDate(value)}`;
}

export function formatJalaliWeekday(value: DateInput) {
  return weekdayFormatter.format(asDate(value));
}

export function formatJalaliDateTime(value: DateInput) {
  const date = asDate(value);
  return `${formatJalaliDate(date)}، ${date.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
}
