/**
 * 鉴权路由模块 (Auth Routes)
 * 包含功能：用户登录、获取当前用户信息、修改密码
 */
const express = require('express');
const { z } = require('zod');

// 引入我们的重构优化工具（消除 try-catch 和冗余校验）
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');

// 引入系统原本的中间件和服务
const { requireAuth } = require('../middleware/auth');
const { writeOperationLog } = require('../services/logs');
const { findUserByAccount, updateLastLoginAt, updatePassword } = require('../services/users');
const { verifyPassword, hashPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/tokens');

const router = express.Router();

// ==========================================
// Zod 参数校验规则定义区
// ==========================================

// 登录接口参数规则
const loginSchema = z.object({
  account: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 修改密码接口参数规则
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码长度不能少于6位'),
});

// ==========================================
// 路由逻辑区
// ==========================================

/**
 * @route POST /api/auth/login
 * @desc 用户登录接口
 */
router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  // 经过 validate 中间件后，req.body 是安全且去除多余字段的
  const account = req.body.account.trim();
  
  // 1. 查询用户是否存在
  const user = await findUserByAccount(account);
  if (!user) {
    // 账号不存在，写入操作日志
    await writeOperationLog({
      operationType: 'login',
      targetType: 'user',
      details: `login_failed: account_not_found: ${account}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(400).json({ message: '账号或密码错误' });
  }

  // 2. 检查账号状态是否正常
  if (user.status !== 'active') {
    return res.status(403).json({ message: user.status === 'pending' ? '账号待审核' : '账号已禁用' });
  }

  // 3. 校验密码是否正确
  const ok = await verifyPassword(req.body.password, user.password);
  if (!ok) {
    // 密码错误，写入操作日志
    await writeOperationLog({
      userId: user.id,
      operationType: 'login',
      targetType: 'user',
      targetId: user.id,
      details: 'login_failed: bad_password',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(400).json({ message: '账号或密码错误' });
  }

  // 4. 登录成功，更新最后登录时间并签发 Token
  await updateLastLoginAt(user.id);
  const token = signAccessToken({
    sub: user.id,
    id: user.id,
    account: user.account,
    username: user.username,
    role: user.role,
  });

  // 5. 记录登录成功日志
  await writeOperationLog({
    userId: user.id,
    operationType: 'login',
    targetType: 'user',
    targetId: user.id,
    details: 'login_success',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // 6. 返回结果给前端
  return res.json({
    token,
    user: {
      id: user.id,
      account: user.account,
      username: user.username,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    },
  });
}));

/**
 * @route GET /api/auth/me
 * @desc 获取当前登录用户信息
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  // requireAuth 中间件已经将用户信息挂载到了 req.user 上
  res.json({
    user: {
      id: req.user.id,
      account: req.user.account,
      username: req.user.username || req.user.account,
      role: req.user.role,
    },
  });
}));

/**
 * @route POST /api/auth/change-password
 * @desc 修改当前用户密码
 */
router.post('/change-password', requireAuth, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // 1. 查询当前用户最新数据
  const user = await findUserByAccount(req.user.account);
  if (!user) return res.status(401).json({ message: '未登录' });

  // 2. 校验旧密码
  const ok = await verifyPassword(currentPassword, user.password);
  if (!ok) return res.status(400).json({ message: '当前密码错误' });

  // 3. 生成新密码哈希并更新入库，解除首次强制修改密码的限制
  const newHash = await hashPassword(newPassword);
  await updatePassword(user.id, newHash, false);

  // 4. 记录修改密码日志
  await writeOperationLog({
    userId: user.id,
    operationType: 'change_password',
    targetType: 'user',
    targetId: user.id,
    details: 'password_changed',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ message: '密码已修改，请重新登录' });
}));

// 【重要】以对象形式导出，完美适配 app.js 中的解构 require
module.exports = { authRouter: router };