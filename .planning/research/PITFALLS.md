# Pitfalls — Menu Navigation, pt-br e Melhorias de Busca

**Criado em:** 2026-03-30
**Atualizado em:** 2026-03-30

Documento de pesquisa preventiva para o milestone v2 do RAG Workforce Bot. Cada pitfall foi
analisado no contexto concreto da codebase existente (python-telegram-bot 21.7, estado em memória
em `ConversationManager`, handler monolítico em `handlers.py`).

---

## 1. Limite de 64 bytes no `callback_data` do InlineKeyboard

### O que é

O Telegram rejeita silenciosamente (ou retorna erro 400) qualquer botão cujo `callback_data`
exceda 64 bytes UTF-8. Com submenus aninhados, a tentação é codificar contexto completo na string
(ex.: `"menu:tirar_duvidas:categoria:integracao:subcategoria:erros_api"`), o que estoura o limite
com facilidade.

### Sinais de alerta

- Callback não chega ao `button_callback` sem nenhum erro visível no bot — o botão simplesmente
  não responde.
- Strings de `callback_data` construídas com f-strings que incluem IDs de relatório, categorias e
  nível de menu ao mesmo tempo.
- Na codebase atual, `get_confirmation_keyboard()` em `templates.py` já usa `"yes_resolved"` e
  `"no_unresolved"` — curtos e seguros. O risco aparece quando o padrão for expandido para o menu
  principal com múltiplos níveis.

### Estratégia de prevenção

Adotar um esquema de `callback_data` compacto e hierárquico desde o início:

```
menu:principal          → 14 bytes
menu:duvidas            → 13 bytes
menu:erro:tipo:acesso   → 22 bytes
menu:back:duvidas       → 17 bytes
```

Regra de design: `callback_data = "<namespace>:<action>[:<param>]"` com no máximo dois parâmetros.
Se precisar de mais contexto (ex.: report_id), armazenar no `UserConversationState` e recuperar
pelo `user_id` já disponível no callback — nunca embutir no `callback_data`.

Adicionar teste unitário que valida `len(data.encode("utf-8")) <= 64` para cada valor registrado.

### Fase que deve endereçar

Fase de implementação do menu principal (antes de qualquer submenu ser criado).

---

## 2. Estado do menu desincronizado com o conteúdo da mensagem

### O que é

O menu exibe "Selecione uma categoria" mas o estado interno ainda está em `PROVIDING_GUIDANCE` do
fluxo antigo. O usuário navega pelo menu, mas o `handle_message` interpreta as respostas de texto
como respostas a perguntas de validação. Isso ocorre porque o estado de navegação de menu e o
estado de conversa existente (`ConversationState`) são dimensões diferentes que precisam coexistir.

### Sinais de alerta

- `ConversationState` atual tem apenas 5 estados (`IDLE`, `AWAITING_REPORT`,
  `AWAITING_VALIDATION_ANSWER`, `PROVIDING_GUIDANCE`, `ESCALATED`). Não existe estado de menu.
- Ao editar uma mensagem com menu via `edit_message_text`, a mensagem muda mas o estado em
  `conv_manager` não é atualizado atomicamente — se `edit_message_text` falhar após a atualização
  de estado, os dois ficam dessincronizados.
- Sintoma em produção: usuário clica "Voltar" e vê menu de nível anterior, mas o bot responde como
  se estivesse em outro estado.

### Estratégia de prevenção

Introduzir um campo `menu_context` no `UserConversationState` para rastrear:
- Nível do menu atual (`"main"`, `"duvidas"`, `"erro"`, etc.)
- ID da mensagem do menu ativo (`menu_message_id: Optional[int]`)

Atualizar estado e editar mensagem dentro do mesmo bloco `try/except`:

```python
# Padrão seguro
conv_manager.set_menu_context(user_id, "duvidas", message_id=query.message.message_id)
await query.edit_message_text(...)  # se falhar, reverter estado
```

Nunca deixar a edição de mensagem fora do contexto de atualização de estado.

### Fase que deve endereçar

Fase de design da arquitetura do menu, antes de qualquer implementação de submenu.

---

## 3. Erro "Message is not modified" ao pressionar o mesmo botão duas vezes

### O que é

Quando o usuário pressiona um botão que já está ativo (ex.: clica em "Tirar Dúvidas" quando o
menu de dúvidas já está visível), o `edit_message_text` tenta enviar o mesmo texto e markup. O
Telegram retorna `telegram.error.BadRequest: Message is not modified`, causando uma exceção não
tratada. Na codebase atual, `button_callback` em `handlers.py` não tem nenhum tratamento para
esse erro.

### Sinais de alerta

- Erros `BadRequest` nos logs após o usuário navegar para frente e para trás rapidamente.
- `button_callback` atual usa `await query.answer()` mas não envolve `edit_message_text` em
  `try/except`.
- Double-tap natural em mobile — usuários com conexão lenta pressionam duas vezes.

### Estratégia de prevenção

Envolver toda chamada `edit_message_text` em tratamento explícito:

```python
from telegram.error import BadRequest

try:
    await query.edit_message_text(text=new_text, reply_markup=new_markup)
except BadRequest as e:
    if "Message is not modified" in str(e):
        pass  # idempotente, ignorar silenciosamente
    else:
        raise
```

Adicionalmente, sempre chamar `await query.answer()` antes de qualquer operação assíncrona para
satisfazer o Telegram imediatamente, independentemente do que acontecer depois.

### Fase que deve endereçar

Implementação do `button_callback` expandido para menu — tratar na mesma função onde os novos
casos são adicionados.

---

## 4. Timeout de callback query (resposta obrigatória em até ~3 segundos)

### O que é

O Telegram exige que todo `CallbackQuery` seja respondido via `query.answer()` em até
aproximadamente 3 segundos. Se o handler executar uma operação lenta (busca na KB, chamada ao
OpenAI, consulta ao banco) antes de chamar `answer()`, o Telegram mostra o spinner de carregamento
indefinidamente e pode marcar o callback como expirado.

### Sinais de alerta

- Na codebase atual, `button_callback` chama `await query.answer()` na primeira linha — correto
  para os dois casos existentes (`yes_resolved`, `no_unresolved`). O risco aparece quando novos
  casos de menu fizerem consultas ao banco ou à KB antes de responder.
- Handler `no_unresolved` já cria escalação (operação de banco) após o `answer()` — padrão
  correto a ser mantido.
- Risco específico: se o menu "Tirar Dúvidas" disparar uma busca na KB para pre-popular categorias
  relevantes, isso deve acontecer após o `answer()`.

### Estratégia de prevenção

Regra imutável: `await query.answer()` é sempre a primeira linha de qualquer callback handler.
Estrutura obrigatória:

```python
async def button_callback(update, context):
    query = update.callback_query
    await query.answer()          # SEMPRE PRIMEIRO — nunca mover para baixo
    # ... resto da lógica
```

Para operações lentas (busca KB, LLM), usar `query.answer(text="Buscando...")` com mensagem de
loading visível ao usuário, depois editar a mensagem com o resultado.

### Fase que deve endereçar

Refatoração do `button_callback` antes de adicionar qualquer nova lógica ao handler.

---

## 5. Árvore de menus profunda demais — usuário se perde

### O que é

Árvores com mais de 3 níveis (Principal → Categoria → Subcategoria → Detalhe) são confusas em
interfaces de chat. O usuário perde o contexto de onde está, não sabe como voltar para o início e
abandona o fluxo.

### Sinais de alerta

- Requisito atual inclui: menu principal → submenus → "Tirar Dúvidas com categorias da KB" →
  fluxo guiado de coleta. Se as categorias da KB tiverem subcategorias, já são 4 níveis.
- Botão "Voltar" em todos os níveis é requisito ativo — sinal de que o risco já foi reconhecido,
  mas sem limite de profundidade explícito.

### Estratégia de prevenção

Limitar a árvore a no máximo 3 níveis efetivos:

```
Nível 0: Menu principal (Tirar Dúvida / Reportar Erro / Meus Chamados)
Nível 1: Categoria ou tipo de problema
Nível 2: Ação final ou coleta de informação
```

Nunca criar um nível 3 navegacional — se necessário mais granularidade, usar uma mensagem de texto
com lista numerada em vez de mais botões. O botão "Voltar" no nível 1 vai para o menu principal;
no nível 2, vai para o nível 1. Não existe "voltar" dentro de fluxos de coleta de dados (as
perguntas de validação são sequenciais, não navegacionais).

Adicionar breadcrumb textual no topo de cada mensagem de menu:

```
Suporte Workforce > Tirar Dúvida
```

Isso reduz a desorientação sem adicionar complexidade técnica.

### Fase que deve endereçar

Fase de design da árvore de navegação — definir profundidade máxima antes de implementar.

---

## 6. Quebrar fluxos existentes ao adicionar o sistema de menus

### O que é

O bot existente funciona com comandos de texto (`/report`, `/search`, `/list`, `/feedback`). Ao
adicionar menus, o `handle_message` e o `button_callback` precisam coexistir com os handlers de
comando. O risco é que um `MessageHandler` geral absorva mensagens que deveriam ir para o menu
ou vice-versa.

### Sinais de alerta

- `handle_message` atual em `handlers.py` responde a qualquer mensagem de texto não-comando.
  Se o usuário estiver em um menu e digitar texto livre, o `handle_message` vai processar como
  resposta de validação.
- `ConversationState.IDLE` atual responde com instrução de usar `/report` — correto hoje, mas
  errado após o menu principal existir (o usuário em IDLE deveria ver o menu, não a instrução de
  comando).
- Ordem de registro de handlers em `register_handlers` pode criar conflitos se um
  `CallbackQueryHandler` específico de menu for adicionado depois do handler genérico.

### Estratégia de prevenção

Introduzir um estado `MENU_NAVIGATION` no `ConversationState` que indica que o usuário está
dentro do sistema de menus. O `handle_message` deve verificar esse estado e responder
apropriadamente (ex.: ignorar texto livre durante navegação de menu, ou oferecer retornar ao menu).

Manter os comandos `/report`, `/search`, `/list`, `/feedback` funcionando independentemente do
estado de menu — comandos sempre têm prioridade e devem limpar o estado de menu.

Criar testes de regressão para os fluxos existentes antes de qualquer modificação no `handlers.py`.

Registrar handlers na ordem correta: comandos específicos → callback handlers → message handler
genérico (já é o padrão atual — manter).

### Fase que deve endereçar

Primeira fase de implementação — antes de qualquer mudança em `handlers.py`.

---

## 7. Strings pt-br espalhadas — hardcoding acidental

### O que é

A codebase já tem strings em inglês espalhadas em dois lugares: `BOT_MESSAGES` dict em
`templates.py` e strings inline em `handlers.py` (ex.: `"Please provide an issue description"`,
`"Invalid report ID format"`, mensagens de erro em `button_callback`). Se a tradução para pt-br
for feita de forma incremental e ad-hoc, strings novas inevitavelmente serão adicionadas inline
nas novas funções de menu.

### Sinais de alerta

- Existem hoje pelo menos 8 strings de resposta hardcoded diretamente em `handlers.py` fora do
  `BOT_MESSAGES` dict (linhas 89, 203, 449, 462, 489, 498, 529, 549).
- `BOT_MESSAGES` em `templates.py` não cobre todas as mensagens de erro — só as mensagens
  principais do fluxo.
- Não há nenhum mecanismo de busca por strings não-localizadas (nenhum lint rule ou fixture).

### Estratégia de prevenção

Antes de adicionar qualquer string pt-br, centralizar todas as strings existentes em `BOT_MESSAGES`
(ou em um módulo `src/bot/strings.py` dedicado). Nunca usar f-string ou string literal para
mensagens ao usuário em handlers — sempre referenciar uma chave de `BOT_MESSAGES`.

Adicionar um comentário `# STRINGS_ONLY_IN_TEMPLATES` no topo de `handlers.py` e fazer parte do
checklist de code review.

Estruturar `BOT_MESSAGES` por categoria para facilitar manutenção:

```python
BOT_MESSAGES = {
    # Navegação de menu
    "menu_principal": "...",
    "menu_duvidas": "...",
    # Erros
    "erro_id_invalido": "...",
    "erro_sem_args": "...",
    # Fluxo de reporte
    "ack_reporte": "...",
}
```

### Fase que deve endereçar

Fase de localização pt-br — antes de qualquer nova string ser adicionada para o menu.

---

## 8. Regressão na qualidade de busca ao alterar parâmetros de ranking

### O que é

Os parâmetros BM25 (`k1=1.5`, `b=0.75`) e os pesos de combinação de score (`0.4 * bm25 + 0.6 * gpt`)
em `knowledge_base.py` foram definidos sem baseline documentado. Qualquer ajuste nesses valores
para melhorar a precisão pode piorar casos que funcionavam antes, sem que haja métrica para
detectar a regressão.

### Sinais de alerta

- Valores hardcoded em `knowledge_base.py` linhas 109-110 e 465 (conforme `CONCERNS.md`).
- Não há nenhum teste de qualidade de busca no repositório (apenas testes unitários de BM25 e
  hybrid search — `tests/` têm testes de ranking mas não um golden dataset de consultas).
- Cache BM25 sem invalidação TTL — se os documentos da KB mudarem, o cache desatualizado piora
  os resultados silenciosamente.

### Estratégia de prevenção

Antes de ajustar qualquer parâmetro, criar um dataset de avaliação mínimo:
- 10-20 consultas representativas com resultados esperados.
- Métrica simples: top-3 contém o artigo relevante (precision@3).

Mover os parâmetros para `config.py` como valores configuráveis com defaults explícitos.
Qualquer mudança de parâmetro deve ser acompanhada de execução do dataset de avaliação.

Para o cache BM25, implementar invalidação TTL (ex.: 1 hora) ou invalidação por evento (novo
documento adicionado) — conforme já identificado em `CONCERNS.md` seção 3.1.

### Fase que deve endereçar

Fase de melhoria da busca — criar o dataset de avaliação como primeiro passo, antes de qualquer
ajuste de parâmetro.

---

## 9. Degradação de performance com busca semântica em KB grande

### O que é

A adição de busca por embeddings (vetorial) ao BM25 existente já foi implementada como hybrid
search. O risco para a v2 está em: (a) adicionar mais documentos à KB sem reindexar os embeddings,
(b) usar modelos de embedding mais caros por documento sem lazy loading, ou (c) calcular
embeddings por consulta sem cache.

### Sinais de alerta

- `find_relevant_articles()` já faz BM25 + re-ranking GPT em sequência (conforme `CONCERNS.md`
  seção 3.1). Adicionar embedding lookup na mesma chamada síncrona pode triplicar a latência.
- O requisito de "melhorar precisão da busca" pode levar à tentação de aumentar o número de
  candidatos pré-ranking (`limit * 3` já é hardcoded em linha 299 de `knowledge_base.py`).
- Usuários do Telegram têm tolerância baixa para latência — resposta acima de 5 segundos parece
  travado.

### Estratégia de prevenção

Definir um SLO informal de latência para busca: p95 < 3 segundos para queries típicas.
Medir a latência atual antes de qualquer melhoria.

Para embeddings, implementar:
- Cache de embeddings de documentos no banco (não recalcular a cada busca).
- Embedding de query em paralelo com BM25, não em sequência.
- Fallback gracioso: se o embedding service estiver lento, retornar resultado BM25 puro.

Não aumentar `limit * 3` sem medir o impacto na latência primeiro.

### Fase que deve endereçar

Fase de melhoria da busca — medir antes de mudar.

---

## 10. Usuário preso em caminhos de menu sem saída

### O que é

O usuário inicia o fluxo de "Reportar Erro", responde duas perguntas de validação e então percebe
que escolheu a categoria errada. Não há como voltar para o menu sem digitar `/cancel`, que limpa
todo o estado. Em interfaces de menu guiado, a ausência de um escape gracioso é um bloqueio de
experiência.

### Sinais de alerta

- `ConversationState.AWAITING_VALIDATION_ANSWER` em `handlers.py` não tem nenhuma saída exceto
  continuar respondendo ou usar `/cancel`.
- O requisito "Botão Voltar em todos os níveis de submenu" está listado como ativo mas não
  especifica o comportamento quando o usuário está no meio de um fluxo de coleta (não apenas
  navegação de menu).
- `ESCALATED` é um estado terminal — o usuário não tem como reabrir um caso sem criar um novo
  report.

### Estratégia de prevenção

Distinguir dois tipos de "Voltar":
1. **Voltar de navegação**: dentro de menus antes de iniciar um fluxo — retorna ao nível anterior.
2. **Cancelar fluxo**: durante coleta de informações (perguntas de validação) — mostra confirmação
   "Deseja cancelar o reporte atual?" antes de limpar o estado.

Adicionar tratamento no `handle_message` para o estado `AWAITING_VALIDATION_ANSWER` que detecta
intenção de cancelamento (texto "cancelar", "voltar", "/cancel") e oferece a opção com botões
inline, em vez de interpretar como resposta à pergunta.

Para o estado `ESCALATED`, adicionar uma saída explícita: após a mensagem de escalação, exibir
um botão "Abrir Novo Chamado" que reseta o estado e volta ao menu principal.

Regra de ouro: toda tela do bot deve ter pelo menos uma saída que não seja digitar `/cancel`.

### Fase que deve endereçar

Design do fluxo de menu e implementação do estado `MENU_NAVIGATION` — endereçar junto com o
Botão Voltar.

---

## Resumo por Fase

| Pitfall | Fase | Prioridade |
|---------|------|------------|
| 1. Limite 64 bytes callback_data | Menu principal (fase 1) | Critica |
| 6. Quebrar fluxos existentes | Menu principal (fase 1) | Critica |
| 4. Timeout callback query | Menu principal (fase 1) | Alta |
| 3. "Message is not modified" | Menu principal (fase 1) | Alta |
| 7. Strings pt-br espalhadas | Localizacao pt-br | Alta |
| 2. Estado desincronizado | Submenus e navegacao (fase 2) | Alta |
| 5. Arvore de menus profunda | Design (antes da fase 2) | Media |
| 10. Usuario preso sem saida | Submenus e navegacao (fase 2) | Media |
| 8. Regressao na busca | Melhoria de busca | Media |
| 9. Performance semantica | Melhoria de busca | Media |
