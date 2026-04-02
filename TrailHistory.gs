/**
 * TrailHistory.gs
 * Salva e recupera o histórico de RECOMENDAÇÕES (Trilhas) passadas que o oráculo gerou.
 * Permite ao usuário visualizar insights gerados para ele nos meses passados.
 */

var TRAIL_HISTORY_SHEET = 'HistoricoTrilhas';

/**
 * Congela uma trilha sugerida no banco de dados para consulta futura.
 * 
 * @param {string} userId
 * @param {Object} trailData O retorno bruto de generatePersonalizedTrail
 */
function recordTrailHistory(userId, trailData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET) || ss.insertSheet(TRAIL_HISTORY_SHEET);
  
  var date = new Date().toISOString();
  var recomJson = JSON.stringify(trailData.recomendacoes || []);
  
  sheet.appendRow([
    Utilities.getUuid(),
    userId,
    date,
    trailData.tonalidadeUsada || '',
    recomJson
  ]);
}

/**
 * Recupera histórico inteiro de predições passadas.
 * 
 * @param {string} userId
 * @return {Array<Object>} Histórico descrescente
 */
function getUserTrailHistory(userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(userId)) {
      result.push({
        id: data[i][0],
        date: data[i][2],
        tone: data[i][3],
        trailRaw: data[i][4]
      });
    }
  }
  return result.reverse(); // Do mais recente pro mais antigo
}
