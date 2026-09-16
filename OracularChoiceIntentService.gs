/** Evidencia de antecipacao registrada antes da escolha definitiva da obra. */
var OracularChoiceIntentService = (function() {
  function clean_(value, label, minimum, maximum) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length < minimum) throw new Error(label + ' precisa ter pelo menos ' + minimum + ' caracteres.');
    return text.slice(0, maximum);
  }

  function normalize(input) {
    input = input || {};
    return {
      expectation: clean_(input.expectation, 'A expectativa de leitura', 12, 400),
      inquiry: clean_(input.inquiry, 'A pergunta do leitor', 8, 240)
    };
  }

  return { normalize: normalize };
})();
