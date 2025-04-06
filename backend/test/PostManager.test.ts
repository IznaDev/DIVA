import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployVoting, deployPostManager } from "./utils/fixtures";
import { PostManager, Voting } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther, TypedDataDomain, TypedDataField } from "ethers";

describe("PostManager via Voting", function () {
  let postManager: any;
  let voting: any;
  let divaToken: any;
  let mockUSDC: any;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;
  let url: string;
  let url2: string;
  let voter1Wallet: any;
  let voter2Wallet: any;
  let mockUSDCDomain: any;
  let divaTokenDomain: any;
  let types: Record<string, Array<TypedDataField>>;


  beforeEach(async function () {
    const votingFixture = await loadFixture(deployVoting);
    postManager = votingFixture.postManager;
    mockUSDC = votingFixture.mockUSDC;
    divaToken = votingFixture.divaToken;

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

      const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
      voter1Wallet = new ethers.Wallet(privateKey, ethers.provider);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      mockUSDCDomain = {
        name: "MockUSDC",
        version: "1",
        chainId,
        verifyingContract: await mockUSDC.getAddress()
      };

      // Configurer le domaine EIP-712 pour les signatures de DivaToken
      divaTokenDomain = {
        name: "DivaToken",
        version: "1",
        chainId,
        verifyingContract: await divaToken.getAddress()
      };

      // Définir les types pour le permit
      types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      // Transférer des fonds à voter1Wallet pour qu'il puisse interagir
      await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));

      // D'abord, nous devons mint quelques tokens USDC pour voter1
      const usdcAmount = ethers.parseUnits("10", 6);
      await mockUSDC.mint(voter1Wallet.address, usdcAmount);

      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 an (365 jours)000; // 1 an (365 jours)
      const nonce = await mockUSDC.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: usdcAmount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(mockUSDCDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      await voting.connect(voter1Wallet).purchaseDivas(
        usdcAmount,
        deadline,
        v,
        r,
        s
      );

    });

    it("should be registered when the voter buy divas", async function () {
      const voterData = await postManager.getVoterData(voter1Wallet.address);
      expect(voterData.isRegistered).to.equal(true);
    })


    it("should correctly retrieve voter data", async function () {
      const voterData = await postManager.getVoterData(voter1Wallet.address);
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

  describe("PostManager additional branch coverage tests", function () {
    let postManager: any, owner: any, voter1: any, voter2: any, voting: any;
    let voter1Wallet: any;
    let voter2Wallet: any;
    let mockUSDCDomain: TypedDataDomain;
    let divaTokenDomain: TypedDataDomain;
    let types: Record<string, Array<TypedDataField>>;
    let divaToken: any;
    let mockUSDC: any;


    beforeEach(async function () {
      const fixture = await loadFixture(deployVoting);
      voting = fixture.voting;
      divaToken = fixture.divaToken;
      mockUSDC = fixture.mockUSDC;
      owner = fixture.owner;
      voter1 = fixture.voter1;
      voter2 = fixture.voter2;
      postManager = fixture.postManager;
      const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
      voter1Wallet = new ethers.Wallet(privateKey, ethers.provider);
      const [deployer] = await ethers.getSigners();
      await deployer.sendTransaction({
        to: voter1Wallet.address,
        value: ethers.parseEther("1")
      });


      const privateKey2 = "0x42c1095e998f97a5a0044966f0945389ae9e86dae88b7a8412f4603c6b78690d";
      voter2Wallet = new ethers.Wallet(privateKey2, ethers.provider);
      await deployer.sendTransaction({
        to: voter2Wallet.address,
        value: ethers.parseEther("1")
      });

      const chainId = (await ethers.provider.getNetwork()).chainId;
      mockUSDCDomain = {
        name: "MockUSDC",
        version: "1",
        chainId,
        verifyingContract: await mockUSDC.getAddress()
      };

      // Configurer le domaine EIP-712 pour les signatures de DivaToken
      divaTokenDomain = {
        name: "DivaToken",
        version: "1",
        chainId,
        verifyingContract: await divaToken.getAddress()
      };

      // Définir les types pour le permit
      types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      // Transférer des fonds à voter1Wallet pour qu'il puisse interagir
      //await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));
      //await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));
      // D'abord, nous devons mint quelques tokens USDC pour voter1
      const usdcAmount = ethers.parseUnits("100000", 12);
      await mockUSDC.mint(voter1Wallet.address, usdcAmount);
      await mockUSDC.approve(await voting.getAddress(), usdcAmount);
      await mockUSDC.mint(voter2Wallet.address, usdcAmount);
      await mockUSDC.approve(await voting.getAddress(), usdcAmount);

      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 an (365 jours)000; // 1 an (365 jours)
      const nonce = await mockUSDC.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: usdcAmount,
        nonce: nonce,
        deadline: deadline
      };

      const nonce2 = await mockUSDC.nonces(voter2Wallet.address);

      const value2 = {
        owner: voter2Wallet.address,
        spender: await voting.getAddress(),
        value: usdcAmount,
        nonce: nonce2,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(mockUSDCDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      const signature2 = await voter2Wallet.signTypedData(mockUSDCDomain, types, value2);
      const { v: v2, r: r2, s: s2 } = ethers.Signature.from(signature2);

      await voting.connect(voter1Wallet).purchaseDivas(
        usdcAmount,
        deadline,
        v,
        r,
        s
      );

      await voting.connect(voter2Wallet).purchaseDivas(
        usdcAmount,
        deadline,
        v2,
        r2,
        s2
      );

    });

    it("should close vote in setVote when deadline is reached", async function () {


      const url = "https://example.com/deadline-test";
      const postId = BigInt(ethers.keccak256(ethers.toUtf8Bytes(url)));
      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 an (365 jours)
      const amount = parseEther("10");
      const nonce = await divaToken.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: amount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(divaTokenDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);
      await voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s);

      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]); // Après MAX_VOTE_DURATION
      await ethers.provider.send("evm_mine", []);
      const voteAmount = parseEther("1");

      const voteNonce = await divaToken.nonces(voter1Wallet.address);
      const voteValue = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: voteAmount,
        nonce: voteNonce,
        deadline: deadline
      };
      const voteSignature = await voter1Wallet.signTypedData(divaTokenDomain, types, voteValue);
      const { v: vVote, r: rVote, s: sVote } = ethers.Signature.from(voteSignature);
      await voting.connect(voter1Wallet).vote(postId, 1, voteAmount, deadline, vVote, rVote, sVote);
      const [, status] = await postManager.getPostStatus(postId);
      expect(status).to.equal(1); // Completed
    });

  });

  describe("PostManager branch coverage via Voting", function () {
    let voting: any, postManager: any, divaToken: any, mockUSDC: any, owner: any, voter1Wallet: any, voter2Wallet: any;
    let mockUSDCDomain: any, divaTokenDomain: any, types: any;


    beforeEach(async function () {
      const fixture = await loadFixture(deployVoting);
      voting = fixture.voting;
      postManager = fixture.postManager;
      divaToken = fixture.divaToken;
      mockUSDC = fixture.mockUSDC;
      owner = fixture.owner;
      voter1 = fixture.voter1;
      voter2 = fixture.voter2;


      voter1Wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider);
      voter2Wallet = new ethers.Wallet("0x42c1095e998f97a5a0044966f0945389ae9e86dae88b7a8412f4603c6b78690d", ethers.provider);
      const [deployer] = await ethers.getSigners();
      await deployer.sendTransaction({ to: voter1Wallet.address, value: ethers.parseEther("1") });
      await deployer.sendTransaction({ to: voter2Wallet.address, value: ethers.parseEther("1") });
      const chainId = (await ethers.provider.getNetwork()).chainId;
      mockUSDCDomain = {
        name: "MockUSDC",
        version: "1",
        chainId,
        verifyingContract: await mockUSDC.getAddress()
      };

      // Configurer le domaine EIP-712 pour les signatures de DivaToken
      divaTokenDomain = {
        name: "DivaToken",
        version: "1",
        chainId,
        verifyingContract: await divaToken.getAddress()
      };

      // Définir les types pour le permit
      types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));
      await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));





    });

    it("should close vote in setVote when deadline is reached via Voting", async function () {
      const url = "https://example.com/deadline-test";
      const postId = ethers.keccak256(ethers.toUtf8Bytes(url));
      const deadline = Math.floor(Date.now() / 1000) + 31536000;

      // Enregistrer voter1 et acheter des DIVAs
      const usdcAmount = ethers.parseUnits("10", 6);
      let nonce = await mockUSDC.nonces(voter1Wallet.address);
      let value = { owner: voter1Wallet.address, spender: await voting.getAddress(), value: usdcAmount, nonce, deadline };
      let sig = ethers.Signature.from(await voter1Wallet.signTypedData(mockUSDCDomain, types, value));
      await voting.connect(voter1Wallet).purchaseDivas(usdcAmount, deadline, sig.v, sig.r, sig.s);

      // Créer un post
      nonce = await divaToken.nonces(voter1Wallet.address);
      value = { owner: voter1Wallet.address, spender: await voting.getAddress(), value: ethers.parseEther("5"), nonce, deadline };
      sig = ethers.Signature.from(await voter1Wallet.signTypedData(divaTokenDomain, types, value));
      await voting.connect(voter1Wallet).createPost(url, ethers.parseEther("5"), deadline, sig.v, sig.r, sig.s);

      // Avancer le temps après MAX_VOTE_DURATION
      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Voter après expiration
      nonce = await divaToken.nonces(voter1Wallet.address);
      value = { owner: voter1Wallet.address, spender: await voting.getAddress(), value: ethers.parseEther("1"), nonce, deadline };
      sig = ethers.Signature.from(await voter1Wallet.signTypedData(divaTokenDomain, types, value));
      await voting.connect(voter1Wallet).vote(postId, 1, ethers.parseEther("1"), deadline, sig.v, sig.r, sig.s);

      const [, status] = await postManager.getPostStatus(postId);
      expect(status).to.equal(1); // Completed
    });

    it("should revert when it attempts to redistribute rewards", async function () {
      const url = "https://example.com/max-reputation-test2";
      const postId = ethers.keccak256(ethers.toUtf8Bytes(url));
      const deadline = Math.floor(Date.now() / 1000) + 31536000;

      // Enregistrer et approvisionner voter1 et voter2
      let usdcAmount = ethers.parseUnits("100", 6);
      let nonce = await mockUSDC.nonces(voter1.address);
      let value = { owner: voter1.address, spender: await voting.getAddress(), value: usdcAmount, nonce, deadline };
      let sig = ethers.Signature.from(await voter1.signTypedData(mockUSDCDomain, types, value));
      await voting.connect(voter1).purchaseDivas(usdcAmount, deadline, sig.v, sig.r, sig.s);

      nonce = await mockUSDC.nonces(voter2.address);
      value = { owner: voter2.address, spender: await voting.getAddress(), value: usdcAmount, nonce, deadline };
      sig = ethers.Signature.from(await voter2.signTypedData(mockUSDCDomain, types, value));
      await voting.connect(voter2).purchaseDivas(usdcAmount, deadline, sig.v, sig.r, sig.s);

      // Créer un post
      nonce = await divaToken.nonces(voter1.address);
      value = { owner: voter1.address, spender: await voting.getAddress(), value: ethers.parseEther("5"), nonce, deadline };
      sig = ethers.Signature.from(await voter1.signTypedData(divaTokenDomain, types, value));
      await voting.connect(voter1).createPost(url, ethers.parseEther("5"), deadline, sig.v, sig.r, sig.s);

      // Voter1 vote True, Voter2 vote Fake
      nonce = await divaToken.nonces(voter1.address);
      value = { owner: voter1.address, spender: await voting.getAddress(), value: ethers.parseEther("1"), nonce, deadline };
      sig = ethers.Signature.from(await voter1.signTypedData(divaTokenDomain, types, value));
      await voting.connect(voter1).vote(postId, 1, ethers.parseEther("1"), deadline, sig.v, sig.r, sig.s);

      nonce = await divaToken.nonces(voter2.address);
      value = { owner: voter2.address, spender: await voting.getAddress(), value: ethers.parseEther("1"), nonce, deadline };
      sig = ethers.Signature.from(await voter2.signTypedData(divaTokenDomain, types, value));
      await voting.connect(voter2).vote(postId, 2, ethers.parseEther("1"), deadline, sig.v, sig.r, sig.s);
      await voting.finalizeAndDistribute(postId);
      await expect(voting.finalizeAndDistribute(postId)).to.be.revertedWith("Rewards already distributed");
    });
  });

  describe("PostManager additional branch coverage tests", function () {
    let voting: any, postManager: any, divaToken: any, mockUSDC: any, owner: any, voter1: any, voter2: any;
    let voter1Wallet: any;
    let voter2Wallet: any;
    let mockUSDCDomain: TypedDataDomain;
    let divaTokenDomain: TypedDataDomain;
    let types: Record<string, Array<TypedDataField>>;

    beforeEach(async function () {
      const fixture = await loadFixture(deployVoting);
      voting = fixture.voting;
      postManager = fixture.postManager;
      divaToken = fixture.divaToken;
      mockUSDC = fixture.mockUSDC;
      owner = fixture.owner;
      voter1 = fixture.voter1;
      voter2 = fixture.voter2;


      voter1Wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider);
      voter2Wallet = new ethers.Wallet("0x42c1095e998f97a5a0044966f0945389ae9e86dae88b7a8412f4603c6b78690d", ethers.provider);
      const [deployer] = await ethers.getSigners();
      await deployer.sendTransaction({ to: voter1Wallet.address, value: ethers.parseEther("1") });
      await deployer.sendTransaction({ to: voter2Wallet.address, value: ethers.parseEther("1") });
      const chainId = (await ethers.provider.getNetwork()).chainId;
      mockUSDCDomain = {
        name: "MockUSDC",
        version: "1",
        chainId,
        verifyingContract: await mockUSDC.getAddress()
      };

      // Configurer le domaine EIP-712 pour les signatures de DivaToken
      divaTokenDomain = {
        name: "DivaToken",
        version: "1",
        chainId,
        verifyingContract: await divaToken.getAddress()
      };

      // Définir les types pour le permit
      types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));
      await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));

      const postId = ethers.keccak256(ethers.toUtf8Bytes(url));
      const deadline = Math.floor(Date.now() / 1000) + 31536000;

      // Enregistrer et approvisionner voter1 et voter2
      let usdcAmount = ethers.parseUnits("100", 6);
      let nonce = await mockUSDC.nonces(voter1Wallet.address);
      let value = { owner: voter1Wallet.address, spender: await voting.getAddress(), value: usdcAmount, nonce, deadline };
      let sig = ethers.Signature.from(await voter1Wallet.signTypedData(mockUSDCDomain, types, value));
      await voting.connect(voter1Wallet).purchaseDivas(usdcAmount, deadline, sig.v, sig.r, sig.s);

      nonce = await mockUSDC.nonces(voter2Wallet.address);
      value = { owner: voter2Wallet.address, spender: await voting.getAddress(), value: usdcAmount, nonce, deadline };
      sig = ethers.Signature.from(await voter2Wallet.signTypedData(mockUSDCDomain, types, value));
      await voting.connect(voter2Wallet).purchaseDivas(usdcAmount, deadline, sig.v, sig.r, sig.s);




    });

    it("should finalize vote with zero votes", async function () {
      const url = "https://example.com/no-votes-test";
      const postId = BigInt(ethers.keccak256(ethers.toUtf8Bytes(url)));
      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 an (365 jours)
      const amount = parseEther("10");
      const nonce = await divaToken.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: amount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(divaTokenDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      await divaToken.connect(voter1Wallet).approve(await voting.getAddress(), amount);
      await voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s);

      await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await voting.connect(voter1Wallet).finalizeAndDistribute(postId); // Via Voting.sol car owner

      const [, status] = await postManager.getPostStatus(postId);
      expect(status).to.equal(1); // Completed
    });

    it("should finalize vote by owner before quorum or deadline", async function () {
      const url = "https://example.com/owner-finalize-test";
      const postId = ethers.keccak256(ethers.toUtf8Bytes(url));
      const amount = parseEther("100"); // Montant insuffisant
      const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 an (365 jours)
      const nonce = await divaToken.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: amount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(divaTokenDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);
      await voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s);


      // Finaliser immédiatement par le owner (Voting.sol)
      await voting.connect(voter1Wallet).finalizeAndDistribute(postId);
      const [, status] = await postManager.getPostStatus(postId);
      expect(status).to.equal(1); // Completed
    });

  });

  // Dans "PostManager additional branch coverage tests"

  it("should handle setVote when quorum is reached exactly at deadline", async function () {
    // Créer une nouvelle instance de PostManager directement pour ce test
    const fixture = await loadFixture(deployPostManager);
    const postManagerInstance = fixture.postManager;
    const ownerInstance = fixture.owner;

    // Créer un nouvel utilisateur
    const [, , , voterInstance] = await ethers.getSigners();

    // Créer un post avec une URL unique
    const url = "https://example.com/quorum-deadline-test-" + Date.now();
    const postId = ethers.keccak256(ethers.toUtf8Bytes(url));
    await postManagerInstance.connect(ownerInstance).createPost(voterInstance.address, url);

    // Avancer le temps juste avant la fin de MAX_VOTE_DURATION
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 - 1]);
    await ethers.provider.send("evm_mine", []);

    // Enregistrer le votant et lui donner 1000 points de réputation (quorum exact)
    await postManagerInstance.connect(ownerInstance).registerVoter(voterInstance.address);
    await postManagerInstance.connect(ownerInstance).updateReputation(voterInstance.address, 999); // 1 + 999 = 1000

    // Voter avec le quorum exact
    await postManagerInstance.connect(ownerInstance).setVote(postId, 1, ethers.parseEther("1"), voterInstance.address);

    // Lorsque le quorum est atteint exactement (1000 points), le vote est automatiquement clôturé
    const [, status] = await postManagerInstance.getPostStatus(postId);
    expect(status).to.equal(1); // Complété car le quorum est atteint exactement
  });

  // Dans "Voter Management dans PostManager" > "updateReputation"
  it("should set reputation to exactly MAX_REPUTATION with precise increase", async function () {
    // Récupérer une nouvelle instance pour ce test spécifique
    const fixture = await loadFixture(deployPostManager);
    const postManagerForTest = fixture.postManager;
    const ownerForTest = fixture.owner;
    const [, , , voter1ForTest] = await ethers.getSigners();

    await postManagerForTest.connect(ownerForTest).registerVoter(voter1ForTest.address);
    await postManagerForTest.connect(ownerForTest).updateReputation(voter1ForTest.address, 99); // 1 + 99 = 100
    const voterData = await postManagerForTest.getVoterData(voter1ForTest.address);
    expect(voterData.reputation).to.equal(100); // MAX_REPUTATION
  });

  it("should set reputation to MIN_REPUTATION with exact decrease", async function () {
    // Récupérer une nouvelle instance pour ce test spécifique
    const fixture = await loadFixture(deployPostManager);
    const postManagerForTest = fixture.postManager;
    const ownerForTest = fixture.owner;
    const [, , , voter1ForTest] = await ethers.getSigners();

    await postManagerForTest.connect(ownerForTest).registerVoter(voter1ForTest.address);
    await postManagerForTest.connect(ownerForTest).updateReputation(voter1ForTest.address, 5); // Réputation = 6
    await postManagerForTest.connect(ownerForTest).updateReputation(voter1ForTest.address, -5); // 6 - 5 = 1
    const voterData = await postManagerForTest.getVoterData(voter1ForTest.address);
    expect(voterData.reputation).to.equal(1); // MIN_REPUTATION
  });

})
