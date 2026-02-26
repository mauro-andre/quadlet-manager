# Quadlet Manager

Interface web para gerenciamento remoto de containers Podman via Quadlets.

## O Problema

Gerenciar containers Podman com Quadlets hoje exige acesso SSH ao servidor. Não existe uma interface web dedicada para isso:

- **Portainer** — não suporta Quadlets
- **Cockpit + cockpit-podman** — gerencia containers básico, mas não gerencia Quadlets
- **Podman Desktop** — suporta Quadlets, mas é app desktop, não web

## A Proposta

Uma aplicação web leve que substitui o SSH para operações do dia a dia com Podman Quadlets. Inspirada na experiência do Portainer com Docker Compose/Stacks, mas focada no ecossistema Podman + systemd.

## Funcionalidades

### Quadlets
- Criar, editar e remover arquivos `.container`, `.network`, `.volume`
- Instalar quadlets (`podman quadlet install`)
- Atualizar quadlets existentes (`podman quadlet install -r`)
- Editor de texto integrado com syntax highlighting

### Containers
- Listar containers com status em tempo real
- Start, stop, restart via systemctl
- Ver logs (stdout/stderr)
- Inspecionar container (env, volumes, network, ports)
- Pull de imagens
- Terminal web no container (`podman exec`)

### Imagens
- Listar imagens locais
- Pull de novas imagens
- Remover imagens não utilizadas

### Networks e Volumes
- Visualizar networks e quais containers estão conectados
- Gerenciar volumes

### Serviços systemd
- Listar serviços relacionados aos quadlets
- Start, stop, restart, enable, disable
- Ver logs do journalctl

### Deploy
- Atualizar imagem e reiniciar container (pull + restart)
- Gerenciamento de `.env` files dos containers

## Stack Técnico

- **Framework**: VeloJS (Hono + Preact, SSR)
- **Comunicação com Podman**: API REST do Podman (`podman system service`)
- **Comunicação com systemd**: D-Bus ou chamadas CLI
- **Autenticação**: JWT com login local
- **Terminal web**: WebSocket + `podman exec`

## Arquitetura

A aplicação roda como um container no próprio servidor, com acesso ao socket do Podman:

```
[Browser] → [Caddy] → [Quadlet Manager Container]
                              ↓
                    [Podman Socket] → [Podman API]
                    [systemctl]     → [systemd]
```

O container precisa de acesso ao socket do Podman (`/run/podman/podman.sock`) e permissão para executar `systemctl` e `podman quadlet` no host.

## Roadmap

### v0.1 — MVP
- [ ] Listar quadlets instalados
- [ ] Ver status dos containers (running, stopped, etc)
- [ ] Start/stop/restart containers
- [ ] Ver logs dos containers
- [ ] Editor básico de arquivos quadlet
- [ ] Instalar/remover quadlets

### v0.2 — Gerenciamento completo
- [ ] Pull de imagens
- [ ] Deploy (pull + restart)
- [ ] Gerenciamento de `.env` files
- [ ] Inspecionar containers (detalhes, env, volumes)
- [ ] Gerenciar networks e volumes

### v0.3 — Experiência avançada
- [ ] Terminal web no container
- [ ] Monitoramento de CPU/memória
- [ ] Alertas (container caiu, restart loop)
- [ ] Webhook para deploy automático

### v1.0 — Multi-servidor
- [ ] Gerenciar múltiplos servidores
- [ ] Dashboard consolidado
- [ ] Conexão via SSH ou agent remoto
