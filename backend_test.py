#!/usr/bin/env python3
"""
Sense Backend API Testing Suite
Tests all core APIs including auth, videos, feed, interests, and knowledge graph generation.
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

class SenseAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.timeout = 30

    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        self.log(f"   URL: {url}")
        self.log(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}")
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:500]
                })

            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {'raw_response': response.text}

            return success, response_data

        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}", "ERROR")
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'expected': expected_status,
                'actual': 'Exception'
            })
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        self.log("=== HEALTH CHECK TESTS ===")
        
        # Test root endpoint
        self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_admin_seed_videos(self):
        """Test admin video seeding"""
        self.log("=== ADMIN SEED VIDEOS TEST ===")
        
        # Test seeding videos with force=true
        success, response = self.run_test(
            "Seed Videos (Force)", 
            "POST", 
            "admin/seed-videos?force=true", 
            200
        )
        
        if success:
            self.log(f"   Videos seeded: {response.get('count', 'unknown')}")
        
        return success

    def test_videos_api(self):
        """Test videos API endpoints"""
        self.log("=== VIDEOS API TESTS ===")
        
        # Get videos
        success, videos_data = self.run_test("Get Videos", "GET", "videos", 200)
        
        if success and videos_data:
            self.log(f"   Found {len(videos_data)} videos")
            return len(videos_data) > 0
        
        return False

    def test_feed_api(self):
        """Test feed API endpoints"""
        self.log("=== FEED API TESTS ===")
        
        # Get feed (without auth)
        success, feed_data = self.run_test("Get Feed (No Auth)", "GET", "feed", 200)
        
        if success:
            self.log(f"   Feed items: {len(feed_data) if isinstance(feed_data, list) else 'unknown'}")
        
        return success

    def test_auth_flow(self):
        """Test authentication flow using Supabase"""
        self.log("=== AUTHENTICATION TESTS ===")
        
        # Note: We can't easily test Supabase auth without proper credentials
        # This would require actual user signup/signin through Supabase
        self.log("⚠️  Auth testing requires valid Supabase user credentials")
        self.log("   Skipping auth tests - manual testing required")
        
        return True

    def test_interests_api(self):
        """Test interests API (requires auth)"""
        self.log("=== INTERESTS API TESTS ===")
        
        if not self.token:
            self.log("⚠️  Skipping interests tests - no auth token")
            return True
        
        # Test get interests
        self.run_test("Get User Interests", "GET", "interests", 200)
        
        # Test save interests
        test_interests = [
            {"topic_slug": "ai", "topic_name": "AI", "weight": 1.0},
            {"topic_slug": "technology", "topic_name": "Technology", "weight": 1.0}
        ]
        
        self.run_test(
            "Save Interests", 
            "POST", 
            "interests", 
            200, 
            data=test_interests
        )
        
        return True

    def test_graph_api(self):
        """Test knowledge graph API endpoints"""
        self.log("=== KNOWLEDGE GRAPH API TESTS ===")
        
        if not self.token:
            self.log("⚠️  Skipping graph tests - no auth token")
            return True
        
        # Test get graph data (database source)
        success_db, _ = self.run_test(
            "Get Graph Data (DB)", 
            "GET", 
            "graph/data?source=db", 
            200
        )
        
        # Test get graph data (live source)
        success_live, _ = self.run_test(
            "Get Graph Data (Live)", 
            "GET", 
            "graph/data?source=live", 
            200
        )
        
        # Test graph stats
        self.run_test("Get Graph Stats", "GET", "graph/stats", 200)
        
        # Test graph generation (this is the core intelligence pipeline)
        self.log("🧠 Testing NLP+LLM Pipeline (Graph Generation)...")
        success_gen, gen_response = self.run_test(
            "Generate Knowledge Graph", 
            "POST", 
            "graph/generate?days=30&use_llm=true", 
            200
        )
        
        if success_gen:
            self.log(f"   Graph generated successfully!")
            self.log(f"   Stats: {gen_response.get('stats', {})}")
            self.log(f"   Nodes: {gen_response.get('node_count', 0)}")
            self.log(f"   Edges: {gen_response.get('edge_count', 0)}")
        else:
            self.log("   Graph generation failed - this is a critical feature!")
        
        return success_db or success_live

    def test_feed_interactions(self):
        """Test feed interaction endpoints"""
        self.log("=== FEED INTERACTIONS TESTS ===")
        
        if not self.token:
            self.log("⚠️  Skipping interaction tests - no auth token")
            return True
        
        # Get user interactions
        self.run_test("Get User Interactions", "GET", "feed/interactions", 200)
        
        return True

    def run_all_tests(self):
        """Run comprehensive test suite"""
        self.log("🚀 Starting Sense Backend API Test Suite")
        self.log(f"   Base URL: {self.base_url}")
        
        start_time = time.time()
        
        # Run tests in logical order
        self.test_health_check()
        
        # Seed videos first (required for other tests)
        videos_seeded = self.test_admin_seed_videos()
        
        # Test video and feed APIs
        self.test_videos_api()
        self.test_feed_api()
        
        # Test auth-dependent APIs (will skip if no auth)
        self.test_auth_flow()
        self.test_interests_api()
        self.test_graph_api()
        self.test_feed_interactions()
        
        # Summary
        end_time = time.time()
        duration = end_time - start_time
        
        self.log("=" * 50)
        self.log("🏁 TEST SUITE COMPLETE")
        self.log(f"   Duration: {duration:.2f} seconds")
        self.log(f"   Tests Run: {self.tests_run}")
        self.log(f"   Tests Passed: {self.tests_passed}")
        self.log(f"   Tests Failed: {len(self.failed_tests)}")
        self.log(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test['expected']}, got {test['actual']}")
                self.log(f"   - {test['name']}: {error_msg}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = SenseAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())