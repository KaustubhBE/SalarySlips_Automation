#!/usr/bin/env python3
"""
Test script to verify global order ID generation
This simulates multiple users requesting order IDs simultaneously
"""

import requests
import threading
import time
from concurrent.futures import ThreadPoolExecutor

# Configuration
BASE_URL = "http://localhost:5000"
FACTORY = "KR"
NUM_REQUESTS = 10
NUM_THREADS = 5

def get_order_id():
    """Request a new order ID from the backend"""
    try:
        response = requests.post(f"{BASE_URL}/api/get_next_order_id", 
                               json={"factory": FACTORY},
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data.get('orderId')
            else:
                print(f"Error: {data.get('message')}")
                return None
        else:
            print(f"HTTP Error: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def test_concurrent_order_ids():
    """Test concurrent order ID generation"""
    print(f"Testing global order ID generation for factory: {FACTORY}")
    print(f"Making {NUM_REQUESTS} requests using {NUM_THREADS} threads...")
    print("-" * 50)
    
    order_ids = []
    start_time = time.time()
    
    def worker():
        order_id = get_order_id()
        if order_id:
            order_ids.append(order_id)
            print(f"Generated: {order_id}")
        return order_id
    
    # Execute concurrent requests
    with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
        futures = [executor.submit(worker) for _ in range(NUM_REQUESTS)]
        results = [future.result() for future in futures]
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Analyze results
    print("\n" + "=" * 50)
    print("RESULTS:")
    print("=" * 50)
    
    # Filter out None results
    valid_order_ids = [oid for oid in order_ids if oid is not None]
    
    print(f"Total requests: {NUM_REQUESTS}")
    print(f"Successful responses: {len(valid_order_ids)}")
    print(f"Failed requests: {NUM_REQUESTS - len(valid_order_ids)}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Average response time: {duration/len(valid_order_ids):.3f} seconds")
    
    # Check for duplicates
    unique_ids = set(valid_order_ids)
    duplicates = len(valid_order_ids) - len(unique_ids)
    
    print(f"\nUniqueness Check:")
    print(f"Unique order IDs: {len(unique_ids)}")
    print(f"Duplicates found: {duplicates}")
    
    if duplicates == 0:
        print("✅ SUCCESS: All order IDs are unique!")
    else:
        print("❌ FAILURE: Duplicate order IDs found!")
        # Find and display duplicates
        seen = set()
        for oid in valid_order_ids:
            if oid in seen:
                print(f"  Duplicate: {oid}")
            seen.add(oid)
    
    # Display all generated order IDs
    print(f"\nGenerated Order IDs:")
    for i, oid in enumerate(sorted(valid_order_ids), 1):
        print(f"  {i:2d}. {oid}")
    
    return duplicates == 0

if __name__ == "__main__":
    print("Global Order ID Uniqueness Test")
    print("=" * 50)
    
    try:
        success = test_concurrent_order_ids()
        exit_code = 0 if success else 1
        print(f"\nTest {'PASSED' if success else 'FAILED'}")
        exit(exit_code)
        
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\nTest failed with error: {e}")
        exit(1)
