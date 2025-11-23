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
        const correctAnswer = num1 + num2;

        // 生成错误答案选项
        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
          const wrong = correctAnswer + Math.floor(Math.random() * 10) - 5;
          if (wrong !== correctAnswer && wrong > 0 && !wrongAnswers.includes(wrong)) {
            wrongAnswers.push(wrong);
          }
        }

        // 混合正确答案和错误答案
        const allAnswers = [correctAnswer, ...wrongAnswers];
        // 随机排序
        allAnswers.sort(() => Math.random() - 0.5);

        // 创建内联键盘
        const keyboard = {
          inline_keyboard: [
            allAnswers.map(ans => ({
              text: ans.toString(),
              callback_data: `verify_${userId}_${ans}`
            }))
          ]
        };

        const verificationMessage = `
👋 欢迎 ${username}！

🤖 为了验证你不是机器人，请在 ${config.verificationTimeout} 秒内点击正确答案：

❓ ${num1} + ${num2} = ?

请点击下方按钮选择答案。
        `.trim();

        const sentMsg = await bot.sendMessage(chatId, verificationMessage, {
          reply_markup: keyboard
        });

        // 保存验证信息
        pendingVerifications.set(userId, {
          chatId,
          correctAnswer,
          messageId: sentMsg.message_id,
          username,
          timestamp: Date.now()
        });

        // 设置超时
        const timeoutId = setTimeout(async () => {
          if (pendingVerifications.has(userId)) {
            try {
              await bot.kickChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);

              // 编辑消息显示超时
              await bot.editMessageText(
                `⏰ ${username} 验证超时，已被移出群组`,
                {
                  chat_id: chatId,
                  message_id: sentMsg.message_id
                }
              );

              // 3秒后删除消息
              setTimeout(() => {
                bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
              }, 3000);

              pendingVerifications.delete(userId);
              logger.info(`用户验证超时: ${username} in chat ${chatId}`);
            } catch (error) {
              logger.error('踢出未验证用户失败:', error);
            }
          }
        }, config.verificationTimeout * 1000);

        // 保存 timeout ID 以便在验证成功时清除
        pendingVerifications.get(userId).timeoutId = timeoutId;

        logger.info(`新用户需要验证: ${username} in chat ${chatId}`);
      } catch (error) {
        logger.error('设置用户验证失败:', error);
      }
    }
  });

  // 处理验证按钮点击
  bot.on('callback_query', async (query) => {
    const data = query.data;

    // 检查是否是验证回调
    if (!data.startsWith('verify_')) {
      return;
    }

    const parts = data.split('_');
    const userId = parseInt(parts[1]);
    const selectedAnswer = parseInt(parts[2]);

    // 检查是否是本人点击
    if (query.from.id !== userId) {
      return bot.answerCallbackQuery(query.id, {
        text: '⚠️ 这不是你的验证消息！',
        show_alert: true
      });
    }

    if (!pendingVerifications.has(userId)) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ 验证已过期',
        show_alert: false
      });
    }

    const verification = pendingVerifications.get(userId);
    const chatId = verification.chatId;

    try {
      if (selectedAnswer === verification.correctAnswer) {
        // 验证成功
        clearTimeout(verification.timeoutId);

        // 解除禁言
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });

        // 编辑消息显示成功
        await bot.editMessageText(
          `✅ ${verification.username} 验证成功，欢迎加入！`,
          {
            chat_id: chatId,
            message_id: verification.messageId
          }
        );

        // 3秒后删除消息
        setTimeout(() => {
          bot.deleteMessage(chatId, verification.messageId).catch(() => {});
        }, 3000);

        bot.answerCallbackQuery(query.id, {
          text: '✅ 验证成功！',
          show_alert: false
        });

        pendingVerifications.delete(userId);
        logger.info(`用户验证成功: ${verification.username} in chat ${chatId}`);
      } else {
        // 答案错误
        bot.answerCallbackQuery(query.id, {
          text: '❌ 答案错误，请重新选择',
          show_alert: true
        });
        logger.info(`用户验证失败: ${verification.username} 选择了错误答案 ${selectedAnswer}`);
      }
    } catch (error) {
      logger.error('处理验证回答失败:', error);
      bot.answerCallbackQuery(query.id, {
        text: '❌ 处理失败，请重试',
        show_alert: false
      });
    }
  });

  // 清理过期的验证（每分钟执行一次）
  setInterval(() => {
    const now = Date.now();
    for (const [userId, verification] of pendingVerifications.entries()) {
      if (now - verification.timestamp > config.verificationTimeout * 1000) {
        clearTimeout(verification.timeoutId);
        pendingVerifications.delete(userId);
      }
    }
  }, 60000);
}

module.exports = setupVerificationHandler;
