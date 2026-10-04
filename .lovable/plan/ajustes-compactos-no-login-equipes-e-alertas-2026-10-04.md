# Ajustes compactos no login, equipes e alertas

## Alterações
- Compactar somente o login no celular após a seleção da empresa: reduzir logo, títulos, campos, botões, margens e espaços para caber na altura útil sem rolagem em telas comuns.
- Adicionar a ação **Excluir equipe** ao lado de renomear, com confirmação antes da exclusão; os membros serão desvinculados automaticamente.
- Substituir o checkbox simples de alertas por um controle visual **Ativo/Inativo**, mantendo o padrão desativado.
- Quando ativo, permitir cadastrar um ou vários horários diários para receber alertas, com ações simples para adicionar e remover horários.
- Salvar a preferência e os horários no perfil do gestor e fazer a geração dos alertas respeitar essa configuração.

## Detalhes técnicos
- Reaproveitar os componentes e estilos existentes, sem criar uma nova tela.
- Adicionar apenas um campo de lista de horários ao perfil; manter o campo atual de ativação.
- Ajustar a rotina existente de alertas para executar somente quando o horário atual corresponder a um dos horários escolhidos pelo gestor.
- Não alterar mensagens automáticas, feedback mensal ou outras áreas.

## Verificação
- Conferir o login em 394 × 852 sem rolagem.
- Testar criação, alternância, renomeação e exclusão de equipe.
- Testar ativação, múltiplos horários, persistência após sair e voltar, e estado inativo sem novos alertas.
