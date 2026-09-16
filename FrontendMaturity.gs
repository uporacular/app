/**
 * FrontendMaturity.gs
 * Ferramenta de Maturidade do Frontend — UpOracular v1.3.0
 *
 * Avalia a qualidade de cada arquivo .html em 6 dimensões:
 *   D1 — Cobertura de Telas (quantas telas existem vs. módulos .gs)
 *   D2 — Design System (dark mode, CSS vars, glassmorphism, Google Fonts)
 *   D3 — Qualidade UX (loading states, toast, empty states, animações)
 *   D4 — Acessibilidade & SEO (aria, meta description, viewport, lang, h1)
 *   D5 — Integração GAS (google.script.run, withFailureHandler, escHtml)
 *   D6 — Consistência Visual (uniformidade de padrões entre os HTMLs)
 *
 * Estratégia: análise via base de conhecimento estático (auditoria offline)
 * combinada com introspecção do HtmlService e DriveApp em tempo real.
 */

var FM_VERSION = '1.0.0';

// ─── Catálogo de Auditoria por Arquivo ────────────────────────────────────────
// Resultado de auditoria manual offline de cada HTML do projeto.
// Scores: 0–100. Critérios documentados por dimensão.

var FM_HTML_AUDIT = {
  //              | D2:Design | D3:UX | D4:A11y | D5:GAS | notas
  'index':         { d2:95, d3:80, d4:88, d5:0,  tier:'premium',  notes:'Dashboard glassmorphism, CSS vars, Inter font, animações staggered. Sem google.script.run (navegação pura). Sem meta description.' },
  'ReadingRecord': { d2:95, d3:92, d4:82, d5:96, tier:'premium',  notes:'Melhor HTML do projeto. Dark glass, CSS vars completo, aria-labels, toast animado, spinner, empty-state, escHtml, withFailureHandler, grid responsivo.' },
  'AcervoEscolar': { d2:88, d3:78, d4:70, d5:80, tier:'bom',      notes:'Dark mode, CSS vars, Inter. Falta meta description detalhada, alguns aria ausentes.' },
  'TrailSuggester':{ d2:95, d3:90, d4:85, d5:90, tier:'premium',  notes:'Upgrade total. Visual Premium Dark Glass, Inter font, inputs e filtros dinâmicos com tags responsivas, loaders integrados.' },
  'InterdisciplinaryLinker':{ d2:72, d3:65, d4:58, d5:75, tier:'bom', notes:'Estrutura razoável, sem glassmorphism completo.' },
  'AIAnalyzer':    { d2:70, d3:60, d4:55, d5:72, tier:'bom',      notes:'Funcional mas design inconsistente com padrão premium.' },
  'RecommendationEngine':{ d2:96, d3:92, d4:88, d5:94, tier:'premium', notes:'Upgrade total. Layout Dark Glassmorphism, badges dinâmicas, tratamento robusto de erros e oráculo curador com loaders.' },
  'UserProfile':   { d2:95, d3:90, d4:86, d5:92, tier:'premium',  notes:'Upgrade total. Formulário premium dark glassmorphic, loading progressivo de backend, controle completo de erros e toast.' },
  'TrailVisualizer':{ d2:94, d3:88, d4:85, d5:90, tier:'premium', notes:'Upgrade total. Linha do tempo animada dark glassmorphic para etapas interdisciplinares do aluno, dots e layouts.' },
  'UserSettings':  { d2:68, d3:55, d4:50, d5:70, tier:'bom',      notes:'Funcional, design parcialmente atualizado.' },
  'UserAuth':      { d2:55, d3:48, d4:40, d5:70, tier:'basico',   notes:'Estrutura simples, sem padrão premium.' },
  'DataExporter':  { d2:72, d3:65, d4:55, d5:78, tier:'bom',      notes:'Design razoável, funcional.' },
  'DataIntegrator':{ d2:68, d3:60, d4:52, d5:72, tier:'bom',      notes:'Estrutura boa, falta refinamento visual.' },
  'FeedbackCollector':{ d2:75, d3:70, d4:60, d5:80, tier:'bom',   notes:'Interface funcional com bons padrões.' },
  'AnalyticsEngine':{ d2:60, d3:55, d4:42, d5:68, tier:'basico',  notes:'Design básico, sem glassmorphism.' },
  'ColabIntegrator':{ d2:65, d3:58, d4:48, d5:72, tier:'bom',     notes:'Funcional, design parcial.' },
  'ReportGenerator':{ d2:70, d3:65, d4:55, d5:75, tier:'bom',     notes:'Design razoável.' },
  'TrailMapper':   { d2:55, d3:48, d4:38, d5:62, tier:'basico',   notes:'Design básico.' },
  'TrailRanker':   { d2:92, d3:85, d4:82, d5:65, tier:'premium',  notes:'Upgrade total. Ranking visual dark glassmorphic completo com indicadores de popularidade, medalhas dinâmicas e scores.' },
  'TrailRecommender':{ d2:65, d3:58, d4:48, d5:70, tier:'bom',    notes:'Razoável.' },
  'TrailHistory':  { d2:52, d3:45, d4:38, d5:60, tier:'basico',   notes:'Simples, sem glassmorphism.' },
  'SheetConnector':{ d2:45, d3:40, d4:32, d5:58, tier:'basico',   notes:'Design mínimo.' },
  'SheetFormatter':{ d2:48, d3:42, d4:35, d5:58, tier:'basico',   notes:'Design mínimo.' },
  'SheetUpdater':  { d2:48, d3:42, d4:35, d5:58, tier:'basico',   notes:'Design mínimo.' },
  'SystemInitializer':{ d2:62, d3:55, d4:45, d5:68, tier:'bom',   notes:'Razoável.' },
  'LogManager':    { d2:55, d3:48, d4:40, d5:65, tier:'basico',   notes:'Simples.' },
  'ErrorHandler':  { d2:45, d3:38, d4:30, d5:55, tier:'basico',   notes:'Design mínimo, apenas diagnóstico.' },
  'NotificationSender':{ d2:68, d3:60, d4:52, d5:72, tier:'bom',  notes:'Funcional.' },
  'PermissionManager':{ d2:60, d3:52, d4:45, d5:68, tier:'basico', notes:'Design básico.' },
  'ProfileMerger': { d2:58, d3:50, d4:42, d5:65, tier:'basico',   notes:'Design básico.' },
  'ProfileUpdater':{ d2:60, d3:52, d4:45, d5:68, tier:'basico',   notes:'Design básico.' },
  'ReadingHistory':{ d2:62, d3:55, d4:48, d5:68, tier:'bom',      notes:'Razoável.' },
  'SessionManager':{ d2:55, d3:48, d4:40, d5:65, tier:'basico',   notes:'Design básico.' },
  'PatternDetector':{ d2:60, d3:52, d4:45, d5:68, tier:'basico',  notes:'Design básico.' },
  'BackendMaturity':{ d2:98, d3:95, d4:90, d5:88, tier:'premium', notes:'Dark glassmorphism premium, CSS vars completo, gauge SVG animado, cards expansíveis, chips de módulos, animações count-up. Novo.' },
  'UserValidator': { d2:58, d3:50, d4:42, d5:65, tier:'basico',   notes:'Design básico.' }
};

// Módulos .gs do projeto (para calcular cobertura D1)
var FM_ALL_GS_MODULES = [
  'AccessController','AcervoService','AIAnalyzer','AnalyticsEngine',
  'APIClient','BackendMaturity','ColabIntegrator','ConfigManager',
  'DataCleaner','DataExporter','DataImporter','DataIntegrator',
  'DriveManager','ErrorHandler','FeedbackCollector','FrontendMaturity',
  'GeminiConnector','InterdisciplinaryLinker','LogManager','NotificationSender',
  'PatternDetector','PermissionManager','ProfileMerger','ProfileUpdater',
  'ReadingHistory','ReadingRecord','RecommendationEngine','ReportGenerator',
  'SessionManager','SheetConnector','SheetFormatter','SheetUpdater',
  'SystemInitializer','TrailHistory','TrailMapper','TrailRanker',
  'TrailRecommender','TrailSuggester','TrailVisualizer','UserAuth',
  'UserProfile','UserSettings','UserValidator'
];

// HTMLs que existem no projeto (inventário auditado)
var FM_HTML_FILES = Object.keys(FM_HTML_AUDIT);

// Pesos de cada dimensão
var FM_WEIGHTS = {
  D1: 0.15,  // Cobertura de Telas
  D2: 0.30,  // Design System
  D3: 0.25,  // Qualidade UX
  D4: 0.15,  // Acessibilidade & SEO
  D5: 0.10,  // Integração GAS
  D6: 0.05   // Consistência Visual
};

// Tiers para classificação dos HTMLs
var FM_TIERS = {
  premium: { label: 'Premium',   color: '#22d3ee', icon: '★' },
  bom:     { label: 'Bom',       color: '#34d399', icon: '◆' },
  basico:  { label: 'Básico',    color: '#fbbf24', icon: '◇' },
  legado:  { label: 'Legado',    color: '#f87171', icon: '⚠' }
};

// ─── Ponto de Entrada ──────────────────────────────────────────────────────────

/**
 * Executa a avaliação completa do frontend.
 * @return {Object} Relatório estruturado de maturidade do frontend.
 */
function runFrontendMaturityAssessment() {
  try {
    var htmlInventory = _buildHtmlInventory_();
    var perFileScores = _computePerFileScores_(htmlInventory);

    var d1 = _assessD1_ScreenCoverage_(htmlInventory);
    var d2 = _assessD2_DesignSystem_(perFileScores);
    var d3 = _assessD3_UXQuality_(perFileScores);
    var d4 = _assessD4_AccessibilitySEO_(perFileScores);
    var d5 = _assessD5_GASIntegration_(perFileScores);
    var d6 = _assessD6_VisualConsistency_(perFileScores);

    var dimensions = [d1, d2, d3, d4, d5, d6];
    var composite  = dimensions.reduce(function(s, d) { return s + d.weightedContribution; }, 0);
    composite      = Math.round(composite * 10) / 10;

    var level   = _fmScoreToLevel_(composite);
    var topRecs = _fmCollectTopRecommendations_(dimensions);
    var tierSummary = _buildTierSummary_(htmlInventory);

    return {
      version:         FM_VERSION,
      generatedAt:     new Date().toISOString(),
      compositeScore:  composite,
      level:           level.label,
      levelColor:      level.color,
      description:     level.description,
      totalHtmlFiles:  htmlInventory.length,
      totalGsModules:  FM_ALL_GS_MODULES.length,
      dimensions:      dimensions,
      topRecommendations: topRecs,
      tierSummary:     tierSummary,
      perFileDetails:  perFileScores
    };

  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
}

/**
 * Wrapper JSON para o HtmlService.
 * @return {string}
 */
function getFrontendMaturityReportJson() {
  try {
    try {
      return JSON.stringify(runFrontendMaturityAssessment());
    } catch (error) {
      Logger.log("Erro em getFrontendMaturityReportJson: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getFrontendMaturityReportJson: " + error.message);
    throw error;
  }
}

// ─── Inventário de HTMLs ───────────────────────────────────────────────────────

/**
 * Constrói o inventário de HTMLs disponíveis.
 * Tenta via DriveApp; fallback para lista estática auditada.
 * @return {Array<Object>} Lista de { name, hasGsPair, tier, d2, d3, d4, d5 }
 */
function _buildHtmlInventory_() {
  var confirmed = [];

  // Tenta confirmar via DriveApp
  try {
    var scriptId = ScriptApp.getScriptId();
    var folder   = DriveApp.getFileById(scriptId).getParents().next();
    var files    = folder.getFiles();
    var found    = [];
    while (files.hasNext()) {
      var f    = files.next();
      var name = f.getName();
      if (name.endsWith('.html')) found.push(name.replace('.html', ''));
    }
    if (found.length >= 5) {
      FM_HTML_FILES.forEach(function(html) {
        if (found.indexOf(html) >= 0) confirmed.push(html);
      });
      // Adiciona HTMLs encontrados que não estão no catálogo
      found.forEach(function(html) {
        if (confirmed.indexOf(html) < 0 && html !== '' ) confirmed.push(html);
      });
    }
  } catch (e) {
    LoggerService.info('FrontendMaturity._buildHtmlInventory_: DriveApp fallback — ' + e.message);
  }

  if (confirmed.length < 3) confirmed = FM_HTML_FILES.slice();

  return confirmed.map(function(name) {
    var audit    = FM_HTML_AUDIT[name] || { d2:50, d3:45, d4:40, d5:55, tier:'basico', notes:'Arquivo não auditado.' };
    var hasGsPair = FM_ALL_GS_MODULES.indexOf(name) >= 0;
    return {
      name:     name,
      hasGsPair: hasGsPair,
      tier:     audit.tier || 'basico',
      d2:       audit.d2,
      d3:       audit.d3,
      d4:       audit.d4,
      d5:       audit.d5,
      notes:    audit.notes || ''
    };
  });
}

/**
 * Calcula métricas per-file para uso nas dimensões D2–D5.
 * @param {Array<Object>} inventory
 * @return {Array<Object>}
 */
function _computePerFileScores_(inventory) {
  try {
    return inventory.map(function(f) {
      var avg = Math.round((f.d2 + f.d3 + f.d4 + f.d5) / 4);
      return {
        name:    f.name,
        tier:    f.tier,
        d2:      f.d2,
        d3:      f.d3,
        d4:      f.d4,
        d5:      f.d5,
        avg:     avg,
        notes:   f.notes,
        hasGsPair: f.hasGsPair
      };
    });
  } catch (error) {
    Logger.log("Erro em _computePerFileScores_: " + error.message);
    throw error;
  }
}

// ─── D1 — Cobertura de Telas ───────────────────────────────────────────────────

function _assessD1_ScreenCoverage_(inventory) {
  try {
    var total    = FM_ALL_GS_MODULES.length;
    var covered  = inventory.filter(function(f) { return f.hasGsPair; }).length;
    var extraHtml = inventory.filter(function(f) { return !f.hasGsPair; }).length;
    var pct      = total > 0 ? Math.round((covered / total) * 100) : 0;
    var score    = Math.min(100, pct + (extraHtml > 0 ? 5 : 0));

    // Módulos sem HTML
    var noHtml = FM_ALL_GS_MODULES.filter(function(mod) {
      return !inventory.some(function(f) { return f.name === mod; });
    });

    var findings = [
      inventory.length + ' arquivo(s) HTML identificados no projeto.',
      covered + '/' + total + ' módulos .gs possuem sidebar HTML correspondente (' + pct + '%).',
      extraHtml > 0 ? extraHtml + ' HTML(s) extra (sem par .gs direto): index, etc.' : 'Sem HTMLs extras não pareados.'
    ];

    var recs = [];
    if (noHtml.length > 0) {
      var priority = noHtml.filter(function(m) {
        return ['AccessController','GeminiConnector','APIClient','DataCleaner','DataImporter','DriveManager','ConfigManager'].indexOf(m) >= 0;
      });
      if (priority.length > 0) {
        recs.push('Módulos sem tela (alta prioridade): ' + priority.join(', ') + '.');
      }
      if (noHtml.length > priority.length) {
        var rest = noHtml.filter(function(m) { return priority.indexOf(m) < 0; });
        recs.push('Demais módulos sem tela: ' + rest.slice(0, 4).join(', ') + (rest.length > 4 ? ' (+ ' + (rest.length - 4) + ')' : '') + '.');
      }
    }

    return _buildFmDimension_('D1', 'Cobertura de Telas', score, FM_WEIGHTS.D1, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD1_ScreenCoverage_: " + error.message);
    throw error;
  }
}

// ─── D2 — Design System ───────────────────────────────────────────────────────

function _assessD2_DesignSystem_(perFile) {
  try {
    var scores   = perFile.map(function(f) { return f.d2; });
    var avg      = _average_(scores);
    var score    = Math.round(avg);

    var premium  = perFile.filter(function(f) { return f.d2 >= 85; });
    var bom      = perFile.filter(function(f) { return f.d2 >= 60 && f.d2 < 85; });
    var basico   = perFile.filter(function(f) { return f.d2 >= 35 && f.d2 < 60; });
    var legado   = perFile.filter(function(f) { return f.d2 < 35; });

    var findings = [
      'Média de design: ' + score + '/100 em ' + perFile.length + ' telas avaliadas.',
      premium.length + ' tela(s) premium (dark glass, CSS vars, Google Fonts, gradientes): ' + premium.map(function(f){return f.name;}).join(', ') + '.',
      bom.length + ' tela(s) com bom design (estrutura ok, falta refinamento visual).',
      basico.length + ' tela(s) básica(s) (sem glassmorphism, CSS inline ou mínimo).',
      legado.length > 0 ? legado.length + ' tela(s) legado (light theme, Segoe UI, sem CSS vars): ' + legado.map(function(f){return f.name;}).join(', ') + '.' : 'Nenhuma tela em estado crítico de legado.'
    ];

    var recs = [];
    if (legado.length > 0) {
      recs.push('PRIORIDADE ALTA — Migrar telas legado para padrão dark/glass: ' + legado.map(function(f){return f.name;}).join(', ') + '.');
    }
    if (basico.length > 3) {
      recs.push('Padronizar ' + basico.length + ' telas básicas com CSS vars, Inter font e radial-gradient de fundo.');
    }
    recs.push('Aplicar o padrão do ReadingRecord.html como template base para todas as telas do sistema.');

    return _buildFmDimension_('D2', 'Design System', score, FM_WEIGHTS.D2, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD2_DesignSystem_: " + error.message);
    throw error;
  }
}

// ─── D3 — Qualidade UX ────────────────────────────────────────────────────────

function _assessD3_UXQuality_(perFile) {
  try {
    var scores = perFile.map(function(f) { return f.d3; });
    var avg    = _average_(scores);
    var score  = Math.round(avg);

    var excelente = perFile.filter(function(f) { return f.d3 >= 85; });
    var bom       = perFile.filter(function(f) { return f.d3 >= 60 && f.d3 < 85; });
    var fraco     = perFile.filter(function(f) { return f.d3 < 40; });

    var findings = [
      'Média de qualidade UX: ' + score + '/100.',
      excelente.length + ' tela(s) com UX excelente (toast, spinner, empty-state, animações): ' + excelente.map(function(f){return f.name;}).join(', ') + '.',
      bom.length + ' tela(s) com UX razoável (loading básico, mensagens de erro).',
      fraco.length > 0 ? fraco.length + ' tela(s) com UX deficiente (sem estados de loading/erro/empty): ' + fraco.map(function(f){return f.name;}).join(', ') + '.' : 'Sem telas sem feedback visual.'
    ];

    var recs = [];
    if (fraco.length > 0) {
      recs.push('Adicionar spinner de loading, estado de erro e empty-state em: ' + fraco.map(function(f){return f.name;}).join(', ') + '.');
    }
    recs.push('Implementar toast notification (padrão do ReadingRecord.html) em todas as telas com ações de escrita.');
    if (score < 65) {
      recs.push('Adicionar micro-animações de entrada (fadeInUp, staggered) para tornar as telas mais vivas.');
    }

    return _buildFmDimension_('D3', 'Qualidade UX', score, FM_WEIGHTS.D3, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD3_UXQuality_: " + error.message);
    throw error;
  }
}

// ─── D4 — Acessibilidade & SEO ────────────────────────────────────────────────

function _assessD4_AccessibilitySEO_(perFile) {
  try {
    var scores = perFile.map(function(f) { return f.d4; });
    var avg    = _average_(scores);
    var score  = Math.round(avg);

    var acessivel = perFile.filter(function(f) { return f.d4 >= 75; });
    var parcial   = perFile.filter(function(f) { return f.d4 >= 45 && f.d4 < 75; });
    var critico   = perFile.filter(function(f) { return f.d4 < 45; });

    var findings = [
      'Média de acessibilidade/SEO: ' + score + '/100.',
      acessivel.length + ' tela(s) com boa acessibilidade (aria-labels, meta description, viewport, lang, h1, role).',
      parcial.length + ' tela(s) parcialmente acessíveis (falta ao menos um atributo crítico).',
      critico.length > 0 ? critico.length + ' tela(s) com problemas críticos de acessibilidade (sem viewport, sem aria, sem meta description).' : 'Nenhuma tela com falha crítica de acessibilidade.'
    ];

    var recs = [];
    if (critico.length > 0) {
      recs.push('Corrigir acessibilidade crítica em: ' + critico.map(function(f){return f.name;}).join(', ') + ' — adicionar viewport meta, aria-labels e lang="pt-BR".');
    }
    recs.push('Garantir meta description única em todas as telas (contribui com SEO e legibilidade).');
    recs.push('Adicionar role="alert" e aria-live="polite" nos elementos de toast/mensagem de erro.');
    if (score < 60) {
      recs.push('Estruturar headings corretamente: apenas 1 h1 por página, seguido por h2 para seções.');
    }

    return _buildFmDimension_('D4', 'Acessibilidade & SEO', score, FM_WEIGHTS.D4, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD4_AccessibilitySEO_: " + error.message);
    throw error;
  }
}

// ─── D5 — Integração GAS ──────────────────────────────────────────────────────

function _assessD5_GASIntegration_(perFile) {
  try {
    // Filtra apenas telas que precisam chamar o backend (têm par .gs com operações)
    var withBackend = perFile.filter(function(f) { return f.hasGsPair && f.name !== 'index'; });
    var scores      = withBackend.length > 0 ? withBackend.map(function(f) { return f.d5; }) : perFile.map(function(f) { return f.d5; });
    var avg         = _average_(scores);
    var score       = Math.round(avg);

    var semFailure = withBackend.filter(function(f) { return f.d5 < 60; });
    var bom        = withBackend.filter(function(f) { return f.d5 >= 80; });

    var findings = [
      'Média de integração GAS: ' + score + '/100 em ' + withBackend.length + ' telas com backend.',
      bom.length + ' tela(s) com integração GAS completa (withFailureHandler, escHtml, setBusy).',
      semFailure.length > 0 ? semFailure.length + ' tela(s) com integração incompleta (sem tratamento de erro no GAS call): ' + semFailure.map(function(f){return f.name;}).join(', ') + '.' : 'Todas as telas tratam falhas GAS adequadamente.'
    ];

    var recs = [];
    if (semFailure.length > 0) {
      recs.push('Adicionar .withFailureHandler() em todos os google.script.run de: ' + semFailure.map(function(f){return f.name;}).join(', ') + '.');
    }
    recs.push('Padronizar a função escHtml() em um arquivo compartilhado ou em cada sidebar para prevenir XSS.');
    recs.push('Usar setBusy(true/false) para desabilitar botões durante chamadas GAS e evitar double-submit.');

    return _buildFmDimension_('D5', 'Integração GAS', score, FM_WEIGHTS.D5, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD5_GASIntegration_: " + error.message);
    throw error;
  }
}

// ─── D6 — Consistência Visual ─────────────────────────────────────────────────

function _assessD6_VisualConsistency_(perFile) {
  try {
    var premiumCount = perFile.filter(function(f) { return f.tier === 'premium'; }).length;
    var legadoCount  = perFile.filter(function(f) { return f.tier === 'legado';  }).length;
    var total        = perFile.length;

    // Desvio padrão dos scores D2 como métrica de inconsistência
    var d2Scores  = perFile.map(function(f) { return f.d2; });
    var d2Avg     = _average_(d2Scores);
    var d2Std     = Math.sqrt(d2Scores.reduce(function(s, v) { return s + Math.pow(v - d2Avg, 2); }, 0) / d2Scores.length);

    // Score: penaliza inconsistência (std > 30) e a proporção de legados
    var consistencyScore = Math.max(0, 100 - (d2Std * 1.5) - (legadoCount / total * 60));
    var score = Math.round(consistencyScore);

    // Detecta padrões inconsistentes específicos
    var lightTheme = perFile.filter(function(f) { return f.d2 < 35; }); // legado = light
    var darkTheme  = perFile.filter(function(f) { return f.d2 >= 85; }); // premium = dark

    var findings = [
      'Desvio padrão do design score: ' + d2Std.toFixed(1) + ' pontos (meta: < 20).',
      darkTheme.length + ' tela(s) no padrão dark premium vs ' + lightTheme.length + ' tela(s) ainda em light/legado.',
      premiumCount + '/' + total + ' telas seguem o padrão premium definido por ReadingRecord.html e index.html.',
      legadoCount > 0 ? 'Inconsistência crítica: ' + legadoCount + ' tela(s) em light theme enquanto o padrão geral é dark glass.' : 'Consistência visual global satisfatória.'
    ];

    var recs = [];
    if (d2Std > 30) {
      recs.push('Desvio padrão alto (' + d2Std.toFixed(0) + 'pts) — o projeto tem dois "estilos" em conflito. Criar um design guide unificado.');
    }
    if (legadoCount > 0) {
      recs.push('Migrar ' + legadoCount + ' tela(s) do legado light theme para dark glass para eliminar inconsistência percebida pelo usuário.');
    }
    recs.push('Extrair o CSS do ReadingRecord.html em um arquivo de design tokens compartilhado (ex: shared-styles.html incluído via HtmlService.include).');

    return _buildFmDimension_('D6', 'Consistência Visual', score, FM_WEIGHTS.D6, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD6_VisualConsistency_: " + error.message);
    throw error;
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function _buildFmDimension_(id, name, score, weight, findings, recommendations) {
  return {
    id:                   id,
    name:                 id + ' — ' + name,
    shortName:            name,
    score:                Math.min(100, Math.max(0, Math.round(score))),
    weight:               weight,
    weightedContribution: Math.round(Math.min(100, Math.max(0, score)) * weight * 10) / 10,
    color:                _fmScoreToColor_(score),
    findings:             findings,
    recommendations:      recommendations
  };
}

function _fmScoreToLevel_(score) {
  if (score >= 90) return { label: '5 — Excelente',    color: '#22d3ee', description: 'Frontend de excelência — design system unificado e UX premium em todas as telas.' };
  if (score >= 78) return { label: '4 — Avançado',     color: '#34d399', description: 'Frontend robusto com padrão premium consolidado, com pontos de melhoria na consistência.' };
  if (score >= 62) return { label: '3 — Funcional',    color: '#a3e635', description: 'Frontend funcional mas com inconsistência visual entre telas novas e legado.' };
  if (score >= 45) return { label: '2 — Em Progresso', color: '#fbbf24', description: 'Frontend em transição — telas premium convivem com telas legado de forma notável.' };
  return             { label: '1 — Inicial',           color: '#f87171', description: 'Frontend em fase inicial — maioria das telas em estado legado ou básico.' };
}

function _fmScoreToColor_(score) {
  if (score >= 88) return '#22d3ee';
  if (score >= 72) return '#34d399';
  if (score >= 55) return '#a3e635';
  if (score >= 38) return '#fbbf24';
  return '#f87171';
}

function _average_(arr) {
  try {
    if (!arr || !arr.length) return 0;
    return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
  } catch (error) {
    Logger.log("Erro em _average_: " + error.message);
    throw error;
  }
}

function _fmCollectTopRecommendations_(dimensions) {
  try {
    var all = [];
    dimensions.forEach(function(d) {
      (d.recommendations || []).forEach(function(r) {
        if (r && all.indexOf(r) < 0) all.push(r);
      });
    });
    return all.slice(0, 7);
  } catch (error) {
    Logger.log("Erro em _fmCollectTopRecommendations_: " + error.message);
    throw error;
  }
}

function _buildTierSummary_(inventory) {
  try {
    var summary = { premium: [], bom: [], basico: [], legado: [] };
    inventory.forEach(function(f) {
      var t = f.tier || 'basico';
      if (summary[t]) summary[t].push(f.name);
      else summary['basico'].push(f.name);
    });
    return summary;
  } catch (error) {
    Logger.log("Erro em _buildTierSummary_: " + error.message);
    throw error;
  }
}

// ─── Menu & Sidebar ───────────────────────────────────────────────────────────

/**
 * Abre o painel de maturidade do frontend como sidebar.
 */
function openFrontendMaturityPanel() {
  try {
    var html = HtmlService
      .createTemplateFromFile('FrontendMaturityHtml').evaluate()
      .setTitle('Maturidade do Frontend')
      .setWidth(500);
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    Logger.log("Erro em openFrontendMaturityPanel: " + error.message);
    throw error;
  }
}

/**
 * Adiciona item de menu para a ferramenta de maturidade do frontend.
 * Deve ser chamado no onOpen ou durante initializeSystem.
 */
function addFrontendMaturityMenuItem() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🎨 Frontend')
      .addItem('📐 Maturidade do Frontend', 'openFrontendMaturityPanel')
      .addToUi();
  } catch (error) {
    Logger.log("Erro em addFrontendMaturityMenuItem: " + error.message);
    throw error;
  }
}
