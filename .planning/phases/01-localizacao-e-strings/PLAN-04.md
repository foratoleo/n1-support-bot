---
phase: 1
plan: 4
title: "Traduzir perguntas de validacao, system prompts LLM e verificacao final"
wave: 2
depends_on: [1]
files_modified: ["src/validation/questions.py", "src/validation/classifier.py", "src/rag/knowledge_base.py"]
requirements_addressed: ["L10N-01", "L10N-02", "L10N-04"]
autonomous: true
estimated_tasks: 3
---

<task id="1">
<title>Traduzir perguntas de validacao em src/validation/questions.py para pt-br</title>
<read_first>
- src/validation/questions.py (estrutura atual: CATEGORY_QUESTIONS dict com objetos Question(id, text, options) nas linhas 34-63)
</read_first>
<action>
Reescrever os textos dos objetos `Question` diretamente em `questions.py`, mantendo os `id` intactos (sao usados programaticamente). Não mover para strings.py — os textos são propriedade estrutural do objeto Question (decisão documentada na seção 5.4 do RESEARCH.md).

Substituir o dicionario `CATEGORY_QUESTIONS` pelo seguinte conteudo:

```python
CATEGORY_QUESTIONS = {
    "data_missing": [
        Question("dm1", "Em qual projeto você está trabalhando?"),
        Question("dm2", "Você confirma que os dados deveriam existir nesse projeto?"),
        Question("dm3", "Você já tentou atualizar a página?"),
        Question("dm4", "O que você vê ao procurar pelos dados?"),
    ],
    "document_generation": [
        Question("dg1", "A partir de qual transcrição você está gerando o documento?"),
        Question("dg2", "Qual tipo de documento você selecionou?"),
        Question("dg3", "Você recebeu alguma mensagem de erro?"),
        Question("dg4", "Quanto tempo você esperou antes de o processo falhar?"),
    ],
    "task_sprint": [
        Question("ts1", "Em qual projeto e sprint está essa tarefa?"),
        Question("ts2", "Qual status a tarefa exibe atualmente?"),
        Question("ts3", "Você está atribuído como responsável pela tarefa?"),
        Question("ts4", "Você já tentou atualizar o status da tarefa?"),
    ],
    "login_auth": [
        Question("la1", "Você está vendo alguma mensagem de erro?"),
        Question("la2", "Você já tentou limpar o cache do navegador?"),
        Question("la3", "Você consegue tentar em um navegador diferente?"),
        Question("la4", "Sua senha foi alterada recentemente?"),
    ],
    "general": [
        Question("g1", "Você pode fornecer mais detalhes sobre o que aconteceu?"),
        Question("g2", "Quando esse problema começou?"),
        Question("g3", "Isso acontece sempre ou apenas às vezes?"),
    ],
}
```

Não alterar nada mais no arquivo — a classe `Question`, `QuestionGenerator`, `get_questions_for_category()` e `validate_responses()` permanecem inalterados.
</action>
<acceptance_criteria>
- `grep -n "Which project\|Can you confirm\|Have you tried\|What do you see\|Which transcript\|What document type\|Did you receive\|How long did\|Are you assigned\|Can you provide\|When did this\|Does this happen" src/validation/questions.py` retorna vazio
- `grep -n "Em qual projeto\|Você confirma\|Você já tentou\|O que você vê\|transcrição\|tipo de documento\|mensagem de erro\|responsável\|navegador\|detalhes sobre" src/validation/questions.py` retorna pelo menos 10 linhas
- `python -c "import sys; sys.path.insert(0, '.'); from src.validation.questions import QuestionGenerator; qg = QuestionGenerator(); qs = qg.get_questions_for_category('login_auth'); print(qs[0].text)"` imprime "Você está vendo alguma mensagem de erro?"
- `python -c "import sys; sys.path.insert(0, '.'); import ast; ast.parse(open('src/validation/questions.py').read()); print('syntax OK')"` imprime "syntax OK"
</acceptance_criteria>
</task>

<task id="2">
<title>Reescrever system prompt do classificador em src/validation/classifier.py para pt-br</title>
<read_first>
- src/validation/classifier.py (localizar metodo _classify_with_openai nas linhas ~220-274 — system_prompt em ingles nas linhas 232-253)
</read_first>
<action>
Localizar a variavel `system_prompt` dentro do metodo `_classify_with_openai()` e substituir seu conteudo pelo prompt em pt-br abaixo. As chaves do JSON de resposta (`category`, `confidence`, `summary`, `area`) permanecem em ingles pois sao usadas programaticamente em `parsed.get("category", "general")`.

```python
system_prompt = """Você é um classificador de chamados de suporte para um sistema de gestão de workforce.
Classifique o problema em uma destas categorias:
- data_missing: Usuário não consegue encontrar ou acessar dados que deveriam existir
- document_generation: Problemas com geração de documentos por IA (PRD, user stories, etc.)
- task_sprint: Problemas com tarefas, sprints ou planejamento de projetos
- login_auth: Problemas de login, autenticação ou sessão
- general: Problemas que não se encaixam nas outras categorias

Também identifique a área da base de conhecimento:
- foundation: Funcionalidades centrais do sistema
- document-generation: Criação de documentos e templates
- frontend: Interface do usuário e problemas de exibição
- planning: Gestão de tarefas e sprints
- support: Tópicos gerais de suporte

Responda com um objeto JSON:
{
    "category": "nome_da_categoria",
    "confidence": 0.0-1.0,
    "summary": "descrição breve",
    "area": "area_kb"
}"""
```

Não alterar mais nada no metodo — apenas a string `system_prompt`.
</action>
<acceptance_criteria>
- `grep -n "You are a support issue classifier\|Classify the issue into\|User cannot find\|Issues with AI document\|Issues with tasks\|Login, authentication\|Issues that don't fit\|Core system functionality\|Document creation\|User interface\|Task and sprint\|General support\|Respond with a JSON" src/validation/classifier.py` retorna vazio
- `grep -n "classificador de chamados\|gestão de workforce\|Classifique o problema\|geração de documentos\|Funcionalidades centrais\|Responda com um objeto JSON" src/validation/classifier.py` retorna pelo menos 5 linhas
- `python -c "import sys; sys.path.insert(0, '.'); import ast; ast.parse(open('src/validation/classifier.py').read()); print('syntax OK')"` imprime "syntax OK"
</acceptance_criteria>
</task>

<task id="3">
<title>Reescrever system prompt e user prompt do reranker em src/rag/knowledge_base.py para pt-br</title>
<read_first>
- src/rag/knowledge_base.py (localizar metodo _rerank_with_gpt4o — system prompt na linha ~445 e user prompt nas linhas ~428-440)
</read_first>
<action>
Localizar o metodo `_rerank_with_gpt4o()` em `src/rag/knowledge_base.py`.

1. Substituir o system prompt (linha ~445):
```python
# ANTES:
{"role": "system", "content": "You are a support ticket analysis assistant."},
# DEPOIS:
{"role": "system", "content": "Você é um assistente de análise de chamados de suporte."},
```

2. Substituir a variavel `prompt` (user prompt, linhas ~428-440):
```python
prompt = f"""Problema relatado pelo usuário: "{issue_description}"

Avalie cada artigo da base de conhecimento abaixo quanto à relevância para resolver este problema.
Atribua uma pontuação de 0 a 10 para cada artigo, onde:
- 10 = Altamente relevante, aborda diretamente o problema
- 5 = Parcialmente relevante, contém informações relacionadas
- 0 = Irrelevante, não auxilia na resolução do problema

Artigos:
{chr(10).join([f"[{i+1}] {text}" for i, text in enumerate(candidate_texts)])}

Retorne apenas um array JSON com as pontuações em ordem, como: [8, 3, 9, 2, 5]
Retorne apenas o array, sem mais nada."""
```

Nao alterar mais nada no metodo — manter logica de parse, scoring e merge identica.
</action>
<acceptance_criteria>
- `grep -n "You are a support ticket analysis assistant\|Given the user's issue\|Evaluate each knowledge base\|Score each article from 0-10\|Highly relevant, directly\|Somewhat relevant, contains\|Not relevant, doesn't help\|Return only a JSON array\|Only return the array" src/rag/knowledge_base.py` retorna vazio
- `grep -n "assistente de análise de chamados\|Problema relatado\|Avalie cada artigo\|Altamente relevante\|Parcialmente relevante\|Irrelevante\|Retorne apenas um array JSON" src/rag/knowledge_base.py` retorna pelo menos 6 linhas
- `python -c "import sys; sys.path.insert(0, '.'); import ast; ast.parse(open('src/rag/knowledge_base.py').read()); print('syntax OK')"` imprime "syntax OK"
</acceptance_criteria>
</task>

<verification>
A partir da raiz do projeto:

1. `grep -rn "Which project\|Can you confirm the data\|Which transcript\|What document type\|Are you seeing any error\|Have you tried clearing\|Can you try a different\|Can you provide more details\|When did this issue start\|Does this happen every time" src/validation/questions.py` — deve retornar vazio.
2. `grep -rn "You are a support issue classifier\|You are a support ticket analysis assistant\|Given the user's issue\|Score each article" src/validation/classifier.py src/rag/knowledge_base.py` — deve retornar vazio.
3. `python -c "import sys; sys.path.insert(0, '.'); from src.validation.questions import QuestionGenerator; qg = QuestionGenerator(); all_qs = [q for cat in qg.CATEGORY_QUESTIONS.values() for q in cat]; english = [q.text for q in all_qs if any(w in q.text for w in ['Which','Can you','Have you','What','When','Does this','Are you'])]; print('English questions remaining:', english)"` — deve imprimir `English questions remaining: []`.
4. `python -c "import sys; sys.path.insert(0, '.'); import ast; [ast.parse(open(f).read()) for f in ['src/validation/questions.py', 'src/validation/classifier.py', 'src/rag/knowledge_base.py']]; print('syntax OK')"` — deve imprimir "syntax OK".
</verification>

<must_haves>
- Todas as 19 perguntas de validação em pt-br com tom direto e cordial
- System prompts LLM em pt-br (classifier e reranker) — L10N-02 completamente atendido
- Chaves JSON de resposta do LLM preservadas em ingles (category, confidence, summary, area) pois sao usadas programaticamente
- Os tres arquivos passam parse de sintaxe Python sem erros
- Logica de reranking (parse, scoring, merge) identica apos a traducao dos prompts
</must_haves>
