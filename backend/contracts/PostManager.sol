// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PostManager
/// @notice Gère les posts et les votes dans le système DIVA
contract PostManager is Ownable {
    uint256 public constant QUORUM_POINTS = 1000;
    uint256 public constant VOTE_DURATION_AFTER_QUORUM = 24 hours;
    uint256 public constant MAX_VOTE_DURATION = 48 hours;
    uint256 public constant MIN_REPUTATION = 1;
    uint256 public constant MAX_REPUTATION = 100;

    enum VoteOption {
        None,
        True,
        Fake
    }

    enum VoteStatus {
        Active,
        Completed
    }

    struct Voter {
        bool isRegistered;
        uint256 reputation;
        uint256 voteCount;
    }

    struct Vote {
        VoteOption choice;
        uint256 stakeAmount;
        uint256 timestamp;
    }

    struct Post {
        string contentUrl;
        address poster;
        uint256 totalTrueStake;
        uint256 totalFakeStake;
        uint256 trueVoteCount;
        uint256 totalTrueReputation;
        uint256 fakeVoteCount;
        uint256 totalFakeReputation;
        uint256 postTime;
        uint256 quorumReachedTime;
        uint256 likeCount;
        uint256 dislikeCount;
        VoteStatus status;
        bool urlExists;
        mapping(address => Vote) votes;
        address[] voters;
    }

    mapping(uint256 => Post) public posts;

    event PostCreated(
        uint256 indexed postId,
        address indexed poster,
        string contentUrl
    );

    event QuorumReached(uint256 indexed postId, uint256 timestamp);
    event VoteCast(
        uint256 indexed postId,
        address indexed voter,
        VoteOption vote,
        uint256 stakeAmount
    );

    event VoteCompleted(
        uint256 indexed postId,
        VoteOption result,
        uint256 majority
    );

    event VoterRegistered(address indexed voter);
    event ReputationUpdated(address indexed voter, uint256 newReputation);

    mapping(address => Voter) public voters;

    /// @notice Initialise le contrat
    constructor() {}

    /// @notice Crée un nouveau post
    /// @param _poster Adresse du créateur
    /// @param _contentUrl URL du contenu
    /// @return ID du post créé
    function createPost(
        address _poster,
        string calldata _contentUrl
    ) external onlyOwner returns (uint256) {
        bytes32 _urlHash = keccak256(abi.encodePacked(_contentUrl));
        uint256 _postId = uint256(_urlHash);

        require(!posts[_postId].urlExists, "URL already exists");

        Post storage newPost = posts[_postId];
        newPost.contentUrl = _contentUrl;
        newPost.poster = _poster;
        newPost.status = VoteStatus.Active;
        newPost.urlExists = true;
        newPost.voters = new address[](0);
        newPost.postTime = block.timestamp;

        emit PostCreated(_postId, _poster, _contentUrl);

        return _postId;
    }

    /// @notice Enregistre un vote sur un post
    /// @param _postId ID du post
    /// @param _vote Option de vote (True/Fake)
    /// @param _stakeAmount Montant mis en jeu
    /// @param _voters Adresse du votant
    function setVote(
        uint256 _postId,
        VoteOption _vote,
        uint256 _stakeAmount,
        address _voters
    ) external onlyOwner {
        require(posts[_postId].urlExists, "Post does not exist");

        require(
            posts[_postId].votes[_voters].choice == VoteOption.None,
            "Voter has already voted"
        );

        Post storage _post = posts[_postId];
        require(_post.status == VoteStatus.Active, "Voting closed");

        uint256 _deadline;

        if (_post.status == VoteStatus.Active) {
            if (_post.quorumReachedTime > 0) {
                _deadline =
                    _post.quorumReachedTime +
                    VOTE_DURATION_AFTER_QUORUM;
            } else {
                _deadline = _post.postTime + MAX_VOTE_DURATION;
            }
            if (block.timestamp >= _deadline) {
                _post.status = VoteStatus.Completed;
                return;
            }
        }

        _post.votes[_voters] = Vote({
            choice: _vote,
            stakeAmount: _stakeAmount,
            timestamp: block.timestamp
        });

        _post.voters.push(_voters);

        uint256 reputation = voters[_voters].reputation;

        if (_vote == VoteOption.True) {
            _post.trueVoteCount++;
            _post.totalTrueStake += _stakeAmount;
            _post.totalTrueReputation += reputation;
        } else {
            _post.fakeVoteCount++;
            _post.totalFakeStake += _stakeAmount;
            _post.totalFakeReputation += reputation;
        }

        uint256 _totalReputation = _post.totalTrueReputation +
            _post.totalFakeReputation;

        if (_post.quorumReachedTime == 0 && _totalReputation >= QUORUM_POINTS) {
            _post.quorumReachedTime = block.timestamp;
            emit QuorumReached(_postId, block.timestamp);
        }

        emit VoteCast(_postId, _voters, _vote, _stakeAmount);
    }

    /// @notice Finalise un vote
    /// @param _postId ID du post
    function finalizeVote(uint256 _postId) external onlyOwner {
        Post storage post = posts[_postId];
        require(post.status == VoteStatus.Active, "Vote already finalized");

        bool isTimeExpired = false;
        uint256 deadline;

        if (post.quorumReachedTime > 0) {
            deadline = post.quorumReachedTime + VOTE_DURATION_AFTER_QUORUM;
        } else {
            deadline = post.postTime + MAX_VOTE_DURATION;
        }

        isTimeExpired = block.timestamp >= deadline;
        require(
            isTimeExpired || msg.sender == owner(),
            "Cannot finalize vote yet"
        );
        post.status = VoteStatus.Completed;

        VoteOption result;
        uint256 totalVotes = post.totalTrueReputation +
            post.totalFakeReputation;

        if (totalVotes == 0) {
            result = VoteOption.None;
            emit VoteCompleted(_postId, result, 50);
        } else {
            uint256 trueVotes = (post.totalTrueReputation * 100) / totalVotes;

            if (trueVotes > 50) {
                result = VoteOption.True;
                emit VoteCompleted(_postId, result, trueVotes);
            } else if (trueVotes < 50) {
                result = VoteOption.Fake;
                emit VoteCompleted(_postId, result, 100 - trueVotes);
            } else {
                result = VoteOption.None;
                emit VoteCompleted(_postId, result, 50);
            }
        }
    }

    function getVote(
        uint256 _postId,
        address _voter
    ) external view returns (Vote memory) {
        return posts[_postId].votes[_voter];
    }

    /**
     * @dev Récupère la liste des votants pour un post
     * @param _postId Identifiant du post
     * @return Liste des adresses des votants
     */
    function getVoters(
        uint256 _postId
    ) external view returns (address[] memory) {
        return posts[_postId].voters;
    }

    /**
     * @dev Vérifie si un post existe et son statut
     * @param _postId Identifiant du post
     * @return exists Si le post existe
     * @return status Statut du post
     */
    function getPostStatus(
        uint256 _postId
    ) external view returns (bool exists, VoteStatus status) {
        Post storage post = posts[_postId];
        return (post.urlExists, post.status);
    }

    /**
     * @dev Récupère les totaux des mises et de la réputation pour un post
     * @param _postId Identifiant du post
     * @return totalTrueStake Mise totale pour l'option "True"
     * @return totalFakeStake Mise totale pour l'option "Fake"
     * @return totalTrueReputation Réputation totale pour l'option "True"
     * @return totalFakeReputation Réputation totale pour l'option "Fake"
     */
    function getPostTotals(
        uint256 _postId
    )
        external
        view
        returns (
            uint256 totalTrueStake,
            uint256 totalFakeStake,
            uint256 totalTrueReputation,
            uint256 totalFakeReputation
        )
    {
        Post storage post = posts[_postId];
        return (
            post.totalTrueStake,
            post.totalFakeStake,
            post.totalTrueReputation,
            post.totalFakeReputation
        );
    }

    /// @notice Enregistre un nouveau votant
    /// @param _voter Adresse du votant
    function registerVoter(address _voter) external onlyOwner {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter] = Voter({
            isRegistered: true,
            reputation: MIN_REPUTATION,
            voteCount: 0
        });
        emit VoterRegistered(_voter);
    }

    /// @notice Met à jour la réputation d'un votant
    /// @param _voter Adresse du votant
    /// @param _change Changement de réputation (positif ou négatif)
    function updateReputation(
        address _voter,
        int256 _change
    ) external onlyOwner {
        require(voters[_voter].isRegistered, "Voter not registered");

        if (_change > 0) {
            uint256 newRep = voters[_voter].reputation + uint256(_change);
            if (newRep > MAX_REPUTATION) {
                newRep = MAX_REPUTATION;
            }
            voters[_voter].reputation = newRep;
        } else if (_change < 0) {
            uint256 change = uint256(-_change);
            if (change >= voters[_voter].reputation) {
                voters[_voter].reputation = MIN_REPUTATION;
            } else {
                voters[_voter].reputation -= change;
            }
        }

        emit ReputationUpdated(_voter, voters[_voter].reputation);
    }

    /// @notice Vérifie si un votant est enregistré
    /// @param _voter Adresse du votant
    /// @return Statut d'enregistrement
    function isRegistered(address _voter) external view returns (bool) {
        return voters[_voter].isRegistered;
    }

    /// @notice Récupère les données d'un votant
    /// @param _voter Adresse du votant
    /// @return Les données du votant
    function getVoterData(address _voter) external view returns (Voter memory) {
        return voters[_voter];
    }
}
