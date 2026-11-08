const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
 try {
  const page=browser.contexts()[0].pages().find(p=>p.url().includes('index.html'));
  if(!page)throw Error('App WebView not found');
  page.on('pageerror',e=>console.error('WEBVIEW ERROR',e.message));
  console.log(await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth,records:Object.keys(patientDatabase).length,pdf:typeof html2pdf,native:typeof AndroidNative.savePrescriptionPdf})));
  await page.evaluate(()=>{
   clinicConfig={docName:'Test Doctor',docDegree:'MBBS',docReg:'TEST-ONLY',clinicName:'Test clinic',clinicTagline:'',clinicAddress:'Test address',clinicContact:''};
   document.getElementById('patient-name').value='Android PDF Test';
   document.getElementById('patient-age').value='35';
   document.getElementById('patient-mobile').value='9000000000';
   document.getElementById('clinical-summary').value='Fictional test assessment';
   prescriptionCart=[{id:'test',brand:'Test medicine',generic:'Test composition',form:'TAB',dose:'Test dose',timing:'1-0-1',when:'After Food (PC)',duration:'Test duration',instructions:'Test instructions'}];
   switchTab('preview');
  });
  await page.waitForTimeout(350);
  await page.screenshot({path:'verification/android-prescription.png',fullPage:true});
  if(process.argv.includes('--print'))await page.evaluate(()=>printPrescription());
  else await page.evaluate(()=>downloadPrescriptionPDF());
  await page.waitForTimeout(1500);
  console.log('Export request completed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
