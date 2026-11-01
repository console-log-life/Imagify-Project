// In-memory stand-ins for the Mongoose models, so the tests need no database.
// They implement only the queries the controllers use, with the same atomic
// semantics MongoDB gives findOneAndUpdate / updateOne on a single document.
import jwt from 'jsonwebtoken';
import userModel from '../model/usermodel.js';
import { transactionModel } from '../model/transactionModel.js';

process.env.JWT_SECRET = 'test-secret';
process.env.RAZORPAY_KEY_SECRET = 'rzp-test-secret';

let nextId = 1;
const newId = () => String(nextId++).padStart(24, '0');

export const db = { users: new Map(), transactions: new Map() };

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && '$gt' in cond) return value > cond.$gt;
    return String(value) === String(cond);
  });

const applyUpdate = (doc, update) => {
  for (const [k, v] of Object.entries(update.$inc || {})) doc[k] += v;
  for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
};

const query = (value) => ({
  collation: () => Promise.resolve(value),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const findIn = (store, filter) => [...store.values()].find((d) => matches(d, filter)) || null;

const stubModel = (model, store, defaults = {}) => {
  model.findById = async (id) => store.get(String(id)) || null;
  model.findOne = (filter) => {
    const lowered = filter.email ? { ...filter, email: filter.email.toLowerCase() } : filter;
    const found = [...store.values()].find((d) =>
      Object.entries(lowered).every(([k, v]) => String(d[k]).toLowerCase() === String(v).toLowerCase())) || null;
    return query(found);
  };
  model.exists = async (filter) => (findIn(store, filter) ? { _id: filter._id } : null);
  model.create = async (data) => {
    const doc = { ...defaults, ...data, _id: newId() };
    store.set(doc._id, doc);
    return doc;
  };
  // Synchronous body: no await between the check and the write, like a
  // single-document atomic update on the database.
  model.findOneAndUpdate = async (filter, update) => {
    const doc = findIn(store, filter);
    if (!doc) return null;
    applyUpdate(doc, update);
    return { ...doc };
  };
  model.updateOne = async (filter, update) => {
    const doc = findIn(store, filter);
    if (doc) applyUpdate(doc, update);
    return { modifiedCount: doc ? 1 : 0 };
  };
};

export const resetDb = () => {
  db.users.clear();
  db.transactions.clear();
  stubModel(userModel, db.users, { creditBalance: 5 });
  stubModel(transactionModel, db.transactions, { payment: false });
};

export const addUser = async (fields = {}) =>
  userModel.create({ name: 'Test', email: `u${nextId}@example.com`, password: 'x', ...fields });

export const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET);
