// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// 1.- Imports

import "hardhat/console.sol";

// 2.- Error code

// declaring custom errors is a better practice for gas saving and using dynamic information

error AuctionV1__NotOwner();
error AuctionV1__Owner();
error AuctionV1__EmptyList();
error AuctionV1__WrongTimeValues();
error AuctionV1__WrongArraySize();
error AuctionV1__DuplicateItems();
error AuctionV1__AuctionEnded();
error AuctionV1__AuctionLive();
error AuctionV1__BidTooLow();

// 3 .-Interfaces

// 4.- Libraries

// 5.- Contract

/** @title Simple Auction System for Trufin.io
 *  @author Nicolas Arnedo Villanueva
 *  @notice This contract is to demo a simple auction system where an owner creates an auction with a list of items
 *          and user can place bids on the items being auctioned.
 *  @dev This implements price feeds as our library
 */

contract AuctionV1 {
    // TYPE DECLARATIONS

    // STATE VARIABLES

    // declare uints successively to save gas
    // start time and end time should be visible to all users
    uint public startTime;
    uint public endTime;
    uint private constant INITIAL_BID = 1 ether;

    // we make the string and uint arrays private as we dont want any other smart contracts to inherit this information
    uint[] private s_initialBids;
    string[] private s_auctionItems;

    // we create a mapping to check for duplicated items when creating an auction
    // the default value for all of the booleans is false
    mapping(string => bool) private s_noDuplicate;
    mapping(string => Item) private s_items;

    address public immutable i_owner;

    struct Item {
        uint highestBid;
        // highestBidder address must be payable so we can return bids that have been surpassed
        address payable highestBidder;
    }

    // EVENTS

    event NewBid(address bidder, uint bid);

    // MODIFIERS

    /**
     * @notice modifier to add to functions that can only be executed by the owner of the contract
     * @dev this modifier was implemented to refactor code since it is used for initalizing auction and getting highest bids
     */

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert AuctionV1__NotOwner();
        _;
    }

    /**
     * @notice modifier to add to functions that cant be executed by the owner of the contract
     * @dev this modifier isn´t completely necessary but could be useful in the future and makes code look cleaner
     */

    modifier notOwner() {
        if (msg.sender == i_owner) revert AuctionV1__Owner();
        _;
    }

    /**
     * @notice modifier to check if the auction is live
     * @dev every time the function place bid is called it should check the auction is still live
     */

    modifier auctionLive() {
        if (block.timestamp > endTime) revert AuctionV1__AuctionEnded();
        _;
    }

    // FUNCTIONS

    /**
     * @notice initializing the contract and saving the owner
     * @dev auction list, start time and end time could have been included in constructor but
     *      chose not to do this, so the owner can create multiple auctions
     */
    constructor() {
        i_owner = msg.sender;
    }

    /**
     * @notice function to create one auction
     * @dev since the solidity problem states that the auction must be initialized with starting bids (in plural) for each item
     *      I assume there are multiple starting bids, therefore each item has a different starting value that the contract creator sets
     * @param _auctionItems the list must not be empty, we check this with the first require
     * @param _startTime value must be smaller than the end time of the auction, checked with the second require
     */
    function initAuction(
        string[] memory _auctionItems,
        uint[] memory _initialBids,
        uint _startTime,
        uint _endTime
    ) public onlyOwner {
        // checking for valid parameters values introduced
        if (_auctionItems.length <= 0) revert AuctionV1__EmptyList();
        if (_auctionItems.length != _initialBids.length)
            revert AuctionV1__WrongArraySize();
        if (_startTime > _endTime) revert AuctionV1__WrongTimeValues();

        s_auctionItems = _auctionItems;
        s_initialBids = _initialBids;
        startTime = _startTime;
        endTime = _endTime;

        for (
            uint itemsIndex = 0;
            itemsIndex < s_auctionItems.length;
            itemsIndex++
        ) {
            // check that the mapping value hasnt been changed to true, which would mean there is a duplicate
            if (!s_noDuplicate[s_auctionItems[itemsIndex]]) {
                // change item value to true
                s_noDuplicate[s_auctionItems[itemsIndex]] = true;
                // set initial value for that specific item
                s_items[s_auctionItems[itemsIndex]].highestBid = s_initialBids[
                    itemsIndex
                ];
            } else {
                revert AuctionV1__DuplicateItems();
            }
        }
    }

    /**
     * @notice function for users to place bids
     * @dev we only save the highest bid for each item, saving in the contract all of the bids causes too much gas
     *      and doesn´t appear necesarry when reading the problem description
     * @param _item name to be able to go through our mapping an update highest bids and bidders
     */

    function placeBid(string memory _item) public payable notOwner auctionLive {
        // verify value is not smaller than the highest bid
        if (msg.value > s_items[_item].highestBid) {
            // saving to local variable to avoid going to storage two times
            address payable highestBidder = s_items[_item].highestBidder;
            // if bid is higher, we return the value of the last highest bid to its owner
            // unless the recent owner is the contract owner which didnt lock any value in the bid
            if (highestBidder != i_owner) {
                highestBidder.transfer(s_items[_item].highestBid);
            }
            // storing the value in a storage variable and then changin it
            // instead of calling the value twice, this way we save the usar
            // placing the bid gas when calling this function
            Item storage item = s_items[_item];
            item.highestBidder = payable(msg.sender);
            item.highestBid = msg.value;
            emit NewBid(item.highestBidder, item.highestBid);
        } else {
            revert AuctionV1__BidTooLow();
        }
    }

    /**
     * @notice function to determine the highest bidder for each item when the auction ends
     * @dev this is a view function as it does not affect/alter the blockchain
     * @return array I assume that it only returns the highest bidder for all of the items in auction that ended, and not also their highest bids
     */
    function getHighestBidders()
        public
        view
        onlyOwner
        returns (address[] memory)
    {
        // first we must check that the auction has finished

        if (block.timestamp < endTime) revert AuctionV1__AuctionLive();
        address[] memory highestBidders = new address[](s_auctionItems.length);
        for (
            uint itemsIndex = 0;
            itemsIndex < s_auctionItems.length;
            itemsIndex++
        ) {
            highestBidders[itemsIndex] = s_items[s_auctionItems[itemsIndex]]
                .highestBidder;
        }
        return highestBidders;
    }

    // TESTING GETTERS

    function getContractBalance() public view returns (uint) {
        return address(this).balance;
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getDuplicateValue(string memory item) public view returns (bool) {
        return s_noDuplicate[item];
    }

    function getHighestBid(string memory item) public view returns (uint) {
        return s_items[item].highestBid;
    }

    function getHighestBidder(
        string memory item
    ) public view returns (address) {
        return s_items[item].highestBidder;
    }
}
