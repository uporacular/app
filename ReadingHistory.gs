/**
 * ReadingHistory.gs
 * Inteligência temporal sobre o histórico de leitura do usuário.
 * Enquanto ReadingRecord faz CRUD, aqui extraímos padrões temporais e ritmos
 * de leitura para alimentar o sistema de recomendação oracular.
 */

var HISTORY_CACHE_TTL = 1200; // 20 minutos

/**
 * Compila a timeline de leituras agrupada por Ano-Mês, incluindo contagem e livros.
 * @param {string} userId
 * @return {Array<Object>} Ex: [{ periodo: '2025-11', total: 3, livros: [...] }]
 */
function getReadingHistoryTimeline(userId) {
  try {
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = 'TIMELINE_' + userId;
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      var records = getReadingRecordsByUser_(userId);
      if (!records || records.length === 0) return [];

      // Agrupa por período Ano-Mês
      var grouped = {};
      records.forEach(function(r) {
        var d = r.date ? new Date(r.date) : null;
        var periodo = d && !isNaN(d)
          ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
          : 'Sem data';
        if (!grouped[periodo]) grouped[periodo] = { periodo: periodo, total: 0, livros: [] };
        grouped[periodo].total++;
        grouped[periodo].livros.push(r.book || 'Sem título');
      });

      // Ordena cronologicamente descrescente
      var timeline = Object.values(grouped).sort(function(a, b) {
        return b.periodo.localeCompare(a.periodo);
      });

      cache.put(cacheKey, JSON.stringify(timeline), HISTORY_CACHE_TTL);
      return timeline;
    } catch (error) {
      Logger.log("Erro em getReadingHistoryTimeline: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getReadingHistoryTimeline: " + error.message);
    throw error;
  }
}

/**
 * Computa sumário estatístico completo do histórico de leitura.
 * @param {string} userId
 * @return {Object} { totalBooks, averageRating, recentBooks, categoriesRead,
 *                    readingStreak, busiestMonth, avgBooksPerMonth }
 */
function getReadingHistoryStats(userId) {
  try {
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = 'STATS_' + userId;
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      var records = getReadingRecordsByUser_(userId) || [];
      if (records.length === 0) {
        return { totalBooks: 0, averageRating: 0, recentBooks: [],
                 categoriesRead: {}, readingStreak: 0, busiestMonth: null, avgBooksPerMonth: 0 };
      }

      var total = records.length;
      var sumRating = 0;
      var countRated = 0;
      var categoriesRead = {};

      records.forEach(function(r) {
        if (r.rating && !isNaN(r.rating)) {
          sumRating += Number(r.rating);
          countRated++;
        }
        var cat = r.category || 'Sem Categoria';
        categoriesRead[cat] = (categoriesRead[cat] || 0) + 1;
      });

      // Mês mais produtivo
      var timeline = getReadingHistoryTimeline(userId);
      var busiestMonth = timeline.length > 0
        ? timeline.reduce(function(a, b) { return b.total > a.total ? b : a; }, timeline[0])
        : null;

      // Média de livros por mês (últimos 12 meses)
      var twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      var recentCount = records.filter(function(r) {
        return r.date && new Date(r.date) >= twelveMonthsAgo;
      }).length;
      var avgBooksPerMonth = (recentCount / 12).toFixed(1);

      // Streak: meses consecutivos com ao menos 1 leitura (a partir do mais recente)
      var streak = _calculateMonthlyStreak_(timeline);

      var stats = {
        totalBooks: total,
        averageRating: countRated > 0 ? parseFloat((sumRating / countRated).toFixed(1)) : 0,
        recentBooks: records
          .filter(function(r) { return r.date; })
          .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
          .slice(0, 5),
        categoriesRead: categoriesRead,
        readingStreak: streak,
        busiestMonth: busiestMonth ? busiestMonth.periodo : null,
        avgBooksPerMonth: parseFloat(avgBooksPerMonth)
      };

      cache.put(cacheKey, JSON.stringify(stats), HISTORY_CACHE_TTL);
      return stats;
    } catch (error) {
      Logger.log("Erro em getReadingHistoryStats: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getReadingHistoryStats: " + error.message);
    throw error;
  }
}

/**
 * Retorna os últimos N livros lidos, ordenados por data.
 * @param {string} userId
 * @param {number} n — padrão: 10
 * @return {Array<Object>}
 */
function getRecentReadings(userId, n) {
  try {
    n = n || 10;
    var records = getReadingRecordsByUser_(userId) || [];
    return records
      .filter(function(r) { return r.date; })
      .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, n);
  } catch (error) {
    Logger.log("Erro em getRecentReadings: " + error.message);
    throw error;
  }
}

/**
 * Calcula sequência de meses consecutivos com ao menos 1 leitura.
 * @param {Array<Object>} timeline — resultado de getReadingHistoryTimeline
 * @return {number} streak em meses
 */
function _calculateMonthlyStreak_(timeline) {
  if (!timeline || timeline.length === 0) return 0;
  var streak = 1;
  for (var i = 0; i < timeline.length - 1; i++) {
    var curr = new Date(timeline[i].periodo + '-01');
    var next = new Date(timeline[i + 1].periodo + '-01');
    var diff = (curr.getFullYear() - next.getFullYear()) * 12
             + (curr.getMonth() - next.getMonth());
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

