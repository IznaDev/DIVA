// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./VotingRegistry.sol";

contract PostManager is Ownable {
    // Constants
    uint256 public constant QUORUM_POINTS = 1000;
    uint256 public constant VOTE_DURATION_AFTER_QUORUM = 24 hours;
    uint256 public constant MAX_VOTE_DURATION = 48 hours;

    VotingRegistry public votingRegistry;

    enum VoteOption {
        None,
        True,
        Fake
    }

    enum VoteStatus {
        Active,
        Completed
    }

    struct Vote {
        VoteOption choice;
        uint256 stakeAmount;
        uint256 timestamp;
        bool withdrawn;
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
    event VoteWithdrawn(uint256 indexed postId, address indexed voter);

    event VoteCompleted(
        uint256 indexed postId,
        VoteOption result,
        uint256 majority
    );

    constructor(address _votingRegistry) {
        votingRegistry = VotingRegistry(_votingRegistry);
    }

    function createPost(
        string calldata _contentUrl
    ) external returns (uint256) {
        bytes32 _urlHash = keccak256(abi.encodePacked(_contentUrl));
        uint256 _postId = uint256(_urlHash);

        require(!posts[_postId].urlExists, "URL already exists");

        Post storage newPost = posts[_postId];
        newPost.contentUrl = _contentUrl;
        newPost.poster = msg.sender;
        newPost.status = VoteStatus.Active;
        newPost.urlExists = true;
        newPost.voters = new address[](0);
        newPost.postTime = block.timestamp;

        emit PostCreated(_postId, msg.sender, _contentUrl);

        return _postId;
    }

    function setVote(
        uint256 _postId,
        VoteOption _vote,
        uint256 _stakeAmount,
        address _voters
    ) external {
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
            timestamp: block.timestamp,
            withdrawn: false
        });

        _post.voters.push(_voters);

        uint256 reputation = votingRegistry.getVoterData(_voters).reputation;

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

    function withdrawVote(uint256 _postId, address _voter) external {
        Post storage post = posts[_postId];
        require(
            post.votes[_voter].choice != VoteOption.None,
            "No vote to withdraw"
        );

        require(post.quorumReachedTime == 0, "Quorum reached, cannot withdraw");

        if (post.votes[_voter].choice == VoteOption.True) {
            post.trueVoteCount--;
            post.totalTrueStake -= post.votes[_voter].stakeAmount;
            uint256 _reputation = votingRegistry
                .getVoterData(_voter)
                .reputation;
            post.totalTrueReputation -= _reputation;
        } else {
            post.fakeVoteCount--;
            post.totalFakeStake -= post.votes[_voter].stakeAmount;
            uint256 _reputation = votingRegistry
                .getVoterData(_voter)
                .reputation;
            post.totalFakeReputation -= _reputation;
        }

        post.votes[_voter] = Vote({
            choice: VoteOption.None,
            stakeAmount: 0,
            timestamp: 0,
            withdrawn: true
        });
        emit VoteWithdrawn(_postId, _voter);
    }

    function finalizeVote(uint256 _postId) external {
        Post storage post = posts[_postId];
        require(post.status == VoteStatus.Active, "Not in active voting state");
        uint256 deadline;
        if (post.quorumReachedTime > 0) {
            deadline = post.quorumReachedTime + VOTE_DURATION_AFTER_QUORUM;
        } else {
            deadline = post.postTime + MAX_VOTE_DURATION;
        }

        require(block.timestamp >= deadline, "Voting period not ended yet");

        post.status = VoteStatus.Completed;

        VoteOption result;

        uint256 totalVotes = post.totalTrueReputation +
            post.totalFakeReputation;
        uint256 trueVotes = (post.totalTrueReputation * 100) / totalVotes;

        if (totalVotes == 0) {
            result = VoteOption.None;
            emit VoteCompleted(_postId, result, 0);
        } else if (trueVotes > 50) {
            result = VoteOption.True;
            emit VoteCompleted(_postId, result, trueVotes);
        } else if (trueVotes < 50) {
            result = VoteOption.Fake;
            emit VoteCompleted(_postId, result, 100 - trueVotes);
        } else {
            result = VoteOption.None;
            emit VoteCompleted(_postId, result, 50); // No clear majority
        }
    }

    function getVote(
        uint256 _postId,
        address _voter
    ) external view returns (Vote memory) {
        return posts[_postId].votes[_voter];
    }
}
