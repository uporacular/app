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
 * @param {string} authToken Token da sessão web; a identidade vem da sessão.
 * @return {Object} Pacote de sugestões com metadados de UI.
 */
function getAggregatedSuggestions(authToken) {
  try {
    var sessionUser = typeof getUpOracularWebSessionUser_ === 'function'
      ? getUpOracularWebSessionUser_(authToken) : null;
    if (!sessionUser) throw new Error('Sessão inválida ou expirada.');
    var id = String(sessionUser.id || sessionUser.userId || sessionUser.email || sessionUser.username || '').trim();
    if (!id) throw new Error('Sessão sem identidade de usuário.');
    var cache = CacheService.getUserCache();
    var cacheKey = CACHE_NS + id;
    var cached   = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    var recomData = generatePersonalizedTrailForUser_(id, 'Escolhas que queremos ler, possibilidades que podemos ser');

    if (recomData && recomData.recomendacoes) {
      recomData.recomendacoes = _deduplicateSuggestions(id, recomData.recomendacoes);
      recomData.recomendacoes = recomData.recomendacoes.slice(0, SUGGESTER_MAX_ITEMS);
      recomData.processedAt         = new Date().toISOString();
      recomData.recomendacoesCount  = recomData.recomendacoes.length;
      recomData.userId              = id;
    }

    cache.put(cacheKey, JSON.stringify(recomData), 300);
    return recomData;
  } catch (error) {
    Logger.log("Erro em getAggregatedSuggestions: " + error.message);
    throw error;
  }
}

/**
 * Remove sugestões já presentes no histórico de leitura recente do usuário.
 * @param {string} userId Identidade interna já resolvida pela sessão autenticada.
 * @param {Array<Object>} suggestions
 * @return {Array<Object>} Lista filtrada.
 */
function _deduplicateSuggestions(userId, suggestions) {
  try {
    try {
      if (!suggestions || !suggestions.length) return [];

      var ss        = getBoundSpreadsheet_();
      var histSheet = ss.getSheetByName('Leituras');
      if (!histSheet) return suggestions;

      var data       = histSheet.getDataRange().getValues();
      var readTitles = {};
      var readAcervo = {};
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(userId)) {
          readTitles[String(data[i][2]).toLowerCase()] = true;
          if (data[i][7]) readAcervo[String(data[i][7])] = true;
        }
      }

      return suggestions.filter(function(s) {
        if (s.acervoId && readAcervo[String(s.acervoId)]) return false;
        return !readTitles[String(s.titulo || '').toLowerCase()];
      });
    } catch (error) {
      Logger.log("Erro em _deduplicateSuggestions: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _deduplicateSuggestions: " + error.message);
    throw error;
  }
}

/**
 * Retorna sugestões filtradas por categoria específica.
 * @param {string} authToken Token da sessão web.
 * @param {string} category
 * @return {Array<Object>}
 */
function getSuggestionsByCategory(authToken, category) {
  try {
    var result = getAggregatedSuggestions(authToken);
    if (!result || !result.recomendacoes) return [];
    return result.recomendacoes.filter(function(s) {
      return String(s.categoria || '').toLowerCase() === String(category).toLowerCase();
    });
  } catch (error) {
    Logger.log("Erro em getSuggestionsByCategory: " + error.message);
    throw error;
  }
}

/**
 * Invalida o cache de sugestões do usuário (ex: após nova leitura registrada).
 * @param {string} userId
 */
function invalidateSuggestionCache(userId) {
  try {
    try {
      CacheService.getUserCache().remove(CACHE_NS + userId);
    } catch (error) {
      Logger.log("Erro em invalidateSuggestionCache: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em invalidateSuggestionCache: " + error.message);
    throw error;
  }
}

/**
 * Serve a sidebar de sugestões de trilha via HtmlService.
 * @return {HtmlOutput}
 */
function serveTrailSuggesterUI() {
  return HtmlService
    .createTemplateFromFile('TrailSuggesterHtml').evaluate()
    .setTitle('UpOracular | Sugestões de Trilha');
}
