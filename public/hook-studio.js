/* Hook Studio on the web: stands in for the artifact runtime's claude.use().
   "sample" calls our /api/sample route (Claude via the Anthropic SDK).
   "downloads" is not offered, so the app falls back to normal browser downloads. */
window.claude = {
  async use(name) {
    if (name !== "sample") {
      const e = new Error("not available");
      e.code = "not_declared";
      throw e;
    }
    return {
      async json(prompt, opts = {}) {
        let res;
        try {
          res = await fetch("/api/sample", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
            signal: opts.signal,
          });
        } catch (err) {
          const e = new Error("request failed");
          e.code = err && err.name === "AbortError" ? "cancelled" : "network";
          throw e;
        }
        if (res.status === 401) { location.href = "/sign-in?next=/studio"; return null; }
        if (res.status === 402) { location.href = "/pricing"; return null; }
        if (!res.ok) {
          const e = new Error("sample failed");
          e.code = res.status === 429 ? "rate_limited" : "error";
          throw e;
        }
        const data = await res.json();
        return data.result;
      },
    };
  },
};


const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const TONES=["Clickbait","Curiosity","Inspirational","Relatable","Luxe and calm"];
const KINDS={
 clickbait:["Clickbait hook","A punchy sentence that stops the scroll."],
 curiosity:["Curiosity question","An open loop the viewer has to watch to close."],
 quote:["Motivational quote","A short line, hard first and then the win."],
 pov:["POV line","pov: you finally did the thing."],
 secret:["Secret reveal","Ungatekeeping or insider tips."],
 list:["Numbered tease","3 things, top 5, the only list."],
 warning:["Stop scrolling warning","Direct and a little bossy."],
 regret:["Why didn't anyone tell me","Regret and FOMO."],
 relatable:["Relatable or funny","Says what the viewer is thinking."],
 emotional:["Emotional or nostalgic","Soft, personal, a little tender."],
 cta:["Save or follow nudge","Tells them to save it for later."]};
const KRULE={clickbait:"clickbait hook sentences",curiosity:"curiosity questions or open loops",quote:"short motivational quotes (hardship first, then the win)",pov:"pov lines",secret:"ungatekeeping or insider secret lines",list:"numbered list teases",warning:"stop-scrolling warnings",regret:"why-didn't-anyone-tell-me regret lines",relatable:"relatable or funny lines",emotional:"emotional or nostalgic lines",cta:"save-this or follow-me nudges"};
const ANIMS={no:"no text animation, text is fixed",yes:"animate every version after frame 1 (pop, slide, shimmer, animated exit), never fading or sliding in",mix:"a mix: some versions fixed, some animated after frame 1, never fading or sliding in"};
function kindsLabel(){return S.kinds.map(k=>KRULE[k]).join(", ")}
const DURS={open:"on screen from the first frame for about 3 seconds",whole:"on screen for the whole video"};
const ORDERS={shuffle:"clips can be shuffled",ordered:"keep the clip order exactly as filmed",single:"one continuous shot, nothing to reorder"};

const S={capmode:"kw",capkw:"",capwhat:"",captopic:"",capfollow:false,caps:[],step:1,kinds:["clickbait"],anim:"no",dur:"open",order:"shuffle",tones:["Curiosity"],desc:"",hooks:[],picked:[],assign:[],cur:0,y:235,size:70,safe:true,opts:{}};
let hid=0,sampleFn=null,ctl=null;const ANG_HOOK=["a first-person pov confession","a question the viewer cannot answer","an ungatekeeping secret reveal","a numbered list tease (3 things, top 5)","a stop-scrolling warning","a why-didn't-anyone-tell-me regret","a bucket list challenge or dare","an insider tip only locals know","a contrarian or unpopular opinion","a before-you-go warning","a this-is-your-sign nudge","a story opener (I did X so you don't have to)","a reaction line to something odd on screen (never seen anyone do X like that)","a named payoff with a number or timing (do this 7 days before you land)","a versus or before-and-after comparison"],
 ANG_QUOTE=["gratitude after a hard season","talking to your future self","giving yourself permission to rest","levelling up and leaving the old life","doing it for your younger self","trusting the timing","letting go of what did not work","proof that the hard part passes"];
let round=0;const shown=[];
const FB=["Shorter","More clickbaity","More curious","Less cringe","Less salesy","More personal","More luxe"],fbSel=new Set(),rejected=[];

/* ---------- hook renderers (1080 canvas) ---------- */
const lns=t=>String(t).split("\n").map(s=>s.trim()).filter(Boolean);
function fitAll(){document.querySelectorAll(".fit").forEach(f=>{const cv=f.querySelector(".cv");if(!cv)return;
  const k=f.clientWidth/1080;cv.style.transform=`scale(${k})`;f.style.height=(parseFloat(cv.style.height)*k)+"px"})}
new ResizeObserver(fitAll).observe(document.body);

/* ---------- stepper ---------- */
function stepper(){
  const names=["Video and text","Pick hooks","Look and tricks","Captions"];
  $("#steps").innerHTML=names.map((n,i)=>{const k=i+1,done=k<S.step,dis=k>S.step&&!(k==2&&S.hooks.length)&&!(k==3&&S.picked.length)&&!(k==4&&S.picked.length);
    return`<button class="stp ${done?'done':''}" data-k="${k}" ${k==S.step?'aria-current="step"':''} ${dis?'disabled':''}><i>${done?"✓":k}</i>${n}</button>`}).join("");
  document.querySelectorAll(".stp").forEach(b=>b.addEventListener("click",()=>go(+b.dataset.k)));
}
function go(k){S.step=k;[1,2,3,4].forEach(i=>$("#s"+i).hidden=i!=k);if(k==4)setup4();
  $("#prev").hidden=k!=3;$("#grid").classList.toggle("withprev",k==3);stepper();if(k==3)setup3();render3();fitAll();scrollTo(0,0)}

/* ---------- step 1 ---------- */
TONES.forEach(t=>{const c=document.createElement("button");c.className="chip";c.textContent=t;c.setAttribute("aria-pressed",S.tones.includes(t));
  c.addEventListener("click",()=>{const i=S.tones.indexOf(t);i>=0?S.tones.splice(i,1):S.tones.push(t);c.setAttribute("aria-pressed",i<0)});$("#tones").appendChild(c)});
Object.entries(KINDS).forEach(([k,[n,d]])=>{const b=document.createElement("button");b.className="vibe";b.setAttribute("role","checkbox");b.dataset.v=k;
  b.setAttribute("aria-checked",S.kinds.includes(k));b.innerHTML=`<strong>${n}</strong><span>${d}</span>`;
  b.addEventListener("click",()=>{const i=S.kinds.indexOf(k);if(i>=0){if(S.kinds.length>1)S.kinds.splice(i,1)}else S.kinds.push(k);
    document.querySelectorAll("#kinds .vibe").forEach(x=>x.setAttribute("aria-checked",S.kinds.includes(x.dataset.v)))});$("#kinds").appendChild(b)});
document.querySelectorAll(".vibes:not([data-multi])").forEach(g=>g.querySelectorAll(".vibe").forEach(b=>b.addEventListener("click",()=>{
  S[g.dataset.g]=b.dataset.v;g.querySelectorAll(".vibe").forEach(x=>x.setAttribute("aria-checked",x==b))})));
$("#desc").addEventListener("input",e=>S.desc=e.target.value);
const vid=$("#vid"),scrub=$("#scrub");
function grab(){try{const c=document.createElement("canvas");c.width=540;c.height=960;const x=c.getContext("2d");
  const vw=vid.videoWidth,vh=vid.videoHeight,r=Math.max(540/vw,960/vh);x.drawImage(vid,(540-vw*r)/2,(960-vh*r)/2,vw*r,vh*r);
  document.documentElement.style.setProperty("--frame",`url(${c.toDataURL("image/jpeg",.8)})`);$("#stage").style.backgroundImage="none"}catch(e){}}
function loadVideoBlob(f,name){S.videoURL=URL.createObjectURL(f);S.fileName=name;vid.src=S.videoURL;
  vid.addEventListener("loadeddata",()=>{$("#vinfo").textContent=`${name} · ${vid.duration.toFixed(1)}s`;scrub.disabled=false;scrub.max=Math.floor(vid.duration*10);vid.currentTime=.2},{once:true})}
$("#file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;loadVideoBlob(f,f.name);S.clips=null;S.cfg.forEach(c=>c.open=null);
  const ok=await idbSet("video",{blob:f,name:f.name});S.videoKept=!!ok;if(!ok)$("#savedat").textContent="This video is too big to keep for later. If you leave, add it again."});
vid.addEventListener("seeked",grab);scrub.addEventListener("input",()=>{vid.currentTime=scrub.value/10});

/* ---------- step 2: hook options ---------- */
const HOOKLORE=`What tends to work best for short-form hooks: 1) a reaction line to something visually odd or surprising on screen, like "Never seen anyone peel an egg like that". 2) a named, specific payoff with a number or timing, like "Book this 7 days before you land". 3) a comparison or versus line, like "dancer vs never danced a day in her life". Opening lines of 8 to 14 words usually beat 1 to 3 words. Weakest: flat statements, generic "rate this /10" asks and "who can relate" lines. Leave an open loop: hint at what happens or what to do without giving the answer. Across the 10, write about 4 reaction lines, 3 named payoffs, 2 comparisons and 1 free choice, each still obeying the length rules below.`;
function promptText(){
  const only=S.kinds.length==1&&S.kinds[0]=="quote",len=only?34:24;
  const rule=`Each is one piece of on-screen text, ${only?"1 or 2":"2 or 3"} short lines, each line under ${len} characters. Mix these kinds across the 10, roughly evenly: ${kindsLabel()}.`
    +(S.kinds.includes("clickbait")?" Make the clickbait ones stop a stranger scrolling.":"");
  return `You write the on-screen hook text for an Instagram Reel or TikTok by a content creator.
The video: ${S.desc.trim()||"(no description given)"}
Kinds of text wanted: ${kindsLabel()}. They are ${DURS[S.dur]}.
Tone: ${S.tones.join(", ")||"curiosity"}.

${HOOKLORE}\n\n${feedbackText()}${angleText()}Reply with only a JSON array of 10 strings. Each string is one piece of text.
${rule}
Separate lines inside one with \\n. Lowercase unless the line is meant to shout. No emojis, no em dashes. Use only facts the description gives. Speak to someone who does not yet want this.`;
}
function feedbackText(){
  const liked=S.picked.map(id=>S.hooks.find(h=>h.id==id)).filter(Boolean).map(h=>h.text.replace(/\n/g," / "));
  const fb=($("#fb")?$("#fb").value.trim():""),chips=[...fbSel];
  let t="";
  if(liked.length)t+="Hooks the creator liked (write more in this spirit): "+liked.join(" | ")+"\n";
  if(rejected.length)t+="Hooks the creator rejected (do not repeat their style): "+rejected.slice(-8).map(x=>x.replace(/\n/g," / ")).join(" | ")+"\n";
  if(chips.length)t+="Adjust: "+chips.join(", ").toLowerCase()+".\n";
  if(fb)t+="The creator's feedback: "+fb+"\n";
  return t?t+"\n":"";
}
function angleText(){
  const list=(S.kinds.length==1&&S.kinds[0]=="quote")?ANG_QUOTE:S.kinds.includes("quote")?ANG_HOOK.concat(ANG_QUOTE):ANG_HOOK,n=list.length,pick=[];
  for(let i=0;i<3;i++)pick.push(list[(round*3+i)%n]);
  round++;
  const avoid=shown.slice(-40).map(x=>x.replace(/\n/g," / "));
  return `This is attempt ${round}. Come at it from a clearly different angle than before. Lead with these angles this round: ${pick.join("; ")}. Spread the 10 across at least 5 different approaches.\n`+(avoid.length?`Already shown, do not repeat or paraphrase any of them: ${avoid.join(" | ")}\n`:"")+"\n";
}
function addHooks(arr,own){arr.forEach(t=>{const tx=String(t).replace(/\\n/g,"\n").trim();if(tx){S.hooks.push({id:++hid,text:tx,own:!!own});shown.push(tx)}})}
async function generate(){
  $("#fallback").hidden=true;$("#gstat").className="thinking";$("#gstat").textContent="Writing options";
  $("#more").disabled=true;$("#stop").hidden=false;
  ctl=new AbortController();
  try{
    const arr=await sampleFn.json(promptText(),{modelTier:"default",signal:ctl.signal,cache:false});
    if(Array.isArray(arr))addHooks(arr.map(x=>typeof x=="string"?x:(x&&x.text)||""));
    $("#gstat").className="note";$("#gstat").textContent=Array.isArray(arr)?"":"Claude's reply was not a list. Try again.";
  }catch(e){
    $("#gstat").className="note";
    if(e.code=="cancelled")$("#gstat").textContent="Stopped.";
    else if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(e.code)){$("#gstat").textContent="";showFallback()}
    else if(e.code=="rate_limited")$("#gstat").textContent="Too many requests. Wait a moment, then try again.";
    else $("#gstat").textContent="That didn't work. Press Write 10 more to try again.";
  }finally{$("#more").disabled=false;$("#stop").hidden=true;renderHooks()}
}
function showFallback(){$("#fallback").hidden=false;$("#promptBox").textContent=promptText()}
$("#to2").addEventListener("click",async()=>{S.hooks=S.hooks.filter(h=>h.own);S.picked=S.picked.filter(id=>S.hooks.some(h=>h.id==id));go(2);renderHooks();
  if(!sampleFn)showFallback();else generate()});
$("#more").addEventListener("click",()=>{if(sampleFn)generate();else showFallback()});
$("#stop").addEventListener("click",()=>ctl&&ctl.abort());
$("#addOwn").addEventListener("click",()=>{const v=$("#own").value;if(!v.trim())return;addHooks([v],true);S.picked.push(hid);$("#own").value="";renderHooks()});
$("#copyPrompt").addEventListener("click",()=>copyText($("#promptBox").textContent,$("#copyPrompt")));
function renderHooks(){
  const box=$("#hooks");box.innerHTML="";
  S.hooks.forEach(h=>{
    const n=S.picked.indexOf(h.id),d=document.createElement("div");d.style.position="relative";
    d.innerHTML=`<button class="hk" aria-pressed="${n>=0}"><pre>${esc(h.text)}</pre><span class="edit" role="button" tabindex="0">edit</span> <span class="edit no" role="button" tabindex="0" style="margin-left:10px">not for me</span></button>${n>=0?`<span class="badge">v${n+1}</span>`:""}`;
    const b=d.querySelector(".hk"),ed=d.querySelector(".edit"),no=d.querySelector(".no");
    no.addEventListener("click",ev=>{ev.stopPropagation();rejected.push(h.text);S.hooks=S.hooks.filter(x=>x!==h);S.picked=S.picked.filter(i=>i!=h.id);renderHooks()});
    b.addEventListener("click",ev=>{if(ev.target===ed||ev.target===no)return;
      const i=S.picked.indexOf(h.id);if(i>=0)S.picked.splice(i,1);else S.picked.push(h.id);renderHooks()});
    ed.addEventListener("click",()=>{const ta=document.createElement("textarea");ta.value=h.text;
      b.replaceChildren(ta);ta.focus();ta.addEventListener("click",e=>e.stopPropagation());
      ta.addEventListener("blur",()=>{h.text=ta.value.trim()||h.text;renderHooks()})});
    box.appendChild(d)});
  $("#to3").disabled=!S.picked.length;stepper();
}
FB.forEach(t=>{const c=document.createElement("button");c.className="chip";c.textContent=t;c.setAttribute("aria-pressed","false");
  c.addEventListener("click",()=>{fbSel.has(t)?fbSel.delete(t):fbSel.add(t);c.setAttribute("aria-pressed",fbSel.has(t))});$("#fbchips").appendChild(c)});
$("#rewrite").addEventListener("click",()=>{
  if(!$("#fb").value.trim()&&!fbSel.size&&!rejected.length){$("#fbstat").textContent="Add a note or tap a chip first.";return}
  $("#fbstat").textContent="";S.hooks=S.hooks.filter(h=>S.picked.includes(h.id)||h.own);renderHooks();
  if(sampleFn)generate();else{showFallback()}});
$("#to3").addEventListener("click",()=>go(3));
$("#back1").addEventListener("click",()=>go(1));
$("#back2").addEventListener("click",()=>go(2));

/* ---------- fonts ---------- */
const FONTS={
 pf:{n:"Playfair",fam:"Playfair Display",w:400,i:0},pfi:{n:"Playfair italic",fam:"Playfair Display",w:400,i:1,hide:1},
 pop:{n:"Poppins",fam:"Poppins",w:700,i:0},anton:{n:"Anton",fam:"Anton",w:400,i:0},
 frau:{n:"Fraunces italic",fam:"Fraunces",w:900,i:1},spar:{n:"League Spartan",fam:"League Spartan",w:800,i:0},
 corm:{n:"Cormorant italic",fam:"Cormorant Garamond",w:500,i:1},caveat:{n:"Caveat",fam:"Caveat",w:700,i:0},
 cour:{n:"Courier Prime",fam:"Courier Prime",w:700,i:0},bebas:{n:"Bebas Neue",fam:"Bebas Neue",w:400,i:0},
 fred:{n:"Fredoka",fam:"Fredoka",w:600,i:0},mont:{n:"Montserrat",fam:"Montserrat",w:700,i:0},
 lora:{n:"Lora",fam:"Lora",w:700,i:0},oswald:{n:"Oswald",fam:"Oswald",w:500,i:0},
 dmser:{n:"DM Serif",fam:"DM Serif Display",w:400,i:0},vibes:{n:"Great Vibes",fam:"Great Vibes",w:400,i:0},
 ital:{n:"Italiana",fam:"Italiana",w:400,i:0},pacif:{n:"Pacifico",fam:"Pacifico",w:400,i:0},
 fig:{n:"Figtree (Proxima style)",fam:"Figtree",w:600,i:0,hide:1},
 pinyon:{n:"Pinyon Script",fam:"Pinyon Script",w:400,i:0,hide:1},mea:{n:"Mea Culpa",fam:"Mea Culpa",w:400,i:0,hide:1},alex:{n:"Alex Brush",fam:"Alex Brush",w:400,i:0,hide:1},
 italianno:{n:"Italianno",fam:"Italianno",w:400,i:0,hide:1},allura:{n:"Allura",fam:"Allura",w:400,i:0,hide:1},
 pf7:{n:"Playfair bold",fam:"Playfair Display",w:700,i:0,hide:1},pfBI9:{n:"Playfair black italic",fam:"Playfair Display",w:900,i:1,hide:1},
 pop4:{n:"Poppins regular",fam:"Poppins",w:400,i:0,hide:1},mont4:{n:"Montserrat regular",fam:"Montserrat",w:400,i:0,hide:1},mont3:{n:"Montserrat light",fam:"Montserrat",w:300,i:0,hide:1},mont5:{n:"Montserrat medium",fam:"Montserrat",w:500,i:0,hide:1},
 osw3:{n:"Oswald light",fam:"Oswald",w:300,i:0,hide:1},osw4:{n:"Oswald regular",fam:"Oswald",w:400,i:0,hide:1},osw6:{n:"Oswald semibold",fam:"Oswald",w:600,i:0,hide:1},
 ari4:{n:"Arimo regular",fam:"Arimo",w:400,i:0,hide:1},ari7:{n:"Arimo bold",fam:"Arimo",w:700,i:0,hide:1},
 tin4:{n:"Tinos",fam:"Tinos",w:400,i:0,hide:1},tinBI:{n:"Tinos bold italic",fam:"Tinos",w:700,i:1,hide:1},ss6:{n:"Source Sans",fam:"Source Sans 3",w:600,i:0,hide:1},
 inst:{n:"Instrument Sans",fam:"Instrument Sans",w:600,i:0}};
const fontStr=(f,px)=>`${f.i?"italic ":""}${f.w} ${Math.max(6,px)}px "${f.fam}", sans-serif`;
const WALL=[
 ["Sans","Proxima style (Figtree)","Figtree",600],["Sans","Montserrat","Montserrat",700],["Sans","Poppins","Poppins",700],["Sans","Inter","Inter",600],["Sans","DM Sans","DM Sans",600],["Sans","Nunito Sans","Nunito Sans",600],["Sans","Mulish","Mulish",600],["Sans","Lato","Lato",700],["Sans","Open Sans","Open Sans",600],["Sans","Raleway","Raleway",600],["Sans","Work Sans","Work Sans",600],["Sans","Manrope","Manrope",600],["Sans","Plus Jakarta Sans","Plus Jakarta Sans",600],["Sans","Outfit","Outfit",600],["Sans","Urbanist","Urbanist",600],["Sans","Sora","Sora",600],["Sans","Space Grotesk","Space Grotesk",600],["Sans","Rubik","Rubik",500],["Sans","Barlow","Barlow",600],["Sans","Lexend","Lexend",500],
 ["Bold display","Anton","Anton",400],["Bold display","Bebas Neue","Bebas Neue",400],["Bold display","Oswald","Oswald",600],["Bold display","League Spartan","League Spartan",800],["Bold display","Archivo Black","Archivo Black",400],["Bold display","Fredoka","Fredoka",600],
 ["Serif","Playfair Display","Playfair Display",700],["Serif","Lora","Lora",700],["Serif","DM Serif Display","DM Serif Display",400],["Serif","Cormorant Garamond","Cormorant Garamond",700],["Serif","Libre Baskerville","Libre Baskerville",700],["Serif","Bodoni Moda","Bodoni Moda",700],["Serif","Cinzel","Cinzel",700],
 ["Script and handwritten","Great Vibes","Great Vibes",400],["Script and handwritten","Dancing Script","Dancing Script",700],["Script and handwritten","Pacifico","Pacifico",400],["Script and handwritten","Caveat","Caveat",700],["Script and handwritten","Sacramento","Sacramento",400],["Script and handwritten","Allura","Allura",400]];
WALL.forEach((w,i)=>{FONTS["w"+i]={n:w[1],fam:w[2],w:w[3],i:0,hide:1,grp:w[0]}});
async function loadFonts(){await Promise.all(Object.values(FONTS).map(f=>document.fonts.load(fontStr(f,40),"Abc").catch(()=>0)));}

/* ---------- text looks drawn on a 1080 wide canvas (preview and video use the same code) ---------- */
function star(c,x,y,r,fill){const q=r*.22;c.fillStyle=fill;c.beginPath();c.moveTo(x,y-r);c.lineTo(x+q,y-q);c.lineTo(x+r,y);c.lineTo(x+q,y+q);c.lineTo(x,y+r);c.lineTo(x-q,y+q);c.lineTo(x-r,y);c.lineTo(x-q,y-q);c.closePath();c.fill()}
const sh=(c,col,b,oy=2)=>{c.shadowColor=col;c.shadowBlur=b;c.shadowOffsetY=oy};
const nosh=c=>{c.shadowColor="transparent";c.shadowBlur=0;c.shadowOffsetY=0};
const KEEP=new Set([11,12,34,35,36,14,15,18,2,30]);
const KEEPFONT=new Set([28]);
const CP={34:{sz:76,w:600,col:"#f7d6e6",sh:0},35:{sz:54,w:700,col:"#fff1b0",sh:.15},36:{sz:47,w:500,col:"#ffffff",sh:.3},37:{sz:41,w:500,col:"#ffffff",sh:.3}};
function drawClean(c,p,L,ov,y,k){
  c.save();c.textBaseline="top";c.textAlign="center";c.lineJoin="round";
  const f=ov?FONTS[ov]:{fam:"Figtree",w:p.w,i:0},sz=p.sz*k,lh=sz*1.06;
  c.font=fontStr(f,sz);c.letterSpacing=(-.012*sz)+"px";c.fillStyle=p.col;
  if(p.sh)sh(c,"rgba(0,0,0,"+p.sh+")",8*k,1);
  L.forEach((l,i)=>c.fillText(l,540,y+i*lh));c.letterSpacing="0px";c.restore()}
function drawHook(c,id,L,ov,y,k,col){
  if(!L.length)return;
  if(CP[id]){drawClean(c,CP[id],L,ov,y,k);return}
  if(id>=13){drawTypeset(c,TSMAP[id],L,y,k,col||"white");return}
  c.save();c.textBaseline="top";c.textAlign="center";c.lineJoin="round";
  const F=(key,sz)=>fontStr(FONTS[ov||key],sz*k),n=L.length;
  switch(id){
  case 1:{const lh=82*k;L.forEach((l,i)=>{c.font=F(i==1&&!ov?"pfi":"pf",78);c.fillStyle="#fff";sh(c,"rgba(0,0,0,.35)",14*k);c.fillText(l,540,y+i*lh)});break}
  case 2:{const lh=72*k;c.font=F("pop",64);
    L.forEach((l,i)=>{const w=c.measureText(l).width;c.fillStyle="#ffe98a";c.fillRect(540-w/2-18*k,y+i*lh+2*k,w+36*k,lh)});
    L.forEach((l,i)=>{c.fillStyle="#d63878";c.fillText(l,540,y+i*lh+6*k)});break}
  case 3:{const lh=106*k;L.forEach((l,i)=>{c.font=F("anton",108);c.fillStyle=(i==n-1&&n>1)?"#ffe98a":"#fff";sh(c,"rgba(0,0,0,.4)",14*k,3);c.fillText(l.toUpperCase(),540,y+i*lh)});break}
  case 4:{const fs=78*k,R=1500;
    L.forEach((l,i)=>{const last=i==n-1&&n>1,sz=last?fs*.78:fs;c.font=fontStr(FONTS[ov||"frau"],sz);c.fillStyle=last?"#ffe98a":"#fff";sh(c,"rgba(0,0,0,.3)",8*k,2);
      const ws=[...l].map(ch=>c.measureText(ch).width),total=ws.reduce((a,b)=>a+b,0),cy=y+i*(fs+6*k)+R;let a=-total/R/2;
      [...l].forEach((ch,j)=>{const w=ws[j],am=a+w/R/2,px=540+R*Math.sin(am),py=cy-R*Math.cos(am);c.save();c.translate(px,py);c.rotate(am);c.fillText(ch,0,0);c.restore();a+=w/R})});break}
  case 5:{const lh=76*k;L.forEach((l,i)=>{c.font=F("spar",72);c.fillStyle="#fff3d6";sh(c,"rgba(0,0,0,.4)",12*k);c.fillText(l,540,y+i*lh)});nosh(c);
    const H=n*76,st=[[250,10,34,"#ffe98a"],[860,30,24,"#9fc4ff"],[215,H*.85,22,"#ffc6e0"],[880,H*.8,38,"#ffe98a"],[540,-12,18,"#9fc4ff"],[820,H+14,18,"#ffc6e0"]];
    st.forEach(([sx,sy,r,col])=>star(c,540+(sx-540)*k,y+sy*k,r*k,col));break}
  case 6:{const lh=54*k;L.forEach((l,i)=>{c.font=F("corm",46);c.fillStyle="#fff";sh(c,"rgba(0,0,0,.55)",14*k,1);c.fillText(l,540,y+i*lh)});break}
  case 7:{const lh=78*k;L.forEach((l,i)=>{c.font=F("caveat",84);c.fillStyle="#fff";sh(c,"rgba(0,0,0,.45)",12*k);c.fillText(l,540,y+i*lh)});nosh(c);
    c.save();c.translate(540-210*k,y+n*lh+2*k);c.scale(k,k);c.strokeStyle="#ff7aa8";c.lineWidth=7;c.lineCap="round";c.stroke(new Path2D("M6 16 C60 2 100 26 160 12 S270 4 320 16 S390 10 414 8"));c.restore();break}
  case 8:{const lh=62*k;c.font=F("cour",50);
    L.forEach((l,i)=>{const w=c.measureText(l).width;c.fillStyle="#fff";c.fillRect(540-w/2-18*k,y+i*lh,w+36*k,56*k)});
    L.forEach((l,i)=>{c.fillStyle="#111";c.fillText(l,540,y+i*lh+3*k)});break}
  case 9:{const lh=108*k;L.forEach((l,i)=>{c.font=F("bebas",116);c.fillStyle="#fff";
    [[ "#fff",10],["#ff4fd8",26],["#ff4fd8",54]].forEach(([col,b])=>{sh(c,col,b*k,0);c.fillText(l,540,y+i*lh)})});break}
  case 11:{const sz=72*k,lh=sz*1.06,cc=(COLORS[col]||COLORS.white)[1];c.font=F("fig",72);c.letterSpacing=(-.012*sz)+"px";sh(c,"rgba(0,0,0,.22)",8*k,1);L.forEach((l,i)=>{c.fillStyle=cc;c.fillText(l,540,y+i*lh)});c.letterSpacing="0px";break}
  case 12:{const sz=72*k,lh=sz*1.06;c.font=F("fig",72);c.letterSpacing=(-.012*sz)+"px";L.forEach((l,i)=>{c.lineWidth=Math.max(5,sz*.17);c.strokeStyle="#000";c.strokeText(l,540,y+i*lh);c.fillStyle="#fff";c.fillText(l,540,y+i*lh)});c.letterSpacing="0px";break}
  case 10:{const lh=78*k;L.forEach((l,i)=>{c.font=F("fred",74);c.lineWidth=16*k;c.strokeStyle="#161016";c.strokeText(l,540,y+i*lh);c.fillStyle="#fff";c.fillText(l,540,y+i*lh)});break}
  }
  c.restore();
}

/* ---------- typeset looks: one font throughout, or a combination ---------- */
const COLORS={white:["White","#fff",0],outline:["White, black outline","#fff",1],yellow:["Cream yellow","#fff1b0",0],pink:["Soft pink","#f7d6e6",0]};
const TS=[
 {id:13,g:"single",name:"Anton",kind:"single",a:"anton",sa:112,caps:1},
 {id:14,g:"single",name:"Playfair",kind:"single",a:"pf7",sa:84},
 {id:15,g:"single",name:"Poppins",kind:"single",a:"pop",sa:76},
 {id:16,g:"single",name:"Montserrat",kind:"single",a:"mont",sa:72,caps:1},
 {id:17,g:"single",name:"Oswald",kind:"single",a:"osw6",sa:100,caps:1},
 {id:18,g:"single",name:"Arimo (Helvetica style)",kind:"single",a:"ari7",sa:80,caps:1},
 {id:19,g:"combo",name:"Anton + Pinyon Script",kind:"combo",a:"anton",sa:118,caps:1,b:"pinyon",sb:135,tag:"script"},
 {id:20,g:"combo",name:"Playfair + Mea Culpa",kind:"combo",a:"pf7",sa:92,caps:1,b:"mea",sb:170,tag:"script"},
 {id:21,g:"combo",name:"Poppins + Alex Brush",kind:"combo",a:"pop",sa:76,caps:1,b:"alex",sb:140,tag:"script"},
 {id:22,g:"combo",name:"Montserrat + Great Vibes",kind:"combo",a:"mont",sa:76,caps:1,b:"vibes",sb:140,tag:"script"},
 {id:23,g:"combo",name:"Oswald + Italianno",kind:"combo",a:"osw6",sa:104,caps:1,b:"italianno",sb:150,tag:"script"},
 {id:24,g:"combo",name:"Arimo + Allura",kind:"combo",a:"ari7",sa:84,caps:1,b:"allura",sb:140,tag:"script"},
 {id:25,g:"combo",name:"Anton + Oswald",kind:"combo",a:"anton",sa:118,caps:1,b:"osw4",sb:84},
 {id:26,g:"combo",name:"Playfair bold + italic",kind:"combo",a:"pf7",sa:92,caps:1,b:"pfi",sb:84},
 {id:27,g:"combo",name:"Poppins bold + regular",kind:"combo",a:"pop",sa:76,caps:1,b:"pop4",sb:64},
 {id:28,g:"combo",name:"Montserrat bold + regular",kind:"combo",a:"mont",sa:76,caps:1,b:"mont4",sb:64},
 {id:29,g:"combo",name:"Oswald semibold + light",kind:"combo",a:"osw6",sa:104,caps:1,b:"osw3",sb:84},
 {id:30,g:"combo",name:"Arimo bold + regular",kind:"combo",a:"ari7",sa:84,caps:1,b:"ari4",sb:70},
 {id:31,g:"combo",name:"Montserrat light + bold",kind:"mix3",a:"mont3",sa:92,b:"mont",sb:104,c:"mont3",sc:60},
 {id:32,g:"combo",name:"The Seasons (serif italic)",kind:"seasons",a:"pf",sa:78,b:"pfBI9",sb:150,c:"mont5",sc:40},
 {id:33,g:"combo",name:"Times italic + Source Sans",kind:"seasons",a:"tin4",sa:92,b:"tinBI",sb:150,c:"ss6",sc:44}];
const TSMAP=Object.fromEntries(TS.map(x=>[x.id,x]));
function tsLine(c,txt,key,sz,y,k,colKey,track,w2){
  const col=COLORS[colKey]||COLORS.white;sz=sz*k;const tr=(track||0)*k;
  const meas=s=>{c.font=fontStr(FONTS[key],s);return [...txt].reduce((a,ch)=>a+c.measureText(ch).width,0)+tr*(txt.length-1)};
  const lim=(w2||960);while(meas(sz)>lim&&sz>16*k)sz-=3;
  c.font=fontStr(FONTS[key],sz);c.textAlign="left";c.lineJoin="round";
  let x=540-meas(sz)/2;
  if(col[2]){nosh(c)}else sh(c,"rgba(0,0,0,.3)",10*k,2);
  [...txt].forEach(ch=>{
    if(col[2]){c.lineWidth=Math.max(5,sz*.09);c.strokeStyle="#000";c.strokeText(ch,x,y)}
    c.fillStyle=col[1];c.fillText(ch,x,y);x+=c.measureText(ch).width+tr});
  nosh(c);return sz}
function drawTypeset(c,ts,L,y,k,colKey){
  c.save();c.textBaseline="top";const n=L.length,U=s=>ts.caps?s.toUpperCase():s;let cy=y;
  if(ts.kind=="single"){L.forEach(l=>{const s=tsLine(c,U(l),ts.a,ts.sa,cy,k,colKey);cy+=s*1.1})}
  else if(ts.kind=="combo"){
    L.forEach((l,i)=>{const last=i==n-1&&n>1;
      if(last){const s=tsLine(c,l,ts.b,ts.sb,cy-ts.sa*.04*k,k,colKey);cy+=s}
      else{const s=tsLine(c,U(l),ts.a,ts.sa,cy,k,colKey);cy+=s*1.1}})}
  else if(ts.kind=="mix3"){
    L.forEach((l,i)=>{const last=i==n-1&&n>1,first=i==0&&n>2;
      if(last){const s=tsLine(c,l,ts.c,ts.sc,cy+8*k,k,colKey);cy+=s}
      else if(first){const s=tsLine(c,l.toUpperCase(),ts.a,ts.sa,cy,k,colKey,6);cy+=s*1.2}
      else{const s=tsLine(c,l.toUpperCase(),ts.b,ts.sb,cy,k,colKey,2);cy+=s*1.15}})}
  else{ // seasons: small first line, big middle lines, spaced caps last line
    L.forEach((l,i)=>{const last=i==n-1&&n>1,first=i==0&&n>2;
      if(last){const s=tsLine(c,l.toUpperCase(),ts.c,ts.sc,cy+14*k,k,colKey,8);cy+=s+14*k}
      else if(first){const s=tsLine(c,l,ts.a,ts.sa,cy,k,colKey);cy+=s*1.05}
      else{const s=tsLine(c,l,ts.b,ts.sb,cy-8*k,k,colKey);cy+=s*.98}})}
  c.restore()}
const STYLES=[
 {id:11,name:"Clean caption",g:"clean"},{id:12,name:"Clean caption, outlined",g:"clean"},{id:34,name:"Large soft pink",g:"clean"},{id:35,name:"Medium cream, bold",g:"clean"},{id:36,name:"Small white",g:"clean"},{id:37,name:"Tiny white",g:"clean"},
 ...TS.map(x=>({id:x.id,name:x.name,g:x.g,tag:x.tag})),
 {id:1,name:"Stacked serif",g:"deco"},{id:2,name:"Highlight blocks",g:"deco"},{id:3,name:"Condensed caps",g:"deco"},{id:4,name:"Arched italic",g:"deco"},{id:5,name:"Sparkle sans",g:"deco"},
 {id:6,name:"Quiet quote",g:"deco"},{id:7,name:"Handwritten",g:"deco"},{id:8,name:"Typewriter label",g:"deco"},{id:9,name:"Neon glow",g:"deco"},{id:10,name:"Sticker bubble",g:"deco"}];
const GROUPS={clean:"Clean caption",single:"Single fonts",combo:"Combinations",deco:"Original decorative looks"};
const styleName=id=>STYLES.find(s=>s.id==id).name;
const STYLE_FONT={11:"fig",12:"fig",34:"fig",35:"fig",36:"fig",37:"fig",1:"pf",2:"pop",3:"anton",4:"frau",5:"spar",6:"corm",7:"caveat",8:"cour",9:"bebas",10:"fred"};
const defs=()=>S.dur=="whole"?{y:1100,size:85,styles:[11,12,11,12,11,12,11,12,11,12]}:{y:235,size:85,styles:[11,12,11,12,11,12,11,12,11,12]};

/* ---------- pools and random assignment ---------- */
const POS=[["Top clear zone",235],["Upper third",420],["Middle",860],["Lower third",1150],["Low",1300]];
const TR={
 speed:{t:"Speed",scope:"whole",vals:[.9,.95,1,1.05,1.1],lab:v=>v+"x",d:"Whole video, sound retimed with it."},
 bright:{t:"Brightness",scope:"whole",vals:[3,5,8],lab:v=>"+"+v+"%",d:"A small lift across the whole video."},
 zoom:{t:"Slow camera move: strength",scope:"open",vals:[1.15,1.2,1.25,1.3],lab:v=>v+"x",d:"How far the picture moves in the opening. Pick the style below. Every move settles back to full frame by about 4 seconds."},
 mot:{t:"Slow camera move: style",scope:"open",vals:["out","in","breathe","drift"],lab:v=>MOTL[v],d:"Zoom out starts tight. Zoom in pushes closer. Breathe pushes in then back. Drift pans sideways."},
 cut:{t:"Cut the very beginning",scope:"open",vals:[.3,.5,.8],lab:v=>v+"s",d:"Trims a moment off the start."}};
const MOTL={out:"Slow zoom out",in:"Slow zoom in",breathe:"Breathe in and out",drift:"Slow drift"};
const NOTYET=["Change the song","New start clip","B-roll","Overlay","Sticker"];
const P={pos:new Set(),fonts:new Set(),speed:new Set([.95,1.05,1.1]),bright:new Set([3,5]),zoom:new Set([1.2,1.3]),mot:new Set(["out","in"]),cut:new Set(),mirror:"mix"};
P.colors=new Set(["white","outline"]);P.groups=new Set(["clean"]);
const LSK="hookstudio.v2";
function saveP(){try{const o={mirror:P.mirror};["fonts","speed","bright","zoom","mot","cut"].forEach(k=>o[k]=[...P[k]]);o.colors=[...P.colors];o.groups=[...P.groups];o.kinds=S.kinds;o.tones=S.tones;o.anim=S.anim;o.dur=S.dur;localStorage.setItem(LSK,JSON.stringify(o))}catch(e){}}
function loadP(){try{const o=JSON.parse(localStorage.getItem(LSK)||"null");if(!o)return;["fonts","speed","bright","zoom","mot","cut"].forEach(k=>{if(Array.isArray(o[k]))P[k]=new Set(o[k])});if(o.mirror)P.mirror=o.mirror;if(Array.isArray(o.colors)&&o.colors.length)P.colors=new Set(o.colors);if(Array.isArray(o.groups)&&o.groups.length)P.groups=new Set(o.groups)}catch(e){}}
loadP();
S.cfg=[];
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function shuf(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function spread(pool,n,dflt){const p=[...pool];if(!p.length)return Array(n).fill(dflt);let o=[];while(o.length<n)o=o.concat(shuf(p));return o.slice(0,n)}
function assign(keepStyles=true){saveP();
  const n=S.picked.length,d=defs();if(!P.pos.size)P.pos.add(d.y);
  let best=null;
  const cats=["speed","bright","zoom","cut"].filter(k=>P[k].size);if(P.mirror=="mix")cats.push("mirror");
  for(let tries=0;tries<300;tries++){
    // each version gets its own random subset of the ticked tricks, never all of them
    const maxK=Math.max(1,Math.min(cats.length-(cats.length>2?1:0),3)),off=Math.floor(Math.random()*Math.max(1,cats.length));
    const on=Array.from({length:n},(_,i)=>{const s=new Set();if(!cats.length)return s;
      s.add(cats[(off+i)%cats.length]);const k=1+Math.floor(Math.random()*maxK);
      shuf(cats).forEach(c=>{if(s.size<k)s.add(c)});return s});
    const sp=spread(P.speed,n,1),br=spread(P.bright,n,0),zm=spread(P.zoom,n,1),mt=spread(P.mot,n,"out"),ct=spread(P.cut,n,0),ps=spread(P.pos,n,d.y),fn=spread(P.fonts,n,null),cl=spread(P.colors,n,"white");
    const mr=Array.from({length:n},(_,i)=>P.mirror=="all"||on[i].has("mirror"));
    const an=Array.from({length:n},(_,i)=>S.anim=="yes"?true:S.anim=="mix"?i%2==1:false);
    const arr=Array.from({length:n},(_,i)=>({style:(S.cfg[i]&&keepStyles?S.cfg[i].style:null)||d.styles[i%d.styles.length],font:fn[i],color:cl[i],y:ps[i],size:S.size,speed:on[i].has("speed")?sp[i]:1,bright:on[i].has("bright")?br[i]:0,mirror:mr[i],zoom:on[i].has("zoom")?zm[i]:1,mot:mt[i],cut:on[i].has("cut")?ct[i]:0,anim:an[i],fx:+(.35+Math.random()*.3).toFixed(2),fy:+(.12+Math.random()*.2).toFixed(2)}));
    const keys=new Set(arr.map(a=>[a.font,a.color,a.y,a.speed,a.bright,a.mirror,a.zoom,a.mot,a.cut].join("|")));
    best=arr;if(keys.size==n)break;
  }
  S.cfg=shuffAnim(best);
  assignOpens();
}

/* ---------- clips: find the cuts, then open each version on a different clip ---------- */
let clipsBusy=false;
async function analyzeClips(){
  if(!S.videoURL||clipsBusy)return;clipsBusy=true;
  const st=$("#clipstat"),say=t=>{if(st)st.textContent=t};
  const av=document.createElement("video");av.muted=true;av.playsInline=true;av.preload="auto";av.src=S.videoURL;
  try{
    say("Finding the clips in your video…");
    await once(av,"loadeddata");
    const W=48,H=85,cv=document.createElement("canvas");cv.width=W;cv.height=H;const cx=cv.getContext("2d",{willReadFrequently:true});
    const dur=av.duration,sm=[];let prev=null;
    const grab=t=>{cx.drawImage(av,0,0,W,H);const d=cx.getImageData(0,0,W,H).data,g=new Uint8Array(W*H);let sum=0;
      for(let i=0,j=0;i<d.length;i+=4,j++){const l=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)|0;g[j]=l;sum+=l}
      let df=0;if(prev){for(let j=0;j<g.length;j++)df+=Math.abs(g[j]-prev[j]);df/=g.length*255}
      sm.push({t,d:df,l:sum/g.length/255});prev=g};
    if(av.requestVideoFrameCallback){
      av.playbackRate=5;
      await new Promise(res=>{let fin=false;const end=()=>{if(!fin){fin=true;res()}};
        const cb=(now,m)=>{grab(m.mediaTime);say("Finding the clips in your video… "+Math.min(99,Math.round(m.mediaTime/dur*100))+"%");if(av.ended)end();else av.requestVideoFrameCallback(cb)};
        av.addEventListener("ended",end,{once:true});av.requestVideoFrameCallback(cb);av.play().catch(end);
        setTimeout(end,Math.max(15000,dur*1000))});
    }else{for(let t=0;t<dur;t+=.1){av.currentTime=t;await once(av,"seeked");grab(t)}}
    const cuts=[0];
    for(let i=2;i<sm.length;i++){const s2=sm[i],win=sm.slice(Math.max(1,i-6),i).map(x=>x.d),avg=win.reduce((a,b)=>a+b,0)/Math.max(1,win.length);
      if(s2.d>.13&&s2.d>avg*3&&s2.t-cuts[cuts.length-1]>=.5)cuts.push(s2.t)}
    S.clips=cuts.map((t0,i)=>{const t1=i+1<cuts.length?cuts[i+1]:dur,xs=sm.filter(x=>x.t>=t0&&x.t<t1);
      return {t0:+t0.toFixed(2),t1:+t1.toFixed(2),lum:+(xs.length?xs.reduce((a,b)=>a+b.l,0)/xs.length:.4).toFixed(3)}});
  }catch(e){S.clips=null;say("Couldn't read the clips from this video. Versions will open on the original first clip.")}
  finally{try{av.pause();av.removeAttribute("src");av.load()}catch(e){}clipsBusy=false}
  assignOpens();if(S.step==3)render3();
}
function assignOpens(){
  const n=S.cfg.length;
  if(!n)return;
  if(S.order!="shuffle"||!S.clips||S.clips.length<2){S.cfg.forEach(c=>c.open=null);return}
  const first=S.clips[0],fl=first.t1-first.t0;
  let pool=S.clips.map((c,i)=>({...c,i})).filter(c=>c.i>0&&c.t1-c.t0>=.7);
  if(!pool.length)pool=S.clips.map((c,i)=>({...c,i})).filter(c=>c.i>0);
  pool.sort((a,b)=>b.lum-a.lum);
  const cand=shuf(pool.slice(0,Math.max(n,Math.ceil(pool.length*.6))));
  S.cfg.forEach((c,i)=>{const k=cand[i%cand.length],lap=Math.floor(i/cand.length);
    const t0=Math.min(k.t0+lap*.4,Math.max(k.t0,k.t1-.7)),rem=k.t1-t0-.12,len=Math.max(.4,Math.min(Math.max(fl,.6),2,rem));
    c.open={clip:k.i,t0:+t0.toFixed(2),len:+len.toFixed(2)}});
}
function clipNote(){
  if(S.order!="shuffle")return S.order=="ordered"?"Clips stay in the order you filmed them.":"";
  if(clipsBusy)return "Finding the clips in your video…";
  if(!S.videoURL)return "Add your video in step 1 and I will find the clips so each version can open on a different one.";
  if(!S.clips)return "";
  if(S.clips.length<2)return "This looks like one continuous shot, so there is no other clip to open on.";
  return `Found ${S.clips.length} clips. Each version opens on a different one, picked from the brighter clips. The rest of the video stays as filmed.`;
}
function shuffAnim(a){return a}

/* ---------- step 3 UI ---------- */
function chipSet(box,items,set,onChange){
  box.innerHTML="";
  items.forEach(([label,val])=>{const b=document.createElement("button");b.className="chip";b.textContent=label;b.setAttribute("aria-pressed",set.has(val));
    b.addEventListener("click",()=>{set.has(val)?set.delete(val):set.add(val);b.setAttribute("aria-pressed",set.has(val));onChange()});box.appendChild(b)});
}
let s3built=false;
function setup3(){
  const d=defs();
  if(!s3built||S.s3dur!==S.dur){S.size=d.size;P.pos=new Set([d.y]);S.s3dur=S.dur;S.cfg=[];$("#size").value=S.size}
  if(S.cfg.length!==S.picked.length)assign(true);
  if(S.cur>=S.picked.length)S.cur=0;
  const vt=$("#vtabs");vt.innerHTML="";
  S.picked.forEach((id,i)=>{const c=document.createElement("button");c.className="chip";c.setAttribute("role","tab");c.textContent="Version "+(i+1);c.dataset.i=i;
    c.addEventListener("click",()=>{S.cur=i;render3()});vt.appendChild(c)});
  const box=$("#cards");box.innerHTML="";
  let lastG="";
  STYLES.filter(st=>S.moreLooks||KEEP.has(st.id)).forEach(st=>{if(st.g!==lastG){lastG=st.g;const h=document.createElement("div");h.className="grp";h.textContent=GROUPS[st.g];box.appendChild(h)}
    const b=document.createElement("button");b.className="sty";b.dataset.id=st.id;
    b.innerHTML=`<canvas width="540" height="260" style="width:100%;display:block"></canvas><div class="cap"><span>L${STYLES.indexOf(st)+1} · ${st.name}${st.tag?" · script":""}</span></div>`;
    b.addEventListener("click",()=>{S.cfg[S.cur].style=st.id;render3()});box.appendChild(b)});
  chipSet($("#colors"),Object.entries(COLORS).map(([k,v])=>[v[0],k]),P.colors,()=>{if(!P.colors.size)P.colors.add("white");assign(true);render3()});
  
  buildWall();
  chipSet($("#pos"),POS.map(([n,y])=>[n+" ("+y+")",y]),P.pos,()=>{if(!P.pos.size)P.pos.add(d.y);assign(true);render3()});
  const tb=$("#tricks");tb.innerHTML="";
  Object.entries(TR).forEach(([k,o])=>{const w=document.createElement("div");w.className="trick";
    w.innerHTML=`<header><strong>${o.t}</strong><span class="tag ${o.scope}">${o.scope=="whole"?"whole video":"opening only"}</span></header><small>${o.d}</small><div class="chips" id="tr_${k}"></div>`;tb.appendChild(w);
    chipSet(w.querySelector(".chips"),o.vals.map(v=>[o.lab(v),v]),P[k],()=>{assign(true);render3()})});
  const m=document.createElement("div");m.className="trick";
  m.innerHTML=`<header><strong>Mirror video</strong><span class="tag whole">whole video</span></header><small>Flips the picture. The text stays readable.</small><div class="chips" id="tr_mirror"></div>`;tb.appendChild(m);
  [["Off","off"],["Some versions","mix"],["Every version","all"]].forEach(([l,v])=>{const b=document.createElement("button");b.className="chip";b.textContent=l;b.dataset.v=v;b.setAttribute("aria-pressed",P.mirror==v);
    b.addEventListener("click",()=>{P.mirror=v;m.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v==v));assign(true);render3()});m.querySelector(".chips").appendChild(b)});
  const nt=document.createElement("div");nt.className="trick off";nt.innerHTML=`<header><strong>Not in the app yet</strong></header><small>${NOTYET.join(", ")}. Coming soon.</small>`;tb.appendChild(nt);
  s3built=true;
  if(S.order=="shuffle"&&S.videoURL&&!S.clips&&!clipsBusy)analyzeClips().then(()=>render3());
  else if(S.cfg.some(c=>c.open===undefined))assignOpens();
}
function wallSample(){const h=S.hooks.find(x=>x.id==S.picked[S.cur]);const L=h?lns(h.text):[];return (L[0]||"should have some type").slice(0,26)}
function buildWall(){
  const box=$("#fonts");box.innerHTML="";let last="";
  WALL.forEach((w,i)=>{const key="w"+i,f=FONTS[key];if(!(S.moreFonts||KEEPFONT.has(i)))return;
    if(f.grp!==last){last=f.grp;const h=document.createElement("div");h.className="grp";h.textContent=f.grp;box.appendChild(h);const g=document.createElement("div");g.className="wall";g.dataset.g=f.grp;box.appendChild(g)}
    const b=document.createElement("button");b.className="wf";b.setAttribute("aria-pressed",P.fonts.has(key));
    b.innerHTML=`<span class="ws" style="font-family:'${f.fam}',sans-serif;font-weight:${f.w}">${esc(wallSample())}</span><small>F${i+1} · ${esc(f.n)}</small>`;
    b.addEventListener("click",()=>{P.fonts.has(key)?P.fonts.delete(key):P.fonts.add(key);b.setAttribute("aria-pressed",P.fonts.has(key));wallCount();assign(true);render3()});
    box.querySelector(`.wall[data-g="${f.grp}"]`).appendChild(b)});
  wallCount()}
function wallCount(){$("#fontcount").textContent=P.fonts.size?P.fonts.size+" picked":"None picked, using the Proxima style default"}
$("#moreFonts").addEventListener("click",()=>{S.moreFonts=!S.moreFonts;buildWall()});
$("#clearFonts").addEventListener("click",()=>{P.fonts.clear();buildWall();assign(true);render3()});
function resolved(i){const c=S.cfg[i],h=S.hooks.find(x=>x.id==S.picked[i]);return {c,L:h?lns(h.text):[]}}
function fmtBright(b){return b?"+"+b+"%":"none"}
function render3(){
  if(S.step!==3||!S.cfg.length)return;
  document.querySelectorAll("#vtabs .chip").forEach(c=>c.setAttribute("aria-pressed",+c.dataset.i==S.cur));
  const {c,L}=resolved(S.cur);
  document.querySelectorAll("#cards .sty").forEach(b=>{b.setAttribute("aria-pressed",+b.dataset.id==c.style);
    const cv=b.querySelector("canvas"),x=cv.getContext("2d");x.clearRect(0,0,540,260);
    x.save();x.translate(-27,0);x.scale(.55,.55);x.drawImage(bgFrame(1080,480,235),0,0);drawHook(x,+b.dataset.id,L.length?L:["your hook here"],c.font,40,Math.min(S.size/100,1),c.color);x.restore()});
  $("#sout").textContent=S.size+"%";
  $("#durnote").textContent=S.dur=="whole"?"The text stays on screen for the whole video.":"The text is on screen from the first frame and leaves after about 3 seconds. It never fades in.";
  $("#plan").innerHTML=`<thead><tr><th>#</th><th>Look</th><th>Colour</th><th>Font</th><th>Height</th><th>Speed</th><th>Bright</th><th>Mirror</th><th>Zoom</th><th>Cut</th><th>Opens on</th></tr></thead><tbody>`+
   S.cfg.map((v,i)=>`<tr data-i="${i}" ${i==S.cur?'class="cur"':""}><td>${i+1}</td><td>${styleName(v.style)}</td><td>${v.style>=13||v.style==11||v.style==12?(v.style>=13?COLORS[v.color||"white"][0]:(v.style==12?"White, black outline":"White")):"own"}</td><td>${v.style>=13?"in the look":FONTS[v.font||STYLE_FONT[v.style]].n}</td><td>${v.y}</td><td>${v.speed}x</td><td>${fmtBright(v.bright)}</td><td>${v.mirror?"yes":"no"}</td><td>${v.zoom>1?(MOTL[v.mot||"out"]||"Slow zoom out")+" "+v.zoom+"x":"none"}</td><td>${v.cut?v.cut+"s":"none"}</td><td>${v.open?"clip "+(v.open.clip+1)+" ("+v.open.t0+"s)":"first clip"}</td></tr>`).join("")+"</tbody>";
  document.querySelectorAll("#plan tbody tr").forEach(r=>r.addEventListener("click",()=>{S.cur=+r.dataset.i;render3()}));
  $("#clipstat").textContent=clipNote();
  $("#makeAll").disabled=!S.videoURL||!S.picked.length;
  $("#mkstat").textContent=S.videoURL?"":"Add your video in step 1 first.";
  drawPreview();drawResults();buildRevChips();
}
function bgFrame(w,h,srcY){ // a w x h slice of the preview frame for the look cards
  const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");
  const full=frameCanvas();x.drawImage(full,0,srcY,1080,h,0,0,w,h);return c}
let _fc=null,_fcKey="";
function frameCanvas(){ // 1080x1920 still of the current video frame (or a gradient)
  const key=(S.videoURL||"")+":"+(vid.currentTime||0).toFixed(2);if(_fc&&_fcKey==key)return _fc;
  const c=document.createElement("canvas");c.width=1080;c.height=1920;const x=c.getContext("2d");
  if(vid.readyState>=2&&vid.videoWidth){coverDraw(x,vid,1,.5,.2)}
  else{const g=x.createLinearGradient(0,0,300,1920);g.addColorStop(0,"#3b2a55");g.addColorStop(.55,"#a14f6e");g.addColorStop(1,"#e9a97a");x.fillStyle=g;x.fillRect(0,0,1080,1920)}
  _fc=c;_fcKey=key;return c}
function coverDraw(x,v,z,fx,fy){
  const vw=v.videoWidth,vh=v.videoHeight,sw=Math.min(vw,vh*9/16),sh2=sw*16/9,bx=(vw-sw)/2,by=(vh-sh2)/2;
  const cw=sw/z,ch=sh2/z,sx=bx+fx*(sw-cw),sy=by+fy*(sh2-ch);
  x.drawImage(v,sx,sy,cw,ch,0,0,1080,1920)}
function layerFor(i){ // transparent 1080x1920 text layer for version i
  const {c,L}=resolved(i),cv=document.createElement("canvas");cv.width=1080;cv.height=1920;const x=cv.getContext("2d");
  if(c.y<700){const g=x.createLinearGradient(0,0,0,720);g.addColorStop(0,"rgba(0,0,0,.49)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.fillRect(0,0,1080,720)}
  drawHook(x,c.style,L.length?L:["your hook here"],c.font,c.y,(c.sz||S.size)/100,c.color);return cv}
const sm01=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t)};
function motion(c,el){ // slow camera move over the opening; every style is back at full frame by 4.2s
  const a=(c.zoom||1)-1;let z=1,fx=c.fx;if(a<=0)return {z,fx};
  const m=c.mot||"out";
  if(m=="out")z=1+a*(1-sm01(el/3));
  else if(m=="in")z=1+a*(el<3?sm01(el/3):1-sm01((el-3)/1.2));
  else if(m=="breathe")z=1+a*Math.sin(Math.PI*Math.min(1,Math.max(0,el/3.6)));
  else{z=1+a*(1-sm01((el-2.4)/1.2));const dir=c.fx>.5?-1:1;fx=Math.min(1,Math.max(0,c.fx+dir*.35*(sm01(el/3)-.5)))}
  return {z,fx}}
function composeFrame(x,v,c,layer,el,haveVideo){
  x.save();x.clearRect(0,0,1080,1920);
  const mv=motion(c,el),z=mv.z;
  if(c.mirror){x.translate(1080,0);x.scale(-1,1)}
  if(c.bright)x.filter=`brightness(${1+c.bright/100})`;
  if(haveVideo)coverDraw(x,v,z,mv.fx,c.fy);else{const g=x.createLinearGradient(0,0,300,1920);g.addColorStop(0,"#3b2a55");g.addColorStop(.55,"#a14f6e");g.addColorStop(1,"#e9a97a");x.fillStyle=g;x.fillRect(0,0,1080,1920)}
  x.restore();x.filter="none";
  let a=1,dy=0,sc=1;
  if(S.dur=="open"){if(el>2.6){const u=Math.min(1,(el-2.6)/.4);a=1-u;if(c.anim)dy=-30*u}}
  else if(c.anim)sc=1+.015*Math.sin(el*2.2);
  if(a>0){x.save();x.globalAlpha=a;x.translate(540,c.y+90);x.scale(sc,sc);x.translate(-540,-(c.y+90)+dy);x.drawImage(layer,0,0);x.restore()}
}
function safeOverlay(x){x.save();x.fillStyle="rgba(255,60,90,.22)";x.fillRect(0,0,1080,220);x.fillRect(0,1500,1080,420);x.fillRect(960,1000,120,500);
  x.strokeStyle="rgba(255,80,110,.9)";x.lineWidth=3;x.setLineDash([14,10]);[220,1500].forEach(y=>{x.beginPath();x.moveTo(0,y);x.lineTo(1080,y);x.stroke()});x.restore()}
function drawPreview(){
  if(S.step!==3||!S.cfg.length)return;
  const x=$("#pv").getContext("2d"),c=S.cfg[S.cur],ok=vid.readyState>=2&&vid.videoWidth>0;
  composeFrame(x,vid,c,layerFor(S.cur),0,ok);
  if(S.safe)safeOverlay(x);
  $("#stat").textContent=`Version ${S.cur+1}: ${styleName(c.style)}, ${c.speed}x, ${c.mirror?"mirrored, ":""}${fmtBright(c.bright)} brightness. Pink bands are covered by Instagram.`;
}
$("#size").addEventListener("input",e=>{S.size=+e.target.value;S.cfg.forEach(c=>c.sz=0);render3()});
$("#safe").addEventListener("change",e=>{S.safe=e.target.checked;render3()});
$("#shuffleAll").addEventListener("click",()=>{assign(true);$("#shufstat").textContent="Shuffled.";render3()});
$("#moreLooks").addEventListener("click",()=>{S.moreLooks=!S.moreLooks;setup3();render3()});
$("#shuffleLooks").addEventListener("click",()=>{const ids=STYLES.filter(s=>S.moreLooks||KEEP.has(s.id)).map(s=>s.id),pool=shuf(ids.length?ids:[11,12]);S.cfg.forEach((c,i)=>c.style=pool[i%pool.length]);render3()});
vid.addEventListener("seeked",()=>{_fc=null;render3()});
if(document.fonts)document.fonts.addEventListener&&document.fonts.addEventListener("loadingdone",()=>{_fc=null;render3()});

/* ---------- make the videos in the browser ---------- */
const MIMES=["video/mp4;codecs=avc1.640028,mp4a.40.2","video/mp4;codecs=avc1,mp4a.40.2","video/mp4","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
const pickMime=()=>MIMES.find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m))||"";
const R={};let stopFlag=false,making=false,dl=null;
const once=(el,ev)=>new Promise(r=>el.addEventListener(ev,r,{once:true}));
function fileName(i){const c=S.cfg[i],base=(S.fileName||"video").replace(/\.[^.]+$/,"").replace(/[^\w-]+/g,"_");
  return `${base}_v${i+1}_${styleName(c.style).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,"")}_${c.speed}x`}
async function makeOne(i){
  const mime=pickMime();if(!mime){R[i]={status:"error",msg:"This browser can't record video here. Try Chrome on a computer."};drawResults();return}
  const c=S.cfg[i],layer=layerFor(i);R[i]={status:"working",pct:0};drawResults();
  const cv=document.createElement("canvas");cv.width=1080;cv.height=1920;const x=cv.getContext("2d");
  const v=document.createElement("video");v.src=S.videoURL;v.playsInline=true;v.preload="auto";
  let ac=null,v2=null;
  try{
    await once(v,"loadeddata");
    if(c.open){v2=document.createElement("video");v2.src=S.videoURL;v2.muted=true;v2.playsInline=true;v2.preload="auto";await once(v2,"loadeddata")}
    const src=el=>{if(v2&&el>=c.open.len&&!v2.paused)v2.pause();return v2&&el<c.open.len?v2:v};
    const stream=cv.captureStream(30);
    try{ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();const src=ac.createMediaElementSource(v),dst=ac.createMediaStreamDestination();src.connect(dst);dst.stream.getAudioTracks().forEach(t=>stream.addTrack(t))}catch(e){}
    const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:9e6,audioBitsPerSecond:160000}),chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    const stopped=new Promise(r=>rec.onstop=r);
    if(v2){v2.playbackRate=c.speed;v2.currentTime=c.open.t0;await once(v2,"seeked")}
    v.playbackRate=c.speed;v.currentTime=c.cut||0;await once(v,"seeked");
    composeFrame(x,src(0),c,layer,0,true);rec.start(250);
    const ended=new Promise(r=>v.addEventListener("ended",r,{once:true}));
    await Promise.all([v.play(),v2?v2.play():0]);
    const dur=v.duration-(c.cut||0);
    await new Promise(res=>{const tick=()=>{if(stopFlag||v.ended){res();return}
      const el=v.currentTime-(c.cut||0);composeFrame(x,src(el),c,layer,el,true);R[i].pct=Math.min(99,Math.round(el/dur*100));drawResults(true);requestAnimationFrame(tick)};tick()});
    composeFrame(x,v,c,layer,dur,true);
    await new Promise(r=>setTimeout(r,250));rec.stop();await stopped;
    if(stopFlag){R[i]={status:"stopped"};return}
    const blob=new Blob(chunks,{type:mime.split(";")[0]});
    R[i]={status:"done",blob,url:URL.createObjectURL(blob),name:fileName(i)+(mime.startsWith("video/mp4")?".mp4":".webm"),mp4:mime.startsWith("video/mp4"),size:blob.size};
    idbSet("r"+i,{blob:R[i].blob,name:R[i].name,mp4:R[i].mp4,size:R[i].size});
  }catch(e){R[i]={status:"error",msg:"That version didn't record. Press Make again."}}
  finally{v.pause();if(v2)v2.pause();if(ac)ac.close().catch(()=>0)}
}
async function makeAll(only){
  if(making)return;making=true;stopFlag=false;$("#makeAll").disabled=true;$("#stopMake").hidden=false;
  const idx=Array.isArray(only)?only:only!=null?[only]:S.picked.map((_,i)=>i);
  for(const i of idx){if(stopFlag)break;$("#mkstat").textContent=`Recording version ${i+1}… You can set up captions in the next step while this runs.`;await makeOne(i);drawResults()}
  making=false;$("#stopMake").hidden=true;$("#makeAll").disabled=false;
  $("#mkstat").textContent=stopFlag?"Stopped.":"All done. Save each video below, then set up your captions.";drawResults();
}
function drawResults(light){
  const box=$("#results");if(!box)return;
  if(light){S.picked.forEach((_,i)=>{const b=box.querySelector(`[data-p="${i}"]`);if(b&&R[i])b.style.width=(R[i].pct||0)+"%"});return}
  box.innerHTML="";if($("#saveAll"))$("#saveAll").disabled=!S.picked.some((_,i)=>R[i]&&R[i].status=="done");
  S.picked.forEach((_,i)=>{const r=R[i]||{status:"idle"},row=document.createElement("div");row.className="rrow";
    let mid="";
    if(r.status=="working")mid=`<div class="bar"><i data-p="${i}" style="width:${r.pct||0}%"></i></div>`;
    else if(r.status=="done")mid=`<video src="${r.url}" controls playsinline muted style="width:110px;border-radius:8px"></video><span class="note" style="margin:0">${(r.size/1048576).toFixed(1)} MB${r.mp4?"":" · WebM, not MP4"}</span><button class="btn" data-save="${i}">Save</button>`;
    else if(r.status=="error")mid=`<span class="err">${r.msg}</span>`;
    else if(r.status=="stopped")mid=`<span class="note" style="margin:0">Stopped</span>`;
    row.innerHTML=`<strong>Version ${i+1}</strong><span class="note" style="margin:0">${styleName(S.cfg[i].style)}, ${S.cfg[i].speed}x</span>${mid}<button class="btn ghost" data-make="${i}" ${making?"disabled":""}>${r.status=="done"?"Make again":"Make this one"}</button>`;
    box.appendChild(row)});
  box.querySelectorAll("[data-make]").forEach(b=>b.addEventListener("click",()=>{if(S.videoURL)makeAll(+b.dataset.make);else $("#mkstat").textContent="Add your video in step 1 first."}));
  box.querySelectorAll("[data-save]").forEach(b=>b.addEventListener("click",async()=>{const i=+b.dataset.save,r=R[i];
    try{if(!dl&&typeof claude!=="undefined")dl=await claude.use("downloads");
      if(dl)await dl.save({filename:r.name,data:r.blob});
      else{const a=document.createElement("a");a.href=r.url;a.download=r.name;document.body.appendChild(a);a.click();a.remove()}
      $("#mkstat").textContent="Saved "+r.name}
    catch(e){$("#mkstat").textContent=e&&e.code=="declined"?"Not saved.":e&&e.code=="rate_limited"?"Another save is open or too many just now. Wait a few seconds, then press Save again.":"Couldn't save that one. Try again."}}));
}
$("#makeAll").addEventListener("click",()=>makeAll());
const CRC=(()=>{const T=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0}return T})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
async function makeZip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=n=>new Uint8Array([n&255,n>>8&255]),u32=n=>new Uint8Array([n&255,n>>8&255,n>>16&255,n>>24&255]);
  for(const f of files){const d=new Uint8Array(await f.blob.arrayBuffer()),nm=enc.encode(f.name),c=crc32(d);
    const lh=[u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(d.length),u32(d.length),u16(nm.length),u16(0),nm];
    parts.push(...lh,d);
    cen.push([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(d.length),u32(d.length),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nm]);
    off+=30+nm.length+d.length}
  const cs=off;let cl=0;cen.forEach(r=>{parts.push(...r);cl+=r.reduce((a,x)=>a+x.length,0)});
  parts.push(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cl),u32(cs),u16(0));
  return new Blob(parts,{type:"application/zip"})}
$("#saveAll").addEventListener("click",async()=>{
  const done=S.picked.map((_,i)=>R[i]).filter(r=>r&&r.status=="done");if(!done.length)return;
  $("#mkstat").textContent="Packing "+done.length+" videos into one file…";
  try{const zip=await makeZip(done.map(r=>({name:r.name,blob:r.blob}))),nm=((S.fileName||"video").replace(/\.[^.]+$/,"").replace(/[^\w-]+/g,"_"))+"_all_versions.zip";
    if(!dl&&typeof claude!=="undefined")dl=await claude.use("downloads");
    if(dl)await dl.save({filename:nm,data:zip});
    else{const a=document.createElement("a");a.href=URL.createObjectURL(zip);a.download=nm;document.body.appendChild(a);a.click();a.remove()}
    $("#mkstat").textContent="Saved "+nm+". Unzip it to get every video."}
  catch(e){$("#mkstat").textContent=e&&e.code=="declined"?"Not saved.":e&&e.code=="rate_limited"?"A save is already open or too many just now. Wait a few seconds and press again.":"Couldn't save the zip. Try Save on each video instead."}});
$("#stopMake").addEventListener("click",()=>{stopFlag=true});

/* ---------- revisions ---------- */
function buildRevChips(){
  const box=$("#revv");if(!box)return;box.innerHTML="";const sel=new Set(S.revsel||[]);
  const mk=(label,pressed,fn)=>{const b=document.createElement("button");b.className="chip";b.textContent=label;b.setAttribute("aria-pressed",pressed);b.addEventListener("click",fn);box.appendChild(b)};
  mk("All versions",!sel.size,()=>{S.revsel=[];buildRevChips()});
  S.picked.forEach((_,i)=>mk("Version "+(i+1),sel.has(i),()=>{sel.has(i)?sel.delete(i):sel.add(i);S.revsel=[...sel].sort();buildRevChips()}));
  const lg=$("#revlog");if(lg)lg.innerHTML=(S.revlog||[]).slice(0,6).map(t=>"<div>"+esc(t)+"</div>").join("");
  if($("#rev")&&document.activeElement!==$("#rev")&&$("#rev").value!==(S.revtext||""))$("#rev").value=S.revtext||"";
}
$("#rev").addEventListener("input",e=>S.revtext=e.target.value);
function pickOpen(i){
  if(!S.clips||S.clips.length<2)return null;
  const cur=S.cfg[i].open?S.cfg[i].open.clip:-1,used=new Set(S.cfg.map((c,j)=>j!=i&&c.open?c.open.clip:-1));
  let pool=S.clips.map((c,k)=>({...c,k})).filter(c=>c.k>0&&c.t1-c.t0>=.7);if(!pool.length)pool=S.clips.map((c,k)=>({...c,k})).filter(c=>c.k>0);
  let c2=pool.filter(c=>c.k!=cur&&!used.has(c.k));if(!c2.length)c2=pool.filter(c=>c.k!=cur);if(!c2.length)c2=pool;
  c2.sort((a,b)=>b.lum-a.lum);const k=rnd(c2.slice(0,Math.max(1,Math.ceil(c2.length*.6)))),fl=S.clips[0].t1-S.clips[0].t0;
  const len=Math.max(.4,Math.min(Math.max(fl,.6),2,k.t1-k.t0-.12));return {clip:k.k,t0:k.t0,len:+len.toFixed(2)}}
function revPrompt(text,scope){
  const rows=S.cfg.map((c,i)=>`v${i+1}: look L${STYLES.findIndex(x=>x.id==c.style)+1}, font ${/^w\d+$/.test(c.font||"")?"F"+(+c.font.slice(1)+1):"the look's own"}, colour ${c.color||"white"}, text height y=${c.y}, text size ${c.sz||S.size}%, speed ${c.speed}, brightness ${c.bright}, mirror ${!!c.mirror}, zoom ${c.zoom} (${c.mot||"out"}), cut ${c.cut}, animated ${!!c.anim}, opens on ${c.open?"clip "+(c.open.clip+1):"the original first clip"}, hook "${hookOf(i)}"`).join("\n");
  const looks=STYLES.filter(x=>KEEP.has(x.id)).map(x=>"L"+(STYLES.indexOf(x)+1)+" "+x.name).join(", ");
  return `You adjust the settings of Trial Reel versions for a content creator. Current versions:
${rows}

The creator's kept looks: ${looks}. Any L number from 1 to ${STYLES.length} works. Fonts are F1 to F39 (F29 is the default kept font), or "none" for the look's own font.
Colours: white, outline (white with a black outline), yellow, pink.
Text height y is pixels from the top of a 1920 tall frame: 235 is high, 1100 is low, allowed 60 to 1700.
The creator's request${scope.size?" (only for versions "+[...scope].map(i=>i+1).join(", ")+")":""}: "${text}"

Reply with only a JSON array. One object per version that must change: {"v":2,"say":"five words at most, plain","look":"L5","font":"F12","color":"outline","y":1100,"size":60,"speed":1.05,"bright":3,"mirror":true,"zoom":1.2,"motion":"in","cut":0.3,"anim":true,"open":"another","hook":"new text"} and include only the keys that change.
Ranges: size 30 to 120, speed 0.9 to 1.15, bright 0 to 10, zoom 1 to 1.5, motion is out (slow zoom out), in (slow zoom in), breathe or drift, cut 0 to 1. open is "another" (pick a different opening clip) or "original". hook uses \\n between lines, no em dashes.
Change nothing the creator did not ask for. If they name a version, touch only that one, otherwise all versions.`;
}
const clampN=(v,a,b)=>Math.min(b,Math.max(a,+v));
function applyRev(arr,scope){
  const changed=new Set(),log=[];
  arr.forEach(r=>{if(!r||typeof r!="object")return;const i=(+r.v)-1;if(!(i>=0&&i<S.cfg.length))return;if(scope.size&&!scope.has(i))return;
    const c=S.cfg[i];let ch=false;
    if(r.look){const st=STYLES[(+String(r.look).replace(/\D/g,""))-1];if(st){c.style=st.id;ch=true}}
    if("font" in r){if(r.font==null||/none|default|own/i.test(String(r.font))){c.font=null;ch=true}else{const n=+String(r.font).replace(/\D/g,"");if(n>=1&&FONTS["w"+(n-1)]){c.font="w"+(n-1);ch=true}}}
    if(r.color&&COLORS[r.color]){c.color=r.color;ch=true}
    [["y",60,1700],["speed",.9,1.15],["bright",0,10],["zoom",1,1.5],["cut",0,1]].forEach(([k,a,b])=>{if(r[k]!=null&&isFinite(+r[k])){c[k]=+clampN(r[k],a,b).toFixed(2);ch=true}});
    if(r.motion&&MOTL[r.motion]){c.mot=r.motion;if(!(c.zoom>1))c.zoom=1.2;ch=true}
    if(r.size!=null&&isFinite(+r.size)){c.sz=Math.round(clampN(r.size,30,120));ch=true}
    ["mirror","anim"].forEach(k=>{if(typeof r[k]=="boolean"){c[k]=r[k];ch=true}});
    if(r.open=="another"){const o=pickOpen(i);if(o){c.open=o;ch=true}}else if(r.open=="original"){c.open=null;ch=true}
    if(typeof r.hook=="string"&&r.hook.trim()){const h=S.hooks.find(x=>x.id==S.picked[i]);if(h){h.text=r.hook.replace(/\\n/g,"\n").replace(/[—–]/g,",").trim();ch=true}}
    if(ch){changed.add(i);log.push("Version "+(i+1)+": "+clean1(r.say||"updated"))}});
  return {changed,log}}
$("#revgo").addEventListener("click",async()=>{
  const st=$("#revstat"),text=($("#rev").value||"").trim();
  if(!text){st.className="note err";st.textContent="Say what to change first.";return}
  if(making){st.className="note err";st.textContent="Wait for the videos to finish, or press Stop first.";return}
  if(!sampleFn){st.className="note err";st.textContent="Claude can't read this from the page right now. Use the controls above, then press Make.";return}
  const scope=new Set(S.revsel||[]);st.className="thinking";st.textContent="Working out the changes";$("#revgo").disabled=true;
  let arr=null;
  try{arr=await sampleFn.json(revPrompt(text,scope),{modelTier:"default",cache:false})}catch(e){arr=null}
  $("#revgo").disabled=false;st.className="note";
  if(!Array.isArray(arr)){st.className="note err";st.textContent="That didn't work. Press the button to try again.";return}
  const {changed,log}=applyRev(arr,scope);
  if(!changed.size){st.textContent="I couldn't turn that into a change. Try naming the version and what to change.";return}
  S.revlog=[("“"+text.slice(0,70)+(text.length>70?"…":"")+"” → "+log.join("; "))].concat(S.revlog||[]).slice(0,8);
  S.revtext="";$("#rev").value="";
  changed.forEach(i=>{R[i]={status:"idle"}});render3();
  st.textContent="Changed "+[...changed].map(i=>"version "+(i+1)).join(", ")+". Making them again.";
  makeAll([...changed].sort((a,b)=>a-b));
});

/* ---------- step 4: captions ---------- */
const CAPCTA=[(k,w)=>`Comment "${k}" for ${w}`,(k,w)=>`Comment "${k}" and I will send you ${w}`,(k,w)=>`Want ${w}? Comment "${k}"`,(k,w)=>`Comment "${k}" to get ${w}`,(k,w)=>`Drop "${k}" in the comments for ${w}`];
const CAPLINES=["Why does this one feel so familiar? You will know by the end.","Is this how you would have done it? Watch it again before you answer.","What do you notice first? Most people miss the second thing.","Why does the ending change how you see the start? Try it again.","Who else has done this without realising? You are not alone.","Would you stop scrolling for this? Be honest about why.","How did this get so easy to watch? The answer is not what you think.","What would you have done differently? Most people say the same thing."];
const clean1=t=>String(t||"").replace(/\s*[—–]\s*/g,", ").replace(/\s+/g," ").trim();
function ensureCaps(){const n=S.picked.length;if(!Array.isArray(S.caps))S.caps=[];while(S.caps.length<n)S.caps.push({cta:"",line:"",edited:false,text:""});S.caps.length=n}
function buildCap(it){const p=[];if(S.capmode=="kw"&&it.cta)p.push(it.cta);if(it.line)p.push(it.line);if(S.capfollow)p.push("Follow for more");return p.join("\n\n")}
const capText=it=>it.edited?it.text:buildCap(it);
function hookOf(i){const h=S.hooks.find(x=>x.id==S.picked[i]);return h?h.text.replace(/\n/g," / "):""}
function capPrompt(idxs,kw,what){
  const others=S.caps.map((c,i)=>idxs.includes(i)?null:c.line).filter(Boolean);
  const topic=(S.captopic||S.desc||"").trim()||"(not given)";
  return `You write Instagram captions for a content creator's Reels. The same video is posted as separate versions, so every caption must read differently.
The video: ${topic}
On-screen hooks, for context only (do not repeat or explain them): ${idxs.map(i=>"v"+(i+1)+": "+hookOf(i)).join(" | ")}
${others.length?"Lines already used on other versions, do not repeat or paraphrase: "+others.join(" | ")+"\n":""}Reply with only a JSON array of ${idxs.length} objects, in order, each {"cta":"...","line":"..."}.
cta: ${S.capmode=="kw"?`one sentence asking the viewer to comment the word "${kw}" to get ${what}. Keep the exact word "${kw}" in straight double quotes and keep the meaning of what they get. Reword it differently each time (change the verb and the order). No hashtags.`:"an empty string"}
line: a short curiosity caption. First a question the viewer cannot answer, then a short line that twists it. Under 110 characters. Never explain or summarise the video. No unverified facts. Each one clearly different.
No em dashes, no emojis.`;
}
async function genCaps(idxs){
  const kw=($("#capkw").value||"").trim().replace(/["“”]/g,""),what=($("#capwhat").value||"").trim();
  S.capkw=kw;S.capwhat=what;S.captopic=$("#captopic").value;
  if(S.capmode=="kw"&&(!kw||!what)){$("#capstat").className="note err";$("#capstat").textContent="Add the keyword and what people get first.";return}
  ensureCaps();$("#capgen").disabled=true;$("#capstat").className="thinking";$("#capstat").textContent="Writing captions";
  let res=null;
  if(sampleFn){try{res=await sampleFn.json(capPrompt(idxs,kw,what),{modelTier:"default",cache:false})}catch(e){res=null}}
  let fell=false;
  idxs.forEach((i,j)=>{const r=Array.isArray(res)?res[j]:null;
    let cta=r&&typeof r.cta=="string"?clean1(r.cta):"",line=r&&typeof r.line=="string"?clean1(r.line):"";
    if(S.capmode=="kw"&&(!cta||!cta.includes(kw))){cta=CAPCTA[(i+round)%CAPCTA.length](kw,what);fell=true}
    if(S.capmode!="kw")cta="";
    if(!line){line=CAPLINES[(i+round+Math.floor(Math.random()*CAPLINES.length))%CAPLINES.length];fell=true}
    S.caps[i]={cta,line,edited:false,text:""}});
  round++;
  $("#capgen").disabled=false;$("#capstat").className="note";
  $("#capstat").textContent=fell?"Claude could not write all of these right now, so some use simple templates. Edit any line.":"";
  renderCaps();
}
function copyTA(ta,btn){const done=()=>{const o=btn.dataset.l||btn.textContent;btn.dataset.l=o;btn.textContent="Copied";setTimeout(()=>btn.textContent=o,1400)};
  (navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(done).catch(()=>{ta.select();try{document.execCommand("copy");done()}catch(e){}})}
function renderCaps(){
  const box=$("#caplist");box.innerHTML="";ensureCaps();
  const any=S.caps.some(c=>c.line||c.cta);$("#capcopyall").disabled=!any;
  if(!any){box.innerHTML='<p class="note" style="margin:0">Press Write captions and they appear here, one per version.</p>';return}
  S.caps.forEach((it,i)=>{const d=document.createElement("div");d.className="trick";
    d.innerHTML=`<header><strong>Version ${i+1}</strong><span class="note" style="margin:0">${esc(hookOf(i).slice(0,60))}</span></header><textarea aria-label="Caption for version ${i+1}" style="min-height:120px;margin-top:8px"></textarea><div class="row" style="margin-top:8px"><button class="btn ghost" data-c="copy">Copy</button><button class="btn ghost" data-c="again">Write another</button></div>`;
    const ta=d.querySelector("textarea");ta.value=capText(it);
    ta.addEventListener("input",()=>{it.edited=true;it.text=ta.value});
    d.querySelector('[data-c="copy"]').addEventListener("click",e=>copyTA(ta,e.currentTarget));
    d.querySelector('[data-c="again"]').addEventListener("click",()=>genCaps([i]));
    box.appendChild(d)});
}
function setup4(){
  $("#capkw").value=S.capkw||"";$("#capwhat").value=S.capwhat||"";$("#captopic").value=S.captopic||"";
  $("#capfollow").setAttribute("aria-pressed",!!S.capfollow);$("#kwbox").hidden=S.capmode!="kw";
  document.querySelectorAll('[data-g="capmode"] .vibe').forEach(b=>b.setAttribute("aria-checked",b.dataset.v==S.capmode));
  renderCaps();stepper();scrollTo(0,0);
}
document.querySelectorAll('[data-g="capmode"] .vibe').forEach(b=>b.addEventListener("click",()=>{$("#kwbox").hidden=S.capmode!="kw";renderCaps()}));
$("#capkw").addEventListener("input",e=>S.capkw=e.target.value);
$("#capwhat").addEventListener("input",e=>S.capwhat=e.target.value);
$("#captopic").addEventListener("input",e=>S.captopic=e.target.value);
$("#capfollow").addEventListener("click",e=>{S.capfollow=!S.capfollow;e.currentTarget.setAttribute("aria-pressed",S.capfollow);renderCaps()});
$("#capgen").addEventListener("click",()=>{ensureCaps();genCaps(S.picked.map((_,i)=>i))});
$("#capcopyall").addEventListener("click",async()=>{const t=S.caps.map((it,i)=>"Version "+(i+1)+"\n"+capText(it)).join("\n\n---\n\n");
  try{await navigator.clipboard.writeText(t);$("#capcopied").textContent="Copied."}catch(e){$("#capcopied").textContent="Copy each one below instead."}setTimeout(()=>$("#capcopied").textContent="",2000)});
$("#to4").addEventListener("click",()=>go(4));
$("#back3").addEventListener("click",()=>go(3));

/* ---------- saved progress ---------- */
const SESS="hookstudio.session.v1";let idb=null,ready=false,lastSnap="";
function idbOpen(){return new Promise(res=>{try{const q=indexedDB.open("hookstudio",1);q.onupgradeneeded=()=>q.result.createObjectStore("kv");q.onsuccess=()=>res(q.result);q.onerror=()=>res(null);q.onblocked=()=>res(null)}catch(e){res(null)}})}
async function idbDo(mode,fn){try{if(!idb)idb=await idbOpen();if(!idb)return null;return await new Promise(res=>{let rq;try{const tx=idb.transaction("kv",mode);rq=fn(tx.objectStore("kv"));tx.oncomplete=()=>res(rq?(rq.result===undefined?null:rq.result):true);tx.onerror=()=>res(null);tx.onabort=()=>res(null)}catch(e){res(null)}})}catch(e){return null}}
const idbSet=(k,v)=>idbDo("readwrite",s=>s.put(v,k)),idbGet=k=>idbDo("readonly",s=>s.get(k)),idbClr=()=>idbDo("readwrite",s=>s.clear());
function snap(){const o={v:1,S:{}};Object.keys(S).forEach(k=>{if(k!="videoURL")o.S[k]=S[k]});
  o.P={pos:[...P.pos],fonts:[...P.fonts],colors:[...P.colors],groups:[...P.groups],speed:[...P.speed],bright:[...P.bright],zoom:[...P.zoom],mot:[...P.mot],cut:[...P.cut],mirror:P.mirror};
  o.hid=hid;o.round=round;o.shown=shown.slice(-80);o.rejected=rejected.slice(-30);o.fb=[...fbSel];o.fbText=$("#fb").value;o.own=$("#own").value;
  o.R=Object.entries(R).filter(([k,r])=>r&&r.status=="done").map(([k])=>+k);return o}
function saveNow(){if(!ready)return;try{const s=JSON.stringify(snap());if(s===lastSnap)return;lastSnap=s;localStorage.setItem(SESS,s);
  const d=new Date(),el=$("#savedat");if(el&&!(S.videoURL&&S.videoKept===false))el.textContent="Progress saved "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}catch(e){}}
setInterval(saveNow,1200);addEventListener("pagehide",saveNow);document.addEventListener("visibilitychange",()=>{if(document.hidden)saveNow()});
async function restoreSession(){
  let o=null;try{o=JSON.parse(localStorage.getItem(SESS)||"null")}catch(e){}
  if(!o||!o.S)return false;
  const vb=await idbGet("video");
  if(!(o.S.desc||(o.S.hooks&&o.S.hooks.length)||vb))return false;
  Object.assign(S,o.S);
  if(o.P){["pos","fonts","colors","groups","speed","bright","zoom","mot","cut"].forEach(k=>{if(Array.isArray(o.P[k])&&(o.P[k].length||k=="fonts"||k=="cut"||k=="pos"))P[k]=new Set(o.P[k])});if(o.P.mirror)P.mirror=o.P.mirror}
  hid=o.hid||0;round=o.round||0;shown.length=0;(o.shown||[]).forEach(x=>shown.push(x));rejected.length=0;(o.rejected||[]).forEach(x=>rejected.push(x));
  fbSel.clear();(o.fb||[]).forEach(x=>fbSel.add(x));
  if(vb&&vb.blob){loadVideoBlob(vb.blob,vb.name||"video");S.videoKept=true}
  for(const i of (o.R||[])){if(i>=S.picked.length)continue;const x=await idbGet("r"+i);if(x&&x.blob)R[i]={status:"done",blob:x.blob,url:URL.createObjectURL(x.blob),name:x.name,mp4:x.mp4,size:x.size}}
  $("#desc").value=S.desc||"";$("#fb").value=o.fbText||"";$("#own").value=o.own||"";
  document.querySelectorAll("#tones .chip").forEach(c=>c.setAttribute("aria-pressed",S.tones.includes(c.textContent)));
  document.querySelectorAll("#kinds .vibe").forEach(x=>x.setAttribute("aria-checked",S.kinds.includes(x.dataset.v)));
  document.querySelectorAll(".vibes[data-g]").forEach(g=>g.querySelectorAll(".vibe").forEach(b=>b.setAttribute("aria-checked",b.dataset.v==S[g.dataset.g])));
  document.querySelectorAll("#fbchips .chip").forEach(c=>c.setAttribute("aria-pressed",fbSel.has(c.textContent)));
  if($("#size"))$("#size").value=S.size;if($("#safe"))$("#safe").checked=S.safe!==false;
  if(S.picked.length&&S.cfg.length==S.picked.length){s3built=true;S.s3dur=S.dur}else S.cfg=[];
  let st=S.step||1;if(st>=3&&!S.picked.length)st=S.hooks.length?2:1;if(st==2&&!S.hooks.length)st=1;
  if(S.hooks.length)renderHooks();
  S.step=st;return true}
$("#startover").addEventListener("click",async e=>{const b=e.currentTarget;
  if(b.dataset.arm!="1"){b.dataset.arm="1";b.textContent="Click again to clear everything";setTimeout(()=>{b.dataset.arm="";b.textContent="Start over"},4000);return}
  ready=false;try{localStorage.removeItem(SESS)}catch(x){}await idbClr();location.reload()});

async function copyText(t,btn){
  try{await navigator.clipboard.writeText(t);const n=btn.nextElementSibling;if(n)n.textContent="Copied."}
  catch(e){const r=document.createRange();r.selectNodeContents($("#promptBox"));const s=getSelection();s.removeAllRanges();s.addRange(r)}}

stepper();go(1);
(async()=>{try{if(await restoreSession()){stepper();go(S.step)}}catch(e){}ready=true;saveNow()})();
loadFonts().then(()=>{_fc=null;render3()});
(async()=>{try{sampleFn=await claude.use("sample")}catch(e){sampleFn=null}try{dl=await claude.use("downloads")}catch(e){dl=null}})();

