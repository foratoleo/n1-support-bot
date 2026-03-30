/**
 * Validation Tests for api-rag-search Edge Function
 *
 * This file tests the request validation logic for the api-rag-search
 * Edge Function to ensure proper handling of valid and invalid requests.
 *
 * Test Coverage:
 * - Valid requests with all fields
 * - Valid requests with only required fields
 * - Missing required fields
 * - Empty/whitespace queries
 * - Invalid UUID format for projectId
 * - Invalid sourceTable values
 * - Invalid searchMode values
 * - Pagination bounds (limit 1-100, offset >= 0)
 * - ContentTypes array validation
 *
 * Run tests:
 * npm test -- --run "supabase/functions/api-rag-search/__tests__/validation.test.ts"
 */

import { describe, it, expect } from 'vitest';
import {
  validateRequest,
  VALID_SOURCE_TABLES,
  VALID_SEARCH_MODES,
  QUERY_MAX_LENGTH,
  LIMIT_MIN,
  LIMIT_MAX,
  OFFSET_MIN,
} from '../types.ts';

// ============================================================================
// Test Suite 1: Valid Requests
// ============================================================================

describe('Validation - Valid Requests', () => {
  it('valid request with all fields', () => {
    const body = {
      query: 'authentication issues in login flow',
      projectId: '123e4567-e89b-42d3-a456-426614174000',
      sourceTable: 'features',
      contentTypes: ['bug', 'feature'],
      searchMode: 'semantic',
      limit: 20,
      offset: 10,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request).toBeDefined();

    const request = result.request!;
    expect(request.query).toBe('authentication issues in login flow');
    expect(request.projectId).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(request.sourceTable).toBe('features');
    expect(request.contentTypes).toEqual(['bug', 'feature']);
    expect(request.searchMode).toBe('semantic');
    expect(request.limit).toBe(20);
    expect(request.offset).toBe(10);
  });

  it('valid request with only required fields', () => {
    const body = {
      query: 'how to implement authentication',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request).toBeDefined();

    const request = result.request!;
    expect(request.query).toBe('how to implement authentication');
    expect(request.projectId).toBeUndefined();
    expect(request.sourceTable).toBeUndefined();
    expect(request.contentTypes).toBeUndefined();
    expect(request.searchMode).toBeUndefined();
    expect(request.limit).toBeUndefined();
    expect(request.offset).toBeUndefined();
  });

  it('valid request with mixed optional fields', () => {
    const body = {
      query: 'sprint planning',
      projectId: '550e8400-e29b-44d4-a716-446655440000',
      limit: 50,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request).toBeDefined();

    const request = result.request!;
    expect(request.query).toBe('sprint planning');
    expect(request.projectId).toBe('550e8400-e29b-44d4-a716-446655440000');
    expect(request.limit).toBe(50);
    expect(request.sourceTable).toBeUndefined();
  });
});

// ============================================================================
// Test Suite 2: Missing Required Fields
// ============================================================================

describe('Validation - Missing Required Fields', () => {
  it('missing query returns clear error', () => {
    const body = {
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      limit: 10,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('query');
  });

  it('empty body returns error', () => {
    const body = {};

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// Test Suite 3: Empty/Whitespace Query
// ============================================================================

describe('Validation - Empty/Whitespace Query', () => {
  it('empty query string returns error', () => {
    const body = {
      query: '',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('query');
    expect(result.error).toContain('empty');
  });

  it('whitespace-only query returns error', () => {
    const body = {
      query: '   \t\n   ',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('query');
    expect(result.error).toContain('whitespace');
  });

  it('query is trimmed during validation', () => {
    const body = {
      query: '  authentication  ',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request).toBeDefined();
    expect(result.request!.query).toBe('authentication');
  });
});

// ============================================================================
// Test Suite 4: projectId Validation
// ============================================================================

describe('Validation - projectId', () => {
  it('invalid projectId format returns UUID error', () => {
    const body = {
      query: 'test query',
      projectId: 'not-a-uuid',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('projectId');
    expect(result.error).toContain('UUID');
  });

  it('projectId with invalid format returns error', () => {
    const body = {
      query: 'test query',
      projectId: '12345-short',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('projectId');
  });

  it('valid UUID v4 projectId passes', () => {
    const body = {
      query: 'test query',
      projectId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request).toBeDefined();
    expect(result.request!.projectId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });
});

// ============================================================================
// Test Suite 5: sourceTable Validation
// ============================================================================

describe('Validation - sourceTable', () => {
  it('invalid sourceTable returns list of valid options', () => {
    const body = {
      query: 'test query',
      sourceTable: 'invalid_table',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('sourceTable');
    expect(result.error).toContain('invalid_table');

    // Verify all valid tables are listed in error message
    VALID_SOURCE_TABLES.forEach((table) => {
      expect(result.error).toContain(table);
    });
  });

  it('valid sourceTable values pass', () => {
    const validTables = VALID_SOURCE_TABLES;

    for (const table of validTables) {
      const body = {
        query: 'test query',
        sourceTable: table,
      };

      const result = validateRequest(body);
      expect(result.valid).toBe(true);
      expect(result.request!.sourceTable).toBe(table);
    }
  });
});

// ============================================================================
// Test Suite 6: searchMode Validation
// ============================================================================

describe('Validation - searchMode', () => {
  it('invalid searchMode returns list of valid options', () => {
    const body = {
      query: 'test query',
      searchMode: 'invalid_mode',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('searchMode');
    expect(result.error).toContain('invalid_mode');

    // Verify all valid modes are listed in error message
    VALID_SEARCH_MODES.forEach((mode) => {
      expect(result.error).toContain(mode);
    });
  });

  it('valid searchMode values pass', () => {
    const validModes = VALID_SEARCH_MODES;

    for (const mode of validModes) {
      const body = {
        query: 'test query',
        searchMode: mode,
      };

      const result = validateRequest(body);
      expect(result.valid).toBe(true);
      expect(result.request!.searchMode).toBe(mode);
    }
  });
});

// ============================================================================
// Test Suite 7: Pagination Validation - limit
// ============================================================================

describe('Validation - limit', () => {
  it('limit below minimum returns error', () => {
    const body = {
      query: 'test query',
      limit: 0,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('limit');
    expect(result.error).toMatch(/at least|minimum/i);
  });

  it('limit negative returns error', () => {
    const body = {
      query: 'test query',
      limit: -1,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('limit');
  });

  it('limit above maximum returns error', () => {
    const body = {
      query: 'test query',
      limit: 101,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('limit');
    expect(result.error).toContain('100');
  });

  it('limit at minimum boundary passes', () => {
    const body = {
      query: 'test query',
      limit: LIMIT_MIN,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.limit).toBe(LIMIT_MIN);
  });

  it('limit at maximum boundary passes', () => {
    const body = {
      query: 'test query',
      limit: LIMIT_MAX,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.limit).toBe(LIMIT_MAX);
  });

  it('limit must be integer', () => {
    const body = {
      query: 'test query',
      limit: 10.5,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('limit');
    expect(result.error).toMatch(/integer/);
  });
});

// ============================================================================
// Test Suite 8: Pagination Validation - offset
// ============================================================================

describe('Validation - offset', () => {
  it('offset negative returns error', () => {
    const body = {
      query: 'test query',
      offset: -1,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('offset');
  });

  it('offset at minimum boundary passes', () => {
    const body = {
      query: 'test query',
      offset: OFFSET_MIN,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.offset).toBe(OFFSET_MIN);
  });

  it('offset large value passes', () => {
    const body = {
      query: 'test query',
      offset: 1000,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.offset).toBe(1000);
  });

  it('offset must be integer', () => {
    const body = {
      query: 'test query',
      offset: 5.5,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('offset');
    expect(result.error).toMatch(/integer/);
  });
});

// ============================================================================
// Test Suite 9: contentTypes Validation
// ============================================================================

describe('Validation - contentTypes', () => {
  it('contentTypes must be array if provided', () => {
    const body = {
      query: 'test query',
      contentTypes: 'not-an-array',
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('contentTypes');
    expect(result.error).toContain('array');
  });

  it('contentTypes with valid strings passes', () => {
    const body = {
      query: 'test query',
      contentTypes: ['bug', 'feature', 'enhancement'],
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.contentTypes).toEqual(['bug', 'feature', 'enhancement']);
  });

  it('contentTypes empty array passes', () => {
    const body = {
      query: 'test query',
      contentTypes: [],
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.contentTypes).toEqual([]);
  });

  it('contentTypes with non-string element returns error', () => {
    const body = {
      query: 'test query',
      contentTypes: ['valid', 123, 'also-valid'],
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('contentTypes');
    expect(result.error).toContain('string');
  });
});

// ============================================================================
// Test Suite 10: Body Structure Validation
// ============================================================================

describe('Validation - Body Structure', () => {
  it('null body returns error', () => {
    const result = validateRequest(null);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('array body returns error', () => {
    const body = [{ query: 'test' }];

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('object');
  });

  it('string body returns error', () => {
    const body = '{"query": "test"}';

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// Test Suite 11: Query Length Validation
// ============================================================================

describe('Validation - Query Length', () => {
  it('query at max length passes', () => {
    const maxQuery = 'a'.repeat(QUERY_MAX_LENGTH);
    const body = {
      query: maxQuery,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(true);
    expect(result.request!.query.length).toBe(QUERY_MAX_LENGTH);
  });

  it('query exceeding max length returns error', () => {
    const tooLongQuery = 'a'.repeat(QUERY_MAX_LENGTH + 1);
    const body = {
      query: tooLongQuery,
    };

    const result = validateRequest(body);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('query');
    expect(result.error).toContain(String(QUERY_MAX_LENGTH));
  });
});

// ============================================================================
// Test Suite 12: Constants Verification
// ============================================================================

describe('Validation - Constants', () => {
  it('all valid sourceTable values', () => {
    const expectedTables = ['features', 'backlog_items', 'generated_documents', 'meeting_transcripts', 'sprints'];
    expect(VALID_SOURCE_TABLES).toEqual(expectedTables);
  });

  it('all valid searchMode values', () => {
    const expectedModes = ['semantic', 'keyword', 'hybrid'];
    expect(VALID_SEARCH_MODES).toEqual(expectedModes);
  });

  it('constants are correctly defined', () => {
    expect(QUERY_MAX_LENGTH).toBe(10000);
    expect(LIMIT_MIN).toBe(1);
    expect(LIMIT_MAX).toBe(100);
    expect(OFFSET_MIN).toBe(0);
  });
});
