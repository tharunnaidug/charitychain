import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarClock, CheckCircle2, FileCheck2, Heart, LockKeyhole, RotateCcw, ShieldCheck, Wallet, ExternalLink } from "lucide-react";
import { ethers } from "ethers";
import { api, openEvidence } from "../lib/api";
import { DEPLOYED, readContract, writeContract, eth, shorten, isOpen, refundOpen, referenceHash } from "../lib/chain";
import { useWallet } from "../lib/useWallet";
import { useAuth } from "../lib/useAuth";
import { Empty, Notice, Spinner, Status, Tag } from "../components/Common";
import { categories } from "../components/categories";
import { prettyDate } from "../components/format";
export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth(), { address, connect } = useWallet();
  const [campaign, setCampaign] = useState(null), [chain, setChain] = useState(null), [bills, setBills] = useState([]);
  const [chainNow, setChainNow] = useState(Math.floor(Date.now() / 1000));
  const [contribution, setContribution] = useState(0n), [claimed, setClaimed] = useState(false), [quote, setQuote] = useState(0n), [events, setEvents] = useState([]);
  const [amount, setAmount] = useState("0.1"), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [chainMissing, setChainMissing] = useState(false);
  async function refresh() {
    setChainMissing(false);
    const { campaign: c } = await api(`/campaigns/${id}`);
    setCampaign(c);
    setBills([]);
    if (DEPLOYED) {
      const contract = readContract();
      const exists = await contract.campaignCount();
      if (!c.chainCampaignId || BigInt(c.chainCampaignId) > exists || BigInt(c.chainCampaignId) < 1n) {
        setChain(null); setChainMissing(true);
        setError("This MongoDB campaign is from a previous local Hardhat run. Its on-chain ID is missing. Publish a fresh demo campaign; do not edit blockchain IDs manually.");
        return;
      }
      const [state, block] = await Promise.all([
        contract.getCampaign(c.chainCampaignId), contract.runner.provider.getBlock("latest")
      ]);
      // Contract ID might exist on a RESET chain but now refer to a different campaign.
      if (state.referenceHash.toLowerCase() !== referenceHash(c).toLowerCase()) {
        setChain(null); setChainMissing(true);
        setError("MongoDB campaign does not match the contract at this on-chain ID. Create a fresh demo campaign, preserving existing historical data.");
        return;
      }
      setError(""); setChain(state);
      setChainNow(Number(block.timestamp));
      if (address) {
        const [myTotal, refund, wasClaimed] = await Promise.all([
          contract.donations(c.chainCampaignId, address),
          contract.getRefundQuote(c.chainCampaignId, address),
          contract.refundClaimed(c.chainCampaignId, address)
        ]);
        setContribution(myTotal); setQuote(refund); setClaimed(wasClaimed);
      } else { setContribution(0n); setClaimed(false); setQuote(0n); }
      const logs = await contract.queryFilter(contract.filters.DonationReceived(BigInt(c.chainCampaignId)), 0, "latest");
      setEvents([...logs].reverse());
    }
    // Fetch evidence only after validating the on-chain campaign reference.
    // This avoids querying stale MongoDB bills against a reset Hardhat chain.
    const { bills } = await api(`/bills?campaignId=${id}`);
    setBills(bills);
  }
  useEffect(() => { setLoading(true); refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [id, address]);
  async function takeAction(action) {
    setBusy(true); setError(""); setSuccess("");
    try { const tx = await action(); if (tx) { const receipt = await tx.wait(); setSuccess(`Confirmed on blockchain: ${receipt.hash}`); } await refresh(); }
    catch (e) { setError(e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }
  async function makeDonation() {
    // Only donors can contribute through CharityChain.
    if (user?.role !== "donor") {
      throw new Error("Only donor accounts can donate.");
    }

    if (!campaign?.chainCampaignId || !chain) {
      throw new Error("Campaign is not available on the blockchain.");
    }

    // Validate the entered amount.
    let value;

    try {
      value = ethers.parseEther(amount);
    } catch {
      throw new Error("Enter a valid ETH amount.");
    }

    if (value <= 0n) {
      throw new Error("Donation must be greater than zero.");
    }

    // Read the latest on-chain values immediately before donating.
    const contract = readContract();
    const latestCampaign = await contract.getCampaign(
      campaign.chainCampaignId
    );

    const latestGoal = BigInt(latestCampaign.goal);
    const latestRaised = BigInt(latestCampaign.totalDonated);

    const latestRemaining =
      latestGoal > latestRaised ? latestGoal - latestRaised : 0n;

    if (latestRemaining === 0n) {
      throw new Error("Campaign goal has already been reached.");
    }

    if (value > latestRemaining) {
      await refresh();

      throw new Error(
        `Only ${ethers.formatEther(latestRemaining)} ETH remains. ` +
        "Please reduce your donation amount."
      );
    }

    // Send transaction only after validation.
    const writableContract = await writeContract();

    return writableContract.donate(
      campaign.chainCampaignId,
      { value }
    );
  }
  const meta = categories[campaign?.category] || categories.Other;
  const Icon = meta.icon;
  const goal = BigInt(campaign?.goalWei || 1);
  const raised = chain?.totalDonated || 0n;

  // Calculate the maximum additional donation allowed.
  const remainingWei = goal > raised ? goal - raised : 0n;
  const remainingEth = ethers.formatEther(remainingWei);

  // Validate donation amount using wei to avoid decimal rounding errors.
  let donationWei = 0n;
  let amountError = "";

  try {
    donationWei = ethers.parseEther(amount);

    if (donationWei <= 0n) {
      amountError = "Enter a donation amount greater than zero.";
    } else if (remainingWei === 0n) {
      amountError = "This campaign has reached its funding goal.";
    } else if (donationWei > remainingWei) {
      amountError = `You can donate a maximum of ${remainingEth} ETH.`;
    }
  } catch {
    amountError = "Enter a valid ETH amount.";
  }
  const pct = Number(goal ? raised * 100n / goal : 0n);
  if (loading) return <div className="container page-pad"><Spinner /></div>;
  if (!campaign) return <div className="container page-pad"><Notice text={error || "Campaign not found"} type="error" /><Link className="inline-link" to="/campaigns">Back to campaigns</Link></div>;
  
return (
  <div className="container page-pad detail-page">
    {/* Back navigation */}
    <Link className="back-link" to="/campaigns">
      <ArrowLeft size={17} />
      All campaigns
    </Link>

    {/* Campaign header */}
    <div className="detail-header">
      <div>
        <div className="eyebrow">
          {campaign.category.toUpperCase()} · BLOCKCHAIN FUNDRAISER
        </div>

        <h1>{campaign.title}</h1>
        <p>{campaign.summary}</p>

        <div className="detail-tags">
          <Tag tone="green">
            <ShieldCheck size={13} />
            Verified charity
          </Tag>

          {chain && (
            <Tag tone={isOpen(chain, chainNow) ? "green" : "amber"}>
              {isOpen(chain, chainNow)
                ? "Accepting donations"
                : "Closed / refunds"}
            </Tag>
          )}

          <span>
            <CalendarClock size={16} />
            Deadline {prettyDate(campaign.deadline)}
          </span>
        </div>
      </div>
    </div>

    {/* Notifications */}
    <Notice text={error} type="error" />
    <Notice text={success} type="success" />

    {chainMissing && (
      <p className="notice notice-error">
        This campaign cannot be used with the active local blockchain.
        Create and publish a new proposal from the charity and admin
        pages; no database deletion is required.
      </p>
    )}

    <div className="detail-layout">
      {/* LEFT SIDE */}
      <div className="detail-left">
        {/* Campaign cover */}
        <div className={`detail-cover ${meta.cls}`}>
          <div className="big-cover-mark">
            <Icon size={88} />
          </div>

          <div className="detail-cover-caption">
            <ShieldCheck size={17} />
            Campaign verified on-chain
          </div>
        </div>

        {/* Campaign story */}
        <div className="panel">
          <h2>The story behind this cause</h2>

          <p className="story-text">{campaign.story}</p>

          <div className="detail-org">
            <ShieldCheck size={24} />

            <div>
              <strong>{campaign.charity?.organizationName}</strong>
              <small>Platform-approved charity organization</small>
            </div>
          </div>
        </div>

        {/* Expense proof and withdrawals */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>
                <FileCheck2 size={20} />
                Expense proof & withdrawals
              </h2>

              <p>
                Evidence is public only after independent approval.
                Approval is recorded on-chain.
              </p>
            </div>
          </div>

          {bills.length ? (
            <div className="bill-feed">
              {bills.map((b) => (
                <div className="bill-row" key={b._id}>
                  <div className="bill-icon">
                    <FileCheck2 size={20} />
                  </div>

                  <div className="bill-desc">
                    <strong>{b.purpose}</strong>

                    <small>
                      Document SHA-256: {shorten(b.documentHash, 12)}
                    </small>

                    <small>{eth(b.amountWei)} ETH requested</small>
                  </div>

                  <Status value={b.status} />

                  {["approved", "paid"].includes(b.status) && (
                    <button
                      className="text-btn"
                      onClick={() =>
                        takeAction(async () => {
                          await openEvidence(b._id, b.documentHash);
                          return null;
                        })
                      }
                    >
                      View bill <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No invoices submitted yet"
              body="Approved spending evidence will be visible here as the fundraiser uses donations."
            />
          )}
        </div>

        {/* All donation transactions */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>All donation transactions</h2>
              <p>Directly sourced from on-chain events.</p>
            </div>

            <Link to="/ledger" className="inline-link">
              Full ledger <ArrowUpRight size={15} />
            </Link>
          </div>

          {events.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Donor wallet</th>
                    <th>Amount</th>
                    <th>Transaction</th>
                  </tr>
                </thead>

                <tbody>
                  {events.map((e) => (
                    <tr key={`${e.transactionHash}-${e.index}`}>
                      <td className="mono">
                        {shorten(e.args.donor, 9)}
                      </td>

                      <td>{eth(e.args.amount)} ETH</td>

                      <td
                        className="mono"
                        title={e.transactionHash}
                      >
                        {shorten(e.transactionHash, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No blockchain donations yet"
              body="Be the first person to support this cause with test ETH."
            />
          )}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="detail-right">
        <div className="donate-panel">
          {/* Funding information */}
          <div className="donation-amount">
            <strong>
              {eth(raised)} <span>ETH</span>
            </strong>

            <p>raised of {eth(goal)} ETH goal</p>
          </div>

          <div className="progress-track tall">
            <div
              style={{
                width: `${Math.min(100, pct)}%`
              }}
            />
          </div>

          <div className="progress-caption">
            <span>{pct}% funded</span>

            <span>
              {chain ? chain.contributorCount.toString() : 0} supporters
            </span>
          </div>

          {/* Escrow metrics */}
          <div className="escrow-metrics">
            <div>
              <span>Still in escrow</span>
              <strong>{eth(chain?.escrowBalance)} ETH</strong>
            </div>

            <div>
              <span>Verified payouts</span>
              <strong>{eth(chain?.totalWithdrawn)} ETH</strong>
            </div>
          </div>

          {/* Donation form: DONORS ONLY */}
          {user?.role === "donor" ? (
            <div className="donation-form">
              <label htmlFor="donation-amount">
                Donation amount (test ETH)
              </label>

              <div className="eth-input">
                <input
                  id="donation-amount"
                  type="number"
                  min="0.00001"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={
                    !chain ||
                    !isOpen(chain, chainNow) ||
                    busy ||
                    remainingWei === 0n
                  }
                />
                <span>ETH</span>
              </div>

              {/* Remaining donation limit */}
              <p className="fine-print">
                Maximum available donation:{" "}
                <strong>{remainingEth} ETH</strong>
              </p>

              {/* Donation validation message */}
              {amountError && (
                <p className="notice notice-error" role="alert">
                  {amountError}
                </p>
              )}

              {/* Quick donation buttons */}
              <div className="quick-values">
                {["0.1", "0.5", "1"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={
                      !chain ||
                      !isOpen(chain, chainNow) ||
                      busy ||
                      ethers.parseEther(value) > remainingWei
                    }
                    onClick={() => setAmount(value)}
                  >
                    {value} ETH
                  </button>
                ))}

                {/* Donate exact remaining amount */}
                {remainingWei > 0n && (
                  <button
                    type="button"
                    disabled={
                      !chain ||
                      !isOpen(chain, chainNow) ||
                      busy
                    }
                    onClick={() => setAmount(remainingEth)}
                  >
                    Donate remaining
                  </button>
                )}
              </div>

              {/* Main donation button */}
              <button
                className="btn btn-primary full"
                disabled={
                  !chain ||
                  !isOpen(chain, chainNow) ||
                  busy ||
                  !!amountError ||
                  remainingWei === 0n
                }
                onClick={() => takeAction(makeDonation)}
              >
                <Heart size={18} />

                {busy
                  ? "Processing…"
                  : remainingWei === 0n && chain
                  ? "Campaign goal reached"
                  : chain && isOpen(chain, chainNow)
                  ? "Donate with MetaMask"
                  : "Campaign closed"}
              </button>

              <p className="fine-print">
                <LockKeyhole size={14} />
                Funds are locked until an approved bill is paid.
              </p>
            </div>
          ) : (
            <p className="notice">
              Only donor accounts can contribute. You can still view
              campaign information and donations.
            </p>
          )}

          {/* Donor refund eligibility */}
          {user?.role === "donor" && (
            <div className="refund-panel">
              <div className="refund-title">
                <RotateCcw size={18} />
                Your refund eligibility
              </div>

              <div>
                <small>Your total donation</small>
                <strong>{eth(contribution)} ETH</strong>
              </div>

              <div>
                <small>Unused share estimate</small>
                <strong>{eth(quote)} ETH</strong>
              </div>

              <div>
                <small>Refund status</small>
                <strong>
                  {claimed
                    ? "Already claimed"
                    : chain && refundOpen(chain, chainNow)
                    ? "Eligible"
                    : "Not yet open"}
                </strong>
              </div>

              <button
                className="btn btn-outline full"
                disabled={
                  !address ||
                  !chain ||
                  !refundOpen(chain, chainNow) ||
                  claimed ||
                  contribution === 0n ||
                  quote === 0n ||
                  busy
                }
                onClick={() =>
                  takeAction(async () =>
                    (await writeContract()).claimRefund(
                      campaign.chainCampaignId
                    )
                  )
                }
              >
                <RotateCcw size={17} />
                {claimed ? "Refund claimed" : "Claim unused funds"}
              </button>

              <p className="fine-print">
                Refunds are enabled at the deadline or upon admin
                cancellation. You initiate the claim from your own wallet.
              </p>
            </div>
          )}
        </div>

        {/* Trust information */}
        <div className="info-card">
          <ShieldCheck size={20} />

          <div>
            <strong>Proof over promises</strong>

            <p>
              Only a verifier can approve bill hashes.
              The fundraiser cannot transfer money without
              an approved bill.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
