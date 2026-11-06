# The Daily Wire Demo — static news site

A fast, SEO-ready news website built with **zero frameworks, zero backend and zero database**.
Articles are Markdown files; a small Node.js script turns them into plain HTML; Tailwind CSS
produces one minified stylesheet; GitHub Actions uploads the result to Hostinger.

```
content/*.md  ──▶  build.js  ──▶  dist/  ──▶  GitHub Actions  ──▶  Hostinger (FTP/SFTP)
```

## Features

| Area | What you get |
|------|--------------|
| **Content** | Markdown + front matter, 12 demo articles across 4 categories, About/Contact/Privacy/Terms/Editorial pages |
| **Pages** | Homepage (hero, trending, latest, per-category sections), one static page per article at `/news/{slug}/`, paginated category pages, 404 |
| **SEO** | Unique title/description, canonical, Open Graph, Twitter cards, `NewsArticle` + `BreadcrumbList` JSON-LD, `WebSite` SearchAction, one H1 per page, breadcrumbs, related articles, `sitemap.xml`, `news-sitemap.xml`, `rss.xml`, `robots.txt` |
| **UI** | Mobile-first newspaper layout, sticky header, hamburger menu, dark mode (localStorage), reading-progress bar, debounced client-side search (`search.json`), system fonts |
| **Performance** | ~9 KB of vanilla JS, one CSS file, `width`/`height` on every image, lazy loading below the fold, `fetchpriority="high"` on hero images, ad slots with reserved heights (no CLS) |
| **Monetisation** | AdSense slots: below headline, mid-article, end of article, sticky mobile anchor. Script loads only when a publisher ID is set, during browser idle time |
| **Hosting** | `.htaccess` with caching, compression and custom 404 for Hostinger's Apache/LiteSpeed |

## Requirements

- Node.js 18 or newer (20 recommended)
- npm

## Quick start

```bash
npm install
npm run dev          # build, watch for changes, preview at http://localhost:3000
```

Other scripts:

| Command | Description |
|---------|-------------|
| `npm run build` | Clean build of HTML, feeds and CSS into `dist/` |
| `npm run watch` | Rebuild on changes (content, templates, static, config) + Tailwind watch |
| `npm run dev` | Same as `watch` plus a local preview server |
| `npm run build:html` | Only the HTML/feeds (no CSS) |
| `npm run build:css` | Only Tailwind CSS |

## GitHub Pages

Pushes to `master` build and publish the site with the GitHub Pages workflow.
In repository **Settings → Pages**, select **GitHub Actions** as the source.
The workflow sets `SITE_URL` to the Pages URL, including its repository path,
so navigation, assets, search, canonical URLs and feeds work under that path.
The existing Hostinger workflow remains available for `main`.

## Project structure

```
.
├── build.js                 # Static site generator (vanilla Node)
├── site.config.js           # Site name, URL, categories, AdSense ID
├── tailwind.config.js
├── package.json
├── content/
│   ├── *.md                 # Articles
│   ├── _TEMPLATE.md.txt     # Copy this to create a new article
│   └── pages/*.md           # About, Contact, Privacy, Terms, Editorial Policy
├── templates/               # HTML templates with {{placeholders}}
│   ├── base.html            # Layout: head, header, footer, ad anchor
│   ├── home.html
│   ├── article.html
│   ├── category.html
│   ├── page.html
│   ├── card.html            # Article card used in grids
│   └── 404.html
├── src/input.css            # Tailwind entry point
├── static/                  # Copied verbatim into dist/
│   ├── .htaccess
│   ├── logo.svg, favicon.svg
│   ├── images/              # Article images
│   └── js/main.js           # Menu, dark mode, search, progress bar, AdSense loader
├── scripts/
│   ├── serve.js             # Dependency-free preview server
│   └── make-placeholders.js # Regenerates the demo SVG images
└── .github/workflows/deploy.yml
```

## Configuration

Edit [`site.config.js`](site.config.js):

```js
module.exports = {
  name: 'The Daily Wire Demo',
  url: process.env.SITE_URL || 'https://example.com',   // no trailing slash
  adsenseClient: process.env.ADSENSE_CLIENT || '',       // 'ca-pub-XXXXXXXXXXXXXXXX'
  postsPerPage: 6,
  categories: {
    technology: { name: 'Technology', description: '…' },
    // add more categories here
  }
};
```

`SITE_URL` and `ADSENSE_CLIENT` can also be supplied as environment variables (the GitHub
workflow reads them from repository **Variables**). While `adsenseClient` is empty the site
shows dashed placeholder boxes in every ad position so you can check the layout.

## Writing articles

Every article is a Markdown file in `content/` with YAML front matter:

```yaml
---
title: "Headline"
description: "Summary for search engines and social cards (≤160 chars)."
category: technology          # must exist in site.config.js
date: 2026-11-06T08:30:00Z    # ISO 8601, used for sorting and sitemaps
image: /images/technology-1.svg
imageAlt: "Alt text"
author: Reporter Name
slug: headline-url-slug       # optional, derived from title if omitted
tags: [one, two]              # optional
featured: true                # optional – homepage hero
trending: true                # optional – homepage trending list
draft: true                   # optional – skip during build
---
Body in Markdown…
```

The build will fail with a clear message if a required field is missing, a category is unknown
or two articles share a slug.

### Images

Put images in `static/images/` and reference them as `/images/filename.jpg`. Use **1200×675
(16:9)** JPG or WebP for production — the demo ships SVG placeholders, which some social
networks will not render as previews.

## Adding an article from the GitHub mobile app

You can publish a story from your phone in about two minutes. Nothing needs to be installed.

1. **Open the repository** in the GitHub app (iOS or Android) and make sure you are on the
   `main` branch.
2. **Grab the template.** Tap **Browse code → content → `_TEMPLATE.md.txt`**, tap the **⋯**
   menu, choose **Copy raw content** (or long-press the text and copy it).
3. **Create the article file.** Go back to the `content` folder, tap **⋯** (top right) → **Create
   new file**.
   - File name: `your-headline-slug.md` — lowercase, hyphens, must end in `.md`.
   - Paste the template, then edit the front matter: `title`, `description`, `category`
     (`technology`, `business`, `science` or `culture`), `date` (today's date/time in UTC),
     `image`, `author` and `slug`. Remove the `#` from `featured:` or `trending:` if you want
     the story promoted on the homepage.
   - Write the body in Markdown below the closing `---`.
4. **Commit.** Tap **Commit changes**, add a short message such as `Add: quantum chips story`,
   keep **Commit directly to the `main` branch** selected and confirm.
5. **Wait for deployment.** Open the **Actions** tab (or watch the notification). The
   *Build and deploy to Hostinger* workflow takes roughly 1–2 minutes. When it turns green, the
   article is live at `https://yourdomain.com/news/your-headline-slug/`, and the homepage,
   category page, sitemaps, RSS feed and search index have all been regenerated.

**Adding a photo from your phone:** in the `static/images` folder tap **⋯ → Upload file**,
choose the image, commit it, then reference it as `/images/filename.jpg` in the article's
`image:` field. Resize to roughly 1200×675 before uploading to keep pages fast.

**Fixing a typo:** open the article file, tap the **pencil** icon, edit, commit. The site
redeploys automatically.

**Unpublishing:** add `draft: true` to the front matter (or delete the file) and commit.

## Deploying to Hostinger

The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every
push to `main`: `npm ci` → `npm run build` → upload `dist/` to your hosting account.

### 1. Get your credentials from hPanel

Hostinger → **Websites → Manage → Files → FTP Accounts**. Note the *FTP IP/hostname*,
*username* and *password*. (For SFTP, see **Advanced → SSH Access**; it is available on
Business/Cloud plans and VPS.)

### 2. Add secrets and variables in GitHub

Repository → **Settings → Secrets and variables → Actions**.

**Secrets** (encrypted):

| Name | Value |
|------|-------|
| `FTP_SERVER` | e.g. `ftp.yourdomain.com` or the IP shown in hPanel |
| `FTP_USERNAME` | FTP/SFTP username |
| `FTP_PASSWORD` | FTP/SFTP password |
| `SSH_PRIVATE_KEY` | *(SFTP only, optional)* private key if you use key auth |

**Variables** (plain text):

| Name | Value | Default |
|------|-------|---------|
| `SITE_URL` | `https://www.yourdomain.com` | `https://example.com` |
| `ADSENSE_CLIENT` | `ca-pub-XXXXXXXXXXXXXXXX` | *(placeholders)* |
| `DEPLOY_PROTOCOL` | `ftp` or `sftp` | `ftp` |
| `FTP_PROTOCOL` | `ftps`, `ftps-legacy` or `ftp` | `ftps` |
| `FTP_PORT` | | `21` (FTP) / `22` (SFTP) |
| `FTP_SERVER_DIR` | Remote folder | `public_html/` |

If your FTP account's root already *is* `public_html`, set `FTP_SERVER_DIR` to `./`.

### 3. Push to `main`

The first deploy uploads everything; later deploys only transfer changed files (the FTP action
keeps a small `.ftp-deploy-sync-state.json` on the server for this).

### 4. After going live

- Submit `https://yourdomain.com/sitemap.xml` and `news-sitemap.xml` in Google Search Console.
- Set `ADSENSE_CLIENT` once your AdSense account is approved. Add per-slot IDs in
  `site.config.js → adSlots` if you create specific ad units.
- Add a consent management platform for EU/UK visitors before enabling personalised ads.

## How the build works

1. `build.js` reads every `content/*.md`, parses front matter with `gray-matter` and converts
   Markdown with `marked` (body images get `loading="lazy"` and intrinsic dimensions).
2. Articles are sorted by date and injected into the templates with a tiny `{{key}}` /
   `{{object.key}}` replacement function — no template language to learn.
3. Each page is wrapped in `templates/base.html`, which receives the SEO metadata and JSON-LD.
4. Feeds, sitemaps, `robots.txt` and `search.json` are written; `static/` is copied into `dist/`.
5. Tailwind scans `templates/`, `build.js`, `static/js/` and the generated HTML to produce a
   purged, minified `dist/style.css`.

### Customising

- **Design:** edit the templates and `src/input.css`. Component classes (`.card`, `.kicker`,
  `.ad-slot`, …) live in the `@layer components` block.
- **Categories:** add an entry to `site.config.js`. Nav, footer, homepage sections, category
  pages and sitemaps update automatically.
- **Ad positions:** `ADS` in `build.js` defines each slot's reserved height. Templates place them
  with `{{adBelowHeadline}}`, `{{adMidArticle}}`, `{{adEndArticle}}`; the anchor lives in
  `base.html`.
- **News sitemap:** only articles published in the last 48 hours are included, per Google News
  guidelines. The file is valid when empty.

## License

MIT. Demo articles are fictional and provided for layout purposes only.
