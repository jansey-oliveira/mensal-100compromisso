# Mensal 100 Compromisso

Site do grupo **Futvôlei 100 Compromisso** (terças 20:00 e sábados 09:00, Futevôlei Zero11): mensalidades, presença por jogo, avulsos, despesas, caixa, uniforme All Black e a página "Minha situação" de cada integrante.

**Site:** https://jansey-oliveira.github.io/mensal-100compromisso/
Links diretos: `#uniforme` e `#situacao`.

## Como funciona
- Site estático (HTML, CSS e JavaScript puro, sem build), publicado pelo GitHub Pages a cada push na `main`.
- Dados no **Firebase do projeto exclusivo `mensal-100compromisso`** (Firestore em São Paulo, plano gratuito), em `grupos/100compromisso/...`:
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
| `firestore.rules` | Regras de segurança do banco |
| `dados/backup-inicial.json` | Dados migrados do artefato em 21/10/2026 |
| `testes/logica.test.mjs` | Testes (`node testes/logica.test.mjs`) |

## Regras de segurança
Ficam em `firestore.rules`. Depois de mudar, publique em **Console do Firebase (mensal-100compromisso) › Firestore › Regras › Publicar**.

## Administradores
No Console, em Firestore, crie a coleção `admins` com um documento por e-mail (em minúsculas), por exemplo `admins/jansey@studiojs.com.br` com `{ nome: "Jansey" }`.

## Funções
- **Mensal:** pagamentos por mês, atrasos, isenções, cobrança pronta para o WhatsApp, Pix com QR.
- **Presença e jogo:** confirmados por jogo, vaga para avulso, jogo cancelado, sorteio de duplas (Dupla 01, 02…), fila da quadra (quem ganha fica) e ranking de vitórias.
- **Caixa:** avulsos, despesas (aluguel da quadra lançado sozinho todo mês), histórico e fechamento do mês.
- **Uniforme All Black:** pedidos, barra de meta, prazo e Pix.
- **Minha situação:** cada integrante vê o que deve, paga pelo Pix e envia o comprovante (só o organizador vê).
- **Instalar no celular:** o site funciona como app na tela inicial.

## Login anônimo
O envio de comprovante usa o login **Anônimo** do Firebase (Authentication › Método de login › Anônimo, ativado).

## Backup
Em **Ajustes › Backup**, o organizador baixa um JSON com tudo e pode restaurar a partir dele.

## Outro organizador
No Console do Firebase, crie o documento `grupos/100compromisso/organizadores/{email em minúsculas}` com `{ nome: "..." }`.
