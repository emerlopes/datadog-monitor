const axios = require('axios');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

// Configurações
const ACTUATOR_URL = 'http://localhost:8080/actuator/mappings'; // URL para consultar os endpoints
const GIT_REPO_URL = 'https://github.com/seu-usuario/repo-monitoramento.git'; // Repositório do GitHub
const REPO_DIR = path.join(process.cwd(), 'repo-monitoramento'); // Diretório do repositório clonado
const MONITOR_DIR = path.join(REPO_DIR, 'monitor'); // Pasta onde os arquivos serão salvos
const BRANCH_NAME = 'feature/create-alarms'; // Nome da nova branch

// Template de alerta
const ALERT_TEMPLATE = (endpoint, tags) => ({
  name: `Alert for ${endpoint}`,
  type: 'query alert',
  query: `avg(last_5m):avg:http.endpoint.latency{endpoint=${endpoint}} > 500`,
  message: `High latency detected for ${endpoint}`,
  tags: tags,
  priority: 'normal',
});

// Função para consultar os endpoints do Actuator
async function fetchEndpoints() {
  try {
    const response = await axios.get(ACTUATOR_URL);
    const endpoints = response.data.contexts.application.mappings.dispatcherServlets.dispatcherServlet;
    console.log(`Encontrados ${endpoints.length} endpoints.`);
    return endpoints;
  } catch (error) {
    console.error('Erro ao consultar os endpoints:', error.message);
    throw error;
  }
}

// Função para gerar arquivos JSON para cada endpoint
async function generateAlertFiles(endpoints) {
  if (!fs.existsSync(MONITOR_DIR)) {
    await fs.mkdirp(MONITOR_DIR);
  }

  for (const endpoint of endpoints) {
    const predicate = endpoint.predicate || '';
    const handler = endpoint.handler.split('#')[0].replace(/\./g, '_');
    const tags = [`endpoint:${predicate}`, 'service:my-service'];

    // Cria o JSON de alerta
    const alert = ALERT_TEMPLATE(predicate, tags);

    // Salva o arquivo na pasta monitor
    const filePath = path.join(MONITOR_DIR, `${handler}.json`);
    await fs.writeJson(filePath, alert, { spaces: 2 });
    console.log(`Arquivo criado: ${filePath}`);
  }
}

// Função para clonar o repositório
async function cloneRepository() {
  const git = simpleGit();

  if (fs.existsSync(REPO_DIR)) {
    console.log('Repositório já clonado. Usando o diretório existente.');
    return git.cwd(REPO_DIR);
  }

  console.log('Clonando o repositório...');
  await git.clone(GIT_REPO_URL, REPO_DIR);
  return git.cwd(REPO_DIR);
}

// Função para criar branch, commit e push
async function commitAndPushChanges(git) {
  console.log('Criando nova branch...');
  await git.checkoutLocalBranch(BRANCH_NAME);

  console.log('Adicionando arquivos...');
  await git.add('./*');

  console.log('Realizando commit...');
  await git.commit('feat: created alarms for all endpoints');

  console.log('Fazendo push...');
  await git.push('origin', BRANCH_NAME);
  console.log(`Alterações enviadas para a branch ${BRANCH_NAME}`);
}

// Função principal
async function main() {
  try {
    // 1. Consulta os endpoints
    const endpoints = await fetchEndpoints();

    // 2. Clona o repositório
    const git = await cloneRepository();

    // 3. Gera arquivos JSON
    await generateAlertFiles(endpoints);

    // 4. Commit e push das alterações
    await commitAndPushChanges(git);

    console.log('Processo concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante o processo:', error.message);
  }
}

main();
