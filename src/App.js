import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const SHIFT_OPTIONS = [
  { value: '00-06', label: '🌙 00:00 – 06:00' },
  { value: '06-12', label: '🌅 06:00 – 12:00' },
  { value: '12-18', label: '☀️ 12:00 – 18:00' },
  { value: '18-24', label: '🌆 18:00 – 24:00' },
  { value: '00-00', label: '⭐ 00:00 – 00:00 (замена)' },
]

function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function fmtTime(d) {
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
}
function fmtDT(d) { return fmtDate(d) + ' ' + fmtTime(d) }

function filterByPeriod(sales, period) {
  const now = new Date()
  if (period === 'day')   { return sales.filter(s => s.sale_date === fmtDate(now)) }
  if (period === 'week')  { const t = new Date(now); t.setDate(now.getDate()-6); t.setHours(0,0,0,0); return sales.filter(s => new Date(s.created_at) >= t) }
  if (period === 'month') { return sales.filter(s => { const t=new Date(s.created_at); return t.getMonth()===now.getMonth()&&t.getFullYear()===now.getFullYear() }) }
  if (period === 'year')  { return sales.filter(s => new Date(s.created_at).getFullYear()===now.getFullYear()) }
  if (period === 'lastmonth') {
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1)
    return sales.filter(s => { const t=new Date(s.created_at); return t.getMonth()===lm.getMonth()&&t.getFullYear()===lm.getFullYear() })
  }
  return sales
}

// ─── TOAST ───
function Toast({ msg, type }) {
  if (!msg) return null
  return (
    <div style={{
      position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
      background: type==='error' ? 'rgba(248,81,73,.15)' : 'rgba(63,185,80,.15)',
      border: `1px solid ${type==='error' ? 'rgba(248,81,73,.4)' : 'rgba(63,185,80,.4)'}`,
      color: type==='error' ? '#f85149' : '#3fb950',
      borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:600,
      boxShadow:'0 8px 30px rgba(0,0,0,.4)', zIndex:9999, whiteSpace:'nowrap'
    }}>
      {type==='error' ? '✕ ' : '✓ '}{msg}
    </div>
  )
}

function StatCard({ label, value, sub, color='#4d94ff' }) {
  return (
    <div style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:14, padding:'18px 20px' }}>
      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:800,color}}>{value}</div>
      {sub && <div style={{fontSize:12,color:'#8b949e',marginTop:4}}>{sub}</div>}
    </div>
  )
}

function PlatformTag({ p }) {
  return (
    <span style={{
      display:'inline-block', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5, textTransform:'uppercase',
      background: p==='OnlyFans' ? 'rgba(0,174,239,.15)' : 'rgba(124,92,191,.2)',
      color: p==='OnlyFans' ? '#00aeef' : '#b48aff',
      border: `1px solid ${p==='OnlyFans' ? 'rgba(0,174,239,.3)' : 'rgba(124,92,191,.3)'}`
    }}>{p==='OnlyFans'?'OF':'FS'}</span>
  )
}

function BarChart({ sales, period }) {
  const now = new Date()
  let buckets = []
  if (period==='day') {
    for (let h=0;h<24;h+=3) {
      const total = sales.filter(s=>{const th=new Date(s.created_at).getHours();return th>=h&&th<h+3}).reduce((a,b)=>a+Number(b.amount),0)
      buckets.push({label:h.toString().padStart(2,'0'),total})
    }
  } else if (period==='week') {
    const days=['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
    for (let i=6;i>=0;i--) { const d=new Date(now); d.setDate(now.getDate()-i); const total=sales.filter(s=>s.sale_date===fmtDate(d)).reduce((a,b)=>a+Number(b.amount),0); buckets.push({label:days[d.getDay()],total}) }
  } else if (period==='month'||period==='lastmonth') {
    const base = period==='lastmonth' ? new Date(now.getFullYear(),now.getMonth()-1,1) : new Date(now.getFullYear(),now.getMonth(),1)
    const dim = new Date(base.getFullYear(),base.getMonth()+1,0).getDate()
    for (let d=1;d<=dim;d++) { const total=sales.filter(s=>s.sale_date===fmtDate(new Date(base.getFullYear(),base.getMonth(),d))).reduce((a,b)=>a+Number(b.amount),0); buckets.push({label:d.toString(),total}) }
  } else {
    const months=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
    for (let m=0;m<12;m++) { const total=sales.filter(s=>{const t=new Date(s.created_at);return t.getMonth()===m&&t.getFullYear()===now.getFullYear()}).reduce((a,b)=>a+Number(b.amount),0); buckets.push({label:months[m],total}) }
  }
  const maxV = Math.max(...buckets.map(b=>b.total),1)
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:4,height:100}}>
      {buckets.map((b,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
          <div title={`$${b.total.toFixed(2)}`} style={{width:'100%',background:'linear-gradient(to top,#4d94ff,rgba(77,148,255,.35))',borderRadius:'3px 3px 0 0',height:`${Math.max((b.total/maxV)*85,b.total>0?4:1)}%`,minHeight:1}}/>
          <div style={{fontSize:9,color:'#6e7681',whiteSpace:'nowrap'}}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

function SalesTable({ sales, showOperator }) {
  const [previewImg, setPreviewImg] = useState(null)
  if (!sales.length) return (
    <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,padding:40,textAlign:'center',color:'#6e7681'}}>Нет данных за выбранный период</div>
  )
  return (
    <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,overflow:'hidden'}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid #30363d',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700}}>Детализация</div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr>
            {['Дата / Время', showOperator&&'Оператор','Смена','Платформа','Скрин','Ссылка','Брутто','Нетто','Зарплата','Комментарий'].filter(Boolean).map(h=>(
              <th key={h} style={{textAlign:'left',padding:'9px 14px',fontSize:11,color:'#6e7681',textTransform:'uppercase',letterSpacing:.4,borderBottom:'1px solid #30363d',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{[...sales].reverse().map(s=>(
            <tr key={s.id} style={{borderBottom:'1px solid rgba(48,54,61,.4)'}}>
              <td style={{padding:'10px 14px',color:'#8b949e',whiteSpace:'nowrap'}}>{fmtDT(new Date(s.created_at))}</td>
              {showOperator && <td style={{padding:'10px 14px',fontWeight:500}}>{s.operator_name}</td>}
              <td style={{padding:'10px 14px',color:'#8b949e',fontSize:12,whiteSpace:'nowrap'}}>{s.shift_label}</td>
              <td style={{padding:'10px 14px'}}><PlatformTag p={s.platform}/></td>
              <td style={{padding:'6px 14px'}}>
                {s.screenshot ? <img onClick={()=>setPreviewImg(s.screenshot)} src={s.screenshot} alt="скрин" style={{width:36,height:36,objectFit:'cover',borderRadius:5,cursor:'pointer',border:'1px solid #30363d',display:'block'}}/> : <span style={{color:'#6e7681'}}>—</span>}
              </td>
              <td style={{padding:'10px 14px',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {s.client_link ? <a href={s.client_link} target="_blank" rel="noreferrer" style={{color:'#4d94ff',textDecoration:'none',fontSize:12}}>{s.client_link.replace(/^https?:\/\//,'')}</a> : <span style={{color:'#6e7681'}}>—</span>}
              </td>
              <td style={{padding:'10px 14px',fontWeight:600,color:'#e6edf3'}}>${Number(s.amount).toFixed(2)}</td>
              <td style={{padding:'10px 14px',fontWeight:600,color:'#4d94ff'}}>${Number(s.netto).toFixed(2)}</td>
              <td style={{padding:'10px 14px',fontWeight:700,color:'#3fb950'}}>${Number(s.salary).toFixed(2)}</td>
              <td style={{padding:'10px 14px',color:'#8b949e'}}>{s.note||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {previewImg && (
        <div onClick={()=>setPreviewImg(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,cursor:'zoom-out'}}>
          <img src={previewImg} alt="скриншот" style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,objectFit:'contain'}}/>
          <div style={{position:'absolute',top:20,right:24,color:'#fff',fontSize:28,cursor:'pointer'}} onClick={()=>setPreviewImg(null)}>✕</div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
//  OPERATOR VIEW
// ══════════════════════════════════════════
function OperatorApp({ user, sales, setSales, onLogout }) {
  const [tab, setTab] = useState('main')
  const [shift, setShift] = useState(null)
  const [selShift, setSelShift] = useState('')
  const [platform, setPlatform] = useState('OnlyFans')
  const [amount, setAmount] = useState('')
  const [clientLink, setClientLink] = useState('')
  const [note, setNote] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotName, setScreenshotName] = useState('')
  const [previewImg, setPreviewImg] = useState(null)
  const [period, setPeriod] = useState('day')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const myShiftSales = shift ? sales.filter(s=>s.operator_login===user.login && s.shift_id===shift.id) : []
  const mySales = sales.filter(s=>s.operator_login===user.login)
  const periodSales = filterByPeriod(mySales, period)

  function showToast(msg,type='success') { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  function openShift() {
    if (!selShift) { showToast('Выберите смену','error'); return }
    setShift({ id: Date.now(), type: selShift, label: SHIFT_OPTIONS.find(s=>s.value===selShift)?.label, start: new Date().toISOString() })
    showToast('Смена открыта!')
  }
  function closeShift() {
    if (!window.confirm('Закрыть смену?')) return
    setShift(null); setSelShift('')
    showToast('Смена закрыта')
  }
  function handleScreenshot(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5*1024*1024) { showToast('Файл слишком большой (макс 5MB)','error'); return }
    const reader = new FileReader()
    reader.onload = ev => { setScreenshot(ev.target.result); setScreenshotName(file.name) }
    reader.readAsDataURL(file)
  }
  async function addSale() {
    const amt = parseFloat(amount)
    if (!amt||amt<=0) { showToast('Введите корректную сумму','error'); return }
    setSaving(true)
    const netto  = amt * 0.8
    const salary = netto * 0.2
    const sale = {
      operator_login: user.login,
      operator_name: user.name,
      shift_id: shift.id,
      shift_label: shift.label,
      platform, amount: amt, netto, salary,
      client_link: clientLink||null,
      note: note||null,
      screenshot: screenshot||null,
      sale_date: fmtDate(new Date())
    }
    const { data, error } = await supabase.from('sales').insert([sale]).select()
    if (error) { showToast('Ошибка сохранения','error'); setSaving(false); return }
    setSales(prev => [...prev, data[0]])
    setAmount(''); setNote(''); setClientLink(''); setScreenshot(null); setScreenshotName('')
    showToast(`+$${amt.toFixed(2)} · зарплата $${salary.toFixed(2)}`)
    setSaving(false)
  }

  const shiftTotal  = myShiftSales.reduce((a,b)=>a+Number(b.amount),0)
  const shiftNetto  = myShiftSales.reduce((a,b)=>a+Number(b.netto),0)
  const shiftSalary = myShiftSales.reduce((a,b)=>a+Number(b.salary),0)
  const periodTotal  = periodSales.reduce((a,b)=>a+Number(b.amount),0)
  const periodNetto  = periodSales.reduce((a,b)=>a+Number(b.netto),0)
  const periodSalary = periodSales.reduce((a,b)=>a+Number(b.salary),0)
  const ofTotal = periodSales.filter(s=>s.platform==='OnlyFans').reduce((a,b)=>a+Number(b.amount),0)
  const fsTotal = periodSales.filter(s=>s.platform==='Fansly').reduce((a,b)=>a+Number(b.amount),0)
  const PERIODS = [{v:'day',l:'Сегодня'},{v:'week',l:'Неделя'},{v:'month',l:'Месяц'},{v:'year',l:'Год'},{v:'lastmonth',l:'Прош. месяц'}]

  return (
    <div style={{minHeight:'100vh',background:'#0d1117',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <nav style={{background:'#161b22',borderBottom:'1px solid #30363d',padding:'0 24px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>Team</span>
          <div style={{width:1,height:20,background:'#30363d'}}/>
          {['main','history'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'#4d94ff':'none',border:'none',borderRadius:8,padding:'6px 14px',color:tab===t?'#fff':'#8b949e',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'}}>
              {t==='main'?'🏠 Главная':'🕐 История'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{background:'#1c2333',border:'1px solid #30363d',borderRadius:30,padding:'5px 14px 5px 6px',display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,background:'linear-gradient(135deg,#4d94ff,#7c5cbf)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12}}>{user.name[0]}</div>
            <span style={{fontSize:13,fontWeight:500}}>{user.name}</span>
          </div>
          <button onClick={onLogout} style={{background:'none',border:'1px solid #30363d',color:'#8b949e',borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Выйти</button>
        </div>
      </nav>

      <div style={{maxWidth:860,margin:'0 auto',padding:'28px 20px'}}>
        {tab==='main' && (
          <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #30363d'}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>Управление сменой</span>
              <span style={{fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:20,
                background:shift?'rgba(63,185,80,.15)':'rgba(248,81,73,.15)',
                color:shift?'#3fb950':'#f85149',
                border:`1px solid ${shift?'rgba(63,185,80,.3)':'rgba(248,81,73,.3)'}`}}>
                {shift ? '● Смена открыта' : 'Нет смены'}
              </span>
            </div>
            {!shift ? (
              <div style={{padding:'60px 24px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:16}}>🕐</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,marginBottom:8}}>Смена не открыта</div>
                <div style={{fontSize:14,color:'#8b949e',marginBottom:28}}>Откройте смену, чтобы начать работу</div>
                <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                  <select value={selShift} onChange={e=>setSelShift(e.target.value)} style={{background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'11px 16px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',minWidth:200}}>
                    <option value=''>— Выберите смену —</option>
                    {SHIFT_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={openShift} style={{background:'linear-gradient(135deg,#4d94ff,#2563eb)',border:'none',borderRadius:10,padding:'11px 22px',color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,cursor:'pointer'}}>▶ Открыть смену</button>
                </div>
              </div>
            ) : (
              <div style={{padding:'24px'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,marginBottom:24}}>
                  <StatCard label='Смена' value={shift.label.split('–')[0].trim()} color='#4d94ff'/>
                  <StatCard label='Начало' value={fmtTime(new Date(shift.start))} color='#e6edf3'/>
                  <StatCard label='Продаж' value={myShiftSales.length} color='#8b949e'/>
                  <StatCard label='Брутто' value={`$${shiftTotal.toFixed(2)}`} color='#e6edf3'/>
                  <StatCard label='Нетто' value={`$${shiftNetto.toFixed(2)}`} color='#4d94ff'/>
                  <StatCard label='Зарплата' value={`$${shiftSalary.toFixed(2)}`} color='#3fb950'/>
                </div>

                <div style={{borderTop:'1px solid #30363d',paddingTop:20,marginBottom:20}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#6e7681',textTransform:'uppercase',letterSpacing:.8,marginBottom:14}}>Добавить продажу</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Платформа</div>
                      <select value={platform} onChange={e=>setPlatform(e.target.value)} style={{width:'100%',background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none'}}>
                        <option>OnlyFans</option>
                        <option>Fansly</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Ссылка на клиента</div>
                      <input type='text' placeholder='https://...' value={clientLink} onChange={e=>setClientLink(e.target.value)} style={{width:'100%',background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Сумма (брутто), $</div>
                      <input type='number' placeholder='0.00' value={amount} onChange={e=>setAmount(e.target.value)} style={{width:'100%',background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Комментарий</div>
                      <input type='text' placeholder='Необязательно' value={note} onChange={e=>setNote(e.target.value)} style={{width:'100%',background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <div style={{fontSize:11,color:'#6e7681',fontWeight:600,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Скриншот продажи</div>
                      <label style={{display:'flex',alignItems:'center',gap:12,background:'#1c2333',border:`2px dashed ${screenshot?'#3fb950':'#30363d'}`,borderRadius:10,padding:'12px 16px',cursor:'pointer'}}>
                        <input type='file' accept='image/*' onChange={handleScreenshot} style={{display:'none'}}/>
                        {screenshot ? (
                          <>
                            <img src={screenshot} alt='preview' style={{width:48,height:48,objectFit:'cover',borderRadius:6,border:'1px solid #30363d',flexShrink:0}}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:600,color:'#3fb950',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✓ {screenshotName}</div>
                              <div style={{fontSize:11,color:'#8b949e',marginTop:2}}>Нажмите чтобы заменить</div>
                            </div>
                            <button onClick={e=>{e.preventDefault();e.stopPropagation();setScreenshot(null);setScreenshotName('')}} style={{background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',color:'#f85149',borderRadius:6,padding:'4px 10px',fontSize:12,cursor:'pointer',flexShrink:0}}>✕</button>
                          </>
                        ) : (
                          <>
                            <div style={{width:48,height:48,background:'#161b22',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📸</div>
                            <div>
                              <div style={{fontSize:13,fontWeight:500,color:'#8b949e'}}>Нажмите чтобы загрузить скриншот</div>
                              <div style={{fontSize:11,color:'#6e7681',marginTop:2}}>PNG, JPG · до 5MB</div>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {parseFloat(amount) > 0 && (
                    <div style={{background:'#0d1117',border:'1px solid #30363d',borderRadius:12,padding:'14px 18px',marginBottom:12,display:'flex',gap:20,flexWrap:'wrap',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,color:'#6e7681'}}>Брутто:</span><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>${parseFloat(amount).toFixed(2)}</span></div>
                      <span style={{color:'#30363d'}}>→</span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,color:'#6e7681'}}>Комиссия (20%):</span><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'#f85149'}}>−${(parseFloat(amount)*0.2).toFixed(2)}</span></div>
                      <span style={{color:'#30363d'}}>→</span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,color:'#6e7681'}}>Нетто:</span><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'#4d94ff'}}>${(parseFloat(amount)*0.8).toFixed(2)}</span></div>
                      <span style={{color:'#30363d'}}>→</span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:12,color:'#6e7681'}}>Зарплата:</span><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'#3fb950',fontSize:16}}>${(parseFloat(amount)*0.16).toFixed(2)}</span></div>
                    </div>
                  )}

                  <button onClick={addSale} disabled={saving} style={{background:'linear-gradient(135deg,#3fb950,#2ea043)',border:'none',borderRadius:10,padding:'11px 24px',color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>
                    {saving ? 'Сохранение...' : '+ Добавить продажу'}
                  </button>
                </div>

                {myShiftSales.length > 0 && (
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'#6e7681',textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>Продажи этой смены</div>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <thead><tr>{['Время','Платформа','Скрин','Ссылка','Брутто','Нетто','Зарплата','Комментарий'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:11,color:'#6e7681',textTransform:'uppercase',letterSpacing:.4,borderBottom:'1px solid #30363d',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                        <tbody>{[...myShiftSales].reverse().map(s=>(
                          <tr key={s.id} style={{borderBottom:'1px solid rgba(48,54,61,.4)'}}>
                            <td style={{padding:'10px 12px',color:'#8b949e',whiteSpace:'nowrap'}}>{fmtTime(new Date(s.created_at))}</td>
                            <td style={{padding:'10px 12px'}}><PlatformTag p={s.platform}/></td>
                            <td style={{padding:'6px 12px'}}>{s.screenshot ? <img onClick={()=>setPreviewImg(s.screenshot)} src={s.screenshot} alt='скрин' style={{width:36,height:36,objectFit:'cover',borderRadius:5,cursor:'pointer',border:'1px solid #30363d',display:'block'}}/> : <span style={{color:'#6e7681'}}>—</span>}</td>
                            <td style={{padding:'10px 12px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.client_link ? <a href={s.client_link} target='_blank' rel='noreferrer' style={{color:'#4d94ff',textDecoration:'none',fontSize:12}}>{s.client_link.replace(/^https?:\/\//,'')}</a> : <span style={{color:'#6e7681'}}>—</span>}</td>
                            <td style={{padding:'10px 12px',fontWeight:600}}>${Number(s.amount).toFixed(2)}</td>
                            <td style={{padding:'10px 12px',fontWeight:600,color:'#4d94ff'}}>${Number(s.netto).toFixed(2)}</td>
                            <td style={{padding:'10px 12px',fontWeight:700,color:'#3fb950'}}>${Number(s.salary).toFixed(2)}</td>
                            <td style={{padding:'10px 12px',color:'#8b949e'}}>{s.note||'—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                <button onClick={closeShift} style={{marginTop:20,background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',color:'#f85149',borderRadius:10,padding:'9px 18px',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>⏹ Закрыть смену</button>
              </div>
            )}
          </div>
        )}

        {tab==='history' && (
          <div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
              {PERIODS.map(p=>(
                <button key={p.v} onClick={()=>setPeriod(p.v)} style={{background:period===p.v?'#4d94ff':'#161b22',border:`1px solid ${period===p.v?'#4d94ff':'#30363d'}`,borderRadius:8,padding:'8px 16px',color:period===p.v?'#fff':'#8b949e',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'}}>{p.l}</button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20}}>
              <StatCard label='Брутто' value={`$${periodTotal.toFixed(2)}`} sub={`${periodSales.length} продаж`} color='#e6edf3'/>
              <StatCard label='Нетто' value={`$${periodNetto.toFixed(2)}`} color='#4d94ff'/>
              <StatCard label='Ваша зарплата' value={`$${periodSalary.toFixed(2)}`} color='#3fb950'/>
              <StatCard label='OnlyFans' value={`$${ofTotal.toFixed(2)}`} color='#00aeef'/>
              <StatCard label='Fansly' value={`$${fsTotal.toFixed(2)}`} color='#b48aff'/>
            </div>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,padding:'20px 20px 16px',marginBottom:16}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,marginBottom:16}}>График продаж</div>
              <BarChart sales={periodSales} period={period}/>
            </div>
            <SalesTable sales={periodSales} showOperator={false}/>
          </div>
        )}
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {previewImg && (
        <div onClick={()=>setPreviewImg(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,cursor:'zoom-out'}}>
          <img src={previewImg} alt='скриншот' style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,objectFit:'contain'}}/>
          <div style={{position:'absolute',top:20,right:24,color:'#fff',fontSize:28,cursor:'pointer'}} onClick={()=>setPreviewImg(null)}>✕</div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
//  ADMIN VIEW
// ══════════════════════════════════════════
function AdminApp({ user, users, setUsers, sales, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [period, setPeriod] = useState('day')
  const [toast, setToast] = useState(null)
  const [newLogin, setNewLogin] = useState('')
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)

  function showToast(msg,type='success') { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const periodSales = filterByPeriod(sales, period)
  const total       = periodSales.reduce((a,b)=>a+Number(b.amount),0)
  const totalNetto  = periodSales.reduce((a,b)=>a+Number(b.netto),0)
  const totalSalary = periodSales.reduce((a,b)=>a+Number(b.salary),0)
  const ofTotal = periodSales.filter(s=>s.platform==='OnlyFans').reduce((a,b)=>a+Number(b.amount),0)
  const fsTotal = periodSales.filter(s=>s.platform==='Fansly').reduce((a,b)=>a+Number(b.amount),0)
  const operators = users.filter(u=>u.role==='operator')
  const ranking = operators.map(op=>{
    const opSales = periodSales.filter(s=>s.operator_login===op.login)
    return { ...op, total: opSales.reduce((a,b)=>a+Number(b.amount),0), salary: opSales.reduce((a,b)=>a+Number(b.salary),0), count: opSales.length }
  }).sort((a,b)=>b.total-a.total)

  async function addOperator() {
    if (!newLogin||!newName||!newPass) { showToast('Заполните все поля','error'); return }
    if (users.find(u=>u.login===newLogin)) { showToast('Логин уже занят','error'); return }
    setSaving(true)
    const { data, error } = await supabase.from('users').insert([{login:newLogin,password:newPass,name:newName,role:'operator'}]).select()
    if (error) { showToast('Ошибка: '+error.message,'error'); setSaving(false); return }
    setUsers(prev=>[...prev,data[0]])
    setNewLogin(''); setNewName(''); setNewPass('')
    showToast(`Оператор ${newName} добавлен`)
    setSaving(false)
  }
  async function removeOperator(id, name) {
    if (!window.confirm(`Удалить оператора ${name}?`)) return
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) { showToast('Ошибка удаления','error'); return }
    setUsers(prev=>prev.filter(u=>u.id!==id))
    showToast('Оператор удалён')
  }
  async function toggleActive(op) {
    const { error } = await supabase.from('users').update({active:!op.active}).eq('id',op.id)
    if (error) { showToast('Ошибка','error'); return }
    setUsers(prev=>prev.map(u=>u.id===op.id?{...u,active:!u.active}:u))
    showToast(op.active ? 'Доступ закрыт' : 'Доступ открыт')
  }

  const PERIODS = [{v:'day',l:'Сегодня'},{v:'week',l:'Неделя'},{v:'month',l:'Месяц'},{v:'year',l:'Год'},{v:'lastmonth',l:'Прош. месяц'}]
  const TABS = [{v:'overview',l:'📊 Обзор'},{v:'operators',l:'👥 Операторы'},{v:'sales',l:'💰 Продажи'}]

  return (
    <div style={{minHeight:'100vh',background:'#0d1117',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <nav style={{background:'#161b22',borderBottom:'1px solid #30363d',padding:'0 24px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>Team</span>
          <span style={{fontSize:11,fontWeight:700,background:'rgba(255,165,0,.15)',color:'#ffb347',border:'1px solid rgba(255,165,0,.3)',borderRadius:5,padding:'2px 8px'}}>ADMIN</span>
          <div style={{width:1,height:20,background:'#30363d'}}/>
          {TABS.map(t=>(
            <button key={t.v} onClick={()=>setTab(t.v)} style={{background:tab===t.v?'#4d94ff':'none',border:'none',borderRadius:8,padding:'6px 14px',color:tab===t.v?'#fff':'#8b949e',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'}}>{t.l}</button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{background:'rgba(255,165,0,.1)',border:'1px solid rgba(255,165,0,.3)',borderRadius:30,padding:'5px 14px 5px 6px',display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,background:'linear-gradient(135deg,#ffb347,#e67e22)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12}}>A</div>
            <span style={{fontSize:13,fontWeight:500,color:'#ffb347'}}>{user.name}</span>
          </div>
          <button onClick={onLogout} style={{background:'none',border:'1px solid #30363d',color:'#8b949e',borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Выйти</button>
        </div>
      </nav>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'28px 20px'}}>
        {(tab==='overview'||tab==='sales') && (
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
            {PERIODS.map(p=>(
              <button key={p.v} onClick={()=>setPeriod(p.v)} style={{background:period===p.v?'#4d94ff':'#161b22',border:`1px solid ${period===p.v?'#4d94ff':'#30363d'}`,borderRadius:8,padding:'8px 16px',color:period===p.v?'#fff':'#8b949e',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'}}>{p.l}</button>
            ))}
          </div>
        )}

        {tab==='overview' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20}}>
              <StatCard label='Брутто (все)' value={`$${total.toFixed(2)}`} sub={`${periodSales.length} продаж`} color='#e6edf3'/>
              <StatCard label='Нетто (все)' value={`$${totalNetto.toFixed(2)}`} color='#4d94ff'/>
              <StatCard label='ФОТ операторов' value={`$${totalSalary.toFixed(2)}`} color='#3fb950'/>
              <StatCard label='OnlyFans' value={`$${ofTotal.toFixed(2)}`} color='#00aeef'/>
              <StatCard label='Fansly' value={`$${fsTotal.toFixed(2)}`} color='#b48aff'/>
              <StatCard label='Активных' value={new Set(periodSales.map(s=>s.operator_login)).size} sub={`из ${operators.length}`} color='#ffb347'/>
            </div>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,padding:'20px 20px 16px',marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,marginBottom:16}}>График продаж</div>
              <BarChart sales={periodSales} period={period}/>
            </div>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid #30363d',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700}}>🏆 Рейтинг операторов</div>
              {ranking.length===0 ? (
                <div style={{padding:40,textAlign:'center',color:'#6e7681'}}>Нет данных за период</div>
              ) : ranking.map((op,i)=>(
                <div key={op.id} style={{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid rgba(48,54,61,.5)',gap:14}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:i===0?'linear-gradient(135deg,#ffd700,#e6a500)':i===1?'linear-gradient(135deg,#c0c0c0,#a0a0a0)':i===2?'linear-gradient(135deg,#cd7f32,#a0522d)':'#1c2333',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:12,flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{op.name}</div>
                    <div style={{fontSize:12,color:'#8b949e'}}>{op.count} продаж · зарплата <span style={{color:'#3fb950'}}>${op.salary.toFixed(2)}</span></div>
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'#4d94ff'}}>${op.total.toFixed(2)}</div>
                  <div style={{width:80,height:6,background:'#30363d',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${total>0?(op.total/total)*100:0}%`,background:'linear-gradient(to right,#4d94ff,#7c5cbf)',borderRadius:3}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='operators' && (
          <div>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,padding:'20px',marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>➕ Добавить оператора</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {[{v:newLogin,s:setNewLogin,p:'Логин'},{v:newName,s:setNewName,p:'Имя'},{v:newPass,s:setNewPass,p:'Пароль'}].map(f=>(
                  <input key={f.p} type='text' placeholder={f.p} value={f.v} onChange={e=>f.s(e.target.value)} style={{background:'#1c2333',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',flex:1,minWidth:120}}/>
                ))}
                <button onClick={addOperator} disabled={saving} style={{background:'linear-gradient(135deg,#3fb950,#2ea043)',border:'none',borderRadius:10,padding:'10px 20px',color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>
                  {saving?'...':'Добавить'}
                </button>
              </div>
            </div>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:14,overflow:'hidden'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid #30363d',fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700}}>Операторы ({operators.length})</div>
              {operators.length===0 && <div style={{padding:40,textAlign:'center',color:'#6e7681'}}>Операторов нет</div>}
              {operators.map(op=>{
                const opSales = sales.filter(s=>s.operator_login===op.login)
                const opTotal = opSales.reduce((a,b)=>a+Number(b.amount),0)
                const opSalary = opSales.reduce((a,b)=>a+Number(b.salary),0)
                return (
                  <div key={op.id} style={{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:'1px solid rgba(48,54,61,.5)',gap:14}}>
                    <div style={{width:36,height:36,background:'linear-gradient(135deg,#4d94ff,#7c5cbf)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,flexShrink:0}}>{op.name[0]}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                        {op.name}
                        {!op.active && <span style={{fontSize:10,background:'rgba(248,81,73,.15)',color:'#f85149',border:'1px solid rgba(248,81,73,.3)',borderRadius:4,padding:'1px 6px'}}>заблокирован</span>}
                      </div>
                      <div style={{fontSize:12,color:'#8b949e'}}>@{op.login} · пароль: {op.password}</div>
                    </div>
                    <div style={{textAlign:'right',marginRight:12}}>
                      <div style={{fontWeight:600,color:'#3fb950'}}>${opTotal.toFixed(2)}</div>
                      <div style={{fontSize:12,color:'#8b949e'}}>ФОТ: ${opSalary.toFixed(2)}</div>
                    </div>
                    <button onClick={()=>toggleActive(op)} style={{background:op.active?'rgba(248,81,73,.1)':'rgba(63,185,80,.1)',border:`1px solid ${op.active?'rgba(248,81,73,.3)':'rgba(63,185,80,.3)'}`,color:op.active?'#f85149':'#3fb950',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                      {op.active?'Закрыть доступ':'Открыть доступ'}
                    </button>
                    <button onClick={()=>removeOperator(op.id,op.name)} style={{background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.3)',color:'#f85149',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Удалить</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab==='sales' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:20}}>
              <StatCard label='Всего продаж' value={periodSales.length} color='#4d94ff'/>
              <StatCard label='Брутто' value={`$${total.toFixed(2)}`} color='#e6edf3'/>
              <StatCard label='Нетто' value={`$${totalNetto.toFixed(2)}`} color='#4d94ff'/>
              <StatCard label='ФОТ' value={`$${totalSalary.toFixed(2)}`} color='#3fb950'/>
            </div>
            <SalesTable sales={periodSales} showOperator={true}/>
          </div>
        )}
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
    </div>
  )
}

// ══════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════
export default function App() {
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loginVal, setLoginVal] = useState('')
  const [passVal, setPassVal] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    async function loadData() {
      const [{ data: u }, { data: s }] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('sales').select('*').order('created_at', { ascending: true })
      ])
      setUsers(u || [])
      setSales(s || [])
      setLoading(false)
    }
    loadData()
  }, [])

  async function doLogin() {
    setLogging(true); setLoginErr('')
    const user = users.find(u => u.login===loginVal && u.password===passVal)
    if (!user) { setLoginErr('Неверный логин или пароль'); setLogging(false); return }
    if (!user.active && user.role !== 'admin') { setLoginErr('Доступ закрыт. Обратитесь к администратору'); setLogging(false); return }
    setCurrentUser(user); setLogging(false)
  }
  function doLogout() { setCurrentUser(null); setLoginVal(''); setPassVal('') }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',color:'#8b949e',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400&display=swap')`}</style>
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:'#e6edf3',marginBottom:12}}>Team</div>
        <div>Загрузка...</div>
      </div>
    </div>
  )

  if (currentUser) {
    if (currentUser.role==='admin')
      return <AdminApp user={currentUser} users={users} setUsers={setUsers} sales={sales} onLogout={doLogout}/>
    return <OperatorApp user={currentUser} sales={sales} setSales={setSales} onLogout={doLogout}/>
  }

  return (
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:20,padding:'44px 42px',width:400,boxShadow:'0 24px 80px rgba(0,0,0,.6)'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:32,marginBottom:6}}>Team</div>
        <div style={{fontSize:14,color:'#8b949e',marginBottom:32}}>Войдите в свой кабинет</div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#8b949e',textTransform:'uppercase',letterSpacing:.5,marginBottom:7}}>Логин</div>
          <input type='text' placeholder='your_login' value={loginVal} onChange={e=>setLoginVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} style={{width:'100%',background:'#0d1117',border:`1px solid ${loginErr?'rgba(248,81,73,.5)':'#30363d'}`,borderRadius:10,padding:'12px 16px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#8b949e',textTransform:'uppercase',letterSpacing:.5,marginBottom:7}}>Пароль</div>
          <input type='password' placeholder='••••••••' value={passVal} onChange={e=>setPassVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} style={{width:'100%',background:'#0d1117',border:`1px solid ${loginErr?'rgba(248,81,73,.5)':'#30363d'}`,borderRadius:10,padding:'12px 16px',color:'#e6edf3',fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:'none',boxSizing:'border-box'}}/>
        </div>
        {loginErr && <div style={{color:'#f85149',fontSize:13,marginBottom:12,textAlign:'center'}}>✕ {loginErr}</div>}
        <button onClick={doLogin} disabled={logging} style={{width:'100%',background:'linear-gradient(135deg,#4d94ff,#2563eb)',border:'none',borderRadius:10,padding:13,color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,cursor:'pointer',opacity:logging?0.7:1,marginTop:4}}>
          {logging ? 'Вход...' : 'Войти'}
        </button>
      </div>
    </div>
  )
}
