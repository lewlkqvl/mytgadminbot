const { requireAdmin, isBotAdmin } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

function setupAdminHandlers(bot) {
  // 踢人命令 /kick
  bot.onText(/\/kick(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      // 检查是否回复了某条消息
      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要踢出的用户的消息！');
      }

      const userToKick = msg.reply_to_message.from;
      const username = userToKick.username ? `@${userToKick.username}` : userToKick.first_name;

      try {
        await bot.kickChatMember(chatId, userToKick.id);
        // 立即解封，使其可以通过邀请链接重新加入
        await bot.unbanChatMember(chatId, userToKick.id);

        await bot.sendMessage(chatId, `✅ 已踢出 ${username}`);
        db.incrementStat(chatId, 'kicks');
        logger.info(`踢出用户: ${username} from chat ${chatId}`);
      } catch (error) {
        logger.error('踢人失败:', error);
        bot.sendMessage(chatId, '❌ 踢人失败，请检查bot权限！');
      }
    });
  });

  // 封禁命令 /ban
  bot.onText(/\/ban(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要封禁的用户的消息！');
      }

      const userToBan = msg.reply_to_message.from;
      const username = userToBan.username ? `@${userToBan.username}` : userToBan.first_name;

      try {
        await bot.kickChatMember(chatId, userToBan.id);
        await bot.sendMessage(chatId, `🚫 已封禁 ${username}`);
        db.incrementStat(chatId, 'bans');
        logger.info(`封禁用户: ${username} in chat ${chatId}`);
      } catch (error) {
        logger.error('封禁失败:', error);
        bot.sendMessage(chatId, '❌ 封禁失败，请检查bot权限！');
      }
    });
  });

  // 解封命令 /unban
  bot.onText(/\/unban(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要解封的用户的消息！');
      }

      const userToUnban = msg.reply_to_message.from;
      const username = userToUnban.username ? `@${userToUnban.username}` : userToUnban.first_name;

      try {
        await bot.unbanChatMember(chatId, userToUnban.id);
        await bot.sendMessage(chatId, `✅ 已解封 ${username}`);
        logger.info(`解封用户: ${username} in chat ${chatId}`);
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

  // 禁言命令 /mute
  bot.onText(/\/mute(?:@\w+)?(?: (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const duration = match[1] ? parseInt(match[1]) * 60 : 0; // 转换为秒，0表示永久

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要禁言的用户的消息！\n用法: /mute [分钟数]');
      }

      const userToMute = msg.reply_to_message.from;
      const username = userToMute.username ? `@${userToMute.username}` : userToMute.first_name;

      try {
        const untilDate = duration > 0 ? Math.floor(Date.now() / 1000) + duration : 0;

        await bot.restrictChatMember(chatId, userToMute.id, {
          until_date: untilDate,
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        const timeText = duration > 0 ? `${match[1]}分钟` : '永久';
        await bot.sendMessage(chatId, `🔇 已禁言 ${username} (${timeText})`);
        db.incrementStat(chatId, 'mutes');
        logger.info(`禁言用户: ${username} for ${timeText} in chat ${chatId}`);
      } catch (error) {
        logger.error('禁言失败:', error);
        bot.sendMessage(chatId, '❌ 禁言失败，请检查bot权限！');
      }
    });
  });

  // 解除禁言命令 /unmute
  bot.onText(/\/unmute(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      if (!await isBotAdmin(bot, chatId)) {
        return bot.sendMessage(chatId, '⚠️ Bot需要管理员权限才能执行此操作！');
      }

      if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ 请回复要解除禁言的用户的消息！');
      }

      const userToUnmute = msg.reply_to_message.from;
      const username = userToUnmute.username ? `@${userToUnmute.username}` : userToUnmute.first_name;

      try {
        await bot.restrictChatMember(chatId, userToUnmute.id, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });

        await bot.sendMessage(chatId, `🔊 已解除 ${username} 的禁言`);
        logger.info(`解除禁言: ${username} in chat ${chatId}`);
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
