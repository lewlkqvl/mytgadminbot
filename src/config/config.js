require('dotenv').config();

module.exports = {
  // Bot Token
  botToken: process.env.BOT_TOKEN,

  // Admin IDs
  adminIds: process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
    : [],

  // Welcome settings
  welcomeMessage: process.env.WELCOME_MESSAGE || '欢迎 {username} 加入群组！',

  // Verification settings
  enableVerification: process.env.ENABLE_VERIFICATION === 'true',
  verificationTimeout: parseInt(process.env.VERIFICATION_TIMEOUT) || 60,

  // Anti-spam settings
  enableAntiSpam: process.env.ENABLE_ANTI_SPAM === 'true',
  spamTimeWindow: parseInt(process.env.SPAM_TIME_WINDOW) || 10,
  spamMessageLimit: parseInt(process.env.SPAM_MESSAGE_LIMIT) || 5,
};
