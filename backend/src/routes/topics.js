const express = require('express');
const { z } = require('zod');

const { requireAuth } = require('../middleware/auth');
const { writeOperationLog } = require('../services/logs');
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

router.get('/', async (req, res, next) => {
  try {
    const items = await listTopics();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().min(1).max(200), content: z.string().max(5000).optional() }).parse(req.body);
    const id = await createTopic({ title: body.title.trim(), content: body.content || '', createdBy: req.user.id });

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
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const topic = await getTopicById(id);
    if (!topic || topic.is_deleted) return res.status(404).json({ message: '话题不存在' });
    await incTopicView(id);
    res.json({ topic });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const topic = await getTopicById(id);
    if (!topic || topic.is_deleted) return res.status(404).json({ message: '话题不存在' });

    const isOwner = Number(topic.created_by) === Number(req.user.id);
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '无权限删除' });

    await softDeleteTopic(id);
    await writeOperationLog({
      userId: req.user.id,
      operationType: 'delete',
      targetType: 'topic',
      targetId: id,
      details: `soft_delete topic id=${id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json({ message: '已删除' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/comments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const items = await listComments(id);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const topicId = Number(req.params.id);
    if (!Number.isFinite(topicId)) return res.status(400).json({ message: 'id 参数错误' });
    const topic = await getTopicById(topicId);
    if (!topic || topic.is_deleted) return res.status(404).json({ message: '话题不存在' });

    const body = z.object({ content: z.string().min(1).max(5000) }).parse(req.body);
    const id = await createComment({ topicId, content: body.content, createdBy: req.user.id });
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
  } catch (e) {
    next(e);
  }
});

module.exports = { topicsRouter: router };

