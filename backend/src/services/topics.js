const { pool } = require('../db');

async function listTopics() {
  const [rows] = await pool.execute(
    `SELECT t.id, t.title, t.content, t.created_by, t.created_at, t.updated_at, t.view_count,
            u.account AS author_account, u.username AS author_name,
            (SELECT COUNT(1) FROM comments c WHERE c.topic_id = t.id AND c.is_deleted = FALSE) AS comment_count
     FROM topics t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.is_deleted = FALSE
     ORDER BY t.id DESC`,
  );
  return rows;
}

async function createTopic({ title, content, createdBy }) {
  const [ret] = await pool.execute(
    `INSERT INTO topics (title, content, created_by)
     VALUES (:title, :content, :createdBy)`,
    { title, content: content || null, createdBy },
  );
  return ret.insertId;
}

async function getTopicById(id) {
  const [rows] = await pool.execute(
    `SELECT t.id, t.title, t.content, t.created_by, t.created_at, t.updated_at, t.view_count, t.is_deleted,
            u.account AS author_account, u.username AS author_name
     FROM topics t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

async function incTopicView(id) {
  await pool.execute(`UPDATE topics SET view_count = view_count + 1 WHERE id = :id`, { id });
}

async function softDeleteTopic(id) {
  await pool.execute(`UPDATE topics SET is_deleted = TRUE WHERE id = :id`, { id });
}

async function listComments(topicId) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.topic_id, c.content, c.created_by, c.created_at, c.updated_at,
            u.account AS author_account, u.username AS author_name
     FROM comments c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.topic_id = :topicId AND c.is_deleted = FALSE
     ORDER BY c.id ASC`,
    { topicId },
  );
  return rows;
}

async function createComment({ topicId, content, createdBy }) {
  const [ret] = await pool.execute(
    `INSERT INTO comments (topic_id, content, created_by)
     VALUES (:topicId, :content, :createdBy)`,
    { topicId, content, createdBy },
  );
  return ret.insertId;
}

module.exports = {
  listTopics,
  createTopic,
  getTopicById,
  incTopicView,
  softDeleteTopic,
  listComments,
  createComment,
};

