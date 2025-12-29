import fs from "fs/promises";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const CACHE_PATH = path.join(DATA_DIR, "cache.json");
const BOOKS_PATH = path.join(DATA_DIR, "books.json");

async function loadJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EMPTY" || err instanceof SyntaxError) {
      return fallback;
    }
    throw err;
  }
}

async function listCache() {
  try {
    const cache = await loadJson(CACHE_PATH, {});
    const books = await loadJson(BOOKS_PATH, []);
    
    const cachedIds = Object.keys(cache).map(Number).sort((a, b) => a - b);
    
    console.log("\n📚 Cached Books Summary:");
    console.log(`   Total cached: ${cachedIds.length} books\n`);
    
    if (cachedIds.length === 0) {
      console.log("   No cached summaries found.");
      return;
    }
    
    // Show first 10 and last 10
    const showCount = Math.min(10, cachedIds.length);
    console.log("   First few cached books:");
    for (let i = 0; i < showCount; i++) {
      const bookId = cachedIds[i];
      const book = books.find(b => b.id === bookId);
      const bookTitle = book ? book.title_cn : `Unknown (ID: ${bookId})`;
      const cacheEntry = cache[bookId];
      const hasAllVersions = cacheEntry && cacheEntry.resonance && cacheEntry.deep_dive && cacheEntry.masterclass;
      const versions = hasAllVersions ? "✅" : "⚠️";
      console.log(`   ${versions} ID ${bookId}: ${bookTitle}`);
    }
    
    if (cachedIds.length > showCount) {
      console.log(`   ... and ${cachedIds.length - showCount} more`);
    }
    
    // Check for problematic entries (same content in all versions)
    console.log("\n🔍 Checking for problematic entries...");
    let problematicCount = 0;
    const problematicIds = [];
    
    for (const bookId of cachedIds) {
      const entry = cache[bookId];
      if (!entry) continue;
      
      const { resonance, deep_dive, masterclass } = entry;
      if (!resonance || !deep_dive || !masterclass) {
        problematicIds.push({ id: bookId, reason: "Missing versions" });
        problematicCount++;
      } else if (resonance === deep_dive || resonance === masterclass || deep_dive === masterclass) {
        problematicIds.push({ id: bookId, reason: "Identical versions" });
        problematicCount++;
      }
    }
    
    if (problematicCount > 0) {
      console.log(`   ⚠️  Found ${problematicCount} problematic entries:`);
      for (const { id, reason } of problematicIds.slice(0, 10)) {
        const book = books.find(b => b.id === id);
        const bookTitle = book ? book.title_cn : `Unknown (ID: ${id})`;
        console.log(`      - ID ${id}: ${bookTitle} (${reason})`);
      }
      if (problematicIds.length > 10) {
        console.log(`      ... and ${problematicIds.length - 10} more`);
      }
    } else {
      console.log("   ✅ All cached entries look good!");
    }
    
    return { cache, cachedIds, problematicIds };
  } catch (err) {
    console.error("❌ Error listing cache:", err.message);
    throw err;
  }
}

async function clearCache(bookIds = null) {
  try {
    const cache = await loadJson(CACHE_PATH, {});
    
    if (bookIds === null || bookIds.length === 0) {
      // Clear all
      const cacheSize = Object.keys(cache).length;
      await fs.writeFile(CACHE_PATH, JSON.stringify({}, null, 2), "utf8");
      console.log(`✅ Cleared all cache (${cacheSize} entries removed)`);
      return cacheSize;
    } else {
      // Clear specific books
      let clearedCount = 0;
      for (const bookId of bookIds) {
        if (cache[bookId]) {
          delete cache[bookId];
          clearedCount++;
        }
      }
      await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
      console.log(`✅ Cleared cache for ${clearedCount} book(s): ${bookIds.join(", ")}`);
      return clearedCount;
    }
  } catch (err) {
    console.error("❌ Error clearing cache:", err.message);
    throw err;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    if (command === "list" || command === "ls" || !command) {
      // List cache
      await listCache();
    } else if (command === "clear" || command === "rm") {
      // Clear cache
      if (args[1] === "all" || args[1] === "*") {
        // Clear all
        console.log("⚠️  Clearing ALL cache...");
        await clearCache(null);
      } else if (args[1]) {
        // Clear specific books
        const bookIds = args.slice(1).map(id => {
          const num = Number(id);
          if (isNaN(num)) throw new Error(`Invalid book ID: ${id}`);
          return num;
        });
        await clearCache(bookIds);
      } else {
        console.log("Usage:");
        console.log("  npm run clear-cache list          - List all cached books");
        console.log("  npm run clear-cache clear <id>   - Clear cache for specific book ID(s)");
        console.log("  npm run clear-cache clear all    - Clear ALL cache (use with caution)");
        console.log("\nExample:");
        console.log("  npm run clear-cache clear 1 2 3  - Clear cache for books 1, 2, and 3");
      }
    } else {
      console.log("Usage:");
      console.log("  npm run clear-cache [list]        - List all cached books (default)");
      console.log("  npm run clear-cache clear <id>    - Clear cache for specific book ID(s)");
      console.log("  npm run clear-cache clear all     - Clear ALL cache");
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();

