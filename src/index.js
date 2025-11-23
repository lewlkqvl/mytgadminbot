const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const db = require('./database/db');
const logger = require('./utils/logger');

// 导入处理器
const setupHelpHandler = require('./handlers/help');
const setupWelcomeHandler = require('./handlers/welcome');
const setupAdminHandlers = require('./handlers/admin');
const setupStatsHandler = require('./handlers/stats');
const setupAutoReplyHandler = require('./handlers/autoReply');
const setupFilterHandler = require('./handlers/filter');
const setupVerificationHandler = require('./handlers/verification');

// 验证配置
if (!config.botToken) {
  logger.error('错误: 未设置 BOT_TOKEN 环境变量！');
  logger.error('请复制 .env.example 为 .env 并填入你的 bot token');
  process.exit(1);
}

// 创建bot实例
const bot = new TelegramBot(config.botToken, { polling: true });

// 初始化
async function init() {
  try {
    // 初始化数据库
    await db.init();

    // 设置所有处理器
    setupHelpHandler(bot);
    setupWelcomeHandler(bot);
    setupAdminHandlers(bot);
    setupStatsHandler(bot);
    setupAutoReplyHandler(bot);
    setupFilterHandler(bot);
    setupVerificationHandler(bot);

    // 获取bot信息
    const botInfo = await bot.getMe();
    logger.info(`Bot 启动成功: @${botInfo.username}`);
    logger.info('正在监听消息...');

    // 功能状态
    logger.info(`用户验证: ${config.enableVerification ? '启用' : '禁用'}`);
    logger.info(`反垃圾信息: ${config.enableAntiSpam ? '启用' : '禁用'}`);
    logger.info(`管理员数量: ${config.adminIds.length}`);
  } catch (error) {
    logger.error('初始化失败:', error);
    process.exit(1);
  }
}

// 错误处理
bot.on('polling_error', (error) => {
  logger.error('Polling 错误:', error.code, error.message);
});

bot.on('error', (error) => {
  logger.error('Bot 错误:', error);
});

// 优雅退出
process.on('SIGINT', async () => {
  logger.info('收到退出信号，正在关闭...');
  await db.saveStats(); // 保存统计数据
  await bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到终止信号，正在关闭...');
  await db.saveStats(); // 保存统计数据
  await bot.stopPolling();
  process.exit(0);
});

// 启动bot
init();
