'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const evidence=require('../dist/evidence-packs.js');

test('only three bounded packs are enabled; unrelated topics have no pack',()=>{
  assert.equal(Object.values(evidence.packs).filter(p=>p.enabled).length,3);
  for(const topic of ['other','protein','coding','credit','salary'])assert.equal(evidence.getPack(topic),null);
  assert.equal(evidence.getPack('skills').id,'study');
  assert.equal(evidence.getPack('childStudy').id,'study');
});

test('every deliverable claim carries a stable source and scope locator',()=>{
  const ids=new Set();
  for(const pack of Object.values(evidence.packs)){
    assert.equal(pack.claims.length,5);
    assert.ok(pack.scope&&pack.boundary&&pack.version);
    for(const claim of pack.claims){
      assert.ok(!ids.has(claim.id));ids.add(claim.id);
      assert.equal(new URL(claim.url).protocol,'https:');
      for(const field of ['source_id','source','locator','evidence_note','audit_date'])assert.ok(claim[field]);
      assert.equal(claim.audit_status,'source_checked');
    }
  }
});

test('both conditions keep identical five claim units and word budgets',()=>{
  for(const pack of Object.values(evidence.packs)){
    const fixed=evidence.selectClaims(pack,'Fixed brief','equipment practice testing style');
    const personal=evidence.selectClaims(pack,'Personalized','equipment practice testing style');
    assert.deepEqual(fixed.map(c=>c.id).sort(),personal.map(c=>c.id).sort());
    const words=claims=>claims.reduce((n,c)=>n+c.text.split(/\s+/).length,0);
    assert.equal(words(fixed),words(personal));
  }
});

test('personalization changes order without changing approved wording',()=>{
  const pack=evidence.packs.activity;
  const result=evidence.selectClaims(pack,'Personalized','Only gym equipment and machines count.');
  assert.equal(result[0].id,'C4');
  assert.equal(result[0].text,pack.claims.find(c=>c.id==='C4').text);
  assert.equal(pack.claims[0].id,'C1');
});

test('same topic words cannot authorize unsupported or overbroad assertions',()=>{
  assert.deepEqual(evidence.exactSupport('activity','Walking outside a gym guarantees identical muscle growth and perfect consistency for every person.'),[]);
  assert.deepEqual(evidence.exactSupport('learning','Learning styles never help anybody.'),[]);
  assert.deepEqual(evidence.exactSupport('study','Practice testing guarantees a perfect exam score.'),[]);
  assert.deepEqual(evidence.exactSupport('study',evidence.packs.activity.claims[0].text),[]);
  assert.deepEqual(evidence.exactSupport('unknown','anything'),[]);
  assert.deepEqual(evidence.exactSupport('activity',evidence.packs.activity.claims[0].text),['C1']);
});

test('audited library is immutable and retains evidence favourable to matching',()=>{
  assert.throws(()=>{evidence.packs.study.claims[0].text='invented';},TypeError);
  assert.throws(()=>{evidence.packs.activity.enabled=false;},TypeError);
  assert.match(evidence.packs.learning.claims.find(c=>c.id==='L3').text,/small average learning benefit/);
  assert.match(evidence.packs.learning.boundary,/preference can remain valid/);
});
