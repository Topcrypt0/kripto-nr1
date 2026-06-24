// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  KRIPTO NR.1 — rocket "crash" game on Base (commit-reveal)
 * @notice Two transactions, in two different blocks:
 *           1. launch()  — place the bet (block N). No result is computed yet,
 *              the outcome depends on a FUTURE block, so a wallet can't preview
 *              it and the tx looks like a plain transfer. Worst-case payout is
 *              reserved from the bankroll so a win is always payable.
 *           2. resolve() — from block N+2 onward, the result is derived from
 *              blockhash(N+1) and the player is paid instantly if they won.
 *
 *  Why this is safe:
 *   - The bet is irreversible before the result is known, so the classic
 *     "inspect the result, revert on a loss" attack is impossible — no
 *     tx.origin hack needed, so smart-contract wallets (Base Account) work.
 *   - Outcome uses a future blockhash the bettor can't predict at commit time.
 *
 *  NOTE: blockhash only covers the last 256 blocks (~8 min on Base). If you
 *  don't resolve in time, resolve() simply refunds your bet.
 *
 *  Randomness is still on-chain (not Chainlink VRF). For real-money scale,
 *  swap the blockhash source for VRF and get an audit.
 */
contract KriptoNr1 {
    address public owner;
    bool public paused;

    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant MAX_BET = 0.001 ether;
    uint256 public constant MAX_MULTIPLIER = 10;
    uint256 public constant BPS = 10_000;

    struct Game {
        uint128 bet;
        uint64 targetBlock;
        bool active;
    }

    /// @notice Pending (committed, not yet resolved) game per player.
    mapping(address => Game) public games;
    /// @notice Worst-case payout reserved for all active games (house can't touch it).
    uint256 public reserved;

    bool private _locked;

    event Committed(address indexed player, uint256 bet, uint256 targetBlock);
    event Resolved(
        address indexed player,
        uint256 bet,
        uint256 multiplier,
        uint256 payout,
        uint256 roll,
        bool refunded
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

    constructor() payable {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Step 1 — place a bet. The result is decided later by resolve().
     *         Send between MIN_BET and MAX_BET. No ETH comes back here, so the
     *         wallet preview shows only the outgoing bet.
     * @return targetBlock The block whose hash will decide the outcome.
     */
    function launch()
        external
        payable
        noReentrant
        returns (uint256 targetBlock)
    {
        require(!paused, "paused");
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "bet out of range");
        require(!games[msg.sender].active, "resolve previous launch first");

        uint256 res = msg.value * MAX_MULTIPLIER;
        // balance already includes this bet; it must cover every reserved payout.
        require(address(this).balance >= reserved + res, "bankroll too low for this bet");
        reserved += res;

        targetBlock = block.number + 1;
        games[msg.sender] = Game({
            bet: uint128(msg.value),
            targetBlock: uint64(targetBlock),
            active: true
        });

        emit Committed(msg.sender, msg.value, targetBlock);
    }

    /**
     * @notice Step 2 — reveal the outcome for `player` and pay any winnings.
     *         Callable by anyone (the result is fixed by the target block, not
     *         by the caller), so a keeper or the frontend can trigger it.
     * @return multiplier The outcome (0, 2, 3, 5 or 10).
     * @return payout     ETH paid to the player.
     */
    function resolve(address player)
        external
        noReentrant
        returns (uint256 multiplier, uint256 payout)
    {
        Game memory g = games[player];
        require(g.active, "no pending launch");
        require(block.number > g.targetBlock, "wait for the reveal block");

        reserved -= uint256(g.bet) * MAX_MULTIPLIER;
        delete games[player];

        bytes32 bh = blockhash(g.targetBlock);
        if (bh == 0) {
            // Missed the 256-block window — refund the bet, no win/loss.
            (bool r, ) = payable(player).call{value: g.bet}("");
            require(r, "refund failed");
            emit Resolved(player, g.bet, 0, 0, 0, true);
            return (0, 0);
        }

        uint256 roll = uint256(
            keccak256(abi.encodePacked(bh, player, g.bet))
        ) % BPS;
        multiplier = _multiplierForRoll(roll);
        payout = uint256(g.bet) * multiplier;

        emit Resolved(player, g.bet, multiplier, payout, roll, false);

        if (payout > 0) {
            (bool ok, ) = payable(player).call{value: payout}("");
            require(ok, "payout failed");
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

    // --- bankroll ---

    function fund() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    receive() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    function bankroll() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice House funds the owner may withdraw (excludes reserved payouts).
    function availableBankroll() external view returns (uint256) {
        return address(this).balance - reserved;
    }

    // --- owner controls ---

    function withdraw(uint256 amount) external onlyOwner noReentrant {
        require(amount <= address(this).balance - reserved, "exceeds available");
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
