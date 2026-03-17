const { verifyAccessToken } = require('../utils/tokens');

function parseBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  const token = parseBearer(req);
  if (!token) return res.status(401).json({ message: '未登录' });
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

function requireRole(roles) {
  const allow = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未登录' });
    if (!allow.includes(req.user.role)) return res.status(403).json({ message: '无权限' });
    return next();
  };
}

module.exports = { requireAuth, requireRole };

