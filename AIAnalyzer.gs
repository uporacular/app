/**
 * AIAnalyzer.gs
 * Análise de texto via Google Gemini (delega a chamada HTTP ao GeminiConnector).
 * Inclui fallback léxico local para ambientes offline ou sem chave configurada.
 * Funções: análise de sentimento, extração de tópicos, classificação temática de leituras.
 */

var AI_CACHE_TTL = 3600; // 1 hora

/**
 * Analisa um texto extraindo tópicos e sentimento via Gemini.
 * Faz fallback léxico se a API não estiver disponível.
 * @param {string} texto — conteúdo a analisar
 * @param {string} modo  — 'topicos' | 'sentimento' | 'tematico' (padrão: 'topicos')
 * @return {Object} { modo, resultado, fonte }
 */
function analyzeTextWithAI(texto, modo) {
  try {
    try {
      if (!texto || texto.trim().length === 0) {
        return { modo: modo, resultado: null, fonte: 'none', erro: 'Texto vazio ou ausente.' };
      }

      modo = modo || 'topicos';

      var cache = CacheService.getScriptCache();
      var cacheKey = 'AI_' + modo + '_' + Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5, texto
      ).map(function(b) { return (b + 256).toString(16).slice(-2); }).join('');

      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Tenta classificar via Gemini reutilizando o conector central
      // (GeminiConnector → gemini-1.5-flash; chave via PropertiesService). Fallback léxico se indisponível.
      var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
      if (apiKey && typeof fetchGeminiRecommendation === 'function') {
        try {
          var prompts = {
            topicos: 'Extraia os 3 principais tópicos deste texto em formato JSON [{"topico":"..."}]: ',
            sentimento: 'Classifique o sentimento deste texto como Positivo, Neutro ou Negativo. Responda JSON {"sentimento":"...","confianca":0.0}: ',
            tematico: 'Classifique o tema literário deste texto em uma ou duas palavras. Responda JSON {"tema":"..."}: '
          };
          var built = PromptContextBuilder.build('gemini.generate', {
            topic: modo,
            summary: texto.substring(0, 1000),
            context: 'Análise textual de acervo; quando houver referência bibliográfica, preservar título e autor juntos.'
          });
          PromptContextBuilder.logAudit('gemini.generate', built.droppedKeys);
          var promptText = (prompts[modo] || prompts.topicos) + JSON.stringify(built.context);

          // Delega a chamada HTTP ao conector central (evita endpoint legado e chave na URL).
          var respText = fetchGeminiRecommendation(promptText);
          if (respText) {
            var resultado = JSON.parse(respText.replace(/```json|```/g, '').trim());
            var out = { modo: modo, resultado: resultado, fonte: 'gemini' };
            cache.put(cacheKey, JSON.stringify(out), AI_CACHE_TTL);
            return out;
          }
        } catch (e) {
          LoggerService.error('AIAnalyzer: falha Gemini — ' + e.message + '. Usando fallback léxico.');
        }
      }

      // Fallback léxico local
      var resultado = _lexicalFallback(texto, modo);
      var out = { modo: modo, resultado: resultado, fonte: 'lexical_fallback' };
      cache.put(cacheKey, JSON.stringify(out), 600);
      return out;
    } catch (error) {
      Logger.log("Erro em analyzeTextWithAI: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em analyzeTextWithAI: " + error.message);
    throw error;
  }
}

/**
 * Fallback léxico quando a API Gemini não está disponível.
 * @param {string} texto
 * @param {string} modo
 * @return {*} Resultado aproximado
 */
function _lexicalFallback(texto, modo) {
  try {
    var lower = texto.toLowerCase();

    if (modo === 'sentimento') {
      var positivos = ['alegria', 'esperança', 'amor', 'conquista', 'liberdade', 'belo', 'bem'];
      var negativos = ['dor', 'medo', 'opressão', 'violência', 'tristeza', 'guerra', 'mal'];
      var pos = positivos.filter(function(w) { return lower.indexOf(w) !== -1; }).length;
      var neg = negativos.filter(function(w) { return lower.indexOf(w) !== -1; }).length;
      var sent = pos > neg ? 'Positivo' : (neg > pos ? 'Negativo' : 'Neutro');
      return { sentimento: sent, confianca: 0.5, nota: 'fallback léxico' };
    }

    if (modo === 'tematico') {
      var temas = {
        'Literatura Brasileira': ['brasil', 'sertão', 'quilombo', 'favela'],
        'Filosofia': ['existência', 'verdade', 'ética', 'razão'],
        'Ciências Humanas': ['sociedade', 'cultura', 'história', 'povo'],
        'Fantasia': ['dragão', 'magia', 'reino', 'feitiço']
      };
      for (var tema in temas) {
        if (temas[tema].some(function(w) { return lower.indexOf(w) !== -1; })) {
          return { tema: tema };
        }
      }
      return { tema: 'Geral' };
    }

    // modo 'topicos': extrai palavras mais longas como proxy de tópico
    var words = texto.match(/\b[a-záéíóúãõê]{5,}\b/gi) || [];
    var freq = {};
    words.forEach(function(w) {
      var wl = w.toLowerCase();
      freq[wl] = (freq[wl] || 0) + 1;
    });
    var top = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; }).slice(0, 3);
    return top.map(function(t) { return { topico: t }; });
  } catch (error) {
    Logger.log("Erro em _lexicalFallback: " + error.message);
    throw error;
  }
}

