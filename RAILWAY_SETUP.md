# Railway 部署步骤 - 快速指南

## 📋 准备工作

1. **确保你有：**
   - GitHub 账号
   - Railway 账号（如果没有，去 https://railway.app 注册，可以用 GitHub 登录）
   - DeepSeek API Key

---

## 🚀 步骤 1: 初始化 Git 仓库

在你的终端运行：

```bash
cd /Users/jessicali/book-journey

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 每日书旅 app"
```

---

## 📤 步骤 2: 创建 GitHub 仓库并推送

### 2.1 在 GitHub 上创建新仓库

1. 访问 https://github.com/new
2. **Repository name:** `book-journey`（或你喜欢的名字）
3. **Description:** `每日书旅 - Daily Book Journey`
4. **Visibility:** Public 或 Private（都可以）
5. **不要**勾选 "Initialize with README"（我们已经有了代码）
6. 点击 "Create repository"

### 2.2 推送代码到 GitHub

GitHub 会显示命令，但这里是完整版本：

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/book-journey.git

# 重命名分支为 main（如果还没有）
git branch -M main

# 推送代码
git push -u origin main
```

如果提示输入用户名密码，使用 GitHub Personal Access Token（不是密码）。

---

## 🚂 步骤 3: 部署到 Railway

### 3.1 登录 Railway

1. 访问 https://railway.app
2. 点击 "Login" 或 "Start a New Project"
3. 选择 "Login with GitHub"
4. 授权 Railway 访问你的 GitHub

### 3.2 创建新项目

1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 在仓库列表中找到 `book-journey`
4. 点击它，Railway 会自动开始部署

### 3.3 设置环境变量

**重要：** 在部署完成前设置 API Key！

1. 在项目页面，点击 "Variables" 标签
2. 点击 "+ New Variable"
3. 添加：
   - **Key:** `DEEPSEEK_API_KEY`
   - **Value:** 你的 DeepSeek API Key
4. 点击 "Add"

### 3.4 等待部署完成

- Railway 会自动检测 Node.js 项目
- 会自动运行 `npm install`
- 会自动运行 `npm start`
- 通常需要 2-3 分钟

### 3.5 获取你的应用 URL

部署完成后：

1. 点击 "Settings" 标签
2. 在 "Domains" 部分，你会看到一个 URL，类似：
   - `https://book-journey-production.up.railway.app`
3. 点击这个 URL 就可以访问你的应用了！

---

## ✅ 验证部署

1. 打开你的 Railway URL
2. 应该能看到 "每日书旅" 首页
3. 点击深度按钮，测试摘要生成
4. 测试分享功能

---

## 🔄 更新代码

以后如果要更新代码：

```bash
cd /Users/jessicali/book-journey

# 修改代码后...
git add .
git commit -m "描述你的更改"
git push
```

Railway 会自动检测到 GitHub 的更新并重新部署！

---

## 🆘 常见问题

### Q: Railway 显示部署失败？
**A:** 
- 检查 "Deployments" 标签查看错误日志
- 确保 `package.json` 中有 `"start": "node server.js"`
- 确保 Node.js 版本 >= 18（在 `package.json` 的 `engines` 中指定）

### Q: 应用显示错误 "Missing DEEPSEEK_API_KEY"？
**A:** 
- 检查环境变量是否设置正确
- 变量名必须是 `DEEPSEEK_API_KEY`（全大写）
- 设置后需要重新部署（Railway 会自动重新部署）

### Q: 如何查看日志？
**A:** 
- 在 Railway 项目页面，点击 "Deployments"
- 选择最新的部署，查看日志

### Q: 如何自定义域名？
**A:** 
- 在 "Settings" → "Domains" 添加你的域名
- 按照提示配置 DNS 记录

---

## 💡 提示

- Railway 免费计划有 $5/月额度，足够运行小应用
- 应用会自动运行，不需要手动操作
- 数据（cache.json, history.json）会保存在 Railway 的存储中
- 如果担心数据丢失，可以定期备份 `data/` 目录

---

**准备好了吗？按照上面的步骤，10分钟内就能上线！** 🎉

