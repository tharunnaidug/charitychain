# CharityChain — architecture and data model

## High-level system

```text
Browser: React / Vite (port 5173)
  |
  |  JWT-protected JSON / multipart form requests
  v
Express REST API (port 5000) -------------> Local MongoDB (port 27017)
  |                                           Users, Charities, Campaigns, Bills
  |-- stores uploaded PDF/PNG/JPG in local uploads directory (private)
  |-- computes SHA-256 of exact uploaded bytes
  |-- verifies Ethereum receipts on the JSON-RPC provider
  v
Local Hardhat JSON-RPC (port 8545) <------- MetaMask + ethers.js
  |
  v
CharityEscrow.sol
  createCampaign / donate / submitBill / verifyBill /
  withdrawApprovedBill / claimRefund / processRefundForDonor
  |
  v
Events -> React public ledger + campaign & donor dashboards

Optional free local refund-bot -> provider unlocked Hardhat account #0
  calls processRefundForDonor() after expiry
```

## Data boundaries

**On-chain:** immutable contract admin, verifier wallet, per-campaign fundraiser, approved-metadata commitment hash, goal, hard deadline, contribution mapping, bill document hash + requested amount + status, approved reserve, escrow balance, withdrawal totals, donor refund state, events.

**MongoDB (off-chain):** user name, email, password hash, role, signed wallet linking, charity identity and review decision, campaign descriptions and state, bill purpose and local evidence metadata, administrative checklist audit.

**Local uploaded files:** user-submitted receipts/invoices. These are deliberately not stored on-chain; donors may view only approved/paid records. Avoid confidential data in the demo.

## Authorization

- Contract `admin`: the wallet that deployed it; can create/cancel campaigns and change verifier.
- Contract `verifier`: initially admin; may approve/reject bills; cannot be the fundraiser of the campaign.
- Contract `fundraiser`: address configured on-chain; only that wallet can submit bills and withdraw approved amounts.
- Contract `donor`: any address contributing ETH; refund must go to that donor's address.
- Backend roles are separate from contract address permissions. Every sensitive claimed chain action is cross-checked against actual transaction receipts and matching contract storage.

## State transitions

```text
Charity:    pending -> approved / rejected
Campaign:   pending -> published (on-chain) / rejected
Bill:       draft -> pending -> approved -> paid
                               \-> rejected
Campaign timeline: active -> expired (clock) OR cancelled (on-chain)
Refund:     not eligible -> eligible -> claimed (per donor)
```

A bill approval reserves that amount against competing bill approvals, but **reserves do not block refunds after expiry**. Any approved but unpaid bill loses payment eligibility at expiry. The refund pool is fixed when the first eligible refund is processed.

## External files and blockchain receipts

`bill.documentHash` is a SHA-256 digest of the **file bytes** in the Express server. The on-chain `bytes32 documentHash` matches that digest exactly. The chain does not fetch, parse or evaluate PDF data. In the admin workflow, approval means *a verifier attests off-chain authenticity and alignment with the campaign*.

For on-chain campaign publication: the API checks the receipt's destination contract, transaction sender, emitted `CampaignCreated` event and on-chain campaign's wallet/reference/goal/deadline against the trusted proposal in MongoDB. For bill linking, the API checks transaction destination/sender, actual `BillSubmitted` event and hash/amount/submitting address. For review, the API checks the `BillReviewed` event and validator address. These crosschecks prevent a browser from simply sending an untrusted `approved: true` flag.

## Frontend screens

- `/` — Overview and fundraising process
- `/campaigns` — Filterable published causes
- `/campaigns/:id` — Live balances, evidence, donation, refund button, latest donor transactions
- `/ledger` — Public on-chain event explorer
- `/dashboard` — Donor donation and refund portfolio
- `/charity` — Organization application, campaign creation, bill upload, one-time withdrawals
- `/admin` — Charity approval, on-chain campaign publication, bill verification checklist
- `/login`, `/register` — Auth
- `/setup` — Installation help
