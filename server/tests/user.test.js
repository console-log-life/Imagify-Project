import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { db, resetDb, addUser, tokenFor } from './helpers.js';
import app from '../app.js';
import { razorpayClient } from '../controllers/userController.js';
import { transactionModel } from '../model/transactionModel.js';

beforeEach(() => resetDb());

test('register stores a bcrypt hash and returns a token that expires', async () => {
  const res = await request(app).post('/api/user/register')
    .send({ name: 'Asha', email: 'Asha@Example.com ', password: 'secret1' });
  assert.equal(res.status, 201);
  const stored = [...db.users.values()][0];
  assert.equal(stored.email, 'asha@example.com');
  assert.notEqual(stored.password, 'secret1');
  assert.ok(jwt.decode(res.body.token).exp, 'token should carry an expiry');
});

test('register rejects a short password', async () => {
  const res = await request(app).post('/api/user/register')
    .send({ name: 'A', email: 'a@b.co', password: '123' });
  assert.equal(res.status, 400);
});

test('login gives the same answer for unknown email and wrong password', async () => {
  await request(app).post('/api/user/register').send({ name: 'A', email: 'a@b.co', password: 'secret1' });
  const unknown = await request(app).post('/api/user/login').send({ email: 'nobody@b.co', password: 'secret1' });
  const wrong = await request(app).post('/api/user/login').send({ email: 'a@b.co', password: 'nope123' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.body.message, wrong.body.message);
});

const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

const paidOrder = async (user) => {
  const tx = await transactionModel.create({ userId: user._id, plan: 'Basic', credits: 100, amount: 10 });
  razorpayClient.instance = { orders: { fetch: async () => ({ status: 'paid', receipt: tx._id }) } };
  return { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') };
};

const verify = (user, body) =>
  request(app).post('/api/user/verify-razor').set('Authorization', `Bearer ${tokenFor(user)}`).send(body);

test('payment verification rejects a forged signature', async () => {
  const user = await addUser({ creditBalance: 0 });
  const body = await paidOrder(user);
  const res = await verify(user, { ...body, razorpay_signature: 'f'.repeat(64) });
  assert.equal(res.status, 400);
  assert.equal(db.users.get(user._id).creditBalance, 0);
});

test('a duplicated payment callback adds credits only once', async () => {
  const user = await addUser({ creditBalance: 0 });
  const body = await paidOrder(user);
  const results = await Promise.all([verify(user, body), verify(user, body)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal(db.users.get(user._id).creditBalance, 100);
});

test('a user cannot redeem another user\'s payment', async () => {
  const owner = await addUser({ creditBalance: 0 });
  const other = await addUser({ creditBalance: 0 });
  const body = await paidOrder(owner);
  const res = await verify(other, body);
  assert.equal(res.status, 403);
  assert.equal(db.users.get(owner._id).creditBalance, 0);
});

test('unknown plan ids are rejected', async () => {
  const user = await addUser();
  const res = await request(app).post('/api/user/pay-razor')
    .set('Authorization', `Bearer ${tokenFor(user)}`).send({ planId: 'Free' });
  assert.equal(res.status, 400);
});
