# Railway Volume 配置指南

## 如何找到并配置 Volume

### 方法 1: 通过服务设置（推荐）

1. **进入 Railway 项目**
   - 登录 https://railway.app
   - 选择你的 `book-journey` 项目

2. **找到服务卡片**
   - 在项目页面，你会看到一个服务卡片（显示你的应用名称）
   - 点击服务卡片右上角的 **"..."** (三个点) 或 **"Settings"** 按钮

3. **查找 Volumes 选项**
   - 在设置页面，向下滚动
   - 查找 **"Volumes"** 或 **"Storage"** 部分
   - 如果看不到，尝试点击 **"Resources"** 标签

4. **创建 Volume**
   - 点击 **"+ New Volume"** 或 **"Add Volume"**
   - **Mount Path（挂载路径）:** 输入 `/app/data`
   - **Name（名称）:** 可以留空或输入 `data-storage`
   - 点击 **"Create"** 或 **"Add"**

5. **重启服务**
   - Volume 创建后，Railway 会自动重启服务
   - 或者手动点击 **"Redeploy"**

### 方法 2: 通过项目设置

1. 在项目页面，点击顶部的 **"Settings"** 标签
2. 查找 **"Resources"** 或 **"Volumes"** 部分
3. 按照上面的步骤创建 Volume

### 方法 3: 如果仍然找不到

Railway 的界面可能已经更新，或者你的计划可能不支持 Volume。可以尝试：

1. **检查你的计划**
   - 免费计划支持 Volume（0.5GB）
   - 如果看不到，可能需要升级或联系支持

2. **查看 Railway 文档**
   - 访问 https://docs.railway.com/guides/volumes
   - 查看最新的配置方法

3. **使用替代方案**（见下方）

## 替代方案：如果找不到 Volume

如果 Railway Volume 不可用，可以考虑以下方案：

### 方案 A: 使用 Railway PostgreSQL（推荐）

Railway 提供免费的 PostgreSQL 数据库，可以用来存储缓存：

1. 在 Railway 项目中，点击 **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway 会自动创建数据库并设置环境变量
3. 修改代码使用数据库存储缓存（需要修改代码）

### 方案 B: 接受临时缓存

如果 Volume 配置困难，可以：
- 接受首次访问需要等待的情况
- 使用预生成功能提前生成内容
- 缓存会在服务运行期间保持，但重启后会丢失

### 方案 C: 使用其他平台

如果 Railway 的持久化存储配置困难，可以考虑：
- **Render**: 提供持久化磁盘
- **Fly.io**: 支持 Volume
- **DigitalOcean App Platform**: 支持持久化存储

## 验证 Volume 是否配置成功

配置 Volume 后，检查日志：

1. 在 Railway 项目页面，点击 **"Deployments"**
2. 查看最新部署的日志
3. 应该看到预生成成功执行
4. 访问应用时，日志应该显示 `✅ [ensureSummary] 从缓存返回`

如果仍然看到 `❌ [ensureSummary] 书籍 X 不在缓存中`，说明 Volume 可能没有正确配置。

## 需要帮助？

如果仍然找不到 Volume 选项：
1. 截图 Railway 的设置页面
2. 查看 Railway 文档：https://docs.railway.com
3. 或者考虑使用数据库存储缓存（需要修改代码）

