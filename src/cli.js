import inquirer from 'inquirer';

export async function askQuery() {
  return inquirer.prompt({ type: 'input', name: 'query', message: '🔍 ID ou nome:' });
}

export async function chooseManga(choices) {
  if (!choices?.length) return null;
  const { id } = await inquirer.prompt({
    type: 'list',
    name: 'id',
    message: '📚 Mangá encontrado:',
    choices,
    pageSize: Math.min(10, choices.length),
  });
  return id;
}

export async function chooseLanguage(langs) {
  const choices = [...langs].sort((a, b) => a.localeCompare(b));
  const { language } = await inquirer.prompt({
    type: 'list',
    name: 'language',
    message: '🌐 Idioma:',
    choices,
    pageSize: Math.min(12, choices.length || 12),
  });
  return language;
}

export async function chooseMode() {
  const { mode } = await inquirer.prompt({
    type: 'list',
    name: 'mode',
    message: '📥 Modo de download:',
    choices: [
      { name: 'Por Volume', value: 'volume' },
      { name: 'Por Capítulo', value: 'chapter' },
    ],
  });
  return mode;
}

export async function chooseFormat() {
  const { format } = await inquirer.prompt({
    type: 'list',
    name: 'format',
    message: '💾 Formato de saída:',
    choices: [
      { name: 'PDF', value: 'pdf' },
      { name: 'ZIP/CBZ', value: 'zip' },
      { name: 'Arquivos soltos (JPG/PNG)', value: 'loose' },
    ],
  });
  let pdfPerChapter = false;
  if (format === 'pdf') {
    ({ pdfPerChapter } = await inquirer.prompt({
      type: 'confirm',
      name: 'pdfPerChapter',
      message: '📄 Gerar um PDF por capítulo?',
      default: false,
    }));
  }
  return { format, pdfPerChapter };
}

export async function chooseChaptersDisplay(choices) {
  const { picked } = await inquirer.prompt({
    type: 'checkbox',
    name: 'picked',
    message: '📖 Escolha os capítulos:',
    choices,
    pageSize: Math.min(20, choices.length || 20),
    validate: (xs) => (xs.length ? true : 'Selecione pelo menos um capítulo.'),
  });
  return picked;
}

export async function chooseVolumesDisplay(volKeys) {
  const isObj = typeof volKeys[0] === 'object';
  const choices = isObj ? volKeys : volKeys.map((v) => ({ name: v, value: v }));
  const { picked } = await inquirer.prompt({
    type: 'checkbox',
    name: 'picked',
    message: '📚 Escolha os volumes:',
    choices,
    pageSize: Math.min(20, choices.length || 20),
    validate: (xs) => (xs.length ? true : 'Selecione pelo menos um volume.'),
  });
  return picked;
}

export async function confirmCount(n) {
  const { ok } = await inquirer.prompt({
    type: 'confirm',
    name: 'ok',
    message: `🔽 Confirmar download de ${n} item(ns)?`,
    default: true,
  });
  return ok;
}
