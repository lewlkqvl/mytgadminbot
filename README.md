# Telegram 群组管理 Bot

一个功能完整的 Telegram 群组管理机器人，使用 Node.js 编写。

## 功能特性

### 👋 欢迎新成员
- 自动欢迎新加入的成员
- 可自定义欢迎消息
- 支持提及用户名

### 🚫 用户管理
- **踢人** - 移除用户但允许其重新加入
- **封禁** - 永久封禁用户
- **解封** - 解除用户封禁

### 🗑️ 消息管理
- **删除消息** - 删除违规消息
- **置顶/取消置顶** - 管理重要消息

### 🔇 禁言功能
- 临时禁言（可设置分钟数）
- 永久禁言
- 解除禁言

### 📊 群组统计
- 消息总数统计
- 新成员统计
- 踢人/封禁统计
- 删除消息统计
- 禁言次数统计

### 🤖 自动回复
- 添加关键词触发的自动回复
- 管理自动回复规则
- 查看所有自动回复列表

### 🛡️ 防垃圾信息
- 自动检测刷屏行为
- 检测并删除包含过多链接的消息
- 自动禁言垃圾信息发送者

### 📝 关键词过滤
- 添加/删除违禁关键词
- 自动删除包含违禁词的消息
- 查看过滤词列表

### 👥 用户验证（防机器人）
- 新成员加入需通过验证
- 数学题验证
- 验证超时自动踢出
- 可通过配置启用/禁用

## 安装

### 1. 克隆项目

```bash
git clone <repository-url>
cd telegram-group-admin-bot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
BOT_TOKEN=your_bot_token_here
ADMIN_IDS=123456789,987654321
WELCOME_MESSAGE=欢迎 {username} 加入群组！
VERIFICATION_TIMEOUT=60
ENABLE_VERIFICATION=true
ENABLE_ANTI_SPAM=true
SPAM_TIME_WINDOW=10
SPAM_MESSAGE_LIMIT=5
```

### 4. 运行 Bot

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## 获取 Bot Token

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 按提示设置机器人名称和用户名
4. 获得 Bot Token，复制到 `.env` 文件中

## 获取用户 ID

1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 向它发送任意消息
3. 它会返回你的用户 ID
4. 将 ID 添加到 `.env` 的 `ADMIN_IDS` 中

## Bot 权限设置

为了让 Bot 正常工作，需要将 Bot 添加到群组并授予管理员权限：

1. 将 Bot 添加到群组
2. 进入群组设置 → 管理员
3. 提升 Bot 为管理员
4. 至少授予以下权限：
   - 删除消息
   - 封禁用户
   - 邀请用户
   - 置顶消息
   - 管理聊天

## 命令列表

### 普通用户命令

| 命令 | 说明 |
|------|------|
| `/start` | 启动 Bot |
| `/help` | 显示帮助信息 |

### 管理员命令

#### 用户管理
| 命令 | 说明 | 用法 |
|------|------|------|
| `/kick` | 踢出用户 | 回复要踢出的用户的消息 |
| `/ban` | 封禁用户 | 回复要封禁的用户的消息 |
| `/unban` | 解封用户 | 回复要解封的用户的消息 |

#### 禁言管理
| 命令 | 说明 | 用法 |
|------|------|------|
| `/mute [分钟]` | 禁言用户 | 回复消息，可选分钟数 |
| `/unmute` | 解除禁言 | 回复要解除禁言的用户的消息 |

#### 消息管理
| 命令 | 说明 | 用法 |
|------|------|------|
| `/del` | 删除消息 | 回复要删除的消息 |
| `/pin` | 置顶消息 | 回复要置顶的消息 |
| `/unpin` | 取消置顶 | 直接使用 |

#### 关键词过滤
| 命令 | 说明 | 示例 |
|------|------|------|
| `/filter add <关键词>` | 添加过滤关键词 | `/filter add 广告` |
| `/filter del <关键词>` | 删除过滤关键词 | `/filter del 广告` |
| `/filter list` | 查看过滤列表 | `/filter list` |

#### 自动回复
| 命令 | 说明 | 示例 |
|------|------|------|
| `/autoreply add <触发词> \| <回复>` | 添加自动回复 | `/autoreply add 你好 \| 欢迎！` |
| `/autoreply del <触发词>` | 删除自动回复 | `/autoreply del 你好` |
| `/autoreply list` | 查看自动回复列表 | `/autoreply list` |

#### 统计
| 命令 | 说明 |
|------|------|
| `/stats` | 查看群组统计信息 |

## 项目结构

```
telegram-group-admin-bot/
├── src/
│   ├── config/
│   │   └── config.js           # 配置管理
│   ├── database/
│   │   └── db.js               # 数据存储
│   ├── handlers/
│   │   ├── admin.js            # 管理员命令处理
│   │   ├── autoReply.js        # 自动回复处理
│   │   ├── filter.js           # 关键词过滤和反垃圾
│   │   ├── help.js             # 帮助命令
│   │   ├── stats.js            # 统计功能
│   │   ├── verification.js     # 用户验证
│   │   └── welcome.js          # 欢迎新成员
│   ├── middleware/
│   │   └── auth.js             # 权限验证中间件
│   ├── utils/
│   │   └── logger.js           # 日志工具
│   └── index.js                # 主入口文件
├── data/                       # 数据存储目录（自动创建）
├── .env.example                # 环境变量示例
├── .gitignore
├── package.json
└── README.md
```

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BOT_TOKEN` | Bot Token（必填） | - |
| `ADMIN_IDS` | 管理员用户 ID，逗号分隔 | - |
| `WELCOME_MESSAGE` | 欢迎消息，{username} 会被替换为用户名 | `欢迎 {username} 加入群组！` |
| `ENABLE_VERIFICATION` | 是否启用用户验证 | `true` |
| `VERIFICATION_TIMEOUT` | 验证超时时间（秒） | `60` |
| `ENABLE_ANTI_SPAM` | 是否启用反垃圾信息 | `true` |
| `SPAM_TIME_WINDOW` | 垃圾信息检测时间窗口（秒） | `10` |
| `SPAM_MESSAGE_LIMIT` | 时间窗口内最大消息数 | `5` |

## 使用示例

### 1. 踢出用户
1. 回复要踢出的用户的任意消息
2. 发送 `/kick`

### 2. 禁言 10 分钟
1. 回复要禁言的用户的消息
2. 发送 `/mute 10`

### 3. 添加违禁词
```
/filter add 广告
```

### 4. 添加自动回复
```
/autoreply add 你好 | 欢迎来到我们的群组！
```

## 注意事项

1. **Bot 权限**：确保 Bot 具有足够的管理员权限
2. **用户验证**：首次使用建议在测试群组中测试验证功能
3. **反垃圾信息**：时间窗口和消息限制可根据群组活跃度调整
4. **数据存储**：数据保存在 `data/` 目录的 JSON 文件中
5. **命令格式**：所有命令都支持 `@bot_username` 后缀，适用于多 Bot 群组

## 故障排查

### Bot 无响应
- 检查 Bot Token 是否正确
- 确认网络连接正常
- 查看控制台错误日志

### 命令无效
- 确认 Bot 是群组管理员
- 检查命令格式是否正确
- 确认你有管理员权限

### 验证功能不工作
- 确认 `ENABLE_VERIFICATION=true`
- 检查 Bot 是否有限制用户的权限
- 查看用户加入时的日志

## 开发

### 添加新功能

1. 在 `src/handlers/` 创建新的处理器文件
2. 在 `src/index.js` 中导入并注册处理器
3. 更新 README 文档

### 日志

日志会自动输出到控制台，包含时间戳和日志级别。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持

如有问题或建议，请提交 Issue。
