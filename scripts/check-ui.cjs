const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
(async()=>{
  const root=path.resolve('app/src/main/assets');
  const server=http.createServer((req,res)=>{
    const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
    if(!file.startsWith(root)) {res.writeHead(403).end();return;}
    try {const data=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser error:',m.text())});
    const target=process.env.AROGYA_TEST_URL || `http://127.0.0.1:${server.address().port}/`;
    const origin=new URL(target).origin+'/';
    await page.route('**/*', route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
    await page.goto(target);
    await page.waitForTimeout(1000);
    fs.mkdirSync('verification',{recursive:true});
    assert.equal(await page.evaluate(()=>Object.keys(patientDatabase).length),0);
    assert.equal(await page.getByText('Sample: Viral Fever').count(),0);
    for(const tab of ['consultation','pharmacy','preview','history']) {
      await page.evaluate(t=>switchTab(t),tab);await page.waitForTimeout(250);
      const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
      console.log(tab,widths);assert(widths.page<=widths.viewport+1,`${tab} overflows viewport`);
      await page.screenshot({path:`verification/mobile-${tab}.png`,fullPage:true});
    }
    const records=await page.evaluate(async()=>{
      window.confirm=()=>true;
      const set=(id,value)=>document.getElementById(id).value=value;
      set('patient-name','Family One');set('patient-mobile','9000000000');saveCurrentEncounter();
      resetEncounterForm();set('patient-name','Family Two');set('patient-mobile','9000000000');saveCurrentEncounter();
      const count=Object.keys(patientDatabase).length;
      const first=Object.values(patientDatabase).find(p=>p.name==='Family One');
      loadPatientRecord(first.id);
      const loaded=document.getElementById('patient-name').value;
      const before=JSON.stringify(patientDatabase);
      const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='arogya_patients')throw Error('quota');return original.call(this,k,v);};
      saveCurrentEncounter();Storage.prototype.setItem=original;
      const rollback=before===JSON.stringify(patientDatabase);
      const event={target:{files:[new File(['{"app":"ArogyaEHR","version":"4.0","patients":{"bad":{}}}'],'bad.json')],value:'bad'}};
      await restoreClinicData(event);
      const invalidUnchanged=before===JSON.stringify(patientDatabase);
      resetEncounterForm();patientDatabase={};localStorage.removeItem('arogya_patients');
      return {count,loaded,rollback,invalidUnchanged};
    });
    assert.deepEqual(records,{count:2,loaded:'Family One',rollback:true,invalidUnchanged:true});
    console.log('PASS: shared mobile numbers, explicit patient selection, failed-save rollback, invalid backup rejection.');
    await page.evaluate(()=>{
      clinicConfig={docName:'Test Doctor',docDegree:'MBBS',docReg:'TEST-ONLY',clinicName:'Test clinic',clinicTagline:'',clinicAddress:'Test address',clinicContact:''};
      document.getElementById('patient-name').value='Layout Test';
      document.getElementById('patient-age').value='35';
      document.getElementById('patient-mobile').value='9000000000';
      document.getElementById('clinical-summary').value='Test assessment';
      prescriptionCart=[1,2,3].map(i=>({id:'test'+i,brand:'Test medicine '+i,generic:'Test composition',form:'TAB',dose:'Test dose',timing:'1-0-1',when:'After Food (PC)',duration:'Test duration',instructions:'Test instructions'}));
      switchTab('preview');
    });
    await page.waitForTimeout(350);
    await page.screenshot({path:'verification/mobile-prescription.png',fullPage:true});
    const doc=await page.evaluate(()=>prescriptionDocument());
    fs.writeFileSync('verification/prescription-test.html',doc);
    const print=await context.newPage();await print.setContent(doc);
    await print.pdf({path:'verification/prescription-native-layout.pdf',format:'A4',preferCSSPageSize:true});
    await print.screenshot({path:'verification/prescription-output.png',fullPage:true});
    await page.clock.install({time:new Date('2026-11-08T14:00:00Z')});
    for(const [label,width,scroll] of [['mobile-top',390,0],['mobile-bottom',390,100000],['desktop-bottom',1440,100000]]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(y=>window.scrollTo(0,y),scroll);
      const downloadPromise=page.waitForEvent('download',{timeout:45000});
      await page.evaluate(()=>downloadPrescriptionPDF());
      console.log('Export status:',await page.locator('#toast-message').textContent());
      const download=await downloadPromise;await download.saveAs(`verification/pdf-${label}.pdf`);
      assert(fs.readFileSync(`verification/pdf-${label}.pdf`).subarray(0,5).equals(Buffer.from('%PDF-')));
      console.log('PDF exported:',label,'parent scroll',await page.evaluate(()=>scrollY));
    }
    fs.copyFileSync('verification/pdf-mobile-top.pdf','verification/prescription-download.pdf');
    assert.equal(await page.locator('#pediatric-banner').count(),0);
    assert.equal(await page.locator('.beta-notice').count(),1);
    const backupDownload=page.waitForEvent('download');
    await page.evaluate(()=>{saveCurrentEncounter();backupClinicData();});
    await (await backupDownload).saveAs('verification/roundtrip-test.json');
    const backup=JSON.parse(fs.readFileSync('verification/roundtrip-test.json','utf8'));
    assert.equal(Object.keys(backup.patients).length,1);
    assert.equal(Object.values(backup.patients)[0].visits[0].medications.length,3);
    assert(backup.medicineCatalog.length>0);
    await page.evaluate(()=>{resetEncounterForm();patientDatabase={};localStorage.removeItem('arogya_patients');});
    await page.locator('#restore-json-input').setInputFiles('verification/roundtrip-test.json');
    await page.waitForFunction(()=>Object.keys(patientDatabase).length===1);
    await page.reload();
    assert.equal(await page.evaluate(()=>Object.keys(patientDatabase).length),1);
    console.log('PASS: saved records survive reload, backup download and restore preserve three medicines.');
    assert.deepEqual(errors,[]);
    console.log('PASS: four mobile tabs, empty initial records, JavaScript runtime, PDF download.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
