// 应用就绪检查脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 开始检查应用就绪状态...\n');

let passed = 0;
let failed = 0;
const issues = [];

// 检查文件是否存在
const checkFile = (filePath, description) => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}: ${filePath}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} - 文件不存在`);
    failed++;
    issues.push(`缺少文件: ${filePath}`);
    return false;
  }
};

// 检查文件内容
const checkFileContent = (filePath, description, validator) => {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${description}: 文件不存在`);
    failed++;
    issues.push(`缺少文件: ${filePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (validator(content)) {
      console.log(`✅ ${description}: ${filePath}`);
      passed++;
      return true;
    } else {
      console.log(`⚠️  ${description}: ${filePath} - 内容可能有问题`);
      failed++;
      issues.push(`${filePath} 内容验证失败`);
      return false;
    }
  } catch (err) {
    console.log(`❌ ${description}: ${filePath} - 读取错误: ${err.message}`);
    failed++;
    issues.push(`无法读取 ${filePath}: ${err.message}`);
    return false;
  }
};

console.log('📁 检查文件完整性...\n');

// 核心文件
checkFile('server.js', '服务器文件');
checkFile('package.json', '项目配置');
checkFile('public/index.html', '主页面');
checkFile('public/app.js', '前端脚本');
checkFile('public/styles.css', '样式文件');

// 数据文件
checkFile('data/books.json', '书籍数据');
checkFile('data/cache.json', '缓存文件');
checkFile('data/history.json', '历史记录');
checkFile('data/state.json', '状态文件');

// PWA 文件
checkFile('public/manifest.json', 'PWA Manifest');
checkFile('public/sw.js', 'Service Worker');
checkFile('public/logo.svg', 'Logo 图标');

console.log('\n📋 检查文件内容...\n');

// 检查 books.json 格式
checkFileContent('data/books.json', '书籍数据格式', (content) => {
  try {
    const books = JSON.parse(content);
    return Array.isArray(books) && books.length > 0 && 
           books.every(book => book.id && book.title_cn && book.title_en);
  } catch {
    return false;
  }
});

// 检查 manifest.json 格式
checkFileContent('public/manifest.json', 'Manifest 格式', (content) => {
  try {
    const manifest = JSON.parse(content);
    return manifest.name && manifest.start_url && manifest.icons;
  } catch {
    return false;
  }
});

// 检查 package.json 格式
checkFileContent('package.json', 'Package.json 格式', (content) => {
  try {
    const pkg = JSON.parse(content);
    return pkg.name && pkg.scripts && pkg.scripts.start;
  } catch {
    return false;
  }
});

// 检查环境变量
console.log('\n🔐 检查环境变量...\n');
const apiKey = process.env.DEEPSEEK_API_KEY;
if (apiKey) {
  console.log(`✅ DEEPSEEK_API_KEY: 已设置 (长度: ${apiKey.length})`);
  passed++;
} else {
  console.log(`⚠️  DEEPSEEK_API_KEY: 未设置`);
  failed++;
  issues.push('DEEPSEEK_API_KEY 环境变量未设置');
}

// 检查端口
console.log('\n🌐 检查端口配置...\n');
const port = process.env.PORT || 3000;
console.log(`📌 服务器端口: ${port}`);

// 检查书籍数量
console.log('\n📚 检查书籍数据...\n');
try {
  const booksPath = path.join(__dirname, 'data/books.json');
  if (fs.existsSync(booksPath)) {
    const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
    console.log(`✅ 书籍数量: ${books.length} 本`);
    if (books.length === 0) {
      console.log(`⚠️  警告: 没有书籍数据`);
      issues.push('books.json 中没有书籍');
    }
  }
} catch (err) {
  console.log(`❌ 无法读取书籍数据: ${err.message}`);
}

// 检查缓存状态
console.log('\n💾 检查缓存状态...\n');
try {
  const cachePath = path.join(__dirname, 'data/cache.json');
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const cacheSize = Object.keys(cache).length;
    const approvedCount = Object.values(cache).filter(item => item.status === 'approved').length;
    console.log(`📊 缓存条目: ${cacheSize}`);
    console.log(`✅ 已批准内容: ${approvedCount}`);
    if (cacheSize > 0) {
      passed++;
    }
  } else {
    console.log(`ℹ️  缓存文件不存在（首次运行正常）`);
  }
} catch (err) {
  console.log(`ℹ️  缓存文件为空或格式错误（首次运行正常）`);
}

// 总结
console.log('\n' + '='.repeat(50));
console.log('📊 检查结果总结');
console.log('='.repeat(50));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (issues.length > 0) {
  console.log('⚠️  发现的问题:');
  issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue}`);
  });
  console.log('');
}

if (failed === 0) {
  console.log('🎉 所有检查通过！应用已就绪！\n');
  console.log('📝 下一步:');
  console.log('   1. 运行 npm start 启动服务器');
  console.log('   2. 访问 http://localhost:3000 测试');
  console.log('   3. 运行 node test-pwa.js 测试 PWA 功能');
  console.log('   4. 部署到生产环境\n');
  process.exit(0);
} else {
  console.log('⚠️  发现一些问题，请先解决后再继续。\n');
  process.exit(1);
}

