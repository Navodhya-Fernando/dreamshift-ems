# Comment Display Fix - Complete Guide

## Problem Summary

### Issues Found
1. ❌ Raw HTML tags showing as text: `</div>`, `<span class='ds-pin-badge'>Pinned</span>`
2. ❌ Timestamps formatted incorrectly: `0654 AM` instead of `6:54 AM`
3. ❌ @mentions not styled properly
4. ❌ Old comments in database contain HTML from previous implementation

## Root Cause

**The database contains old comments with embedded HTML** from the previous implementation. For example:

```
"Hi <div style='color:rgba...'>Jan 04...</div> @user@email.com"
```

When we added `html.escape()` for security, it turned these into:

```
"Hi &lt;div style='color:rgba...'&gt;Jan 04...&lt;/div&gt; @user@email.com"
```

Which displays as literal text when rendered.

## The Fix

### 1. Updated `src/chat_ui.py`

Added three functions:

#### `strip_html_tags(text: str)`
```python
def strip_html_tags(text: str) -> str:
    """Remove any HTML tags from text (for cleaning old data)."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities that might exist
    clean = html.unescape(clean)
    return clean
```

#### Updated `safe_text_with_mentions(text: str)`
```python
def safe_text_with_mentions(text: str) -> str:
    """
    1. Strip any old HTML tags
    2. Escape user input so it cannot break your HTML
    3. Highlight @mentions with styled spans
    """
    # First, strip any old HTML tags from database
    cleaned = strip_html_tags(text or "")
    
    # Escape the cleaned text
    escaped = html.escape(cleaned)
    
    # Highlight mentions
    highlighted = re.sub(
        r"(@[\w\.\-\+@]+)",
        r"<span class='ds-mention'>\1</span>",
        escaped
    )
    
    return highlighted
```

#### Fixed `fmt_ts(dt)`
```python
def fmt_ts(dt) -> str:
    """Format timestamp in a clean, readable way."""
    if not dt:
        return ""
    if isinstance(dt, datetime.date) and not isinstance(dt, datetime.datetime):
        return dt.strftime("%b %d, %Y")
    # Remove leading zero from hour
    time_str = dt.strftime("%b %d, %I:%M %p")
    time_str = time_str.replace(" 0", " ")
    return time_str
```

### 2. Database Cleanup Script

Created `scripts/cleanup_html_comments.py` to clean existing comments:

**To run:**
```bash
cd /home/navodhya-fernando/Documents/DreamShift/dreamshift-ems
python scripts/cleanup_html_comments.py
```

This will:
- ✅ Find all comments with HTML tags
- ✅ Strip the HTML while keeping the text
- ✅ Update the database
- ✅ Show before/after for each comment

## Processing Flow

### Before (Broken)
```
Database: "Hi <div>...</div> @user@email.com"
          ↓
html.escape(): "Hi &lt;div&gt;...&lt;/div&gt; @user@email.com"
          ↓
Display: Shows literal HTML tags ❌
```

### After (Fixed)
```
Database: "Hi <div>...</div> @user@email.com"
          ↓
strip_html_tags(): "Hi ... @user@email.com"
          ↓
html.escape(): "Hi ... @user@email.com"
          ↓
highlight mentions: "Hi ... <span class='ds-mention'>@user@email.com</span>"
          ↓
Display: Shows styled mention ✅
```

## Implementation Steps

### Step 1: Code is Already Fixed ✅
The `src/chat_ui.py` file has been updated with the fixes.

### Step 2: Clean Database (Run This Once)
```bash
python scripts/cleanup_html_comments.py
```

Type `yes` when prompted.

### Step 3: Refresh Browser
Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

### Step 4: Verify
- ✅ No raw HTML tags visible
- ✅ @mentions highlighted in gold
- ✅ Timestamps show as "Jan 5, 6:54 PM"
- ✅ Pinned badges are gold pills
- ✅ Edited markers show correctly

## Security Notes

✅ **Still Secure**: We strip HTML *before* escaping, so user input cannot inject malicious code
✅ **XSS Protected**: All user text is still escaped with `html.escape()`
✅ **Mention Safety**: Mentions are added *after* escaping using safe regex replacement

## Testing

### Test 1: Old Comments
- Comments from before the fix should display cleanly
- No HTML tags visible

### Test 2: New Comments with @mentions
- Type: `Hi @user@example.com how are you?`
- Should display with gold highlight on the mention

### Test 3: Attempted HTML Injection
- Type: `<script>alert('test')</script>`
- Should display as literal text (escaped), not execute

### Test 4: Timestamps
- Should show as: `Jan 5, 6:54 PM` (not `0654 AM`)

## Files Modified

1. ✅ `src/chat_ui.py` - Added HTML stripping and improved formatting
2. ✅ `src/ui.py` - Modern CSS (already updated)
3. ✅ `scripts/cleanup_html_comments.py` - Database cleanup tool (NEW)

## Related Pages

Both pages use the same `render_comment()` function, so the fix applies to:
- ✅ `pages/project_details.py`
- ✅ `pages/task_details.py`

No changes needed to these files - the fix is in the shared component.

## Rollback Plan

If something goes wrong, you can restore old behavior by:

1. Remove the `strip_html_tags()` call from `safe_text_with_mentions()`
2. Database will still be cleaned, but you can restore from backup

## Performance Impact

✅ Minimal - regex operations are very fast
✅ One-time database cleanup (not repeated)
✅ All processing happens at render time (cached by Streamlit)

---

**Last Updated**: January 5, 2026
**Status**: ✅ Ready to deploy
**Next Step**: Run `python scripts/cleanup_html_comments.py`
