import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployVoting, deployPostManager } from "./utils/fixtures";
import { PostManager, Voting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PostManager via Voting", function () {
  let postManager: any;
  let voting: any;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;
  let url: string;
  let url2: string;

  beforeEach(async function () {
    const votingFixture = await loadFixture(deployVoting);
    postManager = votingFixture.postManager;
    voting = votingFixture.voting;
    owner = votingFixture.owner;
    voter1 = votingFixture.voter1;
    voter2 = votingFixture.voter2;
    voter3 = votingFixture.voter3;
    url = "https://www.exemple.com/content";
    url2 = "https://www.exemple2.com";
  });

  describe("Voter Data Access", function () {
    beforeEach(async function () {
      // Enregistrer les votants via Voting (qui est le propriétaire de PostManager)
      // Nous devons utiliser le mécanisme d'enregistrement approprié du contrat Voting
      // Comme purchaseDivas avec signature ne fonctionne pas dans les tests, simulons un enregistrement direct
      // via une fonction d'enregistrement que le contrat Voting appellerait normalement

      // D'abord, nous devons mint quelques tokens USDC pour voter1
      const mockUSDC = await ethers.getContractAt("MockUSDC", await voting.mockUSDC());
      const usdcAmount = ethers.parseUnits("10", 6);
      await mockUSDC.mint(voter1.address, usdcAmount);

      // Appeler la méthode registerVoter sur le contrat Voting (qui est le owner du PostManager)
      await voting.registerVoterForTesting(voter1.address);

      // Vérifier l'enregistrement
      const voterData = await postManager.getVoterData(voter1.address);
      expect(voterData.isRegistered).to.equal(true);
    });

    it("should correctly retrieve voter data", async function () {
      const voterData = await postManager.getVoterData(voter1.address);
      expect(voterData.isRegistered).to.equal(true);
      expect(voterData.reputation).to.equal(1); // Réputation initiale
      expect(voterData.voteCount).to.equal(0); // Pas encore voté
    });

    it("should return default values for unregistered voter", async function () {
      const voterData = await postManager.getVoterData(voter3.address); // Voter3 n'est pas enregistré
      expect(voterData.isRegistered).to.equal(false);
      expect(voterData.reputation).to.equal(0);
      expect(voterData.voteCount).to.equal(0);
    });

    it("should correctly check if a voter is registered", async function () {
      expect(await postManager.isRegistered(voter1.address)).to.equal(true);
      expect(await postManager.isRegistered(voter3.address)).to.equal(false);
    });
  });

  describe("Voter Management dans PostManager", function () {
    let postManager: PostManager;
    let owner: SignerWithAddress;
    let voter1: SignerWithAddress;
    let voter2: SignerWithAddress;

    beforeEach(async function () {
      [owner, voter1, voter2] = await ethers.getSigners();
      const deployment = await deployPostManager();
      postManager = deployment.postManager;
    });

    describe("registerVoter", function () {
      it("should register a new voter", async function () {
        await postManager.registerVoter(voter1.address);
        const voterData = await postManager.getVoterData(voter1.address);

        expect(voterData.isRegistered).to.equal(true);
        expect(voterData.reputation).to.equal(1);
        expect(voterData.voteCount).to.equal(0);
      });

      it("should revert when registering an already registered voter", async function () {
        await postManager.registerVoter(voter1.address);
        await expect(
          postManager.registerVoter(voter1.address)
        ).to.be.revertedWith("Voter already registered");
      });

      it("should only allow owner to register voters", async function () {
        await expect(
          postManager.connect(voter1).registerVoter(voter2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("updateReputation", function () {
      beforeEach(async function () {
        await postManager.registerVoter(voter1.address);
      });

      it("should increase reputation", async function () {
        await postManager.updateReputation(voter1.address, 5);
        const voterData = await postManager.getVoterData(voter1.address);
        expect(voterData.reputation).to.equal(6); // 1 (initial) + 5
      });

      it("should decrease reputation but not below MIN_REPUTATION", async function () {
        await postManager.updateReputation(voter1.address, -5);
        const voterData = await postManager.getVoterData(voter1.address);
        expect(voterData.reputation).to.equal(1); // MIN_REPUTATION
      });

      it("should cap reputation at MAX_REPUTATION", async function () {
        await postManager.updateReputation(voter1.address, 200);
        const voterData = await postManager.getVoterData(voter1.address);
        expect(voterData.reputation).to.equal(100); // MAX_REPUTATION
      });

      it("should revert when updating reputation of unregistered voter", async function () {
        await expect(
          postManager.updateReputation(voter2.address, 5)
        ).to.be.revertedWith("Voter not registered");
      });

      it("should only allow owner to update reputation", async function () {
        await expect(
          postManager.connect(voter1).updateReputation(voter1.address, 5)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    // La fonction setVoteCount n'existe plus dans PostManager après la fusion
    // Le comptage des votes est maintenant géré directement dans les fonctions de vote

    describe("getVoterData", function () {
      it("should return voter data for registered voter", async function () {
        await postManager.registerVoter(voter1.address);
        const voterData = await postManager.getVoterData(voter1.address);

        expect(voterData.isRegistered).to.equal(true);
        expect(voterData.reputation).to.equal(1);
        expect(voterData.voteCount).to.equal(0);
      });

      it("should return default values for unregistered voter", async function () {
        const voterData = await postManager.getVoterData(voter1.address);
        expect(voterData.isRegistered).to.equal(false);
        expect(voterData.reputation).to.equal(0);
        expect(voterData.voteCount).to.equal(0);
      });
    });

    describe("isRegistered", function () {
      it("should return true for registered voter", async function () {
        await postManager.registerVoter(voter1.address);
        expect(await postManager.isRegistered(voter1.address)).to.be.true;
      });

      it("should return false for unregistered voter", async function () {
        expect(await postManager.isRegistered(voter1.address)).to.be.false;
      });
    });
  });


})
