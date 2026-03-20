/**
 * 文件管理路由模块 (File Routes)
 * 包含功能：文件列表获取、文件上传、文件下载、文件删除
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// 引入系统配置与重构工具
const { config } = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { createFile, listFiles, getFileById, incDownloadCount, softDeleteFile } = require('../services/files');
const { writeOperationLog } = require('../services/logs');

// ==========================================
// 初始化与 Multer 配置区
// ==========================================

// 确保上传目录存在
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
ensureDir(config.uploads.dir);

// 配置 multer 磁盘存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploads.dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const safeExt = ext.slice(0, 20); // 限制扩展名长度，防止恶意超长后缀
    // 生成随机不重复的文件名
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${base}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxUploadBytes },
});

// 工具函数：修复上传文件名乱码（处理 Latin-1 误解析的 UTF-8）
function decodeFilename(name) {
  if (!name || typeof name !== 'string') return 'file';
  try {
    const buf = Buffer.from(name, 'latin1');
    if (!buf.length) return name;
    const asUtf8 = buf.toString('utf8');
    // 如果转换后包含中文字符，则认为是转换成功
    if (asUtf8 !== name && /[\u4e00-\u9fff]/.test(asUtf8)) return asUtf8;
  } catch (e) {
    // 忽略转换错误
  }
  return name;
}

// 工具函数：生成 RFC 5987 标准的 UTF-8 下载文件名（彻底解决中文乱码）
function contentDispositionFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'download';
  // 提取安全的 ASCII 字符作为备用名
  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').slice(0, 100) || 'download';
  const utf8Encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`;
}

const router = express.Router();

// ==========================================
// 路由逻辑区
// ==========================================

/**
 * @route GET /api/files
 * @desc 获取未被删除的文件列表
 */
router.get('/', asyncHandler(async (req, res) => {
  const items = await listFiles();
  res.json({ items });
}));

/**
 * @route POST /api/files/upload
 * @desc 上传单个文件
 */
// 注意：将 multer.single 放进路由链，若报错会由全局 error.js 接管
router.post('/upload', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  
  // 1. 解析文件名并判断是否为压缩包
  const original = decodeFilename(req.file.originalname) || 'file';
  const ext = path.extname(original).replace('.', '').toLowerCase().slice(0, 20);
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);

  // 2. 计算相对路径（存入数据库的路径）
  const relPath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
  
  // 3. 写入数据库
  const id = await createFile({
    filename: original,
    filePath: relPath,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    extension: ext || null,
    isArchive,
    uploadedBy: req.user.id,
  });

  // 4. 记录操作日志
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
}));

/**
 * @route GET /api/files/:id/download
 * @desc 下载指定文件
 */
router.get('/:id/download', asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  // 1. 查询文件记录
  const f = await getFileById(id);
  if (!f || f.is_deleted) return res.status(404).json({ message: '文件不存在或已被删除' });

  // 2. 检查物理文件是否存在
  const abs = path.resolve(process.cwd(), f.file_path);
  if (!fs.existsSync(abs)) return res.status(404).json({ message: '物理文件已丢失，请联系管理员' });

  // 3. 异步增加下载次数统计
  await incDownloadCount(id);

  // 4. 设置响应头并使用流传输文件
  res.setHeader('Content-Disposition', contentDispositionFilename(f.filename));
  res.setHeader('Content-Type', f.file_type || 'application/octet-stream');
  
  const stream = fs.createReadStream(abs);
  // 【重要修复】：捕获流读取过程中的错误，防止 Node.js 进程崩溃
  stream.on('error', (err) => next(err)); 
  stream.pipe(res);
}));

/**
 * @route DELETE /api/files/:id
 * @desc 软删除文件（仅限文件上传者或管理员操作）
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  // 1. 获取文件记录
  const f = await getFileById(id);
  if (!f || f.is_deleted) return res.status(404).json({ message: '文件不存在或已被删除' });
  
  // 2. 权限校验：只能删除自己上传的文件，除非是管理员
  const isOwner = Number(f.uploaded_by) === Number(req.user.id);
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限删除该文件' });

  // 3. 执行软删除
  await softDeleteFile(id);
  
  // 4. 记录操作日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'delete',
    targetType: 'file',
    targetId: id,
    details: `soft_delete file id=${id}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  res.json({ message: '文件已放入回收站' });
}));

module.exports = { filesRouter: router };