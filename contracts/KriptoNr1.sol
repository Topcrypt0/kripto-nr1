// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  KRIPTO NR.1 — rocket "crash" style game on Base
 * @author Open-source demo
 * @notice A player sends ETH ("launches the rocket"). The contract rolls an
 *         outcome and instantly pays a multiplier of the bet:
 *           0x (rocket failed), 2x, 3x, 5x or 10x.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  SECURITY NOTICE — READ BEFORE GOING TO MAINNET                          │
 * │                                                                         │
 * │  Randomness here is derived from on-chain values (blockhash, prevrandao,│
 * │  timestamp). This is good enough for a TESTNET demo, but it is NOT      │
 * │  secure for real money: a block proposer can influence prevrandao.      │
 * │  The `tx.origin == msg.sender` check blocks the classic "simulate the   │
 * │  result in a wrapper contract and revert on a loss" attack, but it does │
 * │  not remove proposer influence.                                         │
 * │                                                                         │
 * │  For a real-money mainnet deployment you MUST replace `_random()` with  │
 * │  Chainlink VRF (request/fulfill, 2-step) and get the contract audited.  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
contract KriptoNr1 {
    // --- configuration ---
    address public owner;
    bool public paused;

    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant MAX_BET = 0.001 ether;
    uint256 public constant MAX_MULTIPLIER = 10;
    uint256 public constant BPS = 10_000;

    // --- internal state ---
    bool private _locked;
    uint256 private _nonce;

    // --- events ---
    event Launch(
        address indexed player,
        uint256 bet,
        uint256 multiplier,
        uint256 payout,
        uint256 roll
    );
    event BankrollFunded(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    event PausedSet(bool paused);
    event OwnershipTransferred(address indexed from, address indexed to);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier noReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    /// @dev Send ETH on deploy to seed the bankroll.
    constructor() payable {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Launch the rocket. Send between MIN_BET and MAX_BET.
     * @return multiplier The outcome multiplier (0, 2, 3, 5 or 10).
     * @return payout     The amount paid back to the player (bet * multiplier).
     */
    function launch()
        external
        payable
        noReentrant
        returns (uint256 multiplier, uint256 payout)
    {
        require(!paused, "paused");
        // Block contract callers => prevents atomic "inspect result then revert on loss".
        require(tx.origin == msg.sender, "no contracts");
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "bet out of range");

        // Solvency: the bankroll (which already includes this bet) must be able
        // to cover the largest possible payout for this bet.
        require(
            address(this).balance >= msg.value * MAX_MULTIPLIER,
            "bankroll too low for this bet"
        );

        uint256 roll = _random() % BPS; // 0..9999
        multiplier = _multiplierForRoll(roll);
        payout = msg.value * multiplier;

        emit Launch(msg.sender, msg.value, multiplier, payout, roll);

        if (payout > 0) {
            (bool ok, ) = payable(msg.sender).call{value: payout}("");
            require(ok, "payout transfer failed");
        }
    }

    /**
     * @dev Outcome table (house edge ≈ 2%, EV ≈ 0.98):
     *      roll <  6500 -> 0x   (65.0% lose)
     *      roll <  8700 -> 2x   (22.0%)
     *      roll <  9500 -> 3x   ( 8.0%)
     *      roll <  9900 -> 5x   ( 4.0%)
     *      else         -> 10x  ( 1.0%)
     */
    function _multiplierForRoll(uint256 roll) internal pure returns (uint256) {
        if (roll < 6500) return 0;
        if (roll < 8700) return 2;
        if (roll < 9500) return 3;
        if (roll < 9900) return 5;
        return 10;
    }

    /// @dev TESTNET-grade randomness. Replace with Chainlink VRF for mainnet.
    function _random() internal returns (uint256) {
        unchecked {
            _nonce++;
        }
        return uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    _nonce
                )
            )
        );
    }

    // --- bankroll management ---

    /// @notice Add ETH to the bankroll (anyone can fund).
    function fund() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    receive() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    function bankroll() external view returns (uint256) {
        return address(this).balance;
    }

    // --- owner controls ---

    function withdraw(uint256 amount) external onlyOwner noReentrant {
        require(amount <= address(this).balance, "amount exceeds balance");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdraw(owner, amount);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
