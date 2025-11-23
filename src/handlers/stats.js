const { requireAdmin } = require('../middleware/auth');
const db = require('../database/db');

function setupStatsHandler(bot) {
  // 统计命令 /stats
  bot.onText(/\/stats(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;

    await requireAdmin(bot, msg, async () => {
      const stats = db.getStats(chatId);

      const statsText = `
📊 群组统计信息

💬 消息总数: ${stats.messages}
👥 新成员: ${stats.newMembers}
👢 踢出: ${stats.kicks}
🚫 封禁: ${stats.bans}
🗑️ 删除消息: ${stats.deletedMessages}
🔇 禁言: ${stats.mutes}
      `.trim();

      bot.sendMessage(chatId, statsText);
    });
  });

  // 追踪所有消息用于统计
  bot.on('message', (msg) => {
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      db.incrementStat(msg.chat.id, 'messages');
    }
  });
}

module.exports = setupStatsHandler;
