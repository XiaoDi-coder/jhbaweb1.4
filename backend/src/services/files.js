const { pool } = require('../db');

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

async function incDownloadCount(id) {
  await pool.execute(`UPDATE files SET download_count = download_count + 1 WHERE id = :id`, { id });
}

async function softDeleteFile(id) {
  await pool.execute(`UPDATE files SET is_deleted = TRUE WHERE id = :id`, { id });
}

module.exports = { createFile, listFiles, getFileById, incDownloadCount, softDeleteFile };

