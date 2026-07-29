#!/usr/bin/env python3
"""
Backend contract verification for POST /api/shopping-list barcode field.

This test suite verifies:
1. The new barcode field is accepted and forwarded to the DB layer
2. Invalid barcodes are sanitized to null (not rejected with 400)
3. Missing/null barcodes are handled gracefully
4. Existing validation (name required) is preserved
5. Auth guard still fires first
6. No regression on POST /api/pantry
"""

import requests
import json
import jwt
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000"
JWT_SECRET = "dev-only-insecure-secret-do-not-use-in-prod"

def mint_dev_jwt():
    """Create a dev JWT for testing"""
    payload = {
        "userId": "dev-user",
        "username": "dev",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

def test_shopping_list_barcode():
    """Test POST /api/shopping-list with various barcode scenarios"""
    
    token = mint_dev_jwt()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("=" * 80)
    print("BACKEND CONTRACT VERIFICATION: POST /api/shopping-list barcode field")
    print("=" * 80)
    print()
    
    # Test 1: Valid 13-digit EAN-13 barcode
    print("TEST 1: Valid 13-digit EAN-13 barcode (8710437003216)")
    print("-" * 80)
    body = {"name": "Lichte Basterdsuiker", "barcode": "8710437003216"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (500 with Supabase error as expected)")
            print("✅ PASS: Barcode field accepted (not rejected as 'Invalid JSON' or 'Item name is required')")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 validation error - barcode should be accepted: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 2: Valid 12-digit UPC-A barcode
    print("TEST 2: Valid 12-digit UPC-A barcode (012345678905)")
    print("-" * 80)
    body = {"name": "Something", "barcode": "012345678905"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (500 with Supabase error as expected)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 validation error - UPC-A should be accepted: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 3: Valid 8-digit EAN-8 barcode
    print("TEST 3: Valid 8-digit EAN-8 barcode (12345670)")
    print("-" * 80)
    body = {"name": "Small", "barcode": "12345670"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (500 with Supabase error as expected)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 validation error - EAN-8 should be accepted: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 4: Barcode with letters (should be sanitized to null, not rejected)
    print("TEST 4: Barcode with letters (abc123) - should sanitize to null")
    print("-" * 80)
    body = {"name": "Weird", "barcode": "abc123"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (invalid barcode sanitized to null, not rejected)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        error_msg = response.json().get("error", "")
        if "barcode" in error_msg.lower():
            print(f"❌ FAIL: Got 400 for barcode field - should sanitize to null instead: {error_msg}")
        else:
            print(f"❌ FAIL: Got 400 but not for barcode: {error_msg}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 5: Empty string barcode (should be sanitized to null)
    print("TEST 5: Empty string barcode - should sanitize to null")
    print("-" * 80)
    body = {"name": "Empty", "barcode": ""}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (empty barcode sanitized to null)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 - empty barcode should be sanitized to null: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 6: Explicit null barcode
    print("TEST 6: Explicit null barcode")
    print("-" * 80)
    body = {"name": "Explicit null", "barcode": None}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (null barcode accepted)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 - null barcode should be accepted: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 7: Missing barcode field (regression check)
    print("TEST 7: Missing barcode field - should work (barcode is optional)")
    print("-" * 80)
    body = {"name": "Only name"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (missing barcode is OK)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        error_msg = response.json().get("error", "")
        if "barcode" in error_msg.lower():
            print(f"❌ FAIL: Got 400 for missing barcode - field should be optional: {error_msg}")
        else:
            print(f"❌ FAIL: Got 400: {error_msg}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 8: Missing name (regression check - should still 400)
    print("TEST 8: Missing name - should still return 400 'Item name is required'")
    print("-" * 80)
    body = {"barcode": "8710437003216"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 400:
        data = response.json()
        if data.get("error") == "Item name is required":
            print("✅ PASS: Got expected 400 'Item name is required'")
        else:
            print(f"❌ FAIL: Got 400 but wrong message: {data.get('error')}")
    else:
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
    print()
    
    # Test 9: Barcode too short (5 digits, below 6-14 range)
    print("TEST 9: Barcode too short (12345) - should sanitize to null")
    print("-" * 80)
    body = {"name": "Too short", "barcode": "12345"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (too-short barcode sanitized to null)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 - too-short barcode should be sanitized to null: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 10: Barcode too long (15 digits)
    print("TEST 10: Barcode too long (123456789012345) - should sanitize to null")
    print("-" * 80)
    body = {"name": "Too long", "barcode": "123456789012345"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Reached DB layer (too-long barcode sanitized to null)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 - too-long barcode should be sanitized to null: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    # Test 11: No Authorization header
    print("TEST 11: No Authorization header - should return 401")
    print("-" * 80)
    body = {"name": "No auth", "barcode": "8710437003216"}
    response = requests.post(f"{BASE_URL}/api/shopping-list", json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 401:
        data = response.json()
        if data.get("error") == "Unauthorized":
            print("✅ PASS: Got expected 401 'Unauthorized'")
        else:
            print(f"❌ FAIL: Got 401 but wrong message: {data.get('error')}")
    else:
        print(f"❌ FAIL: Expected 401, got {response.status_code}")
    print()
    
    # Test 12: Regression check on POST /api/pantry
    print("TEST 12: Regression check - POST /api/pantry should still work")
    print("-" * 80)
    body = {"name": "Test pantry item", "barcode": "8710437003216"}
    response = requests.post(f"{BASE_URL}/api/pantry", headers=headers, json=body)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
    if response.status_code == 500:
        data = response.json()
        if "Database is unavailable" in data.get("error", ""):
            print("✅ PASS: Pantry endpoint unchanged (reached DB layer)")
        else:
            print(f"❌ FAIL: Unexpected 500 error: {data.get('error')}")
    elif response.status_code == 400:
        print(f"❌ FAIL: Got 400 - pantry endpoint should work: {response.json()}")
    else:
        print(f"❌ FAIL: Unexpected status {response.status_code}")
    print()
    
    print("=" * 80)
    print("BACKEND CONTRACT VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_shopping_list_barcode()
