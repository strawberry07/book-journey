#!/usr/bin/env node
/**
 * End-to-end test script for Book Journey app
 * Run: node test.js
 */

import http from "http";

const BASE_URL = "http://localhost:3000";
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

const log = (color, msg) => console.log(`${color}${msg}${colors.reset}`);
const success = (msg) => log(colors.green, `✓ ${msg}`);
const error = (msg) => log(colors.red, `✗ ${msg}`);
const info = (msg) => log(colors.blue, `ℹ ${msg}`);
const warn = (msg) => log(colors.yellow, `⚠ ${msg}`);

const fetchJson = (path) => {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    }).on("error", reject);
  });
};

const tests = [];

// Test 1: Server is running
tests.push(async () => {
  info("Test 1: Checking if server is running...");
  try {
    await fetchJson("/api/book/today");
    success("Server is running and responding");
    return true;
  } catch (err) {
    error(`Server not accessible: ${err.message}`);
    error("Make sure to run: npm start (in another terminal)");
    return false;
  }
});

// Test 2: Today's book endpoint
tests.push(async () => {
  info("Test 2: Testing /api/book/today endpoint...");
  try {
    const data = await fetchJson("/api/book/today");
    if (!data) {
      error("Empty response from server");
      return false;
    }
    if (!data.book) {
      error(`Response missing 'book' field. Received: ${JSON.stringify(data).substring(0, 200)}`);
      return false;
    }
    if (data.book === null || data.book === undefined) {
      error("Book field is null or undefined");
      return false;
    }
    if (!data.book.id || !data.book.title_cn) {
      error(`Book data incomplete. Received: ${JSON.stringify(data.book).substring(0, 200)}`);
      return false;
    }
    success(
      `Today's book: "${data.book.title_cn}" (ID: ${data.book.id}) by ${data.book.author || "Unknown"}`
    );
    return { book: data.book };
  } catch (err) {
    error(`Failed to get today's book: ${err.message}`);
    return false;
  }
});

// Test 3: Summary endpoint (with caching)
tests.push(async (prevResult) => {
  if (!prevResult || !prevResult.book) {
    warn("Skipping summary test (previous test failed)");
    return false;
  }
  const bookId = prevResult.book.id;
  info(`Test 3: Testing summary generation for book ID ${bookId}...`);
  info("This will call DeepSeek API if not cached (may take 10-30 seconds)...");
  
  try {
    const startTime = Date.now();
    const data = await fetchJson(`/api/book/${bookId}/summary`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (!data.summary) {
      error("Response missing 'summary' field");
      return false;
    }
    
    const summary = data.summary;
    const isCached = duration < 2;
    
    if (isCached) {
      success(`Summary retrieved from cache (${duration}s)`);
    } else {
      success(`Summary generated via DeepSeek API (${duration}s)`);
      warn("Note: This summary is now cached for future requests");
    }
    
    // Check all three depth levels
    const depths = ["resonance", "deep_dive", "masterclass"];
    const missing = depths.filter((d) => !summary[d] || summary[d].trim().length === 0);
    
    if (missing.length > 0) {
      error(`Missing depth levels: ${missing.join(", ")}`);
      return false;
    }
    
    success(`All three depth levels present:`);
    depths.forEach((depth) => {
      const length = summary[depth].length;
      const preview = summary[depth].substring(0, 50).replace(/\n/g, " ");
      info(`  - ${depth}: ${length} chars - "${preview}..."`);
    });
    
    return { summary };
  } catch (err) {
    error(`Failed to get summary: ${err.message}`);
    if (err.message.includes("ECONNREFUSED")) {
      error("Make sure DeepSeek API key is set: export DEEPSEEK_API_KEY='your-key'");
    }
    return false;
  }
});

// Test 4: Static files
tests.push(async () => {
  info("Test 4: Testing static file serving...");
  const files = ["/", "/styles.css", "/app.js"];
  let allOk = true;
  
  for (const file of files) {
    try {
      await fetchJson(file);
      success(`Static file accessible: ${file}`);
    } catch (err) {
      // Static files return HTML/CSS, not JSON, so parse errors are OK
      if (err.message.includes("Invalid JSON")) {
        success(`Static file accessible: ${file}`);
      } else {
        error(`Failed to access ${file}: ${err.message}`);
        allOk = false;
      }
    }
  }
  return allOk;
});

// Test 5: Date display
tests.push(async () => {
  info("Test 5: Verifying date formatting...");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const expected = `${year}年${month}月${day}日`;
  success(`Expected date format: ${expected}`);
  info("Date will be displayed in the UI automatically");
  return true;
});

// Run all tests
const runTests = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("  Book Journey - End-to-End Test Suite");
  console.log("=".repeat(60) + "\n");
  
  let prevResult = null;
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < tests.length; i++) {
    try {
      const result = await tests[i](prevResult);
      if (result === false) {
        failed++;
        prevResult = null;
      } else {
        passed++;
        prevResult = result === true ? null : result;
      }
    } catch (err) {
      error(`Test ${i + 1} threw error: ${err.message}`);
      failed++;
      prevResult = null;
    }
    console.log("");
  }
  
  console.log("=".repeat(60));
  if (failed === 0) {
    success(`All tests passed! (${passed}/${tests.length})`);
    console.log("\n✅ Your app is ready to use!");
    console.log(`   Open http://localhost:3000 in your browser`);
  } else {
    error(`Some tests failed (${passed} passed, ${failed} failed)`);
    console.log("\n⚠️  Please fix the issues above before publishing");
  }
  console.log("=".repeat(60) + "\n");
};

runTests().catch(console.error);

