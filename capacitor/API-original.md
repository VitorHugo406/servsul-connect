# Ewwon · contrato da API

O app só fala com o servidor por `www/js/api.js` (REST) e `www/js/realtime.js` (WebSocket).
Para ligar ao seu banco: `www/js/config.js` → `useMock:false`, `apiBaseUrl`, `wsUrl`.
O formato dos dados é o mesmo que `www/js/mock.js` devolve — use-o como referência viva.

Autenticação: `Authorization: Bearer <accessToken>`. Em `401` o app tenta `POST /auth/refresh` uma vez.
Erros: HTTP 4xx/5xx com `{ "message": "texto para o usuário" }`.
Envios com `queue` (mensagens, reações, leitura…) entram numa fila offline e são reenviados quando a internet volta —
**torne essas rotas idempotentes** (aceite `clientId`/ids repetidos sem duplicar).

## Endpoints

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/login` | `{email,password}` | `{accessToken,refreshToken,user}` |
| POST | `/auth/refresh` | `{refreshToken}` | `{accessToken,refreshToken}` |
| POST | `/auth/logout` | – | 204 |
| **GET** | **`/bootstrap`** | – | tudo que a UI precisa (abaixo) |
| PATCH | `/me` | `{bio,hours:["08:00","17:00"],days:[1,1,1,1,1,0,0],photo,cover}` | `{ok}` |
| PUT | `/me/status` | `{status:"disp|reun|almo|ocup|fora",clearAfter?}` | `{ok}` |
| POST | `/me/media` | `{kind:"avatar|cover",dataUrl}` | `{url}` |
| PUT | `/me/prefs` | objeto `prefs` | `{ok}` |
| GET | `/chats/:id/messages?before=<iso>` | – | `{items:[Message],nextCursor}` |
| POST | `/chats/:id/messages` | `{text}` | `{id,at}` |
| POST | `/chats/:id/messages/:mid/reactions` | `{emoji,add}` | `{ok}` |
| POST | `/chats/:id/read` | – | `{ok}` |
| PATCH | `/chats/:id/prefs` | `{mute:0|1,muteUntil:<ms epoch>|0}` | `{ok}` |
| PATCH | `/groups/:id` | `{name,description,photo,cover,wallpaper:{preset,photo}}` | `{ok}` |
| POST | `/groups/:id/members` | `{userId}` | `{ok}` |
| DELETE | `/groups/:id/members/:userId` | – | `{ok}` |
| PATCH | `/groups/:id/members/:userId` | `{admin:true|false}` | `{ok}` |
| PUT | `/groups/:id/summary` | objeto `sum` (resumo diário) | `{ok}` |
| PUT | `/groups/:id/automations` | `[boas-vindas,resposta-auto,_,mensagem-vira-tarefa]` | `{ok}` |
| POST | `/notices/:id/read` · `/notices/:id/ack` | – | `{ok}` |
| POST | `/birthdays/:userId/wishes` | `{text}` | `{ok}` |
| POST | `/support/tickets` | `{category,area,severity,description,screenshot,device}` | `{id:"#EW-1045"}` |
| GET | `/support/tickets` | – | `[Ticket]` |
| POST | `/devices` | `{token,platform,appVersion}` | `{ok}` |
| DELETE | `/devices/:token` | – | 204 |

Só **administradores** criam avisos (via painel/back-office; o app só lê e confirma).

## `GET /bootstrap`

```jsonc
{
  "me": { "id": "u1", "handle": "@vitor_hugo", "stats": [3, 5, 12] },      // stats: reuniões hoje, tarefas abertas, concluídas no mês — SÓ do próprio usuário
  "people": { "u1": { "id":"u1","n":"Vitor Hugo","i":"VH","hue":260,"role":"Super Admin","dept":"Diretoria",
              "st":"disp","h":["08:00","17:00"],"days":[1,1,1,1,1,0,0],"mail":"…","bio":"…","since":"Jan 2024","photo":null,"cover":null } },
  "chats": [
    { "id":"d_u2","p":"u2","k":"p","pin":1,"u":2,                                 // conversa direta: p = id da pessoa
      "m":[ { "id":"m1","t":"Oi!","at":"2026-11-06T22:28:00Z","me":false,"from":null,"r":["❤️"] } ],
      "set":{ "mute":0,"muteUntil":0,"fs":1,"ff":0,"col":0,"wall":0,"a":[1,0,0,0] } },
    { "id":"g_geral","k":"set","g":1,"n":"Geral","i":"GE","hue":215,"mem":["u1","u2"],"adm":["u1"],
      "desc":"…","photo":null,"cover":null,"u":0,"m":[],
      "sum":{ "on":1,"h":2,"d":0,"grp":1,"it":{"msg":1,"pend":1,"late":1,"done":0,"meet":1,"bday":0,"avisos":1} } }
  ],
  "notices": [ { "id":"n1","title":"…","body":"…","preview":"…","at":"2026-11-06T09:00:00Z","unread":true,"pinned":false,"author":"Administração" } ],
  "dashboard": { "tasksTotal":8,"tasksDone":5,"revenue":"R$ 48,2k","actions":12,"activity":[3,6,4,8,5,9,11],
                 "counters":{"msg":3,"tasks":8,"meet":5,"late":2},
                 "nextMeeting":{"time":"14:00","room":"Sala Executiva","link":"Link do Teams","inLabel":"2h10","at":"2026-11-06T14:00:00-03:00"},
                 "chart":{"7":{"v":[45,62],"l":["S","T"],"p":"86%"},"30":{"v":[52,66],"l":["Sem 1","Sem 2"],"p":"91%"}} },
  "birthdays": { "today":{"personId":"u2","age":29}, "month":{"label":"novembro","count":5},
                 "upcoming":[{"personId":"u3","day":"08","mon":"nov","inDays":3,"age":34}] },
  "tickets": [ { "id":"#EW-1042","t":"título","s":"Em análise","c":"#ffc36b","d":"há 2 dias" } ],
  "prefs": { "n":1,"nm":1,"ndm":1,"ngrp":1,"nv":1,"nr":1,"ns":0,"quiet":1,"prev":1,"snd":1,"vib":1,"theme":0,"red":0 }
}
```
Mensagens aceitam `h` (texto pronto) **ou** `at` (ISO; o app formata). Status: `disp` Disponível · `reun` Em reunião · `almo` Almoçando · `ocup` Não incomodar · `fora` Fora do expediente.

## WebSocket (`wsUrl?token=…`)

Envie `{"type":"ping"}` a cada ~25 s (o app já faz) e responda `{"type":"pong"}`. Mensagens do servidor: `{ "type": "...", "data": {...} }`

| type | data |
|---|---|
| `message:new` | `{chatId, message:{id,t,at,from,me:false,r:[]}}` |
| `message:reaction` | `{chatId, messageId, reactions:["❤️"]}` |
| `notice:new` | `{notice:{…como em bootstrap}}` |
| `presence:update` | `{userId, status}` |
| `chat:read` | `{chatId}` |

## Push (FCM) — app fechado ou em segundo plano

O app registra o aparelho com `POST /devices`. Para notificar, envie pelo FCM HTTP v1:

```jsonc
{ "message": {
    "token": "<token do aparelho>",
    "notification": { "title": "Ana Souza", "body": "Consegue olhar o relatório?" },
    "data": { "type": "message", "chatId": "d_u2" },
    "android": { "priority": "HIGH",
      "notification": { "channel_id": "mensagens", "sound": "ewwon_msg" } } } }
```
Canais criados pelo app: `mensagens` · `avisos` (`sound: ewwon_aviso`) · `reunioes` · `aniversarios` · `silencioso`.
Avisos: `"data":{"type":"notice","id":"n1","urgent":"1"}` com `channel_id:"avisos"`.
Toque na notificação abre a conversa/aba certa usando `data.type` + `data.chatId`.

### Regras que o servidor deve aplicar ANTES de enviar o push
O app também checa essas regras quando está aberto, mas com o app fechado só o servidor pode bloquear:
1. **Conversa silenciada** (`chat_members.muted` e `muted_until` no futuro ou nulo) → não envie push dessa conversa.
2. Preferências do usuário (`user_prefs.data`): `nm` mensagens · `ndm` individuais · `ngrp` grupos e setores · `n` avisos · `nr` reuniões · `ns` aniversários.
3. `status = 'ocup'` (Não incomodar) → só avisos.
4. `quiet = 1` e fora de `work_start/work_end/work_days` → nada, exceto avisos.
5. `prev = 0` → envie `body` genérico ("Nova mensagem") em vez do texto.
6. Remova tokens FCM inválidos (`UNREGISTERED`) da tabela `devices`.
