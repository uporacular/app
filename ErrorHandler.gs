/**
 * ErrorHandler.gs
 * Módulo para tratamento, captura e registro de erros do sistema.
 * Permite registrar logs de erro, capturar exceções e facilitar o diagnóstico de problemas.
 * Funções típicas: log de erros, try/catch centralizado, notificação de falhas.
 *
 * Autor: Oracular
 * Data de criação: 2026-04-02
 */

/**
 * Registra um erro no log do projeto e no cache.
 * @param {string} message
 * @param {Object} context
 */
function logError(message, context) {
    context = context || {};
    var errorDetails = {
        timestamp: new Date().toISOString(),
        message: message,
        context: JSON.stringify(context)
    };
    Logger.log('ERRO [' + errorDetails.timestamp + ']: ' + errorDetails.message);
    
    var cache = CacheService.getScriptCache();
    if (cache) {
        var recentErrors = [];
        try {
            recentErrors = JSON.parse(cache.get('RECENT_ERRORS') || '[]');
        } catch(e) {}
        recentErrors.push(errorDetails);
        if (recentErrors.length > 50) recentErrors.shift();
        cache.put('RECENT_ERRORS', JSON.stringify(recentErrors), 21600);
    }
}

/**
 * Tenta executar uma função e captura erros.
 * @param {Function} fn
 * @param {Object} context
 * @return {Object} { success: boolean, result: any, error: string }
 */
function tryCatch(fn, context) {
    try {
        return { success: true, result: fn(), error: null };
    } catch (e) {
        logError(e.message, context);
        return { success: false, result: null, error: e.message };
    }
}
