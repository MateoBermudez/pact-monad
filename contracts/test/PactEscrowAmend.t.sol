pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PactEscrow} from "../src/PactEscrow.sol";

contract RejectingClient {
    PactEscrow private immutable pact;

    constructor(PactEscrow _pact) {
        pact = _pact;
    }

    function create(address provider, uint64 deadline) external payable returns (uint256) {
        return pact.createAgreement{value: msg.value}(provider, "Trabajo", deadline, keccak256("reglas"));
    }

    receive() external payable {
        revert("no acepto reembolsos");
    }
}

contract PactEscrowAmendTest is Test {
    PactEscrow internal pact;

    address internal client;
    uint256 internal clientKey;
    address internal provider;
    uint256 internal providerKey;
    address internal stranger = makeAddr("stranger");
    address internal agent = makeAddr("agent");

    uint256 internal constant AMOUNT = 50 ether;
    bytes32 internal constant RULES_HASH = keccak256("reglas");
    bytes32 internal constant DECISION = keccak256("decision");

    event AgreementAmended(
        uint256 indexed id,
        address indexed by,
        uint256 oldAmount,
        uint256 newAmount,
        uint64 newDeadline,
        uint256 nonce,
        uint256 refunded
    );

    function setUp() public {
        pact = new PactEscrow(agent, 1_000 ether);
        (client, clientKey) = makeAddrAndKey("client");
        (provider, providerKey) = makeAddrAndKey("provider");
        vm.deal(client, 1_000 ether);
        vm.deal(provider, 100 ether);
    }

    function _deadline() internal view returns (uint64) {
        return uint64(block.timestamp + 7 days);
    }

    function _expiry() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(client);
        id = pact.createAgreement{value: AMOUNT}(provider, "Logo para una cafeteria", _deadline(), RULES_HASH);
    }

    function _createAndAccept() internal returns (uint256 id) {
        id = _create();
        vm.prank(provider);
        pact.acceptAgreement(id);
    }

    function _sign(uint256 key, uint256 id, uint256 newAmount, uint64 newDeadline, uint64 expiry)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, pact.amendmentDigest(id, newAmount, newDeadline, expiry));
        return abi.encodePacked(r, s, v);
    }

    function _amount(uint256 id) internal view returns (uint256) {
        return pact.getAgreement(id).amount;
    }

    // --- subir el precio -------------------------------------------------------------------------------------

    function test_ClientRaisesPriceWithProviderSignatureAndFundsTheDifference() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 70 ether, 0, expiry);

        vm.expectEmit(true, true, false, true);
        emit AgreementAmended(id, client, AMOUNT, 70 ether, 0, 0, 0);
        vm.prank(client);
        pact.amendAgreement{value: 20 ether}(id, 70 ether, 0, expiry, sig);

        assertEq(_amount(id), 70 ether);
        assertEq(address(pact).balance, 70 ether);
        assertEq(pact.amendmentNonce(id), 1);
        assertEq(uint8(pact.getAgreement(id).status), uint8(PactEscrow.Status.Accepted));
    }

    function test_OnlyTheClientCanRaiseThePrice() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(clientKey, id, 70 ether, 0, expiry);

        vm.prank(provider);
        vm.expectRevert(PactEscrow.OnlyClientCanIncrease.selector);
        pact.amendAgreement{value: 20 ether}(id, 70 ether, 0, expiry, sig);
    }

    function test_RaisingNeedsExactlyTheDifference() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 70 ether, 0, expiry);

        vm.startPrank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.WrongValue.selector, 20 ether, 19 ether));
        pact.amendAgreement{value: 19 ether}(id, 70 ether, 0, expiry, sig);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.WrongValue.selector, 20 ether, 0));
        pact.amendAgreement(id, 70 ether, 0, expiry, sig);
        vm.stopPrank();
    }

    // --- bajar el precio -------------------------------------------------------------------------------------

    function test_ProviderPresentsALowerPriceSignedByTheClientAndTheDifferenceGoesBack() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(clientKey, id, 40 ether, 0, expiry);
        uint256 clientBefore = client.balance;

        vm.expectEmit(true, true, false, true);
        emit AgreementAmended(id, provider, AMOUNT, 40 ether, 0, 0, 10 ether);
        vm.prank(provider);
        pact.amendAgreement(id, 40 ether, 0, expiry, sig);

        assertEq(_amount(id), 40 ether);
        assertEq(client.balance, clientBefore + 10 ether);
        assertEq(address(pact).balance, 40 ether);
    }

    function test_ClientAcceptsAProviderSignedLowerPrice() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);
        uint256 clientBefore = client.balance;

        vm.prank(client);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);

        assertEq(client.balance, clientBefore + 20 ether);
        assertEq(_amount(id), 30 ether);
    }

    function test_LoweringRejectsSentValue() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.WrongValue.selector, 0, 1 ether));
        pact.amendAgreement{value: 1 ether}(id, 30 ether, 0, expiry, sig);
    }

    function test_DeadlineOnlyChangeKeepsTheAmount() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        uint64 newDeadline = uint64(block.timestamp + 30 days);
        bytes memory sig = _sign(providerKey, id, AMOUNT, newDeadline, expiry);

        vm.prank(client);
        pact.amendAgreement(id, AMOUNT, newDeadline, expiry, sig);

        assertEq(_amount(id), AMOUNT);
        assertEq(pact.getAgreement(id).deadline, newDeadline);
    }

    function test_ZeroDeadlineKeepsTheCurrentOne() public {
        uint256 id = _createAndAccept();
        uint64 original = pact.getAgreement(id).deadline;
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 45 ether, 0, expiry);

        vm.prank(client);
        pact.amendAgreement(id, 45 ether, 0, expiry, sig);

        assertEq(pact.getAgreement(id).deadline, original);
    }

    function test_AmendingIsAllowedBeforeTheProviderAcceptsToo() public {
        uint256 id = _create();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 45 ether, 0, expiry);

        vm.prank(client);
        pact.amendAgreement(id, 45 ether, 0, expiry, sig);

        assertEq(_amount(id), 45 ether);
    }

    // --- firmas ----------------------------------------------------------------------------------------------

    function test_SenderCannotSignItsOwnAmendment() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(clientKey, id, 70 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement{value: 20 ether}(id, 70 ether, 0, expiry, sig);
    }

    function test_SignatureFromAStrangerIsRejected() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        (, uint256 strangerKey) = makeAddrAndKey("otro");
        bytes memory sig = _sign(strangerKey, id, 70 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement{value: 20 ether}(id, 70 ether, 0, expiry, sig);
    }

    function test_SignatureDoesNotCoverOtherTerms() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 70 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement{value: 50 ether}(id, 100 ether, 0, expiry, sig);
    }

    function test_SignatureCannotBeReplayed() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.prank(client);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);
    }

    function test_AnOlderProposalDiesWhenAnotherOneIsApplied() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory first = _sign(providerKey, id, 60 ether, 0, expiry);
        bytes memory second = _sign(providerKey, id, 40 ether, 0, expiry);

        vm.prank(client);
        pact.amendAgreement(id, 40 ether, 0, expiry, second);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement{value: 20 ether}(id, 60 ether, 0, expiry, first);
    }

    function test_SignatureForAnotherAgreementIsRejected() public {
        uint256 first = _createAndAccept();
        uint256 second = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, first, 30 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement(second, 30 ether, 0, expiry, sig);
    }

    function test_HighSSignatureIsRejected() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(providerKey, pact.amendmentDigest(id, 30 ether, 0, expiry));
        bytes32 flippedS = bytes32(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement(id, 30 ether, 0, expiry, abi.encodePacked(r, flippedS, flippedV));
    }

    function test_MalformedSignatureIsRejected() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidSignature.selector);
        pact.amendAgreement(id, 30 ether, 0, _expiry(), hex"1234");
    }

    function test_ExpiredProposalIsRejected() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.warp(uint256(expiry) + 1);
        vm.prank(client);
        vm.expectRevert(PactEscrow.AmendmentExpired.selector);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);
    }

    // --- quién y cuándo --------------------------------------------------------------------------------------

    function test_StrangerCannotAmend() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.prank(stranger);
        vm.expectRevert(PactEscrow.NotParty.selector);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);
    }

    function test_CannotAmendAfterDelivery() public {
        uint256 id = _createAndAccept();
        vm.prank(provider);
        pact.registerDelivery(id, "https://example.com/e", "Entregado");
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Delivered));
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);
    }

    function test_CannotAmendACancelledAgreement() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);
        vm.prank(client);
        pact.cancelAndRefund(id);

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Cancelled));
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);
    }

    function test_CannotAmendAMissingAgreement() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.AgreementNotFound.selector, 99));
        pact.amendAgreement(99, 30 ether, 0, _expiry(), hex"");
    }

    function test_ZeroAmountIsRejected() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 0, 0, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidAmount.selector);
        pact.amendAgreement(id, 0, 0, expiry, sig);
    }

    function test_PastDeadlineIsRejected() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        uint64 past = uint64(block.timestamp);
        bytes memory sig = _sign(providerKey, id, 30 ether, past, expiry);

        vm.prank(client);
        vm.expectRevert(PactEscrow.DeadlineNotInFuture.selector);
        pact.amendAgreement(id, 30 ether, past, expiry, sig);
    }

    // --- dinero ----------------------------------------------------------------------------------------------

    function test_ClientThatRejectsRefundsCannotBeForcedAndStateStaysIntact() public {
        RejectingClient bad = new RejectingClient(pact);
        vm.deal(address(bad), 50 ether);
        uint256 id = bad.create{value: 50 ether}(provider, _deadline());
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 30 ether, 0, expiry);

        vm.prank(address(bad));
        vm.expectRevert(PactEscrow.TransferFailed.selector);
        pact.amendAgreement(id, 30 ether, 0, expiry, sig);

        assertEq(_amount(id), 50 ether);
        assertEq(pact.amendmentNonce(id), 0);
    }

    function test_AgentReleasesTheAmendedAmount() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(clientKey, id, 40 ether, 0, expiry);
        vm.prank(provider);
        pact.amendAgreement(id, 40 ether, 0, expiry, sig);

        vm.prank(client);
        pact.setAutoReleaseLimit(40 ether);
        vm.prank(provider);
        pact.registerDelivery(id, "https://example.com/e", "Entregado");

        uint256 providerBefore = provider.balance;
        vm.prank(agent);
        pact.releaseByAgent(id, DECISION);

        assertEq(provider.balance, providerBefore + 40 ether);
        assertEq(address(pact).balance, 0);
    }

    function test_RaisingAboveTheAutoReleaseLimitBlocksTheAgentButNotTheClient() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        pact.setAutoReleaseLimit(50 ether);

        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 60 ether, 0, expiry);
        vm.prank(client);
        pact.amendAgreement{value: 10 ether}(id, 60 ether, 0, expiry, sig);
        vm.prank(provider);
        pact.registerDelivery(id, "https://example.com/e", "Entregado");

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.AboveAutoReleaseLimit.selector, 60 ether, 50 ether));
        pact.releaseByAgent(id, DECISION);

        uint256 providerBefore = provider.balance;
        vm.prank(client);
        pact.approveAndRelease(id);
        assertEq(provider.balance, providerBefore + 60 ether);
    }

    function test_CancelRefundsTheAmendedAmount() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();
        bytes memory sig = _sign(providerKey, id, 70 ether, 0, expiry);
        vm.prank(client);
        pact.amendAgreement{value: 20 ether}(id, 70 ether, 0, expiry, sig);

        uint256 clientBefore = client.balance;
        vm.prank(client);
        pact.cancelAndRefund(id);

        assertEq(client.balance, clientBefore + 70 ether);
        assertEq(address(pact).balance, 0);
    }

    function test_SeveralAmendmentsInARowUseIncreasingNonces() public {
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();

        bytes memory first = _sign(clientKey, id, 40 ether, 0, expiry);
        vm.prank(provider);
        pact.amendAgreement(id, 40 ether, 0, expiry, first);

        bytes memory second = _sign(providerKey, id, 55 ether, 0, expiry);
        vm.prank(client);
        pact.amendAgreement{value: 15 ether}(id, 55 ether, 0, expiry, second);

        bytes memory third = _sign(clientKey, id, 20 ether, 0, expiry);
        vm.prank(provider);
        pact.amendAgreement(id, 20 ether, 0, expiry, third);

        assertEq(_amount(id), 20 ether);
        assertEq(pact.amendmentNonce(id), 3);
        assertEq(address(pact).balance, 20 ether);
    }

    // --- propiedad: el contrato siempre guarda exactamente el importe del acuerdo -----------------------------

    function testFuzz_ContractBalanceAlwaysEqualsTheAgreedAmount(uint96 rawNewAmount, bool providerPresents) public {
        uint256 newAmount = bound(uint256(rawNewAmount), 1, 500 ether);
        uint256 id = _createAndAccept();
        uint64 expiry = _expiry();

        uint256 clientBefore = client.balance;
        if (newAmount > AMOUNT) {
            // Sube: lo presenta siempre el cliente, que firma la otra parte (el proveedor).
            bytes memory sig = _sign(providerKey, id, newAmount, 0, expiry);
            vm.prank(client);
            pact.amendAgreement{value: newAmount - AMOUNT}(id, newAmount, 0, expiry, sig);
            assertEq(client.balance, clientBefore - (newAmount - AMOUNT));
        } else {
            address presenter = providerPresents ? provider : client;
            bytes memory sig = _sign(providerPresents ? clientKey : providerKey, id, newAmount, 0, expiry);
            vm.prank(presenter);
            pact.amendAgreement(id, newAmount, 0, expiry, sig);
            assertEq(client.balance, clientBefore + (AMOUNT - newAmount));
        }

        assertEq(_amount(id), newAmount);
        assertEq(address(pact).balance, newAmount);
    }
}
