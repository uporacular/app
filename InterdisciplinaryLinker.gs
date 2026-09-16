/**
 * InterdisciplinaryLinker.gs
 * Identifica e mapeia conexões entre áreas do conhecimento/categorias literárias.
 * Sustenta a lógica de trilhas interdisciplinares do UpOracular.
 */

var LINK_CACHE_TTL  = 3600;
var LINK_SHEET_NAME = 'LinkMap';

/**
 * Identifica interseções temáticas entre dois assuntos.
 * Consulta a sheet LinkMap e aplica cache para evitar releituras.
 * @param {string} subjectA
 * @param {string} subjectB
 * @return {Object} {subjects, links, keywords, score, timestamp}
 */
function linkSubjects(subjectA, subjectB) {
  try {
    if (!subjectA || !subjectB) return { subjects: [], links: [], keywords: [], score: 0 };

    var cache    = CacheService.getScriptCache();
    var cacheKey = 'LINK_' + subjectA.toUpperCase() + '_' + subjectB.toUpperCase();
    var cached   = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    var links    = _fetchLinksFromSheet(subjectA, subjectB);
    var keywords = _extractKeywords(subjectA, subjectB);
    var score    = Math.min(100, links.length * 20 + keywords.length * 10);

    var result = {
      subjects:  [subjectA, subjectB],
      links:     links,
      keywords:  keywords,
      score:     score,
      timestamp: new Date().toISOString()
    };

    cache.put(cacheKey, JSON.stringify(result), LINK_CACHE_TTL);
    return result;
  } catch (error) {
    Logger.log("Erro em linkSubjects: " + error.message);
    throw error;
  }
}

/**
 * Consulta a sheet LinkMap por conexões pré-cadastradas entre assuntos.
 * Formato da sheet: [AssuntoA, AssuntoB, Descricao, Peso]
 * @param {string} subjectA
 * @param {string} subjectB
 * @return {Array<string>}
 */
function _fetchLinksFromSheet(subjectA, subjectB) {
  try {
    try {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(LINK_SHEET_NAME);
      if (!sheet) return _fetchLinksFromAcervo_(subjectA, subjectB);

      var data  = sheet.getDataRange().getValues();
      var links = [];
      var aLow  = subjectA.toLowerCase();
      var bLow  = subjectB.toLowerCase();

      for (var i = 1; i < data.length; i++) {
        var colA = String(data[i][0]).toLowerCase();
        var colB = String(data[i][1]).toLowerCase();
        if ((colA === aLow && colB === bLow) || (colA === bLow && colB === aLow)) {
          links.push(String(data[i][2]));
        }
      }
      return links.length ? links : _fetchLinksFromAcervo_(subjectA, subjectB);
    } catch (error) {
      Logger.log("Erro em _fetchLinksFromSheet: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em _fetchLinksFromSheet: " + error.message);
    throw error;
  }
}

function _fetchLinksFromAcervo_(subjectA, subjectB) {
  try {
    if (typeof getAcervoInterreferences !== 'function') {
      return [subjectA + ' e ' + subjectB + ' possuem temas transversais.'];
    }
    var refs = getAcervoInterreferences(subjectA + ' ' + subjectB, 5);
    var related = refs.relacionados || [];
    if (!related.length) return [subjectA + ' e ' + subjectB + ' possuem temas transversais.'];
    return related.map(function(item) {
      var obra = item.obra || item.titulo || item.autor || 'Entrada do acervo';
      var bridge = item.pontes && item.pontes.length ? ' por ' + item.pontes.join(', ') : '';
      return obra + bridge + '.';
    });
  } catch (error) {
    Logger.log("Erro em _fetchLinksFromAcervo_: " + error.message);
    throw error;
  }
}

/**
 * Extrai keywords-chave comuns entre dois assuntos usando tokenização simples.
 * @param {string} subjectA
 * @param {string} subjectB
 * @return {Array<string>}
 */
function _extractKeywords(subjectA, subjectB) {
  var stopwords = ['de', 'e', 'o', 'a', 'do', 'da', 'em', 'para', 'com'];
  var tokenize  = function(text) {
    try {
      return text.toLowerCase().split(/\s+/).filter(function(w) {
        return w.length > 2 && stopwords.indexOf(w) === -1;
      });
    } catch (error) {
      Logger.log("Erro em tokenize: " + error.message);
      throw error;
    }
  };
  var tokA   = tokenize(subjectA);
  var tokB   = tokenize(subjectB);
  var common = tokA.filter(function(w) { return tokB.indexOf(w) !== -1; });
  return common.length ? common : ['Interseção de ' + subjectA];
}

/**
 * Retorna todas as conexões existentes para um assunto, com score de relevância.
 * @param {string} subject
 * @return {Array<Object>} [{assuntoB, descricao, peso}] ordenados por peso.
 */
function getConnectionsFor(subject) {
  try {
    try {
      var ss    = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(LINK_SHEET_NAME);
      if (!sheet && typeof getAcervoInterreferences === 'function') {
        var refs = getAcervoInterreferences(subject, 12);
        return (refs.relacionados || []).map(function(item) {
          return {
            assuntoB: item.obra,
            descricao: item.referencia || item.assuntos,
            peso: item.score || 1
          };
        });
      }
      if (!sheet) return [];

      var data    = sheet.getDataRange().getValues();
      var subjLow = subject.toLowerCase();
      var results = [];

      for (var i = 1; i < data.length; i++) {
        var colA = String(data[i][0]).toLowerCase();
        var colB = String(data[i][1]).toLowerCase();
        if (colA === subjLow) {
          results.push({ assuntoB: data[i][1], descricao: data[i][2], peso: data[i][3] || 1 });
        } else if (colB === subjLow) {
          results.push({ assuntoB: data[i][0], descricao: data[i][2], peso: data[i][3] || 1 });
        }
      }
      return results.sort(function(a, b) { return b.peso - a.peso; });
    } catch (error) {
      Logger.log("Erro em getConnectionsFor: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getConnectionsFor: " + error.message);
    throw error;
  }
}

/**
 * Registra uma nova conexão interdisciplinar na sheet LinkMap.
 * @param {string} subjectA
 * @param {string} subjectB
 * @param {string} description
 * @param {number} weight
 */
function registerLink(subjectA, subjectB, description, weight) {
  try {
    try {
      try {
        var ss    = getBoundSpreadsheet_();
        var sheet = ss.getSheetByName(LINK_SHEET_NAME) || ss.insertSheet(LINK_SHEET_NAME);
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(['AssuntoA', 'AssuntoB', 'Descricao', 'Peso', 'CriadoEm']);
        }
        sheet.appendRow([subjectA, subjectB, description, weight || 1, new Date()]);
        CacheService.getScriptCache().remove('LINK_' + subjectA.toUpperCase() + '_' + subjectB.toUpperCase());
      } catch (error) {
        Logger.log("Erro em registerLink: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em registerLink: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em registerLink: " + error.message);
    throw error;
  }
}
