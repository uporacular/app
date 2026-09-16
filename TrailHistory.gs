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
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET) || ss.insertSheet(TRAIL_HISTORY_SHEET);
  
    var date = new Date().toISOString();
    var recomJson = JSON.stringify(trailData.recomendacoes || []);
  
    sheet.appendRow([
      GASUtilities.generateUuid(),
      userId,
      date,
      trailData.tonalidadeUsada || '',
      recomJson
    ]);
  } catch (error) {
    Logger.log("Erro em recordTrailHistory: " + error.message);
    throw error;
  }
}

/**
 * Recupera histórico inteiro de predições passadas.
 * 
 * @param {string} userId
 * @return {Array<Object>} Histórico descrescente
 */
function getUserTrailHistory(userId) {
  try {
    try {
      var ss = getBoundSpreadsheet_();
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
    } catch (error) {
      Logger.log("Erro em getUserTrailHistory: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em getUserTrailHistory: " + error.message);
    throw error;
  }
}

/**
 * Obtém estatísticas do histórico de trilhas de um usuário.
 * @param {string} userId
 * @return {Object} {total, tonalidades, periodoAtivo, ultimaRecomendacao}
 */
function getUserTrailStats(userId) {
  try {
    var history = getUserTrailHistory(userId);
    if (history.length === 0) {
      return {total: 0, tonalidades: {}, periodoAtivo: 0, ultimaRecomendacao: null};
    }
    
    var tonalidades = {};
    var dates = [];
    
    history.forEach(function(trail) {
      var tone = trail.tone || 'desconhecido';
      tonalidades[tone] = (tonalidades[tone] || 0) + 1;
      
      if (trail.date) {
        dates.push(new Date(trail.date));
      }
    });
    
    // Calcula período ativo (dias entre primeira e última recomendação)
    dates.sort(function(a, b) { return a - b; });
    var periodoAtivo = 0;
    if (dates.length > 1) {
      var diff = dates[dates.length - 1] - dates[0];
      periodoAtivo = Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    
    return {
      total: history.length,
      tonalidades: tonalidades,
      periodoAtivo: periodoAtivo,
      ultimaRecomendacao: history[0].date,
      primeiraRecomendacao: dates.length > 0 ? dates[0].toISOString() : null
    };
  } catch (error) {
    Logger.log("Erro em getUserTrailStats: " + error.message);
    return {total: 0, tonalidades: {}, periodoAtivo: 0};
  }
}

/**
 * Obtém as N últimas trilhas de um usuário.
 * @param {string} userId
 * @param {number} limit Padrão: 5
 * @return {Array<Object>}
 */
function getRecentTrails(userId, limit) {
  try {
    limit = limit || 5;
    var history = getUserTrailHistory(userId);
    return history.slice(0, limit);
  } catch (error) {
    Logger.log("Erro em getRecentTrails: " + error.message);
    return [];
  }
}

/**
 * Busca trilhas por período específico.
 * @param {string} userId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array<Object>}
 */
function getTrailsByPeriod(userId, startDate, endDate) {
  try {
    var history = getUserTrailHistory(userId);
    return history.filter(function(trail) {
      var trailDate = new Date(trail.date);
      return trailDate >= startDate && trailDate <= endDate;
    });
  } catch (error) {
    Logger.log("Erro em getTrailsByPeriod: " + error.message);
    return [];
  }
}

/**
 * Obtém distribuição de tonalidades usadas em trilhas.
 * @return {Object} {totalTrilhas, distribuicao: [{tonalidade, count, percentage}]}
 */
function getGlobalTonalityDistribution() {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET);
    if (!sheet) return {totalTrilhas: 0, distribuicao: []};
    
    var data = sheet.getDataRange().getValues();
    var tonalidades = {};
    var total = 0;
    
    for (var i = 1; i < data.length; i++) {
      var tone = String(data[i][3] || 'desconhecido').trim();
      tonalidades[tone] = (tonalidades[tone] || 0) + 1;
      total++;
    }
    
    var distribuicao = [];
    for (var tone in tonalidades) {
      distribuicao.push({
        tonalidade: tone,
        count: tonalidades[tone],
        percentage: Math.round((tonalidades[tone] / total) * 100)
      });
    }
    
    distribuicao.sort(function(a, b) { return b.count - a.count; });
    
    return {
      totalTrilhas: total,
      distribuicao: distribuicao
    };
  } catch (error) {
    Logger.log("Erro em getGlobalTonalityDistribution: " + error.message);
    return {totalTrilhas: 0, distribuicao: []};
  }
}

/**
 * Obtém usuários mais ativos (com mais trilhas registradas).
 * @param {number} limit Padrão: 10
 * @return {Array<Object>} [{userId, count}]
 */
function getTopActiveUsers(limit) {
  try {
    limit = limit || 10;
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET);
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var userCounts = {};
    
    for (var i = 1; i < data.length; i++) {
      var userId = String(data[i][1]);
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }
    
    var users = [];
    for (var userId in userCounts) {
      users.push({userId: userId, count: userCounts[userId]});
    }
    
    users.sort(function(a, b) { return b.count - a.count; });
    return users.slice(0, limit);
  } catch (error) {
    Logger.log("Erro em getTopActiveUsers: " + error.message);
    return [];
  }
}

/**
 * Remove trilhas antigas (limpeza de dados históricos).
 * @param {number} daysOld Trilhas mais antigas que N dias.
 * @return {number} Quantidade de trilhas removidas.
 */
function cleanOldTrails(daysOld) {
  try {
    daysOld = daysOld || 365;
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(TRAIL_HISTORY_SHEET);
    if (!sheet) return 0;
    
    var data = sheet.getDataRange().getValues();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    var rowsToDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      var date = new Date(data[i][2]);
      if (date < cutoff) {
        rowsToDelete.push(i + 1);
      }
    }
    
    // Deleta de trás para frente para não deslocar índices
    rowsToDelete.forEach(function(rowIndex) {
      sheet.deleteRow(rowIndex);
    });
    
    return rowsToDelete.length;
  } catch (error) {
    Logger.log("Erro em cleanOldTrails: " + error.message);
    return 0;
  }
}
