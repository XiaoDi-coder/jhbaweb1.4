const { pool } = require('../db');

async function listNotices() {
  const [rows] = await pool.execute(
    `SELECT n.id, n.title, n.content, n.created_by, n.created_at, n.updated_at, n.is_top, n.status,
            n.publish_time, n.expire_time, n.view_count,
            u.account AS author_account, u.username AS author_name
     FROM notices n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.status = 'published'
       AND (n.publish_time IS NULL OR n.publish_time <= NOW())
       AND (n.expire_time IS NULL OR n.expire_time > NOW())
     ORDER BY n.is_top DESC, n.id DESC`,
  );
  return rows;
}

async function getNoticeById(id) {
  const [rows] = await pool.execute(
    `SELECT n.id, n.title, n.content, n.created_by, n.created_at, n.updated_at, n.is_top, n.status,
            n.publish_time, n.expire_time, n.view_count,
            u.account AS author_account, u.username AS author_name
     FROM notices n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

async function incNoticeView(id) {
  await pool.execute(`UPDATE notices SET view_count = view_count + 1 WHERE id = :id`, { id });
}

async function createNotice({ title, content, createdBy, isTop = false, status = 'published', publishTime, expireTime }) {
  const [ret] = await pool.execute(
    `INSERT INTO notices (title, content, created_by, is_top, status, publish_time, expire_time)
     VALUES (:title, :content, :createdBy, :isTop, :status, :publishTime, :expireTime)`,
    {
      title,
      content,
      createdBy,
      isTop: !!isTop,
      status,
      publishTime: publishTime || null,
      expireTime: expireTime || null,
    },
  );
  return ret.insertId;
}

async function updateNotice({ id, title, content, isTop, status, publishTime, expireTime }) {
  await pool.execute(
    `UPDATE notices
     SET title = :title,
         content = :content,
         is_top = :isTop,
         status = :status,
         publish_time = :publishTime,
         expire_time = :expireTime
     WHERE id = :id`,
    {
      id,
      title,
      content,
      isTop: !!isTop,
      status,
      publishTime: publishTime || null,
      expireTime: expireTime || null,
    },
  );
}

async function deleteNotice(id) {
  await pool.execute(`DELETE FROM notices WHERE id = :id`, { id });
}

async function markNoticeRead({ noticeId, userId }) {
  await pool.execute(
    `INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (:noticeId, :userId)`,
    { noticeId, userId },
  );
}

module.exports = {
  listNotices,
  getNoticeById,
  incNoticeView,
  createNotice,
  updateNotice,
  deleteNotice,
  markNoticeRead,
};

