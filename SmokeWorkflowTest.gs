/**
 * Smoke test de Apps Script para verificar o workflow real do Up Oracular.
 * Valida o contrato canonico e garante que a acao definitiva e a escolha do leitor.
 */
function testSmokeUpOracularWorkflow() {
  var contract = getOracularWorkflowContract();
  if (!contract || !(contract.definitiveAction === 'reader_choice')) {
    throw new Error('Contrato invalido: esperado definitiveAction === \'reader_choice\'');
  }
  return {
    success: true,
    version: contract.version,
    definitiveAction: contract.definitiveAction,
    timestamp: new Date().toISOString()
  };
}
