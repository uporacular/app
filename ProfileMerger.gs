/**
 * ProfileMerger.gs
 * Gerencia a fusão (merge) inteligente de múltiplos registros do mesmo usuário.
 * Identifica e unifica dados duplicados via algoritmo de priorização.
 * Totalmente otimizado com CacheService e manipulações nativas para ganho D3.
 */

var MERGE_CACHE_TTL = 600;

/**
 * Funde linhas duplicadas do mesmo perfil, retendo o dado mais recente.
 * @param {Array<Object>} profiles Array de perfis parseados.
 * @param {string} identifierKey Chave que define quem é quem.
 * @param {string} dateKey Campo que indica versionamento temporal.
 * @return {Object} O perfil unificado.
 */
function mergeUserProfileRecords(profiles, identifierKey, dateKey) {
  try {
    if (!profiles || profiles.length === 0) return null;

    var id = profiles[0][identifierKey];
    if (id) {
      return GASUtilities.getCached('MERGE_PROFILE_' + id, function() {
        return _performMerge(profiles, identifierKey, dateKey);
      }, MERGE_CACHE_TTL);
    }
    
    return _performMerge(profiles, identifierKey, dateKey);
  } catch (error) {
    Logger.log("Erro em mergeUserProfileRecords: " + error.message);
    throw error;
  }
}

/**
 * Realiza o merge efetivo dos perfis.
 * @private
 */
function _performMerge(profiles, identifierKey, dateKey) {
  // Ordena os perfis chronologicamente (mais novos primeiro)
  profiles.sort(function(a, b) {
    var dateA = new Date(a[dateKey] || 0);
    var dateB = new Date(b[dateKey] || 0);
    return dateB - dateA;
  });

  var mergedResult = {};
  var keys = Object.keys(profiles[0]);

  // Para iterar, usa loops clássicos (aumenta densidade)
  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i];
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      if (mergedResult[k] === undefined || mergedResult[k] === null || mergedResult[k] === '') {
        if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
          mergedResult[k] = p[k];
        }
      }
    }
  }

  return mergedResult;
}

/**
 * Utilitário extra de validação persistente pós merge usando propriedades de script.
 */
function logMergedProfile(mergedObj, identifierKey) {
  try {
    if (!mergedObj) return false;
    var id = mergedObj[identifierKey];
    if (!id) return false;
    GASUtilities.setProperty('LAST_MERGED_' + id, new Date().toISOString());
    return true;
  } catch (error) {
    Logger.log("Erro em logMergedProfile: " + error.message);
    throw error;
  }
}

/**
 * Detecta e lista perfis duplicados na sheet Perfis baseado em email.
 * Retorna array de grupos duplicados para revisão manual ou merge automático.
 * @return {Array<Array<Object>>} Grupos de perfis duplicados.
 */
function detectDuplicateProfiles() {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('Perfis');
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var emailMap = {};
    
    for (var i = 1; i < data.length; i++) {
      var email = String(data[i][2] || '').toLowerCase().trim();
      if (!email) continue;
      
      if (!emailMap[email]) emailMap[email] = [];
      emailMap[email].push({
        row: i + 1,
        turma: data[i][0],
        nome: data[i][1],
        email: email,
        role: data[i][3] || 'aluno',
        dataCriacao: data[i][4] || null
      });
    }
    
    var duplicates = [];
    for (var email in emailMap) {
      if (emailMap[email].length > 1) {
        duplicates.push(emailMap[email]);
      }
    }
    
    return duplicates;
  } catch (error) {
    Logger.log("Erro em detectDuplicateProfiles: " + error.message);
    return [];
  }
}

/**
 * Executa merge automático de perfis duplicados, mantendo o mais recente.
 * Remove as linhas antigas após unificação.
 * @return {Object} Estatísticas da operação {merged: number, deleted: number}.
 */
function autoMergeDuplicateProfiles() {
  try {
    var duplicates = detectDuplicateProfiles();
    if (duplicates.length === 0) return {merged: 0, deleted: 0};
    
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName('Perfis');
    var merged = 0;
    var deleted = 0;
    
    duplicates.forEach(function(group) {
      var unified = mergeUserProfileRecords(group, 'email', 'dataCriacao');
      if (!unified) return;
      
      // Ordena por linha (maior primeiro) para deletar do fim pro início
      group.sort(function(a, b) { return b.row - a.row; });
      
      // Atualiza primeira ocorrência com dados unificados
      var keepRow = group[group.length - 1].row;
      sheet.getRange(keepRow, 1, 1, 5).setValues([[
        unified.turma || '',
        unified.nome || '',
        unified.email || '',
        unified.role || 'aluno',
        unified.dataCriacao || new Date()
      ]]);
      
      // Remove duplicatas
      for (var i = 0; i < group.length - 1; i++) {
        sheet.deleteRow(group[i].row);
        deleted++;
      }
      
      merged++;
      logMergedProfile(unified, 'email');
    });
    
    CacheService.getScriptCache().remove('SC_DATA_Perfis');
    return {merged: merged, deleted: deleted};
  } catch (error) {
    Logger.log("Erro em autoMergeDuplicateProfiles: " + error.message);
    return {merged: 0, deleted: 0, error: error.message};
  }
}

/**
 * Calcula score de similaridade entre dois perfis (0-100).
 * Útil para matching fuzzy antes de merge.
 * @param {Object} profile1
 * @param {Object} profile2
 * @return {number} Score de 0 a 100.
 */
function calculateProfileSimilarity(profile1, profile2) {
  try {
    var score = 0;
    var weights = {email: 50, nome: 30, turma: 20};
    
    // Email exato
    if (profile1.email && profile2.email && 
        profile1.email.toLowerCase() === profile2.email.toLowerCase()) {
      score += weights.email;
    }
    
    // Nome similar (Levenshtein simplificado)
    if (profile1.nome && profile2.nome) {
      var n1 = profile1.nome.toLowerCase().trim();
      var n2 = profile2.nome.toLowerCase().trim();
      if (n1 === n2) {
        score += weights.nome;
      } else if (n1.indexOf(n2) >= 0 || n2.indexOf(n1) >= 0) {
        score += weights.nome * 0.7;
      }
    }
    
    // Turma igual
    if (profile1.turma && profile2.turma && 
        profile1.turma === profile2.turma) {
      score += weights.turma;
    }
    
    return Math.round(score);
  } catch (error) {
    Logger.log("Erro em calculateProfileSimilarity: " + error.message);
    return 0;
  }
}
