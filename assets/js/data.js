/* ==========================================================================
   Leoside Equity — site configuration and report data
   --------------------------------------------------------------------------
   This is the only file you touch to publish. Add a report object to the top
   of the REPORTS array and the home page, the archive, the sector filter, the
   dashboard tree and every word count update themselves.

   The array is intentionally empty. Nothing has been published yet, and no
   placeholder research should ever sit on a live site.
   ========================================================================== */

const SITE = {
  name: 'Leoside Equity',
  tagline: 'Daily equity research on Indian and United States markets.',
  email: 'Leoside.Equity@gmail.com',
  founded: 2026,
  // Words a signed out visitor may read before the gate appears.
  freeWords: 90,
  // Publishing calendar, keyed by JavaScript weekday. 0 = Sunday, 6 = Saturday.
  // Every date on the site is read from the visitor's own clock, so this needs
  // no maintenance. Change a value here and the whole site follows.
  schedule: { 0: 'IN', 1: 'IN', 2: 'IN', 3: 'IN', 4: 'US', 5: 'US', 6: 'US' }
};

const MARKETS = {
  IN: {
    code: 'IN',
    name: 'Indian markets',
    short: 'India',
    venues: 'NSE and BSE listed companies',
    days: [0, 1, 2, 3],
    dayLabel: 'Sunday to Wednesday',
    currency: '₹',
    blurb: 'Companies listed on the NSE and the BSE.'
  },
  US: {
    code: 'US',
    name: 'US markets',
    short: 'United States',
    venues: 'NYSE and Nasdaq listed companies',
    days: [4, 5, 6],
    dayLabel: 'Thursday to Saturday',
    currency: '$',
    blurb: 'Companies listed on the NYSE and the Nasdaq.'
  }
};

/* --------------------------------------------------------------------------
   Reports, newest first.

   Copy this shape for each new report and paste it at the top of the array:

   {
     id: 'ticker-2026-08-03',   // unique, becomes the URL: report.html?id=...
     date: '2026-08-03',        // YYYY-MM-DD. The market is derived from this
     market: 'IN',              // 'IN' or 'US'
     ticker: 'TICKER',
     company: 'Company Name Limited',
     exchange: 'NSE',
     sector: 'Financials',      // free text, the filter list builds itself
     rating: 'Buy',             // Buy | Accumulate | Hold | Reduce
     target: '₹1,200',
     last: '₹980',
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
