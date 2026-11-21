const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const navigate=async section=>{await page.click('#nav a[href="#'+section+'"]');await page.waitForFunction(section=>document.querySelector('#nav a.active')?.hash==='#'+section,section);};
  const base=process.env.BENCHMARK_URL||'http://127.0.0.1:8771/research/flight-control-benchmark/';
  await page.goto(base+'#methodology');await page.waitForSelector('.note.success');
  assert.match(await page.locator('.note.success').textContent(),/Fixed 40 s ARM protocol: passed/);
  assert.equal(await page.locator('.panel .pill.green').filter({hasText:'Passed for this protocol'}).count(),4);
  assert.match(await page.locator('main').innerText(),/Fresh maximum-speed sweep/);
  const oldGate=page.locator('details.panel').filter({has:page.locator('summary').filter({hasText:'Broader project gates'})});assert.equal(await oldGate.getAttribute('open'),null);
  await page.screenshot({path:'qa/methodology-current.png'});
  await navigate('parity');assert.match(await page.locator('#current-parity').innerText(),/39 \/ 39/);assert.equal(await page.locator('.historical-parity').getAttribute('open'),null);
  await navigate('firmware');const firmware=await page.locator('main').innerText();for(const bytes of ['229,328','260,340','536,964','359,240'])assert.ok(firmware.includes(bytes),bytes+' absent from '+firmware.slice(0,300));assert.ok(!firmware.includes('Not measured for this artifact'));assert.ok(firmware.includes('runtime high-water'));await page.screenshot({path:'qa/firmware-current.png'});
  await navigate('numbers');await page.waitForSelector('#numbers-mode');assert.equal(await page.locator('#numbers-mode').inputValue(),'off');
  const firstPanel=page.locator('.panel').first();assert.ok((await firstPanel.innerText()).includes('14.10 cm'));assert.ok((await firstPanel.innerText()).includes('20.25 cm'));await page.screenshot({path:'qa/numbers-off.png'});
  await page.selectOption('#numbers-mode','omega');assert.equal(await page.locator('#numbers-mode').inputValue(),'omega');assert.ok((await firstPanel.innerText()).includes('19.66 cm'));assert.ok((await firstPanel.innerText()).includes('14.26 cm'));
  const all=await page.locator('main').innerText();for(const text of ['47.15 m','3.29 m/s','0.597 m','30 / 30','39 / 39','not a 100% real-flight']){if(text==='not a 100% real-flight')assert.ok(all.includes('does not imply a 100% real-flight'));else assert.ok(all.includes(text),text);}
  await page.setViewportSize({width:390,height:844});
  for(const section of ['numbers','methodology','parity','firmware']){await navigate(section);assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth),false,section);}
  await navigate('numbers');await page.screenshot({path:'qa/numbers-mobile.png'});
  assert.deepEqual(errors,[]);const results={fixedProtocolPassed:true,broaderGatesPreserved:true,currentParityDefault:true,verifiedStaticMemory:true,leadOffOnPairedValues:true,referenceGeometry:true,mobileOverflow:false,errors};fs.writeFileSync('qa/guide-results.json',JSON.stringify(results,null,2)+'\n');console.log(results);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
