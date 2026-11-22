import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const ONE_DAY = 24 * 60 * 60;
const hash = (text: string) => ethers.id(text);

async function fixture() {
  const [admin, charity, alice, bob, outsider] = await ethers.getSigners();
  const escrow = await ethers.deployContract("CharityEscrow");
  await escrow.waitForDeployment();
  const now = await networkHelpers.time.latest();
  const deadline = now + 30 * ONE_DAY;
  await escrow.createCampaign(charity.address, hash("campaign-a"), ethers.parseEther("10"), deadline);
  return { escrow, admin, charity, alice, bob, outsider, deadline };
}

describe("CharityEscrow: evidence-gated disbursements and refunds", function () {
  it("permits donations, but prevents anyone from withdrawing without an approved bill", async () => {
    const { escrow, charity, alice } = await networkHelpers.loadFixture(fixture);
    await expect(escrow.connect(alice).donate(1, { value: ethers.parseEther("4") }))
      .to.emit(escrow, "DonationReceived");
    const billHash = hash("bill-1");
    await escrow.connect(charity).submitBill(1, billHash, ethers.parseEther("2"));
    await expect(escrow.connect(charity).withdrawApprovedBill(1, 1)).to.be.revertedWith("Bill not approved");
    await escrow.verifyBill(1, 1, true);
    await expect(escrow.connect(charity).withdrawApprovedBill(1, 1))
      .to.emit(escrow, "FundsWithdrawn");
    expect((await escrow.getCampaign(1)).escrowBalance).to.equal(ethers.parseEther("2"));
    await expect(escrow.connect(charity).withdrawApprovedBill(1, 1)).to.be.revertedWith("Bill not approved");
  });

  it("only an independent verifier may approve; rejected bills can never be paid", async () => {
    const { escrow, charity, alice, outsider } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("3") });
    await escrow.connect(charity).submitBill(1, hash("bill-2"), ethers.parseEther("1"));
    await expect(escrow.connect(outsider).verifyBill(1, 1, true)).to.be.revertedWith("Verifier only");
    await escrow.verifyBill(1, 1, false);
    await expect(escrow.connect(charity).withdrawApprovedBill(1, 1)).to.be.revertedWith("Bill not approved");
    await expect(escrow.verifyBill(1, 1, true)).to.be.revertedWith("Bill already reviewed");
  });

  it("rejects duplicate bills and prevents approving more than the escrow balance", async () => {
    const { escrow, charity, alice } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("3") });
    await escrow.connect(charity).submitBill(1, hash("same-pdf"), ethers.parseEther("2"));
    await expect(escrow.connect(charity).submitBill(1, hash("same-pdf"), ethers.parseEther("2")))
      .to.be.revertedWith("Duplicate bill");
    await escrow.connect(charity).submitBill(1, hash("second-pdf"), ethers.parseEther("2"));
    await escrow.verifyBill(1, 1, true);
    await expect(escrow.verifyBill(1, 2, true)).to.be.revertedWith("Insufficient unreserved funds");
  });

  it("allows full refunds after expiry when no money was spent", async () => {
    const { escrow, alice, bob, deadline } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("4") });
    await escrow.connect(bob).donate(1, { value: ethers.parseEther("6") });
    await expect(escrow.connect(alice).claimRefund(1)).to.be.revertedWith("Refunds not open");
    await networkHelpers.time.increaseTo(deadline + 1);
    await expect(escrow.connect(alice).claimRefund(1)).to.emit(escrow, "RefundClaimed")
      .withArgs(1n, alice.address, ethers.parseEther("4"));
    await escrow.connect(bob).claimRefund(1);
    expect((await escrow.getCampaign(1)).escrowBalance).to.equal(0n);
    await expect(escrow.connect(alice).claimRefund(1)).to.be.revertedWith("Already claimed");
  });

  it("refunds only the remaining balance pro-rata after an approved expenditure", async () => {
    const { escrow, charity, alice, bob, deadline } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("6") });
    await escrow.connect(bob).donate(1, { value: ethers.parseEther("4") });
    await escrow.connect(charity).submitBill(1, hash("invoice-3"), ethers.parseEther("3"));
    await escrow.verifyBill(1, 1, true);
    await escrow.connect(charity).withdrawApprovedBill(1, 1);
    await networkHelpers.time.increaseTo(deadline + 1);
    expect(await escrow.getRefundQuote(1, alice.address)).to.equal(ethers.parseEther("4.2"));
    await expect(escrow.connect(alice).claimRefund(1)).to.emit(escrow, "RefundClaimed")
      .withArgs(1n, alice.address, ethers.parseEther("4.2"));
    await escrow.connect(bob).claimRefund(1);
    expect((await escrow.getCampaign(1)).escrowBalance).to.equal(0n);
  });

  it("locks withdrawals at the deadline, even for previously approved invoices", async () => {
    const { escrow, charity, alice, deadline } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("3") });
    await escrow.connect(charity).submitBill(1, hash("invoice-4"), ethers.parseEther("2"));
    await escrow.verifyBill(1, 1, true);
    await networkHelpers.time.increaseTo(deadline + 1);
    await expect(escrow.connect(charity).withdrawApprovedBill(1, 1)).to.be.revertedWith("Campaign closed");
    await escrow.connect(alice).claimRefund(1);
    expect((await escrow.getCampaign(1)).totalRefunded).to.equal(ethers.parseEther("3"));
  });

  it("opens refunds immediately after admin cancellation", async () => {
    const { escrow, alice, outsider } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("2") });
    await expect(escrow.connect(outsider).cancelCampaign(1)).to.be.revertedWith("Admin only");
    await escrow.cancelCampaign(1);
    await escrow.connect(alice).claimRefund(1);
    expect((await escrow.getCampaign(1)).escrowBalance).to.equal(0n);
  });

  it("does not permit a refund when all escrow has been spent on approved bills", async () => {
    const { escrow, charity, alice, deadline } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("2") });
    await escrow.connect(charity).submitBill(1, hash("entire-bill"), ethers.parseEther("2"));
    await escrow.verifyBill(1, 1, true);
    await escrow.connect(charity).withdrawApprovedBill(1, 1);
    await networkHelpers.time.increaseTo(deadline + 1);
    await expect(escrow.connect(alice).claimRefund(1)).to.be.revertedWith("No unused funds");
  });

  it("lets a keeper refund the original donor, not itself", async () => {
    const { escrow, alice, outsider, deadline } = await networkHelpers.loadFixture(fixture);
    await escrow.connect(alice).donate(1, { value: ethers.parseEther("1") });
    await networkHelpers.time.increaseTo(deadline + 1);
    await expect(escrow.connect(outsider).processRefundForDonor(1, alice.address))
      .to.emit(escrow, "RefundClaimed").withArgs(1n, alice.address, ethers.parseEther("1"));
    expect(await escrow.refundClaimed(1, alice.address)).to.equal(true);
    await expect(escrow.connect(outsider).processRefundForDonor(1, alice.address))
      .to.be.revertedWith("Already claimed");
  });

  it("prevents unauthorized campaign creation, fundraiser self-donation, and excess donations", async () => {
    const { escrow, charity, alice } = await networkHelpers.loadFixture(fixture);
    await expect(escrow.connect(alice).createCampaign(charity.address, hash("x"), 1, 999999999999))
      .to.be.revertedWith("Admin only");
    await expect(escrow.connect(charity).donate(1, { value: 1n })).to.be.revertedWith("Fundraiser cannot self-donate");
    await expect(escrow.connect(alice).donate(1, { value: ethers.parseEther("11") }))
      .to.be.revertedWith("Campaign goal exceeded");
  });
});
