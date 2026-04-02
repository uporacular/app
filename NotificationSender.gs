/**
 * NotificationSender.gs
 * Módulo inteligente para disparos de e-mail e notificações push (mock).
 * Organiza templates e logging.
 */

var NOTIFICATION_LOG_SHEET = 'NotificationLog';

/**
 * Envia um e-mail simples usando o MailApp se as quotas do GSuite permitirem.
 * Retorna log de envio e persiste na planilha de auditoria.
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 * @return {boolean}
 */
function sendNotification(to, subject, body) {
  try {
    var quota = MailApp.getRemainingDailyQuota();
    if (quota <= 0) {
      _logNotification(to, subject, 'QUOTA_EXCEEDED');
      return false;
    }
    
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body
    });
    
    _logNotification(to, subject, 'SUCCESS');
    return true;
  } catch (error) {
    _logNotification(to, subject, 'ERROR: ' + error.message);
    return false;
  }
}

/**
 * Notifica administradores caso eventos de sistema ocorram (ex: falhas de importação).
 * @param {string} eventName
 * @param {string} details
 */
function notifyAdmin(eventName, details) {
  var adminEmail = Session.getEffectiveUser().getEmail();
  var props = PropertiesService.getScriptProperties();
  var overrideAdmin = props.getProperty('ADMIN_EMAIL_OVERRIDE');
  
  sendNotification(
    overrideAdmin || adminEmail,
    '[UpOracular Admin Alert] ' + eventName,
    'Um evento cr\u00EDtico ocorreu no sistema.\nDetalhes: ' + details
  );
}

/**
 * Registra o envio.
 */
function _logNotification(to, subject, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(NOTIFICATION_LOG_SHEET) || ss.insertSheet(NOTIFICATION_LOG_SHEET);
    sheet.appendRow([new Date(), to, subject, status]);
  } catch(e) {}
}
