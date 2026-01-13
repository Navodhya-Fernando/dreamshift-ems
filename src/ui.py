# src/ui.py
import streamlit as st
from pathlib import Path

def load_global_css():
    css_path = Path("static/styles.css")
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text()}</style>", unsafe_allow_html=True)

    st.markdown("""
    <style>
      :root{
        --ds-bg: #0b1220;
        --ds-card: rgba(255,255,255,0.06);
        --ds-border: rgba(255,255,255,0.12);
        --ds-text: rgba(255,255,255,0.88);
        --ds-muted: rgba(255,255,255,0.60);
        --ds-accent: #411c30;
      }

      .block-container { 
        padding-top: 1.2rem; 
        padding-bottom: 2rem; 
        max-width: 1200px; 
      }

      /* Cards */
      .ds-card {
        background: var(--ds-card);
        border: 1px solid var(--ds-border);
        border-radius: 14px;
        padding: 16px;
      }

      .ds-title { font-size: 22px; font-weight: 800; color: #fff; margin: 0; }
      .ds-subtitle { color: var(--ds-muted); margin-top: 6px; font-size: 14px; }

      .ds-row { display:flex; gap:10px; flex-wrap: wrap; align-items:center; }
      .ds-pill {
        display:inline-flex; gap:8px; align-items:center;
        padding: 7px 10px; border-radius: 10px;
        border: 1px solid var(--ds-border);
        background: rgba(255,255,255,0.03);
        color: var(--ds-muted); font-size: 12px; font-weight: 600;
      }
      .ds-pill b { color: #fff; font-weight: 800; }

      /* Chat Cards - Modern Dark Theme */
      .ds-chat-card { 
        background: linear-gradient(135deg, rgba(22,33,62,0.8) 0%, rgba(26,38,68,0.6) 100%);
        border: 1px solid rgba(246,185,0,0.15);
        border-radius: 16px; 
        padding: 18px 20px; 
        margin-bottom: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      }
      .ds-chat-card:hover {
        border-color: rgba(246,185,0,0.25);
        box-shadow: 0 6px 16px rgba(0,0,0,0.4);
      }
      
      .ds-indent { 
        margin-left: 32px;
        border-left: 2px solid rgba(246,185,0,0.2);
        padding-left: 16px;
      }
      
      .ds-chat-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .ds-chat-author { 
        color: #fff; 
        font-weight: 900; 
        font-size: 14px;
        letter-spacing: 0.3px;
      }
      
      .ds-chat-meta {
        display: flex;
        gap: 12px;
        align-items: center;
        color: rgba(255,255,255,0.50);
        font-size: 12px;
      }
      
      .ds-chat-text { 
        color: rgba(255,255,255,0.92); 
        font-size: 14px; 
        line-height: 1.65;
        margin-bottom: 14px;
      }
      
      .ds-pin-badge {
        padding: 4px 10px; 
        border-radius: 999px;
        background: linear-gradient(135deg, #411c30 0%, #2d1420 100%);
        color: #000;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 6px rgba(246,185,0,0.3);
      }
      
      .ds-edited {
        color: rgba(255,255,255,0.45);
        font-size: 11px;
        font-style: italic;
      }
      
      .ds-deleted {
        color: rgba(255,255,255,0.45);
        font-style: italic;
      }
      
      .ds-mention {
        color: #411c30;
        font-weight: 900;
        background: rgba(65,28,48,0.12);
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* Modern Button Overrides - Subtle, Professional (ClickUp-style) */
      .stButton > button,
      .stFormSubmitButton > button {
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.92) !important;
        border-radius: 10px !important;
        font-weight: 650 !important;
        font-size: 13px !important;
        padding: 0.5rem 0.9rem !important;
        transition: all 0.2s ease !important;
        box-shadow: none !important;
      }
      
      .stButton > button:hover,
      .stFormSubmitButton > button:hover {
        background: rgba(255,255,255,0.10) !important;
        border-color: rgba(255,255,255,0.18) !important;
        transform: none !important;
      }

      /* Primary buttons only - purple CTA */
      .stButton > button[kind="primary"],
      .stFormSubmitButton > button[kind="primary"] {
        background: linear-gradient(135deg, #411c30 0%, #2d1420 100%) !important;
        border: 1px solid rgba(65,28,48,0.35) !important;
        color: #fff !important;
        font-weight: 800 !important;
        box-shadow: 0 6px 18px rgba(65,28,48,0.22) !important;
      }
      
      .stButton > button[kind="primary"]:hover,
      .stFormSubmitButton > button[kind="primary"]:hover {
        background: linear-gradient(135deg, #6b3a50 0%, #411c30 100%) !important;
        box-shadow: 0 10px 26px rgba(65,28,48,0.32) !important;
      }

      /* Reaction buttons - compact chips */
      .ds-react button {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 12px !important;
        padding: 6px 10px !important;
        min-height: 30px !important;
        color: rgba(255,255,255,0.82) !important;
        font-weight: 800 !important;
        font-size: 12px !important;
        transition: all 0.18s ease !important;
      }
      
      .ds-react button:hover {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.18) !important;
        color: #fff !important;
        transform: scale(1.02);
      }

      /* Hide heading anchor icons/dashes added by Streamlit */
      [data-testid="stMarkdownContainer"] h1 a,
      [data-testid="stMarkdownContainer"] h2 a,
      [data-testid="stMarkdownContainer"] h3 a,
      [data-testid="stMarkdownContainer"] h4 a,
      [data-testid="stMarkdownContainer"] h5 a,
      [data-testid="stMarkdownContainer"] h6 a {
        display: none !important;
      }

      /* Form Buttons - Only Primary is Yellow */
      .stForm button[kind="primary"],
      .stFormSubmitButton button[kind="primary"] {
        background: linear-gradient(135deg, #f6b900 0%, #d49d00 100%) !important;
        border: 1px solid rgba(246,185,0,0.35) !important;
        color: #000 !important;
        font-weight: 900 !important;
        border-radius: 10px !important;
        padding: 12px 20px !important;
        box-shadow: 0 4px 12px rgba(246,185,0,0.3) !important;
      }
      
      .stForm button[kind="primary"]:hover,
      .stFormSubmitButton button[kind="primary"]:hover {
        background: linear-gradient(135deg, #ffca28 0%, #f6b900 100%) !important;
        box-shadow: 0 6px 16px rgba(246,185,0,0.4) !important;
        transform: translateY(-2px);
      }

      /* Secondary form buttons - subtle */
      .stForm button:not([kind="primary"]),
      .stFormSubmitButton button:not([kind="primary"]) {
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.92) !important;
      }

      /* Hide Streamlit Branding */
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      header {visibility: hidden;}

      /* ═══════════════════════════════════════════════════════
         FUTURE UI/UX ENHANCEMENTS
         ═══════════════════════════════════════════════════════ */

      /* 1. Metric Cards with Pulse Animation */
      @keyframes metric-pulse {
        0%, 100% { 
          box-shadow: 0 0 0 0 rgba(246,185,0,0.4);
          transform: scale(1);
        }
        50% { 
          box-shadow: 0 0 0 8px rgba(246,185,0,0);
          transform: scale(1.02);
        }
      }

      .ds-metric-pulse {
        animation: metric-pulse 2s ease-in-out infinite;
        background: linear-gradient(135deg, rgba(246,185,0,0.08) 0%, rgba(246,185,0,0.03) 100%);
        border: 1px solid rgba(246,185,0,0.25);
        border-radius: 12px;
        padding: 16px;
        transition: all 0.3s ease;
      }

      .ds-metric-pulse:hover {
        transform: scale(1.05) !important;
        box-shadow: 0 8px 24px rgba(246,185,0,0.2) !important;
      }

      /* 2. Task Cards with Urgency Color Coding */
      .ds-task-card {
        background: var(--ds-card);
        border: 1px solid var(--ds-border);
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 10px;
        border-left: 4px solid var(--urgency-color, #888);
        transition: all 0.2s ease;
      }

      .ds-task-card:hover {
        transform: translateX(4px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }

      .ds-task-low { --urgency-color: #4caf50; } /* Green */
      .ds-task-medium { --urgency-color: #ffca28; } /* Yellow */
      .ds-task-high { --urgency-color: #ff9800; } /* Orange */
      .ds-task-critical { --urgency-color: #f44336; } /* Red */

      /* 3. Thread Depth Limiting (max 3 levels) */
      .ds-indent-1 { 
        margin-left: 32px;
        border-left: 2px solid rgba(246,185,0,0.2);
        padding-left: 16px;
      }

      .ds-indent-2 { 
        margin-left: 64px;
        border-left: 2px solid rgba(246,185,0,0.15);
        padding-left: 16px;
      }

      .ds-indent-3 { 
        margin-left: 96px;
        border-left: 2px solid rgba(246,185,0,0.1);
        padding-left: 16px;
      }

      .ds-continue-thread {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(65,28,48,0.1);
        border: 1px solid rgba(65,28,48,0.3);
        color: #411c30;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 8px;
        text-decoration: none;
      }

      .ds-continue-thread:hover {
        background: rgba(246,185,0,0.2);
        transform: translateX(4px);
      }

      /* 4. Quote Reply Styling */
      .ds-quote {
        border-left: 3px solid rgba(246,185,0,0.5);
        padding: 8px 12px;
        margin: 8px 0;
        background: rgba(255,255,255,0.03);
        border-radius: 6px;
        font-style: italic;
        color: rgba(255,255,255,0.70);
        font-size: 13px;
      }

      .ds-quote-author {
        color: #411c30;
        font-weight: 800;
        font-style: normal;
        margin-bottom: 4px;
      }

      /* 5. Edit History Badge */
      .ds-edit-history {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(33,150,243,0.1);
        border: 1px solid rgba(33,150,243,0.3);
        color: #2196f3;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ds-edit-history:hover {
        background: rgba(33,150,243,0.2);
        transform: scale(1.05);
      }

      /* 6. Deleted Comment Restore UI */
      .ds-deleted-card {
        opacity: 0.5;
        border: 1px dashed rgba(255,255,255,0.2);
        background: rgba(255,0,0,0.05);
      }

      .ds-restore-btn {
        background: rgba(76,175,80,0.2) !important;
        border: 1px solid rgba(76,175,80,0.4) !important;
        color: #4caf50 !important;
      }

      .ds-restore-btn:hover {
        background: rgba(76,175,80,0.3) !important;
        border-color: #4caf50 !important;
      }

      /* 7. Admin Override Badge */
      .ds-admin-badge {
        padding: 3px 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%);
        color: #fff;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 6px rgba(233,30,99,0.3);
      }

      /* 8. Mobile Responsive Thread Collapsing */
      @media (max-width: 768px) {
        .ds-indent-1 { margin-left: 16px; padding-left: 12px; }
        .ds-indent-2 { margin-left: 32px; padding-left: 12px; }
        .ds-indent-3 { margin-left: 48px; padding-left: 12px; }
        
        .ds-chat-card { padding: 14px 16px; }
      }

      /* 9. Loading Skeleton for Comments */
      @keyframes skeleton-loading {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }

      .ds-skeleton {
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.05) 0px,
          rgba(255,255,255,0.1) 40px,
          rgba(255,255,255,0.05) 80px
        );
        background-size: 200px 100%;
        animation: skeleton-loading 1.5s ease-in-out infinite;
        border-radius: 8px;
      }

      /* 10. Notification Dot for New Comments */
      .ds-new-badge {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4caf50;
        box-shadow: 0 0 8px rgba(76,175,80,0.6);
        animation: pulse-dot 2s ease-in-out infinite;
      }

      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; transform: scale(1.2); }
      }
    </style>
    """, unsafe_allow_html=True)

