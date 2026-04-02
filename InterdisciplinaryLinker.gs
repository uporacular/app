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
}

/**
 * Consulta a sheet LinkMap por conexões pré-cadastradas entre assuntos.
 * Formato da sheet: [AssuntoA, AssuntoB, Descricao, Peso]
 * @param {string} subjectA
 * @param {string} subjectB
 * @return {Array<string>}
 */
function _fetchLinksFromSheet(subjectA, subjectB) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LINK_SHEET_NAME);
  if (!sheet) return [subjectA + ' e ' + subjectB + ' possuem temas transversais.'];

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
  return links.length ? links : [subjectA + ' e ' + subjectB + ' possuem temas transversais.'];
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
    return text.toLowerCase().split(/\s+/).filter(function(w) {
      return w.length > 2 && stopwords.indexOf(w) === -1;
    });
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
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LINK_SHEET_NAME);
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
}

/**
 * Registra uma nova conexão interdisciplinar na sheet LinkMap.
 * @param {string} subjectA
 * @param {string} subjectB
 * @param {string} description
 * @param {number} weight
 */
function registerLink(subjectA, subjectB, description, weight) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LINK_SHEET_NAME) || ss.insertSheet(LINK_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['AssuntoA', 'AssuntoB', 'Descricao', 'Peso', 'CriadoEm']);
  }
  sheet.appendRow([subjectA, subjectB, description, weight || 1, new Date()]);
  CacheService.getScriptCache().remove('LINK_' + subjectA.toUpperCase() + '_' + subjectB.toUpperCase());
}
