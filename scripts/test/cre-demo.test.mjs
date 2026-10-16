import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface, keccak256, id } from 'ethers';
import { MOCK_FORWARDER, DEMO_ABI, verifyDemoReceipt } from '../lib/cre-demo.mjs';
const receiver = '0x0000000000000000000000000000000000000011';
const deployer = '0x0000000000000000000000000000000000000012';
const result = { request: { requestId: id('request') }, approved: true, validUntil: 2000000000, encodedReport: '0x1234' };
function receipt() {
  const iface = new Interface(DEMO_ABI);
  const event = iface.encodeEventLog(iface.getEvent('SimulationReportRecorded'), [result.request.requestId, true, result.validUntil, keccak256(result.encodedReport)]);
  return { status: 1, hash: id('tx'), to: MOCK_FORWARDER, from: deployer, blockNumber: 42, blockHash: id('block'), logs: [{ address: receiver, ...event }] };
}
test('requires the exact receiver event and labels verified receipts as unverified workflow identity', () => {
  const verified = verifyDemoReceipt(receipt(), receiver, deployer, result);
  assert.equal(verified.receiptVerified, true);
  assert.equal(verified.workflowIdentityVerified, false);
});
test('does not claim publication for reverted or unrelated transactions', () => {
  for (const change of [{ status: 0 }, { to: receiver }, { from: receiver }, { logs: [] }]) assert.throws(() => verifyDemoReceipt({ ...receipt(), ...change }, receiver, deployer, result));
});
test('a successful write for another report is not evidence of this authorization', () => {
  assert.throws(() => verifyDemoReceipt(receipt(), receiver, deployer, { ...result, encodedReport: '0xabcd' }));
  assert.throws(() => verifyDemoReceipt(receipt(), receiver, deployer, { ...result, approved: false }));
});
