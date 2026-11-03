# Indústria One — protótipo de gestão industrial

Protótipo responsivo em HTML, CSS, JavaScript e Python, inspirado na imagem de referência. Inclui páginas navegáveis para todos os módulos, autenticação de demonstração, permissões por perfil e registros compartilhados.

## Abrir direto no Chrome

Dê dois cliques em `index.html` ou arraste o arquivo para uma janela do Chrome para usar o modo local deste navegador. Para que várias máquinas vejam os mesmos registros e indicadores, use o servidor Python abaixo; não é necessário nenhum renderizador.

## Modo opcional com Python

Requer Python 3.10 ou mais recente. Não usa pacotes externos.

1. No computador que ficará como servidor da empresa, abra um terminal nesta pasta.
2. Execute `python server.py`.
3. No próprio computador, acesse `http://127.0.0.1:8000` no Chrome.
4. Para outros computadores na mesma rede, acesse `http://IP-DO-SERVIDOR:8000` no Chrome. Descubra o IP do servidor com `ipconfig` no Windows e permita o Python na rede local se o Firewall perguntar.

O processo do servidor precisa continuar aberto para os demais computadores acessarem os dados. Os registros compartilhados são guardados em `shared-data.json` nesta pasta.

## Usuários de demonstração

- Chefe: `chefe` / `123456`
- Empregado: `empregado` / `123456`
- Convidado: não precisa de usuário ou senha; acesso somente para leitura.

O empregado pode adicionar registros básicos nos módulos. O chefe também pode lançar receitas e despesas no Financeiro. Ambos veem os registros e indicadores; o dashboard atualiza os valores financeiros a partir dos lançamentos, com atualização manual ou automática a cada 30 segundos. O convidado pode visualizar os resultados, mas não alterar dados.

Quem ainda não tem conta pode escolher **Criar novo usuário** na tela de entrada e enviar nome, usuário e senha. A solicitação aparece na seção **Usuários** para o chefe aprovar ou recusar. Contas novas recebem o perfil empregado após aprovação.

No modo de arquivo aberto diretamente (`file://`), o acesso de convidado e as contas de demonstração funcionam no navegador local. Cadastro e aprovação de novos usuários exigem que o sistema seja aberto pelo endereço do servidor Python para que o pedido chegue ao chefe.

## O que funciona nesta versão

- Layout responsivo e páginas por módulo, com registros separados por seção.
- Filtros visuais de período e unidade.
- Exportação dos indicadores de exemplo para CSV.
- Chat conectado à API local, com respostas pré-definidas sobre estoque, faturamento, lucro e produção.
- API de demonstração em `GET /api/dashboard` e `POST /api/assistant`, disponível no modo com servidor Python.
- Login com sessão e controle de escrita financeira por perfil.
- Armazenamento JSON compartilhado por todos os navegadores conectados ao mesmo servidor.

## Limites do protótipo

Os valores iniciais, pedidos e alertas são fictícios. O armazenamento compartilhado em JSON e o login são adequados apenas para demonstração em rede confiável; antes de uso real, substitua as senhas de demonstração e implemente HTTPS, gestão de usuários, banco de dados, cópias de segurança e controles de segurança adicionais. Ainda não há integração com ERP ou sensores, nem um modelo de IA conectado. O chat usa respostas fixas. Os módulos possuem páginas e registros básicos, mas os processos industriais completos ainda precisam ser implementados.
