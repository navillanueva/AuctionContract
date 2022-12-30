// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Imports

import "hardhat/console.sol";

// Error code

error AuctionV1__NotOwner();
error AuctionV1__Owner();

// Interfaces

// Libraries

// Contract

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

    mapping(string => Item) private s_items;
    uint public startTime;
    uint public endTime;
    uint private constant INITIAL_BID = 1e18 wei;
    string[] internal auctionItems;
    address public immutable i_owner;

    struct Item {
        uint highestBid;
        address highestBidder;
    }

    // EVENTS

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
     * @dev this modifier isn´t completely necesarry but could be useful in the future and makes code look cleaner
     */

    modifier notOwner() {
        if (msg.sender == i_owner) revert AuctionV1__Owner();
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
     * @dev since the solidity problem states that the auction must be initialized with starting bids for each item
     *      I generically gave (in the for loop) a starting price of 1eth for every item in the list passed
     * @param _auctionItems the list must not be empty, we check this with the first require
     * @param _startTime value must be smaller than the end time of the auction, checked with the second require
     */
    function initAuction(
        string[] memory _auctionItems,
        uint _startTime,
        uint _endTime
    ) public onlyOwner {
        require(
            auctionItems.length > 0,
            "There has to be at least one item on the auction list"
        );
        require(
            startTime < endTime,
            "The start time value of the auction has to be smaller than the end time"
        );
        startTime = _startTime;
        endTime = _endTime;
        auctionItems = _auctionItems;
        for (
            uint itemsIndex = 0;
            itemsIndex < auctionItems.length;
            itemsIndex++
        ) {
            s_items[auctionItems[itemsIndex]].highestBid = INITIAL_BID;
        }
    }

    /**
     * @notice function for users to place bids
     * @dev we only save the highest bid for each item, saving in the contract all of the bids causes too much gas
     *      and doesn´t appear necesarry when reading the problem description
     * @param _item name to be able to go through our mapping an update highest bids and bidders
     */

    function placeBid(string memory _item) public payable notOwner {
        // verify value is not smaller than the highest bid
        require(
            msg.value > s_items[_item].highestBid,
            "Bid must be higher than the current highest bid!"
        );
        s_items[_item].highestBid = msg.value;
        s_items[_item].highestBidder = msg.sender;
    }

    /**
     * @notice function to determine the highest bidder for each item when the auction ends
     * @dev should the first require be adapted as a modifier with an error or an event?
     * @return array of uints
     */
    function getHighestBids() public payable onlyOwner returns (uint[] memory) {
        // first we must check that the auction has finished
        require(block.timestamp > endTime, "The auction has not ended yet");
        uint[] memory highestBids = new uint[](auctionItems.length);
        for (
            uint itemsIndex = 0;
            itemsIndex < auctionItems.length;
            itemsIndex++
        ) {
            highestBids[itemsIndex] = s_items[auctionItems[itemsIndex]]
                .highestBid;
        }
        return highestBids;
    }

    // TESTING GETTERS

    function getContractBalance() public view returns (uint) {
        return address(this).balance;
    }

    function getTime() public view returns (uint) {
        return block.timestamp;
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }
}
