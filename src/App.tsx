import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Building2, Check, ChevronDown, ChevronRight,
  Clock3, ContactRound, Download, FileBarChart, Fingerprint, LayoutDashboard, LifeBuoy, MoreHorizontal,
  Palette, Plus, ScanLine, Search, Settings2, ShieldCheck, SlidersHorizontal, Sun, Moon, PanelLeftClose,
  Users, X, Upload, Trash2, UserPlus, Camera, Square, RefreshCw, FileUp, LogIn, LogOut, AlertCircle
} from 'lucide-react'

type Page = 'Overview' | 'People register' | 'Visitors' | 'Gate activity' | 'Reports' | 'Workspace settings'
type Person = { id:string; name:string; fields:Record<string,string>; active:boolean; createdAt:string }
type Visitor = { id:string; name:string; phone:string; address:string; host:string; purpose:string; status:'IN'|'OUT'; inAt:string; outAt?:string }
type EventRecord = { id:string; personId:string; name:string; direction:'IN'|'OUT'; gate:string; time:string; kind:'Person'|'Visitor'; detail:string }
type Settings = { orgName:string; tagline:string; theme:'Light'|'Dark'; accent:string; density:string; logo:string|null; licenseKey:string; gateName:string }
const KEY='entrycore.local.v1'
const nowIso=()=>new Date().toISOString()
const timeLabel=(v:string)=>new Date(v).toLocaleString()
const csvCell=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`
function downloadCsv(filename:string, rows:string[][]) {
  const csv=rows.map(r=>r.map(csvCell).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)
}
function parseCsv(text:string):string[][] {
  const rows:string[][]=[]; let row:string[]=[];let cell='';let quoted=false
  for(let i=0;i<text.length;i++){const c=text[i]
    if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}
    else if(c==='"') quoted=!quoted
    else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}
    else cell+=c
  }
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row)
  return rows
}
function loadSaved(){
  try { const raw=localStorage.getItem(KEY); if(raw)return JSON.parse(raw) } catch {}
  return null
}
const defaults:Settings={orgName:'EntryCore Workspace',tagline:'A safer, more connected workplace',theme:'Light',accent:'#287b72',density:'Comfortable',logo:null,licenseKey:'',gateName:'Main gate'}
const starterPeople:Person[]=[]
const starterVisitors:Visitor[]=[]
const starterEvents:EventRecord[]=[]

function App(){
  const saved=useRef<any>(loadSaved()).current
  const [page,setPage]=useState<Page>('Overview')
  const [settings,setSettings]=useState<Settings>({...defaults,...(saved?.settings||{})})
  const [people,setPeople]=useState<Person[]>(saved?.people||starterPeople)
  const [visitors,setVisitors]=useState<Visitor[]>(saved?.visitors||starterVisitors)
  const [events,setEvents]=useState<EventRecord[]>(saved?.events||starterEvents)
  const [search,setSearch]=useState('')
  const [toast,setToast]=useState('')
  const [modal,setModal]=useState<'person'|'visitor'|'scan'|null>(null)
  const [direction,setDirection]=useState<'IN'|'OUT'>('IN')
  const [scanValue,setScanValue]=useState('')
  const [scanStatus,setScanStatus]=useState('Scanner is stopped.')
  const [scanning,setScanning]=useState(false)
  const [personForm,setPersonForm]=useState({id:'',name:'',fields:'Department=\\nRole=\\nYear='})
  const [visitorForm,setVisitorForm]=useState({name:'',phone:'',address:'',host:'',purpose:''})
  const [customField,setCustomField]=useState('')
  const [showNotifications,setShowNotifications]=useState(false)
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false)
  const [licenseInput,setLicenseInput]=useState(settings.licenseKey)
  const fileRef=useRef<HTMLInputElement>(null)
  const logoRef=useRef<HTMLInputElement>(null)
  const cameraRef=useRef<HTMLDivElement>(null)
  const dynamsoftRef=useRef<any>(null)
  const scanLock=useRef(false)
  const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(''),3000)}
  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({settings,people,visitors,events}))},[settings,people,visitors,events])
  useEffect(()=>()=>{stopScanner()},[])
  const insidePeople=useMemo(()=>{const latest=new Map<string,EventRecord>();events.filter(e=>e.kind==='Person').forEach(e=>{if(!latest.has(e.personId))latest.set(e.personId,e)});return [...latest.values()].filter(e=>e.direction==='IN').length},[events])
  const insideVisitors=visitors.filter(v=>v.status==='IN').length
  const todayEvents=events.filter(e=>new Date(e.time).toDateString()===new Date().toDateString())
  const visiblePeople=people.filter(p=>`${p.name} ${p.id} ${Object.values(p.fields).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  const visibleVisitors=visitors.filter(v=>`${v.name} ${v.phone} ${v.host} ${v.purpose}`.toLowerCase().includes(search.toLowerCase()))
  const visibleEvents=events.filter(e=>`${e.name} ${e.personId} ${e.gate} ${e.direction} ${e.kind}`.toLowerCase().includes(search.toLowerCase()))
  const navItems:{label:Page;icon:any;group:string}[]=[
    {label:'Overview',icon:LayoutDashboard,group:'WORKSPACE'},{label:'People register',icon:Users,group:'WORKSPACE'},
    {label:'Visitors',icon:ContactRound,group:'WORKSPACE'},{label:'Gate activity',icon:ScanLine,group:'OPERATIONS'},
    {label:'Reports',icon:FileBarChart,group:'OPERATIONS'},{label:'Workspace settings',icon:Settings2,group:'ADMINISTRATION'}]
  function recordEvent(personId:string,name:string,dir:'IN'|'OUT',kind:'Person'|'Visitor',detail=''){
    const e:EventRecord={id:crypto.randomUUID(),personId,name,direction:dir,gate:settings.gateName,time:nowIso(),kind,detail}
    setEvents(prev=>[e,...prev]);return e
  }
  function processScan(raw:string){
    const code=raw.trim();if(!code)return
    const person=people.find(p=>p.id.toLowerCase()===code.toLowerCase())
    const visitor=visitors.find(v=>v.id.toLowerCase()===code.toLowerCase())
    if(person){
      recordEvent(person.id,person.name,direction,'Person')
      notify(`${person.name} recorded ${direction} at ${settings.gateName}.`)
      setScanStatus(`Matched ${person.name} · ${person.id} · ${direction}`)
    } else if(visitor){
      const next=direction==='IN'?'IN':'OUT'
      setVisitors(prev=>prev.map(v=>v.id===visitor.id?{...v,status:next,...(next==='OUT'?{outAt:nowIso()}:{})}:v))
      recordEvent(visitor.id,visitor.name,direction,'Visitor',visitor.purpose)
      notify(`Visitor ${visitor.name} recorded ${direction}.`)
      setScanStatus(`Matched visitor ${visitor.name} · ${direction}`)
    } else {
      setScanStatus(`No record found for “${code}”. Import or add the person first.`)
      notify('ID not found. No gate event was saved.')
    }
    setScanValue('')
  }
  async function startScanner(){
    if(!cameraRef.current)return
    setScanning(true);setScanStatus('Loading Dynamsoft and requesting camera permission…')
    try{
      const w=window as any
      if(!w.Dynamsoft){
        await new Promise<void>((resolve,reject)=>{
          const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/dynamsoft-barcode-reader-bundle@11.6.3200/dist/dbr.bundle.js'
          script.onload=()=>resolve();script.onerror=()=>reject(new Error('Could not load Dynamsoft SDK. Check internet connection.'));document.head.appendChild(script)
        })
      }
      const D=(window as any).Dynamsoft
      if(settings.licenseKey.trim())D.License.LicenseManager.initLicense(settings.licenseKey.trim())
      else D.License.LicenseManager.initLicense('DLS2eyJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSJ9')
      D.Core.CoreModule.engineResourcePaths.rootDirectory='https://cdn.jsdelivr.net/npm/'
      await D.Core.CoreModule.loadWasm()
      const view=await D.DCE.CameraView.createInstance()
      const enhancer=await D.DCE.CameraEnhancer.createInstance(view)
      const router=await D.CVR.CaptureVisionRouter.createInstance()
      router.setInput(enhancer)
      cameraRef.current.innerHTML=''
      cameraRef.current.append(view.getUIElement())
      router.addResultReceiver({onDecodedBarcodesReceived:(result:any)=>{
        const items=result.barcodeResultItems||[]
        if(items.length&&!scanLock.current){scanLock.current=true;processScan(items[0].text);window.setTimeout(()=>scanLock.current=false,1800)}
      }})
      const filter=new D.Utility.MultiFrameResultCrossFilter()
      filter.enableResultCrossVerification('barcode',true);filter.enableResultDeduplication('barcode',true)
      await router.addResultFilter(filter)
      await enhancer.open();await router.startCapturing('ReadSingleBarcode')
      dynamsoftRef.current={view,enhancer,router}
      setScanStatus('Scanner is live. Present an ID QR code.')
    }catch(e:any){setScanning(false);setScanStatus(e?.message||'Could not start scanner.');notify('Scanner failed to start. See the message in the scanner panel.')}
  }
  async function stopScanner(){
    const s=dynamsoftRef.current;dynamsoftRef.current=null
    try{if(s?.router){await s.router.stopCapturing();s.router.dispose()}if(s?.enhancer){await s.enhancer.close();s.enhancer.dispose()}if(s?.view)s.view.dispose()}catch{}
    setScanning(false)
  }
  function savePerson(){
    const id=personForm.id.trim(),name=personForm.name.trim()
    if(!id||!name){notify('Identifier and full name are required.');return}
    if(people.some(p=>p.id.toLowerCase()===id.toLowerCase())){notify('That identifier already exists.');return}
    const fields:Record<string,string>={}
    personForm.fields.split('\n').forEach(line=>{const ix=line.indexOf('=');if(ix>0)fields[line.slice(0,ix).trim()]=line.slice(ix+1).trim()})
    setPeople(prev=>[{id,name,fields,active:true,createdAt:nowIso()},...prev]);setPersonForm({id:'',name:'',fields:'Department=\\nRole=\\nYear='});setModal(null);notify('Person added.')
  }
  function saveVisitor(){
    if(!visitorForm.name.trim()||!visitorForm.phone.trim()){notify('Visitor name and phone are required.');return}
    const id='VIS-'+Date.now().toString().slice(-8),v:Visitor={id,...visitorForm,name:visitorForm.name.trim(),phone:visitorForm.phone.trim(),status:'IN',inAt:nowIso()}
    setVisitors(prev=>[v,...prev]);recordEvent(id,v.name,'IN','Visitor',v.purpose);setVisitorForm({name:'',phone:'',address:'',host:'',purpose:''});setModal(null);notify('Visitor registered and checked in.')
  }
  function importPeople(file?:File){
    if(!file)return
    const reader=new FileReader()
    reader.onload=()=>{try{
      const rows=parseCsv(String(reader.result||''));if(rows.length<2)throw new Error('CSV must contain a header and at least one row.')
      const headers=rows[0].map(x=>x.trim());const idIdx=headers.findIndex(h=>/^(id|identifier|admission.?number|student.?id|employee.?id|qr|code)$/i.test(h));const nameIdx=headers.findIndex(h=>/^(name|full.?name|person.?name)$/i.test(h))
      if(idIdx<0||nameIdx<0)throw new Error('CSV needs an ID/Identifier column and a Name/Full Name column.')
      const existing=new Set(people.map(p=>p.id.toLowerCase()));let added=0
      const incoming:Person[]=[]
      rows.slice(1).forEach(row=>{const id=(row[idIdx]||'').trim(),name=(row[nameIdx]||'').trim();if(!id||!name||existing.has(id.toLowerCase()))return
        const fields:Record<string,string>={};headers.forEach((h,i)=>{if(i!==idIdx&&i!==nameIdx&&h)fields[h]=(row[i]||'').trim()})
        existing.add(id.toLowerCase());incoming.push({id,name,fields,active:true,createdAt:nowIso()});added++})
      setPeople(prev=>[...incoming,...prev]);notify(`Imported ${added} new people. Duplicate or incomplete rows were skipped.`)
    }catch(e:any){notify(e.message||'Could not import CSV.')} }
    reader.readAsText(file)
  }
  function exportPeople(){downloadCsv('entrycore-people.csv',[['ID','Name',...Array.from(new Set(people.flatMap(p=>Object.keys(p.fields))))],...people.map(p=>[p.id,p.name,...Array.from(new Set(people.flatMap(x=>Object.keys(x.fields)))).map(k=>p.fields[k]||'')])])}
  function exportEvents(){downloadCsv('entrycore-gate-activity.csv',[['Time','ID','Name','Type','Direction','Gate','Details'],...events.map(e=>[e.time,e.personId,e.name,e.kind,e.direction,e.gate,e.detail])])}
  function updateSettings(k:keyof Settings,v:any){setSettings(prev=>({...prev,[k]:v}));}
  const visibleNav=navItems
  return <div className={`app-shell ${settings.theme==='Dark'?'dark':''} ${settings.density==='Compact'?'compact':''}`} style={{'--accent':settings.accent} as React.CSSProperties}>
    <aside className={`sidebar ${sidebarCollapsed?'collapsed':''}`}>
      <div className="brand-row"><div className="brand-mark">{settings.logo?<img src={settings.logo} alt="Organisation logo"/>:<ShieldCheck size={22}/>}</div>{!sidebarCollapsed&&<div className="brand-copy"><strong>{settings.orgName||'Your organisation'}</strong><span>EntryCore workspace</span></div>}<button className="icon-button collapse-btn" onClick={()=>setSidebarCollapsed(v=>!v)} aria-label="Collapse sidebar"><PanelLeftClose size={17}/></button></div>
      <button className="workspace-switcher" onClick={()=>setPage('Workspace settings')}><div className="workspace-icon"><Building2 size={16}/></div>{!sidebarCollapsed&&<><span><b>Primary workspace</b><small>Local device storage</small></span><ChevronDown size={15}/></>}</button>
      {!sidebarCollapsed&&<div className="nav-label">WORKSPACE</div>}
      <nav className="nav-list">{visibleNav.map(item=>{const Icon=item.icon;return <button key={item.label} className={`nav-item ${page===item.label?'active':''}`} onClick={()=>setPage(item.label)} title={sidebarCollapsed?item.label:undefined}><Icon size={18}/>{!sidebarCollapsed&&<span>{item.label}</span>}{page===item.label&&!sidebarCollapsed&&<span className="nav-active-dot"/>}</button>})}</nav>
      {!sidebarCollapsed&&<div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><LifeBuoy size={17}/></div><div><b>Local workspace</b><span>Data stays in this browser</span></div></div><div className="sidebar-user"><div className="avatar admin-avatar">AD</div><div className="user-copy"><b>Local administrator</b><span>Not authenticated</span></div></div></div>}
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{page}</b></div><div className="top-actions"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records, IDs…" aria-label="Search records"/>{search&&<button className="clear-search" onClick={()=>setSearch('')}><X size={13}/></button>}</label><div className="top-divider"/><button className="icon-button notification-button" onClick={()=>setShowNotifications(v=>!v)} aria-label="Notifications"><Bell size={18}/></button><div className="avatar admin-avatar">AD</div></div></header>
      {showNotifications&&<div className="notification-popover"><div className="popover-heading">Workspace status</div><p>Local-only mode is active. Data is saved in this browser; it is not yet shared with other gate computers.</p><button onClick={()=>setShowNotifications(false)}>Close</button></div>}
      {page==='Overview'&&<div className="page-content">
        <div className="page-heading-row"><div><div className="eyebrow"><span className="live-dot"/> LOCAL WORKSPACE <span className="eyebrow-separator">/</span> TODAY</div><h1>Workspace overview<span className="heading-period">.</span></h1><p className="page-subtitle">{settings.tagline||'Gate entries, exits, people and visitors at a glance.'}</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportEvents}><Download size={16}/> Export activity</button><button className="button button-primary" onClick={()=>{setModal('scan');setScanStatus('Scanner is stopped.')}}><ScanLine size={16}/> Open gate console</button></div></div>
        <div className="stats-grid"><StatCard title="People registered" value={String(people.length)} change="Unique IDs in register" icon={<Users size={18}/>} tone="teal"/><StatCard title="Events today" value={String(todayEvents.length)} change="Recorded entries and exits" icon={<Activity size={18}/>} tone="blue"/><StatCard title="People currently inside" value={String(insidePeople)} change="Based on latest scan per ID" icon={<ArrowDownRight size={19}/>} tone="sand"/><StatCard title="Visitors inside" value={String(insideVisitors)} change="Active visitor sessions" icon={<ContactRound size={18}/>} tone="rose"/></div>
        <div className="content-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Gate operations</h2><p>Scan an ID to record entry or exit.</p></div><button className="button button-primary button-small" onClick={()=>setModal('scan')}><ScanLine size={14}/> Scan ID</button></div><div className="gate-summary"><span className="gate-summary-dot"/>{settings.gateName} · local station ready</div><div className="quick-actions"><button className="button button-secondary" onClick={()=>{setModal('person');setPage('People register')}}><UserPlus size={15}/> Add person</button><button className="button button-secondary" onClick={()=>{setModal('visitor');setPage('Visitors')}}><ContactRound size={15}/> Register visitor</button><button className="button button-secondary" onClick={()=>setPage('Reports')}><FileBarChart size={15}/> View reports</button></div><div className="field-hint">Important: this version stores records in the current browser only. It is not suitable as a shared multi-gate production system yet.</div></section>
        <section className="panel gates-panel"><div className="panel-heading"><div><h2>Workspace health</h2><p>Local application status</p></div><ShieldCheck size={19}/></div><div className="gate-list"><GateRow name="Browser database" location="Local storage on this device" status="Online" last="Auto-saves changes"/><GateRow name="Dynamsoft scanner" location="Requires camera permission and internet" status="Review" last="Starts from gate console"/><GateRow name="Shared server" location="Not configured in this build" status="Review" last="Needed for multiple gate stations"/></div></section></div>
        <section className="panel recent-panel"><div className="panel-heading recent-heading"><div><h2>Recent gate activity</h2><p>Latest recorded events</p></div><div className="table-actions"><span className="table-count">{events.length} records</span><button className="button button-quiet" onClick={()=>setPage('Gate activity')}>View activity <ChevronRight size={15}/></button></div></div><EventTable events={events.slice(0,8)}/><div className="table-footer"><span><span className="footer-status-dot"/> Local records</span><button onClick={exportEvents}>Export CSV <Download size={13}/></button></div></section>
      </div>}
      {page==='People register'&&<div className="page-content"><div className="page-heading-row"><div><div className="eyebrow">WORKSPACE / RECORDS</div><h1>People register<span className="heading-period">.</span></h1><p className="page-subtitle">Import a CSV with any additional columns. ID and Name columns are required.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportPeople}><Download size={15}/> Export CSV</button><button className="button button-secondary" onClick={()=>fileRef.current?.click()}><Upload size={15}/> Import CSV</button><button className="button button-primary" onClick={()=>{setPersonForm({id:'',name:'',fields:'Department=\\nRole=\\nYear='});setModal('person')}}><Plus size={15}/> Add person</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e=>{importPeople(e.target.files?.[0]);e.currentTarget.value=''}}/></div></div><div className="panel recent-panel"><div className="panel-heading recent-heading"><div><h2>Registered people</h2><p>{people.length} records saved in this browser</p></div><span className="table-count">{visiblePeople.length} shown</span></div><div className="table-wrap"><table><thead><tr><th>NAME</th><th>IDENTIFIER</th><th>ADDITIONAL FIELDS</th><th>ADDED</th><th/></tr></thead><tbody>{visiblePeople.map(p=><tr key={p.id}><td><div className="person-cell"><div className="avatar person-avatar">{p.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div><b>{p.name}</b><span>Registered person</span></div></div></td><td><span className="id-code">{p.id}</span></td><td>{Object.entries(p.fields).map(([k,v])=>`${k}: ${v}`).join(' · ')||'—'}</td><td>{new Date(p.createdAt).toLocaleDateString()}</td><td><button className="row-more" title="Delete person" onClick={()=>{if(confirm(`Delete ${p.name} (${p.id}) from the register? Historical events remain.`))setPeople(prev=>prev.filter(x=>x.id!==p.id))}}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!visiblePeople.length&&<Empty message={people.length?'No matching people':'No people registered yet. Import your CSV or add a record.'}/>}</div></div><div className="settings-note"><AlertCircle size={17}/><span>CSV import expects headers such as <b>ID, Name, Department, Year</b>. All columns besides ID and Name are retained as custom fields. Excel files should be saved as CSV UTF-8 first.</span></div></div>}
      {page==='Visitors'&&<div className="page-content"><div className="page-heading-row"><div><div className="eyebrow">WORKSPACE / TEMPORARY ACCESS</div><h1>Visitors<span className="heading-period">.</span></h1><p className="page-subtitle">Separate visitor register with host, purpose and visit status.</p></div><button className="button button-primary" onClick={()=>setModal('visitor')}><Plus size={15}/> Register visitor</button></div><div className="stats-grid"><StatCard title="Total visit records" value={String(visitors.length)} change="Includes previous visits" icon={<ContactRound size={18}/>} tone="teal"/><StatCard title="Currently inside" value={String(insideVisitors)} change="Visitor sessions not checked out" icon={<ArrowDownRight size={18}/>} tone="blue"/><StatCard title="Checked out" value={String(visitors.filter(v=>v.status==='OUT').length)} change="Completed visit sessions" icon={<Check size={18}/>} tone="sand"/><StatCard title="Search results" value={String(visibleVisitors.length)} change="Matching visitor records" icon={<Search size={18}/>} tone="rose"/></div><div className="panel recent-panel"><div className="panel-heading recent-heading"><div><h2>Visitor sessions</h2><p>Each registration creates a visit record.</p></div><button className="button button-secondary" onClick={()=>downloadCsv('entrycore-visitors.csv',[['Visit ID','Name','Phone','Address','Host','Purpose','Status','Check-in','Check-out'],...visitors.map(v=>[v.id,v.name,v.phone,v.address,v.host,v.purpose,v.status,v.inAt,v.outAt||''])])}><Download size={15}/> Export visitors</button></div><div className="table-wrap"><table><thead><tr><th>VISITOR</th><th>PHONE</th><th>HOST / PURPOSE</th><th>CHECK-IN</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{visibleVisitors.map(v=><tr key={v.id}><td><div className="person-cell"><div className="avatar person-avatar">{v.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div><b>{v.name}</b><span>{v.id}{v.address?` · ${v.address}`:''}</span></div></div></td><td>{v.phone}</td><td>{v.host||'—'}{v.purpose?` · ${v.purpose}`:''}</td><td>{timeLabel(v.inAt)}</td><td><span className={`direction-pill ${v.status==='IN'?'direction-in':'direction-out'}`}>{v.status==='IN'?'Inside':'Checked out'}</span></td><td>{v.status==='IN'&&<button className="button button-secondary button-small" onClick={()=>{setVisitors(prev=>prev.map(x=>x.id===v.id?{...x,status:'OUT',outAt:nowIso()}:x));recordEvent(v.id,v.name,'OUT','Visitor',v.purpose);notify('Visitor checked out.')}}><LogOut size={13}/> Check out</button>}</td></tr>)}</tbody></table>{!visibleVisitors.length&&<Empty message="No visitors found. Register a visitor to begin tracking visits."/>}</div></div></div>}
      {page==='Gate activity'&&<div className="page-content"><div className="page-heading-row"><div><div className="eyebrow">OPERATIONS / ACCESS LOG</div><h1>Gate activity<span className="heading-period">.</span></h1><p className="page-subtitle">Timestamped IN and OUT events for people and visitors.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportEvents}><Download size={15}/> Export CSV</button><button className="button button-primary" onClick={()=>setModal('scan')}><ScanLine size={15}/> Open scanner</button></div></div><div className="stats-grid"><StatCard title="All events" value={String(events.length)} change="Saved in this browser" icon={<Activity size={18}/>} tone="teal"/><StatCard title="Entries today" value={String(todayEvents.filter(e=>e.direction==='IN').length)} change="IN events" icon={<ArrowDownRight size={18}/>} tone="blue"/><StatCard title="Exits today" value={String(todayEvents.filter(e=>e.direction==='OUT').length)} change="OUT events" icon={<ArrowUpRight size={18}/>} tone="sand"/><StatCard title="Filtered events" value={String(visibleEvents.length)} change="Matches current search" icon={<Search size={18}/>} tone="rose"/></div><div className="panel recent-panel"><div className="panel-heading recent-heading"><div><h2>Event history</h2><p>Newest first. Historical events remain when a person is deleted.</p></div><span className="table-count">{visibleEvents.length} records</span></div><EventTable events={visibleEvents}/></div></div>}
      {page==='Reports'&&<div className="page-content"><div className="page-heading-row"><div><div className="eyebrow">OPERATIONS / EXPORTS</div><h1>Reports<span className="heading-period">.</span></h1><p className="page-subtitle">Download operational records for spreadsheet analysis.</p></div></div><div className="stats-grid"><StatCard title="Events today" value={String(todayEvents.length)} change="All event types" icon={<Activity size={18}/>} tone="teal"/><StatCard title="Unique people" value={String(new Set(events.filter(e=>e.kind==='Person').map(e=>e.personId)).size)} change="People with a recorded event" icon={<Users size={18}/>} tone="blue"/><StatCard title="Visitor sessions" value={String(visitors.length)} change="Current and past visits" icon={<ContactRound size={18}/>} tone="sand"/><StatCard title="People registered" value={String(people.length)} change="Current register size" icon={<FileBarChart size={18}/>} tone="rose"/></div><div className="report-grid"><ReportCard title="Gate activity export" desc="Timestamp, identifier, name, type, direction, gate and details." icon={<FileBarChart size={22}/>} action="Download activity CSV" onClick={exportEvents}/><ReportCard title="People register export" desc="Export registered people and every imported custom field." icon={<Users size={22}/>} action="Download people CSV" onClick={exportPeople}/><ReportCard title="Visitor sessions export" desc="Visitor contact, host, purpose, check-in and check-out timestamps." icon={<ContactRound size={22}/>} action="Download visitor CSV" onClick={()=>downloadCsv('entrycore-visitors.csv',[['Visit ID','Name','Phone','Address','Host','Purpose','Status','Check-in','Check-out'],...visitors.map(v=>[v.id,v.name,v.phone,v.address,v.host,v.purpose,v.status,v.inAt,v.outAt||''])])}/></div><div className="settings-note"><AlertCircle size={17}/><span>These are live exports from this browser's local records. Cross-gate summaries and scheduled reports require a shared server backend.</span></div></div>}
      {page==='Workspace settings'&&<div className="page-content settings-page"><div className="page-heading-row"><div><div className="eyebrow">ADMINISTRATION / PREFERENCES</div><h1>Workspace settings<span className="heading-period">.</span></h1><p className="page-subtitle">Customise this local EntryCore workspace.</p></div><button className="button button-primary" onClick={()=>notify('Settings are auto-saved in this browser.')}><Check size={16}/> Saved automatically</button></div><div className="settings-layout"><aside className="settings-nav"><div className="settings-nav-title">PERSONALISE</div><a className="settings-nav-link active" href="#brand"><Building2 size={16}/> Brand identity</a><a className="settings-nav-link" href="#appearance"><Palette size={16}/> Appearance</a><a className="settings-nav-link" href="#scanner"><ScanLine size={16}/> Scanner setup</a><a className="settings-nav-link" href="#data"><SlidersHorizontal size={16}/> Data management</a></aside><div className="settings-sections"><section className="settings-card" id="brand"><div className="settings-card-heading"><div><h2>Brand identity</h2><p>Set the name and logo shown in this workspace.</p></div><Building2 size={19}/></div><div className="logo-editor"><div className="logo-preview">{settings.logo?<img src={settings.logo} alt="Logo"/>:<ShieldCheck size={29}/>}</div><div className="logo-editor-copy"><b>Organisation logo</b><span>SVG, PNG or JPG. Stored locally in this browser.</span><div className="inline-actions"><button className="button button-secondary button-small" onClick={()=>logoRef.current?.click()}><Upload size={14}/> Upload logo</button>{settings.logo&&<button className="button button-quiet button-small" onClick={()=>updateSettings('logo',null)}>Remove</button>}<input ref={logoRef} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>1_500_000){notify('Choose a logo smaller than 1.5 MB.');return}const r=new FileReader();r.onload=()=>updateSettings('logo',String(r.result));r.readAsDataURL(f)}}}/></div></div></div><div className="form-grid"><label className="field-label">Organisation name<input value={settings.orgName} onChange={e=>updateSettings('orgName',e.target.value)} placeholder="Your organisation"/></label><label className="field-label">Tagline<input value={settings.tagline} onChange={e=>updateSettings('tagline',e.target.value)} placeholder="Optional tagline"/></label><label className="field-label">Gate / station name<input value={settings.gateName} onChange={e=>updateSettings('gateName',e.target.value)} placeholder="Main gate"/></label></div></section>
      <section className="settings-card" id="appearance"><div className="settings-card-heading"><div><h2>Appearance</h2><p>Choose a restrained visual style for your organisation.</p></div><Palette size={19}/></div><div className="setting-row"><div><b>Interface theme</b><span>Light or dark mode on this device.</span></div><div className="segmented"><button className={settings.theme==='Light'?'selected':''} onClick={()=>updateSettings('theme','Light')}><Sun size={15}/> Light</button><button className={settings.theme==='Dark'?'selected':''} onClick={()=>updateSettings('theme','Dark')}><Moon size={15}/> Dark</button></div></div><div className="setting-row"><div><b>Accent colour</b><span>Navigation and primary actions.</span></div><div className="accent-options">{['#287b72','#345e91','#725c8f','#9a6938','#485b68'].map(c=><button key={c} className={`accent-swatch ${settings.accent===c?'chosen':''}`} style={{background:c}} onClick={()=>updateSettings('accent',c)} aria-label={`Set accent ${c}`}>{settings.accent===c&&<Check size={15}/>}</button>)}<label className="custom-color"><input type="color" value={settings.accent} onChange={e=>updateSettings('accent',e.target.value)}/><Plus size={15}/></label><code>{settings.accent.toUpperCase()}</code></div></div><div className="setting-row"><div><b>Information density</b><span>Table and panel spacing.</span></div><div className="segmented"><button className={settings.density==='Comfortable'?'selected':''} onClick={()=>updateSettings('density','Comfortable')}>Comfortable</button><button className={settings.density==='Compact'?'selected':''} onClick={()=>updateSettings('density','Compact')}>Compact</button></div></div></section>
      <section className="settings-card" id="scanner"><div className="settings-card-heading"><div><h2>Dynamsoft barcode scanner</h2><p>Use the official Dynamsoft Barcode Reader JavaScript SDK v11 bundle.</p></div><ScanLine size={19}/></div><label className="field-label">Dynamsoft license key (optional for short test)<input value={licenseInput} onChange={e=>setLicenseInput(e.target.value)} placeholder="Paste your own trial or production license"/></label><div className="field-hint">If left blank, the app uses Dynamsoft's public 24-hour test license. It is not a production license. Your own key is saved only in this browser's local settings; use a licensed deployment for production.</div><div className="inline-actions"><button className="button button-secondary" onClick={()=>{updateSettings('licenseKey',licenseInput.trim());notify('Scanner license setting saved locally.')}}><Check size={14}/> Save license setting</button><button className="button button-secondary" onClick={()=>{setModal('scan');setScanStatus('Scanner is stopped.')}}><Camera size={14}/> Test scanner</button></div></section>
      <section className="settings-card" id="data"><div className="settings-card-heading"><div><h2>Data management</h2><p>Back up or clear the local data stored in this browser.</p></div><SlidersHorizontal size={19}/></div><div className="quick-actions"><button className="button button-secondary" onClick={()=>{const payload={version:1,exportedAt:nowIso(),settings,people,visitors,events};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='entrycore-backup.json';a.click();URL.revokeObjectURL(url)}}><Download size={15}/> Download full backup</button><button className="button button-secondary" onClick={()=>fileRef.current?.click()}><FileUp size={15}/> Import people CSV</button><button className="button button-secondary danger-button" onClick={()=>{if(confirm('Delete all people, visitors and gate events from this browser? This cannot be undone.')){setPeople([]);setVisitors([]);setEvents([]);notify('Local records cleared.')}}}><Trash2 size={15}/> Clear all records</button></div><div className="settings-note"><AlertCircle size={17}/><span><b>Deployment limitation:</b> localStorage is not a database server and has no multi-user access control. Do not use this preview as the sole record system for a real institution. A production build needs a secured backend, database, backups, audit controls and server-side permissions.</span></div></section></div></div></div>}
      <footer className="app-footer"><span>EntryCore <span className="footer-version">LOCAL MVP · V1</span></span><span><span className="footer-status-dot"/> Local browser storage <span className="footer-separator">·</span> Not production-ready</span></footer>
    </main>
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){if(modal==='scan')stopScanner();setModal(null)}}}><div className="modal-card"><div className="modal-heading"><div><h2>{modal==='person'?'Add person':modal==='visitor'?'Register visitor':'Gate console'}</h2><p>{modal==='person'?'Create a record with a unique ID and custom fields.':modal==='visitor'?'Register a temporary visitor and start their visit.':`Station: ${settings.gateName}`}</p></div><button className="icon-button" onClick={()=>{if(modal==='scan')stopScanner();setModal(null)}}><X size={18}/></button></div>
      {modal==='person'&&<div className="modal-form"><label className="field-label">Identifier / QR value *<input autoFocus value={personForm.id} onChange={e=>setPersonForm(v=>({...v,id:e.target.value}))} placeholder="Exact value encoded in ID QR"/></label><label className="field-label">Full name *<input value={personForm.name} onChange={e=>setPersonForm(v=>({...v,name:e.target.value}))} placeholder="Full name"/></label><label className="field-label">Additional fields <span className="optional-label">ONE PER LINE: FIELD=VALUE</span><textarea rows={5} value={personForm.fields} onChange={e=>setPersonForm(v=>({...v,fields:e.target.value}))} placeholder={'Department=Engineering\\nYear=1'}/></label><div className="modal-actions"><button className="button button-secondary" onClick={()=>setModal(null)}>Cancel</button><button className="button button-primary" onClick={savePerson}><Plus size={14}/> Save person</button></div></div>}
      {modal==='visitor'&&<div className="modal-form"><label className="field-label">Visitor name *<input autoFocus value={visitorForm.name} onChange={e=>setVisitorForm(v=>({...v,name:e.target.value}))} placeholder="Full name"/></label><div className="form-grid"><label className="field-label">Phone *<input value={visitorForm.phone} onChange={e=>setVisitorForm(v=>({...v,phone:e.target.value}))} placeholder="Contact number"/></label><label className="field-label">Address<input value={visitorForm.address} onChange={e=>setVisitorForm(v=>({...v,address:e.target.value}))} placeholder="Optional"/></label><label className="field-label">Host / person to meet<input value={visitorForm.host} onChange={e=>setVisitorForm(v=>({...v,host:e.target.value}))} placeholder="Host name or department"/></label><label className="field-label">Purpose of visit<input value={visitorForm.purpose} onChange={e=>setVisitorForm(v=>({...v,purpose:e.target.value}))} placeholder="Meeting, delivery, etc."/></label></div><div className="modal-actions"><button className="button button-secondary" onClick={()=>setModal(null)}>Cancel</button><button className="button button-primary" onClick={saveVisitor}><Check size={14}/> Register & check in</button></div></div>}
      {modal==='scan'&&<div className="scanner-modal"><div className="scanner-controls"><div className="segmented"><button className={direction==='IN'?'selected':''} onClick={()=>setDirection('IN')}><LogIn size={14}/> IN</button><button className={direction==='OUT'?'selected':''} onClick={()=>setDirection('OUT')}><LogOut size={14}/> OUT</button></div><div className="scanner-buttons">{!scanning?<button className="button button-primary" onClick={startScanner}><Camera size={14}/> Start camera</button>:<button className="button button-secondary" onClick={stopScanner}><Square size={13}/> Stop camera</button>}</div></div><div className="camera-box" ref={cameraRef}><div className="camera-placeholder"><ScanLine size={32}/><b>Camera preview</b><span>Start the scanner to read QR or barcodes.</span></div></div><div className="scanner-status"><span className="live-dot"/>{scanStatus}</div><div className="manual-scan"><label className="field-label">Manual ID entry (fallback)<input value={scanValue} onChange={e=>setScanValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')processScan(scanValue)}} placeholder="Paste/type exact ID QR value"/></label><button className="button button-primary" onClick={()=>processScan(scanValue)}>Record {direction}</button></div><div className="field-hint">Repeated scans can create repeated events. Confirm the correct IN/OUT mode before each scan. Camera access requires browser permission and a supported browser.</div></div>}
      </div></div>}
  </div>
}
function StatCard({title,value,change,icon,tone}:{title:string;value:string;change:string;icon:React.ReactNode;tone:string}){return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{change}</div></div>}
function GateRow({name,location,status,last}:{name:string;location:string;status:string;last:string}){return <div className="gate-row"><div className="gate-icon"><Fingerprint size={17}/></div><div className="gate-info"><b>{name}</b><span>{location}</span><small>{last}</small></div><span className={`gate-status ${status==='Online'?'online':'review'}`}><i/>{status}</span></div>}
function EventTable({events}:{events:EventRecord[]}){return <div className="table-wrap"><table><thead><tr><th>PERSON / VISITOR</th><th>IDENTIFIER</th><th>TYPE</th><th>GATE</th><th>DIRECTION</th><th>TIME</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td><div className="person-cell"><div className="avatar person-avatar">{e.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div><b>{e.name}</b><span>{e.detail||e.kind}</span></div></div></td><td><span className="id-code">{e.personId}</span></td><td>{e.kind}</td><td>{e.gate}</td><td><span className={`direction-pill ${e.direction==='IN'?'direction-in':'direction-out'}`}>{e.direction==='IN'?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>} {e.direction}</span></td><td><span className="time-cell"><Clock3 size={13}/>{timeLabel(e.time)}</span></td></tr>)}</tbody></table>{!events.length&&<Empty message="No gate events yet. Open the gate console and scan an ID."/>}</div>}
function Empty({message}:{message:string}){return <div className="empty-search"><Search size={20}/><b>{message}</b></div>}
function ReportCard({title,desc,icon,action,onClick}:{title:string;desc:string;icon:React.ReactNode;action:string;onClick:()=>void}){return <section className="panel report-card"><div className="report-icon">{icon}</div><h2>{title}</h2><p>{desc}</p><button className="button button-secondary" onClick={onClick}><Download size={14}/>{action}</button></section>}
export default App
