#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime

# Get the base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://forkcast-planner.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_meal_update_endpoint():
    """
    Test specifically the PUT /api/meals/{id} endpoint to debug Supabase query issue.
    Focus on the debug logging output from supabase-db.js updateOne method.
    """
    print("=== TESTING MEAL UPDATE ENDPOINT FOR SUPABASE DEBUG ===")
    
    # Step 1: Register a test user
    print("\n1. Registering test user...")
    register_data = {
        "username": f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=register_data)
        print(f"Register response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Registration failed: {response.text}")
            return False
            
        register_result = response.json()
        token = register_result['token']
        user_id = register_result['user']['id']
        print(f"✅ User registered successfully. User ID: {user_id}")
        
    except Exception as e:
        print(f"❌ Registration failed: {e}")
        return False
    
    # Step 2: Create a test meal
    print("\n2. Creating test meal...")
    headers = {"Authorization": f"Bearer {token}"}
    meal_data = {
        "title": "Test Meal for Update",
        "ingredients": "Original ingredients list",
        "instructions": "Original cooking instructions"
    }
    
    try:
        response = requests.post(f"{API_BASE}/meals", json=meal_data, headers=headers)
        print(f"Create meal response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Meal creation failed: {response.text}")
            return False
            
        meal_result = response.json()
        meal_id = meal_result['id']
        print(f"✅ Meal created successfully. Meal ID: {meal_id}")
        print(f"   Original title: {meal_result['title']}")
        
    except Exception as e:
        print(f"❌ Meal creation failed: {e}")
        return False
    
    # Step 3: Update the meal (this is where we want to see debug logs)
    print(f"\n3. Updating meal {meal_id}...")
    update_data = {
        "title": "Updated Test Meal Title",
        "ingredients": "Updated ingredients list with new items",
        "instructions": "Updated cooking instructions with more details"
    }
    
    try:
        response = requests.put(f"{API_BASE}/meals/{meal_id}", json=update_data, headers=headers)
        print(f"Update meal response status: {response.status_code}")
        print(f"Update meal response body: {response.text}")
        
        if response.status_code == 200:
            updated_meal = response.json()
            print(f"✅ Meal updated successfully!")
            print(f"   Updated title: {updated_meal['title']}")
            print(f"   Updated ingredients: {updated_meal['ingredients'][:50]}...")
            return True
        else:
            print(f"❌ Meal update failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Meal update failed: {e}")
        return False

if __name__ == "__main__":
    print("Starting focused meal update test...")
    print(f"API Base URL: {API_BASE}")
    
    success = test_meal_update_endpoint()
    
    if success:
        print("\n🎉 Meal update test completed successfully!")
        print("\n📋 IMPORTANT: Check the console logs for debug output from supabase-db.js updateOne method")
        print("    Look for lines starting with 'DEBUG updateOne:' to see the query construction")
    else:
        print("\n❌ Meal update test failed!")
        
    print("\n" + "="*60)