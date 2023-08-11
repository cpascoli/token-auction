import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";


export type Bid = { price: number, timestamp: number }
export const day = 24 * 60 * 60;

/**
 * Verify that the input array of numbers is sorted in descending order 
 * @param arr an array of numbers
 * @returns if the array is sorted in descending order
 */
export const isSortedDescending = (arr: number[]) => {
    for(let i = 1; i < arr.length; i++) {
        if (arr[i-1] < arr[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Increases the time of the test blockchain by the given number of seconds
 * @param secs the number of seconds to wait
 */
export const waitSeconds = async  (secs: number) => {
	const ts = (await time.latest()) + secs
	await time.increaseTo(ts)
}

/**
 * Converts from wei to units.
 * @param amount the amount in wei to convert in units
 * @returns the amount in units as a number
 */
export const toUnits = (amount: BigNumber) : number => {
    return Number(ethers.utils.formatUnits(amount, 18));
}

/**
 * Converts from units to wei.
 * @param units the amount of units to convert in wei
 * @returns the unit value in wei as a BigNumber
 */
export const toWei = (units: number) : BigNumber => {
    return ethers.utils.parseUnits( units.toString(), 18); 
}

/**
 * 
 * @returns the timestamp of the last mined block.
 */
export const getLastBlockTimestamp = async () => {
    return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
}

/**
 * 
 * @returns an object containing an instance of the TokenAuction contract, 
 *  TokenAuction contract, the contract owner and a user
 */
export const deployAuctionContract = async () => {

    const [ owner, user ] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken")
    const testToken = await TestToken.deploy(toWei(1_000_000))

    const TokenAuction = await ethers.getContractFactory("TokenAuction")
    const tokenAuction = await TokenAuction.deploy(
        testToken.address, 
    )

    await tokenAuction.deployed()

    return { testToken, tokenAuction, owner, user };
}

/**
 * Approves the token transfer and starts a new auction.
 * @param tokenAuction the TokenAuction Contract
 * @param testToken the TestToken Contract
 * @param amount the amount of tokens being auctioned as a BigNumber
 * @param duration the duration of the auction in seconds
 */
export const startAuction = async (tokenAuction: Contract, testToken: Contract, amount: BigNumber, duration: number) => {
    await testToken.approve(tokenAuction.address, amount);
    await tokenAuction.startAuction(amount, duration);
}


/**
 * 
 * @param tokenAuction the TokenAuction contract
 * @param user the account that is submitting the bid
 * @param amount the amount of the token to bid for
 * @param prices the array of prices for the bids to submit, in wei
 * @returns an array of Bid objects containing the price and timestamp of all bids stored in the contract
 */
export const submitBids = async (
        tokenAuction: Contract, 
        users: SignerWithAddress[], 
        amounts: BigNumber[], 
        prices: number[]
    ) => {

    const precision = 10**6;

    for (const [index, user] of users.entries()) {
        const amount = amounts[index % amounts.length];
        const price = prices[index % prices.length]
        const scaledPrice =  BigNumber.from( Math.round(price * precision) )
        const etherAmount = amount.mul( scaledPrice ).div( precision );

        await tokenAuction.connect(user).bid(amount, toWei(price), { value: etherAmount });
    }

    const bids : Bid[] = (await tokenAuction.getAllBids()).map( 
        (it : { price: BigNumber, timestamp: BigNumber }) => { 
            return {
                price: toUnits(it.price),
                timestamp: it.timestamp.toNumber(),
            }
        }
    );

    return bids;
}


/**
 * @param min the min value (inclusive)
 * @param max the max value (exclusive)
 * @param precision the number of digits of precison of the response. It defaults to 6.
 * @returns Random value between min (inclusive) and max (exclusive)
 */
export const getRandomBetween = (min: number, max: number, precision = 6) => {
    return Math.round( (Math.random() * (max - min) + min ) * 10**precision  ) / 10**precision;
}

/**
 * Submit n bids and returns the average gas spent.
 * 
 * @param prices an array of n prices used to submit n bids
 * @param amount the amount of each bid
 * @param user the user submitting the transactions
 * @param tokenAuction the TokenAuction contract
 * @returns The average gas spent for all tranactions as a Promise<BigNumber>
 */
export const submitBidsAndGetAvgGas = async (
        prices: number[],
        amount: BigNumber,
        user: SignerWithAddress, 
        tokenAuction: Contract,
    )  => {
    
    const precision = 10**6;
    let totalGasUsed = BigNumber.from(0);

    for (let i=0; i<prices.length; i++) {
        const price = prices[i]
        const scaledPrice =  BigNumber.from( Math.round(price * precision) )
        const etherAmount = amount.mul( scaledPrice ).div( precision );
        const tx = await tokenAuction.connect(user).bid(amount, toWei(price), { value: etherAmount });
        
        const gasUsed = (await tx.wait()).gasUsed;
        totalGasUsed = totalGasUsed.add(gasUsed);
    }

    return totalGasUsed.div(prices.length).toNumber();
}