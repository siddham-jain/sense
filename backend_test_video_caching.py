#!/usr/bin/env python3
"""
Sense Video Caching & Feed Testing Suite
Tests the new video caching system, personalized feed, and YouTube Shorts integration.
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

class SenseVideoCachingTester:
    def __init__(self, base_url: str = "https://knowledgegraph-1.preview.emergentagent.com"):
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
                self.log(f"   Response: {response.text[:300]}...")
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
        success1, _ = self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health endpoint
        success2, _ = self.run_test("Health Check", "GET", "health", 200)
        
        return success1 and success2

    def test_personalized_feed_endpoint(self):
        """Test the new personalized feed endpoint"""
        self.log("=== PERSONALIZED FEED TESTS ===")
        
        # Test personalized feed without auth (should work but return empty/onboarding message)
        success1, feed_data = self.run_test(
            "Personalized Feed (No Auth)", 
            "GET", 
            "feed/personalized?limit=20&include_youtube=true", 
            200
        )
        
        if success1:
            self.log(f"   Feed response keys: {list(feed_data.keys())}")
            if 'needs_onboarding' in feed_data:
                self.log(f"   Needs onboarding: {feed_data['needs_onboarding']}")
            if 'videos' in feed_data:
                self.log(f"   Videos count: {len(feed_data['videos'])}")
        
        return success1

    def test_cache_stats_endpoint(self):
        """Test the cache stats endpoint"""
        self.log("=== CACHE STATS TESTS ===")
        
        # Test cache stats without auth (should fail with 401)
        success1, _ = self.run_test(
            "Cache Stats (No Auth)", 
            "GET", 
            "feed/cache-stats", 
            401
        )
        
        return success1

    def test_background_generation_endpoint(self):
        """Test the background generation endpoint"""
        self.log("=== BACKGROUND GENERATION TESTS ===")
        
        # Test background generation without auth (should fail with 401)
        success1, _ = self.run_test(
            "Background Generation (No Auth)", 
            "POST", 
            "feed/generate-background?count=3", 
            401
        )
        
        return success1

    def test_user_interests_endpoint(self):
        """Test the user interests endpoints"""
        self.log("=== USER INTERESTS TESTS ===")
        
        # Test get user interests without auth (should fail with 401)
        success1, _ = self.run_test(
            "Get User Interests (No Auth)", 
            "GET", 
            "user/interests", 
            401
        )
        
        # Test save user interests without auth (should fail with 401)
        test_interests = {
            "interests": [
                {"topic_slug": "ai", "topic_name": "AI", "weight": 1.0},
                {"topic_slug": "technology", "topic_name": "Technology", "weight": 1.0}
            ]
        }
        
        success2, _ = self.run_test(
            "Save User Interests (No Auth)", 
            "POST", 
            "user/interests", 
            401,
            data=test_interests
        )
        
        return success1 and success2

    def test_video_generation_endpoint(self):
        """Test the video generation endpoint"""
        self.log("=== VIDEO GENERATION TESTS ===")
        
        # Test video generation without auth (should fail with 401)
        success1, _ = self.run_test(
            "Generate Videos (No Auth)", 
            "POST", 
            "videos/generate", 
            401,
            data={"count": 3}
        )
        
        return success1

    def test_knowledge_graph_endpoints(self):
        """Test knowledge graph endpoints for improved sensitivity"""
        self.log("=== KNOWLEDGE GRAPH TESTS ===")
        
        # Test graph data endpoint without auth (should fail with 401)
        success1, _ = self.run_test(
            "Get Graph Data (No Auth)", 
            "GET", 
            "graph/data?source=db", 
            401
        )
        
        # Test graph generation without auth (should fail with 401)
        success2, _ = self.run_test(
            "Generate Graph (No Auth)", 
            "POST", 
            "graph/generate?days=30&use_llm=true", 
            401
        )
        
        return success1 and success2

    def test_feed_interactions_endpoint(self):
        """Test feed interactions endpoint"""
        self.log("=== FEED INTERACTIONS TESTS ===")
        
        # Test get interactions without auth (should fail with 401)
        success1, _ = self.run_test(
            "Get Feed Interactions (No Auth)", 
            "GET", 
            "feed/interactions", 
            401
        )
        
        # Test create interaction without auth (should fail with 401)
        test_interaction = {
            "video_id": "test-video-id",
            "action": "like",
            "value": {"timestamp": datetime.now().isoformat()}
        }
        
        success2, _ = self.run_test(
            "Create Feed Interaction (No Auth)", 
            "POST", 
            "feed/interactions", 
            401,
            data=test_interaction
        )
        
        return success1 and success2

    def test_basic_video_endpoints(self):
        """Test basic video endpoints that should work without auth"""
        self.log("=== BASIC VIDEO TESTS ===")
        
        # Test get videos (should work without auth)
        success1, videos_data = self.run_test("Get Videos", "GET", "videos", 200)
        
        if success1 and videos_data:
            self.log(f"   Found {len(videos_data)} videos")
            
            # Check if videos have required fields
            if len(videos_data) > 0:
                video = videos_data[0]
                required_fields = ['id', 'title', 'src', 'provider', 'topics']
                missing_fields = [field for field in required_fields if field not in video]
                
                if missing_fields:
                    self.log(f"   ⚠️  Missing fields in video: {missing_fields}")
                else:
                    self.log(f"   ✅ Video structure looks good")
                    self.log(f"   Sample video: {video.get('title', 'No title')}")
        
        # Test basic feed endpoint (should work without auth)
        success2, feed_data = self.run_test("Get Basic Feed", "GET", "feed", 200)
        
        if success2:
            self.log(f"   Basic feed items: {len(feed_data) if isinstance(feed_data, list) else 'unknown'}")
        
        return success1 and success2

    def run_all_tests(self):
        """Run comprehensive test suite for video caching features"""
        self.log("🚀 Starting Sense Video Caching Test Suite")
        self.log(f"   Base URL: {self.base_url}")
        self.log("   Testing new features: Video Caching, Personalized Feed, YouTube Shorts")
        
        start_time = time.time()
        
        # Run tests in logical order
        health_ok = self.test_health_check()
        
        if not health_ok:
            self.log("❌ Health check failed - stopping tests")
            return False
        
        # Test basic endpoints that should work without auth
        self.test_basic_video_endpoints()
        
        # Test new video caching and feed endpoints
        self.test_personalized_feed_endpoint()
        
        # Test auth-protected endpoints (should return 401 without auth)
        self.test_cache_stats_endpoint()
        self.test_background_generation_endpoint()
        self.test_user_interests_endpoint()
        self.test_video_generation_endpoint()
        self.test_knowledge_graph_endpoints()
        self.test_feed_interactions_endpoint()
        
        # Summary
        end_time = time.time()
        duration = end_time - start_time
        
        self.log("=" * 60)
        self.log("🏁 VIDEO CACHING TEST SUITE COMPLETE")
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
        else:
            self.log("\n✅ ALL TESTS PASSED!")
        
        return len(self.failed_tests) == 0

def main():
    """Main test runner"""
    tester = SenseVideoCachingTester()
    
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