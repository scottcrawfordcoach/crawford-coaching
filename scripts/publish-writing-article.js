#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const blogsDir = path.join(root, 'blogs');
const writingHubPath = path.join(root, 'crawford-writing.html');
const archivePath = path.join(root, 'crawford-writing-all.html');
const writingImportDir = path.join(root, 'writing-import');
const vercelPath = path.join(root, 'vercel.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      args.source = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--rebuild-only') {
      args.rebuildOnly = true;
    }
  }
  return args;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    fail('Source file must start with frontmatter wrapped in --- lines.');
  }

  const frontmatter = {};
  const frontLines = match[1].split(/\r?\n/);
  frontLines.forEach((line) => {
    const separator = line.indexOf(':');
    if (separator === -1) {
      return;
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const value = rawValue.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    frontmatter[key] = value;
  });

  return { frontmatter, markdown: match[2].trim() };
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMarkdownToHtml(text) {
  const escaped = escapeHtml(text);
  const withLinks = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
  const blocks = markdown.split(/\r?\n\s*\r?\n/);
  const htmlBlocks = [];

  blocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith('## ')) {
      htmlBlocks.push(`<h2>${inlineMarkdownToHtml(trimmed.slice(3).trim())}</h2>`);
      return;
    }

    if (trimmed.startsWith('- ')) {
      const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().startsWith('- '));
      const items = lines.map((line) => `<li>${inlineMarkdownToHtml(line.trim().slice(2).trim())}</li>`).join('');
      htmlBlocks.push(`<ul>${items}</ul>`);
      return;
    }

    htmlBlocks.push(`<p>${inlineMarkdownToHtml(trimmed.replace(/\r?\n/g, ' '))}</p>`);
  });

  return htmlBlocks.join('\n      ');
}

function estimateReadTime(markdown) {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

function parseTags(rawValue) {
  if (!rawValue) {
    return [];
  }

  return String(rawValue)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'));
}

function tryParseArticle(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const sep = line.indexOf(':');
    if (sep === -1) return;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    frontmatter[key] = val;
  });

  const markdown = match[2].trim();
  if (!frontmatter.title || !frontmatter.dateIso) return null;

  const slug = frontmatter.slug ? slugify(frontmatter.slug) : slugify(frontmatter.title);
  if (!slug) return null;

  return {
    title: frontmatter.title,
    slug,
    date: frontmatter.date || '',
    dateIso: frontmatter.dateIso,
    excerpt: frontmatter.excerpt || '',
    ogDescription: frontmatter.ogDescription || frontmatter.excerpt || '',
    image: frontmatter.image || `./extracted-images/writing-${slug}.webp`,
    imageAlt: frontmatter.imageAlt || frontmatter.title,
    readTime: frontmatter.readTime || estimateReadTime(markdown),
    category: frontmatter.category || 'Writing',
    tags: parseTags(frontmatter.tags),
    markdown,
  };
}

function readAllArticles() {
  const files = fs.readdirSync(writingImportDir)
    .filter((f) => f.endsWith('.md') && f !== 'article-template.md');

  const articles = [];
  for (const file of files) {
    const data = tryParseArticle(path.join(writingImportDir, file));
    if (data) {
      articles.push(data);
    } else {
      console.warn(`Skipping ${file}: could not parse frontmatter.`);
    }
  }

  articles.sort((a, b) => {
    if (b.dateIso !== a.dateIso) {
      return b.dateIso.localeCompare(a.dateIso);
    }
    const numA = parseInt((a.slug.match(/^(\d+)/) || ['0', '0'])[1], 10);
    const numB = parseInt((b.slug.match(/^(\d+)/) || ['0', '0'])[1], 10);
    return numB - numA;
  });

  return articles;
}

function createArticlePage(data) {
  const canonical = `https://crawford-coaching.ca/writing/${data.slug}`;
  const articleBody = markdownToHtml(data.markdown);
  const titleEncoded = encodeURIComponent(`${data.title} | Crawford Coaching`);
  const urlEncoded = encodeURIComponent(canonical);

  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="/timer-favicon.png">
<title>${escapeHtml(data.title)} | Crawford Coaching</title>
<meta name="description" content="${escapeHtml(data.excerpt)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Crawford Coaching">
<meta property="og:title" content="${escapeHtml(data.title)}">
<meta property="og:description" content="${escapeHtml(data.ogDescription)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://crawford-coaching.ca/${data.image.replace(/^\.\//, '')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(data.title)}">
<meta name="twitter:description" content="${escapeHtml(data.ogDescription)}">
<meta name="twitter:image" content="https://crawford-coaching.ca/${data.image.replace(/^\.\//, '')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Jost:wght@200;300;400;500&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --ink: #0e0f10; --slate: #1c2330; --mist: #7a8fa3; --pale: #c8d4de; --white: #f5f3ef;
  --brand-blue: #2d86c4; --brand-blue-light: #4fa3d8;
  --serif-display: 'Cormorant Garamond', Georgia, serif;
  --serif-body: 'Libre Baskerville', Georgia, serif;
  --sans: 'Jost', sans-serif;
}
body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
img { max-width: 100%; display: block; }
a { color: inherit; }
.nav { position: fixed; top:0; left:0; right:0; z-index:100; display:flex; align-items:center; justify-content:space-between; padding:1.25rem 3rem; background: rgba(14,15,16,0.85); backdrop-filter: blur(12px); border-bottom:1px solid rgba(122,143,163,0.08); }
.nav__logo img { height: 36px; }
.nav__links { display:flex; gap:2.5rem; list-style:none; }
.nav__links a { font-size:0.82rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--mist); text-decoration:none; }
.nav__links a.active, .nav__links a:hover { color:var(--white); }
.nav__cta { font-size:0.78rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--pale); text-decoration:none; border:1px solid rgba(245,243,239,0.25); padding:0.55rem 1.4rem; }
.article-hero { padding:8.5rem 2rem 2rem; border-bottom:1px solid rgba(122,143,163,0.16); background: radial-gradient(circle at 82% 8%, rgba(45,134,196,0.2), transparent 55%), var(--ink); }
.article-hero__inner, .article-layout, .read-next__inner { width:min(1100px, 100%); margin:0 auto; }
.article-hero__eyebrow { font-size:0.75rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--brand-blue); margin-bottom:1rem; }
.article-hero h1 { font-family:var(--serif-display); font-size:clamp(2.1rem,4.6vw,4rem); font-weight:300; line-height:1.05; margin-bottom:1rem; }
.article-hero__meta { display:flex; flex-wrap:wrap; gap:1rem 1.4rem; color:var(--mist); font-size:0.82rem; letter-spacing:0.06em; text-transform:uppercase; }
.article-layout { padding:2.5rem 2rem 4rem; display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:2.5rem; }
.article-main figure { margin-bottom:2rem; border:1px solid rgba(122,143,163,0.2); }
.article-main figcaption { font-size:0.73rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--mist); padding:0.8rem 1rem; border-top:1px solid rgba(122,143,163,0.2); }
.article-body p, .article-body li { font-family:var(--serif-body); font-size:1.02rem; line-height:1.9; color:var(--pale); }
.article-body p { margin-bottom:1.35rem; }
.article-body p:first-child { color:var(--white); font-size:1.12rem; }
.article-body ul { margin:0 0 1.35rem 1.4rem; display:grid; gap:0.5rem; }
.article-body h2 { font-family: var(--serif-display); font-size: 1.8rem; font-weight: 300; margin: 1.6rem 0 0.9rem; }
.article-body a { color: var(--brand-blue-light); }
.article-aside { align-self:start; position:sticky; top:7rem; display:grid; gap:1rem; }
.aside-panel { border:1px solid rgba(122,143,163,0.2); background:var(--slate); padding:1rem; }
.aside-panel h2 { font-size:0.75rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--brand-blue); margin-bottom:0.8rem; }
.aside-panel p { font-family:var(--serif-body); font-size:0.9rem; line-height:1.7; color:var(--pale); }
.share-list { list-style:none; display:grid; gap:0.55rem; }
.share-list a { font-size:0.78rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--mist); text-decoration:none; border:1px solid rgba(122,143,163,0.25); padding:0.55rem 0.7rem; display:block; }
.share-list a:hover { color:var(--white); border-color:rgba(79,163,216,0.5); background:rgba(79,163,216,0.09); }
.read-next { border-top:1px solid rgba(122,143,163,0.16); padding:2.7rem 2rem 4rem; }
.read-next__link { display:inline-flex; align-items:center; gap:0.6rem; text-decoration:none; color:var(--pale); font-size:0.78rem; letter-spacing:0.14em; text-transform:uppercase; border:1px solid rgba(245,243,239,0.22); padding:0.75rem 1rem; }
.footer { padding:3rem; border-top:1px solid rgba(122,143,163,0.1); display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:2rem; text-align:center; }
.footer__logo img { height:32px; }
.footer__copy { font-size:0.75rem; color:var(--mist); }
.footer__links { display:flex; gap:2rem; list-style:none; flex-wrap:wrap; }
.footer__links a { font-size:0.75rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--mist); text-decoration:none; }
.footer__links a:hover { color:var(--pale); }
@media (max-width:1024px) { .article-layout { grid-template-columns:1fr; } .article-aside { position:static; } }
@media (max-width:900px) { .nav { padding:1rem 1.4rem; } .nav__links, .nav__cta { display:none; } .article-hero { padding-top:7rem; } .article-layout, .read-next, .footer { padding-left:1.4rem; padding-right:1.4rem; } }
</style>
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": ${JSON.stringify(data.title)},
  "description": ${JSON.stringify(data.ogDescription)},
  "datePublished": ${JSON.stringify(data.dateIso)},
  "dateModified": ${JSON.stringify(data.dateIso)},
  "author": { "@type": "Person", "name": "Scott Crawford" },
  "publisher": { "@type": "Organization", "name": "Crawford Coaching", "url": "https://crawford-coaching.ca" },
  "mainEntityOfPage": ${JSON.stringify(canonical)},
  "image": ${JSON.stringify(`https://crawford-coaching.ca/${data.image.replace(/^\.\//, '')}`)}
}</script>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav__logo"><img src="./extracted-images/cc-logo.png" alt="Crawford Coaching"></a>
  <ul class="nav__links">
    <li><a href="/coaching">Coaching</a></li>
    <li><a href="/whole">WHOLE</a></li>
    <li><a href="/synergize">Synergize Fitness</a></li>
    <li><a href="/growth-zone">Growth Zone</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/writing" class="active">Writing</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
  <a href="https://calendar.app.google/R66fNg5m7w3aKPKd6" class="nav__cta" target="_blank" rel="noopener">Book a Call</a>
</nav>
<header class="article-hero"><div class="article-hero__inner"><p class="article-hero__eyebrow">Writing</p><h1>${escapeHtml(data.title)}</h1><p class="article-hero__meta"><span>Published ${escapeHtml(data.date)}</span><span>${escapeHtml(data.readTime)}</span><span>${escapeHtml(data.category)}</span></p></div></header>
<main class="article-layout">
  <article class="article-main" aria-label=${JSON.stringify(`Blog article: ${data.title}`)}>
    <figure><img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.imageAlt)}"><figcaption>The visible goal is often only part of the story.</figcaption></figure>
    <div class="article-body">
      ${articleBody}
    </div>
  </article>
  <aside class="article-aside" aria-label="Article sidebar">
    <section class="aside-panel"><h2>Share</h2><ul class="share-list"><li><a id="share-copy" href="#">Copy Link</a></li><li><a id="share-linkedin" href="#" target="_blank" rel="noopener">LinkedIn</a></li><li><a id="share-facebook" href="#" target="_blank" rel="noopener">Facebook</a></li><li><a id="share-x" href="#" target="_blank" rel="noopener">X</a></li><li><a id="share-email" href="#">Email</a></li></ul></section>
    <section class="aside-panel"><h2>Work With Me</h2><p>If this resonates, we can talk through your context and build a path that fits real life, not an idealized one.</p><p style="margin-top:0.7rem;"><a href="/contact" style="color: var(--brand-blue); text-decoration: none;">Start a conversation.</a></p></section>
  </aside>
</main>
<section class="read-next"><div class="read-next__inner"><a href="/writing" class="read-next__link">Back to Writing</a></div></section>
<footer class="footer"><a href="/" class="footer__logo"><img src="./extracted-images/cc-logo.png" alt="Crawford Coaching"></a><ul class="footer__links"><li><a href="/coaching">Coaching</a></li><li><a href="/whole">WHOLE</a></li><li><a href="/synergize">Synergize Fitness</a></li><li><a href="/growth-zone">Growth Zone</a></li><li><a href="/about">About</a></li><li><a href="/writing">Writing</a></li><li><a href="/contact">Contact</a></li></ul><p class="footer__copy">&copy; 2026 Crawford Coaching</p></footer>
<script>
(function() {
  const canonical = ${JSON.stringify(canonical)};
  const title = ${JSON.stringify(`${data.title} | Crawford Coaching`)};
  const titleEncoded = encodeURIComponent(title);
  const urlEncoded = encodeURIComponent(canonical);
  document.getElementById('share-linkedin').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + urlEncoded;
  document.getElementById('share-facebook').href = 'https://www.facebook.com/sharer/sharer.php?u=' + urlEncoded;
  document.getElementById('share-x').href = 'https://twitter.com/intent/tweet?url=' + urlEncoded + '&text=' + titleEncoded;
  document.getElementById('share-email').href = 'mailto:?subject=' + titleEncoded + '&body=' + urlEncoded;
  const copy = document.getElementById('share-copy');
  copy.addEventListener('click', async function(event) {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(canonical);
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy Link'; }, 1600);
    } catch (err) {
      window.location.href = canonical;
    }
  });
})();
</script>
<script src="https://website-assistant-sandy.vercel.app/chat-widget.js"></script>
</body>
</html>
`;
}

function buildCardHtml(data) {
  const articlePath = `/writing/${data.slug}`;
  const urlEncoded = encodeURIComponent(`https://crawford-coaching.ca${articlePath}`);
  const emailSubject = encodeURIComponent(data.title);
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const tagsAttr = tags.join(',');
  const tagButtons = tags
    .map((tag) => `<button type="button" class="tag-chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
    .join('');

  return `\n    <article class="post-card" data-tags="${escapeHtml(tagsAttr)}">\n      <a class="post-card__image" href="${articlePath}" aria-label="Read: ${escapeHtml(data.title)}">\n        <img src="${escapeHtml(data.image)}" alt="Blog thumbnail for ${escapeHtml(data.title)}">\n      </a>\n      <div class="post-card__content">\n        <p class="post-card__meta">\n          <span>${escapeHtml(data.date)}</span>\n          <span>${escapeHtml(data.readTime)}</span>\n          <span>${escapeHtml(data.category)}</span>\n        </p>\n        <h3><a href="${articlePath}">${escapeHtml(data.title)}</a></h3>\n        <p>${escapeHtml(data.excerpt)}</p>\n        <div class="post-card__actions">\n          <a class="post-card__read" href="${articlePath}">Read</a>\n          <div class="share-pill" aria-label="Share options">\n            <span class="share-pill__label">Share</span>\n            <a class="share-pill__icon" href="https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">\n              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>\n              <span class="share-pill__tooltip">LinkedIn</span>\n            </a>\n            <a class="share-pill__icon" href="https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}" target="_blank" rel="noopener" aria-label="Share on Facebook">\n              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>\n              <span class="share-pill__tooltip">Facebook</span>\n            </a>\n            <a class="share-pill__icon" href="mailto:?subject=${emailSubject}&body=${urlEncoded}" aria-label="Share by Email">\n              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h20v16H2V4zm2 2v.54l8 5.33 8-5.33V6H4zm16 12V8.94l-8 5.33-8-5.33V18h16z"/></svg>\n              <span class="share-pill__tooltip">Email</span>\n            </a>\n          </div>\n        </div>\n        <div class="post-card__tags" aria-label="Keywords">${tagButtons}</div>\n      </div>\n    </article>`;
}

function buildSearchBox() {
  return `
    <section class="library-tools" aria-label="Search and tags">
      <label class="library-tools__label" for="writing-library-search">Search the library</label>
      <input id="writing-library-search" class="library-tools__input" type="search" placeholder="Search by title, excerpt, or keyword tag">
      <div class="library-tools__quick" id="writing-library-quick-tags">
        <button type="button" class="tag-chip" data-tag="coaching">coaching</button>
        <button type="button" class="tag-chip" data-tag="mindset">mindset</button>
        <button type="button" class="tag-chip" data-tag="fitness">fitness</button>
        <button type="button" class="tag-chip" data-tag="nutrition">nutrition</button>
        <button type="button" class="tag-chip" data-tag="resilience">resilience</button>
        <button type="button" class="tag-chip" data-tag="habits">habits</button>
        <button type="button" class="tag-chip" data-tag="identity">identity</button>
      </div>
      <p id="writing-library-results" class="library-tools__results">Showing 3 articles</p>
    </section>`;
}

function buildArcCardHtml(data) {
  const articlePath = `/writing/${data.slug}`;
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const tagsAttr = tags.join(',');
  const tagButtons = tags
    .map((tag) => `<button type="button" class="tag-chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
    .join('\n          ');
  const imageSrc = data.image.replace(/^\.\//, '/');

  return `
    <article class="arc-card" data-tags="${escapeHtml(tagsAttr)}">
      <a class="arc-card__image" href="${articlePath}" aria-label="Read: ${escapeHtml(data.title)}">
        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.imageAlt)}">
      </a>
      <div class="arc-card__content">
        <p class="arc-card__meta"><span>${escapeHtml(data.date)}</span><span>${escapeHtml(data.readTime)}</span></p>
        <h3><a href="${articlePath}">${escapeHtml(data.title)}</a></h3>
        <p class="arc-card__excerpt">${escapeHtml(data.excerpt)}</p>
        <div class="arc-card__footer">
          <a class="arc-card__read" href="${articlePath}">Read &rarr;</a>
        </div>
        <div class="arc-card__tags">
          ${tagButtons}
        </div>
      </div>
    </article>`;
}

function rebuildWritingHub(allArticles) {
  let html = fs.readFileSync(writingHubPath, 'utf8');

  // --- Rebuild post-list section ---
  const sectionMarker = '<section class="post-list" aria-label="Blog posts">';
  const asideMarker = '<aside class="sidebar"';

  const startIdx = html.indexOf(sectionMarker);
  if (startIdx === -1) fail('Could not find post-list section in crawford-writing.html.');

  const asideIdx = html.indexOf(asideMarker, startIdx);
  if (asideIdx === -1) fail('Could not find sidebar aside in crawford-writing.html.');

  const regionBeforeAside = html.slice(startIdx, asideIdx);
  const lastSectionCloseOffset = regionBeforeAside.lastIndexOf('</section>');
  if (lastSectionCloseOffset === -1) fail('Could not find closing section tag in post-list region.');

  const endIdx = startIdx + lastSectionCloseOffset + '</section>'.length;

  const top3 = allArticles.slice(0, 3);
  let newContent = sectionMarker;
  newContent += buildCardHtml(top3[0]);
  newContent += buildSearchBox();
  if (top3[1]) newContent += buildCardHtml(top3[1]);
  if (top3[2]) newContent += buildCardHtml(top3[2]);
  newContent += `\n    <div class="view-all-wrap">\n      <a href="/writing/all" class="view-all-btn">View All ${allArticles.length} Articles &rarr;</a>\n    </div>\n  </section>`;

  html = html.slice(0, startIdx) + newContent + html.slice(endIdx);

  // --- Rebuild JSON-LD blogPost array ---
  const blogPostKey = '"blogPost": [';
  const blogPostIdx = html.indexOf(blogPostKey);
  if (blogPostIdx !== -1) {
    const afterArray = blogPostIdx + blogPostKey.length;
    const closingBracket = html.indexOf('\n  ]', afterArray);
    if (closingBracket !== -1) {
      const entries = allArticles.map((a) => {
        const articlePath = `/writing/${a.slug}`;
        return `\n    {"@type":"BlogPosting","headline":${JSON.stringify(a.title)},"url":${JSON.stringify(`https://crawford-coaching.ca${articlePath}`)},"datePublished":${JSON.stringify(a.dateIso)},"image":${JSON.stringify(`https://crawford-coaching.ca/${a.image.replace(/^\.\//, '')}`)}}`;
      }).join(',');
      html = html.slice(0, afterArray) + entries + '\n  ' + html.slice(closingBracket + '\n  '.length);
    }
  }

  fs.writeFileSync(writingHubPath, html, 'utf8');
}

function rebuildArchivePage(allArticles) {
  let html = fs.readFileSync(archivePath, 'utf8');

  const gridStart = '<div class="archive-grid" id="archive-grid">';
  const gridEnd = '</div><!-- /archive-grid -->';

  const startIdx = html.indexOf(gridStart);
  if (startIdx === -1) fail('Could not find archive-grid in crawford-writing-all.html.');

  const endIdx = html.indexOf(gridEnd, startIdx);
  if (endIdx === -1) fail('Could not find end of archive-grid in crawford-writing-all.html.');

  const cards = allArticles.map((a) => buildArcCardHtml(a)).join('');
  const newGrid = gridStart + cards + '\n\n  ' + gridEnd;

  html = html.slice(0, startIdx) + newGrid + html.slice(endIdx + gridEnd.length);

  html = html.replace(/<h1>All \d+ Articles<\/h1>/, `<h1>All ${allArticles.length} Articles</h1>`);
  html = html.replace(/Showing \d+ articles/, `Showing ${allArticles.length} articles`);

  fs.writeFileSync(archivePath, html, 'utf8');
}

function upsertWritingHub(data) {
  let html = fs.readFileSync(writingHubPath, 'utf8');
  const articlePath = `/writing/${data.slug}`;

  if (html.includes(`href="${articlePath}"`)) {
    return;
  }

  const sectionMarker = '<section class="post-list" aria-label="Blog posts">';
  const sectionIndex = html.indexOf(sectionMarker);
  if (sectionIndex === -1) {
    fail('Could not find post list section in crawford-writing.html.');
  }

  const insertIndex = sectionIndex + sectionMarker.length;
  html = `${html.slice(0, insertIndex)}${buildCardHtml(data)}${html.slice(insertIndex)}`;

  const blogPostKey = '"blogPost": [';
  const blogPostIndex = html.indexOf(blogPostKey);
  if (blogPostIndex !== -1) {
    const obj = `\n    {\n      "@type": "BlogPosting",\n      "headline": ${JSON.stringify(data.title)},\n      "url": ${JSON.stringify(`https://crawford-coaching.ca${articlePath}`)},\n      "datePublished": ${JSON.stringify(data.dateIso)},\n      "image": ${JSON.stringify(`https://crawford-coaching.ca/${data.image.replace(/^\.\//, '')}`)}\n    },`;
    const arrInsert = blogPostIndex + blogPostKey.length;
    html = `${html.slice(0, arrInsert)}${obj}${html.slice(arrInsert)}`;
  }

  fs.writeFileSync(writingHubPath, html, 'utf8');
}

function upsertVercelRewrite(slug) {
  const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const source = `/writing/${slug}`;
  const destination = `/blogs/crawford-writing-${slug}.html`;

  const exists = Array.isArray(vercel.rewrites) && vercel.rewrites.some((r) => r.source === source);
  if (!exists) {
    vercel.rewrites.push({ source, destination });
    fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
  }
}

function validateData(frontmatter, markdown) {
  const required = ['title', 'date', 'dateIso', 'excerpt', 'ogDescription', 'image', 'imageAlt'];
  required.forEach((field) => {
    if (!frontmatter[field]) {
      fail(`Missing required frontmatter field: ${field}`);
    }
  });

  const slug = frontmatter.slug ? slugify(frontmatter.slug) : slugify(frontmatter.title);
  if (!slug) {
    fail('Could not derive a valid slug.');
  }

  const readTime = frontmatter.readTime || estimateReadTime(markdown);
  const category = frontmatter.category || 'Writing';
  const tags = parseTags(frontmatter.tags);

  return {
    title: frontmatter.title,
    slug,
    date: frontmatter.date,
    dateIso: frontmatter.dateIso,
    excerpt: frontmatter.excerpt,
    ogDescription: frontmatter.ogDescription,
    image: frontmatter.image,
    imageAlt: frontmatter.imageAlt,
    readTime,
    category,
    tags,
    markdown,
  };
}

function main() {
  const args = parseArgs(process.argv);

  // --rebuild-only: rebuild both pages from all articles without publishing a new one
  if (args.rebuildOnly) {
    const allArticles = readAllArticles();
    rebuildWritingHub(allArticles);
    rebuildArchivePage(allArticles);
    console.log(`Rebuilt writing hub: crawford-writing.html (${allArticles.length} articles, showing top 3)`);
    console.log(`Rebuilt archive: crawford-writing-all.html (${allArticles.length} articles)`);
    return;
  }

  if (!args.source) {
    fail('Usage: node scripts/publish-writing-article.js --source writing-import/my-article.md [--dry-run]\n       node scripts/publish-writing-article.js --rebuild-only');
  }

  const sourcePath = path.resolve(process.cwd(), args.source);
  if (!fs.existsSync(sourcePath)) {
    fail(`Source file not found: ${sourcePath}`);
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const parsed = parseFrontmatter(sourceContent);
  const data = validateData(parsed.frontmatter, parsed.markdown);

  const outputFileName = `crawford-writing-${data.slug}.html`;
  const outputPath = path.join(blogsDir, outputFileName);
  const articleHtml = createArticlePage(data);

  if (args.dryRun) {
    console.log(`[dry-run] Would create: blogs/${outputFileName}`);
    console.log(`[dry-run] Would rebuild: crawford-writing.html (canonical top-3 layout)`);
    console.log(`[dry-run] Would rebuild: crawford-writing-all.html (full archive)`);
    console.log(`[dry-run] Would update: vercel.json with /writing/${data.slug}`);
    return;
  }

  fs.mkdirSync(blogsDir, { recursive: true });
  fs.writeFileSync(outputPath, articleHtml, 'utf8');

  const allArticles = readAllArticles();
  rebuildWritingHub(allArticles);
  rebuildArchivePage(allArticles);
  upsertVercelRewrite(data.slug);

  console.log(`Created article page: blogs/${outputFileName}`);
  console.log(`Rebuilt writing hub: crawford-writing.html (${allArticles.length} articles, showing top 3)`);
  console.log(`Rebuilt archive: crawford-writing-all.html (${allArticles.length} articles)`);
  console.log(`Updated route: /writing/${data.slug}`);
}

main();
