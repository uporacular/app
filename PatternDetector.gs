/**
/**
 * PatternDetector.gs
 * Detecção estatística de padrões, tendências e interseções nos registros de leitura.
 * Integra com SpreadsheetApp para leitura real de dados e CacheService para performance.
 */

var LEITURAS_SHEET = 'Leituras';
var CACHE_TTL_PATTERNS = 1800; // 30 minutos

/**
 * Analisa padrões de categorias para um conjunto de registros.
 * @param {Array<Object>} readingRecords — [{ userId, book, category, date }, ...]
 * @return {Object} { frequencia, dominante, diversidade, interdisciplinaridadeIdx }
 */
function detectCategoryPatterns(readingRecords) {
  try {
    if (!readingRecords || readingRecords.length === 0) {
      return { frequencia: {}, dominante: null, diversidade: 0, interdisciplinaridadeIdx: 0 };
    }

    var freq = {};
    readingRecords.forEach(function(r) {
      var cat = (r.category || 'Sem Categoria').trim();
      freq[cat] = (freq[cat] || 0) + 1;
    });

    var keys = Object.keys(freq);
    var dominante = keys.reduce(function(a, b) { return freq[a] > freq[b] ? a : b; }, keys[0]);
    var diversidade = keys.length;
    var total = readingRecords.length;

    var entropy = computeEntropy(freq, total);
    var maxEntropy = Math.log(diversidade + 1e-9);
    var interdisciplinaridadeIdx = maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0;

    return {
      frequencia: freq,
      dominante: dominante,
      diversidade: diversidade,
      totalLeituras: total,
      interdisciplinaridadeIdx: interdisciplinaridadeIdx.toFixed(3)
    };
  } catch (error) {
    Logger.log("Erro em detectCategoryPatterns: " + error.message);
    throw error;
  }
}

/**
 * Interface de maturidade — calcula a entropia da distribuição de frequências.
 * @param {Object} freq Mapa de frequências
 * @param {number} total Total de registros
 * @return {number}
 */
function computeEntropy(freq, total) {
  try {
    if (!total) return 0;
    var keys = Object.keys(freq);
    return keys.reduce(function(acc, k) {
      var p = freq[k] / total;
      return acc - p * Math.log(p + 1e-9);
    }, 0);
  } catch (error) {
    Logger.log("Erro em computeEntropy: " + error.message);
    throw error;
  }
}

function detectUserReadingPatterns(userId) {
  try {
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = 'PATTERNS_' + userId;
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(LEITURAS_SHEET);
      if (!sheet && typeof detectAcervoTrends === 'function') return detectAcervoTrends();
      if (!sheet) return { error: 'Aba Leituras não encontrada.' };

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var userRecords = [];

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue;
        var rowUserId = String(row[1] || '').toLowerCase().trim();
        if (rowUserId === userId.toLowerCase().trim()) {
          userRecords.push({
            book: row[2] || '',
            category: row[3] || 'Sem Categoria',
            date: row[4] || ''
          });
        }
      }

      var patterns = detectCategoryPatterns(userRecords);

      // Insights baseados nos padrões
      var insights = [];
      if (patterns.interdisciplinaridadeIdx > 0.7) {
        insights.push('Leitor interdisciplinar — explora com amplitude.');
      } else if (patterns.interdisciplinaridadeIdx < 0.3) {
        insights.push('Especialização detectada em: ' + patterns.dominante + '. Considere expandir horizontes.');
      } else {
        insights.push('Equilíbrio entre profundidade e amplitude. Continue explorando!');
      }

      var result = { userId: userId, patterns: patterns, insights: insights };
      cache.put(cacheKey, JSON.stringify(result), CACHE_TTL_PATTERNS);
      return result;
    } catch (error) {
      Logger.log("Erro em detectUserReadingPatterns: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em detectUserReadingPatterns: " + error.message);
    throw error;
  }
}

/**
 * Detecta tendências globais da biblioteca para apoiar curadoria pedagógica.
 * @return {Object} Mapa global de categorias com percentuais
 */
function detectGlobalLibraryTrends() {
  try {
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get('GLOBAL_TRENDS');
      if (cached) return JSON.parse(cached);

      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(LEITURAS_SHEET);
      if (!sheet) return { error: 'Aba Leituras não encontrada.' };

      var data = sheet.getDataRange().getValues();
      var allRecords = [];

      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          allRecords.push({ category: data[i][3] || 'Sem Categoria' });
        }
      }

      if (!allRecords.length && typeof detectAcervoTrends === 'function') return detectAcervoTrends();

      var trends = detectCategoryPatterns(allRecords);

      // Adiciona percentuais por categoria
      var percentuais = {};
      Object.keys(trends.frequencia).forEach(function(cat) {
        percentuais[cat] = ((trends.frequencia[cat] / trends.totalLeituras) * 100).toFixed(1) + '%';
      });
      trends.percentuais = percentuais;

      cache.put('GLOBAL_TRENDS', JSON.stringify(trends), CACHE_TTL_PATTERNS);
      return trends;
    } catch (error) {
      Logger.log("Erro em detectGlobalLibraryTrends: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em detectGlobalLibraryTrends: " + error.message);
    throw error;
  }
}

function detectAcervoTrends() {
  try {
    if (typeof getAcervoStats !== 'function') return { error: 'Aba Leituras não encontrada.' };
    var stats = getAcervoStats();
    var freq = {};
    (stats.categorias || []).forEach(function(item) {
      freq[item.nome] = item.total;
    });
    var total = stats.total || 0;
    var records = [];
    Object.keys(freq).forEach(function(cat) {
      for (var i = 0; i < freq[cat]; i++) records.push({ category: cat });
    });
    var trends = detectCategoryPatterns(records);
    trends.percentuais = {};
    Object.keys(freq).forEach(function(cat) {
      trends.percentuais[cat] = total ? ((freq[cat] / total) * 100).toFixed(1) + '%' : '0%';
    });
    trends.fonte = 'Acervo';
    trends.cores = stats.cores || [];
    trends.termos = stats.termos || [];
    return trends;
  } catch (error) {
    Logger.log("Erro em detectAcervoTrends: " + error.message);
    throw error;
  }
}

/**
 * Interface de maturidade — detecta tendências globais da biblioteca.
 */
function getGlobalTrends() {
  return detectGlobalLibraryTrends();
}

