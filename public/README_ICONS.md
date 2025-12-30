# 图标生成说明

## 当前状态

已创建 SVG logo (`logo.svg`)，但 PWA 还需要以下 PNG 格式的图标：

- `icon-192.png` (192x192px) - Android 图标
- `icon-512.png` (512x512px) - 启动画面
- `apple-touch-icon.png` (180x180px) - iOS 图标

## 生成图标的方法

### 方法 1: 使用在线工具（推荐）

1. 访问 https://realfavicongenerator.net/ 或 https://www.pwabuilder.com/imageGenerator
2. 上传 `logo.svg` 文件
3. 下载生成的图标包
4. 将以下文件放到 `public/` 目录：
   - `icon-192.png`
   - `icon-512.png`
   - `apple-touch-icon.png`

### 方法 2: 使用 ImageMagick（命令行）

如果你安装了 ImageMagick：

```bash
cd /Users/jessicali/book-journey/public

# 从 SVG 生成 PNG（需要 ImageMagick 支持 SVG）
convert -background none -resize 192x192 logo.svg icon-192.png
convert -background none -resize 512x512 logo.svg icon-512.png
convert -background none -resize 180x180 logo.svg apple-touch-icon.png
```

### 方法 3: 使用浏览器生成

1. 打开 `generate-icon.html` 文件（已创建）
2. 在浏览器中打开
3. 打开开发者工具控制台
4. 复制生成的 data URL
5. 使用在线工具将 data URL 转换为 PNG 文件

### 方法 4: 手动创建（临时方案）

如果暂时无法生成图标，可以：

1. 使用任何图片编辑软件（如 Photoshop、GIMP、在线编辑器）
2. 创建 192x192、512x512、180x180 的 PNG 图片
3. 使用简单的书籍图标或文字"每日书旅"
4. 保存到 `public/` 目录

## 临时占位符

在生成正式图标之前，应用仍然可以工作，只是：
- 添加到主屏幕时可能显示默认图标
- 启动画面可能显示空白

## 验证

生成图标后，可以通过以下方式验证：

1. 访问应用
2. 打开浏览器开发者工具
3. 查看 Application > Manifest，确认所有图标都正确加载
4. 在移动设备上测试"添加到主屏幕"功能

