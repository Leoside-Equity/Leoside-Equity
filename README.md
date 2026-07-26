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
| `method.html` | The research method, on its own page with a back button. Currently a placeholder |
| `terms.html` / `privacy.html` / `disclaimer.html` | Legal pages |
| `admin.html` | Daily publishing screen. Admin accounts only |
| `assets/js/config.js` | Supabase keys and the `USE_SUPABASE` switch |
| `assets/js/data.js` | Site config, markets, and the local report array |
| `assets/js/auth.js` | Accounts. Runs on localStorage or Supabase, same interface |
| `assets/js/store.js` | Loads reports and boots each page |
| `assets/js/app.js` | Header, footer, lion mark, date helpers, theme |
| `assets/js/cards.js` | Shared report card and row markup |
| `assets/css/styles.css` | Everything visual. Design tokens live at the top |
| `supabase/` | The migration and the setup guide |

## Publishing a new report

Everything is driven by `assets/js/data.js`. Add an object to the top of the `REPORTS` array:

```js
{
  id: 'ticker-2026-08-03',        // unique, used in the URL
  date: '2026-08-03',             // YYYY-MM-DD, decides the market automatically
  market: 'IN',                   // 'IN' or 'US'
  ticker: 'TICKER',
  company: 'Company Name Limited',
  exchange: 'NSE',
  sector: 'Financials',
  rating: 'Buy',                  // Buy | Accumulate | Hold | Reduce
  target: '₹1,200',
  last: '₹980',
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

Nothing else needs updating. The archive, the sector filter, the dashboard tree, the home page and the word counts all read from this array.

Sector filter options, month and week grouping, and the "N reports" counts are all derived, so they stay correct on their own.

The archive currently ships empty on purpose. Every page has a proper empty state, so the site looks finished with nothing published: the home page shows a "first report is on its way" card, the archive explains it will fill up, and the dashboard tells the member their account is ready.

## The publishing calendar

Set in `SITE.schedule` in `data.js`, keyed by JavaScript weekday where Sunday is 0:

```js
schedule: { 0:'IN', 1:'IN', 2:'IN', 3:'IN', 4:'US', 5:'US', 6:'US' }
```

Sunday through Wednesday is India, Thursday through Saturday is the United States.

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
- India is coded amber, the United States is coded slate blue, consistently everywhere
- Playfair Display for headings, Inter for interface, Lora for the body of a note
- Light and dark themes both supported. It follows the system setting and the toggle in the header overrides it.

The lion mark is inline SVG in `app.js` (`LS.mark()`) so it inherits colour from its surroundings. A standalone copy for the browser tab is in `assets/img/favicon.svg`. The mane is a twenty point star and the muzzle is an upward chevron, so at small sizes it reads as a rising line.

## Before you launch

- [ ] Write the real content for `method.html`. It currently holds a placeholder line
- [ ] Have a lawyer review `terms.html`, `privacy.html` and `disclaimer.html` against Indian and United States rules on securities commentary. They are drafted from scratch in plain language, not copied from anywhere, and they still need professional review
- [ ] Check the contact address in `SITE.email` in `data.js`
- [ ] Build the backend and move the gate onto it
- [ ] Update the domain in `robots.txt` and add a sitemap
- [ ] Add an Open Graph image and per page `og:` tags if you want link previews to look right
- [ ] Decide on analytics, then update section 6 of the privacy policy to match what you actually run
