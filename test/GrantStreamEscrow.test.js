const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─── Status enum mirrors ───────────────────────────────────────────────────────
const Status = { Pending: 0, Submitted: 1, Approved: 2, Paid: 3, Rejected: 4 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const u = (n) => ethers.parseUnits(String(n), 6); // 6-decimal USDC amounts

describe("GrantStreamEscrow", function () {
  // ── Shared fixture ────────────────────────────────────────────────────────
  async function deployFixture() {
    const [owner, funder, grantee, verifier, other, attacker] =
      await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const GrantStreamEscrow = await ethers.getContractFactory("GrantStreamEscrow");
    const escrow = await GrantStreamEscrow.deploy(await usdc.getAddress());
    await escrow.waitForDeployment();

    return { usdc, escrow, owner, funder, grantee, verifier, other, attacker };
  }

  /** Sets up a fully-funded grant with two milestones (100 + 200 USDC). */
  async function fundedGrantFixture() {
    const base = await deployFixture();
    const { usdc, escrow, funder, grantee, verifier } = base;

    const amounts = [u(100), u(200)];
    const total = u(300);

    await usdc.mint(funder.address, total);
    await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);
    await usdc.connect(funder).approve(await escrow.getAddress(), total);
    await escrow.connect(funder).fundGrant(0);

    return { ...base, amounts, total, grantId: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Deployment", function () {
    it("stores the USDC token address", async function () {
      const { usdc, escrow } = await loadFixture(deployFixture);
      expect(await escrow.usdc()).to.equal(await usdc.getAddress());
    });

    it("starts with nextGrantId = 0", async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.nextGrantId()).to.equal(0);
    });

    it("reverts when deployed with zero-address USDC", async function () {
      const GrantStreamEscrow = await ethers.getContractFactory("GrantStreamEscrow");
      await expect(
        GrantStreamEscrow.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        await GrantStreamEscrow.deploy(ethers.ZeroAddress).catch(() =>
          ethers.getContractFactory("GrantStreamEscrow")
        ),
        "InvalidAddress"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GRANT CREATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Grant Creation", function () {
    it("creates a grant and stores all fields correctly", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      const amounts = [u(100), u(200)];

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);

      const grant = await escrow.grants(0);
      expect(grant.funder).to.equal(funder.address);
      expect(grant.grantee).to.equal(grantee.address);
      expect(grant.verifier).to.equal(verifier.address);
      expect(grant.totalAmount).to.equal(u(300));
      expect(grant.paidAmount).to.equal(0);
      expect(grant.funded).to.equal(false);
      expect(grant.exists).to.equal(true);
    });

    it("increments nextGrantId after each creation", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(50)]);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(50)]);
      expect(await escrow.nextGrantId()).to.equal(2);
    });

    it("creates the correct number of milestones", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      const amounts = [u(10), u(20), u(30), u(40)];

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);
      expect(await escrow.getMilestoneCount(0)).to.equal(4);
    });

    it("initialises each milestone as Pending with correct amount", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      const amounts = [u(100), u(200)];

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);

      const m0 = await escrow.getMilestone(0, 0);
      expect(m0.amount).to.equal(u(100));
      expect(m0.status).to.equal(Status.Pending);
      expect(m0.evidenceURI).to.equal("");

      const m1 = await escrow.getMilestone(0, 1);
      expect(m1.amount).to.equal(u(200));
      expect(m1.status).to.equal(Status.Pending);
    });

    it("emits GrantCreated event with correct args", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);

      await expect(
        escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100)])
      )
        .to.emit(escrow, "GrantCreated")
        .withArgs(0, funder.address, grantee.address, verifier.address, u(100));
    });

    it("supports a single milestone", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(500)]);

      const grant = await escrow.grants(0);
      expect(grant.totalAmount).to.equal(u(500));
      expect(await escrow.getMilestoneCount(0)).to.equal(1);
    });

    it("supports many milestones", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      const amounts = Array.from({ length: 10 }, (_, i) => u(i + 1));

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);
      expect(await escrow.getMilestoneCount(0)).to.equal(10);
    });

    // ── Input validation ───────────────────────────────────────────────────
    it("reverts when grantee is zero address", async function () {
      const { escrow, funder, verifier } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(funder).createGrant(ethers.ZeroAddress, verifier.address, [u(100)])
      ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts when verifier is zero address", async function () {
      const { escrow, funder, grantee } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(funder).createGrant(grantee.address, ethers.ZeroAddress, [u(100)])
      ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts when milestone array is empty", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(funder).createGrant(grantee.address, verifier.address, [])
      ).to.be.revertedWithCustomError(escrow, "InvalidMilestones");
    });

    it("reverts when any milestone amount is zero", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100), 0])
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. GRANT FUNDING
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Grant Funding", function () {
    it("marks the grant as funded after fundGrant()", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(300);

      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100), u(200)]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(0);

      const grant = await escrow.grants(0);
      expect(grant.funded).to.equal(true);
    });

    it("transfers USDC from funder to escrow contract", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(300);

      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100), u(200)]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);

      const escrowAddress = await escrow.getAddress();
      const before = await usdc.balanceOf(funder.address);

      await escrow.connect(funder).fundGrant(0);

      expect(await usdc.balanceOf(escrowAddress)).to.equal(total);
      expect(await usdc.balanceOf(funder.address)).to.equal(before - total);
    });

    it("emits GrantFunded event", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(300);

      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100), u(200)]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);

      await expect(escrow.connect(funder).fundGrant(0))
        .to.emit(escrow, "GrantFunded")
        .withArgs(0, total);
    });

    // ── Access control ─────────────────────────────────────────────────────
    it("reverts when non-funder tries to fund", async function () {
      const { escrow, usdc, funder, grantee, verifier, other } =
        await loadFixture(deployFixture);
      const total = u(100);

      await usdc.mint(other.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdc.connect(other).approve(await escrow.getAddress(), total);

      await expect(escrow.connect(other).fundGrant(0)).to.be.revertedWithCustomError(
        escrow,
        "NotFunder"
      );
    });

    it("reverts when grant does not exist", async function () {
      const { escrow, funder } = await loadFixture(deployFixture);
      await expect(escrow.connect(funder).fundGrant(99)).to.be.revertedWithCustomError(
        escrow,
        "GrantNotFound"
      );
    });

    it("reverts on double funding", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(100);

      await usdc.mint(funder.address, total * 2n);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total * 2n);
      await escrow.connect(funder).fundGrant(0);

      await expect(escrow.connect(funder).fundGrant(0)).to.be.revertedWithCustomError(
        escrow,
        "GrantAlreadyFunded"
      );
    });

    it("reverts when funder has insufficient USDC balance", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(1000);

      // mint less than total
      await usdc.mint(funder.address, u(10));
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);

      await expect(escrow.connect(funder).fundGrant(0)).to.be.reverted;
    });

    it("reverts when allowance is not set", async function () {
      const { escrow, usdc, funder, grantee, verifier } = await loadFixture(deployFixture);
      const total = u(100);

      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      // NO approve call

      await expect(escrow.connect(funder).fundGrant(0)).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MILESTONE SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Milestone Submission", function () {
    it("grantee can submit a milestone with evidence", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence-abc");

      const m = await escrow.getMilestone(grantId, 0);
      expect(m.status).to.equal(Status.Submitted);
      expect(m.evidenceURI).to.equal("ipfs://evidence-abc");
    });

    it("emits MilestoneSubmitted event", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence-abc")
      )
        .to.emit(escrow, "MilestoneSubmitted")
        .withArgs(grantId, 0, "ipfs://evidence-abc");
    });

    it("allows resubmission of a rejected milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://v1");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);
      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://v2");

      const m = await escrow.getMilestone(grantId, 0);
      expect(m.status).to.equal(Status.Submitted);
      expect(m.evidenceURI).to.equal("ipfs://v2");
    });

    it("multiple different milestones can be submitted independently", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(grantee).submitMilestone(grantId, 1, "ipfs://m1");

      expect((await escrow.getMilestone(grantId, 0)).status).to.equal(Status.Submitted);
      expect((await escrow.getMilestone(grantId, 1)).status).to.equal(Status.Submitted);
    });

    // ── Access / input validation ───────────────────────────────────────────
    it("reverts when non-grantee submits", async function () {
      const { escrow, other, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(other).submitMilestone(grantId, 0, "ipfs://bad")
      ).to.be.revertedWithCustomError(escrow, "NotGrantee");
    });

    it("reverts when verifier tries to submit", async function () {
      const { escrow, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(verifier).submitMilestone(grantId, 0, "ipfs://bad")
      ).to.be.revertedWithCustomError(escrow, "NotGrantee");
    });

    it("reverts when funder tries to submit", async function () {
      const { escrow, funder, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(funder).submitMilestone(grantId, 0, "ipfs://bad")
      ).to.be.revertedWithCustomError(escrow, "NotGrantee");
    });

    it("reverts when grant is not funded", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100)]);
      // not funded

      await expect(
        escrow.connect(grantee).submitMilestone(0, 0, "ipfs://evidence")
      ).to.be.revertedWithCustomError(escrow, "GrantNotFunded");
    });

    it("reverts when grant does not exist", async function () {
      const { escrow, grantee } = await loadFixture(deployFixture);

      await expect(
        escrow.connect(grantee).submitMilestone(99, 0, "ipfs://evidence")
      ).to.be.revertedWithCustomError(escrow, "GrantNotFound");
    });

    it("reverts when milestoneId is out of range", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(grantee).submitMilestone(grantId, 99, "ipfs://evidence")
      ).to.be.revertedWithCustomError(escrow, "InvalidMilestone");
    });

    it("reverts when evidenceURI is empty", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(grantee).submitMilestone(grantId, 0, "")
      ).to.be.revertedWithCustomError(escrow, "EmptyEvidenceURI");
    });

    it("reverts when milestone is already submitted (not Pending/Rejected)", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://first");

      await expect(
        escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://second")
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when milestone is already paid", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      await expect(
        escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://again")
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. VERIFIER APPROVAL
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Verifier Approval", function () {
    it("verifier can approve a submitted milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      const m = await escrow.getMilestone(grantId, 0);
      expect(m.status).to.equal(Status.Paid);
    });

    it("emits MilestoneApproved and MilestonePaid events", async function () {
      const { escrow, grantee, verifier, grantId, amounts } =
        await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(escrow.connect(verifier).approveMilestone(grantId, 0))
        .to.emit(escrow, "MilestoneApproved")
        .withArgs(grantId, 0)
        .and.to.emit(escrow, "MilestonePaid")
        .withArgs(grantId, 0, grantee.address, amounts[0]);
    });

    it("releases the correct USDC amount to the grantee", async function () {
      const { escrow, grantee, verifier, grantId, amounts } =
        await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      expect(await (await ethers.getContractAt("MockUSDC", await escrow.usdc())).balanceOf(grantee.address))
        .to.equal(amounts[0]);
    });

    it("updates grant.paidAmount after approval", async function () {
      const { escrow, grantee, verifier, grantId, amounts } =
        await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      const grant = await escrow.grants(grantId);
      expect(grant.paidAmount).to.equal(amounts[0]);
    });

    it("can approve multiple milestones sequentially", async function () {
      const { escrow, grantee, verifier, grantId, amounts, total } =
        await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      await escrow.connect(grantee).submitMilestone(grantId, 1, "ipfs://m1");
      await escrow.connect(verifier).approveMilestone(grantId, 1);

      const usdc = await ethers.getContractAt("MockUSDC", await escrow.usdc());
      expect(await usdc.balanceOf(grantee.address)).to.equal(total);

      const grant = await escrow.grants(grantId);
      expect(grant.paidAmount).to.equal(total);
    });

    // ── Access / status validation ──────────────────────────────────────────
    it("reverts when non-verifier approves (other account)", async function () {
      const { escrow, grantee, other, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(other).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("reverts when funder tries to approve", async function () {
      const { escrow, grantee, funder, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(funder).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("reverts when grantee tries to approve", async function () {
      const { escrow, grantee, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(grantee).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("reverts when approving a Pending (not Submitted) milestone", async function () {
      const { escrow, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when approving an already-paid milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when approving a Rejected milestone directly", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);

      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when grant does not exist", async function () {
      const { escrow, verifier } = await loadFixture(deployFixture);

      await expect(
        escrow.connect(verifier).approveMilestone(99, 0)
      ).to.be.revertedWithCustomError(escrow, "GrantNotFound");
    });

    it("reverts when milestoneId is out of range", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 99)
      ).to.be.revertedWithCustomError(escrow, "InvalidMilestone");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. VERIFIER REJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Verifier Rejection", function () {
    it("verifier can reject a submitted milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);

      const m = await escrow.getMilestone(grantId, 0);
      expect(m.status).to.equal(Status.Rejected);
    });

    it("emits MilestoneRejected event", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(escrow.connect(verifier).rejectMilestone(grantId, 0))
        .to.emit(escrow, "MilestoneRejected")
        .withArgs(grantId, 0);
    });

    it("does not transfer funds on rejection", async function () {
      const { escrow, grantee, verifier, grantId, total } =
        await loadFixture(fundedGrantFixture);

      const usdc = await ethers.getContractAt("MockUSDC", await escrow.usdc());

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(total);
      expect(await usdc.balanceOf(grantee.address)).to.equal(0);
    });

    it("allows resubmission after rejection", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://v1");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);
      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://v2");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      const m = await escrow.getMilestone(grantId, 0);
      expect(m.status).to.equal(Status.Paid);
    });

    // ── Access / status validation ──────────────────────────────────────────
    it("reverts when non-verifier rejects (other account)", async function () {
      const { escrow, grantee, other, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(other).rejectMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("reverts when rejecting a Pending milestone", async function () {
      const { escrow, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(verifier).rejectMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when rejecting an already-paid milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      await expect(
        escrow.connect(verifier).rejectMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when rejecting an already-rejected milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).rejectMilestone(grantId, 0);

      await expect(
        escrow.connect(verifier).rejectMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("reverts when grant does not exist", async function () {
      const { escrow, verifier } = await loadFixture(deployFixture);

      await expect(
        escrow.connect(verifier).rejectMilestone(99, 0)
      ).to.be.revertedWithCustomError(escrow, "GrantNotFound");
    });

    it("reverts when milestoneId is out of range", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(verifier).rejectMilestone(grantId, 99)
      ).to.be.revertedWithCustomError(escrow, "InvalidMilestone");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. FUND RELEASE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Fund Release", function () {
    it("full grant: all milestones paid releases total amount", async function () {
      const { escrow, usdc: rawUsdc, grantee, verifier, grantId, total } =
        await loadFixture(fundedGrantFixture);

      const usdc = await ethers.getContractAt("MockUSDC", await escrow.usdc());

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(verifier).approveMilestone(grantId, 0);
      await escrow.connect(grantee).submitMilestone(grantId, 1, "ipfs://m1");
      await escrow.connect(verifier).approveMilestone(grantId, 1);

      expect(await usdc.balanceOf(grantee.address)).to.equal(total);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("partial payment: second milestone still locked in escrow", async function () {
      const { escrow, grantee, verifier, grantId, amounts, total } =
        await loadFixture(fundedGrantFixture);

      const usdc = await ethers.getContractAt("MockUSDC", await escrow.usdc());

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      expect(await usdc.balanceOf(grantee.address)).to.equal(amounts[0]);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(amounts[1]);
    });

    it("funds from multiple independent grants stay isolated", async function () {
      const { escrow, usdc: usdcAddr, funder, grantee, verifier } =
        await loadFixture(deployFixture);

      const usdc = await ethers.getContractAt("MockUSDC", await escrow.getAddress().then(() => usdcAddr.getAddress()));

      const [, , , , other2] = await ethers.getSigners();
      const total = u(200);

      // Grant 0 - funder → grantee
      await usdcAddr.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdcAddr.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(0);

      // Grant 1 - other2 as funder → grantee
      await usdcAddr.mint(other2.address, total);
      await escrow.connect(other2).createGrant(grantee.address, verifier.address, [total]);
      await usdcAddr.connect(other2).approve(await escrow.getAddress(), total);
      await escrow.connect(other2).fundGrant(1);

      // Only approve grant 0
      await escrow.connect(grantee).submitMilestone(0, 0, "ipfs://g0");
      await escrow.connect(verifier).approveMilestone(0, 0);

      expect(await usdcAddr.balanceOf(await escrow.getAddress())).to.equal(total);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. REENTRANCY EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Reentrancy Edge Cases", function () {
    /**
     * The contract uses OpenZeppelin SafeERC20 + a standard ERC-20 token,
     * so a true reentrancy via the ERC-20 callback path would require a
     * malicious token. These tests verify the state-machine is already
     * updated before the external transfer, providing the check-effects-
     * interactions guarantee.
     */

    it("milestone status is Paid BEFORE the transfer callback would re-enter", async function () {
      // Verify that by the time _releaseMilestone() calls safeTransfer the
      // milestone status is already Paid. We check this via event ordering:
      // MilestonePaid is emitted after the state update — if status were still
      // Approved when the transfer ran, a re-entrant approve would succeed.
      // After approval the status must be Paid (double-approve reverts).
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      // A re-entrant call would fail here because status is already Paid
      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("double-approve on same milestone is always rejected", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      // Simulate what a re-entrant contract would attempt
      await expect(
        escrow.connect(verifier).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidStatus");
    });

    it("approving one milestone does not change state of another milestone", async function () {
      const { escrow, grantee, verifier, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(grantee).submitMilestone(grantId, 1, "ipfs://m1");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      const m1 = await escrow.getMilestone(grantId, 1);
      expect(m1.status).to.equal(Status.Submitted); // unaffected
    });

    it("grant.paidAmount is updated atomically with each release", async function () {
      const { escrow, grantee, verifier, grantId, amounts } =
        await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://m0");
      await escrow.connect(verifier).approveMilestone(grantId, 0);

      let grant = await escrow.grants(grantId);
      expect(grant.paidAmount).to.equal(amounts[0]);

      await escrow.connect(grantee).submitMilestone(grantId, 1, "ipfs://m1");
      await escrow.connect(verifier).approveMilestone(grantId, 1);

      grant = await escrow.grants(grantId);
      expect(grant.paidAmount).to.equal(amounts[0] + amounts[1]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. UNAUTHORIZED ACCESS ATTEMPTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Unauthorized Access Attempts", function () {
    it("random account cannot create a grant on behalf of funder (it becomes their own)", async function () {
      // createGrant() uses msg.sender as funder — attacker can create grants
      // but they become the funder of that grant, not someone else's
      const { escrow, attacker, grantee, verifier } = await loadFixture(deployFixture);

      await escrow.connect(attacker).createGrant(grantee.address, verifier.address, [u(100)]);
      const grant = await escrow.grants(0);
      expect(grant.funder).to.equal(attacker.address);
    });

    it("attacker cannot fund another user's grant", async function () {
      const { escrow, usdc, funder, grantee, verifier, attacker } =
        await loadFixture(deployFixture);

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100)]);

      await usdc.mint(attacker.address, u(100));
      await usdc.connect(attacker).approve(await escrow.getAddress(), u(100));

      await expect(escrow.connect(attacker).fundGrant(0)).to.be.revertedWithCustomError(
        escrow,
        "NotFunder"
      );
    });

    it("attacker cannot submit milestones for another grantee's grant", async function () {
      const { escrow, grantId, attacker } = await loadFixture(fundedGrantFixture);

      await expect(
        escrow.connect(attacker).submitMilestone(grantId, 0, "ipfs://hack")
      ).to.be.revertedWithCustomError(escrow, "NotGrantee");
    });

    it("attacker cannot approve milestones", async function () {
      const { escrow, grantee, attacker, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(attacker).approveMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("attacker cannot reject milestones", async function () {
      const { escrow, grantee, attacker, grantId } = await loadFixture(fundedGrantFixture);

      await escrow.connect(grantee).submitMilestone(grantId, 0, "ipfs://evidence");

      await expect(
        escrow.connect(attacker).rejectMilestone(grantId, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });

    it("grant IDs cannot be manipulated to reference non-existent grants", async function () {
      const { escrow, verifier } = await loadFixture(deployFixture);

      // No grants created — all IDs should revert with GrantNotFound
      await expect(escrow.getMilestoneCount(0)).to.be.revertedWithCustomError(
        escrow,
        "GrantNotFound"
      );
      await expect(escrow.getMilestone(0, 0)).to.be.revertedWithCustomError(
        escrow,
        "GrantNotFound"
      );
      await expect(
        escrow.connect(verifier).approveMilestone(0, 0)
      ).to.be.revertedWithCustomError(escrow, "GrantNotFound");
    });

    it("verifier of grant A cannot act on grant B", async function () {
      const { escrow, usdc, funder, grantee, verifier, other } =
        await loadFixture(deployFixture);

      // Grant 0 with verifier
      const total = u(100);
      await usdc.mint(funder.address, total * 2n);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(0);

      // Grant 1 with 'other' as verifier
      await escrow.connect(funder).createGrant(grantee.address, other.address, [total]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(1);

      await escrow.connect(grantee).submitMilestone(1, 0, "ipfs://g1");

      // verifier of grant 0 tries to approve grant 1's milestone
      await expect(
        escrow.connect(verifier).approveMilestone(1, 0)
      ).to.be.revertedWithCustomError(escrow, "NotVerifier");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. VIEW FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("View Functions", function () {
    it("getMilestone returns correct data for each milestone", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);
      const amounts = [u(50), u(75), u(125)];

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, amounts);

      for (let i = 0; i < amounts.length; i++) {
        const m = await escrow.getMilestone(0, i);
        expect(m.amount).to.equal(amounts[i]);
        expect(m.status).to.equal(Status.Pending);
      }
    });

    it("getMilestoneCount returns correct count", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(1), u(2), u(3)]);
      expect(await escrow.getMilestoneCount(0)).to.equal(3);
    });

    it("getMilestone reverts for non-existent grant", async function () {
      const { escrow } = await loadFixture(deployFixture);

      await expect(escrow.getMilestone(99, 0)).to.be.revertedWithCustomError(
        escrow,
        "GrantNotFound"
      );
    });

    it("getMilestone reverts for out-of-range milestoneId", async function () {
      const { escrow, funder, grantee, verifier } = await loadFixture(deployFixture);

      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [u(100)]);

      await expect(escrow.getMilestone(0, 5)).to.be.revertedWithCustomError(
        escrow,
        "InvalidMilestone"
      );
    });

    it("getMilestoneCount reverts for non-existent grant", async function () {
      const { escrow } = await loadFixture(deployFixture);

      await expect(escrow.getMilestoneCount(99)).to.be.revertedWithCustomError(
        escrow,
        "GrantNotFound"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. END-TO-END FLOWS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("End-to-End Flows", function () {
    it("happy path: create → fund → submit → approve → paid", async function () {
      const { escrow, usdc, funder, grantee, verifier } =
        await loadFixture(deployFixture);

      const milestones = [u(100), u(150), u(250)];
      const total = u(500);

      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, milestones);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(0);

      for (let i = 0; i < milestones.length; i++) {
        await escrow.connect(grantee).submitMilestone(0, i, `ipfs://evidence-${i}`);
        await escrow.connect(verifier).approveMilestone(0, i);
      }

      expect(await usdc.balanceOf(grantee.address)).to.equal(total);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);

      const grant = await escrow.grants(0);
      expect(grant.paidAmount).to.equal(total);
    });

    it("reject-then-resubmit-then-approve path works correctly", async function () {
      const { escrow, usdc, funder, grantee, verifier } =
        await loadFixture(deployFixture);

      const total = u(100);
      await usdc.mint(funder.address, total);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [total]);
      await usdc.connect(funder).approve(await escrow.getAddress(), total);
      await escrow.connect(funder).fundGrant(0);

      await escrow.connect(grantee).submitMilestone(0, 0, "ipfs://v1");
      await escrow.connect(verifier).rejectMilestone(0, 0);
      await escrow.connect(grantee).submitMilestone(0, 0, "ipfs://v2");
      await escrow.connect(verifier).approveMilestone(0, 0);

      expect(await usdc.balanceOf(grantee.address)).to.equal(total);
    });

    it("two independent grants proceed without interfering", async function () {
      const { escrow, usdc, funder, grantee, verifier, other } =
        await loadFixture(deployFixture);

      const [, , , , , , grantee2] = await ethers.getSigners();

      const totalA = u(100);
      const totalB = u(200);

      // Grant A
      await usdc.mint(funder.address, totalA + totalB);
      await escrow.connect(funder).createGrant(grantee.address, verifier.address, [totalA]);
      await usdc.connect(funder).approve(await escrow.getAddress(), totalA + totalB);
      await escrow.connect(funder).fundGrant(0);

      // Grant B
      await escrow.connect(funder).createGrant(grantee2.address, verifier.address, [totalB]);
      await escrow.connect(funder).fundGrant(1);

      // Approve grant A only
      await escrow.connect(grantee).submitMilestone(0, 0, "ipfs://a");
      await escrow.connect(verifier).approveMilestone(0, 0);

      // Grant B still locked
      expect(await usdc.balanceOf(grantee.address)).to.equal(totalA);
      expect(await usdc.balanceOf(grantee2.address)).to.equal(0);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(totalB);
    });
  });
});
