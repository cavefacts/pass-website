const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

// Spam limits for readers' comments; the author's own comments skip them.
const MAX_LINKS = 2; // links allowed in one comment
const MAX_PER_VISITOR = 5; // comments from one IP address in 10 minutes
const MAX_SITE_WIDE = 30; // comments from everyone in 10 minutes

let tableReady;

// Set up the table once per server instance rather than on every request.
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          chapter_slug VARCHAR(50) NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          comment_text TEXT NOT NULL,
          is_author BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_comments_chapter
        ON comments(chapter_slug)
      `;
      await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_author BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64)`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

function isAdmin(key) {
  return Boolean(key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
}

function countLinks(s) {
  return (s.match(/https?:\/\/\S+|www\.\S+/gi) || []).length;
}

// Tells visitors apart for rate limiting. Only a salted hash of the IP
// address is stored, never the address itself.
function visitorHash(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = req.headers["x-real-ip"] || forwarded;
  return crypto
    .createHash("sha256")
    .update(`${process.env.ADMIN_KEY || ""}|${ip}`)
    .digest("hex");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await ensureTable();

    if (req.method === "GET") {
      const chapter = req.query.chapter;
      if (!chapter || !/^[a-z0-9-]+$/.test(chapter)) {
        return res.status(400).json({ error: "Invalid chapter slug" });
      }

      const rows = await sql`
        SELECT id, author_name, comment_text, is_author, created_at
        FROM comments
        WHERE chapter_slug = ${chapter}
        ORDER BY created_at ASC
      `;

      return res.status(200).json({ comments: rows });
    }

    if (req.method === "POST") {
      const { chapter, name, text, admin_key, website } = req.body || {};

      if (!chapter || !/^[a-z0-9-]+$/.test(chapter)) {
        return res.status(400).json({ error: "Invalid chapter slug" });
      }
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
        return res.status(400).json({ error: "Name is required (max 100 chars)" });
      }
      if (typeof text !== "string" || text.trim().length === 0 || text.length > 5000) {
        return res.status(400).json({ error: "Comment is required (max 5000 chars)" });
      }
      // A hidden form field that people never see but form-filling bots fill in.
      if (website) {
        return res.status(400).json({ error: "Comment rejected as possible spam" });
      }

      const authorFlag = isAdmin(admin_key);
      const ipHash = visitorHash(req);

      if (!authorFlag) {
        if (countLinks(name) > 0) {
          return res.status(400).json({ error: "Names can't contain links" });
        }
        if (countLinks(text) > MAX_LINKS) {
          return res.status(400).json({ error: `Comments can include at most ${MAX_LINKS} links` });
        }

        const [recent] = await sql`
          SELECT
            (COUNT(*) FILTER (WHERE ip_hash = ${ipHash}))::int AS from_visitor,
            COUNT(*)::int AS site_wide
          FROM comments
          WHERE created_at > NOW() - INTERVAL '10 minutes'
        `;
        if (recent.from_visitor >= MAX_PER_VISITOR || recent.site_wide >= MAX_SITE_WIDE) {
          return res.status(429).json({ error: "Too many comments right now. Please try again in a few minutes." });
        }
      }

      const rows = await sql`
        INSERT INTO comments (chapter_slug, author_name, comment_text, is_author, ip_hash)
        VALUES (${chapter}, ${name.trim()}, ${text.trim()}, ${authorFlag}, ${ipHash})
        RETURNING id, author_name, comment_text, is_author, created_at
      `;

      return res.status(201).json({ comment: rows[0] });
    }

    if (req.method === "DELETE") {
      const { id, admin_key } = req.body || {};
      const qId = req.query.id;
      const qKey = req.query.admin_key;
      const commentId = id || qId;
      const key = admin_key || qKey;

      if (!isAdmin(key)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (!commentId || !/^\d+$/.test(String(commentId))) {
        return res.status(400).json({ error: "Comment ID required" });
      }

      await sql`DELETE FROM comments WHERE id = ${commentId}`;
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Comments API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
