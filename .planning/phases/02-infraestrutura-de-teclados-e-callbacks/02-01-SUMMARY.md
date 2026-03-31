# Phase 2 Plan 1: Criar keyboards.py e callback_router.py Summary

**Created:** 2026-03-30
**Last Updated:** 2026-03-31
**Status:** Complete

---

## O que foi feito

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/bot/keyboards.py` | Módulo de fábrica de InlineKeyboard (REF-03) |
| `src/bot/callback_router.py` | Router de callbacks por prefixo (REF-02, NAV-09) |
| `src/bot/_callback_handlers.py` | Handlers concretos registrados via @register (REF-02) |
| `tests/test_callback_data.py` | Testes de validação de callback_data (64 bytes + formato) |

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/bot/handlers.py` | button_callback virou alias de route_callback; register_handlers usa CallbackQueryHandler(route_callback) |
| `src/bot/templates.py` | get_confirmation_keyboard re-exportada de keyboards.py; definição inline removida |

---

## Decisões de implementação

### keyboards.py
- `get_confirmation_keyboard()` migrada de templates.py, usa BTN_YES_RESOLVED / BTN_NO_UNRESOLVED de strings.py
- `_assert_callback_data()` valida limite de 64 bytes UTF-8 (NAV-08) em tempo de construção
- `get_main_menu_keyboard()` placeholder para Fase 4

### callback_router.py
- `@register(prefix)` decorator popula dict `_HANDLERS` — zero if/elif, extensível por novos módulos
- `route_callback()` chama `await query.answer()` como primeira linha (NAV-07)
- Despacho por prefixo mais longo primeiro (prefixos específicos têm prioridade)
- Importa `src.bot._callback_handlers` ao final para garantir registro antes de qualquer evento

### _callback_handlers.py
- `yes_resolved` e `no_unresolved` com lógica extraída de button_callback — comportamento idêntico ao anterior
- `search` e `feedback` como stubs registrados (prefixos reconhecidos, sem lógica ainda)
- Acessa conv_manager via import lazy para evitar importação circular

### handlers.py
- `button_callback` mantido como alias para compatibilidade retroativa
- `register_handlers` substituiu `CallbackQueryHandler(button_callback)` por `CallbackQueryHandler(route_callback)`

### templates.py
- `get_confirmation_keyboard` re-exportada via `from src.bot.keyboards import get_confirmation_keyboard`
- Callers existentes (`from src.bot.templates import get_confirmation_keyboard`) não precisam de alterações

---

## Critérios de sucesso — verificação

| Critério | Status |
|----------|--------|
| Todo CallbackQueryHandler chama await query.answer() como primeira linha | Confirmado — linha 88 de callback_router.py |
| Todos os callback_data satisfazem <= 64 bytes UTF-8 | Confirmado — _assert_callback_data() em keyboards.py; "yes_resolved" = 12 bytes, "no_unresolved" = 13 bytes |
| Router despacha por prefixo sem cadeia if/elif | Confirmado — dict _HANDLERS + sorted lookup em route_callback() |
| keyboards.py expõe funções factory para todos os teclados inline existentes | Confirmado — get_confirmation_keyboard() + get_main_menu_keyboard() |
| Fluxos yes_resolved e no_unresolved continuam funcionando | Confirmado — lógica preservada integralmente em _callback_handlers.py |

---

## Requirements satisfeitos

- **REF-02**: button_callback monolítico decomposto em router de callbacks por prefixo
- **REF-03**: Teclados InlineKeyboard centralizados em src/bot/keyboards.py
- **NAV-07**: callback_query.answer() chamado em todo CallbackQuery handler
- **NAV-08**: Callback data compacto respeitando limite 64 bytes (validação em _assert_callback_data)
- **NAV-09**: Router de callbacks baseado em prefixo substituindo if/elif monolítico

---

## Verificação final

```bash
$ python -c "from src.bot.keyboards import *; print('keyboards.py OK')"
keyboards.py OK

$ python -c "from src.bot.callback_router import route_callback; print('callback_router.py OK')"
callback_router.py OK

$ python -m pytest tests/test_callback_data.py -v
============================== 34 passed in 1.20s ==============================
```

### Cobertura de testes

| Categoria | Testes |
|-----------|--------|
| Limite 64 bytes (26 keyboards) | 26 testes |
| Formato prefix:action[:param] | 5 testes |
| format_breadcrumb | 3 testes |
