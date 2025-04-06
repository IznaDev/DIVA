import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther, TypedDataDomain, TypedDataField } from "ethers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployVoting } from "./utils/fixtures";

describe("Voting Coverage Tests", function () {
  let voting: any;
  let divaToken: any;
  let mockUSDC: any;
  let postManager: any;
  let owner: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;
  let voter4: any;

  // Wallets pour les tests spécifiques
  let voter1Wallet: any;
  let voter2Wallet: any;
  let voter3Wallet: any;
  let voter4Wallet: any;

  // Domains et types pour EIP-712
  let mockUSDCDomain: TypedDataDomain;
  let divaTokenDomain: TypedDataDomain;
  let types: Record<string, Array<TypedDataField>>;

  before(async function () {
    const votingFixture = await loadFixture(deployVoting);
    voting = votingFixture.voting;
    divaToken = votingFixture.divaToken;
    postManager = votingFixture.postManager;
    mockUSDC = votingFixture.mockUSDC;
    owner = votingFixture.owner;
    voter1 = votingFixture.voter1;
    voter2 = votingFixture.voter2;
    voter3 = votingFixture.voter3;

    // Initialiser les wallets
    voter1Wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", ethers.provider);
    voter2Wallet = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", ethers.provider);
    voter3Wallet = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", ethers.provider);
    voter4Wallet = new ethers.Wallet("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", ethers.provider);

    // Configurer le domaine EIP-712
    const chainId = (await ethers.provider.getNetwork()).chainId;
    mockUSDCDomain = {
      name: "MockUSDC",
      version: "1",
      chainId,
      verifyingContract: await mockUSDC.getAddress()
    };

    divaTokenDomain = {
      name: "DivaToken",
      version: "1",
      chainId,
      verifyingContract: await divaToken.getAddress()
    };

    types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    // Transférer des ETH et des tokens pour les tests
    await owner.sendTransaction({ to: voter1Wallet.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: voter2Wallet.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: voter3Wallet.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: voter4Wallet.address, value: ethers.parseEther("1") });

    await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));
    await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));
    await mockUSDC.mint(voter3Wallet.address, ethers.parseEther("1000"));
    await mockUSDC.mint(voter4Wallet.address, ethers.parseEther("1000"));

    // Acheter des DIVA tokens pour tous les votants
    for (const voter of [voter1Wallet, voter2Wallet, voter3Wallet, voter4Wallet]) {
      const usdcAmount = ethers.parseEther("100");
      // Utiliser un délai bien dans le futur pour éviter les problèmes d'expiration
      const deadline = Math.floor(Date.now() / 1000) + 3600 * 24; // 24 heures
      const nonce = await mockUSDC.nonces(voter.address);

      const value = {
        owner: voter.address,
        spender: await voting.getAddress(),
        value: usdcAmount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter.signTypedData(mockUSDCDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      await voting.connect(voter).purchaseDivas(
        usdcAmount,
        deadline,
        v,
        r,
        s
      );
    }
  });

  describe("Square Root Function Tests", function () {
    it("should return 0 when input is 0", async function () {
      const result = await voting.sqrt(0);
      expect(result).to.equal(0);
    });

    it("should return 1 when input is 1", async function () {
      const result = await voting.sqrt(1);
      expect(result).to.equal(1);
    });

    it("should return 1 when input is 2", async function () {
      const result = await voting.sqrt(2);
      expect(result).to.equal(1);
    });

    it("should return 1 when input is 3", async function () {
      const result = await voting.sqrt(3);
      expect(result).to.equal(1);
    });

    it("should return 2 when input is 4", async function () {
      const result = await voting.sqrt(4);
      expect(result).to.equal(2);
    });

    it("should return 10 when input is 100", async function () {
      const result = await voting.sqrt(100);
      expect(result).to.equal(10);
    });

    it("should handle large numbers correctly", async function () {
      const largeNumber = ethers.parseEther("1000000"); // 10^24
      const result = await voting.sqrt(largeNumber);
      expect(result).to.equal(BigInt("1000000000000"));
    });
  });

  describe("FinalizeAndDistribute Tests", function () {
    let postId: bigint;
    let postUrl: string;

    beforeEach(async function () {
      // Créer un nouveau post pour chaque test
      postUrl = `https://example.com/post-${Date.now()}`;

      // Créer un post avec voter1
      const postAmount = parseEther("5");
      // Utiliser un délai bien dans le futur pour éviter les problèmes d'expiration
      const deadline = Math.floor(Date.now() / 1000) + 3600 * 24; // 24 heures
      const nonce = await divaToken.nonces(voter1Wallet.address);

      const value = {
        owner: voter1Wallet.address,
        spender: await voting.getAddress(),
        value: postAmount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await voter1Wallet.signTypedData(divaTokenDomain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      await voting.connect(voter1Wallet).createPost(postUrl, postAmount, deadline, v, r, s);

      // Calcul du postId
      postId = BigInt(ethers.keccak256(ethers.toUtf8Bytes(postUrl)));
    });

    it("should revert when rewards have already been distributed", async function () {
      // D'abord, finaliser le vote
      await voting.connect(owner).finalizeAndDistribute(postId);

      // Essayer de finaliser à nouveau
      await expect(voting.connect(owner).finalizeAndDistribute(postId))
        .to.be.revertedWith("Rewards already distributed");
    });


    it("should handle post with no votes", async function () {
      // Finaliser un post sans vote
      await expect(voting.connect(owner).finalizeAndDistribute(postId))
        .to.emit(voting, "VoteFinalized")
        .withArgs(postId, 0, 0, 0, 0, 0, 0); // Option.None = 0
    });

    it("should correctly handle the case when totalWinnerWeight is zero", async function () {
      // Manipuler directement le storage pour avoir une situation où le totalWinnerWeight est 0
      // mais il y a encore des gagnants (cas très spécifique qui peut arriver avec des manipulations)

      // Faire voter voter2 pour FAKE
      const fakeVoteAmount = parseEther("10");
      const fakeDeadline = Math.floor(Date.now() / 1000) + 3600;
      const fakeNonce = await divaToken.nonces(voter2Wallet.address);

      const fakeValue = {
        owner: voter2Wallet.address,
        spender: await voting.getAddress(),
        value: fakeVoteAmount,
        nonce: fakeNonce,
        deadline: fakeDeadline
      };

      const fakeSignature = await voter2Wallet.signTypedData(divaTokenDomain, types, fakeValue);
      const fakeSig = ethers.Signature.from(fakeSignature);

      await voting.connect(voter2Wallet).vote(
        postId,
        2, // FAKE
        fakeVoteAmount,
        fakeDeadline,
        fakeSig.v,
        fakeSig.r,
        fakeSig.s
      );

      // Manipuler la réputation pour créer un scénario où FAKE gagne mais avec totalWinnerWeight = 0
      const postManagerAddress = await postManager.getAddress();
      const postKey = ethers.solidityPackedKeccak256(
        ["uint256", "uint256"],
        [postId, 2] // 2 est l'index du mapping des posts
      );

      // Mettre totalFakeReputation > totalTrueReputation
      const totalTrueReputationSlot = ethers.toBigInt(postKey) + 3n;
      const totalFakeReputationSlot = ethers.toBigInt(postKey) + 4n;

      await ethers.provider.send("hardhat_setStorageAt", [
        postManagerAddress,
        ethers.toBeHex(totalTrueReputationSlot),
        ethers.toBeHex(0, 32)
      ]);

      await ethers.provider.send("hardhat_setStorageAt", [
        postManagerAddress,
        ethers.toBeHex(totalFakeReputationSlot),
        ethers.toBeHex(100, 32)
      ]);

      // Modifier la mise du votant pour qu'elle soit de 0 (pour créer un poids de 0)
      const voteKey = ethers.solidityPackedKeccak256(
        ["uint256", "address", "uint256"],
        [postId, voter2Wallet.address, 3] // 3 est l'index du mapping des votes
      );

      // Mettre stakeAmount à 0 pour forcer totalWinnerWeight = 0
      const stakeAmountSlot = ethers.toBigInt(voteKey) + 2n;

      await ethers.provider.send("hardhat_setStorageAt", [
        postManagerAddress,
        ethers.toBeHex(stakeAmountSlot),
        ethers.toBeHex(0, 32)
      ]);

      // Finaliser le vote - cela devrait gérer le cas où totalWinnerWeight = 0
      await expect(voting.connect(owner).finalizeAndDistribute(postId))
        .to.emit(voting, "VoteFinalized");
    });
  });

});
