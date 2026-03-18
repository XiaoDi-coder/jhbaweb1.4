/**
 * 文件模块数据库服务层 (File Services)
 * 处理与文件记录 (files) 相关的核心数据库交互
 */
const { pool } = require('../db');

/**
 * 在数据库中创建新的文件上传记录
 * @param {Object} fileData - 文件属性对象
 * @returns {number} 新创建记录的自增 ID
 */
async function createFile({
  filename,
  filePath,
  fileSize,
  fileType,
  extension,
  isArchive,
  uploadedBy,
}) {
  const [ret] = await pool.execute(
    `INSERT INTO files
      (filename, file_path, file_size, file_type, extension, is_archive, uploaded_by)
     VALUES
      (:filename, :filePath, :fileSize, :fileType, :extension, :isArchive, :uploadedBy)`,
    {
      filename,
      filePath,
      fileSize,
      fileType: fileType || null,
      extension: extension || null,
      isArchive: !!isArchive,
      uploadedBy,
    },
  );
  return ret.insertId;
}

/**
 * 获取未删除状态的文件列表（含上传者的账号和姓名）
 * @returns {Array} 文件记录数组
 */
async function listFiles() {
  const [rows] = await pool.execute(
    `SELECT f.id, f.filename, f.file_size, f.file_type, f.extension, f.is_archive, f.uploaded_by,
            f.uploaded_at, f.download_count, u.account AS uploader_account, u.username AS uploader_name
     FROM files f
     LEFT JOIN users u ON f.uploaded_by = u.id
     WHERE f.is_deleted = FALSE
     ORDER BY f.id DESC`,
  );
  return rows;
}

/**
 * 根据文件 ID 查找单个文件的完整信息
 * @param {number} id - 文件ID
 * @returns {Object|null} 文件记录对象或 null
 */
async function getFileById(id) {
  const [rows] = await pool.execute(
    `SELECT id, filename, file_path, file_size, file_type, extension, is_archive, uploaded_by,
            uploaded_at, download_count, is_deleted
     FROM files
     WHERE id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

/**
 * 增加文件的下载次数统计 (+1)
 * @param {number} id - 文件ID
 */
async function incDownloadCount(id) {
  await pool.execute(`UPDATE files SET download_count = download_count + 1 WHERE id = :id`, { id });
}

/**
 * 软删除指定文件 (将 is_deleted 标记为 TRUE)
 * 注: 物理文件并未从磁盘中删除
 * @param {number} id - 文件ID
 */
async function softDeleteFile(id) {
  await pool.execute(`UPDATE files SET is_deleted = TRUE WHERE id = :id`, { id });
}

module.exports = { 
  createFile, 
  listFiles, 
  getFileById, 
  incDownloadCount, 
  softDeleteFile 
};