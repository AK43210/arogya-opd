// Patient identities are independent of shared family mobile numbers.
let activePatientId = null;
const newPatientId = () => 'p_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
const oldLoadState = loadStateFromStorage;
loadStateFromStorage = function () {
  oldLoadState();
  const original = JSON.stringify(patientDatabase);
  let changed = false;
  const migrated = {};
  for (const [key, value] of Object.entries(patientDatabase)) {
    const id = /^p_[\w-]+$/.test(key) ? key : newPatientId();
    migrated[id] = {...value, id, mobile:value.mobile || (/^\d{10}$/.test(key) ? key : '')};
    if (id !== key) changed = true;
  }
  if (changed) {
    try {
      if (!localStorage.getItem('arogya_before_patient_ids')) localStorage.setItem('arogya_before_patient_ids', original);
      localStorage.setItem('arogya_patients', JSON.stringify(migrated));
    } catch (e) { showToast('Record migration could not be saved. Export a backup before closing.', 'error'); }
  }
  patientDatabase = migrated;

};

const oldResetEncounter = resetEncounterForm;
resetEncounterForm = function () {
  oldResetEncounter();
  activePatientId = null;
  document.getElementById('patient-matches').replaceChildren();
};

function loadPatientRecord(id) {
  const patient = patientDatabase[id];
  if (!patient) return;
  resetEncounterForm();
  activePatientId = id;
  for (const [field, value] of Object.entries({
    'patient-mobile':patient.mobile, 'patient-name':patient.name, 'patient-age':patient.age,
    'patient-sex':patient.sex, 'patient-occupation':patient.occupation, 'patient-address':patient.address,
    'patient-abha':patient.abha, 'clinical-family-history':patient.familyHistory, 'clinical-drug-history':patient.drugHistory
  })) document.getElementById(field).value = value || '';
  document.getElementById('returning-patient-badge').classList.remove('hidden');
  showToast('Patient loaded. Start a new consultation.', 'success');
}

lookupPatientByMobile = function () {
  const input = document.getElementById('patient-mobile');
  const mobile = input.value.replace(/\D/g,'');
  if (mobile.length !== 10) { showToast('Enter a 10-digit mobile number.', 'error'); return; }
  const matches = Object.values(patientDatabase).filter(p => p.mobile === mobile);
  const container = document.getElementById('patient-matches');
  container.replaceChildren();
  if (activePatientId && patientDatabase[activePatientId]?.mobile !== mobile) {
    resetEncounterForm(); input.value = mobile;
  }
  if (!matches.length) { showToast('No saved patients. Enter patient details below.', 'info'); return; }
  const label = document.createElement('p');label.textContent = 'Choose patient or add a family member:';container.append(label);
  for (const p of matches) {
    const button = document.createElement('button');button.type='button';
    button.textContent = `${p.name} · ${p.age || '—'} / ${p.sex || '—'}`;
    button.className='patient-choice';button.onclick=()=>loadPatientRecord(p.id);container.append(button);
  }
  const add = document.createElement('button');add.type='button';add.textContent='New patient with this number';add.className='patient-choice';
  add.onclick=()=>{resetEncounterForm();input.value=mobile;document.getElementById('patient-name').focus();};container.append(add);
};

saveCurrentEncounter = function () {
  const val = id => document.getElementById(id).value.trim();
  const name=val('patient-name'), mobile=val('patient-mobile').replace(/\D/g,'');
  if (!name || !/^\d{10}$/.test(mobile)) {showToast('Enter patient name and a 10-digit mobile number.', 'error');return;}
  if (!prescriptionCart.length && !confirm('Save this consultation without medicines?')) return;
  const before=structuredClone(patientDatabase);
  const id=activePatientId || newPatientId();
  const patient={...patientDatabase[id],id,name,mobile,age:val('patient-age'),sex:val('patient-sex'),occupation:val('patient-occupation'),address:val('patient-address'),abha:val('patient-abha'),familyHistory:val('clinical-family-history'),drugHistory:val('clinical-drug-history')};
  const now=new Date();
  const visit={id:'enc_'+newPatientId(),date:now.toLocaleDateString('en-CA'),time:now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),chiefComplaints:val('clinical-chief-complaints'),asooComplaints:val('clinical-asoo-complaints'),history:val('clinical-history'),previousConsultation:val('clinical-prev-consultation'),diagnosis:val('clinical-summary'),vitals:{bp:val('vitals-bp'),pulse:val('vitals-pulse'),temp:val('vitals-temp'),spo2:val('vitals-spo2'),wt:val('vitals-weight'),rbs:val('vitals-rbs')},medications:structuredClone(prescriptionCart),investigations:val('order-investigations'),advice:val('order-advice'),followup:val('order-followup-date')};
  patient.visits=[visit,...(patient.visits || [])];patientDatabase[id]=patient;
  if (!savePatientsToStorage()) {patientDatabase=before;return;}
  activePatientId=id;renderArchiveList();showToast('Consultation saved.', 'success');
};

renderArchiveList = function () {
  const container=document.getElementById('archive-list-container');container.replaceChildren();
  const query=document.getElementById('archive-filter-input').value.trim().toLowerCase();
  for (const p of Object.values(patientDatabase)) {
    if (query && !`${p.name} ${p.mobile}`.toLowerCase().includes(query)) continue;
    const card=document.createElement('div');card.className='history-card';
    const title=document.createElement('strong');title.textContent=p.name;card.append(title);
    const detail=document.createElement('p');detail.textContent=`${p.age || '—'} / ${p.sex || '—'} · +91 ${p.mobile} · ${(p.visits || []).length} visits`;card.append(detail);
    if(p.visits?.[0]) {const last=document.createElement('p');last.textContent=`${p.visits[0].date}: ${p.visits[0].diagnosis || 'Consultation'}`;card.append(last);}
    const load=document.createElement('button');load.type='button';load.textContent='New consultation';load.className='patient-choice';load.onclick=()=>{loadPatientRecord(p.id);switchTab('consultation');};card.append(load);
    container.append(card);
  }
  if(!container.children.length)container.textContent='No saved consultations.';
};

exportEncountersCSV = function () {
  const rows=[['Patient ID','Date','Mobile','Name','Age','Sex','Diagnosis','Medicines','Investigations','Follow-up']];
  for(const p of Object.values(patientDatabase))for(const v of p.visits || [])rows.push([p.id,v.date,p.mobile,p.name,p.age,p.sex,v.diagnosis,(v.medications || []).map(m=>`${m.brand} ${m.dose} ${m.timing} ${m.duration}`).join('; '),v.investigations,v.followup]);
  const cell=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
  if(window.AndroidNative?.saveTextFile) {AndroidNative.saveTextFile('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'Arogya-consultations.csv','text/csv');return;}
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='Arogya-consultations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

backupClinicData = function () {
  const data={app:'ArogyaEHR',version:'4.0',exportDate:new Date().toISOString(),patients:patientDatabase,customPresets,clinicConfig,medicineCatalog};
  if(window.AndroidNative?.saveTextFile) {AndroidNative.saveTextFile(JSON.stringify(data,null,2),'Arogya-backup.json','application/json');return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='Arogya-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

restoreClinicData = async function (event) {
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try {
    if(file.size>20*1024*1024)throw Error('Backup exceeds 20 MB.');
    const data=JSON.parse(await file.text());
    const object=x=>x && typeof x==='object' && !Array.isArray(x);
    const safeId=x=>typeof x==='string' && /^[\w-]+$/.test(x);
    if(data.app!=='ArogyaEHR' || !object(data.patients) || !['3.0','4.0'].includes(data.version))throw Error('Unsupported backup format.');
    const patients={};
    for(const [key,p] of Object.entries(data.patients)) {
      if(!safeId(key) || !object(p) || typeof p.name!=='string' || !Array.isArray(p.visits))throw Error('Invalid patient record.');
      const mobile=p.mobile || (/^\d{10}$/.test(key)?key:'');if(!/^\d{10}$/.test(mobile))throw Error('Invalid mobile number.');
      const id=/^p_[\w-]+$/.test(key)?key:newPatientId();
      for(const v of p.visits)if(!object(v) || !Array.isArray(v.medications) || v.medications.some(m=>!object(m) || typeof m.brand!=='string'))throw Error('Invalid consultation.');
      patients[id]={...p,id,mobile};
    }
    const presets=data.customPresets || [];
    if(!Array.isArray(presets) || presets.some(p=>!object(p) || !safeId(p.id) || typeof p.title!=='string' || typeof p.category!=='string' || typeof p.diagnosis!=='string' || !Array.isArray(p.medicines) || p.medicines.some(m=>!object(m)||!safeId(m.id)||typeof m.brand!=='string'||typeof m.generic!=='string')))throw Error('Invalid templates.');
    const config=data.clinicConfig || clinicConfig;
    if(!object(config) || ['docName','docReg','docDegree','clinicName','clinicTagline','clinicAddress','clinicContact'].some(k=>typeof config[k]!=='string'))throw Error('Invalid clinic settings.');
    const catalog=data.medicineCatalog || medicineCatalog;
    if(!Array.isArray(catalog)||catalog.some(m=>!object(m)||!safeId(m.id)||['brand','generic','form','cat'].some(k=>typeof m[k]!=='string')))throw Error('Invalid medicine catalogue.');
    if(!confirm('Restore this backup? Matching patient IDs will be replaced, and clinic settings and templates will be updated.'))return;
    const keys=['arogya_patients','arogya_custom_presets_v3','arogya_clinic_config','arogya_catalog_v3'];
    const before=keys.map(k=>localStorage.getItem(k));
    const next=[{...patientDatabase,...patients},presets,config,catalog];
    try {keys.forEach((k,i)=>localStorage.setItem(k,JSON.stringify(next[i])));}
    catch(e) {keys.forEach((k,i)=>before[i]===null?localStorage.removeItem(k):localStorage.setItem(k,before[i]));throw Error('Not enough storage to restore backup.');}
    [patientDatabase,customPresets,clinicConfig,medicineCatalog]=next;
    resetEncounterForm();renderArchiveList();renderPresets();renderMedicineCatalog();applyClinicConfigToUI();
    showToast('Backup restored.', 'success');
  } catch(e) {showToast(e.message || 'Invalid backup. No records restored.', 'error');}
};
