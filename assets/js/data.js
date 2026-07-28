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
  IN: { code: 'IN', slug: 'in', name: 'India',          currency: '₹', venues: 'the NSE and the BSE' },
  US: { code: 'US', slug: 'us', name: 'United States',  currency: '$', venues: 'the NYSE and the Nasdaq' },
  UK: { code: 'UK', slug: 'uk', name: 'United Kingdom', currency: '£', venues: 'the London Stock Exchange' }
};

/* --------------------------------------------------------------------------
   Kinds carry the shape of the report. A single company note, an index and
   macro note, and a sector study all use the same record, so the labels on
   the key statistics change rather than the columns underneath.

   `subject` is what the ticker field is called for that kind, `holder` what
   the company field is called, and `target` / `last` how the two price fields
   are described. Nothing else in the site needs to know the difference.
   -------------------------------------------------------------------------- */
const COVERAGE = {
  stock: {
    kind: 'stock',
    label: 'Single company',
    unit: 'One company',
    subject: 'Ticker',
    holder: 'Company',
    target: 'Fair value band',
    last: 'Last close',
    crumb: 'company'
  },
  macro: {
    kind: 'macro',
    label: 'Index & macro',
    unit: 'The whole market',
    subject: 'Index',
    holder: 'Market',
    target: 'Fair value on the index',
    last: 'Last index level',
    crumb: 'market outlook'
  },
  sector: {
    kind: 'sector',
    label: 'Sector study',
    unit: 'One sector',
    subject: 'Sector',
    holder: 'Industry',
    target: 'Fair value on the sector',
    last: 'Last sector level',
    crumb: 'sector study'
  }
};

/* --------------------------------------------------------------------------
   The four coverage slots that make up a week. `days` and `dayLabel` are
   derived from SITE.schedule at the bottom of this file, so a change to the
   schedule cannot leave a stale label behind.
   -------------------------------------------------------------------------- */
const MARKETS = {
  IN_MACRO: {
    code: 'IN_MACRO',
    region: 'IN',
    kind: 'macro',
    name: 'Indian market outlook',
    short: 'India · Macro',
    nav: 'Indian market outlook',
    headline: 'Where the Indian market goes next',
    blurb: 'The Indian market read as one thing rather than one company: what the indices are doing, what the macro data underneath them says, and what that sets up for the week ahead.',
    covers: 'NIFTY, the SENSEX, rates, inflation, currency and flows',
    examples: ['NIFTY 50 direction', 'Rate and inflation prints', 'Foreign and domestic flows']
  },
  US: {
    code: 'US',
    region: 'US',
    kind: 'stock',
    name: 'United States equities',
    short: 'United States',
    nav: 'US companies',
    headline: 'One American business a day',
    blurb: 'A single company listed in the United States, taken apart properly: what it sells, what actually moves the numbers, where the pressure points are, and what the share price is asking you to believe.',
    covers: 'NYSE and Nasdaq listed companies',
    examples: ['Business model and moat', 'Earnings quality', 'Valuation and catalysts']
  },
  UK: {
    code: 'UK',
    region: 'UK',
    kind: 'stock',
    name: 'London Stock Exchange',
    short: 'United Kingdom',
    nav: 'UK companies',
    headline: 'One London listing a day',
    blurb: 'A single company listed in London, given the same treatment as the American names: the business first, the numbers second, and the price last.',
    covers: 'London Stock Exchange listed companies',
    examples: ['Business model and moat', 'Earnings quality', 'Valuation and catalysts']
  },
  IN_SECTOR: {
    code: 'IN_SECTOR',
    region: 'IN',
    kind: 'sector',
    name: 'Indian sector study',
    short: 'India · Sector',
    nav: 'Indian sectors',
    headline: 'One Indian sector, taken apart',
    blurb: 'A whole slice of the Indian market rather than one name in it. What is driving the sector, what could break it, and the case for where it goes from here.',
    covers: 'A single sector of the Indian market, IT or banks or pharma',
    examples: ['What is driving the sector', 'Where the risk sits', 'The case either way']
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

  Object.keys(MARKETS).forEach(function (code) {
    const days = [];
    for (let i = 0; i < 7; i++) if (SITE.schedule[i] === code) days.push(i);

    MARKETS[code].days = days;
    MARKETS[code].count = days.length;
    MARKETS[code].dayLabel =
      days.length === 0 ? 'Not currently scheduled'
      : days.length === 1 ? DAY_NAMES[days[0]]
      : days.length === 2 ? DAY_NAMES[days[0]] + ' and ' + DAY_NAMES[days[1]]
      : DAY_NAMES[days[0]] + ' to ' + DAY_NAMES[days[days.length - 1]];

    /* Convenience copies so a caller with a market never has to look up two
       more objects just to print a colour class or a currency symbol. */
    const region = REGIONS[MARKETS[code].region];
    MARKETS[code].slug = region.slug;
    MARKETS[code].currency = region.currency;
    MARKETS[code].regionName = region.name;
  });
})();
