# Modelo de Governança — UpOracular

Este documento detalha a estrutura de tomada de decisão, manutenção técnica e integridade pedagógica do projeto UpOracular.

## 1. Atribuições da Liderança
O projeto é liderado por uma equipe técnica e pedagógica que garante:
- A coerência entre a IA (Google Gemini) e os valores decoloniais.
- O backup e a segurança dos dados dos estudantes (Planilha de Perfis).
- O cumprimento das normativas de proteção de dados (LGPD).

## 2. Manutenção Técnica
A manutenção é realizada via **Antigravity Kit (ag-kit)**.
- **Backups Semanais**: O `DataExporter.gs` gera CSVs de segurança no Drive.
- **Logs de Acesso**: O `AccessController.gs` monitora preventivamente tentativas de login não autorizadas.
- **Scoring de Maturidade**: Qualquer nova versão deve manter um score de maturidade superior a **90/100**.

## 3. Curadoria Literária
As novas indicações inseridas no `RecommendationEngine.gs` e as trilhas mapeadas no `TrailMapper.gs` são validadas periodicamente por um conselho de mediadores de leitura, garantindo que o "Robô Oracular" ofereça sugestões ricas e seguras.

## 4. Direitos Autorais e Licenciamento
O UpOracular é disponibilizado sob licença de uso acadêmico.
- O código proprietário no `.gs` pode ser reutilizado em projetos escolares.
- Todas as citações bibliográficas seguem as normas da ABNT descritas no `Projeto.md`.

---
*Escola Classe 115 Norte | UpOracular: Onde os Fios das diferentes Histórias Amarram.*
