/**
 * 话题讨论路由模块 (Topic Routes)
 * 包含功能：获取话题列表、获取详情、创建话题、删除话题、获取与发表评论
 */
const express = require('express');
const { z } = require('zod');

// 引入重构工具与系统中间件
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { writeOperationLog } = require('../services/logs');

// 引入底层数据库服务
const {
  listTopics,
  createTopic,
  getTopicById,
  incTopicView,
  softDeleteTopic,
  listComments,
  createComment,
} = require('../services/topics');

const router = express.Router();

// ==========================================
// Zod 参数校验规则定义区
// ==========================================

const topicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最大长度为200字符'),
  content: z.string().max(5000, '内容超出最大长度限制').optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, '评论不能为空').max(5000, '评论内容超长'),
});

// ==========================================
// 路由逻辑区
// ==========================================

/**
 * @route GET /api/topics
 * @desc 获取未被删除的话题列表 (包含评论数量统计)
 */
router.get('/', asyncHandler(async (req, res) => {
  const items = await listTopics();
  res.json({ items });
}));

/**
 * @route POST /api/topics
 * @desc 创建新话题
 */
router.post('/', requireAuth, validate(topicSchema), asyncHandler(async (req, res) => {
  const body = req.body; // 已被 Zod 校验和过滤

  // 1. 入库
  const id = await createTopic({
    title: body.title.trim(),
    content: body.content || '',
    createdBy: req.user.id
  });

  // 2. 记录日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'create',
    targetType: 'topic',
    targetId: id,
    details: `create topic: ${body.title.trim()}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ id });
}));

/**
 * @route GET /api/topics/:id
 * @desc 获取单条话题详情，并增加浏览量
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  const topic = await getTopicById(id);
  if (!topic || topic.is_deleted) return res.status(404).json({ message: '话题不存在或已被删除' });
  
  // 异步增加浏览量
  await incTopicView(id);
  
  res.json({ topic });
}));

/**
 * @route DELETE /api/topics/:id
 * @desc 软删除话题（仅限发布者或管理员）
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  // 1. 查找话题以校验权限
  const topic = await getTopicById(id);
  if (!topic || topic.is_deleted) return res.status(404).json({ message: '话题不存在或已被删除' });

  // 2. 权限判断
  const isOwner = Number(topic.created_by) === Number(req.user.id);
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限删除该话题' });

  // 3. 执行删除
  await softDeleteTopic(id);
  
  // 4. 记录日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'delete',
    targetType: 'topic',
    targetId: id,
    details: `soft_delete topic id=${id}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  res.json({ message: '话题已删除' });
}));

/**
 * @route GET /api/topics/:id/comments
 * @desc 获取指定话题下的所有有效评论
 */
router.get('/:id/comments', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
  
  const items = await listComments(id);
  res.json({ items });
}));

/**
 * @route POST /api/topics/:id/comments
 * @desc 对指定话题发表评论
 */
router.post('/:id/comments', requireAuth, validate(commentSchema), asyncHandler(async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isFinite(topicId)) return res.status(400).json({ message: 'id 参数错误' });
  
  // 判断话题是否存活
  const topic = await getTopicById(topicId);
  if (!topic || topic.is_deleted) return res.status(404).json({ message: '无法评论：该话题不存在或已被删除' });

  // 写入评论
  const id = await createComment({
    topicId,
    content: req.body.content,
    createdBy: req.user.id
  });
  
  // 记录日志
  await writeOperationLog({
    userId: req.user.id,
    operationType: 'create',
    targetType: 'comment',
    targetId: id,
    details: `create comment topic=${topicId}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  res.json({ id });
}));

module.exports = { topicsRouter: router };