// --- Age parsing & matching utils ---

type ChildCtx = {
  name?: string | null;
  dob: string; // ISO string
  agePretty?: string; // optional
  ageYears?: number; // optional
};

type AgeParseResult = {
  months: number; // age in months
  granularity: 'years' | 'months'; // what the user expressed
};

const MONTHS_PER_YEAR = 12;

const now = () => new Date();

export function ageInMonthsFromDob(dobIso: string, at: Date = now()): number {
  const dob = new Date(dobIso);
  let months =
    (at.getFullYear() - dob.getFullYear()) * MONTHS_PER_YEAR +
    (at.getMonth() - dob.getMonth());
  // adjust for day-of-month
  if (at.getDate() < dob.getDate()) {months -= 1;}
  return Math.max(0, months);
}

// Parses phrases like:
// - "my 1 year old", "1-yr-old", "1 yr old", "1yo", "1 y/o"
// - "18 months", "18 mo", "1 and 6 months", "1y 6m"
export function parseAgeMention(queryRaw: string): AgeParseResult | null {
  const q = queryRaw.toLowerCase();

  // e.g. "1 and 6 months"
  const yearsAndMonths = q.match(
    /\b(\d+)\s*(?:years?|yrs?|y\/?o?)\s*(?:and|&|\+)\s*(\d+)\s*(?:months?|mos?|m\/?o?)\b/,
  );
  if (yearsAndMonths) {
    const y = Number(yearsAndMonths[1]);
    const m = Number(yearsAndMonths[2]);
    return {months: y * MONTHS_PER_YEAR + m, granularity: 'months'};
  }

  // e.g. "1y 6m", "1 yr 6 mo"
  const ySpaceM = q.match(
    /\b(\d+)\s*(?:y|yrs?|years?)\s+(\d+)\s*(?:m|mos?|months?)\b/,
  );
  if (ySpaceM) {
    const y = Number(ySpaceM[1]);
    const m = Number(ySpaceM[2]);
    return {months: y * MONTHS_PER_YEAR + m, granularity: 'months'};
  }

  // months-only: "18 months", "18 mo", "18 m/o"
  const monthsOnly = q.match(/\b(\d+)\s*(?:months?|mos?|m\/?o?)\b/);
  if (monthsOnly) {
    const m = Number(monthsOnly[1]);
    return {months: m, granularity: 'months'};
  }

  // year-only variants: "1 year old", "1 yr old", "1yo", "1 y/o", "1-year-old"
  const yearsOnly = q.match(
    /\b(\d+)\s*(?:years?|yrs?|y\/?o?|yo)\b|\b(\d+)\s*-\s*year\s*-\s*old\b|\b(\d+)\s*year\s*old\b/,
  );
  if (yearsOnly) {
    const y = Number(yearsOnly[1] || yearsOnly[2] || yearsOnly[3]);
    return {months: y * MONTHS_PER_YEAR, granularity: 'years'};
  }

  return null;
}

export function matchChildrenByAge(
  ageMonths: number,
  children: ChildCtx[],
  granularity: 'years' | 'months',
): {exact: ChildCtx[]; close: ChildCtx[]} {
  // Tighter tolerance if user gave months; broader if they gave years
  const tolerance = granularity === 'months' ? 2 : 6; // months

  const exact: ChildCtx[] = [];
  const close: ChildCtx[] = [];

  const withAges = children.map(c => ({
    child: c,
    ageMonths: ageInMonthsFromDob(c.dob),
    diff: Math.abs(ageInMonthsFromDob(c.dob) - ageMonths),
  }));

  // exact bucket = within tolerance/2, close bucket = within tolerance
  const exactCutoff = Math.max(0, Math.floor(tolerance / 2));

  for (const item of withAges) {
    if (item.diff <= exactCutoff) {exact.push(item.child);}
    else if (item.diff <= tolerance) {close.push(item.child);}
  }

  // If no exact but one very close child, we’ll let the caller decide whether to accept or ask.
  return {exact, close};
}
