(()=>{'use strict';
const $=id=>document.getElementById(id);let word=0x41540000,mode='decimal';
const buf=new ArrayBuffer(4),view=new DataView(buf);const uint=n=>n>>>0;
function floatOf(u){view.setUint32(0,uint(u),false);return view.getFloat32(0,false)}
function bitsOf(n){view.setFloat32(0,n,false);return view.getUint32(0,false)}
function hex(u){return '0x'+uint(u).toString(16).toUpperCase().padStart(8,'0')}
function binary(u){return uint(u).toString(2).padStart(32,'0')}
function fields(u){const b=binary(u);return [b.slice(0,1),b.slice(1,9),b.slice(9)]}
function type(u){const e=(u>>>23)&255,f=u&0x7fffff;if(e===255)return f?'NaN':'Infinity';if(e===0)return f?'Denormalized':'Zero';return 'Normalized'}
function decimal(n){if(Number.isNaN(n))return 'NaN';if(Object.is(n,-0))return '-0';return String(n)}
function decimalInput(v){const s=v.trim();if(!s)throw Error('Enter a decimal value.');if(/^[-+]?nan$/i.test(s))return NaN;if(/^[-+]?(infinity|inf)$/i.test(s))return s[0]==='-'?-Infinity:Infinity;if(!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|0x[\da-f]+)$/i.test(s))throw Error('Enter a valid decimal number, Infinity, or NaN.');return Number(s)}
function parseInput(){if(mode==='decimal')return bitsOf(decimalInput($('inputValue').value));if(mode==='hex'){const s=$('inputValue').value.trim().replace(/^0x/i,'');if(!/^[0-9a-f]{8}$/i.test(s))throw Error('Hex format needs exactly 8 hexadecimal digits.');return parseInt(s,16)>>>0}if(mode==='binary'){const s=$('inputValue').value.replace(/[\s_]/g,'');if(!/^[01]{32}$/.test(s))throw Error('Binary format needs exactly 32 bits.');return parseInt(s,2)>>>0}
const arr=[$('fieldSign').value.trim(),$('fieldExp').value.trim(),$('fieldFrac').value.trim()];if(arr.every(x=>/^0x/i.test(x))){const p=arr.map(x=>x.slice(2));if(!/^[01]$/.test(p[0])||!/^[\da-f]{1,2}$/i.test(p[1])||!/^[\da-f]{1,6}$/i.test(p[2]))throw Error('Hex fields: sign 0/1, exponent 00–FF, fraction 000000–7FFFFF.');const s=parseInt(p[0],16),e=parseInt(p[1],16),f=parseInt(p[2],16);if(e>255||f>0x7fffff)throw Error('A field is outside its bit range.');return uint((s<<31)|(e<<23)|f)}if(!/^[01]$/.test(arr[0])||!/^[01]{8}$/.test(arr[1])||!/^[01]{23}$/.test(arr[2]))throw Error('Binary fields must have 1, 8 and 23 bits, respectively.');return parseInt(arr.join(''),2)>>>0}
function syncInput(){const f=fields(word);if(mode==='decimal')$('inputValue').value=decimal(floatOf(word));if(mode==='hex')$('inputValue').value=hex(word);if(mode==='binary')$('inputValue').value=binary(word);if(mode==='fields'){ $('fieldSign').value=f[0];$('fieldExp').value=f[1];$('fieldFrac').value=f[2];}}
function explain(u){
const s=u>>>31,e=(u>>>23)&255,f=u&0x7fffff;
if(e===255)return f?String.raw`\[\mathrm{NaN}\quad(E=255,\;F\ne0)\]`:String.raw`\[${s?'-':''}\infty\quad(E=255,\;F=0)\]`;
if(e===0&&f===0)return String.raw`\[${s?'-':''}0\quad(E=0,\;F=0)\]`;
const factor=e===0?String.raw`\frac{${f}}{2^{23}}`:String.raw`1+\frac{${f}}{2^{23}}`;
const power=e===0?-126:e-127;
return String.raw`\[(-1)^{${s}}\left(${factor}\right)\times 2^{${power}} = ${decimal(floatOf(u))}\]`;
}
let mathQueue=Promise.resolve();
function displayEquation(tex){
const el=$('formula');
if(window.MathJax?.typesetClear)window.MathJax.typesetClear([el]);
el.textContent=tex;
if(window.MathJax?.typesetPromise){mathQueue=mathQueue.catch(()=>{}).then(()=>window.MathJax.typesetPromise([el]));}
}
function render(){const b=binary(word),f=fields(word),e=(word>>>23)&255,t=type(word);$('classBadge').textContent=t;$('outDecimal').textContent=decimal(floatOf(word));$('outHex').textContent=hex(word);$('outBinary').textContent=b;$('outFields').textContent=f.join(' / ');$('outExponent').textContent=e===0?'-126 (subnormal/zero)':e===255?'Reserved (255)':String(e-127);$('rawWord').textContent=hex(word);$('typeValue').textContent=t;$('biasedValue').textContent=String(e);$('operandA').textContent=decimal(floatOf(word));displayEquation(explain(word));const canvas=$('bitCanvas');canvas.replaceChildren();for(let i=0;i<32;i++){const btn=document.createElement('button');btn.type='button';btn.className='bit '+(i===0?'sign':i<9?'exponent':'fraction');btn.textContent=b[i];btn.setAttribute('aria-label',`Bit ${31-i}, ${i===0?'sign':i<9?'exponent':'fraction'}, value ${b[i]}. Toggle bit.`);btn.setAttribute('aria-pressed',b[i]==='1'?'true':'false');btn.title=`Bit ${31-i} · click to toggle`;btn.addEventListener('click',()=>{word=uint(word^(1<<(31-i)));syncInput();render();});canvas.appendChild(btn)}calculate()}
function calculate(){try{const a=floatOf(word),b=Math.fround(decimalInput($('operandB').value));let n;switch($('operator').value){case '+':n=Math.fround(a+b);break;case '-':n=Math.fround(a-b);break;case '*':n=Math.fround(a*b);break;default:throw Error('Unsupported operator')}const u=bitsOf(n);$('resultDecimal').textContent=decimal(floatOf(u));$('resultHex').textContent=hex(u);$('resultClass').textContent=type(u);$('resultBinary').textContent=binary(u);$('resultFields').textContent=fields(u).join(' / ');$('calcError').textContent='';$('calcResult').hidden=false}catch(err){$('calcError').textContent=err.message;$('calcResult').hidden=true}}
function isPanelCommand(input){
  const value=input.trim();
  if(/^\/irc$/i.test(value))return true;
  const hexadecimal=value.replace(/^0x/i,'').replace(/[\s_-]/g,'');
  if(/^2f697263$/i.test(hexadecimal))return true;
  const bits=value.replace(/[\s_-]/g,'');
  return bits==='00101111011010010111001001100011';
}
const auxClientUrl='https://kiwiirc.com/nextclient/irc.libera.chat/#half-bytes';
function openPanel(){
  const backdrop=$('auxBackdrop');
  backdrop.hidden=false;
    if(!$('auxFrame').getAttribute('src'))$('auxFrame').setAttribute('src',auxClientUrl);
  $('auxClose').focus();
}
function closePanel(){
  $('auxBackdrop').hidden=true;
    syncInput();
  $('inputValue').focus();
}
$('auxClose').addEventListener('click',closePanel);
$('auxBackdrop').addEventListener('click',event=>{if(event.target===$('auxBackdrop'))closePanel()});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('auxBackdrop').hidden){event.preventDefault();closePanel()}
});
$('inputValue').addEventListener('keydown',event=>{
  if(event.key!=='Enter' || event.isComposing || !isPanelCommand(event.currentTarget.value))return;
  event.preventDefault();
  openPanel();
});
function update(){
  try{word=parseInput();$('inputError').textContent='';render()}catch(err){$('inputError').textContent=err.message}
}
function setMode(m){mode=m;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode===m)));$('single-input').hidden=m==='fields';$('fields-input').hidden=m!=='fields';$('inputLabel').textContent=({decimal:'Decimal number',hex:'IEEE 754 hexadecimal word',binary:'IEEE 754 binary word'})[m]||'';$('inputHint').textContent=({decimal:'Try 0.1, -0, Infinity, or NaN.',hex:'Exactly 8 hex digits; e.g. 41540000.',binary:'Exactly 32 binary digits (spaces allowed).'})[m]||'';syncInput();$('inputError').textContent=''}
document.querySelectorAll('[data-mode]').forEach(x=>x.addEventListener('click',()=>setMode(x.dataset.mode)));['inputValue','fieldSign','fieldExp','fieldFrac'].forEach(id=>$(id).addEventListener('input',update));$('resetBtn').addEventListener('click',()=>{word=0x41540000;setMode('decimal');render()});$('operator').addEventListener('change',calculate);$('operandB').addEventListener('input',calculate);$('calculate').addEventListener('click',calculate);$('copyBtn').addEventListener('click',async()=>{const str=`Decimal: ${decimal(floatOf(word))}\nHex: ${hex(word)}\nBinary: ${binary(word)}\nS/E/M: ${fields(word).join(' / ')}\nType: ${type(word)}`;try{await navigator.clipboard.writeText(str);$('copyBtn').textContent='Copied ✓';setTimeout(()=>$('copyBtn').textContent='Copy full encoding',1400)}catch(_){$('copyBtn').textContent='Copy unavailable in this browser'}});render();
})();

// Date is the visitor's current local date, not a hard-coded 2002 timestamp.
(() => {
  const now = new Date();
  document.getElementById('updatedDate').textContent = now.toLocaleDateString('en-US', {year:'numeric',month:'2-digit',day:'2-digit'});
  document.getElementById('copyrightYear').textContent = now.getFullYear();

  // Shared site-wide counter: requires an internet connection to the counter service.
  // Reloads within the same tab session display the total without adding another hit.
  const key = 'floatlab_pan0ptes_ieee754_visits_2026';
  const base = 'https://countapi.mileshilliard.com/api/v1/';
  const countEl = document.getElementById('visitorCount');
  const statusEl = document.getElementById('counterStatus');
  let counted = false;
  try { counted = sessionStorage.getItem('floatlab.visitCounted') === '1'; } catch (_) {}
  const action = counted ? 'get' : 'hit';
  fetch(base + action + '/' + key, {cache:'no-store'})
    .then(response => { if (!response.ok) throw new Error('Service unavailable'); return response.json(); })
    .then(data => {
      const value = Number(data.value);
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid counter response');
      countEl.textContent = String(value).padStart(6,'0');
      statusEl.textContent = 'Total page visits';
      if (!counted) { try { sessionStorage.setItem('floatlab.visitCounted','1'); } catch (_) {} }
    })
    .catch(() => { countEl.textContent = '------'; statusEl.textContent = 'Counter offline'; });
})();
