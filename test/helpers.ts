import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers"

export const day = 24 * 60 * 60;

export async function waitSeconds(secs: number) {
	const ts = (await time.latest()) + secs
	await time.increaseTo(ts)
}

export const toUnits = (amount: BigNumber) : number => {
    return Number(ethers.utils.formatUnits(amount, 18));
}

export const toWei = (units: number) : BigNumber => {
    return ethers.utils.parseUnits( units.toString(), 18); 
}

export const getLastBlockTimestamp = async () => {
    return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
}

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

export const startAuction = async (tokenAuction: Contract, testToken: Contract, amount: BigNumber, duration: number) => {
    await testToken.approve(tokenAuction.address, amount);
    await tokenAuction.startAuction(amount, duration);
}