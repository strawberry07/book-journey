import http from "http";
import fs from "fs/promises";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DAY_MS = 24 * 60 * 60 * 1000;
const COOL_DOWN_MS = 14 * DAY_MS;

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const BOOKS_PATH = path.join(DATA_DIR, "books.json");
const CACHE_PATH = path.join(DATA_DIR, "cache.json");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");
const STATE_PATH = path.join(DATA_DIR, "state.json");
// DeepSeek API key must be provided via environment variable for security.
// Example (zsh): export DEEPSEEK_API_KEY="your-real-key"
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const loadJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) throw Object.assign(new Error("empty"), { code: "EMPTY" });
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EMPTY" || err instanceof SyntaxError) {
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    throw err;
  }
};

const books = await loadJson(BOOKS_PATH, []);

if (books.length === 0) {
  console.error("⚠️  WARNING: No books loaded from", BOOKS_PATH);
  console.error("   Make sure books.json exists and contains book data");
} else {
  console.log(`✓ Loaded ${books.length} books from database`);
}

const readCache = () => loadJson(CACHE_PATH, {});
const writeCache = (data) =>
  fs.writeFile(CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
const readHistory = () => loadJson(HISTORY_PATH, { selections: [] });
const writeHistory = (data) =>
  fs.writeFile(HISTORY_PATH, JSON.stringify(data, null, 2), "utf8");
const readState = () =>
  loadJson(STATE_PATH, { currentBookId: null, selectedAt: 0 });
const writeState = (data) =>
  fs.writeFile(STATE_PATH, JSON.stringify(data, null, 2), "utf8");

const pickNewBookId = async () => {
  const history = await readHistory();
  const now = Date.now();
  const recentIds = new Set(
    history.selections
      .filter((entry) => now - entry.timestamp < COOL_DOWN_MS)
      .map((entry) => entry.bookId)
  );

  const candidates = books.filter((book) => !recentIds.has(book.id));
  const pool = candidates.length > 0 ? candidates : books;
  const choice = pool[Math.floor(Math.random() * pool.length)];

  history.selections.push({ bookId: choice.id, timestamp: now });
  await writeHistory(history);
  await writeState({ currentBookId: choice.id, selectedAt: now });
  return choice.id;
};

const getBookForDate = async (targetDate) => {
  if (!books || books.length === 0) {
    throw new Error("No books available in database");
  }

  const targetDateObj = new Date(targetDate);
  targetDateObj.setHours(0, 0, 0, 0);
  const targetDayStart = targetDateObj.getTime();
  const targetDayEnd = targetDayStart + DAY_MS;

  const history = await readHistory();
  
  // Find if a book was already selected for this date
  const existingSelection = history.selections.find(
    (entry) =>
      entry.timestamp >= targetDayStart && entry.timestamp < targetDayEnd
  );

  if (existingSelection) {
    const book = books.find((b) => b.id === existingSelection.bookId);
    if (book) return book;
  }

  // If no book for this date, generate one deterministically based on date
  // This ensures the same date always gets the same book
  // Use a seed based on the date to make it deterministic
  const daysSinceEpoch = Math.floor(targetDayStart / DAY_MS);
  const index = daysSinceEpoch % books.length;
  return books[index];
};

const getTodaysBook = async () => {
  const today = new Date().toISOString().split("T")[0];
  return getBookForDate(today);
};

const buildPrompt = (book) => {
  const basePrompt = `### ROLE
你是一位博学的朋友和思考伙伴，用温暖、真诚、易懂的语言分享书籍的智慧。请为《${book.title_cn}》（${book.title_en}）作者：${book.author} 提供三版摘要。

### 语言风格
使用自然、流畅的简体中文，像朋友聊天一样亲切。避免学术腔调和AI感，用真实、有温度的语言。不要说"这本书告诉我们"、"作者认为"这类套话，直接分享核心观点。

### 重要要求

**关于"每日金句"（重要）：**
- 必须使用"每日金句"这个标题（不要用"黄金箴言"或其他名称）
- 金句必须是书中真实存在的原话或准确转述的核心观点
- 在提供金句前，请确认这句话确实出现在《${book.title_cn}》这本书中，如果是转述，必须准确反映作者的核心观点
- 只写金句本身，绝对不要添加任何解释、说明或评论（如"这句话道出了..."、"这体现了..."、"这揭示了..."等）
- 金句后直接换行，不要有任何解释性文字
- 如果无法确认书中是否有准确的原话，可以用简洁的方式转述核心观点，但必须准确

**关于"今日所思"：**
- Version 2 (deep_dive) 和 Version 3 (masterclass) 必须包含"今日所思"部分
- 使用"今日所思："作为标题
- 提供反思问题，帮助读者联系自己的生活

### 内容要求（重要：内容要充实，不要过于简短）

**Version 1 (resonance - 3分钟精华):**
- 必须写3-4段话，总字数不少于400字（是之前的两倍），详细说明这本书为什么值得读，包括：
  * 这本书的核心价值是什么（用一段话展开）
  * 它解决了什么问题或提供了什么视角（用一段话展开）
  * 为什么现在读它特别有意义（用一段话展开）
  * 它如何影响读者的思考或生活（用一段话展开）
- 必须包含"每日金句"部分，只写一句最打动人的原话或核心观点（不要解释，只写金句本身，确保是书中真实存在的）
- 语言简洁有力，有情感共鸣，但内容要充实，不能简短

**Version 2 (deep_dive - 10分钟思考):**
- 必须详细梳理6-8个核心观点（不能少于6个），每个观点用一段话（至少6-8句话）深入阐述，包括：
  * 这个观点是什么（2-3句话）
  * 作者是如何论证的（2-3句话）
  * 为什么这个观点重要（1-2句话）
  * 它与其他观点的关系（1-2句话）
- 用清晰的结构呈现，观点之间要有逻辑连接和过渡段落
- 必须包含"今日所思"部分，格式为："今日所思："后跟3-4个反思问题，帮助读者联系自己的生活，每个问题要具体、深入
- 加入4-5个日常生活中的具体例子，详细说明这些观点如何应用，每个例子用4-5句话描述，要具体、生动、可操作
- 总字数必须达到1200-1600字（是之前的两倍），不能少于1200字

**Version 3 (masterclass - 30分钟沉浸):**
- 必须全面深入分析书籍的核心思想，总字数不少于2000字（是之前的两倍），包括：
  * 书籍的整体框架和逻辑结构（用2-3段话详细说明，包括章节结构、论证逻辑、核心脉络）
  * 核心论点和论证过程（详细展开，至少6-8段，每段深入分析一个核心论点，包括作者的论证方法、证据、逻辑链条）
  * 作者独特的视角和贡献（用2-3段话说明，包括作者的思想创新、独特见解、对领域的贡献）
  * 这本书在相关领域的地位和影响（用1-2段话说明，包括学术影响、实践影响、读者反馈）
  * 书籍的深层主题和哲学思考（用2-3段话展开，探讨书中的深层含义、哲学意蕴、人生启示）
- 跨学科连接（这是重点，必须大幅扩充）：
  * 必须详细阐述书中的观点如何与其他4-5个不同领域（如心理学、经济学、历史、哲学、科学、艺术、社会学、文学等）联系起来
  * 每个跨学科连接用2-3段话（至少10-12句话）深入说明，包括：
    - 这个领域的核心概念是什么
    - 书中的观点如何与这个领域产生共鸣或冲突
    - 这种连接揭示了什么新的理解
    - 这种跨学科视角如何丰富我们对问题的认识
  * 不能只是简单提及，必须深入分析，展示真正的跨学科思维
  * 跨学科部分应占总内容的30-40%
- 生活应用：必须提供6-8个具体的日常应用场景和例子，每个例子详细描述（至少5-6句话），说明如何将书中的智慧应用到工作、关系、决策、个人成长、教育、领导力等各个方面，例子要具体、可操作、有启发性
- 必须包含"今日所思"部分，格式为："今日所思："后跟4-5个深度反思问题，引导读者深入思考，每个问题要具体、有启发性，不能是泛泛而谈
- 用对话式的语言，像在和朋友分享心得，但内容要深入、全面，总字数必须达到2000-3000字（是之前的两倍），不能少于2000字

### 输出格式
返回JSON，包含三个键：resonance, deep_dive, masterclass。不要包含额外说明。`;

  return basePrompt;
};

const callDeepSeek = async (book) => {
  const prompt = buildPrompt(book);
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }
    
    console.log(`📤 Calling DeepSeek API for book: ${book.title_cn} (ID: ${book.id})`);
    const requestBody = {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一位博学的朋友，用温暖、自然、易懂的中文分享书籍智慧。避免学术腔调和AI感，像朋友聊天一样真诚。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8000, // Ensure much longer responses (doubled)
    };
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📥 DeepSeek API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ DeepSeek API error response:`, errorText);
      throw new Error(`DeepSeek error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log(`✅ DeepSeek API success, response keys:`, Object.keys(data));
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.error("❌ Empty content in response:", data);
      throw new Error("Empty completion");
    }

    try {
      const parsed = JSON.parse(content);
      return {
        resonance: parsed.resonance,
        deep_dive: parsed.deep_dive,
        masterclass: parsed.masterclass,
        createdAt: Date.now(),
        source: "deepseek",
      };
    } catch (err) {
      return {
        resonance: content,
        deep_dive: content,
        masterclass: content,
        createdAt: Date.now(),
        source: "deepseek-raw",
      };
    }
  } catch (err) {
    console.error("❌ DeepSeek request failed!");
    console.error("   Error message:", err.message);
    console.error("   Error stack:", err.stack);
    if (err.cause) {
      console.error("   Error cause:", err.cause);
    }
    if (!DEEPSEEK_API_KEY) {
      console.error("⚠️  DEEPSEEK_API_KEY is not set!");
    } else {
      console.error(`⚠️  API Key present (length: ${DEEPSEEK_API_KEY.length}, starts with: ${DEEPSEEK_API_KEY.substring(0, 5)}...)`);
    }
    throw err; // Re-throw so the caller can handle it
  }
};

const ensureSummary = async (bookId) => {
  const cache = await readCache();
  if (cache[bookId]) return cache[bookId];

  const book = books.find((b) => b.id === bookId);
  if (!book) throw new Error("Book not found");

  try {
    const summary = await callDeepSeek(book);
    cache[bookId] = summary;
    await writeCache(cache);
    return summary;
  } catch (err) {
    console.error(`❌ Failed to generate summary for book ${bookId}:`, err.message);
    console.error(`   Full error:`, err);
    // Return a more helpful error message
    const errorMsg = err.message || "未知错误";
    return {
      resonance: `生成摘要时出错: ${errorMsg}。请检查服务器日志获取详细信息。`,
      deep_dive: `生成摘要时出错: ${errorMsg}。请检查服务器日志获取详细信息。`,
      masterclass: `生成摘要时出错: ${errorMsg}。请检查服务器日志获取详细信息。`,
      createdAt: Date.now(),
      source: "error",
    };
  }
};

const sendJson = (res, status, data) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
};

const serveStatic = async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const safePath = path.normalize(urlObj.pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (safePath === "/" || safePath === "") {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const mime =
      {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
      }[ext] || "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
};

const requestListener = async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  console.log(`📨 ${req.method} ${urlObj.pathname}`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check endpoint for Railway/deployment platforms
  if (req.method === "GET" && urlObj.pathname === "/health") {
    res.writeHead(200, { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ status: "ok", service: "book-journey", timestamp: Date.now() }));
    return;
  }

  if (req.method === "GET" && urlObj.pathname === "/api/book/today") {
    try {
      const book = await getTodaysBook();
      return sendJson(res, 200, { book });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { error: "无法获取今日书目" });
    }
  }

  if (req.method === "GET" && urlObj.pathname === "/api/book/date") {
    try {
      const date = urlObj.searchParams.get('date');
      if (!date) {
        return sendJson(res, 400, { error: "缺少日期参数" });
      }
      const book = await getBookForDate(date);
      return sendJson(res, 200, { book, date });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { error: "无法获取指定日期的书目" });
    }
  }

  if (
    req.method === "GET" &&
    urlObj.pathname &&
    urlObj.pathname.startsWith("/api/book/") &&
    urlObj.pathname.endsWith("/summary")
  ) {
    console.log(`📥 Received summary request: ${urlObj.pathname}`);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    console.log(`   URL parts:`, parts);
    // Path is /api/book/1/summary, so parts = ["api", "book", "1", "summary"]
    // Book ID is at index 2, not 1!
    const id = Number(parts[2]);
    console.log(`   Parsed book ID: ${id} (from parts[2])`);
    if (!id || isNaN(id)) {
      console.error(`   ❌ Invalid book ID: ${id}, parts were:`, parts);
      return sendJson(res, 400, { error: "无效的书籍 ID" });
    }
    try {
      console.log(`   ✅ Processing summary request for book ID: ${id}`);
      const summary = await ensureSummary(id);
      console.log(`   ✅ Summary generated/retrieved successfully`);
      return sendJson(res, 200, { summary });
    } catch (err) {
      console.error(`   ❌ Error in ensureSummary:`, err);
      return sendJson(res, 500, { error: "无法生成摘要" });
    }
  }

  return serveStatic(req, res);
};

const server = http.createServer((req, res) => {
  requestListener(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Book Journey server running at http://0.0.0.0:${PORT}`);
  if (!DEEPSEEK_API_KEY) {
    console.warn("⚠️  WARNING: DEEPSEEK_API_KEY is not set!");
    console.warn("   Set it with: export DEEPSEEK_API_KEY='your-key'");
  } else {
    console.log("✓ DeepSeek API key is set");
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught errors to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit, let the server keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, let the server keep running
});

