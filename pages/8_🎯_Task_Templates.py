# (No button found in grep, but if present, ensure use_container_width=True)

# Example for a button:
# col_btn, col_spacer = st.columns([1, 8])
# with col_btn:
#     if st.button("Button Text"):
#         ...
# Apply this pattern to all single buttons and form_submit_buttons on this page.

# Remove all st.markdown CSS blocks from this file.

# 1. Remove all st.container(), st.columns(), and st.empty() that render with no content.
# 2. Use conditional rendering for containers/expanders only if there is data.
# 3. Use global card class for all cards.
# 4. Align all headers and buttons to the same left edge.
# 5. Add empty state card (ds-empty-state) if no templates.
# 6. Ensure consistent section/card/inline gaps using ds-gap-section, ds-gap-card, ds-gap-inline classes.