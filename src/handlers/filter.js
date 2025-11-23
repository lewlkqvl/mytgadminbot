const { requireAdmin, isBotAdmin } = require('../middleware/auth');
const db = require('../database/db');
const config = require('../config/config');
const logger = require('../utils/logger');

function setupFilterHandler(bot) {
  // 添加关键词过滤 /filter add <关键词>
  bot.onText(/\/filter(?:@\w+)? add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = match[1].trim();

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      db.addFilter(chatId, keyword);

      // 确认关键词已添加
      const filters = db.getFilters(chatId);
      const added = filters.some(f => f.keyword === keyword.toLowerCase());

      if (added) {
        bot.sendMessage(chatId, `✅ 已添加过滤关键词: "${keyword}"\n\n当前共有 ${filters.length} 个过滤关键词`);
        logger.info(`✅ 添加过滤关键词成功 in chat ${chatId}: "${keyword}"`);
      } else {
        bot.sendMessage(chatId, `❌ 添加过滤关键词失败: "${keyword}"`);
        logger.error(`❌ 添加过滤关键词失败 in chat ${chatId}: "${keyword}"`);
      }
    });
  });

  // 删除关键词过滤 /filter del <关键词>
  bot.onText(/\/filter(?:@\w+)? del (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const keyword = match[1].trim();

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      db.removeFilter(chatId, keyword);
      bot.sendMessage(chatId, `✅ 已删除过滤关键词: "${keyword}"`);
      logger.info(`删除过滤关键词 in chat ${chatId}: ${keyword}`);
    });
  });

  // 列出所有过滤关键词 /filter list
  bot.onText(/\/filter(?:@\w+)? list/, async (msg) => {
    const chatId = msg.chat.id;

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      const filters = db.getFilters(chatId);

      if (filters.length === 0) {
        return bot.sendMessage(chatId, '🔍 暂无过滤关键词\n\n💡 使用 /filter add <关键词> 来添加过滤词');
      }

      let text = `🔍 过滤关键词列表 (共 ${filters.length} 个):\n\n`;
      filters.forEach((filter, index) => {
        text += `${index + 1}. "${filter.keyword}"\n`;
      });

      text += '\n💡 发送包含以上关键词的消息将被自动删除';
      text += '\n⚠️ 确保 Bot 拥有管理员权限才能删除消息';

      bot.sendMessage(chatId, text);
      logger.info(`查看过滤关键词列表 in chat ${chatId}: ${filters.length} 个关键词`);
    });
  });

  // 监听消息进行过滤和反垃圾检测
  bot.on('message', async (msg) => {
    // 基本检查
    if (!msg.text || msg.text.startsWith('/')) return;
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // 添加调试日志
    logger.debug(`[Filter] 收到群组消息 in chat ${chatId}: "${text}"`);

    try {
      // 检查关键词过滤
      const filters = db.getFilters(chatId);
      logger.debug(`[Filter] 当前群组有 ${filters.length} 个过滤关键词`);

      const hasFilteredWord = db.checkFilter(chatId, text);

      if (hasFilteredWord) {
        logger.info(`检测到违禁词 in chat ${chatId}, 消息: "${text}"`);

        const botIsAdmin = await isBotAdmin(bot, chatId);
        logger.info(`Bot 管理员状态 in chat ${chatId}: ${botIsAdmin}`);

        if (botIsAdmin) {
          try {
            await bot.deleteMessage(chatId, msg.message_id);
            const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

            const warningMsg = await bot.sendMessage(
              chatId,
              `⚠️ ${username} 的消息包含违禁词已被删除`
            );

            // 3秒后删除警告消息
            setTimeout(() => {
              bot.deleteMessage(chatId, warningMsg.message_id).catch(() => {});
            }, 3000);

            db.incrementStat(chatId, 'deletedMessages');
            logger.info(`✅ 已删除包含违禁词的消息 from ${username} in chat ${chatId}`);
          } catch (deleteError) {
            logger.error(`删除消息失败:`, deleteError.message);
          }
        } else {
          logger.warn(`⚠️ Bot 不是管理员，无法删除消息 in chat ${chatId}`);
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
