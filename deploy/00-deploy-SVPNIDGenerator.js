const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat.config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("-------------------------------------------------");
  log("Deploying SvpnIdGenerator...");

  const args = [
    [
      {
        token: "0xc668695dcbCf682dE106Da94bDE65c9bc79362d3",
        paymentAmountMonthly: BigInt(100) * BigInt(1e18),
        paymentAmountYearly: BigInt(200) * BigInt(1e18),
      },
      {
        token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        paymentAmountMonthly: BigInt(10) * BigInt(1e6),
        paymentAmountYearly: BigInt(15) * BigInt(1e6),
      },
    ],
  ];

  const svpnIdGen = await deploy("SVPNIDGenerator", {
    from: deployer,
    log: true,
    args: args,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!developmentChains.includes(network.name)) {
    await verify(svpnIdGen.address, args);
  }
  log("-------------------------------------------------");
  log("successfully deployed Escrow...");
};

module.exports.tags = ["all", "SVPN"];
