/**
 * TrailRecommender.gs
 * Módulo Orquestrador e Recomendações unificado, servindo UI e logando resultados.
 */

/**
 * Entry-point unificado de recomendações de trilha, gravando cache e properties.
 * @param {string} userId O ID do usuário (geralmente e-mail logado)
 * @param {string} promptTone O tom da IA (mock)
 * @return {Object} Payload final.
 */
function generatePersonalizedTrail(userId, promptTone) {
  var cache = CacheService.getUserCache();
  var cacheKey = 'RECOMMENDER_' + Utilities.base64Encode(userId + '_' + promptTone);
  
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
       return JSON.parse(cached);
    } catch(e){}
  }

  var historyMap = []; 
  try {
     historyMap = mapUserReadingTrail(userId); 
  } catch(e) {}
  
  var categoriesRead = historyMap.map(function(n) { return n.category; });

  var fallbackCandidates = [
    { titulo: "Quarto de Despejo", categoria: "Literatura Brasileira", justificativa: "Fundamental para entender a base humanitária." },
    { titulo: "O Povo Brasileiro", categoria: "Ciências Humanas", justificativa: "Compreensão matriz cultural." },
    { titulo: "A Metamorfose", categoria: "Fantasia / Ficção", justificativa: "Clássico sobre existencialismo." }
  ];

  var finalRankedList = fallbackCandidates;

  if (historyMap.length > 0) {
    var aiDerivedCandidates = [
      { titulo: "Livro de Transição A", categoria: historyMap[0].category, justificativa: "Aprofunde na sua primeira leitura." },
      { titulo: "Conexão Interdisciplinar X", categoria: "Ciências Humanas", justificativa: "Ponte com o que você vem lendo em " + historyMap[historyMap.length-1].category }
    ];
    var combined = aiDerivedCandidates.concat(fallbackCandidates);
    try {
      finalRankedList = rankSuggestionsForUser(userId, combined);
    } catch(e) {
      finalRankedList = combined;
    }
  }

  var result = {
    status: historyMap.length === 0 ? "NEW_USER" : "SUCCESS",
    usuarioId: userId,
    tonalidadeUsada: promptTone || "Balanceado",
    baseLeitura: categoriesRead.join(", "),
    recomendacoes: finalRankedList.slice(0, 4)
  };

  cache.put(cacheKey, JSON.stringify(result), 600);
  return result;
}

/**
 * Função mock para ligação.
 */
function getTrailRecommenderData() {
  return generatePersonalizedTrail(Session.getActiveUser().getEmail(), "Um robô por dentro das leituras");
}
