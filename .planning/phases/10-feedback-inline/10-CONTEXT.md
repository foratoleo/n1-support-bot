# Phase 10 — Feedback Inline Automático

Criado em: 2026-03-30
Atualizado em: 2026-03-30

## Objetivo

Tornar o ciclo de feedback automático ao final de cada fluxo, com rating por estrelas e comentário opcional via botões inline.

## Requisitos

- FBK-01: Prompt de feedback aparece automaticamente ao final de qualquer fluxo (report submetido, artigo KB exibido, escalação concluída)
- FBK-02: Usuário avalia com 1-5 estrelas via botão; rating registrado no banco
- FBK-03: Após rating, bot pergunta "Quer deixar um comentário?" com Sim/Não; se Sim, aguarda texto livre

## Critérios de Sucesso

1. Ao final de qualquer fluxo, o prompt de feedback aparece automaticamente via InlineKeyboard — sem precisar /feedback
2. Usuário avalia com 1-5 estrelas via botão; rating registrado no banco
3. Após rating, bot pergunta "Quer deixar um comentário?" com Sim/Não; se Sim, aguarda texto livre
4. Feedback nao bloqueia — usuário pode ignorar e iniciar nova acao

## Decisoes de Design

- Prefixo de callback: `fbk:` (separado de outros prefixos existentes)
- UUID truncado para 8 chars nos callbacks para respeitar limite de 64 bytes do Telegram
- Busca por prefixo UUID no banco para associar rating ao chamado
- Feedback e NON-BLOCKING: exceçoes sao capturadas e logadas, nunca propagadas
- send_feedback_prompt_after_edit usa query.message.reply_text (nova mensagem, nao edita)
