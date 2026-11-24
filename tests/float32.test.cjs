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
