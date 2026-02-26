# VeloJS - Documentação Técnica para Desenvolvimento

Este documento fornece contexto técnico completo do VeloJS para que desenvolvedores (humanos ou IA) possam entender a arquitetura e continuar o desenvolvimento.

---

## 1. Visão Geral

**VeloJS** é um framework fullstack para aplicações web com:
- **SSR (Server-Side Rendering)** com Hono
- **Hidratação client-side** com Preact
- **Roteamento** com wouter-preact
- **Actions** (RPCs client→server)
- **Loaders** (data fetching no servidor)
- **Middlewares** (proteção de rotas)

### Stack Tecnológico
- **Server**: Hono (framework web minimalista)
- **Client**: Preact + @preact/signals
- **Build**: Vite com plugin customizado
- **Roteamento**: wouter-preact (client) + Hono (server)

---

## 2. Estrutura de Arquivos

```
velojs/
├── bin/
│   └── velojs.js       # CLI entry point (node wrapper)
├── src/
│   ├── index.ts        # Exports principais (types, config, Scripts)
│   ├── server.tsx      # Server: createApp, startServer, SSR
│   ├── client.tsx      # Client: startClient, hidratação
│   ├── hooks.tsx       # Hooks: useLoader
│   ├── vite.ts         # Plugin Vite (transformações AST + config)
│   ├── cli.ts          # CLI: dev, build, start commands
│   ├── components.tsx  # Componentes: Scripts
│   ├── types.ts        # Tipos TypeScript
│   ├── config.ts       # Configuração (VeloConfig)
│   ├── cookie.ts       # Helpers para cookies
│   └── factory.ts      # Re-export do Hono factory
├── package.json
└── tsconfig.json
```

---

## 3. CLI (`cli.ts`)

O VeloJS possui uma CLI para desenvolvimento e produção.

### 3.1 Comandos Disponíveis

```bash
velojs dev      # Inicia servidor de desenvolvimento (Vite dev server)
velojs build    # Build de produção (client + server)
velojs start    # Inicia servidor de produção
velojs help     # Mostra ajuda
```

### 3.2 Funcionamento Interno

```typescript
// velojs dev
// Executa: npx vite (com todas as opções passadas)

// velojs build
// Executa em sequência:
// 1. npx vite build          (client build)
// 2. npx vite build --mode server  (server build)

// velojs start
// Executa: node dist/server.js
```

### 3.3 Estrutura do Bin

```javascript
// bin/velojs.js - Wrapper que executa o CLI via tsx
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
const cliPath = resolve(__dirname, "../src/cli.ts");
spawnSync("npx", ["tsx", cliPath, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
});
```

### 3.4 Uso no package.json do Projeto

```json
{
    "scripts": {
        "dev": "velojs dev",
        "build": "velojs build",
        "start": "NODE_ENV=production velojs start"
    }
}
```

---

## 4. Tipos Principais (`types.ts`)

```typescript
// Argumentos passados para loaders
interface LoaderArgs {
    params: Record<string, string>;  // Parâmetros de URL (:id, etc)
    query: Record<string, string>;   // Query string (?foo=bar)
}

// Argumentos passados para actions
interface ActionArgs<TBody = unknown> {
    body: TBody;                      // Corpo da requisição
    params?: Record<string, string>;  // Parâmetros de URL
    query?: Record<string, string>;   // Query string
    c?: Context;                      // Hono Context (cookies, headers, etc)
}

// Metadados injetados pelo plugin em cada módulo
interface Metadata {
    moduleId: string;    // ID baseado no path do arquivo (ex: "auth/Login")
    fullPath?: string;   // Path completo da rota (ex: "/admin/login")
}

// Módulo de rota (cada arquivo de página)
interface RouteModule {
    Component: ComponentType<any>;    // Componente Preact
    loader?: (args: LoaderArgs) => Promise<any>;  // Loader (server-only)
    metadata?: Metadata;              // Metadados injetados pelo plugin
    [key: `action_${string}`]: (args: ActionArgs) => Promise<any>;  // Actions
}

// Nó da árvore de rotas
interface RouteNode {
    path?: string;                    // Caminho da rota ("/admin", "/:id")
    module: RouteModule;              // Módulo importado
    children?: RouteNode[];           // Rotas filhas (aninhamento)
    middlewares?: MiddlewareHandler[];// Middlewares Hono
    isRoot?: boolean;                 // Marca o root (html, head, body)
}

// Array de rotas da aplicação
type AppRoutes = RouteNode[];
```

---

## 5. Fluxo Server-Side (`server.tsx`)

### 5.1 Registro de Rotas

O server usa `metadata.fullPath` (injetado pelo plugin) para registrar as rotas GET:

```
registerRoutes(app, routes)
    ├── Para cada RouteNode:
    │   ├── Acumula modules: [...parentModules, node.module]
    │   ├── Acumula middlewares: [...parentMiddlewares, ...node.middlewares]
    │   │
    │   ├── Se tem children → recursão
    │   └── Se é folha:
    │       ├── Extrai fullPath do metadata do módulo
    │       └── Registra rota GET no fullPath com middlewares
```

**Por que usar `metadata.fullPath`?**
- O path é calculado uma vez pelo plugin (build-time)
- Evita recalcular paths em runtime
- Consistência: a mesma fonte de verdade para server e Link component

### 5.2 Fluxo de Requisição GET (página)

```
Request GET /admin/login
    │
    ├── Middlewares executam em ordem (auth, logging, etc)
    │
    ├── loadPage(modules, context)
    │   ├── Executa todos os loaders em paralelo
    │   └── Retorna { components, data }
    │
    ├── nestComponents(components)
    │   └── Aninha: Layout1 > Layout2 > Page
    │
    └── renderPage(context, nestedComponent, data)
        ├── Se ?_data=1 → retorna JSON (navegação SPA)
        └── Senão → renderiza HTML + injeta window.__PAGE_DATA__
```

### 5.3 Registro de Actions

```
registerActionRoutes(app, routes)
    ├── Para cada módulo com action_*:
    │   └── Registra POST /_action/{moduleId}/{actionName}
    │       ├── Aplica middlewares acumulados
    │       ├── Extrai body do request
    │       └── Chama action({ body, params, query, c })
```

---

## 6. Fluxo Client-Side (`client.tsx`)

### 6.1 Geração de Rotas com Regex Dinâmico

O client gera padrões regex específicos para cada layout baseado nos paths dos filhos imediatos:

```typescript
pathToRegexPattern(path)
    │
    └── Converte :param para [^/]+ (match qualquer valor)
        Ex: "/:id" → "/[^/]+"
        Ex: "/users/:id/posts" → "/users/[^/]+/posts"

buildLayoutRegex(basePath, children)
    │
    ├── Converte paths para padrões regex (trata :params)
    │
    ├── Se só tem filho com path vazio:
    │   └── Retorna regex de match exato: /^\/admin\/?$/
    │
    ├── Se tem filho vazio + outros:
    │   └── Retorna: /^\/admin(\/?$|\/login|\/esqueci-senha)/
    │
    └── Se só filhos com paths não-vazios:
        └── Retorna: /^\/admin(\/login|\/esqueci-senha)/
        └── Com params: /^\/teste(\/[^/]+)/  (para /:pathAppliedId)
```

**Por que usar regex dinâmico?**

Problema: Dois layouts com mesmo path prefix (`/admin`) conflitam no `<Switch>`.

```typescript
// routes.tsx - AuthLayout e AdminLayout ambos em /admin
{ path: "/admin", module: AuthLayout, children: [
    { path: "/login", module: Login },
    { path: "/esqueci-senha", module: ResetPassword },
]},
{ path: "/admin", module: AdminLayout, children: [
    { path: "", module: AdminHome },
]},
```

Solução: Cada layout só faz match nos paths específicos dos seus filhos:

```tsx
// Gerado automaticamente:
<Switch>
  {/* AuthLayout: match /admin/login OU /admin/esqueci-senha */}
  <Route path={/^\/admin(\/login|\/esqueci-senha)/}>
    <AuthLayout>...</AuthLayout>
  </Route>

  {/* AdminLayout: match exato /admin */}
  <Route path={/^\/admin\/?$/}>
    <AdminLayout>...</AdminLayout>
  </Route>
</Switch>
```

### 6.2 Hidratação

```typescript
startClient({ routes })
    │
    ├── buildRoutes(routes) gera árvore de componentes wouter
    │   └── Cada layout tem regex específico dos seus filhos
    │
    └── hydrate(<Router><ClientRoutes /></Router>, document.body)
```

### 6.3 Navegação SPA

```
Clique em <Link to={LoginPage}>
    │
    ├── Link resolve metadata.fullPath → "/admin/login"
    ├── Prefixo ~ para path absoluto → "~/admin/login"
    │
    ├── wouter intercepta (não faz full reload)
    │
    ├── useLocation() atualiza
    │
    ├── Switch encontra Route com regex que matcha
    │   └── /^\/admin(\/login|\/esqueci-senha)/ ✓
    │
    └── useLoader busca dados via fetch(?_data=1)
```

---

## 7. Plugin Vite (`vite.ts`)

O plugin usa **Babel AST** para transformações seguras do código e gerencia toda a configuração do Vite.

### 7.1 Configuração Absorvida

O `veloPlugin()` absorve toda a configuração necessária, deixando o `vite.config.ts` do usuário minimalista:

```typescript
// vite.config.ts do usuário - super limpo!
import { defineConfig } from "vite";
import { veloPlugin } from "velojs/vite";

export default defineConfig({
    plugins: [veloPlugin()],
});
```

**O que o plugin configura automaticamente:**

| Configuração | Valor |
|--------------|-------|
| Preact preset | `@preact/preset-vite` |
| Dev server | `@hono/vite-dev-server` com entry virtual |
| Build client | `outDir: "dist/client"`, `manifest: true` |
| Build server | `ssr: true`, `outDir: "dist"`, `entryFileNames: "server.js"` |
| Aliases | `react` → `preact/compat`, `react-dom` → `preact/compat` |
| Define | `process.env.NODE_ENV` |

### 7.2 Virtual Modules

O plugin cria entry points virtuais que importam os arquivos do usuário:

```typescript
// Virtual: virtual:velo/server-entry
import "./app/server.js";           // Init do usuário
import routes from "./app/routes.js"; // Rotas do usuário
import { startServer } from "velojs/server";

export default await startServer({ routes });

// Virtual: virtual:velo/client-entry
import "./app/client.js";           // Init do usuário
import routes from "./app/routes.js"; // Rotas do usuário
import { startClient } from "velojs/client";

startClient({ routes });
```

### 7.3 Estrutura de Arquivos do Usuário

```
app/
├── server.tsx    # Init do servidor (DB connections, etc)
├── client.tsx    # Init do cliente (CSS imports, etc)
├── routes.tsx    # export default [...] satisfies AppRoutes
└── ...           # Componentes e módulos
```

**Exemplo de routes.tsx:**
```typescript
import type { AppRoutes } from "velojs";
import * as Root from "./client-root.js";
import * as Home from "./Home.js";

export default [
    {
        module: Root,
        isRoot: true,
        children: [
            { path: "/", module: Home },
        ],
    },
] satisfies AppRoutes;
```

### 7.4 Configuração Customizada

```typescript
import { veloPlugin } from "velojs/vite";

veloPlugin({
    appDirectory: "./app",      // default: "./app"
    routesFile: "routes.tsx",   // default: "routes.tsx"
    serverInit: "server.tsx",   // default: "server.tsx"
    clientInit: "client.tsx",   // default: "client.tsx"
});
```

### 7.5 Injeção de fullPath

O plugin extrai os fullPaths do arquivo de rotas no `buildStart` hook:

```typescript
buildFullPathMap(routesCode)
    │
    ├── Parse do routes.tsx com Babel
    │
    ├── Fase 1: Coleta imports
    │   └── Map: localName → source ("Login" → "./auth/Login.js")
    │
    ├── Fase 2: Percorre árvore de rotas
    │   └── Acumula paths: parentPath + node.path
    │
    └── Fase 3: Gera Map moduleId → fullPath
        └── "auth/Login" → "/admin/login"
```

Durante o `transform`, o plugin injeta o fullPath no metadata de cada módulo:

```typescript
// Se o módulo está no Map de fullPaths
const fullPath = fullPathMap.get(moduleId);
injectMetadata(code, moduleId, fullPath);

// Resultado:
export const metadata = {
    moduleId: "auth/Login",
    fullPath: "/admin/login"
};
```

### 7.6 Transformações AST

| # | Função | Quando | O que faz |
|---|--------|--------|-----------|
| 1 | `injectMetadata` | Server + Client | Adiciona `export const metadata = { moduleId, fullPath }` |
| 2 | `transformUseLoader` | Server + Client | Injeta moduleId: `useLoader()` → `useLoader("moduleId")` e `Loader()` → `Loader("moduleId")` |
| 3 | `transformActionsForClient` | Client only | Substitui corpo de actions por fetch stub |
| 4 | `removeLoaders` | Client only | Remove `export const loader` completamente |
| 5 | `removeMiddlewares` | Client only | Remove `middlewares: [...]` e imports relacionados |

### 7.7 Transformação de Actions (Exemplo)

**Código Original:**
```typescript
export const action_login = async ({
    body,
    c,
}: ActionArgs<LoginBody>): Promise<TokenResponse> => {
    const { generateToken } = await import("./user.repository.js");
    const token = await generateToken(body.email, body.password);
    setCookie(c!, "accessToken", token);
    return { token };
};
```

**Código Transformado (Client):**
```typescript
export const action_login = async ({
    body
}: {
    body: LoginBody;
}) => {
    return fetch("/_action/auth/Login/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then(r => r.json());
};
```

### 7.8 Remoção de Middlewares (Exemplo)

**Código Original:**
```typescript
import { authMiddleware, logMiddleware } from "./middlewares.js";
import { Button } from "./components.js";

export const routes = [
    {
        path: "/admin",
        middlewares: [authMiddleware, logMiddleware],
        children: [...]
    }
];
```

**Código Transformado (Client):**
```typescript
import { Button } from "./components.js";

export const routes = [
    {
        path: "/admin",
        children: [...]
    }
];
```

### 7.9 Ordem de Processamento

```
buildStart()
    │
    └── buildFullPathMap(routesCode)
        └── Popula fullPathMap: moduleId → fullPath

transform(code, id, options)
    │
    ├── Ignora se não é .ts/.tsx
    ├── Ignora se fora do appDir
    │
    ├── Se tem middlewares: [] && !SSR
    │   └── removeMiddlewares(code)
    │
    └── Se tem Component/loader/action
        ├── fullPath = fullPathMap.get(moduleId)
        ├── injectMetadata(code, moduleId, fullPath)
        ├── transformUseLoader(code, moduleId)
        │
        └── Se !SSR (client)
            ├── transformActionsForClient(code, moduleId)
            └── removeLoaders(code)
```

---

## 8. Sistema de Middlewares

### 8.1 Definição de Middleware

```typescript
// app/middlewares.ts
import { createMiddleware } from "velojs/factory";
import { getCookie } from "velojs/cookie";

export const authMiddleware = createMiddleware(async (c, next) => {
    const token = getCookie(c, "accessToken");

    if (!token) {
        // GET = redirect, POST = JSON error
        if (c.req.method === "GET") {
            return c.redirect("/login");
        }
        return c.json({ error: "unauthorized" }, 401);
    }

    await next();
});
```

### 8.2 Uso nas Rotas

```typescript
// app/app-routes.tsx
import { authMiddleware } from "./middlewares.js";

export const routes: AppRoutes = [
    {
        path: "/admin",
        module: AdminLayout,
        middlewares: [authMiddleware],  // Protege /admin e filhos
        children: [
            { path: "", module: AdminHome },
            { path: "/users", module: AdminUsers },
        ]
    }
];
```

### 8.3 Acumulação de Middlewares

```
Rota: /admin/users

Middlewares aplicados (em ordem):
1. rootMiddleware (do root)
2. authMiddleware (do /admin)
3. Handler da página
```

---

## 9. Sistema de Loaders

### 9.1 Definição de Loader

```typescript
// app/users/[id].tsx
import type { LoaderArgs } from "velojs";

interface User {
    id: string;
    name: string;
}

export const loader = async ({ params }: LoaderArgs): Promise<User> => {
    const { getUser } = await import("./user.repository.js");
    return getUser(params.id);
};
```

### 9.2 Duas Formas de Consumir Dados

O VeloJS oferece duas formas de consumir dados do loader:

| Função | Onde usar | SSR | SPA | Quando usar |
|--------|-----------|-----|-----|-------------|
| `Loader()` | Nível do módulo | ✅ | ❌ | Dados globais no Layout |
| `useLoader()` | Dentro do Component | ✅ | ✅ | Dados de página |

### 9.3 `Loader()` - SSR Only (Nível do Módulo)

Use para dados globais/compartilhados que são carregados no Layout e exportados para outros módulos.

```typescript
// app/admin/Layout.tsx
import { Loader } from "velojs/hooks";

interface GlobalData {
    user: { name: string };
    permissions: string[];
}

// Fora do componente - roda uma única vez no import do módulo
export const { data: globalData } = Loader<GlobalData>();

export const Component = ({ children }) => {
    return (
        <div>
            <header>Olá, {globalData.value?.user.name}</header>
            {children}
        </div>
    );
};

// Em outros módulos - importa o dado do Layout
// app/admin/Home.tsx
import { globalData } from "./Layout.js";

export const Component = () => {
    return <div>Permissões: {globalData.value?.permissions.join(", ")}</div>;
};
```

**Limitação**: `Loader()` roda apenas uma vez no import do módulo. Se o usuário navegar via SPA para uma página que usa `Loader()`, o dado será `null`. Use `useLoader()` para páginas que podem ser alvo de navegação SPA.

### 9.4 `useLoader()` - SSR + SPA (Dentro do Component)

Use para dados específicos da página. Suporta hidratação SSR e navegação SPA (faz fetch automaticamente se necessário).

```typescript
// app/users/[id].tsx
import { useLoader } from "velojs/hooks";

interface User {
    id: string;
    name: string;
}

export const Component = () => {
    const { data, loading } = useLoader<User>();

    if (loading.value) return <div>Carregando...</div>;
    if (!data.value) return <div>Usuário não encontrado</div>;

    return <div>{data.value.name}</div>;
};
```

### 9.5 Fluxo de Dados

```
Loader() - SSR Only:
    SSR: loader() → window.__PAGE_DATA__[moduleId] → Loader() hidrata
    SPA: Loader() já rodou no import → retorna null (não faz fetch)

useLoader() - SSR + SPA:
    SSR: loader() → window.__PAGE_DATA__[moduleId] → useLoader() hidrata
    SPA: useLoader() → fetch(url?_data=1) → JSON → atualiza signal
```

---

## 10. Sistema de Actions

### 10.1 Definição de Action

```typescript
// app/auth/Login.tsx
import type { ActionArgs } from "velojs";

interface LoginBody {
    email: string;
    password: string;
}

export const action_login = async ({
    body,
    c,
}: ActionArgs<LoginBody>): Promise<{ token: string }> => {
    const { authenticate } = await import("./auth.service.js");
    const { setCookie } = await import("velojs/cookie");

    const token = await authenticate(body.email, body.password);
    setCookie(c!, "accessToken", token);

    return { token };
};
```

### 10.2 Chamada no Cliente

```typescript
const handleSubmit = async () => {
    const response = await action_login({
        body: { email: "user@example.com", password: "123" }
    });

    if (response.token) {
        window.location.href = "/admin";
    }
};
```

### 10.3 Fluxo de Execução

```
Cliente:
    action_login({ body })
    → fetch POST /_action/auth/Login/login
    → JSON response

Servidor:
    POST /_action/auth/Login/login
    → middlewares executam
    → action_login({ body, params, query, c })
    → return JSON
```

---

## 11. Configuração (`velojs.config.ts`)

```typescript
import { defineConfig } from "velojs/config";

export default defineConfig({
    appDirectory: "./app",  // Diretório da aplicação (default: "./app")
});
```

---

## 12. Exports por Subpath

| Import | Conteúdo |
|--------|----------|
| `velojs` | Types (AppRoutes, ActionArgs, LoaderArgs, etc), Scripts, Link |
| `velojs/server` | startServer, createApp |
| `velojs/client` | startClient |
| `velojs/hooks` | Loader, useLoader, useParams, useQuery, touch |
| `velojs/vite` | veloPlugin |
| `velojs/cookie` | getCookie, setCookie, deleteCookie |
| `velojs/factory` | createMiddleware |
| `velojs/config` | defineConfig |

---

## 13. Componente Scripts (`components.tsx`)

O componente `<Scripts />` injeta automaticamente os scripts e estilos necessários.

### 13.1 Uso Básico

```tsx
import { Scripts } from "velojs";

export const Component = ({ children }) => {
    return (
        <html>
            <head>
                <Scripts />
            </head>
            <body>{children}</body>
        </html>
    );
};
```

### 13.2 Comportamento por Ambiente

**Desenvolvimento (`import.meta.env.DEV = true`):**
```html
<script type="module" src="/@vite/client"></script>
<script type="module" src="/__velo_client.js"></script>
```

**Produção (`import.meta.env.DEV = false`):**
```html
<link rel="stylesheet" href="/static/client.css" />
<script type="module" src="/static/client.js"></script>
```

### 13.3 Customização do Path

```tsx
// Mudar o path base dos assets (default: "/static")
<Scripts basePath="/assets" />

// Resultado em produção:
// <link rel="stylesheet" href="/assets/client.css" />
// <script type="module" src="/assets/client.js"></script>
```

### 13.4 Implementação Interna

```tsx
export function Scripts({ basePath = "/static" }) {
    const isDev = import.meta.env.DEV;

    if (isDev) {
        return (
            <>
                <script type="module" src="/@vite/client"></script>
                <script type="module" src="/__velo_client.js"></script>
            </>
        );
    }

    return (
        <>
            <link rel="stylesheet" href={`${basePath}/client.css`} />
            <script type="module" src={`${basePath}/client.js`}></script>
        </>
    );
}
```

---

## 14. Componente Link (`components.tsx`)

O componente `<Link />` permite navegação usando módulos de rota ao invés de strings hardcoded.

### 14.1 Uso Básico

```tsx
import { Link } from "velojs";
import * as LoginPage from "./auth/Login.js";
import * as UserPage from "./users/[id].js";

// Com módulo de rota
<Link to={LoginPage}>Ir para Login</Link>

// Com string (também suportado)
<Link to="/admin/login">Ir para Login</Link>

// Com parâmetros de URL
<Link to={UserPage} params={{ id: "123" }}>Ver Usuário</Link>
```

### 14.2 Vantagens do Link com Módulo

- **Type-safe**: TypeScript garante que o módulo existe
- **Refatoração fácil**: Renomear arquivo atualiza automaticamente
- **Sem strings mágicas**: Path vem do `metadata.fullPath`

### 14.3 Funcionamento Interno

```typescript
export function Link({ to, params, ...rest }) {
    // Resolve path: módulo usa fullPath, string usa direto
    const isModule = typeof to !== "string";
    const basePath = isModule ? to.metadata?.fullPath : to;

    // Substitui parâmetros (:id → 123)
    const finalPath = params ? substituteParams(basePath, params) : basePath;

    // Módulos usam ~ para path absoluto (escapa contexto de nest)
    const routePath = isModule ? `~${finalPath}` : finalPath;

    return <WouterLink to={routePath} {...rest} />;
}
```

### 14.4 Por que o prefixo `~`?

Com rotas aninhadas (usando `nest` do wouter), paths são relativos ao contexto atual.
O prefixo `~` indica path absoluto, evitando duplicação:

```tsx
// Dentro de /admin (contexto aninhado)
<Link to="/login" />        // → /admin/login (relativo!)
<Link to="~/admin/login" /> // → /admin/login (absoluto)

// Link com módulo já adiciona ~ automaticamente
<Link to={LoginPage} />     // → ~/admin/login (correto)
```

### 14.5 Props Suportadas

O Link herda todas as props do `Link` do wouter-preact:

```tsx
interface LinkProps {
    to: string | RouteModule;     // Destino (string ou módulo)
    params?: Record<string, string>; // Parâmetros de URL
    className?: string;           // Classes CSS
    onClick?: (e: Event) => void; // Handler de click
    // ... outras props do wouter Link
}
```

---

## 15. Convenções Importantes

### 15.1 Nomenclatura de Actions
- **Prefixo obrigatório**: `action_`
- **Exemplos**: `action_login`, `action_createUser`, `action_delete`

### 15.2 Nomenclatura de Loaders
- **Nome exato**: `loader`
- **Um por arquivo**: Cada módulo pode ter apenas um loader

### 15.3 Componente Principal
- **Nome exato**: `Component`
- **Export named**: `export const Component = () => ...`

### 15.4 Dynamic Imports em Server Code
- **Loaders e Actions** devem usar `await import()` para código server-only
- Isso evita que o bundler inclua código de servidor no client

```typescript
// Correto - dynamic import
export const loader = async () => {
    const { db } = await import("./database.js");
    return db.query(...);
};

// Errado - import no topo (vazaria pro client)
import { db } from "./database.js";
export const loader = async () => {
    return db.query(...);
};
```

---

## 16. Arquitetura de Pastas Recomendada

```
app/
├── routes.tsx              # Definição de rotas (export default)
├── server.tsx              # Init do servidor (DB, Redis, etc)
├── client.tsx              # Init do cliente (CSS global, etc)
├── client-root.tsx         # Componente raiz (html, head, body)
├── middlewares.ts          # Middlewares da aplicação
│
├── auth/                   # Feature: autenticação
│   ├── Layout.tsx
│   ├── Login.tsx
│   └── auth.css.ts
│
├── admin/                  # Feature: área admin
│   ├── Layout.tsx
│   ├── Home.tsx
│   └── Users.tsx
│
├── components/             # Componentes compartilhados
│   ├── Button.tsx
│   └── Input.tsx
│
└── modules/                # Lógica de negócio (server-only)
    ├── user/
    │   ├── user.repository.ts
    │   ├── user.services.ts
    │   └── user.models.ts
    └── ...
```

---

## 17. Como Estender o Plugin Vite

### 17.1 Adicionando Nova Transformação

1. Criar função de transformação usando Babel AST:

```typescript
function minhaTransformacao(code: string): string {
    const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
    });

    traverse(ast, {
        // Visitor pattern - processa nós específicos
        ExportNamedDeclaration(nodePath) {
            // Manipula o AST
        },
    });

    const output = generate(ast, { retainLines: true });
    return output.code;
}
```

2. Adicionar chamada no `transform()`:

```typescript
transform(code, id, options) {
    // ... verificações ...

    if (condicao) {
        transformedCode = minhaTransformacao(transformedCode);
        hasTransformations = true;
    }

    // ...
}
```

### 17.2 Tipos do Babel Úteis

```typescript
import * as t from "@babel/types";

// Verificações
t.isIdentifier(node, { name: "foo" })
t.isVariableDeclaration(node)
t.isArrowFunctionExpression(node)
t.isObjectProperty(node)
t.isArrayExpression(node)

// Criação de nós
t.identifier("name")
t.stringLiteral("value")
t.objectProperty(key, value)
t.objectExpression([properties])
t.callExpression(callee, [args])
t.arrowFunctionExpression([params], body)
```

---

## 18. Troubleshooting

### Problema: Código de server vazando pro client
**Sintoma**: Warnings de módulos Node.js externalizados no build
**Causa**: Import de código server-only no topo de arquivos de rota
**Solução**: Usar dynamic import dentro de loaders/actions

### Problema: Hidratação não funciona
**Sintoma**: Links fazem full page reload
**Causa**: Mismatch entre HTML do server e estrutura do client
**Solução**: Garantir que server e client renderizam mesma árvore de componentes

### Problema: Action retorna undefined
**Sintoma**: action_xxx retorna undefined no client
**Causa**: Transformação de action não está funcionando
**Solução**: Verificar se o nome começa com `action_` e se é arrow function async

### Problema: Middleware não executa
**Sintoma**: Rota não está protegida
**Causa**: Middleware não está na árvore de rotas correta
**Solução**: Verificar herança de middlewares (pai → filho)

---

## 19. Roadmap / TODOs

- [ ] Source maps no plugin Vite
- [ ] Hot Module Replacement (HMR) otimizado
- [ ] Error boundaries
- [ ] Streaming SSR
- [ ] Prefetch de rotas
- [ ] Cache de loaders

---

*Última atualização: Janeiro 2026*
