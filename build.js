#!/usr/bin/env node
'use strict';

/**
 * Static site generator for the news website.
 *
 * Usage:
 *   node build.js            # one-off build of HTML, feeds and assets into /dist
 *   node build.js --watch    # rebuild on changes + Tailwind in watch mode
 *   node build.js --serve    # also start a local preview server (with --watch)
 *
 * Tailwind CSS is compiled by `npm run build:css` (or automatically in --watch mode).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const matter = require('gray-matter');
const { marked } = require('marked');
const site = require('./site.config');

const ROOT = __dirname;
const DIRS = {
  content: path.join(ROOT, 'content'),
  pages: path.join(ROOT, 'content', 'pages'),
  templates: path.join(ROOT, 'templates'),
  static: path.join(ROOT, 'static'),
  dist: path.join(ROOT, 'dist')
};

const args = new Set(process.argv.slice(2));
const WATCH = args.has('--watch');
const SERVE = args.has('--serve');

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripTags = (html = '') => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const absUrl = (p) => (/^https?:\/\//.test(p) ? p : site.url + (p.startsWith('/') ? p : '/' + p));

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const isoDate = (d) => new Date(d).toISOString();

const readingTime = (text) => Math.max(1, Math.round(stripTags(text).split(/\s+/).filter(Boolean).length / 220));

const wordCount = (text) => stripTags(text).split(/\s+/).filter(Boolean).length;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(relPath, content) {
  const out = path.join(DIRS.dist, relPath);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, content);
}

/** Resolve `a.b.c` paths inside a data object. */
function get(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Minimal `{{placeholder}}` template engine. Values are inserted as-is. */
function render(template, data) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = get(data, key);
    return v == null ? '' : String(v);
  });
}

const templateCache = {};
function tpl(name) {
  if (!WATCH && templateCache[name]) return templateCache[name];
  const t = fs.readFileSync(path.join(DIRS.templates, `${name}.html`), 'utf8');
  templateCache[name] = t;
  return t;
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                   */
/* -------------------------------------------------------------------------- */

const renderer = new marked.Renderer();
// Body images: lazy-load and reserve intrinsic size to limit layout shift.
renderer.image = function ({ href, title, text }) {
  const t = title ? ` title="${esc(title)}"` : '';
  return `<img src="${esc(href)}" alt="${esc(text || '')}"${t} width="1200" height="675" loading="lazy" decoding="async">`;
};
renderer.link = function ({ href, title, text }) {
  const external = /^https?:\/\//.test(href) && !href.startsWith(site.url);
  const t = title ? ` title="${esc(title)}"` : '';
  const rel = external ? ' rel="noopener" target="_blank"' : '';
  return `<a href="${esc(href)}"${t}${rel}>${text}</a>`;
};
marked.use({ renderer, gfm: true, breaks: false });

const md = (src) => marked.parse(src);

/* -------------------------------------------------------------------------- */
/* Content loading                                                            */
/* -------------------------------------------------------------------------- */

function loadArticles() {
  const files = fs.readdirSync(DIRS.content).filter((f) => f.endsWith('.md'));
  const articles = files.map((file) => {
    const raw = fs.readFileSync(path.join(DIRS.content, file), 'utf8');
    const { data, content } = matter(raw);

    const required = ['title', 'description', 'category', 'date', 'image', 'author'];
    for (const key of required) {
      if (!data[key]) throw new Error(`content/${file}: missing required front matter field "${key}"`);
    }
    const category = slugify(data.category);
    if (!site.categories[category]) {
      throw new Error(`content/${file}: unknown category "${data.category}". Add it to site.config.js.`);
    }
    if (data.draft) return null;

    const slug = slugify(data.slug || data.title);
    const html = md(content);
    const url = `/news/${slug}/`;

    return {
      file,
      slug,
      url,
      absUrl: site.url + url,
      title: String(data.title),
      description: String(data.description),
      category,
      categoryName: site.categories[category].name,
      categoryUrl: `/category/${category}/`,
      date: new Date(data.date),
      updated: new Date(data.updated || data.date),
      image: data.image,
      imageAlt: data.imageAlt || data.title,
      imageCaption: data.imageCaption || '',
      author: String(data.author),
      tags: Array.isArray(data.tags) ? data.tags : [],
      featured: Boolean(data.featured),
      trending: Boolean(data.trending),
      html,
      readingTime: readingTime(html),
      wordCount: wordCount(html)
    };
  });

  const list = articles.filter(Boolean).sort((a, b) => b.date - a.date);

  const seen = new Set();
  for (const a of list) {
    if (seen.has(a.slug)) throw new Error(`Duplicate slug "${a.slug}" (${a.file})`);
    seen.add(a.slug);
  }
  return list;
}

function loadPages() {
  if (!fs.existsSync(DIRS.pages)) return [];
  return fs
    .readdirSync(DIRS.pages)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(DIRS.pages, file), 'utf8'));
      const slug = slugify(data.slug || path.basename(file, '.md'));
      return {
        slug,
        url: `/${slug}/`,
        title: data.title || slug,
        description: data.description || '',
        date: new Date(data.date || Date.now()),
        html: md(content)
      };
    });
}

/* -------------------------------------------------------------------------- */
/* View helpers                                                               */
/* -------------------------------------------------------------------------- */

function articleView(a) {
  return {
    ...a,
    title: esc(a.title),
    description: esc(a.description),
    author: esc(a.author),
    imageAlt: esc(a.imageAlt),
    imageCaption: esc(a.imageCaption),
    categoryName: esc(a.categoryName),
    dateIso: isoDate(a.date),
    dateHuman: fmtDate(a.date)
  };
}

const card = (a) => render(tpl('card'), articleView(a));
const cards = (list) => list.map(card).join('\n');

/**
 * AdSense slot. Renders a live <ins> unit when a publisher ID is configured,
 * otherwise a visible placeholder. Height is always reserved to prevent CLS.
 */
function adSlot(name, { height, label, className = '' }) {
  const slotId = site.adSlots[name] || '';
  const live = Boolean(site.adsenseClient);
  const inner = live
    ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(site.adsenseClient)}"${
        slotId ? ` data-ad-slot="${esc(slotId)}"` : ''
      } data-ad-format="auto" data-full-width-responsive="true"></ins>`
    : `<span>Advertisement · ${esc(label)}</span>`;
  return `<div class="ad-slot ${live ? 'is-live' : ''} ${className}" data-ad-slot="${name}" style="min-height:${height}px;height:${height}px" aria-label="Advertisement">${inner}</div>`;
}

const ADS = {
  belowHeadline: () => adSlot('belowHeadline', { height: 280, label: 'Below headline' }),
  midArticle: () => adSlot('midArticle', { height: 250, label: 'Mid-article' }),
  endArticle: () => adSlot('endArticle', { height: 280, label: 'End of article' }),
  mobileAnchor: () => adSlot('mobileAnchor', { height: 50, label: 'Anchor', className: 'max-w-[320px]' }),
  leaderboard: () => adSlot('belowHeadline', { height: 90, label: 'Leaderboard', className: 'my-8 hidden md:flex' })
};

function navLinks() {
  const items = [['/', 'Home'], ...Object.entries(site.categories).map(([slug, c]) => [`/category/${slug}/`, c.name])];
  return items.map(([href, label]) => `<a class="nav-link" href="${href}">${esc(label)}</a>`).join('\n');
}

function footerCategories() {
  return Object.entries(site.categories)
    .map(([slug, c]) => `<li><a class="hover:text-brand-600" href="/category/${slug}/">${esc(c.name)}</a></li>`)
    .join('\n');
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.url)
    }))
  };
}

const publisherLd = () => ({
  '@type': 'Organization',
  name: site.name,
  url: site.url,
  logo: { '@type': 'ImageObject', url: absUrl('/logo.svg'), width: 512, height: 512 }
});

/**
 * Wrap page content in the base layout.
 */
function layout({ title, description, url, ogType = 'website', ogImage, jsonLd, content, robots = 'index, follow', bodyClass = '', ogExtra = '', extraHead = '' }) {
  const publicConfig = { adsenseClient: site.adsenseClient, siteUrl: site.url };
  return render(tpl('base'), {
    lang: site.language,
    locale: site.locale,
    siteName: esc(site.name),
    siteShortName: esc(site.shortName || site.name),
    siteUrl: site.url,
    tagline: esc(site.tagline),
    twitter: esc(site.twitter),
    title: esc(title),
    ogTitle: esc(title.replace(` | ${site.name}`, '')),
    description: esc(description),
    canonical: absUrl(url),
    robots,
    ogType,
    ogImage: absUrl(ogImage || '/images/og-default.svg'),
    ogExtra,
    extraHead,
    jsonLd: JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonLd }).replace(/</g, '\\u003c'),
    siteConfigJson: JSON.stringify(publicConfig).replace(/</g, '\\u003c'),
    navLinks: navLinks(),
    footerCategories: footerCategories(),
    anchorAd: ADS.mobileAnchor(),
    bodyClass: `has-anchor-ad ${bodyClass}`.trim(),
    content,
    year: new Date().getFullYear()
  });
}

/* -------------------------------------------------------------------------- */
/* Page builders                                                              */
/* -------------------------------------------------------------------------- */

function buildHome(articles) {
  const hero = articles.find((a) => a.featured) || articles[0];
  const rest = articles.filter((a) => a !== hero);
  const latest = rest.slice(0, 6);

  let trending = articles.filter((a) => a.trending && a !== hero).slice(0, 5);
  if (trending.length < 5) {
    const fill = rest.filter((a) => !trending.includes(a)).slice(0, 5 - trending.length);
    trending = trending.concat(fill);
  }

  const trendingList = trending
    .map(
      (a, i) => `<li class="flex gap-3 py-3">
  <span class="text-2xl font-black leading-none text-neutral-300 dark:text-neutral-700">${i + 1}</span>
  <div>
    <a href="${a.categoryUrl}" class="kicker">${esc(a.categoryName)}</a>
    <h3 class="mt-1 text-sm font-bold leading-snug"><a href="${a.url}" class="hover:text-brand-600">${esc(a.title)}</a></h3>
  </div>
</li>`
    )
    .join('\n');

  const categorySections = Object.entries(site.categories)
    .map(([slug, c]) => {
      const list = articles.filter((a) => a.category === slug).slice(0, 3);
      if (!list.length) return '';
      return `<section class="mt-10" aria-labelledby="cat-${slug}-heading">
  <h2 id="cat-${slug}-heading" class="section-title"><a href="/category/${slug}/" class="hover:text-brand-600">${esc(c.name)}</a></h2>
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${cards(list)}</div>
  <p class="mt-4 text-right text-sm"><a href="/category/${slug}/" class="font-semibold text-brand-600 hover:underline">More in ${esc(c.name)} →</a></p>
</section>`;
    })
    .join('\n');

  const content = render(tpl('home'), {
    siteName: esc(site.name),
    tagline: esc(site.tagline),
    hero: articleView(hero),
    trendingList,
    latestCards: cards(latest),
    categorySections,
    adHome: ADS.leaderboard()
  });

  const jsonLd = [
    {
      '@type': 'WebSite',
      name: site.name,
      url: site.url,
      description: site.tagline,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    },
    { ...publisherLd(), '@type': 'NewsMediaOrganization' },
    breadcrumbLd([{ name: 'Home', url: '/' }])
  ];

  writeFile(
    'index.html',
    layout({
      title: `${site.name} – ${site.tagline}`,
      description: site.tagline,
      url: '/',
      ogImage: hero.image,
      jsonLd,
      content
    })
  );
}

function splitBody(html) {
  const parts = html.split(/(?<=<\/p>)/);
  const paragraphs = parts.filter((p) => p.trim().endsWith('</p>')).length;
  if (paragraphs < 4) return [html, ''];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(''), parts.slice(mid).join('')];
}

function buildArticles(articles) {
  for (const a of articles) {
    const related = articles
      .filter((r) => r !== a && r.category === a.category)
      .concat(articles.filter((r) => r !== a && r.category !== a.category))
      .slice(0, 3);

    const [bodyFirstHalf, bodySecondHalf] = splitBody(a.html);

    const content = render(tpl('article'), {
      ...articleView(a),
      bodyFirstHalf,
      bodySecondHalf,
      encodedUrl: encodeURIComponent(a.absUrl),
      encodedTitle: encodeURIComponent(a.title),
      adBelowHeadline: ADS.belowHeadline(),
      adMidArticle: ADS.midArticle(),
      adEndArticle: ADS.endArticle(),
      relatedCards: cards(related)
    });

    const jsonLd = [
      {
        '@type': 'NewsArticle',
        mainEntityOfPage: { '@type': 'WebPage', '@id': a.absUrl },
        headline: a.title.slice(0, 110),
        description: a.description,
        image: [absUrl(a.image)],
        datePublished: isoDate(a.date),
        dateModified: isoDate(a.updated),
        author: [{ '@type': 'Person', name: a.author }],
        publisher: publisherLd(),
        articleSection: a.categoryName,
        keywords: a.tags.join(', ') || undefined,
        wordCount: a.wordCount,
        inLanguage: site.language,
        isAccessibleForFree: true
      },
      breadcrumbLd([
        { name: 'Home', url: '/' },
        { name: a.categoryName, url: a.categoryUrl },
        { name: a.title, url: a.url }
      ])
    ];

    const ogExtra = [
      `<meta property="article:published_time" content="${isoDate(a.date)}">`,
      `<meta property="article:modified_time" content="${isoDate(a.updated)}">`,
      `<meta property="article:section" content="${esc(a.categoryName)}">`,
      `<meta property="article:author" content="${esc(a.author)}">`,
      ...a.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`)
    ].join('\n  ');

    writeFile(
      path.join('news', a.slug, 'index.html'),
      layout({
        title: `${a.title} | ${site.name}`,
        description: a.description,
        url: a.url,
        ogType: 'article',
        ogImage: a.image,
        ogExtra,
        jsonLd,
        content,
        bodyClass: 'is-article'
      })
    );
  }
}

function buildCategories(articles) {
  const per = site.postsPerPage;
  for (const [slug, c] of Object.entries(site.categories)) {
    const list = articles.filter((a) => a.category === slug);
    const totalPages = Math.max(1, Math.ceil(list.length / per));
    const pageUrl = (n) => (n === 1 ? `/category/${slug}/` : `/category/${slug}/page/${n}/`);

    for (let page = 1; page <= totalPages; page++) {
      const items = list.slice((page - 1) * per, page * per);
      const prev = page > 1 ? pageUrl(page - 1) : null;
      const next = page < totalPages ? pageUrl(page + 1) : null;

      const linkCls = 'rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800';
      const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
        .map((n) =>
          n === page
            ? `<li><span aria-current="page" class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 font-bold text-white">${n}</span></li>`
            : `<li><a href="${pageUrl(n)}" class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">${n}</a></li>`
        )
        .join('');

      const content = render(tpl('category'), {
        categoryName: esc(c.name),
        categoryDescription: esc(c.description),
        totalCount: list.length,
        page,
        totalPages,
        adCategory: ADS.leaderboard(),
        cards: items.length ? cards(items) : '<p class="text-neutral-500">No articles yet.</p>',
        pageNumbers,
        prevLink: prev ? `<a href="${prev}" class="${linkCls}" rel="prev">← Newer</a>` : '<span></span>',
        nextLink: next ? `<a href="${next}" class="${linkCls}" rel="next">Older →</a>` : '<span></span>'
      });

      const title = page === 1 ? `${c.name} News | ${site.name}` : `${c.name} News – Page ${page} | ${site.name}`;
      const extraHead = [
        prev ? `<link rel="prev" href="${absUrl(prev)}">` : '',
        next ? `<link rel="next" href="${absUrl(next)}">` : ''
      ].join('\n  ');

      writeFile(
        path.join(pageUrl(page), 'index.html'),
        layout({
          title,
          description: c.description,
          url: pageUrl(page),
          ogImage: items[0] ? items[0].image : undefined,
          extraHead,
          jsonLd: [
            {
              '@type': 'CollectionPage',
              name: `${c.name} News`,
              url: absUrl(pageUrl(page)),
              description: c.description,
              isPartOf: { '@type': 'WebSite', name: site.name, url: site.url }
            },
            breadcrumbLd([
              { name: 'Home', url: '/' },
              { name: c.name, url: `/category/${slug}/` }
            ])
          ],
          content
        })
      );
    }
  }
}

function buildPages(pages) {
  for (const p of pages) {
    const content = render(tpl('page'), {
      title: esc(p.title),
      description: esc(p.description),
      dateIso: isoDate(p.date),
      dateHuman: fmtDate(p.date),
      body: p.html
    });
    writeFile(
      path.join(p.slug, 'index.html'),
      layout({
        title: `${p.title} | ${site.name}`,
        description: p.description,
        url: p.url,
        jsonLd: [
          { '@type': 'WebPage', name: p.title, url: absUrl(p.url), description: p.description },
          breadcrumbLd([
            { name: 'Home', url: '/' },
            { name: p.title, url: p.url }
          ])
        ],
        content
      })
    );
  }
}

function build404(articles) {
  writeFile(
    '404.html',
    layout({
      title: `Page not found | ${site.name}`,
      description: 'The page you requested could not be found.',
      url: '/404.html',
      robots: 'noindex, follow',
      jsonLd: [breadcrumbLd([{ name: 'Home', url: '/' }])],
      content: render(tpl('404'), { latestCards: cards(articles.slice(0, 3)) })
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Feeds, sitemaps, search index                                              */
/* -------------------------------------------------------------------------- */

const xmlEsc = esc;

function buildSitemap(articles, pages) {
  const urls = [
    { loc: '/', lastmod: articles[0] ? articles[0].updated : new Date(), changefreq: 'hourly', priority: '1.0' },
    ...Object.keys(site.categories).flatMap((slug) => {
      const list = articles.filter((a) => a.category === slug);
      const totalPages = Math.max(1, Math.ceil(list.length / site.postsPerPage));
      return Array.from({ length: totalPages }, (_, i) => ({
        loc: i === 0 ? `/category/${slug}/` : `/category/${slug}/page/${i + 1}/`,
        lastmod: list[0] ? list[0].updated : new Date(),
        changefreq: 'daily',
        priority: i === 0 ? '0.8' : '0.5'
      }));
    }),
    ...articles.map((a) => ({ loc: a.url, lastmod: a.updated, changefreq: 'weekly', priority: '0.7' })),
    ...pages.map((p) => ({ loc: p.url, lastmod: p.date, changefreq: 'yearly', priority: '0.3' }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${xmlEsc(absUrl(u.loc))}</loc>
    <lastmod>${isoDate(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  writeFile('sitemap.xml', xml);
}

function buildNewsSitemap(articles) {
  // Google News only accepts articles published in the last 2 days.
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const recent = articles.filter((a) => a.date.getTime() >= cutoff).slice(0, 1000);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recent
  .map(
    (a) => `  <url>
    <loc>${xmlEsc(a.absUrl)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEsc(site.name)}</news:name>
        <news:language>${site.language}</news:language>
      </news:publication>
      <news:publication_date>${isoDate(a.date)}</news:publication_date>
      <news:title>${xmlEsc(a.title)}</news:title>
      <news:keywords>${xmlEsc([a.categoryName, ...a.tags].join(', '))}</news:keywords>
    </news:news>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  writeFile('news-sitemap.xml', xml);
}

function buildRss(articles) {
  const items = articles
    .slice(0, 20)
    .map(
      (a) => `    <item>
      <title>${xmlEsc(a.title)}</title>
      <link>${xmlEsc(a.absUrl)}</link>
      <guid isPermaLink="true">${xmlEsc(a.absUrl)}</guid>
      <pubDate>${a.date.toUTCString()}</pubDate>
      <dc:creator>${xmlEsc(a.author)}</dc:creator>
      <category>${xmlEsc(a.categoryName)}</category>
      <description>${xmlEsc(a.description)}</description>
      <enclosure url="${xmlEsc(absUrl(a.image))}" type="${a.image.endsWith('.svg') ? 'image/svg+xml' : a.image.endsWith('.png') ? 'image/png' : a.image.endsWith('.webp') ? 'image/webp' : 'image/jpeg'}" length="0"/>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xmlEsc(site.name)}</title>
    <link>${xmlEsc(site.url)}/</link>
    <description>${xmlEsc(site.tagline)}</description>
    <language>${site.language}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEsc(site.url)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
  writeFile('rss.xml', xml);
}

function buildRobots() {
  writeFile(
    'robots.txt',
    `User-agent: *
Allow: /
Disallow: /404.html

Sitemap: ${site.url}/sitemap.xml
Sitemap: ${site.url}/news-sitemap.xml
`
  );
}

function buildSearchIndex(articles) {
  const index = articles.map((a) => ({
    t: a.title,
    d: a.description,
    u: a.url,
    c: a.categoryName,
    dt: a.date.toISOString().slice(0, 10),
    i: a.image,
    k: a.tags.join(' ')
  }));
  writeFile('search.json', JSON.stringify(index));
}

function copyStatic() {
  if (fs.existsSync(DIRS.static)) {
    fs.cpSync(DIRS.static, DIRS.dist, { recursive: true });
  }
}

/* -------------------------------------------------------------------------- */
/* Build orchestration                                                        */
/* -------------------------------------------------------------------------- */

function build() {
  const started = Date.now();
  ensureDir(DIRS.dist);

  const articles = loadArticles();
  const pages = loadPages();

  copyStatic();
  buildHome(articles);
  buildArticles(articles);
  buildCategories(articles);
  buildPages(pages);
  build404(articles);
  buildSitemap(articles, pages);
  buildNewsSitemap(articles);
  buildRss(articles);
  buildRobots();
  buildSearchIndex(articles);

  console.log(
    `✔ Built ${articles.length} articles, ${Object.keys(site.categories).length} categories, ${pages.length} pages in ${Date.now() - started}ms → dist/`
  );
}

function safeBuild() {
  try {
    build();
  } catch (err) {
    console.error('✖ Build failed:', err.message);
    if (!WATCH) process.exit(1);
  }
}

function startTailwind(watch) {
  let cli;
  try {
    cli = require.resolve('tailwindcss/lib/cli.js');
  } catch (e) {
    console.error('Tailwind CSS is not installed. Run `npm install` first.');
    return null;
  }
  const tailwindArgs = [cli, '-i', './src/input.css', '-o', './dist/style.css', '--minify'];
  if (watch) tailwindArgs.push('--watch');
  const child = spawn(process.execPath, tailwindArgs, { stdio: 'inherit', cwd: ROOT });
  child.on('error', (e) => console.error('Tailwind failed to start:', e.message));
  return child;
}

function watchDirs(onChange) {
  const dirs = [DIRS.content, DIRS.templates, DIRS.static, path.join(ROOT, 'site.config.js')];
  let timer = null;
  const trigger = (file) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`↻ Change detected${file ? ` (${file})` : ''}, rebuilding…`);
      delete require.cache[require.resolve('./site.config')];
      onChange();
    }, 150);
  };
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    try {
      fs.watch(d, { recursive: fs.statSync(d).isDirectory() }, (_, file) => trigger(file));
    } catch (e) {
      console.warn(`Could not watch ${d}: ${e.message}`);
    }
  }
}

safeBuild();

if (WATCH) {
  startTailwind(true);
  watchDirs(safeBuild);
  console.log('👀 Watching content/, templates/, static/ and site.config.js…');
  if (SERVE) {
    require('./scripts/serve');
  }
}
