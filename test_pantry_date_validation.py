#!/usr/bin/env python3
"""
Pantry Date Validation Test - Testing the validateIsoDate fix

This test verifies the new validateIsoDate helper function that was added to
POST /api/pantry and PUT /api/pantry/:id endpoints.

The fix ensures that:
1. Valid calendar dates are accepted (e.g., 2025-11-03, 2024-02-29 leap year)
2. Invalid calendar dates are rejected with 400 (e.g., 2024-13-45, 2024-02-31, 2023-02-29 non-leap)
3. Malformed strings are rejected with 400 (e.g., "hello", "2024-1-1", "20241203", "")
4. PUT partial updates work (updating only name without expiresAt doesn't trigger validation)
5. Guard order is preserved: 401 (auth) → 400 (validation) → 500 (DB)
"""

import requests
import json
import os
import jwt
from datetime import datetime, timedelta

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

# Generate a valid JWT token using the dev secret from lib/auth.js
JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-prod'
FAKE_TOKEN = jwt.encode(
    {
        'userId': 'test-user-id-123',
        'username': 'test_user',
        'exp': datetime.utcnow() + timedelta(days=7)
    },
    JWT_SECRET,
    algorithm='HS256'
)

def print_test_header(test_name):
    """Print a formatted test header."""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_result(passed, message):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def test_valid_dates():
    """Test that valid calendar dates are accepted."""
    print_test_header("Valid Dates - Should be Accepted")
    
    valid_dates = [
        ("2025-11-03", "Regular valid date"),
        ("2024-02-29", "Leap year Feb 29"),
        ("2024-12-31", "End of year"),
        ("2025-01-01", "Start of year"),
    ]
    
    for date, description in valid_dates:
        print(f"\n[TEST] {description}: {date}")
        try:
            response = requests.post(
                f"{API_BASE}/pantry",
                headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
                json={"name": "Test Item", "expiresAt": date},
                timeout=10
            )
            # Should NOT be 400 (validation error)
            # Should be 500 (DB unavailable) or 200 (if DB is available)
            if response.status_code == 400:
                data = response.json()
                print_result(False, f"Valid date rejected with 400: {data}")
            elif response.status_code in [200, 500]:
                data = response.json()
                print_result(True, f"Valid date accepted (status {response.status_code}): {data}")
            else:
                print_result(False, f"Unexpected status {response.status_code}: {response.text}")
        except Exception as e:
            print_result(False, f"Request failed: {e}")

def test_invalid_calendar_dates():
    """Test that invalid calendar dates are rejected with 400."""
    print_test_header("Invalid Calendar Dates - Should be Rejected with 400")
    
    invalid_dates = [
        ("2024-13-45", "Invalid month (13) and day (45)"),
        ("2024-02-31", "February doesn't have 31 days"),
        ("2024-04-31", "April only has 30 days"),
        ("2023-02-29", "Non-leap year Feb 29"),
        ("2024-11-31", "November only has 30 days"),
        ("2024-00-15", "Month 00 is invalid"),
        ("2024-06-00", "Day 00 is invalid"),
    ]
    
    for date, description in invalid_dates:
        print(f"\n[TEST] {description}: {date}")
        try:
            response = requests.post(
                f"{API_BASE}/pantry",
                headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
                json={"name": "Test Item", "expiresAt": date},
                timeout=10
            )
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'expiresAt' in error_msg or 'date' in error_msg.lower():
                    print_result(True, f"Invalid date rejected with 400: {data}")
                else:
                    print_result(False, f"Got 400 but wrong error message: {data}")
            else:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print_result(False, f"Expected 400, got {response.status_code}: {data}")
        except Exception as e:
            print_result(False, f"Request failed: {e}")

def test_malformed_date_strings():
    """Test that malformed date strings are rejected with 400."""
    print_test_header("Malformed Date Strings - Should be Rejected with 400")
    
    malformed_dates = [
        ("hello", "Non-date string"),
        ("2024-1-1", "Wrong format (single digit month/day)"),
        ("20241203", "No dashes"),
        ("2024/12/03", "Wrong separator (slashes)"),
        ("", "Empty string"),
        ("2024-12", "Incomplete date (missing day)"),
        ("12-03-2024", "Wrong order (MM-DD-YYYY)"),
        ("2024-12-03T00:00:00Z", "ISO datetime (not just date)"),
    ]
    
    for date, description in malformed_dates:
        print(f"\n[TEST] {description}: '{date}'")
        try:
            response = requests.post(
                f"{API_BASE}/pantry",
                headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
                json={"name": "Test Item", "expiresAt": date},
                timeout=10
            )
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '')
                if 'expiresAt' in error_msg or 'YYYY-MM-DD' in error_msg:
                    print_result(True, f"Malformed date rejected with 400: {data}")
                else:
                    print_result(False, f"Got 400 but wrong error message: {data}")
            else:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print_result(False, f"Expected 400, got {response.status_code}: {data}")
        except Exception as e:
            print_result(False, f"Request failed: {e}")

def test_leap_year_validation():
    """Test leap year Feb 29 validation specifically."""
    print_test_header("Leap Year Feb 29 Validation")
    
    # Test non-leap year Feb 29 (should be rejected)
    print("\n[TEST] Non-leap year Feb 29: 2023-02-29 (should be rejected)")
    try:
        response = requests.post(
            f"{API_BASE}/pantry",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"name": "Test Item", "expiresAt": "2023-02-29"},
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            print_result(True, f"Non-leap Feb 29 rejected with 400: {data}")
        else:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            print_result(False, f"Expected 400, got {response.status_code}: {data}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test leap year Feb 29 (should be accepted)
    print("\n[TEST] Leap year Feb 29: 2024-02-29 (should be accepted)")
    try:
        response = requests.post(
            f"{API_BASE}/pantry",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"name": "Test Item", "expiresAt": "2024-02-29"},
            timeout=10
        )
        # Should NOT be 400 (validation error)
        # Should be 500 (DB unavailable) or 200 (if DB is available)
        if response.status_code == 400:
            data = response.json()
            print_result(False, f"Leap year Feb 29 rejected with 400: {data}")
        elif response.status_code in [200, 500]:
            data = response.json()
            print_result(True, f"Leap year Feb 29 accepted (status {response.status_code}): {data}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_put_partial_updates():
    """Test that PUT partial updates work without triggering date validation."""
    print_test_header("PUT Partial Updates - Should Work Without Date Validation")
    
    # Test 1: PUT with only name (no expiresAt) - should not trigger date validation
    print("\n[TEST] PUT /api/pantry/:id with only name (no expiresAt)")
    try:
        response = requests.put(
            f"{API_BASE}/pantry/fake-item-id",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"name": "Updated Name"},
            timeout=10
        )
        # Should NOT be 400 for date validation
        # Should be 404 (item not found) or 500 (DB unavailable)
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if 'expiresAt' in error_msg or 'date' in error_msg.lower():
                print_result(False, f"Date validation triggered on name-only update: {data}")
            else:
                # Some other 400 error is OK (e.g., validation for name)
                print_result(True, f"Got 400 but not for date validation: {data}")
        elif response.status_code in [404, 500]:
            data = response.json()
            print_result(True, f"Name-only update didn't trigger date validation (status {response.status_code}): {data}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 2: PUT with valid expiresAt - should accept
    print("\n[TEST] PUT /api/pantry/:id with valid expiresAt")
    try:
        response = requests.put(
            f"{API_BASE}/pantry/fake-item-id",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"expiresAt": "2025-12-31"},
            timeout=10
        )
        # Should NOT be 400 for date validation
        # Should be 404 (item not found) or 500 (DB unavailable)
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if 'expiresAt' in error_msg or 'date' in error_msg.lower():
                print_result(False, f"Valid date rejected in PUT: {data}")
            else:
                print_result(True, f"Got 400 but not for date validation: {data}")
        elif response.status_code in [404, 500]:
            data = response.json()
            print_result(True, f"Valid date accepted in PUT (status {response.status_code}): {data}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 3: PUT with invalid expiresAt - should reject with 400
    print("\n[TEST] PUT /api/pantry/:id with invalid expiresAt")
    try:
        response = requests.put(
            f"{API_BASE}/pantry/fake-item-id",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"expiresAt": "2024-02-31"},
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if 'expiresAt' in error_msg or 'date' in error_msg.lower():
                print_result(True, f"Invalid date rejected in PUT with 400: {data}")
            else:
                print_result(False, f"Got 400 but wrong error message: {data}")
        else:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            print_result(False, f"Expected 400, got {response.status_code}: {data}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_guard_order():
    """Test that guard order is preserved: 401 → 400 → 500."""
    print_test_header("Guard Order - 401 (Auth) → 400 (Validation) → 500 (DB)")
    
    # Test 1: No auth token - should get 401 BEFORE date validation
    print("\n[TEST] POST /api/pantry with invalid date but no auth (expect 401, not 400)")
    try:
        response = requests.post(
            f"{API_BASE}/pantry",
            json={"name": "Test Item", "expiresAt": "2024-13-45"},
            timeout=10
        )
        if response.status_code == 401:
            print_result(True, f"Auth guard fired first (401): {response.json()}")
        elif response.status_code == 400:
            print_result(False, f"Validation fired before auth (400): {response.json()}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 2: Valid auth but invalid date - should get 400 BEFORE DB access
    print("\n[TEST] POST /api/pantry with auth and invalid date (expect 400, not 500)")
    try:
        response = requests.post(
            f"{API_BASE}/pantry",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"name": "Test Item", "expiresAt": "2024-13-45"},
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if 'expiresAt' in error_msg or 'date' in error_msg.lower():
                print_result(True, f"Validation fired before DB (400): {data}")
            else:
                print_result(False, f"Got 400 but wrong error: {data}")
        elif response.status_code == 500:
            print_result(False, f"DB access happened before validation (500): {response.json()}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test 3: Valid auth and valid date - should get 500 (DB unavailable)
    print("\n[TEST] POST /api/pantry with auth and valid date (expect 500 DB error)")
    try:
        response = requests.post(
            f"{API_BASE}/pantry",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            json={"name": "Test Item", "expiresAt": "2025-12-31"},
            timeout=10
        )
        if response.status_code == 500:
            data = response.json()
            error_msg = data.get('error', '').lower()
            if 'database' in error_msg or 'unavailable' in error_msg:
                print_result(True, f"DB error as expected (500): {data}")
            else:
                print_result(False, f"Got 500 but unexpected error: {data}")
        elif response.status_code == 200:
            # If DB is available, 200 is also acceptable
            print_result(True, f"Item created successfully (200): {response.json()}")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def test_other_kitchen_endpoints():
    """Quick smoke test to ensure other Kitchen endpoints still work."""
    print_test_header("Other Kitchen Endpoints - Smoke Test")
    
    # Test GET /api/pantry
    print("\n[TEST] GET /api/pantry (should work)")
    try:
        response = requests.get(
            f"{API_BASE}/pantry",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            timeout=10
        )
        if response.status_code in [200, 500]:
            print_result(True, f"GET /api/pantry works (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test GET /api/shopping-list
    print("\n[TEST] GET /api/shopping-list (should work)")
    try:
        response = requests.get(
            f"{API_BASE}/shopping-list",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            timeout=10
        )
        if response.status_code in [200, 500]:
            print_result(True, f"GET /api/shopping-list works (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
    
    # Test GET /api/barcode-lookup
    print("\n[TEST] GET /api/barcode-lookup (should work)")
    try:
        response = requests.get(
            f"{API_BASE}/barcode-lookup?code=1234567890",
            headers={"Authorization": f"Bearer {FAKE_TOKEN}"},
            timeout=10
        )
        if response.status_code == 200:
            print_result(True, f"GET /api/barcode-lookup works (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Request failed: {e}")

def main():
    """Run all pantry date validation tests."""
    print("\n" + "="*80)
    print("PANTRY DATE VALIDATION TEST - validateIsoDate Fix Verification")
    print("="*80)
    print(f"Testing against: {API_BASE}")
    print("="*80)
    
    try:
        # Run all test suites
        test_valid_dates()
        test_invalid_calendar_dates()
        test_malformed_date_strings()
        test_leap_year_validation()
        test_put_partial_updates()
        test_guard_order()
        test_other_kitchen_endpoints()
        
        print("\n" + "="*80)
        print("PANTRY DATE VALIDATION TEST COMPLETED")
        print("="*80)
        print("\nKEY FINDINGS:")
        print("✅ Valid calendar dates (including leap year Feb 29) should be accepted")
        print("✅ Invalid calendar dates (e.g., 2024-13-45, 2024-02-31, 2023-02-29) should be rejected with 400")
        print("✅ Malformed strings (e.g., 'hello', '2024-1-1', '20241203') should be rejected with 400")
        print("✅ PUT partial updates (name-only) should work without triggering date validation")
        print("✅ Guard order preserved: 401 (auth) → 400 (validation) → 500 (DB)")
        print("✅ Other Kitchen endpoints should continue to work")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
