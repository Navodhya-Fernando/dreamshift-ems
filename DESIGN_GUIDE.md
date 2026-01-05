# DreamShift EMS - Design Guide

## 🎨 Color Palette

### Primary Colors
- **Background Main**: `#24101a` - Deep burgundy background for entire site
- **Container Background**: `#411c30` - Lighter burgundy for cards and containers
- **Accent Primary**: `#f6b900` - Golden yellow for highlights, buttons, and important text
- **Text Primary**: `#ffffff` - White for main text
- **Text Secondary**: `rgba(255, 255, 255, 0.7)` - Semi-transparent white for secondary text

### Status Colors
- **Success**: `#00ff88` (Green) - Completed tasks, success messages
- **Warning**: `#ffaa00` (Orange) - Warnings, important notices
- **Danger**: `#ff4444` (Red) - Errors, urgent tasks, overdue items
- **Info**: `#f6b900` (Gold) - Information, neutral highlights

### Transparency Variants
- **Success Background**: `rgba(0, 255, 136, 0.2)` - Success badges/cards
- **Warning Background**: `rgba(255, 170, 0, 0.2)` - Warning badges/cards
- **Danger Background**: `rgba(255, 68, 68, 0.2)` - Danger badges/cards
- **Accent Background**: `rgba(246, 185, 0, 0.2)` - Accent badges/cards
- **Border Color**: `rgba(246, 185, 0, 0.3)` - Subtle borders

## 🎯 Component Styling

### Cards
```css
background: #411c30;
border: 1px solid rgba(246, 185, 0, 0.3);
border-radius: 12px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
```

### Buttons
- **Primary**: Gold background (#f6b900) with dark text (#24101a)
- **Secondary**: Container background with gold border
- **Hover**: Lighter gold (#ffc933) with lift effect

### Metric Cards
```css
background: linear-gradient(135deg, #411c30 0%, #5a2d45 100%);
accent: #f6b900;
```

### Task Cards
- Border-left colored by urgency (green/yellow/red)
- Background matches urgency with opacity
- Hover effect with gold border

### Badges
- Semi-transparent backgrounds matching status
- Solid border matching status color
- Uppercase text, small size

## 📱 Responsive Design

All components are mobile-responsive with:
- Reduced padding on mobile
- Stacked columns on small screens
- Touch-friendly button sizes
- Readable font sizes

## ✨ Animations

- **Fade In**: Subtle entry animation for cards
- **Slide In**: Left-to-right animation for modals
- **Pulse**: Breathing animation for metric cards
- **Hover Effects**: Lift and glow on interactive elements

## 🎭 Theming Notes

The dark theme with gold accents creates a premium, professional feel while:
- Reducing eye strain in low-light environments
- Highlighting important information with gold
- Maintaining clear hierarchy with opacity levels
- Ensuring accessibility with sufficient contrast ratios

## 🔄 Updates Applied

All pages have been updated with:
1. ✅ Dark burgundy background (#24101a)
2. ✅ Container backgrounds (#411c30)
3. ✅ Gold accents (#f6b900) for highlights
4. ✅ White text with opacity variants
5. ✅ Status colors for task states
6. ✅ Consistent borders and shadows
7. ✅ Professional hover effects
8. ✅ Streamlit component overrides

## 📄 Files Updated

- `static/styles.css` - Complete CSS overhaul
- `app.py` - Home dashboard
- `pages/settings.py` - Settings page
- `pages/profile.py` - Profile page
- `pages/task_details.py` - Task details
- All other page files - Automated color replacement

---

**Last Updated**: Current session
**Design System**: Professional Dark Theme with Gold Accents
