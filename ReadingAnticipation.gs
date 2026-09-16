/**
 * ReadingAnticipation.gs — Guia de Antecipação de Leitura via Gemini.
 *
 * Prática consolidada de compreensão leitora: ANTES de abrir a obra, o leitor
 * ativa o conhecimento prévio, levanta hipóteses sobre o título/tema e define
 * um objetivo de leitura. Aqui, para cada obra recomendada pelo Oráculo, o
 * Gemini gera 3 perguntas de antecipação + 1 objetivo de leitura.
 *
 * Reusa fetchGeminiRecommendation (GeminiConnector.gs, já endurecido com
 * retry+backoff; devolve null em falha) e degrada para um guia determinístico
 * local — a função NUNCA lança por falta de GEMINI_API_KEY.
 *
 * Fronteira pública (google.script.run):
 *   - getReadingAnticipationGuide(item) oferece somente o fallback local.
 *   - getMyReadingAnticipationGuide(authToken, acervoId), no workflow autenticado,
 *     libera Gemini apenas quando o consentimento persistido estiver ativo.
 */

/**
 * Gera o guia de antecipação para uma obra recomendada.
 * @param {Object} item { obra?: string, titulo?: string, autor?: string, categoria?: string }
 * @return {{obra: string, perguntas: Array<string>, objetivo: string, fonte: string}}
 */
function getReadingAnticipationGuide_(item, options) {
  try {
    item = item || {};
    options = options || {};
    var acervoId = String(item.acervoId || '').trim();
    if (!acervoId || typeof getAcervoEntryById !== 'function') {
      throw new Error('A obra precisa pertencer ao acervo cadastrado.');
    }
    var acervoItem = getAcervoEntryById(acervoId);
    if (!acervoItem) throw new Error('Obra não encontrada no acervo cadastrado.');
    item = acervoItem;
    var obra = String(item.obra || item.titulo || '').trim().slice(0, 120) || 'a obra recomendada';
    var autor = String(item.autor || '').trim().slice(0, 80);
    var categoria = String(item.categoria || '').trim().slice(0, 80);

    var prompt = [
      'Você é um mediador de leitura preparando um leitor para começar uma obra',
      'recomendada pela trilha interdisciplinar do UpOracular.',
      '',
      'Obra: ' + obra + (autor ? (' — ' + autor) : '') + (categoria ? (' (categoria: ' + categoria + ')') : ''),
      '',
      'Gere EXATAMENTE 3 perguntas de ANTECIPAÇÃO de leitura, em português do',
      'Brasil, uma por linha, cada linha começando com "- ", nesta ordem:',
      '1) conhecimento prévio (o que o leitor já sabe/viveu sobre o tema);',
      '2) hipótese sobre o título ou a categoria (o que a obra parece prometer);',
      '3) predição (o que o leitor espera descobrir ou sentir lendo).',
      'Depois, em uma linha separada começando com "OBJETIVO: ", proponha um',
      'objetivo de leitura curto e concreto para acompanhar durante a obra.',
      'Não revele enredo, não invente fatos sobre a obra; trabalhe apenas com',
      'título, autor e categoria. Sem markdown além dos prefixos pedidos.'
    ].join('\n');

    var perguntas = [];
    var objetivo = '';
    var fonte = 'local';

    var texto = options.allowAI ? fetchGeminiRecommendation(prompt) : null;
    if (texto) {
      String(texto).split('\n').forEach(function (linha) {
        var l = linha.trim();
        if (l.indexOf('- ') === 0 && perguntas.length < 3) {
          perguntas.push(l.replace(/^-\s*/, '').trim());
        } else if (/^OBJETIVO\s*:/i.test(l) && !objetivo) {
          objetivo = l.replace(/^OBJETIVO\s*:\s*/i, '').trim();
        }
      });
      if (perguntas.length === 3) { fonte = 'gemini'; }
    }

    if (perguntas.length < 3) {
      // Guia determinístico local: mesmas três etapas da antecipação.
      fonte = 'local';
      perguntas = [
        'O que você já sabe ou já viveu sobre ' + (categoria ? ('o tema "' + categoria + '"') : 'o assunto desta obra') + '?',
        'Olhando o título "' + obra + '"' + (autor ? (' e o autor ' + autor) : '') + ', o que essa obra parece prometer?',
        'O que você espera descobrir ou sentir lendo essa obra? Anote sua previsão para conferir depois.'
      ];
      objetivo = objetivo || 'Durante a leitura, marque um trecho que confirme ou surpreenda a sua previsão.';
    }
    if (!objetivo) {
      objetivo = 'Durante a leitura, marque um trecho que confirme ou surpreenda a sua previsão.';
    }

    return { obra: obra, perguntas: perguntas, objetivo: objetivo, fonte: fonte };
  } catch (error) {
    Logger.log("Erro em getReadingAnticipationGuide_: " + error.message);
    throw error;
  }
}

/**
 * Compatibilidade segura para clientes legados: nunca aceita uma sinalizacao
 * de IA enviada pelo navegador. O caminho autenticado faz a checagem de
 * consentimento no servidor antes de chamar a implementacao privada.
 */
function getReadingAnticipationGuide(item) {
  return getReadingAnticipationGuide_(item, { allowAI: false });
}
