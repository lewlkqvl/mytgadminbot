const config = require('../config/config');
const db = require('../database/db');
const logger = require('../utils/logger');

function setupWelcomeHandler(bot) {
  // 处理新成员加入
  bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    for (const member of newMembers) {
      // 跳过bot自己
      if (member.is_bot) continue;

      const username = member.username ? `@${member.username}` : member.first_name;
      const welcomeText = config.welcomeMessage.replace('{username}', username);

      try {
        await bot.sendMessage(chatId, `👋 ${welcomeText}`);
        db.incrementStat(chatId, 'newMembers');
        logger.info(`新成员加入: ${username} in chat ${chatId}`);
      } catch (error) {
        logger.error('发送欢迎消息失败:', error);
      }
    }
  });

  // 处理成员离开
  bot.on('left_chat_member', async (msg) => {
    const chatId = msg.chat.id;
    const member = msg.left_chat_member;

    if (member.is_bot) return;

    const username = member.username ? `@${member.username}` : member.first_name;
    logger.info(`成员离开: ${username} from chat ${chatId}`);
  });
}

module.exports = setupWelcomeHandler;
