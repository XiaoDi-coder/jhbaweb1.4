/**
 * 应用入口文件
 * 1. 读取环境变量（.env）
 * 2. 检查数据库连通性，并确保默认管理员账号存在
 * 3. 启动 HTTP 服务，暴露后端 API 与静态前端页面
 */
require('dotenv').config();

const { createApp } = require('./app');
const { config } = require('./config');
const { pingDb } = require('./db');
const { ensureDefaultAdmin } = require('./seed');

/**
 * 初始化数据库连接并进行基础数据（默认管理员）种子写入
 */
async function initDbAndSeed() {
  try {
    await pingDb();
    const seedResult = await ensureDefaultAdmin();
    // 在控制台输出当前默认管理员创建情况，便于排查
    // eslint-disable-next-line no-console
    console.log(`[db] 已连接，默认管理员: ${seedResult.created ? '已创建' : '已存在'}（账号：${seedResult.account}）`);
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[db] 尚未准备好：${e.code || e.message}`);
    return false;
  }
}

/**
 * 主启动函数
 */
async function main() {
  const ok = await initDbAndSeed();

  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`服务已启动：http://localhost:${config.port}`);
  });

  // 如果第一次启动时数据库未就绪，则后台定时重试 ping + 初始化
  if (!ok) {
    const timer = setInterval(async () => {
      const ready = await initDbAndSeed();
      if (ready) clearInterval(timer);
    }, 10_000);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


