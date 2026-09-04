# Correções finais de desempenho, automações e primeiro acesso

## O que será corrigido

1. **Mural de tarefas instantâneo**
   - Separar a atualização visual do card das operações secundárias do drop.
   - Persistir movimento, posição e automações de coluna sem manter a interface aguardando.
   - Evitar refetch/realtime antigo sobrescrevendo o estado otimista e reduzir gravações de reordenação.

2. **Automações funcionais sem travar o mural**
   - Restaurar o disparo pontual por quadro/card em segundo plano, sem aguardar na interface.
   - Manter verificações pesadas de prazo, atraso e sobrecarga apenas no agendamento.
   - Corrigir e validar a função de automações e o feedback mensal do primeiro dia, limitado ao mês anterior e com idempotência.

3. **Scroll do chat**
   - Remover atualizações e efeitos que competem com a rolagem.
   - Controlar o viewport real do chat diretamente, preservando a posição quando o usuário consulta mensagens antigas.
   - Validar chat de setor, individual e grupo.

4. **Senha do primeiro acesso**
   - Remover a restrição de seis dígitos.
   - Aceitar letras, números e símbolos, com critérios compatíveis com senha forte e mensagem de erro clara.
   - Garantir que o onboarding finalize após a atualização bem-sucedida.

5. **Mensagens de hoje**
   - Contar somente mensagens recebidas pelo usuário desde o início do dia local, considerando os canais aos quais ele pertence.
   - Não contar mensagens antigas nem mensagens enviadas pelo próprio usuário.
   - Usar o mesmo valor nas telas inicial desktop e mobile.

## Validação

- Verificar erros de build e runtime.
- Testar no preview: mover card entre colunas, rolar histórico sem salto, atualizar senha forte e conferir a métrica diária.
- Testar as funções de automação e feedback e revisar seus logs de execução.
