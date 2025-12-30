// 简单的图标生成脚本
// 这个脚本会创建一个简单的 favicon.ico 的替代方案
// 注意：实际生产环境建议使用专业的图标生成工具

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建一个简单的 HTML 文件来生成图标（使用 canvas）
const iconHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Icon Generator</title>
</head>
<body>
  <canvas id="canvas" width="512" height="512"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // 背景
    ctx.fillStyle = '#F9F8F3';
    ctx.fillRect(0, 0, 512, 512);
    
    // 书籍
    const centerX = 256;
    const centerY = 256;
    
    // 书页
    ctx.fillStyle = '#B22222';
    ctx.fillRect(centerX - 100, centerY - 75, 200, 150);
    ctx.fillStyle = '#F9F8F3';
    ctx.fillRect(centerX - 90, centerY - 65, 180, 130);
    
    // 书脊
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(centerX - 100, centerY - 75, 20, 150);
    
    // 文字线条
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX - 75, centerY - 40);
    ctx.lineTo(centerX + 60, centerY - 40);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX - 75, centerY - 10);
    ctx.lineTo(centerX + 70, centerY - 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX - 75, centerY + 20);
    ctx.lineTo(centerX + 50, centerY + 20);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX - 75, centerY + 50);
    ctx.lineTo(centerX + 65, centerY + 50);
    ctx.stroke();
    
    // 导出为 data URL（可以复制到浏览器控制台查看）
    console.log('Icon generated! Copy this to save:');
    console.log(canvas.toDataURL('image/png'));
  </script>
</body>
</html>`;

// 保存 HTML 文件
fs.writeFileSync(
  path.join(__dirname, 'generate-icon.html'),
  iconHTML,
  'utf8'
);

console.log('✅ Icon generator HTML created at public/generate-icon.html');
console.log('📝 Open it in a browser and use the console to get the image data URL');

