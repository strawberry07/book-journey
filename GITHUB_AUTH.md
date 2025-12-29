# GitHub 认证设置指南

## 🔐 问题
GitHub 不再支持密码认证，需要使用 Personal Access Token (PAT) 或 SSH。

## ✅ 方法 1: Personal Access Token (推荐，最简单)

### 步骤 1: 创建 Personal Access Token

1. **访问 GitHub 设置**
   - 打开 https://github.com/settings/tokens
   - 或者：GitHub 右上角头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **生成新 Token**
   - 点击 "Generate new token" → "Generate new token (classic)"
   - **Note:** 输入描述，如 "book-journey deployment"
   - **Expiration:** 选择过期时间（建议 90 天或 No expiration）
   - **Scopes:** 勾选 `repo`（完整仓库访问权限）
   - 点击 "Generate token"

3. **复制 Token**
   - ⚠️ **重要：** Token 只显示一次，立即复制保存！
   - 格式类似：`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 步骤 2: 使用 Token 推送代码

**选项 A: 在 URL 中使用 Token（一次性）**

```bash
cd /Users/jessicali/book-journey

# 使用 Token 作为密码（替换 YOUR_TOKEN 和 YOUR_USERNAME）
git remote set-url origin https://YOUR_TOKEN@github.com/strawberry07/book-journey.git

# 然后推送
git push -u origin main
```

**选项 B: 使用 Git Credential Helper（推荐，更安全）**

```bash
cd /Users/jessicali/book-journey

# 推送时，用户名输入你的 GitHub 用户名，密码输入 Token
git push -u origin main

# 当提示时：
# Username: strawberry07
# Password: ghp_你的token（粘贴刚才复制的 token）
```

**选项 C: 使用 macOS Keychain（最方便，一次设置）**

```bash
cd /Users/jessicali/book-journey

# 配置 Git 使用 macOS Keychain
git config --global credential.helper osxkeychain

# 推送（第一次会提示输入用户名和 token，之后自动保存）
git push -u origin main
```

---

## ✅ 方法 2: SSH 密钥（更安全，长期使用）

### 步骤 1: 检查是否已有 SSH 密钥

```bash
ls -al ~/.ssh
```

如果看到 `id_rsa.pub` 或 `id_ed25519.pub`，跳到步骤 3。

### 步骤 2: 生成新的 SSH 密钥

```bash
# 生成 SSH 密钥（替换为你的 GitHub 邮箱）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 按 Enter 使用默认路径
# 可以设置密码（可选，更安全）
```

### 步骤 3: 添加 SSH 密钥到 GitHub

```bash
# 复制公钥内容
cat ~/.ssh/id_ed25519.pub
# 或者
cat ~/.ssh/id_rsa.pub
```

然后：
1. 访问 https://github.com/settings/keys
2. 点击 "New SSH key"
3. **Title:** 输入描述，如 "MacBook Pro"
4. **Key:** 粘贴刚才复制的公钥内容
5. 点击 "Add SSH key"

### 步骤 4: 测试 SSH 连接

```bash
ssh -T git@github.com
```

如果看到 "Hi strawberry07! You've successfully authenticated..." 就成功了！

### 步骤 5: 更改远程仓库 URL 为 SSH

```bash
cd /Users/jessicali/book-journey

# 更改远程 URL 为 SSH
git remote set-url origin git@github.com:strawberry07/book-journey.git

# 推送
git push -u origin main
```

---

## 🎯 推荐方案

**快速部署（现在就用）：** 方法 1 选项 B 或 C  
**长期使用：** 方法 2 (SSH)

---

## 🆘 如果还是有问题

### 检查远程仓库 URL

```bash
git remote -v
```

应该显示：
- HTTPS: `https://github.com/strawberry07/book-journey.git`
- SSH: `git@github.com:strawberry07/book-journey.git`

### 清除已保存的凭据（如果需要）

```bash
# macOS Keychain
git credential-osxkeychain erase
host=github.com
protocol=https
# 按两次 Enter

# 或者删除 Keychain 中的 GitHub 条目
# 打开 "钥匙串访问" → 搜索 "github" → 删除相关条目
```

---

**选择一种方法，按照步骤操作即可！** 🚀

