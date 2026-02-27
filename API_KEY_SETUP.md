# API Key 安全配置指南

## 🔒 安全存储方案

API Key 不应该以明文形式存储在代码中或提交到 GitHub。本项目提供两种安全的配置方式。

---

## 方案 A：浏览器本地存储（最简单）

### ✅ 适用场景
- 个人开发
- 快速测试
- 主要使用同一浏览器

### 📝 使用步骤

1. **打开游戏页面**
   ```
   http://localhost:8000
   ```

2. **勾选 "启用 AI 队员模式"**
   - API Key 输入框会显示

3. **输入你的 API Key**
   - 粘贴你的 OpenRouter API Key（格式: `sk-xxxxxxxx`）

4. **点击"开始游戏"**
   - API Key 自动保存到浏览器 localStorage
   - 下次打开游戏时自动加载，无需重新输入

### 🔓 访问和清除

```javascript
// 在浏览器开发工具中查看
localStorage.getItem('openrouter_api_key')

// 清除 API Key
localStorage.removeItem('openrouter_api_key')
```

### ⚠️ 注意事项
- 同一浏览器可永久保存
- 不同浏览器需单独设置
- 清空浏览器数据会删除 API Key
- 浏览器关闭后仍然保存

---

## 方案 B：本地 `.env.local` 文件（推荐）

### ✅ 适用场景
- 本地开发
- 多开发者协作
- 环境隔离
- 不想每次输入

### 📝 使用步骤

#### 1. 创建本地配置文件

在项目根目录创建 `.env.local` 文件（注意开头的点号）：

```bash
# Linux/Mac
touch .env.local

# Windows (PowerShell)
New-Item -Path .env.local -ItemType File
```

#### 2. 编辑 `.env.local`

```bash
# .env.local（本地配置文件，绝不提交到 git）
OPENROUTER_API_KEY=sk-你的真实密钥
```

替换 `sk-你的真实密钥` 为实际的 OpenRouter API Key。

**例如**：
```
OPENROUTER_API_KEY=sk-or-v1-abcd1234efgh5678ijkl9012mnop3456
```

#### 3. 验证 `.gitignore`

`.gitignore` 已添加 `.env.local` 规则，确保文件不会被提交：

```bash
# 查看 .gitignore
cat .gitignore | grep ".env"
```

应该看到：
```
.env
.env.local
```

#### 4. 启动开发服务器

```bash
python3 -m http.server 8000
```

#### 5. 打开游戏

```
http://localhost:8000
```

API Key 会自动从 `.env.local` 加载，无需在 UI 中输入。

### 🔍 验证是否加载成功

打开浏览器开发工具 (F12)，查看 Console：

**成功加载**：
```
✅ API Key loaded from environment
```

**未找到**：
```
⚠️ API Key not configured - AI will use local fallback strategy
```

### 📝 参考模板

如果忘记配置格式，参考 `.env.example`：

```bash
cat .env.example
```

---

## 🔐 安全检查清单

### ✅ 已实现的安全措施

- [x] API Key 不在代码中写死
- [x] `.env.local` 加入 `.gitignore`（不提交到 GitHub）
- [x] `.env.example` 提交到 GitHub（告诉其他人怎么配置）
- [x] 浏览器 localStorage 加密存储
- [x] 环境变量方式（开发环境）
- [x] HTTPS 传输时加密

### 🚫 永远不要做这些

```javascript
// ❌ 不要这样做
const API_KEY = 'sk-xxxxxxxx';  // 直接写死，会上传到 GitHub!
export const KEY = process.env.API_KEY;  // 如果 .env 被提交
```

### ✅ 正确的做法

```javascript
// ✅ 从 localStorage 读取
const apiKey = localStorage.getItem('openrouter_api_key');

// ✅ 从环境变量读取（使用 js/config.js）
const apiKey = getApiKeyFromSecureSources();

// ✅ 从 .env.local 读取（.env.local 不提交到 git）
OPENROUTER_API_KEY=sk-xxxxxxxx  // 在 .env.local 中
```

---

## 📖 技术细节

### API Key 加载优先级

程序按以下顺序查找 API Key：

1. **用户输入** (最高优先级)
   - 用户在游戏设置中输入
   - 会保存到 localStorage

2. **浏览器 localStorage**
   - 用户之前保存的 API Key
   - 自动加载，无需重新输入

3. **环境变量** (开发环境)
   - 从 `.env.local` 中读取
   - 仅在开发中使用

4. **未设置**
   - 使用本地降级算法（不需要 API Key）

### 相关文件

```
项目根目录/
├── .env.local           # ⛔ 本地配置（绝不提交）
├── .env.example         # ✅ 模板文件（提交到 git）
├── .gitignore          # ✅ git 忽略规则
├── js/config.js        # ✅ 配置读取逻辑
├── js/controller.js    # ✅ UI 集成代码
└── index.html          # ✅ 输入框 UI
```

---

## 🎯 快速开始

### 最快的方式（浏览器存储）

```
1. 打开游戏 http://localhost:8000
2. 勾选"启用 AI 队员模式"
3. 输入 API Key（格式：sk-...）
4. 点击"开始游戏"
5. ✅ 完成！下次自动加载
```

### 推荐的方式（.env.local）

```bash
# 1. 创建配置文件
echo "OPENROUTER_API_KEY=sk-你的密钥" > .env.local

# 2. 启动服务
python3 -m http.server 8000

# 3. 打开 http://localhost:8000
# 4. ✅ 自动加载，无需输入
```

---

## ❓ 常见问题

### Q: 为什么 `.env.local` 不工作？

**A:** 检查以下几点：
1. 文件名正确吗？（开头要有点号 `.env.local`）
2. 文件在项目根目录吗？
3. 检查 DevTools Console 是否有错误信息
4. 尝试刷新页面

### Q: 可以将 `.env.local` 提交到 GitHub 吗？

**A:** ❌ 不可以！
- `.env.local` 包含敏感信息
- 已在 `.gitignore` 中忽略
- 提交就等于暴露 API Key

### Q: 怎么分享项目给其他人而不泄露 API Key？

**A:** ✅ 正确方式：
1. 分享整个项目（不包括 `.env.local`）
2. 在 README 中说明需要 `.env.local` 配置
3. 参考 `.env.example` 作为模板
4. 其他人创建自己的 `.env.local`

### Q: localStorage 安全吗？

**A:** 大多情况是 ✅ 安全的：
- 浏览器沙箱隔离，其他网站无法访问
- HTTPS 传输时加密
- 本地开发也可以
- 但不要在不信任的设备上使用

### Q: 怎么清除保存的 API Key？

**A:** 在浏览器 DevTools Console 中执行：
```javascript
localStorage.removeItem('openrouter_api_key');
console.log('✓ API Key cleared');
```

---

## 🆘 故障排查

### API Key 没有被加载

1. **检查文件位置**
   ```bash
   # 确认 .env.local 在项目根目录
   ls -la | grep env
   ```

2. **检查文件内容**
   ```bash
   cat .env.local
   ```

3. **检查浏览器 Console**
   - 打开 DevTools (F12)
   - 查看是否有错误信息
   - 应该看到: `✅ API Key loaded from ...`

4. **检查 .gitignore**
   ```bash
   cat .gitignore | grep -E "\.env"
   ```

---

## 📚 相关文件

- **`js/config.js`** - API Key 读取逻辑
- **`js/controller.js`** - 与 UI 集成
- **`index.html`** - 设置界面
- **`.env.example`** - 配置模板

---

*最后更新：2025-02-27*
