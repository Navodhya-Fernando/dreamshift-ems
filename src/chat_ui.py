# src/chat_ui.py
import datetime
import html
import re
import streamlit as st

REACTION_ORDER = ["👍", "❤️", "🎉", "👀", "✅"]

def fmt_ts(dt) -> str:
    """Format timestamp in a clean, readable way."""
    if not dt:
        return ""
    if isinstance(dt, datetime.date) and not isinstance(dt, datetime.datetime):
        return dt.strftime("%b %d, %Y")
    # Use %I for 12-hour format with leading zero removed for single digits
    time_str = dt.strftime("%b %d, %I:%M %p")
    # Remove leading zero from hour if present (e.g., "06:54" -> "6:54")
    time_str = time_str.replace(" 0", " ")
    return time_str

def strip_html_tags(text: str) -> str:
    """Remove any HTML tags from text (for cleaning old data)."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities that might exist
    clean = html.unescape(clean)
    return clean

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
    
    # Highlight mentions (supports both @email and @user formats)
    highlighted = re.sub(
        r"(@[\w\.\-\+@]+)",
        r"<span class='ds-mention'>\1</span>",
        escaped
    )
    
    return highlighted

def build_threads(comments: list[dict]):
    top_level = [c for c in comments if not c.get("parent_comment_id")]
    children_map: dict[str, list[dict]] = {}
    for c in comments:
        pid = c.get("parent_comment_id")
        if pid:
            children_map.setdefault(str(pid), []).append(c)
    for pid in children_map:
        children_map[pid] = sorted(children_map[pid], key=lambda x: x.get("created_at") or datetime.datetime.min)
    return top_level, children_map

def render_comment(
    c: dict,
    *,
    current_user_email: str,
    can_pin: bool,
    db,
    entity_type: str,
    entity_id: str,
    workspace_id: str | None,
    project_id: str | None,
    task_id: str | None,
    indent: bool = False,
):
    cid = str(c["_id"])
    is_author = (c.get("user_email") == current_user_email)

    is_deleted = bool(c.get("is_deleted"))
    is_pinned = bool(c.get("is_pinned"))
    edited_at = c.get("edited_at")

    author = c.get("user_name") or c.get("user_email") or "Unknown"
    author_safe = html.escape(author)

    # Body (escape user text, then highlight mentions)
    body_html = (
        "<span class='ds-deleted'>This comment was deleted.</span>"
        if is_deleted
        else safe_text_with_mentions(c.get("text", ""))
    )

    # Badges
    pinned_badge_html = "<span class='ds-pin-badge'>Pinned</span>" if is_pinned else ""
    edited_badge_html = "<span class='ds-edited'>Edited</span>" if edited_at else ""

    indent_class = " ds-indent" if indent else ""

    # Render comment card
    st.markdown(
        f"""
        <div class="ds-chat-card{indent_class}">
          <div class="ds-chat-top">
            <div class="ds-chat-author">{author_safe}</div>
            <div class="ds-chat-meta">
              <span>{fmt_ts(c.get("created_at"))}</span>
              {edited_badge_html}
              {pinned_badge_html}
            </div>
          </div>
          <div class="ds-chat-text">{body_html}</div>
        </div>
        """,
        unsafe_allow_html=True
    )

    # Action buttons row
    col1, col2, col3, col4 = st.columns([1, 1, 5, 1.5])

    with col1:
        if st.button("💬 Reply", key=f"reply_{cid}", disabled=is_deleted, use_container_width=True):
            st.session_state.reply_to_comment_id = cid
            st.session_state.edit_comment_id = None
            st.rerun()

    with col2:
        if can_pin:
            pin_label = "📌 Unpin" if is_pinned else "📍 Pin"
            if st.button(pin_label, key=f"pin_{cid}", use_container_width=True):
                db.toggle_pin_comment(cid, current_user_email, (not is_pinned))
                st.rerun()

    # Reactions in col3
    with col3:
        reactions = c.get("reactions", {}) or {}
        rcols = st.columns(len(REACTION_ORDER))
        
        for i, emoji in enumerate(REACTION_ORDER):
            users = reactions.get(emoji, []) or []
            count = len(users)
            label = f"{emoji} {count}" if count else emoji
            
            with rcols[i]:
                if st.button(label, key=f"react_{cid}_{emoji}", use_container_width=True):
                    db.toggle_reaction(cid, emoji, current_user_email)
                    st.rerun()

    # Edit/Delete for author
    with col4:
        if is_author and not is_deleted:
            e1, e2 = st.columns(2)
            with e1:
                if st.button("✏️", key=f"edit_{cid}", use_container_width=True, help="Edit"):
                    st.session_state.edit_comment_id = cid
                    st.session_state.reply_to_comment_id = None
                    st.rerun()
            with e2:
                if st.button("🗑️", key=f"del_{cid}", use_container_width=True, help="Delete"):
                    db.delete_comment(cid, current_user_email)
                    st.session_state.edit_comment_id = None
                    st.session_state.reply_to_comment_id = None
                    st.rerun()

    # Inline edit
    if st.session_state.get("edit_comment_id") == cid and is_author and not is_deleted:
        with st.form(f"edit_form_{cid}"):
            new_text = st.text_area("Edit comment", value=c.get("text", ""), height=90)
            b1, b2 = st.columns(2)
            save = b1.form_submit_button("Save", use_container_width=True)
            cancel = b2.form_submit_button("Cancel", use_container_width=True)
            if cancel:
                st.session_state.edit_comment_id = None
                st.rerun()
            if save:
                if new_text.strip():
                    db.edit_comment(cid, current_user_email, new_text.strip())
                    st.session_state.edit_comment_id = None
                    st.rerun()
                else:
                    st.error("Comment cannot be empty.")

    # Inline reply
    if st.session_state.get("reply_to_comment_id") == cid and not is_deleted:
        with st.form(f"reply_form_{cid}"):
            reply_text = st.text_area("Reply", placeholder="Write a reply...", height=90)
            b1, b2 = st.columns(2)
            send = b1.form_submit_button("Send", use_container_width=True)
            cancel = b2.form_submit_button("Cancel", use_container_width=True)
            if cancel:
                st.session_state.reply_to_comment_id = None
                st.rerun()
            if send:
                if reply_text.strip():
                    db.add_comment(
                        entity_type=entity_type,
                        entity_id=entity_id,
                        user_email=current_user_email,
                        text=reply_text.strip(),
                        workspace_id=workspace_id,
                        project_id=project_id,
                        task_id=task_id,
                        parent_comment_id=cid
                    )
                    st.session_state.reply_to_comment_id = None
                    st.rerun()
                else:
                    st.error("Reply cannot be empty.")
