#!/usr/bin/env python3
"""
Direct Database Cleanup Script for Forkcast
Removes remaining test data by directly accessing the Supabase database.
"""

import os
import re
import json
from datetime import datetime
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

class DirectDatabaseCleanup:
    def __init__(self):
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise Exception("Missing Supabase environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.cleanup_results = {
            'test_users_found': 0,
            'meals_deleted': 0,
            'users_deleted': 0,
            'errors': []
        }

    def log_message(self, message):
        """Log cleanup message with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")

    def is_test_user(self, username):
        """Check if username matches test/debug patterns"""
        test_patterns = [
            r'test.*',
            r'.*test.*',
            r'debug.*',
            r'.*debug.*',
            r'chef_\d+',
            r'demo.*',
            r'sample.*',
            r'fake.*',
            r'temp.*',
            r'cleanup_admin.*'
        ]
        
        username_lower = username.lower()
        for pattern in test_patterns:
            if re.match(pattern, username_lower):
                return True
        return False

    def get_all_users(self):
        """Get all users from the database"""
        try:
            response = self.supabase.table('users').select('*').execute()
            return response.data
        except Exception as e:
            self.log_message(f"❌ Error fetching users: {str(e)}")
            return []

    def get_all_meals(self):
        """Get all meals with user information"""
        try:
            response = self.supabase.table('meals').select('''
                *,
                users(id, username)
            ''').execute()
            return response.data
        except Exception as e:
            self.log_message(f"❌ Error fetching meals: {str(e)}")
            return []

    def identify_test_data(self):
        """Identify all test users and their data"""
        self.log_message("🔍 Identifying test users and data...")
        
        # Get all users and meals
        all_users = self.get_all_users()
        all_meals = self.get_all_meals()
        
        test_users = {}
        test_meals = []
        
        # Identify test users
        for user in all_users:
            username = user.get('username', '')
            if self.is_test_user(username):
                test_users[user['id']] = username
                self.log_message(f"🔍 Found test user: {username} (ID: {user['id']})")
        
        # Identify test meals (both by user and by content)
        for meal in all_meals:
            user_id = meal.get('user_id')
            title = meal.get('title', '')
            
            # Check if meal belongs to test user
            if user_id in test_users:
                test_meals.append(meal)
                continue
            
            # Check if meal has test patterns in title
            if any(pattern in title.lower() for pattern in ['test', 'debug', 'sample', 'demo']):
                test_meals.append(meal)
                # Add user to test users if not already there
                if user_id and user_id not in test_users:
                    user_info = meal.get('users')
                    if user_info:
                        username = user_info.get('username', f'unknown_{user_id[:8]}')
                        test_users[user_id] = username
                        self.log_message(f"🔍 Found test meal user: {username} (ID: {user_id})")
        
        self.cleanup_results['test_users_found'] = len(test_users)
        self.log_message(f"📋 Identified {len(test_users)} test users and {len(test_meals)} test meals")
        
        return test_users, test_meals

    def delete_meals(self, meals):
        """Delete meals directly from database"""
        self.log_message(f"🗑️ Deleting {len(meals)} test meals...")
        
        deleted_count = 0
        for meal in meals:
            try:
                meal_id = meal['id']
                title = meal.get('title', 'Unknown')
                
                response = self.supabase.table('meals').delete().eq('id', meal_id).execute()
                
                if response.data:
                    deleted_count += 1
                    self.cleanup_results['meals_deleted'] += 1
                    self.log_message(f"✅ Deleted meal: '{title}' (ID: {meal_id})")
                else:
                    error_msg = f"Failed to delete meal: '{title}' (ID: {meal_id})"
                    self.cleanup_results['errors'].append(error_msg)
                    self.log_message(f"❌ {error_msg}")
                    
            except Exception as e:
                error_msg = f"Exception deleting meal {meal.get('id', 'unknown')}: {str(e)}"
                self.cleanup_results['errors'].append(error_msg)
                self.log_message(f"❌ {error_msg}")
        
        self.log_message(f"✅ Successfully deleted {deleted_count}/{len(meals)} meals")
        return deleted_count

    def delete_users(self, user_ids):
        """Delete test users from database"""
        self.log_message(f"👤 Deleting {len(user_ids)} test users...")
        
        deleted_count = 0
        for user_id in user_ids:
            try:
                response = self.supabase.table('users').delete().eq('id', user_id).execute()
                
                if response.data:
                    deleted_count += 1
                    self.cleanup_results['users_deleted'] += 1
                    self.log_message(f"✅ Deleted user: {user_id}")
                else:
                    error_msg = f"Failed to delete user: {user_id}"
                    self.cleanup_results['errors'].append(error_msg)
                    self.log_message(f"❌ {error_msg}")
                    
            except Exception as e:
                error_msg = f"Exception deleting user {user_id}: {str(e)}"
                self.cleanup_results['errors'].append(error_msg)
                self.log_message(f"❌ {error_msg}")
        
        self.log_message(f"✅ Successfully deleted {deleted_count}/{len(user_ids)} users")
        return deleted_count

    def verify_cleanup(self):
        """Verify that test data has been cleaned up"""
        self.log_message("🔍 Verifying cleanup results...")
        
        # Check remaining meals
        remaining_meals = self.get_all_meals()
        test_meals_remaining = []
        
        for meal in remaining_meals:
            title = meal.get('title', '')
            user_info = meal.get('users')
            
            # Check for test patterns
            if any(pattern in title.lower() for pattern in ['test', 'debug', 'sample', 'demo']):
                test_meals_remaining.append(meal)
            elif user_info and self.is_test_user(user_info.get('username', '')):
                test_meals_remaining.append(meal)
        
        # Check remaining users
        remaining_users = self.get_all_users()
        test_users_remaining = []
        
        for user in remaining_users:
            username = user.get('username', '')
            if self.is_test_user(username):
                test_users_remaining.append(user)
        
        if test_meals_remaining or test_users_remaining:
            self.log_message(f"⚠️ Found {len(test_meals_remaining)} remaining test meals and {len(test_users_remaining)} test users")
            if test_meals_remaining:
                for meal in test_meals_remaining[:3]:  # Show first 3
                    user_info = meal.get('users', {})
                    username = user_info.get('username', 'Unknown') if user_info else 'Unknown'
                    self.log_message(f"   - Meal: '{meal.get('title', 'Unknown')}' by {username}")
            if test_users_remaining:
                for user in test_users_remaining[:3]:  # Show first 3
                    self.log_message(f"   - User: {user.get('username', 'Unknown')} (ID: {user['id']})")
        else:
            self.log_message("✅ No test data found - cleanup successful!")
        
        return len(test_meals_remaining) + len(test_users_remaining)

    def run_cleanup(self):
        """Run the complete direct database cleanup"""
        self.log_message("🚀 Starting direct database cleanup...")
        self.log_message(f"🌐 Supabase URL: {self.supabase_url}")
        self.log_message("=" * 60)
        
        try:
            # Step 1: Identify test data
            test_users, test_meals = self.identify_test_data()
            
            if not test_users and not test_meals:
                self.log_message("✅ No test data identified - system appears clean")
                return True
            
            # Step 2: Delete test meals first (to avoid foreign key constraints)
            if test_meals:
                self.delete_meals(test_meals)
            
            # Step 3: Delete test users
            if test_users:
                self.delete_users(list(test_users.keys()))
            
            # Step 4: Verify cleanup
            remaining_items = self.verify_cleanup()
            
            # Step 5: Print summary
            self.print_cleanup_summary()
            
            return remaining_items == 0
            
        except Exception as e:
            self.log_message(f"❌ Unexpected error during cleanup: {str(e)}")
            return False

    def print_cleanup_summary(self):
        """Print cleanup results summary"""
        self.log_message("\n" + "=" * 60)
        self.log_message("DIRECT DATABASE CLEANUP SUMMARY")
        self.log_message("=" * 60)
        
        self.log_message(f"Test users identified: {self.cleanup_results['test_users_found']}")
        self.log_message(f"Meals deleted: {self.cleanup_results['meals_deleted']}")
        self.log_message(f"Users deleted: {self.cleanup_results['users_deleted']}")
        self.log_message(f"Errors encountered: {len(self.cleanup_results['errors'])}")
        
        if self.cleanup_results['errors']:
            self.log_message("\nErrors:")
            for error in self.cleanup_results['errors'][:5]:  # Show first 5 errors
                self.log_message(f"  ❌ {error}")
        
        self.log_message("\n" + "=" * 60)

def main():
    """Main cleanup execution"""
    try:
        cleanup = DirectDatabaseCleanup()
        success = cleanup.run_cleanup()
        
        if success:
            print("\n🎉 Direct database cleanup completed successfully!")
            return 0
        else:
            print("\n⚠️ Cleanup completed with some issues. Check the log above.")
            return 1
            
    except KeyboardInterrupt:
        print("\n\nCleanup interrupted by user.")
        return 1
    except Exception as e:
        print(f"\n\nUnexpected error during cleanup: {e}")
        return 1

if __name__ == "__main__":
    exit(main())