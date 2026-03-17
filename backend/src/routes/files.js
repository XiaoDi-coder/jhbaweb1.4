const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const { createFile, listFiles, getFileById, incDownloadCount, softDeleteFile } = require('../services/files');
const { writeOperationLog } = require('../services/logs');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

ensureDir(config.uploads.dir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploads.dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const safeExt = ext.slice(0, 20);
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${base}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxUploadBytes },
});

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await listFiles();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// 修复上传文件名乱码：若为 Latin-1 误解析的 UTF-8，尝试还原
function decodeFilename(name) {
  if (!name || typeof name !== 'string') return 'file';
  try {
    const buf = Buffer.from(name, 'latin1');
    if (!buf.length) return name;
    const asUtf8 = buf.toString('utf8');
    if (asUtf8 !== name && /[\u4e00-\u9fff]/.test(asUtf8)) return asUtf8;
  } catch (e) {}
  return name;
}

router.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择文件' });
    const original = decodeFilename(req.file.originalname) || 'file';
    const ext = path.extname(original).replace('.', '').toLowerCase().slice(0, 20);
    const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);

    const relPath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
    const id = await createFile({
      filename: original,
      filePath: relPath,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      extension: ext || null,
      isArchive,
      uploadedBy: req.user.id,
    });

    await writeOperationLog({
      userId: req.user.id,
      operationType: 'upload',
      targetType: 'file',
      targetId: id,
      details: `upload ${original} -> ${relPath}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: '上传成功', id });
  } catch (e) {
    next(e);
  }
});

// 生成 RFC 5987 的 UTF-8 文件名，避免中文乱码
function contentDispositionFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'download';
  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').slice(0, 100) || 'download';
  const utf8Encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`;
}

router.get('/:id/download', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const f = await getFileById(id);
    if (!f || f.is_deleted) return res.status(404).json({ message: '文件不存在' });

    const abs = path.resolve(process.cwd(), f.file_path);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: '文件丢失' });

    await incDownloadCount(id);

    res.setHeader('Content-Disposition', contentDispositionFilename(f.filename));
    res.setHeader('Content-Type', f.file_type || 'application/octet-stream');
    const stream = fs.createReadStream(abs);
    stream.on('error', next);
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const f = await getFileById(id);
    if (!f || f.is_deleted) return res.status(404).json({ message: '文件不存在' });
    const isOwner = Number(f.uploaded_by) === Number(req.user.id);
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限删除' });

    await softDeleteFile(id);
    await writeOperationLog({
      userId: req.user.id,
      operationType: 'delete',
      targetType: 'file',
      targetId: id,
      details: `soft_delete file id=${id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ message: '已删除' });
  } catch (e) {
    next(e);
  }
});

module.exports = { filesRouter: router };

