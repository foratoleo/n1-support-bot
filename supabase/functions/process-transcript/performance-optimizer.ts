interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number;
  hits: number;
}

interface PerformanceMetrics {
  avgProcessingTime: number;
  totalRequests: number;
  cacheHitRate: number;
  tokenUsage: number;
  errorRate: number;
}

export class PerformanceOptimizer {
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: PerformanceMetrics = {
    avgProcessingTime: 0,
    totalRequests: 0,
    cacheHitRate: 0,
    tokenUsage: 0,
    errorRate: 0
  };
  private maxCacheSize = 100; // Maximum number of cache entries
  private defaultTTL = 3600 * 1000; // 1 hour in milliseconds

  /**
   * Generate cache key from transcript and context
   */
  generateCacheKey(transcript: string, context: any): string {
    const hash = this.simpleHash(transcript + JSON.stringify(context));
    return `doc_${hash}`;
  }

  /**
   * Check if cached result exists and is valid
   */
  getCachedResult(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    
    // Update cache hit rate metric
    this.updateCacheHitRate(true);
    
    return entry.value;
  }

  /**
   * Store result in cache with TTL
   */
  setCachedResult(key: string, value: any, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      key,
      value,
      expiresAt,
      hits: 0
    });

    this.updateCacheHitRate(false);
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLeastRecentlyUsed(): void {
    let minHits = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }
  }

  /**
   * Simple hash function for cache key generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update cache hit rate metric
   */
  private updateCacheHitRate(isHit: boolean): void {
    const totalAttempts = this.metrics.totalRequests + 1;
    const hits = isHit ? 
      (this.metrics.cacheHitRate * this.metrics.totalRequests) + 1 :
      (this.metrics.cacheHitRate * this.metrics.totalRequests);
    
    this.metrics.cacheHitRate = hits / totalAttempts;
  }

  /**
   * Record processing metrics
   */
  recordMetrics(processingTime: number, tokensUsed: number, isError: boolean): void {
    // Update average processing time
    const totalTime = this.metrics.avgProcessingTime * this.metrics.totalRequests;
    this.metrics.totalRequests++;
    this.metrics.avgProcessingTime = (totalTime + processingTime) / this.metrics.totalRequests;
    
    // Update token usage
    this.metrics.tokenUsage += tokensUsed;
    
    // Update error rate
    if (isError) {
      const errors = this.metrics.errorRate * (this.metrics.totalRequests - 1);
      this.metrics.errorRate = (errors + 1) / this.metrics.totalRequests;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache and reset metrics
   */
  reset(): void {
    this.cache.clear();
    this.metrics = {
      avgProcessingTime: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      tokenUsage: 0,
      errorRate: 0
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; expiresIn: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      expiresIn: Math.max(0, entry.expiresAt - Date.now())
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: this.metrics.cacheHitRate,
      entries: entries.sort((a, b) => b.hits - a.hits)
    };
  }

  /**
   * Optimize prompt for token efficiency
   */
  optimizePrompt(prompt: string): string {
    // Remove excessive whitespace
    let optimized = prompt.replace(/\s+/g, ' ').trim();
    
    // Remove redundant instructions that might be in the system prompt
    const redundantPhrases = [
      'Please make sure to',
      'It is important that',
      'You must ensure that',
      'Remember to'
    ];
    
    redundantPhrases.forEach(phrase => {
      optimized = optimized.replace(new RegExp(phrase, 'gi'), '');
    });
    
    return optimized;
  }

  /**
   * Batch similar requests for processing
   */
  canBatch(request1: any, request2: any): boolean {
    // Check if requests have similar context
    if (request1.context?.name !== request2.context?.name) {
      return false;
    }
    
    // Check if transcripts are of similar length (within 20%)
    const len1 = request1.transcript.length;
    const len2 = request2.transcript.length;
    const ratio = Math.min(len1, len2) / Math.max(len1, len2);
    
    return ratio > 0.8;
  }

  /**
   * Memory usage optimization
   */
  optimizeMemory(): void {
    // Clear expired cache entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    
    // Force garbage collection if available (Deno specific)
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();