@README.md

# Notes for Claude

- Pushing to `main` publishes the live site within a minute or two, so get the site owner's OK before every push.
- There's no build step: the pages are plain HTML, and all the comment logic is in `comments.js` and `api/comments.js`.
- Node.js isn't installed on the site owner's PC. To test `api/comments.js`, run it under any Node 20+ with `@neondatabase/serverless` mocked out. Real comments can only be tested on the live site.
- Commits use the GitHub account's noreply email, set in this clone's local git config.
