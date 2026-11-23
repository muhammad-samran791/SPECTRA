'use strict';

const canvas = document.getElementById('scene');
const shell = document.getElementById('canvasShell');
const ctx = canvas.getContext('2d', { alpha: false });
const angleSlider = document.getElementById('angle');
const dispersionSlider = document.getElementById('dispersion');
const angleValue = document.getElementById('angleValue');
const dispersionValue = document.getElementById('dispersionValue');
const autoButton = document.getElementById('auto');
const autoLabel = document.getElementById('autoLabel');
const autoIcon = document.getElementById('autoIcon');
const status = document.getElementById('status');

const state = {
  angle: 8,
  dispersion: 76,
  autoRotate: false,
  dragging: false,
  dragStartAngle: 0,
  dragStartValue: 8,
  pulseTime: -10000,
  hover: false,
  pointer: { x: -1000, y: -1000 },
  w: 1200,
  h: 540,
  cx: 583,
  cy: 195,
  mobile: false
};
const palette = [
  { name: 'red', color: '#ff738b' },
  { name: 'orange', color: '#ffac6e' },
  { name: 'yellow', color: '#ffe889' },
  { name: 'mint', color: '#91ffc0' },
  { name: 'aqua', color: '#75f5f0' },
  { name: 'blue', color: '#83adff' },
  { name: 'violet', color: '#d3a2ff' }
];

const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y});
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
const mul = (a,k) => ({x:a.x*k,y:a.y*k});
const dot = (a,b) => a.x*b.x+a.y*b.y;
const cross = (a,b) => a.x*b.y-a.y*b.x;
const normalize = v => mul(v, 1 / Math.max(1e-9, Math.hypot(v.x,v.y)));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const mix = (a,b,t) => a+(b-a)*t;

// MAIN CODE SNIPPET — six complete lines, extracted as-is for the Reel.
function refractRay(dir, normal, n1, n2) {
  const r = n1/n2, c = -dot(normal, dir);
  const k = 1 - r*r*(1-c*c);
  if (k < 0) return null;
  return normalize(add(mul(dir,r), mul(normal,r*c-Math.sqrt(k))));
}

function raySegment(origin, direction, a, b) {
  const e = sub(b,a), denominator = cross(direction,e);
  if (Math.abs(denominator) < 1e-9) return null;
  const ao = sub(a,origin);
  const t = cross(ao,e)/denominator, u = cross(ao,direction)/denominator;
  if (t < .001 || u < -.00001 || u > 1.00001) return null;
  return { t, point: add(origin,mul(direction,t)) };
}

function trianglePoints() {
  const a = state.angle * Math.PI / 180;
  const size = state.mobile ? 1.42 : 1.13;
  const c = Math.cos(a), s = Math.sin(a);
  return [{x:-94,y:101},{x:94,y:101},{x:0,y:-120}].map(p=>({
    x: state.cx + size * (p.x*c-p.y*s),
    y: state.cy + size * (p.x*s+p.y*c)
  }));
}

function prismTrace(index, points) {
  const origin = {x:state.mobile?73:88, y:state.cy-17};
  const incident = {x:1,y:0};
  const n = 1.49 + (index/6) * (.026 + .130*state.dispersion/100);
  const hits = points.map((p,i) => {
    const h=raySegment(origin,incident,p,points[(i+1)%3]);
    return h ? { ...h,edge:i } : null;
  }).filter(Boolean).sort((a,b)=>a.t-b.t);
  if (!hits.length) return null;
  const first=hits[0], e1=sub(points[(first.edge+1)%3],points[first.edge]);
  const inwardFacingNormal=normalize({x:-e1.y,y:e1.x});
  const interior=refractRay(incident,inwardFacingNormal,1,n);
  if (!interior) return null;
  const secondHits=points.map((p,i)=>{
    if(i===first.edge) return null;
    const h=raySegment(add(first.point,mul(interior,.1)),interior,p,points[(i+1)%3]);
    return h ? {...h,edge:i} : null;
  }).filter(Boolean).sort((a,b)=>a.t-b.t);
  if(!secondHits.length) return null;
  const second=secondHits[0], e2=sub(points[(second.edge+1)%3],points[second.edge]);
  const exitOutward=normalize({x:-e2.y,y:e2.x});
  const outgoing=refractRay(interior,mul(exitOutward,-1),n,1);
  if(!outgoing) return null;
  const endX=state.w-35, endY=state.h-24;
  const tx=outgoing.x>0 ? (endX-second.point.x)/outgoing.x : Infinity;
  const ty=outgoing.y>0 ? (endY-second.point.y)/outgoing.y : Infinity;
  const distance=Math.max(0,Math.min(tx,ty));
  return { origin,first:first.point,second:second.point,end:add(second.point,mul(outgoing,distance)),n };
}

function resize() {
  const rect=canvas.getBoundingClientRect();
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(rect.width*ratio));
  canvas.height=Math.max(1,Math.round(rect.height*ratio));
  state.mobile=rect.width<670;
  state.w=state.mobile?680:1200;
  state.h=state.mobile?820:540;
  state.cx=state.mobile?320:583;
  state.cy=state.mobile?388:195;
}
window.addEventListener('resize',resize,{passive:true});
resize();

let seed=7721;
function random(){ seed=(seed*16807)%2147483647;return (seed-1)/2147483646; }
const dust=Array.from({length:75},()=>({x:random(),y:random(),r:.3+random()*1.6,p:random()*Math.PI*2,velocity:.15+random()*.55}));

function softCircle(x,y,r,color,alpha=1) {
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color.replace('ALPHA',String(.32*alpha)));
  g.addColorStop(.25,color.replace('ALPHA',String(.12*alpha)));
  g.addColorStop(1,color.replace('ALPHA','0'));
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}
function line(from,to,color,width=2,alpha=1) {
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.lineCap='round';ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.restore();
}
function radiantRay(from,to,color,intensity=1,thickness=1) {
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=22;line(from,to,color,13*thickness,.14*intensity);
  ctx.shadowBlur=12;line(from,to,color,5.5*thickness,.55*intensity);
  ctx.shadowBlur=3;line(from,to,color,2*thickness,.96*intensity);
  ctx.restore();
}
function drawPolygon(pts) {ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}

function drawGrid(t) {
  ctx.fillStyle='#12183c';ctx.fillRect(0,0,state.w,state.h);
  const radial=ctx.createRadialGradient(state.cx,state.cy,0,state.cx,state.cy,state.mobile?380:600);
  radial.addColorStop(0,'#353e88');radial.addColorStop(.48,'#222c68');radial.addColorStop(1,'#101638');
  ctx.fillStyle=radial;ctx.fillRect(0,0,state.w,state.h);
  ctx.strokeStyle='#a7b9ff0c';ctx.lineWidth=1;
  for(let x=20;x<state.w;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,state.h);ctx.stroke();}
  for(let y=18;y<state.h;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(state.w,y);ctx.stroke();}
  const fade=ctx.createLinearGradient(0,0,0,state.h);fade.addColorStop(0,'#090e292a');fade.addColorStop(.58,'#090e2900');fade.addColorStop(1,'#050a2444');ctx.fillStyle=fade;ctx.fillRect(0,0,state.w,state.h);
  dust.forEach((p,i)=>{
    const x=p.x*state.w, y=((p.y*state.h+t*.001*p.velocity*22)%state.h);
    const alpha=.14+.2*(.5+.5*Math.sin(t*.0015+p.p));
    ctx.fillStyle=`rgba(208,223,255,${alpha})`;
    ctx.beginPath();ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fill();
  });
  // Technical concentric markings, intentionally subtle.
  ctx.save();ctx.strokeStyle='#c7cfff19';ctx.lineWidth=1;ctx.setLineDash([2,12]);
  [160,200].forEach(r=>{ctx.beginPath();ctx.arc(state.cx,state.cy,r,0,Math.PI*2);ctx.stroke();});
  ctx.setLineDash([]);ctx.restore();
  softCircle(state.cx,state.cy,270,'rgba(121,151,255,ALPHA)',.55);
}

function drawPrism(points,time) {
  const bounds=points.map(p=>p.y),top=Math.min(...bounds),bottom=Math.max(...bounds);
  ctx.save();
  ctx.shadowColor='#9cb3ff';ctx.shadowBlur=37;
  drawPolygon(points);ctx.strokeStyle='#91c1ff73';ctx.lineWidth=11;ctx.stroke();
  ctx.shadowBlur=0;
  const fill=ctx.createLinearGradient(state.cx-120,top,state.cx+130,bottom);
  fill.addColorStop(0,'#fcfcff28');fill.addColorStop(.28,'#7fffff23');fill.addColorStop(.57,'#e6adff1d');fill.addColorStop(.82,'#c5ecff43');fill.addColorStop(1,'#809fff30');
  drawPolygon(points);ctx.fillStyle=fill;ctx.fill();
  ctx.save();drawPolygon(points);ctx.clip();
  const beamShimmer=ctx.createLinearGradient(state.cx-140,0,state.cx+140,0);
  beamShimmer.addColorStop(0,'#f6fdff04');beamShimmer.addColorStop((.4+.1*Math.sin(time*.00048)).toFixed(3),'#f8faff30');beamShimmer.addColorStop(1,'#f6fdff03');
  ctx.fillStyle=beamShimmer;ctx.fillRect(state.cx-150,top,320,bottom-top);
  // Inner beveled facets.
  ctx.strokeStyle='#eaf4ff26';ctx.lineWidth=1;
  points.forEach(p=>line({x:state.cx,y:state.cy+22},p,'#c2edff',.8,.19));
  ctx.restore();
  drawPolygon(points);ctx.lineJoin='round';ctx.shadowColor='#b9ebff';ctx.shadowBlur=13;ctx.strokeStyle='#d7f5ffd0';ctx.lineWidth=2.3;ctx.stroke();
  ctx.shadowBlur=0;drawPolygon(points);ctx.strokeStyle='#ffffff60';ctx.lineWidth=.7;ctx.stroke();
  for(const p of points){softCircle(p.x,p.y,23,'rgba(216,243,255,ALPHA)',.58);}
  ctx.restore();
}

function drawSource(start,time) {
  const x=start.x-31,y=start.y;
  softCircle(x+15,y,75,'rgba(221,242,255,ALPHA)',1.2);
  ctx.save();ctx.translate(x,y);ctx.shadowColor='#d6f7ff';ctx.shadowBlur=17;
  const outer=ctx.createLinearGradient(-17,-21,20,24);outer.addColorStop(0,'#c7daf6');outer.addColorStop(.5,'#7184bd');outer.addColorStop(1,'#293665');
  ctx.fillStyle=outer;ctx.beginPath();ctx.roundRect(-20,-21,40,42,11);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#efffff8c';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#141b42';ctx.beginPath();ctx.arc(0,0,12.5,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='#f4ffff';ctx.shadowBlur=23;ctx.fillStyle='#edfaff';ctx.beginPath();ctx.arc(0,0,5.5,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawBeams(t,points) {
  const traces=palette.map((_,i)=>prismTrace(i,points));
  const center=traces[3];if(!center)return;
  const first=center.first;
  const elapsed=t-state.pulseTime;
  const intensity=1+.23*Math.max(0,1-elapsed/1300);
  const inProgress=clamp(elapsed/390,0,1);
  const inputEnd=add(center.origin,mul(sub(first,center.origin),inProgress));
  ctx.save();ctx.shadowColor='#daedff';ctx.shadowBlur=38;
  line(center.origin,inputEnd,'#d3e7ff',17,.12);
  line(center.origin,inputEnd,'#e7f8ff',7,.4);
  line(center.origin,inputEnd,'#fff',2.8,.95);
  ctx.restore();
  softCircle(first.x,first.y,58,'rgba(227,243,255,ALPHA)',.85);
  for(let i=palette.length-1;i>=0;i--){
    const tr=traces[i];if(!tr)continue;
    const reveal=clamp((elapsed-330-i*18)/580,0,1);
    // Subtle color within the crystal; each wavelength has its own path.
    radiantRay(tr.first,tr.second,palette[i].color,.60,.6);
    if(reveal>.001) {
      const last=add(tr.second,mul(sub(tr.end,tr.second),reveal));
      radiantRay(tr.second,last,palette[i].color,intensity,1.1);
      softCircle(last.x,last.y,14,`rgba(${i%2===0?'213,170,255':'178,220,255'},ALPHA)`,.2);
    }
  }
  drawPrism(points,t);
  // 2 extra luminous flares on the prism intersection.
  softCircle(first.x,first.y,25,'rgba(231,246,255,ALPHA)',1.2);
  softCircle(center.second.x,center.second.y,28,'rgba(234,190,255,ALPHA)',.84);
  drawSource(center.origin,t);
  // Moving glints riding on incident light.
  for(let k=0;k<4;k++){
    const progress=((t*.00027+k*.27)%1);
    const gx=mix(center.origin.x,first.x,progress);
    ctx.fillStyle=`rgba(240,248,255,${.5*Math.sin(progress*Math.PI)})`;
    ctx.beginPath();ctx.arc(gx,center.origin.y,1.4+(k%2),0,Math.PI*2);ctx.fill();
  }
  return center;
}

function drawReadouts() {
  const y=state.mobile?state.cy+213:state.cy+183;
  ctx.save();ctx.textAlign='center';ctx.fillStyle='#d9e0ff9c';ctx.font='600 11px system-ui';
  ctx.letterSpacing='2px';ctx.fillText('n ≈ 1.49',state.cx,y);
  ctx.fillStyle='#98a9db90';ctx.font='500 9px system-ui';ctx.fillText('GLASS PRISM',state.cx,y+20);
  ctx.restore();
}

function tick(t) {
  if(state.autoRotate && !state.dragging){
    state.angle=8.5+13*Math.sin(t*.00051);
    updateControlLabels();
  }
  const widthScale=canvas.width/state.w,heightScale=canvas.height/state.h;
  ctx.setTransform(widthScale,0,0,heightScale,0,0);
  ctx.clearRect(0,0,state.w,state.h);
  drawGrid(t);
  const pts=trianglePoints();
  drawBeams(t,pts);
  drawReadouts();
  requestAnimationFrame(tick);
}

function updateControlLabels(){
  angleSlider.value=Math.round(state.angle);
  angleValue.textContent=`${state.angle>=0?'+':'−'}${String(Math.abs(Math.round(state.angle))).padStart(2,'0')}°`;
  dispersionValue.textContent=`${state.dispersion}%`;
}
function triggerPulse(){
  state.pulseTime=performance.now();
  status.textContent='LIGHT IS SPLITTING INTO COLOR';
  window.setTimeout(()=>{status.textContent='LIGHT REFRACTED SUCCESSFULLY';},1200);
}
angleSlider.addEventListener('input',()=>{state.autoRotate=false;updateAutoButton();state.angle=Number(angleSlider.value);updateControlLabels();});
dispersionSlider.addEventListener('input',()=>{state.dispersion=Number(dispersionSlider.value);updateControlLabels();});
document.getElementById('replay').addEventListener('click',triggerPulse);
function updateAutoButton(){
  autoButton.setAttribute('aria-pressed',String(state.autoRotate));
  autoLabel.textContent=state.autoRotate?'PAUSE ROTATION':'AUTO ROTATE';
  autoIcon.textContent=state.autoRotate?'Ⅱ':'↻';
}
autoButton.addEventListener('click',()=>{
  state.autoRotate=!state.autoRotate;updateAutoButton();
});

function pointerToWorld(event){
  const rect=canvas.getBoundingClientRect();
  return {x:(event.clientX-rect.left)/rect.width*state.w,y:(event.clientY-rect.top)/rect.height*state.h};
}
canvas.addEventListener('pointerdown',event=>{
  const p=pointerToWorld(event);
  if(Math.hypot(p.x-state.cx,p.y-state.cy)>175) return;
  state.autoRotate=false;updateAutoButton();state.dragging=true;
  state.dragStartAngle=Math.atan2(p.y-state.cy,p.x-state.cx);
  state.dragStartValue=state.angle;
  shell.classList.add('dragging');canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  const p=pointerToWorld(event);state.pointer=p;
  if(!state.dragging)return;
  let delta=(Math.atan2(p.y-state.cy,p.x-state.cx)-state.dragStartAngle)*180/Math.PI;
  if(delta>180)delta-=360;if(delta< -180)delta+=360;
  state.angle=clamp(state.dragStartValue+delta,-5,22);
  updateControlLabels();
});
function release(){state.dragging=false;shell.classList.remove('dragging');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
document.addEventListener('keydown',e=>{
  if(e.key.toLowerCase()==='r'){state.angle=8;state.dispersion=76;state.autoRotate=false;updateAutoButton();updateControlLabels();triggerPulse();}
  if(e.code==='Space' && e.target.tagName!=='BUTTON' && e.target.tagName!=='INPUT'){e.preventDefault();triggerPulse();}
});
updateControlLabels();
requestAnimationFrame(tick);
