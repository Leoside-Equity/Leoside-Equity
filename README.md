# Leoside Equity

A static site for a daily equity research publication: plain HTML, CSS and JavaScript on the front, Supabase (Postgres and auth) behind it. There is no framework. The build step only minifies and copies the public files into `dist/`.

## Run it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. The dev server sends the same security headers as the live site, so a Content Security Policy problem shows up locally first. Do not open the HTML files by double clicking: sign in needs a real origin.

## Build and deploy

```bash
npm run build
```

Deploy the `dist/` folder and nothing else. It holds only public files: the SQL, the scripts, `_source/` and this README are never included. The build:

- joins the shared scripts into one minified file and minifies the rest, with no source maps
- minifies the stylesheet and HTML and adds a content hash to every CSS and JS reference, so they can be cached for a year
- copies the Content-Security-Policy from `_headers` into a `<meta>` tag on every page, for hosts that cannot send headers
- adds every published report to `sitemap.xml`

Host settings are already in the folder:

| Host | What to set |
| --- | --- |
| Netlify | Nothing. `netlify.toml` runs the build and publishes `dist/`; headers come from `_headers`. |
| Vercel | Nothing. `vercel.json` sets the build, output folder and headers. |
| Cloudflare Pages | Build command `npm run build`, output directory `dist`. Headers come from `_headers`. |
| Anything else | Upload `dist/`, and copy the headers from `_headers` into the host's settings. |

### Connecting leosideequity.com

1. In the host's dashboard, add `leosideequity.com` and `www.leosideequity.com` as custom domains, and set `www` to redirect to the bare domain.
2. At your domain registrar, create the DNS records the host shows you (usually an `A` or `ALIAS` record for the bare domain and a `CNAME` for `www`).
3. Wait for the host to issue the HTTPS certificate, then turn on "force HTTPS".
4. In Supabase, Authentication > URL Configuration: set Site URL to `https://leosideequity.com` and add `https://leosideequity.com/**` to the redirect URLs. Keep `http://localhost:5173/**` for local work.
5. In Google Cloud, add `https://leosideequity.com` to the OAuth client's authorised JavaScript origins.
6. Submit `https://leosideequity.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

Every canonical link, share tag, sitemap entry and structured data block already points at `https://leosideequity.com`.

## What is in here

| Path | Purpose |
| --- | --- |
| `index.html` | Home: hero with the 3D globe and live exchange clocks, the companies marquee, latest research with its opening volume, this week, and the invitation to join |
| `reports.html` | Archive with search, market, sector, stance and sort filters, pagination, and shareable filter URLs |
| `report.html` | One report. The database decides whether a visitor gets the preview or the full text |
| `dashboard.html` | Members: saved reports, history, account and privacy (download data, delete account). Admins: numbers and the error log |
| `admin.html` | Publishing, admins only (checked in the database on every save) |
| `signup.html`, `signin.html`, `reset.html` | Accounts, including the age check |
| `about.html`, `method.html` | What the site is, FAQ, how a report is written |
| `terms.html`, `privacy.html`, `disclaimer.html`, `copyright.html`, `accessibility.html` | Legal pages and the accessibility statement |
| `404.html`, `offline.html` | Not found, and the page the service worker shows offline |
| `assets/css/styles.css` | Every style. Tokens (colours, type, spacing) are at the top |
| `assets/js/app.js` | Shared shell: header, menu, footer, search, cookie choice, dialogs, contact, age check, error reporting |
| `assets/js/globe.js` | The globe: orthographic projection, real sun position, coastlines from `land-mask.js` |
| `assets/js/config.js` | Supabase URL and publishable key, timeouts |
| `assets/js/data.js` | Site settings, the weekly calendar, market definitions |
| `assets/fonts/` | Playfair Display (upright and italic), Inter and IBM Plex Mono, self hosted under the SIL Open Font License |
| `supabase/migrations/` | Database changes, run in order |
| `supabase/email-templates/` | Account emails to paste into Supabase |
| `scripts/` | Build, icon generation, WebP logos, land mask generation, load test |

## Publishing

Use `admin.html`. Any date works:

| Date chosen | What happens |
| --- | --- |
| In the past | Goes live now, filed under that date |
| Today | Goes live now |
| In the future | Held as a scheduled draft, goes live at 06:00 India time on the day |

The publishing page has no author or position fields. Reports appear under "Leoside Equity research desk", and the disclaimer says in general terms that the people who write them may hold shares in what they cover. Note that UK and EU market abuse rules expect a named author and a statement of any position on a view about a listed share; if that matters for your readers, a per-report disclosure is the safer choice. To correct a published fact, edit the report and add a dated note as its first paragraph: the site's pages say corrections appear at the top of the report. For Indian reports keep to the market or a sector: no view, price or target on any individual Indian listed security, because Leoside Equity is not registered with SEBI. The valuation fields are hidden, and emptied by the database, for Indian reports for that reason.

Headlines should state the argument without telling people to act. "Ultimate buying opportunity" or "21% upside" reads as a recommendation, which undercuts every disclaimer on the site.

## Security model

- The publishable key in `config.js` is public by design. Everything it can reach is decided by row level security and the security definer functions in `supabase/migrations/`.
- The service role key must never appear anywhere in this folder.
- Readers never query `reports` directly. `list_reports()` returns metadata only, `get_report()` returns a preview or the full text depending on who is asking.
- Member writes are rate limited in the database. Every function that returns data checks the caller.
- Pages load no third party scripts, fonts or trackers. The CSP allows scripts from this site only.
- Details and the checklist are in `supabase/SETUP.md`.

## Tests you can repeat

```bash
npm run build        # also fails on a source map in dist/, or a stray quote or brace in styles.css
npm run loadtest     # 25 simultaneous signed out readers against the live API
npm run audit:deps   # known vulnerabilities in dependencies
```

## Design rules

The palette, type and spacing live in the tokens at the top of `styles.css`. Light mode is warm ivory (`#F6F4EF`) with ink text (`#14181E`) and ink buttons; dark mode is near black (`#08090B`) with ivory text and gold buttons (`#D2AE68`). Brass carries links and small accents, with the United States in steel blue, the United Kingdom in green and India in saffron. Every text colour passes 4.5:1 against every surface in its theme. Playfair Display sets headlines and display type at weight 600, with its italic for the second line of the home headline; Inter sets the interface and all reading text (summaries and report bodies); IBM Plex Mono sets tickers and times.

How the pieces fit together:
- **One surface per theme.** Each page is one continuous background from the header to the footer. Sections are divided by space and hairlines, not by blocks of colour; the only tinted areas are full-width bands (this week on the home page, and the footer) in a slightly warmer version of the page colour.
- **Header.** A solid bar in the page colour with a hairline underneath, stuck to the top. The name is set in two colours, "Leo" and "Equity" in the text colour and "side" in gold (`--accent` in light, `--gold` in dark), with "The research desk" in small spaced capitals under it. The current page is a quiet filled chip in the nav, and a gold reading-progress line runs along the hairline.
- **Home page.** The headline (sized to its column, so it always sits on two lines) beside the 3D globe with its orbit rings and the three exchange clocks; pressing a clock turns the globe to that city. Under the buttons a dateline gives today's market and the newest report, ruled like the clocks opposite. A full-width marquee of the companies covered carries the page into "Latest research": the newest report beside its bound 3D volume, then the four before it as a stack of cards. Each card sticks one strip lower than the last, so the next slides over it and leaves its date and market showing; the cards are given equal heights so the pile leaves in one piece. While the page is open it fetches the report list again every three minutes (and when the tab comes back into view) and redraws the lead, the cards, the week and the hero links if anything changed, with a short status message for a new report. It waits while focus or the pointer is inside those parts. The volume stays closed until a mouse pointer rests on it, then opens: the title page inside the cover, and on the first page the key figures and the points of the report's own summary, so it changes with every report. It closes when the pointer leaves, and stays closed on touch screens. It uses only what the public report list already returns, never the report body. A one line note under the lead report says it is general commentary and links to the disclaimer. Then this week as a desk diary: the markets over their days with exchange hours (the middle one centred on the week), a gold line that fills as the week passes, one column a day, today filled in the primary colour, and an agenda list on phones; and the invitation to join with the lion.
- **Inner pages** open on a plain head (breadcrumbs, title, what the page is for) closed by a hairline. Long documents keep their contents list beside the text without a box, and end with two "keep reading" links to the pages that follow on, ruled like the older and newer links under a report. No page is a dead end. Terms and their meanings (on About and Method) are set as a ledger, `dl.terms`, not as bold headed bullet lists.
- **Layout safety.** Every single column grid is `minmax(0, 1fr)`, so a wide table scrolls inside its own box and never pushes a page wider than a phone. The exchange clocks put the city under the code when their columns get narrow (a container query in em, so it follows the reader's text size).
Rules taken from the brief, to keep the site looking made rather than generated:
- **Surfaces.** Solid colours only: no gradients on text or surfaces, no glass or blur, no grain, no glowing orbs, no dot or line grids. The only soft light is the globe's own atmosphere.
- **Depth.** No drop shadows on cards or panels. Hairlines do the separating, and a restrained shadow is kept only for things that open over the page (menus, dialogs, toasts, the contact button) and for the stacked report cards on the home page, whose faint upward shadow falls on the card underneath.
- **Shape.** Corners are rounded but crisp (8 pixels on controls, 10 to 14 on panels), never soft or pill shaped. Buttons are at least 44 pixels tall and keep a 16 pixel gap between them.
- **Motion.** Hover changes colour or border instantly. Nothing fades, lifts, slides or animates on hover or on scroll, with one deliberate exception: the latest report's volume opens while the pointer rests on it. The stacked report cards are not animated; they are sticky and move only with the reader's scrolling. Otherwise the only motion is the globe (which turns when an exchange is pressed), the companies marquee (with a pause button, and still under reduced motion) and loading indicators. The floating contact button waits until reading has started, so it never sits on a hero.
- **Labels.** No badges or small labels stacked above headlines, and no dashes: none in the copy, no drawn rules or short bars that read as one, and report text is shown with ranges as "12 to 15%" (`plain()` in `store.js`; the stored text is untouched).
- **Details.** Icons are drawn for the site with square ends and mitred corners. Monospace is used only for tickers, times and codes, and every spacing value comes from the `--s-*` scale.

The logo is the original lion artwork, `assets/img/logo.png` (335 x 335, transparent), cut from `_source/logo-original.png`. It is shown gold with nothing drawn around it, on both the ivory and the black page. `node scripts/make-icons.mjs` regenerates the header sizes, the favicon, the app icons and the share image from it, and `node scripts/make-webp.mjs` then writes the WebP copies the pages load.
The globe's land outline is a bitmap built from Natural Earth data by `node scripts/make-land-mask.mjs path/to/land-110m.json` (the file comes from the world-atlas package). The script unwraps each coastline across the date line and closes rings that circle a pole, which is what keeps the Arctic and Antarctica free of stray bands. `globe.js` blends the four map cells around each point, so coastlines stay smooth even near the poles, and the meridians stop at 80 degrees so they never bunch into a bright knot there.
