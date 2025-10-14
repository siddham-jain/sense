#!/usr/bin/env python3
"""
Test the Intelligence Pipeline directly without authentication
This tests the core NLP + LLM functionality
"""

import sys
import os
sys.path.append('/app/backend')

from intelligence.pipeline import IntelligencePipeline
import asyncio
from datetime import datetime, timezone, timedelta
import json

async def test_intelligence_pipeline():
    """Test the intelligence pipeline with mock browsing history"""
    print("🧠 Testing Intelligence Pipeline (NLP + LLM)...")
    
    try:
        # Create pipeline instance
        pipeline = IntelligencePipeline()
        print("✅ Pipeline initialized successfully")
        
        # Create mock browsing history data
        now = datetime.now(timezone.utc)
        mock_history = [
            {
                "id": "1",
                "user_id": "test-user",
                "url": "https://arxiv.org/abs/2023.12345",
                "domain": "arxiv.org",
                "title": "Attention Is All You Need: Transformer Architecture",
                "content": {
                    "text": "The Transformer architecture has revolutionized natural language processing. This paper introduces the attention mechanism that allows models to focus on relevant parts of the input sequence. The multi-head attention mechanism enables the model to attend to information from different representation subspaces."
                },
                "entities": ["Transformer", "attention mechanism", "natural language processing", "multi-head attention"],
                "keyphrases": ["transformer architecture", "attention mechanism", "neural networks", "deep learning"],
                "dwell_ms": 45000,
                "created_at": (now - timedelta(days=1)).isoformat()
            },
            {
                "id": "2", 
                "user_id": "test-user",
                "url": "https://openai.com/blog/gpt-4",
                "domain": "openai.com",
                "title": "GPT-4: Large Language Model Capabilities",
                "content": {
                    "text": "GPT-4 is a large multimodal model that can accept image and text inputs and produce text outputs. It exhibits human-level performance on various professional and academic benchmarks. The model demonstrates improved reasoning capabilities and reduced hallucinations compared to previous versions."
                },
                "entities": ["GPT-4", "OpenAI", "large language model", "multimodal"],
                "keyphrases": ["language model", "artificial intelligence", "machine learning", "text generation"],
                "dwell_ms": 60000,
                "created_at": (now - timedelta(days=2)).isoformat()
            },
            {
                "id": "3",
                "user_id": "test-user", 
                "url": "https://www.nature.com/articles/nature14539",
                "domain": "nature.com",
                "title": "Human-level control through deep reinforcement learning",
                "content": {
                    "text": "Deep reinforcement learning combines reinforcement learning with deep neural networks. This approach has achieved remarkable success in game playing, robotics, and autonomous systems. The Deep Q-Network (DQN) algorithm learns to play Atari games at superhuman levels."
                },
                "entities": ["deep reinforcement learning", "Deep Q-Network", "DQN", "Atari games"],
                "keyphrases": ["reinforcement learning", "deep learning", "neural networks", "game playing"],
                "dwell_ms": 30000,
                "created_at": (now - timedelta(days=3)).isoformat()
            },
            {
                "id": "4",
                "user_id": "test-user",
                "url": "https://pytorch.org/tutorials/",
                "domain": "pytorch.org", 
                "title": "PyTorch Deep Learning Framework",
                "content": {
                    "text": "PyTorch is a machine learning framework that provides tensor computation with GPU acceleration and automatic differentiation for building neural networks. It offers dynamic computational graphs and is widely used in research and production."
                },
                "entities": ["PyTorch", "tensor computation", "GPU acceleration", "neural networks"],
                "keyphrases": ["machine learning framework", "deep learning", "computational graphs", "automatic differentiation"],
                "dwell_ms": 25000,
                "created_at": (now - timedelta(days=4)).isoformat()
            }
        ]
        
        print(f"📊 Created mock browsing history with {len(mock_history)} entries")
        
        # Test user interests
        user_interests = ["AI", "Technology", "Machine Learning"]
        
        # Run the pipeline
        print("🔄 Running intelligence pipeline...")
        result = await pipeline.generate_graph(
            browsing_history=mock_history,
            user_interests=user_interests,
            days=30,
            use_llm=True
        )
        
        # Analyze results
        anchors = result.get('anchors', [])
        nodes = result.get('nodes', [])
        edges = result.get('edges', [])
        stats = result.get('stats', {})
        
        print(f"✅ Pipeline completed successfully!")
        print(f"📈 Results:")
        print(f"   - Anchors extracted: {len(anchors)}")
        print(f"   - Graph nodes: {len(nodes)}")
        print(f"   - Graph edges: {len(edges)}")
        print(f"   - LLM used: {stats.get('llm_used', False)}")
        
        # Show some sample anchors
        if anchors:
            print(f"\n🎯 Sample anchors:")
            for i, anchor in enumerate(anchors[:5]):
                print(f"   {i+1}. {anchor['text']} (type: {anchor['anchor_type']}, freq: {anchor['frequency']})")
        
        # Show some sample nodes
        if nodes:
            print(f"\n🔗 Sample nodes:")
            for i, node in enumerate(nodes[:5]):
                print(f"   {i+1}. {node['label']} (kind: {node.get('kind', 'unknown')})")
        
        # Show some sample edges
        if edges:
            print(f"\n🌐 Sample edges:")
            for i, edge in enumerate(edges[:3]):
                print(f"   {i+1}. {edge['source']} -> {edge['target']} (relation: {edge.get('relation', 'unknown')})")
        
        # Test success criteria
        success = (
            len(anchors) > 0 and
            len(nodes) > 0 and
            len(edges) > 0 and
            stats.get('llm_used', False)
        )
        
        if success:
            print(f"\n🎉 Intelligence pipeline test PASSED!")
            return True
        else:
            print(f"\n❌ Intelligence pipeline test FAILED!")
            return False
            
    except Exception as e:
        print(f"❌ Intelligence pipeline test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Main test runner"""
    print("🚀 Starting Intelligence Pipeline Tests")
    
    success = await test_intelligence_pipeline()
    
    if success:
        print("\n✅ All intelligence pipeline tests passed!")
        return 0
    else:
        print("\n❌ Intelligence pipeline tests failed!")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)