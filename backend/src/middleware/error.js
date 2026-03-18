/**
 * 全局错误处理中间件
 * 作用：拦截整个应用中抛出的所有错误，统一封装成规范的 JSON 格式返回给前端。
 */
const errorHandler = (err, req, res, next) => {
    // 在控制台打印错误日志，方便后端排查问题
    console.error(`[系统异常] ${req.method} ${req.url} -`, err.message);

    // 获取错误状态码，默认为 500（服务器内部错误）
    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部繁忙，请稍后再试';

    // 返回规范的错误响应
    res.status(statusCode).json({
        code: statusCode,
        message: message,
        // 开发环境下返回错误堆栈信息，生产环境隐藏
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * 404 路由未找到处理中间件
 * 【注意】：为了兼容现有的 app.js，这里必须命名为 notFound
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        code: 404,
        message: '请求的接口或资源不存在'
    });
};

module.exports = { errorHandler, notFound };