import re

with open('crawford-writing.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Add CSS for view-all button ──────────────────────────────────────────
css_add = """
.view-all-wrap {
  text-align: center;
  padding: 1.5rem 0 0.5rem;
}
.view-all-btn {
  display: inline-block;
  font-family: var(--sans);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--pale);
  text-decoration: none;
  border: 1px solid rgba(245,243,239,0.3);
  padding: 0.75rem 2rem;
  transition: background 0.25s, border-color 0.25s;
}
.view-all-btn:hover {
  background: rgba(245,243,239,0.08);
  border-color: rgba(245,243,239,0.7);
}

"""
content = content.replace('\n@media (max-width: 1024px) {', css_add + '\n@media (max-width: 1024px) {', 1)

# ── 2. Reorder JSON-LD blogPost array (newest → oldest) ────────────────────
JSONLD_NEW = """{
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "Crawford Coaching Writing",
  "url": "https://crawford-coaching.ca/writing",
  "description": "Essays on coaching, fitness, resilience, and behavior change.",
  "publisher": {
    "@type": "Organization",
    "name": "Crawford Coaching"
  },
  "blogPost": [
    {"@type":"BlogPosting","headline":"15. Becoming a Snacker","url":"https://crawford-coaching.ca/writing/15-becoming-a-snacker","datePublished":"2026-03-27","image":"https://crawford-coaching.ca/extracted-images/writing-15-becoming-a-snacker.webp"},
    {"@type":"BlogPosting","headline":"14. A Failed Tactic Is Not A Failed Strategy","url":"https://crawford-coaching.ca/writing/14-a-failed-tactic-is-not-a-failed-strategy","datePublished":"2026-03-11","image":"https://crawford-coaching.ca/extracted-images/writing-14-a-failed-tactic-is-not-a-failed-strategy.webp"},
    {"@type":"BlogPosting","headline":"13. The Quiet Side","url":"https://crawford-coaching.ca/writing/13-the-quiet-side","datePublished":"2026-02-26","image":"https://crawford-coaching.ca/extracted-images/writing-13-the-quiet-side.webp"},
    {"@type":"BlogPosting","headline":"12. The Price Of Being Right At Any Cost","url":"https://crawford-coaching.ca/writing/12-the-price-of-being-right-at-any-cost","datePublished":"2026-02-06","image":"https://crawford-coaching.ca/extracted-images/writing-12-the-price-of-being-right-at-any-cost.webp"},
    {"@type":"BlogPosting","headline":"11. Interrupted Training - the Art of Coming Back Well","url":"https://crawford-coaching.ca/writing/11-interrupted-training-the-art-of-coming-back-well","datePublished":"2026-01-21","image":"https://crawford-coaching.ca/extracted-images/writing-11-interrupted-training-the-art-of-coming-back-well.webp"},
    {"@type":"BlogPosting","headline":"10. New Year, New Start?","url":"https://crawford-coaching.ca/writing/10-new-year-new-start","datePublished":"2025-12-31","image":"https://crawford-coaching.ca/extracted-images/writing-10-new-year-new-start.webp"},
    {"@type":"BlogPosting","headline":"9. Holiday Balance - Letting the Holidays Be Messy","url":"https://crawford-coaching.ca/writing/9-letting-the-holidays-be-messy","datePublished":"2025-12-19","image":"https://crawford-coaching.ca/extracted-images/writing-9-letting-the-holidays-be-messy.webp"},
    {"@type":"BlogPosting","headline":"8. The Paradox of Happiness","url":"https://crawford-coaching.ca/writing/8-the-paradox-of-happiness","datePublished":"2025-12-03","image":"https://crawford-coaching.ca/extracted-images/writing-8-the-paradox-of-happiness.webp"},
    {"@type":"BlogPosting","headline":"7. Feed the Fire; Don't Starve The Flame","url":"https://crawford-coaching.ca/writing/7-feed-the-fire-dont-starve-the-flame","datePublished":"2025-09-16","image":"https://crawford-coaching.ca/extracted-images/writing-7-feed-the-fire-dont-starve-the-flame.webp"},
    {"@type":"BlogPosting","headline":"6. The Problem With Advice","url":"https://crawford-coaching.ca/writing/6-the-problem-with-advice","datePublished":"2025-08-27","image":"https://crawford-coaching.ca/extracted-images/writing-6-the-problem-with-advice.webp"},
    {"@type":"BlogPosting","headline":"5. Requisition Form: Muscle Edition","url":"https://crawford-coaching.ca/writing/5-requisition-form-muscle-edition","datePublished":"2025-08-25","image":"https://crawford-coaching.ca/extracted-images/writing-5-requisition-form-muscle-edition.webp"},
    {"@type":"BlogPosting","headline":"4. The Power Of The Pack","url":"https://crawford-coaching.ca/writing/4-the-power-of-the-pack","datePublished":"2025-08-25","image":"https://crawford-coaching.ca/extracted-images/writing-4-the-power-of-the-pack.webp"},
    {"@type":"BlogPosting","headline":"3. There\u2019s So Much More To Cardio!","url":"https://crawford-coaching.ca/writing/3-theree28099s-so-much-more-to-cardio","datePublished":"2025-08-25","image":"https://crawford-coaching.ca/extracted-images/writing-3-theree28099s-so-much-more-to-cardio.webp"},
    {"@type":"BlogPosting","headline":"2. Don\u2019t Wait for the Proof","url":"https://crawford-coaching.ca/writing/2-dont-wait-for-the-proof","datePublished":"2025-08-25","image":"https://crawford-coaching.ca/extracted-images/writing-2-dont-wait-for-the-proof.webp"},
    {"@type":"BlogPosting","headline":"1. The Need Beneath the Want","url":"https://crawford-coaching.ca/writing/1-the-need-beneath-the-want","datePublished":"2025-08-25","image":"https://crawford-coaching.ca/extracted-images/writing-1-need-beneath-the-want.webp"}
  ]
}"""

# Find and replace the JSON-LD block
jl_start = content.find('<script type="application/ld+json">')
jl_end = content.find('</script>', jl_start) + len('</script>')
content = content[:jl_start] + '<script type="application/ld+json">\n' + JSONLD_NEW + '\n</script>' + content[jl_end:]

# ── 3. Replace post-list section ────────────────────────────────────────────
LI = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
FB = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>'
EM = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h20v16H2V4zm2 2v.54l8 5.33 8-5.33V6H4zm16 12V8.94l-8 5.33-8-5.33V18h16z"/></svg>'

def share_pill(slug, title_enc, label):
    base = 'https://crawford-coaching.ca/writing/'
    url_enc = 'https%3A%2F%2Fcrawford-coaching.ca%2Fwriting%2F' + slug
    return f'''          <div class="share-pill" aria-label="Share options">
            <span class="share-pill__label">Share</span>
            <a class="share-pill__icon" href="https://www.linkedin.com/sharing/share-offsite/?url={url_enc}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">
              {LI}
              <span class="share-pill__tooltip">LinkedIn</span>
            </a>
            <a class="share-pill__icon" href="https://www.facebook.com/sharer/sharer.php?u={url_enc}" target="_blank" rel="noopener" aria-label="Share on Facebook">
              {FB}
              <span class="share-pill__tooltip">Facebook</span>
            </a>
            <a class="share-pill__icon" href="mailto:?subject={title_enc}&body={url_enc}" aria-label="Share by Email">
              {EM}
              <span class="share-pill__tooltip">Email</span>
            </a>
          </div>'''

def tag_chips(tags_csv):
    chips = ''
    for t in tags_csv.split(','):
        chips += f'\n          <button type="button" class="tag-chip" data-tag="{t}">{t}</button>'
    return chips

def article_card(slug, title, date_str, read_time, img, excerpt, tags_csv, aria_label):
    return f'''    <article class="post-card" data-tags="{tags_csv}">
      <a class="post-card__image" href="/writing/{slug}" aria-label="Read: {aria_label}">
        <img src="./extracted-images/{img}" alt="Blog thumbnail for {aria_label}">
      </a>
      <div class="post-card__content">
        <p class="post-card__meta">
          <span>{date_str}</span>
          <span>{read_time}</span>
          <span>Coaching</span>
        </p>
        <h3><a href="/writing/{slug}">{title}</a></h3>
        <p>{excerpt}</p>
        <div class="post-card__actions">
          <a class="post-card__read" href="/writing/{slug}">Read</a>
{share_pill(slug, aria_label.replace(' ','%20').replace(',','%2C').replace("'","%27").replace(':','%3A').replace('?','%3F').replace('!','%21'), aria_label)}
        </div>
        <div class="post-card__tags" aria-label="Keywords">{tag_chips(tags_csv)}
        </div>
      </div>
    </article>'''

new_section = '''  <section class="post-list" aria-label="Blog posts">
''' + article_card(
    '15-becoming-a-snacker', '15. Becoming a Snacker', 'Mar 26, 2026', '10 min read',
    'writing-15-becoming-a-snacker.webp', 'by Scott Crawford',
    'nutrition,habits,fitness,behaviour-change', '15. Becoming a Snacker') + '''

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
    </section>

''' + article_card(
    '14-a-failed-tactic-is-not-a-failed-strategy',
    '14. A Failed Tactic Is Not A Failed Strategy', 'Mar 10, 2026', '10 min read',
    'writing-14-a-failed-tactic-is-not-a-failed-strategy.webp', 'by Scott Crawford',
    'mindset,resilience,strategy,coaching',
    '14. A Failed Tactic Is Not A Failed Strategy') + '''

''' + article_card(
    '13-the-quiet-side', '13. The Quiet Side', 'Feb 25, 2026', '9 min read',
    'writing-13-the-quiet-side.webp', 'By Scott Crawford',
    'mindset,resilience,identity,coaching', '13. The Quiet Side') + '''

    <div class="view-all-wrap">
      <a href="/writing/all" class="view-all-btn">View All 15 Articles &rarr;</a>
    </div>
  </section>'''

# Find section boundaries
sec_start = content.find('  <section class="post-list"')
aside_start = content.find('  <aside class="sidebar"')
sec_end = content.rfind('</section>', sec_start, aside_start) + len('</section>')

content = content[:sec_start] + new_section + '\n\n' + content[sec_end:]

with open('crawford-writing.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done: crawford-writing.html updated')
