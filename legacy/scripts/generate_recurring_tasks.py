#!/usr/bin/env python3
"""
Cron job to generate recurring task instances
Run this daily: 0 0 * * * /path/to/python scripts/generate_recurring_tasks.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import DreamShiftDB
import datetime

def generate_recurring_tasks():
    """Generate new instances of recurring tasks"""
    db = DreamShiftDB()
    
    # Get all recurring tasks
    recurring_tasks = db.get_recurring_tasks()
    
    generated_count = 0
    errors = []
    
    for task in recurring_tasks:
        try:
            task_id = str(task['_id'])
            
            # Check if end date has passed
            if 'end_date' in task.get('recurring', {}) and task['recurring']['end_date']:
                if datetime.datetime.now() > task['recurring']['end_date']:
                    print(f"Stopping expired recurring task: {task['title']}")
                    db.stop_task_recurrence(task_id)
                    continue
            
            # Calculate next due date based on pattern
            last_generated = task['recurring'].get('last_generated', task.get('due_date'))
            pattern = task['recurring']['pattern']
            
            next_due = None
            
            if pattern == 'daily':
                next_due = last_generated + datetime.timedelta(days=1)
            
            elif pattern == 'weekly':
                days_ahead = task['recurring'].get('day_of_week', 1) - last_generated.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                next_due = last_generated + datetime.timedelta(days=days_ahead)
            
            elif pattern == 'monthly':
                day_of_month = task['recurring'].get('day_of_month', 1)
                next_month = last_generated.month + 1
                next_year = last_generated.year
                if next_month > 12:
                    next_month = 1
                    next_year += 1
                next_due = datetime.datetime(next_year, next_month, min(day_of_month, 28))
            
            elif pattern == 'custom':
                interval = task['recurring'].get('interval', 7)
                next_due = last_generated + datetime.timedelta(days=interval)
            
            # Generate if due date has passed
            if next_due and datetime.datetime.now() >= next_due:
                new_task_id = db.generate_next_recurrence(task_id)
                if new_task_id:
                    generated_count += 1
                    print(f"✓ Generated recurrence for task: {task['title']} (Due: {next_due.strftime('%Y-%m-%d')})")
        
        except Exception as e:
            error_msg = f"Error processing task {task.get('title', 'Unknown')}: {str(e)}"
            errors.append(error_msg)
            print(f"✗ {error_msg}")
    
    print(f"\n{'='*60}")
    print(f"Recurring Task Generation Complete")
    print(f"{'='*60}")
    print(f"Total tasks processed: {len(recurring_tasks)}")
    print(f"New instances generated: {generated_count}")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\nError Details:")
        for error in errors:
            print(f"  - {error}")
    
    return generated_count

if __name__ == "__main__":
    try:
        count = generate_recurring_tasks()
        sys.exit(0)
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        sys.exit(1)
