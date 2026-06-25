const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws'),os=require('os');
const PORT=process.env.PORT||3000;
const ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY||'';

let state={
  away:{name:'VISITANTE',r:0,h:0,e:0,innings:['-','-','-','-','-','-','-','-','-']},
  home:{name:'LOCAL',r:0,h:0,e:0,innings:['-','-','-','-','-','-','-','-','-']},
  inning:1,half:'top',balls:0,strikes:0,outs:0,
  bases:[false,false,false],
  title:'BÉISBOL EN VIVO',status:'EN JUEGO',
  awayColor:'#c0392b',homeColor:'#1a3a6b',
  pitcher1Name:'',pitcher1Pitches:0,
  pitcher2Name:'',pitcher2Pitches:0,
  activePitcher:1,
  lineupAway:[],lineupHome:[],
  currentBatterIdx:{away:0,home:0},
  battingTeam:'away',
  statsAway:[],statsHome:[]
};

// ── Endpoint: leer lineup desde foto via Claude Vision ──
async function leerLineup(req,res){
  if(!ANTHROPIC_API_KEY){
    res.writeHead(500,{'Content-Type':'application/json'});
    res.end(JSON.stringify({error:'ANTHROPIC_API_KEY no configurada en el servidor'}));
    return;
  }
  let body='';
  req.on('data',d=>body+=d);
  req.on('end',async()=>{
    try{
      const {imageBase64,mediaType}=JSON.parse(body);
      const payload={
        model:'claude-sonnet-4-6',
        max_tokens:1000,
        messages:[{
          role:'user',
          content:[
            {type:'image',source:{type:'base64',media_type:mediaType||'image/jpeg',data:imageBase64}},
            {type:'text',text:`Analiza esta imagen de un lineup/alineación de béisbol.
Extrae la lista de bateadores en orden. Para cada jugador identifica:
- Orden al bate (1-9 o 1-10)
- Número de camiseta (puede estar vacío)
- Nombre del jugador
- Posición (como número: 1=P,2=C,3=1B,4=2B,5=3B,6=SS,7=LF,8=CF,9=RF, o como texto)

Responde ÚNICAMENTE con un JSON array, sin texto adicional, sin backticks, así:
[{"orden":1,"numero":"11","nombre":"Juan Pérez","posicion":"6"},{"orden":2,"numero":"7","nombre":"Luis García","posicion":"2"}]

Si la posición es texto (SS, CF, etc.) conviértela a número. Si no hay número de camiseta usa "".`}
          ]
        }]
      };
      const apiRes=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
        body:JSON.stringify(payload)
      });
      const data=await apiRes.json();
      const text=data.content?.[0]?.text||'[]';
      // Limpiar posibles backticks
      const clean=text.replace(/```json|```/g,'').trim();
      const lineup=JSON.parse(clean);
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({lineup}));
    }catch(e){
      res.writeHead(500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.message}));
    }
  });
}

function serve(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const u=req.url.split('?')[0];

  if(u==='/state'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify(state));return;
  }

  if(u==='/leer-lineup'&&req.method==='POST'){
    leerLineup(req,res);return;
  }

  const routes={
    '/':'index.html','/overlay':'index.html','/overlay.html':'index.html','/index.html':'index.html',
    '/control':'control.html','/control.html':'control.html',
    '/scorecard':'scorecard_sync.html','/scorecard.html':'scorecard_sync.html',
    '/overlay2':'overlay2.html','/overlay2.html':'overlay2.html',
    '/control2':'control2.html','/control2.html':'control2.html',
    '/overlay3':'overlay3.html','/overlay3.html':'overlay3.html',
    '/control5':'control5.html','/control5.html':'control5.html'
  };
  const f=routes[u];
  if(!f){res.writeHead(404);res.end('Not found');return;}
  const p=path.join(__dirname,f);
  if(!fs.existsSync(p)){res.writeHead(404);res.end('Archivo no encontrado: '+f);return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});
  res.end(fs.readFileSync(p));
}

const server=http.createServer(serve);
const wss=new WebSocketServer({server}),clients=new Set();
wss.on('connection',(ws)=>{
  clients.add(ws);
  ws.send(JSON.stringify({type:'state',data:state}));
  ws.on('message',(raw)=>{
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(msg.type==='update'){
      state={...state,...msg.data};
      for(const c of clients)if(c!==ws&&c.readyState===1)c.send(JSON.stringify({type:'state',data:state}));
    }
  });
  ws.on('close',()=>clients.delete(ws));
  ws.on('error',()=>clients.delete(ws));
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('\n⚾  BASEBALL SCOREBOARD — puerto '+PORT);
  console.log('API Vision activa:',ANTHROPIC_API_KEY?'✅ SÍ':'❌ NO (falta ANTHROPIC_API_KEY)');
  console.log('Overlay   → /overlay');
  console.log('Control2  → /control2');
  console.log('Scorecard → /scorecard\n');
});
