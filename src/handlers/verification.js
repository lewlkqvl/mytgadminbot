const { isBotAdmin } = require('../middleware/auth');
const config = require('../config/config');
const logger = require('../utils/logger');

// 存储待验证的用户
const pendingVerifications = new Map();

function setupVerificationHandler(bot) {
  if (!config.enableVerification) {
    return;
  }

  // 处理新成员加入 - 需要验证
  bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    if (!await isBotAdmin(bot, chatId)) {
      return;
    }

    for (const member of newMembers) {
      // 跳过bot
      if (member.is_bot) continue;

      const userId = member.id;
      const username = member.username ? `@${member.username}` : member.first_name;

      try {
        // 先禁言用户
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        // 生成随机数学题
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const answer = num1 + num2;

        const verificationMessage = `
👋 欢迎 ${username}！

🤖 为了验证你不是机器人，请在 ${config.verificationTimeout} 秒内回答：

❓ ${num1} + ${num2} = ?

请直接发送答案数字。
        `.trim();

        const sentMsg = await bot.sendMessage(chatId, verificationMessage);

        // 保存验证信息
        pendingVerifications.set(userId, {
          chatId,
          answer,
          messageId: sentMsg.message_id,
          username,
          timestamp: Date.now()
        });

        // 设置超时
        setTimeout(async () => {
          if (pendingVerifications.has(userId)) {
            try {
              await bot.kickChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);
              await bot.sendMessage(chatId, `⏰ ${username} 验证超时，已被移出群组`);
              await bot.deleteMessage(chatId, sentMsg.message_id);

              pendingVerifications.delete(userId);
              logger.info(`用户验证超时: ${username} in chat ${chatId}`);
            } catch (error) {
              logger.error('踢出未验证用户失败:', error);
            }
          }
        }, config.verificationTimeout * 1000);

        logger.info(`新用户需要验证: ${username} in chat ${chatId}`);
      } catch (error) {
        logger.error('设置用户验证失败:', error);
      }
    }
  });

  // 监听验证回答
  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (pendingVerifications.has(userId)) {
      const verification = pendingVerifications.get(userId);
      const userAnswer = parseInt(msg.text.trim());

      try {
        // 删除用户的回答消息
        await bot.deleteMessage(chatId, msg.message_id);

        if (userAnswer === verification.answer) {
          // 验证成功，解除禁言
          await bot.restrictChatMember(chatId, userId, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          });

          await bot.sendMessage(chatId, `✅ ${verification.username} 验证成功，欢迎加入！`);
          await bot.deleteMessage(chatId, verification.messageId);

          pendingVerifications.delete(userId);
          logger.info(`用户验证成功: ${verification.username} in chat ${chatId}`);
        } else {
          // 答案错误
          await bot.sendMessage(
            chatId,
            `❌ ${verification.username} 答案错误，请重新回答`,
            { reply_to_message_id: verification.messageId }
          );
          logger.info(`用户验证失败: ${verification.username} in chat ${chatId}`);
        }
      } catch (error) {
        logger.error('处理验证回答失败:', error);
      }
    }
  });

  // 清理过期的验证（每分钟执行一次）
  setInterval(() => {
    const now = Date.now();
    for (const [userId, verification] of pendingVerifications.entries()) {
      if (now - verification.timestamp > config.verificationTimeout * 1000) {
        pendingVerifications.delete(userId);
      }
    }
  }, 60000);
}

module.exports = setupVerificationHandler;
