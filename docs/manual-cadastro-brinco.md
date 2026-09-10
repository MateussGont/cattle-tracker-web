# Manual de cadastro do brinco — Cattle Tracker
Versão inicial baseada no software do commit 4a85dff8. O procedimento foi conferido no código; ainda precisa ser executado por um operador com o hardware. “Colar/collar” permanece em alguns botões e nomes técnicos legados, mas o produto é chamado brinco.

## Antes de começar
Tenha uma conta administradora, propriedade e animal identificados, um gateway configurado e ligado, um brinco XIAO ESP32-S3 + Wio-SX1262 com firmware compatível, antena conectada e cabo USB de dados. Use Chrome/Edge em localhost ou HTTPS para o Web Serial. Feche monitores seriais que estejam usando a placa. O acesso de administrador é necessário para cadastrar dispositivos, propriedades e gateways.

O responsável técnico deve deixar API, banco, MQTT e site funcionando e disponibilizar a imagem completa de firmware no site. Cadastrar o gateway na tela não grava Wi-Fi/MQTT no receptor: essa configuração ainda é feita separadamente em secrets.h e exige gravar o firmware do gateway.

## Entenda as três identificações
| Campo | O que identifica | Exemplo |
|---|---|---|
| Identificação/brinco do animal | Registro do animal no rebanho (tagCode) | ANIMAL-001 |
| Identificação do dispositivo | Unidade eletrônica física (deviceIdentifier) | BRINCO-0001 |
| ID de rádio | Número gravado no dispositivo e usado na transmissão (radioDeviceId) | 101 |

Esses valores têm funções distintas. O ID de rádio deve ser único em toda a instalação. Use 1 a 65535 como convenção de operação; a implementação atual também aceita 0. A sugestão automática pode estar errada em cadastros com mais de 50 dispositivos; confirme com o inventário completo. Não crie dois dispositivos físicos com o mesmo ID.

## Passo a passo
1. Entre no aplicativo com a conta administradora. Se o ambiente foi criado pelo seed de demonstração, solicite ao responsável técnico o acesso; não use credenciais de exemplo em uma implantação compartilhada.
2. Em **Propriedades**, use **Nova propriedade**, informe o nome e clique **Cadastrar**, caso ela ainda não exista.
3. Em **Gateways**, clique **Novo gateway**. Informe nome, identificador exato configurado no receptor (por exemplo, GATEWAY-0001) e propriedade. Clique **Cadastrar**. Prefira selecionar a propriedade para manter o inventário organizado.
4. Em **Animais**, clique **Novo animal**. Informe a identificação do animal, os dados disponíveis e a propriedade; clique **Cadastrar**. Verifique se o animal já existe antes.
5. Em **Dispositivos**, abra **Novo dispositivo**.
6. No passo 1 do assistente, informe a identificação da unidade eletrônica, um ID de rádio livre e o modelo, se conhecido. Clique **Avançar**.
7. No passo 2, escolha o gateway da propriedade e avance. Embora a tela permita “Nenhum / decidir depois”, faça a associação agora: a interface atual ainda não tem um fluxo completo para editar esse vínculo posteriormente.
8. No passo 3, escolha o animal e clique **Cadastrar e continuar**. O registro já é salvo neste momento; os próximos passos configuram a unidade física.
9. No passo 4, conecte somente o brinco que será configurado. Clique **Conectar dispositivo USB** e escolha sua porta. Não escolha o gateway.
10. Use **Verificar status atual**. Se houver identidade anterior, confira a unidade e o inventário antes de gravar outra. Eventos “boot” ou “awaiting_provisioning” não comprovam que a consulta/configuração foi concluída.
11. Para placa nova ou firmware incompatível, use **① Gravar firmware (1x por unidade nova)**. Aguarde a conclusão e o reinício; selecione novamente a porta se ela mudar. Para unidade já com firmware compatível, não é necessário regravar a aplicação.
12. Clique **② Configurar (enviar ID de rádio)**. Aguarde a confirmação **Configurado com sucesso** e confira se radioDeviceId corresponde ao registro. A confirmação esperada contém event=provisioned e o ID correto.
13. Consulte o status novamente e reinicie a placa; repita a consulta para confirmar que a identidade permaneceu salva. O firmware atual pode demorar mais que o prazo de 8 segundos do site; veja diagnóstico abaixo.
14. Etiquete a unidade com identificação física e ID de rádio. Registre também versão do firmware, gateway, animal e data no inventário.
15. Clique **Concluir**. Com GNSS em condição de obter fixação e gateway operante, acompanhe **Dispositivos**, **Mapa** e **Histórico**.

## Como comprovar que o cadastro terminou
- O dispositivo existe uma única vez na lista e está associado ao animal correto.
- O ID consultado após reinício é o mesmo do cadastro.
- O receptor mostra o mesmo device_id e sequência avançando.
- Há novas mensagens no backend e a última comunicação avança.
- Com fixação válida, mapa e histórico mostram o animal correto.
- Sem fixação, não aparecer no mapa não significa necessariamente ausência de transmissão. O backend só grava posições quando a flag de fixação está presente.
- Bateria “—” é esperada no hardware atual: não há medição real implementada.

No firmware atual a cadência real é superior a 12,5 segundos, e o GPS pode precisar de mais tempo para obter a primeira posição. Aguarde vários ciclos e consulte o diagnóstico; não considere uma estimativa de tempo garantia de fixação.

## Trocar o brinco de animal
Preserve o ID de rádio da unidade física. Faça a troca da associação pelo aplicativo: desvincule o animal anterior e vincule o novo em Dispositivos ou no detalhe do animal. Não é necessário SET_RADIO_ID para uma simples troca de animal.

Confirme propriedade/gateway antes da troca. Até a correção do cache por associação, o mapa pode mostrar a posição do animal anterior; espere nova telemetria e confira o horário. Evite duas pessoas alterando o vínculo simultaneamente até a correção de unicidade por animal.

## Retomar um cadastro interrompido
Se o registro foi criado, não cadastre novamente a mesma unidade. Procure o registro e anote seu ID. O assistente atual não permite reabrir integralmente a etapa USB de um dispositivo existente; a recuperação precisa do responsável técnico ou da melhoria registrada no backlog. Se a associação com o animal falhou após criar o dispositivo, vincule pela lista. “Fechar” não desfaz um registro já salvo.

## Diagnóstico
| Sintoma | Verificação/ação |
|---|---|
| Porta não aparece | Cabo de dados, porta USB, placa correta e identificação no sistema. Consulte os drivers oficiais do fabricante se necessário. |
| Porta ocupada | Feche monitor serial, outra aba de configuração ou ferramenta de gravação. Execute uma operação USB por vez. |
| Falha ao baixar firmware / HTTP 404 | Responsável técnico deve gerar e importar a imagem completa para o site, conforme o guia de integração dos repositórios. |
| “O dispositivo não respondeu a tempo” | Existe defeito conhecido no parser e no prazo serial. Confirme o comando por monitor serial com o técnico; não recrie o cadastro nem fique regravando a placa automaticamente. |
| event=awaiting_provisioning | A unidade ainda não confirmou o ID; clique Configurar e confira event=provisioned/ID. |
| Cadastro duplicado / erro interno ao salvar | Consulte o inventário e o técnico: conflitos de identificador podem aparecer como erro interno na versão atual. |
| Há rádio, mas não há posição | Conferir antena/visada GNSS, baud e pinagem; RX/TX do firmware divergem da ligação no README e precisam ser alinhados antes do teste. |
| mqtt_publish_skipped no receptor | Gateway sem publicação MQTT; conferir Wi-Fi, broker, credenciais e tamanho do pacote. As mensagens descartadas não são recuperadas na versão atual. |
| Mapa não atualiza após queda | Recarregue a página; a reconexão automática do WebSocket está pendente. |
| Dispositivo sumiu da seleção | Verificar filtro e limite atual de 50 resultados; paginação completa está no backlog. |

## Registro de bancada
Copie uma linha por unidade: identificação física | ID rádio | modelo/revisão | firmware/commit | propriedade | gateway | animal | ID confirmado após reinício | primeira mensagem | primeira posição | responsável | observações.

Este manual descreve o produto atual, incluindo suas limitações. A validação com um operador e uma unidade real é parte do gate de bancada.
