# Plataforma — Hosting Gerenciado de Containers

## Origem

Nasceu do Quadlet Manager (QM), uma ferramenta open-source para gerenciar containers Podman via Quadlets. O QM é a ferramenta de administração; a Plataforma é o produto voltado ao cliente, construído sobre a mesma infraestrutura.

## Visão

**"Heroku brasileiro, 10x mais barato, sem lock-in."**

Uma plataforma de hosting gerenciado que abstrai toda a complexidade de infraestrutura. Desenvolvedores fazem deploy de apps em segundos sem saber o que é Podman, Quadlet ou systemd.

## Público Alvo

- Devs solo que querem entregar sem aprender AWS
- Freelancers que precisam de hosting para projetos de clientes
- Pequenas startups construindo MVPs
- Indie hackers construindo produtos SaaS

## Diferenciais

- **Simples como Heroku** — deploy em poucos cliques
- **Barato como VPS** — servidores dedicados por trás, custo baixo
- **Sem vendor lock-in** — containers OCI padrão, leva suas imagens pra qualquer lugar
- **Transparente** — engine open-source, cliente sabe o que roda por baixo
- **Raízes brasileiras** — preço em BRL, suporte em português, servidores no Brasil
- **Alcance global** — UI em inglês, acessível mundialmente

## Arquitetura

Dois produtos separados, mesma infraestrutura:

- **Quadlet Manager (QM)** — painel admin para gerenciar servidores (self-host, open-source)
- **Plataforma** — painel do cliente para gerenciar apps (UX simplificada, multi-tenant)

Por baixo dos panos: Podman + Quadlets + Caddy (proxy reverso + SSL automático) + systemd.

## Funcionalidades Principais

### 1. Deploy de Apps (Apps Customizadas)

O dev conecta um repositório GitHub, seleciona branch ou tag. A cada push:

1. Plataforma clona o repo (ou recebe webhook)
2. Detecta Dockerfile → usa ele. Sem Dockerfile → **Nixpacks** detecta a linguagem e builda automaticamente
3. `podman build` localmente no servidor
4. Imagem fica local (sem registry externo)
5. Quadlet criado/atualizado → container deployado
6. Auto-deploy on push (toggle)

**O dev nunca toca em registry ou escreve Dockerfile.**

### 2. Loja de Apps (Instalação com 1 Clique)

Catálogo de apps pré-configuradas. Cada app é um template:

```json
{
  "name": "MongoDB",
  "icon": "mongodb.svg",
  "description": "Banco NoSQL",
  "category": "database",
  "image": "docker.io/library/mongo:latest",
  "volumes": [
    { "mount": "/data/db", "label": "Data" }
  ],
  "ports": [
    { "container": 27017, "label": "MongoDB" }
  ],
  "env": [
    { "key": "MONGO_INITDB_ROOT_USERNAME", "label": "Usuário admin", "default": "admin" },
    { "key": "MONGO_INITDB_ROOT_PASSWORD", "label": "Senha admin", "generate": "random" }
  ]
}
```

**Fluxo:** Navega no catálogo → Clica "Instalar" → Preenche configs → Pronto.

O catálogo é um repositório Git público — comunidade contribui templates via PRs.

**Categorias iniciais:**
- **Bancos de dados:** PostgreSQL, MySQL, MongoDB, Redis, MariaDB
- **Ferramentas:** n8n, Metabase, Grafana, Uptime Kuma, MinIO
- **CMS:** WordPress, Ghost, Strapi
- **Dev:** Gitea, Drone CI, Registry

Começa com 10-15 apps populares, comunidade cresce o resto.

### 3. Ambientes

Espaços isolados por projeto. Cada ambiente é uma network Podman.

- Cliente cria ambiente "MeuSaaS"
- Instala MongoDB da loja → entra na network do ambiente
- Instala Redis → entra na mesma network
- Faz deploy da API → entra na mesma network, conecta em `mongodb:27017` pelo nome do container
- Isolamento total entre ambientes

### 4. Domínios Customizados

- Cliente adiciona domínio → plataforma mostra registros DNS pra configurar
- Caddy cuida do SSL automaticamente (Let's Encrypt)
- HTTPS sem configuração

## Interface do Painel do Cliente

### Dashboard (Home)
- Resumo: apps rodando, storage usado, plano atual
- Status rápido: verde/vermelho por app

### Apps
- Lista com status (running, stopped, deploying)
- Por app: logs (tempo real), variáveis de ambiente, domínio custom, restart/stop/redeploy, métricas básicas (CPU, RAM)

### Loja de Apps
- Grid visual com ícones e categorias
- Clica → configura → instala

### Ambientes
- Lista de ambientes
- Dentro de cada: apps que pertencem a ele

### Deploy (GitHub)
- Conecta repo → seleciona branch
- Toggle de auto-deploy
- Histórico de deploys com rollback

### Domínios
- Lista de domínios configurados
- Adicionar domínio → instruções DNS → SSL automático

### Billing
- Plano atual, uso, próxima cobrança
- Upgrade/downgrade
- Histórico de faturas

### Configurações
- Perfil, senha, API key
- Notificações (app caiu, deploy falhou)

### O que NÃO incluir:
- Terminal/SSH — risco de segurança, quebra a abstração
- Configuração manual de rede/volume — fica escondido
- Métricas avançadas — só nos planos Pro/Business

## Infraestrutura e Multi-Tenancy

### Servidores compartilhados (multi-tenant)

Vários clientes por servidor. Exemplo: Hetzner AX42 (8 cores, 64GB RAM, 2TB NVMe) a ~€50/mês hospeda 30-50 clientes pequenos.

Margem: €50 de custo → R$1.500+ de receita.

### Limites de recursos por container

Limites nativos do Podman, invisíveis pro cliente:

```ini
[Container]
PodmanArgs=--memory=512m
PodmanArgs=--cpus=0.5
```

### Escalar servidores

- Monitora uso total (CPU, RAM, disco)
- Chegou em 70% → provisiona novo servidor
- Novos clientes vão pro novo servidor
- Clientes existentes ficam onde estão (migração só se necessário)

### Mudança de plano

Quando o cliente muda de plano:
1. Atualiza plano no banco
2. Reescreve limites de recursos nos quadlets dele
3. `systemctl daemon-reload` + restart dos containers
4. Downgrade: avisa se uso atual excede os novos limites

## Modelo de Preços

Vende **simplicidade, não recursos**. Nada de vCPU/RAM.

| Plano | Preço | Apps | Bancos | Storage | RAM/app | Comportamento |
|-------|-------|------|--------|---------|---------|---------------|
| Starter | R$9/mês | 1 | 1 | 1GB | 256MB | Cold start (dorme após 30min) |
| Dev | R$29/mês | 3 | 1 | 5GB | 512MB | Sempre ligado |
| Pro | R$79/mês | 10 | 3 | 20GB | 1GB | Sempre ligado |
| Business | R$199/mês | Ilimitado | Ilimitado | 50GB | 2GB | Sempre ligado |

### Cold Start (Plano Starter)

- App dorme após 30min sem tráfego
- Primeiro request acorda (~3-5s de delay)
- Container dormindo = custo zero
- Incentivo natural ao upgrade: usuários do cliente reclamam da demora → cliente faz upgrade

### Sem free tier permanente

Free tier atrai freeloaders e drena recursos. Em vez disso:
- **Trial de 7 dias** sem cartão de crédito para testar
- **R$9/mês Starter** como mínimo — valor simbólico que filtra abuso
- Após o trial: container para, dados preservados por 30 dias

## Provedores de Hosting

| Provedor | Localização | Observações |
|----------|-------------|-------------|
| Hetzner | Europa | Melhor custo-benefício, servidores dedicados potentes |
| OVH | São Paulo | Datacenter no Brasil, baixa latência |
| Oracle Cloud | São Paulo | Free tier generoso pra começar |

Evitar Hostinger/Hostgator — VPS fraco, não serve pra esse uso.

## Estratégia de Go-to-Market

### Encontrando os primeiros clientes (0 → 100)

1. **Comunidades dev BR** — TabNews, dev.to/pt, grupos Discord/Telegram, r/brdev
2. **Twitter/X dev BR** — vídeos curtos mostrando deploy em 30 segundos
3. **YouTube** — tutoriais: "suba sua API Node em 2 minutos"
4. **Freelancers** — oferecer como hosting dos projetos entregues aos clientes
5. **Indie Hackers BR** — quem constrói SaaS precisa de hosting barato
6. **Parcerias com bootcamps** — alunos precisam de hosting pro projeto final
7. **Botões "Deploy na [Plataforma]"** — em repos populares do GitHub

### O que NÃO fazer no início

- Não gastar com ads
- Não escalar antes de ter 10 clientes felizes
- Não construir tudo antes de vender — lançar MVP e iterar

### Playbook

1. Fazer funcionar pra 5 pessoas (amigos, conhecidos)
2. Pegar feedback, ajustar
3. Lançar público com trial
4. Produzir conteúdo mostrando a simplicidade
5. Crescer orgânico

## Modelo de Negócio

**Engine open-source, serviço gerenciado pago.** Mesmo modelo de:

- Vercel (Next.js é open-source, plataforma é paga)
- Supabase (Postgres open-source, plataforma managed paga)
- GitLab (self-hosted grátis, cloud pago)

O código é grátis. O dinheiro vem do serviço gerenciado.

**"Vendendo pá na corrida do ouro."** Ao invés de construir um SaaS, vende a infraestrutura onde produtos SaaS rodam. Quanto mais SaaS são criados, mais clientes aparecem.

## Funcionalidades Futuras (não para v1)

- **Escalonamento horizontal / load balancing** — Caddy nativo com `reverse_proxy` e múltiplos upstreams. Só quando clientes precisarem (feature de plano Pro/Business).
- **Multi-região** — servidores em múltiplas localizações, cliente escolhe
- **Colaboração em time** — múltiplos usuários por conta
- **Visualização de pipeline CI/CD** — logs de build, previews de deploy
- **Backups gerenciados** — automatizados, agendados, restore com 1 clique
- **SSO/LDAP** — feature enterprise
- **Acesso via API** — deploy/gerenciamento programático
