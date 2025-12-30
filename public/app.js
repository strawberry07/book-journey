const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const dateDisplayEl = document.getElementById("date-display");
const appStartDateEl = document.getElementById("app-start-date");
const titleCnEl = document.getElementById("title-cn");
const titleEnEl = document.getElementById("title-en");
const authorEl = document.getElementById("author");
const statusEl = document.getElementById("status");
const dateDisplayEl = document.getElementById("date-display");
const prevDayBtn = document.getElementById("prev-day");
const nextDayBtn = document.getElementById("next-day");
const shareBtn = document.getElementById("share-btn");
const buttons = document.querySelectorAll(".depth-btn");

let currentBook = null;
let currentDate = new Date();

const depthLabels = {
  resonance: "3 分钟 · 精华",
  deep_dive: "10 分钟 · 思考",
  masterclass: "30 分钟 · 沉浸",
};

const formatDate = (date = currentDate) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
};

const formatDateForAPI = (date) => {
  return date.toISOString().split("T")[0];
};

const isToday = (date) => {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const fetchJson = async (url) => {
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Fetch failed: ${res.status} ${res.statusText}`, errorText);
      throw new Error(`请求失败: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      console.error('❌ Network error - possible CORS or connection issue:', err);
      throw new Error('无法连接到服务器。请检查网络连接或稍后重试。');
    }
    throw err;
  }
};

let appStartDate = null; // 应用启动日期

const loadBookForDate = async (date) => {
  currentDate = date;
  dateDisplayEl.textContent = formatDate(date);
  statusEl.textContent = "正在获取书目...";
  
  // Enable/disable navigation buttons based on date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  // 如果还没有获取应用启动日期，从API响应中获取
  if (!appStartDate) {
    // 会在API响应后设置
  }
  
  // Disable previous day button if at app start date
  if (appStartDate) {
    const startDateOnly = new Date(appStartDate);
    startDateOnly.setHours(0, 0, 0, 0);
    prevDayBtn.disabled = dateOnly <= startDateOnly;
  } else {
    prevDayBtn.disabled = false; // 暂时允许，等API返回后更新
  }
  
  // Disable next day button if at today or future
  nextDayBtn.disabled = isToday(date) || dateOnly > today;
  
  try {
    const dateStr = formatDateForAPI(date);
    const endpoint = isToday(date) ? "/api/book/today" : `/api/book/date?date=${dateStr}`;
    const data = await fetchJson(endpoint);
    
    // 检查维护模式
    if (data.maintenance || data.error?.includes("维护")) {
      statusEl.textContent = "系统维护中，请稍后再试";
      titleCnEl.textContent = "系统维护中";
      titleEnEl.textContent = "";
      authorEl.textContent = "";
      if (data.estimatedTime) {
        statusEl.textContent = `系统维护中，预计 ${data.estimatedTime} 后恢复`;
      }
      return;
    }
    
    currentBook = data.book;
    
    // 更新应用启动日期（如果API返回了）
    if (data.appStartDate) {
      appStartDate = data.appStartDate;
      // 重新检查按钮状态
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      const startDateOnly = new Date(appStartDate);
      startDateOnly.setHours(0, 0, 0, 0);
      prevDayBtn.disabled = dateOnly <= startDateOnly;
    }
    
    titleCnEl.textContent = `《${currentBook.title_cn}》`;
    titleEnEl.textContent = currentBook.title_en;
    authorEl.textContent = `作者：${currentBook.author || "未知"}`;
    
    // 显示应用启动日期信息
    if (data.appStartDate) {
      appStartDate = data.appStartDate;
      const startDate = new Date(data.appStartDate);
      const startDateStr = formatDate(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateOnly = new Date(startDate);
      startDateOnly.setHours(0, 0, 0, 0);
      
      // 如果当前日期就是启动日期，显示提示
      if (dateOnly.getTime() === startDateOnly.getTime()) {
        appStartDateEl.textContent = "（应用启动日）";
        appStartDateEl.style.display = "inline";
      } else if (dateOnly < today) {
        // 显示启动日期信息
        appStartDateEl.textContent = `（启动于 ${startDateStr}）`;
        appStartDateEl.style.display = "inline";
      } else {
        appStartDateEl.style.display = "none";
      }
      
      // 更新前一天按钮状态
      prevDayBtn.disabled = dateOnly <= startDateOnly;
      
      console.log(`📅 应用启动日期: ${startDateStr}`);
    }
    
    statusEl.textContent = "选择上方深度开始阅读";
    
    // Clear summary when changing dates
    summaryEl.innerHTML = "";
    buttons.forEach((btn) => btn.classList.remove("active"));
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes("无法查看")) {
      statusEl.textContent = err.message;
    } else {
      statusEl.textContent = "无法获取书目，请稍后重试";
    }
  }
};

const loadToday = () => {
  // Check if URL has date parameter
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get("date");
  
  if (dateParam) {
    try {
      const date = new Date(dateParam);
      if (!isNaN(date.getTime())) {
        loadBookForDate(date);
        return;
      }
    } catch (err) {
      console.error("Invalid date parameter:", err);
    }
  }
  
  currentDate = new Date();
  loadBookForDate(currentDate);
};

const renderSummary = (depth, content) => {
  // Handle escaped newlines and actual newlines
  let processedContent = content
    // First, handle escaped newlines (\n in string literals)
    .replace(/\\n/g, "\n")
    // Then handle actual newlines
    .replace(/\n\n+/g, "\n\n") // Normalize multiple newlines to double
    .replace(/\n/g, "<br/>")
    // Remove markdown bold (**text**) and convert to HTML
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold** to <strong>
    .replace(/\*(.+?)\*/g, '<em>$1</em>'); // *italic* to <em>
  
  // Remove any "每日金句" or "黄金箴言" sections if they exist
  processedContent = processedContent.replace(/(?:每日金句|黄金箴言)[：:][^<]*(?:<br\/>[^<]*)*?(?=<br\/><br\/>|$|(?=<br\/>[^<]*[：:]))/gi, '');
  
  // Style "今日所思" section - find all occurrences and wrap them
  const reflectionRegex = /今日所思[：:]\s*([^<]*(?:<br\/>[^<]*)*?)(?=<br\/><br\/>|$|(?=<br\/>[^<]*[：:]))/g;
  processedContent = processedContent.replace(reflectionRegex, (match, content) => {
    // Clean up the content (remove trailing breaks, trim)
    const cleanContent = content.replace(/<br\/>\s*$/, '').trim();
    return `<div class="reflection-section"><strong>今日所思</strong>：${cleanContent}</div>`;
  });
  
  summaryEl.innerHTML = `<p>${processedContent}</p>`;
};

const loadSummary = async (depth) => {
  console.log("🔘 Depth button clicked:", depth);
  if (!currentBook) {
    console.error("❌ No current book available");
    statusEl.textContent = "错误：未找到当前书目";
    return;
  }
  console.log(`📚 Loading summary for book: ${currentBook.title_cn} (ID: ${currentBook.id})`);
  statusEl.textContent = "正在生成/获取缓存的摘要...";
  summaryEl.innerHTML = "";

  // Remove active state from all buttons
  buttons.forEach((btn) => btn.classList.remove("active"));

  // Add active state to clicked button
  const clickedBtn = Array.from(buttons).find(
    (btn) => btn.dataset.depth === depth
  );
  if (clickedBtn) clickedBtn.classList.add("active");

  try {
    const url = `/api/book/${currentBook.id}/summary`;
    console.log(`🌐 Fetching from: ${url}`);
    const data = await fetchJson(url);
    console.log("✅ Received summary data:", Object.keys(data));
    const summary = data.summary;
    if (!summary) {
      console.error("❌ No summary in response:", data);
      statusEl.textContent = "错误：响应中缺少摘要数据";
      return;
    }
    console.log(`📄 Rendering ${depth} summary (length: ${summary[depth]?.length || 0} chars)`);
    renderSummary(depth, summary[depth] || "暂无内容");
    statusEl.textContent = ""; // Clear status text
  } catch (err) {
    console.error("❌ Error loading summary:", err);
    console.error("   Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    // 更友好的错误消息
    let userMessage = "获取摘要失败，请稍后再试";
    let shouldRetry = false;
    let retryDelay = 5000; // 5秒后重试
    
    if (err.message.includes("500") || err.message.includes("无法生成")) {
      userMessage = "内容生成中，请稍候片刻后重试";
      shouldRetry = true;
    } else if (err.message.includes("网络") || err.message.includes("fetch") || err.message.includes("Failed to fetch")) {
      userMessage = "网络连接异常，请检查网络后重试";
      shouldRetry = true;
    } else if (err.message.includes("503") || err.message.includes("维护")) {
      userMessage = "系统维护中，请稍后再试";
      shouldRetry = false;
    } else if (err.message.includes("timeout") || err.message.includes("超时")) {
      userMessage = "请求超时，正在重试...";
      shouldRetry = true;
      retryDelay = 3000; // 3秒后重试
    }
    
    statusEl.textContent = userMessage;
    
    // 自动重试机制
    if (shouldRetry && currentBook) {
      let retryCount = 0;
      const maxRetries = 3;
      
      const retry = () => {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`🔄 自动重试 (${retryCount}/${maxRetries})...`);
          statusEl.textContent = `${userMessage} (重试 ${retryCount}/${maxRetries})`;
          
          setTimeout(async () => {
            try {
              const url = `/api/book/${currentBook.id}/summary`;
              const data = await fetchJson(url);
              const summary = data.summary;
              if (summary && summary[depth]) {
                renderSummary(depth, summary[depth]);
                statusEl.textContent = "";
                return; // 成功，停止重试
              }
            } catch (retryErr) {
              console.error(`❌ 重试 ${retryCount} 失败:`, retryErr);
              if (retryCount < maxRetries) {
                retry(); // 继续重试
              } else {
                statusEl.textContent = "多次重试失败，请稍后再试";
              }
            }
          }, retryDelay);
        } else {
          statusEl.textContent = "多次重试失败，请稍后再试";
        }
      };
      
      retry();
    }
  }
};

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const depth = btn.dataset.depth;
    loadSummary(depth);
  });
});

prevDayBtn.addEventListener("click", () => {
  const prevDate = new Date(currentDate);
  prevDate.setDate(prevDate.getDate() - 1);
  loadBookForDate(prevDate);
});

nextDayBtn.addEventListener("click", () => {
  if (isToday(currentDate)) return;
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  
  if (nextDate <= today) {
    loadBookForDate(nextDate);
  } else {
    // 已经到达今天，不能再往前了
    console.log('已到达今天，无法查看未来日期');
    // 可以显示一个提示，但不需要alert，因为按钮已经被禁用了
  }
});

const extractSummary = (summaryContent) => {
  if (!summaryContent) return null;
  
  // Remove HTML tags and normalize text
  let text = summaryContent
    .replace(/<[^>]+>/g, ' ') // Replace HTML tags with spaces
    .replace(/&nbsp;/g, ' ')
    .replace(/\\n/g, ' ') // Handle escaped newlines
    .replace(/\n/g, ' ') // Handle actual newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  if (!text || text.length === 0) return null;
  
  // Debug: log original text
  console.log('📝 Original text (first 200 chars):', text.substring(0, 200));
  
  // Split into sentences first
  const sentencePattern = /[^。！？]*[。！？]/g;
  let sentences = text.match(sentencePattern);
  
  console.log('📊 Found sentences:', sentences?.length || 0);
  
  if (!sentences || sentences.length === 0) {
    // Fallback: extract first 150-200 characters (try to end at a natural break)
    const fallback = text.substring(0, 200);
    const lastPeriod = fallback.lastIndexOf('。');
    const lastExclamation = fallback.lastIndexOf('！');
    const lastQuestion = fallback.lastIndexOf('？');
    const lastPunct = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastPunct > 50) {
      return cleanMetaCommentary(fallback.substring(0, lastPunct + 1));
    }
    return cleanMetaCommentary(fallback.trim() + (text.length > 200 ? '...' : ''));
  }
  
  // Filter out sentences that contain meta-commentary patterns or book title references
  // More aggressive: remove any sentence that mentions the book, author, or book title
  const directSentences = sentences.filter(sentence => {
    const trimmed = sentence.trim();
    // Skip sentences that contain meta-commentary patterns anywhere (not just at start)
    const hasMetaCommentary = /(这本书|书中|作者|它|本书)(告诉|说|提到|认为|指出|强调|探讨|揭示|阐述|展示|帮助|让|启发|提醒|的核心|的核心是|的核心在于|的核心价值|的核心价值是|的核心价值在于|的核心观点|的核心观点是|的核心观点在于|的核心思想|的核心思想是|的核心思想在于|探讨|揭示|阐述|展示)/.test(trimmed);
    // Skip sentences that mention book titles (e.g., "《盲眼钟表匠》" or "那么《书名》将为你...")
    const hasBookTitle = /《[^》]+》|如果你曾|那么.*将为你|为你打开|为你提供|为你带来/.test(trimmed);
    return !hasMetaCommentary && !hasBookTitle;
  });
  
  // If we filtered out all sentences, try to clean the original sentences instead
  let sentencesToUse;
  if (directSentences.length === 0) {
    // Clean the original sentences by removing meta-commentary phrases
    sentencesToUse = sentences.map(sentence => cleanMetaCommentary(sentence)).filter(s => s.length > 0);
  } else {
    sentencesToUse = directSentences;
  }
  
  // If still no sentences, use original but cleaned
  if (sentencesToUse.length === 0) {
    sentencesToUse = sentences.map(sentence => cleanMetaCommentary(sentence)).filter(s => s.length > 0);
  }
  
  // Take 2-4 sentences (prefer 3-4, but at least 2)
  const count = Math.min(Math.max(2, sentencesToUse.length), 4);
  let summary = sentencesToUse.slice(0, count).join('').trim();
  
  console.log('📋 Summary before final cleanup:', summary.substring(0, 200));
  
  // Final cleanup: remove any remaining meta-commentary
  summary = cleanMetaCommentary(summary);
  
  console.log('✅ Final summary:', summary.substring(0, 200));
  
  return summary || null;
};

// Helper function to clean meta-commentary from text
const cleanMetaCommentary = (text) => {
  if (!text) return text;
  
  // Remove meta-commentary phrases anywhere in the text (not just at start)
  const patterns = [
    // 这本书...
    /这本书告诉我们[，,：:]\s*/g,
    /这本书说[，,：:]\s*/g,
    /这本书的核心是[，,：:]\s*/g,
    /这本书的核心在于[，,：:]\s*/g,
    /这本书的核心价值是[，,：:]\s*/g,
    /这本书的核心价值在于[，,：:]\s*/g,
    /这本书探讨了[，,：:]\s*/g,
    /这本书揭示了[，,：:]\s*/g,
    /这本书阐述了[，,：:]\s*/g,
    /这本书展示了[，,：:]\s*/g,
    /这本书帮助我们[，,：:]\s*/g,
    /这本书让我们[，,：:]\s*/g,
    /这本书启发我们[，,：:]\s*/g,
    /这本书提醒我们[，,：:]\s*/g,
    /这本书的核心观点是[，,：:]\s*/g,
    /这本书的核心观点在于[，,：:]\s*/g,
    /这本书的核心思想是[，,：:]\s*/g,
    /这本书的核心思想在于[，,：:]\s*/g,
    // 书中...
    /书中提到[，,：:]\s*/g,
    /书中说[，,：:]\s*/g,
    /书中指出[，,：:]\s*/g,
    /书中强调[，,：:]\s*/g,
    // 作者...
    /作者认为[，,：:]\s*/g,
    /作者指出[，,：:]\s*/g,
    /作者强调[，,：:]\s*/g,
    /作者说[，,：:]\s*/g,
    /作者提到[，,：:]\s*/g,
    // 它...
    /它告诉我们[，,：:]\s*/g,
    /它说[，,：:]\s*/g,
    /它探讨了[，,：:]\s*/g,
    /它揭示了[，,：:]\s*/g,
    /它阐述了[，,：:]\s*/g,
    /它展示了[，,：:]\s*/g,
    // 本书...
    /本书告诉我们[，,：:]\s*/g,
    /本书说[，,：:]\s*/g,
    /本书的核心是[，,：:]\s*/g,
    /本书的核心在于[，,：:]\s*/g,
    // 更通用的模式
    /(这本书|书中|作者|它|本书)(的核心|的核心是|的核心在于|的核心价值|的核心价值是|的核心价值在于|的核心观点|的核心观点是|的核心观点在于|的核心思想|的核心思想是|的核心思想在于)[，,：:]\s*/g,
  ];
  
  let cleaned = text;
  patterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Also remove standalone meta-commentary phrases (more aggressive)
  cleaned = cleaned.replace(/\s*(这本书|书中|作者|它|本书)(告诉|说|提到|认为|指出|强调|探讨|揭示|阐述|展示|帮助|让|启发|提醒|的核心|的核心是|的核心在于|的核心价值|的核心价值是|的核心价值在于|的核心观点|的核心观点是|的核心观点在于|的核心思想|的核心思想是|的核心思想在于)[，,：:]\s*/g, '');
  
  // Remove any remaining patterns that might have been missed
  cleaned = cleaned.replace(/(这本书|书中|作者|它|本书)(告诉|说|提到|认为|指出|强调|探讨|揭示|阐述|展示|帮助|让|启发|提醒)/g, '');
  
  // Remove book title references (e.g., "《盲眼钟表匠》" or "那么《书名》将为你...")
  cleaned = cleaned.replace(/《[^》]+》/g, ''); // Remove book titles in 《》
  cleaned = cleaned.replace(/如果你曾[^。！？]*那么[^。！？]*[。！？]/g, ''); // Remove "如果你曾...那么..." patterns
  cleaned = cleaned.replace(/那么[^。！？]*将为你[^。！？]*[。！？]/g, ''); // Remove "那么...将为你..." patterns
  cleaned = cleaned.replace(/为你打开[^。！？]*[。！？]/g, ''); // Remove "为你打开..." patterns
  cleaned = cleaned.replace(/为你提供[^。！？]*[。！？]/g, ''); // Remove "为你提供..." patterns
  cleaned = cleaned.replace(/为你带来[^。！？]*[。！？]/g, ''); // Remove "为你带来..." patterns
  
  // Remove any sentence that starts with meta-commentary or book references (even after cleaning)
  const sentences = cleaned.split(/[。！？]/);
  const directSentences = sentences.filter(s => {
    const trimmed = s.trim();
    return !trimmed.match(/^(这本书|书中|作者|它|本书|如果你曾|那么)/) && 
           !trimmed.match(/《[^》]+》/); // Also filter out sentences with book titles
  });
  
  if (directSentences.length > 0) {
    cleaned = directSentences.join('。').trim();
  }
  
  return cleaned.trim();
};

const getSummaryFromContent = async () => {
  // Always fetch the resonance summary to get clean text (not HTML)
  // This ensures we get the original text before HTML processing
  try {
    if (!currentBook || !currentBook.id) {
      console.error("No current book available");
      return null;
    }
    
    const data = await fetchJson(`/api/book/${currentBook.id}/summary`);
    const resonanceContent = data.summary?.resonance || '';
    
    if (!resonanceContent) {
      console.error("No resonance content available");
      return null;
    }
    
    const summary = extractSummary(resonanceContent);
    
    // Debug: log the extracted summary
    console.log('📋 Extracted summary for share card:', summary);
    
    if (!summary) {
      console.warn("Failed to extract summary from content");
      // Fallback: return first 200 characters (also clean it)
      const text = resonanceContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const cleaned = cleanMetaCommentary(text.substring(0, 200));
      return cleaned + (text.length > 200 ? '...' : '');
    }
    
    return summary;
  } catch (err) {
    console.error("Failed to fetch summary:", err);
    return null;
  }
};

let shareCardBlob = null; // Store the blob for sharing/downloading

const closeShareCard = () => {
  const shareCard = document.getElementById("share-card");
  const shareOverlay = document.getElementById("share-overlay");
  const shareCardDownload = document.getElementById("share-card-download");
  const shareCardShare = document.getElementById("share-card-share");
  
  shareOverlay.style.display = "none";
  shareCard.style.display = "none";
  shareCard.style.position = "absolute";
  shareCard.style.transform = "";
  shareCardBlob = null; // Clear blob when closing
  
  // Reset buttons
  shareCardDownload.disabled = true;
  shareCardShare.disabled = true;
  shareCardDownload.style.opacity = "0.5";
  shareCardShare.style.opacity = "0.5";
  
  statusEl.textContent = "";
};

const downloadShareCard = () => {
  if (!shareCardBlob || !currentBook) {
    const shareCardStatus = document.getElementById("share-card-status");
    if (shareCardStatus) {
      shareCardStatus.style.display = "block";
      shareCardStatus.textContent = "❌ 图片数据不可用";
      shareCardStatus.style.color = "var(--error, #e74c3c)";
    }
    return;
  }
  
  try {
    // Verify blob is valid
    if (shareCardBlob.size === 0) {
      throw new Error("图片数据为空");
    }
    
    const url = URL.createObjectURL(shareCardBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `每日书旅-${currentBook.title_cn}.png`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    const shareCardStatus = document.getElementById("share-card-status");
    if (shareCardStatus) {
      shareCardStatus.style.display = "block";
      shareCardStatus.textContent = "✅ 图片已下载";
      shareCardStatus.style.color = "var(--primary)";
    }
    
    statusEl.textContent = "图片已下载";
    setTimeout(() => {
      statusEl.textContent = "";
      if (shareCardStatus) {
        shareCardStatus.style.display = "none";
      }
    }, 2000);
  } catch (err) {
    console.error("Download error:", err);
    const shareCardStatus = document.getElementById("share-card-status");
    if (shareCardStatus) {
      shareCardStatus.style.display = "block";
      shareCardStatus.textContent = `❌ 下载失败: ${err.message}`;
      shareCardStatus.style.color = "var(--error, #e74c3c)";
    }
    statusEl.textContent = `下载失败: ${err.message}`;
  }
};

const shareCardImage = async (shareCardStatusEl = null) => {
  // Use share card status element if provided, otherwise try main status
  const statusArea = shareCardStatusEl || document.getElementById("status");
  
  // Test: Show we're in the function
  if (statusArea) {
    statusArea.textContent = "🔵 已进入分享函数";
    statusArea.style.color = "var(--primary)";
    if (shareCardStatusEl) {
      shareCardStatusEl.style.display = "block";
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  if (!shareCardBlob || !currentBook) {
    if (statusArea) {
      statusArea.textContent = "❌ 图片尚未准备好，请稍候";
      statusArea.style.color = "var(--error, #e74c3c)";
      if (shareCardStatusEl) {
        shareCardStatusEl.style.display = "block";
      }
    }
    setTimeout(() => {
      if (shareCardStatusEl) {
        shareCardStatusEl.style.display = "none";
      } else if (statusArea) {
        statusArea.textContent = "";
        statusArea.style.color = "";
      }
    }, 3000);
    return;
  }
  
  // Show immediate feedback
  if (statusArea) {
    statusArea.textContent = "✅ 图片已准备好，正在准备分享...";
    statusArea.style.color = "var(--primary)";
    if (shareCardStatusEl) {
      shareCardStatusEl.style.display = "block";
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const summary = await getSummaryFromContent();
    const dateStr = formatDateForAPI(currentDate);
    const shareUrl = `${window.location.origin}?date=${dateStr}`;
    const file = new File([shareCardBlob], `每日书旅-${currentBook.title_cn}.png`, { type: "image/png" });
    
    // Check if we're on mobile/iOS
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid || (window.innerWidth <= 768 && 'ontouchstart' in window);
    
    // Check if share API is available
    if (!navigator.share) {
      const isHTTPS = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      const errorMsg = isHTTPS 
        ? "❌ 此浏览器不支持分享功能，请使用下载按钮"
        : "❌ 分享功能需要 HTTPS 连接。当前使用 HTTP，请使用下载按钮";
      
      if (statusArea) {
        statusArea.textContent = errorMsg;
        statusArea.style.color = "var(--error, #e74c3c)";
        if (shareCardStatusEl) {
          shareCardStatusEl.style.display = "block";
        }
      }
      setTimeout(() => {
        if (shareCardStatusEl) {
          shareCardStatusEl.style.display = "none";
        } else if (statusArea) {
          statusArea.textContent = "";
          statusArea.style.color = "";
        }
      }, 6000);
      return;
    }
    
    if (statusArea) {
      statusArea.textContent = "📎 尝试分享图片文件...";
      statusArea.style.fontSize = "16px";
      statusArea.style.fontWeight = "bold";
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Try to share the image file first (works on Android, newer iOS versions)
    let canShareFile = false;
    if (navigator.canShare) {
      try {
        canShareFile = navigator.canShare({ files: [file] });
        if (statusArea) {
          statusArea.textContent = `📎 文件分享支持: ${canShareFile ? '✅ 是' : '❌ 否'}`;
          statusArea.style.fontSize = "16px";
          statusArea.style.fontWeight = "bold";
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        if (statusArea) {
          statusArea.textContent = `检查文件分享时出错: ${err.message}`;
        }
        canShareFile = false;
      }
    }
    
    if (canShareFile) {
      try {
        if (statusArea) {
          statusArea.textContent = "🚀 正在打开分享菜单（文件模式）...";
          statusArea.style.fontSize = "16px";
          statusArea.style.fontWeight = "bold";
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        await navigator.share({
          title: `每日书旅 - ${currentBook.title_cn}`,
          text: `📚 ${currentBook.title_cn}\n${summary ? summary : ''}\n\n${shareUrl}`,
          files: [file],
        });
          if (statusArea) {
            statusArea.textContent = "✅ 分享成功！";
            statusArea.style.color = "var(--primary)";
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "block";
            }
          }
          setTimeout(() => {
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "none";
            } else if (statusArea) {
              statusArea.textContent = "";
              statusArea.style.color = "";
            }
          }, 2000);
          return;
        } catch (err) {
          if (err.name === "AbortError") {
            if (statusArea) {
              statusArea.textContent = "已取消分享";
              if (shareCardStatusEl) {
                shareCardStatusEl.style.display = "block";
              }
            }
            setTimeout(() => {
              if (shareCardStatusEl) {
                shareCardStatusEl.style.display = "none";
              } else if (statusArea) {
                statusArea.textContent = "";
              }
            }, 2000);
            return;
          }
          // Error sharing file, continue to text-only
          if (statusArea) {
            statusArea.textContent = `文件分享失败，尝试文本分享...`;
            statusArea.style.color = "var(--muted)";
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "block";
            }
          }
        }
      }
      
      // Fallback: Try text-only share on mobile (iOS often needs this)
      if (isMobile) {
        try {
          if (statusArea) {
            statusArea.textContent = "🚀 正在打开分享菜单（文本模式）...";
            statusArea.style.color = "var(--primary)";
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "block";
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        await navigator.share({
          title: `每日书旅 - ${currentBook.title_cn}`,
          text: `📚 ${currentBook.title_cn}\n${summary ? summary : ''}\n\n${shareUrl}`,
        });
          if (statusArea) {
            statusArea.textContent = "✅ 分享成功！";
            statusArea.style.color = "var(--primary)";
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "block";
            }
          }
          setTimeout(() => {
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "none";
            } else if (statusArea) {
              statusArea.textContent = "";
              statusArea.style.color = "";
            }
          }, 2000);
          return;
        } catch (err) {
          if (err.name === "AbortError") {
            if (statusArea) {
              statusArea.textContent = "已取消分享";
              if (shareCardStatusEl) {
                shareCardStatusEl.style.display = "block";
              }
            }
            setTimeout(() => {
              if (shareCardStatusEl) {
                shareCardStatusEl.style.display = "none";
              } else if (statusArea) {
                statusArea.textContent = "";
              }
            }, 2000);
            return;
          }
          // If share fails, show error
          if (statusArea) {
            statusArea.textContent = `❌ 分享失败: ${err.name} - ${err.message || "未知错误"}`;
            statusArea.style.color = "var(--error, #e74c3c)";
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "block";
            }
          }
          setTimeout(() => {
            if (shareCardStatusEl) {
              shareCardStatusEl.style.display = "none";
            } else if (statusArea) {
              statusArea.textContent = "";
              statusArea.style.color = "";
            }
          }, 5000);
          return;
        }
      }
      
      // Desktop: Show message that sharing isn't available
      if (statusArea) {
        statusArea.textContent = "❌ 此设备不支持分享，请使用下载功能";
        statusArea.style.color = "var(--error, #e74c3c)";
        if (shareCardStatusEl) {
          shareCardStatusEl.style.display = "block";
        }
      }
      setTimeout(() => {
        if (shareCardStatusEl) {
          shareCardStatusEl.style.display = "none";
        } else if (statusArea) {
          statusArea.textContent = "";
          statusArea.style.color = "";
        }
      }, 4000);
  } catch (err) {
    const statusArea = shareCardStatusEl || document.getElementById("status");
    if (statusArea) {
      statusArea.textContent = `❌ 分享失败: ${err.message || "未知错误"}`;
      statusArea.style.color = "var(--error, #e74c3c)";
      if (shareCardStatusEl) {
        shareCardStatusEl.style.display = "block";
      }
    }
    setTimeout(() => {
      if (shareCardStatusEl) {
        shareCardStatusEl.style.display = "none";
      } else if (statusArea) {
        statusArea.textContent = "";
        statusArea.style.color = "";
      }
    }, 5000);
  }
};

const shareContent = async () => {
  if (!currentBook) return;

  statusEl.textContent = "正在生成分享卡片...";
  
  // Get the summary (2-4 sentences)
  const summary = await getSummaryFromContent();
  
  // Prepare share card content
  const shareCard = document.getElementById("share-card");
  const shareOverlay = document.getElementById("share-overlay");
  const shareCardClose = document.getElementById("share-card-close");
  const shareCardDownload = document.getElementById("share-card-download");
  const shareCardShare = document.getElementById("share-card-share");
  const shareCardDate = document.getElementById("share-card-date");
  const shareCardTitleCn = document.getElementById("share-card-title-cn");
  const shareCardTitleEn = document.getElementById("share-card-title-en");
  const shareCardAuthor = document.getElementById("share-card-author");
  const shareCardQuote = document.getElementById("share-card-quote");
  
  // Keep buttons visible but disabled until image is ready
  shareCardDownload.disabled = true;
  shareCardShare.disabled = true;
  shareCardDownload.style.opacity = "0.5";
  shareCardShare.style.opacity = "0.5";
  shareCardDownload.style.visibility = "visible"; // Keep visible
  shareCardShare.style.visibility = "visible"; // Keep visible
  
  // Set up button handlers
  shareCardClose.onclick = (e) => {
    e.stopPropagation(); // Prevent overlay click
    closeShareCard();
  };
  shareCardDownload.onclick = (e) => {
    e.stopPropagation();
    if (!shareCardDownload.disabled) {
      downloadShareCard();
    }
  };
  shareCardShare.onclick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Get share card status element
    const shareCardStatus = document.getElementById("share-card-status");
    
    // Immediate visual feedback
    shareCardShare.style.transform = "scale(0.95)";
    shareCardShare.style.backgroundColor = "#1e5cd8";
    setTimeout(() => {
      shareCardShare.style.transform = "";
      shareCardShare.style.backgroundColor = "";
    }, 200);
    
    // Show status on share card itself
    if (shareCardStatus) {
      shareCardStatus.style.display = "block";
      shareCardStatus.textContent = "🔵 按钮已点击，开始处理...";
      shareCardStatus.style.color = "var(--primary)";
    }
    
    if (shareCardShare.disabled) {
      if (shareCardStatus) {
        shareCardStatus.textContent = "❌ 图片尚未准备好，请稍候";
        shareCardStatus.style.color = "var(--error, #e74c3c)";
      }
      setTimeout(() => {
        if (shareCardStatus) {
          shareCardStatus.style.display = "none";
        }
      }, 3000);
      return;
    }
    
    // Check if blob exists
    if (!shareCardBlob) {
      if (shareCardStatus) {
        shareCardStatus.textContent = "❌ 图片数据丢失，请重新生成";
        shareCardStatus.style.color = "var(--error, #e74c3c)";
      }
      setTimeout(() => {
        if (shareCardStatus) {
          shareCardStatus.style.display = "none";
        }
      }, 3000);
      return;
    }
    
    // Call share function - wrap in try/catch to catch any errors
    try {
      if (shareCardStatus) {
        shareCardStatus.textContent = "🔵 开始执行分享函数...";
        shareCardStatus.style.color = "var(--primary)";
      }
      
      // Small delay to ensure message is visible
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await shareCardImage(shareCardStatus);
    } catch (err) {
      console.error("Share button error:", err);
      if (shareCardStatus) {
        shareCardStatus.textContent = `❌ 错误: ${err.message || "分享失败"}`;
        shareCardStatus.style.color = "var(--error, #e74c3c)";
      }
      setTimeout(() => {
        if (shareCardStatus) {
          shareCardStatus.style.display = "none";
        }
      }, 5000);
    }
  };
  shareOverlay.onclick = closeShareCard; // Also close when clicking overlay
  
  // Prevent card click from closing (only overlay should close)
  shareCard.onclick = (e) => {
    e.stopPropagation();
  };
  
  shareCardDate.textContent = formatDate(currentDate);
  shareCardTitleCn.textContent = `《${currentBook.title_cn}》`;
  shareCardTitleEn.textContent = currentBook.title_en || "";
  shareCardAuthor.textContent = currentBook.author || "未知作者";
  shareCardQuote.textContent = summary || "点击查看完整内容";
  
  // Show overlay and share card - center it on screen
  shareOverlay.style.display = "block";
  shareCard.style.display = "block";
  shareCard.style.position = "fixed";
  shareCard.style.left = "50%";
  shareCard.style.top = "50%";
  shareCard.style.transform = "translate(-50%, -50%)";
  shareCard.style.zIndex = "10000";
  
  try {
    // Wait longer for rendering to ensure everything is visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate image from share card
    // Make sure card is fully visible and rendered
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Create a clone of the card for better capture (html2canvas sometimes has issues with fixed positioning)
    // We'll hide buttons in the clone only, keeping the original visible at all times
    const cardClone = shareCard.cloneNode(true);
    cardClone.style.position = "absolute";
    cardClone.style.left = "-9999px";
    cardClone.style.top = "0";
    cardClone.style.transform = "none";
    cardClone.style.display = "block";
    
    // Hide buttons and status in the clone only (not in the original)
    const cloneActions = cardClone.querySelector('.share-card-actions');
    const cloneStatus = cardClone.querySelector('#share-card-status');
    const cloneClose = cardClone.querySelector('#share-card-close');
    
    if (cloneActions) cloneActions.style.display = 'none';
    if (cloneStatus) cloneStatus.style.display = 'none';
    if (cloneClose) cloneClose.style.display = 'none';
    
    document.body.appendChild(cardClone);
    
    // Wait a bit for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const canvas = await html2canvas(cardClone, {
        backgroundColor: "#F9F8F3",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      
      // Remove clone
      document.body.removeChild(cardClone);
      
      // Verify canvas was created successfully
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("图片生成失败：画布为空");
      }
    
      // Don't hide card immediately - keep it visible while processing
      // It will be hidden after successful share or in fallback
      
      canvas.toBlob(async (blob) => {
        if (!blob || blob.size === 0) {
          console.error("Blob is empty or invalid");
          statusEl.textContent = "❌ 图片生成失败，请重试";
          return;
        }
        
        // Store blob for download/share buttons
        shareCardBlob = blob;
        
        console.log("Image generated successfully:", {
          size: blob.size,
          type: blob.type,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        });
        
        // Enable buttons now that image is ready (smooth transition)
        shareCardDownload.disabled = false;
        shareCardShare.disabled = false;
        // Use transition for smooth opacity change
        shareCardDownload.style.transition = "opacity 0.3s ease";
        shareCardShare.style.transition = "opacity 0.3s ease";
        shareCardDownload.style.opacity = "1";
        shareCardShare.style.opacity = "1";
        
        // Card is ready
        statusEl.textContent = "";
      }, "image/png", 1.0); // Use highest quality
    } catch (canvasErr) {
      // If clone method fails, try original method
      if (cardClone && cardClone.parentNode) {
        document.body.removeChild(cardClone);
      }
      
      console.warn("Clone method failed, trying original with clone:", canvasErr);
      
      // Create a fresh clone for fallback
      const fallbackClone = shareCard.cloneNode(true);
      fallbackClone.style.position = "absolute";
      fallbackClone.style.left = "-9999px";
      fallbackClone.style.top = "0";
      fallbackClone.style.transform = "none";
      fallbackClone.style.display = "block";
      
      // Hide buttons in the clone only
      const fallbackActions = fallbackClone.querySelector('.share-card-actions');
      const fallbackStatus = fallbackClone.querySelector('#share-card-status');
      const fallbackClose = fallbackClone.querySelector('#share-card-close');
      
      if (fallbackActions) fallbackActions.style.display = 'none';
      if (fallbackStatus) fallbackStatus.style.display = 'none';
      if (fallbackClose) fallbackClose.style.display = 'none';
      
      document.body.appendChild(fallbackClone);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(fallbackClone, {
        backgroundColor: "#F9F8F3",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      
      // Remove fallback clone
      document.body.removeChild(fallbackClone);
      
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("图片生成失败：画布为空");
      }
      
      canvas.toBlob(async (blob) => {
        if (!blob || blob.size === 0) {
          console.error("Blob is empty or invalid");
          statusEl.textContent = "❌ 图片生成失败，请重试";
          return;
        }
        
        shareCardBlob = blob;
        
        shareCardDownload.disabled = false;
        shareCardShare.disabled = false;
        shareCardDownload.style.opacity = "1";
        shareCardShare.style.opacity = "1";
        
        statusEl.textContent = "";
      }, "image/png", 1.0);
    }
    
  } catch (err) {
    console.error("Share card generation failed:", err);
    closeShareCard();
    statusEl.textContent = "生成分享卡片失败";
  }
};

shareBtn.addEventListener("click", shareContent);

loadToday();

