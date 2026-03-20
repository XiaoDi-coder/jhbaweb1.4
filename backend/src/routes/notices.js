/**
 * 公告路由模块 (Notice Routes)
 * 包含功能：获取公告列表、获取详情、已读标记、创建/更新/删除公告
 */
const express = require('express');
const { z } = require('zod');

// 引入我们的重构优化工具（消除 try-catch 和冗余校验）
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');

// 引入系统原本的中间件和服务
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeOperationLog } = require('../services/logs');
const {
  listNotices,
  getNoticeById,
  incNoticeView,
  createNotice,
  updateNotice,
  deleteNotice,
  markNoticeRead,
} = require('../services/notices');

const router = express.Router();

// ==========================================
// Zod 参数校验规则定义区
// ==========================================

// 创建与更新公告共享的验证规则
const noticeSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最大长度为200字符'),
  content: z.string().min(1, '内容不能为空').max(20000, '内容超出最大长度限制'),
  isTop: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  publishTime: z.string().datetime({ message: '发布时间格式错误' }).optional().nullable(),
  expireTime: z.string().datetime({ message: '过期时间格式错误' }).optional().nullable(),
});

// ==========================================
// 路由逻辑区
// ==========================================

/**
 * @route GET /api/notices
 * @desc 获取已发布的公告列表（过滤掉未到发布时间或已过期的公告）
 */
router.get('/', asyncHandler(async (req, res) => {
  const items = await listNotices();
  res.json({ items });
}));

/**
 * @route GET /api/notices/:id
 * @desc 获取单条公告详情并增加阅读量
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  const notice = await getNoticeById(id);
  if (!notice) return res.status(404).json({ message: '公告不存在' });
  
  // 异步增加阅读量
  await incNoticeView(id);
  
  res.json({ notice });
}));

/**
 * @route POST /api/notices/:id/read
 * @desc 标记公告为已读（需登录用户）
 */
router.post('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  await markNoticeRead({ noticeId: id, userId: req.user.id });
  res.json({ message: 'ok' });
}));

/**
 * @route POST /api/notices
 * @desc 创建新公告（仅限 admin / super_admin 角色）
 */
router.post('/', requireAuth, requireRole(['admin', 'super_admin']), validate(noticeSchema), asyncHandler(async (req, res) => {
  const body = req.body; // 此时 body 已经被 Zod 校验过滤过了

  // 1. 创建公告入库
  const id = await createNotice({
    title: body.title.trim(),
    content: body.content,
    createdBy: req.user.id,
    isTop: body.isTop || false,
    status: body.status || 'published',
    publishTime: body.publishTime || null,
    expireTime: body.expireTime || null,
  });

  // 2. 写入重要操作日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'create',
    targetType: 'notice',
    targetId: id,
    details: `create notice: ${body.title.trim()}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ id });
}));

/**
 * @route PUT /api/notices/:id
 * @desc 更新指定公告（仅限 admin / super_admin 角色）
 */
router.put('/:id', requireAuth, requireRole(['admin', 'super_admin']), validate(noticeSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  const body = req.body;

  // 1. 更新公告数据
  await updateNotice({
    id,
    title: body.title.trim(),
    content: body.content,
    isTop: body.isTop || false,
    status: body.status || 'published',
    publishTime: body.publishTime ?? null,
    expireTime: body.expireTime ?? null,
  });

  // 2. 写入操作日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'update',
    targetType: 'notice',
    targetId: id,
    details: `update notice: ${body.title.trim()}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ message: '已更新' });
}));

/**
 * @route DELETE /api/notices/:id
 * @desc 删除指定公告（仅限 admin / super_admin 角色）
 */
router.delete('/:id', requireAuth, requireRole(['admin', 'super_admin']), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  // 1. 删除公告
  await deleteNotice(id);
  
  // 2. 写入操作日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'delete',
    targetType: 'notice',
    targetId: id,
    details: `delete notice id=${id}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  res.json({ message: '已删除' });
}));

module.exports = { noticesRouter: router };