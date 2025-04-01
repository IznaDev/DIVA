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
import "./VotingRegistry.sol";
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
    VotingRegistry public votingRegistry;
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
        votingRegistry = new VotingRegistry();
        postManager = new PostManager(address(votingRegistry));

        // Transférer la propriété des contrats au contrat Voting
        divaToken.transferOwnership(address(this));
        votingRegistry.transferOwnership(address(this));
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
        if (!votingRegistry.isRegistered(msg.sender)) {
            votingRegistry.registerVoter(msg.sender);
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
        require(
            votingRegistry.isRegistered(msg.sender),
            "Voter not registered"
        );

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

        postManager.createPost(_contentUrl);
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
        require(
            votingRegistry.isRegistered(msg.sender),
            "Voter not registered"
        );
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

    function withdrawVote(uint256 _postId) external nonReentrant {
        // PostManager.Post storage post = postManager.posts[_postId];
        PostManager.Vote memory userVote = postManager.getVote(
            _postId,
            msg.sender
        );

        require(!userVote.withdrawn, "Vote already withdrawn");

        postManager.withdrawVote(_postId, msg.sender);

        divaToken.transfer(msg.sender, userVote.stakeAmount);
    }
}
