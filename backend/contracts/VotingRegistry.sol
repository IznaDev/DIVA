// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract VotingRegistry is Ownable {
    // Constants
    uint256 public constant MIN_REPUTATION = 1;
    uint256 public constant MAX_REPUTATION = 100;

    enum VoteOption {
        None,
        True,
        Fake
    }

    struct Voter {
        bool isRegistered;
        uint256 reputation;
        uint256 voteCount;
    }

    mapping(address => Voter) public voters;

    event VoterRegistered(address indexed voter);
    event ReputationUpdated(address indexed voter, uint256 newReputation);

    constructor() {}

    function registerVoter(address _voter) external onlyOwner {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter] = Voter({
            isRegistered: true,
            reputation: MIN_REPUTATION,
            voteCount: 0
        });
        emit VoterRegistered(_voter);
    }

    function updateReputation(
        address _voter,
        int256 _change
    ) external onlyOwner {
        require(voters[_voter].isRegistered, "Voter not registered");

        if (_change > 0) {
            // Augmentation de réputation
            uint256 newRep = voters[_voter].reputation + uint256(_change);
            if (newRep > MAX_REPUTATION) {
                newRep = MAX_REPUTATION;
            }
            voters[_voter].reputation = newRep;
        } else if (_change < 0) {
            // Diminution de réputation
            uint256 change = uint256(-_change);
            if (change >= voters[_voter].reputation) {
                voters[_voter].reputation = MIN_REPUTATION;
            } else {
                voters[_voter].reputation -= change;
            }
        }

        emit ReputationUpdated(_voter, voters[_voter].reputation);
    }

    function setVoteCount(address _voter) external onlyOwner {
        require(voters[_voter].isRegistered, "Voter not registered");
        voters[_voter].voteCount++;
    }

    function getVoterData(address _voter) external view returns (Voter memory) {
        require(voters[_voter].isRegistered, "Voter not registered");
        return voters[_voter];
    }

    function isRegistered(address _voter) external view returns (bool) {
        return voters[_voter].isRegistered;
    }
}
