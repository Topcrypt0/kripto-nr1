// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  KRIPTO NR.1 — rocket "crash" style game on Base
 * @notice Two-step play so wallets can't preview the outcome:
 *           1. launch() — take the bet, roll the result, CREDIT any winnings
 *              to the player's claimable balance. No ETH is sent back, so a
 *              wallet's transaction preview shows only the outgoing bet — a
 *              plain, safe-looking transfer with no "you will receive +X".
 *           2. claim() — the player withdraws their accumulated winnings in a
 *              separate transaction.
 *
 *  Because the roll uses the *inclusion* block's data, a wallet simulation
 *  (run against a different block) cannot reliably predict the outcome.
 *
 *  SECURITY NOTICE — READ BEFORE GOING TO MAINNET
 *  Randomness is on-chain (blockhash, prevrandao, timestamp): fine for a demo,
 *  not VRF-grade. `tx.origin == msg.sender` blocks the atomic "inspect then
 *  revert on loss" attack. For real-money scale, replace `_random()` with
 *  Chainlink VRF and get the contract audited.
 */
contract KriptoNr1 {
    // --- configuration ---
    address public owner;
    bool public paused;

    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant MAX_BET = 0.001 ether;
    uint256 public constant MAX_MULTIPLIER = 10;
    uint256 public constant BPS = 10_000;

    // --- state ---
    bool private _locked;
    uint256 private _nonce;

    /// @notice Unclaimed winnings per player.
    mapping(address => uint256) public winnings;
    /// @notice Sum of all unclaimed winnings (a liability the house can't withdraw).
    uint256 public totalOwed;

    // --- events ---
    event Launch(
        address indexed player,
        uint256 bet,
        uint256 multiplier,
        uint256 payout,
        uint256 roll
    );
    event Claim(address indexed player, uint256 amount);
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
     * @notice Launch the rocket. Send between MIN_BET and MAX_BET. Any winnings
     *         are credited to your claimable balance (see claim()), not sent now.
     * @return multiplier The outcome multiplier (0, 2, 3, 5 or 10).
     * @return payout     The amount credited to the player (bet * multiplier).
     */
    function launch()
        external
        payable
        noReentrant
        returns (uint256 multiplier, uint256 payout)
    {
        require(!paused, "paused");
        require(tx.origin == msg.sender, "no contracts");
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "bet out of range");

        uint256 roll = _random() % BPS; // 0..9999
        multiplier = _multiplierForRoll(roll);
        payout = msg.value * multiplier;

        if (payout > 0) {
            // Solvency: balance (already includes this bet) must cover every
            // owed payout, including this new one.
            require(
                address(this).balance >= totalOwed + payout,
                "bankroll too low for this bet"
            );
            winnings[msg.sender] += payout;
            totalOwed += payout;
        }

        emit Launch(msg.sender, msg.value, multiplier, payout, roll);
    }

    /// @notice Withdraw your accumulated winnings.
    function claim() external noReentrant returns (uint256 amount) {
        amount = winnings[msg.sender];
        require(amount > 0, "nothing to claim");
        winnings[msg.sender] = 0;
        totalOwed -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "claim transfer failed");
        emit Claim(msg.sender, amount);
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

    // --- bankroll ---

    /// @notice Add ETH to the bankroll (anyone can fund).
    function fund() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    receive() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    /// @notice Total ETH held by the contract.
    function bankroll() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice House funds the owner may withdraw (excludes players' winnings).
    function availableBankroll() external view returns (uint256) {
        return address(this).balance - totalOwed;
    }

    // --- owner controls ---

    function withdraw(uint256 amount) external onlyOwner noReentrant {
        // Never touch ETH that is owed to players as winnings.
        require(amount <= address(this).balance - totalOwed, "exceeds house funds");
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
