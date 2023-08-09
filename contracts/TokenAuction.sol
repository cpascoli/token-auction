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

    address public owner;
    IERC20 public token;
    uint public amount;
    uint public auctionStart;
    uint public auctionEnd;

    Bid[] public bids;

    /**
     * @title Represents a bid by a user.
     * @dev includes the addess of the bidder,
     *      the timestamp of the block when the bid was submitted,
     *      an mount of tokens at the specified price.
     */
    struct Bid {
        address bidder;
        uint timestamp;
        uint amount;
        uint price;
        uint filled;
    }

    /// @notice Logged when the token auction is started
    event AuctionStarted(uint amount, uint duration);

    /// @notice Logged when a new bid for tokens is submitted
    event BidSubmitted(address indexed bidder, uint amount, uint price);

    /// @notice Logged when the auction is ended
    event AuctionEnded();

    /// @notice Logged when the auction has ended and tokens are transferred to a winning bidder
    event TokensTransferred(address indexed bidder, uint amount);

    /**
     *  @param _token the address of the ERC20 token being auctioned
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
     */
    function bid(uint _amount, uint _price) external notTheOwner auctionInProgress {

        bids.push(
            Bid({
                    bidder: msg.sender,
                    timestamp: block.timestamp,
                    amount: _amount,
                    price: _price,
                    filled: 0
                }
            )
        );

        // To preserve the bid array in ascending price order,
        // swap the new bid with the previous one until the new bid is in the correct position
        for(uint i = bids.length - 1; i > 0 && bids[i].price <= bids[i - 1].price; i--) {
            // Swap bids[i] and bids[i - 1]
            Bid memory temp = bids[i];
            bids[i] = bids[i - 1];
            bids[i - 1] = temp;
        }

        emit BidSubmitted(msg.sender, _amount, _price);
    }


    /**
     * @notice End the auction and transfer the token amount to the winning bidders.
     * @dev the array of bids is processed backwards until all bids are filled or all tokens are sent.
     */
    function endAuction() external auctionEnded {

        if (bids.length > 0) {
            for (uint i = bids.length - 1; i >= 0; i--) {
                // process i-th bid
                Bid storage abid = bids[i];
                uint amountFilled = abid.amount <= amount ? abid.amount : amount;
                abid.filled = amountFilled;
                amount -= amountFilled;

                token.transfer(abid.bidder, amountFilled);
                emit TokensTransferred(abid.bidder, amountFilled);

                // end processing bids when all tokens have been transferred
                // or all bids have been processed
                if (amount == 0 || i == 0) break;
            }
        }

        emit AuctionEnded();
    }


    /**
     *  @notice Return the array of bids
     *  @dev the returned array is sorted in ascending price order
     */
    function bidsCount() external view returns (uint) {
        return bids.length;
    }


    function getAllBids() external view returns (Bid[] memory) {
        return bids;
    }



    modifier onlyOwner() {
        require(msg.sender == owner, "TokenAuction: caller is not the owner");
        _;
    }

    modifier notTheOwner() {
        require(msg.sender != owner, "TokenAuction: caller is the owner");
        _;
    }

    modifier auctionNotStarted() {
        require(auctionStart == 0 && auctionEnd == 0, "TokenAuction: auction already started");
        _;
    }

    modifier auctionInProgress() {
        require(auctionStart > 0 && auctionEnd > 0, "TokenAuction: auction not started");
        require(block.timestamp < auctionEnd, "TokenAuction: auction ended");
        _;
    }

    modifier auctionEnded() {
        require(auctionStart > 0 && auctionEnd > 0, "TokenAuction: auction not started");
        require(block.timestamp >= auctionEnd, "TokenAuction: auction in progress");
        _;
    }


}