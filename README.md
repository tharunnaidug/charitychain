# CharityChain — Blockchain-Based Transparent Donation Management System

**A full-stack, smart contract-powered charity donation platform that makes fundraising, expense verification, withdrawals, and refunds traceable.**

> **Project status:** Local development and demonstration prototype. CharityChain currently uses **test ETH** on a **local Hardhat blockchain**, not real cryptocurrency or INR. Do not use it to collect real donations without additional security, compliance, and deployment work.

## 📌 About the Project

CharityChain addresses a common challenge in charitable fundraising: donors may be able to see how much money was collected, but not always how it was spent. The project combines a familiar web application with an Ethereum-compatible smart contract so that donations, bill approvals, withdrawals, and refunds can be independently traced through blockchain transactions and events.

A charity proposes a campaign, an administrator reviews and publishes it, and donors contribute test ETH using MetaMask. Funds remain in the **CharityEscrow** smart contract. A charity submits supporting expense evidence, an authorized verifier reviews it, and the charity can withdraw only through the contract's approved-bill workflow. When refunds become available, eligible donors can claim their share of unused funds.

### Project Objectives

- Improve visibility into donation collection and spending.
- Keep donated test ETH in smart contract-controlled escrow until permitted actions occur.
- Require independent bill review before an organization withdraws funds.
- Display an auditable history of donations, approvals, withdrawals, and refunds.
- Demonstrate how blockchain and a conventional database can work together.

## ✨ Key Features

| Feature | Description |
| --- | --- |
| Role-based dashboards | Separate experiences for **Admin**, **Charity Organization**, and **Donor**. |
| Charity and campaign workflow | Organizations propose campaigns; an admin reviews and publishes them. |
| MetaMask donations | Donors sign test ETH transactions through their linked wallets. |
| Campaign goal protection | Donation UI displays the remaining amount and prevents submitting amounts above the displayed remainder; the smart contract enforces its own funding rules. |
| Smart contract escrow | Donations remain in the contract until authorized spending or refund transactions. |
| Expense evidence | Organizations upload bills; a SHA-256 document hash helps detect later changes. |
| Verified withdrawals | An authorized verifier reviews a bill before the fundraiser can withdraw an approved amount. |
| Public blockchain ledger | View donation, bill submission, review, withdrawal, and refund events. |
| Donor refunds | Eligible donors can claim proportional unused funds after the refund conditions are met. |
| Local demonstration tools | Seeded accounts, test wallets, and Hardhat time advancement for a repeatable viva/demo flow. |

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, Vite, JavaScript | Web interface and role-based dashboards |
| Backend | Node.js, Express | APIs, authentication, and application logic |
| Database | MongoDB | Users, organizations, proposals, and bill metadata |
| Smart contract | Solidity — `CharityEscrow.sol` | Donation escrow, verification rules, withdrawals, and refunds |
| Blockchain development | Hardhat | Local Ethereum-compatible chain, deployment, and tests |
| Wallet integration | MetaMask, ethers.js | Account selection, signing, and contract interaction |
| Document integrity | SHA-256 | Hash-based evidence integrity checks |

## 🏗️ System Architecture

```text
                         CharityChain Web App
                              React + Vite
                                   |
                   +---------------+----------------+
                   |                                |
             Express API                    MetaMask + ethers.js
                   |                                |
                MongoDB                      Hardhat Local Node
                   |                         127.0.0.1:8545
         Users, charities,                          |
         campaign descriptions,              CharityEscrow.sol
         proposals, bill metadata                    |
                                           Donations / approvals /
                                           withdrawals / refunds
```

### Where is the blockchain stored?

The standard local Hardhat node runs at **`http://127.0.0.1:8545`** with **Chain ID `31337`**. That URL is an **RPC endpoint**, not a blockchain database folder. In the normal development setup, the blockchain's blocks, balances, transactions, and contract state are held in the running Hardhat process's **memory**.

**MongoDB and the blockchain are separate stores:** MongoDB persists ordinary application records, while the Hardhat chain holds the local smart contract's financial state and transaction history. Restarting a fresh Hardhat node resets its on-chain history, but does not automatically erase MongoDB records.

## 📂 Project Structure

```text
CharityChain/
├── blockchain/
│   ├── contracts/
│   │   └── CharityEscrow.sol
│   ├── scripts/
│   │   └── deploy.ts
│   ├── test/
│   │   └── CharityEscrow.ts
│   └── ...
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   └── scripts/
│   │       └── seedDemo.js
│   ├── .env.example
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminPortal.jsx
│   │   │   ├── CharityPortal.jsx
│   │   │   └── CampaignDetail.jsx
│   │   └── lib/
│   │       ├── chain.js
│   │       ├── wallet.jsx
│   │       └── useWallet.js
│   ├── .env.example
│   └── ...
├── DEMO_INVOICE.png
└── README.md
```

> The tree highlights key files, not every generated or dependency file.

## ✅ Prerequisites

- Node.js and npm compatible with the project's package manifests
- MongoDB Community Server (running locally)
- MetaMask browser extension
- A terminal (the commands below use **Windows Command Prompt**)
- Internet access for initial npm installation and any required compiler downloads

## ⚙️ Setup — First Time Only

Run these commands from the project root, one folder at a time:

```cmd
cd blockchain
npm install
npm run compile
npm run test
cd ..\backend
npm install
copy .env.example .env
cd ..\frontend
npm install
copy .env.example .env
cd ..
```

If `blockchain/node_modules` is left over from an earlier Hardhat version, move that folder aside before reinstalling. Do **not** use `--force` or `--legacy-peer-deps` to hide dependency errors.

In **`backend/.env`**, set `JWT_SECRET` to your own random string of at least 32 characters. See the `.env.example` files for development configuration examples.

Start **MongoDB Community Server** using Windows Services → MongoDB Server, or start `mongod` from your MongoDB installation.

> **Security:** Never commit real `.env` files, private keys, secrets, database credentials, or uploaded private documents to GitHub. Commit only safe `.env.example` templates. Keep Hardhat's publicly known development keys strictly separate from wallets containing real assets.

## ▶️ Start the Project — Four Terminals

You can also use the project's numbered Windows `.cmd` shortcuts, if present.

**Terminal 1 — Start the blockchain (leave running):**

```cmd
cd blockchain
npm run node
```

**Terminal 2 — Deploy after the node starts:**

```cmd
cd blockchain
npm run deploy
npm run check:chain
```

**Terminal 3 — Seed and start the backend (leave running):**

```cmd
cd backend
npm run seed:demo
npm run dev
```

**Terminal 4 — Start the frontend (leave running):**

```cmd
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173** in your browser.

## 🦊 Connect MetaMask — Critical

Configure a **local development network** in MetaMask:

| Setting | Value |
| --- | --- |
| Network RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | Test ETH (free on Hardhat; no fiat value) |

Import the **local development accounts** displayed by `npm run node`. Use a **separate, test-only browser wallet profile**. Never import public Hardhat private keys into a wallet that holds real assets.

The website header shows both the selected MetaMask wallet and the wallet linked to the logged-in account. **Both must match** for fundraiser/admin actions. Changing website login does **not** automatically switch the selected MetaMask account.

## 👥 Demo Login Credentials — Local Test Data Only

Run `cd backend && npm run seed:demo` to create missing demo accounts.

| Role | Email | Hardhat account |
| --- | --- | --- |
| Admin | `demo-admin@charitychain.local` | `#0` |
| Charity | `demo-charity@charitychain.local` | `#1` |
| Donor A | `demo-donor-a@charitychain.local` | `#2` |
| Donor B | `demo-donor-b@charitychain.local` | `#3` |

**Password for newly seeded users:** `DemoOnly@12345`

The seed script **does not overwrite** an existing account's password or wallet. If a demo user already exists, use that account's original credentials. **Never expose demo accounts on the internet.**

## 🎬 Live Demo — Exact Order

Follow this sequence to demonstrate the complete donation-to-refund lifecycle:

1. **Admin** — Log in with the admin account and select MetaMask **Account #0**. Open `/admin` → Campaigns and publish **Demo Books for Students** (pre-created by the seed).
2. **Donor A** — Log in and select **Account #2**. Open the campaign and donate **2 test ETH**.
3. **Donor B** — Log in and select **Account #3**. Donate **1 test ETH**.
4. **Charity** — Log in and select **Account #1**. Open the published campaign and upload **`DEMO_INVOICE.png`** (included in the project root) for **1 test ETH**. Confirm the `submitBill` transaction in MetaMask.
5. **Admin / Verifier** — Log in with **Account #0**. Open Bill verification, inspect the evidence, tick all four checks, and approve the `verifyBill` transaction.
6. **Charity** — Switch to **Account #1**, select the approved bill, and click **Withdraw**.
7. **Public Ledger** — Confirm `Donations`, `BillSubmitted`, `BillReviewed`, and `FundsWithdrawn` events. **2 ETH** should remain in escrow.
8. **Advance local time** — In the `blockchain` folder, run `npm run time:advance` (31-day local time travel). **Warning:** This changes Hardhat block time only; it does not change real-world time.
9. **Donor A** — Switch to **Account #2** and claim the refund (approximately **1.3333 test ETH**).
10. **Donor B** — Switch to **Account #3** and claim the refund (approximately **0.6667 test ETH**).
11. **Public Ledger** — Verify both refund events. Optional watcher:

   ```cmd
   cd blockchain
   npm run refunds:watch
   ```

### Demo Calculation

| Item | Test ETH |
| --- | ---: |
| Donor A contribution | 2.0000 |
| Donor B contribution | 1.0000 |
| **Total raised** | **3.0000** |
| Approved expense and withdrawal | 1.0000 |
| **Unused funds** | **2.0000** |
| Donor A proportional refund | ≈ 1.3333 |
| Donor B proportional refund | ≈ 0.6667 |

The refunds above assume the demo completes as described and no additional spending or donations change the balances. Test ETH gas costs are separate.

## 🔄 If You Reset Hardhat

**Every fresh standard Hardhat node starts without the previous on-chain transactions.** MongoDB persists independently. Existing MongoDB campaigns may point to on-chain campaign IDs or contract deployments that are no longer present after a reset.

The application includes stale-campaign detection and warning messages. Run `npm run seed:demo` to create a fresh **pending** proposal if none exists, or create a proposal in the Charity portal and publish it through the admin workflow.

- Do **not** manually set `chainCampaignId=1` in MongoDB.
- Do **not** erase historical MongoDB records unless you intentionally want to discard old demo history.
- Redeploy the contract after a fresh Hardhat node starts.
- Refresh the frontend after deployment.

## 🧰 Troubleshooting

| Problem | What to check |
| --- | --- |
| `Admin only` | The website admin login is not enough; select blockchain admin **MetaMask Account #0**. |
| `Fundraiser only` | Select the registered fundraiser wallet (**Account #1** for the seeded charity). Do not change the approved charity's wallet directly in MongoDB. |
| `Unknown campaign` | The MongoDB record may reference an old on-chain campaign after a Hardhat reset. Create and publish a **new** proposal or use a persistent chain instance. |
| `StackUnderflow` | Check that `npm run compile` and `npm run test` pass. The project uses the Cancun EVM/hardfork configuration. Stop old Hardhat processes before restarting; record the full error if it persists. Do not send ETH while unresolved. |
| `Contract not found` | Redeploy after a reset, then refresh the frontend. |
| `could not coalesce error` | Inspect the Hardhat terminal for the underlying revert reason. |
| `ERESOLVE` | The project's toolbox dependency expects Mocha 12; use the aligned `package.json`. |
| `Invalid email/password` | Run `npm run seed:demo` and use the demo email/password; existing users retain their original credentials. |
| `$0.00` in MetaMask | Expected: local test ETH has no real fiat value. |
| React Fast Refresh warning | Wallet hook logic was moved to `useWallet.js` to reduce reload issues. |

## 🧑‍💻 Editable Code Map

| File | Responsibility |
| --- | --- |
| `frontend/src/pages/AdminPortal.jsx` | Admin dashboard, campaign publishing, bill review |
| `frontend/src/pages/CharityPortal.jsx` | Campaign proposals, bill uploads, charity workflow |
| `frontend/src/pages/CampaignDetail.jsx` | Donations, on-chain history, refunds, stale-campaign detection |
| `frontend/src/lib/wallet.jsx` | MetaMask account monitoring and wallet linkage |
| `frontend/src/lib/chain.js` | ethers.js blockchain reads and writes |
| `backend/src/routes/` | Express endpoints and MongoDB interaction |
| `backend/src/scripts/seedDemo.js` | Demo users and campaign records |
| `blockchain/contracts/CharityEscrow.sol` | Escrow logic, balances, bill and refund rules |
| `blockchain/test/CharityEscrow.ts` | Smart contract authorization, withdrawal, and refund tests |
| `blockchain/scripts/deploy.ts` | Contract deployment and ABI/address distribution |

## 🔐 Security and Trust Model

- **On-chain authorization:** The smart contract enforces its own permissions and transaction conditions; hiding buttons in the frontend is not a substitute for contract checks.
- **Independent review:** A bill must be approved by an authorized verifier before the related withdrawal can proceed.
- **Document integrity:** A SHA-256 hash helps detect changes to a bill after its hash is recorded; **a hash does not prove the original document is genuine**.
- **Auditability:** The public ledger displays blockchain events. In this local prototype, that history exists only while the current Hardhat chain state is retained.
- **Prototype limits:** A single local Hardhat node is **not** a decentralized production network. Demo credentials, public development keys, and test ETH are not suitable for real-money operation.

## 🚀 Future Enhancements

- **INR and UPI donations:** Integrate a compliant payment gateway and record verified payment references on-chain. Actual rupees would move through banking/payment systems, **not** be held as ETH in the existing escrow contract.
- **Public or consortium network deployment:** Move beyond the single-node local prototype after security review.
- **Independent admin and verifier wallets:** Strengthen separation of duties.
- **Improved evidence management:** Consider decentralized file storage and stronger document verification.
- **Production monitoring and security:** Add contract audits, reconciliation, access controls, and operational safeguards.

## 🧪 Verification Notes

The README describes the intended project workflow; **it is not a claim that the entire integration has been tested in every environment**. Initial npm installation and compiler downloads require internet access. Verify the project on your own machine using:

```cmd
cd blockchain
npm run test
npm run check:chain
```

Also complete a browser walkthrough covering wallet linking, campaign publishing, donations, bill approval, withdrawal, and refunds.

**CharityChain — Making donations more transparent through smart contract-controlled escrow and verifiable financial events.**
