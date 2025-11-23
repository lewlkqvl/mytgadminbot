const { isBotAdmin } = require('../middleware/auth');
const config = require('../config/config');
const logger = require('../utils/logger');
const { generateCaptcha } = require('../utils/captcha');

// 存储待验证的用户
// 结构: userId -> { groupChatId, username, timestamp, captchaText, attempts, timeoutId, instructionMsgId }
const pendingVerifications = new Map();

// 存储 bot 用户名
let botUsername = null;

function setupVerificationHandler(bot) {
  if (!config.enableVerification) {
    return;
  }

  // 获取 bot 用户名
  bot.getMe().then(me => {
    botUsername = me.username;
    logger.info(`Bot 用户名: @${botUsername}`);
  }).catch(err => {
    logger.error('获取 bot 信息失败:', err);
  });

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
        // 完全禁言用户：不允许发送任何消息
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        });

        logger.info(`已禁言新用户: ${username} in chat ${chatId}`);

        // 发送指引消息，告知用户需要私聊 bot 进行验证
        const botLink = botUsername ? `@${botUsername}` : 'bot';
        const instructionMessage = `
👋 欢迎 ${username}！

🔒 为了验证你不是机器人，请私聊 ${botLink} 并发送 /start 完成验证。

⚠️ 注意：
- 请在 ${config.verificationTimeout} 秒内完成验证
- 验证成功后即可正常发言
- 最多可尝试 3 次
        `.trim();

        const instructionMsg = await bot.sendMessage(chatId, instructionMessage);

        // 保存验证信息（此时还没有验证码）
        pendingVerifications.set(userId, {
          groupChatId: chatId,
          username,
          timestamp: Date.now(),
          captchaText: null, // 等用户私聊时再生成
          attempts: 0,
          instructionMsgId: instructionMsg.message_id,
          captchaSent: false // 标记是否已发送验证码
        });

        // 设置超时
        const timeoutId = setTimeout(async () => {
          if (pendingVerifications.has(userId)) {
            try {
              await bot.banChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);

              await bot.sendMessage(chatId, `⏰ ${username} 验证超时，已被移出群组`);

              // 删除指引消息
              bot.deleteMessage(chatId, instructionMsg.message_id).catch(() => {});

              pendingVerifications.delete(userId);
              logger.info(`用户验证超时: ${username} in chat ${chatId}`);
            } catch (error) {
              logger.error('踢出未验证用户失败:', error);
            }
          }
        }, config.verificationTimeout * 1000);

        // 保存 timeout ID
        pendingVerifications.get(userId).timeoutId = timeoutId;

        logger.info(`新用户需要验证: ${username} (${userId}) from group ${chatId}`);
      } catch (error) {
        logger.error('设置用户验证失败:', error);
      }
    }
  });

  // 处理私聊消息
  bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // 只处理私聊消息
    if (msg.chat.type !== 'private') {
      return;
    }

    // 检查用户是否在待验证列表中
    if (!pendingVerifications.has(userId)) {
      // 用户没有待验证，但可能是新用户想验证
      if (msg.text === '/start') {
        await bot.sendMessage(
          chatId,
          '👋 你好！\n\n如果你是新加入群组的成员，系统会自动提示你进行验证。\n\n如果你已经在群组中，无需额外验证。'
        );
      }
      return;
    }

    const verification = pendingVerifications.get(userId);

    // 处理 /start 命令 - 发送验证码
    if (msg.text === '/start') {
      if (verification.captchaSent) {
        await bot.sendMessage(
          chatId,
          '⚠️ 验证码已发送，请直接回复验证码。\n\n如果看不清，请联系管理员。'
        );
        return;
      }

      try {
        // 生成验证码
        const captcha = generateCaptcha(6);
        const captchaText = captcha.text;
        const captchaImage = captcha.image;

        const verificationMessage = `
🤖 请输入下方图片中的验证码

⚠️ 注意：
- 验证码不区分大小写
- 请仔细识别字符
- 最多可尝试 3 次
- 验证成功后即可在群组中发言
        `.trim();

        await bot.sendMessage(chatId, verificationMessage);

        // 发送验证码图片
        await bot.sendPhoto(chatId, captchaImage, {
          caption: '📷 请输入上图中的验证码',
          contentType: 'image/png'
        }, {
          filename: 'captcha.png'
        });

        // 更新验证信息
        verification.captchaText = captchaText.toLowerCase();
        verification.captchaSent = true;

        logger.info(`已向用户 ${verification.username} (${userId}) 发送验证码: ${captchaText}`);
      } catch (error) {
        logger.error('发送验证码失败:', error);
        await bot.sendMessage(chatId, '❌ 发送验证码失败，请稍后重试或联系管理员。');
      }
      return;
    }

    // 处理验证码输入
    if (!msg.text) {
      await bot.sendMessage(chatId, '⚠️ 请输入验证码文本。');
      return;
    }

    // 如果还没发送验证码，提示用户先发送 /start
    if (!verification.captchaSent) {
      await bot.sendMessage(
        chatId,
        '⚠️ 请先发送 /start 获取验证码。'
      );
      return;
    }

    const userInput = msg.text.trim().toLowerCase();

    logger.info(`收到用户 ${verification.username} (${userId}) 的验证输入: ${msg.text}`);
    logger.info(`验证码比对: 用户输入="${userInput}", 正确答案="${verification.captchaText}"`);

    try {
      if (userInput === verification.captchaText) {
        // 验证成功
        logger.info(`✅ 验证成功: ${verification.username} (${userId})`);
        clearTimeout(verification.timeoutId);

        // 在群组中恢复用户权限
        try {
          await bot.restrictChatMember(verification.groupChatId, userId, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          });
          logger.info(`已恢复用户权限: ${verification.username} in group ${verification.groupChatId}`);
        } catch (permError) {
          logger.error(`恢复用户权限失败:`, permError.message);
        }

        // 私聊通知验证成功
        await bot.sendMessage(chatId, `✅ 验证成功！你现在可以在群组中正常发言了。`);

        // 群组通知
        const successMsg = await bot.sendMessage(
          verification.groupChatId,
          `✅ ${verification.username} 验证成功，欢迎加入！`
        );

        // 删除群组中的指引消息和成功消息
        setTimeout(() => {
          bot.deleteMessage(verification.groupChatId, verification.instructionMsgId).catch(() => {});
          bot.deleteMessage(verification.groupChatId, successMsg.message_id).catch(() => {});
        }, 5000);

        pendingVerifications.delete(userId);
        logger.info(`用户验证成功: ${verification.username} (${userId}) for group ${verification.groupChatId}`);
      } else {
        // 验证码错误
        verification.attempts += 1;
        logger.info(`❌ 验证失败: ${verification.username} (${userId}), 尝试次数: ${verification.attempts}/3`);

        if (verification.attempts >= 3) {
          // 3次失败，踢出群组
          logger.info(`⛔ 3次验证失败，踢出用户: ${verification.username} (${userId})`);
          clearTimeout(verification.timeoutId);

          try {
            await bot.banChatMember(verification.groupChatId, userId);
            await bot.unbanChatMember(verification.groupChatId, userId);
            logger.info(`已踢出用户: ${verification.username}`);
          } catch (kickError) {
            logger.error(`踢出用户失败:`, kickError.message);
          }

          // 私聊通知
          await bot.sendMessage(
            chatId,
            `❌ 验证失败次数过多（3次），你已被移出群组。`
          );

          // 群组通知
          await bot.sendMessage(
            verification.groupChatId,
            `❌ ${verification.username} 验证失败次数过多，已被移出群组`
          );

          // 删除群组中的指引消息
          bot.deleteMessage(verification.groupChatId, verification.instructionMsgId).catch(() => {});

          pendingVerifications.delete(userId);
          logger.info(`用户验证失败（3次）: ${verification.username} (${userId}) from group ${verification.groupChatId}`);
        } else {
          // 提示重试
          const remainingAttempts = 3 - verification.attempts;
          await bot.sendMessage(
            chatId,
            `❌ 验证码错误，还有 ${remainingAttempts} 次机会\n\n请重新输入验证码。`
          );

          logger.info(`用户验证失败: ${verification.username} (${userId}), 剩余尝试次数: ${remainingAttempts}`);
        }
      }
    } catch (error) {
      logger.error('处理验证回答失败:', error);
      await bot.sendMessage(chatId, '❌ 处理验证时出错，请稍后重试或联系管理员。');
    }
  });

  // 清理过期的验证（每分钟执行一次）
  setInterval(() => {
    const now = Date.now();
    for (const [userId, verification] of pendingVerifications.entries()) {
      if (now - verification.timestamp > config.verificationTimeout * 1000) {
        clearTimeout(verification.timeoutId);
        pendingVerifications.delete(userId);
        logger.info(`清理过期验证: userId ${userId}`);
      }
    }
  }, 60000);
}

module.exports = setupVerificationHandler;
