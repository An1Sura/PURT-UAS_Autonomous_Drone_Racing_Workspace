const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BENCHMARK_URL||'http://127.0.0.1:8770/research/flight-control-benchmark/')+'#comparison');await page.waitForSelector('#matched-scene canvas');
 assert.equal(await page.locator('#matched-timeline').getAttribute('max'),'83');
 for(const mode of ['off','omega']){
  await page.selectOption('#matched-replay-mode',mode);await page.waitForTimeout(150);
  assert.equal(await page.locator('#matched-scene canvas').count(),1);
  assert.ok((await page.locator('#matched-clock').textContent()).includes('/ 40.00 s'));
  await page.click('#matched-play');await page.waitForTimeout(250);await page.click('#matched-play');
  assert.ok(parseFloat(await page.locator('#matched-time').textContent())>25);
  await page.locator('#matched-timeline').fill('45');await page.click('[data-matched-camera="top"]');await page.waitForTimeout(200);
  await page.locator('#matched-replay').screenshot({path:`qa/matched-replay-${mode}.png`});
  await page.locator('#matched-timeline').fill('82.99');await page.click('#matched-play');await page.waitForTimeout(200);
  assert.equal(await page.locator('#matched-time').textContent(),'83.00 s');
  assert.equal(await page.locator('#matched-play').getAttribute('aria-label'),'Play matched replay');
  await page.click('#matched-reset');assert.equal(await page.locator('#matched-time').textContent(),'0.01 s');
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth),false);
 await page.locator('#matched-replay').screenshot({path:'qa/matched-replay-mobile.png'});
 await page.click('#nav a[href="#overview"]');await page.waitForSelector('#scene canvas');await page.waitForTimeout(150);
 assert.equal(await page.locator('#scene canvas').count(),1);
 assert.deepEqual(errors,[]);fs.writeFileSync('qa/matched-replay-results.json',JSON.stringify({modes:['off','omega'],timelineEnd:83,playPause:true,reset:true,topView:true,mobileOverflow:false,navigationTeardown:true,errors},null,2));
 await browser.close();console.log('Matched replay controls and recorded 83 s endpoints verified.');
})().catch(e=>{console.error(e);process.exit(1)});
