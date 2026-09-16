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
    var quota = GASUtilities.getEmailQuotaRemaining();
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
  try {
    var adminEmail = Session.getEffectiveUser().getEmail();
    var props = PropertiesService.getScriptProperties();
    var overrideAdmin = props.getProperty('ADMIN_EMAIL_OVERRIDE');
  
    sendNotification(
      overrideAdmin || adminEmail,
      '[UpOracular Admin Alert] ' + eventName,
      'Um evento cr\u00EDtico ocorreu no sistema.\nDetalhes: ' + details
    );
  } catch (error) {
    Logger.log("Erro em notifyAdmin: " + error.message);
    throw error;
  }
}

/**
 * Registra o envio.
 */
function _logNotification(to, subject, status) {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(NOTIFICATION_LOG_SHEET) || ss.insertSheet(NOTIFICATION_LOG_SHEET);
    sheet.appendRow([new Date(), to, subject, status]);
  } catch(e) {}
}

/**
 * Lista todas as notificacoes registradas em forma de linha [Data, Email, Assunto],
 * no shape que a tela NotificationSender (renderNotificacoes) espera.
 * @return {Array<Array>}
 */
function getAllNotifications() {
  try {
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(NOTIFICATION_LOG_SHEET);
    if (!sheet || sheet.getLastRow() < 1) return [];
    var data = sheet.getDataRange().getValues();
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      rows.push([data[i][0], data[i][1], data[i][2]]);
    }
    return rows;
  } catch (e) { return []; }
}

/**
 * Lista as notificacoes de um destinatario em forma de linha [Data, Email, Assunto].
 * @param {string} email
 * @return {Array<Array>}
 */
function getNotificationsByEmail(email) {
  try {
    if (!email) return [];
    try {
      var ss = getBoundSpreadsheet_();
      var sheet = ss.getSheetByName(NOTIFICATION_LOG_SHEET);
      if (!sheet || sheet.getLastRow() < 1) return [];
      var data = sheet.getDataRange().getValues();
      var alvo = String(email).toLowerCase();
      var rows = [];
      for (var i = 0; i < data.length; i++) {
        if (String(data[i][1]).toLowerCase() === alvo) {
          rows.push([data[i][0], data[i][1], data[i][2]]);
        }
      }
      return rows;
    } catch (e) { return []; }
  } catch (error) {
    Logger.log("Erro em getNotificationsByEmail: " + error.message);
    throw error;
  }
}

/**
 * Envia notificação em lote para múltiplos destinatários.
 * Respeita quota e processa de forma otimizada.
 * @param {Array<string>} recipients Array de e-mails.
 * @param {string} subject
 * @param {string} body
 * @return {Object} {sent: number, failed: number, quotaExceeded: boolean}
 */
function sendBatchNotification(recipients, subject, body) {
  try {
    var quota = GASUtilities.getEmailQuotaRemaining();
    var sent = 0;
    var failed = 0;
    var quotaExceeded = false;
    
    for (var i = 0; i < recipients.length; i++) {
      if (quota <= 0) {
        quotaExceeded = true;
        break;
      }
      
      var success = sendNotification(recipients[i], subject, body);
      if (success) {
        sent++;
        quota--;
      } else {
        failed++;
      }
    }
    
    return {
      sent: sent,
      failed: failed,
      quotaExceeded: quotaExceeded,
      remaining: recipients.length - sent - failed
    };
  } catch (error) {
    Logger.log("Erro em sendBatchNotification: " + error.message);
    return {sent: 0, failed: recipients.length, quotaExceeded: false, error: error.message};
  }
}

/**
 * Envia notificação com template predefinido.
 * Templates suportados: WELCOME, RECOMMENDATION, REMINDER, ALERT
 * @param {string} to
 * @param {string} templateName
 * @param {Object} vars Variáveis para substituição no template.
 * @return {boolean}
 */
function sendTemplatedNotification(to, templateName, vars) {
  try {
    var templates = {
      WELCOME: {
        subject: 'Bem-vindo ao UpOracular!',
        body: 'Olá {{nome}},\n\nBem-vindo ao sistema de recomendação de leituras UpOracular.\n\nBoa leitura!\nEquipe UpOracular'
      },
      RECOMMENDATION: {
        subject: 'Nova recomendação de leitura para você',
        body: 'Olá {{nome}},\n\nTemos uma nova recomendação de leitura baseada no seu perfil:\n\n{{recomendacao}}\n\nAcesse o sistema para mais detalhes!'
      },
      REMINDER: {
        subject: 'Lembrete: {{assunto}}',
        body: 'Olá {{nome}},\n\nEste é um lembrete sobre: {{mensagem}}\n\nAtenciosamente,\nEquipe UpOracular'
      },
      ALERT: {
        subject: '[ALERTA] {{titulo}}',
        body: 'Atenção {{nome}},\n\n{{mensagem}}\n\nSe precisar de ajuda, entre em contato conosco.'
      }
    };
    
    var template = templates[templateName];
    if (!template) return false;
    
    var subject = template.subject;
    var body = template.body;
    
    // Substitui variáveis
    for (var key in vars) {
      var placeholder = '{{' + key + '}}';
      subject = subject.split(placeholder).join(vars[key]);
      body = body.split(placeholder).join(vars[key]);
    }
    
    return sendNotification(to, subject, body);
  } catch (error) {
    Logger.log("Erro em sendTemplatedNotification: " + error.message);
    return false;
  }
}

/**
 * Obtém estatísticas de notificações enviadas.
 * @param {number} days Número de dias para análise (padrão: 30).
 * @return {Object} Estatísticas {total, success, failed, byDay}
 */
function getNotificationStats(days) {
  try {
    days = days || 30;
    var ss = getBoundSpreadsheet_();
    var sheet = ss.getSheetByName(NOTIFICATION_LOG_SHEET);
    if (!sheet) return {total: 0, success: 0, failed: 0, byDay: []};
    
    var data = sheet.getDataRange().getValues();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    var total = 0;
    var success = 0;
    var failed = 0;
    var byDay = {};
    
    for (var i = 1; i < data.length; i++) {
      var date = new Date(data[i][0]);
      if (date < cutoff) continue;
      
      total++;
      var status = String(data[i][3] || '');
      
      if (status === 'SUCCESS') success++;
      else if (status.indexOf('ERROR') >= 0 || status === 'QUOTA_EXCEEDED') failed++;
      
      var dayKey = date.toISOString().split('T')[0];
      byDay[dayKey] = (byDay[dayKey] || 0) + 1;
    }
    
    var byDayArray = [];
    for (var day in byDay) {
      byDayArray.push({date: day, count: byDay[day]});
    }
    byDayArray.sort(function(a, b) { return a.date.localeCompare(b.date); });
    
    return {
      total: total,
      success: success,
      failed: failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      byDay: byDayArray
    };
  } catch (error) {
    Logger.log("Erro em getNotificationStats: " + error.message);
    return {total: 0, success: 0, failed: 0, successRate: 0, byDay: []};
  }
}
