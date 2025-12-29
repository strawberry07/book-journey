# 每日书旅 - 发布指南 (Step-by-Step Publishing Guide)

## 🚀 快速发布（推荐平台）

### 方法 1: Railway（最简单，推荐）⭐

**优点：** 免费额度充足，自动 HTTPS，5分钟部署

**步骤：**

1. **准备代码仓库**
   ```bash
   cd /Users/jessicali/book-journey
   git init
   git add .
   git commit -m "Initial commit"
   
   # 创建 GitHub 仓库并推送
   # 在 GitHub 上创建新仓库，然后：
   git remote add origin https://github.com/你的用户名/book-journey.git
   git branch -M main
   git push -u origin main
   ```

2. **部署到 Railway**
   - 访问 https://railway.app
   - 点击 "Start a New Project"
   - 选择 "Deploy from GitHub repo"
   - 授权 GitHub，选择你的 `book-journey` 仓库
   - Railway 会自动检测 Node.js 项目

3. **设置环境变量**
   - 在 Railway 项目页面，点击 "Variables"
   - 添加变量：
     - 名称: `DEEPSEEK_API_KEY`
     - 值: 你的 DeepSeek API Key
   - 点击 "Add"

4. **完成！**
   - Railway 会自动部署
   - 部署完成后，你会得到一个 URL（如：`https://book-journey-production.up.railway.app`）
   - 应用已经在线运行！

---

### 方法 2: Render（免费，简单）

**步骤：**

1. **准备 GitHub 仓库**（同上）

2. **部署到 Render**
   - 访问 https://render.com
   - 注册/登录账号
   - 点击 "New +" → "Web Service"
   - 连接你的 GitHub 仓库
   - 选择 `book-journey` 仓库

3. **配置服务**
   - **Name:** `book-journey`（或你喜欢的名字）
   - **Environment:** `Node`
   - **Build Command:** `npm install`（自动检测）
   - **Start Command:** `npm start`
   - **Plan:** Free（免费计划）

4. **设置环境变量**
   - 在 "Environment Variables" 部分
   - 添加：
     - Key: `DEEPSEEK_API_KEY`
     - Value: 你的 API Key

5. **部署**
   - 点击 "Create Web Service"
   - 等待部署完成（约 2-3 分钟）
   - 你会得到 URL：`https://book-journey.onrender.com`

---

### 方法 3: Fly.io（全球 CDN，速度快）

**步骤：**

1. **安装 Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **登录 Fly.io**
   ```bash
   fly auth login
   ```

3. **初始化项目**
   ```bash
   cd /Users/jessicali/book-journey
   fly launch
   ```
   - 选择应用名称
   - 选择区域（建议选择离用户近的）
   - 选择 "Postgres" → No（我们不需要数据库）

4. **设置环境变量**
   ```bash
   fly secrets set DEEPSEEK_API_KEY=你的API密钥
   ```

5. **部署**
   ```bash
   fly deploy
   ```

6. **查看 URL**
   ```bash
   fly open
   ```

---

### 方法 4: Vercel（适合静态+API）

**注意：** Vercel 主要支持 serverless，需要稍微调整代码结构。

**步骤：**

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **部署**
   ```bash
   cd /Users/jessicali/book-journey
   vercel
   ```

3. **设置环境变量**
   - 在 Vercel 项目设置中添加 `DEEPSEEK_API_KEY`

---

## 📋 发布前检查清单

### ✅ 代码准备

- [ ] 确保 `data/books.json` 包含所有书籍数据
- [ ] 检查 `package.json` 中的 `engines.node` 版本（需要 >=18）
- [ ] 确保 `.gitignore` 不包含敏感信息（API keys等）

### ✅ 环境变量

- [ ] 准备好 DeepSeek API Key
- [ ] 在部署平台设置 `DEEPSEEK_API_KEY` 环境变量

### ✅ 测试

- [ ] 本地测试：`npm start` 运行正常
- [ ] 测试所有功能：书籍加载、摘要生成、分享功能

---

## 🔧 创建 .gitignore（如果还没有）

创建 `/Users/jessicali/book-journey/.gitignore`：

```
node_modules/
data/cache.json
data/history.json
data/state.json
.env
.DS_Store
*.log
```

**注意：** `data/books.json` 应该提交到 Git，但缓存文件不需要。

---

## 🌐 自定义域名（可选）

### Railway
1. 在项目设置 → "Settings" → "Domains"
2. 添加你的域名
3. 按照提示配置 DNS

### Render
1. 在服务设置 → "Custom Domains"
2. 添加域名
3. 配置 DNS CNAME 记录

---

## 📊 监控和维护

### 查看日志

**Railway:**
- 在项目页面点击 "Deployments" → 查看日志

**Render:**
- 在服务页面点击 "Logs" 标签

**Fly.io:**
```bash
fly logs
```

### 重启服务

**Railway/Render:** 在平台界面点击 "Redeploy"

**Fly.io:**
```bash
fly restart
```

---

## 💰 成本估算

### 免费额度（通常足够使用）

- **Railway:** $5/月免费额度（足够运行小应用）
- **Render:** 免费计划（有休眠限制，但适合个人项目）
- **Fly.io:** 免费额度（3个共享CPU应用）

### API 费用

- DeepSeek API 按使用量计费
- 摘要会被缓存，每本书每个深度只生成一次
- 100本书 × 3个深度 = 最多 300 次 API 调用
- 之后都从缓存读取，无需额外费用

---

## 🆘 常见问题

### Q: 部署后显示 "Cannot GET /"？
**A:** 检查 `package.json` 中的 `start` 脚本是否正确。

### Q: 环境变量不生效？
**A:** 
- 确保变量名是 `DEEPSEEK_API_KEY`（全大写）
- 重启/重新部署服务
- 检查平台的环境变量设置页面

### Q: 如何更新代码？
**A:** 
```bash
git add .
git commit -m "Update"
git push
```
平台会自动重新部署。

### Q: 数据会丢失吗？
**A:** 
- Railway/Render: 数据存储在容器中，重启会保留
- 建议定期备份 `data/` 目录
- 可以将 `data/` 目录挂载到持久化存储

---

## 🎯 推荐方案

**新手推荐：** Railway 或 Render（最简单）  
**需要全球加速：** Fly.io  
**已有 VPS：** 使用 PM2 + Nginx（见 DEPLOYMENT.md）

---

## 📝 快速命令参考

```bash
# 本地测试
cd /Users/jessicali/book-journey
export DEEPSEEK_API_KEY="your-key"
npm start

# 推送到 GitHub（首次）
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/book-journey.git
git push -u origin main

# 更新代码
git add .
git commit -m "Update"
git push
```

---

**准备好了吗？选择上面的一个平台，5分钟内就能上线！** 🚀

