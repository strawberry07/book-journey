# PWA 功能测试指南

## 🧪 测试步骤

### 1. 本地测试（开发环境）

#### 启动服务器
```bash
cd /Users/jessicali/book-journey
npm start
```

#### 访问应用
打开浏览器访问：`http://localhost:3000`

#### 检查 Manifest
1. 打开浏览器开发者工具（F12 或 Cmd+Option+I）
2. 切换到 **Application** 标签（Chrome）或 **Storage** 标签（Firefox）
3. 点击左侧的 **Manifest**
4. 应该看到：
   - ✅ Name: "每日书旅"
   - ✅ Icons: 显示图标列表
   - ✅ Start URL: "/"
   - ✅ Display: "standalone"

#### 检查 Service Worker
1. 在开发者工具中，点击左侧的 **Service Workers**
2. 应该看到：
   - ✅ Status: "activated and is running"
   - ✅ Scope: "http://localhost:3000/"
3. 如果显示 "waiting to activate"，点击 "skipWaiting"

#### 检查缓存
1. 在开发者工具中，点击左侧的 **Cache Storage**
2. 应该看到缓存名称：`book-journey-v1.0.0`
3. 点击查看缓存的内容：
   - index.html
   - styles.css
   - app.js
   - logo.svg
   - manifest.json

### 2. 移动设备测试（生产环境）

#### iOS Safari
1. 在 iPhone/iPad 上访问你的应用 URL（Railway 部署的地址）
2. 点击底部的 **分享** 按钮
3. 向下滚动，找到 **"添加到主屏幕"** 或 **"Add to Home Screen"**
4. 点击后，可以自定义名称
5. 点击 **"添加"**
6. 检查主屏幕：
   - ✅ 应该看到应用图标
   - ✅ 点击后应该全屏打开（无浏览器地址栏）

#### Android Chrome
1. 在 Android 手机上访问应用 URL
2. 点击右上角的 **菜单**（三个点）
3. 选择 **"添加到主屏幕"** 或 **"Add to Home Screen"**
4. 可以自定义名称
5. 点击 **"添加"**
6. 检查主屏幕和应用行为

### 3. 功能测试清单

#### ✅ Manifest 测试
- [ ] 应用名称正确显示
- [ ] 图标可以加载（即使只是 SVG）
- [ ] 主题颜色正确
- [ ] 启动 URL 正确

#### ✅ Service Worker 测试
- [ ] Service Worker 成功注册
- [ ] 缓存正常工作
- [ ] 离线时仍可访问（部分功能）

#### ✅ 离线功能测试
1. 打开应用
2. 等待 Service Worker 缓存资源
3. 在开发者工具中，切换到 **Network** 标签
4. 勾选 **"Offline"** 选项
5. 刷新页面
6. 应该看到：
   - ✅ 页面仍然可以加载（从缓存）
   - ✅ 样式和脚本正常工作
   - ⚠️ API 请求可能失败（这是正常的）

#### ✅ 添加到主屏幕测试
- [ ] iOS Safari 可以添加
- [ ] Android Chrome 可以添加
- [ ] 添加后图标显示正确
- [ ] 打开时全屏显示（无地址栏）
- [ ] 启动画面显示（如果有图标）

### 4. 浏览器控制台检查

打开浏览器控制台，应该看到：
```
✅ Service Worker registered: http://localhost:3000/
```

如果没有看到，检查：
1. Service Worker 文件路径是否正确
2. 服务器是否正确提供 `sw.js` 文件
3. 是否使用 HTTPS（生产环境必需）

### 5. 常见问题排查

#### 问题 1: Service Worker 未注册
**检查：**
- 确认 `sw.js` 文件存在于 `public/` 目录
- 确认服务器可以访问 `/sw.js`
- 检查浏览器控制台是否有错误

**解决：**
```bash
# 检查文件是否存在
ls -la public/sw.js

# 检查服务器日志
# 访问 http://localhost:3000/sw.js 应该返回文件内容
```

#### 问题 2: Manifest 未加载
**检查：**
- 确认 `manifest.json` 文件存在
- 确认 HTML 中有 `<link rel="manifest" href="/manifest.json">`
- 访问 `http://localhost:3000/manifest.json` 应该返回 JSON

**解决：**
```bash
# 检查文件
ls -la public/manifest.json

# 检查内容
cat public/manifest.json
```

#### 问题 3: 图标未显示
**当前状态：**
- SVG logo 已创建，可以工作
- PNG 图标还未生成（这是正常的）

**临时方案：**
- 应用仍然可以工作
- 添加到主屏幕时可能显示默认图标
- 建议后续生成 PNG 图标

#### 问题 4: HTTPS 要求
**注意：**
- Service Worker 在本地开发环境（localhost）可以工作
- 生产环境需要 HTTPS
- Railway 部署应该自动提供 HTTPS

### 6. 测试命令

#### 检查文件是否存在
```bash
cd /Users/jessicali/book-journey
ls -la public/ | grep -E "manifest|sw.js|logo.svg"
```

#### 检查文件内容
```bash
# 检查 manifest
cat public/manifest.json

# 检查 service worker
head -20 public/sw.js

# 检查 logo
head -5 public/logo.svg
```

#### 测试服务器响应
```bash
# 启动服务器后，在另一个终端测试
curl http://localhost:3000/manifest.json
curl http://localhost:3000/sw.js
curl http://localhost:3000/logo.svg
```

### 7. 预期结果

#### 成功标志
- ✅ 开发者工具中可以看到 Service Worker 已注册
- ✅ Manifest 正确加载
- ✅ 缓存中有资源
- ✅ 可以添加到主屏幕
- ✅ 离线时可以访问（部分功能）

#### 当前限制
- ⚠️ PNG 图标还未生成（使用 SVG 作为占位符）
- ⚠️ 完全离线时 API 请求会失败（这是预期的）

### 8. 下一步

测试通过后：
1. ✅ PWA 功能正常工作
2. 📝 可以生成 PNG 图标以获得更好的体验
3. 🚀 可以部署到生产环境

---

**提示：** 如果遇到问题，检查浏览器控制台的错误信息，并参考上面的排查步骤。

