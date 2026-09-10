# Como trabalhar no Cattle Tracker

Consulte o [Project central](https://github.com/users/MateussGont/projects/1) e o [backlog](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/backlog.md). Escolha uma issue pronta e registre seu nome como responsável ao iniciar. Limite inicial da equipe: duas implementações e uma validação de bancada simultâneas.

## Abrir uma tarefa

Use este repositório para sua área de responsabilidade; inclua cenário, comportamento atual/esperado, escopo, evidência, dependências e critérios de aceite verificáveis. Use prioridade P0/P1/P2, área e milestone da fase. Referências entre repositórios devem ser qualificadas. A etiqueta iteration: agora indica o primeiro ciclo selecionado, não que o trabalho já começou.

## Entregar

Crie uma branch e um PR ligado à issue. Descreva o efeito no produto, os testes executados e limitações restantes. Alterações de protocolo exigem compatibilidade entre ambos os repositórios e testes de mensagens antigas/novas. Não misture revisão documental com afirmação de validação física.

Ao concluir, vincule a evidência: teste automatizado, log de bancada, medição, documento ou PR. Não encerre um gate de hardware somente porque o firmware compilou. Datas e estimativas devem ser combinadas com quem executará; os marcos indicam sequência de validação.

Não versionar .env, secrets.h, passwd, credenciais, dados pessoais de operação ou imagens contendo segredos. Publicar firmware de brinco com versão, placa, protocolo e SHA-256, conforme o contrato de integração.
