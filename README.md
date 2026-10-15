# Louvor Central V2

Aplicativo: https://adiricom.vercel.app/

Três módulos: Programar culto, Repertório e Integrantes. HTML/CSS/JavaScript com Firebase Firestore; publicação Vercel ligada à branch main.

## Persistência

Não existe expiração por idade do cadastro. Cultos futuros permanecem editáveis, e cultos passados aparecem no histórico conforme data e horário em America/Sao_Paulo. Nenhum processo automático remove documentos. O endpoint legado `/api/cleanup` retorna HTTP 410 sem acessar o banco; `vercel.json` não contém cron. As regras negam exclusão física.

A exclusão manual na interface exige confirmação e marca o documento como `deleted:true`; músicas e equipe do culto permanecem no documento oculto. Remover um item da programação altera apenas a lista daquele culto. A primeira música é sempre o primeiro elemento de `tracks`, sem booleano separado. Tons e notas são específicos por culto.

## Segurança e autorização proposta

A edição continua pública, sem login, conforme configuração solicitada. As regras validam campos, tamanhos, tipos e imutabilidade de `created_at`; negam deletes físicos. Isso NÃO autentica editores nem impede alterações maliciosas por terceiros. Conhecer o link não é proteção. Evite dados privados, inclusive telefones pessoais não autorizados para compartilhamento.

Proposta para uma próxima etapa: manter leitura pública, habilitar Firebase Authentication com Google e cadastrar UIDs autorizados numa coleção `editors`, administrada somente pelo responsável. Exigir `request.auth != null && exists(/databases/$(database)/documents/editors/$(request.auth.uid))` em create/update, preservando as validações existentes. Negar toda escrita pública em `editors`, manter `delete:false` e mostrar controles de edição somente após autenticação e autorização. A proteção efetiva deve ficar nas regras do Firestore, nunca apenas no HTML. Essa proposta não está ativada: nenhum editor foi bloqueado ou escolhido sem definição do responsável.

A configuração web do Firebase é pública por natureza; não há chave administrativa ou chave privada neste repositório. As regras são publicadas separadamente no Firebase; um commit sozinho não as aplica.

## Executar e testar

Sirva a pasta com `python3 -m http.server 4174` e abra http://127.0.0.1:4174/ . Atenção: a configuração aponta ao banco real; alterações locais também são compartilhadas.

Teste automatizado, sem rede e sem dependências: `node --test tests/v2.test.cjs`.

Os listeners são substituídos na reconexão, os cadastros usam transações e conflitos relevantes de edição são recusados antes da sobrescrita. Falhas de conexão, permissão e cota são exibidas. O plano gratuito continua sujeito às cotas do fornecedor; não há promessa de armazenamento ilimitado.
