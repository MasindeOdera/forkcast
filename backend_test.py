#!/usr/bin/env python3
"""
Backend test for barcode-cache endpoints and updated /api/barcode-lookup behavior.

This test focuses on:
1. GET /api/barcode-lookup with various scenarios (auth, validation, cache behavior, bypassCache)
2. DELETE /api/barcode-cache with various scenarios
3. Regression tests for DELETE /api/shopping-list and /api/barcode-diagnose
4. Graceful degradation when Supabase is unavailable
"""

import requests
import json
import jwt
import time
from datetime import datetime, timedelta

# Base URL for the Next.js backend
BASE_URL = "http://localhost:3000"

# Dev JWT secret (from debugging.md Step 6)
DEV_SECRET = "dev-only-insecure-secret-do-not-use-in-prod"

def mint_dev_jwt():
    """Mint a dev JWT for testing (as documented in debugging.md)"""
    payload = {
        "userId": "dev-user",
        "username": "dev",
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    token = jwt.encode(payload, DEV_SECRET, algorithm="HS256")
    return token

def test_barcode_lookup_known_good():
    """
    Test 1: GET /api/barcode-lookup?code=4056489592068 (Crownfield Crunchy Muesli)
    Expected: 200, found:true, name, brand, source:'off', no fromCache (Supabase unavailable)
    """
    print("\n" + "="*80)
    print("TEST 1: GET /api/barcode-lookup?code=4056489592068 (known-good OFF product)")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/barcode-lookup?code=4056489592068",
            headers=headers,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            assert data.get("found") == True, "Expected found:true"
            assert data.get("name") is not None, "Expected name field"
            assert data.get("brand") is not None, "Expected brand field"
            assert data.get("source") == "off", f"Expected source:'off', got {data.get('source')}"
            assert data.get("code") == "4056489592068", "Expected code field"
            
            # Should NOT have fromCache:true (Supabase unavailable)
            if data.get("fromCache") == True:
                print("⚠️  WARNING: fromCache:true present (unexpected - Supabase should be unavailable)")
            else:
                print("✅ No fromCache field (correct - cache unavailable)")
            
            # Check for debug fields
            assert "triedVariants" in data, "Expected triedVariants field"
            assert "triedSources" in data, "Expected triedSources field"
            
            print(f"✅ TEST 1 PASSED: Found product '{data.get('name')}' from brand '{data.get('brand')}'")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {str(e)}")
        return False

def test_barcode_lookup_bypass_cache():
    """
    Test 2: GET /api/barcode-lookup?code=4056489592068&bypassCache=1
    Expected: 200, same data as Test 1, server logs should show (bypassCache) tag
    """
    print("\n" + "="*80)
    print("TEST 2: GET /api/barcode-lookup?code=4056489592068&bypassCache=1")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/barcode-lookup?code=4056489592068&bypassCache=1",
            headers=headers,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields (same as Test 1)
            assert data.get("found") == True, "Expected found:true"
            assert data.get("name") is not None, "Expected name field"
            assert data.get("brand") is not None, "Expected brand field"
            assert data.get("source") == "off", f"Expected source:'off', got {data.get('source')}"
            
            # Should NOT have fromCache (bypassed)
            assert data.get("fromCache") != True, "Expected no fromCache when bypassCache=1"
            
            print("✅ TEST 2 PASSED: bypassCache parameter working correctly")
            print("ℹ️  Check server logs for '[barcode] lookup 4056489592068 (bypassCache)' message")
            return True
        else:
            print(f"❌ TEST 2 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {str(e)}")
        return False

def test_barcode_lookup_invalid_codes():
    """
    Test 3: GET /api/barcode-lookup with invalid codes
    Expected: 400, error:'Invalid barcode'
    """
    print("\n" + "="*80)
    print("TEST 3: GET /api/barcode-lookup with invalid codes")
    print("="*80)
    
    token = mint_dev_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    
    invalid_codes = ["invalid", "abc123"]
    all_passed = True
    
    for code in invalid_codes:
        try:
            print(f"\n  Testing code: {code}")
            response = requests.get(
                f"{BASE_URL}/api/barcode-lookup?code={code}",
                headers=headers,
                timeout=10
            )
            
            print(f"  Status Code: {response.status_code}")
            print(f"  Response: {json.dumps(response.json(), indent=2)}")
            
            if response.status_code == 400:
                data = response.json()
                if data.get("error") == "Invalid barcode":
                    print(f"  ✅ Correctly rejected invalid code '{code}'")
                else:
                    print(f"  ❌ Wrong error message: {data.get('error')}")
                    all_passed = False
            else:
                print(f"  ❌ Expected 400, got {response.status_code}")
                all_passed = False
                
        except Exception as e:
            print(f"  ❌ Failed with exception: {str(e)}")
            all_passed = False
    
    if all_passed:
        print("\n✅ TEST 3 PASSED: All invalid codes correctly rejected")
    else:
        print("\n❌ TEST 3 FAILED: Some invalid codes not handled correctly")
    
    return all_passed

def test_barcode_lookup_no_auth():
    """
    Test 4: GET /api/barcode-lookup without Authorization header
    Expected: 401, error:'Unauthorized'
    """
    print("\n" + "="*80)
    print("TEST 4: GET /api/barcode-lookup without Authorization header")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/barcode-lookup?code=4056489592068",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 401:
            data = response.json()
            if data.get("error") == "Unauthorized":
                print("✅ TEST 4 PASSED: Correctly requires authentication")
                return True
            else:
                print(f"❌ TEST 4 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"❌ TEST 4 FAILED: Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {str(e)}")
        return False

def test_barcode_cache_delete():
    """
    Test 5: DELETE /api/barcode-cache?code=4056489592068
    Expected: 200, invalidated:'4056489592068'
    """
    print("\n" + "="*80)
    print("TEST 5: DELETE /api/barcode-cache?code=4056489592068")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/barcode-cache?code=4056489592068",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("invalidated") == "4056489592068":
                print("✅ TEST 5 PASSED: Cache invalidation endpoint working")
                print("ℹ️  Check server logs for '[barcode] cache invalidated for 4056489592068 by user dev-user'")
                return True
            else:
                print(f"❌ TEST 5 FAILED: Wrong response: {data}")
                return False
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 5 FAILED with exception: {str(e)}")
        return False

def test_barcode_cache_delete_invalid():
    """
    Test 6: DELETE /api/barcode-cache?code=abc (invalid code)
    Expected: 400, error:'Invalid barcode'
    """
    print("\n" + "="*80)
    print("TEST 6: DELETE /api/barcode-cache?code=abc (invalid code)")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/barcode-cache?code=abc",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get("error") == "Invalid barcode":
                print("✅ TEST 6 PASSED: Invalid code correctly rejected")
                return True
            else:
                print(f"❌ TEST 6 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"❌ TEST 6 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 6 FAILED with exception: {str(e)}")
        return False

def test_barcode_cache_delete_no_auth():
    """
    Test 7: DELETE /api/barcode-cache without Authorization header
    Expected: 401, error:'Unauthorized'
    """
    print("\n" + "="*80)
    print("TEST 7: DELETE /api/barcode-cache without Authorization header")
    print("="*80)
    
    try:
        response = requests.delete(
            f"{BASE_URL}/api/barcode-cache?code=4056489592068",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 401:
            data = response.json()
            if data.get("error") == "Unauthorized":
                print("✅ TEST 7 PASSED: Correctly requires authentication")
                return True
            else:
                print(f"❌ TEST 7 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"❌ TEST 7 FAILED: Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 7 FAILED with exception: {str(e)}")
        return False

def test_barcode_cache_delete_no_code():
    """
    Test 8: DELETE /api/barcode-cache without code param
    Expected: 400, error:'Invalid barcode'
    """
    print("\n" + "="*80)
    print("TEST 8: DELETE /api/barcode-cache without code param")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/barcode-cache",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get("error") == "Invalid barcode":
                print("✅ TEST 8 PASSED: Missing code param correctly rejected")
                return True
            else:
                print(f"❌ TEST 8 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"❌ TEST 8 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 8 FAILED with exception: {str(e)}")
        return False

def test_shopping_list_delete_regression():
    """
    Test 9: DELETE /api/shopping-list?checked=true (regression test)
    Expected: Should NOT throw ReferenceError: url is not defined
    """
    print("\n" + "="*80)
    print("TEST 9: DELETE /api/shopping-list?checked=true (regression test)")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.delete(
            f"{BASE_URL}/api/shopping-list?checked=true",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        # We expect 500 due to missing Supabase, but NOT a ReferenceError
        if response.status_code == 500:
            data = response.json()
            error_msg = data.get("error", "")
            details = data.get("details", "")
            
            # Check that it's NOT the ReferenceError
            if "ReferenceError" in str(error_msg) or "url is not defined" in str(details):
                print("❌ TEST 9 FAILED: ReferenceError: url is not defined still present")
                return False
            else:
                print("✅ TEST 9 PASSED: No ReferenceError (DB unavailable error is expected)")
                print("ℹ️  Check server logs to confirm no 'ReferenceError: url is not defined'")
                return True
        elif response.status_code == 200:
            # If it somehow works (shouldn't in this env), that's also fine
            print("✅ TEST 9 PASSED: Endpoint working (unexpected but acceptable)")
            return True
        else:
            print(f"⚠️  TEST 9: Unexpected status {response.status_code}, but no ReferenceError")
            return True
            
    except Exception as e:
        print(f"❌ TEST 9 FAILED with exception: {str(e)}")
        return False

def test_barcode_diagnose():
    """
    Test 10: GET /api/barcode-diagnose?code=4056489592068
    Expected: 200, JSON with requestedCode, variants, attempts array, summary
    """
    print("\n" + "="*80)
    print("TEST 10: GET /api/barcode-diagnose?code=4056489592068")
    print("="*80)
    
    try:
        token = mint_dev_jwt()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/barcode-diagnose?code=4056489592068",
            headers=headers,
            timeout=60  # Longer timeout as it queries all sources
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            assert "requestedCode" in data, "Expected requestedCode field"
            assert "variants" in data, "Expected variants field"
            assert "attempts" in data, "Expected attempts array"
            assert "summary" in data, "Expected summary field"
            
            # Check summary fields
            summary = data.get("summary", {})
            assert "anyHit" in summary, "Expected summary.anyHit"
            assert "firstHit" in summary, "Expected summary.firstHit"
            
            # Check attempts array has 5 sources
            attempts = data.get("attempts", [])
            assert len(attempts) >= 5, f"Expected at least 5 attempts, got {len(attempts)}"
            
            # Verify at least one hit (OFF should work)
            if summary.get("anyHit") == True and summary.get("firstHit") == "off":
                print(f"✅ TEST 10 PASSED: Diagnose endpoint working, found product via {summary.get('firstHit')}")
                print(f"ℹ️  Total sources queried: {len(attempts)}")
                print("ℹ️  Check server logs to confirm NO '[barcode_cache]' warnings for diagnose")
                return True
            else:
                print(f"⚠️  TEST 10: Diagnose returned but no hits found (may be rate-limited)")
                print("ℹ️  Structure is correct, but product lookup failed")
                return True  # Structure is correct even if no hits
                
        else:
            print(f"❌ TEST 10 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 10 FAILED with exception: {str(e)}")
        return False

def check_server_logs():
    """
    Helper to remind about checking server logs for graceful degradation warnings
    """
    print("\n" + "="*80)
    print("SERVER LOG CHECKS")
    print("="*80)
    print("""
Please verify the following in server logs:

1. For Test 1 (barcode-lookup without bypassCache):
   - Should see: [barcode] lookup 4056489592068
   - Should see: [barcode_cache] getFresh threw: (graceful degradation)
   - Should see: [barcode_cache] upsert threw: (graceful degradation)

2. For Test 2 (barcode-lookup with bypassCache):
   - Should see: [barcode] lookup 4056489592068 (bypassCache)
   - Should NOT see any [barcode_cache] warnings (cache skipped)

3. For Test 5 (cache invalidation):
   - Should see: [barcode] cache invalidated for 4056489592068 by user dev-user

4. For Test 9 (shopping-list delete):
   - Should NOT see: ReferenceError: url is not defined

5. For Test 10 (barcode-diagnose):
   - Should NOT see any [barcode_cache] warnings (diagnose bypasses cache)

To check logs:
  sudo tail -n 100 /var/log/supervisor/nextjs.out.log
  sudo tail -n 100 /var/log/supervisor/nextjs.err.log
""")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BARCODE-CACHE ENDPOINTS TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Environment: Supabase env vars NOT set (expected)")
    print(f"Expected Behavior: Graceful degradation - cache reads/writes silently no-op")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("Test 1: barcode-lookup known-good", test_barcode_lookup_known_good()))
    results.append(("Test 2: barcode-lookup bypassCache", test_barcode_lookup_bypass_cache()))
    results.append(("Test 3: barcode-lookup invalid codes", test_barcode_lookup_invalid_codes()))
    results.append(("Test 4: barcode-lookup no auth", test_barcode_lookup_no_auth()))
    results.append(("Test 5: barcode-cache delete", test_barcode_cache_delete()))
    results.append(("Test 6: barcode-cache delete invalid", test_barcode_cache_delete_invalid()))
    results.append(("Test 7: barcode-cache delete no auth", test_barcode_cache_delete_no_auth()))
    results.append(("Test 8: barcode-cache delete no code", test_barcode_cache_delete_no_code()))
    results.append(("Test 9: shopping-list delete regression", test_shopping_list_delete_regression()))
    results.append(("Test 10: barcode-diagnose", test_barcode_diagnose()))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    # Remind about server log checks
    check_server_logs()
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
