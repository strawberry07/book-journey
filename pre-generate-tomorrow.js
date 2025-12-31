// 预生成明天（2026-01-01）的内容
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const BOOKS_PATH = path.join(DATA_DIR, 'books.json');
const CACHE_PATH = path.join(DATA_DIR, 'cache.json');

// 加载书籍数据
const loadJson = async (filePath, fallback) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    if (!data.trim()) return fallback;
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    throw err;
  }
};

const books = await loadJson(BOOKS_PATH, []);
const cache = await loadJson(CACHE_PATH, {});

// 计算2026-01-01对应的书籍
const APP_START_DATE = new Date('2026-01-01');
APP_START_DATE.setHours(0, 0, 0, 0);
const targetDayStart = APP_START_DATE.getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
const daysSinceStart = Math.floor((targetDayStart - APP_START_DATE.getTime()) / DAY_MS);
const bookIndex = daysSinceStart % books.length;
const tomorrowBook = books[bookIndex];

console.log('📅 预生成明天（2026-01-01）的内容...\n');
console.log('📚 书籍信息:');
console.log(`   ID: ${tomorrowBook.id}`);
console.log(`   书名: ${tomorrowBook.title_cn}`);
console.log(`   英文: ${tomorrowBook.title_en}`);
console.log(`   作者: ${tomorrowBook.author}\n`);

// 检查缓存
if (cache[tomorrowBook.id] && cache[tomorrowBook.id].status === 'approved') {
  console.log('✅ 内容已在缓存中！');
  console.log(`   状态: ${cache[tomorrowBook.id].status}`);
  console.log(`   精华版: ${cache[tomorrowBook.id].resonance?.length || 0} 字`);
  console.log(`   思考版: ${cache[tomorrowBook.id].deep_dive?.length || 0} 字`);
  console.log(`   沉浸版: ${cache[tomorrowBook.id].masterclass?.length || 0} 字\n`);
  console.log('🎉 明天用户访问时，内容会立即从缓存加载！');
  process.exit(0);
} else {
  console.log('⚠️  内容尚未生成');
  console.log('   当前缓存状态:', cache[tomorrowBook.id]?.status || '不存在');
  console.log('\n💡 建议:');
  console.log('   1. 启动服务器（npm start）');
  console.log('   2. 服务器启动时会自动生成启动日期（2026-01-01）的内容');
  console.log('   3. 或者访问 admin 界面手动触发预生成');
  console.log('   4. 或者等待服务器在 2026-01-01 自动生成\n');
  process.exit(1);
}

