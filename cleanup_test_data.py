#!/usr/bin/env python3
"""
Forkcast Test Data Cleanup Script
Identifies and removes test/debug users and their associated data from the production database.
"""

import requests
import json
import time
import re
from datetime import datetime

# Configuration
BASE_URL = "https://forkcast-planner.preview.emergentagent.com/api"

class ForkcastDataCleanup:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_users = []
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
            r'chef_\d+',  # Pattern from our test script
            r'demo.*',
            r'sample.*',
            r'fake.*',
            r'temp.*'
        ]
        
        username_lower = username.lower()
        for pattern in test_patterns:
            if re.match(pattern, username_lower):
                return True
        return False

    def create_admin_user(self):
        """Create a temporary admin user for cleanup operations"""
        self.log_message("Creating temporary admin user for cleanup operations...")
        
        try:
            admin_username = f"cleanup_admin_{int(time.time())}"
            admin_password = "cleanup_secure_123"
            
            url = f"{self.base_url}/auth/register"
            payload = {
                "username": admin_username,
                "password": admin_password
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data['token']
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                self.log_message(f"✅ Admin user created: {admin_username}")
                return True
            else:
                self.log_message(f"❌ Failed to create admin user: {response.text}")
                return False
                
        except Exception as e:
            self.log_message(f"❌ Exception creating admin user: {str(e)}")
            return False

    def get_all_meals(self):
        """Get all meals to identify test user data"""
        self.log_message("Fetching all meals to identify test users...")
        
        try:
            url = f"{self.base_url}/meals"
            response = self.session.get(url)
            
            if response.status_code == 200:
                meals = response.json()
                self.log_message(f"📊 Found {len(meals)} total meals in system")
                return meals
            else:
                self.log_message(f"❌ Failed to fetch meals: {response.text}")
                return []
                
        except Exception as e:
            self.log_message(f"❌ Exception fetching meals: {str(e)}")
            return []

    def identify_test_users_from_meals(self, meals):
        """Identify test users from meal data"""
        self.log_message("Analyzing meals to identify test users...")
        
        test_user_ids = set()
        test_usernames = set()
        
        for meal in meals:
            # Check if meal has user information
            if 'user' in meal and 'username' in meal['user']:
                username = meal['user']['username']
                if self.is_test_user(username):
                    test_user_ids.add(meal.get('userId'))
                    test_usernames.add(username)
                    self.log_message(f"🔍 Found test user meal: {username} (ID: {meal.get('userId')})")
            
            # Also check meal titles for test patterns
            title = meal.get('title', '')
            if any(pattern in title.lower() for pattern in ['test', 'debug', 'sample', 'demo']):
                self.log_message(f"🔍 Found test meal: '{title}' by user {meal.get('userId')}")
                if meal.get('userId'):
                    test_user_ids.add(meal.get('userId'))
        
        self.cleanup_results['test_users_found'] = len(test_user_ids)
        self.log_message(f"📋 Identified {len(test_user_ids)} test users: {list(test_usernames)}")
        
        return list(test_user_ids)

    def get_user_meals(self, user_id):
        """Get all meals for a specific user"""
        try:
            url = f"{self.base_url}/meals?userId={user_id}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                return response.json()
            else:
                self.log_message(f"⚠️ Failed to get meals for user {user_id}: {response.text}")
                return []
                
        except Exception as e:
            self.log_message(f"❌ Exception getting user meals: {str(e)}")
            return []

    def delete_meal(self, meal_id):
        """Delete a specific meal"""
        try:
            url = f"{self.base_url}/meals/{meal_id}"
            response = self.session.delete(url)
            
            if response.status_code == 200:
                self.cleanup_results['meals_deleted'] += 1
                return True
            else:
                error_msg = f"Failed to delete meal {meal_id}: {response.text}"
                self.cleanup_results['errors'].append(error_msg)
                self.log_message(f"⚠️ {error_msg}")
                return False
                
        except Exception as e:
            error_msg = f"Exception deleting meal {meal_id}: {str(e)}"
            self.cleanup_results['errors'].append(error_msg)
            self.log_message(f"❌ {error_msg}")
            return False

    def cleanup_user_data(self, user_id):
        """Clean up all data for a specific user"""
        self.log_message(f"🧹 Cleaning up data for user: {user_id}")
        
        # Get user's meals
        user_meals = self.get_user_meals(user_id)
        self.log_message(f"📊 Found {len(user_meals)} meals for user {user_id}")
        
        # Delete each meal
        deleted_count = 0
        for meal in user_meals:
            meal_id = meal.get('id')
            if meal_id:
                if self.delete_meal(meal_id):
                    deleted_count += 1
                    self.log_message(f"🗑️ Deleted meal: {meal.get('title', 'Unknown')} (ID: {meal_id})")
                else:
                    self.log_message(f"❌ Failed to delete meal: {meal.get('title', 'Unknown')} (ID: {meal_id})")
        
        self.log_message(f"✅ Deleted {deleted_count}/{len(user_meals)} meals for user {user_id}")
        return deleted_count

    def verify_cleanup(self):
        """Verify that test data has been cleaned up"""
        self.log_message("🔍 Verifying cleanup results...")
        
        # Get all meals again to check
        remaining_meals = self.get_all_meals()
        
        test_meals_remaining = []
        for meal in remaining_meals:
            # Check for test patterns in usernames
            if 'user' in meal and 'username' in meal['user']:
                username = meal['user']['username']
                if self.is_test_user(username):
                    test_meals_remaining.append(meal)
            
            # Check for test patterns in meal titles
            title = meal.get('title', '')
            if any(pattern in title.lower() for pattern in ['test', 'debug', 'sample', 'demo']):
                test_meals_remaining.append(meal)
        
        if test_meals_remaining:
            self.log_message(f"⚠️ Found {len(test_meals_remaining)} remaining test meals:")
            for meal in test_meals_remaining[:5]:  # Show first 5
                username = meal.get('user', {}).get('username', 'Unknown')
                self.log_message(f"   - '{meal.get('title', 'Unknown')}' by {username}")
        else:
            self.log_message("✅ No test meals found - cleanup successful!")
        
        return len(test_meals_remaining)

    def run_cleanup(self):
        """Run the complete cleanup process"""
        self.log_message("🚀 Starting Forkcast test data cleanup...")
        self.log_message(f"🌐 Base URL: {self.base_url}")
        self.log_message("=" * 60)
        
        # Step 1: Create admin user for operations
        if not self.create_admin_user():
            self.log_message("❌ Cannot proceed without admin access")
            return False
        
        # Step 2: Get all meals and identify test users
        all_meals = self.get_all_meals()
        if not all_meals:
            self.log_message("⚠️ No meals found or unable to fetch meals")
            return False
        
        test_user_ids = self.identify_test_users_from_meals(all_meals)
        
        if not test_user_ids:
            self.log_message("✅ No test users identified - system appears clean")
            return True
        
        # Step 3: Clean up test user data
        self.log_message(f"🧹 Starting cleanup of {len(test_user_ids)} test users...")
        
        for user_id in test_user_ids:
            self.cleanup_user_data(user_id)
        
        # Step 4: Verify cleanup
        remaining_test_meals = self.verify_cleanup()
        
        # Step 5: Print summary
        self.print_cleanup_summary()
        
        return remaining_test_meals == 0

    def print_cleanup_summary(self):
        """Print cleanup results summary"""
        self.log_message("\n" + "=" * 60)
        self.log_message("CLEANUP RESULTS SUMMARY")
        self.log_message("=" * 60)
        
        self.log_message(f"Test users identified: {self.cleanup_results['test_users_found']}")
        self.log_message(f"Meals deleted: {self.cleanup_results['meals_deleted']}")
        self.log_message(f"Users deleted: {self.cleanup_results['users_deleted']}")
        self.log_message(f"Errors encountered: {len(self.cleanup_results['errors'])}")
        
        if self.cleanup_results['errors']:
            self.log_message("\nErrors:")
            for error in self.cleanup_results['errors']:
                self.log_message(f"  ❌ {error}")
        
        self.log_message("\n" + "=" * 60)

def main():
    """Main cleanup execution"""
    cleanup = ForkcastDataCleanup()
    
    try:
        success = cleanup.run_cleanup()
        
        if success:
            print("\n🎉 Test data cleanup completed successfully!")
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