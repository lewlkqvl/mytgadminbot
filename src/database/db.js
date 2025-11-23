const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '../../data');
const STATS_FILE = path.join(DB_PATH, 'stats.json');
const FILTERS_FILE = path.join(DB_PATH, 'filters.json');
const AUTO_REPLIES_FILE = path.join(DB_PATH, 'auto_replies.json');

class Database {
  constructor() {
    this.stats = {};
    this.filters = [];
    this.autoReplies = [];
    this.userMessages = new Map(); // 用于反垃圾信息追踪
    this.initialized = false; // 初始化标志
  }

  async init() {
    // 防止重复初始化
    if (this.initialized) {
      logger.warn('数据库已经初始化，跳过重复初始化');
      return;
    }

    try {
      await fs.mkdir(DB_PATH, { recursive: true });
      await this.loadStats();
      await this.loadFilters();
      await this.loadAutoReplies();
      this.initialized = true;
      logger.info('数据库初始化成功');
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      throw error;
    }
  }

  // 统计数据管理
  async loadStats() {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf8');
      this.stats = JSON.parse(data);
    } catch (error) {
      this.stats = {};
    }
  }

  async saveStats() {
    try {
      await fs.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      logger.error('保存统计数据失败:', error);
    }
  }

  // 定期保存统计数据（防止频繁写入文件）
  scheduleSaveStats() {
    if (this.saveStatsTimer) {
      return;
    }
    this.saveStatsTimer = setTimeout(async () => {
      await this.saveStats();
      this.saveStatsTimer = null;
    }, 5000); // 5秒后保存
  }

  incrementStat(chatId, stat) {
    if (!this.stats[chatId]) {
      this.stats[chatId] = {
        messages: 0,
        newMembers: 0,
        kicks: 0,
        bans: 0,
        deletedMessages: 0,
        mutes: 0
      };
    }
    this.stats[chatId][stat] = (this.stats[chatId][stat] || 0) + 1;

    // 使用定时器批量保存，避免频繁写入
    this.scheduleSaveStats();
  }

  getStats(chatId) {
    return this.stats[chatId] || {
      messages: 0,
      newMembers: 0,
      kicks: 0,
      bans: 0,
      deletedMessages: 0,
      mutes: 0
    };
  }

  // 关键词过滤管理
  async loadFilters() {
    try {
      const data = await fs.readFile(FILTERS_FILE, 'utf8');
      this.filters = JSON.parse(data);
    } catch (error) {
      this.filters = [];
    }
  }

  async saveFilters() {
    try {
      await fs.writeFile(FILTERS_FILE, JSON.stringify(this.filters, null, 2));
    } catch (error) {
      logger.error('保存过滤器失败:', error);
    }
  }

  addFilter(chatId, keyword) {
    const filter = { chatId, keyword: keyword.toLowerCase() };
    this.filters.push(filter);
    this.saveFilters();
  }

  removeFilter(chatId, keyword) {
    this.filters = this.filters.filter(
      f => !(f.chatId === chatId && f.keyword === keyword.toLowerCase())
    );
    this.saveFilters();
  }

  getFilters(chatId) {
    return this.filters.filter(f => f.chatId === chatId);
  }

  checkFilter(chatId, text) {
    const chatFilters = this.getFilters(chatId);
    const lowerText = text.toLowerCase();
    return chatFilters.some(f => lowerText.includes(f.keyword));
  }

  // 自动回复管理
  async loadAutoReplies() {
    try {
      const data = await fs.readFile(AUTO_REPLIES_FILE, 'utf8');
      this.autoReplies = JSON.parse(data);
    } catch (error) {
      this.autoReplies = [];
    }
  }

  async saveAutoReplies() {
    try {
      await fs.writeFile(AUTO_REPLIES_FILE, JSON.stringify(this.autoReplies, null, 2));
    } catch (error) {
      logger.error('保存自动回复失败:', error);
    }
  }

  addAutoReply(chatId, trigger, response) {
    const reply = { chatId, trigger: trigger.toLowerCase(), response };
    this.autoReplies.push(reply);
    this.saveAutoReplies();
  }

  removeAutoReply(chatId, trigger) {
    this.autoReplies = this.autoReplies.filter(
      r => !(r.chatId === chatId && r.trigger === trigger.toLowerCase())
    );
    this.saveAutoReplies();
  }

  getAutoReplies(chatId) {
    return this.autoReplies.filter(r => r.chatId === chatId);
  }

  findAutoReply(chatId, text) {
    const lowerText = text.toLowerCase();
    return this.autoReplies.find(
      r => r.chatId === chatId && lowerText.includes(r.trigger)
    );
  }

  // 反垃圾信息追踪
  trackMessage(userId, chatId) {
    const key = `${chatId}_${userId}`;
    const now = Date.now();

    if (!this.userMessages.has(key)) {
      this.userMessages.set(key, []);
    }

    const messages = this.userMessages.get(key);
    messages.push(now);

    // 清理过期消息
    const validMessages = messages.filter(
      time => now - time < 10000 // 保留最近10秒的消息
    );
    this.userMessages.set(key, validMessages);

    return validMessages.length;
  }

  clearUserMessages(userId, chatId) {
    const key = `${chatId}_${userId}`;
    this.userMessages.delete(key);
  }
}

module.exports = new Database();
