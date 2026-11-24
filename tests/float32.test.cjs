'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../float32-core.js');
const view = new DataView(new ArrayBuffer(4));
const floatOf = bits => { view.setUint32(0,bits>>>0); return view.getFloat32(0); };
const bitsOf = n => { view.setFloat32(0,n); return view.getUint32(0); };
test('reference decimal inputs and special values',()=>{
  for(const [input,word] of [['13.25',0x41540000],['0.1',0x3dcccccd],['-0',0x80000000],['Infinity',0x7f800000],['-Infinity',0xff800000],['1e-45',1],['16777217',0x4b800000]])
    assert.equal(core.parseDecimal(input),word,input);
  assert.equal(core.exactDecimal(0x3dcccccd),'0.100000001490116119384765625');
});
test('PDR arithmetic examples and tie-to-even',()=>{
  const n=x=>core.parseDecimal(x);
  assert.equal(core.operate(n('13.25'),n('2.5'),'+').bits,0x417c0000);
  assert.equal(core.operate(n('1.5'),n('2.25'),'+').bits,0x40700000);
  assert.equal(core.operate(n('3'),n('-2'),'*').bits,0xc0c00000);
  assert.equal(core.operate(n('16777216'),n('1'),'+').bits,0x4b800000);
});
test('special values, signed zero, subnormals and neighbors',()=>{
  const op=(a,b,s)=>core.operate(a,b,s).bits;
  assert.equal(core.classify(op(0x7f800000,0xff800000,'+')),'NaN');
  assert.equal(core.classify(op(0x7f800000,0,'*')),'NaN');
  assert.equal(op(0x80000000,0x80000000,'+'),0x80000000);
  assert.equal(op(0,0x80000000,'+'),0);
  assert.equal(op(1,1,'+'),2);
  assert.equal(core.nextUp(0x80000000),1);
  assert.equal(core.nextDown(0),0x80000001);
  assert.equal(core.neighbors(0x3f800000).ulp,2**-23);
});
test('random binary32 differential arithmetic, 30,000 operand pairs',()=>{
  let seed=0x13579bdf;
  const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  for(let i=0;i<30000;i++){
    const x=rand(),y=rand(),a=floatOf(x),b=floatOf(y);
    for(const sign of ['+','-','*']){
      const result=sign==='+'?a+b:sign==='-'?a-b:a*b;
      if(Number.isNaN(result))continue;
      const expected=bitsOf(Math.fround(result));
      assert.equal(core.operate(x,y,sign).bits,expected,
        sign+' operands 0x'+x.toString(16)+',0x'+y.toString(16));
    }
  }
});

test('fieldsHex formats sign, exponent and fraction',()=>{
  assert.deepEqual(core.fieldsHex(0x41540000),{sign:'0x0',exponent:'0x82',fraction:'0x540000'});
  assert.deepEqual(core.fieldsHex(0x80000001),{sign:'0x1',exponent:'0x00',fraction:'0x000001'});
  assert.deepEqual(core.fieldsHex(0xff800000),{sign:'0x1',exponent:'0xFF',fraction:'0x000000'});
});

test('fieldsHex round-trips through the S/E/M hex parser',()=>{
  let seed=0x2468ace1;
  const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  for(const word of [0,0x80000000,1,0x41540000,0x7f800000,0x7fc00000,0xffffffff])
    assert.equal(roundTrip(word),word);
  for(let i=0;i<10000;i++){const w=rand();assert.equal(roundTrip(w),w);}
  assert.throws(()=>core.parseFieldsHex(['0x2','0x00','0x000000']));
  assert.throws(()=>core.parseFieldsHex(['0x0','0x100','0x000000']));
  assert.throws(()=>core.parseFieldsHex(['0x0','0x00','0x800000']));
});
function roundTrip(word){
  const f=core.fieldsHex(word);
  return core.parseFieldsHex([f.sign,f.exponent,f.fraction]);
}

// Targeted generators for cases uniform random words rarely reach.
let seed=0xdeadbeef;
const ri=n=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n;
const word=(s,e,m)=>((s<<31)|(e<<23)|m)>>>0;
const M=()=>ri(0x800000);
const gens={
  cancellation:()=>{const e=1+ri(253),s=ri(2);return [word(s,e,M()),word(s^1,e+ri(2),M())];},
  subnormal:()=>[word(ri(2),ri(2),M()),word(ri(2),ri(2),M())],
  mulUnderflow:()=>[word(ri(2),1+ri(60),M()),word(ri(2),60+ri(60),M())],
  nearMax:()=>[word(ri(2),200+ri(55),M()),word(ri(2),200+ri(55),M())],
  ties:()=>{const mk=()=>word(ri(2),100+ri(60),(ri(4)<<21)|(ri(2)<<ri(23)));return [mk(),mk()];},
  expGap:()=>{const e=60+ri(100),g=22+ri(6);return [word(0,e,M()),word(0,e-g,M())];},
};
function checkAgainstFround(x,y){
  for(const op of ['+','-','*']){
    const a=floatOf(x),b=floatOf(y);
    const r=op==='+'?a+b:op==='-'?a-b:a*b;
    const got=core.operate(x,y,op).bits;
    if(Number.isNaN(r))assert.equal(core.classify(got),'NaN');
    else assert.equal(got,bitsOf(Math.fround(r)),`${op} 0x${x.toString(16)} 0x${y.toString(16)}`);
  }
}
for(const [name,gen] of Object.entries(gens)){
  test(`differential arithmetic: ${name}`,()=>{
    for(let i=0;i<50000;i++)checkAgainstFround(...gen());
  });
}

test('classification of every class',()=>{
  const cases=[
    [0x41540000,'Normalized'],[0x00800000,'Normalized'],[0x7f7fffff,'Normalized'],[0xc0000000,'Normalized'],
    [0x00000001,'Denormalized'],[0x007fffff,'Denormalized'],[0x80000001,'Denormalized'],
    [0x00000000,'Zero'],[0x80000000,'Zero'],
    [0x7f800000,'Infinity'],[0xff800000,'Infinity'],
    [0x7fc00000,'NaN'],[0xff800001,'NaN'],[0x7fffffff,'NaN'],
  ];
  for(const [bits,kind] of cases)assert.equal(core.classify(bits),kind,'0x'+bits.toString(16));
});

test('every class works in both operand positions',()=>{
  const samples=[0x41540000,0x00000001,0x80000000,0x7f800000,0xff800000,0x7fc00000];
  const seen=new Set();
  for(const x of samples)for(const y of samples){
    seen.add(core.classify(x)+'/'+core.classify(y));
    checkAgainstFround(x,y);
  }
  // all 25 ordered class pairs were exercised
  assert.equal(seen.size,25);
});

test.todo('exact examples from the course deck (waiting for the slides)');
