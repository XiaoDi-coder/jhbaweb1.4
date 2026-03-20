/**
 * 公告模块数据库服务层 (Notice Services)
 * 处理所有与公告 (notices) 表及已读记录 (notice_reads) 表的数据库交互
 */
const { pool } = require('../db');

/**
 * 获取有效的公共公告列表
 * 条件：状态为 'published'，当前时间在 publish_time 和 expire_time 之间
 * 排序：置顶优先，其次按最新发布排序
 * @returns {Array} 公告列表
 */
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

/**
 * 根据 ID 获取单条公告的详细信息
 * @param {number} id - 公告ID
 * @returns {Object|null} 公告详情对象，如果未找到则返回 null
 */
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

/**
 * 增加公告的浏览次数 (+1)
 * @param {number} id - 公告ID
 */
async function incNoticeView(id) {
  await pool.execute(`UPDATE notices SET view_count = view_count + 1 WHERE id = :id`, { id });
}

/**
 * 创建新公告并保存到数据库
 * @param {Object} noticeData - 公告配置数据
 * @returns {number} 新创建的公告在数据库中的自增 ID
 */
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

/**
 * 更新已有公告的信息
 * @param {Object} noticeData - 需要更新的公告数据（必须包含记录的 id）
 */
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

/**
 * 从数据库中永久删除指定公告
 * @param {number} id - 要删除的公告 ID
 */
async function deleteNotice(id) {
  await pool.execute(`DELETE FROM notices WHERE id = :id`, { id });
}

/**
 * 记录指定用户已阅读指定公告 
 * (使用 INSERT IGNORE 避免用户多次点击导致的主键冲突/重复记录)
 * @param {Object} params - 包含 noticeId (公告ID) 和 userId (用户ID)
 */
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