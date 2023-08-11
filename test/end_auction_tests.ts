import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { 
    deployAuctionContract, 
    day,
    toWei, 
    getRandomBetween, 
    waitSeconds, 
    submitBids, 
    startAuction,
    isSortedDescending
} from "./helpers";

/**
 * Tests the startAuction function of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("endAuction()", function () {

        describe("validation", function () {
            it("reverts if the auction has not started", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await expect ( tokenAuction.connect(user).endAuction(0) ).to.be.revertedWith("TokenAuction: auction not started");
            });

            it("reverts if the auction is in progress", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                
                // start an auction lasting 7 dayes and try to end it after 1 day
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                await waitSeconds(1 * day);

                await expect ( tokenAuction.connect(user).endAuction(0) ).to.be.revertedWith("TokenAuction: auction in progress");
            });
        })


        describe("bids filling process", function () {

            describe("all bids fully filled", function () {
                it("transfers the tokens to all bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction
                    await startAuction(tokenAuction, testToken, toWei(100), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 1.1, 0.9]
                    const amounts = [toWei(10), toWei(5), toWei(7)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    expect ( await testToken.balanceOf(user0.address) ).to.equal(amounts[0]);
                    expect ( await testToken.balanceOf(user1.address) ).to.equal(amounts[1]);
                    expect ( await testToken.balanceOf(user2.address) ).to.equal(amounts[2]);
                });

                it("takes all Ether from the bidder balances", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction
                    await startAuction(tokenAuction, testToken, toWei(100), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 1.1, 0.9]
                    const amounts = [toWei(10), toWei(5), toWei(7)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    expect ( await tokenAuction.getBidderBalance(user0.address) ).to.equal(toWei(0));
                    expect ( await tokenAuction.getBidderBalance(user1.address) ).to.equal(toWei(0));
                    expect ( await tokenAuction.getBidderBalance(user2.address) ).to.equal(toWei(0));
                });
            });

            describe("some bids unfilled", function () {
                it("transfers the tokens to the winning bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction and place some bids
                    await startAuction(tokenAuction, testToken, toWei(10), 7 * day);
                    const users = [user0, user1, user2]
                    const prices = [3, 1, 2]
                    const amounts = [toWei(7), toWei(2), toWei(3)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    // verify only user0 and user2 got their bids filled 
                    expect ( await testToken.balanceOf(user0.address) ).to.equal( amounts[0] );
                    expect ( await testToken.balanceOf(user2.address) ).to.equal( amounts[2] );
                    expect ( await testToken.balanceOf(user1.address) ).to.equal( toWei(0) );
                });

                it("leaves Ether in the balances of non winning bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction
                    await startAuction(tokenAuction, testToken, toWei(10), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [3, 1, 2]
                    const amounts = [toWei(7), toWei(2), toWei(3)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    // verify bidder balances
                    const user1EtherSent = amounts[1].mul(prices[1])

                    expect ( await tokenAuction.getBidderBalance(user0.address) ).to.equal(toWei(0));
                    expect ( await tokenAuction.getBidderBalance(user2.address) ).to.equal(toWei(0));
                    expect ( await tokenAuction.getBidderBalance(user1.address) ).to.equal(user1EtherSent);
                });
            });

            describe("partially filled bid", function () {
                it("transfers the tokens to the winning bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction for 10 tokens
                    await startAuction(tokenAuction, testToken, toWei(10), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 2, 3]
                    const amounts = [toWei(6), toWei(6), toWei(6)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction and verify token balances
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    expect ( await testToken.balanceOf(user0.address) ).to.equal( toWei(0) );
                    expect ( await testToken.balanceOf(user1.address) ).to.equal( toWei(4) );
                    expect ( await testToken.balanceOf(user2.address) ).to.equal( toWei(6) );
                });

                it("leaves Ether in the bidder balance for the unfilled part of the bid", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction
                    await startAuction(tokenAuction, testToken, toWei(10), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 2, 3];
                    const amounts = [toWei(6), toWei(6), toWei(6)]

                    await submitBids(tokenAuction, users, amounts, prices);

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction(0);

                    // verify bidder balances
                    const user0EtherSent = amounts[0].mul(prices[0]);
                    expect ( await tokenAuction.getBidderBalance(user0.address) ).to.equal(user0EtherSent);

                    const user1EtherSent = amounts[1].mul(prices[1]);
                    const user1FilledValue = toWei(4).mul(prices[1]) // user1 bid is filled with 4 out of 6 tokens
                   
                    expect ( await tokenAuction.getBidderBalance(user1.address) ).to.equal( user1EtherSent.sub(user1FilledValue) );
                    expect ( await tokenAuction.getBidderBalance(user2.address) ).to.equal(toWei(0));

                });
            });

            describe("multiple bids at the same price", function () {

                it("fills them in FIFO order", async function () {
                    const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction for 1000 tokens
                    await startAuction(tokenAuction, testToken, toWei(10), 7 * day);
    
                    const users = [user0, user1, user2]
                    const prices = [1.1, 1.1, 1.1]
                    const amounts = [toWei(6), toWei(10), toWei(3)]
                  
                    await submitBids(tokenAuction, users, amounts, prices)
    
                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user).endAuction(0);
    
                    const bids = await tokenAuction.getAllBids()
    
                    // the bids array gets filled from the last to the first element therefore
                    // the bids timestamps must be in reverse chronological order

                    const timestamps = bids.map( it => it.timestamp.toNumber() )
                    expect( isSortedDescending(timestamps) ).to.be.true
                });
            });

            it("emits the AuctionEnded event", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);

                // start auction and wait for it to end
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                await waitSeconds(7 * day);
                
                await expect( tokenAuction.endAuction(0) )
                    .to.emit(tokenAuction, 'AuctionEnded')
    
            });

        })

        describe("bids filling process, multiple txs", function () {

            it("process the winning bids in one chunk", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user ] = await ethers.getSigners();

                // start an auction for 1000 tokens
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

                // submit 10 bids for 10 tokens each
                const bidsCount = 10
                const users = Array.from({ length: bidsCount }, () => user);
                const prices = Array.from({ length: bidsCount }, () => getRandomBetween(0.001, 0.005));
                const amounts = Array.from({ length: bidsCount }, () => toWei(10));

                await submitBids(tokenAuction, users, amounts, prices)

                // wait the end of the auction
                await waitSeconds(7 * day);
                
                // process first 3 winning bids for a total of 30 tokens
                await tokenAuction.connect(user).endAuction(3);

                expect ( await testToken.balanceOf(user.address) ).to.equal( toWei(30) );
            });
          

            it("process the winning bids in multiple chunks", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user ] = await ethers.getSigners();

                // start an auction for 1000 tokens
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

                // submit 10 bids for 10 tokens each
                const bidsCount = 10
                const users = Array.from({ length: bidsCount }, () => user);
                const prices = Array.from({ length: bidsCount }, () => getRandomBetween(0.01, 0.1));
                const amounts = Array.from({ length: bidsCount }, () => toWei(10));

                await submitBids(tokenAuction, users, amounts, prices)

                // wait the end of the auction
                await waitSeconds(7 * day);
                
                // process first 8 winning bids in 3 transaction for a total of 80 tokens
                await tokenAuction.connect(user).endAuction(3);
                await tokenAuction.connect(user).endAuction(4);
                await tokenAuction.connect(user).endAuction(1);

                expect ( await testToken.balanceOf(user.address) ).to.equal( toWei(80) );
            });


            it("emits the AuctionEnded when all winning bids have been processed", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const [ _, user ] = await ethers.getSigners();

                // start an auction for 1000 tokens
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);

                // submit 9 bids for 10 tokens each
                const bidsCount = 9
                const users = Array.from({ length: bidsCount }, () => user);
                const prices = Array.from({ length: bidsCount }, () => getRandomBetween(0.01, 0.1));
                const amounts = Array.from({ length: bidsCount }, () => toWei(10));

                await submitBids(tokenAuction, users, amounts, prices)

                // wait the end of the auction
                await waitSeconds(7 * day);
                
                // process all 9 winning bids in 3 transactions
                await tokenAuction.connect(user).endAuction(4);
                await tokenAuction.connect(user).endAuction(4);

                // verify the las emits the AuctionEnded 
                await expect( tokenAuction.connect(user).endAuction(1) )
                    .to.emit(tokenAuction, 'AuctionEnded')
              
            });

        })
    })

});