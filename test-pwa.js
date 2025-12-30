// PWA 功能测试脚本
import http from 'http';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

const testFiles = [
  '/manifest.json',
  '/sw.js',
  '/logo.svg',
  '/index.html',
  '/styles.css',
  '/app.js'
];

console.log('🧪 开始测试 PWA 文件...\n');

let passed = 0;
let failed = 0;

const testFile = (path) => {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${path}`;
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${path} - 状态码: ${res.statusCode}, 大小: ${data.length} bytes`);
          passed++;
          resolve(true);
        } else {
          console.log(`❌ ${path} - 状态码: ${res.statusCode}`);
          failed++;
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${path} - 错误: ${err.message}`);
      failed++;
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`❌ ${path} - 超时`);
      failed++;
      resolve(false);
    });
  });
};

const runTests = async () => {
  console.log(`📡 连接到 ${BASE_URL}\n`);
  
  for (const file of testFiles) {
    await testFile(file);
    await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟
  }
  
  console.log(`\n📊 测试结果:`);
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   📈 成功率: ${((passed / testFiles.length) * 100).toFixed(1)}%\n`);
  
  if (failed === 0) {
    console.log('🎉 所有文件都可以正常访问！');
    console.log('\n📝 下一步:');
    console.log('   1. 在浏览器中打开 http://localhost:3000');
    console.log('   2. 打开开发者工具 (F12)');
    console.log('   3. 切换到 Application 标签');
    console.log('   4. 检查 Manifest 和 Service Workers');
    process.exit(0);
  } else {
    console.log('⚠️  部分文件无法访问，请检查服务器是否正在运行');
    console.log('   运行: npm start');
    process.exit(1);
  }
};

// 检查服务器是否运行
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

// 主函数
(async () => {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ 服务器未运行！');
    console.log('   请先启动服务器: npm start');
    process.exit(1);
  }
  
  await runTests();
})();

