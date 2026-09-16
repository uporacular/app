/**
 * Dados sintéticos — Up Oracular
 * Gerado em 2026-06-21 01:10:44 por generate_synthetic_data_all_projects.py
 *
 * Execute populateSyntheticData() PELO EDITOR do Apps Script para popular
 * as abas de domínio com ~30 registros cada (valida os gráficos do notebook).
 * Idempotente: limpa as linhas de dados antes de reinserir.
 *
 * NÃO define onOpen() — para não colidir com o menu real do projeto.
 */

function populateSyntheticData() {
  try {
    try {
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var results = [];

        // Permissoes
        try {
          var sheet_PERMISSOES = ss.getSheetByName('Permissoes') || ss.insertSheet('Permissoes');
          if (sheet_PERMISSOES.getLastRow() > 1) {
            sheet_PERMISSOES.deleteRows(2, sheet_PERMISSOES.getLastRow() - 1);
          }
          var h_sheet_PERMISSOES = ["ID", "Name", "Email", "Username", "PasswordHash", "Role", "Status", "LastLoginAt", "CreatedAt", "UpdatedAt"];
          sheet_PERMISSOES.getRange(1, 1, 1, h_sheet_PERMISSOES.length).setValues([h_sheet_PERMISSOES]);
          var d_sheet_PERMISSOES = [
            ["PER-0001", "Felipe Costa", "usuario1@escola.edu.br", "USR-333", "D", "professor", "inativo", "A", "2026-04-22 01:10:44", "2026-06-04 01:10:44"],
            ["PER-0002", "Felipe Costa", "usuario2@escola.edu.br", "USR-938", "B", "professor", "ativo", "B", "2026-05-12 01:10:44", "2026-06-17 01:10:44"],
            ["PER-0003", "Bruno Santos", "usuario3@escola.edu.br", "USR-787", "B", "coordenador", "ativo", "C", "2026-05-05 01:10:44", "2026-05-27 01:10:44"],
            ["PER-0004", "Eduarda Lima", "usuario4@escola.edu.br", "USR-148", "A", "coordenador", "inativo", "C", "2026-05-12 01:10:44", "2026-06-01 01:10:44"],
            ["PER-0005", "Felipe Costa", "usuario5@escola.edu.br", "USR-392", "D", "professor", "ativo", "B", "2026-06-11 01:10:44", "2026-06-18 01:10:44"],
            ["PER-0006", "Carla Oliveira", "usuario6@escola.edu.br", "USR-298", "B", "coordenador", "inativo", "C", "2026-04-13 01:10:44", "2026-06-02 01:10:44"],
            ["PER-0007", "Henrique Alves", "usuario7@escola.edu.br", "USR-798", "A", "professor", "inativo", "D", "2026-05-25 01:10:44", "2026-06-14 01:10:44"],
            ["PER-0008", "Eduarda Lima", "usuario8@escola.edu.br", "USR-760", "B", "professor", "ativo", "A", "2026-05-27 01:10:44", "2026-05-25 01:10:44"],
            ["PER-0009", "Gabriela Rocha", "usuario9@escola.edu.br", "USR-801", "B", "aluno", "inativo", "C", "2026-06-19 01:10:44", "2026-06-01 01:10:44"],
            ["PER-0010", "Ana Silva", "usuario10@escola.edu.br", "USR-920", "A", "coordenador", "inativo", "B", "2026-06-15 01:10:44", "2026-06-13 01:10:44"],
            ["PER-0011", "Felipe Costa", "usuario11@escola.edu.br", "USR-831", "B", "aluno", "inativo", "B", "2026-05-10 01:10:44", "2026-05-29 01:10:44"],
            ["PER-0012", "Carla Oliveira", "usuario12@escola.edu.br", "USR-373", "B", "professor", "ativo", "C", "2026-06-19 01:10:44", "2026-06-20 01:10:44"],
            ["PER-0013", "Bruno Santos", "usuario13@escola.edu.br", "USR-627", "A", "coordenador", "inativo", "D", "2026-04-21 01:10:44", "2026-06-05 01:10:44"],
            ["PER-0014", "Eduarda Lima", "usuario14@escola.edu.br", "USR-626", "A", "professor", "ativo", "B", "2026-05-16 01:10:44", "2026-06-13 01:10:44"],
            ["PER-0015", "Eduarda Lima", "usuario15@escola.edu.br", "USR-786", "C", "professor", "ativo", "D", "2026-06-14 01:10:44", "2026-05-26 01:10:44"],
            ["PER-0016", "Diego Souza", "usuario16@escola.edu.br", "USR-939", "C", "coordenador", "ativo", "D", "2026-04-04 01:10:44", "2026-06-02 01:10:44"],
            ["PER-0017", "Diego Souza", "usuario17@escola.edu.br", "USR-561", "A", "aluno", "ativo", "B", "2026-03-30 01:10:44", "2026-06-02 01:10:44"],
            ["PER-0018", "Bruno Santos", "usuario18@escola.edu.br", "USR-250", "D", "coordenador", "ativo", "D", "2026-04-02 01:10:44", "2026-06-03 01:10:44"],
            ["PER-0019", "Gabriela Rocha", "usuario19@escola.edu.br", "USR-700", "B", "coordenador", "ativo", "C", "2026-05-11 01:10:44", "2026-06-06 01:10:44"],
            ["PER-0020", "Carla Oliveira", "usuario20@escola.edu.br", "USR-957", "D", "aluno", "ativo", "D", "2026-03-25 01:10:44", "2026-06-17 01:10:44"],
            ["PER-0021", "Eduarda Lima", "usuario21@escola.edu.br", "USR-485", "B", "aluno", "ativo", "D", "2026-05-19 01:10:44", "2026-06-16 01:10:44"],
            ["PER-0022", "Eduarda Lima", "usuario22@escola.edu.br", "USR-235", "B", "coordenador", "ativo", "D", "2026-05-31 01:10:44", "2026-06-05 01:10:44"],
            ["PER-0023", "Diego Souza", "usuario23@escola.edu.br", "USR-343", "A", "aluno", "ativo", "D", "2026-06-17 01:10:44", "2026-06-09 01:10:44"],
            ["PER-0024", "Carla Oliveira", "usuario24@escola.edu.br", "USR-680", "B", "aluno", "ativo", "B", "2026-05-30 01:10:44", "2026-06-17 01:10:44"],
            ["PER-0025", "Bruno Santos", "usuario25@escola.edu.br", "USR-145", "A", "aluno", "ativo", "B", "2026-05-29 01:10:44", "2026-05-24 01:10:44"],
            ["PER-0026", "Ana Silva", "usuario26@escola.edu.br", "USR-116", "A", "coordenador", "inativo", "D", "2026-04-26 01:10:44", "2026-06-09 01:10:44"],
            ["PER-0027", "Bruno Santos", "usuario27@escola.edu.br", "USR-146", "A", "coordenador", "inativo", "D", "2026-06-05 01:10:44", "2026-06-21 01:10:44"],
            ["PER-0028", "Bruno Santos", "usuario28@escola.edu.br", "USR-937", "C", "aluno", "ativo", "D", "2026-06-09 01:10:44", "2026-06-12 01:10:44"],
            ["PER-0029", "Ana Silva", "usuario29@escola.edu.br", "USR-841", "B", "coordenador", "ativo", "C", "2026-03-29 01:10:44", "2026-06-14 01:10:44"],
            ["PER-0030", "Bruno Santos", "usuario30@escola.edu.br", "USR-703", "A", "professor", "ativo", "D", "2026-04-11 01:10:44", "2026-06-01 01:10:44"]
          ];
          sheet_PERMISSOES.getRange(2, 1, d_sheet_PERMISSOES.length, h_sheet_PERMISSOES.length).setValues(d_sheet_PERMISSOES);
          results.push('OK Permissoes: ' + d_sheet_PERMISSOES.length + ' registros');
        } catch (e) {
          results.push('ERRO Permissoes: ' + e.message);
        }

        // Acervo
        try {
          var sheet_ACERVO = ss.getSheetByName('Acervo') || ss.insertSheet('Acervo');
          if (sheet_ACERVO.getLastRow() > 1) {
            sheet_ACERVO.deleteRows(2, sheet_ACERVO.getLastRow() - 1);
          }
          var h_sheet_ACERVO = ["ID", "Name", "Description", "Status", "CreatedAt", "UpdatedAt"];
          sheet_ACERVO.getRange(1, 1, 1, h_sheet_ACERVO.length).setValues([h_sheet_ACERVO]);
          var d_sheet_ACERVO = [
            ["ACE-0001", "Carla Oliveira", "Dados coletados durante atividade", "ativo", "2026-05-12 01:10:44", "2026-06-08 01:10:44"],
            ["ACE-0002", "Felipe Costa", "Observação inicial do processo", "ativo", "2026-06-20 01:10:44", "2026-06-15 01:10:44"],
            ["ACE-0003", "Ana Silva", "Acompanhamento de evolução", "inativo", "2026-05-28 01:10:44", "2026-06-21 01:10:44"],
            ["ACE-0004", "Felipe Costa", "Registro de sessão experimental", "ativo", "2026-04-06 01:10:44", "2026-06-09 01:10:44"],
            ["ACE-0005", "Henrique Alves", "Observação inicial do processo", "ativo", "2026-06-18 01:10:44", "2026-05-24 01:10:44"],
            ["ACE-0006", "Ana Silva", "Acompanhamento de evolução", "inativo", "2026-03-27 01:10:44", "2026-06-09 01:10:44"],
            ["ACE-0007", "Gabriela Rocha", "Registro de sessão experimental", "ativo", "2026-06-11 01:10:44", "2026-06-21 01:10:44"],
            ["ACE-0008", "Gabriela Rocha", "Registro de sessão experimental", "ativo", "2026-06-09 01:10:44", "2026-05-30 01:10:44"],
            ["ACE-0009", "Bruno Santos", "Dados coletados durante atividade", "ativo", "2026-06-20 01:10:44", "2026-05-27 01:10:44"],
            ["ACE-0010", "Henrique Alves", "Registro de sessão experimental", "ativo", "2026-04-30 01:10:44", "2026-06-02 01:10:44"],
            ["ACE-0011", "Eduarda Lima", "Acompanhamento de evolução", "ativo", "2026-04-15 01:10:44", "2026-06-02 01:10:44"],
            ["ACE-0012", "Ana Silva", "Registro de sessão experimental", "ativo", "2026-04-26 01:10:44", "2026-06-08 01:10:44"],
            ["ACE-0013", "Diego Souza", "Registro de sessão experimental", "ativo", "2026-05-03 01:10:44", "2026-06-04 01:10:44"],
            ["ACE-0014", "Gabriela Rocha", "Dados coletados durante atividade", "inativo", "2026-04-04 01:10:44", "2026-06-07 01:10:44"],
            ["ACE-0015", "Ana Silva", "Dados coletados durante atividade", "inativo", "2026-04-10 01:10:44", "2026-06-04 01:10:44"],
            ["ACE-0016", "Bruno Santos", "Acompanhamento de evolução", "inativo", "2026-04-03 01:10:44", "2026-06-19 01:10:44"],
            ["ACE-0017", "Felipe Costa", "Observação inicial do processo", "ativo", "2026-04-06 01:10:44", "2026-06-08 01:10:44"],
            ["ACE-0018", "Carla Oliveira", "Registro de sessão experimental", "inativo", "2026-06-11 01:10:44", "2026-06-03 01:10:44"],
            ["ACE-0019", "Henrique Alves", "Acompanhamento de evolução", "ativo", "2026-03-24 01:10:44", "2026-06-02 01:10:44"],
            ["ACE-0020", "Diego Souza", "Dados coletados durante atividade", "ativo", "2026-06-09 01:10:44", "2026-06-17 01:10:44"],
            ["ACE-0021", "Gabriela Rocha", "Registro de sessão experimental", "inativo", "2026-04-01 01:10:44", "2026-06-05 01:10:44"],
            ["ACE-0022", "Carla Oliveira", "Acompanhamento de evolução", "ativo", "2026-05-13 01:10:44", "2026-06-19 01:10:44"],
            ["ACE-0023", "Ana Silva", "Registro de sessão experimental", "ativo", "2026-06-11 01:10:44", "2026-05-27 01:10:44"],
            ["ACE-0024", "Henrique Alves", "Registro de sessão experimental", "ativo", "2026-04-16 01:10:44", "2026-06-11 01:10:44"],
            ["ACE-0025", "Bruno Santos", "Acompanhamento de evolução", "inativo", "2026-04-23 01:10:44", "2026-06-12 01:10:44"],
            ["ACE-0026", "Bruno Santos", "Dados coletados durante atividade", "inativo", "2026-05-14 01:10:44", "2026-06-09 01:10:44"],
            ["ACE-0027", "Carla Oliveira", "Observação inicial do processo", "ativo", "2026-04-12 01:10:44", "2026-05-31 01:10:44"],
            ["ACE-0028", "Carla Oliveira", "Registro de sessão experimental", "ativo", "2026-04-04 01:10:44", "2026-05-30 01:10:44"],
            ["ACE-0029", "Gabriela Rocha", "Dados coletados durante atividade", "inativo", "2026-05-17 01:10:44", "2026-06-16 01:10:44"],
            ["ACE-0030", "Carla Oliveira", "Dados coletados durante atividade", "inativo", "2026-05-09 01:10:44", "2026-06-05 01:10:44"]
          ];
          sheet_ACERVO.getRange(2, 1, d_sheet_ACERVO.length, h_sheet_ACERVO.length).setValues(d_sheet_ACERVO);
          results.push('OK Acervo: ' + d_sheet_ACERVO.length + ' registros');
        } catch (e) {
          results.push('ERRO Acervo: ' + e.message);
        }

        // AccessLog
        try {
          var sheet_ACCESSLOG = ss.getSheetByName('AccessLog') || ss.insertSheet('AccessLog');
          if (sheet_ACCESSLOG.getLastRow() > 1) {
            sheet_ACCESSLOG.deleteRows(2, sheet_ACCESSLOG.getLastRow() - 1);
          }
          var h_sheet_ACCESSLOG = ["ID", "Timestamp", "Level", "Action", "Entity", "RecordID", "UserID", "Message", "Details", "CreatedAt"];
          sheet_ACCESSLOG.getRange(1, 1, 1, h_sheet_ACCESSLOG.length).setValues([h_sheet_ACCESSLOG]);
          var d_sheet_ACCESSLOG = [
            ["ACC-0001", "2026-05-15 01:10:44", "baixo", "remover", "A", "ACC-0001", "USR-930", "Comportamento dentro do esperado", "Comportamento dentro do esperado", "2026-05-17 01:10:44"],
            ["ACC-0002", "2026-04-24 01:10:44", "baixo", "criar", "C", "ACC-0002", "USR-797", "Comportamento dentro do esperado", "Comportamento dentro do esperado", "2026-04-19 01:10:44"],
            ["ACC-0003", "2026-04-29 01:10:44", "baixo", "visualizar", "D", "ACC-0003", "USR-898", "Observações durante a coleta", "Processo executado com sucesso", "2026-04-08 01:10:44"],
            ["ACC-0004", "2026-06-12 01:10:44", "baixo", "visualizar", "D", "ACC-0004", "USR-950", "Processo executado com sucesso", "Processo executado com sucesso", "2026-06-14 01:10:44"],
            ["ACC-0005", "2026-06-17 01:10:44", "alto", "remover", "B", "ACC-0005", "USR-821", "Comportamento dentro do esperado", "Necessita acompanhamento adicional", "2026-05-16 01:10:44"],
            ["ACC-0006", "2026-04-22 01:10:44", "baixo", "remover", "B", "ACC-0006", "USR-316", "Observações durante a coleta", "Comportamento dentro do esperado", "2026-04-21 01:10:44"],
            ["ACC-0007", "2026-06-10 01:10:44", "alto", "editar", "C", "ACC-0007", "USR-838", "Comportamento dentro do esperado", "Processo executado com sucesso", "2026-06-13 01:10:44"],
            ["ACC-0008", "2026-06-16 01:10:44", "medio", "editar", "B", "ACC-0008", "USR-805", "Comportamento dentro do esperado", "Necessita acompanhamento adicional", "2026-05-21 01:10:44"],
            ["ACC-0009", "2026-06-16 01:10:44", "baixo", "remover", "A", "ACC-0009", "USR-498", "Comportamento dentro do esperado", "Processo executado com sucesso", "2026-04-20 01:10:44"],
            ["ACC-0010", "2026-06-17 01:10:44", "baixo", "visualizar", "A", "ACC-0010", "USR-193", "Processo executado com sucesso", "Comportamento dentro do esperado", "2026-06-20 01:10:44"],
            ["ACC-0011", "2026-05-13 01:10:44", "baixo", "remover", "A", "ACC-0011", "USR-935", "Processo executado com sucesso", "Comportamento dentro do esperado", "2026-05-28 01:10:44"],
            ["ACC-0012", "2026-05-25 01:10:44", "baixo", "criar", "C", "ACC-0012", "USR-332", "Necessita acompanhamento adicional", "Processo executado com sucesso", "2026-04-09 01:10:44"],
            ["ACC-0013", "2026-06-13 01:10:44", "baixo", "criar", "A", "ACC-0013", "USR-573", "Processo executado com sucesso", "Necessita acompanhamento adicional", "2026-04-06 01:10:44"],
            ["ACC-0014", "2026-06-01 01:10:44", "alto", "criar", "A", "ACC-0014", "USR-595", "Comportamento dentro do esperado", "Processo executado com sucesso", "2026-04-17 01:10:44"],
            ["ACC-0015", "2026-05-16 01:10:44", "medio", "visualizar", "C", "ACC-0015", "USR-332", "Observações durante a coleta", "Necessita acompanhamento adicional", "2026-04-29 01:10:44"],
            ["ACC-0016", "2026-05-15 01:10:44", "alto", "editar", "D", "ACC-0016", "USR-452", "Observações durante a coleta", "Comportamento dentro do esperado", "2026-05-16 01:10:44"],
            ["ACC-0017", "2026-05-22 01:10:44", "baixo", "remover", "A", "ACC-0017", "USR-739", "Observações durante a coleta", "Necessita acompanhamento adicional", "2026-05-26 01:10:44"],
            ["ACC-0018", "2026-05-01 01:10:44", "medio", "criar", "B", "ACC-0018", "USR-889", "Processo executado com sucesso", "Processo executado com sucesso", "2026-05-18 01:10:44"],
            ["ACC-0019", "2026-05-31 01:10:44", "baixo", "editar", "C", "ACC-0019", "USR-893", "Necessita acompanhamento adicional", "Observações durante a coleta", "2026-03-25 01:10:44"],
            ["ACC-0020", "2026-06-10 01:10:44", "baixo", "remover", "C", "ACC-0020", "USR-318", "Comportamento dentro do esperado", "Necessita acompanhamento adicional", "2026-05-19 01:10:44"],
            ["ACC-0021", "2026-05-19 01:10:44", "baixo", "visualizar", "B", "ACC-0021", "USR-530", "Processo executado com sucesso", "Necessita acompanhamento adicional", "2026-05-17 01:10:44"],
            ["ACC-0022", "2026-05-18 01:10:44", "medio", "criar", "D", "ACC-0022", "USR-558", "Observações durante a coleta", "Observações durante a coleta", "2026-05-19 01:10:44"],
            ["ACC-0023", "2026-04-25 01:10:44", "medio", "editar", "C", "ACC-0023", "USR-281", "Comportamento dentro do esperado", "Observações durante a coleta", "2026-05-03 01:10:44"],
            ["ACC-0024", "2026-04-24 01:10:44", "alto", "visualizar", "D", "ACC-0024", "USR-241", "Processo executado com sucesso", "Comportamento dentro do esperado", "2026-05-09 01:10:44"],
            ["ACC-0025", "2026-06-18 01:10:44", "medio", "remover", "C", "ACC-0025", "USR-821", "Processo executado com sucesso", "Necessita acompanhamento adicional", "2026-05-05 01:10:44"],
            ["ACC-0026", "2026-05-24 01:10:44", "alto", "visualizar", "C", "ACC-0026", "USR-181", "Comportamento dentro do esperado", "Necessita acompanhamento adicional", "2026-05-31 01:10:44"],
            ["ACC-0027", "2026-06-08 01:10:44", "alto", "editar", "A", "ACC-0027", "USR-708", "Processo executado com sucesso", "Comportamento dentro do esperado", "2026-05-10 01:10:44"],
            ["ACC-0028", "2026-06-15 01:10:44", "baixo", "remover", "C", "ACC-0028", "USR-848", "Processo executado com sucesso", "Processo executado com sucesso", "2026-05-22 01:10:44"],
            ["ACC-0029", "2026-06-15 01:10:44", "baixo", "criar", "D", "ACC-0029", "USR-897", "Necessita acompanhamento adicional", "Processo executado com sucesso", "2026-04-05 01:10:44"],
            ["ACC-0030", "2026-05-09 01:10:44", "baixo", "editar", "C", "ACC-0030", "USR-924", "Comportamento dentro do esperado", "Necessita acompanhamento adicional", "2026-03-25 01:10:44"]
          ];
          sheet_ACCESSLOG.getRange(2, 1, d_sheet_ACCESSLOG.length, h_sheet_ACCESSLOG.length).setValues(d_sheet_ACCESSLOG);
          results.push('OK AccessLog: ' + d_sheet_ACCESSLOG.length + ' registros');
        } catch (e) {
          results.push('ERRO AccessLog: ' + e.message);
        }

        // Settings
        try {
          var sheet_SETTINGS = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
          if (sheet_SETTINGS.getLastRow() > 1) {
            sheet_SETTINGS.deleteRows(2, sheet_SETTINGS.getLastRow() - 1);
          }
          var h_sheet_SETTINGS = ["Key", "Value", "Description", "Scope", "UpdatedAt", "UpdatedBy"];
          sheet_SETTINGS.getRange(1, 1, 1, h_sheet_SETTINGS.length).setValues([h_sheet_SETTINGS]);
          var d_sheet_SETTINGS = [
            ["D", "A", "Dados coletados durante atividade", "B", "2026-06-01 01:10:44", "2026-06-20 01:10:44"],
            ["D", "C", "Dados coletados durante atividade", "C", "2026-05-26 01:10:44", "2026-04-24 01:10:44"],
            ["C", "A", "Dados coletados durante atividade", "A", "2026-05-24 01:10:44", "2026-06-16 01:10:44"],
            ["B", "B", "Acompanhamento de evolução", "C", "2026-05-27 01:10:44", "2026-05-02 01:10:44"],
            ["C", "A", "Observação inicial do processo", "B", "2026-05-25 01:10:44", "2026-05-26 01:10:44"],
            ["A", "A", "Registro de sessão experimental", "A", "2026-06-11 01:10:44", "2026-06-08 01:10:44"],
            ["B", "C", "Registro de sessão experimental", "D", "2026-06-01 01:10:44", "2026-04-26 01:10:44"],
            ["C", "A", "Acompanhamento de evolução", "C", "2026-06-20 01:10:44", "2026-04-29 01:10:44"],
            ["D", "A", "Acompanhamento de evolução", "B", "2026-05-25 01:10:44", "2026-06-13 01:10:44"],
            ["D", "A", "Registro de sessão experimental", "C", "2026-06-01 01:10:44", "2026-06-20 01:10:44"],
            ["B", "A", "Observação inicial do processo", "A", "2026-06-09 01:10:44", "2026-06-03 01:10:44"],
            ["B", "C", "Observação inicial do processo", "B", "2026-05-30 01:10:44", "2026-04-25 01:10:44"],
            ["A", "A", "Registro de sessão experimental", "C", "2026-06-17 01:10:44", "2026-04-22 01:10:44"],
            ["A", "B", "Acompanhamento de evolução", "A", "2026-06-05 01:10:44", "2026-05-13 01:10:44"],
            ["C", "A", "Observação inicial do processo", "C", "2026-06-01 01:10:44", "2026-05-13 01:10:44"],
            ["A", "B", "Registro de sessão experimental", "B", "2026-05-22 01:10:44", "2026-05-18 01:10:44"],
            ["C", "C", "Dados coletados durante atividade", "C", "2026-05-31 01:10:44", "2026-05-16 01:10:44"],
            ["C", "B", "Observação inicial do processo", "C", "2026-06-09 01:10:44", "2026-06-17 01:10:44"],
            ["A", "A", "Acompanhamento de evolução", "D", "2026-06-03 01:10:44", "2026-04-22 01:10:44"],
            ["A", "A", "Acompanhamento de evolução", "D", "2026-05-22 01:10:44", "2026-04-24 01:10:44"],
            ["A", "A", "Acompanhamento de evolução", "D", "2026-06-06 01:10:44", "2026-06-05 01:10:44"],
            ["A", "B", "Acompanhamento de evolução", "C", "2026-05-30 01:10:44", "2026-05-09 01:10:44"],
            ["B", "B", "Dados coletados durante atividade", "C", "2026-06-12 01:10:44", "2026-05-15 01:10:44"],
            ["C", "B", "Observação inicial do processo", "A", "2026-06-09 01:10:44", "2026-05-21 01:10:44"],
            ["D", "D", "Dados coletados durante atividade", "C", "2026-06-11 01:10:44", "2026-06-21 01:10:44"],
            ["B", "B", "Registro de sessão experimental", "A", "2026-06-19 01:10:44", "2026-05-21 01:10:44"],
            ["B", "D", "Registro de sessão experimental", "C", "2026-06-17 01:10:44", "2026-04-25 01:10:44"],
            ["D", "B", "Registro de sessão experimental", "A", "2026-06-07 01:10:44", "2026-05-18 01:10:44"],
            ["C", "B", "Observação inicial do processo", "B", "2026-05-31 01:10:44", "2026-04-22 01:10:44"],
            ["B", "B", "Dados coletados durante atividade", "C", "2026-06-11 01:10:44", "2026-04-28 01:10:44"]
          ];
          sheet_SETTINGS.getRange(2, 1, d_sheet_SETTINGS.length, h_sheet_SETTINGS.length).setValues(d_sheet_SETTINGS);
          results.push('OK Settings: ' + d_sheet_SETTINGS.length + ' registros');
        } catch (e) {
          results.push('ERRO Settings: ' + e.message);
        }

        Logger.log(results.join('\n'));
        return results;
      } catch (error) {
        Logger.log("Erro em populateSyntheticData: " + error.message);
        throw error; // Re-lança para tratamento superior
      }
    } catch (error) {
      Logger.log("Erro em populateSyntheticData: " + error.message);
      throw error;
    }
  } catch (error) {
    Logger.log("Erro em populateSyntheticData: " + error.message);
    throw error;
  }
}
