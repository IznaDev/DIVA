// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import "./DivaToken.sol";
import "./PostManager.sol";

contract Voting is Ownable, ReentrancyGuard, EIP712 {
    using SafeMath for uint256;
    using ECDSA for bytes32;
    // Constants
    uint256 public constant MIN_STAKE_AMOUNT = 100000000000000000; // 0.1 DIVAS (18 décimales)
    uint256 public constant MAX_STAKE_AMOUNT = 50 * 1e18; // 50 DIVAS

    uint256 public constant POST_STAKE_AMOUNT = 5e18; // 1 DIVA  pour poster

    uint256 public constant DIVA_PRICE = 1e16; // 0.01 USDC per DIVA

    // Variables
    IERC20 public mockUSDC;
    DivaToken public divaToken;
    PostManager public postManager;

    // Events
    event TransferDivas(address indexed to, uint256 value);
    event VoteFailed(uint256 indexed postId, uint256 timestamp);
    event ReputationUpdated(address indexed voter, uint256 newReputation);

    //Constructor
    constructor(address _mockUSDC) EIP712("Voting", "1") {
        mockUSDC = IERC20(_mockUSDC);

        // Déployer les contrats
        divaToken = new DivaToken();
        postManager = new PostManager();

        // Transférer la propriété des contrats au contrat Voting
        divaToken.transferOwnership(address(this));
        postManager.transferOwnership(address(this));
    }

    //Functions
    function purchaseDivas(
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");

        IERC20Permit(address(mockUSDC)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );
        require(
            mockUSDC.transferFrom(msg.sender, address(this), _amount),
            "USDC transfer failed"
        );

        uint256 _divaAmount = _amount * 10 ** 12 * divaToken.conversionRate();
        require(
            divaToken.mint(msg.sender, _divaAmount),
            "Minting Divas failed"
        );
        if (!postManager.isRegistered(msg.sender)) {
            postManager.registerVoter(msg.sender);
        }

        emit TransferDivas(msg.sender, _divaAmount);
    }

    function createPost(
        string calldata _contentUrl,
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant {
        require(postManager.isRegistered(msg.sender), "Voter not registered");

        IERC20Permit(address(divaToken)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );

        require(
            divaToken.transferFrom(
                msg.sender,
                address(this),
                POST_STAKE_AMOUNT
            ),
            "Transfer failed"
        );

        postManager.createPost(msg.sender, _contentUrl);
    }

    function vote(
        uint256 _postId,
        PostManager.VoteOption _choice,
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant {
        require(postManager.isRegistered(msg.sender), "Voter not registered");
        require(_amount >= MIN_STAKE_AMOUNT, "Stake too low");
        require(_amount <= MAX_STAKE_AMOUNT, "Stake too high");

        // Utiliser permit pour approuver les tokens DIVA
        IERC20Permit(address(divaToken)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );

        require(
            divaToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        postManager.setVote(_postId, _choice, _amount, msg.sender);
    }

    // Mapping pour suivre les récompenses distribuées
    mapping(uint256 => bool) public rewardsDistributed;

    // Événement émis lors de la finalisation et distribution
    event VoteFinalized(
        uint256 indexed postId,
        PostManager.VoteOption result,
        uint256 majority,
        uint256 totalRewarded,
        uint256 totalReturned,
        uint256 winnerCount,
        uint256 loserCount
    );

    /**
     * @dev Finalise un vote et distribue les récompenses aux votants
     * @param _postId L'identifiant du post à finaliser
     * @return Succès de l'opération
     */
    function finalizeAndDistribute(
        uint256 _postId
    ) external nonReentrant returns (bool) {
        // Vérifier que les récompenses n'ont pas déjà été distribuées
        require(!rewardsDistributed[_postId], "Rewards already distributed");

        // 1. Vérifier l'état du post
        (bool exists, PostManager.VoteStatus status) = postManager
            .getPostStatus(_postId);
        require(exists, "Post does not exist");

        // 2. Finaliser le vote si ce n'est pas déjà fait
        if (status == PostManager.VoteStatus.Active) {
            try postManager.finalizeVote(_postId) {
                // Succès de la finalisation
            } catch {
                revert("Cannot finalize vote yet");
            }
        }

        // 3. Vérifier que le vote est bien finalisé
        (, status) = postManager.getPostStatus(_postId);
        require(
            status == PostManager.VoteStatus.Completed,
            "Voting not completed"
        );

        // 4. Marquer comme distribuées pour éviter les redistributions
        rewardsDistributed[_postId] = true;

        // 5. Récupérer les totaux et vérifier si le vote a reçu des participations
        (
            uint256 totalTrueStake,
            uint256 totalFakeStake,
            uint256 totalTrueReputation,
            uint256 totalFakeReputation
        ) = postManager.getPostTotals(_postId);

        uint256 totalVotes = totalTrueReputation + totalFakeReputation;
        if (totalVotes == 0) {
            emit VoteFinalized(
                _postId,
                PostManager.VoteOption.None,
                0,
                0,
                0,
                0,
                0
            );
            return true;
        }

        // 6. Déterminer le résultat et les pourcentages
        uint256 truePercentage = (totalTrueReputation * 100) / totalVotes;
        PostManager.VoteOption winningOption;
        uint256 majority;

        // 7. Gérer le cas d'égalité (50/50)
        if (truePercentage == 50) {
            // En cas d'égalité, tous les votants récupèrent leur mise complète
            uint256 returnedAmount = _returnAllStakes(_postId);
            emit VoteFinalized(
                _postId,
                PostManager.VoteOption.None,
                50,
                0,
                returnedAmount,
                0,
                0
            );
            return true;
        }
        // 8. Déterminer le gagnant
        else if (truePercentage > 50) {
            winningOption = PostManager.VoteOption.True;
            majority = truePercentage;
        } else {
            winningOption = PostManager.VoteOption.Fake;
            majority = 100 - truePercentage;
        }

        // 9. Distribuer les récompenses
        (
            uint256 totalRewarded,
            uint256 totalReturned,
            uint256 winnerCount,
            uint256 loserCount
        ) = _distributeRewards(
                _postId,
                totalTrueStake,
                totalFakeStake,
                winningOption
            );

        // 10. Émettre l'événement de finalisation avec toutes les statistiques
        emit VoteFinalized(
            _postId,
            winningOption,
            majority,
            totalRewarded,
            totalReturned,
            winnerCount,
            loserCount
        );

        return true;
    }

    /**
     * @dev Retourne toutes les mises aux votants (utilisé en cas d'égalité)
     * @param _postId L'identifiant du post
     * @return Le montant total retourné
     */
    function _returnAllStakes(uint256 _postId) private returns (uint256) {
        uint256 returnedAmount = 0;
        address[] memory voters = postManager.getVoters(_postId);
        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            PostManager.Vote memory voteData = postManager.getVote(
                _postId,
                voter
            );

            if (
                voteData.choice != PostManager.VoteOption.None &&
                !voteData.withdrawn
            ) {
                divaToken.transfer(voter, voteData.stakeAmount);
                returnedAmount += voteData.stakeAmount;
            }
        }
        return returnedAmount;
    }

    /**
     * @dev Distribue les récompenses aux gagnants et retourne une partie des mises aux perdants
     * @param _postId L'identifiant du post
     * @param totalTrueStake Le total des mises pour l'option True
     * @param totalFakeStake Le total des mises pour l'option Fake
     * @param winningOption L'option gagnante
     * @return totalRewarded Le montant total des récompenses distribuées
     * @return totalReturned Le montant total retourné aux perdants
     * @return winnerCount Le nombre de gagnants
     * @return loserCount Le nombre de perdants
     */
    /**
     * @dev Calcule le montant total confisqué des perdants
     */
    function _calculateTotalSlashed(
        uint256 totalTrueStake,
        uint256 totalFakeStake,
        PostManager.VoteOption winningOption
    ) private pure returns (uint256) {
        // Calculer le montant total mis en jeu par les perdants
        uint256 totalLosersStake = (winningOption ==
            PostManager.VoteOption.True)
            ? totalFakeStake
            : totalTrueStake;

        // Seulement 40% des jetons des perdants sont confisqués pour les récompenses
        return (totalLosersStake * 40) / 100;
    }

    /**
     * @dev Calcule le poids total des gagnants basé sur la racine carrée des mises
     */
    function _calculateTotalWinnerWeight(
        uint256 _postId,
        PostManager.VoteOption winningOption
    ) private view returns (uint256) {
        uint256 totalWinnerWeight = 0;
        address[] memory voters = postManager.getVoters(_postId);

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            PostManager.Vote memory voteData = postManager.getVote(
                _postId,
                voter
            );

            if (voteData.choice == winningOption && !voteData.withdrawn) {
                totalWinnerWeight += sqrt(voteData.stakeAmount);
            }
        }

        return totalWinnerWeight;
    }

    /**
     * @dev Calcule la récompense pour un gagnant
     */
    function _calculateWinnerReward(
        PostManager.Vote memory voteData,
        uint256 totalSlashed,
        uint256 totalWinnerWeight
    ) private pure returns (uint256) {
        if (totalWinnerWeight == 0) return 0;

        // Calcul équitable basé sur la racine carrée de la mise
        uint256 voterWeight = sqrt(voteData.stakeAmount);
        uint256 reward = (totalSlashed * voterWeight) / totalWinnerWeight;

        // Limiter la récompense à 25% de la mise pour éviter les déséquilibres
        uint256 maxReward = (voteData.stakeAmount * 25) / 100;
        return (reward > maxReward) ? maxReward : reward;
    }

    /**
     * @dev Traite un votant gagnant
     */
    function _processWinner(
        address voter,
        PostManager.Vote memory voteData,
        uint256 totalSlashed,
        uint256 totalWinnerWeight
    ) private returns (uint256 reward) {
        reward = _calculateWinnerReward(
            voteData,
            totalSlashed,
            totalWinnerWeight
        );

        // Transférer mise + récompense
        divaToken.transfer(voter, voteData.stakeAmount + reward);

        // Augmenter la réputation du gagnant
        postManager.updateReputation(voter, 1);

        return reward;
    }

    /**
     * @dev Traite un votant perdant
     */
    function _processLoser(
        address voter,
        PostManager.Vote memory voteData
    ) private returns (uint256 returnAmount) {
        // PERDANT: récupère 60% de sa mise
        returnAmount = (voteData.stakeAmount * 60) / 100;

        divaToken.transfer(voter, returnAmount);

        // Diminuer la réputation du perdant
        postManager.updateReputation(voter, -1);

        return returnAmount;
    }

    /**
     * @dev Distribue les récompenses aux votants
     */
    function _distributeRewards(
        uint256 _postId,
        uint256 totalTrueStake,
        uint256 totalFakeStake,
        PostManager.VoteOption winningOption
    )
        private
        returns (
            uint256 totalRewarded,
            uint256 totalReturned,
            uint256 winnerCount,
            uint256 loserCount
        )
    {
        uint256 totalSlashed = _calculateTotalSlashed(
            totalTrueStake,
            totalFakeStake,
            winningOption
        );
        uint256 totalWinnerWeight = _calculateTotalWinnerWeight(
            _postId,
            winningOption
        );

        address[] memory voters = postManager.getVoters(_postId);

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            PostManager.Vote memory voteData = postManager.getVote(
                _postId,
                voter
            );

            // Ignorer les votes nuls ou retirés
            if (
                voteData.choice == PostManager.VoteOption.None ||
                voteData.withdrawn
            ) continue;

            if (voteData.choice == winningOption) {
                uint256 reward = _processWinner(
                    voter,
                    voteData,
                    totalSlashed,
                    totalWinnerWeight
                );
                totalRewarded += reward;
                winnerCount++;
            } else {
                uint256 returnAmount = _processLoser(voter, voteData);
                totalReturned += returnAmount;
                loserCount++;
            }
        }

        return (totalRewarded, totalReturned, winnerCount, loserCount);
    }

    /**
     * @dev Calcule la racine carrée entière d'un nombre methode newton raphson
     * @param x Le nombre dont on veut la racine carrée
     * @return y La racine carrée entière de x
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        else if (x <= 3) return 1;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function registerVoterForTesting(address _voter) external onlyOwner {
        postManager.registerVoter(_voter);
    }
}
