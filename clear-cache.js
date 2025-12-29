import fs from "fs/promises";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const CACHE_PATH = path.join(DATA_DIR, "cache.json");

async function clearCache() {
  try {
    // Check if cache file exists
    try {
      await fs.access(CACHE_PATH);
      console.log("📦 Cache file found, clearing...");
      
      // Read current cache to show stats
      const cache = JSON.parse(await fs.readFile(CACHE_PATH, "utf8"));
      const cacheSize = Object.keys(cache).length;
      console.log(`   Found ${cacheSize} cached summaries`);
      
      // Clear the cache
      await fs.writeFile(CACHE_PATH, JSON.stringify({}, null, 2), "utf8");
      console.log("✅ Cache cleared successfully!");
      console.log(`   Removed ${cacheSize} cached summaries`);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("ℹ️  No cache file found (already empty)");
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error("❌ Error clearing cache:", err.message);
    process.exit(1);
  }
}

// Run the script
clearCache();

