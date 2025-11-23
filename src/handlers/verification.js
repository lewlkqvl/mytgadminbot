const { isBotAdmin } = require('../middleware/auth');
const config = require('../config/config');
const logger = require('../utils/logger');
const { generateCaptcha } = require('../utils/captcha');

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
        // 限制用户权限：只允许发送普通消息，不允许发送媒体、链接等
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: true,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        // 生成验证码（6位数字+字母）
        const captcha = generateCaptcha(6);
        const captchaText = captcha.text;
        const captchaImage = captcha.image;

        const verificationMessage = `
👋 欢迎 ${username}！

🤖 为了验证你不是机器人，请在 ${config.verificationTimeout} 秒内输入下方图片中的验证码。

⚠️ 注意：
- 验证码不区分大小写
- 请仔细识别字符
- 验证成功后即可正常使用
- 最多可尝试 3 次
        `.trim();

        // 发送验证消息
        const textMsg = await bot.sendMessage(chatId, verificationMessage);

        // 发送验证码图片
        const photoMsg = await bot.sendPhoto(chatId, captchaImage, {
          caption: '📷 请输入上图中的验证码'
        }, {
          filename: 'captcha.png',
          contentType: 'image/png'
        });

        // 保存验证信息
        pendingVerifications.set(userId, {
          chatId,
          captchaText: captchaText.toLowerCase(), // 转为小写以便不区分大小写比较
          textMessageId: textMsg.message_id,
          photoMessageId: photoMsg.message_id,
          username,
          timestamp: Date.now(),
          attempts: 0 // 尝试次数
        });

        // 设置超时
        const timeoutId = setTimeout(async () => {
          if (pendingVerifications.has(userId)) {
            try {
              await bot.kickChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);

              await bot.sendMessage(chatId, `⏰ ${username} 验证超时，已被移出群组`);

              // 删除验证消息
              bot.deleteMessage(chatId, textMsg.message_id).catch(() => {});
              bot.deleteMessage(chatId, photoMsg.message_id).catch(() => {});

              pendingVerifications.delete(userId);
              logger.info(`用户验证超时: ${username} in chat ${chatId}`);
            } catch (error) {
              logger.error('踢出未验证用户失败:', error);
            }
          }
        }, config.verificationTimeout * 1000);

        // 保存 timeout ID 以便在验证成功时清除
        pendingVerifications.get(userId).timeoutId = timeoutId;

        logger.info(`新用户需要验证: ${username} in chat ${chatId}, 验证码: ${captchaText}`);
      } catch (error) {
        logger.error('设置用户验证失败:', error);
      }
    }
  });

  // 监听消息进行验证
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith('/')) return; // 跳过命令

    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!pendingVerifications.has(userId)) {
      return;
    }

    const verification = pendingVerifications.get(userId);

    // 检查是否是正确的群组
    if (chatId !== verification.chatId) {
      return;
    }

    try {
      const userInput = msg.text.trim().toLowerCase();

      // 删除用户的输入消息
      await bot.deleteMessage(chatId, msg.message_id);

      if (userInput === verification.captchaText) {
        // 验证成功
        clearTimeout(verification.timeoutId);

        // 恢复完整权限
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        });

        const successMsg = await bot.sendMessage(chatId, `✅ ${verification.username} 验证成功，欢迎加入！`);

        // 删除验证消息和成功消息
        setTimeout(() => {
          bot.deleteMessage(chatId, verification.textMessageId).catch(() => {});
          bot.deleteMessage(chatId, verification.photoMessageId).catch(() => {});
          bot.deleteMessage(chatId, successMsg.message_id).catch(() => {});
        }, 3000);

        pendingVerifications.delete(userId);
        logger.info(`用户验证成功: ${verification.username} in chat ${chatId}`);
      } else {
        // 验证码错误
        verification.attempts += 1;

        if (verification.attempts >= 3) {
          // 3次失败，踢出
          clearTimeout(verification.timeoutId);

          await bot.kickChatMember(chatId, userId);
          await bot.unbanChatMember(chatId, userId);

          await bot.sendMessage(
            chatId,
            `❌ ${verification.username} 验证失败次数过多，已被移出群组`
          );

          // 删除验证消息
          bot.deleteMessage(chatId, verification.textMessageId).catch(() => {});
          bot.deleteMessage(chatId, verification.photoMessageId).catch(() => {});

          pendingVerifications.delete(userId);
          logger.info(`用户验证失败（3次）: ${verification.username} in chat ${chatId}`);
        } else {
          // 提示重试
          const remainingAttempts = 3 - verification.attempts;
          const errorMsg = await bot.sendMessage(
            chatId,
            `❌ ${verification.username} 验证码错误，还有 ${remainingAttempts} 次机会`,
            { reply_to_message_id: verification.photoMessageId }
          );

          // 3秒后删除错误提示
          setTimeout(() => {
            bot.deleteMessage(chatId, errorMsg.message_id).catch(() => {});
          }, 3000);

          logger.info(`用户验证失败: ${verification.username}, 剩余尝试次数: ${remainingAttempts}`);
        }
      }
    } catch (error) {
      logger.error('处理验证回答失败:', error);
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
