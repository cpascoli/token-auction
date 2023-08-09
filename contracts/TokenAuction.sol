// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/**
 *  @title A Solidity contract that implements a simple auction system for ERC20 tokens
 *  @author Carlo Pascoli
 *  @notice The contact can be interacted with using its external functions to:
 *       1. Start an auction (only available to the owner).
 *       2. Bid on the tokens (available only to now-owner users).
 *       3. End the auction. The bids are filled until there are no more tokens or no more bids.
 */

contract TokenAuction {

    /// The address owning the contract.
    address public owner;

    /// The token being auctioned
    IERC20 public token;

    /// The amount of tokens being auctioned.
    uint public amount;

    /// The time when the auction starts.
    uint public auctionStart;

    /// The time when the auction ends.
    uint public auctionEnd;

    /// The array of the user bids. As new bids are added to it it's maintaied ordered in ascending bid price order.
    Bid[] public bids;

    /// A boolean indicating if all winning bids have been processed and the auction is ended.
    bool public bidsProcessingEnded;


    /**
     * @title Represents a bid by a user.
     * @dev includes the addess of the bidder,
     *      the timestamp of the block when the bid was received,
     *      an mount of tokens at the specified price.
     */
    struct Bid {
        address bidder;
        uint timestamp;
        uint amount;
        uint price;
    }

    /// @notice Logged when the token auction is started
    event AuctionStarted(uint amount, uint duration);

    /// @notice Logged when a new bid for tokens is submitted
    event BidSubmitted(address indexed bidder, uint amount, uint price);

    /// @notice Logged when the auction is ended
    event AuctionEnded();


    /**
     *  @param _token the address of the ERC20 token being auctioned.
     *  @dev the deployer is the owner of the contract.
     */
    constructor(address _token) {
        owner = msg.sender;
        token = IERC20(_token);
    }


    /**
     *  @notice Starts an auction for the desired amount of tokens and auction duration.
     *  @param _amount the amount of ERC20 tokens being auctioned.
     *  @param _duration the duration of the auction is seconds.
     *  @dev Transfers the amount of ERC20 tokens being auctined to this contact.
     *       Only callable by the owner. It requires that an auction is not started.
    */
    function startAuction(uint _amount, uint _duration) external auctionNotStarted onlyOwner {
        require(_amount > 0 && _duration > 0, "TokenAuction: invalid auction");
        require(token.allowance(msg.sender, address(this)) >= _amount, "TokenAuction: insufficient allowance");

        amount = _amount;
        auctionStart = block.timestamp;
        auctionEnd = block.timestamp + _duration;

        bool transferred = token.transferFrom(msg.sender, address(this), _amount);
        assert(transferred);

        emit AuctionStarted(_amount, _duration);
    }


    /**
     *  @notice Submit a new bid for a given amount of tokens and a given price.
     *  @param _amount the amount of ERC20 tokens in the bid
     *  @param _price the price of the bid
     *  @dev the new Bid is appended to a dynamic array of bids which is kept sorted in ascending price order.
     */
    function bid(uint _amount, uint _price) external notTheOwner auctionInProgress {

        // append the new bid to the bid array
        bids.push(
            Bid({
                    bidder: msg.sender,
                    timestamp: block.timestamp,
                    amount: _amount,
                    price: _price
                }
            )
        );

        // To keep the bid array in ascending price order,
        // we swap the new bid with the previous ones until the new bid is in the correct position
        for(uint i = bids.length - 1; i > 0 && bids[i].price <= bids[i - 1].price; i--) {
            Bid memory temp = bids[i];
            bids[i] = bids[i - 1];
            bids[i - 1] = temp;
        }

        emit BidSubmitted(msg.sender, _amount, _price);
    }

    uint private lastBidFilledIdx;

    /**
     * @notice End the auction and transfer the token amount to the winning bidders.
     * @param batchSize the max number of the bids to filled in one transaction. If 0 is passed than all winning bids are processed.
     * @dev the array of bids, which is already sorted in ascending price orderis processed backwards,
     *      from the last item to the first, until all bids are filled or all tokens are sold out.
     *      As the winning bids are processed the appropriate amount of tokens are sent to the winners.
     *      The AuctionEnded event is emitted when all wnning bids have been processed.
     */
    function endAuction(uint batchSize) external auctionEnded {

        uint bidsCount = bids.length;
 
        // return if have no bids or all tokens have been distribured
        if (bidsProcessingEnded || bidsCount == 0 || amount == 0) {
            emit AuctionEnded();
            return;
        }

        // determine the start and end indexes of the bids to process,
        // if batchSize is 0 than process all bids otherwise process at most batchSize bids
        uint startIdx = lastBidFilledIdx == 0 ? bidsCount - 1 : lastBidFilledIdx - 1;
        uint endIdx = (batchSize == 0) ? 0 : (startIdx > batchSize) ? startIdx - batchSize + 1: 0;

        uint i;
        for (i = startIdx; i >= endIdx; i--) {

            // fill the i-th bid
            Bid memory abid = bids[i];
            uint amountFilled = abid.amount <= amount ? abid.amount : amount;
            amount -= amountFilled;

            // transfer the tokens
            bool transferred = token.transfer(abid.bidder, amountFilled);
            assert(transferred);

            // end processing bids when all tokens have been transferred
            // or all bids have been processed
            if (amount == 0 || i == 0) {
                bidsProcessingEnded = true;
                break;
            }
        }

        // remember the index of the last bid processed
        lastBidFilledIdx = i;

        if(bidsProcessingEnded) {
            emit AuctionEnded();
        }
    }


    /// @notice Returns the array of all bids sorted in ascending price order.
    function getAllBids() external view returns (Bid[] memory) {
        return bids;
    }

    /// @notice Requires that the function is called by the contract owner.
    modifier onlyOwner() {
        require(msg.sender == owner, "TokenAuction: caller is not the owner");
        _;
    }

    /// @notice Requires that the function is called by accounts other than the owner.
    modifier notTheOwner() {
        require(msg.sender != owner, "TokenAuction: caller is the owner");
        _;
    }

    /// @notice Requires that the auction is not started.
    modifier auctionNotStarted() {
        require(auctionStart == 0 && auctionEnd == 0, "TokenAuction: auction already started");
        _;
    }

    /// @notice Requires that the auction is in progress (e.g started but not ended yet)
    modifier auctionInProgress() {
        require(auctionStart > 0 && auctionEnd > 0, "TokenAuction: auction not started");
        require(block.timestamp < auctionEnd, "TokenAuction: auction ended");
        _;
    }

    /// @notice Requires that the auction is in progress (e.g started but not ended yet)
    modifier auctionEnded() {
        require(auctionStart > 0 && auctionEnd > 0, "TokenAuction: auction not started");
        require(block.timestamp >= auctionEnd, "TokenAuction: auction in progress");
        _;
    }

}