// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// 1.- Imports

import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// 2.- Error codes

// declaring custom errors is a better practice for gas saving and using dynamic information

error AuctionV2__NotOwner();
error AuctionV2__Owner();
error AuctionV2__EmptyList();
error AuctionV2__WrongTimeValues();
error AuctionV2__WrongArraySize();
error AuctionV2__DuplicateItems();
error AuctionV2__AuctionLive();
error AuctionV2__AuctionEnded();
error AuctionV2__BidTooLow();
/**
 * @dev we add some params to this error so the user can understand which one of the 3 is value that isnt allowing the function performUpKeep to execute
 */
error AuctionV2__UpkeepNotNeeded(bool newBids, uint256 AuctionState);

// 3 .-Interfaces

// 4.- Libraries

// 5.- Contract

/** @title Simple Auction System for Trufin.io
 *  @author Nicolas Arnedo Villanueva
 *  @notice The auction v2 contract maintains the simple functionality of the v1 but implements an oracle to be able to automatically
 *          set the winners of the auction once it has ended, instead of the owner having to call this function.
 *  @dev This implements chainlink automation
 */

contract AuctionV2 is AutomationCompatibleInterface {
    // TYPE DECLARATIONS

    enum AuctionState {
        OPEN,
        CALCULATING
    }

    // STATE VARIABLES

    // declare uints successively to save gas
    // start time and end time should be visible to all users
    uint256 public startTime;
    uint256 public endTime;
    uint256 public interval;
    bool private s_newBids;

    // we make the string and uint arrays private as we dont want any other smart contracts to inherit this information
    uint256[] private s_initialBids;
    string[] private s_auctionItems;

    // we create a mapping to check for duplicated items when creating an auction
    // the default value for all of the booleans is false
    mapping(string => bool) private s_noDuplicate;
    mapping(string => Item) private s_items;
    AuctionState private s_auctionState;

    address public immutable i_owner;
    address[] public winners;

    struct Item {
        uint256 highestBid;
        // highestBidder address must be payable so we can return bids that have been surpassed
        address payable highestBidder;
    }

    // EVENTS (valuable for when we change a dynamic variable and helpful for frontend developing)

    event NewBid(address bidder, uint256 bid);
    event WinnersPicked(address[] indexed bidders);

    // MODIFIERS

    /**
     * @notice modifier to add to functions that can only be executed by the owner of the contract
     * @dev this modifier was implemented to refactor code since it is used for initalizing auction and getting highest bids
     */

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert AuctionV2__NotOwner();
        _;
    }

    /**
     * @notice modifier to add to functions that cant be executed by the owner of the contract
     * @dev this modifier isn´t completely necessary but could be useful in the future and makes code look cleaner
     */

    modifier notOwner() {
        if (msg.sender == i_owner) revert AuctionV2__Owner();
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
        uint256[] memory _initialBids,
        uint256 _startTime,
        uint256 _endTime
    ) public onlyOwner {
        // checking for valid parameters values introduced
        if (_auctionItems.length <= 0) revert AuctionV2__EmptyList();
        if (_auctionItems.length != _initialBids.length)
            revert AuctionV2__WrongArraySize();
        if (_startTime > _endTime) revert AuctionV2__WrongTimeValues();

        s_auctionItems = _auctionItems;
        s_initialBids = _initialBids;
        startTime = _startTime;
        endTime = _endTime;

        // we decalre the auction open so the oracle can later perform automatically upkeep
        s_auctionState = AuctionState.OPEN;
        interval = endTime - startTime;
        s_newBids = false;

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
                // set the highest bidder to the owner
                s_items[s_auctionItems[itemsIndex]].highestBidder = payable(
                    msg.sender
                );
            } else {
                revert AuctionV2__DuplicateItems();
            }
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
        if (msg.value < s_items[_item].highestBid)
            revert AuctionV2__BidTooLow();
        // verify auction is open
        if (block.timestamp > endTime) revert AuctionV2__AuctionEnded();
        // saving to local variable to avoid going to storage two times (higher gas cost)
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
        // for later use with chainlink keepers
        s_newBids = true;
        // this event is mainly useful for later frontend development
        emit NewBid(item.highestBidder, item.highestBid);
    }

    // a different way of implementing this could be posible
    /**
     * @dev This is the function that the Chainlink Automation nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval (endTime - startTime) has passes.
     * 2. The auction is open.
     * 3. Users have placed bids on at least one item (if not it is irrelevent to execute getHighestBidders)
     * */

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = AuctionState.OPEN == s_auctionState;
        bool timePassed = ((block.timestamp - startTime) > interval);
        upkeepNeeded = (isOpen && timePassed && s_newBids);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @dev Once `checkUpkeep` is returning `true`, this function is called
     * and it kicks off a Chainlink VRF call to get a random winner.
     */
    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert AuctionV2__UpkeepNotNeeded(
                s_newBids,
                uint256(s_auctionState) // if it returns 1 or 2 the auction is calculating or ended
            );
        }
        // so that no more bids are placed
        s_auctionState = AuctionState.CALCULATING;
        // we call the function to get the highest bidders
        winners = getHighestBidders();
    }

    /**
     * @notice function to determine the highest bidder for each item when the auction ends
     * @dev We still keep modifier and first if check just in case upkeep doesnt work and owner has to call it manually
     * @return array I assume that it only returns the highest bidder for all of the items in auction that ended, and not also their highest bids
     */
    function getHighestBidders() public onlyOwner returns (address[] memory) {
        if (block.timestamp < endTime) revert AuctionV2__AuctionLive();
        // maybe add that the item is emptied after the auction has finished
        address[] memory highestBidders = new address[](s_auctionItems.length);
        for (
            uint itemsIndex = 0;
            itemsIndex < s_auctionItems.length;
            itemsIndex++
        ) {
            highestBidders[itemsIndex] = s_items[s_auctionItems[itemsIndex]]
                .highestBidder;
        }
        // again, this event would be for frontend development
        emit WinnersPicked(highestBidders);
        return highestBidders;
    }

    // TESTING GETTERS

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getDuplicateValue(string memory item) public view returns (bool) {
        return s_noDuplicate[item];
    }

    function getHighestBid(string memory item) public view returns (uint256) {
        return s_items[item].highestBid;
    }

    function getHighestBidder(
        string memory item
    ) public view returns (address) {
        return s_items[item].highestBidder;
    }

    function getAuctionState() public view returns (AuctionState) {
        return s_auctionState;
    }

    function getBids() public view returns (bool) {
        return s_newBids;
    }

    function getTime() public view returns (uint256) {
        return block.timestamp;
    }
}
