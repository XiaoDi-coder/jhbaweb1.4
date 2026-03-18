/**
 * 异步路由处理器 (Async Handler)
 * 作用：捕获 Promise 中的 reject（错误），并自动传递给 Express 的 next() 函数
 * 这样在路由中就不需要写大量的 try...catch 语句了
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;