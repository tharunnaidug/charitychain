// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CharityEscrow
 * @notice Demo-only ETH escrow for evidence-gated charity withdrawals and
 *         donor-initiated proportional refunds after a fixed deadline.
 * @dev Bill authenticity is reviewed OFF chain by a separate trusted verifier.
 *      Approval, payouts, accounting and expiry are enforced ON chain.
 *      Do not deploy with real money without an independent audit.
 */
contract CharityEscrow is ReentrancyGuard {
    enum BillStatus { Pending, Approved, Rejected, Paid }

    struct Campaign {
        address payable fundraiser;
        bytes32 referenceHash;      // keccak256 of canonical approved campaign metadata
        uint256 goal;
        uint256 deadline;
        uint256 totalDonated;
        uint256 totalWithdrawn;
        uint256 totalRefunded;
        uint256 escrowBalance;
        uint256 reservedForBills;
        uint256 contributorCount;
        uint256 refundClaims;
        uint256 refundPool;
        uint256 billCount;
        bool cancelled;
        bool refundSnapshotTaken;
    }

    struct Bill {
        bytes32 documentHash;       // SHA-256 of uploaded bytes
        uint256 amount;
        address submittedBy;
        BillStatus status;
    }

    address public immutable admin;
    address public verifier;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) private campaigns;
    mapping(bytes32 => bool) public usedCampaignReferences;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(uint256 => mapping(uint256 => Bill)) private bills;
    mapping(uint256 => mapping(bytes32 => bool)) public usedDocumentHashes;

    event CampaignCreated(uint256 indexed campaignId, address indexed fundraiser, bytes32 referenceHash, uint256 goal, uint256 deadline);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event BillSubmitted(uint256 indexed campaignId, uint256 indexed billId, bytes32 documentHash, uint256 amount);
    event BillReviewed(uint256 indexed campaignId, uint256 indexed billId, bool approved);
    event FundsWithdrawn(uint256 indexed campaignId, uint256 indexed billId, address indexed fundraiser, uint256 amount);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);
    event VerifierChanged(address indexed newVerifier);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "Verifier only");
        _;
    }

    modifier existingCampaign(uint256 campaignId) {
        require(campaignId > 0 && campaignId <= campaignCount, "Unknown campaign");
        _;
    }

    constructor() {
        admin = msg.sender;
        verifier = msg.sender; // For local demo, admin is initially the verifier.
    }

    function setVerifier(address newVerifier) external onlyAdmin {
        require(newVerifier != address(0), "Invalid verifier");
        verifier = newVerifier;
        emit VerifierChanged(newVerifier);
    }

    function createCampaign(address payable fundraiser, bytes32 referenceHash, uint256 goal, uint256 deadline)
        external onlyAdmin returns (uint256 campaignId)
    {
        require(fundraiser != address(0) && fundraiser != admin && fundraiser != verifier, "Invalid fundraiser");
        require(referenceHash != bytes32(0) && !usedCampaignReferences[referenceHash], "Duplicate reference");
        require(goal > 0, "Goal must be positive");
        require(deadline > block.timestamp, "Deadline must be in future");

        campaignId = ++campaignCount;
        Campaign storage c = campaigns[campaignId];
        c.fundraiser = fundraiser;
        c.referenceHash = referenceHash;
        c.goal = goal;
        c.deadline = deadline;
        usedCampaignReferences[referenceHash] = true;
        emit CampaignCreated(campaignId, fundraiser, referenceHash, goal, deadline);
    }

    function donate(uint256 campaignId) external payable existingCampaign(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(!c.cancelled && block.timestamp < c.deadline, "Campaign closed");
        require(msg.value > 0, "Zero donation");
        require(c.totalDonated + msg.value <= c.goal, "Campaign goal exceeded");
        require(msg.sender != c.fundraiser, "Fundraiser cannot self-donate");
        if (donations[campaignId][msg.sender] == 0) c.contributorCount++;
        donations[campaignId][msg.sender] += msg.value;
        c.totalDonated += msg.value;
        c.escrowBalance += msg.value;
        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function submitBill(uint256 campaignId, bytes32 documentHash, uint256 amount)
        external existingCampaign(campaignId) returns (uint256 billId)
    {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.fundraiser, "Fundraiser only");
        require(!c.cancelled && block.timestamp < c.deadline, "Campaign closed");
        require(documentHash != bytes32(0) && !usedDocumentHashes[campaignId][documentHash], "Duplicate bill");
        require(amount > 0, "Invalid bill amount");
        require(amount <= c.escrowBalance, "Bill exceeds escrow");

        billId = ++c.billCount;
        bills[campaignId][billId] = Bill(documentHash, amount, msg.sender, BillStatus.Pending);
        usedDocumentHashes[campaignId][documentHash] = true;
        emit BillSubmitted(campaignId, billId, documentHash, amount);
    }

    function verifyBill(uint256 campaignId, uint256 billId, bool approve)
        external onlyVerifier existingCampaign(campaignId)
    {
        Campaign storage c = campaigns[campaignId];
        require(!c.cancelled && block.timestamp < c.deadline, "Campaign closed");
        require(verifier != c.fundraiser, "Fundraiser cannot self-verify");
        require(billId > 0 && billId <= c.billCount, "Unknown bill");
        Bill storage b = bills[campaignId][billId];
        require(b.status == BillStatus.Pending, "Bill already reviewed");

        if (approve) {
            require(b.amount <= c.escrowBalance - c.reservedForBills, "Insufficient unreserved funds");
            c.reservedForBills += b.amount;
            b.status = BillStatus.Approved;
        } else {
            b.status = BillStatus.Rejected;
        }
        emit BillReviewed(campaignId, billId, approve);
    }

    function withdrawApprovedBill(uint256 campaignId, uint256 billId)
        external nonReentrant existingCampaign(campaignId)
    {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.fundraiser, "Fundraiser only");
        require(!c.cancelled && block.timestamp < c.deadline, "Campaign closed");
        require(billId > 0 && billId <= c.billCount, "Unknown bill");
        Bill storage b = bills[campaignId][billId];
        require(b.status == BillStatus.Approved, "Bill not approved");
        require(b.amount <= c.escrowBalance, "Insufficient balance");

        // Effects before external transfer; ReentrancyGuard blocks callbacks.
        b.status = BillStatus.Paid;
        c.reservedForBills -= b.amount;
        c.escrowBalance -= b.amount;
        c.totalWithdrawn += b.amount;
        (bool ok, ) = c.fundraiser.call{value: b.amount}("");
        require(ok, "ETH transfer failed");
        emit FundsWithdrawn(campaignId, billId, c.fundraiser, b.amount);
    }

    function cancelCampaign(uint256 campaignId) external onlyAdmin existingCampaign(campaignId) {
        Campaign storage c = campaigns[campaignId];
        require(!c.cancelled && block.timestamp < c.deadline, "Campaign already closed");
        c.cancelled = true;
        emit CampaignCancelled(campaignId);
    }

    /**
     * @notice Claim unused funds. Eligible at deadline or following admin cancellation.
     *         The FIRST claim freezes the refund pool; no withdrawals are then possible.
     *         Donors, not the contract, initiate their own claim transaction.
     */
    function claimRefund(uint256 campaignId) external nonReentrant existingCampaign(campaignId) {
        _refund(campaignId, msg.sender);
    }

    /**
     * @notice Anyone (including an optional free local bot) may initiate a refund,
     *         but ETH always goes to the original donor, never the caller.
     *         Donor-initiated claims remain available without the bot.
     */
    function processRefundForDonor(uint256 campaignId, address donor)
        external nonReentrant existingCampaign(campaignId)
    {
        _refund(campaignId, donor);
    }

    function _refund(uint256 campaignId, address donor) private {
        Campaign storage c = campaigns[campaignId];
        require(c.cancelled || block.timestamp >= c.deadline, "Refunds not open");
        uint256 donated = donations[campaignId][donor];
        require(donated > 0, "No donation");
        require(!refundClaimed[campaignId][donor], "Already claimed");
        if (!c.refundSnapshotTaken) {
            c.refundPool = c.escrowBalance;
            c.refundSnapshotTaken = true;
        }
        require(c.refundPool > 0, "No unused funds");

        refundClaimed[campaignId][donor] = true;
        c.refundClaims++;
        // Give any integer division remainder to the final claimant.
        uint256 amount = c.refundClaims == c.contributorCount
            ? c.escrowBalance
            : c.refundPool * donated / c.totalDonated;
        c.escrowBalance -= amount;
        c.totalRefunded += amount;
        (bool ok, ) = payable(donor).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundClaimed(campaignId, donor, amount);
    }

    function getCampaign(uint256 campaignId) external view existingCampaign(campaignId) returns (Campaign memory) {
        return campaigns[campaignId];
    }

    function getBill(uint256 campaignId, uint256 billId)
        external view existingCampaign(campaignId) returns (Bill memory)
    {
        require(billId > 0 && billId <= campaigns[campaignId].billCount, "Unknown bill");
        return bills[campaignId][billId];
    }

    /** @notice Estimated claimable amount; before expiry, only a projection. */
    function getRefundQuote(uint256 campaignId, address donor)
        external view existingCampaign(campaignId) returns (uint256)
    {
        Campaign storage c = campaigns[campaignId];
        if (refundClaimed[campaignId][donor] || donations[campaignId][donor] == 0) return 0;
        if (c.totalDonated == 0) return 0;
        if (c.refundSnapshotTaken && c.refundClaims == c.contributorCount - 1) return c.escrowBalance;
        uint256 base = c.refundSnapshotTaken ? c.refundPool : c.escrowBalance;
        return base * donations[campaignId][donor] / c.totalDonated;
    }

    receive() external payable { revert("Use donate"); }
    fallback() external payable { revert("Unknown function"); }
}
