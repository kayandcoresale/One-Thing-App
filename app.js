
const {createClient}=window.supabase;
const db=createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const LEGACY="oneThingApp_v1",MIGRATED="oneThingMigrationHandled_v1";
const defaults={app_name:"One Thing",commitment:"Go live on Whatnot",show_time:"19:00",active_days:[0,1,2,3,4,5,6],reminder_mode:"relentless",voice:"direct",debt_goal:0,debt_paid:0};
let session,profile,settings={...defaults},entries=[],mode="login",timers=[];
const key=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(v||0));

function bind(){
 $("loginTab").onclick=()=>switchMode("login");$("signupTab").onclick=()=>switchMode("signup");
 $("authForm").onsubmit=auth;$("forgotButton").onclick=forgot;$("logoutButton").onclick=()=>db.auth.signOut();
 $("settingsButton").onclick=openSettings;$("settingsForm").onsubmit=saveSettings;$("onboardingForm").onsubmit=onboard;
 $("liveButton").onclick=()=>markDone("live");$("completeButton").onclick=()=>markDone("completed");
 $("skipButton").onclick=()=>$("skipDialog").showModal();$("skipForm").onsubmit=markSkip;
 $("resultForm").onsubmit=saveResult;$("clearHistoryButton").onclick=clearHistory;
 $("enableNotificationsButton").onclick=enableNotifications;$("testNotificationButton").onclick=()=>notify(-10);
 $("importButton").onclick=importLegacy;$("skipImportButton").onclick=()=>{localStorage.setItem(MIGRATED,"skip");$("migrationDialog").close()};
}
async function init(){
 bind();
 const {data:{session:s}}=await db.auth.getSession();await handleSession(s);
 db.auth.onAuthStateChange(async(_,s2)=>handleSession(s2));
 if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js");
 setInterval(updateCountdown,30000);
}
async function handleSession(s){
 session=s;cancelTimers();
 if(!s){document.body.classList.add("auth-locked");$("authScreen").classList.remove("hidden");return}
 document.body.classList.remove("auth-locked");$("authScreen").classList.add("hidden");await load();
}
async function load(){
 const uid=session.user.id;
 const [p,s,e]=await Promise.all([
  db.from("profiles").select("*").eq("id",uid).maybeSingle(),
  db.from("user_settings").select("*").eq("user_id",uid).maybeSingle(),
  db.from("check_ins").select("*").eq("user_id",uid).order("check_date",{ascending:false})
 ]);
 if(p.error||s.error||e.error){console.error(p.error,s.error,e.error);return toast("Could not load your account.")}
 profile=p.data;entries=e.data||[];
 if(!s.data){$("onboardingDialog").showModal();return}
 settings={...defaults,...s.data,active_days:(s.data.active_days||defaults.active_days).map(Number)};
 render();schedule();
 if(!localStorage.getItem(MIGRATED)&&hasLegacy())$("migrationDialog").showModal();
}
function switchMode(m){mode=m;const sign=m==="signup";$("loginTab").classList.toggle("active",!sign);$("signupTab").classList.toggle("active",sign);$("nameLabel").classList.toggle("hidden",!sign);$("nameInput").required=sign;$("authButton").textContent=sign?"Create account":"Log in";$("forgotButton").classList.toggle("hidden",sign);$("authMessage").textContent=""}
async function auth(ev){ev.preventDefault();const email=$("emailInput").value.trim(),password=$("passwordInput").value;const r=mode==="signup"?await db.auth.signUp({email,password,options:{data:{display_name:$("nameInput").value.trim()}}}):await db.auth.signInWithPassword({email,password});if(r.error)return $("authMessage").textContent=r.error.message;if(mode==="signup"&&!r.data.session)$("authMessage").textContent="Check your email, confirm the account, then log in."}
async function forgot(){const email=$("emailInput").value.trim();if(!email)return $("authMessage").textContent="Enter your email first.";const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});$("authMessage").textContent=error?error.message:"Password reset email sent."}
const checked=id=>[...document.querySelectorAll(`#${id} input:checked`)].map(x=>Number(x.value));
const setChecked=(id,days)=>document.querySelectorAll(`#${id} input`).forEach(x=>x.checked=days.includes(Number(x.value)));
async function onboard(ev){ev.preventDefault();const days=checked("onboardDays");if(!days.length)return toast("Choose at least one day.");const row={user_id:session.user.id,app_name:"One Thing",commitment:$("onboardCommitment").value.trim(),show_time:$("onboardTime").value,active_days:days,reminder_mode:$("onboardMode").value,voice:$("onboardVoice").value,debt_goal:Number($("onboardGoal").value||0),debt_paid:0};const{error}=await db.from("user_settings").insert(row);if(error)return toast(error.message);settings={...defaults,...row};$("onboardingDialog").close();render();schedule();if(!localStorage.getItem(MIGRATED)&&hasLegacy())$("migrationDialog").showModal()}
function openSettings(){$("appNameInput").value=settings.app_name;$("commitmentInput").value=settings.commitment;$("showTimeInput").value=settings.show_time;$("reminderModeInput").value=settings.reminder_mode;$("voiceInput").value=settings.voice;$("debtGoalInput").value=settings.debt_goal;$("debtPaidInput").value=settings.debt_paid;setChecked("settingsDays",settings.active_days);$("settingsDialog").showModal()}
async function saveSettings(ev){ev.preventDefault();const days=checked("settingsDays");if(!days.length)return toast("Choose at least one day.");const row={app_name:$("appNameInput").value.trim()||"One Thing",commitment:$("commitmentInput").value.trim(),show_time:$("showTimeInput").value,active_days:days,reminder_mode:$("reminderModeInput").value,voice:$("voiceInput").value,debt_goal:Number($("debtGoalInput").value||0),debt_paid:Number($("debtPaidInput").value||0),updated_at:new Date().toISOString()};const{data,error}=await db.from("user_settings").update(row).eq("user_id",session.user.id).select().single();if(error)return toast(error.message);settings={...defaults,...data,active_days:data.active_days.map(Number)};$("settingsDialog").close();render();schedule();toast("Settings saved.")}
const today=()=>entries.find(x=>x.check_date===key());
const active=()=>settings.active_days.includes(new Date().getDay());
function replace(x){entries=entries.filter(e=>e.check_date!==x.check_date);entries.push(x)}
async function markDone(source){const{data,error}=await db.from("check_ins").upsert({user_id:session.user.id,check_date:key(),status:"completed",source,completed_at:new Date().toISOString(),skip_reason:null},{onConflict:"user_id,check_date"}).select().single();if(error)return toast(error.message);replace(data);cancelTimers();render();toast(source==="live"?"Notifications stopped. Go make money.":"Promise kept.")}
async function markSkip(ev){ev.preventDefault();const reason=new FormData(ev.target).get("skipReason"),status=reason==="Planned day off"?"excused":"skipped";const{data,error}=await db.from("check_ins").upsert({user_id:session.user.id,check_date:key(),status,source:"skip",completed_at:new Date().toISOString(),skip_reason:reason},{onConflict:"user_id,check_date"}).select().single();if(error)return toast(error.message);replace(data);cancelTimers();$("skipDialog").close();ev.target.reset();render();toast("Today recorded.")}
async function saveResult(ev){ev.preventDefault();const old=today();const row={user_id:session.user.id,check_date:key(),status:"completed",source:old?.source||"completed",completed_at:old?.completed_at||new Date().toISOString(),gross_sales:Number($("grossInput").value||0),profit:Number($("profitInput").value||0),items_sold:Number($("itemsInput").value||0),minutes_live:Number($("minutesInput").value||0),notes:$("notesInput").value.trim()};const{data,error}=await db.from("check_ins").upsert(row,{onConflict:"user_id,check_date"}).select().single();if(error)return toast(error.message);replace(data);ev.target.reset();render();toast(`${money(data.profit)} closer.`)}
function render(){document.title=settings.app_name;$("appTitle").textContent=settings.app_name;$("commitmentDisplay").textContent=settings.commitment;$("showTimeDisplay").textContent=active()?fmtTime(settings.show_time):"Not scheduled today";$("userChip").textContent=profile?.display_name||session.user.email;const done=entries.filter(x=>x.status==="completed"),profit=done.reduce((s,x)=>s+Number(x.profit||0),0),remaining=Math.max(0,Number(settings.debt_goal)-Number(settings.debt_paid)-profit);$("profitValue").textContent=money(profit);$("debtRemainingValue").textContent=settings.debt_goal?money(remaining):"Not set";$("showsValue").textContent=done.length;$("streakValue").textContent=`${streak()} days`;const t=today(),pill=$("todayStatus");pill.className="status-pill";if(!active()&&!t)pill.textContent="Day off";else if(!t)pill.textContent="Waiting";else if(t.status==="completed"){pill.textContent="Promise kept";pill.classList.add("complete")}else if(t.status==="excused")pill.textContent="Excused";else{pill.textContent="Skipped";pill.classList.add("skipped")}renderHistory();updateCountdown();notificationStatus()}
function renderHistory(){const list=$("historyList"),recent=[...entries].sort((a,b)=>b.check_date.localeCompare(a.check_date)).slice(0,14);if(!recent.length){list.innerHTML='<p class="empty-state">No entries yet.</p>';return}list.innerHTML=recent.map(x=>`<article class="history-entry"><div><strong>${x.status==="completed"?"✓ Promise kept":x.status==="excused"?"○ Excused":"✕ Skipped"}</strong><small>${fmtDate(x.check_date)}${x.skip_reason?" · "+safe(x.skip_reason):""}</small></div><div class="history-amount">${x.status==="completed"?money(x.profit):"—"}</div></article>`).join("")}
function streak(){const map=new Map(entries.map(x=>[x.check_date,x.status]));let n=0,d=new Date();for(let i=0;i<3650;i++){if(!settings.active_days.includes(d.getDay())){d.setDate(d.getDate()-1);continue}const k=key(d),s=map.get(k);if(s==="completed"||s==="excused"){if(s==="completed")n++;d.setDate(d.getDate()-1);continue}if(k===key()&&!s){d.setDate(d.getDate()-1);continue}break}return n}
const offsets=m=>m==="gentle"?[-60,-10,0,20]:m==="normal"?[-120,-60,-30,-10,0,10,20,30]:[-180,-120,-60,-45,-30,-20,-10,-5,0,10,20,30,40,50,60,75,90,120];
function schedule(){cancelTimers();if(!session||!active()||today()||!("Notification"in window)||Notification.permission!=="granted")return;const target=targetDate().getTime(),now=Date.now();offsets(settings.reminder_mode).forEach(o=>{const delay=target+o*60000-now;if(delay>0&&delay<86400000)timers.push(setTimeout(()=>notify(o),delay))})}
function cancelTimers(){timers.forEach(clearTimeout);timers=[]}
function notify(o){if(today()||Notification.permission!=="granted")return;const options={body:message(o),icon:"icons/icon-192.svg",tag:`one-${key()}-${o}`,requireInteraction:o>=0};navigator.serviceWorker?.ready?navigator.serviceWorker.ready.then(r=>r.showNotification(settings.commitment,options)):new Notification(settings.commitment,options)}
function message(o){const mins=Math.abs(o),timing=o===0?"It is time.":o<0?`${human(mins)} until your commitment.`:`${human(mins)} past your scheduled time.`;const groups={encouraging:["A smaller version still counts.","You only need to begin."],direct:["Your one commitment is still waiting.","Start before your brain negotiates."],accountant:["Skipping earns $0.","Your goal did not take today off."],funny:["It has, regrettably, not completed itself.","This is the notification you asked to annoy you."]};const g=groups[settings.voice]||groups.direct;return `${timing} ${g[Math.floor(Math.random()*g.length)]}`}
async function enableNotifications(){if(!("Notification"in window))return toast("Notifications are not supported.");const p=await Notification.requestPermission();notificationStatus();if(p==="granted"){schedule();toast("Notifications enabled.")}}
function notificationStatus(){const e=$("notificationStatus");if(!("Notification"in window))e.textContent="Notifications are not supported.";else if(Notification.permission==="granted")e.textContent="Notifications are enabled on this device.";else if(Notification.permission==="denied")e.textContent="Notifications are blocked in browser settings.";else e.textContent="Permission has not been requested."}
function updateCountdown(){if(!session)return;const t=today(),diff=targetDate()-Date.now();if(!active()&&!t)$("countdownDisplay").textContent="No commitment scheduled today.";else if(t?.status==="completed")$("countdownDisplay").textContent="Done for today. Notifications silenced.";else if(t)$("countdownDisplay").textContent="Today has been recorded.";else $("countdownDisplay").textContent=diff>0?`${human(Math.floor(diff/60000))} until your commitment.`:`${human(Math.floor(Math.abs(diff)/60000))} past your scheduled time. Still available.`}
function targetDate(){const[h,m]=settings.show_time.split(":").map(Number),d=new Date();d.setHours(h,m,0,0);return d}
async function clearHistory(){if(!confirm("Clear all cloud history?"))return;const{error}=await db.from("check_ins").delete().eq("user_id",session.user.id);if(error)return toast(error.message);entries=[];render()}
function hasLegacy(){try{const x=JSON.parse(localStorage.getItem(LEGACY));return !!(x&&(x.settings||x.entries?.length))}catch{return false}}
async function importLegacy(){let old;try{old=JSON.parse(localStorage.getItem(LEGACY))}catch{return toast("Could not read old data.")}const s=old.settings||{};let r=await db.from("user_settings").update({app_name:s.appName||settings.app_name,commitment:s.commitment||settings.commitment,show_time:s.showTime||settings.show_time,reminder_mode:s.reminderMode||settings.reminder_mode,voice:s.voice||settings.voice,debt_goal:Number(s.debtGoal??settings.debt_goal),debt_paid:Number(s.debtPaid??settings.debt_paid)}).eq("user_id",session.user.id);if(r.error)return toast(r.error.message);const rows=(old.entries||[]).map(x=>({user_id:session.user.id,check_date:x.date,status:x.status==="completed"?"completed":"skipped",source:x.source||"legacy",completed_at:x.completedAt||new Date(`${x.date}T12:00:00`).toISOString(),skip_reason:x.reason||null,gross_sales:Number(x.gross||0),profit:Number(x.profit||0),items_sold:Number(x.items||0),minutes_live:Number(x.minutes||0),notes:x.notes||""}));if(rows.length){r=await db.from("check_ins").upsert(rows,{onConflict:"user_id,check_date"});if(r.error)return toast(r.error.message)}localStorage.setItem(MIGRATED,"imported");$("migrationDialog").close();toast("Old data imported.");await load()}
function fmtTime(v){const[h,m]=v.split(":").map(Number),d=new Date();d.setHours(h,m);return d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
function fmtDate(v){return new Date(`${v}T12:00:00`).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}
function human(n){if(n<60)return `${n} minutes`;const h=Math.floor(n/60),m=n%60;return m?`${h}h ${m}m`:`${h} hour${h===1?"":"s"}`}
function safe(v=""){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2400)}
init();
