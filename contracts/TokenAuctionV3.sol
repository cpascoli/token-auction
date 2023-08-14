// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 *  @title A Solidity contract that implements a simple auction system for ERC20 tokens.
 *  @author Carlo Pascoli
 *  @notice The contact can be interacted with using its external functions to:
 *       1. Start an auction (only available to the owner).
 *       2. Bid on the tokens (available only to now-owner users).
 *       3. Cancel a bid before the auction ends. (available only to now-owner users).
 *       4. End the auction. Bids are filled until there are no more tokens or no more bids.
 */
contract TokenAuctionV3 {

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

    /// The Ether balances for each bidder address
    mapping(address => uint) private balances;

    /// The array of the user bids. As new bids are added to it it's maintaied ordered in ascending bid price order.
    Bid[] public bids;

    /// A boolean indicating if all winning bids have been processed and the auction is ended.
    bool public bidsProcessingEnded;

    /// the index of the last bid filled during the auction ending processs. Initialised to the max uint value.
    uint public lastBidFilledIdx;

    /// Mapping between bidder accounts and the array of timestamps of cancelled bids
    mapping (address => uint[]) public cancelledBids;


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

    /// @notice Logged when the bidder Ehter balance for unfilled bids is withdrawn
    event EtherWithdrawn(address indexed bidder, uint amount);

    /// notice Logged when the ower transfers Ether out of the contract
    event EtherSent(address indexed recipient, uint amount);

    /// @notice Logged when an existing bid is cancelled
    event BidCancelled(address indexed bidder, uint timestamp, uint amount, uint price);


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
     *          Gas considerations:
     *          This approach guarantees constant computational complexity, O(1), when the new bids come at
     *          a price within the top k-th bids. On the other hand, for bids coming at randomly distributed
     *          prices the computational complexity deteriorate to O(n).
     */
    function bid(uint _amount, uint _price) external payable notTheOwner auctionInProgress {
        require(_amount > 0 && _price > 0, "TokenAuction: invalid bid");
        require(msg.value == _amount * _price / 1e18, "TokenAuction: invalid amount of Ether sent");

        // account for the Ether received
        balances[msg.sender] += msg.value;

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


    /**
     *  @notice Cancel a bid submitted by the caller at the timestamp provied.
     *  @param timestamp the time wehen the bid was placed.
     *  @dev scans the bid array for the first bid of the caller with the provided timestamp and adds it to the
     *       array of bids cancelled by the user.
     */
    function cancelBid(uint timestamp) external notTheOwner auctionInProgress {

        for(uint i = bids.length - 1; i >= 0; i--) {
            Bid memory temp = bids[i];
            if (temp.bidder == msg.sender && temp.timestamp == timestamp) {
                // add the timestamp of this bid to the array of cancelled bids
                cancelledBids[msg.sender].push(timestamp);

                emit BidCancelled(msg.sender, timestamp, temp.amount, temp.price);
                break;
            }
            if (i==0) break;
        }
    }


    /**
     * @notice End the auction by filling the winning bids and transfering the tokens to the winning bidders accounts.
     * @param batchSize the max number of the bids to be processed in the transaction.
     *      If a batchSize of 0 is passed than processes all winning bids.
     * @dev In order to fill the winning bids the array of all bids is simply scanned backwards, from the last item to the first,
     *      until all bids are filled or all auctioned tokens are sold.
     *      This is possible because the bids array has been kept sorted in ascending price order.
     *      As the winning bids are processed, the appropriate amount of tokens are sent to the winners' accounts.
     *      The AuctionEnded event is emitted when all wnning bids have been processed.
     *      In order to limit the gas spent with the transaction the user can pass a non zero 'batchSize' value.
     *      When winning bids are processed in multiple transactions (e.g. batchSize > 0) the contract variable 'lastBidFilledIdx'
     *      is used to keep track of the index of the last bid processed, with 0 meaning
     *      Gas considerations:
     *      when all winning bids are filled this function has linear complexity O(n) with the number of winning bids.
     *      To keep gas cost limited, and achieve constant complexity O(1), a 'batchSize' > 0 has to be provided.
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
        uint startIdx = lastBidFilledIdx == ~uint256(0) ? bidsCount - 1 : lastBidFilledIdx - 1;
        uint endIdx = (batchSize == 0) ? 0 : (startIdx > batchSize - 1) ? startIdx - (batchSize - 1) : 0;
        
        uint i;
        for (i = startIdx; i >= endIdx; i--) {
            
            Bid memory abid = bids[i];

            // skips cancelled bids
            bool bidIsCancelled = isBidCancelled(abid.bidder, abid.timestamp);
            if (!bidIsCancelled) {
                // fill the i-th bid
                uint amountFilled = abid.amount <= amount ? abid.amount : amount;
                amount -= amountFilled;

                // reduce the bidder balance by the value of the tokens bought at the bid price.
                balances[abid.bidder] -= amountFilled * abid.price / 1e18;

                // transfer the tokens
                bool transferred = token.transfer(abid.bidder, amountFilled);
                assert(transferred);
            }

            // end processing bids when all tokens are sold or all bids are processed
            if (amount == 0 || i == 0) {
                bidsProcessingEnded = true;
                break;
            }
        }

        // remember the index of the last bid processed
        lastBidFilledIdx = bidsProcessingEnded ? i : endIdx;

        if(bidsProcessingEnded) {
            emit AuctionEnded();
        }
    }


    /**
     * @notice Allow the sender to withdraw their funds that were not used to fill bids.
     *         Requires the auction to have ended and bids filled.
     */
    function withdraw() external auctionEnded {

         // 1. checks
        require(bidsProcessingEnded, "TokenAuction: winning bids not filled");
        uint balance = balances[msg.sender];
        require(balance > 0, "TokenAuction: no Ether to withdraw");

        // 2. effects
        balances[msg.sender] = 0;

        // 3. interactions
        payable(msg.sender).transfer(balance);

        emit EtherWithdrawn(msg.sender, balance);
    }


    /**
     * @notice Allow the owner to withdraw the Ether in the contract after the auciton ends and bids are filled.
     * @param _to the address where to send the Ether to.
     * @param _amount the amount of Ether to withdraw.
     */
    function sendEther(address _to, uint _amount) external onlyOwner auctionEnded {
        require(bidsProcessingEnded, "TokenAuction: winning bids not filled");
        require(_to != address(0), "TokenAuction: invalid recipient address");
        require(_amount > 0 && _amount <= address(this).balance, "TokenAuction: invalid amount");

        payable(_to).transfer(_amount);

        emit EtherSent(_to, _amount);
    }


    /// @notice returns the contract Ether balance
    function getBalance() external view returns (uint) {
        return address(this).balance;
    }

    
    /// @notice Get the Ether balance for a bidder.
    /// @param user the address of a user.
    /// @return returns the Ether balance for the user.
    function getBidderBalance(address user) external view returns (uint) {
        return balances[user];
    }


    /// @notice Returns the array of all bids sorted in ascending price order.
    function getAllBids() external view returns (Bid[] memory) {
        return bids;
    }


    /// @notice returns if a bid at the given timestamp was cancelled
    function isBidCancelled(address bidder, uint timestamp) internal view returns (bool) {
        uint[] memory timestamps = cancelledBids[bidder];
        uint count = timestamps.length;
        for (uint i = 0; i<count; i++) {
            if (timestamps[i] == timestamp) {
                return true;
            }
        }

        return false;
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