import os
import json
import requests
from git import Repo

# Configurações
ACTUATOR_URL = "http://target-application:8080/actuator/mappings"
OUTPUT_DIR = "./alerts/"
GIT_REPO_URL = "https://github.com/seu-usuario/repo-alertas.git"
BRANCH_NAME = "auto-alerts-branch"

# Função para consultar os endpoints
def fetch_endpoints(url):
    response = requests.get(url)
    if response.status_code == 200:
        print("Endpoints obtidos com sucesso!")
        data = response.json()
        return data["contexts"]["application"]["mappings"]["dispatcherServlets"]["dispatcherServlet"]
    else:
        print(f"Erro ao consultar os endpoints: {response.status_code}")
        return []

# Função para gerar arquivos JSON
def generate_alert_files(endpoints, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for endpoint in endpoints:
        predicate = endpoint.get("predicate", "")
        handler = endpoint.get("handler", "").split("#")[0].replace(".", "_")

        # Estrutura do alerta
        alert_data = {
            "name": f"Alert for {predicate}",
            "type": "query alert",
            "query": f"avg(last_5m):avg:http.endpoint.latency{{endpoint={predicate}}} > 500",
            "message": f"High latency detected for {predicate}",
            "priority": "normal",
        }

        # Salva o arquivo JSON
        file_path = os.path.join(output_dir, f"{handler}.json")
        with open(file_path, "w") as file:
            json.dump(alert_data, file, indent=4)

    print(f"Arquivos JSON gerados na pasta: {output_dir}")

# Função para clonar o repositório
def clone_repository(repo_url, local_path):
    if os.path.exists(local_path):
        print("Repositório já clonado. Usando a cópia local.")
        repo = Repo(local_path)
    else:
        print("Clonando o repositório...")
        repo = Repo.clone_from(repo_url, local_path)
    return repo

# Função para criar uma nova branch e fazer commit
def create_branch_and_commit(repo, branch_name, commit_message):
    # Cria uma nova branch
    if branch_name in repo.heads:
        repo.head.reference = repo.heads[branch_name]
    else:
        new_branch = repo.create_head(branch_name)
        repo.head.reference = new_branch

    repo.head.reset(index=True, working_tree=True)

    # Adiciona os arquivos e faz o commit
    repo.git.add(A=True)
    repo.index.commit(commit_message)
    print(f"Commit realizado na branch '{branch_name}'.")

# Função para push das alterações
def push_changes(repo, branch_name):
    try:
        origin = repo.remote(name="origin")
        origin.push(branch_name)
        print(f"Alterações enviadas para a branch '{branch_name}'.")
    except Exception as e:
        print(f"Erro ao enviar alterações: {e}")

# Função principal
def main():
    # Passo 1: Consultar os endpoints
    endpoints = fetch_endpoints(ACTUATOR_URL)

    # Passo 2: Gerar arquivos JSON
    generate_alert_files(endpoints, OUTPUT_DIR)

    # Passo 3: Clonar o repositório
    repo = clone_repository(GIT_REPO_URL, "./repo-alertas")

    # Passo 4: Criar nova branch e fazer commit
    create_branch_and_commit(repo, BRANCH_NAME, "Automated alerts for new endpoints")

    # Passo 5: Enviar alterações
    push_changes(repo, BRANCH_NAME)

if __name__ == "__main__":
    main()
