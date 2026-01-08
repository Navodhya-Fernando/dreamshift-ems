# 🚀 Streamlit Cloud Deployment Guide

## ⚠️ Critical Fix: MongoDB Connection Error

**Error**: `pymongo.errors.ServerSelectionTimeoutError`

**Root Cause**: MongoDB connection timeout on Streamlit Cloud due to:
1. Missing retry/timeout configuration
2. Incorrect database name format in `.env`
3. Missing Streamlit secrets configuration

---

## ✅ Fixes Applied

### 1. **Updated `src/database.py`** ✅

**Changes**:
- Added cloud-optimized MongoDB connection parameters
- Increased timeout to 10 seconds (from default 30s)
- Enabled retry for reads and writes
- Added connection pooling (10-50 connections)
- Background index creation to prevent blocking
- Support for both `.env` (local) and Streamlit secrets (cloud)
- Ping test before index creation

**New Connection Code**:
```python
self.client = MongoClient(
    mongodb_uri,
    serverSelectionTimeoutMS=10000,  # 10 second timeout
    connectTimeoutMS=10000,
    socketTimeoutMS=10000,
    retryWrites=True,
    retryReads=True,
    maxPoolSize=50,
    minPoolSize=10
)
```

---

### 2. **Fixed `.env` File** ✅

**Before**:
```bash
MONGODB_URI=mongodb+srv://navodhya:KyVXwIzLSdjNT1gW@dremashift-ems.knwm5dk.mongodb.net/
DB_NAME="dreamshift"
```

**After**:
```bash
MONGODB_URI=mongodb+srv://navodhya:KyVXwIzLSdjNT1gW@dremashift-ems.knwm5dk.mongodb.net/?retryWrites=true&w=majority&appName=dremashift-ems
DB_NAME=dreamshift
```

**Changes**:
- ✅ Added query parameters (`retryWrites`, `w=majority`, `appName`)
- ✅ Removed quotes from `DB_NAME` (causes issues in Python)
- ✅ Added proper URI path separator (`?`)

---

### 3. **Created `.streamlit/secrets.toml`** ✅

This file contains your secrets for **Streamlit Cloud deployment**.

**Location**: `.streamlit/secrets.toml`

**Note**: This file is **already populated** with your credentials from `.env`.

---

## 📋 Deployment Steps (Streamlit Cloud)

### Step 1: Push Changes to GitHub

```bash
cd /home/navodhya-fernando/Documents/DreamShift/dreamshift-ems

# Add all changes
git add .

# Commit fixes
git commit -m "Fix: MongoDB connection timeout on Streamlit Cloud"

# Push to GitHub
git push origin master
```

---

### Step 2: Configure Streamlit Cloud Secrets

1. Go to your Streamlit Cloud app: https://share.streamlit.io/
2. Click on your app → **"⋮" menu** → **"Settings"**
3. Go to **"Secrets"** section
4. Copy the entire contents of `.streamlit/secrets.toml` and paste it there
5. Click **"Save"**

**Important**: Do NOT commit `.streamlit/secrets.toml` to GitHub for security!

---

### Step 3: Add `.streamlit/secrets.toml` to `.gitignore`

```bash
echo ".streamlit/secrets.toml" >> .gitignore
git add .gitignore
git commit -m "Security: Ignore Streamlit secrets file"
git push
```

---

### Step 4: Reboot Your Streamlit App

1. In Streamlit Cloud dashboard, click **"Reboot app"**
2. Wait for deployment (1-2 minutes)
3. Check logs for any errors

---

## 🔍 Verify MongoDB Connection

### Test Locally First

```bash
cd /home/navodhya-fernando/Documents/DreamShift/dreamshift-ems
streamlit run 🏠_Home.py
```

**Expected Output**:
```
You can now view your Streamlit app in your browser.
  Local URL: http://localhost:8501
```

**If you see errors**, check:
- MongoDB Atlas IP whitelist (add `0.0.0.0/0` to allow all IPs)
- Database user permissions (needs read/write access)
- Cluster is running (not paused)

---

### Test on Streamlit Cloud

After deployment, check the logs:

1. Go to Streamlit Cloud app
2. Click **"Manage app"** (bottom right)
3. View **"Logs"** tab
4. Look for connection success message

**Success Indicators**:
- No `ServerSelectionTimeoutError`
- App loads normally
- Can create/view workspaces and tasks

---

## 🛠️ MongoDB Atlas Configuration

### Allow Streamlit Cloud IPs

**Option 1: Allow All IPs** (Easiest)
1. Go to MongoDB Atlas → **Network Access**
2. Click **"Add IP Address"**
3. Choose **"Allow access from anywhere"** (`0.0.0.0/0`)
4. Click **"Confirm"**

**Option 2: Specific IPs** (More Secure)
Streamlit Cloud uses dynamic IPs, so Option 1 is recommended.

---

### Verify Database User Permissions

1. Go to MongoDB Atlas → **Database Access**
2. Find user: `navodhya`
3. Ensure role: **"Read and write to any database"** or **"Atlas admin"**
4. Click **"Edit"** if you need to update permissions

---

## 🐛 Troubleshooting

### Error: "ServerSelectionTimeoutError"

**Cause**: MongoDB can't be reached

**Solutions**:
1. ✅ Check MongoDB Atlas IP whitelist
2. ✅ Verify cluster is running (not paused)
3. ✅ Check credentials in secrets
4. ✅ Ensure database name is correct (`dreamshift`)

---

### Error: "Authentication failed"

**Cause**: Wrong username/password

**Solutions**:
1. Verify credentials in MongoDB Atlas
2. Update `.streamlit/secrets.toml` with correct password
3. Update Streamlit Cloud secrets
4. Reboot app

---

### Error: "Database name not found"

**Cause**: `DB_NAME` mismatch

**Solutions**:
1. Check MongoDB Atlas - database should be `dreamshift`
2. Update `DB_NAME` in secrets to match
3. Reboot app

---

### Error: "Index creation failed"

**Cause**: Indexes might already exist

**Solution**: This is now handled gracefully with try/except. The app will continue to work even if index creation fails.

---

## 📊 Performance Optimization

### Current Settings

```python
serverSelectionTimeoutMS=10000,  # 10 seconds
connectTimeoutMS=10000,          # 10 seconds
socketTimeoutMS=10000,           # 10 seconds
maxPoolSize=50,                  # Max 50 connections
minPoolSize=10,                  # Min 10 connections
retryWrites=True,                # Auto-retry failed writes
retryReads=True                  # Auto-retry failed reads
```

### Why These Settings?

- **10s timeout**: Streamlit Cloud needs time to establish connection
- **Connection pooling**: Reuses connections for better performance
- **Retry enabled**: Handles temporary network issues automatically
- **Background indexes**: Don't block app startup

---

## 🔐 Security Best Practices

### DO ✅

- ✅ Use `.streamlit/secrets.toml` for cloud secrets
- ✅ Add secrets to `.gitignore`
- ✅ Use environment variables in `.env` for local dev
- ✅ Rotate passwords regularly
- ✅ Use MongoDB Atlas IP whitelist

### DON'T ❌

- ❌ Commit `.env` to GitHub
- ❌ Commit `.streamlit/secrets.toml` to GitHub
- ❌ Share credentials in public channels
- ❌ Use weak passwords

---

## 📝 Summary of Changes

| File | Change | Status |
|------|--------|--------|
| `src/database.py` | Added cloud-optimized connection | ✅ Done |
| `.env` | Fixed MongoDB URI format | ✅ Done |
| `.streamlit/secrets.toml` | Created secrets file | ✅ Done |
| `.gitignore` | Need to add secrets.toml | ⏳ To Do |

---

## 🚀 Next Steps

1. **Add secrets to `.gitignore`**:
   ```bash
   echo ".streamlit/secrets.toml" >> .gitignore
   ```

2. **Test locally**:
   ```bash
   streamlit run 🏠_Home.py
   ```

3. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Fix: MongoDB connection for Streamlit Cloud"
   git push origin master
   ```

4. **Configure Streamlit Cloud**:
   - Copy `.streamlit/secrets.toml` → Streamlit Cloud Secrets
   - Reboot app

5. **Verify deployment**:
   - Check logs for connection success
   - Test creating workspace/task

---

## ✅ Expected Results

After following these steps:

✅ App deploys successfully on Streamlit Cloud  
✅ MongoDB connection established  
✅ No more `ServerSelectionTimeoutError`  
✅ All features work (workspaces, tasks, comments)  
✅ Modern UI displays correctly  

---

## 📞 Support

**If issues persist**:

1. Check Streamlit Cloud logs
2. Verify MongoDB Atlas network access
3. Test connection string in MongoDB Compass
4. Review this guide step-by-step

**Common Fix**: Allow all IPs (`0.0.0.0/0`) in MongoDB Atlas Network Access

---

**Last Updated**: January 5, 2026  
**Deployment Platform**: Streamlit Cloud  
**Database**: MongoDB Atlas  

*Happy Deploying! 🚀*
