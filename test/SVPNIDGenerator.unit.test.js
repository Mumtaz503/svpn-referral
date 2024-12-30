const { assert } = require("chai");
const { developmentChains } = require("../helper-hardhat.config");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { expect } = require("chai");
const { isAddress } = require("ethers");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("SVPN unit tests", () => {
      let svpnIdGen,
        deployer,
        user,
        signer,
        userSigner,
        provider,
        usdt,
        svpn,
        routerV2;
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        user = (await getNamedAccounts()).user;
        signer = await ethers.provider.getSigner();
        userSigner = await ethers.getSigner(user);
        await deployments.fixture(["all"]);
        routerV2 = await ethers.getContractAt(
          "UniswapV2Router02",
          "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          signer
        );
        svpn = await ethers.getContractAt(
          "IErc20",
          "0xc668695dcbCf682dE106Da94bDE65c9bc79362d3",
          signer
        );
        usdt = await ethers.getContractAt(
          "IErc20",
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          signer
        );
        svpnIdGen = await ethers.getContract("SVPNIDGenerator", deployer);
        provider = new ethers.JsonRpcProvider(
          "https://eth-mainnet.g.alchemy.com/v2/FXYpiM__uT9z5x-XVuvLJRSQdPd2cYaS"
        );
      });
      describe("constructor", function () {
        it("Should correctly set the tokens and their respective payment amounts", async () => {
          const tokensAndPayments = await svpnIdGen.getTokenAndPayments();
          assert.equal(tokensAndPayments[0].token, svpn.target);
        });
      });
      describe("addTokens function", function () {
        it("Should push the new token and payments object in the array", async () => {
          const newTokenAndPaymentObject = [
            {
              token: "0x26498856B5119FFbb304a34697798601BfAa3A7d",
              paymentAmountMonthly: BigInt(1100) * BigInt(1e18),
              paymentAmountYearly: BigInt(900) * BigInt(1e18),
            },
            {
              token: "0xc668695dcbCf682dE106Da94bDE65c9bc79362d3",
              paymentAmountMonthly: BigInt(1500) * BigInt(1e18),
              paymentAmountYearly: BigInt(900) * BigInt(1e18),
            },
          ];
          await svpnIdGen.addTokens(newTokenAndPaymentObject);
          const newTokensAndPayments = await svpnIdGen.getTokenAndPayments();
          assert.equal(
            newTokensAndPayments[2].token,
            newTokenAndPaymentObject[0].token
          );
        });
      });
      describe("payForUniqueIDMonthly function", function () {
        it("Should revert if token not found", async () => {
          const newTokenAddress = "0x26498856B5119FFbb304a34697798601BfAa3A7d";
          await expect(
            svpnIdGen.payForUniqueIDMonthly(newTokenAddress)
          ).to.be.revertedWith("Token Not found");
        });
        it("Should revert if the user balance is not enough", async () => {
          await expect(
            svpnIdGen.payForUniqueIDMonthly(svpn.target)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should transfer tokens from the user to the contract", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            svpn.target, //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("1"),
            }
          );
          await transactionResponse.wait(1);

          const contractBalBefore = await svpn.balanceOf(svpnIdGen.target);
          await svpn.approve(svpnIdGen.target, await svpn.balanceOf(deployer));
          const payment = await svpnIdGen.getTokenAndPayments();
          const tx = await svpnIdGen.payForUniqueIDMonthly(svpn.target);
          await tx.wait(1);
          const contractBalAfter = await svpn.balanceOf(svpnIdGen.target);

          assert(contractBalAfter > contractBalBefore);
          assert.equal(payment[0].paymentAmountMonthly, contractBalAfter);
        });
        it("Should generate a user ID", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            svpn.target, //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("1"),
            }
          );
          await transactionResponse.wait(1);

          await svpn.approve(svpnIdGen.target, await svpn.balanceOf(deployer));
          const tx = await svpnIdGen.payForUniqueIDMonthly(svpn.target);
          await tx.wait(1);

          const userId = await svpnIdGen.getUserIDs(deployer);

          expect(userId).to.exist;
        });
        it("Should generate a user info", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            svpn.target, //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("1"),
            }
          );
          await transactionResponse.wait(1);

          await svpn.approve(svpnIdGen.target, await svpn.balanceOf(deployer));
          const tx = await svpnIdGen.payForUniqueIDMonthly(svpn.target);
          await tx.wait(1);

          const userInfo = await svpnIdGen.getUserInfo(deployer);
          expect(userInfo).to.exist;
        });
        it("Should increas the number of sales", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            svpn.target, //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("1"),
            }
          );
          await transactionResponse.wait(1);

          await svpn.approve(svpnIdGen.target, await svpn.balanceOf(deployer));
          const tx = await svpnIdGen.payForUniqueIDMonthly(svpn.target);
          await tx.wait(1);

          const totalMonthlySales = await svpnIdGen.getTotalMonthlySales();
          const overAllsales = await svpnIdGen.getOverallSales();

          assert.equal(totalMonthlySales, 1);
          assert.equal(overAllsales, 1);
        });
      });
      describe("payForUniqueIDYearly function", function () {
        it("Should revert if Token Not found", async () => {
          const newTokenAddress = "0x26498856B5119FFbb304a34697798601BfAa3A7d";
          await expect(
            svpnIdGen.payForUniqueIDYearly(newTokenAddress)
          ).to.be.revertedWith("Token Not found");
        });
        it("Should revert if not enough balance", async () => {
          await expect(
            svpnIdGen.payForUniqueIDYearly(usdt.target)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should transfer tokens from user to the contract", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            usdt.target,
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("0.05"),
            }
          );
          await transactionResponse.wait(1);
          const contractBal = await usdt.balanceOf(svpnIdGen.target);
          await usdt.approve(svpnIdGen.target, await usdt.balanceOf(deployer));

          const tx = await svpnIdGen.payForUniqueIDYearly(usdt.target);
          await tx.wait(1);

          const contractBalAfter = await usdt.balanceOf(svpnIdGen.target);
          console.log(contractBalAfter);

          assert(contractBalAfter > contractBal);
        });
        it("Should increment Total Yearly Sales", async () => {
          const previousYearlySales = await svpnIdGen.getTotalYearlySales();
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            usdt.target,
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("0.05"),
            }
          );
          await transactionResponse.wait(1);
          await usdt.approve(svpnIdGen.target, await usdt.balanceOf(deployer));

          const tx = await svpnIdGen.payForUniqueIDYearly(usdt.target);
          await tx.wait(1);

          const updatedYearlySales = await svpnIdGen.getTotalYearlySales();

          assert(previousYearlySales < updatedYearlySales);
        });
        it("Should generate user info", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            usdt.target,
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("0.05"),
            }
          );
          await transactionResponse.wait(1);
          await usdt.approve(svpnIdGen.target, await usdt.balanceOf(deployer));

          const tx = await svpnIdGen.payForUniqueIDYearly(usdt.target);
          await tx.wait(1);

          const userInfo = await svpnIdGen.getUserInfo(deployer);
          assert.equal(userInfo[0].user, deployer);
        });
      });
      describe("withdraw function", function () {
        it("Should withdraw all tokens to the deployer's acount", async () => {
          const amountOutMin = 10n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            svpn.target, //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2
            .connect(userSigner)
            .swapExactETHForTokens(amountOutMin, path, user, deadline, {
              value: ethers.parseEther("1"),
            });
          await transactionResponse.wait(1);
          console.log("User SVPN balance: ", await svpn.balanceOf(user));

          const amountOutMin2 = 10n;
          const path2 = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            usdt.target,
          ];

          const deadline2 = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse2 = await routerV2
            .connect(userSigner)
            .swapExactETHForTokens(amountOutMin2, path2, user, deadline, {
              value: ethers.parseEther("0.05"),
            });
          await transactionResponse.wait(1);
          console.log("User USDT balance: ", await usdt.balanceOf(user));

          await svpn
            .connect(userSigner)
            .approve(svpnIdGen.target, await svpn.balanceOf(user));
          await usdt
            .connect(userSigner)
            .approve(svpnIdGen.target, await usdt.balanceOf(user));

          const tx = await svpnIdGen
            .connect(userSigner)
            .payForUniqueIDMonthly(usdt.target);
          await tx.wait(1);

          const tx2 = await svpnIdGen
            .connect(userSigner)
            .payForUniqueIDYearly(svpn.target);
          await tx2.wait(1);

          console.log(
            "Contract SVPN Balance: ",
            await svpn.balanceOf(svpnIdGen.target)
          );
          console.log(
            "Contract USDT balance: ",
            await usdt.balanceOf(svpnIdGen.target)
          );

          const deployerSvpnBalance = await svpn.balanceOf(deployer);
          const deployerUsdtBalance = await usdt.balanceOf(deployer);

          const tx3 = await svpnIdGen.withdrawTokens();
          await tx3.wait(1);

          const deployerSvpnBalAfter = await svpn.balanceOf(deployer);
          const deployerUsdtBalAfeter = await usdt.balanceOf(deployer);

          assert(deployerSvpnBalAfter > deployerSvpnBalance);
          assert(deployerUsdtBalAfeter > deployerUsdtBalance);
        });
      });
      describe("updateMonthlyPaymentAmount function", function () {
        it("Should revert if token is not found", async () => {
          await expect(
            svpnIdGen.updateMonthlyPaymentAmount(
              "0x2637ffecE0217aE626529f6775167020F1c17D83",
              BigInt(10) * BigInt(1e18)
            )
          ).to.be.revertedWith("Token Not found");
        });
        it("Should change the payment for the specified token", async () => {
          const tokenAndPayment = await svpnIdGen.getTokenAndPayments();
          const svpnMonthlyPayment = tokenAndPayment[0].paymentAmountMonthly;

          const svpnNewMonthlyPayment = BigInt(110) * BigInt(1e18);

          const tx = await svpnIdGen.updateMonthlyPaymentAmount(
            svpn.target,
            svpnNewMonthlyPayment
          );
          await tx.wait(1);

          const paymentAndToknAfter = await svpnIdGen.getTokenAndPayments();

          const newsvpnpay = paymentAndToknAfter[0].paymentAmountMonthly;
          assert.equal(newsvpnpay, svpnNewMonthlyPayment);
        });
      });
      describe("updateYearlyPaymentAmount function", function () {
        it("Should revert if token not found", async () => {
          await expect(
            svpnIdGen.updateYearlyPaymentAmount(
              "0x2637ffecE0217aE626529f6775167020F1c17D83",
              BigInt(10) * BigInt(1e18)
            )
          ).to.be.revertedWith("Token Not found");
        });
        it("Should update the payment for yearly for usdt", async () => {
          const tokenAndPayment = await svpnIdGen.getTokenAndPayments();
          const usdtNewYearlyPayment = tokenAndPayment[1].paymentAmountYearly;
          const newYearlyPayment = BigInt(8) * BigInt(1e6);

          const tx = await svpnIdGen.updateYearlyPaymentAmount(
            usdt.target,
            newYearlyPayment
          );
          await tx.wait(1);

          const paymentAndTokenAfter = await svpnIdGen.getTokenAndPayments();
          const newYearlyPaymentForUsdt =
            paymentAndTokenAfter[1].paymentAmountYearly;
          assert.equal(newYearlyPaymentForUsdt, newYearlyPayment);
        });
      });
    });
