import streamlit as st
from datetime import datetime

def render_comment_thread(comments, current_user_id):
    """Render comments in ClickUp-style thread"""
    st.markdown('<div class="ds-comments">', unsafe_allow_html=True)

    for c in comments:
        is_me = (c.get("user_email") == current_user_id or c.get("user_id") == current_user_id)
        author = c.get("user_name") or c.get("author_name") or c.get("user_email") or "User"
        
        created = c.get("created_at")
        if isinstance(created, datetime):
            ts = created.strftime("%b %d, %I:%M %p").replace(" 0", " ")
        else:
            ts = str(created) if created else ""

        role = "user" if is_me else "assistant"
        
        with st.chat_message(role):
            st.markdown(
                f"""
                <div class="ds-comment-card">
                  <div class="ds-comment-meta">
                    <span class="ds-comment-author">{author}</span>
                    <span class="ds-comment-time">{ts}</span>
                  </div>
                  <div class="ds-comment-body">{c.get("text", "")}</div>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("</div>", unsafe_allow_html=True)

def comment_input_box(placeholder="Write a comment (@mention teammates by name)..."):
    """Clean comment input using st.chat_input"""
    msg = st.chat_input(placeholder)
    if not msg:
        return None
    return msg.strip()
