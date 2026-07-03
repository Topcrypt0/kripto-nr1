// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  KRIPTO NR.1 — rocket "crash" lottery on Base (commit-reveal, claim-on-win)
 * @notice One transaction to play, a second only if you win:
 *           1. launch()  — place the bet (block N). The outcome depends on a
 *              FUTURE block, so the wallet can't preview it and the tx looks
 *              like a plain transfer. Worst-case payout is reserved from the
 *              bankroll so a win is always payable.
 *           2. claim()   — from block N+2 onward, pays your winnings. You only
 *              ever send this when you WON. A loss needs no second transaction:
 *              the losing bet stays with the house, and your next launch()
 *              auto-clears the old game for free.
 *
 *         The frontend reads preview(you) (a free eth_call, no gas) to learn the
 *         result after the reveal block: it shows a Claim button on a win and
 *         nothing to sign on a loss.
 *
 *  FREE LAUNCHES (referral promo):
 *   - freeLaunch(inviter) plays a real FREE_BET (0.001 ETH) game at no cost to
 *     the player — a win pays real ETH (up to 0.01 ETH at X10), a loss costs
 *     the player nothing.
 *   - Every address gets ONE starter free launch. If it arrived via an invite
 *     link, the inviter earns +1 free-launch credit (capped at INVITE_CAP
 *     unique invitees).
 *   - Free launches are funded from a separate promoPool the owner tops up
 *     with fundPromo(). When the pool can't cover a worst-case X10 win, free
 *     launches pause automatically. The main bankroll is never at risk from
 *     the promo: total promo losses are hard-capped by what the owner put in.
 *     (Free launches cost only gas to a player, so they ARE farmable with
 *      throwaway wallets — size the promo pool as your marketing budget.)
 *
 *  Why this is safe:
 *   - The bet is irreversible before the result is known, so the classic
 *     "inspect the result, revert on a loss" attack is impossible — no
 *     tx.origin hack needed, so smart-contract wallets (Base Account) work.
 *   - Outcome uses a future blockhash the bettor can't predict at commit time.
 *   - A loser gains nothing by NOT claiming — the bet is already the house's.
 *     Claiming a win after the 256-block (~8 min) window forfeits it, so
 *     stalling can never turn a loss into a refund (a guaranteed-profit exploit
 *     that a naive "refund on expiry" design would allow).
 *
 *  Randomness is still on-chain (not Chainlink VRF): the Base sequencer is
 *  trusted not to censor/reorder to influence blockhash. For real-money scale,
 *  swap the blockhash source for VRF and get an audit.
 */
contract KriptoNr1 {
    address public owner;
    bool public paused;

    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant MAX_BET = 0.001 ether;
    uint256 public constant FREE_BET = 0.001 ether;
    uint256 public constant MAX_MULTIPLIER = 10;
    uint256 public constant INVITE_CAP = 10;
    uint256 public constant BPS = 10_000;

    struct Game {
        uint128 bet;
        uint64 targetBlock;
        bool active;
        bool free; // promo game: stake is virtual, reserve comes from promoPool
    }

    /// @notice Pending (committed, not yet settled) game per player.
    mapping(address => Game) public games;
    /// @notice Worst-case payout reserved for all active games (house can't touch it).
    uint256 public reserved;

    /// @notice Marketing budget for free launches; only owner deposits shrink
    ///         it permanently (payouts), the rest cycles back after each game.
    uint256 public promoPool;
    /// @notice Starter free launch used (one per address, ever).
    mapping(address => bool) public freeUsed;
    /// @notice Free launches earned by inviting (spend via freeLaunch()).
    mapping(address => uint256) public freeCredits;
    /// @notice Unique invitees credited to this inviter (capped at INVITE_CAP).
    mapping(address => uint256) public inviteCount;

    bool private _locked;

    event Played(address indexed player, uint256 bet, uint256 targetBlock);
    event FreePlayed(
        address indexed player,
        address indexed inviter,
        uint256 bet,
        uint256 targetBlock
    );
    event InviteReward(address indexed inviter, address indexed invitee);
    event Settled(
        address indexed player,
        uint256 bet,
        uint256 multiplier,
        uint256 payout,
        uint256 roll
    );
    event Expired(address indexed player, uint256 bet);
    event BankrollFunded(address indexed from, uint256 amount);
    event PromoFunded(address indexed from, uint256 amount);
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

    /**
     * @param _owner The house account (withdraw / pause / transfer rights).
     *        Passed explicitly so the contract can be deployed through a CREATE2
     *        factory without the factory becoming the owner. Zero falls back to
     *        the deployer for a plain `new KriptoNr1()` deployment.
     */
    constructor(address _owner) payable {
        owner = _owner == address(0) ? msg.sender : _owner;
        emit OwnershipTransferred(address(0), owner);
    }

    /**
     * @notice Step 1 — place a bet. The result is decided later by claim().
     *         Send between MIN_BET and MAX_BET. No ETH comes back here, so the
     *         wallet preview shows only the outgoing bet.
     *
     *         If you still have a matured previous game, it is settled here for
     *         free — a forgotten win is paid out, a loss is simply cleared — so
     *         a losing player never has to send a settle transaction.
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

        _autoSettlePrevious(msg.sender);

        uint256 res = msg.value * MAX_MULTIPLIER;
        // balance already includes this bet; it must cover every reserved
        // payout AND the untouched promo budget.
        require(
            address(this).balance >= reserved + promoPool + res,
            "bankroll too low for this bet"
        );
        reserved += res;

        targetBlock = block.number + 1;
        games[msg.sender] = Game({
            bet: uint128(msg.value),
            targetBlock: uint64(targetBlock),
            active: true,
            free: false
        });

        emit Played(msg.sender, msg.value, targetBlock);
    }

    /**
     * @notice A FREE launch — same game, same odds, real payout, zero stake.
     *         Uses your one starter free launch (crediting `inviter` if you
     *         came via an invite link) or one earned invite credit. Funded by
     *         the promo pool; reverts when the pool can't cover an X10 win.
     * @param  inviter Who invited you (zero address if nobody).
     * @return targetBlock The block whose hash will decide the outcome.
     */
    function freeLaunch(address inviter)
        external
        noReentrant
        returns (uint256 targetBlock)
    {
        require(!paused, "paused");

        _autoSettlePrevious(msg.sender);

        if (!freeUsed[msg.sender]) {
            freeUsed[msg.sender] = true;
            if (
                inviter != address(0) &&
                inviter != msg.sender &&
                inviteCount[inviter] < INVITE_CAP
            ) {
                inviteCount[inviter] += 1;
                freeCredits[inviter] += 1;
                emit InviteReward(inviter, msg.sender);
            }
        } else {
            require(freeCredits[msg.sender] > 0, "no free launch available");
            freeCredits[msg.sender] -= 1;
        }

        uint256 res = FREE_BET * MAX_MULTIPLIER;
        require(promoPool >= res, "promo pool empty");
        promoPool -= res;
        reserved += res;

        targetBlock = block.number + 1;
        games[msg.sender] = Game({
            bet: uint128(FREE_BET),
            targetBlock: uint64(targetBlock),
            active: true,
            free: true
        });

        emit FreePlayed(msg.sender, inviter, FREE_BET, targetBlock);
    }

    /// @notice Free launches `player` can start right now (starter + credits).
    ///         The frontend should also check promoPool >= FREE_BET*10.
    function freeLaunches(address player) external view returns (uint256) {
        return (freeUsed[player] ? 0 : 1) + freeCredits[player];
    }

    /**
     * @notice Step 2 — claim your winnings. Only worth sending after a win
     *         (preview() tells the frontend). On a loss it just clears the game.
     */
    function claim()
        external
        noReentrant
        returns (uint256 multiplier, uint256 payout)
    {
        return _settle(msg.sender);
    }

    /**
     * @notice Permissionless settle for any player — lets a keeper/owner clear
     *         abandoned games and free their reserved bankroll. The outcome is
     *         fixed by the target block, not by the caller, so this is safe.
     */
    function settle(address player)
        external
        noReentrant
        returns (uint256 multiplier, uint256 payout)
    {
        return _settle(player);
    }

    function _autoSettlePrevious(address player) internal {
        Game memory prev = games[player];
        if (prev.active) {
            require(block.number > prev.targetBlock, "previous game not ready");
            _settle(player);
        }
    }

    function _settle(address player)
        internal
        returns (uint256 multiplier, uint256 payout)
    {
        Game memory g = games[player];
        require(g.active, "no pending game");
        require(block.number > g.targetBlock, "wait for the reveal block");

        uint256 res = uint256(g.bet) * MAX_MULTIPLIER;
        reserved -= res;
        delete games[player];

        bytes32 bh = blockhash(g.targetBlock);
        if (bh == 0) {
            // Missed the 256-block window. The outcome can no longer be
            // verified, so the bet is forfeited to the bankroll (a free game's
            // reserve simply returns to the promo pool). Refunding a paid bet
            // instead would let a loser stall past the window for his stake
            // back — a guaranteed-profit exploit.
            if (g.free) promoPool += res;
            emit Expired(player, g.bet);
            return (0, 0);
        }

        uint256 roll = uint256(
            keccak256(abi.encodePacked(bh, player, g.bet))
        ) % BPS;
        multiplier = _multiplierForRoll(roll);
        payout = uint256(g.bet) * multiplier;

        // A free game's unspent reserve cycles back into the promo pool; only
        // the actual payout leaves it. A paid game's reserve just unlocks.
        if (g.free) promoPool += res - payout;

        emit Settled(player, g.bet, multiplier, payout, roll);

        if (payout > 0) {
            (bool ok, ) = payable(player).call{value: payout}("");
            require(ok, "payout failed");
        }
    }

    /**
     * @notice Read-only outcome for a pending game, for the frontend to decide
     *         whether to show a Claim button. No gas (call it via eth_call).
     * @return ready      True once the reveal block exists (or the game expired).
     * @return multiplier 0 (loss/expired), 2, 3, 5 or 10.
     * @return payout     ETH the player would receive by calling claim().
     */
    function preview(address player)
        external
        view
        returns (bool ready, uint256 multiplier, uint256 payout)
    {
        Game memory g = games[player];
        if (!g.active || block.number <= g.targetBlock) return (false, 0, 0);
        bytes32 bh = blockhash(g.targetBlock);
        if (bh == 0) return (true, 0, 0); // expired — settles as a loss
        uint256 roll = uint256(
            keccak256(abi.encodePacked(bh, player, g.bet))
        ) % BPS;
        multiplier = _multiplierForRoll(roll);
        payout = uint256(g.bet) * multiplier;
        ready = true;
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

    // --- bankroll & promo pool ---

    function fund() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    /// @notice Top up the free-launch budget. This is the ONLY way promo funds
    ///         appear; free launches stop when it runs low, so the total the
    ///         promo can ever lose is exactly what you deposit here.
    function fundPromo() external payable {
        promoPool += msg.value;
        emit PromoFunded(msg.sender, msg.value);
    }

    receive() external payable {
        emit BankrollFunded(msg.sender, msg.value);
    }

    function bankroll() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice House funds the owner may withdraw (excludes reserved payouts
    ///         and the promo budget).
    function availableBankroll() public view returns (uint256) {
        return address(this).balance - reserved - promoPool;
    }

    // --- owner controls ---

    function withdraw(uint256 amount) external onlyOwner noReentrant {
        require(amount <= availableBankroll(), "exceeds available");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdraw(owner, amount);
    }

    /// @notice Cancel (part of) the promo budget and move it back to the
    ///         withdrawable bankroll. Doesn't touch reserves of games already
    ///         in flight.
    function defundPromo(uint256 amount) external onlyOwner {
        require(amount <= promoPool, "exceeds promo pool");
        promoPool -= amount;
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
