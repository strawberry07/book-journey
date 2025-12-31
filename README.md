# 每日书旅 📚

> 将书单转化为年度深度阅读之旅的移动优先 Web 应用

每日书旅是一个优雅的渐进式 Web 应用（PWA），每天为你精选一本好书，提供三种深度的阅读体验：3 分钟精华、10 分钟思考、30 分钟沉浸。通过智能轮播算法，为你打造一整年的阅读旅程。

## ✨ 功能特性

### 📖 核心功能
- **每日精选**：每 24 小时自动选择一本新书
- **三种深度**：
  - **3 分钟 · 精华**：400 字，快速了解书籍核心价值
  - **10 分钟 · 思考**：1200-1600 字，深入理解核心观点，包含生活应用示例和反思问题
  - **30 分钟 · 沉浸**：2000-3000 字，全面分析，包含跨学科连接和实际应用
- **日期导航**：浏览历史内容，回顾过往书籍
- **智能预生成**：自动提前生成未来内容，确保快速加载

### 🎨 用户体验
- **移动优先设计**：专为手机优化的响应式界面
- **新文人风格**：优雅的排版和配色，营造阅读氛围
- **PWA 支持**：可安装到主屏幕，支持离线访问
- **分享功能**：生成精美的分享卡片，支持下载和原生分享



## 📁 项目结构

```
book-journey/
├── server.js              # 主服务器文件
├── package.json           # 项目配置
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── app.js             # 前端逻辑
│   ├── styles.css         # 样式文件
│   ├── manifest.json      # PWA 配置
│   ├── sw.js              # Service Worker
│   └── logo.svg           # 应用图标
├── data/                  # 数据目录（不提交到 Git）
│   ├── books.json         # 书籍列表
│   ├── cache.json         # 摘要缓存
│   ├── history.json       # 选择历史
│   └── state.json         # 应用状态
├── test.js                # 测试脚本
└── README.md              # 本文件
```

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供 AI 摘要生成服务
- [html2canvas](https://html2canvas.hertzen.com/) - 分享卡片图片生成
- [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) - 中文字体

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/strawberry07/book-journey/issues)
- 访问应用：[在线地址](https://your-app-url.railway.app)

---

**每日书旅** · 读书便佳 📚

