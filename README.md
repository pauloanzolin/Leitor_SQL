This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 📝 Descrição
Este PR adiciona a propriedade `container_name` ao serviço `web` no arquivo `docker-compose.yml`. A mudança fixa o nome do contêiner como `leitor_sql`, padronizando o ciclo de vida do contêiner e facilitando a execução de comandos de inspeção (como `docker logs` e `docker exec`).

## 🛠️ Tipo de Alteração
- [ ] Bug fix (correção que não quebra funcionalidades existentes)
- [ ] Nova feature (adição de nova funcionalidade)
- [x] Refatoração / Ajuste de Infraestrutura (alteração de configuração sem mudança de código)

## 🔍 O que foi feito?
- Adicionado `container_name: leitor_sql` ao serviço `web`.

## 🧪 Como testar?
1. Baixe esta branch: `git checkout develop` (ou a branch específica do PR).
2. Suba o ambiente: `docker compose up -d`.
3. Verifique se o contêiner subiu com o nome exato rodando: `docker ps`.
4. O contêiner deve aparecer na lista como `leitor_sql` em vez do padrão gerado automaticamente pelo Docker Compose (`diretorio-web-1`).

## ⚠️ Impactos e Riscos
- **Escalonamento:** Esta mudança impede o uso do comando `--scale web=X`, pois o nome do contêiner passará a ser único no host. Sem impactos esperados para a arquitetura atual do projeto.
