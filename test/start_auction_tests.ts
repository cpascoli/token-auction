import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployAuctionContract, startAuction, day, toWei, waitSeconds, getLastBlockTimestamp } from "./helpers";

/**
 * Tests the startAuction function of the TokenAuction contract.
 */
describe("TokenAuction", function () {

    describe("startAuction", function () {

        describe("validation", function () {

            it("reverts if caller is not the owner", async function () {
                const { tokenAuction, user } = await loadFixture(deployAuctionContract);

                await expect ( tokenAuction.connect(user).startAuction(0, 7 * day) ).to.be.revertedWith("TokenAuction: caller is not the owner");
            });

            it("reverts if the token amount is 0", async function () {
                const { tokenAuction } = await loadFixture(deployAuctionContract);

                await expect ( tokenAuction.startAuction(0, 7 * day) ).to.be.revertedWith("TokenAuction: invalid auction");
            });

            it("reverts if the auction duration is 0", async function () {
                const { tokenAuction } = await loadFixture(deployAuctionContract);

                await expect ( tokenAuction.startAuction(toWei(1000), 0) ).to.be.revertedWith("TokenAuction: invalid auction");
            });

            it("reverts if token transfer is not approved for the required amount of tokens", async function () {
                const { tokenAuction } = await loadFixture(deployAuctionContract);
                const amount = toWei(1000);
                const duration = 7 * day;

                await expect ( tokenAuction.startAuction(amount, duration) ).to.be.revertedWith("TokenAuction: insufficient allowance");
            });

            it("reverts if the auction is already startred", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const amount = toWei(1000);
                const duration = 7 * day;
                await startAuction(tokenAuction, testToken, amount, duration);

                await waitSeconds(1 * day);

                await expect ( tokenAuction.startAuction(amount, duration) ).to.be.revertedWith("TokenAuction: auction already started");
            });
        });


        describe("auction starting process", function () {

            it("sets the auction end time", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const amount = toWei(1000);
                const duration = 7 * day;
                await startAuction(tokenAuction, testToken, amount, duration);

                const auctionStartedTime = await getLastBlockTimestamp()
                const auctionEndTime = (await tokenAuction.auctionEnd()).toNumber()

                expect( auctionEndTime ).to.be.equal( auctionStartedTime + duration );
            });

            it("transfers the tokens to the contract", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const amount = toWei(1000);
                const duration = 7 * day;
                await startAuction(tokenAuction, testToken, amount, duration);

                expect( await testToken.balanceOf(tokenAuction.address) ).to.be.equal( amount );
            });

            it("emits the AuctionStarted event", async function () {
                const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
                const amount = toWei(1000);
                const duration = 7 * day;

                await testToken.approve(tokenAuction.address, amount);

                expect( await tokenAuction.startAuction(toWei(1000), duration) )
                    .to.emit(tokenAuction, 'AuctionStarted')
                    .withArgs(amount, duration);
            });
        });
    })

});