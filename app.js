(() => {
  'use strict';

  const core = window.Float32Core;
  if (!core) throw Error('Float32 core unavailable');

  const $ = id => document.getElementById(id);
  const INITIAL_WORD = 0x41540000;

  // ---------- Formatting helpers ----------

  const uint = n => n >>> 0;
  const view = new DataView(new ArrayBuffer(4));

  function floatOf(u) {
    view.setUint32(0, uint(u), false);
    return view.getFloat32(0, false);
  }

  function hex(u) {
    return '0x' + uint(u).toString(16).toUpperCase().padStart(8, '0');
  }

  function binary(u) {
    return uint(u).toString(2).padStart(32, '0');
  }

  // Sign / exponent / mantissa as binary strings.
  function fields(u) {
    const b = binary(u);
    return [b.slice(0, 1), b.slice(1, 9), b.slice(9)];
  }

  // Same fields in hex, e.g. 0x0 / 0x82 / 0x540000.
  function fieldsHexText(u) {
    const f = core.fieldsHex(u);
    return [f.sign, f.exponent, f.fraction].join(' / ');
  }

  function decimal(n) {
    if (Number.isNaN(n)) return 'NaN';
    if (Object.is(n, -0)) return '-0';
    return String(n);
  }

  // ---------- Parsing ----------

  function parseHexWord(text) {
    const s = text.trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]{8}$/i.test(s)) throw Error('Hex format needs exactly 8 hexadecimal digits.');
    return parseInt(s, 16) >>> 0;
  }

  function parseBinaryWord(text) {
    const s = text.replace(/[\s_]/g, '');
    if (!/^[01]{32}$/.test(s)) throw Error('Binary format needs exactly 32 bits.');
    return parseInt(s, 2) >>> 0;
  }

  function parseBinaryFields(parts) {
    const valid = /^[01]$/.test(parts[0]) && /^[01]{8}$/.test(parts[1]) && /^[01]{23}$/.test(parts[2]);
    if (!valid) throw Error('Binary fields must have 1, 8 and 23 bits, respectively.');
    return parseInt(parts.join(''), 2) >>> 0;
  }

  function parseFieldParts(parts) {
    const allHex = parts.every(x => /^0x/i.test(x));
    return allHex ? core.parseFieldsHex(parts) : parseBinaryFields(parts);
  }

  // ---------- Reusable value input ----------

  const MODE_TEXT = {
    decimal: { label: 'Decimal number', hint: 'Try 0.1, -0, Infinity, or NaN.' },
    hex: { label: 'IEEE 754 hexadecimal word', hint: 'Exactly 8 hex digits; e.g. 41540000.' },
    binary: { label: 'IEEE 754 binary word', hint: 'Exactly 32 binary digits (spaces allowed).' },
  };

  function inputTemplate(prefix) {
    return `
      <div class="modebar" role="group" aria-label="Input format">
        <button type="button" class="mode" data-mode="decimal" aria-pressed="true">Decimal</button>
        <button type="button" class="mode" data-mode="hex" aria-pressed="false">Hexadecimal</button>
        <button type="button" class="mode" data-mode="binary" aria-pressed="false">Binary</button>
        <button type="button" class="mode" data-mode="fields" aria-pressed="false">S / E / M</button>
      </div>
      <div data-role="single">
        <label class="formlabel" data-role="label" for="${prefix}Value">Decimal number</label>
        <input class="txt" id="${prefix}Value" data-role="value" spellcheck="false" autocomplete="off">
        <p class="hint" data-role="hint"></p>
      </div>
      <div data-role="fieldset" hidden>
        <label class="formlabel" for="${prefix}Sign">Sign / Exponent / Mantissa</label>
        <div class="minirow">
          <input class="txt" id="${prefix}Sign" data-role="sign" aria-label="Sign bit">
          <input class="txt" data-role="exponent" aria-label="Exponent">
          <input class="txt" data-role="fraction" aria-label="Mantissa">
        </div>
        <p class="hint">Binary: 1 / 8 / 23 digits. For hex, prefix each field with 0x.</p>
      </div>
      <p class="error" data-role="error" role="alert"></p>
      <p class="smallnote">Class: <strong data-role="class"></strong>
        &middot; S/E/M: <span data-role="sem"></span>
        &middot; hex: <span data-role="semHex"></span></p>`;
  }

  /**
   * Mounts a value input (mode selector, fields, error text, class badge) in rootEl.
   * options: { prefix, initialWord, valueId, onChange }
   * Keeps the last valid 32-bit word; invalid text sets an error and leaves the word alone.
   */
  function createValueInput(rootEl, options) {
    const prefix = options.prefix;
    const onChange = options.onChange || (() => {});
    let word = uint(options.initialWord);
    let mode = 'decimal';
    let error = '';

    rootEl.innerHTML = inputTemplate(prefix);
    const part = name => rootEl.querySelector(`[data-role="${name}"]`);
    const valueEl = part('value');
    if (options.valueId) valueEl.id = options.valueId;
    part('label').htmlFor = valueEl.id;
    const fieldEls = [part('sign'), part('exponent'), part('fraction')];

    function readWord() {
      if (mode === 'decimal') return core.parseDecimal(valueEl.value);
      if (mode === 'hex') return parseHexWord(valueEl.value);
      if (mode === 'binary') return parseBinaryWord(valueEl.value);
      return parseFieldParts(fieldEls.map(el => el.value.trim()));
    }

    // Write the current word into the visible input(s) for the active mode.
    function sync() {
      const f = fields(word);
      if (mode === 'decimal') valueEl.value = decimal(floatOf(word));
      if (mode === 'hex') valueEl.value = hex(word);
      if (mode === 'binary') valueEl.value = binary(word);
      if (mode === 'fields') fieldEls.forEach((el, i) => { el.value = f[i]; });
    }

    function showError(message) {
      error = message;
      part('error').textContent = message;
    }

    function showClass() {
      part('class').textContent = core.classify(word);
      part('sem').textContent = fields(word).join(' / ');
      part('semHex').textContent = fieldsHexText(word);
    }

    function update() {
      try {
        word = readWord();
        showError('');
        showClass();
        onChange(word);
      } catch (err) {
        showError(err.message);
        onChange(null, err.message);
      }
    }

    function setMode(next) {
      mode = next;
      rootEl.querySelectorAll('[data-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === next));
      });
      part('single').hidden = next === 'fields';
      part('fieldset').hidden = next !== 'fields';
      if (MODE_TEXT[next]) {
        part('label').textContent = MODE_TEXT[next].label;
        part('hint').textContent = MODE_TEXT[next].hint;
      }
      sync();
      showError('');
    }

    function setWord(next) {
      word = uint(next);
      sync();
      showError('');
      showClass();
    }

    rootEl.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    [valueEl, ...fieldEls].forEach(el => el.addEventListener('input', update));

    setMode('decimal');
    showClass();

    return {
      getWord: () => word,
      getError: () => error,
      setWord,
      setMode,
      sync,
      focus: () => valueEl.focus(),
      valueEl,
    };
  }

  // ---------- Converter (operand A) ----------

  const inputA = createValueInput($('inputA'), {
    prefix: 'a',
    valueId: 'inputValue',
    initialWord: INITIAL_WORD,
    onChange: word => { if (word !== null) render(); },
  });

  // ---------- Calculator (operand B) ----------

  const inputB = createValueInput($('inputB'), {
    prefix: 'b',
    initialWord: floatBits(2.5),
    onChange: () => calculate(),
  });

  function floatBits(n) {
    view.setFloat32(0, n, false);
    return view.getUint32(0, false);
  }

  // Keep the module-level `syncInput` name for the aux panel's close handler.
  function syncInput() {
    inputA.sync();
  }

  function explain(u) {
    const s = u >>> 31;
    const e = (u >>> 23) & 255;
    const f = u & 0x7fffff;
    if (e === 255) {
      return f
        ? String.raw`\[\mathrm{NaN}\quad(E=255,\;F\ne0)\]`
        : String.raw`\[${s ? '-' : ''}\infty\quad(E=255,\;F=0)\]`;
    }
    if (e === 0 && f === 0) return String.raw`\[${s ? '-' : ''}0\quad(E=0,\;F=0)\]`;
    const factor = e === 0 ? String.raw`\frac{${f}}{2^{23}}` : String.raw`1+\frac{${f}}{2^{23}}`;
    const power = e === 0 ? -126 : e - 127;
    return String.raw`\[(-1)^{${s}}\left(${factor}\right)\times 2^{${power}} = ${decimal(floatOf(u))}\]`;
  }

  let mathQueue = Promise.resolve();
  function displayEquation(tex) {
    const el = $('formula');
    if (window.MathJax?.typesetClear) window.MathJax.typesetClear([el]);
    el.textContent = tex;
    if (window.MathJax?.typesetPromise) {
      mathQueue = mathQueue.catch(() => {}).then(() => window.MathJax.typesetPromise([el]));
    }
  }

  function exponentText(e) {
    if (e === 0) return '-126 (subnormal/zero)';
    if (e === 255) return 'Reserved (255)';
    return String(e - 127);
  }

  function bitKind(i) {
    return i === 0 ? 'sign' : i < 9 ? 'exponent' : 'fraction';
  }

  function renderBits(word) {
    const b = binary(word);
    const canvas = $('bitCanvas');
    canvas.replaceChildren();
    for (let i = 0; i < 32; i++) {
      const btn = document.createElement('button');
      const kind = bitKind(i);
      btn.type = 'button';
      btn.className = 'bit ' + kind;
      btn.textContent = b[i];
      btn.setAttribute('aria-label', `Bit ${31 - i}, ${kind}, value ${b[i]}. Toggle bit.`);
      btn.setAttribute('aria-pressed', b[i] === '1' ? 'true' : 'false');
      btn.title = `Bit ${31 - i} · click to toggle`;
      btn.addEventListener('click', () => {
        inputA.setWord(inputA.getWord() ^ (1 << (31 - i)));
        render();
      });
      canvas.appendChild(btn);
    }
  }

  // Redraws everything that depends on operand A.
  function render() {
    const word = inputA.getWord();
    const kind = core.classify(word);
    const e = (word >>> 23) & 255;
    $('classBadge').textContent = kind;
    $('outDecimal').textContent = decimal(floatOf(word));
    $('outHex').textContent = hex(word);
    $('outBinary').textContent = binary(word);
    $('outFields').textContent = fields(word).join(' / ');
    $('outFieldsHex').textContent = fieldsHexText(word);
    $('outExponent').textContent = exponentText(e);
    $('rawWord').textContent = hex(word);
    $('typeValue').textContent = kind;
    $('biasedValue').textContent = String(e);
    $('operandA').textContent = decimal(floatOf(word));
    $('operandAClass').textContent = kind;
    $('operandAFields').textContent = fields(word).join(' / ');
    $('operandAFieldsHex').textContent = fieldsHexText(word);
    displayEquation(explain(word));
    const nb = core.neighbors(word);
    $('exactDecimal').textContent = core.exactDecimal(word);
    $('nextDown').textContent = hex(nb.lower) + ' · ' + decimal(floatOf(nb.lower));
    $('nextUp').textContent = hex(nb.upper) + ' · ' + decimal(floatOf(nb.upper));
    $('ulpValue').textContent = nb.ulp === null ? 'Not applicable' : String(nb.ulp);
    renderBits(word);
    calculate();
  }

  function roundingText(result) {
    const detail = result.rounding;
    if (!detail) return 'RESULT: ' + result.stage + ' | Special-value handling or exact zero.';
    const outcome = detail.exact ? 'exact' : detail.incremented ? 'incremented' : 'retained';
    return 'RESULT: ' + result.stage + ' | G/R/S: ' + detail.guard + '/' + detail.round + '/' +
      detail.sticky + ' | Round-to-nearest-even: ' + outcome;
  }

  function calculate() {
    try {
      if (inputB.getError()) throw Error('Operand B: ' + inputB.getError());
      const result = core.operate(inputA.getWord(), inputB.getWord(), $('operator').value);
      const u = result.bits;
      $('resultDecimal').textContent = decimal(floatOf(u));
      $('resultHex').textContent = hex(u);
      $('resultClass').textContent = core.classify(u);
      $('resultBinary').textContent = binary(u);
      $('resultFields').textContent = fields(u).join(' / ');
      $('resultFieldsHex').textContent = fieldsHexText(u);
      $('roundTrace').textContent = roundingText(result);
      $('calcError').textContent = '';
      $('calcResult').hidden = false;
    } catch (err) {
      $('calcError').textContent = err.message;
      $('calcResult').hidden = true;
    }
  }

  function copyEncoding() {
    const word = inputA.getWord();
    return `Decimal: ${decimal(floatOf(word))}\nHex: ${hex(word)}\nBinary: ${binary(word)}\n` +
      `S/E/M: ${fields(word).join(' / ')}\nS/E/M hex: ${fieldsHexText(word)}\nType: ${core.classify(word)}`;
  }

  async function onCopy() {
    const btn = $('copyBtn');
    try {
      await navigator.clipboard.writeText(copyEncoding());
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = 'Copy full encoding'; }, 1400);
    } catch (_) {
      btn.textContent = 'Copy unavailable in this browser';
    }
  }

  // ---------- Auxiliary panel (unchanged) ----------

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

  // ---------- Wiring ----------

  $('resetBtn').addEventListener('click', () => {
    inputA.setMode('decimal');
    inputA.setWord(INITIAL_WORD);
    render();
  });
  $('operator').addEventListener('change', calculate);
  $('calculate').addEventListener('click', calculate);
  $('copyBtn').addEventListener('click', onCopy);

  render();
})();
