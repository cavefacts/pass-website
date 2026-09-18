# Pass website

The reading site for *Pass*, a novel by Duncan Sabien: <https://pass-website.vercel.app>

It's plain HTML and CSS with no build step, plus one small serverless function that handles reader comments.

## Where it lives

- **Code:** GitHub, [cavefacts/pass-website](https://github.com/cavefacts/pass-website). Every push to `main` goes live automatically within a minute or two.
- **Hosting:** Vercel project `pass-website` ([dashboard](https://vercel.com/sophie-ricketts-projects/pass-website)).
- **Database:** Neon Postgres, connected to the Vercel project from its Storage tab. The comments table sets itself up on first use.
- **Settings** ([environment variables](https://vercel.com/sophie-ricketts-projects/pass-website/settings/environment-variables)):
  - `DATABASE_URL`, `POSTGRES_URL` and similar: added automatically when the database was connected.
  - `ADMIN_KEY`: the author's secret key for author mode.
  - A changed setting only takes effect after the next deploy.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Home page: title, dedication, The Rules and the Prologue |
| `contents.html`, `foreword.html`, `chapter-1.html` … `chapter-20.html`, `epilogue.html` | The book |
| `prologue.html`, `rules.html` | Old addresses that redirect to the home page |
| `style.css` | All styling, including the styled passages (epigraphs, text messages, journal entries, signs) |
| `comments.js` | Comments section, tip button and author mode; loaded on every reading page |
| `api/comments.js` | The comments API (a Vercel serverless function) |
| `package.json` | The database library the API uses; Vercel installs it |
| `Dockerfile`, `docker-compose.yml` | An old local preview setup. Vercel ignores them, and comments don't work in it |

The chapter pages were generated from the manuscript by a script of Moshe's (`build_site.py`) that isn't in this repo. Edit the HTML directly, or get the script from Moshe first. Regenerating the pages would overwrite any direct edits.

## Comments

- Each reading page has a `<div class="comments-section" data-chapter="...">`, which `comments.js` fills in.
- **Author mode:** add `?admin` to the end of a page's address and enter the admin key. The browser remembers it until "Exit admin mode" is clicked. The author's comments get an "Author" badge, and the author can delete any comment.
- **Spam protection** (applies to readers, not the author):
  - a hidden field that only bots fill in;
  - at most 2 links per comment, and none in names;
  - at most 5 comments per visitor, and 30 from everyone, in any 10 minutes.

  Visitors are told apart by IP address, which is stored only as a salted hash. The limits are at the top of `api/comments.js`.

## History

- **June 2026:** Moshe built the site with Claude Code. The first version went on GitHub on June 29.
- **August 2026:** Moshe added comments, the tip button and author mode.
- **September 2026:** The August version went live with the Neon database. Author mode now asks for the key instead of reading it from the address, because keys containing `+` or `%` broke. The API switched to Neon's own database library, since `@vercel/postgres` is deprecated, and gained spam protection.

## Not done yet

- There's no favicon, and no description or preview image for when links are shared.
- `style.css` has styles for a downloads box that no page uses.
- Deleting a comment sends the admin key in the request address, so it can appear in Vercel's request logs, which only project members can see.
- The repo is public, so the full text can be downloaded from GitHub. Making it private wouldn't affect the site.
