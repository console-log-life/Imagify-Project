import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { db, resetDb, addUser, tokenFor } from './helpers.js';
import app from '../app.js';
import { imageProvider } from '../controllers/imageController.js';

let providerCalls;
beforeEach(() => {
  resetDb();
  providerCalls = 0;
  imageProvider.textToImage = async () => {
    providerCalls += 1;
    await new Promise((r) => setTimeout(r, 20)); // simulate network latency
    return Buffer.from('png-bytes');
  };
});

const generate = (user, prompt = 'a red fox') =>
  request(app).post('/api/image/generate-image')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ prompt });

test('rejects requests without a token', async () => {
  const res = await request(app).post('/api/image/generate-image').send({ prompt: 'x' });
  assert.equal(res.status, 401);
});

test('spends exactly one credit for a generated image', async () => {
  const user = await addUser({ creditBalance: 3 });
  const res = await generate(user);
  assert.equal(res.status, 200);
  assert.equal(res.body.creditBalance, 2);
  assert.match(res.body.resultImage, /^data:image\/png;base64,/);
  assert.equal(db.users.get(user._id).creditBalance, 2);
});

test('returns 402 and does not call the provider when credits are 0', async () => {
  const user = await addUser({ creditBalance: 0 });
  const res = await generate(user);
  assert.equal(res.status, 402);
  assert.equal(providerCalls, 0);
});

test('concurrent requests cannot spend more credits than the user has', async () => {
  const user = await addUser({ creditBalance: 1 });
  const results = await Promise.all([generate(user), generate(user), generate(user)]);
  const ok = results.filter((r) => r.status === 200).length;
  assert.equal(ok, 1, 'only one of three parallel requests may succeed');
  assert.equal(providerCalls, 1);
  assert.equal(db.users.get(user._id).creditBalance, 0);
});

test('refunds the credit when the image provider fails', async () => {
  imageProvider.textToImage = async () => { throw new Error('provider down'); };
  const user = await addUser({ creditBalance: 2 });
  const res = await generate(user);
  assert.equal(res.status, 502);
  assert.equal(db.users.get(user._id).creditBalance, 2);
});

test('rejects empty and over-long prompts without spending credits', async () => {
  const user = await addUser({ creditBalance: 2 });
  assert.equal((await generate(user, '   ')).status, 400);
  assert.equal((await generate(user, 'a'.repeat(1001))).status, 400);
  assert.equal(db.users.get(user._id).creditBalance, 2);
});

test('does not show the provider\'s own billing error to the user', async () => {
  imageProvider.textToImage = async () => {
    const error = new Error('Request failed with status code 402');
    error.response = { status: 402, data: Buffer.from(JSON.stringify({ error: 'Not enough credits to process the request' })) };
    throw error;
  };
  const user = await addUser({ creditBalance: 5 });
  const res = await generate(user);
  assert.equal(res.status, 502);
  assert.doesNotMatch(res.body.message, /not enough credits/i);
  assert.equal(db.users.get(user._id).creditBalance, 5);
});
