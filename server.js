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

// 质量检查函数（需要在 preGenerateSummaries 之前定义）
const validateSummary = (summary) => {
  const issues = [];
  
  // 检查三个版本是否存在
  if (!summary.resonance || !summary.deep_dive || !summary.masterclass) {
    issues.push("缺少一个或多个版本");
    return { valid: false, issues };
  }
  
  // 检查版本是否相同
  if (summary.resonance === summary.deep_dive || 
      summary.resonance === summary.masterclass || 
      summary.deep_dive === summary.masterclass) {
    issues.push("部分版本内容相同");
  }
  
  // 检查长度
  if (summary.resonance.length < 200) {
    issues.push("精华版过短（少于200字）");
  }
  if (summary.deep_dive.length < 800) {
    issues.push("思考版过短（少于800字）");
  }
  if (summary.masterclass.length < 1500) {
    issues.push("沉浸版过短（少于1500字）");
  }
  
  // 检查格式问题（过多的换行）
  const checkFormatting = (text) => {
    const newlineCount = (text.match(/\n/g) || []).length;
    const ratio = newlineCount / text.length;
    return ratio > 0.02; // 每50个字符超过1个换行
  };
  
  if (checkFormatting(summary.resonance)) {
    issues.push("精华版格式异常（换行过多）");
  }
  
  // 检查是否包含明显的错误标记
  const hasErrorMarkers = (text) => {
    return text.includes("生成摘要时出错") || 
           text.includes("Failed to") ||
           text.includes("Error:") ||
           text.includes("错误");
  };
  
  if (hasErrorMarkers(summary.resonance) || 
      hasErrorMarkers(summary.deep_dive) || 
      hasErrorMarkers(summary.masterclass)) {
    issues.push("包含错误信息");
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

// 预生成函数：批量生成未来N天的书籍摘要
const preGenerateSummaries = async (count = 10) => {
  const cache = await readCache();
  const today = new Date();
  const results = {
    generated: [],
    skipped: [],
    errors: []
  };

  console.log(`🚀 开始预生成未来 ${count} 天的书籍摘要...`);

  for (let i = 0; i < count; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const dateStr = futureDate.toISOString().split("T")[0];
    
    try {
      const book = await getBookForDate(dateStr);
      
      // 检查是否已存在且已批准
      if (cache[book.id] && cache[book.id].status === "approved") {
        console.log(`⏭️  [${i + 1}/${count}] ${dateStr}: 书籍 ${book.id}《${book.title_cn}》已批准，跳过`);
        results.skipped.push({ date: dateStr, bookId: book.id, book: book.title_cn, reason: "已批准" });
        continue;
      }

      // 检查是否已存在但待审核
      if (cache[book.id] && cache[book.id].status === "pending") {
        console.log(`⏳ [${i + 1}/${count}] ${dateStr}: 书籍 ${book.id}《${book.title_cn}》待审核，跳过`);
        results.skipped.push({ date: dateStr, bookId: book.id, book: book.title_cn, reason: "待审核" });
        continue;
      }

      console.log(`📚 [${i + 1}/${count}] ${dateStr}: 生成书籍 ${book.id}《${book.title_cn}》...`);

      // 直接调用 callDeepSeek 生成摘要，然后手动设置状态
      try {
        const summary = await callDeepSeek(book);
        
        // 自动质量检查
        const validation = validateSummary(summary);
        
        // 设置审核状态
        const summaryWithStatus = {
          ...summary,
          status: validation.valid ? "pending" : "rejected",
          validationIssues: validation.issues,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: summary.createdAt || Date.now(),
          source: summary.source || "deepseek"
        };
        
        // 保存到缓存
        const updatedCache = await readCache();
        updatedCache[book.id] = summaryWithStatus;
        await writeCache(updatedCache);
        
        const status = summaryWithStatus.status;
        if (status === "pending") {
          console.log(`   ✅ 生成成功，等待审核`);
        } else {
          console.log(`   ⚠️  生成成功但质量检查未通过: ${validation.issues.join(", ")}`);
        }
        results.generated.push({ date: dateStr, bookId: book.id, book: book.title_cn, status, issues: validation.issues });
      } catch (err) {
        throw err;
      }

      // 添加延迟，避免 API 限流
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      }

    } catch (err) {
      console.error(`   ❌ 生成失败: ${err.message}`);
      results.errors.push({ date: dateStr, error: err.message });
    }
  }

  console.log(`\n📊 预生成完成！`);
  console.log(`   ✅ 成功生成: ${results.generated.length}`);
  console.log(`   ⏭️  跳过: ${results.skipped.length}`);
  console.log(`   ❌ 失败: ${results.errors.length}`);

  return results;
};

const buildPrompt = (book) => {
  const basePrompt = `### ROLE
你是一位博学的朋友和思考伙伴，用温暖、真诚、易懂的语言分享书籍的智慧。请为《${book.title_cn}》（${book.title_en}）作者：${book.author} 提供三版摘要。

### 语言风格
使用自然、流畅的简体中文，像朋友聊天一样亲切。避免学术腔调和AI感，用真实、有温度的语言。不要说"这本书告诉我们"、"作者认为"这类套话，直接分享核心观点。

### 重要要求

**关于"今日所思"：**
- Version 2 (deep_dive) 和 Version 3 (masterclass) 必须包含"今日所思"部分
- 使用"今日所思："作为标题
- 提供反思问题，帮助读者联系自己的生活

### 内容要求（重要：内容要充实，不要过于简短）

**Version 1 (resonance - 3分钟精华):**
- 必须写3-4段话，总字数不少于400字，详细说明这本书为什么值得读，包括：
  * 这本书的核心价值是什么（用一段话展开）
  * 它解决了什么问题或提供了什么视角（用一段话展开）
  * 为什么现在读它特别有意义（用一段话展开）
  * 它如何影响读者的思考或生活（用一段话展开）
- 语言简洁有力，有情感共鸣，但内容要充实，不能简短
- **重要：** 在内容开头，提供2-4句话的简洁总结，概括这本书的核心价值和为什么值得读（这段总结将用于分享卡片）

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

### 输出格式（重要）
必须返回有效的 JSON 格式，包含三个键：resonance, deep_dive, masterclass。

**严格要求：**
1. 只返回 JSON，不要包含任何其他文字、说明或代码块标记
2. 三个版本的内容必须完全不同：
   - resonance: 3-4段，400字，简洁有力
   - deep_dive: 6-8个核心观点，1200-1600字，详细深入
   - masterclass: 全面分析，2000-3000字，包含跨学科连接
3. 每个版本的内容长度和深度必须明显不同
4. JSON 格式示例：
{
  "resonance": "内容...",
  "deep_dive": "内容...",
  "masterclass": "内容..."
}

**不要使用 markdown 代码块，直接返回纯 JSON。**`;

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
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      let jsonContent = content;
      
      // Remove markdown code blocks if present
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonContent);
      
      // Validate that we have all three versions
      if (!parsed.resonance || !parsed.deep_dive || !parsed.masterclass) {
        console.warn("⚠️  Missing one or more versions in response:", Object.keys(parsed));
        throw new Error("Incomplete response: missing versions");
      }
      
      // Ensure all three versions are different
      if (parsed.resonance === parsed.deep_dive || parsed.resonance === parsed.masterclass || parsed.deep_dive === parsed.masterclass) {
        console.warn("⚠️  Warning: Some versions are identical!");
        console.warn("Resonance length:", parsed.resonance?.length);
        console.warn("Deep dive length:", parsed.deep_dive?.length);
        console.warn("Masterclass length:", parsed.masterclass?.length);
      }
      
      return {
        resonance: parsed.resonance,
        deep_dive: parsed.deep_dive,
        masterclass: parsed.masterclass,
        createdAt: Date.now(),
        source: "deepseek",
      };
    } catch (err) {
      console.error("❌ Failed to parse JSON response:", err.message);
      console.error("Raw content preview (first 500 chars):", content.substring(0, 500));
      
      // Don't return the same content for all three - return error messages instead
      throw new Error(`Failed to parse DeepSeek response as JSON: ${err.message}. The API may not have returned the expected format.`);
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
  const cached = cache[bookId];
  
  // 如果已缓存且已批准，直接返回（不包含审核状态字段）
  if (cached && cached.status === "approved") {
    return {
      resonance: cached.resonance,
      deep_dive: cached.deep_dive,
      masterclass: cached.masterclass,
      createdAt: cached.createdAt,
      source: cached.source
    };
  }
  
  // 如果已缓存但未批准，返回待审核提示
  if (cached && cached.status === "pending") {
    throw new Error("内容审核中，请稍后再试");
  }
  
  // 如果被拒绝，删除并重新生成
  if (cached && cached.status === "rejected") {
    delete cache[bookId];
    await writeCache(cache);
  }
  
  // 生成新摘要
  const book = books.find((b) => b.id === bookId);
  if (!book) throw new Error("Book not found");
  
  try {
    const summary = await callDeepSeek(book);
    
    // 自动质量检查
    const validation = validateSummary(summary);
    
    // 设置审核状态
    const summaryWithStatus = {
      ...summary,
      status: validation.valid ? "pending" : "rejected",
      validationIssues: validation.issues,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: summary.createdAt || Date.now(),
      source: summary.source || "deepseek"
    };
    
    cache[bookId] = summaryWithStatus;
    await writeCache(cache);
    
    // 如果自动检查失败，抛出错误
    if (!validation.valid) {
      console.warn(`⚠️  Book ${bookId} summary failed validation:`, validation.issues);
      throw new Error(`内容质量检查未通过: ${validation.issues.join(", ")}`);
    }
    
    // 如果通过检查但需要审核，返回待审核提示
    throw new Error("内容已生成，等待审核中");
    
  } catch (err) {
    // 如果是审核相关的错误，直接抛出
    if (err.message.includes("审核") || err.message.includes("质量检查")) {
      throw err;
    }
    
    // 其他错误，返回错误摘要
    console.error(`❌ Failed to generate summary for book ${bookId}:`, err.message);
    console.error(`   Full error:`, err);
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

  // List cache endpoint
  if (req.method === "GET" && urlObj.pathname === "/api/admin/cache") {
    try {
      const cache = await readCache();
      const cachedIds = Object.keys(cache).map(Number).sort((a, b) => a - b);
      
      // Check for problematic entries
      const problematic = [];
      for (const bookId of cachedIds) {
        const entry = cache[bookId];
        if (!entry) continue;
        
        const { resonance, deep_dive, masterclass } = entry;
        if (!resonance || !deep_dive || !masterclass) {
          problematic.push({ id: bookId, reason: "Missing versions" });
        } else if (resonance === deep_dive || resonance === masterclass || deep_dive === masterclass) {
          problematic.push({ id: bookId, reason: "Identical versions" });
        }
      }
      
      return sendJson(res, 200, {
        total: cachedIds.length,
        cachedIds,
        problematic: problematic.length,
        problematicIds: problematic.map(p => p.id),
        details: problematic
      });
    } catch (err) {
      console.error("Error listing cache:", err);
      return sendJson(res, 500, { error: "Failed to list cache" });
    }
  }

  // Clear cache endpoint (for admin use)
  if (req.method === "POST" && urlObj.pathname === "/api/admin/clear-cache") {
    try {
      const cache = await readCache();
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });
      
      const bookIds = body.bookIds; // Array of book IDs to clear, or null/undefined to clear all
      
      if (bookIds === null || bookIds === undefined || (Array.isArray(bookIds) && bookIds.length === 0)) {
        // Clear all
        const cacheSize = Object.keys(cache).length;
        await writeCache({});
        console.log(`🗑️  Cache cleared: ${cacheSize} entries removed`);
        return sendJson(res, 200, { 
          success: true, 
          message: `Cache cleared successfully. Removed ${cacheSize} cached summaries.`,
          cleared: cacheSize
        });
      } else if (Array.isArray(bookIds)) {
        // Clear specific books
        let clearedCount = 0;
        for (const bookId of bookIds) {
          if (cache[bookId]) {
            delete cache[bookId];
            clearedCount++;
          }
        }
        await writeCache(cache);
        console.log(`🗑️  Cache cleared for ${clearedCount} book(s): ${bookIds.join(", ")}`);
        return sendJson(res, 200, {
          success: true,
          message: `Cleared cache for ${clearedCount} book(s)`,
          cleared: clearedCount,
          bookIds: bookIds
        });
      } else {
        return sendJson(res, 400, { error: "Invalid request. Expected { bookIds: [1, 2, 3] } or { bookIds: null } to clear all" });
      }
    } catch (err) {
      console.error("Error clearing cache:", err);
      return sendJson(res, 500, { error: "Failed to clear cache", details: err.message });
    }
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

  // 审核管理 API
  
  // 获取待审核列表
  if (req.method === "GET" && urlObj.pathname === "/api/admin/pending") {
    try {
      const cache = await readCache();
      const pending = [];
      
      for (const [id, summary] of Object.entries(cache)) {
        if (summary.status === "pending") {
          const book = books.find(b => b.id === Number(id));
          pending.push({
            bookId: Number(id),
            book: book ? {
              id: book.id,
              title_cn: book.title_cn,
              title_en: book.title_en,
              author: book.author
            } : null,
            summary: {
              resonance: summary.resonance ? summary.resonance.substring(0, 300) + "..." : "",
              deep_dive: summary.deep_dive ? summary.deep_dive.substring(0, 300) + "..." : "",
              masterclass: summary.masterclass ? summary.masterclass.substring(0, 300) + "..." : ""
            },
            validationIssues: summary.validationIssues || [],
            createdAt: summary.createdAt,
            fullSummary: summary // 包含完整内容用于审核
          });
        }
      }
      
      // 按创建时间排序
      pending.sort((a, b) => a.createdAt - b.createdAt);
      
      return sendJson(res, 200, { 
        count: pending.length,
        pending 
      });
    } catch (err) {
      console.error("Error fetching pending:", err);
      return sendJson(res, 500, { error: "无法获取待审核列表" });
    }
  }
  
  // 批准内容
  if (req.method === "POST" && urlObj.pathname === "/api/admin/approve") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });
      
      const { bookId } = body;
      if (!bookId) {
        return sendJson(res, 400, { error: "缺少 bookId 参数" });
      }
      
      const cache = await readCache();
      
      if (!cache[bookId]) {
        return sendJson(res, 404, { error: "摘要不存在" });
      }
      
      cache[bookId].status = "approved";
      cache[bookId].reviewedAt = Date.now();
      cache[bookId].reviewedBy = "admin"; // 可以后续添加实际用户信息
      
      await writeCache(cache);
      
      console.log(`✅ Book ${bookId} summary approved`);
      
      return sendJson(res, 200, { 
        success: true,
        message: `书籍 ${bookId} 的摘要已批准`
      });
    } catch (err) {
      console.error("Error approving summary:", err);
      return sendJson(res, 500, { error: "批准失败" });
    }
  }
  
  // 拒绝内容
  if (req.method === "POST" && urlObj.pathname === "/api/admin/reject") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });
      
      const { bookId, reason } = body;
      if (!bookId) {
        return sendJson(res, 400, { error: "缺少 bookId 参数" });
      }
      
      const cache = await readCache();
      
      if (!cache[bookId]) {
        return sendJson(res, 404, { error: "摘要不存在" });
      }
      
      // 删除缓存，下次访问会重新生成
      delete cache[bookId];
      await writeCache(cache);
      
      console.log(`❌ Book ${bookId} summary rejected${reason ? `: ${reason}` : ""}`);
      
      return sendJson(res, 200, { 
        success: true,
        message: `书籍 ${bookId} 的摘要已拒绝，将在下次访问时重新生成`
      });
    } catch (err) {
      console.error("Error rejecting summary:", err);
      return sendJson(res, 500, { error: "拒绝失败" });
    }
  }
  
  // 预生成 API（后台任务）
  if (req.method === "POST" && urlObj.pathname === "/api/admin/pre-generate") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });
      
      const { count = 10 } = body;
      
      if (count <= 0 || count > 100) {
        return sendJson(res, 400, { error: "数量必须在 1-100 之间" });
      }
      
      // 异步执行预生成（不阻塞响应）
      preGenerateSummaries(count).then(results => {
        console.log("✅ Pre-generation completed:", results);
      }).catch(err => {
        console.error("❌ Pre-generation error:", err);
      });
      
      return sendJson(res, 200, { 
        success: true,
        message: `已开始预生成 ${count} 天的内容，请稍后查看管理界面`,
        count
      });
    } catch (err) {
      console.error("Error starting pre-generation:", err);
      return sendJson(res, 500, { error: "启动预生成失败" });
    }
  }

  // 批量批准
  if (req.method === "POST" && urlObj.pathname === "/api/admin/approve-batch") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });
      
      const { bookIds } = body;
      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        return sendJson(res, 400, { error: "缺少 bookIds 数组" });
      }
      
      const cache = await readCache();
      const approved = [];
      const notFound = [];
      
      for (const bookId of bookIds) {
        if (cache[bookId]) {
          cache[bookId].status = "approved";
          cache[bookId].reviewedAt = Date.now();
          cache[bookId].reviewedBy = "admin";
          approved.push(bookId);
        } else {
          notFound.push(bookId);
        }
      }
      
      await writeCache(cache);
      
      console.log(`✅ Batch approved ${approved.length} summaries`);
      
      return sendJson(res, 200, { 
        success: true,
        approved: approved.length,
        notFound: notFound.length,
        message: `已批准 ${approved.length} 个摘要`
      });
    } catch (err) {
      console.error("Error batch approving:", err);
      return sendJson(res, 500, { error: "批量批准失败" });
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

