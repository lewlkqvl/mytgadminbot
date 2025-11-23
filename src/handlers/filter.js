const { requireAdmin, isBotAdmin } = require('../middleware/auth');
const db = require('../database/db');
const config = require('../config/config');
const logger = require('../utils/logger');

function setupFilterHandler(bot) {
  // 添加关键词过滤 /filter add <关键词>
  bot.onText(/\/filter(?:@\w+)? add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = match[1].trim();

    await requireAdmin(bot, msg, async () => {
      db.addFilter(chatId, keyword);
      bot.sendMessage(chatId, `✅ 已添加过滤关键词: "${keyword}"`);
      logger.info(`添加过滤关键词 in chat ${chatId}: ${keyword}`);
    });
  });

  // 删除关键词过滤 /filter del <关键词>
  bot.onText(/\/filter(?:@\w+)? del (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = match[1].trim();

    await requireAdmin(bot, msg, async () => {
      db.removeFilter(chatId, keyword);
      bot.sendMessage(chatId, `✅ 已删除过滤关键词: "${keyword}"`);
      logger.info(`删除过滤关键词 in chat ${chatId}: ${keyword}`);
    });
  });

  // 列出所有过滤关键词 /filter list
  bot.onText(/\/filter(?:@\w+)? list/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      const filters = db.getFilters(chatId);

      if (filters.length === 0) {
        return bot.sendMessage(chatId, '🔍 暂无过滤关键词');
      }

      let text = '🔍 过滤关键词列表:\n\n';
      filters.forEach((filter, index) => {
        text += `${index + 1}. "${filter.keyword}"\n`;
      });

      bot.sendMessage(chatId, text);
    });
  });

  // 监听消息进行过滤和反垃圾检测
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    try {
      // 检查关键词过滤
      if (db.checkFilter(chatId, text)) {
        if (await isBotAdmin(bot, chatId)) {
          await bot.deleteMessage(chatId, msg.message_id);
          const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

          await bot.sendMessage(
            chatId,
            `⚠️ ${username} 的消息包含违禁词已被删除`,
            { parse_mode: 'Markdown' }
          );

          db.incrementStat(chatId, 'deletedMessages');
          logger.info(`删除包含违禁词的消息 from ${username} in chat ${chatId}`);
        }
        return;
      }

      // 反垃圾信息检测
      if (config.enableAntiSpam) {
        const messageCount = db.trackMessage(userId, chatId);

        if (messageCount > config.spamMessageLimit) {
          if (await isBotAdmin(bot, chatId)) {
            const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

            // 禁言5分钟
            await bot.restrictChatMember(chatId, userId, {
              until_date: Math.floor(Date.now() / 1000) + 300,
              can_send_messages: false
            });

            await bot.sendMessage(
              chatId,
              `🛡️ ${username} 因刷屏被禁言5分钟`
            );

            db.incrementStat(chatId, 'mutes');
            db.clearUserMessages(userId, chatId);
            logger.info(`禁言刷屏用户: ${username} in chat ${chatId}`);
          }
        }
      }

      // 检测垃圾链接
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      const urls = text.match(urlPattern);

      if (urls && urls.length > 3) {
        // 如果消息包含超过3个链接，可能是垃圾广告
        if (await isBotAdmin(bot, chatId)) {
          await bot.deleteMessage(chatId, msg.message_id);
          const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

          await bot.sendMessage(
            chatId,
            `⚠️ ${username} 的消息包含过多链接已被删除`
          );

          db.incrementStat(chatId, 'deletedMessages');
          logger.info(`删除包含过多链接的消息 from ${username} in chat ${chatId}`);
        }
      }
    } catch (error) {
      logger.error('消息过滤处理失败:', error);
    }
  });
}

module.exports = setupFilterHandler;
