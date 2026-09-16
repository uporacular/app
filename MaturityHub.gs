/**
 * MaturityHub.gs
 * Hub Unificado de Maturidade — UpOracular v1.3.0
 *
 * Orquestra BackendMaturity.gs + FrontendMaturity.gs em uma única chamada,
 * cruzando os dados por módulo para gerar:
 *   • Score combinado (55% backend · 45% frontend)
 *   • Matriz por módulo: backend score × frontend score × gap
 *   • Insights de desequilíbrio (onde backend é forte mas frontend é fraco, e vice-versa)
 *   • Recomendações integradas com prioridade de impacto
 *
 * Funções públicas acessíveis via google.script.run:
 *   getUnifiedMaturityJson()   → JSON do relatório completo
 *   openMaturityHubPanel()     → abre a sidebar no Sheets
 *   addMaturityHubMenuItem()   → registra o menu "🔬 Diagnóstico"
 */

var HUB_VERSION = '1.0.0';

// Peso relativo de cada camada no score combinado
var HUB_WEIGHT_BACKEND  = 0.55;
var HUB_WEIGHT_FRONTEND = 0.45;

// Tabela de scores backend conhecidos por módulo (GAS integration estimate)
// Fonte: _estimateGasIntegration_() em BackendMaturity.gs
var HUB_BACKEND_MODULE_SCORES = {
  AccessController:        95, AcervoService:          90,
  AIAnalyzer:              85, AnalyticsEngine:         70,
  APIClient:               95, BackendMaturity:         82,
  ColabIntegrator:         90, ConfigManager:           95,
  DataCleaner:             80, DataExporter:            90,
  DataImporter:            85, DataIntegrator:          85,
  DriveManager:            95, ErrorHandler:            85,
  FeedbackCollector:       90, FrontendMaturity:        82,
  GeminiConnector:         90, InterdisciplinaryLinker: 85,
  LogManager:              90, NotificationSender:      90,
  PatternDetector:         80, PermissionManager:       90,
  ProfileMerger:           85, ProfileUpdater:          85,
  ReadingHistory:          85, ReadingRecord:           95,
  RecommendationEngine:    90, ReportGenerator:         90,
  SessionManager:          95, SheetConnector:          95,
  SheetFormatter:          90, SheetUpdater:            95,
  SystemInitializer:       95, TrailHistory:            85,
  TrailMapper:             75, TrailRanker:             70,
  TrailRecommender:        80, TrailSuggester:          85,
  TrailVisualizer:         70, UserAuth:                90,
  UserProfile:             85, UserSettings:            90,
  UserValidator:           85
};

// ─── Ponto de Entrada ──────────────────────────────────────────────────────────

/**
 * Executa a avaliação unificada (backend + frontend) e retorna o relatório JSON.
 * @return {string} JSON serializado do relatório completo.
 */
function getUnifiedMaturityJson() {
  try {
    return JSON.stringify(_runUnifiedAssessment_());
  } catch (error) {
    Logger.log("Erro em getUnifiedMaturityJson: " + error.message);
    throw error;
  }
}

/**
 * Executa a avaliação unificada.
 * @return {Object} Relatório completo.
 */
function _runUnifiedAssessment_() {
  try {
    try {
      // 1. Executa ambas as avaliações
      var backend  = runBackendMaturityAssessment();
      var frontend = runFrontendMaturityAssessment();

      if (backend.error)  return { error: 'Backend: ' + backend.error };
      if (frontend.error) return { error: 'Frontend: ' + frontend.error };

      // 2. Score combinado
      var combined = Math.round(
        (backend.compositeScore  * HUB_WEIGHT_BACKEND +
         frontend.compositeScore * HUB_WEIGHT_FRONTEND) * 10
      ) / 10;

      // 3. Nível unificado
      var combinedLevel = _hubScoreToLevel_(combined);

      // 4. Matriz por módulo (cross-analysis)
      var moduleMatrix = _buildModuleMatrix_(frontend.perFileDetails || []);

      // 5. Insights de desequilíbrio
      var insights = _generateInsights_(backend, frontend, moduleMatrix);

      // 6. Recomendações integradas por prioridade de impacto
      var integratedRecs = _mergeRecommendations_(
        backend.topRecommendations  || [],
        frontend.topRecommendations || [],
        moduleMatrix
      );

      // 7. Estatísticas de gap
      var gapStats = _computeGapStats_(moduleMatrix);

      return {
        version:       HUB_VERSION,
        generatedAt:   new Date().toISOString(),
        combinedScore: combined,
        level:         combinedLevel.label,
        levelColor:    combinedLevel.color,
        description:   combinedLevel.description,
        backend: {
          score:      backend.compositeScore,
          level:      backend.level,
          levelColor: backend.levelColor,
          totalModules: backend.totalModules,
          dimensions: backend.dimensions
        },
        frontend: {
          score:          frontend.compositeScore,
          level:          frontend.level,
          levelColor:     frontend.levelColor,
          totalHtmlFiles: frontend.totalHtmlFiles,
          tierSummary:    frontend.tierSummary,
          dimensions:     frontend.dimensions
        },
        moduleMatrix:        moduleMatrix,
        gapStats:            gapStats,
        insights:            insights,
        integratedRecs:      integratedRecs
      };

    } catch (e) {
      return { error: e.message + '\n' + e.stack };
    }
  } catch (error) {
    Logger.log("Erro em _runUnifiedAssessment_: " + error.message);
    throw error;
  }
}

// ─── Matriz por Módulo ─────────────────────────────────────────────────────────

/**
 * Constrói a matriz cross-layer para cada módulo do projeto.
 * Cruza: backendScore (GAS quality) × frontendScore (HTML quality) × gap.
 *
 * @param {Array<Object>} perFileDetails  da avaliação de frontend
 * @return {Array<Object>}
 */
function _buildModuleMatrix_(perFileDetails) {
  try {
    // Indexa scores de frontend por nome de módulo
    var feFrontendByName = {};
    perFileDetails.forEach(function(f) {
      feFrontendByName[f.name] = f;
    });

    // Lista mestre de todos os módulos (união de backend + frontend conhecidos)
    var allModules = Object.keys(HUB_BACKEND_MODULE_SCORES);
    // Adiciona módulos que só aparecem no frontend
    perFileDetails.forEach(function(f) {
      if (allModules.indexOf(f.name) < 0 && f.name !== 'index') allModules.push(f.name);
    });
    allModules.sort();

    return allModules.map(function(name) {
      var beScore = HUB_BACKEND_MODULE_SCORES[name] || 0;

      // Frontend score: média de d2+d3+d4+d5 da auditoria
      var feData    = feFrontendByName[name];
      var feScore   = feData ? feData.avg : null;
      var tier      = feData ? feData.tier : null;
      var feNotes   = feData ? (feData.notes || '') : '';

      var isCore     = ['SystemInitializer','ConfigManager','ErrorHandler','LogManager',
                        'SessionManager','UserAuth','UserValidator','UserProfile',
                        'SheetConnector','SheetUpdater','RecommendationEngine',
                        'TrailMapper','TrailRanker','PatternDetector','GeminiConnector'].indexOf(name) >= 0;
      var isPipeline = ['ReadingRecord','PatternDetector','AcervoService','TrailMapper',
                        'RecommendationEngine','TrailRanker','GeminiConnector','AIAnalyzer',
                        'TrailRecommender','TrailSuggester','TrailHistory'].indexOf(name) >= 0;
      var hasHtml   = feScore !== null;

      // Gap: positivo = backend melhor que frontend (frontend precisa de atenção)
      //      negativo = frontend melhor que backend (backend precisa de atenção)
      var gap       = hasHtml ? Math.round(beScore - feScore) : null;

      // Classificação do gap
      var gapStatus = _classifyGap_(beScore, feScore, hasHtml);

      // Score integrado (média ponderada quando ambos existem)
      var integrated = hasHtml
        ? Math.round(beScore * HUB_WEIGHT_BACKEND + feScore * HUB_WEIGHT_FRONTEND)
        : beScore;

      return {
        name:       name,
        beScore:    beScore,
        feScore:    feScore,
        tier:       tier,
        gap:        gap,
        gapStatus:  gapStatus,
        integrated: integrated,
        isCore:     isCore,
        isPipeline: isPipeline,
        hasHtml:    hasHtml,
        feNotes:    feNotes
      };
    });
  } catch (error) {
    Logger.log("Erro em _buildModuleMatrix_: " + error.message);
    throw error;
  }
}

/**
 * Classifica o desequilíbrio entre backend e frontend de um módulo.
 * @param {number} be  Backend score (0–100)
 * @param {number|null} fe  Frontend score (0–100 ou null)
 * @param {boolean} hasHtml
 * @return {string} 'balanced' | 'backend-strong' | 'frontend-strong' | 'both-weak' | 'no-ui'
 */
function _classifyGap_(be, fe, hasHtml) {
  if (!hasHtml) return 'no-ui';
  var avg  = (be + fe) / 2;
  var diff = be - fe;
  if (avg < 50)    return 'both-weak';
  if (diff > 25)   return 'backend-strong';  // Frontend precisa de atenção
  if (diff < -25)  return 'frontend-strong'; // Backend precisa de atenção
  return 'balanced';
}

// ─── Gap Statistics ────────────────────────────────────────────────────────────

/**
 * Calcula estatísticas de gap a partir da matriz de módulos.
 * @param {Array<Object>} matrix
 * @return {Object}
 */
function _computeGapStats_(matrix) {
  try {
    var withGap      = matrix.filter(function(m) { return m.gap !== null; });
    var backendLead  = withGap.filter(function(m) { return m.gapStatus === 'backend-strong'; });
    var frontendLead = withGap.filter(function(m) { return m.gapStatus === 'frontend-strong'; });
    var balanced     = withGap.filter(function(m) { return m.gapStatus === 'balanced'; });
    var bothWeak     = withGap.filter(function(m) { return m.gapStatus === 'both-weak'; });
    var noUi         = matrix.filter(function(m) { return m.gapStatus === 'no-ui'; });

    var gaps         = withGap.map(function(m) { return Math.abs(m.gap); });
    var avgGap       = gaps.length > 0
      ? Math.round(gaps.reduce(function(s,v){return s+v;},0) / gaps.length)
      : 0;

    // Módulos com maior gap (backend >>> frontend) — prioridade para refatoração de UI
    var priorityUi   = backendLead.slice().sort(function(a,b) { return b.gap - a.gap; }).slice(0,5);
    // Módulos com maior gap (frontend >>> backend) — prioridade para refatoração de código
    var priorityCode = frontendLead.slice().sort(function(a,b) { return a.gap - b.gap; }).slice(0,5);

    return {
      total:          matrix.length,
      withHtml:       withGap.length,
      noHtml:         noUi.length,
      backendLead:    backendLead.length,
      frontendLead:   frontendLead.length,
      balanced:       balanced.length,
      bothWeak:       bothWeak.length,
      avgGap:         avgGap,
      priorityUi:     priorityUi.map(function(m){return { name:m.name, be:m.beScore, fe:m.feScore, gap:m.gap };}),
      priorityCode:   priorityCode.map(function(m){return { name:m.name, be:m.beScore, fe:m.feScore, gap:m.gap };})
    };
  } catch (error) {
    Logger.log("Erro em _computeGapStats_: " + error.message);
    throw error;
  }
}

// ─── Insights de Desequilíbrio ─────────────────────────────────────────────────

/**
 * Gera insights textuais cruzando os resultados de backend e frontend.
 * @param {Object} backend  Relatório de backend
 * @param {Object} frontend Relatório de frontend
 * @param {Array<Object>} matrix
 * @return {Array<Object>} Lista de insights { type, title, body, severity }
 */
function _generateInsights_(backend, frontend, matrix) {
  try {
    var insights = [];
    var gapStats = _computeGapStats_(matrix);

    // ── Insight 1: Score Delta ──
    var delta = Math.round(Math.abs(backend.compositeScore - frontend.compositeScore) * 10) / 10;
    if (delta > 15) {
      var stronger = backend.compositeScore > frontend.compositeScore ? 'backend' : 'frontend';
      var weaker   = stronger === 'backend' ? 'frontend' : 'backend';
      insights.push({
        type:     'gap',
        severity: 'warn',
        title:    'Desequilíbrio entre camadas (' + delta + ' pts)',
        body:     'O ' + stronger + ' (' + (stronger === 'backend' ? backend.compositeScore : frontend.compositeScore) +
                  '/100) está significativamente à frente do ' + weaker + ' (' +
                  (weaker === 'backend' ? backend.compositeScore : frontend.compositeScore) +
                  '/100). Isso pode criar uma experiência inconsistente — funcionalidades sólidas com interfaces defasadas, ou interfaces premium sem lógica robusta por trás.'
      });
    } else {
      insights.push({
        type:     'balance',
        severity: 'good',
        title:    'Camadas bem equilibradas (Δ ' + delta + ' pts)',
        body:     'Backend (' + backend.compositeScore + ') e frontend (' + frontend.compositeScore +
                  ') estão alinhados. Isso indica que o desenvolvimento evoluiu as duas camadas de forma consistente.'
      });
    }

    // ── Insight 2: Módulos críticos com backend forte e frontend fraco ──
    if (gapStats.priorityUi.length > 0) {
      var names = gapStats.priorityUi.map(function(m) {
        return m.name + ' (BE:' + m.be + ' → FE:' + m.fe + ')';
      }).join(', ');
      insights.push({
        type:     'priority-ui',
        severity: 'warn',
        title:    gapStats.backendLead + ' módulo(s) com UI defasada',
        body:     'Os seguintes módulos têm backend sólido mas interface desatualizada — são os candidatos prioritários para refatoração visual: ' + names + '. A prioridade deve ser migrar para o padrão dark glass do ReadingRecord.html.'
      });
    }

    // ── Insight 3: Módulos críticos com frontend mais avançado que backend ──
    if (gapStats.priorityCode.length > 0) {
      var codeNames = gapStats.priorityCode.map(function(m) {
        return m.name + ' (FE:' + Math.abs(m.gap) + 'pts à frente)';
      }).join(', ');
      insights.push({
        type:     'priority-code',
        severity: 'info',
        title:    gapStats.frontendLead + ' módulo(s) com backend aquém da interface',
        body:     'Nesses módulos o frontend está mais desenvolvido que o backend: ' + codeNames + '. Risco: a interface pode chamar funções GAS ainda não implementadas ou com lógica incompleta.'
      });
    }

    // ── Insight 4: Módulos sem UI ──
    if (gapStats.noHtml > 0) {
      var noUiModules = matrix.filter(function(m) { return m.gapStatus === 'no-ui'; }).map(function(m) { return m.name; });
      var coreNoUi    = noUiModules.filter(function(n) {
        return matrix.some(function(m) { return m.name === n && m.isCore; });
      });
      insights.push({
        type:     'coverage',
        severity: coreNoUi.length > 0 ? 'warn' : 'info',
        title:    gapStats.noHtml + ' módulo(s) sem interface HTML',
        body:     'Esses módulos existem no backend mas não têm sidebar/tela correspondente' +
                  (coreNoUi.length > 0 ? ', incluindo módulos core: ' + coreNoUi.join(', ') : '') +
                  '. Módulos sem UI são inacessíveis ao usuário final e podem ser subutilizados.'
      });
    }

    // ── Insight 5: Coerência GAS-HTML (D5 backend × D5 frontend) ──
    var beD5 = _getDimensionScore_(backend.dimensions, 'D5');
    var feD5 = _getDimensionScore_(frontend.dimensions, 'D5');
    if (beD5 !== null && feD5 !== null) {
      var gasGap = Math.abs(beD5 - feD5);
      if (gasGap > 20) {
        insights.push({
          type:     'gas-coherence',
          severity: 'info',
          title:    'Integração GAS inconsistente entre camadas',
          body:     'A coerência arquitetural do backend (D5: ' + beD5 + '/100) diverge da integração GAS das telas (D5: ' + feD5 +
                    '/100). Isso indica que nem todas as funções expostas no backend são chamadas adequadamente pelo frontend, ou vice-versa.'
        });
      }
    }

    // ── Insight 6: Módulos pipeline com UX fraca ──
    var weakPipeline = matrix.filter(function(m) {
      return m.isPipeline && m.hasHtml && m.feScore !== null && m.feScore < 55;
    });
    if (weakPipeline.length > 0) {
      insights.push({
        type:     'pipeline-ux',
        severity: 'warn',
        title:    weakPipeline.length + ' etapa(s) do pipeline com UX deficiente',
        body:     'As seguintes etapas do pipeline de recomendação têm interfaces abaixo do esperado: ' +
                  weakPipeline.map(function(m){ return m.name + ' (' + m.feScore + '/100)'; }).join(', ') +
                  '. Isso impacta diretamente a experiência do aluno ao navegar pelas recomendações.'
      });
    }

    // ── Insight 7: Pontos positivos ──
    var excellentModules = matrix.filter(function(m) {
      return m.hasHtml && m.gapStatus === 'balanced' && m.integrated >= 85;
    });
    if (excellentModules.length > 0) {
      insights.push({
        type:     'excellence',
        severity: 'good',
        title:    excellentModules.length + ' módulo(s) de referência (BE+FE equilibrados)',
        body:     'Esses módulos têm backend sólido e frontend premium — servem como referência de qualidade para todo o projeto: ' +
                  excellentModules.map(function(m) { return m.name; }).join(', ') + '.'
      });
    }

    return insights;
  } catch (error) {
    Logger.log("Erro em _generateInsights_: " + error.message);
    throw error;
  }
}

// ─── Recomendações Integradas ──────────────────────────────────────────────────

/**
 * Combina e prioriza recomendações de backend e frontend,
 * adicionando recomendações de integração específicas.
 * @param {string[]} beRecs
 * @param {string[]} feRecs
 * @param {Array<Object>} matrix
 * @return {Array<Object>} Recomendações com metadados de origem e impacto.
 */
function _mergeRecommendations_(beRecs, feRecs, matrix) {
  try {
    var result = [];

    // Recomendações de integração (específicas do Hub)
    var gapStats = _computeGapStats_(matrix);

    if (gapStats.priorityUi.length > 0) {
      result.push({
        source:  'hub',
        impact:  'high',
        label:   '🔗 Integração',
        text:    'Priorizar refatoração visual de ' + gapStats.priorityUi.length + ' módulo(s) cujo backend já está maduro mas a UI está defasada: ' +
                 gapStats.priorityUi.map(function(m){return m.name;}).join(', ') + '.'
      });
    }

    if (gapStats.noHtml > 0) {
      var coreNoUi = matrix.filter(function(m) { return m.gapStatus === 'no-ui' && m.isCore; });
      if (coreNoUi.length > 0) {
        result.push({
          source: 'hub',
          impact: 'high',
          label:  '🔗 Integração',
          text:   'Criar sidebars HTML para módulos core sem UI: ' + coreNoUi.map(function(m){return m.name;}).join(', ') + '.'
        });
      }
    }

    var pipelineWeak = matrix.filter(function(m) { return m.isPipeline && m.hasHtml && m.feScore < 55; });
    if (pipelineWeak.length > 0) {
      result.push({
        source: 'hub',
        impact: 'high',
        label:  '🔗 Pipeline',
        text:   'Modernizar as interfaces das etapas do pipeline com UX deficiente: ' +
                pipelineWeak.map(function(m){return m.name;}).join(', ') + '.'
      });
    }

    result.push({
      source: 'hub',
      impact: 'medium',
      label:  '🔗 Arquitetura',
      text:   'Criar shared-styles.html com os design tokens do ReadingRecord.html para ser incluído via HtmlService.createTemplateFromFile() em todas as sidebars, garantindo 100% de consistência visual.'
    });

    // Recomendações do backend (primeiras 3)
    beRecs.slice(0, 3).forEach(function(r) {
      result.push({ source: 'backend', impact: 'medium', label: '⚙ Backend', text: r });
    });

    // Recomendações do frontend (primeiras 3)
    feRecs.slice(0, 3).forEach(function(r) {
      result.push({ source: 'frontend', impact: 'medium', label: '🎨 Frontend', text: r });
    });

    return result.slice(0, 10);
  } catch (error) {
    Logger.log("Erro em _mergeRecommendations_: " + error.message);
    throw error;
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Busca o score de uma dimensão pelo ID.
 * @param {Array<Object>} dimensions
 * @param {string} id
 * @return {number|null}
 */
function _getDimensionScore_(dimensions, id) {
  if (!dimensions) return null;
  for (var i = 0; i < dimensions.length; i++) {
    if (dimensions[i].id === id) return dimensions[i].score;
  }
  return null;
}

/**
 * Converte score combinado em nível de maturidade.
 * @param {number} score
 * @return {{ label: string, color: string, description: string }}
 */
function _hubScoreToLevel_(score) {
  if (score >= 92) return { label: '5 — Excelência',    color: '#22d3ee', description: 'Sistema full-stack maduro — backend e frontend coesos, sem gaps críticos.' };
  if (score >= 80) return { label: '4 — Avançado',      color: '#34d399', description: 'Sistema robusto com bom equilíbrio entre camadas. Pequenas inconsistências a corrigir.' };
  if (score >= 65) return { label: '3 — Funcional',     color: '#a3e635', description: 'Sistema funcional com desequilíbrios detectados entre backend e frontend.' };
  if (score >= 48) return { label: '2 — Em Progresso',  color: '#fbbf24', description: 'Backend ou frontend significativamente mais fraco — priorizar nivelamento.' };
  return             { label: '1 — Inicial',            color: '#f87171', description: 'Sistema em fase inicial. Ambas as camadas necessitam desenvolvimento.' };
}

// ─── Sidebar & Menu ────────────────────────────────────────────────────────────

/**
 * Abre o painel hub de maturidade integrada como sidebar.
 */
function openMaturityHubPanel() {
  try {
    var html = HtmlService
      .createTemplateFromFile('MaturityHubHtml').evaluate()
      .setTitle('Hub de Maturidade')
      .setWidth(560);
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    Logger.log("Erro em openMaturityHubPanel: " + error.message);
    throw error;
  }
}

/**
 * Registra o menu "🔬 Diagnóstico" unificado no Google Sheets.
 * Substitui os menus separados de backend e frontend.
 */
function addMaturityHubMenuItem() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🔬 Diagnóstico')
      .addItem('📊 Hub de Maturidade (Unificado)', 'openMaturityHubPanel')
      .addSeparator()
      .addItem('⚙ Somente Backend',  'openBackendMaturityPanel')
      .addItem('🎨 Somente Frontend', 'openFrontendMaturityPanel')
      .addToUi();
  } catch (error) {
    Logger.log("Erro em addMaturityHubMenuItem: " + error.message);
    throw error;
  }
}
