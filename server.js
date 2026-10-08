const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const PORT = Number(process.env.PORT || 3000);
const AIMLAPI_KEY = process.env.AIMLAPI_KEY;
const AIMLAPI_MODEL = process.env.AIMLAPI_MODEL || 'openai/gpt-5-5';
const PUBLIC = path.join(__dirname, 'public');

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1_000_000) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function safeFile(p) {
  const full = path.normalize(path.join(PUBLIC, p));
  return full.startsWith(PUBLIC) ? full : null;
}

async function analyze(req, res) {
  if (!AIMLAPI_KEY) return send(res, 500, {error: 'AIMLAPI_KEY não configurada. Crie o arquivo .env a partir do .env.example.'});
  try {
    const input = JSON.parse(await readBody(req));
    const businesses = Array.isArray(input.businesses) ? input.businesses.slice(0, 100) : [];
    if (!businesses.length) return send(res, 400, {error: 'Nenhum negócio foi enviado para análise.'});

    const compact = businesses.map((b, i) => ({
      index: i,
      nome: b.name || '',
      tipo: b.type || '',
      endereco: b.address || '',
      telefone: b.phone || '',
      site: b.site || '',
      pontuacao_regra: b.score ?? null
    }));

    const system = `Você é o analista de prospecção do buscIA. Analise negócios para encontrar oportunidades para profissionais que vendem criação de sites, marketing digital, tráfego pago e redes sociais. Não invente informações. Ausência de site significa apenas que o dado não foi informado na fonte; não afirme como fato que a empresa não possui site. Para cada negócio, dê uma classificação: alta, média ou baixa, e uma justificativa curta baseada somente nos dados recebidos. Retorne SOMENTE JSON válido no formato {"analises":[{"index":0,"classificacao":"alta","motivo":"..."}]}.`;
    const user = `Analise estes negócios e priorize os que parecem melhores oportunidades de prospecção:\n${JSON.stringify(compact)}`;

    const r = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIMLAPI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AIMLAPI_MODEL,
        temperature: 0.2,
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: user}
        ]
      })
    });
    const raw = await r.text();
    if (!r.ok) return send(res, 502, {error: `AIMLAPI respondeu ${r.status}.`, details: raw.slice(0, 500)});

    let data;
    try { data = JSON.parse(raw); } catch { return send(res, 502, {error: 'Resposta inválida da AIMLAPI.'}); }
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
    }
    if (!parsed?.analises || !Array.isArray(parsed.analises)) return send(res, 502, {error: 'A IA não retornou o formato esperado.'});
    send(res, 200, parsed);
  } catch (e) {
    send(res, 500, {error: e.message || 'Erro interno.'});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/ai') return analyze(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, {error: 'Método não permitido.'});

  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/') pathname = '/index.html';
  const file = safeFile(pathname.slice(1));
  if (!file) return send(res, 403, {error: 'Acesso negado.'});
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, {error: 'Arquivo não encontrado.'});
    const ext = path.extname(file);
    const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`buscIA rodando em http://localhost:${PORT}`));
