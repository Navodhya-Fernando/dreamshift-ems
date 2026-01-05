# User Profile & Security Features

## Overview

DreamShift EMS now includes comprehensive user profile management and security features:

- **Profile Photos**: LinkedIn URL or public image support
- **Role Titles**: Custom job titles/roles per user
- **Employment Dates**: Track when employees joined
- **Password Management**: Change password with validation
- **Admin Controls**: Centralized team profile management

---

## Features

### 1. Enhanced User Profiles

Each user profile now supports:

```json
{
  "name": "John Doe",
  "email": "john@dreamshift.net",
  "password": "...",
  "created_at": "2026-01-01T00:00:00Z",
  
  "profile": {
    "photo_url": "https://...",
    "role_title": "Senior CV Writer",
    "date_joined": "2025-07-01"
  },
  
  "security": {
    "password_updated_at": "2026-01-05T00:00:00Z"
  }
}
```

**Fields:**
- `created_at`: Account creation date
- `profile.date_joined`: Employment start date
- `profile.role_title`: Current job title/role
- `profile.photo_url`: Profile picture (LinkedIn or public URL)

### 2. Password Change

**Validation:**
- Minimum 8 characters
- Must be different from old password
- Must match confirmation
- Requires current password verification

### 3. Email Changes

Email changes must be requested through workspace administrators for security purposes.

### 4. Admin Profile Management

Workspace Owners can:
- Update team member names
- Set role titles (job positions)
- Add profile photos (LinkedIn URLs)
- Set employment start dates
- Preview changes before saving

---

## Setup Instructions

### Database Migration

No migration needed! New profile fields are optional and added automatically when profiles are updated.

---

## Usage Guide

### For Users

**Update Profile Photo:**
1. Ask admin to add your photo URL
2. Use LinkedIn profile image or any public URL
3. Photo appears on Profile page

**Change Email:**
1. Contact your workspace administrator
2. Admin will update your email in the system

**Change Password:**
1. Profile → Security → Change password
2. Enter current + new password (8+ chars)
3. Confirm new password
4. Password updated immediately

### For Admins

**Manage Team Profiles:**
1. Admin Panel → Admin Actions → User Profile Management
2. Select team member from dropdown
3. Update:
   - Full name
   - Role/job title
   - Profile photo URL
   - Employment start date
4. Preview changes
5. Save

**Profile Photo URLs:**
- Use publicly accessible images
- LinkedIn URLs may expire (not recommended for long-term)
- Best: Upload to image host (Imgur, Cloudinary, etc.)
- Fallback: Avatar with initials displayed

---

## API Reference

### Database Methods

```python
from src.database import DreamShiftDB
db = DreamShiftDB()

# Check if email exists
db.is_email_taken("email@example.com")  # Returns bool

# Verify password
db.verify_user_password("user@example.com", "password123")  # Returns bool

# Update password
db.update_password("user@example.com", "new_password")

# Update profile fields
db.update_user_profile_fields("user@example.com", {
    "name": "John Doe",
    "profile.role_title": "Senior Developer",
    "profile.photo_url": "https://...",
    "profile.date_joined": "2025-01-01"
})
```

---

## Security Considerations

### Password Management
- SHA256 hashing (consider upgrading to bcrypt/argon2)
- Minimum length validation
- Current password verification required
- Password history (stores `password_updated_at`)

### Profile Photos
- LinkedIn URLs may expire without notice
- Admin should verify URL accessibility
- Consider implementing image upload with storage
- Fallback: Avatar initials always displayed

---

## Troubleshooting

### Profile Photo Not Loading

**Error:** Image fails to display
**Causes:**
- LinkedIn URL expired
- URL not publicly accessible
- CORS restrictions
**Solution:** Use publicly hosted image URL

---

## Future Enhancements

### Recommended Upgrades

1. **Password Hashing**: Upgrade from SHA256 to bcrypt/argon2
2. **Image Upload**: Replace URLs with actual file uploads
3. **2FA**: Add two-factor authentication
4. **OAuth**: Login with Google/LinkedIn
5. **Audit Log**: Track all profile/security changes
6. **Email Verification**: Add email change verification flow
7. **Session Management**: Active sessions list
8. **Profile Completion**: Progress tracker

---

## Support

For issues or questions:
1. Check this documentation
2. Review `.env.example` for configuration
3. Contact workspace administrator
4. Check error logs in Streamlit console

---

## Version

- **Added**: January 2026
- **Compatible with**: DreamShift EMS v2.0+
- **Dependencies**: MongoDB, SMTP server, Streamlit
