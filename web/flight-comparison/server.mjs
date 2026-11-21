import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./public/',import.meta.url));
const root=fs.existsSync(path.join(source,'data/dataset.json'))?source:fileURLToPath(new URL('../../docs/research/',import.meta.url));
const prefix='/research/flight-control-benchmark';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.csv':'text/csv','.xml':'application/xml','.md':'text/plain','.mo':'text/plain','.rs':'text/plain','.tex':'text/plain','.txt':'text/plain'};
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let route;try{route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(route==='/'||route===prefix){res.writeHead(302,{Location:prefix+'/'});res.end();return;}
 if(!route.startsWith(prefix+'/')){res.writeHead(404);res.end('Not found');return;}
 const relative=route.slice(prefix.length+1)||'index.html',file=path.resolve(root,relative);
 if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
 fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':st.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
}).listen(Number(process.env.PORT||8770),'127.0.0.1',()=>console.log('Simulation preview: http://127.0.0.1:'+(process.env.PORT||8770)+prefix+'/'));
