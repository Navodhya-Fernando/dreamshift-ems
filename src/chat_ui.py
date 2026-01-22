# src/chat_ui.py
import datetime
import html
import re
import streamlit as st

REACTION_ORDER = ["thumbs_up", "heart", "party", "eyes", "check"]
REACTION_ICONS = {
    "thumbs_up": ":material/thumb_up:",
    "heart": ":material/favorite:",
    "party": ":material/celebration:",
    "eyes": ":material/visibility:",
    "check": ":material/done:"
}

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
    # Fully unescape (handles double-encoded content) then strip tags/entities
    s = text
    for _ in range(5):  # iterate to resolve nested encodings
        new_s = html.unescape(s)
        if new_s == s:
            break
        s = new_s

    # Remove real HTML tags
    s = re.sub(r"<[^>]+>", "", s)
    # Remove any encoded tags that might remain (e.g., &lt;div&gt;)
    s = re.sub(r"&lt;[^&]*&gt;", "", s, flags=re.IGNORECASE)
    return s

def safe_text_with_mentions(text: str) -> str:
    """
    1. Strip any old HTML tags
    2. Escape user input so it cannot break your HTML
    3. Highlight @mentions with styled spans
    """
    # First, strip any old HTML tags from database
    cleaned = strip_html_tags(text or "")
    
    # Escape the cleaned text
    escaped = html.escape(cleaned).replace("`", "&#96;")  # neutralize backticks so markdown won't code-wrap
    
    # Highlight mentions (supports both @email and @user formats)
    highlighted = re.sub(
        r"(@[\w\.\-\+@]+)",
        r"<span class='ds-mention'>\1</span>",
        escaped
    )
    
    return highlighted

def calculate_thread_depth(comment_id: str, children_map: dict, depth: int = 0) -> int:
    """Calculate the maximum depth of a comment thread."""
    if comment_id not in children_map:
        return depth
    
    max_child_depth = depth
    for child in children_map.get(comment_id, []):
        child_depth = calculate_thread_depth(str(child["_id"]), children_map, depth + 1)
        max_child_depth = max(max_child_depth, child_depth)
    
    return max_child_depth

def get_urgency_class(priority: str) -> str:
    """Map priority to CSS urgency class for color coding."""
    priority_map = {
        "Low": "ds-task-low",
        "Medium": "ds-task-medium",
        "High": "ds-task-high",
        "Critical": "ds-task-critical"
    }
    return priority_map.get(priority, "ds-task-medium")

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
    depth: int = 0,
    is_admin: bool = False,
):
    """
    Render a comment with advanced features:
    - Thread depth limiting (max 3 levels)
    - Edit history tracking
    - Quote reply support
    - Admin override capabilities
    - Restore deleted comments
    """
    cid = str(c["_id"])
    is_author = (c.get("user_email") == current_user_email)

    is_deleted = bool(c.get("is_deleted"))
    is_pinned = bool(c.get("is_pinned"))
    edited_at = c.get("edited_at")
    edit_count = c.get("edit_count", 0) if edited_at else 0

    author = c.get("user_name") or c.get("user_email") or "Unknown"
    author_safe = html.escape(author)

    # Check if comment can be restored (deleted within 24 hours)
    can_restore = False
    if is_deleted and is_author:
        deleted_at = c.get("deleted_at")
        if deleted_at:
            hours_since_delete = (datetime.datetime.utcnow() - deleted_at).total_seconds() / 3600
            can_restore = hours_since_delete <= 24

    # Hide deleted comments unless author/admin can still restore
    if is_deleted:
        if not can_restore:
            return
        if not (is_author or is_admin):
            return

    # Body (escape user text, then highlight mentions)
    body_html = (
        "<span class='ds-deleted'>This comment was deleted.</span>"
        if is_deleted
        else safe_text_with_mentions(c.get("text", ""))
    )

    # Quoted text if present (build without triple-quote indentation to avoid markdown parsing issues)
    quoted_text = c.get("quoted_text")
    quoted_author = c.get("quoted_author")
    quote_html = ""
    if quoted_text and not is_deleted:
        q_author = html.escape(quoted_author or "Someone")
        q_text = html.escape(quoted_text[:100])
        if len(quoted_text) > 100:
            q_text += "..."
        quote_html = (
            "<div class='ds-quote'>"
            f"<div class='ds-quote-author'>@{q_author} said:</div>"
            f"<div class='ds-quote-text'>{q_text}</div>"
            "</div>"
        )

    # Badges (ensure proper escaping)
    pinned_badge_html = "<span class='ds-pin-badge'>Pinned</span>" if is_pinned else ""
    edited_badge_html = "<span class='ds-edited'>Edited</span>" if edited_at else ""
    edit_history_html = f"<span class='ds-edit-history' title='Click to view edit history'>✏️ {edit_count} edit{'s' if edit_count != 1 else ''}</span>" if edit_count > 0 else ""

    # Depth-based indentation class
    indent_class = ""
    if depth == 0:
        indent_class = ""
    elif depth == 1:
        indent_class = " ds-indent-1"
    elif depth == 2:
        indent_class = " ds-indent-2"
    else:
        indent_class = " ds-indent-3"

    # Build card classes
    deleted_class = ' ds-deleted-card' if (is_deleted and not can_restore) else ''

    # Render comment card (ClickUp-style: clean header with just author + time)
    card_html = (
        f"<div class='ds-chat-card{indent_class}{deleted_class}'>"
        "<div class='ds-chat-header'>"
        f"<div class='ds-chat-author'>{author_safe}</div>"
        f"<div class='ds-chat-time'>{fmt_ts(c.get('created_at'))}</div>"
        "</div>"
        f"{quote_html}"
        f"<div class='ds-chat-body'>{body_html}</div>"
        "</div>"
    )
    st.markdown(card_html, unsafe_allow_html=True)

    # Depth limiting: Show "Continue thread" if depth >= 3
    if depth >= 3:
        st.markdown(
            "<a href='#' class='ds-continue-thread' onclick='return false;'>💬 Continue thread →</a>",
            unsafe_allow_html=True
        )
        return  # Stop rendering deeper comments

    # Show badges above action bar
    badge_row = f"{pinned_badge_html}{edited_badge_html}{edit_history_html}"
    if badge_row.strip():
        st.markdown(badge_row, unsafe_allow_html=True)

    # Check if there are ANY actions available before rendering action bar
    has_actions = (
        True or  # Reply always available unless deleted
        can_pin or
        (is_author and not is_deleted) or
        can_restore or
        (is_admin and not is_author)
    )

    # Only render action bar if there are actions
    if has_actions and not is_deleted:
        # ===== ClickUp-style action bar (icon buttons + reaction popover) =====
        a1, a2, a3, a4, a5 = st.columns([0.55, 0.55, 0.55, 0.55, 6.8])

        with a1:
            if st.button("↩︎", key=f"reply_{cid}", disabled=is_deleted, help="Reply", type="secondary"):
                st.session_state.reply_to_comment_id = cid
                st.session_state.edit_comment_id = None
                st.rerun()

        with a2:
            if can_pin:
                pin_icon = "📌" if is_pinned else "📍"
                pin_help = "Unpin" if is_pinned else "Pin"
                if st.button(pin_icon, key=f"pin_{cid}", help=pin_help, type="secondary"):
                    db.toggle_pin_comment(cid, current_user_email, (not is_pinned))
                    st.rerun()

        with a3:
            # One reaction button -> popover menu (closest to ClickUp possible in Streamlit)
            with st.popover("😊", use_container_width=False):
                st.markdown("React")
                reactions = c.get("reactions", {}) or {}

                r1, r2, r3, r4, r5 = st.columns(5)
                for col, emoji in zip([r1, r2, r3, r4, r5], REACTION_ORDER):
                    users = reactions.get(emoji, []) or []
                    count = len(users)
                    label = f"{emoji} {count}" if count else emoji
                    with col:
                        if st.button(label, key=f"react_{cid}_{emoji}", type="secondary"):
                            db.toggle_reaction(cid, emoji, current_user_email)
                            st.rerun()

        with a4:
            # Edit (only author + not deleted)
            if is_author and not is_deleted:
                if st.button("✏️", key=f"edit_{cid}", help="Edit", type="secondary"):
                    st.session_state.edit_comment_id = cid
                    st.session_state.reply_to_comment_id = None
                    st.rerun()

        with a5:
            # Delete / Restore / Admin delete on right (keep compact)
            right = st.columns([0.6, 0.6, 0.6, 6.2])

            if is_author and not is_deleted:
                with right[0]:
                    if st.button("🗑️", key=f"del_{cid}", help="Delete", type="secondary"):
                        db.delete_comment(cid, current_user_email)
                        st.session_state.edit_comment_id = None
                        st.session_state.reply_to_comment_id = None
                        st.rerun()

            if can_restore:
                with right[1]:
                    if st.button("♻️", key=f"restore_{cid}", help="Restore", type="secondary"):
                        db.restore_comment(cid, current_user_email)
                        st.rerun()

            if is_admin and not is_author:
                with right[2]:
                    if st.button("🔨", key=f"admin_del_{cid}", help="Admin delete", type="secondary"):
                        db.delete_comment(cid, current_user_email, is_admin_action=True)
                        st.rerun()

    # Inline edit
    if st.session_state.get("edit_comment_id") == cid and is_author and not is_deleted:
        with st.form(f"edit_form_{cid}"):
            new_text = st.text_area("Edit comment", value=c.get("text", ""), height=90)
            b1, b2 = st.columns(2)
            save = b1.form_submit_button("Save", use_container_width=True, type="primary")
            cancel = b2.form_submit_button("Cancel", use_container_width=True, type="secondary")
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
            send = b1.form_submit_button("Send", use_container_width=True, type="primary")
            cancel = b2.form_submit_button("Cancel", use_container_width=True, type="secondary")
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
