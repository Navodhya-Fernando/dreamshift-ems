"""
Cleanup Script: Remove HTML tags from existing comments
Run this once to clean up old comments that have HTML in them
"""

import sys
import os
import re
import html

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import DreamShiftDB

def strip_html_tags(text: str) -> str:
    """Remove any HTML tags from text."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    clean = html.unescape(clean)
    return clean

def cleanup_comments():
    db = DreamShiftDB()
    
    # Access the comments collection directly
    comments_collection = db.db["comments"]
    
    # Get all comments
    all_comments = list(comments_collection.find({}))
    
    print(f"Found {len(all_comments)} comments to check")
    
    updated_count = 0
    
    for comment in all_comments:
        original_text = comment.get("text", "")
        
        # Check if comment contains HTML tags
        if '<' in original_text and '>' in original_text:
            cleaned_text = strip_html_tags(original_text)
            
            print(f"\n─────────────────────────────────")
            print(f"Comment ID: {comment['_id']}")
            print(f"Before: {original_text[:100]}...")
            print(f"After:  {cleaned_text[:100]}...")
            
            # Update the comment
            comments_collection.update_one(
                {"_id": comment["_id"]},
                {"$set": {"text": cleaned_text}}
            )
            
            updated_count += 1
    
    print(f"\n{'='*50}")
    print(f"Cleanup complete!")
    print(f"📊 Total comments checked: {len(all_comments)}")
    print(f"🔧 Comments updated: {updated_count}")
    print(f"{'='*50}")

if __name__ == "__main__":
    print("🚀 Starting comment cleanup...")
    print("This will remove HTML tags from existing comments\n")
    
    response = input("Continue? (yes/no): ").strip().lower()
    
    if response == "yes":
        cleanup_comments()
    else:
        print("Cleanup cancelled")
