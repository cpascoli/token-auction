import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { 
    deployAuctionContract, 
    day,
    toWei, 
    toUnits, 
    waitSeconds, 
    submitBids, 
    startAuction,
    isSortedDescending
} from "./helpers";

/**
 * Tests the startAuction function of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("endAuction", function () {

        describe("validation", function () {
            it("reverts if the auction has not started", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                await expect ( tokenAuction.connect(user).endAuction() ).to.be.revertedWith("TokenAuction: auction not started");
            });

            it("reverts if the auction is in progress", async function () {
                const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                
                // start an auction lasting 7 dayes and try to end it after 1 day
                await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                await waitSeconds(1 * day);

                await expect ( tokenAuction.connect(user).endAuction() ).to.be.revertedWith("TokenAuction: auction in progress");
            });
        })


        describe("bids filling process", function () {

            describe("all bids fully filled", function () {

                it("sets the filled amount", async function () {
                    const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                    
                    // start an auction for 1000 tokens
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
    
                    const users = [user, user, user]
                    const prices = [1, 1.1, 1.2]
                    const amounts = [toWei(100), toWei(600), toWei(300)]
                  
                    await submitBids(tokenAuction, users, amounts, prices)
    
                    await waitSeconds(7 * day);
    
                    // end auction
                    await tokenAuction.connect(user).endAuction();
    
                    const bids = await tokenAuction.getAllBids()
    
                    expect ( bids[0].amount ).to.equal( bids[0].filled );
                    expect ( bids[1].amount ).to.equal( bids[1].filled );
                    expect ( bids[2].amount ).to.equal( bids[2].filled );
    
                    expect ( bids[0].filled ).to.equal( toWei(100) );
                    expect ( bids[1].filled ).to.equal( toWei(600) );
                    expect ( bids[2].filled ).to.equal( toWei(300) );
                });

                it("transfer the tokens to all bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction and pakce some bids
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 1.1, 0.9]
                    const amounts = [toWei(100), toWei(50), toWei(70)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction();

                    expect ( await testToken.balanceOf(user0.address) ).to.equal( amounts[0] );
                    expect ( await testToken.balanceOf(user1.address) ).to.equal( amounts[1]);
                    expect ( await testToken.balanceOf(user2.address) ).to.equal( amounts[2]);
                });
            });

            describe("some bids unfilled", function () {

                it("sets the filled amount", async function () {
                    const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                    
                    // start an auction for 1000 tokens
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
    
                    const users = [user, user, user]
                    const prices = [1.2, 1.0, 1.1]
                    const amounts = [toWei(700), toWei(200), toWei(300)]
                  
                    await submitBids(tokenAuction, users, amounts, prices)
    
                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user).endAuction();
    
                    const bids = await tokenAuction.getAllBids()

                    expect ( bids[0].filled ).to.equal( toWei(0) ); // unfilled bid
                    expect ( bids[1].filled ).to.equal( toWei(300) );
                    expect ( bids[2].filled ).to.equal( toWei(700) );
                });

                it("transfer the tokens to the winning bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction and place some bids
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                    const users = [user0, user1, user2]
                    const prices = [1.2, 1.0, 1.1]
                    const amounts = [toWei(700), toWei(200), toWei(300)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction();

                    // verify only user0 and user2 got their bids filled 
                    expect ( await testToken.balanceOf(user0.address) ).to.equal( amounts[0] );
                    expect ( await testToken.balanceOf(user2.address) ).to.equal( amounts[2]);
                    expect ( await testToken.balanceOf(user1.address) ).to.equal( toWei(0) );
                });
            });

            describe("partially filled bid", function () {

                it("sets the filled amount", async function () {
                    const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                    
                    // start an auction for 1000 tokens
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
    
                    const users = [user, user, user]
                    const prices = [1, 1.1, 1.2]
                    const amounts = [toWei(100), toWei(1000), toWei(600)]
                  
                    await submitBids(tokenAuction, users, amounts, prices)
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user).endAuction();
    
                    const bids = await tokenAuction.getAllBids()
    
                    expect ( bids[0].amount ).to.equal( toWei(100) );
                    expect ( bids[1].amount ).to.equal( toWei(1000) );
                    expect ( bids[2].amount ).to.equal( toWei(600) );
    
                    expect ( bids[0].filled ).to.equal( toWei(0) );
                    expect ( bids[1].filled ).to.equal( toWei(400) );
                    expect ( bids[2].filled ).to.equal( toWei(600) );
                });

                it("transfer the tokens to the winning bidders", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction and pakce some bids
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 1.1, 1.2]
                    const amounts = [toWei(100), toWei(1000), toWei(600)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction and verify token balances
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction();

                    expect ( await testToken.balanceOf(user0.address) ).to.equal( toWei(0) );
                    expect ( await testToken.balanceOf(user1.address) ).to.equal( toWei(400) );
                    expect ( await testToken.balanceOf(user2.address) ).to.equal( toWei(600) );
                });

                it("the partially filled bid has lower price than the fully filled bids", async function () {
                    const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction and pakce some bids
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
                    const users = [user0, user1, user2];
                    const prices = [1, 1.2, 1.1]
                    const amounts = [toWei(100), toWei(400), toWei(700)]

                    await submitBids(tokenAuction, users, amounts, prices)

                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user0).endAuction();

                    const bids = await tokenAuction.getAllBids()

                    const fullyFilledBidPrices = bids.filter( it => toUnits(it.filled) > 0 && toUnits(it.filled) === toUnits(it.amount) ).map( it => toUnits(it.price))
                    const partiallyFilledBidPrices = bids.filter( it => toUnits(it.filled) > 0 && toUnits(it.filled) < toUnits(it.amount) ).map( it => toUnits(it.price))
                    
                    // there can only be 1 partially filled bid
                    expect( partiallyFilledBidPrices.length ).to.equal(1);

                    const pricePartiallyFilled = partiallyFilledBidPrices[0]
                    const minPriceFilled = Math.min(...fullyFilledBidPrices);

                    expect(pricePartiallyFilled).to.be.lessThanOrEqual(minPriceFilled)
                });
            });

            describe("multiple bids at the same price", function () {

                it("fills them in FIFO order", async function () {
                    const { tokenAuction, testToken, user } = await loadFixture(deployAuctionContract);
                    const [ _, user0, user1, user2 ] = await ethers.getSigners();

                    // start an auction for 1000 tokens
                    await startAuction(tokenAuction, testToken, toWei(1000), 7 * day);
    
                    const users = [user0, user1, user2]
                    const prices = [1.1, 1.1, 1.1]
                    const amounts = [toWei(600), toWei(1000), toWei(300)]
                  
                    await submitBids(tokenAuction, users, amounts, prices)
    
                    // end auction
                    await waitSeconds(7 * day);
                    await tokenAuction.connect(user).endAuction();
    
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
                
                expect( await tokenAuction.endAuction() )
                    .to.emit(tokenAuction, 'AuctionEnded')
    
            });


        })
    })

});