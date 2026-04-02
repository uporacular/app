/**
 * TrailSuggester.gs
 * Camada de apresentação e filtragem de sugestões de trilha.
 * Intermediário entre TrailRecommender/IA e a interface do usuário.
 * Aplica filtros de preferência, deduplicação e metadados de apresentação.
 */

var SUGGESTER_MAX_ITEMS = 6;
var CACHE_NS            = 'SUGG_';

/**
 * Retorna sugestões agregadas e processadas para o frontend.
 * Aplica filtros de preferência e remove duplicatas do histórico recente.
 * @param {string} userId  Opcional — usa sessão ativa se omitido.
 * @return {Object} Pacote de sugestões com metadados de UI.
 */
function getAggregatedSuggestions(userId) {
  var id    = userId || getAuthenticatedUserEmail();
  var cache = CacheService.getUserCache();
  var cacheKey = CACHE_NS + id;
  var cached   = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var recomData = generatePersonalizedTrail(id, 'Escolhas que queremos ler, possibilidades que podemos ser');

  if (recomData && recomData.recomendacoes) {
    recomData.recomendacoes = _deduplicateSuggestions(id, recomData.recomendacoes);
    recomData.recomendacoes = recomData.recomendacoes.slice(0, SUGGESTER_MAX_ITEMS);
    recomData.processedAt         = new Date().toISOString();
    recomData.recomendacoesCount  = recomData.recomendacoes.length;
    recomData.userId              = id;
  }

  cache.put(cacheKey, JSON.stringify(recomData), 300);
  return recomData;
}

/**
 * Remove sugestões já presentes no histórico de leitura recente do usuário.
 * @param {string} userId
 * @param {Array<Object>} suggestions
 * @return {Array<Object>} Lista filtrada.
 */
function _deduplicateSuggestions(userId, suggestions) {
  if (!suggestions || !suggestions.length) return [];

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var histSheet = ss.getSheetByName('Leituras');
  if (!histSheet) return suggestions;

  var data       = histSheet.getDataRange().getValues();
  var readTitles = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId)) {
      readTitles[String(data[i][2]).toLowerCase()] = true;
    }
  }

  return suggestions.filter(function(s) {
    return !readTitles[String(s.titulo || '').toLowerCase()];
  });
}

/**
 * Retorna sugestões filtradas por categoria específica.
 * @param {string} userId
 * @param {string} category
 * @return {Array<Object>}
 */
function getSuggestionsByCategory(userId, category) {
  var result = getAggregatedSuggestions(userId);
  if (!result || !result.recomendacoes) return [];
  return result.recomendacoes.filter(function(s) {
    return String(s.categoria || '').toLowerCase() === String(category).toLowerCase();
  });
}

/**
 * Invalida o cache de sugestões do usuário (ex: após nova leitura registrada).
 * @param {string} userId
 */
function invalidateSuggestionCache(userId) {
  CacheService.getUserCache().remove(CACHE_NS + userId);
}

/**
 * Serve a sidebar de sugestões de trilha via HtmlService.
 * @return {HtmlOutput}
 */
function serveTrailSuggesterUI() {
  return HtmlService
    .createHtmlOutputFromFile('TrailSuggester')
    .setTitle('UpOracular | Sugestões de Trilha');
}
