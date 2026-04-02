# Contribuição para o UpOracular

Este documento detalha o processo de contribuição técnica e pedagógica para o projeto UpOracular.

## 1. Princípios de Contribuição
O UpOracular é um projeto **comunitário e acadêmico**. Valorizamos:
- **Respeito intelectual**: Toda contribuição deve estar em harmonia com os princípios decoloniais.
- **Clareza de código**: O código deve ser autoexplicativo (Self-documenting) seguindo o ag-kit `clean-code`.
- **Diversidade Literária**: Sugestões de novos títulos devem focar em bibliografias diversas.

## 2. Contribuição Técnica
Se você deseja modificar os módulos `.gs` ou a interface `.html`:
1.  **Fork a Planilha & Script**: Crie uma cópia para testes unitários antes do deploy.
2.  **Maturity Scorer**: Execute `python .agent/scripts/maturity_scorer.py .` para garantir que o score do projeto não diminua após suas alterações.
3.  **Naming Convention**: Use `PascalCase` para novos módulos `.gs` e `camelCase` para funções internas.
4.  **Testing**: Adicione testes unitários se o módulo for de lógica (ex: `AnalyticsEngine.gs`).

## 3. Contribuição Pedagógica
Para adicionar ou sugerir novas **Trilhas Oraculares**:
- Envie um PR modificando a planilha `LinkMap` com o cabeçalho: `AssuntoA, AssuntoB, Descricao, Peso`.
- Verifique se as novas trilhas seguem os temas transversais definidos em `PEDAGOGY.md`.

## 4. Estilo de Código (GAS)
- Evite variáveis globais excessivas.
- Utilize o `CacheService` para todas as leituras de Planilhas em módulos de alto tráfego.
- Comente a finalidade de cada função usando o padrão JSDoc.

---
*UpOracular: Escolhas que queremos ler, possibilidades que podemos ser.*
