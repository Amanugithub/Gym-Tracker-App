export function localDateForTimezone(
  timestamp: string,
  timezoneId: string,
): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Cannot calculate a local date from an invalid timestamp");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidTimezone(timezoneId: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezoneId }).format();
    return true;
  } catch {
    return false;
  }
}
