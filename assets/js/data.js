/* ==========================================================================
   Leoside Equity: site configuration and report data
   --------------------------------------------------------------------------
   A report belongs to a country and nothing else about its shape is the
   site's business. The one place the Indian week is spelled out is
   REGIONS.IN.days below.

   REPORTS stays empty here. On the live site reports come from the database.
   ========================================================================== */

const SITE = {
  name: 'Leoside Equity',
  url: 'https://leosideequity.com',
  tagline: 'Written equity research on United States, United Kingdom and Indian markets.',
  /* The one place the contact address is written. Everything reads it. */
  email: 'support@leosideequity.com',
  founded: 2026,
  /* Words a signed out visitor may read before the sign in prompt. Keep in
     step with limit_n in the set_preview() database function. */
  freeWords: 90,

  /* Bump termsVersion whenever the terms or privacy policy change in a way
     that needs fresh agreement. Accounts record the version they accepted. */
  termsVersion: '2026-09-25',
  legalUpdated: '2026-09-25',

  /* Account age rules. Under minAge cannot hold an account. Between minAge
     and adultAge a parent or guardian has to agree. See terms section 3. */
  minAge: 13,
  adultAge: 18,

  /* Publishing week, keyed by JavaScript weekday: 0 is Sunday. */
  schedule: { 0: 'IN', 1: 'US', 2: 'US', 3: 'US', 4: 'UK', 5: 'UK', 6: 'IN' }
};

/* --------------------------------------------------------------------------
   The three markets.

   `valuation` decides whether price fields apply. Indian coverage is about
   the market as a whole or a sector, never a single listed security, so it
   carries no stance, fair value, price or horizon.

   `exchange` feeds the market clocks on the home page: regular session hours
   in the exchange's own time zone. Holidays and early closes are not known
   to the site, and the clocks say so.

   `focus` is what a day's report covers, shown on the home page: one phrase
   for every day of the market, or one per weekday (0 is Sunday) where the
   days differ.
   -------------------------------------------------------------------------- */
const REGIONS = {
  US: {
    code: 'US', slug: 'us', name: 'United States', currency: '$',
    venues: 'NYSE and Nasdaq',
    lede: 'Companies listed in New York, covered at the start of the week.',
    valuation: true,
    focus: 'One company',
    exchange: { short: 'NYSE', city: 'New York', tz: 'America/New_York', open: '09:30', close: '16:00', lat: 40.707, lon: -74.011 },
    days: [
      ['Monday to Wednesday',
       'One company a day from the NYSE or the Nasdaq. Each report starts with how the business makes money and finishes with what the share price already assumes about it.']
    ]
  },
  UK: {
    code: 'UK', slug: 'uk', name: 'United Kingdom', currency: '£',
    venues: 'London Stock Exchange',
    lede: 'Companies listed in London, covered as the week closes.',
    valuation: true,
    focus: 'One company',
    exchange: { short: 'LSE', city: 'London', tz: 'Europe/London', open: '08:00', close: '16:30', lat: 51.515, lon: -0.099 },
    days: [
      ['Thursday and Friday',
       'Two London listed companies. Figures are in sterling, and the reports run to the same length and the same structure as the American ones.']
    ]
  },
  IN: {
    code: 'IN', slug: 'in', name: 'India', currency: '₹',
    venues: 'NSE and BSE',
    lede: 'The Indian market as a whole, covered over the weekend.',
    valuation: false,
    focus: { 6: 'One sector', 0: 'The whole market' },
    exchange: { short: 'NSE', city: 'Mumbai', tz: 'Asia/Kolkata', open: '09:15', close: '15:30', lat: 19.060, lon: 72.863 },
    days: [
      ['Saturday',
       'One sector on its own: what is driving it, where the risk sits, and the arguments on each side.'],
      ['Sunday',
       'The market as a whole, read through the indices and the rates, inflation, currency and fund flows underneath them.']
    ]
  }
};

/* --------------------------------------------------------------------------
   Reports, newest first. Local mode only. Shape:

   { id: 'aapl-2026-08-03', date: '2026-08-03', market: 'US', ticker: 'AAPL',
     company: 'Apple Inc.', exchange: 'Nasdaq', sector: 'Technology',
     readMins: 6, title: '...', standfirst: '...', author: '...',
     disclosure: '...', body: [{ h: 'Heading', p: ['Paragraph'] }],
     rating: 'Undervalued', target: '$150 to $168', last: '$121',
     horizon: '12 months' }
   -------------------------------------------------------------------------- */
const REPORTS = [];
REPORTS.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

/* --------------------------------------------------------------------------
   Derived from the schedule, so no label can contradict it.
   -------------------------------------------------------------------------- */
(function deriveScheduleLabels() {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* The week is treated as a circle, so India's [0, 6] reads as the weekend
     it is ("Saturday and Sunday") rather than the two ends of the week. */
  function runOf(days) {
    if (!days.length) return [];
    const has = {};
    days.forEach(function (d) { has[d] = true; });
    let start = days[0];
    for (let i = 0; i < days.length; i++) {
      if (!has[(days[i] + 6) % 7]) { start = days[i]; break; }
    }
    const run = [];
    for (let d = start, n = 0; n < days.length; n++, d = (d + 1) % 7) {
      if (!has[d]) return [];
      run.push(d);
    }
    return run;
  }

  function describeDays(days) {
    if (!days.length) return 'Not currently scheduled';
    if (days.length === 7) return 'Every day';
    if (days.length === 1) return DAY_NAMES[days[0]];
    const run = runOf(days);
    if (!run.length) return days.map(function (x) { return DAY_NAMES[x]; }).join(', ');
    return run.length === 2
      ? DAY_NAMES[run[0]] + ' and ' + DAY_NAMES[run[1]]
      : DAY_NAMES[run[0]] + ' to ' + DAY_NAMES[run[run.length - 1]];
  }

  Object.keys(REGIONS).forEach(function (code) {
    const days = [];
    for (let i = 0; i < 7; i++) if (SITE.schedule[i] === code) days.push(i);
    const run = runOf(days);
    REGIONS[code].weekdays = days;
    REGIONS[code].count = days.length;
    REGIONS[code].dayLabel = describeDays(days);
    REGIONS[code].startDay = run.length ? run[0] : (days[0] || 0);
  });
})();

/* Every market in the order the week meets them. */
const REGION_ORDER = Object.keys(REGIONS).sort(function (a, b) {
  return REGIONS[a].startDay - REGIONS[b].startDay;
});
