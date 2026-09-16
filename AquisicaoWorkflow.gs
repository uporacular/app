/**
 * AquisicaoWorkflow.gs — Workflow de aprovacao (admin) do Up Oracular.
 *
 * Administradores listam sugestoes de aquisicao do acervo pendentes e aprovam/
 * rejeitam, registrando revisor e data. Exige login com papel 'admin'. Opera
 * sobre a aba 'SugestoesAcervo'.
 */

function upwf_admin_(username, password) {
  try {
    var res = loginWithPassword(username, password);
    if (!res || !res.success || !res.user) return null;
    return String(res.user.role || '').toLowerCase() === 'admin' ? res.user : null;
  } catch (error) {
    Logger.log("Erro em upwf_admin_: " + error.message);
    throw error;
  }
}

function upwf_update_(id, status, revisor, obs) {
  try {
    var sheet = up_ss_().getSheetByName('SugestoesAcervo');
    if (!sheet || sheet.getLastRow() < 2) return { success: false, message: 'Nenhum registro.' };
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    ['Revisor', 'RevisadoEm', 'ObsRevisao'].forEach(function (h) {
      if (headers.indexOf(h) === -1) { sheet.getRange(1, headers.length + 1).setValue(h); headers.push(h); }
    });
    var idCol = headers.indexOf('ID'), stCol = headers.indexOf('Status');
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) {
        var row = i + 2;
        sheet.getRange(row, stCol + 1).setValue(status);
        sheet.getRange(row, headers.indexOf('Revisor') + 1).setValue(revisor);
        sheet.getRange(row, headers.indexOf('RevisadoEm') + 1).setValue(new Date());
        sheet.getRange(row, headers.indexOf('ObsRevisao') + 1).setValue(obs || '');
        return { success: true, id: id, status: status };
      }
    }
    return { success: false, message: 'ID nao encontrado: ' + id };
  } catch (error) {
    Logger.log("Erro em upwf_update_: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

function upwf_list_(statusFiltro) {
  try {
    try {
      var sheet = up_ss_().getSheetByName('SugestoesAcervo');
      if (!sheet || sheet.getLastRow() < 2) return [];
      var values = sheet.getDataRange().getValues();
      var headers = values[0].map(String);
      return values.slice(1).map(function (r) { var o = {}; headers.forEach(function (h, i) { o[h] = r[i]; }); return o; })
        .filter(function (o) { return !statusFiltro || String(o.Status || '').toLowerCase() === statusFiltro; });
    } catch (error) {
      Logger.log("Erro em upwf_list_: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em upwf_list_: " + error.message);
    throw error;
  }
}

function listarAquisicoesPendentes(username, password) {
  if (!upwf_admin_(username, password)) return { success: false, message: 'Acesso restrito a administradores.' };
  return { success: true, itens: upwf_list_('sugerido') };
}

function aprovarAquisicao(username, password, id, observacao) {
  try {
    var admin = upwf_admin_(username, password);
    if (!admin) return { success: false, message: 'Acesso restrito a administradores.' };
    if (!String(id || '').trim()) return { success: false, message: 'Informe o ID.' };
    return upwf_update_(id, 'aprovado', admin.username, observacao);
  } catch (error) {
    Logger.log("Erro em aprovarAquisicao: " + error.message);
    throw error;
  }
}

function rejeitarAquisicao(username, password, id, motivo) {
  try {
    var admin = upwf_admin_(username, password);
    if (!admin) return { success: false, message: 'Acesso restrito a administradores.' };
    if (!String(id || '').trim()) return { success: false, message: 'Informe o ID.' };
    if (!String(motivo || '').trim()) return { success: false, message: 'Informe o motivo da rejeicao.' };
    return upwf_update_(id, 'rejeitado', admin.username, motivo);
  } catch (error) {
    Logger.log("Erro em rejeitarAquisicao: " + error.message);
    throw error;
  }
}
