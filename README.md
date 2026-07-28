# Leoside Equity

A static front end for a daily equity research site. Plain HTML, CSS and JavaScript, no build step, no dependencies to install. Drop the folder on any host and it works.

## Running it locally

Do not open `index.html` by double clicking it. Browsers restrict `localStorage` on `file://` URLs, which breaks sign in. Start the tiny dev server instead:

```bash
powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
```

Then open <http://localhost:5173>.

## What is in here

| File | What it does |
| --- | --- |
| `index.html` | Home page. Hero, today's report, recent grid, publishing calendar explainer |
| `reports.html` | Full archive with search, market, sector, rating and sort filters |
| `report.html` | A single note. Reads `?id=` from the URL. Holds the free preview gate |
| `dashboard.html` | Member area. Sidebar archive by month, week and day |
| `signup.html` / `signin.html` | Account forms |
| `about.html` | What the site is, who it is for, FAQ |
| `method.html` | The research method, on its own page with a back button |
| `terms.html` / `privacy.html` / `disclaimer.html` | Legal pages |
| `admin.html` | Daily publishing screen. Admin accounts only |
| `assets/js/config.js` | Supabase keys and the `USE_SUPABASE` switch |
| `assets/js/data.js` | Site config, markets, and the local report array |
| `assets/js/auth.js` | Accounts. Runs on localStorage or Supabase, same interface |
| `assets/js/store.js` | Loads reports and boots each page |
| `assets/js/app.js` | Header, footer, lion mark, date helpers, theme |
| `assets/js/cards.js` | Shared report card and row markup |
| `assets/css/styles.css` | Everything visual. Design tokens live at the top |
| `supabase/` | The migrations and the setup guide |

There is no mailing list. The site sends only what an account cannot work without: address confirmation, password resets, and account, security or legal notices. `privacy.html` section 7 and `terms.html` section 11 both say so, and migration `0011` drops the `digest_opt_in` column that used to record an opt in nobody was asked for. If you ever add a digest, those two sections have to change back first.

## Publishing a new report

Everything is driven by `assets/js/data.js`. Add an object to the top of the `REPORTS` array:

```js
{
  id: 'ticker-2026-08-03',        // unique, used in the URL
  date: '2026-08-03',             // YYYY-MM-DD, suggests the slot for that day
  market: 'US',                   // 'IN_MACRO' | 'US' | 'UK' | 'IN_SECTOR'
  ticker: 'TICKER',               // a symbol, an index, or a sector code
  company: 'Company Name Inc.',   // the company, the market, or the industry
  exchange: 'Nasdaq',
  sector: 'Technology',
  rating: 'Undervalued',          // Undervalued | Fairly valued | Overvalued
  target: '$150 to $168',         // an estimate of worth, not a forecast
  last: '$121',
  horizon: '12 months',
  readMins: 6,
  title: 'The headline argument in one line',
  standfirst: 'Two sentences that state the thesis before anyone clicks.',
  body: [
    { h: 'Section heading', p: ['First paragraph.', 'Second paragraph.'] },
    { h: 'Another section', p: ['And so on.'] }
  ]
}
```

Nothing else needs updating. The reports page, the sector filter, the dashboard tree, the home page and the word counts all read from this array.

Sector filter options, month and week grouping, and the "N reports" counts are all derived, so they stay correct on their own.

With nothing published every page has a proper empty state, so the site still looks finished: the home page shows a "first report is on its way" card, the reports page explains it will fill up, and the dashboard tells the member their account is ready.

## The publishing calendar

Set in `SITE.schedule` in `data.js`, keyed by JavaScript weekday where Sunday is 0:

```js
schedule: { 0:'IN_MACRO', 1:'US', 2:'US', 3:'US', 4:'UK', 5:'UK', 6:'IN_SECTOR' }
```

| Day | Slot | What goes out |
| --- | --- | --- |
| Sunday | `IN_MACRO` | The Indian market as a whole. Indices, rates, inflation, flows |
| Monday to Wednesday | `US` | One NYSE or Nasdaq listed company a day |
| Thursday and Friday | `UK` | One London listed company a day |
| Saturday | `IN_SECTOR` | One Indian sector taken apart |

Three things come off this one object and nothing restates them by hand: the day strip under the header, the week map on the home page, and the coverage list on the about, method and report pages. `MARKETS[code].days`, `.count` and `.dayLabel` are all derived at the bottom of `data.js`, so "Monday to Wednesday" and "3 reports a week" are computed, never typed.

**Three countries, three colours.** `REGIONS` holds them: India amber, the United States slate blue, the United Kingdom violet. Both Indian slots share amber because they are both India, and a fourth colour would have implied a fourth country.

**The site never announces the shape of a report.** Tags say `India`, not `India · Sector`. The split between the Sunday market view and the Saturday sector view is stated once, in `REGIONS.IN.detail`, which is what the home page's market split renders. Everywhere else a report is simply Indian. That keeps any given day free to be whatever it needs to be without a badge elsewhere on the site contradicting it.

One report record covers every shape. `COVERAGE` exists only to rename four fields on the publishing form, so an index outlook is not typed into a box labelled `Ticker`. Nothing reader facing reads it. No extra columns, no second table.

**It never needs manual updating.** The strip under the header always runs Sunday to Saturday. Which chip is marked as today, and the date printed beside it, come from `new Date()`, which is the reader's own device clock and timezone. Someone in Bengaluru and someone in New York can see different days highlighted at the same moment, each correct for them. Nothing animates or flashes; today simply carries a brass outline.

Report dates are equally safe. A `date` string like `2026-08-03` is parsed with `new Date(2026, 7, 3)` in `LS.parseDate()`, which builds local midnight. Parsing it the obvious way, `new Date('2026-08-03')`, would be read as UTC and would show the wrong weekday for anyone west of Greenwich. That is why the helper exists, and why every date on the site should go through it rather than through `Date.parse`.

Change one value in `schedule` and the header strip, the home page explainer, the market colour coding, the archive filters and the dashboard all follow.

## Two modes

The site runs either standalone or against Supabase, switched by one line in `assets/js/config.js`:

```js
USE_SUPABASE: false,   // localStorage. No server. Edit REPORTS in data.js
USE_SUPABASE: true,    // real accounts, real gate. See supabase/SETUP.md
```

Everything else is identical between the two. `Auth` and `Data` expose the same functions either way, so no page knows or cares which is running.

To connect the backend, follow **`supabase/SETUP.md`**. It takes about fifteen minutes and ends with a test that proves the gate is real.

## How the gate works, and what has to change

Signed out visitors see the first `SITE.freeWords` words (currently 90) and then a card asking them to create a free account. Signed in visitors get the whole note.

The front end is built honestly: `LS.preview()` truncates the text **before** it is written into the page, so the rest of the note is not sitting in the HTML waiting to be found in view source.

**In local mode that is still only a front end.** Account data sits in `localStorage`, so anyone can bypass it from the console. It is fine for working on the design and worthless as security.

**In Supabase mode the gate is real.** The `reports` table has row level security on with no read policy, so it cannot be read through the API at all. The only door is `get_report()`, which reads `auth.uid()` from a signed JWT and returns either a 90 word preview or the full body. Someone can read your JavaScript, take the public key, call the function directly, and still get 90 words. `supabase/SETUP.md` step 6 walks through proving that yourself.

## Design

The palette and type scale are CSS custom properties at the top of `styles.css`. Change them there and the whole site follows.

- Ink navy `#0E141C` for dark surfaces, warm paper `#FBF9F5` for light
- Antique brass `#9C7430` and `#C6A15A` as the accent
- India is coded amber, the United States slate blue, the United Kingdom violet, consistently everywhere
- Playfair Display for headings, Inter for interface, Lora for the body of a note
- Light and dark themes both supported. It follows the system setting and the toggle in the header overrides it.

The lion mark is a single image, `assets/img/logo.png`, drawn by `LS.mark()` in `app.js`. Replacing the artwork means replacing that file and nothing else. It wants a square export with a transparent background, because it sits on a cream header in light mode and an ink one in dark. `logo.svg` is the fallback `LS.mark()` swaps in if the png ever goes missing; `logo-original.png` is the untouched export kept as a source file.

Readers can set a profile photo. It is cropped square, scaled to 256px in a canvas on their own machine, and stored inline on their profile row as a data URI, so no storage bucket and no second set of access rules. See migration `0012`.

## Before you launch

- [ ] Have a lawyer review `terms.html`, `privacy.html` and `disclaimer.html` against the securities commentary rules in every market you publish on. They are drafted from scratch in plain language, not copied from anywhere, and they still need professional review. Section 19 of the terms carries the territorial scope clause, which is the one most worth a second opinion
- [ ] Check the contact address in `SITE.email` in `data.js`
- [ ] Update the domain in `robots.txt` and add a sitemap
- [ ] Add an Open Graph image and per page `og:` tags if you want link previews to look right
- [ ] Decide on analytics, then update section 6 of the privacy policy to match what you actually run
- [ ] `assets/img/favicon.svg` is not referenced by any page. Wire it up as an `<link rel="icon">` or delete it
