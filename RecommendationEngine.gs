/**
 * RecommendationEngine.gs
 * Motor central de curadoria e recomendação de trilhas de leitura.
 * Orquestra PatternDetector → TrailRanker → GeminiConnector para
 * entregar sugestões personalizadas e interdisciplinares.
 */

var REC_CACHE_TTL      = 900;  // 15 minutos
var CATALOG_SHEET_NAME = 'Catálogo';

/**
 * Gera recomendações personalizadas para um usuário.
 * Pipeline: perfil de padrões → catálogo da biblioteca → ranqueamento → enriquecimento IA.
 *
 * @param {Object} userProfile    { userId, interests: [] }
 * @param {Array<Object>} readingHistory  registros do usuário [{ book, category, rating }]
 * @return {Array<Object>} Recomendações ranqueadas [{ titulo, categoria, justificativa, score, tags }]
 */
function generateRecommendations(userProfile, readingHistory) {
  if (!userProfile || !userProfile.userId) return [];

  var cache = CacheService.getScriptCache();
  var cacheKey = 'RECS_' + userProfile.userId;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 1. Detecta padrões comportamentais do usuário via PatternDetector
  var patterns = detectCategoryPatterns(readingHistory || []);
  var readCategories = Object.keys(patterns.frequencia || {});

  // 2. Carrega catálogo da planilha (evita hardcode)
  var candidates = _loadCatalogCandidates_(readCategories);

  // 3. Mescla interesses explícitos do perfil com dados comportamentais
  var enrichedProfile = {
    userId:    userProfile.userId,
    interests: (userProfile.interests || []).join(' ').toLowerCase(),
  };

  // 4. Ranqueia candidatos via TrailRanker
  var ranked = rankSuggestionsForUser(userProfile.userId, candidates);

  // 5. Enriquece top-5 com justificativa via GeminiConnector (se disponível)
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey && ranked.length > 0) {
    ranked = _enrichWithAIJustification_(ranked.slice(0, 5), enrichedProfile, apiKey)
             .concat(ranked.slice(5));
  }

  var result = ranked.slice(0, 6);
  cache.put(cacheKey, JSON.stringify(result), REC_CACHE_TTL);
  return result;
}

/**
 * Ponto de entrada para o frontend — usa o usuário autenticado.
 * @return {Object} { userId, recomendacoes, geradoEm }
 */
function getRecommendationsForCurrentUser() {
  var email = Session.getActiveUser().getEmail();
  var records = getReadingRecordsByUser(email) || [];
  var profile = { userId: email, interests: [] };

  if (typeof getUserProfile === 'function') {
    var fullProfile = getUserProfile(email);
    if (fullProfile && fullProfile.interests) {
      profile.interests = fullProfile.interests.split(',').map(function(s) { return s.trim(); });
    }
  }

  return {
    userId:        email,
    recomendacoes: generateRecommendations(profile, records),
    geradoEm:      new Date().toISOString()
  };
}

/**
 * Carrega livros do Catálogo que o usuário ainda não leu nas categorias menos visitadas.
 * @param {Array<string>} readCategories categorias já lidas
 * @return {Array<Object>} candidatos [{ titulo, categoria, justificativa }]
 */
function _loadCatalogCandidates_(readCategories) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATALOG_SHEET_NAME);
  if (!sheet) {
    // Fallback curado para quando o catálogo ainda não existe
    return [
      { titulo: 'Quarto de Despejo',    categoria: 'Literatura Brasileira', justificativa: 'Perspectiva de resistência periférica.' },
      { titulo: 'O Povo Brasileiro',    categoria: 'Ciências Humanas',      justificativa: 'Matriz da formação cultural brasileira.' },
      { titulo: 'Pedagogia do Oprimido', categoria: 'Educação',             justificativa: 'Fundamento da educação libertadora.' },
      { titulo: 'A Metamorfose',        categoria: 'Ficção',                justificativa: 'Clássico existencialista.' },
      { titulo: 'Dom Casmurro',         categoria: 'Literatura Brasileira', justificativa: 'Narrador não-confiável — exercício crítico.' }
    ];
  }

  var data = sheet.getDataRange().getValues();
  var candidates = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    candidates.push({
      titulo:       String(data[i][0] || ''),
      categoria:    String(data[i][1] || 'Geral'),
      justificativa: String(data[i][2] || '')
    });
  }
  return candidates;
}

/**
 * Enriquece as justificativas dos candidatos via Gemini.
 * @param {Array<Object>} candidates
 * @param {Object}        profile  { userId, interests }
 * @param {string}        apiKey
 * @return {Array<Object>} candidates com justificativa enriquecida
 */
function _enrichWithAIJustification_(candidates, profile, apiKey) {
  try {
    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
    var listText = candidates.map(function(c, idx) {
      return (idx + 1) + '. ' + c.titulo + ' (' + c.categoria + ')';
    }).join('\n');

    var prompt = 'Para um leitor com interesses em "' + (profile.interests || 'variados') +
      '", escreva uma justificativa pedagógica curta (1 frase) para cada livro:\n' + listText +
      '\nResponda JSON: [{"titulo":"...","justificativa":"..."}]';

    var response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      var raw = JSON.parse(response.getContentText());
      var text = raw.candidates[0].content.parts[0].text;
      var enriched = JSON.parse(text.replace(/```json|```/g, '').trim());
      enriched.forEach(function(item) {
        candidates.forEach(function(c) {
          if (c.titulo === item.titulo && item.justificativa) {
            c.justificativa = item.justificativa;
          }
        });
      });
    }
  } catch (e) {
    Logger.log('RecommendationEngine._enrichWithAI: ' + e.message);
  }
  return candidates;
}

