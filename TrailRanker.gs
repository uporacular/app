/**
 * TrailRanker.gs
 * Avalia, pontua e ranqueia as possibilidades de trilhas ou livros candidatos
 * para apresentar ao usuário, priorizando relevância e interdisciplinaridade.
 */

/**
 * Monta — uma única vez — o contexto de pontuação do usuário, evitando
 * releituras repetidas da planilha durante o ranqueamento de N candidatos.
 *
 * Reúne os interesses declarados no perfil e deriva, a partir do histórico,
 * um mapa de contagem por categoria (lookup O(1) na pontuação) e o conjunto
 * de acervoIds já lidos (para filtrar o que o usuário já consumiu).
 *
 * @param {string} userId
 * @return {{ userInterests: string, readCategoryCounts: Object<string,number>, readAcervoIds: Object<string,boolean> }}
 */
function _buildUserScoringContext_(userId) {
  try {
    var profile = typeof getUserProfile === 'function' ? getUserProfile(userId) : null;
    var userInterests = profile ? String(profile.interests || "").toLowerCase() : "";

    var userRecords = typeof getReadingRecordsByUser_ === 'function'
      ? (getReadingRecordsByUser_(userId) || [])
      : [];

    var readCategoryCounts = {};
    var readAcervoIds = {};
    userRecords.forEach(function(r) {
      var cat = String(r.category || "").toLowerCase();
      readCategoryCounts[cat] = (readCategoryCounts[cat] || 0) + 1;
      if (r.acervoId) readAcervoIds[String(r.acervoId)] = true;
    });

    return {
      userInterests:      userInterests,
      readCategoryCounts: readCategoryCounts,
      readAcervoIds:      readAcervoIds
    };
  } catch (error) {
    Logger.log("Erro em _buildUserScoringContext_: " + error.message);
    throw error;
  }
}

/**
 * Ranqueia uma lista de livros ou temas candidatos com base no perfil do usuário.
 *
 * @param {string} userId
 * @param {Array<Object>} candidates Lista de recomendações ou temas potenciais.
 *                                   Formato esperado: [{ titulo: "Livro X", categoria: "Arte" }, ...]
 * @param {Object} [userContext] Contexto de pontuação pré-calculado (ver _buildUserScoringContext_).
 *                               Quando omitido, é montado uma única vez internamente.
 * @return {Array<Object>} Candidatos ranqueados e pontuados, do maior para o menor.
 */
function rankSuggestionsForUser(userId, candidates, userContext) {
  try {
    if (!candidates || candidates.length === 0) return [];

    // Lê perfil + histórico uma única vez e reusa em todos os candidatos (evita N+1).
    var ctx = userContext || _buildUserScoringContext_(userId);

    var ranked = candidates.filter(function(candidate) {
      return !(candidate.acervoId && ctx.readAcervoIds[String(candidate.acervoId)]);
    }).map(function(candidate) {
      var scoreData = scoreCandidate(candidate, userId, ctx);

      return {
        titulo: candidate.titulo,
        obra: candidate.obra || candidate.titulo,
        acervoId: candidate.acervoId || '',
        autor: candidate.autor || '',
        categoria: candidate.categoria,
        assuntos: candidate.assuntos || '',
        localizacao: candidate.localizacao || '',
        cor: candidate.cor || '',
        codigo: candidate.codigo || '',
        justificativa: candidate.justificativa || "",
        score: scoreData.score,
        tags: scoreData.tags
      };
    });

    // Ordenar de forma descendente pelo score
    ranked.sort(function(a, b) {
      return b.score - a.score;
    });

    return ranked;
  } catch (error) {
    Logger.log("Erro em rankSuggestionsForUser: " + error.message);
    throw error;
  }
}

/**
 * Interface de maturidade — pontua um único candidato baseado no perfil do usuário.
 * @param {Object} candidate
 * @param {string} userId
 * @param {Object} [userContext] Contexto pré-calculado; montado sob demanda se omitido.
 * @return {{ score: number, tags: string[] }}
 */
function scoreCandidate(candidate, userId, userContext) {
  try {
    var ctx = userContext || _buildUserScoringContext_(userId);
    var userInterests = ctx.userInterests;

    var score = Number(candidate.catalogScore || 0);
    var tags = [];

    var catLower = (candidate.categoria || "").toLowerCase();
    var searchText = [
      candidate.titulo || '',
      candidate.obra || '',
      candidate.autor || '',
      candidate.assuntos || '',
      candidate.categoria || ''
    ].join(' ').toLowerCase();
  
    // 1. Matches perfil explícito
    if ((catLower && userInterests.includes(catLower)) ||
        (userInterests && searchText.indexOf(userInterests) !== -1)) {
      score += 30;
      tags.push("Alinhado aos seus interesses");
    }

    // 2. Exploração Interdisciplinar
    var countInHistory = ctx.readCategoryCounts[catLower] || 0;
    if (countInHistory === 0) {
      score += 20;
      tags.push("Nova Fronteira");
    } else if (countInHistory > 2) {
      score += 10;
      tags.push("Aprofundamento");
    }

    return { score: score, tags: tags };
  } catch (error) {
    Logger.log("Erro em scoreCandidate: " + error.message);
    throw error;
  }
}


/**
 * Filtra apenas as melhores trilhas para evitar sobrecarga de informação (Top 3)
 */
function getTopTrailsForUser(userId, candidates) {
  try {
    var ranked = rankSuggestionsForUser(userId, candidates);
    return ranked.slice(0, 3);
  } catch (error) {
    Logger.log("Erro em getTopTrailsForUser: " + error.message);
    throw error;
  }
}
