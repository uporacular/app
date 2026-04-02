/**
 * LogManager.gs
 * Módulo para registro e recuperação de logs do sistema em planilhas Google Sheets.
 * Permite rastrear eventos, ações de usuários e ocorrências relevantes para auditoria.
 * Funções típicas: registro de logs, consulta de eventos, exportação de histórico.
 *
 * Autor: [Seu Nome]
 * Data de criação: [Data]
 * Última modificação: [Data]
 */

var LOG_SHEET = 'Logs';

/**
 * Registra um log.
 * @param {string} message
 */
function addLog(message) {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var sheet = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
	sheet.appendRow([new Date(), message]);
}

/**
 * Retorna os logs mais recentes.
 * @param {number} limit
 * @return {Array<string>}
 */
function getRecentLogs(limit) {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var sheet = ss.getSheetByName(LOG_SHEET);
	if (!sheet) return [];
	var data = sheet.getDataRange().getValues();
	var logs = [];
	for (var i = Math.max(1, data.length - limit); i < data.length; i++) {
		logs.push('[' + data[i][0] + '] ' + data[i][1]);
	}
	return logs.reverse();
}
