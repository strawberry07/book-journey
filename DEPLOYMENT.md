# 每日书旅 - 部署指南 (Deployment Guide)

## 应用工作原理 (How the App Works)

这个应用是**完全自动化的**，你**不需要**每天手动运行它！

### 核心机制：

1. **日期驱动选择 (Date-Based Selection)**
   - 应用根据访问日期自动选择对应的书籍
   - 使用确定性算法：相同的日期总是返回相同的书籍
   - 确保14天内不重复（可轮播全年）

2. **按需生成摘要 (On-Demand Summary Generation)**
   - 当用户点击深度按钮时，才生成或获取摘要
   - 摘要会被缓存，避免重复API调用
   - 首次访问某本书时调用DeepSeek API，之后从缓存读取

3. **自动运行 (Always Running)**
   - 服务器需要持续运行（7x24小时）
   - 不需要定时任务或手动干预
   - 用户访问时自动处理所有逻辑

## 部署选项 (Deployment Options)

### 选项 1: 云服务器部署 (推荐)

#### 使用 VPS (如 DigitalOcean, Linode, AWS EC2)

```bash
# 1. 在服务器上克隆代码
git clone <your-repo-url>
cd book-journey

# 2. 安装依赖
npm install

# 3. 设置环境变量
export DEEPSEEK_API_KEY="your-api-key"

# 4. 使用 PM2 保持进程运行
npm install -g pm2
pm2 start server.js --name "book-journey"
pm2 save
pm2 startup  # 设置开机自启

# 5. 配置反向代理 (Nginx)
# /etc/nginx/sites-available/book-journey
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 使用 Heroku

```bash
# 1. 安装 Heroku CLI
# 2. 登录
heroku login

# 3. 创建应用
heroku create your-app-name

# 4. 设置环境变量
heroku config:set DEEPSEEK_API_KEY=your-api-key

# 5. 部署
git push heroku main

# 6. 应用会自动运行，无需手动操作
```

#### 使用 Railway / Render / Fly.io

这些平台都支持：
- 自动从 Git 部署
- 环境变量配置
- 自动保持应用运行
- HTTPS 自动配置

**步骤：**
1. 连接 GitHub 仓库
2. 设置 `DEEPSEEK_API_KEY` 环境变量
3. 部署完成，应用自动运行

### 选项 2: 本地运行（仅测试）

```bash
# 每次启动
export DEEPSEEK_API_KEY="your-key"
npm start
```

**注意：** 这种方式需要你的电脑一直开着，不适合生产环境。

## 重要配置 (Important Configuration)

### 环境变量

```bash
# 必需
DEEPSEEK_API_KEY=your-deepseek-api-key

# 可选
PORT=3000  # 默认 3000
```

### 数据持久化

应用会在 `data/` 目录存储：
- `books.json` - 书籍列表
- `cache.json` - 摘要缓存（节省API费用）
- `history.json` - 选择历史
- `state.json` - 当前状态

**确保这些文件在部署时被保留！**

## 常见问题 (FAQ)

### Q: 我需要每天手动运行吗？
**A: 不需要！** 应用会自动根据日期选择书籍。只要服务器运行，用户访问时就会看到当天的书籍。

### Q: 如何确保每天都有新书？
**A: 应用已经实现了14天不重复的逻辑。** 如果所有书都在14天内被选过，会自动开始轮播。

### Q: API费用会很高吗？
**A: 不会。** 摘要会被缓存，每本书的每个深度版本只生成一次。100本书 × 3个深度 = 最多300次API调用。

### Q: 如何更新书籍列表？
**A: 修改 `data/books.json`，然后重启服务器。**

### Q: 如何备份数据？
**A: 备份整个 `data/` 目录即可。**

## 性能优化建议 (Performance Tips)

1. **预生成摘要（可选）**
   ```bash
   # 可以写一个脚本预生成所有摘要
   # 但这不是必需的，因为摘要会按需生成并缓存
   ```

2. **使用 CDN**（如果静态资源很多）
   - 将 `public/` 目录放到 CDN
   - 只让服务器处理 API 请求

3. **监控 API 使用**
   - 定期检查 DeepSeek API 使用量
   - 查看 `data/cache.json` 了解缓存情况

## 总结 (Summary)

✅ **不需要每天手动运行**  
✅ **服务器持续运行即可**  
✅ **用户访问时自动处理**  
✅ **摘要自动缓存，节省费用**  
✅ **日期驱动，自动选择书籍**

只需部署一次，应用就会自动工作！

