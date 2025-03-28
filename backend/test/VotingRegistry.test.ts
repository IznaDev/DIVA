import { expect } from "chai";
import { ethers } from "hardhat";
import { deployVotingRegistry } from "./utils/fixtures";
import { VotingRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VotingRegistry", function () {
  let votingRegistry: VotingRegistry;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();
    const deployment = await deployVotingRegistry();
    votingRegistry = deployment.votingRegistry;
  });

  describe("registerVoter", function () {
    it("should register a new voter", async function () {
      await votingRegistry.registerVoter(voter1.address);
      const voterData = await votingRegistry.getVoterData(voter1.address);

      expect(voterData.isRegistered).to.equal(true);
      expect(voterData.reputation).to.equal(1);
      expect(voterData.voteCount).to.equal(0);
    });

    it("should revert when registering an already registered voter", async function () {
      await votingRegistry.registerVoter(voter1.address);
      await expect(
        votingRegistry.registerVoter(voter1.address)
      ).to.be.revertedWith("Voter already registered");
    });

    it("should only allow owner to register voters", async function () {
      await expect(
        votingRegistry.connect(voter1).registerVoter(voter2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("updateReputation", function () {
    beforeEach(async function () {
      await votingRegistry.registerVoter(voter1.address);
    });

    it("should increase reputation", async function () {
      await votingRegistry.updateReputation(voter1.address, 5);
      const voterData = await votingRegistry.getVoterData(voter1.address);
      expect(voterData.reputation).to.equal(6); // 1 (initial) + 5
    });

    it("should decrease reputation but not below MIN_REPUTATION", async function () {
      await votingRegistry.updateReputation(voter1.address, -5);
      const voterData = await votingRegistry.getVoterData(voter1.address);
      expect(voterData.reputation).to.equal(1); // MIN_REPUTATION
    });

    it("should cap reputation at MAX_REPUTATION", async function () {
      await votingRegistry.updateReputation(voter1.address, 200);
      const voterData = await votingRegistry.getVoterData(voter1.address);
      expect(voterData.reputation).to.equal(100); // MAX_REPUTATION
    });

    it("should revert when updating reputation of unregistered voter", async function () {
      await expect(
        votingRegistry.updateReputation(voter2.address, 5)
      ).to.be.revertedWith("Voter not registered");
    });

    it("should only allow owner to update reputation", async function () {
      await expect(
        votingRegistry.connect(voter1).updateReputation(voter1.address, 5)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setVoteCount", function () {
    beforeEach(async function () {
      await votingRegistry.registerVoter(voter1.address);
    });

    it("should increment vote count", async function () {
      await votingRegistry.setVoteCount(voter1.address);
      const voterData = await votingRegistry.getVoterData(voter1.address);
      expect(voterData.voteCount).to.equal(1);

      // Increment again
      await votingRegistry.setVoteCount(voter1.address);
      const updatedVoterData = await votingRegistry.getVoterData(voter1.address);
      expect(updatedVoterData.voteCount).to.equal(2);
    });

    it("should revert when setting vote count for unregistered voter", async function () {
      await expect(
        votingRegistry.setVoteCount(voter2.address)
      ).to.be.revertedWith("Voter not registered");
    });

    it("should only allow owner to set vote count", async function () {
      await expect(
        votingRegistry.connect(voter1).setVoteCount(voter1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("getVoterData", function () {
    it("should return voter data for registered voter", async function () {
      await votingRegistry.registerVoter(voter1.address);
      const voterData = await votingRegistry.getVoterData(voter1.address);

      expect(voterData.isRegistered).to.equal(true);
      expect(voterData.reputation).to.equal(1);
      expect(voterData.voteCount).to.equal(0);
    });

    it("should revert when getting data for unregistered voter", async function () {
      await expect(
        votingRegistry.getVoterData(voter1.address)
      ).to.be.revertedWith("Voter not registered");
    });
  });

  describe("isRegistered", function () {
    it("should return true for registered voter", async function () {
      await votingRegistry.registerVoter(voter1.address);
      expect(await votingRegistry.isRegistered(voter1.address)).to.be.true;
    });

    it("should return false for unregistered voter", async function () {
      expect(await votingRegistry.isRegistered(voter1.address)).to.be.false;
    });
  });
});
