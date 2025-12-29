# Railway 部署问题排查

## 当前问题
服务器启动成功，但 Railway 在几秒后停止容器。

## 已实施的修复
1. ✅ 服务器监听 `0.0.0.0`（允许外部访问）
2. ✅ 添加了 `/health` 健康检查端点
3. ✅ 添加了进程信号处理（SIGTERM, SIGINT）
4. ✅ 添加了错误处理（防止崩溃）
5. ✅ 创建了 `railway.json` 配置文件

## 在 Railway 中需要检查的设置

### 1. 检查 Healthcheck 设置
1. 进入 Railway 项目
2. 点击你的服务（Service）
3. 点击 "Settings" 标签
4. 找到 "Healthcheck" 部分
5. 确保设置：
   - **Path:** `/health`
   - **Timeout:** 300ms 或更长
   - **Interval:** 10s 或更长

### 2. 检查环境变量
1. 在 "Variables" 标签中
2. 确认 `DEEPSEEK_API_KEY` 已设置
3. 确认 `PORT` 变量存在（Railway 会自动设置）

### 3. 检查部署日志
1. 点击 "Deployments" 标签
2. 查看最新的部署日志
3. 查找错误信息

### 4. 检查服务配置
1. 在服务设置中
2. 确认 "Start Command" 是：`npm start`
3. 确认没有其他启动命令冲突

## 可能的解决方案

### 方案 1: 禁用 Healthcheck（临时测试）
1. 在服务设置中
2. 找到 "Healthcheck"
3. 暂时禁用健康检查
4. 重新部署
5. 如果这样可以运行，说明是健康检查配置问题

### 方案 2: 使用不同的健康检查路径
尝试将健康检查路径改为根路径 `/`：
1. 在 `railway.json` 中改为 `"healthcheckPath": "/"`
2. 或者在 Railway 设置中手动设置

### 方案 3: 检查端口配置
确保 Railway 设置的端口与代码中的 `PORT` 环境变量匹配。

### 方案 4: 查看详细日志
在 Railway 的日志中查找：
- 是否有错误信息
- 健康检查是否返回 200
- 是否有超时错误

## 快速测试

部署后，手动测试健康检查端点：
```bash
curl https://你的railway-url.railway.app/health
```

应该返回：
```json
{"status":"ok","service":"book-journey","timestamp":1234567890}
```

## 如果还是不行

### 尝试 Render 作为替代
如果 Railway 持续有问题，可以尝试 Render：
1. 访问 https://render.com
2. 连接 GitHub 仓库
3. 创建 Web Service
4. 设置环境变量
5. Render 通常更简单，不需要特殊配置

### 或者使用 Fly.io
Fly.io 也是一个很好的选择，配置更灵活。

---

**下一步：** 检查 Railway 项目设置中的 Healthcheck 配置，确保路径是 `/health`。

