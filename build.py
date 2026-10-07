#!/usr/bin/env python3
"""Build the site.

Reads   src/ (layout + pages), content/posts/*.md, assets/
Writes  index.html, projects/, cv/, blog/, 404.html, sitemap.xml, feed.xml, robots.txt

Run:    pip install -r requirements.txt && python build.py
Check:  python build.py --check     (validates posts, writes nothing)

The generated files are committed, because GitHub Pages serves this repo's
root as-is. fintech_dashboard.html is not touched by this script.
"""
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import shutil
import sys
from email.utils import format_datetime

import markdown
import yaml

ROOT = pathlib.Path(__file__).resolve().parent
SITE_URL = "https://fintech.pelicanx.in"
AUTHOR = "Kohinoor Mukherjee"
LINKEDIN = "https://www.linkedin.com/in/kohinoor-mukherjee419/"
DEFAULT_COVER = "/assets/img/covers/default.svg"
WORDS_PER_MINUTE = 220

POST_KEYS = {"title", "description", "category", "date", "updated", "cover", "order", "draft"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ARROW = ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M5 12h13"></path><path d="M12 5l7 7-7 7"></path></svg>')

errors, warnings = [], []
esc = lambda s: html.escape(str(s), quote=True)


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def fill(template, **values):
    """Replace {{name}} placeholders. Unknown placeholders are a bug, so fail."""
    def sub(m):
        return str(values[m.group(1)])
    return re.sub(r"\{\{(\w+)\}\}", sub, template)


def version(rel):
    return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]


def as_date(value, where, key):
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    try:
        return dt.date.fromisoformat(str(value))
    except ValueError:
        errors.append(f"{where}: '{key}' must be a date like 2026-10-07, got {value!r}")
        return None


# ------------------------------------------------------------------ posts

def load_posts():
    posts = []
    for path in sorted((ROOT / "content" / "posts").glob("*.md")):
        where = f"content/posts/{path.name}"
        slug = path.stem
        if not SLUG_RE.match(slug):
            errors.append(f"{where}: file name must be lowercase-words-with-hyphens.md")
            continue

        text = path.read_text(encoding="utf-8")
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.S)
        if not m:
            errors.append(f"{where}: missing the '---' front-matter block at the top")
            continue
        try:
            meta = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError as e:
            errors.append(f"{where}: front matter is not valid YAML ({e})")
            continue
        body_md = m.group(2).strip()

        for key in set(meta) - POST_KEYS:
            warnings.append(f"{where}: unknown front-matter key '{key}' is ignored")
        for key in ("title", "description", "category"):
            if not str(meta.get(key) or "").strip():
                errors.append(f"{where}: '{key}' is required")
        if meta.get("draft"):
            continue

        description = str(meta.get("description") or "").strip()
        if len(description) > 160:
            warnings.append(f"{where}: description is {len(description)} characters; search results cut off near 160")
        if not body_md:
            errors.append(f"{where}: the post has no body")

        cover = str(meta.get("cover") or DEFAULT_COVER)
        if cover.startswith("/") and not (ROOT / cover.lstrip("/")).is_file():
            errors.append(f"{where}: cover file {cover} does not exist")

        md = markdown.Markdown(extensions=["extra", "sane_lists", "toc"], output_format="html")
        body = md.convert(body_md)
        if re.search(r"<h1[\s>]", body):
            errors.append(f"{where}: don't use a '# ' heading in the body; the title is the page's only H1. Start at '## '")
        body = body.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
        body = re.sub(r'<a href="(https?://)', r'<a target="_blank" rel="noopener noreferrer" href="\1', body)

        words = len(re.findall(r"\w+", re.sub(r"<[^>]+>", " ", body)))
        posts.append({
            "slug": slug,
            "url": f"/blog/{slug}/",
            "title": str(meta.get("title") or "").strip(),
            "description": description,
            "category": str(meta.get("category") or "").strip(),
            "date": as_date(meta.get("date"), where, "date"),
            "updated": as_date(meta.get("updated"), where, "updated"),
            "cover": cover,
            "order": meta.get("order") if isinstance(meta.get("order"), int) else 10**6,
            "body": body,
            "minutes": max(1, round(words / WORDS_PER_MINUTE)),
        })

    # Dated posts first, newest on top; undated ones after, in their 'order'.
    dated = sorted((p for p in posts if p["date"]), key=lambda p: (p["date"], p["slug"]), reverse=True)
    undated = sorted((p for p in posts if not p["date"]), key=lambda p: (p["order"], p["slug"]))
    return dated + undated


def human(date):
    return f"{date.day} {date.strftime('%b %Y')}"


# ------------------------------------------------------------------ pages

def render(layout, *, path, title, description, content, nav="", og_type="website",
           og_title=None, image=None, json_ld=None):
    canonical = SITE_URL + path
    og_image = ""
    if image and not image.endswith(".svg"):  # social cards don't render SVG
        og_image = (f'<meta property="og:image" content="{esc(SITE_URL + image)}">\n'
                    '<meta name="twitter:card" content="summary_large_image">')
    else:
        og_image = '<meta name="twitter:card" content="summary">'
    ld = ""
    if json_ld:
        ld = ('<script type="application/ld+json">'
              + json.dumps(json_ld, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    current = ' aria-current="page"'
    return fill(
        layout,
        title=esc(title), description=esc(description), canonical=esc(canonical),
        og_type=og_type, og_title=esc(og_title or title), og_image=og_image, json_ld=ld,
        css_v=version("assets/css/site.css"), js_v=version("assets/js/site.js"),
        nav_home=current if nav == "home" else "", nav_projects=current if nav == "projects" else "",
        nav_blog=current if nav == "blog" else "", nav_cv=current if nav == "cv" else "",
        content=content,
    )


def post_card(p):
    return f"""        <a class="tile post-card" href="{p['url']}">
          <img class="cover" src="{esc(p['cover'])}" alt="" width="800" height="450" loading="lazy">
          <span class="tile__kicker">{esc(p['category'])}</span>
          <h2 class="post-card__title">{esc(p['title'])}</h2>
          <p class="post-card__desc">{esc(p['description'])}</p>
          <span class="read-more">
            Read the post
            {ARROW}
          </span>
        </a>
"""


def post_page(layout, template, p, nxt):
    meta = f"{p['minutes']} min read"
    if p["date"]:
        meta = f'<time datetime="{p["date"].isoformat()}">{human(p["date"])}</time> &middot; ' + meta
        if p["updated"] and p["updated"] > p["date"]:
            meta += f' &middot; Updated <time datetime="{p["updated"].isoformat()}">{human(p["updated"])}</time>'
    next_html = ""
    if nxt:
        next_html = f"""
      <nav class="article__foot" aria-label="More writing">
        <a class="article__next" href="{nxt['url']}">
          <span class="mono">Next</span>
          <span>{esc(nxt['title'])}</span>
          {ARROW}
        </a>
      </nav>"""
    content = fill(template, category=esc(p["category"]), title=esc(p["title"]),
                   description=esc(p["description"]), meta=meta, cover=esc(p["cover"]),
                   body=p["body"], next=next_html)
    ld = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": p["title"], "description": p["description"],
        "articleSection": p["category"],
        "author": {"@type": "Person", "name": AUTHOR, "url": SITE_URL + "/"},
        "mainEntityOfPage": SITE_URL + p["url"],
        "image": SITE_URL + p["cover"],
    }
    if p["date"]:
        ld["datePublished"] = p["date"].isoformat()
        ld["dateModified"] = (p["updated"] or p["date"]).isoformat()
    return render(layout, path=p["url"], title=f"{p['title']} — {AUTHOR}", og_title=p["title"],
                  description=p["description"], content=content, nav="blog",
                  og_type="article", image=p["cover"], json_ld=ld)


def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def build(posts):
    layout = read("src/layout.html")

    for folder in ("blog", "projects", "cv"):  # generated folders: start clean
        shutil.rmtree(ROOT / folder, ignore_errors=True)

    write("index.html", render(
        layout, path="/", nav="home",
        title=f"{AUTHOR} — Product manager, fintech",
        description="Product manager for fintech. Two years owning the web trading platform at Angel One; "
                    "now building in fintech and reading history.",
        content=read("src/pages/home.html"), image="/assets/img/portrait.jpg",
        json_ld={"@context": "https://schema.org", "@type": "Person", "name": AUTHOR,
                 "url": SITE_URL + "/", "jobTitle": "Product manager",
                 "image": SITE_URL + "/assets/img/portrait.jpg", "sameAs": [LINKEDIN]}))

    write("projects/index.html", render(
        layout, path="/projects/", nav="projects", title=f"My Projects — {AUTHOR}",
        description="Things I built, and what each one taught me: the problem, what I shipped, "
                    "and what I'd do differently.",
        content=read("src/pages/projects.html")))

    write("cv/index.html", render(
        layout, path="/cv/", nav="cv", title=f"CV — {AUTHOR}",
        description=f"{AUTHOR}'s one-page CV. Product manager, fintech.",
        content=read("src/pages/cv.html")))

    cards = "\n".join(post_card(p) for p in posts) or '        <p class="empty-note">Nothing published yet.</p>\n'
    write("blog/index.html", render(
        layout, path="/blog/", nav="blog", title=f"My Writings — {AUTHOR}",
        description="Notes on fintech and on building product, by Kohinoor Mukherjee.",
        content=fill(read("src/blog-index.html"), cards=cards),
        json_ld={"@context": "https://schema.org", "@type": "Blog", "name": f"{AUTHOR} — Writing",
                 "url": SITE_URL + "/blog/", "author": {"@type": "Person", "name": AUTHOR}}))

    template = read("src/post.html")
    for i, p in enumerate(posts):
        nxt = posts[(i + 1) % len(posts)] if len(posts) > 1 else None
        write(f"blog/{p['slug']}/index.html", post_page(layout, template, p, nxt))

    write("404.html", render(
        layout, path="/404.html", title=f"Page not found — {AUTHOR}",
        description="That page doesn't exist.",
        content="""  <section class="page-head">
    <div class="wrap page-head__inner">
      <div class="page-head__text">
        <p class="mono mono--accent">404</p>
        <h1>That page doesn't exist</h1>
        <p>It may have moved. <a href="/">Go to the home page</a> or <a href="/blog/">read the writing</a>.</p>
      </div>
    </div>
  </section>"""))

    # ---- sitemap, robots, feed
    urls = [("/", None), ("/projects/", None), ("/blog/", None), ("/cv/", None),
            ("/fintech_dashboard.html", None)]
    urls += [(p["url"], p["updated"] or p["date"]) for p in posts]
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, mod in urls:
        lastmod = f"<lastmod>{mod.isoformat()}</lastmod>" if mod else ""
        sitemap.append(f"  <url><loc>{esc(SITE_URL + path)}</loc>{lastmod}</url>")
    write("sitemap.xml", "\n".join(sitemap + ["</urlset>"]) + "\n")

    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")

    items = []
    for p in posts:
        pub = ""
        if p["date"]:
            stamp = dt.datetime.combine(p["date"], dt.time(), dt.timezone.utc)
            pub = f"\n      <pubDate>{format_datetime(stamp)}</pubDate>"
        link = esc(SITE_URL + p["url"])
        items.append(f"""    <item>
      <title>{esc(p['title'])}</title>
      <link>{link}</link>
      <guid>{link}</guid>
      <category>{esc(p['category'])}</category>{pub}
      <description>{esc(p['description'])}</description>
    </item>""")
    write("feed.xml", f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{esc(AUTHOR)} — Writing</title>
    <link>{SITE_URL}/blog/</link>
    <description>Notes on fintech and on building product.</description>
    <language>en</language>
{chr(10).join(items)}
  </channel>
</rss>
""")


def main():
    check_only = "--check" in sys.argv
    posts = load_posts()
    for w in warnings:
        print("warning:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)
    if check_only:
        print(f"ok: {len(posts)} posts are valid")
        return
    build(posts)
    print(f"built: {len(posts)} posts")


if __name__ == "__main__":
    main()
