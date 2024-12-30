// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.25;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";

contract SVPNIDGenerator is Ownable {
    using SafeERC20 for IERC20;
    struct UserInfo {
        address token;
        uint256 paidAmount;
        address user;
        string paymentId;
        string packageType;
    }

    struct TokenAndPayment {
        address token;
        uint256 paymentAmountMonthly;
        uint256 paymentAmountYearly;
    }

    IERC20 private tokens;

    uint256 public nextID;
    uint256 public constant IDLength = 15;
    uint256 public s_totalYearlySales;
    uint256 public s_totalYearlySalesValue;
    uint256 public s_totalMonthlySales;
    uint256 public s_totalMonthlySalesValue;
    uint256 public s_totalOverallSales;
    uint256 public s_totalOverallSalesValue;
    TokenAndPayment[] private s_tokenAndPayments;
    // uint256 public constant SVPN_DECIMALS = 1e18;

    event IDGenerated(
        address indexed payer,
        string generatedID,
        string paymentType
    );
    event MonthlyPaymentAmountUpdated(
        address indexed tokenAddress,
        uint256 newPaymentAmount
    );
    event YearlyPaymentAmountUpdated(
        address tokenAddress,
        uint256 newPaymentAmount
    );

    // Mapping to store arrays of user IDs
    mapping(address => string[]) private _userIDs;
    mapping(address => UserInfo[]) private s_userToUserInfo;

    constructor(
        TokenAndPayment[] memory _tokenAndPayments
    ) Ownable(msg.sender) {
        for (uint256 i = 0; i < _tokenAndPayments.length; i++) {
            s_tokenAndPayments.push(_tokenAndPayments[i]);
        }
        nextID = 1;
    }

    function addTokens(
        TokenAndPayment[] memory _newTokenAndPayments
    ) external onlyOwner {
        for (
            uint256 newIndex = 0;
            newIndex < _newTokenAndPayments.length;
            newIndex++
        ) {
            bool exists = false;
            address newToken = _newTokenAndPayments[newIndex].token;

            for (
                uint256 existingIndex = 0;
                existingIndex < s_tokenAndPayments.length;
                existingIndex++
            ) {
                if (s_tokenAndPayments[existingIndex].token == newToken) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                s_tokenAndPayments.push(_newTokenAndPayments[newIndex]);
            }
        }
    }

    function payForUniqueIDMonthly(address _tokenAddress) external {
        TokenAndPayment memory tokenAndPayment;
        bool tokenFound = false;
        for (uint256 i = 0; i < s_tokenAndPayments.length; i++) {
            if (_tokenAddress == s_tokenAndPayments[i].token) {
                tokenAndPayment = s_tokenAndPayments[i];
                tokenFound = true;
                break;
            }
        }
        require(tokenFound == true, "Token Not found");

        uint256 monthlyPayment = tokenAndPayment.paymentAmountMonthly;
        require(
            IERC20(_tokenAddress).balanceOf(msg.sender) >= monthlyPayment,
            "Not enough balance"
        );
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            monthlyPayment
        );
        string memory generatedID = generateUniqueID();
        _userIDs[msg.sender].push(generatedID);
        s_userToUserInfo[msg.sender].push(
            UserInfo({
                token: _tokenAddress,
                paidAmount: monthlyPayment,
                user: msg.sender,
                paymentId: generatedID,
                packageType: "Monthly"
            })
        );
        s_totalMonthlySales += 1;
        emit IDGenerated(msg.sender, generatedID, "Monthly");
    }

    function payForUniqueIDYearly(address _tokenAddress) external {
        TokenAndPayment memory tokenAndPayment;
        bool tokenFound = false;
        for (uint256 i = 0; i < s_tokenAndPayments.length; i++) {
            if (_tokenAddress == s_tokenAndPayments[i].token) {
                tokenAndPayment = s_tokenAndPayments[i];
                tokenFound = true;
                break;
            }
        }
        require(tokenFound == true, "Token Not found");
        uint256 yearlyPaymentAmount = tokenAndPayment.paymentAmountYearly;
        require(
            IERC20(_tokenAddress).balanceOf(msg.sender) >= yearlyPaymentAmount,
            "Not enough balance"
        );
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            yearlyPaymentAmount
        );
        string memory generatedID = generateUniqueID();
        _userIDs[msg.sender].push(generatedID);
        s_userToUserInfo[msg.sender].push(
            UserInfo({
                token: _tokenAddress,
                paidAmount: yearlyPaymentAmount,
                user: msg.sender,
                paymentId: generatedID,
                packageType: "Yearly"
            })
        );
        s_totalYearlySales += 1;
        emit IDGenerated(msg.sender, generatedID, "Yearly");
    }

    function generateUniqueID() internal returns (string memory) {
        bytes memory characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        bytes memory result = new bytes(IDLength);
        bool unique;
        uint256 attempts = 0;

        do {
            bytes32 hash = keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender,
                    nextID,
                    attempts
                )
            );
            unique = true;

            for (uint256 i = 0; i < IDLength; i++) {
                uint256 randIndex = uint256(uint8(hash[i % 32])) %
                    characters.length;
                result[i] = characters[randIndex];
            }

            string memory newID = string(result);
            for (uint256 i = 0; i < _userIDs[msg.sender].length; i++) {
                if (
                    keccak256(abi.encodePacked(_userIDs[msg.sender][i])) ==
                    keccak256(abi.encodePacked(newID))
                ) {
                    unique = false;
                    break;
                }
            }

            attempts++;
        } while (!unique && attempts < 10); // Prevent infinite loops

        require(
            unique,
            "Failed to generate a unique ID after several attempts."
        );
        nextID++;
        return string(result);
    }

    function withdrawTokens() external onlyOwner {
        for (uint256 i = 0; i < s_tokenAndPayments.length; i++) {
            address tokenAddress = s_tokenAndPayments[i].token;
            uint256 amountToWithdraw = IERC20(tokenAddress).balanceOf(
                address(this)
            );

            if (amountToWithdraw > 0) {
                IERC20(tokenAddress).safeTransfer(msg.sender, amountToWithdraw);
            }
        }
    }

    function updateMonthlyPaymentAmount(
        address _tokenAddress,
        uint256 _newPaymentAmount
    ) external onlyOwner {
        bool tokenFound = false;
        for (uint256 i = 0; i < s_tokenAndPayments.length; i++) {
            if (_tokenAddress == s_tokenAndPayments[i].token) {
                s_tokenAndPayments[i].paymentAmountMonthly = _newPaymentAmount;
                tokenFound = true;
                break;
            }
        }
        require(tokenFound, "Token Not found");
        emit MonthlyPaymentAmountUpdated(_tokenAddress, _newPaymentAmount);
    }

    function updateYearlyPaymentAmount(
        address _tokenAddress,
        uint256 _newPaymentAmount
    ) external onlyOwner {
        bool tokenFound = false;
        for (uint256 i = 0; i < s_tokenAndPayments.length; i++) {
            if (_tokenAddress == s_tokenAndPayments[i].token) {
                s_tokenAndPayments[i].paymentAmountYearly = _newPaymentAmount;
                tokenFound = true;
                break;
            }
        }
        require(tokenFound, "Token Not found");
        emit YearlyPaymentAmountUpdated(_tokenAddress, _newPaymentAmount);
    }

    function getUserIDs(address user) external view returns (string[] memory) {
        return _userIDs[user];
    }

    function getUserInfo(
        address _user
    ) public view returns (UserInfo[] memory) {
        return s_userToUserInfo[_user];
    }

    function getTotalYearlySales() public view returns (uint256) {
        return s_totalYearlySales;
    }

    function getTotalMonthlySales() public view returns (uint256) {
        return s_totalMonthlySales;
    }

    function getOverallSales() public view returns (uint256) {
        return s_totalMonthlySales + s_totalYearlySales;
    }

    function getTokenAndPayments()
        public
        view
        returns (TokenAndPayment[] memory)
    {
        return s_tokenAndPayments;
    }
}
