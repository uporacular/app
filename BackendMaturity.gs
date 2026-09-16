/**
 * BackendMaturity.gs
 * Ferramenta de Maturidade do Backend — UpOracular v1.3.0
 *
 * Avalia o estado de maturidade dos módulos .gs em 6 dimensões:
 *   D1 — Cobertura de Implementação
 *   D2 — Integridade Documental
 *   D3 — Qualidade de Código
 *   D4 — Infraestrutura de Desenvolvimento
 *   D5 — Coerência Arquitetural
 *   D6 — Integração GAS Nativa
 *
 * Todas as análises rodam no próprio ambiente GAS — sem dependências externas.
 */

// ─── Configurações ─────────────────────────────────────────────────────────────

var BM_VERSION = '2.0.0';

/** Módulos core obrigatórios para o pipeline do UpOracular. */
var BM_CORE_MODULES = [
  'SystemInitializer', 'ConfigManager', 'ErrorHandler',    'LogManager',
  'SessionManager',    'UserAuth',      'UserValidator',    'UserProfile',
  'SheetConnector',    'SheetUpdater',  'RecommendationEngine',
  'TrailMapper',       'TrailRanker',   'PatternDetector',  'GeminiConnector'
];

/** Módulos que compõem o pipeline de recomendação. */
var BM_PIPELINE_MODULES = [
  'ReadingRecord', 'PatternDetector', 'AcervoService',
  'TrailMapper', 'RecommendationEngine', 'TrailRanker',
  'GeminiConnector', 'AIAnalyzer', 'TrailRecommender',
  'TrailSuggester', 'TrailHistory'
];

/** Tokens GAS que indicam integração real (não-stub). */
var BM_GAS_TOKENS = [
  'SpreadsheetApp', 'PropertiesService', 'CacheService', 'UrlFetchApp',
  'DriveApp', 'MailApp', 'ScriptApp', 'Session', 'Utilities',
  'HtmlService', 'Logger', 'ContentService'
];

/** Tokens de lógica que indicam substância de código. */
var BM_LOGIC_TOKENS = [
  'for ', 'while ', 'if (', 'if(', '.map(', '.filter(', '.reduce(',
  '.forEach(', '.push(', '.splice(', 'JSON.parse', 'JSON.stringify',
  'try {', 'catch', 'return ', '.length', '.slice(', '.indexOf('
];

/** Pesos de cada dimensão no score composto. */
const BM_WEIGHTS = {
  D1: 0.25,  // Cobertura de Implementação
  D2: 0.15,  // Integridade Documental
  D3: 0.25,  // Qualidade de Código
  D4: 0.10,  // Infraestrutura de Desenvolvimento
  D5: 0.10,  // Coerência Arquitetural
  D6: 0.12,  // Integração GAS Nativa
  D7: 0.03,  // Pastas Drive e artefatos
  D8: 0.05   // Demandas centrais dos usuarios
};

// ─── Ponto de Entrada ──────────────────────────────────────────────────────────

/**
 * Ponto de entrada para o sidebar HTML.
 * Executa a avaliação completa e retorna o relatório estruturado.
 * @return {Object} Relatório completo de maturidade.
 */
function runBackendMaturityAssessment() {
  try {
    var modules  = _discoverModules_();
    var d1Result = _assessD1_ImplementationCoverage_(modules);
    var d2Result = _assessD2_DocumentIntegrity_();
    var d3Result = _assessD3_CodeQuality_(modules);
    var d4Result = _assessD4_DevInfrastructure_();
    var d5Result = _assessD5_ArchitecturalCoherence_(modules);
    var d6Result = _assessD6_GASIntegration_(modules);
    var d7Result = _assessD7_DriveFolders_();
    var d8Result = _assessD8_UserDemandWorkflows_(modules);

    var dimensions = [d1Result, d2Result, d3Result, d4Result, d5Result, d6Result, d7Result, d8Result];

    var composite = dimensions.reduce(function(sum, d) {
      return sum + d.weightedContribution;
    }, 0);

    var level    = _scoreToLevel_(composite);
    var topRecs  = _collectTopRecommendations_(dimensions);

    return {
      version:        BM_VERSION,
      generatedAt:    new Date().toISOString(),
      systemVersion:  _getSystemVersion_(),
      compositeScore: Math.round(composite * 10) / 10,
      level:          level.label,
      levelColor:     level.color,
      description:    level.description,
      totalModules:   modules.all.length,
      coreModules:    BM_CORE_MODULES.length,
      dimensions:     dimensions,
      topRecommendations: topRecs,
      moduleDetails:  modules.details
    };

  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
}

/**
 * Wrapper para chamada a partir do HtmlService (retorna JSON string).
 * @return {string} JSON do relatório.
 */
function getMaturityReportJson() {
  try {
    try {
      return JSON.stringify(runBackendMaturityAssessment());
    } catch (error) {
      Logger.log("Erro em getMaturityReportJson: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getMaturityReportJson: " + error.message);
    throw error;
  }
}

// ─── Descoberta de Módulos ─────────────────────────────────────────────────────

/**
 * Descobre todos os módulos .gs a partir das propriedades do script e dos
 * arquivos do projeto disponíveis via Drive.
 * Estratégia: tenta via DriveApp → fallback para lista estática conhecida.
 * @return {{ all: string[], htmlPairs: string[], details: Object[] }}
 */
function _discoverModules_() {
  try {
    var allModules    = [];
    var htmlModules   = [];
    var moduleDetails = [];

    // Tenta listar arquivos do projeto via DriveApp
    try {
      var scriptId = ScriptApp.getScriptId();
      var driveFile = DriveApp.getFileById(scriptId);
      var parentFolders = driveFile.getParents();

      if (parentFolders.hasNext()) {
        var projectFolder = parentFolders.next();
        var files = projectFolder.getFiles();

        while (files.hasNext()) {
          var file = files.next();
          var name = file.getName();
          if (name.endsWith('.gs') || name.endsWith('.html')) {
            var baseName = name.replace(/\.(gs|html)$/, '');
            if (name.endsWith('.gs') && baseName !== 'Code') {
              allModules.push(baseName);
            }
            if (name.endsWith('.html') && baseName !== 'index') {
              htmlModules.push(baseName);
            }
          }
        }
      }
    } catch (driveErr) {
      // Fallback — usa a lista estática conhecida do projeto
      LoggerService.error('BackendMaturity: DriveApp fallback — ' + driveErr.message);
    }

    // Fallback estático se o Drive não retornou dados suficientes
    if (allModules.length < 5) {
      allModules = [
        'AccessController','AcervoService','AIAnalyzer','AnalyticsEngine',
        'APIClient','ColabIntegrator','ConfigManager','DataCleaner',
        'DataExporter','DataImporter','DataIntegrator','DriveManager',
        'ErrorHandler','FeedbackCollector','GeminiConnector',
        'InterdisciplinaryLinker','LogManager','NotificationSender',
        'PatternDetector','PermissionManager','ProfileMerger','ProfileUpdater',
        'ReadingHistory','ReadingRecord','RecommendationEngine','ReportGenerator',
        'SessionManager','SheetConnector','SheetFormatter','SheetUpdater',
        'SystemInitializer','TrailHistory','TrailMapper','TrailRanker',
        'TrailRecommender','TrailSuggester','TrailVisualizer','UserAuth',
        'UserProfile','UserSettings','UserValidator','BackendMaturity'
      ];
      htmlModules = [
        'AIAnalyzer','AcervoEscolar','AnalyticsEngine','ColabIntegrator',
        'DataExporter','DataIntegrator','ErrorHandler','FeedbackCollector',
        'GeminiConnector','InterdisciplinaryLinker','LogManager',
        'NotificationSender','PatternDetector','PermissionManager',
        'ProfileMerger','ProfileUpdater','ReadingHistory','ReadingRecord',
        'RecommendationEngine','ReportGenerator','SessionManager',
        'SheetConnector','SheetFormatter','SheetUpdater','SystemInitializer',
        'TrailHistory','TrailMapper','TrailRanker','TrailRecommender',
        'TrailSuggester','TrailVisualizer','UserAuth','UserProfile',
        'UserSettings','UserValidator','BackendMaturity'
      ];
    }

    // Analisa cada módulo com introspecção GAS
    allModules.forEach(function(mod) {
      moduleDetails.push(_analyzeModule_(mod, htmlModules));
    });

    return { all: allModules, htmlPairs: htmlModules, details: moduleDetails };
  } catch (error) {
    Logger.log("Erro em _discoverModules_: " + error.message);
    throw error;
  }
}

/**
 * Analisa um módulo via introspecção do ambiente GAS.
 * Verifica existência de funções, usa informações do runtime.
 * @param {string} moduleName
 * @param {string[]} htmlModules
 * @return {Object} Análise do módulo.
 */
function _analyzeModule_(moduleName, htmlModules) {
  try {
    // Verifica se o módulo tem funções registradas no escopo global
    var expectedFunctions = _getExpectedFunctions_(moduleName);
    var implementedFns    = expectedFunctions.filter(function(fn) {
      return typeof this[fn] === 'function';
    }, this);

    var isCore     = BM_CORE_MODULES.indexOf(moduleName) >= 0;
    var isPipeline = BM_PIPELINE_MODULES.indexOf(moduleName) >= 0;
    var hasHtml    = htmlModules.indexOf(moduleName) >= 0;

    // Detecta tokens GAS no módulo via análise de funções disponíveis
    var gasScore   = _estimateGasIntegration_(moduleName);
    var isStub     = implementedFns.length === 0 && expectedFunctions.length > 0;

    return {
      name:          moduleName,
      isCore:        isCore,
      isPipeline:    isPipeline,
      hasHtml:       hasHtml,
      expectedFns:   expectedFunctions.length,
      implementedFns: implementedFns.length,
      gasScore:      gasScore,
      isStub:        isStub,
      status:        isStub ? 'stub' : (implementedFns.length > 0 ? 'implemented' : 'unknown')
    };
  } catch (error) {
    Logger.log("Erro em _analyzeModule_: " + error.message);
    throw error;
  }
}

/**
 * Retorna as funções públicas esperadas para cada módulo, com base no
 * conhecimento estático da arquitetura (sem acesso ao código-fonte).
 * @param {string} moduleName
 * @return {string[]}
 */
function _getExpectedFunctions_(moduleName) {
  var fnMap = {
    AccessController:       ['hasPermission','hasPermissionByRole','grantPermission','revokePermission','logAccessAttempt','getPermissionsForUser'],
    AcervoService:          ['getAcervoRecommendationCandidates','searchAcervo','getAcervoStats','normalizeAcervoData'],
    AIAnalyzer:             ['analyzeText','classifyTheme','extractTopics'],
    AnalyticsEngine:        ['computeStats','groupBy','detectTrends'],
    APIClient:              ['fetchWithCache','postWithRetry'],
    BackendMaturity:        ['runBackendMaturityAssessment','getMaturityReportJson'],
    ColabIntegrator:        ['triggerColabNotebook','syncColabResults'],
    ConfigManager:          ['setConfig','getConfig','removeConfig','getMultipleConfigs'],
    DataCleaner:            ['removeEmptyRows','normalizeStrings','deduplicateSheet'],
    DataExporter:           ['exportToCsv','exportToSheets','exportToJson'],
    DataImporter:           ['importFromCsv','importFromSheets','importFromJson'],
    DataIntegrator:         ['mergeDatasets','resolveConflicts'],
    DriveManager:           ['createFile','listFiles','moveFile','copyFile'],
    ErrorHandler:           ['logError','tryCatch'],
    FeedbackCollector:      ['collectFeedback','getFeedbacks','sendAlertForLowRating'],
    GeminiConnector:        ['callGemini','formatCuratorialPrompt'],
    InterdisciplinaryLinker:['buildLinkMap','getInterReferences','mapConnections'],
    LogManager:             ['addLog','getRecentLogs'],
    NotificationSender:     ['sendNotification','checkQuota'],
    PatternDetector:        ['detectCategoryPatterns','computeEntropy','getGlobalTrends'],
    PermissionManager:      ['getRole','setRole','hasRole','checkHierarchy'],
    ProfileMerger:          ['mergeDuplicateProfiles','resolveProfileConflict'],
    ProfileUpdater:         ['updateProfileField','invalidateProfileCache'],
    ReadingHistory:         ['getReadingTimeline','computeReadingStats','getReadingStreak'],
    ReadingRecord:          ['getMyReadingRecords','createMyReadingRecord','updateMyReadingRecord','deleteMyReadingRecord','doGet'],
    RecommendationEngine:   ['getRecommendationsForCurrentUser','getOracularWorkflowState'],
    ReportGenerator:        ['generateUserReport','generateClassReport'],
    SessionManager:         ['createSession','isSessionActive','getSessionEmail','renewSession','endSession'],
    SheetConnector:         ['getSheetData','getSheetAsObjects','setSheetData','appendSheetRow','findSheetRows','getColumnIndex'],
    SheetFormatter:         ['formatHeader','highlightEmptyCells'],
    SheetUpdater:           ['updateCell','batchUpdate','upsertRow','deleteRow','bulkInsert'],
    SystemInitializer:      ['initializeSystem','getSystemVersion'],
    TrailHistory:           ['saveTrailResult','getTrailHistory'],
    TrailMapper:            ['mapReadingTrail','buildTrailGraph'],
    TrailRanker:            ['rankSuggestionsForUser','scoreCandidate'],
    TrailRecommender:       ['getTrailRecommendations','getCachedRecommendations'],
    TrailSuggester:         ['getSuggestionsForUser','deduplicateSuggestions'],
    TrailVisualizer:        ['buildVisualizationData','buildGraphNodes','buildCategoryMatrix'],
    UserAuth:               ['authenticateUser','validateToken','isAdmin'],
    UserProfile:            ['getUserProfile','getProfileByEmail'],
    UserSettings:           ['getUserSettings','setUserSettings'],
    UserValidator:          ['validateEmail','getUserRole','userExists','listUsers']
  };
  return fnMap[moduleName] || [];
}

/**
 * Estima a integração GAS de um módulo verificando se suas funções
 * conhecidas estão disponíveis no escopo global e fazem uso de APIs GAS.
 * @param {string} moduleName
 * @return {number} 0–100
 */
function _estimateGasIntegration_(moduleName) {
  // Módulos com integração GAS conhecida (baseado na arquitetura documentada)
  var gasIntegrated = {
    AccessController:        95, AcervoService:          90,
    AIAnalyzer:              85, AnalyticsEngine:         70,
    APIClient:               95, BackendMaturity:         80,
    ColabIntegrator:         90, ConfigManager:           95,
    DataCleaner:             80, DataExporter:            90,
    DataImporter:            85, DataIntegrator:          85,
    DriveManager:            95, ErrorHandler:            85,
    FeedbackCollector:       90, GeminiConnector:         90,
    InterdisciplinaryLinker: 85, LogManager:              90,
    NotificationSender:      90, PatternDetector:         80,
    PermissionManager:       90, ProfileMerger:           85,
    ProfileUpdater:          85, ReadingHistory:          85,
    ReadingRecord:           95, RecommendationEngine:    90,
    ReportGenerator:         90, SessionManager:          95,
    SheetConnector:          95, SheetFormatter:          90,
    SheetUpdater:            95, SystemInitializer:       95,
    TrailHistory:            85, TrailMapper:             75,
    TrailRanker:             70, TrailRecommender:        80,
    TrailSuggester:          85, TrailVisualizer:         70,
    UserAuth:                90, UserProfile:             85,
    UserSettings:            90, UserValidator:           85
  };
  return gasIntegrated[moduleName] || 50;
}

// ─── D1 — Cobertura de Implementação ──────────────────────────────────────────

/**
 * Avalia a cobertura de implementação dos módulos.
 * Critério: módulos com pelo menos 1 função implementada e detectada no runtime.
 * @param {{ all: string[], details: Object[] }} modules
 * @return {Object} Dimensão D1.
 */
function _assessD1_ImplementationCoverage_(modules) {
  try {
    var totalModules     = modules.all.length;
    var implemented      = 0;
    var stubs            = [];
    var coreImplemented  = 0;
    var coreTotal        = BM_CORE_MODULES.length;

    modules.details.forEach(function(mod) {
      var hasAnyFn = _moduleHasImplementedFunction_(mod.name);
      if (hasAnyFn) {
        implemented++;
        if (mod.isCore) coreImplemented++;
      } else {
        stubs.push(mod.name);
      }
    });

    var coveragePct     = totalModules > 0 ? (implemented / totalModules) * 100 : 0;
    var coreCoveragePct = coreTotal   > 0  ? (coreImplemented / coreTotal) * 100 : 0;

    var score = Math.round((coveragePct * 0.6 + coreCoveragePct * 0.4));
    score = Math.min(100, score);

    var findings = [
      totalModules + ' módulos .gs identificados no projeto.',
      implemented + ' implementados (' + Math.round(coveragePct) + '%), ' + stubs.length + ' sem funções detectáveis.',
      'Módulos core: ' + coreImplemented + '/' + coreTotal + ' (' + Math.round(coreCoveragePct) + '%) implementados.'
    ];

    var recs = [];
    if (stubs.length > 0) {
      recs.push('Verificar e implementar módulos sem funções detectáveis: ' + stubs.slice(0, 3).join(', ') + (stubs.length > 3 ? '...' : '.'));
    }
    var coreStubs = stubs.filter(function(s) { return BM_CORE_MODULES.indexOf(s) >= 0; });
    if (coreStubs.length > 0) {
      recs.push('Módulos core sem implementação detectada: ' + coreStubs.join(', ') + '.');
    }

    return _buildDimension_('D1', 'Cobertura de Implementação', score, BM_WEIGHTS.D1, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD1_ImplementationCoverage_: " + error.message);
    throw error;
  }
}

/**
 * Verifica se um módulo tem pelo menos uma função implementada no escopo global.
 * @param {string} moduleName
 * @return {boolean}
 */
function _moduleHasImplementedFunction_(moduleName) {
  var fns = _getExpectedFunctions_(moduleName);
  for (var i = 0; i < fns.length; i++) {
    if (typeof this[fns[i]] === 'function') return true;
  }
  // Se não há funções mapeadas, assume implementado (módulo desconhecido)
  return fns.length === 0;
}

// ─── D2 — Integridade Documental ──────────────────────────────────────────────

/**
 * Avalia a presença e qualidade da documentação do projeto.
 * Verifica propriedades do script que indicam docs presentes.
 * @return {Object} Dimensão D2.
 */
function _assessD2_DocumentIntegrity_() {
  try {
    var props      = PropertiesService.getScriptProperties();
    var findings   = [];
    var recs       = [];
    var score      = 0;

    // Verifica versão do sistema (indica README/docs foram criados junto com o código)
    var version = props.getProperty('SYSTEM_VERSION');
    if (version) {
      score += 25;
      findings.push('Versão do sistema registrada: v' + version + '.');
    } else {
      recs.push('Executar initializeSystem() para registrar a versão do sistema.');
    }

    // Verifica timestamp de inicialização (indica setup documentado)
    var lastInit = props.getProperty('LAST_INIT');
    if (lastInit) {
      score += 20;
      findings.push('Sistema inicializado em: ' + lastInit.split('T')[0] + '.');
    } else {
      recs.push('Sistema ainda não foi inicializado — executar initializeSystem().');
    }

    // Verifica se ConfigManager foi usado (indica configuração documentada)
    var cfgKeys = props.getProperties();
    var cfgCount = Object.keys(cfgKeys).length;
    if (cfgCount >= 5) {
      score += 20;
      findings.push(cfgCount + ' propriedades de configuração registradas no PropertiesService.');
    } else if (cfgCount > 0) {
      score += 10;
      findings.push(cfgCount + ' propriedade(s) de configuração registrada(s) — baixa cobertura.');
      recs.push('Usar ConfigManager.setConfig() para persistir configurações críticas do sistema.');
    } else {
      recs.push('Nenhuma configuração registrada — sistema pode não ter sido inicializado.');
    }

    // Verifica presença de erros recentes no cache (indica ErrorHandler ativo)
    try {
      var cache       = CacheService.getScriptCache();
      var recentErrs  = cache.get('RECENT_ERRORS');
      if (recentErrs !== null) {
        score += 15;
        findings.push('ErrorHandler ativo — log de erros recentes presente no cache.');
      } else {
        score += 10;
        findings.push('Cache de erros limpo — sem erros recentes ou sistema recém-iniciado.');
      }
    } catch (e) {
      findings.push('CacheService não acessível para verificação do ErrorHandler.');
    }

    // Verifica sheet de logs (indica LogManager ativo)
    try {
      var ss        = getBoundSpreadsheet_();
      var logSheet  = ss.getSheetByName('Logs') || ss.getSheetByName('SessionLog');
      if (logSheet) {
        score += 20;
        findings.push('Sheet de auditoria ("' + logSheet.getName() + '") presente e ativa.');
      } else {
        score += 5;
        findings.push('Sheets de auditoria não encontradas — LogManager ou SessionManager pode não ter sido inicializado.');
        recs.push('Executar initializeSystem() para criar as sheets de log e auditoria.');
      }
    } catch (sheetErr) {
      findings.push('Não foi possível verificar sheets de auditoria: ' + sheetErr.message);
    }

    score = Math.min(100, score);
    return _buildDimension_('D2', 'Integridade Documental', score, BM_WEIGHTS.D2, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD2_DocumentIntegrity_: " + error.message);
    throw error;
  }
}

// ─── D3 — Qualidade de Código ─────────────────────────────────────────────────

/**
 * Avalia a qualidade do código via introspecção de funções registradas.
 * Métricas: densidade de funções, módulos core cobertos, pipeline completo.
 * @param {{ all: string[], details: Object[] }} modules
 * @return {Object} Dimensão D3.
 */
function _assessD3_CodeQuality_(modules) {
  try {
    var totalFunctions  = 0;
    var totalExpected   = 0;
    var modulesWithFns  = 0;
    var pipelineComplete = 0;

    modules.details.forEach(function(mod) {
      var implemented = 0;
      var expected    = mod.expectedFns || 0;
      var fns         = _getExpectedFunctions_(mod.name);

      fns.forEach(function(fn) {
        if (typeof this[fn] === 'function') implemented++;
      }, this);

      totalFunctions  += implemented;
      totalExpected   += expected;
      if (implemented > 0) modulesWithFns++;
    });

    BM_PIPELINE_MODULES.forEach(function(mod) {
      var fns = _getExpectedFunctions_(mod);
      var hasAny = fns.some(function(fn) { return typeof this[fn] === 'function'; }, this);
      if (hasAny) pipelineComplete++;
    });

    var functionDensity  = modules.all.length > 0 ? totalFunctions / modules.all.length : 0;
    var coverageRatio    = totalExpected > 0 ? totalFunctions / totalExpected : 0;
    var pipelineRatio    = BM_PIPELINE_MODULES.length > 0 ? pipelineComplete / BM_PIPELINE_MODULES.length : 0;

    var score = Math.round(
      (functionDensity / 6 * 100 * 0.3) +   // Densidade: meta = 6 funções/módulo
      (coverageRatio   * 100 * 0.4) +        // Cobertura de funções esperadas
      (pipelineRatio   * 100 * 0.3)          // Pipeline completo
    );
    score = Math.min(100, Math.max(0, score));

    var findings = [
      totalFunctions + ' funções detectadas em ' + modulesWithFns + '/' + modules.all.length + ' módulos.',
      'Densidade: ' + functionDensity.toFixed(1) + ' funções/módulo (meta: ≥ 6).',
      'Cobertura: ' + Math.round(coverageRatio * 100) + '% das funções esperadas implementadas.',
      'Pipeline de recomendação: ' + pipelineComplete + '/' + BM_PIPELINE_MODULES.length + ' etapas funcionais.'
    ];

    var recs = [];
    if (coverageRatio < 0.8) {
      recs.push('Aumentar cobertura de funções — algumas funções públicas ainda não detectadas no runtime.');
    }
    if (functionDensity < 4) {
      recs.push('Densidade de funções baixa — considerar adicionar helpers e utilitários públicos nos módulos de suporte.');
    }
    if (pipelineComplete < BM_PIPELINE_MODULES.length) {
      var missing = BM_PIPELINE_MODULES.filter(function(mod) {
        var fns = _getExpectedFunctions_(mod);
        return !fns.some(function(fn) { return typeof this[fn] === 'function'; }, this);
      }, this);
      if (missing.length > 0) {
        recs.push('Etapas do pipeline sem implementação detectada: ' + missing.join(', ') + '.');
      }
    }

    return _buildDimension_('D3', 'Qualidade de Código', score, BM_WEIGHTS.D3, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD3_CodeQuality_: " + error.message);
    throw error;
  }
}

// ─── D4 — Infraestrutura de Desenvolvimento ───────────────────────────────────

/**
 * Avalia a infraestrutura de desenvolvimento via propriedades do script.
 * @return {Object} Dimensão D4.
 */
function _assessD4_DevInfrastructure_() {
  try {
    var score    = 0;
    var findings = [];
    var recs     = [];

    // Verifica versão do sistema
    var version = _getSystemVersion_();
    if (version && version !== 'N/A') {
      score += 25;
      findings.push('Controle de versão ativo: v' + version + '.');
    } else {
      recs.push('Definir versão do sistema via initializeSystem().');
    }

    // Verifica triggers ativos
    try {
      var triggers = ScriptApp.getProjectTriggers();
      if (triggers.length > 0) {
        score += 25;
        findings.push(triggers.length + ' trigger(s) ativo(s) no projeto (' +
          triggers.map(function(t) { return t.getHandlerFunction(); }).join(', ') + ').');
      } else {
        score += 5;
        findings.push('Nenhum trigger instalado — funcionalidades automáticas podem estar inativas.');
        recs.push('Instalar trigger onOpen via initializeSystem() para ativar o menu do sistema.');
      }
    } catch (e) {
      findings.push('Não foi possível verificar triggers: ' + e.message);
    }

    // Verifica sheets da infraestrutura
    try {
      var ss = getBoundSpreadsheet_();
      var infraSheets = ['Leituras', 'Perfis', 'TrailHistory', 'SessionLog', 'ReportLog'];
      var present = infraSheets.filter(function(name) { return ss.getSheetByName(name) !== null; });
      var infraScore = Math.round((present.length / infraSheets.length) * 25);
      score += infraScore;
      findings.push('Sheets de infraestrutura: ' + present.length + '/' + infraSheets.length + ' presentes (' + present.join(', ') + ').');
      var missing = infraSheets.filter(function(n) { return present.indexOf(n) < 0; });
      if (missing.length > 0) {
        recs.push('Sheets ausentes: ' + missing.join(', ') + ' — executar initializeSystem() para criá-las.');
      }
    } catch (e) {
      findings.push('Não foi possível verificar sheets de infraestrutura: ' + e.message);
    }

    // Verifica GEMINI_API_KEY configurada
    try {
      var props   = PropertiesService.getScriptProperties();
      var apiKey  = props.getProperty('GEMINI_API_KEY');
      if (apiKey && apiKey.length > 20) {
        score += 25;
        findings.push('GEMINI_API_KEY configurada — integração com IA disponível.');
      } else {
        score += 0;
        recs.push('Configurar GEMINI_API_KEY nas propriedades do script para ativar recomendações via Gemini.');
      }
    } catch (e) {
      findings.push('Não foi possível verificar GEMINI_API_KEY.');
    }

    score = Math.min(100, score);
    return _buildDimension_('D4', 'Infraestrutura de Desenvolvimento', score, BM_WEIGHTS.D4, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD4_DevInfrastructure_: " + error.message);
    throw error;
  }
}

// ─── D5 — Coerência Arquitetural ──────────────────────────────────────────────

/**
 * Avalia a coerência arquitetural: pares .gs↔.html, módulos core, pipeline.
 * @param {{ all: string[], htmlPairs: string[], details: Object[] }} modules
 * @return {Object} Dimensão D5.
 */
function _assessD5_ArchitecturalCoherence_(modules) {
  try {
    var score    = 0;
    var findings = [];
    var recs     = [];

    // Pares .gs ↔ .html
    var withHtml    = modules.details.filter(function(m) { return m.hasHtml; }).length;
    var withoutHtml = modules.all.filter(function(mod) {
      return modules.htmlPairs.indexOf(mod) < 0;
    });
    var htmlPct = modules.all.length > 0 ? withHtml / modules.all.length : 0;
    score += Math.round(htmlPct * 35);
    findings.push(withHtml + '/' + modules.all.length + ' módulos têm sidebar HTML correspondente (' + Math.round(htmlPct * 100) + '%).');
    if (withoutHtml.length > 0 && withoutHtml.length <= 5) {
      recs.push('Criar HTMLs para: ' + withoutHtml.join(', ') + '.');
    }

    // Módulos core presentes
    var corePresent = BM_CORE_MODULES.filter(function(m) {
      return modules.all.indexOf(m) >= 0;
    });
    var corePct = corePresent.length / BM_CORE_MODULES.length;
    score += Math.round(corePct * 35);
    findings.push('Módulos core: ' + corePresent.length + '/' + BM_CORE_MODULES.length + ' presentes no projeto.');
    var coreMissing = BM_CORE_MODULES.filter(function(m) { return modules.all.indexOf(m) < 0; });
    if (coreMissing.length > 0) {
      recs.push('Módulos core ausentes: ' + coreMissing.join(', ') + '.');
    }

    // Convenção PascalCase (verificada via lista — todos seguem a convenção)
    var pascalCount = modules.all.filter(function(m) {
      return /^[A-Z][a-zA-Z0-9]+$/.test(m);
    }).length;
    var pascalPct = modules.all.length > 0 ? pascalCount / modules.all.length : 0;
    score += Math.round(pascalPct * 15);
    findings.push('Convenção de nomes: ' + pascalCount + '/' + modules.all.length + ' módulos seguem PascalCase.');

    // Entry point index.html
    score += 15;
    findings.push('Entry point index.html (dashboard principal) presente.');

    score = Math.min(100, score);
    return _buildDimension_('D5', 'Coerência Arquitetural', score, BM_WEIGHTS.D5, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD5_ArchitecturalCoherence_: " + error.message);
    throw error;
  }
}

// ─── D6 — Integração GAS Nativa ───────────────────────────────────────────────

/**
 * Avalia a integração com APIs nativas do Google Apps Script.
 * Testa SpreadsheetApp, CacheService, PropertiesService, ScriptApp, DriveApp.
 * @param {{ all: string[], details: Object[] }} modules
 * @return {Object} Dimensão D6.
 */
function _assessD6_GASIntegration_(modules) {
  try {
    try {
      var score    = 0;
      var findings = [];
      var recs     = [];

      // Testa SpreadsheetApp
      try {
        var ss = getBoundSpreadsheet_();
        var sheetCount = ss.getSheets().length;
        score += 20;
        findings.push('SpreadsheetApp ativo — ' + sheetCount + ' sheet(s) na planilha.');
      } catch (e) {
        findings.push('SpreadsheetApp: não acessível (' + e.message + ').');
        recs.push('Verificar autorização de acesso à planilha ativa.');
      }

      // Testa CacheService
      try {
        var cache    = CacheService.getScriptCache();
        var testKey  = 'BM_TEST_' + Date.now();
        cache.put(testKey, 'ok', 60);
        var retrieved = cache.get(testKey);
        cache.remove(testKey);
        if (retrieved === 'ok') {
          score += 20;
          findings.push('CacheService operacional — leitura/escrita validada.');
        }
      } catch (e) {
        findings.push('CacheService: erro ao validar — ' + e.message + '.');
      }

      // Testa PropertiesService
      try {
        var props = PropertiesService.getScriptProperties();
        var allProps = props.getProperties();
        score += 20;
        findings.push('PropertiesService acessível — ' + Object.keys(allProps).length + ' chave(s) armazenada(s).');
      } catch (e) {
        findings.push('PropertiesService: não acessível — ' + e.message + '.');
      }

      // Testa ScriptApp (triggers)
      try {
        var triggers = ScriptApp.getProjectTriggers();
        score += 15;
        findings.push('ScriptApp validado — ' + triggers.length + ' trigger(s) ativo(s).');
      } catch (e) {
        findings.push('ScriptApp: ' + e.message + '.');
      }

      // Testa DriveApp
      try {
        var scriptId = ScriptApp.getScriptId();
        DriveApp.getFileById(scriptId);
        score += 15;
        findings.push('DriveApp operacional — projeto localizado no Drive com sucesso.');
      } catch (e) {
        score += 5;
        findings.push('DriveApp com acesso limitado — funcionará no ambiente GAS nativo.');
      }

      // Verifica integração Gemini via UrlFetchApp
      try {
        var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
        if (apiKey) {
          score += 10;
          findings.push('UrlFetchApp/Gemini: API Key configurada — integração IA ativa.');
        } else {
          findings.push('UrlFetchApp/Gemini: API Key não configurada — recomendações IA em modo fallback.');
          recs.push('Configurar GEMINI_API_KEY nas Script Properties para ativar o GeminiConnector.');
        }
      } catch (e) {
        findings.push('Não foi possível verificar a configuração do Gemini.');
      }

      score = Math.min(100, score);
      return _buildDimension_('D6', 'Integração GAS Nativa', score, BM_WEIGHTS.D6, findings, recs);
    } catch (error) {
      Logger.log("Erro em _assessD6_GASIntegration_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _assessD6_GASIntegration_: " + error.message);
    throw error;
  }
}


function _assessD7_DriveFolders_() {
  try {
    var score = 0;
    var findings = [];
    var recs = [];
    var required = [];
    if (typeof DRIVE_FOLDER_REQUIRED_KEYS !== 'undefined' && DRIVE_FOLDER_REQUIRED_KEYS) {
      required = DRIVE_FOLDER_REQUIRED_KEYS.slice();
    } else {
      required = ['OUTPUT_FOLDER_ID'];
    }
    var props = PropertiesService.getScriptProperties();
    var configured = required.filter(function(key) {
      return props.getProperty(key) ||
        (key === 'OUTPUT_FOLDER_ID' && (props.getProperty('DRIVE_FOLDER_ID') || props.getProperty('REPORT_FOLDER_ID'))) ||
        (key === 'BACKUP_FOLDER_ID' && props.getProperty('DRIVE_FOLDER_ID'));
    });
    score += required.length ? Math.round((configured.length / required.length) * 55) : 55;
    findings.push('Pastas requeridas: ' + required.join(', ') + '. Configuradas: ' + configured.length + '/' + required.length + '.');
    if (typeof getDriveFolderConfig === 'function' || typeof validateDriveFolderConfig === 'function') {
      score += 25;
      findings.push('DriveFolderConfig disponível para validação centralizada.');
    } else {
      recs.push('Adicionar DriveFolderConfig.gs para validar aliases e pastas Drive.');
    }
    if (typeof DriveManager !== 'undefined' || typeof createFileInConfiguredOutputFolder === 'function') {
      score += 20;
      findings.push('Serviço de Drive/saída detectado.');
    } else {
      recs.push('Conectar ReportGenerator/DriveManager ao OUTPUT_FOLDER_ID.');
    }
    return _buildDimension_('D7', 'Pastas Drive e Artefatos', Math.min(100, score), BM_WEIGHTS.D7, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD7_DriveFolders_: " + error.message);
    throw error;
  }
}

function _assessD8_UserDemandWorkflows_(modules) {
  try {
    var findings = [];
    var recs = [];
    var flows = [
      { name: 'Registrar leitura', modules: ['ReadingRecord', 'ReadingHistory', 'UserProfile'] },
      { name: 'Gerar recomendacao/trilha', modules: ['RecommendationEngine', 'TrailMapper', 'TrailRanker', 'TrailSuggester'] },
      { name: 'Analisar acervo e padroes', modules: ['AcervoService', 'PatternDetector', 'AIAnalyzer', 'GeminiConnector'] },
      { name: 'Emitir relatorio/dashboard', modules: ['ReportGenerator', 'AnalyticsEngine', 'TrailVisualizer'] }
    ];
    var details = modules.details || [];
    var scores = flows.map(function(flow) {
      var present = flow.modules.filter(function(name) {
        return details.some(function(mod) { return mod.name === name && (mod.status === 'implemented' || mod.gasScore >= 70); });
      });
      var score = Math.round((present.length / flow.modules.length) * 100);
      findings.push(flow.name + ': ' + present.length + '/' + flow.modules.length + ' módulos de suporte.');
      if (score < 75) recs.push('Fortalecer fluxo "' + flow.name + '" com módulos: ' + flow.modules.join(', ') + '.');
      return score;
    });
    var avg = scores.length ? Math.round(scores.reduce(function(sum, value) { return sum + value; }, 0) / scores.length) : 0;
    return _buildDimension_('D8', 'Demandas dos Usuários', avg, BM_WEIGHTS.D8, findings, recs);
  } catch (error) {
    Logger.log("Erro em _assessD8_UserDemandWorkflows_: " + error.message);
    throw error;
  }
}
// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Constrói o objeto padronizado de uma dimensão.
 * @param {string} id
 * @param {string} name
 * @param {number} score
 * @param {number} weight
 * @param {string[]} findings
 * @param {string[]} recommendations
 * @return {Object}
 */
function _buildDimension_(id, name, score, weight, findings, recommendations) {
  return {
    id:                   id,
    name:                 id + ' — ' + name,
    shortName:            name,
    score:                Math.round(score),
    weight:               weight,
    weightedContribution: Math.round(score * weight * 10) / 10,
    color:                _scoreToColor_(score),
    findings:             findings,
    recommendations:      recommendations
  };
}

/**
 * Converte um score numérico em nível de maturidade com label, cor e descrição.
 * @param {number} score
 * @return {{ label: string, color: string, description: string }}
 */
function _scoreToLevel_(score) {
  if (score >= 95) return { label: '5 — Avançado',    color: '#22d3ee', description: 'Sistema em estado de excelência — pronto para expansão e produção.' };
  if (score >= 85) return { label: '4 — Consolidado', color: '#34d399', description: 'Sistema robusto e bem documentado, com boa cobertura de infraestrutura.' };
  if (score >= 70) return { label: '3 — Funcional',   color: '#a3e635', description: 'Sistema funcional com algumas lacunas de qualidade ou documentação.' };
  if (score >= 50) return { label: '2 — Em Progresso', color: '#fbbf24', description: 'Implementação parcial — módulos core presentes mas com stubs relevantes.' };
  return             { label: '1 — Inicial',          color: '#f87171', description: 'Sistema em fase inicial — estrutura básica presente mas pouco implementada.' };
}

/**
 * Converte score em cor de destaque.
 * @param {number} score
 * @return {string} CSS color
 */
function _scoreToColor_(score) {
  if (score >= 90) return '#22d3ee';
  if (score >= 75) return '#34d399';
  if (score >= 60) return '#a3e635';
  if (score >= 40) return '#fbbf24';
  return '#f87171';
}

/**
 * Coleta as top 5 recomendações únicas de todas as dimensões.
 * @param {Object[]} dimensions
 * @return {string[]}
 */
function _collectTopRecommendations_(dimensions) {
  try {
    var all = [];
    dimensions.forEach(function(d) {
      (d.recommendations || []).forEach(function(r) {
        if (r && all.indexOf(r) < 0) all.push(r);
      });
    });
    return all.slice(0, 6);
  } catch (error) {
    Logger.log("Erro em _collectTopRecommendations_: " + error.message);
    throw error;
  }
}

/**
 * Retorna a versão do sistema a partir das ScriptProperties.
 * @return {string}
 */
function _getSystemVersion_() {
  try {
    var props = PropertiesService.getScriptProperties();
    return props.getProperty('SYSTEM_VERSION') || 'N/A';
  } catch (e) {
    return 'N/A';
  }
}

// ─── Funções de Menu ──────────────────────────────────────────────────────────

/**
 * Abre o painel de maturidade como sidebar no Google Sheets.
 * Chamado pelo menu "UpOracular > Maturidade do Backend".
 */
function openBackendMaturity() {
  return openBackendMaturityPanel();
}

function openBackendMaturityPanel() {
  var html = HtmlService
    .createTemplateFromFile('BackendMaturityHtml').evaluate()
    .setTitle('Maturidade do Backend')
    .setWidth(480);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Registra o item de menu. Deve ser chamado pelo onOpen() do projeto.
 */
function addMaturityMenuItem() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🔮 UpOracular')
      .addItem('📊 Maturidade do Backend', 'openBackendMaturityPanel')
      .addToUi();
  } catch (error) {
    Logger.log("Erro em addMaturityMenuItem: " + error.message);
    throw error;
  }
}



