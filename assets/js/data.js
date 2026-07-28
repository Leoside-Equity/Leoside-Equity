/* ==========================================================================
   Leoside Equity — site configuration, coverage model and report data
   --------------------------------------------------------------------------
   This is the only file you touch to change what the week looks like or to
   publish in local mode. Add a report object to the top of the REPORTS array
   and the home page, the archive, the sector filter, the dashboard tree and
   every word count update themselves.

   The array is intentionally empty. Nothing is published from this file on a
   live site; in Supabase mode the reports come from the database.
   ========================================================================== */

const SITE = {
  name: 'Leoside Equity',
  tagline: 'Daily equity research across India, the United States and the United Kingdom.',
  email: 'Leoside.Equity@gmail.com',
  founded: 2026,
  // Words a signed out visitor may read before the gate appears.
  freeWords: 90,

  /* The publishing week, keyed by JavaScript weekday. 0 = Sunday, 6 = Saturday.
     Every date on the site is read from the visitor's own clock, so this needs
     no maintenance. Change a value here and the whole site follows: the strip
     under the header, the home page week map, the archive filters, the colour
     coding and the dashboard all read from this one object. */
  schedule: {
    0: 'IN_MACRO',   // Sunday    — the Indian market as a whole
    1: 'US',         // Monday    ┐
    2: 'US',         // Tuesday   ├ one US listed company a day
    3: 'US',         // Wednesday ┘
    4: 'UK',         // Thursday  ┐ one London listed company a day
    5: 'UK',         // Friday    ┘
    6: 'IN_SECTOR'   // Saturday  — one Indian sector
  }
};

/* --------------------------------------------------------------------------
   Regions carry the colour. Three countries, three hues, used identically
   everywhere: the day strip, the tags, the archive filter and the dashboard
   tree. Both Indian slots share the Indian colour because they are both
   India; what separates them is the kind of report, not the country.
   -------------------------------------------------------------------------- */
const REGIONS = {
  IN: {
    code: 'IN', slug: 'in', name: 'India', currency: '₹',
    venues: 'the NSE and the BSE',
    /* The one place the Indian week is spelled out. Everywhere else simply
       says India, so the split stays a detail of the calendar rather than
       something the whole site keeps repeating. */
    detail: 'The market as a whole on Sunday, and a single sector on Saturday.'
  },
  US: {
    code: 'US', slug: 'us', name: 'United States', currency: '$',
    venues: 'the NYSE and the Nasdaq',
    detail: 'One company listed in New York, taken apart properly, each day.'
  },
  UK: {
    code: 'UK', slug: 'uk', name: 'United Kingdom', currency: '£',
    venues: 'the London Stock Exchange',
    detail: 'One London listing, given the same treatment, each day.'
  }
};

/* --------------------------------------------------------------------------
   Kinds exist for one reason: the labels on the publishing form.

   A company note, a market outlook and a sector study all use the same record,
   so writing an index into a box labelled "Ticker" is how a database ends up
   full of tickers that are not tickers. These rename the four fields where
   that matters and stop there.

   Nothing reader facing uses this. The site does not announce the shape of a
   report anywhere, which leaves any given day free to be whatever it needs to
   be without the page contradicting itself.
   -------------------------------------------------------------------------- */
const COVERAGE = {
  stock:  { kind: 'stock',  subject: 'Ticker', holder: 'Company',  target: 'Fair value band',           last: 'Last close' },
  macro:  { kind: 'macro',  subject: 'Index',  holder: 'Market',   target: 'Fair value on the index',   last: 'Last index level' },
  sector: { kind: 'sector', subject: 'Sector', holder: 'Industry', target: 'Fair value on the sector',  last: 'Last sector level' }
};

/* --------------------------------------------------------------------------
   The four coverage slots that make up a week. `days` and `dayLabel` are
   derived from SITE.schedule at the bottom of this file, so a change to the
   schedule cannot leave a stale label behind.

   `short` is deliberately just the country. A tag that reads "India" on every
   report is calmer than one that reads "India · Macro" on some and
   "India · Sector" on others, and the distinction only matters in one place:
   the market split on the home page. `name` carries the longer form for the
   few spots that genuinely need it, such as the admin dropdown.
   -------------------------------------------------------------------------- */
const MARKETS = {
  IN_MACRO: {
    code: 'IN_MACRO',
    region: 'IN',
    kind: 'macro',
    name: 'Indian market outlook',
    short: 'India'
  },
  US: {
    code: 'US',
    region: 'US',
    kind: 'stock',
    name: 'United States equities',
    short: 'United States'
  },
  UK: {
    code: 'UK',
    region: 'UK',
    kind: 'stock',
    name: 'London Stock Exchange',
    short: 'United Kingdom'
  },
  IN_SECTOR: {
    code: 'IN_SECTOR',
    region: 'IN',
    kind: 'sector',
    name: 'Indian sector study',
    short: 'India'
  }
};

/* --------------------------------------------------------------------------
   Reports, newest first.

   Copy this shape for each new report and paste it at the top of the array.
   The fields are the same for all three kinds of report; only the labels the
   site prints beside them change, which COVERAGE above decides.

   {
     id: 'ticker-2026-08-03',   // unique, becomes the URL: report.html?id=...
     date: '2026-08-03',        // YYYY-MM-DD. Suggests the slot for that day
     market: 'US',              // 'IN_MACRO' | 'US' | 'UK' | 'IN_SECTOR'
     ticker: 'TICKER',          // a symbol, an index, or a sector code
     company: 'Company Name',   // the company, the market, or the industry
     exchange: 'Nasdaq',
     sector: 'Technology',      // free text, the filter list builds itself
     rating: 'Undervalued',     // Undervalued | Fairly valued | Overvalued
     target: '$150 to $168',    // an estimate of worth, not a forecast
     last: '$121',
     horizon: '12 months',
     readMins: 6,
     title: 'The headline argument in one line',
     standfirst: 'Two sentences that state the argument before anyone clicks.',
     body: [
       { h: 'Section heading', p: ['First paragraph.', 'Second paragraph.'] },
       { h: 'Another section',  p: ['And so on.'] }
     ]
   }
   -------------------------------------------------------------------------- */
const REPORTS = [];

/* Newest first, in case entries are ever added out of order. */
REPORTS.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/* --------------------------------------------------------------------------
   Derived, so no label can contradict the schedule above.

   `days` is every weekday a slot runs on, and `dayLabel` reads it back as
   English: a run of consecutive days becomes "Monday to Wednesday", a pair
   becomes "Thursday and Friday", and a single day is just itself.
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
    /* Find the day that begins the run: the one whose predecessor is absent. */
    const has = {};
    days.forEach(function (d) { has[d] = true; });
    let start = days[0];
    for (let i = 0; i < days.length; i++) {
      const prev = (days[i] + 6) % 7;
      if (!has[prev]) { start = days[i]; break; }
    }
    /* Walk forward from there. A contiguous set comes back in order; a broken
       one comes back empty and the caller falls back to plain listing. */
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

  Object.keys(MARKETS).forEach(function (code) {
    const days = [];
    for (let i = 0; i < 7; i++) if (SITE.schedule[i] === code) days.push(i);

    MARKETS[code].days = days;
    MARKETS[code].count = days.length;
    MARKETS[code].dayLabel = describeDays(days);

    /* Convenience copies so a caller with a market never has to look up two
       more objects just to print a colour class or a currency symbol. */
    const region = REGIONS[MARKETS[code].region];
    MARKETS[code].slug = region.slug;
    MARKETS[code].currency = region.currency;
    MARKETS[code].regionName = region.name;
  });

  /* Regions get the same treatment, pooling every slot they own. This is what
     the home page splits on: three countries, not four slots, so India reads
     as one weekend rather than two separate entries at opposite ends of the
     week. */
  Object.keys(REGIONS).forEach(function (code) {
    const days = [];
    for (let i = 0; i < 7; i++) if (MARKETS[SITE.schedule[i]].region === code) days.push(i);

    REGIONS[code].days = days;
    REGIONS[code].count = days.length;
    REGIONS[code].dayLabel = describeDays(days);

    /* Where the run begins, so the home page can list the regions in the order
       the week meets them. Sorting on the raw days would put India first on
       the strength of Sunday, when its run actually starts on Saturday. */
    const run = runOf(days);
    REGIONS[code].startDay = run.length ? run[0] : (days[0] || 0);
  });
})();
