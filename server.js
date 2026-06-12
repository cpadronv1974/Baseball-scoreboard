const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws'),os=require('os');
const PORT=process.env.PORT||3000;
let state={away:{name:'VISITANTE',r:0,h:0,e:0,innings:['-','-','-','-','-','-','-','-','-']},home:{name:'LOCAL',r:0,h:0,e:0,innings:['-','-','-','-','-','-','-','-','-']},inning:1,half:'top',balls:0,strikes:0,outs:0,bases:[false,false,false],title:'BÉISBOL EN VIVO',status:'EN JUEGO'};
function serve(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const u=req.url.split('?')[0];
  if(u==='/state'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(state));return;}
  const routes={'/':'index.html','/overlay':'index.html','/overlay.html':'index.html','/index.html':'index.html','/control':'control.html','/control.html':'control.html','/scorecard':'scorecard_sync.html','/scorecard.html':'scorecard_sync.html'};
  ,'/overlay2':'overlay2.html','/overlay2.html':'overlay2.html','/control2':'control2.html','/control2.html':'control2.html'
  const f=routes[u];
  if(!f){res.writeHead(404);res.end('Not found');return;}
  const p=path.join(__dirname,f);
  if(!fs.existsSync(p)){res.writeHead(404);res.end('Not found: '+f);return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});
  res.end(fs.readFileSync(p));
}
const server=http.createServer(serve);
const wss=new WebSocketServer({server}),clients=new Set();
wss.on('connection',(ws)=>{clients.add(ws);ws.send(JSON.stringify({type:'state',data:state}));ws.on('message',(raw)=>{let msg;try{msg=JSON.parse(raw);}catch{return;}if(msg.type==='update'){state={...state,...msg.data};for(const c of clients)if(c!==ws&&c.readyState===1)c.send(JSON.stringify({type:'state',data:state}));}});ws.on('close',()=>clients.delete(ws));ws.on('error',()=>clients.delete(ws));});
server.listen(PORT,'0.0.0.0',()=>console.log('⚾ Scoreboard corriendo en puerto '+PORT));
