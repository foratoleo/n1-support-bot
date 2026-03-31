# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

### In-Memory State Management (Critical)
- **Issue:** ConversationManager uses in-memory dict (`_states: Dict[int, UserConversationState]`) for user state tracking
- **Files:** `src/bot/conversation_manager.py`
- **Impact:** All user conversation states are lost on bot restart. Users lose their place in workflows.
- **Fix approach:** Persist user state to database. Add `user_states` table with columns: `user_id`, `current_state`, `current_report_id`, `context` (JSONB), `updated_at`. Load state on user interaction, save after each state change.

### BM25 Re-Ranking Without Index Loading
- **Issue:** KnowledgeBaseSearcher rebuilds BM25 index in-memory for every search call (`_score_with_bm25plus` constructs corpus from DB rows each time)
- **Files:** `src/rag/knowledge_base.py` (lines 431-477)
- **Impact:** Performance degrades with large KB. O(n) corpus construction on every search.
- **Fix approach:** Load KB documents once at startup, build BM25 index in memory, refresh periodically or on KB updates.

### Silent Exception Handling
- **Issue:** Several places use bare `except Exception: pass` or catch-then-ignore patterns
- **Files:** 
  - `src/rag/knowledge_base.py` line 14 (NLTK import), line 105 (stemming), line 382 (BM25 fallback), line 553 (re-ranking)
  - `src/bot/_callback_handlers.py` lines 77, 347 (feedback prompts)
  - `src/bot/report_wizard.py` lines 391, 447, 467
- **Impact:** Silent failures hide bugs. Users see no feedback when operations fail.
- **Fix approach:** Replace silent catches with specific exception handling, log warnings/errors, provide user feedback where appropriate.

### Unused Code / Placeholder Handlers
- **Issue:** `handle_search_callback` in `_callback_handlers.py` is a no-op stub (line 137: `pass`)
- **Files:** `src/bot/_callback_handlers.py:124-137`
- **Impact:** Placeholder that was "to be expanded in Phase 7" - unclear if still planned
- **Fix approach:** Either implement inline search functionality or remove the placeholder.

### Empty Returns Without Context
- **Issue:** Multiple search methods return empty `[]` or `None` without indicating why
- **Files:** 
  - `src/rag/knowledge_base.py` lines 226, 387, 410, 575, 580
  - `src/bot/kb_browser.py` line 102
- **Impact:** No differentiation between "no results", "error", and "feature disabled"
- **Fix approach:** Create result wrapper with status enum: `SearchResult(success: bool, data: List, error: Optional[str])`

## Known Bugs

### UUID Conversion Risk
- **Issue:** Converting Telegram user_id (int) to UUID with `UUID(int=user_id)` can fail for large integers
- **Files:** 
  - `src/bot/handlers.py` line 115
  - `src/bot/_callback_handlers.py` lines 271-272
- **Trigger:** Telegram user IDs can exceed UUID's max value (2^128-1)
- **Workaround:** Store user_id as string in database instead of UUID, or use separate mapping table.

### Database Connection Not Initialized Before First Use
- **Issue:** `get_database_pool()` is called in handlers but pool may not be initialized if bot starts without running `init_database_pool()`
- **Files:** `src/database/connection.py` lines 151-165
- **Trigger:** Any handler that calls `get_database_pool()` before `main.py` completes initialization
- **Workaround:** Currently handled by main.py startup order, but fragile.

### Duplicate KB Documents Possible
- **Issue:** No validation prevents duplicate `file_path` entries at application level (only DB constraint)
- **Files:** `src/database/models.py` line 40 (`file_path` unique constraint exists, but no application-level check)
- **Trigger:** Seed script could fail silently on duplicate file paths
- **Workaround:** Database constraint catches it, but error message is unclear.

## Security Considerations

### API Keys in Environment Variables
- **Risk:** `TELEGRAM_BOT_TOKEN` and `OPENAI_API_KEY` are loaded from `.env` file
- **Files:** `src/config.py`
- **Current mitigation:** `.env` is gitignored
- **Recommendations:** 
  - Use Docker secrets or external secret manager in production
  - Validate env var presence at startup, not silently default to empty string

### No Input Sanitization on User Reports
- **Risk:** User-submitted `description` in reports is stored as-is
- **Files:** `src/bot/handlers.py` line 104, `src/database/repositories.py`
- **Current mitigation:** Text is displayed to users, no XSS in Telegram
- **Recommendations:** 
  - Add length limits to prevent DoS
  - Consider rate limiting report creation per user

### Hardcoded Model Names
- **Risk:** `gpt-4o` is hardcoded in multiple places for classification/re-ranking
- **Files:** 
  - `src/validation/classifier.py` line 256
  - `src/rag/knowledge_base.py` line 523
- **Current mitigation:** Uses configured base_url for API endpoint
- **Recommendations:** Make model name configurable per feature

## Performance Bottlenecks

### Large KB Loading on Every Search
- **Problem:** Each search fetches all matching documents from DB then re-scores in memory
- **Files:** `src/rag/knowledge_base.py` (lines 319-429)
- **Cause:** No caching, fetches full content even for large docs
- **Improvement path:** 
  - Add LRU cache for frequent queries
  - Paginate results from DB
  - Store pre-computed search vectors in DB

### Blocking I/O in Async Context
- **Problem:** `openai_client.chat.completions.create` is called synchronously in re-ranking
- **Files:** `src/rag/knowledge_base.py` lines 519-534
- **Cause:** Uses `run_in_executor` but still blocks thread pool
- **Improvement path:** Use `openai.AsyncOpenAI` client for true async

### No Connection Pool Warming
- **Problem:** First request after idle period is slow (cold pool)
- **Files:** `src/database/connection.py`
- **Cause:** `pool_pre_ping=True` but no warm-up on startup
- **Improvement path:** Run dummy query on startup after `pool.initialize()`

## Fragile Areas

### Callback Router Handler Matching
- **Issue:** Prefix matching in `route_callback` uses string `startswith` - can have false positives
- **Files:** `src/bot/callback_router.py` lines 94-97
- **Why fragile:** "search" prefix matches "search_article_123" vs "search:category" - order dependent
- **Safe modification:** Ensure prefixes are mutually exclusive or use exact match for leaf nodes

### State Machine Transitions Not Enforced
- **Issue:** `update_user_state` accepts any state with kwargs - no validation of valid transitions
- **Files:** `src/bot/conversation_manager.py` lines 116-136
- **Why fragile:** Code could set invalid states (e.g., COLLECTING_REPORT → ESCALATED without going through validation)
- **Safe modification:** Add transition validation matrix

### Import-Time Side Effects in Router
- **Issue:** `callback_router.py` imports modules at end of file to trigger registration decorators
- **Files:** `src/bot/callback_router.py` lines 109-112
- **Why fragile:** Circular import risk, order-dependent behavior
- **Safe modification:** Use explicit registration pattern or lazy imports

## Scaling Limits

### In-Memory Conversation State
- **Current capacity:** Limited by process memory - estimate ~10KB per user
- **Limit:** At ~10,000 concurrent users, could consume ~100MB+
- **Scaling path:** Database-backed state persistence required for horizontal scaling

### Database Connection Pool
- **Current capacity:** pool_size=10, max_overflow=20 (30 total)
- **Limit:** With blocking queries, ~30 concurrent DB operations
- **Scaling path:** 
  - Increase pool size cautiously
  - Add read replicas for heavy read workloads (KB search)
  - Consider connection pooling service (PgBouncer)

### Telegram API Rate Limits
- **Current capacity:** No explicit rate limiting in code
- **Limit:** Telegram's standard limits (~30 msg/sec to single user, bulk limits)
- **Scaling path:** Add message queuing, batch responses where possible

## Dependencies at Risk

### rank-bm25 (Optional but Used)
- **Risk:** External library for BM25 - version compatibility with Python 3.11+
- **Impact:** Would need to reimplement BM25 scoring or find alternative
- **Migration plan:** Already has fallback (inline scoring mentioned in comments), verify tests pass

### NLTK (Optional)
- **Risk:** Large download dependency (stemmer data)
- **Impact:** Graceful degradation with `_nltk_available = False` - search still works
- **Migration plan:** Consider spacy or smaller stemmer library

### python-telegram-bot
- **Risk:** Major version changes can break API
- **Impact:** Significant refactor needed on major version bump
- **Migration plan:** Pin to specific minor version, review changelog on updates

## Missing Critical Features

### No Retry Logic for External APIs
- **Problem:** Telegram API calls and OpenAI calls have no retry on transient failures
- **Files:** All handlers make API calls directly
- **Blocks:** Production reliability, particularly on network issues

### No Health Check Endpoint
- **Problem:** No way to verify bot is running correctly (DB connection, Telegram auth)
- **Files:** N/A
- **Blocks:** Container orchestration health checks, monitoring

### No Logging of Conversations
- **Problem:** `conversations` table exists but no handler adds messages during menu navigation
- **Files:** `src/database/repositories.py` - `ConversationRepository.add_message` exists but only called in `report_command`
- **Blocks:** Auditing, debugging user issues, analytics

## Test Coverage Gaps

### State Handlers Not Tested
- **What's not tested:** All state handlers in `src/bot/state_handlers/`
- **Files:** `awaiting_report.py`, `awaiting_kb_search.py`, `providing_guidance.py`, `awaiting_validation.py`, etc.
- **Risk:** Logic errors in menu navigation go undetected
- **Priority:** High

### Callback Handlers Have Minimal Tests
- **What's not tested:** Most callback handlers in `_callback_handlers.py`
- **Files:** Menu navigation, escalation triggers, search callbacks
- **Risk:** Broken menu navigation, wrong state transitions
- **Priority:** High

### Integration Tests Missing
- **What's not tested:** Full conversation flows (start → menu → report → validation → guidance)
- **Files:** N/A
- **Risk:** State management bugs, database transaction issues
- **Priority:** Medium

### RAG Search Quality Not Measured
- **What's not tested:** Search relevance, re-ranking effectiveness
- **Files:** `src/rag/knowledge_base.py`
- **Risk:** Degraded search quality without detection
- **Priority:** Medium

---

*Concerns audit: 2026-03-31*
