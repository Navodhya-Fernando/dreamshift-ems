# DreamShift EMS — Workspace, Project & Task Management

*Modern Streamlit app for team workspaces, projects, tasks, comments, and time tracking with a premium minimal UI.*

[![Platform](https://img.shields.io/badge/Platform-Streamlit-FF4B4B)](#)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248)](#)
[![Language](https://img.shields.io/badge/Language-Python-3776AB)](#)
[![UI](https://img.shields.io/badge/UI-Custom%20CSS-F6B900)](#)
[![License](https://img.shields.io/badge/License-Private-black)](#)

---

## ✨ Overview

DreamShift EMS is a **workspace-first project and task management system** built with Streamlit and MongoDB.
It provides clean workflows for teams to organize projects, assign tasks, track deadlines, and collaborate in real time.

---

## 🧠 Core Features

* 🔐 Secure authentication and role-based access
* 🏢 Workspaces with custom statuses and members
* 📁 Projects with deadlines and progress
* ✅ Tasks with priorities, deadlines, and subtasks
* 🧩 Kanban board with filters
* 💬 Comments with @mentions
* ⏱ Time tracking (timer + logs)
* 🔔 In-app notifications
* 📊 Dashboard analytics
* 🎨 Premium minimal UI with custom CSS

---

## 📁 Project Structure

```bash
dreamshift-ems/
│
├── Home.py              # Home dashboard
├── pages/               # Streamlit pages
├── src/                 # Database + UI helpers
├── static/              # CSS + icons
├── requirements.txt
└── .env
```

---

## ⚙️ Setup Guide

### 1️⃣ Environment

Create a .env file in the project root:

```env
MONGODB_URI=mongodb+srv://your-connection-string
DB_NAME=dreamshift
```

### 2️⃣ Install dependencies

```bash
pip install -r requirements.txt
```

### 3️⃣ Run locally

```bash
streamlit run Home.py
```

---

## 🧭 User Manual

See [USER_MANUAL.md](USER_MANUAL.md) for the full in-app workflow guide.

---

## 🪪 License

DreamShift EMS © 2026
