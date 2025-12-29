# 清除缓存指南

## 方法 1: 使用命令行脚本（推荐）

### 本地运行：
```bash
cd /Users/jessicali/book-journey
npm run clear-cache
```

### 在 Railway 中运行：
1. 进入 Railway 项目
2. 点击服务名称
3. 点击 "Settings" → "Shell"
4. 运行命令：
```bash
npm run clear-cache
```

或者直接运行：
```bash
node clear-cache.js
```

---

## 方法 2: 使用 API 端点

### 通过 HTTP 请求清除缓存：

```bash
curl -X POST https://你的railway-url.railway.app/api/admin/clear-cache
```

或者在浏览器中打开（需要支持 POST 请求的工具，如 Postman）：
- URL: `https://你的railway-url.railway.app/api/admin/clear-cache`
- Method: `POST`

### 使用 JavaScript (在浏览器控制台)：
```javascript
fetch('https://你的railway-url.railway.app/api/admin/clear-cache', {
  method: 'POST'
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 什么时候需要清除缓存？

1. **修复了摘要生成问题后** - 需要重新生成所有摘要
2. **更新了 prompt 模板后** - 需要生成新格式的摘要
3. **发现摘要内容有问题** - 需要重新生成特定书籍的摘要
4. **测试新功能** - 需要清除缓存测试新逻辑

---

## 清除特定书籍的缓存

如果需要只清除特定书籍的缓存，可以：

1. **编辑 `data/cache.json` 文件**
2. **删除对应的书籍 ID 条目**
3. **保存文件**

例如，要清除书籍 ID 为 1 的缓存：
```json
{
  "1": { ... }  // 删除这一行
}
```

---

## 注意事项

- 清除缓存后，下次访问该书籍时会重新调用 DeepSeek API
- 这会消耗 API 额度，但确保内容是最新的
- 缓存文件会自动重新创建

---

**推荐：** 使用 `npm run clear-cache` 命令，最简单直接！

