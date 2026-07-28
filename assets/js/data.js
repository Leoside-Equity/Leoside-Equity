/* ==========================================================================
   Leoside Equity: site configuration and report data
   --------------------------------------------------------------------------
   One idea runs through this file: a report belongs to a country, and nothing
   else about its shape is the site's business. Sunday's Indian note may be a
   view on the index, Saturday's may be a sector, and either may be something
   else entirely one week. The site says "India" and leaves it there.

   The one place the Indian week is spelled out is REGIONS.IN.days below, which
   the market split on the home page renders. Nowhere else repeats it.

   REPORTS is intentionally empty. Nothing is published from this file on a
   live site; in Supabase mode the reports come from the database.
   ========================================================================== */

const SITE = {
  name: 'Leoside Equity',
  tagline: 'Daily equity research across the United States, the United Kingdom and India.',
  email: 'Leoside.Equity@gmail.com',
  founded: 2026,
  // Words a signed out visitor may read before the gate appears.
  freeWords: 90,

  /* The publishing week, keyed by JavaScript weekday. 0 = Sunday, 6 = Saturday.
     Values are country codes, the same ones a report carries.

     Every date on the site is read from the visitor's own clock, so this needs
     no maintenance. Change a value here and the whole site follows: the strip
     under the header, the home page split, the filters, the colour coding and
     the dashboard all read from this one object. */
  schedule: {
    0: 'IN',   // Sunday
    1: 'US',   // Monday
    2: 'US',   // Tuesday
    3: 'US',   // Wednesday
    4: 'UK',   // Thursday
    5: 'UK',   // Friday
    6: 'IN'    // Saturday
  }
};

/* --------------------------------------------------------------------------
   The three markets. This is the whole model: a colour, a name, and what the
   week looks like there.

   `valuation` decides whether the price fields apply. A note on a whole market
   or a sector is an argument about direction, not a number against a share
   price, so India carries no valuation stance, fair value, last price or
   horizon. The publishing form hides those boxes and the report page omits
   them rather than printing empty dashes.

   `days` is the only place the Indian week is broken down. The home page reads
   it; nothing else does.
   -------------------------------------------------------------------------- */
const REGIONS = {
  US: {
    code: 'US', slug: 'us', name: 'United States', currency: '$',
    venues: 'NYSE and Nasdaq',
    lede: 'The deepest, most heavily covered market in the world, which is exactly why it rewards reading closely.',
    valuation: true,
    /* Each entry is [when, what]. This is the only place on the site where a
       market's week is described in any detail. */
    days: [
      ['Monday to Wednesday',
       'Three American companies, one a day. Each report starts with the business itself, what it actually sells and to whom, then works through the numbers that move it: revenue quality, margin direction, what the balance sheet can absorb. Only then does it turn to price, and to what the current valuation is quietly assuming about the years ahead.']
    ],
    /* Short phrases used where there is only room for a list. */
    focus: ['The business before the numbers', 'Earnings quality and balance sheet', 'What the price already assumes']
  },
  UK: {
    code: 'UK', slug: 'uk', name: 'United Kingdom', currency: '£',
    venues: 'London Stock Exchange',
    lede: 'Older, narrower and more cyclical than New York, and persistently overlooked because of it.',
    valuation: true,
    days: [
      ['Thursday and Friday',
       'Two London listings, one a day, given exactly the same treatment as the American names. London skews towards banks, miners, energy and consumer staples, so the questions lean harder on cycles, capital discipline and what a business earns at the bottom of one rather than the top.']
    ],
    focus: ['Cyclicality and capital discipline', 'Dividend cover and cash generation', 'Where the cycle actually sits']
  },
  IN: {
    code: 'IN', slug: 'in', name: 'India', currency: '₹',
    venues: 'NSE and BSE',
    lede: 'Read from the top down across the weekend, because the direction of the whole market is the story worth telling.',
    valuation: false,
    days: [
      ['Sunday',
       'Where the market as a whole is heading. The indices are the surface; underneath sit rates, inflation, the currency and the flow of money in and out of the country. The report follows what those are doing to each other and what it sets up for the week ahead.'],
      ['Saturday',
       'One sector at a time, taken apart properly. What is driving it right now, which parts of the story are already in the price, where the risk is concentrated, and the honest case both for and against it from here.']
    ],
    focus: ['Index direction and what drives it', 'Rates, inflation, currency and flows', 'One sector, argued both ways']
  }
};

/* --------------------------------------------------------------------------
   Reports, newest first.

   Copy this shape for each new report and paste it at the top of the array.

   {
     id: 'aapl-2026-08-03',     // unique, becomes the URL: report.html?id=...
     date: '2026-08-03',        // YYYY-MM-DD. Suggests the market for that day
     market: 'US',              // 'US' | 'UK' | 'IN'
     ticker: 'AAPL',            // a symbol, an index, or a sector
     company: 'Apple Inc.',     // the company, the market, or the industry
     exchange: 'Nasdaq',
     sector: 'Technology',      // free text, the filter list builds itself
     readMins: 6,
     title: 'The headline argument in one line',
     standfirst: 'Two sentences that state the argument before anyone clicks.',
     body: [
       { h: 'Section heading', p: ['First paragraph.', 'Second paragraph.'] },
       { h: 'Another section',  p: ['And so on.'] }
     ],

     // Only on markets where REGIONS[market].valuation is true:
     rating: 'Undervalued',     // Undervalued | Fairly valued | Overvalued
     target: '$150 to $168',    // an estimate of worth, not a forecast
     last: '$121',
     horizon: '12 months'
   }
   -------------------------------------------------------------------------- */
const REPORTS = [];

/* Newest first, in case entries are ever added out of order. */
REPORTS.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/* --------------------------------------------------------------------------
   Derived from the schedule, so no label can contradict it.
   -------------------------------------------------------------------------- */
(function deriveScheduleLabels() {
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* Read a set of weekdays back as English.

     The week is treated as a circle, which is the whole point: India runs on
     Saturday and Sunday, and days [0, 6] sorted numerically look like the two
     ends of the week rather than the weekend they actually are. Rotating the
     start until the run is unbroken turns that into "Saturday and Sunday". */
  function runOf(days) {
    if (!days.length) return [];
    const has = {};
    days.forEach(function (d) { has[d] = true; });
    let start = days[0];
    for (let i = 0; i < days.length; i++) {
      const prev = (days[i] + 6) % 7;
      if (!has[prev]) { start = days[i]; break; }
    }
    const run = [];
    for (let d = start, n = 0; n < days.length; n++, d = (d + 1) % 7) {
      if (!has[d]) return [];          /* broken run, caller lists them plainly */
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

    REGIONS[code].weekdays = days;
    REGIONS[code].count = days.length;
    REGIONS[code].dayLabel = describeDays(days);

    /* Where the run begins, so the home page can list the markets in the order
       the week meets them. Sorting on the raw days would put India first on
       the strength of Sunday, when its run actually starts on Saturday. */
    const run = runOf(days);
    REGIONS[code].startDay = run.length ? run[0] : (days[0] || 0);
  });
})();

/* Every market in the order the week meets them. */
const REGION_ORDER = Object.keys(REGIONS).sort(function (a, b) {
  return REGIONS[a].startDay - REGIONS[b].startDay;
});
