import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployAuctionContract, day, toWei, waitSeconds, getLastBlockTimestamp } from "./helpers";


describe("TokenAuction", function () {

    describe("startAuction", function () {

        it("reverts if caller is not the owner", async function () {
			const { tokenAuction, user } = await loadFixture(deployAuctionContract);

            await expect ( tokenAuction.connect(user).startAuction(0, 7 * day) ).to.be.revertedWith("TokenAuction: caller is not the owner");
		});

		it("reverts if amount is 0", async function () {
			const { tokenAuction } = await loadFixture(deployAuctionContract);

            await expect ( tokenAuction.startAuction(0, 7 * day) ).to.be.revertedWith("TokenAuction: invalid auction");
		});

		it("reverts if duration is 0", async function () {
			const { tokenAuction } = await loadFixture(deployAuctionContract);

            await expect ( tokenAuction.startAuction(toWei(1000), 0) ).to.be.revertedWith("TokenAuction: invalid auction");
		});

        it("reverts if token transfer is not approved", async function () {
			const { tokenAuction } = await loadFixture(deployAuctionContract);
            const amount = toWei(1000);
            const duration = 7 * day;

            await expect ( tokenAuction.startAuction(amount, duration) ).to.be.revertedWith("TokenAuction: insufficient allowance");
		});

        it("reverts if auction already startred", async function () {
			const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
            const amount = toWei(1000);
            const duration = 7 * day;

            await testToken.approve(tokenAuction.address, amount);
            await tokenAuction.startAuction(amount, duration);
            await waitSeconds(1 * day);

            await expect ( tokenAuction.startAuction(amount, duration) ).to.be.revertedWith("TokenAuction: auction already started");
		});


        it("sets the auction end time", async function () {
			const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
            const amount = toWei(1000);
            const duration = 7 * day;

            await testToken.approve(tokenAuction.address, amount);
            await tokenAuction.startAuction(amount, duration);
            const auctionStartedTime = await getLastBlockTimestamp()
            const auctionEndTime = (await tokenAuction.auctionEnd()).toNumber()

            expect( auctionEndTime ).to.be.equal( auctionStartedTime + duration );
		});

        it("emits the AuctionStarted event", async function () {
			const { tokenAuction, testToken } = await loadFixture(deployAuctionContract);
            const amount = toWei(1000);
            const duration = 7 * day;

            await testToken.approve(tokenAuction.address, amount);

            await expect( await tokenAuction.startAuction(toWei(1000), duration) )
                .to.emit(tokenAuction, 'AuctionStarted')
                .withArgs(amount, duration);
		});

    })

});