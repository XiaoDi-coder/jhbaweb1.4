/**
 * Express 应用初始化
 * 负责挂载所有业务路由以及静态前端页面
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { authRouter } = require('./routes/auth');
const { publicRouter } = require('./routes/public');
const { adminRouter } = require('./routes/admin');
const { filesRouter } = require('./routes/files');
const { topicsRouter } = require('./routes/topics');
const { noticesRouter } = require('./routes/notices');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  // 信任反向代理（如部署在 Nginx 后面时可正确获取 IP）
  app.set('trust proxy', true);
  // 允许跨域访问（当前主要为同源前端服务）
  app.use(cors());
  // HTTP 请求日志
  app.use(morgan('dev'));
  // 解析 JSON 请求体，限制体积防止滥用，明确 UTF-8
  app.use(express.json({ limit: '2mb' }));
  // 所有 JSON 响应统一使用 UTF-8，避免中文乱码
  app.use(function (req, res, next) {
    var origJson = res.json;
    res.json = function (data) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return origJson.call(this, data);
    };
    next();
  });

  // 健康检查接口
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // 业务接口路由
  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/topics', topicsRouter);
  app.use('/api/notices', noticesRouter);

  // 静态前端页面：将 frontend 目录作为静态资源根目录，同源避免 CORS 问题
  // 开发/更新时禁止缓存 HTML/JS/CSS，避免改代码后必须清缓存才生效
  const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');
  app.use(
    '/',
    express.static(frontendDir, {
      setHeaders: function (res, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (['.html', '.htm', '.js', '.css'].indexOf(ext) !== -1) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );

  // 统一 404 和错误处理
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };


