#!/usr/bin/env python3
"""
Quick database check for meal plans issue
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:3000/api"

def test_database_state():
    """Test the current state of the database and meal plans functionality"""
    print("🔍 Checking Forkcast database state...")
    
    # Step 1: Register a test user to get authentication
    print("\n1. Creating test user for database check...")
    test_username = f"dbcheck_{int(time.time())}"
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json={
            "username": test_username,
            "password": "testpass123"
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data['token']
            user_id = data['user']['id']
            print(f"✅ Test user created: {test_username} (ID: {user_id})")
        else:
            print(f"❌ Failed to create test user: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Check meal plans endpoint
    print("\n2. Testing meal plans endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/meal-plans", headers=headers)
        print(f"GET /api/meal-plans status: {response.status_code}")
        
        if response.status_code == 200:
            meal_plans = response.json()
            print(f"✅ Found {len(meal_plans)} meal plans")
            
            if len(meal_plans) > 0:
                print("📋 Sample meal plans:")
                for i, plan in enumerate(meal_plans[:3]):
                    print(f"  {i+1}. {plan.get('date', 'No date')} {plan.get('mealType', 'No type')}: {plan.get('meal', {}).get('title', 'No title')}")
            else:
                print("📭 Database has 0 meal plans")
                
        elif response.status_code == 500:
            error_data = response.json()
            print(f"❌ Server error: {error_data.get('error', 'Unknown error')}")
            if 'does not exist' in str(error_data):
                print("🚨 CRITICAL: meal_plans table does not exist in Supabase!")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing meal plans: {e}")
    
    # Step 3: Try to create a meal plan
    print("\n3. Testing meal plan creation...")
    try:
        # First create a meal
        meal_response = requests.post(f"{BASE_URL}/meals", headers=headers, json={
            "title": "Test Meal for Plan",
            "ingredients": "Test ingredient",
            "instructions": "Test instruction"
        })
        
        if meal_response.status_code == 200:
            meal_data = meal_response.json()
            meal_id = meal_data['id']
            print(f"✅ Test meal created: {meal_id}")
            
            # Now try to create a meal plan
            plan_response = requests.post(f"{BASE_URL}/meal-plans", headers=headers, json={
                "date": "2025-09-08",
                "mealType": "lunch",
                "mealId": meal_id
            })
            
            print(f"POST /api/meal-plans status: {plan_response.status_code}")
            
            if plan_response.status_code == 200:
                print("✅ Meal plan created successfully!")
            else:
                print(f"❌ Failed to create meal plan: {plan_response.text}")
        else:
            print(f"❌ Failed to create test meal: {meal_response.text}")
            
    except Exception as e:
        print(f"❌ Error testing meal plan creation: {e}")
    
    # Step 4: Check meals count
    print("\n4. Checking meals count...")
    try:
        response = requests.get(f"{BASE_URL}/meals", headers=headers)
        if response.status_code == 200:
            meals = response.json()
            print(f"📊 Found {len(meals)} total meals in database")
        else:
            print(f"❌ Error getting meals: {response.text}")
    except Exception as e:
        print(f"❌ Error checking meals: {e}")
    
    print(f"\n🧹 Cleaning up test user: {test_username}")

if __name__ == "__main__":
    test_database_state()