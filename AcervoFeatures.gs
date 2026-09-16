/**
 * AcervoFeatures.gs — Funcionalidades autenticadas do Up Oracular.
 *
 * Justificam o login: usuarios autenticados (curadores/mediadores) registram
 * recomendacoes de leitura para os alunos e sugerem aquisicoes para o acervo.
 * Toda acao exige credenciais validas (loginWithPassword) e e atribuida ao
 * usuario autor.
 */

function up_auth_(username, password) {
  var res = loginWithPassword(username, password);
  return (res && res.success) ? res.user : null;
}

function up_ss_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SPREADSHEET_ID') || props.getProperty('SPREADSHEETS_ID');
    if (id) return SpreadsheetApp.openById(id);
    return getBoundSpreadsheet_();
  } catch (error) {
    Logger.log("Erro em up_ss_: " + error.message);
    throw error;
  }
}

function up_append_(sheetName, headers, obj) {
  try {
    var ss = up_ss_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    var current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String) : [];
    if (!current.length) { sheet.getRange(1, 1, 1, headers.length).setValues([headers]); current = headers.slice(); }
    sheet.appendRow(current.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
  } catch (error) {
    Logger.log("Erro em up_append_: " + error.message);
    throw error; // Re-lança para tratamento superior
  }
}

function up_list_(sheetName) {
  var sheet = up_ss_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  return values.slice(1).map(function (r) { var o = {}; headers.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}

function up_id_(prefix) { return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000); }

/** Funcionalidade 1 — Registrar recomendacao de leitura. */
function registrarRecomendacaoLeitura(username, password, titulo, publicoAlvo, motivo) {
  try {
    var user = up_auth_(username, password);
    if (!user) return { success: false, message: 'Credenciais invalidas.' };
    if (!String(titulo || '').trim()) return { success: false, message: 'Informe o titulo.' };
    var id = up_id_('REC');
    up_append_('RecomendacoesLeitura', ['ID', 'DataHora', 'Autor', 'Titulo', 'PublicoAlvo', 'Motivo'], {
      ID: id, DataHora: new Date(), Autor: user.username, Titulo: titulo, PublicoAlvo: publicoAlvo || '', Motivo: motivo || ''
    });
    return { success: true, id: id };
  } catch (error) {
    Logger.log("Erro em registrarRecomendacaoLeitura: " + error.message);
    throw error;
  }
}

/** Funcionalidade 2 — Sugerir aquisicao para o acervo. */
function sugerirAquisicaoAcervo(username, password, titulo, autorObra, justificativa) {
  try {
    var user = up_auth_(username, password);
    if (!user) return { success: false, message: 'Credenciais invalidas.' };
    if (!String(titulo || '').trim()) return { success: false, message: 'Informe o titulo.' };
    var id = up_id_('AQ');
    up_append_('SugestoesAcervo', ['ID', 'DataHora', 'Autor', 'Titulo', 'AutorObra', 'Justificativa', 'Status'], {
      ID: id, DataHora: new Date(), Autor: user.username, Titulo: titulo, AutorObra: autorObra || '', Justificativa: justificativa || '', Status: 'sugerido'
    });
    return { success: true, id: id };
  } catch (error) {
    Logger.log("Erro em sugerirAquisicaoAcervo: " + error.message);
    throw error;
  }
}

function listarRecomendacoesLeitura(username, password) {
  if (!up_auth_(username, password)) return { success: false, message: 'Credenciais invalidas.' };
  return { success: true, itens: up_list_('RecomendacoesLeitura') };
}

function listarSugestoesAcervo(username, password) {
  if (!up_auth_(username, password)) return { success: false, message: 'Credenciais invalidas.' };
  return { success: true, itens: up_list_('SugestoesAcervo') };
}
