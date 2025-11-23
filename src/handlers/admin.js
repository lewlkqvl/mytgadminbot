const { requireAdmin, isBotAdmin } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

function setupAdminHandlers(bot) {
  // 踢人命令 /kick [userId]
  bot.onText(/\/kick(?:@\w+)?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userIdParam = match[1];

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userToKick, username;

      // 优先使用回复消息，其次使用参数中的用户ID
      if (msg.reply_to_message) {
        userToKick = msg.reply_to_message.from;
        username = userToKick.username ? `@${userToKick.username}` : userToKick.first_name;
      } else if (userIdParam) {
        userToKick = { id: parseInt(userIdParam) };
        username = `用户 ${userIdParam}`;
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要踢出的用户的消息，或使用: /kick <用户ID>');
      }

      try {
        await bot.banChatMember(chatId, userToKick.id);
        // 立即解封，使其可以通过邀请链接重新加入
        await bot.unbanChatMember(chatId, userToKick.id);

        await bot.sendMessage(chatId, `✅ 已踢出 ${username}`);
        db.incrementStat(chatId, 'kicks');
        logger.info(`踢出用户: ${username} (${userToKick.id}) from chat ${chatId}`);
      } catch (error) {
        logger.error('踢人失败:', error);
        bot.sendMessage(chatId, '❌ 踢人失败，请检查bot权限！');
      }
    });
  });

  // 封禁命令 /ban [userId]
  bot.onText(/\/ban(?:@\w+)?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userIdParam = match[1];

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userToBan, username;

      // 优先使用回复消息，其次使用参数中的用户ID
      if (msg.reply_to_message) {
        userToBan = msg.reply_to_message.from;
        username = userToBan.username ? `@${userToBan.username}` : userToBan.first_name;
      } else if (userIdParam) {
        userToBan = { id: parseInt(userIdParam) };
        username = `用户 ${userIdParam}`;
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要封禁的用户的消息，或使用: /ban <用户ID>');
      }

      try {
        await bot.banChatMember(chatId, userToBan.id);
        await bot.sendMessage(chatId, `🚫 已封禁 ${username}`);
        db.incrementStat(chatId, 'bans');
        logger.info(`封禁用户: ${username} (${userToBan.id}) in chat ${chatId}`);
      } catch (error) {
        logger.error('封禁失败:', error);
        bot.sendMessage(chatId, '❌ 封禁失败，请检查bot权限！');
      }
    });
  });

  // 解封命令 /unban [userId]
  bot.onText(/\/unban(?:@\w+)?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userIdParam = match[1];

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userToUnban, username;

      // 优先使用回复消息，其次使用参数中的用户ID
      if (msg.reply_to_message) {
        userToUnban = msg.reply_to_message.from;
        username = userToUnban.username ? `@${userToUnban.username}` : userToUnban.first_name;
      } else if (userIdParam) {
        userToUnban = { id: parseInt(userIdParam) };
        username = `用户 ${userIdParam}`;
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要解封的用户的消息，或使用: /unban <用户ID>');
      }

      try {
        await bot.unbanChatMember(chatId, userToUnban.id);
        await bot.sendMessage(chatId, `✅ 已解封 ${username}`);
        logger.info(`解封用户: ${username} (${userToUnban.id}) in chat ${chatId}`);
      } catch (error) {
        logger.error('解封失败:', error);
        bot.sendMessage(chatId, '❌ 解封失败！');
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

  // 禁言命令 /mute [userId] [minutes]
  bot.onText(/\/mute(?:@\w+)?(?: (\d+))?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param1 = match[1]; // 可能是 userId 或 分钟数
    const param2 = match[2]; // 如果存在，一定是分钟数

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userToMute, username, duration;

      // 优先使用回复消息
      if (msg.reply_to_message) {
        userToMute = msg.reply_to_message.from;
        username = userToMute.username ? `@${userToMute.username}` : userToMute.first_name;
        duration = param1 ? parseInt(param1) * 60 : 0; // param1 是分钟数
      } else if (param1) {
        // 使用用户ID
        userToMute = { id: parseInt(param1) };
        username = `用户 ${param1}`;
        duration = param2 ? parseInt(param2) * 60 : 0; // param2 是分钟数
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要禁言的用户的消息，或使用: /mute <用户ID> [分钟数]');
      }

      try {
        const untilDate = duration > 0 ? Math.floor(Date.now() / 1000) + duration : 0;

        await bot.restrictChatMember(chatId, userToMute.id, {
          until_date: untilDate,
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        const timeText = duration > 0 ? `${duration / 60}分钟` : '永久';
        await bot.sendMessage(chatId, `🔇 已禁言 ${username} (${timeText})`);
        db.incrementStat(chatId, 'mutes');
        logger.info(`禁言用户: ${username} (${userToMute.id}) for ${timeText} in chat ${chatId}`);
      } catch (error) {
        logger.error('禁言失败:', error);
        bot.sendMessage(chatId, '❌ 禁言失败，请检查bot权限！');
      }
    });
  });

  // 解除禁言命令 /unmute [userId]
  bot.onText(/\/unmute(?:@\w+)?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userIdParam = match[1];

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      let userToUnmute, username;

      // 优先使用回复消息，其次使用参数中的用户ID
      if (msg.reply_to_message) {
        userToUnmute = msg.reply_to_message.from;
        username = userToUnmute.username ? `@${userToUnmute.username}` : userToUnmute.first_name;
      } else if (userIdParam) {
        userToUnmute = { id: parseInt(userIdParam) };
        username = `用户 ${userIdParam}`;
      } else {
        return bot.sendMessage(chatId, '❌ 请回复要解除禁言的用户的消息，或使用: /unmute <用户ID>');
      }

      try {
        await bot.restrictChatMember(chatId, userToUnmute.id, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });

        await bot.sendMessage(chatId, `🔊 已解除 ${username} 的禁言`);
        logger.info(`解除禁言: ${username} (${userToUnmute.id}) in chat ${chatId}`);
      } catch (error) {
        logger.error('解除禁言失败:', error);
        bot.sendMessage(chatId, '❌ 解除禁言失败！');
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
