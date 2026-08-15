const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = e.parameter.action;
  let result;

  try {
    if (action === 'getHero') result = getHero();
    else if (action === 'getQuests') result = getQuests();
    else if (action === 'getHistorico') result = getHistorico();
    else if (action === 'addQuest') result = addQuest(e.parameter);
    else if (action === 'completeQuest') result = completeQuest(e.parameter);
    else if (action === 'deleteQuest') result = deleteQuest(e.parameter);
    else if (action === 'resetDailies') result = resetDailies();
    else result = { error: 'Acao desconhecida' };
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHero() {
  const sheet = SS.getSheetByName('hero');
  const row = sheet.getRange(2, 1, 1, 8).getValues()[0];

  return {
    nivel: row[0],
    exp_atual: row[1],
    exp_necessaria: row[2],
    forca: row[3],
    magia: row[4],
    carisma: row[5],
    inteligencia: row[6],
    data_limite: row[7],
  };
}

function getQuests() {
  const sheet = SS.getSheetByName('quests');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  return rows.slice(1).filter((r) => r[0] !== '').map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i];
    });
    return obj;
  });
}

function getHistorico() {
  const sheet = SS.getSheetByName('historico');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  return rows.slice(1).filter((r) => r[0] !== '').map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i];
    });
    return obj;
  }).reverse();
}

function addQuest(params) {
  const sheet = SS.getSheetByName('quests');
  const id = new Date().getTime().toString();
  const data = new Date().toLocaleString('pt-BR');

  sheet.appendRow([id, params.nome, params.tipo, params.atributo, 'ativa', data]);

  return { success: true, id };
}

function resetDailies() {
  const sheet = SS.getSheetByName('quests');
  const rows = sheet.getDataRange().getValues();
  let resetCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const tipo = rows[i][2];
    const status = rows[i][4];

    if (tipo === 'diaria' && status === 'concluida') {
      sheet.getRange(i + 1, 5).setValue('ativa');
      resetCount++;
    }
  }

  return { success: true, resetCount };
}

function completeQuest(params) {
  const questSheet = SS.getSheetByName('quests');
  const heroSheet = SS.getSheetByName('hero');
  const histSheet = SS.getSheetByName('historico');

  const rows = questSheet.getDataRange().getValues();
  let questRow = -1;
  let quest = null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == params.id) {
      questRow = i + 1;
      quest = { nome: rows[i][1], tipo: rows[i][2], atributo: rows[i][3] };
      break;
    }
  }

  if (!quest) return { error: 'Quest nao encontrada' };

  questSheet.getRange(questRow, 5).setValue('concluida');
  questSheet.getRange(questRow, 6).setValue(new Date().toLocaleString('pt-BR'));

  const expGanho = quest.tipo === 'principal' ? 30 : 10;
  const pontosAtrib = quest.tipo === 'principal' ? 3 : 1;

  let [nivel, expAtual, expNec, forca, magia, carisma, inteligencia] =
    heroSheet.getRange(2, 1, 1, 7).getValues()[0];

  expAtual += expGanho;

  const atrib = quest.atributo.toLowerCase();
  if (atrib === 'forca') forca += pontosAtrib;
  else if (atrib === 'magia') magia += pontosAtrib;
  else if (atrib === 'carisma') carisma += pontosAtrib;
  else if (atrib === 'inteligencia') inteligencia += pontosAtrib;

  let levelUp = false;
  while (expAtual >= expNec) {
    expAtual -= expNec;
    nivel++;
    expNec = Math.round(expNec * 1.2);
    levelUp = true;
  }

  heroSheet.getRange(2, 1, 1, 7).setValues([[
    nivel,
    expAtual,
    expNec,
    forca,
    magia,
    carisma,
    inteligencia,
  ]]);

  histSheet.appendRow([
    new Date().toLocaleString('pt-BR'),
    quest.nome,
    expGanho,
    quest.atributo,
    pontosAtrib,
    nivel,
  ]);

  return {
    success: true,
    levelUp,
    nivel,
    expAtual,
    expNec,
    forca,
    magia,
    carisma,
    inteligencia,
    expGanho,
    pontosAtrib,
    atributo: quest.atributo,
  };
}

function deleteQuest(params) {
  const sheet = SS.getSheetByName('quests');
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == params.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { error: 'Quest nao encontrada' };
}
