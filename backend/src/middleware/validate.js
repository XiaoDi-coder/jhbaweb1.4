/**
 * Zod 参数校验中间件
 * 作用：拦截请求，使用 Zod Schema 校验参数是否合法。
 * 如果不合法，直接返回 400 错误；如果合法，将过滤后的安全数据挂载到 req 对象上。
 */
const { ZodError } = require('zod');

const validate = (schema, source = 'body') => (req, res, next) => {
    try {
        // 解析并校验数据，剥离掉 schema 中未定义的冗余字段
        req[source] = schema.parse(req[source]);
        next(); // 校验通过，进入下一个中间件或路由
    } catch (error) {
        if (error instanceof ZodError) {
            // 提取所有的验证错误信息并拼接
            const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
            return res.status(400).json({
                code: 400,
                message: `参数格式错误: ${errorMessages}`,
            });
        }
        next(error); // 非 Zod 错误，交给全局错误处理器
    }
};

module.exports = validate;