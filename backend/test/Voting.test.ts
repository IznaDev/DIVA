import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther, TypedDataDomain, TypedDataField } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployVoting } from "./utils/fixtures";

describe("Voting contract tests:", function () {
    let voting: any;
    let divaToken: any;
    let mockUSDC: any;
    let postManager: any;
    let voter1: any;
    let voter2: any;
    let voter3: any;
    let url: string;
    let url2: string;

    before(async function () {
        const votingFixture = await loadFixture(deployVoting);
        voting = votingFixture.voting;
        divaToken = votingFixture.divaToken;
        postManager = votingFixture.postManager;
        mockUSDC = votingFixture.mockUSDC;
        voter1 = votingFixture.voter1;
        voter2 = votingFixture.voter2;
        voter3 = votingFixture.voter3;
        url = "https://www.exemple.com/content";
        url2 = "https://www.exemple2.com"



    })
    describe("Deployment tests", function () {
        it("should set the DivaToken address", async function () {
            expect(await voting.divaToken()).to.equal(await divaToken.getAddress());
        });
        it("should set the MockUSDC address", async function () {
            expect(await voting.mockUSDC()).to.equal(await mockUSDC.getAddress());
        });

    })
    let mockUSDCDomain: TypedDataDomain;
    let divaTokenDomain: TypedDataDomain;
    let types: Record<string, Array<TypedDataField>>;
    let voter1Wallet: any;
    let voter2Wallet: any;
    before(async function () {

        const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        voter1Wallet = new ethers.Wallet(privateKey, ethers.provider);

        const privateKey2 = "0x42c1095e998f97a5a0044966f0945389ae9e86dae88b7a8412f4603c6b78690d";
        voter2Wallet = new ethers.Wallet(privateKey2, ethers.provider);

        // Configurer le domaine EIP-712 pour les signatures de MockUSDC
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
        await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));

    });

    describe("Token purchase tests", function () {

        it("should successfully purchase Diva tokens with permit", async function () {
            const usdcAmount = ethers.parseEther("10");
            await mockUSDC.mint(voter1Wallet.address, usdcAmount);

            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 heure dans le futur
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

            const initialDivaBalance = await divaToken.balanceOf(voter1Wallet.address);

            await voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            );

            const conversionRate = await divaToken.conversionRate();
            const expectedDivaAmount = BigInt(usdcAmount) * BigInt(10 ** 12) * BigInt(conversionRate);
            const finalDivaBalance = await divaToken.balanceOf(voter1Wallet.address);

            expect(finalDivaBalance).to.equal(initialDivaBalance + expectedDivaAmount);
        });

        it("should revert when permit signature has expired", async function () {
            const usdcAmount = ethers.parseEther("10");

            // Deadline dans le passé
            const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 heure dans le passé
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

            // La transaction devrait échouer car le deadline est dans le passé
            await expect(voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            )).to.be.revertedWith("ERC20Permit: expired deadline");
        });

        it("should register the buyer as a voter ", async function () {
            expect(await postManager.isRegistered(voter1Wallet.getAddress())).to.be.true;
        })

        it("should emit TransferDivas event when purchasing with permit", async function () {
            const usdcAmount = ethers.parseEther("10");

            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            const conversionRate = await divaToken.conversionRate();
            const divaAmount = BigInt(usdcAmount) * BigInt(10 ** 12) * BigInt(conversionRate);

            await expect(voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            )).to.emit(voting, "TransferDivas").withArgs(voter1Wallet.address, divaAmount);
        });
    })
    before(async function () {
        const usdcAmount = ethers.parseEther("100");
        await mockUSDC.mint(voter1Wallet.address, usdcAmount);
        await mockUSDC.mint(voter2Wallet.address, usdcAmount);

        // Transférer des ETH aux wallets de test pour payer les frais de transaction
        const [deployer] = await ethers.getSigners();
        await deployer.sendTransaction({
            to: voter1Wallet.address,
            value: ethers.parseEther("1")
        });
        await deployer.sendTransaction({
            to: voter2Wallet.address,
            value: ethers.parseEther("1")
        });

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 heure dans le futur
        const nonce = await mockUSDC.nonces(voter1Wallet.address);
        const nonce2 = await mockUSDC.nonces(voter2Wallet.address);

        const value = {
            owner: voter1Wallet.address,
            spender: await voting.getAddress(),
            value: usdcAmount,
            nonce: nonce,
            deadline: deadline
        };

        const value2 = {
            owner: voter2Wallet.address,
            spender: await voting.getAddress(),
            value: usdcAmount,
            nonce: nonce2,
            deadline: deadline
        };

        const signature = await voter1Wallet.signTypedData(mockUSDCDomain, types, value);
        const signature2 = await voter2Wallet.signTypedData(mockUSDCDomain, types, value2);
        const { v, r, s } = ethers.Signature.from(signature);

        await voting.connect(voter1Wallet).purchaseDivas(
            usdcAmount,
            deadline,
            v,
            r,
            s
        );

        const { v: v2, r: r2, s: s2 } = ethers.Signature.from(signature2);
        await voting.connect(voter2Wallet).purchaseDivas(
            usdcAmount,
            deadline,
            v2,
            r2,
            s2
        );
    })

    describe(" Posts creating tests:", function () {
        it("should revert when a user unregistred attempt to post something", async function () {
            const amount = parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await divaToken.nonces(voter1.address);

            const value = {
                owner: voter1.address,
                spender: await voting.getAddress(),
                value: amount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1.signTypedData(divaTokenDomain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await expect(voting.connect(voter1).createPost(url, amount, deadline, v, r, s))
                .to.be.revertedWith("Voter not registered");
        })

        it("should revert when a registred user attempt to post something with an insufficient allowance", async function () {
            const amount = parseEther("4"); // Montant insuffisant
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            await expect(voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s))
                .to.be.rejectedWith("ERC20: insufficient allowance");
        })

        it("shoul not revert whan a voter post something with a sufficient balance", async function () {
            const amount = parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            await expect(voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s))
                .to.be.not.reverted;
        })

        it("should revert when a voter attempt to post an url already posted", async function () {
            const amount = parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            await expect(voting.connect(voter1Wallet).createPost(url, amount, deadline, v, r, s))
                .to.be.revertedWith("URL already exists");
        })

        it("should emit a PostCreated event when a voter success to create a post", async function () {
            const amount = parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            await expect(voting.connect(voter1Wallet).createPost(url2, amount, deadline, v, r, s))
                .to.emit(postManager, "PostCreated");
        })
        it("should set the post ID by hashing the url", async function () {
            // Utiliser keccak256 et toUtf8Bytes pour calculer le hash comme le fait Solidity
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));

            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);

            // Vérifier que le post existe avec cet ID
            const post = await postManager.posts(postId);
            expect(post.urlExists).to.be.true;
        })
    })
    describe("Vote tests:", function () {
        before(async function () {
            // S'assurer qu'un post existe avant de tester les votes
            // Utiliser une URL différente pour éviter le conflit
            const voteTestUrl = "https://example.com/vote-test-post";
            const amount = parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            // Créer un post pour les tests de vote
            await voting.connect(voter1Wallet).createPost(voteTestUrl, amount, deadline, v, r, s);

            // Mettre à jour la variable url pour les tests de vote
            url = voteTestUrl;
        });
        it("should revert when a user unregistred attempt to vote", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            const amount = parseEther("1");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await divaToken.nonces(voter1.address);

            const value = {
                owner: voter1.address,
                spender: await voting.getAddress(),
                value: amount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1.signTypedData(divaTokenDomain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1).vote(postId, BigInt(2), amount, deadline, v, r, s))
                .to.be.revertedWith("Voter not registered");
        })

        it("should revert when a user unregistred attempt to vote with a too high amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            const amount = parseEther("60"); // Montant trop élevé
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), amount, deadline, v, r, s))
                .to.be.revertedWith("Stake too high");
        })

        it("should revert when a user unregistred attempt to vote with a too low amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            const amount = parseEther("0.09"); // Montant trop faible
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), amount, deadline, v, r, s))
                .to.be.revertedWith("Stake too low");
        })

        it("should not revert when a voter votes with a valid amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            const amount = parseEther("1");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
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

            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), amount, deadline, v, r, s))
                .to.not.be.reverted;
        })

        it("should emit VoteCast event when a voter vote successfully", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);
            const amount = parseEther("1");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await divaToken.nonces(voter2Wallet.address);

            const value = {
                owner: voter2Wallet.address,
                spender: await voting.getAddress(),
                value: amount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter2Wallet.signTypedData(divaTokenDomain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await expect(voting.connect(voter2Wallet).vote(postId, BigInt(2), amount, deadline, v, r, s))
                .to.emit(postManager, "VoteCast")
                .withArgs(postId, await voter2Wallet.getAddress(), BigInt(2), amount);
        })
        it("should increment post's fake votes account after a vote 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.fakeVoteCount).equal(2);

        })
        it("should add the voter's stake amount to totalFakeStake when he votes 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.totalFakeStake).equal(parseEther("2"));

        })
        it("should add the voter's reputation to totalFakereputation when he votes 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.totalFakeReputation).equal(2);

        })
        it("should create a new vote with the choice's voter when he votes", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);

            // Récupérer l'adresse du votant
            const voter1Address = await voter1Wallet.getAddress();

            // Récupérer le vote et vérifier son choix
            const vote = await postManager.getVote(postId, voter1Address);
            expect(BigInt(vote.choice)).to.equal(BigInt(2));
        })

    })



    describe("PostManager Access Functions Tests", function () {
        let postId: bigint;
        let testUrl: string;

        before(async function () {
            // Créer un post pour les tests
            testUrl = "https://example.com/access-functions-test";

            // S'assurer que voter1Wallet a assez de DIVA tokens
            const divaBalance = await divaToken.balanceOf(voter1Wallet.address);
            if (divaBalance < ethers.parseEther("5")) {
                // Acheter des DIVA tokens si nécessaire
                const usdcAmount = ethers.parseEther("10");
                const deadline = Math.floor(Date.now() / 1000) + 3600;
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
            }

            // Créer un post avec permit pour DivaToken
            // Utiliser POST_STAKE_AMOUNT (5 DIVA) comme défini dans le contrat
            const divaAmount = ethers.parseEther("5");
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await divaToken.nonces(voter1Wallet.address);

            const value = {
                owner: voter1Wallet.address,
                spender: await voting.getAddress(),
                value: divaAmount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1Wallet.signTypedData(divaTokenDomain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await voting.connect(voter1Wallet).createPost(
                testUrl,
                divaAmount,
                deadline,
                v,
                r,
                s
            );

            // Récupérer l'ID du post
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(testUrl));
            postId = BigInt(iDUrl);

            // Pour les tests, nous allons d'abord enregistrer voter2Wallet comme votant
            if (!await postManager.isRegistered(voter2Wallet.address)) {
                await voting.connect(voter1Wallet).registerVoterForTesting(voter2Wallet.address);
            }

            // Ensuite, nous modifions directement le storage pour configurer sa réputation à 50
            const postManagerAddress = await postManager.getAddress();
            const voterSlot = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [voter2Wallet.address, 0] // le mapping des voters est à la position 0
            );

            // La position de la réputation est à offset 1 dans la struct Voter
            const reputationSlot = ethers.toBigInt(voterSlot) + 1n;

            // Modifier directement le storage pour attribuer une réputation de 50
            await ethers.provider.send("hardhat_setStorageAt", [
                postManagerAddress,
                ethers.toBeHex(reputationSlot),
                ethers.toBeHex(50, 32) // 50 avec padding à 32 bytes
            ]);

            const voteAmount = ethers.parseEther("5");
            const voteDeadline = Math.floor(Date.now() / 1000) + 3600;
            const voteNonce = await divaToken.nonces(voter2Wallet.address);

            const voteValue = {
                owner: voter2Wallet.address,
                spender: await voting.getAddress(),
                value: voteAmount,
                nonce: voteNonce,
                deadline: voteDeadline
            };

            const voteSignature = await voter2Wallet.signTypedData(divaTokenDomain, types, voteValue);
            const voteSig = ethers.Signature.from(voteSignature);

            // Voter TRUE avec 5 DIVA
            await voting.connect(voter2Wallet).vote(
                postId,
                1,  // 1 corresponds to PostManager.VoteOption.True
                voteAmount,
                voteDeadline,
                voteSig.v,
                voteSig.r,
                voteSig.s
            );

            // Maintenant nous devons mettre à jour directement la totalTrueReputation du post
            // Le mapping des posts est stocké à l'index 2 dans PostManager
            const postKey = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [postId, 2] // 2 est l'index du mapping des posts
            );

            // La position de totalTrueReputation est à offset 3 dans la struct Post
            const totalTrueReputationSlot = ethers.toBigInt(postKey) + 3n;

            // Mettre à jour totalTrueReputation à 50
            await ethers.provider.send("hardhat_setStorageAt", [
                postManagerAddress,
                ethers.toBeHex(totalTrueReputationSlot),
                ethers.toBeHex(50, 32) // 50 avec padding à 32 bytes
            ]);
        });

        describe("getVoters function", function () {
            it("should return the correct list of voters for a post", async function () {
                const voters = await postManager.getVoters(postId);

                expect(voters.length).to.be.greaterThan(0);
                expect(voters).to.include(voter2Wallet.address);
            });
        });

        describe("getPostStatus function", function () {
            it("should return true and active status for the test post", async function () {
                const [exists, status] = await postManager.getPostStatus(postId);

                expect(exists).to.be.true;
                // VoteStatus.Active = 0
                expect(status).to.equal(0);
            });

            it("should return false for a non-existent post", async function () {
                const nonExistentPostId = ethers.keccak256(ethers.toUtf8Bytes("non-existent-url"));
                const [exists,] = await postManager.getPostStatus(nonExistentPostId);

                expect(exists).to.be.false;
            });
        });

    });
})