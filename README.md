# fintech.pelicanx.in

Kohinoor Mukherjee's site: About Me (home), projects, writing, CV, and the India fintech dashboard.
Hosted on GitHub Pages from the root of `main`.

## Publish a blog post

Add one markdown file to `content/posts/`. The file name becomes the URL:
`content/posts/upi-lite-limits.md` is published at `/blog/upi-lite-limits/`.

```markdown
---
title: "Why UPI Lite limits went up"
description: "One or two sentences, under 160 characters. Shown on the card and in search results."
category: Payments
date: 2026-10-07
---
First paragraph.

## A section heading

More text, lists, tables, quotes, links and footnotes all work.
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Quote it. It is the page's only H1, so start body headings at `##`. |
| `description` | yes | Under 160 characters. |
| `category` | yes | One or two words: Payments, Lending, WealthTech, Product. |
| `date` | for new posts | `YYYY-MM-DD`. Dated posts are listed newest first. |
| `updated` | no | `YYYY-MM-DD`, when a post is revised. |
| `cover` | no | Path to an 800x450 image in `assets/img/covers/`. A default is used if absent. |
| `draft` | no | `true` keeps the post out of the site. |

Push to `main` (or merge a pull request) and the workflow in `.github/workflows/build.yml`
rebuilds the pages. On a pull request it only validates the posts and fails if one is invalid.

## Build locally

```
pip install -r requirements.txt
python build.py            # rebuild every page
python build.py --check    # validate posts only
python -m http.server      # preview at http://localhost:8000
```

## What is where

| Path | What it is |
|---|---|
| `content/posts/*.md` | Blog posts. Edit these. |
| `src/layout.html` | Header, navigation, footer and `<head>` shared by every page. |
| `src/pages/` | Body of the home, projects and CV pages. |
| `src/blog-index.html`, `src/post.html` | Templates for the writing list and a single post. |
| `assets/` | Stylesheet, script, images and the CV PDF. |
| `build.py` | Generates everything below. |
| `index.html`, `projects/`, `blog/`, `cv/`, `404.html`, `sitemap.xml`, `feed.xml`, `robots.txt` | Generated. Do not edit by hand. |
| `fintech_dashboard.html` | The dashboard. Standalone, not touched by the build. |
