/**
 * 通用 404 处理中间件
 */
function notFound(req, res) {
  res.status(404).json({ message: '接口不存在' });
}

/**
 * 全局错误处理中间件
 * - 对 4xx 错误直接返回业务提示
 * - 对 5xx 错误隐藏具体细节，仅返回“服务器错误”，并在服务端打印日志
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 ? '服务器错误' : err.message || '请求错误';
  if (status >= 500) {
    // 避免把内部错误细节返回给前端，仅在服务端日志中输出
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };


