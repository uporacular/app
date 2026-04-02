/**
 * GeminiConnector.gs
 * Faz a conexão primária do ecossistema Google Apps Script para a API Gemini do Google.
 * Orquestra o recebimento dinâmico de conexões literárias.
 */

var GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

/**
 * Chamada crua para a API usando UrlFetchApp.
 * @param {string} promptText
 * @return {string|null} Resposta de texto natural gerada pela IA, ou null se falhar.
 */
function fetchGeminiRecommendation(promptText) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log("ALERTA: Acesso falhou. GEMINI_API_KEY não configurada no PropertiesService do script da planilha.");
    return null;
  }
  
  var payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.75, // Criatividade controlada
      topK: 40,
      topP: 0.95
    }
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(GEMINI_API_URL + apiKey, options);
    var json = JSON.parse(response.getContentText());
    
    if (json.error) {
      Logger.log("Erro GEMINI: " + json.error.message);
      return null;
    }
    
    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
      return json.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    Logger.log("Excessão de Rede com GEMINI: " + error.toString());
  }
  
  return null;
}

/**
 * Abstração amigável de integração: formata o prompt de curadoria.
 * Utilizado por TrailRecommender.gs ou AIAnalyzer.gs.
 * 
 * @param {string} summary Resumo do histórico do usuário.
 * @param {string} directive O tom curatorial do projeto UpOracular escolhido.
 * @return {string} A análise de trilha interdisciplinar retornada.
 */
function askOracularGemini(summary, directive) {
  var sysPrompt = "Você é o Oráculo Literário (UpOracular) focado em educação interdisciplinar criativa.\n";
  sysPrompt += "Aqui está o mapa histórico das leituras do aluno: " + summary + "\n\n";
  sysPrompt += "DIRETRIZ CURATORIAL: '" + directive + "'\n";
  sysPrompt += "Com esses dados, forneça 2 conexões surpreendentes ou obras inusitadas relacionando essas áreas. Descreva brevemente.";
  
  return fetchGeminiRecommendation(sysPrompt);
}
