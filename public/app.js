const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const titleCnEl = document.getElementById("title-cn");
const titleEnEl = document.getElementById("title-en");
const authorEl = document.getElementById("author");
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

const loadBookForDate = async (date) => {
  currentDate = date;
  dateDisplayEl.textContent = formatDate(date);
  statusEl.textContent = "正在获取书目...";
  
  // Disable navigation buttons - start date is today, no previous dates
  prevDayBtn.disabled = true;
  nextDayBtn.disabled = isToday(date) || date > new Date();
  
  try {
    const dateStr = formatDateForAPI(date);
    const endpoint = isToday(date) ? "/api/book/today" : `/api/book/date?date=${dateStr}`;
    const data = await fetchJson(endpoint);
    currentBook = data.book;
    titleCnEl.textContent = `《${currentBook.title_cn}》`;
    titleEnEl.textContent = currentBook.title_en;
    authorEl.textContent = `作者：${currentBook.author || "未知"}`;
    statusEl.textContent = "选择上方深度开始阅读";
    
    // Clear summary when changing dates
    summaryEl.innerHTML = "";
    buttons.forEach((btn) => btn.classList.remove("active"));
  } catch (err) {
    console.error(err);
    statusEl.textContent = "无法获取书目，请稍后重试";
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
  // Remove markdown bold (**text**) and convert to HTML
  let processedContent = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold** to <strong>
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // *italic* to <em>
    .replace(/\n/g, "<br/>");
  
  // Find "每日金句" or "黄金箴言" and highlight only the quote (not the interpretation)
  const highlightMarkers = ["每日金句", "黄金箴言"];
  let markerIndex = -1;
  let highlightMarker = "";
  
  for (const marker of highlightMarkers) {
    const idx = processedContent.indexOf(marker);
    if (idx !== -1) {
      markerIndex = idx;
      highlightMarker = marker;
      break;
    }
  }
  
  if (markerIndex !== -1) {
    // Split at the marker
    const beforeMarker = processedContent.substring(0, markerIndex + highlightMarker.length);
    let afterMarker = processedContent.substring(markerIndex + highlightMarker.length);
    
    // Remove leading punctuation/spaces
    afterMarker = afterMarker.replace(/^[：:，,。.\s]+/, '');
    
    // Find the quote - look for text until interpretation markers or next section
    // Interpretation markers: "这句话", "这", "它", "这个观点", etc.
    const interpretationStartPattern = /(这句话|这|它|这个观点|这种|这种观点|这种思想|这体现了|这说明了|这反映了|这揭示了|这展现了|这表达了|这传递了|这诠释了|这阐释了|这揭示了|这彰显了|这昭示了|这暗示了|这暗示|这意味着|这代表|这象征)/i;
    const interpretationMatch = afterMarker.match(interpretationStartPattern);
    
    let quote = "";
    let rest = "";
    
    if (interpretationMatch) {
      // Found interpretation text, extract quote before it
      const interpretationStart = interpretationMatch.index;
      quote = afterMarker.substring(0, interpretationStart).trim();
      
      // Find where interpretation ends (usually at next <br/> or section)
      const afterInterpretation = afterMarker.substring(interpretationStart);
      const interpretationEnd = afterInterpretation.search(/<br\/><br\/>|<br\/>(?=[^<]*[：:])/);
      
      if (interpretationEnd !== -1) {
        rest = afterInterpretation.substring(interpretationEnd);
      } else {
        // Remove entire interpretation sentence/paragraph
        const sentenceEnd = afterInterpretation.search(/[。！？]<br\/>|[。！？]$/);
        if (sentenceEnd !== -1) {
          rest = afterInterpretation.substring(sentenceEnd + 1);
        } else {
          rest = "";
        }
      }
    } else {
      // No interpretation found, quote is until next <br/><br/> or section
      const nextDoubleBreak = afterMarker.indexOf('<br/><br/>');
      const nextSection = afterMarker.search(/<br\/>(?=[^<]*[：:])/);
      
      if (nextDoubleBreak !== -1) {
        quote = afterMarker.substring(0, nextDoubleBreak).trim();
        rest = afterMarker.substring(nextDoubleBreak);
      } else if (nextSection !== -1) {
        quote = afterMarker.substring(0, nextSection).trim();
        rest = afterMarker.substring(nextSection);
      } else {
        // Single break or end
        const nextBreak = afterMarker.indexOf('<br/>');
        if (nextBreak !== -1) {
          quote = afterMarker.substring(0, nextBreak).trim();
          rest = afterMarker.substring(nextBreak);
        } else {
          quote = afterMarker.trim();
          rest = "";
        }
      }
    }
    
    // Clean up quote (remove trailing punctuation that might be part of interpretation)
    quote = quote.replace(/[，,]$/, '').trim();
    
    // Replace marker with "每日金句" if it was "黄金箴言"
    const finalMarker = highlightMarker === "黄金箴言" ? "每日金句" : highlightMarker;
    processedContent = beforeMarker.replace(highlightMarker, finalMarker) + '：<span class="highlight-quote">' + quote + '</span>' + rest;
  }
  
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
    statusEl.textContent = `获取摘要失败：${err.message || "请稍后再试"}`;
  }
};

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const depth = btn.dataset.depth;
    loadSummary(depth);
  });
});

prevDayBtn.addEventListener("click", () => {
  // Disabled for now - start date is today
  // const prevDate = new Date(currentDate);
  // prevDate.setDate(prevDate.getDate() - 1);
  // loadBookForDate(prevDate);
});

nextDayBtn.addEventListener("click", () => {
  if (isToday(currentDate)) return;
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);
  if (nextDate <= new Date()) {
    loadBookForDate(nextDate);
  }
});

const extractQuote = (summaryContent) => {
  if (!summaryContent) return null;
  
  // Look for "每日金句" or "黄金箴言" followed by the quote
  const quotePattern = /(?:每日金句|黄金箴言)[：:]\s*([^<]+?)(?=<br\/>|$|(?:这句话|这|它|这个观点))/i;
  const match = summaryContent.match(quotePattern);
  
  if (match && match[1]) {
    // Clean up the quote - remove HTML tags and extra whitespace
    let quote = match[1]
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    // Remove trailing punctuation that might be part of interpretation (but keep periods)
    quote = quote.replace(/[，,！？]$/, '').trim();
    
    // Ensure quote ends with a period (。) if it doesn't already end with punctuation
    if (quote && !/[。！？]$/.test(quote)) {
      quote += '。';
    }
    
    return quote;
  }
  
  return null;
};

const getQuoteFromSummary = async () => {
  // Try to get quote from currently loaded summary
  if (summaryEl.innerHTML) {
    const quote = extractQuote(summaryEl.innerHTML);
    if (quote) return quote;
  }
  
  // If not loaded, fetch the resonance summary to get the quote
  try {
    const data = await fetchJson(`/api/book/${currentBook.id}/summary`);
    const resonanceContent = data.summary?.resonance || '';
    return extractQuote(resonanceContent);
  } catch (err) {
    console.error("Failed to fetch quote:", err);
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
    const quote = await getQuoteFromSummary();
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
          text: `📚 ${currentBook.title_cn}\n${quote ? `"${quote}"` : ''}\n\n${shareUrl}`,
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
          text: `📚 ${currentBook.title_cn}\n${quote ? `"${quote}"` : ''}\n\n${shareUrl}`,
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
  
  // Get the quote
  const quote = await getQuoteFromSummary();
  
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
  shareCardQuote.textContent = quote || "点击查看完整内容";
  
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

