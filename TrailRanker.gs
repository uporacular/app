/**
 * TrailRanker.gs
 * Avalia, pontua e ranqueia as possibilidades de trilhas ou livros candidatos
 * para apresentar ao usuário, priorizando relevância e interdisciplinaridade.
 */

/**
 * Ranqueia uma lista de livros ou temas candidatos com base no perfil do usuário.
 * 
 * @param {string} userId
 * @param {Array<Object>} candidates Lista de recomendações ou temas potenciais. 
 *                                   Formato esperado: [{ titulo: "Livro X", categoria: "Arte" }, ...]
 * @return {Array<Object>} Candidatos ranqueados e pontuados, do maior para o menor.
 */
function rankSuggestionsForUser(userId, candidates) {
  if (!candidates || candidates.length === 0) return [];

  var profile = getUserProfile(userId);
  var userInterests = profile ? (profile.interests || "").toLowerCase() : "";
  var userRecords = getReadingRecordsByUser(userId);
  var readCategories = userRecords.map(function(r) { return (r.category || "").toLowerCase(); });

  var ranked = candidates.map(function(candidate) {
    var score = 0;
    var tags = [];
    var catLower = (candidate.categoria || "").toLowerCase();
    
    // 1. Matches perfil explícito (Interesse declarado/fundido)
    if (userInterests.includes(catLower) && catLower !== "") {
      score += 30;
      tags.push("Alinhado aos seus interesses");
    }

    // 2. Exploração Interdisciplinar: Menor a incidência no histórico, 
    // maior a pontuação interdisciplinar para 'sair da bolha'.
    var countInHistory = readCategories.filter(function(c) { return c === catLower; }).length;
    if (countInHistory === 0) {
      score += 20; // Recompensa a descoberta de novas áreas
      tags.push("Nova Fronteira");
    } else if (countInHistory > 2) {
      score += 10; // Aprofundamento no assunto seguro
      tags.push("Aprofundamento");
    }

    return {
      titulo: candidate.titulo,
      categoria: candidate.categoria,
      justificativa: candidate.justificativa || "",
      score: score,
      tags: tags
    };
  });

  // Ordenar de forma descendente pelo score
  ranked.sort(function(a, b) {
    return b.score - a.score;
  });

  return ranked;
}

/**
 * Filtra apenas as melhores trilhas para evitar sobrecarga de informação (Top 3)
 */
function getTopTrailsForUser(userId, candidates) {
  var ranked = rankSuggestionsForUser(userId, candidates);
  return ranked.slice(0, 3);
}
