# FEATURES.md - Telegram Support Bot with Guided Menus

**Scope**: Feature taxonomy for Telegram support bots with guided InlineKeyboard navigation, grounded in the Workforce Bot v2 milestone context (pt-br, guided menus, improved search).

**Creation date**: 2026-03-30
**Last updated**: 2026-03-30

---

## 1. Menu Tree Structures

### 1.1 Standard top-level categories (table stakes)

Support bots that use guided menus converge on 3-5 top-level options. The categories below represent what internal-tool support bots almost universally provide:

| Category label (pt-br) | Intent |
|------------------------|--------|
| Tirar Dúvida | Browse FAQ / KB by topic |
| Reportar Erro | Start guided error report |
| Acompanhar Chamado | Check status of open report |
| Falar com Humano | Escalation to agent |
| Avaliar Atendimento | Leave feedback on closed ticket |

Anything beyond 5 items at the root level is an anti-feature — Telegram InlineKeyboard rows render poorly with more than 3 buttons per row, and users abandon menus that require scrolling to find intent.

### 1.2 Submenu depth

- **2 levels is table stakes** (root + one level of categories).
- **3 levels is the practical maximum** before users lose navigation context. At level 3 users cannot recall where they came from without explicit breadcrumbs.
- Beyond 3 levels is an anti-feature.

### 1.3 Breadcrumb / current-location pattern

Telegram has no native breadcrumb. The de facto pattern is to prepend the current location as bold text at the top of the message body:

```
*Inicio > Tirar Duvida > Acesso e Login*

Escolha um topico:
```

This is table stakes for any menu deeper than 2 levels. Dependencies: requires tracking the navigation path in conversation state.

### 1.4 "Voltar" button placement

- Always last button in every inline keyboard that is not the root.
- Callback data pattern: `menu_back` or `menu_back:<previous_state_id>`.
- Anti-feature: using /cancel as the only back-navigation — it destroys all state and forces the user to restart.

---

## 2. Guided Error Reporting Flows

### 2.1 Information to collect, in order

The sequence matters. Collect in dependency order (each answer scopes the next):

1. **Functional area / module** — narrows subsequent questions. Options as inline buttons reduce free-text errors.
2. **Symptom type** — e.g., "não carrega", "dados incorretos", "erro de permissão". Inline buttons again.
3. **When it started** — "Hoje", "Ontem", "Há mais de 2 dias", "Não sei". Date ranges as buttons avoid parsing.
4. **Frequency** — "Sempre", "Às vezes", "Só uma vez".
5. **Error message or screenshot** (optional, free-text/photo) — ask only after the above are locked in; this is where free text adds value.
6. **Confirmation summary** — show collected data back and ask the user to confirm before creating the ticket.

### 2.2 Table stakes in error reporting flows

- At least steps 1–3 as guided choices (buttons), not free text.
- Confirmation step before submitting — users frequently mistype symptoms in step 5 and regret submitting.
- Ability to go back and change a previous answer before final submission.
- Unique report ID shown on confirmation.

### 2.3 Differentiators in error reporting flows

- **Pre-fill detection**: If user arrived via "Reportar Erro > [category]" from the KB browser, pre-fill the functional area automatically.
- **Duplicate detection**: Before creating the report, run a fast BM25 query with the collected symptom text and, if a match above threshold exists, show the KB article with "Isso resolve sua dúvida?" before opening the ticket. This reduces ticket volume.
- **Screenshot attachment**: Accept photo messages during step 5. Telegram delivers these as file_id references; store as attachment metadata on the report.
- **Severity estimation**: After step 4, the bot estimates severity (Baixo/Médio/Alto) and shows it to the user for confirmation before escalation decision.

### 2.4 Conversation state requirements

The guided flow needs these fields tracked per user per active report:

- `flow_step`: which step of the collection wizard the user is on.
- `collected_fields`: dict of answers gathered so far.
- `navigation_stack`: list of states enabling back-navigation.
- `active_flow`: discriminator between "error_report" and "faq_browse" so the handler routes correctly.

The existing `ConversationState` enum (IDLE, AWAITING_REPORT, AWAITING_VALIDATION_ANSWER, PROVIDING_GUIDANCE, ESCALATED) covers the post-classification path but not the pre-collection guided wizard. A new state `COLLECTING_REPORT_FIELDS` (or equivalent) and a field for `navigation_stack` are needed.

---

## 3. FAQ / Knowledge Base Browsing Patterns

### 3.1 Table stakes

- Category tree browsable by buttons (no typing required to reach an article).
- Each KB article rendered with: title, summary (max ~300 chars), "Ver mais" button if content is long (Telegram 4096-char message limit).
- After reading an article: "Isso resolveu?" with Yes/No. "Não" routes to error reporting pre-filled with the category.
- Search by keyword still available as fallback from within the menu ("Pesquisar" button).

### 3.2 Differentiators

- **Contextual suggestions**: After displaying an article, show 2–3 related article buttons ("Veja também").
- **Most-accessed articles first**: Order KB category lists by access count, not alphabetically. Simple and high-impact on resolution rate.
- **Article rating**: thumbs-up/thumbs-down inline button on each article. Cheap to implement; generates signal for improving KB.

### 3.3 Anti-features for KB browsing

- Sending the full article body as a single message — truncation leaves users confused. Always paginate or summarize with "Ver completo".
- Showing raw UUIDs or slugs as button labels.
- Requiring the user to remember and type a category name after already navigating to it via menu.

---

## 4. User Onboarding Flows

### 4.1 Table stakes

- `/start` shows the main menu immediately — not a wall of text explaining commands.
- First interaction shows the bot's scope ("Sou o assistente de suporte do Workforce") so the user knows what the bot handles.
- If user sends a free-text message outside a flow, respond with the main menu rather than "command not found".

### 4.2 Differentiators

- **First-time vs. returning detection**: On `/start`, check if the user has prior reports. If yes, show "Bem-vindo de volta, [nome]! Você tem X chamados abertos." with a shortcut button.
- **Inline tour**: On first `/start`, show a single message explaining the 3 main capabilities with inline buttons for each. The buttons immediately start the respective flow — no dead-end menus.

### 4.3 Anti-features

- Asking the user to register or provide name/email before they can report anything — internal tool bots already know who the user is via Telegram identity or should not require registration at all.
- Long onboarding copy that the user must scroll through before reaching the menu.

---

## 5. Feedback Collection Patterns

### 5.1 Table stakes

- Feedback prompt appears automatically after a flow ends (escalation confirmed OR KB article marked as resolved) — not only via `/feedback` command.
- 1–5 star rating as inline buttons (or 5 individual button rows).
- Optional free-text comment after rating: "Quer deixar um comentário?" with "Sim" / "Não" buttons before asking for text.
- Thank-you message that closes the loop.

### 5.2 When to trigger feedback

| Trigger event | Timing |
|---------------|--------|
| User confirms "Sim, resolvido" after KB article | Immediately inline |
| Escalation created and confirmed | After confirmation message |
| Report marked resolved by agent (webhook) | Proactive push message to user |

The third case (proactive push when agent resolves) is a differentiator — it closes the loop and gets higher response rates than asking at ticket creation.

### 5.3 Anti-features

- Asking for feedback mid-flow when the issue is still unresolved.
- Blocking further interaction until feedback is given ("You must rate before continuing").
- Using /feedback command as the only way to leave feedback.

---

## 6. Session Management and Conversation State

### 6.1 Table stakes

- State persists in memory per user_id across messages within a session.
- `/cancel` clears all state and returns to idle with a clear message.
- Stale state handling: if state is older than N hours (e.g., 4h) and user sends a new message, reset gracefully rather than resuming a dead flow.
- Concurrent flow protection: if user tries to start a new flow while one is active, prompt "Você tem um atendimento em andamento. Deseja continuar ou iniciar um novo?" with inline options.

### 6.2 Differentiators

- **Navigation stack**: Store the sequence of menu states the user traversed so "Voltar" can unwind correctly without hardcoding parent states in each handler.
- **Resumption on restart**: If the user sends `/start` mid-flow, do not silently discard progress. Offer "Retomar" or "Novo atendimento".
- **Flow discriminator**: Track which top-level flow is active (faq_browse, error_report, check_status) so the same callback handler can route correctly.

### 6.3 Current codebase gap

The existing `ConversationManager` uses in-memory dict. This means state is lost on pod restart (Docker Compose redeploy). For a corporate internal tool this is acceptable short-term but is a known technical debt item. Adding state persistence to PostgreSQL is a differentiator, not table stakes, for this milestone.

---

## 7. Quick Replies and Suggested Actions

### 7.1 What "quick replies" mean in Telegram

Telegram does not have WhatsApp-style quick reply bubbles. The equivalent is InlineKeyboardMarkup attached to a bot message. ReplyKeyboardMarkup (persistent keyboard) is the other option but is intrusive and adds visual noise — avoid for support flows.

### 7.2 Table stakes

- Every bot-initiated message in a guided flow has inline buttons for the expected responses — the user should never need to type in any menu-driven step.
- Dead ends are blocked: every terminal message has at least one action button ("Voltar ao Menu Principal", "Abrir Chamado", etc.).

### 7.3 Differentiators

- **Contextual shortcuts**: After a KB article that mentions a specific feature area, surface a button "Reportar problema nesta área" pre-filled with that category.
- **Recents shortcuts**: At the main menu, add a "Retomar chamado recente" button if the user has an open report less than 24h old.

### 7.4 Anti-features

- ReplyKeyboardMarkup as the primary navigation mechanism — it pollutes the user's keyboard area and is not dismissible by the bot once sent.
- Sending multiple separate messages rapidly (one per step) — Telegram may render them out of order under load. Prefer editing the existing message via `edit_message_text` + updated InlineKeyboard when staying in the same conceptual view.

---

## 8. Breadcrumb and Navigation Patterns

### 8.1 Design constraints imposed by Telegram

- Messages cannot be revised once the user has scrolled away (edit_message_text only works on the most recent message in practice).
- InlineKeyboard buttons can be updated by editing the message they are attached to.
- The idiomatic Telegram pattern for menus is: the bot sends a message with inline buttons; when a button is pressed, the bot edits that same message with new content and a new keyboard. This creates a "single pane" navigation experience.

### 8.2 Table stakes

- **Edit-in-place navigation**: Use `callback_query.edit_message_text()` to update content within the same message bubble, rather than sending a new message for every navigation step. Sending a new message on each button press floods the chat and is the #1 UX complaint in Telegram bots.
- **"Menu Principal" button**: Always available at any depth, immediately resets to root.
- **Breadcrumb text in message body**: `*Inicio > Categoria > Subcategoria*` at the top of each navigated-to message.

### 8.3 Differentiators

- **Stateful back navigation**: Track the full navigation path and "Voltar" unwinds one step at a time, not just to root.
- **Persistent shortcut row**: Keep a fixed bottom row on all menus with [Menu Principal | Cancelar]. Consistent position trains muscle memory.

### 8.4 Implementation note

`callback_query.answer()` must be called for every CallbackQuery to dismiss the loading spinner on the Telegram client. Failing to call it leaves buttons in a "loading" state permanently — this is a common bug.

---

## 9. Feature Taxonomy Summary

### Table stakes (must-have, users leave without these)

1. Main menu appears on `/start` — no command-line knowledge required.
2. All user-facing text in pt-br with professional, cordial tone.
3. InlineKeyboard for all guided steps — no typing in menu flows.
4. "Voltar" button at every non-root level.
5. "Menu Principal" button always reachable.
6. Edit-in-place navigation (edit_message_text, not flood with new messages).
7. Breadcrumb text in message header.
8. Guided error report collects: area, symptom, timing, frequency before creating ticket.
9. Confirmation step before submitting report (show collected data, confirm).
10. KB browsable by category tree.
11. After KB article: "Isso resolveu?" inline prompt.
12. Feedback collected after flow completion, inline, not only via command.
13. Stale-state graceful reset (time-based or on `/start`).
14. Free-text outside flow routes to main menu, not "unknown command".

### Differentiators (competitive advantage, not mandatory for launch)

1. Duplicate detection before creating a ticket (BM25 match + "Isso resolve?" prompt).
2. Pre-fill category when arriving at error report from KB article.
3. Contextual "Veja também" related article suggestions.
4. Most-accessed KB articles ranked first within categories.
5. Per-article thumbs-up/thumbs-down rating.
6. First-time vs. returning user detection in `/start`.
7. Navigation stack for true N-level back-navigation (vs. simple parent reference).
8. Proactive feedback prompt when agent closes ticket (requires webhook or polling).
9. State persistence to PostgreSQL (survives pod restarts).
10. Screenshot/photo attachment support in error report flow.

### Anti-features (deliberately NOT build)

1. **Deep menu trees (>3 levels)** — users lose context and abandon.
2. **ReplyKeyboardMarkup as navigation** — clutters chat, not dismissible.
3. **New message per navigation step** — floods chat history.
4. **Free-text required in guided flows** — defeats the purpose of guided menus.
5. **Blocking on feedback** — never require feedback before continuing.
6. **Registration/authentication gates** — internal tool; Telegram identity is sufficient.
7. **Multilingual support (en/es)** — explicitly out of scope; adds complexity with no current user need.
8. **Web admin panel** — out of scope this milestone; adds deployment surface for no user-facing gain.
9. **Storing full conversation text client-side** — memory leak; existing in-memory state is already a known debt.
10. **Silent error swallowing** — every error must surface a user-friendly message with a recovery action button.

---

## 10. Dependency Map

```
edit-in-place navigation
  └── requires: CallbackQueryHandler, answer() on every query

breadcrumb text
  └── requires: navigation_stack in conversation state

"Voltar" N levels deep
  └── requires: navigation_stack (not just parent reference)

guided error report wizard
  └── requires: new ConversationState (COLLECTING_REPORT_FIELDS)
  └── requires: collected_fields dict in UserConversationState
  └── requires: navigation_stack

duplicate detection before ticket creation
  └── requires: BM25 search at end of wizard (already exists)
  └── requires: confidence threshold config

KB category browsing
  └── requires: categories indexed/tagged in KB documents
  └── requires: KBDocumentRepository.list_by_category() query

proactive feedback after agent closes ticket
  └── requires: webhook from ticket system or polling job
  └── requires: bot.send_message() with stored chat_id (not just reply)
  └── NOT required for v2 launch
```

---

*Last updated: 2026-03-30*
