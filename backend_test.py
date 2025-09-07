#!/usr/bin/env python3
"""
Forkcast Backend API Test Suite
Tests all backend API endpoints for the Forkcast meal sharing application.
"""

import requests
import json
import os
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://forkcast-planner.preview.emergentagent.com/api"
TEST_USERNAME = f"chef_{int(time.time())}"
TEST_PASSWORD = "delicious123"

class ForkcastAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.test_meal_id = None
        self.results = {
            'auth_register': {'status': 'pending', 'details': ''},
            'auth_login': {'status': 'pending', 'details': ''},
            'meals_get_all': {'status': 'pending', 'details': ''},
            'meals_create': {'status': 'pending', 'details': ''},
            'meals_get_user': {'status': 'pending', 'details': ''},
            'meals_update': {'status': 'pending', 'details': ''},
            'meals_delete': {'status': 'pending', 'details': ''},
            'upload_image': {'status': 'pending', 'details': ''},
            'users_me': {'status': 'pending', 'details': ''},
            'ai_suggestions': {'status': 'pending', 'details': ''}
        }

    def log_result(self, test_name, status, details):
        """Log test result"""
        self.results[test_name] = {'status': status, 'details': details}
        print(f"[{status.upper()}] {test_name}: {details}")

    def test_auth_register(self):
        """Test user registration"""
        print("\n=== Testing Authentication - Register ===")
        
        try:
            url = f"{self.base_url}/auth/register"
            payload = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if 'token' in data and 'user' in data:
                    user = data['user']
                    if 'id' in user and 'username' in user and 'createdAt' in user:
                        self.auth_token = data['token']
                        self.user_data = user
                        self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                        self.log_result('auth_register', 'pass', f'User registered successfully: {user["username"]}')
                        return True
                    else:
                        self.log_result('auth_register', 'fail', f'Invalid user object structure: {user}')
                else:
                    self.log_result('auth_register', 'fail', f'Missing token or user in response: {data}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('auth_register', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('auth_register', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_auth_login(self):
        """Test user login"""
        print("\n=== Testing Authentication - Login ===")
        
        try:
            url = f"{self.base_url}/auth/login"
            payload = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if 'token' in data and 'user' in data:
                    user = data['user']
                    if 'id' in user and 'username' in user and 'createdAt' in user:
                        # Update token in case it's different
                        self.auth_token = data['token']
                        self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                        self.log_result('auth_login', 'pass', f'User logged in successfully: {user["username"]}')
                        return True
                    else:
                        self.log_result('auth_login', 'fail', f'Invalid user object structure: {user}')
                else:
                    self.log_result('auth_login', 'fail', f'Missing token or user in response: {data}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('auth_login', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('auth_login', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_users_me(self):
        """Test get current user info"""
        print("\n=== Testing Users - Get Me ===")
        
        if not self.auth_token:
            self.log_result('users_me', 'skip', 'No auth token available')
            return False
            
        try:
            url = f"{self.base_url}/users/me"
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if 'id' in data and 'username' in data and ('createdAt' in data or 'created_at' in data):
                    # Ensure password is not included
                    if 'password' not in data:
                        self.log_result('users_me', 'pass', f'User data retrieved successfully: {data["username"]}')
                        return True
                    else:
                        self.log_result('users_me', 'fail', 'Password field included in response (security issue)')
                else:
                    self.log_result('users_me', 'fail', f'Invalid user object structure: {data}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('users_me', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('users_me', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_meals_get_all(self):
        """Test get all meals"""
        print("\n=== Testing Meals - Get All ===")
        
        if not self.auth_token:
            self.log_result('meals_get_all', 'skip', 'No auth token available')
            return False
            
        try:
            url = f"{self.base_url}/meals"
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return an array
                if isinstance(data, list):
                    self.log_result('meals_get_all', 'pass', f'Retrieved {len(data)} meals successfully')
                    return True
                else:
                    self.log_result('meals_get_all', 'fail', f'Expected array, got: {type(data)}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('meals_get_all', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('meals_get_all', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_meals_create(self):
        """Test create new meal"""
        print("\n=== Testing Meals - Create ===")
        
        if not self.auth_token:
            self.log_result('meals_create', 'skip', 'No auth token available')
            return False
            
        try:
            url = f"{self.base_url}/meals"
            payload = {
                "title": f"Test Meal {int(time.time())}",
                "ingredients": "2 cups flour, 1 cup sugar, 3 eggs, 1 tsp vanilla",
                "instructions": "1. Mix dry ingredients. 2. Add wet ingredients. 3. Bake at 350°F for 25 minutes.",
                "imageUrl": "https://example.com/test-image.jpg"
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['id', 'userId', 'title', 'ingredients', 'instructions', 'createdAt', 'updatedAt']
                if all(field in data for field in required_fields):
                    self.test_meal_id = data['id']
                    print(f"DEBUG: Created meal with ID: {self.test_meal_id}")
                    self.log_result('meals_create', 'pass', f'Meal created successfully: {data["title"]}')
                    return True
                else:
                    missing_fields = [field for field in required_fields if field not in data]
                    self.log_result('meals_create', 'fail', f'Missing fields in response: {missing_fields}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('meals_create', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('meals_create', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_meals_get_user(self):
        """Test get user's meals"""
        print("\n=== Testing Meals - Get User Meals ===")
        
        if not self.auth_token or not self.user_data:
            self.log_result('meals_get_user', 'skip', 'No auth token or user data available')
            return False
            
        try:
            url = f"{self.base_url}/meals?userId={self.user_data['id']}"
            
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return an array
                if isinstance(data, list):
                    # All meals should belong to the user
                    user_meals = [meal for meal in data if meal.get('userId') == self.user_data['id']]
                    if len(user_meals) == len(data):
                        self.log_result('meals_get_user', 'pass', f'Retrieved {len(data)} user meals successfully')
                        return True
                    else:
                        self.log_result('meals_get_user', 'fail', f'Some meals do not belong to user: {len(user_meals)}/{len(data)}')
                else:
                    self.log_result('meals_get_user', 'fail', f'Expected array, got: {type(data)}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('meals_get_user', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('meals_get_user', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_meals_update(self):
        """Test update meal"""
        print("\n=== Testing Meals - Update ===")
        
        if not self.auth_token or not self.test_meal_id:
            self.log_result('meals_update', 'skip', 'No auth token or test meal ID available')
            return False
            
        try:
            # First, verify the meal exists by trying to get it
            verify_url = f"{self.base_url}/meals/{self.test_meal_id}"
            verify_response = self.session.get(verify_url)
            print(f"DEBUG: Verification GET response: {verify_response.status_code}")
            if verify_response.status_code == 200:
                meal_data = verify_response.json()
                print(f"DEBUG: Meal exists, meal userId: {meal_data.get('userId')}")
                print(f"DEBUG: Current user ID: {self.user_data.get('id')}")
                print(f"DEBUG: UserIds match: {meal_data.get('userId') == self.user_data.get('id')}")
            else:
                print(f"DEBUG: Meal verification failed: {verify_response.text}")
            
            url = f"{self.base_url}/meals/{self.test_meal_id}"
            print(f"DEBUG: Updating meal with ID: {self.test_meal_id}")
            payload = {
                "title": f"Updated Test Meal {int(time.time())}",
                "ingredients": "Updated ingredients list",
                "instructions": "Updated cooking instructions"
            }
            
            response = self.session.put(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure and updated fields
                if 'id' in data and data['id'] == self.test_meal_id:
                    if data.get('title') == payload['title']:
                        self.log_result('meals_update', 'pass', f'Meal updated successfully: {data["title"]}')
                        return True
                    else:
                        self.log_result('meals_update', 'fail', f'Title not updated correctly: {data.get("title")}')
                else:
                    self.log_result('meals_update', 'fail', f'Invalid meal ID in response: {data.get("id")}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('meals_update', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('meals_update', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_upload_image(self):
        """Test image upload"""
        print("\n=== Testing Upload - Image ===")
        
        if not self.auth_token:
            self.log_result('upload_image', 'skip', 'No auth token available')
            return False
            
        try:
            url = f"{self.base_url}/upload"
            
            # Create a simple test image (1x1 pixel PNG)
            test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xdd\x8d\xb4\x1c\x00\x00\x00\x00IEND\xaeB`\x82'
            
            files = {
                'file': ('test.png', test_image_data, 'image/png')
            }
            
            response = self.session.post(url, files=files)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['url', 'publicId', 'width', 'height']
                if all(field in data for field in required_fields):
                    if data['url'].startswith('https://'):
                        self.log_result('upload_image', 'pass', f'Image uploaded successfully: {data["url"]}')
                        return True
                    else:
                        self.log_result('upload_image', 'fail', f'Invalid URL format: {data["url"]}')
                else:
                    missing_fields = [field for field in required_fields if field not in data]
                    self.log_result('upload_image', 'fail', f'Missing fields in response: {missing_fields}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('upload_image', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('upload_image', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_meals_delete(self):
        """Test delete meal"""
        print("\n=== Testing Meals - Delete ===")
        
        if not self.auth_token or not self.test_meal_id:
            self.log_result('meals_delete', 'skip', 'No auth token or test meal ID available')
            return False
            
        try:
            url = f"{self.base_url}/meals/{self.test_meal_id}"
            
            response = self.session.delete(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return success message
                if 'message' in data and 'deleted' in data['message'].lower():
                    self.log_result('meals_delete', 'pass', f'Meal deleted successfully: {data["message"]}')
                    return True
                else:
                    self.log_result('meals_delete', 'fail', f'Unexpected response: {data}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('meals_delete', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('meals_delete', 'fail', f'Exception: {str(e)}')
        
        return False

    def test_ai_suggestions(self):
        """Test AI meal suggestions"""
        print("\n=== Testing AI - Meal Suggestions ===")
        
        if not self.auth_token:
            self.log_result('ai_suggestions', 'skip', 'No auth token available')
            return False
            
        try:
            url = f"{self.base_url}/meal-suggestions"
            payload = {
                "prompt": "I want something healthy and quick to make for dinner",
                "ingredients": ["chicken", "vegetables", "rice"],
                "dietary": "low-carb",
                "cuisine": "Asian",
                "mealType": "dinner"
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if 'suggestions' in data:
                    suggestions = data['suggestions']
                    if isinstance(suggestions, str) and len(suggestions) > 0:
                        self.log_result('ai_suggestions', 'pass', f'AI suggestions generated successfully (length: {len(suggestions)} chars)')
                        return True
                    else:
                        self.log_result('ai_suggestions', 'fail', f'Invalid suggestions format: {type(suggestions)}')
                else:
                    self.log_result('ai_suggestions', 'fail', f'Missing suggestions in response: {data}')
            else:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
                self.log_result('ai_suggestions', 'fail', f'HTTP {response.status_code}: {error_msg}')
                
        except Exception as e:
            self.log_result('ai_suggestions', 'fail', f'Exception: {str(e)}')
        
        return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"Starting Forkcast Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_USERNAME}")
        print("=" * 60)
        
        # Test authentication first
        if self.test_auth_register():
            self.test_auth_login()
            self.test_users_me()
            
            # Test meal operations
            self.test_meals_get_all()
            if self.test_meals_create():
                self.test_meals_get_user()
                self.test_meals_update()
                # Test upload before delete
                self.test_upload_image()
                # Test AI suggestions
                self.test_ai_suggestions()
                self.test_meals_delete()
            else:
                # Skip dependent tests if meal creation fails
                self.log_result('meals_get_user', 'skip', 'Meal creation failed')
                self.log_result('meals_update', 'skip', 'Meal creation failed')
                self.log_result('meals_delete', 'skip', 'Meal creation failed')
                # Still test upload and AI suggestions independently
                self.test_upload_image()
                self.test_ai_suggestions()
        else:
            # Skip all tests if registration fails
            for test_name in ['auth_login', 'users_me', 'meals_get_all', 'meals_create', 
                             'meals_get_user', 'meals_update', 'meals_delete', 'upload_image', 'ai_suggestions']:
                self.log_result(test_name, 'skip', 'User registration failed')

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.results.values() if result['status'] == 'pass')
        failed = sum(1 for result in self.results.values() if result['status'] == 'fail')
        skipped = sum(1 for result in self.results.values() if result['status'] == 'skip')
        
        print(f"Total Tests: {len(self.results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Skipped: {skipped}")
        print()
        
        # Print detailed results
        for test_name, result in self.results.items():
            status_symbol = "✅" if result['status'] == 'pass' else "❌" if result['status'] == 'fail' else "⏭️"
            print(f"{status_symbol} {test_name}: {result['details']}")
        
        print("\n" + "=" * 60)
        
        # Return overall success
        return failed == 0 and passed > 0

def main():
    """Main test execution"""
    tester = ForkcastAPITester()
    
    try:
        tester.run_all_tests()
        success = tester.print_summary()
        
        if success:
            print("🎉 All tests passed successfully!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1
            
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user.")
        return 1
    except Exception as e:
        print(f"\n\nUnexpected error during testing: {e}")
        return 1

if __name__ == "__main__":
    exit(main())