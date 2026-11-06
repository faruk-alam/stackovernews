// Central site configuration. Edit this file to rebrand the site.
module.exports = {
  name: 'The Daily Wire Demo',
  shortName: 'Daily Wire',
  tagline: 'Independent reporting on technology, business, science and culture.',
  // Public URL without trailing slash. Used for canonical URLs, sitemaps and feeds.
  url: process.env.SITE_URL || 'https://example.com',
  language: 'en',
  locale: 'en_US',
  twitter: '@dailywiredemo',
  email: 'newsroom@example.com',
  // Google AdSense publisher ID, e.g. 'ca-pub-1234567890123456'.
  // Leave empty to render visual placeholders instead of live ad units.
  adsenseClient: process.env.ADSENSE_CLIENT || '',
  // Optional per-slot IDs. Leave empty while testing.
  adSlots: {
    belowHeadline: '',
    midArticle: '',
    endArticle: '',
    mobileAnchor: ''
  },
  postsPerPage: 6,
  categories: {
    technology: { name: 'Technology', description: 'Gadgets, software, AI and the companies shaping the digital world.' },
    business: { name: 'Business', description: 'Markets, startups, work and the global economy.' },
    science: { name: 'Science', description: 'Discoveries, space, climate and health research explained.' },
    culture: { name: 'Culture', description: 'Film, music, books, games and the ideas that move society.' }
  }
};
