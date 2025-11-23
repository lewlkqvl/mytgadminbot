const config = require('../config/config');

// 检查用户是否是管理员
async function isAdmin(bot, chatId, userId) {
  try {
    // 检查是否在配置的管理员列表中
    if (config.adminIds.includes(userId)) {
      return true;
    }

    // 检查是否是群组管理员
    const member = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(member.status);
  } catch (error) {
    return false;
  }
}

// 检查bot是否是管理员
async function isBotAdmin(bot, chatId) {
  try {
    const botInfo = await bot.getMe();
    const member = await bot.getChatMember(chatId, botInfo.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch (error) {
    return false;
  }
}

// 管理员命令中间件
async function requireAdmin(bot, msg, callback) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const adminStatus = await isAdmin(bot, chatId, userId);

  if (!adminStatus) {
    bot.sendMessage(chatId, '⛔ 此命令仅限管理员使用！');
    return false;
  }

  return callback();
}

module.exports = {
  isAdmin,
  isBotAdmin,
  requireAdmin
};
