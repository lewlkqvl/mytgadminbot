const { isAdmin } = require('../middleware/auth');

function setupHelpHandler(bot) {
  bot.onText(/\/help(?:@\w+)?/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userIsAdmin = await isAdmin(bot, chatId, userId);

    const generalHelp = `
🤖 Telegram 群组管理 Bot

📚 普通用户命令:
/help - 显示此帮助信息
/stats - 查看群组统计（仅管理员）
    `.trim();

    const adminHelp = `
⚙️ 管理员命令:

👥 用户管理:
/kick - 踢出用户（回复消息使用）
/ban - 封禁用户（回复消息使用）
/unban - 解封用户（回复消息使用）

🔇 禁言管理:
/mute [分钟] - 禁言用户（回复消息使用）
/unmute - 解除禁言（回复消息使用）

🗑️ 消息管理:
/del - 删除消息（回复消息使用）
/pin - 置顶消息（回复消息使用）
/unpin - 取消置顶

📝 关键词过滤:
/filter add <关键词> - 添加过滤关键词
/filter del <关键词> - 删除过滤关键词
/filter list - 查看所有过滤关键词

🤖 自动回复:
/autoreply add <触发词> | <回复> - 添加自动回复
/autoreply del <触发词> - 删除自动回复
/autoreply list - 查看所有自动回复

📊 统计:
/stats - 查看群组统计信息

💡 提示:
- 回复某条消息后使用命令可对该用户执行操作
- /mute 不加分钟数则永久禁言
- 自动回复格式: /autoreply add 你好 | 欢迎！
    `.trim();

    if (userIsAdmin) {
      bot.sendMessage(chatId, generalHelp + '\n\n' + adminHelp);
    } else {
      bot.sendMessage(chatId, generalHelp);
    }
  });

  // /start 命令
  bot.onText(/\/start(?:@\w+)?/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      '👋 你好！我是群组管理 Bot。\n\n使用 /help 查看可用命令。'
    );
  });
}

module.exports = setupHelpHandler;
