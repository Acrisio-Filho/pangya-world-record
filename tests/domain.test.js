const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { VotingPolicy, RecordPolicy, RecordDraft } = vm.runInNewContext(['records/domain/record.js', 'records/domain/ranking.js', 'community/domain/voting.js'].map(file => fs.readFileSync('backend/src/modules/' + file, 'utf8')).join('\n') + '\n({ VotingPolicy, RecordPolicy, RecordDraft })');
test('community requires quorum, three voters and a strict two-to-one majority', () => {
  assert.equal(VotingPolicy.decide({ approve: 100, reject: 0, voters: 2 }), null);
  assert.equal(VotingPolicy.decide({ approve: 49, reject: 0, voters: 3 }), null);
  assert.equal(VotingPolicy.decide({ approve: 50, reject: 25, voters: 3 }), null);
  assert.equal(VotingPolicy.decide({ approve: 50, reject: 24, voters: 3 }), 'approved');
  assert.equal(VotingPolicy.decide({ approve: 24, reject: 50, voters: 3 }), 'rejected');
});
test('ranking orders by lower score, breaking ties by higher Pang', () => {
  assert.ok(RecordPolicy.compare({ score: -30, pang: 1 }, { score: -29, pang: 999 }) < 0);
  assert.ok(RecordPolicy.compare({ score: -30, pang: 999 }, { score: -30, pang: 1 }) < 0);
  assert.equal(RecordPolicy.isPublished({ status: 'pending', community: 1 }), false);
});

test('record draft rejects missing scores, invalid Pang and missing unassisted video', () => {
  const valid = { course_id: 'blue_water', power_value: 245, score: -25, method: 'com_ajuda', wind: 'normal' };
  for (const score of [null, '', ' ', undefined, Infinity, -1.2]) assert.throws(() => RecordDraft({ ...valid, score }));
  for (const pang of [-1, 'oops', Infinity, 1.2]) assert.throws(() => RecordDraft({ ...valid, pang }));
  assert.throws(() => RecordDraft({ ...valid, method: 'sem_ajuda' }));
  assert.equal(RecordDraft(valid).score, -25);
  assert.ok(Object.isFrozen(RecordDraft(valid)));
});
