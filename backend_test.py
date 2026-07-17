#!/usr/bin/env python3
"""
Backend API Testing for Deployment Fix Verification
Tests the 6 specific objectives from the deployment fix review request.
"""

import requests
import json
import os
import sys

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_URL = f"{BASE_URL}/api"

print(f"Testing API at: {API_URL}")
print("=" * 80)

# Track test results
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def test_result(test_name, passed, message=""):
    """Record test result"""
    if passed:
        test_results["passed"].append(test_name)
        print(f"✅ PASS: {test_name}")
        if message:
            print(f"   {message}")
    else:
        test_results["failed"].append(test_name)
        print(f"❌ FAIL: {test_name}")
        if message:
            print(f"   {message}")
    print()

def test_warning(test_name, message):
    """Record warning"""
    test_results["warnings"].append(test_name)
    print(f"⚠️  WARNING: {test_name}")
    print(f"   {message}")
    print()

# ============================================================================
# OBJECTIVE 1: Server boots without crashing
# ============================================================================
print("OBJECTIVE 1: Server boots without crashing")
print("-" * 80)

try:
    # Try a simple GET request to a non-existent path - should return 404 JSON, not crash
    response = requests.get(f"{API_URL}/nonexistent-path", timeout=5)
    
    if response.status_code == 404:
        try:
            data = response.json()
            if "error" in data:
                test_result(
                    "Server boots without crashing",
                    True,
                    f"Server responded with 404 JSON: {data}"
                )
            else:
                test_result(
                    "Server boots without crashing",
                    False,
                    f"Got 404 but unexpected JSON format: {data}"
                )
        except json.JSONDecodeError:
            test_result(
                "Server boots without crashing",
                False,
                "Got 404 but response is not JSON"
            )
    else:
        test_result(
            "Server boots without crashing",
            True,
            f"Server responded with status {response.status_code} (not 404, but server is running)"
        )
except requests.exceptions.ConnectionError:
    test_result(
        "Server boots without crashing",
        False,
        "Connection refused - server is not running"
    )
except Exception as e:
    test_result(
        "Server boots without crashing",
        False,
        f"Unexpected error: {str(e)}"
    )

# ============================================================================
# OBJECTIVE 2: .env file exists
# ============================================================================
print("OBJECTIVE 2: .env file exists at /app/.env")
print("-" * 80)

env_path = "/app/.env"
if os.path.exists(env_path) and os.path.isfile(env_path):
    # Check if it's readable
    try:
        with open(env_path, 'r') as f:
            content = f.read()
            if len(content) > 0:
                test_result(
                    ".env file exists and is readable",
                    True,
                    f"File size: {len(content)} bytes"
                )
            else:
                test_result(
                    ".env file exists and is readable",
                    False,
                    "File exists but is empty"
                )
    except Exception as e:
        test_result(
            ".env file exists and is readable",
            False,
            f"File exists but cannot be read: {str(e)}"
        )
else:
    test_result(
        ".env file exists and is readable",
        False,
        f"File does not exist at {env_path}"
    )

# ============================================================================
# OBJECTIVE 3: DB-dependent endpoints respond gracefully
# ============================================================================
print("OBJECTIVE 3: DB-dependent endpoints respond gracefully with clear error message")
print("-" * 80)

# Expected error message for DB unavailability
EXPECTED_DB_ERROR = "Database is unavailable. Please contact the administrator."

# Test 3a: POST /api/auth/register
print("Test 3a: POST /api/auth/register")
try:
    response = requests.post(
        f"{API_URL}/auth/register",
        json={"username": "testuser_deploy_fix", "password": "password123"},
        timeout=5
    )
    
    if response.status_code == 500:
        try:
            data = response.json()
            if data.get("error") == EXPECTED_DB_ERROR:
                test_result(
                    "POST /api/auth/register returns graceful DB error",
                    True,
                    f"Got expected error message: {data.get('error')}"
                )
            else:
                test_result(
                    "POST /api/auth/register returns graceful DB error",
                    False,
                    f"Got 500 but unexpected error message: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "POST /api/auth/register returns graceful DB error",
                False,
                "Got 500 but response is not JSON"
            )
    elif response.status_code == 200:
        test_warning(
            "POST /api/auth/register",
            "Endpoint returned 200 - DB might be available (unexpected in this sandbox)"
        )
    else:
        test_result(
            "POST /api/auth/register returns graceful DB error",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "POST /api/auth/register returns graceful DB error",
        False,
        f"Request failed: {str(e)}"
    )

# Test 3b: POST /api/auth/login
print("Test 3b: POST /api/auth/login")
try:
    response = requests.post(
        f"{API_URL}/auth/login",
        json={"username": "demo", "password": "password123"},
        timeout=5
    )
    
    if response.status_code == 500:
        try:
            data = response.json()
            if data.get("error") == EXPECTED_DB_ERROR:
                test_result(
                    "POST /api/auth/login returns graceful DB error",
                    True,
                    f"Got expected error message: {data.get('error')}"
                )
            else:
                test_result(
                    "POST /api/auth/login returns graceful DB error",
                    False,
                    f"Got 500 but unexpected error message: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "POST /api/auth/login returns graceful DB error",
                False,
                "Got 500 but response is not JSON"
            )
    elif response.status_code == 200:
        test_warning(
            "POST /api/auth/login",
            "Endpoint returned 200 - DB might be available (unexpected in this sandbox)"
        )
    else:
        test_result(
            "POST /api/auth/login returns graceful DB error",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "POST /api/auth/login returns graceful DB error",
        False,
        f"Request failed: {str(e)}"
    )

# Test 3c: GET /api/users/me with bogus token
print("Test 3c: GET /api/users/me with bogus Bearer token")
try:
    response = requests.get(
        f"{API_URL}/users/me",
        headers={"Authorization": "Bearer bogus_token_12345"},
        timeout=5
    )
    
    # This should return 401 (auth check happens before DB) OR 500 with DB error
    if response.status_code == 401:
        try:
            data = response.json()
            test_result(
                "GET /api/users/me with bogus token returns 401",
                True,
                f"Auth guard works correctly: {data.get('error')}"
            )
        except json.JSONDecodeError:
            test_result(
                "GET /api/users/me with bogus token returns 401",
                False,
                "Got 401 but response is not JSON"
            )
    elif response.status_code == 500:
        try:
            data = response.json()
            if data.get("error") == EXPECTED_DB_ERROR:
                test_warning(
                    "GET /api/users/me with bogus token",
                    "Got DB error instead of 401 - auth might be checking DB first"
                )
            else:
                test_result(
                    "GET /api/users/me with bogus token",
                    False,
                    f"Got 500 with unexpected error: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "GET /api/users/me with bogus token",
                False,
                "Got 500 but response is not JSON"
            )
    else:
        test_result(
            "GET /api/users/me with bogus token",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "GET /api/users/me with bogus token",
        False,
        f"Request failed: {str(e)}"
    )

# Test 3d: GET /api/meals
print("Test 3d: GET /api/meals")
try:
    response = requests.get(f"{API_URL}/meals", timeout=5)
    
    if response.status_code == 500:
        try:
            data = response.json()
            # Accept either the standard DB error message OR a clear error with details
            error_msg = data.get("error", "")
            has_details = "details" in data and data["details"]
            
            if data.get("error") == EXPECTED_DB_ERROR or (error_msg and has_details):
                test_result(
                    "GET /api/meals returns graceful DB error",
                    True,
                    f"Got clear error message: {error_msg} (details: {data.get('details', 'N/A')[:100]})"
                )
            else:
                test_result(
                    "GET /api/meals returns graceful DB error",
                    False,
                    f"Got 500 but unclear error message: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "GET /api/meals returns graceful DB error",
                False,
                "Got 500 but response is not JSON"
            )
    elif response.status_code == 200:
        test_warning(
            "GET /api/meals",
            "Endpoint returned 200 - DB might be available (unexpected in this sandbox)"
        )
    else:
        test_result(
            "GET /api/meals returns graceful DB error",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "GET /api/meals returns graceful DB error",
        False,
        f"Request failed: {str(e)}"
    )

# ============================================================================
# OBJECTIVE 4: CORS preflight works
# ============================================================================
print("OBJECTIVE 4: CORS preflight (OPTIONS request)")
print("-" * 80)

try:
    response = requests.options(f"{API_URL}/auth/login", timeout=5)
    
    if response.status_code == 200:
        cors_header = response.headers.get('Access-Control-Allow-Origin')
        if cors_header == '*':
            test_result(
                "OPTIONS /api/auth/login returns 200 with CORS headers",
                True,
                f"Access-Control-Allow-Origin: {cors_header}"
            )
        else:
            test_result(
                "OPTIONS /api/auth/login returns 200 with CORS headers",
                False,
                f"Got 200 but Access-Control-Allow-Origin is '{cors_header}' (expected '*')"
            )
    else:
        test_result(
            "OPTIONS /api/auth/login returns 200 with CORS headers",
            False,
            f"Unexpected status code: {response.status_code}"
        )
except Exception as e:
    test_result(
        "OPTIONS /api/auth/login returns 200 with CORS headers",
        False,
        f"Request failed: {str(e)}"
    )

# ============================================================================
# OBJECTIVE 5: Request validation fires before DB usage
# ============================================================================
print("OBJECTIVE 5: Request validation fires before DB usage")
print("-" * 80)

try:
    # Send empty body to login endpoint - should get 400 validation error, not 500 DB error
    response = requests.post(
        f"{API_URL}/auth/login",
        json={},
        timeout=5
    )
    
    if response.status_code == 400:
        try:
            data = response.json()
            if "Username and password are required" in data.get("error", ""):
                test_result(
                    "POST /api/auth/login with empty body returns 400 validation error",
                    True,
                    f"Validation works correctly: {data.get('error')}"
                )
            else:
                test_result(
                    "POST /api/auth/login with empty body returns 400 validation error",
                    False,
                    f"Got 400 but unexpected error message: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "POST /api/auth/login with empty body returns 400 validation error",
                False,
                "Got 400 but response is not JSON"
            )
    elif response.status_code == 500:
        test_result(
            "POST /api/auth/login with empty body returns 400 validation error",
            False,
            "Got 500 DB error - validation should run before DB access"
        )
    else:
        test_result(
            "POST /api/auth/login with empty body returns 400 validation error",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "POST /api/auth/login with empty body returns 400 validation error",
        False,
        f"Request failed: {str(e)}"
    )

# ============================================================================
# OBJECTIVE 6: Auth guard runs before DB
# ============================================================================
print("OBJECTIVE 6: Auth guard runs before DB")
print("-" * 80)

try:
    # Send request to /api/users/me without Authorization header
    response = requests.get(f"{API_URL}/users/me", timeout=5)
    
    if response.status_code == 401:
        try:
            data = response.json()
            if "Unauthorized" in data.get("error", ""):
                test_result(
                    "GET /api/users/me without Authorization returns 401",
                    True,
                    f"Auth guard works correctly: {data.get('error')}"
                )
            else:
                test_result(
                    "GET /api/users/me without Authorization returns 401",
                    False,
                    f"Got 401 but unexpected error message: {data.get('error')}"
                )
        except json.JSONDecodeError:
            test_result(
                "GET /api/users/me without Authorization returns 401",
                False,
                "Got 401 but response is not JSON"
            )
    elif response.status_code == 500:
        test_result(
            "GET /api/users/me without Authorization returns 401",
            False,
            "Got 500 DB error - auth guard should run before DB access"
        )
    else:
        test_result(
            "GET /api/users/me without Authorization returns 401",
            False,
            f"Unexpected status code: {response.status_code}, body: {response.text[:200]}"
        )
except Exception as e:
    test_result(
        "GET /api/users/me without Authorization returns 401",
        False,
        f"Request failed: {str(e)}"
    )

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"✅ Passed: {len(test_results['passed'])}")
for test in test_results['passed']:
    print(f"   - {test}")
print()

if test_results['warnings']:
    print(f"⚠️  Warnings: {len(test_results['warnings'])}")
    for test in test_results['warnings']:
        print(f"   - {test}")
    print()

if test_results['failed']:
    print(f"❌ Failed: {len(test_results['failed'])}")
    for test in test_results['failed']:
        print(f"   - {test}")
    print()
    sys.exit(1)
else:
    print("🎉 All tests passed!")
    sys.exit(0)
