#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const extractedImagesDir = path.join(root, 'extracted-images');
const writingImportDir = path.join(root, 'writing-import');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    source: null,
    dir: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--source') {
      args.source = argv[i + 1];
      i += 1;
    } else if (token === '--dir') {
      args.dir = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function friendlyDate(isoDate) {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) {
    return 'Jan 1, 1970';
  }

  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

function extractBlogDataObject(html) {
  const marker = 'window._BLOG_DATA=';
  const markerPos = html.indexOf(marker);
  if (markerPos === -1) {
    fail('Could not find window._BLOG_DATA in source HTML.');
  }

  const jsonStart = markerPos + marker.length;
  const scriptEnd = html.indexOf('</script>', jsonStart);
  if (scriptEnd === -1) {
    fail('Could not locate closing </script> after _BLOG_DATA.');
  }

  let jsonCandidate = html.slice(jsonStart, scriptEnd).trim();
  if (jsonCandidate.endsWith(';')) {
    jsonCandidate = jsonCandidate.slice(0, -1);
  }

  try {
    return JSON.parse(jsonCandidate);
  } catch (err) {
    fail(`Failed to parse _BLOG_DATA JSON: ${err.message}`);
  }
}

function buildMetaMap(metaEntries) {
  const map = {};
  (metaEntries || []).forEach((entry) => {
    if (!entry || !entry.key) {
      return;
    }
    map[entry.key] = entry.value;
  });
  return map;
}

function applyEntityRanges(rawText, entityRanges, entityMap) {
  if (!entityRanges || entityRanges.length === 0) {
    return rawText;
  }

  const linkRanges = entityRanges
    .map((range) => {
      const entity = entityMap[String(range.key)];
      if (!entity || entity.type !== 'LINK') {
        return null;
      }
      const href = (entity.data && (entity.data.href || entity.data.url)) || '';
      if (!href) {
        return null;
      }
      return { offset: range.offset, length: range.length, href };
    })
    .filter(Boolean)
    .sort((a, b) => a.offset - b.offset);

  if (linkRanges.length === 0) {
    return rawText;
  }

  let result = '';
  let cursor = 0;

  linkRanges.forEach((range) => {
    if (range.offset > cursor) {
      result += rawText.slice(cursor, range.offset);
    }
    const linkText = rawText.slice(range.offset, range.offset + range.length);
    if (linkText.trim()) {
      result += `[${linkText}](${range.href})`;
    } else {
      result += linkText;
    }
    cursor = range.offset + range.length;
  });

  result += rawText.slice(cursor);
  return result;
}

function draftJsToMarkdown(fullContentRaw) {
  if (!fullContentRaw) {
    return '';
  }

  let draft;
  try {
    draft = JSON.parse(fullContentRaw);
  } catch (err) {
    return '';
  }

  if (!draft || !Array.isArray(draft.blocks)) {
    return '';
  }

  const entityMap = draft.entityMap || {};
  const lines = [];
  let inList = false;

  draft.blocks.forEach((block) => {
    const rawText = block.text || '';
    const linked = applyEntityRanges(rawText, block.entityRanges, entityMap);
    const text = safeText(linked);
    if (!text) {
      if (!inList) {
        lines.push('');
      }
      return;
    }

    const type = block.type || 'unstyled';

    if (type === 'unordered-list-item') {
      lines.push(`- ${text}`);
      inList = true;
      return;
    }

    if (type === 'ordered-list-item') {
      lines.push(`1. ${text}`);
      inList = true;
      return;
    }

    if (inList) {
      lines.push('');
      inList = false;
    }

    if (type === 'header-two') {
      lines.push(`## ${text}`);
      lines.push('');
      return;
    }

    if (type === 'header-three') {
      lines.push(`### ${text}`);
      lines.push('');
      return;
    }

    lines.push(text);
    lines.push('');
  });

  const normalized = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalized;
}

function chooseLocalImage(sourcePath, slug) {
  const parsed = path.parse(sourcePath);
  const siblingWebp = path.join(parsed.dir, `${parsed.name}.webp`);

  if (!fs.existsSync(siblingWebp)) {
    return {
      imageRelativePath: '',
      note: 'No sibling .webp image found next to source HTML.',
    };
  }

  const outputName = `writing-${slug}.webp`;
  const outputPath = path.join(extractedImagesDir, outputName);
  fs.copyFileSync(siblingWebp, outputPath);

  return {
    imageRelativePath: `./extracted-images/${outputName}`,
    note: `Copied image to extracted-images/${outputName}`,
  };
}

function renderMarkdownFile(article) {
  return `---
 title: "${article.title.replace(/"/g, '\\"')}"
 slug: "${article.slug}"
 date: "${article.date}"
 dateIso: "${article.dateIso}"
 category: "${article.category}"
 readTime: "${article.readTime}"
 excerpt: "${article.excerpt.replace(/"/g, '\\"')}"
 ogDescription: "${article.ogDescription.replace(/"/g, '\\"')}"
 image: "${article.imagePath}"
 imageAlt: "${article.imageAlt.replace(/"/g, '\\"')}"
---

${article.body}
`;
}

function ensureWritingImportDir() {
  if (!fs.existsSync(writingImportDir)) {
    fs.mkdirSync(writingImportDir, { recursive: true });
  }
}

function importOne(htmlPath) {
  const absolutePath = path.resolve(process.cwd(), htmlPath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Source file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  if (!raw || raw.trim().length === 0) {
    fail(`Source HTML file is empty: ${absolutePath}`);
  }
  const data = extractBlogDataObject(raw);

  const post = data.post || {};
  const meta = buildMetaMap(data.head && data.head.meta);

  const title = safeText(post.title || meta['og:title'] || path.parse(absolutePath).name);
  const slug = slugify(post.slug || title);
  const dateIso = safeText((post.publishedDate || post.date || '').slice(0, 10)) || '2026-01-01';
  const date = friendlyDate(dateIso);
  const ogDescription = safeText(meta['og:description'] || post.content || '').replace(/\.\.\.$/, '');

  const bodyFromDraft = draftJsToMarkdown(post.fullContent);
  const fallbackBody = safeText(post.content || ogDescription);
  const body = bodyFromDraft || fallbackBody;

  const excerpt = (ogDescription || fallbackBody || title).slice(0, 220);
  const imageAlt = safeText(meta['twitter:image:alt'] || title);

  const imageResult = chooseLocalImage(absolutePath, slug);
  const imagePath = imageResult.imageRelativePath || './extracted-images/placeholder-writing-image.webp';

  const article = {
    title,
    slug,
    date,
    dateIso,
    category: 'Coaching',
    readTime: estimateReadTime(body),
    excerpt,
    ogDescription: ogDescription || excerpt,
    imagePath,
    imageAlt,
    body,
  };

  ensureWritingImportDir();
  const outputPath = path.join(writingImportDir, `${slug}.md`);
  fs.writeFileSync(outputPath, renderMarkdownFile(article), 'utf8');

  console.log(`Imported: ${path.relative(root, absolutePath)}`);
  console.log(`Created: ${path.relative(root, outputPath)}`);
  console.log(`Image: ${imageResult.note}`);
  console.log(`Next: node scripts/publish-writing-article.js --source ${path.relative(root, outputPath)}`);
  console.log('');
}

function importDirectory(dirPath) {
  const absoluteDir = path.resolve(process.cwd(), dirPath);
  if (!fs.existsSync(absoluteDir)) {
    fail(`Directory not found: ${absoluteDir}`);
  }

  const htmlFiles = fs.readdirSync(absoluteDir)
    .filter((name) => name.toLowerCase().endsWith('.html'))
    .map((name) => path.join(absoluteDir, name))
    .sort();

  if (htmlFiles.length === 0) {
    fail('No .html files found in directory.');
  }

  htmlFiles.forEach((filePath) => importOne(filePath));
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.source && !args.dir) {
    fail('Usage: node scripts/import-legacy-blog-html.js --source "Blog Import/1.html" OR --dir "Blog Import"');
  }

  if (args.source && args.dir) {
    fail('Use either --source or --dir, not both.');
  }

  if (args.source) {
    importOne(args.source);
    return;
  }

  importDirectory(args.dir);
}

main();
