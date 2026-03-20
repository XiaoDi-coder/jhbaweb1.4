/**
 * 话题与评论模块数据库服务层 (Topic & Comment Services)
 * 处理所有的论坛核心数据库交互
 */
const { pool } = require('../db');

/**
 * 获取未删除的话题列表
 * 包含：作者的姓名和账号信息，以及该话题下有效评论的统计数量
 * @returns {Array} 话题列表数组
 */
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

/**
 * 插入新话题
 * @returns {number} 插入的自增主键 ID
 */
async function createTopic({ title, content, createdBy }) {
  const [ret] = await pool.execute(
    `INSERT INTO topics (title, content, created_by)
     VALUES (:title, :content, :createdBy)`,
    { title, content: content || null, createdBy },
  );
  return ret.insertId;
}

/**
 * 根据 ID 查找单条话题信息 (包含被软删除的也会被查出，由路由层判断)
 * @param {number} id - 话题ID
 * @returns {Object|null} 话题对象
 */
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

/**
 * 浏览量 + 1
 * @param {number} id - 话题ID
 */
async function incTopicView(id) {
  await pool.execute(`UPDATE topics SET view_count = view_count + 1 WHERE id = :id`, { id });
}

/**
 * 软删除话题 (将 is_deleted 标为 TRUE)
 * @param {number} id - 话题ID
 */
async function softDeleteTopic(id) {
  await pool.execute(`UPDATE topics SET is_deleted = TRUE WHERE id = :id`, { id });
}

/**
 * 获取指定话题下的所有未删除评论（按时间顺序列出，并带有评论者信息）
 * @param {number} topicId - 话题ID
 * @returns {Array} 评论列表数组
 */
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

/**
 * 给指定话题增加一条评论
 * @returns {number} 插入的评论 ID
 */
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