buscIA — versão com IA real preparada

O projeto usa:
- OpenStreetMap + Overpass para encontrar negócios e mostrar o mapa.
- AIMLAPI para analisar os negócios encontrados.
- A chave da AIMLAPI fica no servidor, em .env, e não no HTML.

COMO USAR NO COMPUTADOR/CHROMEBOOK COM NODE:
1. Instale/tenha Node.js 18 ou superior.
2. Renomeie .env.example para .env.
3. Abra .env e coloque sua NOVA chave AIMLAPI em AIMLAPI_KEY.
4. No terminal, dentro desta pasta, rode: node server.js
5. Abra: http://localhost:3000

IMPORTANTE:
- A chave que foi enviada no chat deve ser considerada exposta. Gere uma nova chave antes de usar o projeto.
- Não envie a nova chave para ninguém e não coloque a chave dentro do index.html.
- A IA só analisa os dados que o mapa público devolver. Ausência de site significa apenas que o site não foi informado na fonte.
- O projeto ainda usa OpenStreetMap/Overpass para os negócios; ele não consulta diretamente o Google Places.
