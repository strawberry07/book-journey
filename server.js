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

// 应用启动日期：2026年1月1日
const APP_START_DATE = new Date("2026-01-01");
APP_START_DATE.setHours(0, 0, 0, 0);
const APP_START_DATE_STR = APP_START_DATE.toISOString().split("T")[0]; // "2026-01-01"

// 维护模式：通过环境变量控制
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

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
  
  // 获取最近14天内使用过的书籍ID（考虑冷却期）
  const recentIds = new Set(
    history.selections
      .filter((entry) => now - entry.timestamp < COOL_DOWN_MS)
      .map((entry) => entry.bookId)
  );

  // 过滤掉在冷却期内的书籍（支持动态书籍数量）
  let candidates = books.filter((book) => !recentIds.has(book.id));
  
  // 如果所有书都在冷却期，使用所有书籍（回退机制）
  // 这种情况理论上不会发生，因为14天冷却期意味着最多只有 books.length - 14 本书在冷却中
  if (candidates.length === 0) {
    console.warn(`⚠️  所有 ${books.length} 本书都在冷却期中，使用回退机制`);
    candidates = books;
  }
  
  // 从候选书籍中随机选择
  const choice = candidates[Math.floor(Math.random() * candidates.length)];

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

  // 计算从启动日期开始的天数（支持动态书籍数量）
  const daysSinceStart = Math.floor((targetDayStart - APP_START_DATE.getTime()) / DAY_MS);
  
  // 获取最近14天内使用过的书籍ID（考虑冷却期）
  const recentIds = new Set();
  history.selections.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    entryDate.setHours(0, 0, 0, 0);
    const entryDaysSinceStart = Math.floor((entryDate.getTime() - APP_START_DATE.getTime()) / DAY_MS);
    const daysDiff = Math.abs(entryDaysSinceStart - daysSinceStart);
    
    // 如果这本书在目标日期的14天范围内使用过，加入冷却列表
    if (daysDiff < 14 && daysDiff >= 0) {
      recentIds.add(entry.bookId);
    }
  });

  // 过滤掉在冷却期内的书籍
  let candidates = books.filter((book) => !recentIds.has(book.id));
  
  // 如果所有书都在冷却期，使用所有书籍（回退机制）
  // 这种情况理论上不会发生，因为14天冷却期意味着最多只有 books.length - 14 本书在冷却中
  if (candidates.length === 0) {
    console.warn(`⚠️  所有 ${books.length} 本书都在冷却期中，使用回退机制`);
    candidates = books;
  }

  // 使用确定性算法从候选书籍中选择（基于日期）
  // 这样确保同一个日期总是选择同一本书
  const index = daysSinceStart % candidates.length;
  const selectedBook = candidates[index];
  
  // 记录选择（如果还没有记录）
  if (!existingSelection) {
    history.selections.push({ bookId: selectedBook.id, timestamp: targetDayStart });
    await writeHistory(history);
  }
  
  return selectedBook;
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
  
  // 检查长度（匹配提示词要求）
  if (summary.resonance.length < 400) {
    issues.push("精华版过短（少于400字）");
  }
  if (summary.deep_dive.length < 1200) {
    issues.push("思考版过短（少于1200字）");
  }
  if (summary.masterclass.length < 2000) {
    issues.push("沉浸版过短（少于2000字）");
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
  
  // 检查是否包含明显的错误标记（更精确的检查，避免误判）
  const hasErrorMarkers = (text) => {
    // 只检查特定的错误模式，而不是简单的"错误"这个词
    const errorPatterns = [
      /生成摘要时出错/i,
      /Failed to generate/i,
      /Error:.*生成/i,
      /生成.*失败/i,
      /无法生成摘要/i,
      /请检查服务器日志/i,
      /未知错误/i,
      /API.*error/i,
      /DeepSeek.*error/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(text));
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

      // 如果存在但不是 approved，删除并重新生成
      if (cache[book.id] && cache[book.id].status !== "approved") {
        console.log(`🔄 [${i + 1}/${count}] ${dateStr}: 书籍 ${book.id}《${book.title_cn}》状态为 ${cache[book.id].status}，重新生成`);
        delete cache[book.id];
        await writeCache(cache);
      }

      console.log(`📚 [${i + 1}/${count}] ${dateStr}: 生成书籍 ${book.id}《${book.title_cn}》...`);

      // 直接调用 callDeepSeek 生成摘要，然后自动批准
      try {
        const summary = await callDeepSeek(book);
        
        // 自动质量检查
        const validation = validateSummary(summary);
        
        // 设置审核状态
        const summaryWithStatus = {
          ...summary,
          status: validation.valid ? "approved" : "rejected",  // 直接 approved，不再 pending
          validationIssues: validation.issues,
          reviewedAt: validation.valid ? Date.now() : null,
          reviewedBy: validation.valid ? "system" : null,  // 系统自动审核
          createdAt: summary.createdAt || Date.now(),
          source: summary.source || "deepseek"
        };
        
        // 保存到缓存
        const updatedCache = await readCache();
        updatedCache[book.id] = summaryWithStatus;
        await writeCache(updatedCache);
        
        const status = summaryWithStatus.status;
        if (status === "approved") {
          console.log(`   ✅ 生成成功，已自动批准`);
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
使用自然、流畅的简体中文，像朋友聊天一样亲切。避免学术腔调和AI感，用真实、有温度的语言。

**严格禁止使用以下表述：**
- ❌ "这本书告诉我们..."
- ❌ "这本书说..."
- ❌ "书中提到..."
- ❌ "作者认为..."
- ❌ "作者指出..."
- ❌ "这本书的核心是..."
- ❌ "这本书揭示了..."
- ❌ "它告诉我们..."
- ❌ 任何类似的元评论性表述

**必须直接陈述观点，就像这些观点是事实一样。** 例如：
- ✅ "生命的真正力量来自无目的、累积的自然选择。"
- ❌ "这本书告诉我们生命的真正力量来自无目的、累积的自然选择。"

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
- **关键要求（必须严格遵守）：** 
  * 开头的2-4句总结必须直接陈述书籍的核心观点，绝对不要使用任何元评论性表述
  * **绝对禁止在总结中提及书名**（如"《盲眼钟表匠》"、"这本书"等），这不是推荐买书的app，重要的是书中的观点
  * 禁止使用："这本书告诉我们"、"作者认为"、"书中提到"、"这本书说"、"它告诉我们"、"这本书的核心是"等任何间接表述
  * 禁止使用："如果你曾惊叹于..."、"那么《书名》将为你..."等推荐性表述
  * 直接说出观点本身，就像这些观点是客观事实一样
  * 示例对比：
    - ❌ 错误："如果你曾惊叹于鹰眼的锐利，那么《盲眼钟表匠》将为你打开一扇全新的认知之窗。"
    - ✅ 正确："生命的真正力量来自无目的、累积的自然选择，而非有意识的设计者。"
    - ❌ 错误："这本书告诉我们人是有需求的动物，除短暂的时间外，极少达到完全满足的状态。"
    - ✅ 正确："人是一种不断需求的动物，除短暂的时间外，极少达到完全满足的状态。"

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
  console.log(`🔍 [ensureSummary] 检查书籍 ${bookId} 的缓存状态...`);
  const cache = await readCache();
  const cached = cache[bookId];
  
  // 如果已缓存且已批准，直接返回（不包含审核状态字段）
  // 注意：旧内容可能不符合新的字数要求，但已经批准过，所以直接返回
  if (cached && cached.status === "approved") {
    // 检查内容是否存在
    if (!cached.resonance || !cached.deep_dive || !cached.masterclass) {
      console.warn(`⚠️  Book ${bookId} has approved status but missing content, regenerating...`);
      delete cache[bookId];
      await writeCache(cache);
    } else {
      console.log(`✅ [ensureSummary] 从缓存返回书籍 ${bookId} 的内容（已批准）`);
      return {
        resonance: cached.resonance,
        deep_dive: cached.deep_dive,
        masterclass: cached.masterclass,
        createdAt: cached.createdAt,
        source: cached.source
      };
    }
  } else if (cached) {
    console.log(`⚠️  [ensureSummary] 书籍 ${bookId} 在缓存中但状态为 "${cached.status}"，需要重新生成`);
  } else {
    console.log(`❌ [ensureSummary] 书籍 ${bookId} 不在缓存中，需要生成`);
  }
  
  // 如果存在但状态不是 approved，删除并重新生成
  if (cached && cached.status !== "approved") {
    console.log(`🔄 Book ${bookId} has status "${cached.status}", regenerating...`);
    delete cache[bookId];
    await writeCache(cache);
  }
  
  // 生成新摘要
  const book = books.find((b) => b.id === bookId);
  if (!book) throw new Error("Book not found");
  
  // 重试机制：最多重试3次
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      const summary = await callDeepSeek(book);
      
      // 自动质量检查
      const validation = validateSummary(summary);
      
      // 如果验证失败，重试（除非是最后一次尝试）
      if (!validation.valid) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.warn(`⚠️  Book ${bookId} summary failed validation (attempt ${retryCount}/${maxRetries}):`, validation.issues);
          console.warn(`   重试生成...`);
          // 等待2秒后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        } else {
          console.error(`❌ Book ${bookId} summary failed validation after ${maxRetries} attempts:`, validation.issues);
          throw new Error(`内容质量检查未通过: ${validation.issues.join(", ")}`);
        }
      }
      
      // 验证通过，保存并返回
      const summaryWithStatus = {
        ...summary,
        status: "approved",  // 直接设置为 approved
        validationIssues: [],  // 验证通过，没有问题
        reviewedAt: Date.now(),
        reviewedBy: "system",  // 标记为系统自动审核
        createdAt: summary.createdAt || Date.now(),
        source: summary.source || "deepseek"
      };
      
      cache[bookId] = summaryWithStatus;
      await writeCache(cache);
      
      console.log(`✅ Book ${bookId} summary auto-approved by system (attempt ${retryCount + 1})`);
      
      // 直接返回内容
      return {
        resonance: summaryWithStatus.resonance,
        deep_dive: summaryWithStatus.deep_dive,
        masterclass: summaryWithStatus.masterclass,
        createdAt: summaryWithStatus.createdAt,
        source: summaryWithStatus.source
      };
      
    } catch (err) {
      // 如果是验证失败且还有重试机会，继续循环
      if (err.message.includes("质量检查") && retryCount < maxRetries - 1) {
        retryCount++;
        console.warn(`⚠️  Book ${bookId} generation failed (attempt ${retryCount}/${maxRetries}):`, err.message);
        console.warn(`   重试生成...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      // 其他错误或已达到最大重试次数，抛出错误
      throw err;
    }
  }
  
  // 如果循环结束但还没有返回，说明所有重试都失败了
  throw new Error(`内容生成失败：已重试 ${maxRetries} 次但仍未通过验证`);
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
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".ico": "image/x-icon",
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

  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // 维护模式检查（允许健康检查和admin界面）
  if (MAINTENANCE_MODE && 
      !urlObj.pathname.startsWith('/health') && 
      !urlObj.pathname.startsWith('/admin.html') &&
      !urlObj.pathname.startsWith('/api/admin')) {
    res.writeHead(503, {
      ...corsHeaders,
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ 
      error: "系统维护中，请稍后再试",
      maintenance: true,
      estimatedTime: "30分钟",
      timestamp: new Date().toISOString()
    }));
    return;
  }

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
    try {
      const cache = await readCache();
      const cacheSize = Object.keys(cache).length;
      const hasApiKey = !!DEEPSEEK_API_KEY;
      const approvedCount = Object.values(cache).filter(item => item.status === "approved").length;
      
      res.writeHead(200, { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ 
        status: "ok",
        service: "book-journey",
        timestamp: new Date().toISOString(),
        maintenance: MAINTENANCE_MODE,
        cache: {
          size: cacheSize,
          approved: approvedCount,
          healthy: cacheSize > 0
        },
        api: {
          configured: hasApiKey
        },
        startDate: APP_START_DATE_STR
      }));
      return;
    } catch (err) {
      res.writeHead(503, { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ 
        status: "degraded",
        error: err.message,
        timestamp: new Date().toISOString()
      }));
      return;
    }
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 如果今天在启动日期之前，返回错误
      if (today < APP_START_DATE) {
        return sendJson(res, 400, { 
          error: `应用将从 ${APP_START_DATE_STR} 开始运行` 
        });
      }
      
      return sendJson(res, 200, { 
        book,
        appStartDate: APP_START_DATE_STR // 返回固定的应用启动日期
      });
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
      
      const requestedDate = new Date(date);
      requestedDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 如果请求的日期在应用启动日期之前，返回错误
      if (requestedDate < APP_START_DATE) {
        return sendJson(res, 400, { 
          error: `无法查看 ${date} 的内容，应用从 ${APP_START_DATE_STR} 开始运行` 
        });
      }
      
      // 如果请求的日期在今天之后，返回错误
      if (requestedDate > today) {
        return sendJson(res, 400, { 
          error: `无法查看未来日期的内容` 
        });
      }
      
      const book = await getBookForDate(date);
      return sendJson(res, 200, { 
        book,
        date: date,
        appStartDate: APP_START_DATE_STR
      });
    } catch (err) {
      console.error(err);
      return sendJson(res, 500, { error: "无法获取指定日期的书目" });
    }
  }

  // 审核管理 API
  
  // 检查特定书籍的缓存状态
  if (req.method === "GET" && urlObj.pathname === "/api/admin/check-book") {
    try {
      const bookId = urlObj.searchParams.get('id');
      if (!bookId) {
        return sendJson(res, 400, { error: "缺少 id 参数" });
      }
      
      const cache = await readCache();
      const cached = cache[bookId];
      const book = books.find(b => b.id === Number(bookId));
      
      return sendJson(res, 200, {
        bookId: Number(bookId),
        book: book ? {
          id: book.id,
          title_cn: book.title_cn,
          title_en: book.title_en,
          author: book.author
        } : null,
        cached: !!cached,
        status: cached?.status || (cached ? "legacy" : "not_found"),
        hasResonance: !!cached?.resonance,
        hasDeepDive: !!cached?.deep_dive,
        hasMasterclass: !!cached?.masterclass,
        createdAt: cached?.createdAt,
        reviewedAt: cached?.reviewedAt,
        validationIssues: cached?.validationIssues || [],
        needsMigration: cached && !cached.status, // 旧格式需要迁移
        resonanceLength: cached?.resonance?.length || 0,
        deepDiveLength: cached?.deep_dive?.length || 0,
        masterclassLength: cached?.masterclass?.length || 0
      });
    } catch (err) {
      console.error("Error checking book:", err);
      return sendJson(res, 500, { error: "检查失败" });
    }
  }

  // 获取待审核列表（主要用于查看旧格式内容，现在不再有 pending 状态）
  if (req.method === "GET" && urlObj.pathname === "/api/admin/pending") {
    try {
      const cache = await readCache();
      const pending = [];
      
      for (const [id, summary] of Object.entries(cache)) {
        // 现在只包含没有 status 的旧格式内容（不再有 pending 状态）
        if (!summary.status) {
          const book = books.find(b => b.id === Number(id));
          const needsMigration = !summary.status; // 标记旧格式
          
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
            createdAt: summary.createdAt || Date.now(),
            fullSummary: summary, // 包含完整内容用于审核
            needsMigration: needsMigration, // 标记是否需要迁移
            currentStatus: summary.status || "legacy" // 当前状态
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
      
      const oldStatus = cache[bookId].status;
      const needsMigration = !oldStatus; // 旧格式没有 status 字段
      
      // 如果是旧格式，迁移到新格式
      if (needsMigration) {
        console.log(`🔄 Migrating legacy format for book ${bookId}`);
        // 确保所有必需字段存在
        if (!cache[bookId].createdAt) {
          cache[bookId].createdAt = Date.now();
        }
        if (!cache[bookId].source) {
          cache[bookId].source = "deepseek";
        }
      }
      
      cache[bookId].status = "approved";
      cache[bookId].reviewedAt = Date.now();
      cache[bookId].reviewedBy = "admin"; // 可以后续添加实际用户信息
      
      console.log(`📝 Status changed: Book ${bookId} -> approved${needsMigration ? ' (migrated from legacy)' : ''} at ${new Date().toISOString()}`);
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
      const oldStatus = cache[bookId]?.status;
      delete cache[bookId];
      console.log(`📝 Status changed: Book ${bookId} -> deleted (was ${oldStatus}) at ${new Date().toISOString()}`);
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
      
      // 异步执行智能预生成（不阻塞响应）
      // 这会从启动日期开始检查并生成缺失的内容
      smartPreGenerate().then(() => {
        console.log("✅ 手动预生成完成");
      }).catch(err => {
        console.error("❌ 手动预生成错误:", err);
      });
      
      return sendJson(res, 200, { 
        success: true,
        message: `已开始智能预生成，将从启动日期（${APP_START_DATE_STR}）开始检查并生成缺失的内容`,
        startDate: APP_START_DATE_STR
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
          const oldStatus = cache[bookId].status;
          const needsMigration = !oldStatus; // 旧格式没有 status 字段
          
          // 如果是旧格式，迁移到新格式
          if (needsMigration) {
            console.log(`🔄 Migrating legacy format for book ${bookId}`);
            if (!cache[bookId].createdAt) {
              cache[bookId].createdAt = Date.now();
            }
            if (!cache[bookId].source) {
              cache[bookId].source = "deepseek";
            }
          }
          
          cache[bookId].status = "approved";
          cache[bookId].reviewedAt = Date.now();
          cache[bookId].reviewedBy = "admin";
          console.log(`📝 Status changed: Book ${bookId} -> approved${needsMigration ? ' (migrated from legacy)' : ` (was ${oldStatus})`} at ${new Date().toISOString()}`);
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
      const startTime = Date.now();
      const summary = await ensureSummary(id);
      const duration = Date.now() - startTime;
      console.log(`   ✅ Summary generated/retrieved successfully in ${duration}ms`);
      return sendJson(res, 200, { summary });
    } catch (err) {
      console.error(`   ❌ Error in ensureSummary:`, err);
      console.error(`   ❌ Error stack:`, err.stack);
      
      // 所有错误返回 500（不再有 202 状态码，因为不再有 pending 状态）
      return sendJson(res, 500, { 
        error: "无法生成摘要",
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
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

// 智能预生成函数：自动检查并生成未来缺失的内容
const smartPreGenerate = async () => {
  try {
    const cache = await readCache();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToCheck = 14; // 检查未来14天
    let toGenerate = [];
    
    // 确定起始日期：从启动日期或今天（取较晚的）开始
    const startDate = new Date(APP_START_DATE > today ? APP_START_DATE : today);
    startDate.setHours(0, 0, 0, 0);
    
    console.log(`🔍 检查从 ${startDate.toISOString().split("T")[0]} 到未来${daysToCheck}天的内容生成状态...`);
    
    // 从启动日期（或今天）开始检查，到未来14天
    for (let i = 0; i <= daysToCheck; i++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];
      
      // 如果目标日期在启动日期之前，跳过
      if (targetDate < APP_START_DATE) {
        continue;
      }
      
      try {
        const book = await getBookForDate(dateStr);
        
        if (!cache[book.id] || cache[book.id].status !== "approved") {
          toGenerate.push({ date: dateStr, bookId: book.id, book: book.title_cn });
          console.log(`   📋 ${dateStr}: ${book.title_cn} 需要生成`);
        } else {
          console.log(`   ✅ ${dateStr}: ${book.title_cn} 已存在`);
        }
      } catch (err) {
        console.error(`   ⚠️  检查日期 ${dateStr} 时出错:`, err.message);
      }
    }
    
    if (toGenerate.length > 0) {
      console.log(`📚 发现 ${toGenerate.length} 个内容需要预生成`);
      console.log(`   需要生成的日期: ${toGenerate.map(item => item.date).join(', ')}`);
      
      // 优先排序：启动日期优先，然后是今天，然后是其他日期
      toGenerate.sort((a, b) => {
        if (a.date === APP_START_DATE_STR) return -1;
        if (b.date === APP_START_DATE_STR) return 1;
        const todayStr = today.toISOString().split("T")[0];
        if (a.date === todayStr) return -1;
        if (b.date === todayStr) return 1;
        return a.date.localeCompare(b.date);
      });
      // 每次生成3个，避免一次性生成太多（减少到3个以提高成功率）
      const batchSize = 3;
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < toGenerate.length; i += batchSize) {
        const batch = toGenerate.slice(i, i + batchSize);
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(toGenerate.length/batchSize);
        console.log(`🔄 生成批次 ${batchNum}/${totalBatches} (${batch.length} 个内容)...`);
        
        for (const item of batch) {
          try {
            const book = books.find(b => b.id === item.bookId);
            if (!book) {
              console.error(`   ❌ ${item.date}: 书籍 ${item.bookId} 不存在`);
              errorCount++;
              continue;
            }
            
            // 再次检查缓存（可能在生成过程中被其他进程更新）
            const currentCache = await readCache();
            if (currentCache[book.id] && currentCache[book.id].status === "approved") {
              console.log(`   ⏭️  ${item.date}: ${item.book} 已存在，跳过`);
              skipCount++;
              continue;
            }
            
            console.log(`   📚 ${item.date}: 生成 ${item.book}...`);
            
            try {
              const summary = await callDeepSeek(book);
              const validation = validateSummary(summary);
              
              if (validation.valid) {
                const summaryWithStatus = {
                  ...summary,
                  status: "approved",
                  validationIssues: [],
                  reviewedAt: Date.now(),
                  reviewedBy: "system",
                  createdAt: Date.now(),
                  source: "deepseek"
                };
                
                const updatedCache = await readCache();
                updatedCache[book.id] = summaryWithStatus;
                await writeCache(updatedCache);
                console.log(`   ✅ ${item.date}: ${item.book} 已生成并批准（书籍ID: ${book.id}）`);
                console.log(`      📝 缓存已保存，resonance: ${summary.resonance.length}字, deep_dive: ${summary.deep_dive.length}字, masterclass: ${summary.masterclass.length}字`);
                successCount++;
              } else {
                console.error(`   ⚠️  ${item.date}: ${item.book} 质量检查未通过: ${validation.issues.join(", ")}`);
                errorCount++;
              }
            } catch (genErr) {
              console.error(`   ❌ ${item.date}: ${item.book} 生成过程出错:`, genErr.message);
              errorCount++;
            }
            
            // 延迟避免限流
            if (i + batch.length < toGenerate.length) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
            }
          } catch (err) {
            console.error(`   ❌ ${item.date}: ${item.book} 生成失败:`, err.message);
            errorCount++;
          }
        }
        
        // 批次之间稍长延迟
        if (i + batchSize < toGenerate.length) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        }
      }
      
      console.log(`\n📊 智能预生成完成:`);
      console.log(`   ✅ 成功: ${successCount}`);
      console.log(`   ⏭️  跳过: ${skipCount}`);
      console.log(`   ❌ 失败: ${errorCount}`);
    } else {
      const startDateStr = startDate.toISOString().split("T")[0];
      console.log(`✅ 从 ${startDateStr} 到未来${daysToCheck}天的内容已全部准备就绪`);
    }
  } catch (err) {
    console.error('❌ 智能预生成失败:', err);
    console.error('   错误堆栈:', err.stack);
  }
};

// 服务器启动时延迟执行智能预生成（不阻塞启动）
// 优先生成启动日期和今天的内容，然后生成未来的内容
setTimeout(async () => {
  console.log('🚀 启动智能预生成检查...');
  try {
    const cache = await readCache();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 优先生成启动日期的内容（即使今天在启动日期之前）
    if (!cache || Object.keys(cache).length === 0 || 
        !Object.values(cache).some(item => item.status === "approved")) {
      console.log(`📚 缓存为空或没有已批准内容，优先生成启动日期（${APP_START_DATE_STR}）的内容...`);
      try {
        const startBook = await getBookForDate(APP_START_DATE_STR);
        if (!cache[startBook.id] || cache[startBook.id].status !== "approved") {
          console.log(`📚 生成启动日期内容: ${startBook.title_cn}`);
          const summary = await callDeepSeek(startBook);
          const validation = validateSummary(summary);
          
          if (validation.valid) {
            const summaryWithStatus = {
              ...summary,
              status: "approved",
              validationIssues: [],
              reviewedAt: Date.now(),
              reviewedBy: "system",
              createdAt: Date.now(),
              source: "deepseek"
            };
            
            const updatedCache = await readCache();
            updatedCache[startBook.id] = summaryWithStatus;
            await writeCache(updatedCache);
            console.log(`✅ 启动日期内容已生成并批准: ${startBook.title_cn}（书籍ID: ${startBook.id}）`);
            console.log(`   📝 缓存已保存，resonance: ${summary.resonance.length}字, deep_dive: ${summary.deep_dive.length}字, masterclass: ${summary.masterclass.length}字`);
          } else {
            console.error(`⚠️  启动日期内容质量检查未通过: ${validation.issues.join(", ")}`);
          }
        } else {
          console.log(`✅ 启动日期内容已存在: ${startBook.title_cn}`);
        }
      } catch (err) {
        console.error(`❌ 生成启动日期内容失败:`, err.message);
      }
    }
    
    // 如果今天在启动日期之后，也生成今天的内容
    if (today >= APP_START_DATE) {
      const todayStr = today.toISOString().split("T")[0];
      const todayBook = await getBookForDate(todayStr);
      
      if (!cache[todayBook.id] || cache[todayBook.id].status !== "approved") {
        console.log(`📚 优先生成今天的内容: ${todayBook.title_cn}`);
        try {
          const summary = await callDeepSeek(todayBook);
          const validation = validateSummary(summary);
          
          if (validation.valid) {
            const summaryWithStatus = {
              ...summary,
              status: "approved",
              validationIssues: [],
              reviewedAt: Date.now(),
              reviewedBy: "system",
              createdAt: Date.now(),
              source: "deepseek"
            };
            
            const updatedCache = await readCache();
            updatedCache[todayBook.id] = summaryWithStatus;
            await writeCache(updatedCache);
            console.log(`✅ 今天的内容已生成并批准: ${todayBook.title_cn}（书籍ID: ${todayBook.id}）`);
            console.log(`   📝 缓存已保存，resonance: ${summary.resonance.length}字, deep_dive: ${summary.deep_dive.length}字, masterclass: ${summary.masterclass.length}字`);
          } else {
            console.error(`⚠️  今天的内容质量检查未通过: ${validation.issues.join(", ")}`);
          }
        } catch (err) {
          console.error(`❌ 生成今天的内容失败:`, err.message);
        }
      } else {
        console.log(`✅ 今天的内容已存在: ${todayBook.title_cn}`);
      }
    } else {
      console.log(`📅 今天是 ${today.toISOString().split("T")[0]}，应用将从 ${APP_START_DATE_STR} 开始运行`);
    }
    
    // 然后生成未来的内容（从启动日期开始）
    await smartPreGenerate();
  } catch (err) {
    console.error('❌ 启动时智能预生成失败:', err);
    console.error('   错误堆栈:', err.stack);
    // 不抛出错误，让服务器继续运行
  }
}, 5000); // 延迟5秒，快速生成启动日期和今天的内容

// 每天凌晨2点执行智能预生成（使用简单的定时器，不依赖外部库）
// 延迟执行，确保服务器完全启动
setTimeout(() => {
  const scheduleDailyPreGenerate = () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // 设置为明天凌晨2点
      
      const msUntilTomorrow = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        console.log('🕐 定时任务：开始每日智能预生成...');
        smartPreGenerate().catch(err => {
          console.error('❌ 定时智能预生成失败:', err);
          console.error('   错误堆栈:', err.stack);
        });
        
        // 设置每天重复执行
        setInterval(() => {
          console.log('🕐 定时任务：开始每日智能预生成...');
          smartPreGenerate().catch(err => {
            console.error('❌ 定时智能预生成失败:', err);
            console.error('   错误堆栈:', err.stack);
          });
        }, 24 * 60 * 60 * 1000); // 每24小时执行一次
      }, msUntilTomorrow);
      
      console.log(`⏰ 已设置定时任务，将在 ${tomorrow.toLocaleString('zh-CN')} 执行首次预生成`);
    } catch (err) {
      console.error('❌ 设置定时任务失败:', err);
      console.error('   错误堆栈:', err.stack);
    }
  };
  
  // 延迟执行定时任务设置，确保服务器完全启动
setTimeout(() => {
  try {
    scheduleDailyPreGenerate();
  } catch (err) {
    console.error('❌ 设置定时任务失败:', err);
    console.error('   错误堆栈:', err.stack);
    // 不抛出错误，让服务器继续运行
  }
}, 15000); // 延迟15秒，确保服务器完全启动
}, 15000); // 延迟15秒，确保服务器完全启动

