const { requireAdmin } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

function setupAutoReplyHandler(bot) {
  // 添加自动回复 /autoreply add <触发词> | <回复内容>
  bot.onText(/\/autoreply(?:@\w+)? add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1];

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      const parts = params.split('|').map(p => p.trim());

      if (parts.length !== 2) {
        return bot.sendMessage(
          chatId,
          '❌ 格式错误！\n用法: /autoreply add <触发词> | <回复内容>\n例: /autoreply add 你好 | 欢迎！'
        );
      }

      const [trigger, response] = parts;
      db.addAutoReply(chatId, trigger, response);

      bot.sendMessage(chatId, `✅ 已添加自动回复:\n触发词: "${trigger}"\n回复: "${response}"`);
      logger.info(`添加自动回复 in chat ${chatId}: ${trigger} -> ${response}`);
    });
  });

  // 删除自动回复 /autoreply del <触发词>
  bot.onText(/\/autoreply(?:@\w+)? del (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const trigger = match[1].trim();

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      db.removeAutoReply(chatId, trigger);
      bot.sendMessage(chatId, `✅ 已删除自动回复: "${trigger}"`);
      logger.info(`删除自动回复 in chat ${chatId}: ${trigger}`);
    });
  });

  // 列出所有自动回复 /autoreply list
  bot.onText(/\/autoreply(?:@\w+)? list/, async (msg) => {
    const chatId = msg.chat.id;

    // 只允许在群组中使用
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      return bot.sendMessage(chatId, '❌ 此命令只能在群组中使用');
    }

    await requireAdmin(bot, msg, async () => {
      const replies = db.getAutoReplies(chatId);

      if (replies.length === 0) {
        return bot.sendMessage(chatId, '📝 暂无自动回复规则');
      }

      let text = '📝 自动回复列表:\n\n';
      replies.forEach((reply, index) => {
        text += `${index + 1}. "${reply.trigger}" → "${reply.response}"\n`;
      });

      bot.sendMessage(chatId, text);
    });
  });

  // 监听消息并触发自动回复
  bot.on('message', async (msg) => {
    // 只处理文本消息，跳过命令
    if (!msg.text || msg.text.startsWith('/')) return;

    // 只处理群组消息，不处理私聊（私聊用于验证）
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;

    const chatId = msg.chat.id;
    const reply = db.findAutoReply(chatId, msg.text);

    if (reply) {
      try {
        await bot.sendMessage(chatId, reply.response, {
          reply_to_message_id: msg.message_id
        });
        logger.info(`自动回复触发 in chat ${chatId}: ${reply.trigger}`);
      } catch (error) {
        logger.error('发送自动回复失败:', error);
      }
    }
  });
}

module.exports = setupAutoReplyHandler;
