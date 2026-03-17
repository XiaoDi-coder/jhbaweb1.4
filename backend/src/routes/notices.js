const express = require('express');
const { z } = require('zod');

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

router.get('/', async (req, res, next) => {
  try {
    const items = await listNotices();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const notice = await getNoticeById(id);
    if (!notice) return res.status(404).json({ message: '公告不存在' });
    await incNoticeView(id);
    res.json({ notice });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    await markNoticeRead({ noticeId: id, userId: req.user.id });
    res.json({ message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(20000),
        isTop: z.boolean().optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        publishTime: z.string().datetime().optional(),
        expireTime: z.string().datetime().optional(),
      })
      .parse(req.body);

    const id = await createNotice({
      title: body.title.trim(),
      content: body.content,
      createdBy: req.user.id,
      isTop: body.isTop || false,
      status: body.status || 'published',
      publishTime: body.publishTime || null,
      expireTime: body.expireTime || null,
    });

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
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const body = z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(20000),
        isTop: z.boolean().optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        publishTime: z.string().datetime().optional().nullable(),
        expireTime: z.string().datetime().optional().nullable(),
      })
      .parse(req.body);

    await updateNotice({
      id,
      title: body.title.trim(),
      content: body.content,
      isTop: body.isTop || false,
      status: body.status || 'published',
      publishTime: body.publishTime ?? null,
      expireTime: body.expireTime ?? null,
    });

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
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    await deleteNotice(id);
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
  } catch (e) {
    next(e);
  }
});

module.exports = { noticesRouter: router };

