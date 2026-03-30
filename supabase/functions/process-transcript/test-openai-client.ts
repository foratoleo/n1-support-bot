/**
 * Test file for OpenAI Client Module
 * Demonstrates usage patterns and error handling
 */

import { 
  OpenAIClient, 
  OpenAIRequestConfig,
  OpenAIErrorType,
  getOpenAIClient 
} from './openai-client.ts';

// ============================================================================
// Test Cases
// ============================================================================

async function testBasicCompletion() {
  console.log('\n=== Testing Basic Completion ===');
  
  const client = getOpenAIClient();
  
  const response = await client.createCompletion(
    'What are the key components of a robust API integration?',
    {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
      enableLogging: true
    }
  );
  
  if (response.success) {
    console.log('✅ Success:', response.data?.substring(0, 200) + '...');
    console.log('Token usage:', response.usage);
    console.log('Performance:', response.performance);
  } else {
    console.log('❌ Error:', response.error);
  }
}

async function testStreamingCompletion() {
  console.log('\n=== Testing Streaming Completion ===');
  
  const client = new OpenAIClient();
  
  try {
    const stream = client.streamCompletion(
      'Write a short story about API integration',
      {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 200
      }
    );
    
    console.log('Streaming response:');
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    console.log('\n✅ Stream completed');
  } catch (error) {
    console.log('❌ Stream error:', error);
  }
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  const client = new OpenAIClient();
  
  // Test with invalid API key
  const invalidClient = new OpenAIClient('invalid-key');
  
  const response = await invalidClient.createCompletion(
    'This should fail',
    {
      maxRetries: 1,
      enableLogging: true
    }
  );
  
  if (!response.success) {
    console.log('✅ Error correctly caught:');
    console.log('  Type:', response.error?.type);
    console.log('  Message:', response.error?.message);
    console.log('  Retryable:', response.error?.retryable);
  }
}

async function testRateLimiting() {
  console.log('\n=== Testing Rate Limit Awareness ===');
  
  const client = getOpenAIClient();
  
  // Check current rate limit state
  const rateLimitState = client.getRateLimitState();
  console.log('Current rate limit state:', rateLimitState);
  
  // Make multiple requests to test rate limiting
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      client.createCompletion(
        `Test request ${i + 1}`,
        {
          model: 'gpt-4o-mini',
          maxTokens: 50,
          enableLogging: false
        }
      )
    );
  }
  
  const results = await Promise.allSettled(promises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      console.log(`✅ Request ${index + 1} succeeded`);
    } else {
      console.log(`❌ Request ${index + 1} failed`);
    }
  });
  
  // Check rate limit state after requests
  const newRateLimitState = client.getRateLimitState();
  console.log('Updated rate limit state:', newRateLimitState);
}

async function testCircuitBreaker() {
  console.log('\n=== Testing Circuit Breaker ===');
  
  const client = new OpenAIClient();
  
  // Check initial circuit breaker state
  const initialState = client.getCircuitBreakerState();
  console.log('Initial circuit breaker state:', initialState);
  
  // Simulate failures to trigger circuit breaker
  // In real scenario, this would happen with actual API failures
  
  // Make a normal request
  const response = await client.createCompletion(
    'Test circuit breaker',
    {
      model: 'gpt-4o-mini',
      maxTokens: 50,
      maxRetries: 0
    }
  );
  
  if (response.success) {
    console.log('✅ Request succeeded, circuit breaker remains closed');
  }
  
  // Check circuit breaker state
  const finalState = client.getCircuitBreakerState();
  console.log('Final circuit breaker state:', finalState);
}

async function testEmbeddings() {
  console.log('\n=== Testing Embeddings ===');
  
  const client = getOpenAIClient();
  
  const texts = [
    'OpenAI API integration best practices',
    'Error handling and retry logic',
    'Rate limiting and circuit breakers'
  ];
  
  const response = await client.createEmbedding(texts);
  
  if (response.success && response.data) {
    console.log('✅ Embeddings generated:');
    console.log('  Number of embeddings:', response.data.length);
    console.log('  Embedding dimensions:', response.data[0]?.length);
    console.log('  Token usage:', response.usage);
  } else {
    console.log('❌ Embedding error:', response.error);
  }
}

async function testTokenEstimation() {
  console.log('\n=== Testing Token Estimation ===');
  
  const client = new OpenAIClient();
  
  const testTexts = [
    'Short text',
    'This is a medium length text that contains more words and should use more tokens',
    'This is a very long text that contains many words and sentences. It discusses various topics including API integration, error handling, retry logic, rate limiting, circuit breakers, and many other technical concepts that are important for building robust systems. The text continues with more details about implementation patterns, best practices, security considerations, and performance optimization strategies.'
  ];
  
  testTexts.forEach(text => {
    const estimated = client.estimateTokens(text);
    console.log(`Text length: ${text.length} chars → Estimated tokens: ${estimated}`);
  });
}

async function testComplexWorkflow() {
  console.log('\n=== Testing Complex Workflow ===');
  
  const client = getOpenAIClient();
  
  // Step 1: Generate a plan
  console.log('Step 1: Generating plan...');
  const planResponse = await client.createCompletion(
    'Create a plan for implementing OpenAI API integration',
    {
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 300,
      systemPrompt: 'You are a technical architect. Be concise and structured.'
    }
  );
  
  if (!planResponse.success) {
    console.log('❌ Failed to generate plan:', planResponse.error);
    return;
  }
  
  console.log('✅ Plan generated');
  
  // Step 2: Generate code based on plan
  console.log('Step 2: Generating implementation...');
  const codeResponse = await client.createCompletion(
    `Based on this plan, generate TypeScript code:\n${planResponse.data}`,
    {
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 500,
      systemPrompt: 'You are a senior developer. Generate clean, production-ready TypeScript code.'
    }
  );
  
  if (!codeResponse.success) {
    console.log('❌ Failed to generate code:', codeResponse.error);
    return;
  }
  
  console.log('✅ Implementation generated');
  
  // Step 3: Generate tests
  console.log('Step 3: Generating tests...');
  const testResponse = await client.createCompletion(
    'Generate unit tests for the OpenAI integration',
    {
      model: 'gpt-4o-mini', // Use cheaper model for tests
      temperature: 0.3,
      maxTokens: 300
    }
  );
  
  if (!testResponse.success) {
    console.log('❌ Failed to generate tests:', testResponse.error);
    return;
  }
  
  console.log('✅ Tests generated');
  
  // Calculate total usage
  const totalTokens = 
    (planResponse.usage?.totalTokens || 0) +
    (codeResponse.usage?.totalTokens || 0) +
    (testResponse.usage?.totalTokens || 0);
  
  const totalCost = 
    (planResponse.usage?.estimatedCost || 0) +
    (codeResponse.usage?.estimatedCost || 0) +
    (testResponse.usage?.estimatedCost || 0);
  
  console.log('\n📊 Workflow Summary:');
  console.log(`  Total tokens used: ${totalTokens}`);
  console.log(`  Estimated cost: $${totalCost.toFixed(4)}`);
  console.log(`  Total time: ${
    (planResponse.performance?.requestTime || 0) +
    (codeResponse.performance?.requestTime || 0) +
    (testResponse.performance?.requestTime || 0)
  }ms`);
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('🚀 OpenAI Client Test Suite');
  console.log('=' .repeat(50));
  
  try {
    // Run tests in sequence to avoid rate limiting
    await testBasicCompletion();
    await testStreamingCompletion();
    await testErrorHandling();
    await testRateLimiting();
    await testCircuitBreaker();
    await testEmbeddings();
    await testTokenEstimation();
    await testComplexWorkflow();
    
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runTests();
}