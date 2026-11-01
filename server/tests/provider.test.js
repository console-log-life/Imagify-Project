import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { imageProvider } from '../controllers/imageController.js';

const realPost = axios.post;
afterEach(() => {
  axios.post = realPost;
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_API_TOKEN;
});

test('uses Cloudflare Workers AI when its credentials are set', async () => {
  process.env.CF_ACCOUNT_ID = 'acc123';
  process.env.CF_API_TOKEN = 'tok456';
  let call;
  axios.post = async (url, body, options) => {
    call = { url, body, options };
    return { data: { success: true, result: { image: Buffer.from('jpeg-bytes').toString('base64') } } };
  };
  const image = await imageProvider.textToImage('a red fox');
  assert.equal(call.url, 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-1-schnell');
  assert.deepEqual(call.body, { prompt: 'a red fox', steps: 4 });
  assert.equal(call.options.headers.Authorization, 'Bearer tok456');
  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(image.data.toString(), 'jpeg-bytes');
});

test('falls back to ClipDrop when Cloudflare is not configured', async () => {
  let url;
  axios.post = async (u) => { url = u; return { data: Buffer.from('png-bytes') }; };
  const image = await imageProvider.textToImage('a red fox');
  assert.equal(url, 'https://clipdrop-api.co/text-to-image/v1');
  assert.equal(image.mimeType, 'image/png');
});

test('throws when Cloudflare answers without an image', async () => {
  process.env.CF_ACCOUNT_ID = 'acc';
  process.env.CF_API_TOKEN = 'tok';
  axios.post = async () => ({ data: { success: false, errors: [{ message: 'quota' }] } });
  await assert.rejects(imageProvider.textToImage('x'));
});
