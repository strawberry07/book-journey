# Testing Guide - Book Journey App

## Quick Test Checklist

### 1. **Start the Server**
```bash
cd /Users/jessicali/book-journey
export DEEPSEEK_API_KEY="your-real-api-key-here"
npm start
```

You should see: `Book Journey server running at http://localhost:3000`

### 2. **Run Automated Tests** (in a new terminal)
```bash
cd /Users/jessicali/book-journey
npm test
```

This will test:
- ✅ Server connectivity
- ✅ Today's book endpoint
- ✅ Summary generation (DeepSeek API)
- ✅ Caching functionality
- ✅ Static file serving
- ✅ Date formatting

### 3. **Manual Browser Testing**

Open `http://localhost:3000` and verify:

#### **Visual Checks:**
- [ ] Header shows "每日书旅 · 100 本 · 365 天"
- [ ] Date displays correctly (e.g., "2025年1月15日")
- [ ] Today's book title (Chinese) is visible
- [ ] English title and author are shown
- [ ] Three depth buttons are visible: "3 分钟 · 精华", "10 分钟 · 思考", "30 分钟 · 沉浸"

#### **Functionality Tests:**
- [ ] Click "3 分钟 · 精华" → Button highlights (blue border/background)
- [ ] Summary appears below (should show Chinese content)
- [ ] Click "10 分钟 · 思考" → Previous button unhighlights, new one highlights
- [ ] New summary appears (different content, longer)
- [ ] Click "30 分钟 · 沉浸" → Summary appears (longest content)
- [ ] Progress bar is visible on 30-minute button

#### **API Tests:**
- [ ] First click on any depth takes 10-30 seconds (DeepSeek API call)
- [ ] Second click on same depth is instant (cached)
- [ ] Refresh page → Same book appears (24-hour rotation)
- [ ] Check browser console → No errors

### 4. **Test DeepSeek Integration**

**First Request (No Cache):**
```bash
curl http://localhost:3000/api/book/today
# Note the book ID, then:
curl http://localhost:3000/api/book/1/summary
# Should take 10-30 seconds, returns JSON with resonance, deep_dive, masterclass
```

**Second Request (Cached):**
```bash
curl http://localhost:3000/api/book/1/summary
# Should be instant (< 1 second)
```

**Verify Cache File:**
```bash
cat data/cache.json
# Should show the book ID with all three summary levels
```

### 5. **Test Daily Rotation**

**Check State:**
```bash
cat data/state.json
# Shows currentBookId and selectedAt timestamp
```

**Simulate Next Day** (for testing):
- Manually edit `data/state.json` and change `selectedAt` to a timestamp 25 hours ago
- Restart server → New book should be selected
- Verify it's different from previous book

### 6. **Test 14-Day Cooldown**

**Check History:**
```bash
cat data/history.json
# Shows all book selections with timestamps
```

**Verify Logic:**
- Books selected in last 14 days should not reappear
- After 14 days, they can be selected again

### 7. **Mobile Testing**

- [ ] Open on phone/tablet (or browser dev tools mobile view)
- [ ] Layout is responsive
- [ ] Buttons are easy to tap
- [ ] Text is readable
- [ ] Date is visible

### 8. **Error Handling Tests**

**Test Missing API Key:**
```bash
# Stop server, restart without DEEPSEEK_API_KEY
npm start
# Click a depth button → Should show fallback message in Chinese
```

**Test Invalid Book ID:**
```bash
curl http://localhost:3000/api/book/9999/summary
# Should return error JSON
```

## Common Issues & Solutions

### Issue: "SyntaxError: Unexpected end of JSON input"
**Solution:** Delete corrupted data files:
```bash
rm -f data/cache.json data/history.json data/state.json
npm start
```

### Issue: DeepSeek API calls fail
**Solution:** 
- Verify API key: `echo $DEEPSEEK_API_KEY`
- Check network connectivity
- Verify key is valid at https://platform.deepseek.com

### Issue: Server won't start (port 3000 in use)
**Solution:**
```bash
# Use different port
PORT=3001 npm start
# Or kill process on port 3000
lsof -ti:3000 | xargs kill
```

### Issue: Cached summaries not working
**Solution:**
- Check `data/cache.json` exists and is valid JSON
- Verify file permissions: `ls -la data/`

## Pre-Publish Checklist

Before sharing your app, ensure:

- [ ] All automated tests pass (`npm test`)
- [ ] All three depth levels generate proper Chinese content
- [ ] Caching works (second request is instant)
- [ ] Date displays correctly
- [ ] Mobile layout looks good
- [ ] No console errors in browser
- [ ] API key is NOT in code (using environment variable)
- [ ] Books list has all 100 books
- [ ] Daily rotation works correctly
- [ ] 14-day cooldown prevents immediate repeats

## Performance Benchmarks

- **First summary request:** 10-30 seconds (DeepSeek API)
- **Cached summary request:** < 1 second
- **Page load time:** < 500ms
- **Button click response:** < 100ms (UI feedback)

---

**Ready to publish?** Once all tests pass, your app is ready to share! 🚀

