const { sql } = require("@vercel/postgres");

async function ensureTable() {
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
  try {
    await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_author BOOLEAN DEFAULT FALSE`;
  } catch (_) {}
}

function isAdmin(key) {
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
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

      const { rows } = await sql`
        SELECT id, author_name, comment_text, is_author, created_at
        FROM comments
        WHERE chapter_slug = ${chapter}
        ORDER BY created_at ASC
      `;

      return res.status(200).json({ comments: rows });
    }

    if (req.method === "POST") {
      const { chapter, name, text, admin_key } = req.body;

      if (!chapter || !/^[a-z0-9-]+$/.test(chapter)) {
        return res.status(400).json({ error: "Invalid chapter slug" });
      }
      if (!name || name.trim().length === 0 || name.length > 100) {
        return res.status(400).json({ error: "Name is required (max 100 chars)" });
      }
      if (!text || text.trim().length === 0 || text.length > 5000) {
        return res.status(400).json({ error: "Comment is required (max 5000 chars)" });
      }

      const authorFlag = isAdmin(admin_key);

      const { rows } = await sql`
        INSERT INTO comments (chapter_slug, author_name, comment_text, is_author)
        VALUES (${chapter}, ${name.trim()}, ${text.trim()}, ${authorFlag})
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
      if (!commentId) {
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
