/**
 * RecommendationEngine.gs
 * Motor central de curadoria e recomendação de trilhas de leitura.
 * Orquestra PatternDetector → TrailRanker → GeminiConnector para
 * entregar sugestões personalizadas e interdisciplinares.
 */

var REC_CACHE_TTL      = 900;  // 15 minutos
var CATALOG_SHEET_NAME = 'Catálogo';
var ACERVO_CATALOG_SHEET_NAME = 'Acervo';
var LEGACY_CATALOG_SHEET_NAMES = ['Catalogo', 'Catálogo'];

/**
 * Gera recomendações personalizadas para um usuário.
 * Pipeline: perfil de padrões → catálogo da biblioteca → ranqueamento → enriquecimento IA.
 *
 * @param {Object} userProfile    { userId, interests: [] }
 * @param {Array<Object>} readingHistory  registros do usuário [{ book, category, rating }]
 * @return {Array<Object>} Recomendações ranqueadas [{ titulo, categoria, justificativa, score, tags }]
 */
function generateRecommendations_(userProfile, readingHistory, options) {
  try {
    try {
      if (!userProfile || !userProfile.userId) return [];

      options = options || {};
      var cache = CacheService.getScriptCache();
      var historyKey = (readingHistory || []).map(function(record) {
        return String(record.id || record.acervoId || record.book || '');
      }).sort().join('|');
      var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, historyKey, Utilities.Charset.UTF_8);
      var cacheKey = 'RECS_ACERVO_V3_' + String(userProfile.userId).slice(0, 40) + '_' +
        Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '').slice(0, 12) + '_' + (options.allowAI ? 'ai' : 'local');
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // 1. Detecta padrões comportamentais do usuário via PatternDetector
      var patterns = detectCategoryPatterns(readingHistory || []);
      var readCategories = Object.keys(patterns.frequencia || {});

      // 2. Carrega catálogo da planilha (evita hardcode)
      var candidates = _loadCatalogCandidates_(readCategories).filter(function(candidate) {
        return !!candidate.acervoId;
      });
      var readIds = {};
      (readingHistory || []).forEach(function(record) {
        if (record.acervoId) readIds[String(record.acervoId)] = true;
      });
      candidates = candidates.filter(function(candidate) { return !readIds[String(candidate.acervoId)]; });

      // 3. Mescla interesses explícitos do perfil com dados comportamentais
      var enrichedProfile = {
        userId:    userProfile.userId,
        interests: (userProfile.interests || []).join(' ').toLowerCase(),
      };

      // 4. Ranqueia candidatos via TrailRanker
      var ranked = rankSuggestionsForUser(userProfile.userId, candidates);

      // 5. Enriquece top-5 com justificativa via GeminiConnector (se a chave estiver configurada)
      var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
      if (options.allowAI && apiKey && ranked.length > 0) {
        ranked = _enrichWithAIJustification_(ranked.slice(0, 5), enrichedProfile)
                 .concat(ranked.slice(5));
      }

      var result = ranked.slice(0, 6);
      cache.put(cacheKey, JSON.stringify(result), REC_CACHE_TTL);
      return result;
    } catch (error) {
      Logger.log("Erro em generateRecommendations: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em generateRecommendations: " + error.message);
    throw error;
  }
}

/**
 * Ponto de entrada único para o frontend — resolve usuário, perfil, histórico
 * e recomendações em uma só chamada (evita múltiplos round-trips google.script.run).
 * @return {Object} { userId, perfilConfigurado, recomendacoes, geradoEm }
 */
function getRecommendationsForCurrentUser(authToken) {
  try {
    try {
      var sessionUser = typeof getUpOracularWebSessionUser_ === 'function'
        ? getUpOracularWebSessionUser_(authToken)
        : null;
      if (!sessionUser) throw new Error('Sessão inválida ou expirada.');

      var userId = String(sessionUser.id || sessionUser.email || sessionUser.username || '').trim();
      var email = String(sessionUser.email || userId).trim();
      var records = getReadingRecordsByUser_(userId) || [];
      if (!records.length && email && email !== userId) records = getReadingRecordsByUser_(email) || [];

      var profile = { userId: userId, interests: [] };
      var perfilConfigurado = false;

      if (typeof getUserProfileData === 'function') {
        var fullProfile = getUserProfileData(email);
        if (fullProfile) {
          perfilConfigurado = true;
          if (fullProfile.interests) {
            profile.interests = String(fullProfile.interests).split(',').map(function(s) { return s.trim(); });
          }
        }
      }

      var consentStatus = ConsentService.getStatus(userId, 'generative').status;
      return {
        userId:            userId,
        usuario:           sessionUser.username || email,
        perfilConfigurado: perfilConfigurado,
        recomendacoes:     generateRecommendations_(profile, records, { allowAI: consentStatus === 'active' }),
        acervoDisponivel:  _hasRealAcervoCatalog_(),
        geminiAtivo:       consentStatus === 'active' && !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
        consentimentoIA:   consentStatus,
        geradoEm:          new Date().toISOString()
      };
    } catch (error) {
      Logger.log("Erro em getRecommendationsForCurrentUser: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getRecommendationsForCurrentUser: " + error.message);
    throw error;
  }
}

/**
 * Carrega livros do Catálogo que o usuário ainda não leu nas categorias menos visitadas.
 * @param {Array<string>} readCategories categorias já lidas
 * @return {Array<Object>} candidatos [{ titulo, categoria, justificativa }]
 */
function _loadCatalogCandidates_(readCategories) {
  if (typeof getAcervoRecommendationCandidates === 'function') {
    var acervoCandidates = getAcervoRecommendationCandidates(readCategories || [], 120);
    if (acervoCandidates && acervoCandidates.length) return acervoCandidates;
  }
  return [];
}

function _hasRealAcervoCatalog_() {
  try {
    try {
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(ACERVO_CATALOG_SHEET_NAME);
      return !!(sheet && sheet.getLastRow() > 1);
    } catch (error) {
      Logger.log("Erro em _hasRealAcervoCatalog_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _hasRealAcervoCatalog_: " + error.message);
    throw error;
  }
}

/**
 * Enriquece as justificativas dos candidatos via Gemini, reutilizando o
 * conector central (GeminiConnector → gemini-1.5-flash; chave via PropertiesService).
 * Se a IA estiver indisponível ou a resposta for inválida, mantém as
 * justificativas originais dos candidatos (fallback).
 * @param {Array<Object>} candidates
 * @param {Object}        profile  { userId, interests }
 * @return {Array<Object>} candidates com justificativa enriquecida (ou intactos no fallback)
 */
function _enrichWithAIJustification_(candidates, profile) {
  try {
    try {
      try {
        if (typeof fetchGeminiRecommendation !== 'function') return candidates;

        var listText = candidates.map(function(c, idx) {
          var author = String(c.autor || c.author || '').trim();
          return (idx + 1) + '. ' + c.titulo +
            (author ? (' — autor: ' + author) : ' — autor não informado') +
            ' (categoria: ' + c.categoria + ')';
        }).join('\n');

        var built = PromptContextBuilder.build('recommendation', {
          interests: profile.interests || 'variados',
          works: candidates.map(function(c) {
            return {
              title: c.titulo || c.obra || '',
              author: c.autor || c.author || '',
              category: c.categoria || '',
              subjects: c.assuntos || c.subjects || ''
            };
          }),
          authors: candidates.map(function(c) { return c.autor || c.author || ''; }).filter(Boolean),
          summary: listText,
          directive: 'Destacar tramas semelhantes e transposições interdisciplinares pedagogicamente úteis.'
        });
        PromptContextBuilder.logAudit('recommendation', built.droppedKeys);

        var prompt = 'Analise o contexto bibliográfico JSON a seguir. Use sempre título e autor em conjunto ' +
          'para evitar homônimos e aumentar a precisão de pesquisa. Não invente trama nem autoria. ' +
          'Para cada obra, escreva uma justificativa pedagógica curta e uma possível conexão ' +
          'interdisciplinar ou de trama semelhante.\nCONTEXTO: ' + JSON.stringify(built.context) +
          '\nResponda JSON: [{"titulo":"...","autor":"...","justificativa":"...","conexaoInterdisciplinar":"..."}]';

        // Delega a chamada HTTP ao conector central (evita endpoint legado e chave na URL).
        var text = fetchGeminiRecommendation(prompt);
        if (!text) return candidates;  // IA indisponível → mantém justificativas originais

        var enriched = JSON.parse(text.replace(/```json|```/g, '').trim());
        enriched.forEach(function(item) {
          candidates.forEach(function(c) {
            if (c.titulo === item.titulo && item.justificativa) {
              c.justificativa = item.justificativa;
            }
          });
        });
      } catch (e) {
        LoggerService.info('RecommendationEngine._enrichWithAI: ' + e.message);
      }
      return candidates;
    } catch (error) {
      Logger.log("Erro em _enrichWithAIJustification_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _enrichWithAIJustification_: " + error.message);
    throw error;
  }
}

