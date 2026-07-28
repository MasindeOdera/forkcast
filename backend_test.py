#!/usr/bin/env python3
"""
Backend API Test Suite for Barcode Lookup Enhancement
Tests the enhanced barcode-lookup system + new /api/barcode-diagnose endpoint
"""

import requests
import jwt
import time
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:3000/api"
JWT_SECRET = "dev-only-insecure-secret-do-not-use-in-prod"

def generate_jwt_token():
    """Generate a valid JWT token for testing"""
    payload = {
        "userId": "test-user-123",
        "username": "testuser",
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(passed, message, response_snippet=None):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    if response_snippet:
        print(f"Response snippet: {json.dumps(response_snippet, indent=2)}")

# ============================================================================
# TEST 1: /api/barcode-lookup REGRESSION TESTS (7 tests)
# ============================================================================

def test_1a_lookup_auth_guard():
    """Test 1a: GET /api/barcode-lookup without Authorization → 401"""
    print_test_header("1a: Barcode Lookup - Auth Guard")
    
    try:
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=1234567890123")
        
        if response.status_code == 401:
            print_result(True, "Returns 401 without Authorization header", 
                        {"status": response.status_code, "error": response.json().get("error")})
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_1b_lookup_validation():
    """Test 1b: Validation - missing code, non-digit, too short, too long → 400"""
    print_test_header("1b: Barcode Lookup - Validation")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    test_cases = [
        ("missing code", f"{BASE_URL}/barcode-lookup", "missing code parameter"),
        ("non-digit", f"{BASE_URL}/barcode-lookup?code=ABCDEF", "non-numeric code"),
        ("too short (5 digits)", f"{BASE_URL}/barcode-lookup?code=12345", "5-digit code"),
        ("too long (15 digits)", f"{BASE_URL}/barcode-lookup?code=123456789012345", "15-digit code"),
    ]
    
    all_passed = True
    for test_name, url, description in test_cases:
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 400:
                print_result(True, f"{test_name}: Returns 400 for {description}", 
                            {"status": 400, "error": response.json().get("error")})
            else:
                print_result(False, f"{test_name}: Expected 400, got {response.status_code}", 
                            {"status": response.status_code, "body": response.json()})
                all_passed = False
        except Exception as e:
            print_result(False, f"{test_name}: Exception - {str(e)}")
            all_passed = False
    
    return all_passed

def test_1c_lookup_real_hit_van_gilse():
    """Test 1c: Real hit - 8710437003216 (Van Gilse sugar)"""
    print_test_header("1c: Barcode Lookup - Real Hit (Van Gilse)")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=8710437003216", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            checks = [
                (data.get("found") == True, "found is true"),
                ("Basterdsuiker" in (data.get("name") or "").lower() or "suiker" in (data.get("name") or "").lower(), 
                 f"name contains sugar-related term: '{data.get('name')}'"),
                (data.get("brand") and "gilse" in data.get("brand").lower(), 
                 f"brand contains 'Gilse': '{data.get('brand')}'"),
                (data.get("source") == "off", f"source is 'off': '{data.get('source')}'"),
                ("8710437003216" in data.get("triedVariants", []), 
                 f"triedVariants contains code: {data.get('triedVariants')}"),
                ("off" in data.get("triedSources", []), 
                 f"triedSources contains 'off': {data.get('triedSources')}"),
            ]
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Real hit test completed in {duration:.2f}s", 
                        {
                            "found": data.get("found"),
                            "name": data.get("name"),
                            "brand": data.get("brand"),
                            "source": data.get("source"),
                            "triedVariants": data.get("triedVariants"),
                            "triedSources": data.get("triedSources")
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_1d_lookup_real_hit_muesli():
    """Test 1d: Real hit - 4056489592068 (Muesli)"""
    print_test_header("1d: Barcode Lookup - Real Hit (Muesli)")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=4056489592068", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            checks = [
                (data.get("found") == True, "found is true"),
                ("muesli" in (data.get("name") or "").lower(), 
                 f"name contains 'Muesli': '{data.get('name')}'"),
                (data.get("brand") and "crownfield" in data.get("brand").lower(), 
                 f"brand is 'Crownfield': '{data.get('brand')}'"),
                (data.get("source") == "off", f"source is 'off': '{data.get('source')}'"),
            ]
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Real hit test completed in {duration:.2f}s", 
                        {
                            "found": data.get("found"),
                            "name": data.get("name"),
                            "brand": data.get("brand"),
                            "source": data.get("source")
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_1e_lookup_guaranteed_miss():
    """Test 1e: Guaranteed miss - 2210620002500 (GS1 internal-use)"""
    print_test_header("1e: Barcode Lookup - Guaranteed Miss")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=2210620002500", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields for a miss
            checks = [
                (data.get("found") == False, f"found is false: {data.get('found')}"),
                (data.get("source") == "none", f"source is 'none': '{data.get('source')}'"),
                (len(data.get("triedSources", [])) == 5, 
                 f"triedSources contains all 5 sources: {data.get('triedSources')}"),
                ("off" in data.get("triedSources", []), "triedSources contains 'off'"),
                ("obf" in data.get("triedSources", []), "triedSources contains 'obf'"),
                ("opf" in data.get("triedSources", []), "triedSources contains 'opf'"),
                ("opff" in data.get("triedSources", []), "triedSources contains 'opff'"),
                ("upcitemdb" in data.get("triedSources", []), "triedSources contains 'upcitemdb'"),
            ]
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Guaranteed miss test completed in {duration:.2f}s", 
                        {
                            "found": data.get("found"),
                            "source": data.get("source"),
                            "triedSources": data.get("triedSources"),
                            "triedVariants": data.get("triedVariants")
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_1f_lookup_timeout_check():
    """Test 1f: Timeout check - completes in reasonable time (< 15s)"""
    print_test_header("1f: Barcode Lookup - Timeout Check")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=2210620002500", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            if duration < 15:
                print_result(True, f"Request completed in {duration:.2f}s (< 15s target)", 
                            {"duration_seconds": round(duration, 2)})
                return True
            else:
                print_result(False, f"Request took {duration:.2f}s (> 15s target)", 
                            {"duration_seconds": round(duration, 2)})
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

# ============================================================================
# TEST 2: /api/barcode-diagnose NEW ENDPOINT TESTS (5 tests)
# ============================================================================

def test_2a_diagnose_auth_guard():
    """Test 2a: GET /api/barcode-diagnose without Authorization → 401"""
    print_test_header("2a: Barcode Diagnose - Auth Guard")
    
    try:
        response = requests.get(f"{BASE_URL}/barcode-diagnose?code=4056489592068")
        
        if response.status_code == 401:
            print_result(True, "Returns 401 without Authorization header", 
                        {"status": response.status_code, "error": response.json().get("error")})
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_2b_diagnose_validation():
    """Test 2b: Validation - missing code, non-digit, too short, too long → 400"""
    print_test_header("2b: Barcode Diagnose - Validation")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    test_cases = [
        ("missing code", f"{BASE_URL}/barcode-diagnose", "missing code parameter"),
        ("non-digit", f"{BASE_URL}/barcode-diagnose?code=ABCDEF", "non-numeric code"),
        ("too short (5 digits)", f"{BASE_URL}/barcode-diagnose?code=12345", "5-digit code"),
        ("too long (15 digits)", f"{BASE_URL}/barcode-diagnose?code=123456789012345", "15-digit code"),
    ]
    
    all_passed = True
    for test_name, url, description in test_cases:
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 400:
                print_result(True, f"{test_name}: Returns 400 for {description}", 
                            {"status": 400, "error": response.json().get("error")})
            else:
                print_result(False, f"{test_name}: Expected 400, got {response.status_code}", 
                            {"status": response.status_code, "body": response.json()})
                all_passed = False
        except Exception as e:
            print_result(False, f"{test_name}: Exception - {str(e)}")
            all_passed = False
    
    return all_passed

def test_2c_diagnose_hit_case():
    """Test 2c: Hit case - 4056489592068 with full matrix"""
    print_test_header("2c: Barcode Diagnose - Hit Case (Full Matrix)")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-diagnose?code=4056489592068", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response shape
            checks = [
                (data.get("requestedCode") == "4056489592068", 
                 f"requestedCode is correct: '{data.get('requestedCode')}'"),
                (isinstance(data.get("variants"), list) and len(data.get("variants")) > 0, 
                 f"variants is array: {data.get('variants')}"),
                (isinstance(data.get("attempts"), list), "attempts is array"),
                (len(data.get("attempts", [])) == 5, 
                 f"attempts.length === 5 (never stops early): {len(data.get('attempts', []))}"),
                (isinstance(data.get("summary"), dict), "summary is object"),
            ]
            
            # Check first attempt (should be a hit from OFF)
            attempts = data.get("attempts", [])
            if len(attempts) > 0:
                first_attempt = attempts[0]
                checks.extend([
                    (first_attempt.get("code") == "4056489592068", 
                     f"first attempt code: '{first_attempt.get('code')}'"),
                    (first_attempt.get("source") == "off", 
                     f"first attempt source: '{first_attempt.get('source')}'"),
                    (first_attempt.get("sourceName") == "Open Food Facts", 
                     f"first attempt sourceName: '{first_attempt.get('sourceName')}'"),
                    (first_attempt.get("hit") == True, 
                     f"first attempt hit: {first_attempt.get('hit')}"),
                    (isinstance(first_attempt.get("durationMs"), (int, float)), 
                     f"first attempt durationMs is number: {first_attempt.get('durationMs')}"),
                    (isinstance(first_attempt.get("product"), dict), 
                     "first attempt has product object"),
                ])
                
                product = first_attempt.get("product", {})
                if product:
                    checks.extend([
                        (product.get("name") is not None, 
                         f"product has name: '{product.get('name')}'"),
                        (product.get("brand") is not None, 
                         f"product has brand: '{product.get('brand')}'"),
                    ])
            
            # Check summary
            summary = data.get("summary", {})
            checks.extend([
                (summary.get("anyHit") == True, f"summary.anyHit is true: {summary.get('anyHit')}"),
                (summary.get("firstHit") == "off", f"summary.firstHit is 'off': '{summary.get('firstHit')}'"),
                (isinstance(summary.get("totalDurationMs"), (int, float)), 
                 f"summary.totalDurationMs is number: {summary.get('totalDurationMs')}"),
                (summary.get("totalSourcesQueried") == 5, 
                 f"summary.totalSourcesQueried is 5: {summary.get('totalSourcesQueried')}"),
            ])
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Hit case test completed in {duration:.2f}s", 
                        {
                            "requestedCode": data.get("requestedCode"),
                            "variants": data.get("variants"),
                            "attempts_count": len(data.get("attempts", [])),
                            "first_attempt": attempts[0] if attempts else None,
                            "summary": data.get("summary")
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_2d_diagnose_full_miss():
    """Test 2d: Full-miss case - 2210620002500"""
    print_test_header("2d: Barcode Diagnose - Full Miss Case")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-diagnose?code=2210620002500", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response shape for miss
            attempts = data.get("attempts", [])
            summary = data.get("summary", {})
            
            checks = [
                (len(attempts) == 5, f"attempts.length === 5: {len(attempts)}"),
                (all(not attempt.get("hit") for attempt in attempts), 
                 "all attempts have hit:false"),
                (summary.get("anyHit") == False, f"summary.anyHit is false: {summary.get('anyHit')}"),
                (summary.get("firstHit") is None, f"summary.firstHit is null: {summary.get('firstHit')}"),
            ]
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Full miss test completed in {duration:.2f}s", 
                        {
                            "attempts_count": len(attempts),
                            "all_miss": all(not a.get("hit") for a in attempts),
                            "summary": summary
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_2e_diagnose_variant_expansion():
    """Test 2e: Variant expansion - 049000042566 (12-digit UPC-A)"""
    print_test_header("2e: Barcode Diagnose - Variant Expansion")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/barcode-diagnose?code=049000042566", headers=headers)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            variants = data.get("variants", [])
            attempts = data.get("attempts", [])
            
            # Check variant expansion
            checks = [
                ("049000042566" in variants, 
                 f"variants contains original 12-digit: {variants}"),
                ("0049000042566" in variants, 
                 f"variants contains 13-digit EAN-13: {variants}"),
                (len(variants) == 2, f"variants array has 2 entries: {len(variants)}"),
                (len(attempts) == 10, 
                 f"attempts.length === 10 (5 sources × 2 variants): {len(attempts)}"),
            ]
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, f"Variant expansion test completed in {duration:.2f}s", 
                        {
                            "variants": variants,
                            "attempts_count": len(attempts)
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                        {"status": response.status_code, "body": response.json()})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

# ============================================================================
# TEST 3: RESPONSE SHAPE BACKWARDS COMPATIBILITY
# ============================================================================

def test_3_backwards_compatibility():
    """Test 3: Response shape backwards compatibility"""
    print_test_header("3: Response Shape Backwards Compatibility")
    
    token = generate_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/barcode-lookup?code=4056489592068", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check all existing fields are present
            required_fields = [
                "found", "code", "requestedCode", "name", "brand", 
                "image", "quantity", "source", "triedVariants"
            ]
            
            # New field
            new_fields = ["triedSources"]
            
            checks = []
            for field in required_fields:
                checks.append((field in data, f"Field '{field}' present"))
            
            for field in new_fields:
                checks.append((field in data, f"NEW field '{field}' present"))
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                print(f"  {'✓' if passed else '✗'} {message}")
            
            print_result(all_passed, "Backwards compatibility check", 
                        {
                            "all_fields_present": all_passed,
                            "fields": list(data.keys())
                        })
            return all_passed
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all tests and report results"""
    print("\n" + "="*80)
    print("BARCODE LOOKUP ENHANCEMENT TEST SUITE")
    print("Testing enhanced barcode-lookup system + /api/barcode-diagnose endpoint")
    print("="*80)
    
    results = {}
    
    # Test 1: /api/barcode-lookup regression tests
    print("\n" + "="*80)
    print("SECTION 1: /api/barcode-lookup REGRESSION TESTS")
    print("="*80)
    results["1a_auth_guard"] = test_1a_lookup_auth_guard()
    results["1b_validation"] = test_1b_lookup_validation()
    results["1c_real_hit_van_gilse"] = test_1c_lookup_real_hit_van_gilse()
    results["1d_real_hit_muesli"] = test_1d_lookup_real_hit_muesli()
    results["1e_guaranteed_miss"] = test_1e_lookup_guaranteed_miss()
    results["1f_timeout_check"] = test_1f_lookup_timeout_check()
    
    # Test 2: /api/barcode-diagnose new endpoint tests
    print("\n" + "="*80)
    print("SECTION 2: /api/barcode-diagnose NEW ENDPOINT TESTS")
    print("="*80)
    results["2a_auth_guard"] = test_2a_diagnose_auth_guard()
    results["2b_validation"] = test_2b_diagnose_validation()
    results["2c_hit_case"] = test_2c_diagnose_hit_case()
    results["2d_full_miss"] = test_2d_diagnose_full_miss()
    results["2e_variant_expansion"] = test_2e_diagnose_variant_expansion()
    
    # Test 3: Backwards compatibility
    print("\n" + "="*80)
    print("SECTION 3: BACKWARDS COMPATIBILITY")
    print("="*80)
    results["3_backwards_compatibility"] = test_3_backwards_compatibility()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("\nDetailed Results:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
