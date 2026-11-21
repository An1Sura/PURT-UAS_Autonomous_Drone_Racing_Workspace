import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const app=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--output')||!args.includes('--archive'))throw Error('Use --output <docs/research> --archive <simulation-evidence-20261121.tar.gz>');
const output=path.resolve(option('--output')),archive=path.resolve(option('--archive'));
if(path.basename(output)!=='research'||path.basename(path.dirname(output))!=='docs')throw Error('Output must be a docs/research directory');
const source=path.join(app,'public');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archiveHash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(archive))archiveHash.update(chunk);
const archiveInfo={url:'https://github.com/An1Sura/PURT-UAS_Autonomous_Drone_Racing_Workspace/releases/download/matched-simulation-20261121/simulation-evidence-20261121.tar.gz',sha256:archiveHash.digest('hex'),bytes:fs.statSync(archive).size};
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const files=walk(source),storage={};
// The complete immutable data tree is in the Release. Small documents and plotted
// trajectories stay on Pages; original bytes and hashes never change.
for(const file of files){
 const rel=path.relative(source,file).split(path.sep).join('/'),bytes=fs.statSync(file).size;
 if(!rel.startsWith('data/'))continue;
 const archived=/\.(?:gz|tar|bin|elf|exe)$/.test(rel)||(bytes>5_000_000&&rel.endsWith('.csv'));
 storage[rel]={sha256:hash(fs.readFileSync(file)),bytes,location:archived?'release':'pages',...(archived?{archiveEntry:rel}:{})};
}
const dataset=JSON.parse(fs.readFileSync(path.join(source,'data/dataset.json')));
if(!dataset.matchedQualification?.fixedReferenceQualified)throw Error('Fixed-reference qualification is incomplete');
dataset.publication='GitHub Pages · simulation only';dataset.evidenceArchive=archiveInfo;
for(const entries of [dataset.evidence,dataset.matchedQualification.evidence])for(const e of Object.values(entries)){
 const entry=storage[e.path];if(!entry||entry.sha256!==e.sha256)throw Error('Missing or changed evidence: '+e.id);
 if(entry.location==='release')e.archive={...archiveInfo,entry:e.path};
}
fs.mkdirSync(output,{recursive:true});
// Explicit replacement of the retired dashboard; Git retains its history.
for(const name of fs.readdirSync(output))fs.rmSync(path.join(output,name),{recursive:true,force:true});
for(const file of files){const rel=path.relative(source,file).split(path.sep).join('/');if(storage[rel]?.location==='release')continue;const dest=path.join(output,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}
fs.writeFileSync(path.join(output,'data/dataset.json'),JSON.stringify(dataset));
fs.writeFileSync(path.join(output,'data/matched-qualification/summary.json'),JSON.stringify(dataset.matchedQualification));
fs.writeFileSync(path.join(output,'data/evidence-storage.json'),JSON.stringify({archive:archiveInfo,files:storage},null,2)+'\n');
fs.copyFileSync(path.join(source,'data/SHA256SUMS'),path.join(output,'data/ORIGINAL-SHA256SUMS'));
const deployed=walk(output),total=deployed.reduce((n,p)=>n+fs.statSync(p).size,0);
if(total>800_000_000||deployed.some(p=>fs.statSync(p).size>95_000_000))throw Error('Pages or Git file size budget exceeded');
fs.writeFileSync(path.join(output,'data/SHA256SUMS'),deployed.filter(p=>p.includes('/data/')&&!p.endsWith('/SHA256SUMS')).map(p=>`${hash(fs.readFileSync(p))}  ${path.relative(path.join(output,'data'),p)}`).join('\n')+'\n');
console.log(JSON.stringify({output,bytes:total,files:deployed.length,archivedFiles:Object.values(storage).filter(f=>f.location==='release').length,archive:archiveInfo}));
