const { requireAdmin, isBotAdmin } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

function setupAdminHandlers(bot) {
  // 踢人命令 /kick [userId|@username]
  bot.onText(/\/kick(?:@\w+)?(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userParam = match[1]?.trim();

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userId, username;

      // 优先使用回复消息，其次使用参数中的用户ID或用户名
      if (msg.reply_to_message) {
        userId = msg.reply_to_message.from.id;
        username = msg.reply_to_message.from.username
          ? `@${msg.reply_to_message.from.username}`
          : msg.reply_to_message.from.first_name;
      } else if (userParam) {
        // 判断是数字ID还是用户名
        if (/^\d+$/.test(userParam)) {
          // 纯数字，作为用户ID
          userId = parseInt(userParam);
          username = `用户 ${userParam}`;
        } else {
          // @username 或 username
          const usernameStr = userParam.startsWith('@') ? userParam.substring(1) : userParam;
          userId = `@${usernameStr}`;
          username = `@${usernameStr}`;
        }
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要踢出的用户的消息，或使用: /kick <用户ID|@用户名>');
      }

      try {
        await bot.banChatMember(chatId, userId);
        // 立即解封，使其可以通过邀请链接重新加入
        await bot.unbanChatMember(chatId, userId);

        await bot.sendMessage(chatId, `✅ 已踢出 ${username}`);
        db.incrementStat(chatId, 'kicks');
        logger.info(`踢出用户: ${username} (${userId}) from chat ${chatId}`);
      } catch (error) {
        logger.error('踢人失败:', error);
        bot.sendMessage(chatId, '❌ 踢人失败，请检查bot权限或用户ID/用户名是否正确！');
      }
    });
  });

  // 封禁命令 /ban [userId|@username]
  bot.onText(/\/ban(?:@\w+)?(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userParam = match[1]?.trim();

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userId, username;

      // 优先使用回复消息，其次使用参数中的用户ID或用户名
      if (msg.reply_to_message) {
        userId = msg.reply_to_message.from.id;
        username = msg.reply_to_message.from.username
          ? `@${msg.reply_to_message.from.username}`
          : msg.reply_to_message.from.first_name;
      } else if (userParam) {
        // 判断是数字ID还是用户名
        if (/^\d+$/.test(userParam)) {
          userId = parseInt(userParam);
          username = `用户 ${userParam}`;
        } else {
          const usernameStr = userParam.startsWith('@') ? userParam.substring(1) : userParam;
          userId = `@${usernameStr}`;
          username = `@${usernameStr}`;
        }
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要封禁的用户的消息，或使用: /ban <用户ID|@用户名>');
      }

      try {
        await bot.banChatMember(chatId, userId);
        await bot.sendMessage(chatId, `🚫 已封禁 ${username}`);
        db.incrementStat(chatId, 'bans');
        logger.info(`封禁用户: ${username} (${userId}) in chat ${chatId}`);
      } catch (error) {
        logger.error('封禁失败:', error);
        bot.sendMessage(chatId, '❌ 封禁失败，请检查bot权限或用户ID/用户名是否正确！');
      }
    });
  });

  // 解封命令 /unban [userId|@username]
  bot.onText(/\/unban(?:@\w+)?(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userParam = match[1]?.trim();

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userId, username;

      // 优先使用回复消息，其次使用参数中的用户ID或用户名
      if (msg.reply_to_message) {
        userId = msg.reply_to_message.from.id;
        username = msg.reply_to_message.from.username
          ? `@${msg.reply_to_message.from.username}`
          : msg.reply_to_message.from.first_name;
      } else if (userParam) {
        // 判断是数字ID还是用户名
        if (/^\d+$/.test(userParam)) {
          userId = parseInt(userParam);
          username = `用户 ${userParam}`;
        } else {
          const usernameStr = userParam.startsWith('@') ? userParam.substring(1) : userParam;
          userId = `@${usernameStr}`;
          username = `@${usernameStr}`;
        }
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要解封的用户的消息，或使用: /unban <用户ID|@用户名>');
      }

      try {
        await bot.unbanChatMember(chatId, userId);
        await bot.sendMessage(chatId, `✅ 已解封 ${username}`);
        logger.info(`解封用户: ${username} (${userId}) in chat ${chatId}`);
      } catch (error) {
        logger.error('解封失败:', error);
        bot.sendMessage(chatId, '❌ 解封失败，请检查用户ID/用户名是否正确！');
      }
    });
  });

  // 删除消息命令 /del
  bot.onText(/\/del(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要删除的消息！');
      }

      try {
        await bot.deleteMessage(chatId, msg.reply_to_message.message_id);
        await bot.deleteMessage(chatId, msg.message_id);
        db.incrementStat(chatId, 'deletedMessages');
        logger.info(`删除消息 in chat ${chatId}`);
      } catch (error) {
        logger.error('删除消息失败:', error);
        bot.sendMessage(chatId, '❌ 删除失败，请检查bot权限！');
      }
    });
  });

  // 禁言命令 /mute [userId|@username] [minutes]
  bot.onText(/\/mute(?:@\w+)?(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1]?.trim();

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userId, username, duration = 0;

      // 优先使用回复消息
      if (msg.reply_to_message) {
        userId = msg.reply_to_message.from.id;
        username = msg.reply_to_message.from.username
          ? `@${msg.reply_to_message.from.username}`
          : msg.reply_to_message.from.first_name;
        // params 是分钟数
        if (params && /^\d+$/.test(params)) {
          duration = parseInt(params) * 60;
        }
      } else if (params) {
        // 解析参数：可能是 "userId" 或 "@username" 或 "userId 30" 或 "@username 30"
        const parts = params.split(/\s+/);
        const userPart = parts[0];
        const timePart = parts[1];

        // 判断用户参数是数字ID还是用户名
        if (/^\d+$/.test(userPart)) {
          userId = parseInt(userPart);
          username = `用户 ${userPart}`;
        } else {
          const usernameStr = userPart.startsWith('@') ? userPart.substring(1) : userPart;
          userId = `@${usernameStr}`;
          username = `@${usernameStr}`;
        }

        // 解析时间参数
        if (timePart && /^\d+$/.test(timePart)) {
          duration = parseInt(timePart) * 60;
        }
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要禁言的用户的消息，或使用: /mute <用户ID|@用户名> [分钟数]');
      }

      try {
        const untilDate = duration > 0 ? Math.floor(Date.now() / 1000) + duration : 0;

        await bot.restrictChatMember(chatId, userId, {
          until_date: untilDate,
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        const timeText = duration > 0 ? `${duration / 60}分钟` : '永久';
        await bot.sendMessage(chatId, `🔇 已禁言 ${username} (${timeText})`);
        db.incrementStat(chatId, 'mutes');
        logger.info(`禁言用户: ${username} (${userId}) for ${timeText} in chat ${chatId}`);
      } catch (error) {
        logger.error('禁言失败:', error);
        bot.sendMessage(chatId, '❌ 禁言失败，请检查bot权限或用户ID/用户名是否正确！');
      }
    });
  });

  // 解除禁言命令 /unmute [userId|@username]
  bot.onText(/\/unmute(?:@\w+)?(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userParam = match[1]?.trim();

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userId, username;

      // 优先使用回复消息，其次使用参数中的用户ID或用户名
      if (msg.reply_to_message) {
        userId = msg.reply_to_message.from.id;
        username = msg.reply_to_message.from.username
          ? `@${msg.reply_to_message.from.username}`
          : msg.reply_to_message.from.first_name;
      } else if (userParam) {
        // 判断是数字ID还是用户名
        if (/^\d+$/.test(userParam)) {
          userId = parseInt(userParam);
          username = `用户 ${userParam}`;
        } else {
          const usernameStr = userParam.startsWith('@') ? userParam.substring(1) : userParam;
          userId = `@${usernameStr}`;
          username = `@${usernameStr}`;
        }
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要解除禁言的用户的消息，或使用: /unmute <用户ID|@用户名>');
      }

      try {
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });

        await bot.sendMessage(chatId, `🔊 已解除 ${username} 的禁言`);
        logger.info(`解除禁言: ${username} (${userId}) in chat ${chatId}`);
      } catch (error) {
        logger.error('解除禁言失败:', error);
        bot.sendMessage(chatId, '❌ 解除禁言失败，请检查用户ID/用户名是否正确！');
      }
    });
  });

  // Pin消息命令 /pin
  bot.onText(/\/pin(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要置顶的消息！');
      }

      try {
        await bot.pinChatMessage(chatId, msg.reply_to_message.message_id);
        await bot.sendMessage(chatId, '📌 消息已置顶');
        logger.info(`置顶消息 in chat ${chatId}`);
      } catch (error) {
        logger.error('置顶失败:', error);
        bot.sendMessage(chatId, '❌ 置顶失败！');
      }
    });
  });

  // Unpin消息命令 /unpin
  bot.onText(/\/unpin(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      try {
        await bot.unpinChatMessage(chatId);
        await bot.sendMessage(chatId, '✅ 已取消置顶');
        logger.info(`取消置顶 in chat ${chatId}`);
      } catch (error) {
        logger.error('取消置顶失败:', error);
        bot.sendMessage(chatId, '❌ 取消置顶失败！');
      }
    });
  });
}

module.exports = setupAdminHandlers;
