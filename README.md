# Mensal 100 Compromisso

Site do grupo **Futvôlei 100 Compromisso** (terças 20:00 e sábados 09:00, Futevôlei Zero11): mensalidades, presença por jogo, avulsos, despesas, caixa, uniforme All Black e a página "Minha situação" de cada integrante.

**Site:** https://jansey-oliveira.github.io/mensal-100compromisso/
Links diretos: `#uniforme` e `#situacao`.

## Como funciona
- Site estático (HTML, CSS e JavaScript puro, sem build), publicado pelo GitHub Pages a cada push na `main`.
- Dados no **Firebase do projeto `arena-futvolei`** (o mesmo do sistema de torneios), em `grupos/100compromisso/...`:
  `integrantes`, `pagamentos`, `despesas`, `avulsos`, `jogos`, `uniforme`, `config/geral`.
- **Qualquer pessoa vê** os dados pelo link. **Só quem entra com Google e é administrador** (coleção `admins`) ou organizador do grupo (`grupos/100compromisso/organizadores/{email}`) altera.

## Arquivos
| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura da página |
| `css/style.css` | Visual (tokens de cor, modo claro e escuro) |
| `js/app.js` | Telas, ações, Firebase, login e backup |
| `js/logica.js` | Regras puras: meses, dias de jogo, Pix (BR Code) |
| `js/config.js` | Configuração do Firebase e identificador do grupo |
| `dados/backup-inicial.json` | Dados migrados do artefato em 21/10/2026 |
| `testes/logica.test.mjs` | Testes (`node testes/logica.test.mjs`) |

## Regras de segurança
As regras ficam no `firestore.rules` do repositório **arena-futvolei** (bloco "Mensal de grupos"), porque o projeto Firebase é o mesmo. Depois de mudar, publique em **Console do Firebase › Firestore › Regras › Publicar**.

## Backup
Em **Ajustes › Backup**, o organizador baixa um JSON com tudo e pode restaurar a partir dele.

## Outro organizador
No Console do Firebase, crie o documento `grupos/100compromisso/organizadores/{email em minúsculas}` com `{ nome: "..." }`.
