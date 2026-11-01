# Imagify | Text-to-Image Generation with Credits

Imagify turns a text prompt into an image. Users sign up, get 5 free credits, spend one credit per image, and can buy more credits through Razorpay.

**Live demo:** https://imagify-project-phi.vercel.app

## Features

- Text-to-image generation through the [ClipDrop](https://clipdrop.co/apis) text-to-image API
- Email and password accounts: passwords hashed with bcrypt, sessions as JWTs that expire (7 days by default)
- Credit system: 5 free credits on sign-up, 1 credit per image, credit refunded if generation fails
- Credit packs paid in INR through Razorpay, with HMAC signature verification of every payment
- Download the generated image

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS, Motion, Axios |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth | bcrypt, JSON Web Tokens |
| Payments | Razorpay Orders API |
| Image generation | ClipDrop text-to-image API |
| Tests | Node.js test runner, Supertest |

## How the credit and payment logic stays correct

**Spending credits.** A generate request reserves its credit with one atomic MongoDB update:

```js
userModel.findOneAndUpdate(
  { _id: userId, creditBalance: { $gt: 0 } },
  { $inc: { creditBalance: -1 } }
)
```

The filter only matches while the balance is above zero, so parallel requests can never spend more credits than the user has. If ClipDrop fails, the credit is given back.

**Buying credits.** The server sets the price for each plan; the client only sends a plan id. After checkout, `/verify-razor` checks the Razorpay HMAC signature, confirms the order is paid, checks that the payment belongs to the logged-in user, and then marks the transaction paid with an atomic update on `{ payment: false }`. A duplicated or replayed callback therefore adds credits only once.

**Other safeguards.** Prompt length is limited to 1000 characters, image and login requests are rate limited, login gives the same error for an unknown email and a wrong password, and CORS can be restricted to the frontend origin.

## API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/user/register` | No | Create an account |
| POST | `/api/user/login` | No | Log in |
| GET | `/api/user/credits` | Yes | Current credit balance |
| POST | `/api/user/pay-razor` | Yes | Create a Razorpay order for a plan |
| POST | `/api/user/verify-razor` | Yes | Verify a payment and add credits |
| POST | `/api/image/generate-image` | Yes | Generate an image from a prompt |

Authenticated routes expect `Authorization: Bearer <token>`.

## Project structure

```
Imagify-Project/
├── client/              React frontend (Vite)
│   └── src/
│       ├── components/  UI sections, login modal, navbar
│       ├── context/     AppContext: auth state, credits, API calls
│       └── pages/       Home, Result (generate), BuyCredit
└── server/              Express API
    ├── app.js           Express app (routes, CORS, JSON parsing)
    ├── server.js        Connects to MongoDB, then starts the app
    ├── controllers/     image and user/payment handlers
    ├── middlewares/     JWT auth, rate limiting
    ├── model/           Mongoose models: user, transaction
    └── tests/           API tests
```

## Run locally

Requirements: Node.js 18+, a MongoDB database, a ClipDrop API key, and Razorpay test keys.

```bash
git clone https://github.com/console-log-life/Imagify-Project.git
cd Imagify-Project

# Backend
cd server
cp .env.example .env      # fill in the values
npm install
npm run dev               # http://localhost:4000

# Frontend (new terminal)
cd client
cp .env.example .env      # VITE_BACKEND_URL and VITE_RAZORPAY_KEY_ID
npm install
npm run dev               # http://localhost:5173
```

### Environment variables

`server/.env`

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime, optional (default `7d`) |
| `CLIPDROP_API` | ClipDrop API key |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS, comma separated; leave empty locally |
| `PORT` | API port (default 4000) |

`client/.env`

| Variable | Description |
| --- | --- |
| `VITE_BACKEND_URL` | Backend URL |
| `VITE_RAZORPAY_KEY_ID` | Razorpay key id (public) |

## Tests

```bash
cd server
npm test
```

The tests run against in-memory stand-ins for the database, so they need no MongoDB, ClipDrop or Razorpay account. They cover authentication, one credit per image, parallel requests not overspending credits, refunds on provider failure, forged payment signatures, duplicated payment callbacks, and payments redeemed by the wrong user.

## Known limitations

- Generated images are returned to the browser and not stored, so there is no image history.
- The rate limiter keeps counts in memory, so limits are per server instance.
