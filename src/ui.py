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
        --ds-accent: #f6b900;
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
        padding: 7px 10px; border-radius: 999px;
        border: 1px solid var(--ds-border);
        background: rgba(255,255,255,0.04);
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
        background: linear-gradient(135deg, #f6b900 0%, #d49d00 100%);
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
        color: #f6b900;
        font-weight: 900;
        background: rgba(246,185,0,0.12);
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* Modern Button Overrides - Subtle, Professional */
      div[data-testid="column"] > div > div > div > button {
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        color: rgba(255,255,255,0.88) !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        font-size: 13px !important;
        padding: 10px 16px !important;
        transition: all 0.2s ease !important;
        box-shadow: none !important;
      }
      
      div[data-testid="column"] > div > div > div > button:hover {
        background: rgba(255,255,255,0.14) !important;
        border-color: rgba(246,185,0,0.4) !important;
        color: #f6b900 !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      }
      
      div[data-testid="column"] > div > div > div > button:active {
        transform: translateY(0);
      }

      /* Reaction Chips - Modern Pills */
      .ds-react {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      
      .ds-react button {
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 999px !important;
        padding: 7px 14px !important;
        min-height: 36px !important;
        color: rgba(255,255,255,0.85) !important;
        font-weight: 800 !important;
        font-size: 13px !important;
        transition: all 0.2s ease !important;
      }
      
      .ds-react button:hover {
        background: rgba(246,185,0,0.15) !important;
        border-color: rgba(246,185,0,0.5) !important;
        color: #f6b900 !important;
        transform: scale(1.05);
      }

      /* Form Buttons - Gold Primary Style */
      div[data-testid="stForm"] button[kind="primary"],
      div[data-testid="stForm"] button:first-of-type {
        background: linear-gradient(135deg, #f6b900 0%, #d49d00 100%) !important;
        border: none !important;
        color: #000 !important;
        font-weight: 900 !important;
        border-radius: 10px !important;
        padding: 12px 20px !important;
        box-shadow: 0 4px 12px rgba(246,185,0,0.3) !important;
      }
      
      div[data-testid="stForm"] button[kind="primary"]:hover {
        background: linear-gradient(135deg, #ffca28 0%, #f6b900 100%) !important;
        box-shadow: 0 6px 16px rgba(246,185,0,0.4) !important;
        transform: translateY(-2px);
      }

      /* Hide Streamlit Branding */
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      header {visibility: hidden;}
    </style>
    """, unsafe_allow_html=True)

