# 清除缓存指南

## 🎯 智能缓存管理

脚本会自动检测有问题的缓存（三个版本相同或缺失），只清除有问题的，保留正常的缓存。

---

## 方法 1: 使用命令行脚本（推荐）

### 1. 列出所有缓存（查看哪些有问题）

```bash
npm run clear-cache list
# 或简写
npm run clear-cache
```

这会显示：
- 所有已缓存的书籍
- 哪些缓存有问题（三个版本相同或缺失）
- 问题详情

### 2. 只清除有问题的缓存

脚本会自动检测并提示，然后你可以：

```bash
# 清除特定书籍的缓存（例如：书籍 ID 1, 2, 3）
npm run clear-cache clear 1 2 3

# 清除单个书籍
npm run clear-cache clear 5
```

### 3. 清除所有缓存（谨慎使用）

```bash
npm run clear-cache clear all
```

---

## 方法 2: 使用 API 端点

### 1. 查看缓存状态

```bash
curl https://你的railway-url.railway.app/api/admin/cache
```

或在浏览器控制台：
```javascript
fetch('https://你的railway-url.railway.app/api/admin/cache')
  .then(res => res.json())
  .then(data => {
    console.log('Total cached:', data.total);
    console.log('Problematic:', data.problematic);
    console.log('Problematic IDs:', data.problematicIds);
  });
```

### 2. 清除特定书籍的缓存

```bash
curl -X POST https://你的railway-url.railway.app/api/admin/clear-cache \
  -H "Content-Type: application/json" \
  -d '{"bookIds": [1, 2, 3]}'
```

或在浏览器控制台：
```javascript
fetch('https://你的railway-url.railway.app/api/admin/clear-cache', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bookIds: [1, 2, 3] })
})
.then(res => res.json())
.then(data => console.log(data));
```

### 3. 清除所有缓存

```bash
curl -X POST https://你的railway-url.railway.app/api/admin/clear-cache \
  -H "Content-Type: application/json" \
  -d '{"bookIds": null}'
```

---

## 📋 使用示例

### 场景 1: 检查哪些缓存有问题

```bash
npm run clear-cache list
```

输出示例：
```
📚 Cached Books Summary:
   Total cached: 50 books

🔍 Checking for problematic entries...
   ⚠️  Found 3 problematic entries:
      - ID 5: 《某本书》 (Identical versions)
      - ID 12: 《另一本书》 (Missing versions)
      - ID 23: 《第三本书》 (Identical versions)
```

### 场景 2: 清除有问题的缓存

```bash
# 先查看
npm run clear-cache list

# 然后清除有问题的（假设是 ID 5, 12, 23）
npm run clear-cache clear 5 12 23
```

### 场景 3: 在 Railway 中使用

1. 进入 Railway 项目
2. 点击服务 → "Settings" → "Shell"
3. 运行：
```bash
npm run clear-cache list
npm run clear-cache clear 5 12 23
```

---

## ⚠️ 注意事项

- **只清除有问题的缓存** - 保留正常工作的缓存，节省 API 费用
- **清除后会自动重新生成** - 下次访问时会调用 DeepSeek API 重新生成
- **检查后再清除** - 先用 `list` 命令查看，确认哪些需要清除

---

## 🎯 推荐工作流程

1. **发现问题后**：运行 `npm run clear-cache list` 查看哪些有问题
2. **只清除有问题的**：运行 `npm run clear-cache clear <id1> <id2> ...`
3. **测试**：访问这些书籍，确认新生成的摘要正常
4. **保留正常的缓存**：不要清除所有缓存，只清除有问题的

---

**推荐：** 使用 `npm run clear-cache list` 先查看，然后只清除有问题的！

