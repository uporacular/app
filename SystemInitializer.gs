/**
 * SystemInitializer.gs
 * Inicialização e setup do sistema UpOracular.
 * Cria sheets essenciais, define cabeçalhos, registra triggers e versão.
 */

var SYSTEM_VERSION = '1.3.0';

var SHEET_SCHEMAS = {
  Leituras:    ['ID', 'UserID', 'Livro', 'Categoria', 'Data', 'Nota'],
  Perfis:      ['Turma', 'Nome', 'Email', 'Role', 'CriadoEm'],
  TrailHistory:['ID', 'UserID', 'Trilha', 'Pontuacao', 'Data'],
  SessionLog:  ['Timestamp', 'Email', 'Acao', 'SessionID'],
  ReportLog:   ['Timestamp', 'UserID', 'TipoRelatorio', 'URL']
};

/**
 * Ponto de entrada do setup: cria sheets, define cabeçalhos, registra versão.
 * @return {string} Mensagem com resumo da inicialização.
 */
function initializeSystem() {
  try {
    var ss      = getBoundSpreadsheet_();
    var created = [];
    var updated = [];

    for (var name in SHEET_SCHEMAS) {
      var sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        created.push(name);
      }
      _ensureHeaders(sheet, SHEET_SCHEMAS[name]);
      if (!created.includes(name)) updated.push(name);
    }

    // Persiste versão e timestamp de inicialização
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SYSTEM_VERSION', SYSTEM_VERSION);
    props.setProperty('LAST_INIT', new Date().toISOString());

    // Registra trigger onOpen se não existir
    _ensureOnOpenTrigger();

    // Adiciona item de menu "Maturidade do Backend" ao painel UpOracular
    try { addMaturityMenuItem(); } catch (e) { /* Silencioso — disponível via menu manual */ }

    // Adiciona item de menu "Maturidade do Frontend"
    try { addFrontendMaturityMenuItem(); } catch (e) { /* Silencioso */ }

    var summary = [];
    if (created.length) summary.push('Criadas: ' + created.join(', '));
    if (updated.length) summary.push('Revisadas: ' + updated.join(', '));
    return summary.length ? summary.join(' | ') : 'Sistema já estava pronto. v' + SYSTEM_VERSION;
  } catch (error) {
    Logger.log("Erro em initializeSystem: " + error.message);
    throw error;
  }
}

/**
 * Garante que a primeira linha da sheet contém os cabeçalhos corretos.
 * Não sobrescreve dados existentes — apenas preenche se a linha 1 estiver vazia.
 * @param {Sheet} sheet
 * @param {Array<string>} headers
 */
function _ensureHeaders(sheet, headers) {
  try {
    var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var isEmpty  = firstRow.every(function(cell) { return cell === '' || cell === null; });
    if (isEmpty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  } catch (error) {
    Logger.log("Erro em _ensureHeaders: " + error.message);
    throw error;
  }
}

/**
 * Cria o trigger onOpen apenas se não existir para evitar duplicatas.
 */
function _ensureOnOpenTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasOnOpen = triggers.some(function(t) {
    return t.getHandlerFunction() === 'onOpen' && t.getEventType() === ScriptApp.EventType.ON_OPEN;
  });
  if (!hasOnOpen) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(getBoundSpreadsheet_())
      .onOpen()
      .create();
  }
}

/**
 * Retorna a versão atual do sistema.
 * @return {string}
 */
function getSystemVersion() {
  try {
    var props = PropertiesService.getScriptProperties();
    return props.getProperty('SYSTEM_VERSION') || SYSTEM_VERSION;
  } catch (error) {
    Logger.log("Erro em getSystemVersion: " + error.message);
    throw error;
  }
}
