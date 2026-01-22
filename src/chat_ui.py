# src/chat_ui.py
import datetime
import html
import re
import streamlit as st

# Reactions are kept as stable keys (DB-friendly). UI renders as text labels (no emojis/material).
REACTION_ORDER = ["thumbs_up", "heart", "party", "eyes", "check"]

REACTION_LABELS = {
    "thumbs_up": "Like",
    "heart": "Love",
    "party": "Celebrate",
    "eyes": "Seen",
    "check": "Approve",
}


def fmt_ts(dt) -> str:
    """Format timestamp in a clean, readable way."""
    if not dt:
        return ""
    if isinstance(dt, datetime.date) and not isinstance(dt, datetime.datetime):
        return dt.strftime("%b %d, %Y")
    time_str = dt.strftime("%b %d, %I:%M %p")
    time_str = time_str.replace(" 0", " ")
    return time_str


def strip_html_tags(text: str) -> str:
    """Remove any HTML tags from text (for cleaning old data)."""
    if not text:
        return ""
    s = text
    for _ in range(5):
        new_s = html.unescape(s)
        if new_s == s:
            break
        s = new_s
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"&lt;[^&]*&gt;", "", s, flags=re.IGNORECASE)
    return s


def safe_text_with_mentions(text: str) -> str:
    """
    1. Strip any old HTML tags
    2. Escape user input so it cannot break your HTML
    3. Highlight @mentions (name or email) with styled spans
    """
    cleaned = strip_html_tags(text or "")
    escaped = html.escape(cleaned).replace("`", "&#96;")

    mention_pattern = re.compile(
        r"(@(?:[A-Za-z][A-Za-z0-9 .'-]{0,48}|[\w\.\-\+]+@[\w\.-]+))(?=$|\s|[.,;:!?])"
    )
    highlighted = mention_pattern.sub(r"<span class='ds-mention'>\1</span>", escaped)
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
        "Critical": "ds-task-critical",
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
        children_map[pid] = sorted(
            children_map[pid], key=lambda x: x.get("created_at") or datetime.datetime.min
        )
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
    Render a modern, minimal comment item with:
    - Thread depth limiting (max 3 levels)
    - Edit history indicator
    - Quote reply support
    - Admin override capabilities
    - Restore deleted comments (24h)
    """
    cid = str(c["_id"])
    is_author = (c.get("user_email") == current_user_email)

    is_deleted = bool(c.get("is_deleted"))
    is_pinned = bool(c.get("is_pinned"))
    edited_at = c.get("edited_at")
    edit_count = c.get("edit_count", 0) if edited_at else 0

    author = c.get("user_name") or c.get("user_email") or "Unknown"
    author_safe = html.escape(author)

    # Determine restore eligibility (deleted within 24 hours)
    can_restore = False
    if is_deleted and is_author:
        deleted_at = c.get("deleted_at")
        if deleted_at:
            hours_since_delete = (datetime.datetime.utcnow() - deleted_at).total_seconds() / 3600
            can_restore = hours_since_delete <= 24

    # Hide deleted comments unless author/admin can restore/see
    if is_deleted:
        if not can_restore and not is_admin:
            return
        if not (is_author or is_admin):
            return

    # Body text
    body_html = (
        "<span class='ds-deleted'>This comment was deleted.</span>"
        if is_deleted
        else safe_text_with_mentions(c.get("text", ""))
    )

    # Quote block (minimal)
    quoted_text = c.get("quoted_text")
    quoted_author = c.get("quoted_author")
    quote_html = ""
    if quoted_text and not is_deleted:
        q_author = html.escape(quoted_author or "Someone")
        q_text = html.escape(quoted_text[:140])
        if len(quoted_text) > 140:
            q_text += "…"
        quote_html = (
            "<div class='ds-quote'>"
            f"<div class='ds-quote-author'>{q_author}</div>"
            f"<div class='ds-quote-text'>{q_text}</div>"
            "</div>"
        )

    # Badges (text-only, no emojis)
    pinned_badge_html = "<span class='ds-pill ds-pill-accent'>Pinned</span>" if is_pinned else ""
    edited_badge_html = "<span class='ds-pill'>Edited</span>" if edited_at else ""
    edit_history_html = (
        f"<span class='ds-pill ds-pill-ghost' title='Edit count'>{edit_count} edit{'s' if edit_count != 1 else ''}</span>"
        if edit_count > 0
        else ""
    )

    # Thread indentation class
    if depth <= 0:
        indent_class = ""
    elif depth == 1:
        indent_class = " ds-indent-1"
    elif depth == 2:
        indent_class = " ds-indent-2"
    else:
        indent_class = " ds-indent-3"

    deleted_class = " ds-deleted-card" if is_deleted else ""

    # Render card
    card_html = (
        f"<div class='ds-chat-card{indent_class}{deleted_class}'>"
        "<div class='ds-chat-top'>"
        f"<div class='ds-chat-meta'>"
        f"<span class='ds-chat-author'>{author_safe}</span>"
        f"<span class='ds-chat-time'>{fmt_ts(c.get('created_at'))}</span>"
        "</div>"
        f"<div class='ds-chat-badges'>{pinned_badge_html}{edited_badge_html}{edit_history_html}</div>"
        "</div>"
        f"{quote_html}"
        f"<div class='ds-chat-body'>{body_html}</div>"
        "</div>"
    )
    st.markdown(card_html, unsafe_allow_html=True)

    # Depth limiting
    if depth >= 3:
        st.markdown(
            "<div class='ds-thread-cap'>Thread continues…</div>",
            unsafe_allow_html=True,
        )
        return

    # Only show actions if not deleted (deleted UI kept minimal)
    if is_deleted:
        # Restore options, if any
        cols = st.columns([1, 6])
        if can_restore:
            with cols[0]:
                if st.button("Restore", key=f"restore_{cid}", type="secondary"):
                    db.restore_comment(cid, current_user_email)
                    st.rerun()
        if is_admin and not is_author:
            with cols[1]:
                if st.button("Admin delete", key=f"admin_del_{cid}", type="secondary"):
                    db.delete_comment(cid, current_user_email, is_admin_action=True)
                    st.rerun()
        return

    # Action row (minimal, ClickUp-like)
    a1, a2, a3, a4, a5 = st.columns([0.9, 0.9, 1.3, 0.9, 6.0])

    with a1:
        if st.button("Reply", key=f"reply_{cid}", type="secondary", help="Reply to this comment"):
            st.session_state.reply_to_comment_id = cid
            st.session_state.edit_comment_id = None
            st.rerun()

    with a2:
        if can_pin:
            label = "Unpin" if is_pinned else "Pin"
            if st.button(label, key=f"pin_{cid}", type="secondary"):
                db.toggle_pin_comment(cid, current_user_email, (not is_pinned))
                st.rerun()

    with a3:
        # Reactions popover (text labels)
        with st.popover("React", use_container_width=False):
            st.markdown("<div class='ds-react-title'>Reactions</div>", unsafe_allow_html=True)
            reactions = c.get("reactions", {}) or {}

            rcols = st.columns(len(REACTION_ORDER))
            for col, rk in zip(rcols, REACTION_ORDER):
                users = reactions.get(rk, []) or []
                count = len(users)
                label = REACTION_LABELS.get(rk, rk)
                btn_label = f"{label} ({count})" if count else label

                with col:
                    if st.button(btn_label, key=f"react_{cid}_{rk}", type="secondary"):
                        db.toggle_reaction(cid, rk, current_user_email)
                        st.rerun()

    with a4:
        if is_author:
            if st.button("Edit", key=f"edit_{cid}", type="secondary"):
                st.session_state.edit_comment_id = cid
                st.session_state.reply_to_comment_id = None
                st.rerun()

    with a5:
        right = st.columns([1.1, 5.9])
        with right[0]:
            if is_author:
                if st.button("Delete", key=f"del_{cid}", type="secondary"):
                    db.delete_comment(cid, current_user_email)
                    st.session_state.edit_comment_id = None
                    st.session_state.reply_to_comment_id = None
                    st.rerun()

    # Inline edit
    if st.session_state.get("edit_comment_id") == cid and is_author:
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
    if st.session_state.get("reply_to_comment_id") == cid:
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
                        parent_comment_id=cid,
                    )
                    st.session_state.reply_to_comment_id = None
                    st.rerun()
                else:
                    st.error("Reply cannot be empty.")


def render_chat_interface(
    *,
    comments: list[dict],
    current_user_email: str,
    can_pin: bool,
    db,
    entity_type: str,
    entity_id: str,
    workspace_id: str | None = None,
    project_id: str | None = None,
    task_id: str | None = None,
    is_admin: bool = False,
):
    """
    Modern, minimal comment section (ClickUp-ish).

    IMPORTANT:
    This version intentionally avoids:
    - Material icons
    - Emoji headings
    - Direct db.db.comments usage

    You pass comments in, and this module renders + calls db methods you already have:
      - db.add_comment(...)
      - db.delete_comment(...)
      - db.restore_comment(...)
      - db.edit_comment(...)
      - db.toggle_pin_comment(...)
      - db.toggle_reaction(...)

    It also supports threading via parent_comment_id.
    """
    st.markdown("<div class='ds-comments'>", unsafe_allow_html=True)
    st.markdown("<div class='ds-comments-title'>Comments</div>", unsafe_allow_html=True)

    # New comment composer (top)
    with st.form(key=f"comment_new_{entity_type}_{entity_id}", clear_on_submit=True):
        new_text = st.text_area(
            "Write a comment",
            placeholder="Write a comment… Use @ to mention someone.",
            height=90,
            label_visibility="collapsed",
        )
        c1, c2 = st.columns([1, 5])
        submit = c1.form_submit_button("Send", type="primary", use_container_width=True)
        cancel = c2.form_submit_button("Cancel", type="secondary", use_container_width=True)

        if cancel:
            st.rerun()

        if submit:
            if not new_text.strip():
                st.error("Comment cannot be empty.")
            else:
                db.add_comment(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    user_email=current_user_email,
                    text=new_text.strip(),
                    workspace_id=workspace_id,
                    project_id=project_id,
                    task_id=task_id,
                    parent_comment_id=None,
                )
                st.rerun()

    # Render thread
    if not comments:
        st.markdown(
            "<div class='ds-empty'>No comments yet.</div>",
            unsafe_allow_html=True,
        )
        st.markdown("</div>", unsafe_allow_html=True)
        return

    top_level, children_map = build_threads(comments)

    # Sort newest-first for top level (professional feed behavior)
    top_level_sorted = sorted(
        top_level,
        key=lambda x: x.get("created_at") or datetime.datetime.min,
        reverse=True,
    )

    def render_tree(node: dict, depth: int):
        render_comment(
            node,
            current_user_email=current_user_email,
            can_pin=can_pin,
            db=db,
            entity_type=entity_type,
            entity_id=entity_id,
            workspace_id=workspace_id,
            project_id=project_id,
            task_id=task_id,
            indent=(depth > 0),
            depth=depth,
            is_admin=is_admin,
        )
        for child in children_map.get(str(node["_id"]), []):
            render_tree(child, depth + 1)

    for comment in top_level_sorted:
        render_tree(comment, 0)

    st.markdown("</div>", unsafe_allow_html=True)
