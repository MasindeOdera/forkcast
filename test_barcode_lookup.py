#!/usr/bin/env python3
"""
Barcode Lookup Regression + Enhancement Test
Tests the GET /api/barcode-lookup endpoint after major upgrade.

Test scenarios:
1. Auth guard: 401 without Authorization
2. Validation: 400 for missing/invalid/too short/too long barcodes
3. Real hit via Open Food Facts: 8710437003216 (Van Gilse product)
4. Real miss: 2210620002500 (Simon Lévelt in-store code)
5. Variant retry: 049000042566 (Coca-Cola UPC-A)
6. AbortSignal timeout: request completes in under 10s
7. Empty-product OFF hit rejection: verify normal hits still work
"""

import requests
import json
import time
import jwt
from datetime import datetime, timedelta

# Base URL for the API
BASE_URL = "http://localhost:3000/api"

# Generate a valid JWT token for testing
# Using the dev fallback secret from lib/auth.js
JWT_SECRET = "dev-only-insecure-secret-do-not-use-in-prod"

def generate_test_token():
    """Generate a valid JWT token for testing"""
    payload = {
        'userId': 'test-user-id',
        'username': 'test_user',
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def print_test_header(test_num, description):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(passed, message):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def print_response(response):
    """Print response details"""
    print(f"Status: {response.status_code}")
    try:
        print(f"Body: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Body: {response.text}")

# =============================================================================
# TEST 1: Auth guard - 401 without Authorization
# =============================================================================
def test_1_auth_guard():
    print_test_header(1, "Auth guard: GET /api/barcode-lookup without Authorization → 401")
    
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '1234567890123'},
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 401:
            print_result(True, "Correctly returned 401 without Authorization header")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# TEST 2: Validation - missing code, non-numeric, too short, too long
# =============================================================================
def test_2_validation():
    print_test_header(2, "Validation: missing code, non-numeric, too short, too long")
    
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    test_cases = [
        {'params': {}, 'expected_status': 400, 'description': 'Missing code parameter'},
        {'params': {'code': 'ABCDEF'}, 'expected_status': 400, 'description': 'Non-numeric code'},
        {'params': {'code': '12345'}, 'expected_status': 400, 'description': 'Too short (5 digits)'},
        {'params': {'code': '123456789012345'}, 'expected_status': 400, 'description': 'Too long (15 digits)'},
    ]
    
    all_passed = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n--- Test 2.{i}: {test_case['description']} ---")
        try:
            response = requests.get(
                f"{BASE_URL}/barcode-lookup",
                params=test_case['params'],
                headers=headers,
                timeout=10
            )
            
            print_response(response)
            
            if response.status_code == test_case['expected_status']:
                data = response.json()
                if 'error' in data and 'Invalid barcode' in data['error']:
                    print_result(True, f"Correctly returned 400 with 'Invalid barcode' error")
                else:
                    print_result(True, f"Correctly returned {test_case['expected_status']}")
            else:
                print_result(False, f"Expected {test_case['expected_status']}, got {response.status_code}")
                all_passed = False
        except Exception as e:
            print_result(False, f"Exception: {str(e)}")
            all_passed = False
    
    return all_passed

# =============================================================================
# TEST 3: Real hit via Open Food Facts - 8710437003216 (Van Gilse product)
# =============================================================================
def test_3_real_hit_off():
    print_test_header(3, "Real hit via Open Food Facts: 8710437003216 (Van Gilse product)")
    
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '8710437003216'},
            headers=headers,
            timeout=15
        )
        
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields
        checks = [
            (data.get('found') == True, "found is true"),
            ('name' in data, "name field exists"),
            ('brand' in data, "brand field exists"),
            (data.get('source') == 'off', "source is 'off'"),
            ('triedVariants' in data, "triedVariants field exists"),
            (isinstance(data.get('triedVariants'), list), "triedVariants is an array"),
            ('8710437003216' in data.get('triedVariants', []), "triedVariants contains '8710437003216'"),
        ]
        
        # Check for Van Gilse product
        name_lower = (data.get('name') or '').lower()
        brand_lower = (data.get('brand') or '').lower()
        
        checks.append((
            'basterdsuiker' in name_lower or 'van gilse' in name_lower or 'van gilse' in brand_lower,
            "Product name or brand contains 'Basterdsuiker' or 'Van Gilse'"
        ))
        
        all_passed = True
        for check, description in checks:
            if check:
                print_result(True, description)
            else:
                print_result(False, description)
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# TEST 4: Real miss - 2210620002500 (Simon Lévelt in-store code)
# =============================================================================
def test_4_real_miss():
    print_test_header(4, "Real miss: 2210620002500 (Simon Lévelt in-store code)")
    
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '2210620002500'},
            headers=headers,
            timeout=15
        )
        
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields for miss
        checks = [
            (data.get('found') == False, "found is false"),
            (data.get('source') == 'none', "source is 'none'"),
            ('triedVariants' in data, "triedVariants field exists"),
            (isinstance(data.get('triedVariants'), list), "triedVariants is an array"),
        ]
        
        all_passed = True
        for check, description in checks:
            if check:
                print_result(True, description)
            else:
                print_result(False, description)
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# TEST 5: Variant retry - 049000042566 (Coca-Cola UPC-A)
# =============================================================================
def test_5_variant_retry():
    print_test_header(5, "Variant retry: 049000042566 (Coca-Cola UPC-A)")
    
    print("\nNote: The code tries variants in order and stops when it finds a match.")
    print("If the first variant succeeds, triedVariants will only contain that one.")
    print("Testing both a found product and a not-found product to verify variant logic.\n")
    
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    all_passed = True
    
    # Test 5a: Real product (might be found on first try)
    print("--- Test 5a: Real product (049000042566) ---")
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '049000042566'},
            headers=headers,
            timeout=15
        )
        
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            
            # Check basic structure
            if 'triedVariants' in data and isinstance(data.get('triedVariants'), list):
                print_result(True, "triedVariants field exists and is an array")
                
                tried_variants = data.get('triedVariants', [])
                if '049000042566' in tried_variants:
                    print_result(True, "triedVariants contains '049000042566'")
                else:
                    print_result(False, "triedVariants should contain '049000042566'")
                    all_passed = False
                
                # If found on first try, it won't have the padded variant
                if data.get('found'):
                    print_result(True, f"Product found via {data.get('source')} (resolved successfully)")
                    if len(tried_variants) == 1:
                        print_result(True, "Only one variant tried (found on first attempt - efficient!)")
                    elif '0049000042566' in tried_variants:
                        print_result(True, "Both variants tried (padded variant also checked)")
                else:
                    print_result(True, "Product not found")
            else:
                print_result(False, "triedVariants field missing or not an array")
                all_passed = False
                
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 5b: Non-existent product to verify multiple variants are tried
    print("\n--- Test 5b: Non-existent 12-digit code to verify variant generation ---")
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '012345678901'},  # Unlikely to be a real product
            headers=headers,
            timeout=15
        )
        
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            all_passed = False
        else:
            data = response.json()
            
            tried_variants = data.get('triedVariants', [])
            
            # For a not-found product, both variants should be tried
            checks = [
                ('012345678901' in tried_variants, "triedVariants contains '012345678901'"),
                ('0012345678901' in tried_variants, "triedVariants contains '0012345678901' (padded)"),
                (len(tried_variants) == 2, "Both variants were tried (12-digit → 13-digit conversion working)"),
            ]
            
            for check, description in checks:
                if check:
                    print_result(True, description)
                else:
                    print_result(False, description)
                    all_passed = False
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

# =============================================================================
# TEST 6: AbortSignal timeout - request completes in under 10s
# =============================================================================
def test_6_timeout():
    print_test_header(6, "AbortSignal timeout: request completes in under 10s")
    
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        start_time = time.time()
        
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '8710437003216'},  # Use a known good code
            headers=headers,
            timeout=15
        )
        
        elapsed_time = time.time() - start_time
        
        print_response(response)
        print(f"\nElapsed time: {elapsed_time:.2f} seconds")
        
        if response.status_code == 200:
            if elapsed_time < 10:
                print_result(True, f"Request completed in {elapsed_time:.2f}s (under 10s limit)")
                return True
            else:
                print_result(False, f"Request took {elapsed_time:.2f}s (over 10s limit)")
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# TEST 7: Empty-product OFF hit rejection - verify normal hits still work
# =============================================================================
def test_7_empty_product_rejection():
    print_test_header(7, "Empty-product OFF hit rejection: verify normal hits still work")
    
    print("\nNote: This test verifies that the code rejects OFF hits with both empty")
    print("product_name AND empty brands. We test this by verifying that normal hits")
    print("(test 3) still return found:true correctly (i.e., we didn't break the happy path).")
    
    # Re-run test 3 to verify normal hits still work
    token = generate_test_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        response = requests.get(
            f"{BASE_URL}/barcode-lookup",
            params={'code': '8710437003216'},
            headers=headers,
            timeout=15
        )
        
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('found') == True:
            print_result(True, "Normal hits still return found:true (happy path not broken)")
            
            # Verify that the product has either name or brand (not both empty)
            has_name = bool(data.get('name'))
            has_brand = bool(data.get('brand'))
            
            if has_name or has_brand:
                print_result(True, "Product has name and/or brand (not empty)")
                return True
            else:
                print_result(False, "Product has both empty name and brand (should have been rejected)")
                return False
        else:
            print_result(False, "Expected found:true for known product")
            return False
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Main test runner
# =============================================================================
def main():
    print("\n" + "="*80)
    print("BARCODE LOOKUP REGRESSION + ENHANCEMENT TEST")
    print("Testing GET /api/barcode-lookup after major upgrade")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['Test 1: Auth guard'] = test_1_auth_guard()
    results['Test 2: Validation'] = test_2_validation()
    results['Test 3: Real hit (OFF)'] = test_3_real_hit_off()
    results['Test 4: Real miss'] = test_4_real_miss()
    results['Test 5: Variant retry'] = test_5_variant_retry()
    results['Test 6: Timeout'] = test_6_timeout()
    results['Test 7: Empty-product rejection'] = test_7_empty_product_rejection()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == '__main__':
    exit(main())
