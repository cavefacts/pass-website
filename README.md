# Pass website

The reading site for *Pass*, a novel by Duncan Sabien: <https://passnovel.com> (also still reachable at <https://pass-website.vercel.app>)

It's plain HTML and CSS with no build step, plus one small serverless function that handles reader comments.

## Where it lives

- **Code:** GitHub, [cavefacts/pass-website](https://github.com/cavefacts/pass-website). Every push to `main` goes live automatically within a minute or two.
- **Domain:** `passnovel.com`, registered at Squarespace, with its DNS records pointing at Vercel.
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
| `rules.png` | "The Rules" hand-lettered graphic shown on the home page, recolored to the site's palette (orange rule numbers, light grey title and text) from a drawing supplied by the site owner |
| `contents.html`, `foreword.html`, `chapter-1.html`, `chapter-2.html`, `chapter-3.html`, `chapter-4.html`, `chapter-5.html`, `chapter-6.html`, `chapter-7.html`, `chapter-8.html`, `chapter-9.html`, `chapter-10.html`, `chapter-11.html`, `chapter-12.html`, `chapter-13.html`, `chapter-14.html`, `chapter-15.html`, `chapter-16.html`, `chapter-17.html`, `chapter-18.html`, `chapter-19.html`, `chapter-20.html`, `chapter-21.html`, `epilogue.html` | The whole book (see "Publishing history" below) |
| `prologue.html`, `rules.html` | Old addresses that redirect to the home page |
| `feed.xml` | The RSS feed, with one item per published chapter, newest first. Every reading page links to it from its `<head>`. It's written by hand |
| `pass.epub` | The whole novel as an EPUB e-book, supplied by the site owner. Linked as "EPUB" in the header bar of every reading page, next to "RSS" (which links to `feed.xml`). To update it, replace the file and keep the name |
| `style.css` | All styling, including the styled passages (epigraphs, text messages, journal entries, signs, and Ms. Palmano's writing on the board, `class="palmano"`). That writing is centered and in Permanent Marker; board writing in two columns uses `<div class="palmano palmano-columns">` with one `<span>` per cell. Ashleigh's blocky capitals (`class="ashleigh-capitals"`) show in Architects Daughter. Text-message conversations are chat bubbles: `<div class="texts">` with one `<p class="in">` (received, left) or `<p class="out">` (sent by Conor, right) per message. Handwritten bullet lists add `list-item` to the class, and the coupon and the math equation in Chapter 12 use `class="coupon"` and `class="math"` |
| `smile.png` | The smiley face in two text messages (Chapters 10 and 12), taken from the EPUB |
| `fonts/MoretonSmartFont.otf` | Moreton, the author's handwriting font, used only for Conor's handwriting (paragraphs with `class="journal-entry conor"`). Other characters' handwritten notes use `class="journal-entry"` alone and show in Caveat |
| `fonts/IAmTheCrayonMaster.ttf` | I Am The Crayon Master by Alice Butler, used only for Conor's wrong-hand writing (`class="journal-entry scrawl"`). Downloaded from dafont.com, where it's listed as "100% Free"; it came with no ReadMe or license file |
| `comments.js` | Comments section, tip button and author mode; loaded on every reading page |
| `api/comments.js` | The comments API (a Vercel serverless function) |
| `package.json` | The database library the API uses; Vercel installs it |
| `favicon.ico`, `apple-touch-icon.png` | The site icon, for browser tabs and Apple home screens |
| `og-image.png` | The picture shown when someone shares a link to the site |
| `tools/make-images.ps1` | Draws those three images. Re-run it after changing their design (Windows only) |
| `Dockerfile`, `docker-compose.yml` | An old local preview setup. Vercel ignores them, and comments don't work in it |

Every reading page's `<head>` has link-preview tags (a title, description and image) that point at `https://passnovel.com/og-image.png`. If the domain changes, update that address on every page.

The chapter pages were generated from the manuscript by a script of Moshe's (`build_site.py`) that isn't in this repo. Edit the HTML directly, or get the script from Moshe first. Regenerating the pages would overwrite any direct edits.

## Publishing history

The site soft-launched in September 2026 with only the Foreword, the Rules/Prologue and Chapter 1. Chapters 2 and 3 were added in October 2026, converted from the author's revised Word files rather than restored from git history, and Chapters 4 and 5 followed later that month, converted from the full manuscript (`Pass (for printing).docx`). Chapters 6, 7 and 8 were added on October 29, also converted from the manuscript. Chapters 9 to 13 were added on November 6, converted from the EPUB's chapter files (its text matches the manuscript word for word, and it already marks text messages and handwriting). Chapters 14 to 19 were added on November 20, converted from the EPUB the same way. Chapters 20 and 21 and the Epilogue were added on November 26, also from the EPUB, which completed the book; the "more chapters soon" notes on Chapter 19 and the Contents page were removed then. (Older drafts of `chapter-20.html`, `chapter-21.html` and `epilogue.html` from before the soft launch are in git history, but they differ a lot from the final text.)

When converting from the EPUB: Conor's handwritten notes get `class="journal-entry conor"` so they show in his font. Where the EPUB has Conor writing with his wrong hand (`class="hand scrawl"`), use `class="journal-entry scrawl"` instead, which shows in I Am The Crayon Master (`fonts/IAmTheCrayonMaster.ttf`); Mrs. Haynes-Hornaday's name on the board (Chapter 14) uses `class="nameplate"`, in Meddon (slanted, formal penmanship). If the text of a chapter ever changes, edit its page directly, and if a page is added, add it to `contents.html`, to both `<select>` menus on every reading page, and to `feed.xml`.

## Comments

- Each reading page has a `<div class="comments-section" data-chapter="...">`, which `comments.js` fills in.
- **Replies:** every comment has a Reply link. Replies are indented up to three levels; replies deeper than that line up with the third level and say who they're answering. Each reply stores the comment it answers in the `parent_id` column, which the API adds to the table by itself (existing comments are untouched and stay top-level). Deleting a comment keeps its replies and moves them up a level.
- **Author mode:** add `?admin` to the end of a page's address and enter the admin key. The browser remembers it until "Exit admin mode" is clicked. The author's comments get an "Author" badge, and the author can delete any comment.
- **Spam protection** (applies to readers, not the author):
  - a hidden field that only bots fill in;
  - at most 2 links per comment, and none in names;
  - at most 5 comments per visitor, and 30 from everyone, in any 10 minutes.

  Visitors are told apart by IP address, which is stored only as a salted hash. The limits are at the top of `api/comments.js`.

## History

- **June 2026:** Moshe built the site with Claude Code. The first version went on GitHub on June 29.
- **August 2026:** Moshe added comments, the tip button and author mode.
- **September 2026:** The August version went live with the Neon database. Author mode now asks for the key instead of reading it from the address, because keys containing `+` or `%` broke. The API switched to Neon's own database library, since `@vercel/postgres` is deprecated, and gained spam protection. The site got an icon and a link preview image.

## Not done yet

- `style.css` has styles for a downloads box that no page uses.
- Deleting a comment sends the admin key in the request address, so it can appear in Vercel's request logs, which only project members can see.
- The repo is public, so the full text can be downloaded from GitHub. Making it private wouldn't affect the site.
