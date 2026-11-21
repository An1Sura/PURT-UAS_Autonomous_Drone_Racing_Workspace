const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[],sections=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const base=process.env.BENCHMARK_URL||'http://127.0.0.1:8771/research/flight-control-benchmark/';
  await page.goto(base);await page.waitForSelector('.claims-panel');
  const ids=await page.locator('#nav a').evaluateAll(links=>links.map(a=>a.hash.slice(1)));
  for(const id of ids){
   await page.click('#nav a[href="#'+id+'"]');await page.waitForFunction(id=>document.querySelector('#nav a.active')?.hash==='#'+id,id);
   const audit=await page.evaluate(()=>({missing:[...document.querySelectorAll('[data-evidence]')].map(e=>e.dataset.evidence).filter(id=>!window.researchDataset.evidence[id]),charts:document.querySelectorAll('.chart svg').length,documentedCharts:document.querySelectorAll('.chart>.evidence-details').length,claims:document.querySelectorAll('.claim-record').length,overflow:document.body.scrollWidth>innerWidth}));
   assert.deepEqual(audit.missing,[],id);assert.equal(audit.documentedCharts,audit.charts,id);assert.ok(audit.claims>0,id);assert.equal(audit.overflow,false,id);sections.push({id,...audit});
  }
  const allDownload=page.waitForEvent('download');await page.click('[data-export-claims]');const all=await allDownload;const claims=JSON.parse(fs.readFileSync(await all.path(),'utf8'));
  assert.equal(claims.claims.length,11);assert.ok(claims.claims.some(c=>c.kind==='Model assumptions'));
  const archived=claims.claims.flatMap(c=>c.sources).find(s=>s.archive);assert.ok(archived);assert.match(archived.archive.sha256,/^[a-f0-9]{64}$/);
  await page.click('#nav a[href="#comparison"]');await page.waitForSelector('#fresh-probe-0 svg');
  const graphDownload=page.waitForEvent('download');await page.locator('#fresh-probe-0 .chart-tools button').filter({hasText:'Source record'}).click();const graph=JSON.parse(fs.readFileSync(await(await graphDownload).path(),'utf8'));
  assert.ok(graph.claims[0].sources.some(s=>s.id==='cognipilot-attitude-0-calibration.csv'));
  await page.locator('#fresh-probe-0>.evidence-details>summary').click();await page.locator('#fresh-probe-0 [data-evidence="cognipilot-attitude-0-calibration.csv"]').click();await page.waitForFunction(()=>document.querySelector('#source-preview')?.textContent.match(/Archived original|time_s/));
  assert.ok((await page.locator('#e-body').textContent()).includes('SHA-256'));await page.click('#close-evidence');
  await page.locator('#fresh-probe-0').screenshot({path:'qa/evidence-graph.png'});
  await page.locator('.claims-panel>summary').click();
  for(const width of [1512,390]){await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth),false,'expanded evidence width '+width);}
  assert.deepEqual(errors,[]);const result={sections,claims:claims.claims.length,graphManifest:true,releaseExtractionPath:true,expandedEvidenceMobileOverflow:false,errors};fs.writeFileSync('qa/evidence-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
