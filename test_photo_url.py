#!/usr/bin/env python3
"""
Quick test script to verify photo URL is accessible
"""

import requests
import sys

def test_photo_url(url):
    """Test if photo URL is accessible"""
    print(f"Testing URL: {url}")
    print("-" * 60)
    
    try:
        # Test without headers
        print("\n1. Testing without headers...")
        response = requests.get(url, timeout=10)
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        print(f"   Content-Length: {len(response.content)} bytes")
        
        if response.status_code == 200:
            print("   ✅ SUCCESS - Photo is accessible!")
            return True
        else:
            print(f"   ❌ FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    try:
        # Test with headers
        print("\n2. Testing with User-Agent header...")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=10, headers=headers)
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        print(f"   Content-Length: {len(response.content)} bytes")
        
        if response.status_code == 200:
            print("   ✅ SUCCESS - Photo is accessible with headers!")
            return True
        else:
            print(f"   ❌ FAILED - HTTP {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    return False

if __name__ == "__main__":
    # Example URL - replace with actual photo URL from your system
    test_url = "https://utsvlihpudfraxzcmtle.supabase.co/storage/v1/object/public/profile/staff-photos/943a2d6b-bac6-426d-9865-aed2b8cb8ab5-1234567890.jpg"
    
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
    
    print("=" * 60)
    print("PHOTO URL ACCESSIBILITY TEST")
    print("=" * 60)
    
    success = test_photo_url(test_url)
    
    print("\n" + "=" * 60)
    if success:
        print("RESULT: ✅ Photo URL is accessible")
    else:
        print("RESULT: ❌ Photo URL is NOT accessible")
        print("\nPossible issues:")
        print("1. Photo doesn't exist in Supabase Storage")
        print("2. Storage bucket has RLS policies blocking access")
        print("3. Photo path is incorrect")
        print("4. Network/firewall blocking access")
    print("=" * 60)
