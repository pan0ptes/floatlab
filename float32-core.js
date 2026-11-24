/* IEEE 754 binary32 core. Integers represent significands exactly; rounding is nearest/ties-to-even. */
(function (root) {
'use strict';
const FRAC_MASK = 0x7fffff;
const QNAN = 0x7fc00000;
const uint = value => value >>> 0;
const bitLength = value => value === 0n ? 0 : value.toString(2).length;

function classify(bits) {
  const exponent = (bits >>> 23) & 255;
  const fraction = bits & FRAC_MASK;
  return exponent === 255 ? (fraction ? 'NaN' : 'Infinity') :
    exponent === 0 ? (fraction ? 'Denormalized' : 'Zero') : 'Normalized';
}

function unpack(bits) {
  bits = uint(bits);
  const sign = bits >>> 31;
  const exponentField = (bits >>> 23) & 255;
  const fraction = bits & FRAC_MASK;
  return {
    bits, sign, exponentField, fraction, kind: classify(bits),
    mantissa: BigInt(exponentField ? fraction | 0x800000 : fraction),
    exponent: exponentField ? exponentField - 150 : -149
  };
}

function compareAtPower(num, den, power) {
  if (power >= 0) {
    const scaled = den << BigInt(power);
    return num < scaled ? -1 : num > scaled ? 1 : 0;
  }
  const scaled = num << BigInt(-power);
  return scaled < den ? -1 : scaled > den ? 1 : 0;
}
function floorLog2Ratio(num, den) {
  let result = bitLength(num) - bitLength(den);
  if (compareAtPower(num, den, result) < 0) result--;
  if (compareAtPower(num, den, result + 1) >= 0) result++;
  return result;
}

function roundRatio(num, den, binaryShift) {
  if (binaryShift >= 0) num <<= BigInt(binaryShift);
  else den <<= BigInt(-binaryShift);
  let quotient = num / den;
  const remainder = num % den;
  const cmp = remainder * 2n - den;
  const incremented = cmp > 0n || (cmp === 0n && (quotient & 1n) === 1n);
  if (incremented) quotient++;
  return {
    value: quotient,
    detail: { rule: 'nearest, ties to even', incremented,
      halfway: cmp === 0n, exact: remainder === 0n }
  };
}

/* The dropped bits produce guard, round, and sticky values. The retained
   significand is incremented for >halfway, or halfway with odd low bit. */
function roundPower2(num, binaryShift) {
  if (binaryShift >= 0) return {
    value: num << BigInt(binaryShift),
    detail: { rule: 'nearest, ties to even', guard: 0, round: 0, sticky: 0,
      incremented: false, exact: true }
  };
  const lost = -binaryShift, n = BigInt(lost);
  let quotient = num >> n;
  const guard = Number((num >> (n - 1n)) & 1n);
  const round = lost >= 2 ? Number((num >> (n - 2n)) & 1n) : 0;
  const sticky = lost >= 3
    ? Number((num & ((1n << (n - 2n)) - 1n)) !== 0n) : 0;
  const incremented = guard === 1 &&
    (round === 1 || sticky === 1 || (quotient & 1n) === 1n);
  if (incremented) quotient++;
  return {
    value: quotient,
    detail: { rule: 'nearest, ties to even', guard, round, sticky,
      incremented, exact: guard === 0 && round === 0 && sticky === 0 }
  };
}

function packRounded(sign, exponent, rounded) {
  const value = rounded.value;
  if (exponent >= -126) {
    let p = exponent, significand = value;
    if (significand === 0x1000000n) { p++; significand >>= 1n; }
    const overflow = p > 127;
    return {
      bits: overflow ? uint((sign << 31) | 0x7f800000) :
        uint((sign << 31) | ((p + 127) << 23) | Number(significand & 0x7fffffn)),
      rounding: rounded.detail, stage: overflow ? 'overflow' : 'normalized'
    };
  }
  return {
    bits: uint((sign << 31) | (value >= 0x800000n ? 0x00800000 : Number(value))),
    rounding: rounded.detail,
    stage: value === 0n ? 'underflow to zero' :
      value >= 0x800000n ? 'minimum normal' : 'subnormal'
  };
}

/* Value = (-1)^sign * mantissa * 2^exponent; no floating-point math used. */
function fromScaled(sign, mantissa, exponent) {
  sign &= 1;
  if (mantissa === 0n) return {
    bits: uint(sign << 31), rounding: null, stage: 'zero'
  };
  const p = bitLength(mantissa) - 1 + exponent;
  if (p > 127) return {
    bits: uint((sign << 31) | 0x7f800000), rounding: null, stage: 'overflow'
  };
  if (p >= -126) return packRounded(
    sign, p, roundPower2(mantissa, 23 - (bitLength(mantissa) - 1))
  );
  return packRounded(sign, -127, roundPower2(mantissa, exponent + 149));
}
function fromRatio(sign, num, den) {
  if (num === 0n) return uint(sign << 31);
  const p = floorLog2Ratio(num, den);
  if (p > 127) return uint((sign << 31) | 0x7f800000);
  if (p >= -126) return packRounded(sign, p, roundRatio(num, den, 23 - p)).bits;
  const rounded = roundRatio(num, den, 149);
  return uint((sign << 31) | (
    rounded.value >= 0x800000n ? 0x00800000 : Number(rounded.value)
  ));
}

/* Decimal text is parsed into an exact rational before one binary32 rounding. */
function parseDecimal(input) {
  const str = String(input).trim();
  if (/^[+-]?nan$/i.test(str)) return QNAN;
  if (/^[+-]?(?:inf|infinity)$/i.test(str))
    return str[0] === '-' ? 0xff800000 : 0x7f800000;
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(str);
  if (!match) throw Error('Enter a valid decimal number, Infinity, or NaN.');
  const sign = match[1] === '-' ? 1 : 0;
  const fractional = match[3] ?? match[4] ?? '';
  const digits = ((match[2] || '') + fractional).replace(/^0+/, '');
  if (!digits) return uint(sign << 31);
  if (digits.length > 1500) throw Error('Decimal input exceeds 1500 significant digits.');
  const exponentPart = match[5] ? Number(match[5]) : 0;
  const magnitude = digits.length + exponentPart - fractional.length;
  if (magnitude > 40) return uint((sign << 31) | 0x7f800000);
  if (magnitude < -50) return uint(sign << 31);
  const exp10 = exponentPart - fractional.length;
  const significand = BigInt(digits);
  const num = exp10 >= 0 ? significand * (10n ** BigInt(exp10)) : significand;
  const den = exp10 < 0 ? 10n ** BigInt(-exp10) : 1n;
  return fromRatio(sign, num, den);
}

function operate(aBits, bBits, operator) {
  const a = unpack(aBits), b = unpack(bBits);
  if (!['+', '-', '*'].includes(operator)) throw Error('Unsupported operator.');
  const nan = { bits: QNAN, rounding: null, stage: 'NaN' };
  if (a.kind === 'NaN' || b.kind === 'NaN') return nan;
  const bSign = b.sign ^ Number(operator === '-');

  if (operator === '*') {
    const sign = a.sign ^ b.sign;
    if ((a.kind === 'Infinity' && b.kind === 'Zero') ||
        (b.kind === 'Infinity' && a.kind === 'Zero')) return nan;
    if (a.kind === 'Infinity' || b.kind === 'Infinity') return {
      bits: uint((sign << 31) | 0x7f800000), rounding: null, stage: 'infinity'
    };
    return fromScaled(sign, a.mantissa * b.mantissa, a.exponent + b.exponent);
  }

  if (a.kind === 'Infinity' || b.kind === 'Infinity') {
    if (a.kind === 'Infinity' && b.kind === 'Infinity' && a.sign !== bSign) return nan;
    const sign = a.kind === 'Infinity' ? a.sign : bSign;
    return { bits: uint((sign << 31) | 0x7f800000), rounding: null, stage: 'infinity' };
  }
  if (a.kind === 'Zero' && b.kind === 'Zero') return {
    bits: uint((a.sign === bSign ? a.sign : 0) << 31),
    rounding: null, stage: 'signed zero'
  };

  const exponent = Math.min(a.exponent, b.exponent);
  const signedA = (a.sign ? -a.mantissa : a.mantissa) << BigInt(a.exponent - exponent);
  const signedB = (bSign ? -b.mantissa : b.mantissa) << BigInt(b.exponent - exponent);
  const sum = signedA + signedB;
  return fromScaled(sum < 0n ? 1 : 0, sum < 0n ? -sum : sum, exponent);
}

function exactDecimal(bits) {
  const a = unpack(bits);
  if (a.kind === 'NaN') return 'NaN';
  if (a.kind === 'Infinity') return a.sign ? '-Infinity' : 'Infinity';
  if (a.kind === 'Zero') return a.sign ? '-0' : '0';
  if (a.exponent >= 0)
    return (a.sign ? '-' : '') + (a.mantissa << BigInt(a.exponent)).toString();
  const places = -a.exponent;
  const str = (a.mantissa * (5n ** BigInt(places))).toString().padStart(places + 1, '0');
  const whole = str.slice(0, str.length - places);
  const frac = str.slice(str.length - places).replace(/0+$/, '');
  return (a.sign ? '-' : '') + whole + (frac ? '.' + frac : '');
}

// Sign, exponent and fraction as 0x-prefixed upper-case hex (1, 2 and 6 digits).
function fieldsHex(bits) {
  bits = uint(bits);
  const hex = (value, digits) => '0x' + value.toString(16).toUpperCase().padStart(digits, '0');
  return {
    sign: hex(bits >>> 31, 1),
    exponent: hex((bits >>> 23) & 255, 2),
    fraction: hex(bits & FRAC_MASK, 6)
  };
}

// Inverse of fieldsHex: takes ['0x0', '0x82', '0x540000'] style parts and returns the word.
function parseFieldsHex(parts) {
  const p = parts.map(x => x.slice(2));
  const valid = /^[01]$/.test(p[0]) && /^[\da-f]{1,2}$/i.test(p[1]) && /^[\da-f]{1,6}$/i.test(p[2]);
  if (!valid) throw Error('Hex fields: sign 0/1, exponent 00–FF, fraction 000000–7FFFFF.');
  const sign = parseInt(p[0], 16);
  const exponent = parseInt(p[1], 16);
  const fraction = parseInt(p[2], 16);
  if (exponent > 255 || fraction > FRAC_MASK) throw Error('A field is outside its bit range.');
  return uint((sign << 31) | (exponent << 23) | fraction);
}

function nextUp(bits) {
  bits = uint(bits);
  if (classify(bits) === 'NaN' || bits === 0x7f800000) return bits;
  if ((bits & 0x7fffffff) === 0) return 1;
  return uint((bits >>> 31) ? bits - 1 : bits + 1);
}
function nextDown(bits) {
  bits = uint(bits);
  if (classify(bits) === 'NaN' || bits === 0xff800000) return bits;
  if ((bits & 0x7fffffff) === 0) return 0x80000001;
  return uint((bits >>> 31) ? bits + 1 : bits - 1);
}
function neighbors(bits) {
  const lower = nextDown(bits), upper = nextUp(bits);
  if (classify(bits) === 'NaN') return { lower, upper, ulp: null };
  const view = new DataView(new ArrayBuffer(4));
  const value = u => { view.setUint32(0, uint(u)); return view.getFloat32(0); };
  const up = value(upper) - value(bits);
  const down = value(bits) - value(lower);
  const step = Number.isFinite(up) && up > 0 ? up : down;
  return {lower, upper, ulp: Number.isFinite(step) && step > 0 ? step : null};
}

const api = {classify,unpack,fieldsHex,parseFieldsHex,parseDecimal,operate,exactDecimal,nextUp,nextDown,neighbors};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Float32Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
