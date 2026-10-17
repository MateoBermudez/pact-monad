pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PactEscrow} from "../src/PactEscrow.sol";

contract ReentrantClient {
    PactEscrow private immutable pact;
    uint256 private targetId;
    bool public reentrancyBlocked;

    constructor(PactEscrow _pact) {
        pact = _pact;
    }

    function create(address provider, uint64 deadline) external payable returns (uint256 id) {
        id = pact.createAgreement{value: msg.value}(provider, "Trabajo", deadline);
        targetId = id;
    }

    function cancel() external {
        pact.cancelAndRefund(targetId);
    }

    receive() external payable {
        try pact.cancelAndRefund(targetId) {
            reentrancyBlocked = false;
        } catch {
            reentrancyBlocked = true;
        }
    }
}

contract RejectingProvider {
    PactEscrow private immutable pact;

    constructor(PactEscrow _pact) {
        pact = _pact;
    }

    function accept(uint256 id) external {
        pact.acceptAgreement(id);
    }

    function deliver(uint256 id) external {
        pact.registerDelivery(id, "https://example.com/entrega");
    }

    receive() external payable {
        revert("no acepto pagos");
    }
}

contract PactEscrowTest is Test {
    PactEscrow internal pact;

    address internal client = makeAddr("client");
    address internal provider = makeAddr("provider");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AMOUNT = 10 ether;
    string internal constant DESCRIPTION = "Logo para una cafeteria, entrega en PNG y SVG";
    string internal constant URL = "https://example.com/logo.zip";

    event AgreementCreated(
        uint256 indexed id,
        address indexed client,
        address indexed provider,
        uint256 amount,
        uint64 deadline,
        string description
    );
    event AgreementAccepted(uint256 indexed id, address indexed provider);
    event DeliveryRegistered(uint256 indexed id, address indexed provider, string evidenceUrl);
    event AgreementApproved(uint256 indexed id, address indexed provider, uint256 amount);
    event AgreementCancelled(uint256 indexed id, address indexed client, uint256 amount);

    function setUp() public {
        pact = new PactEscrow();
        vm.deal(client, 100 ether);
    }

    function _deadline() internal view returns (uint64) {
        return uint64(block.timestamp + 7 days);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(client);
        id = pact.createAgreement{value: AMOUNT}(provider, DESCRIPTION, _deadline());
    }

    function _createAndAccept() internal returns (uint256 id) {
        id = _create();
        vm.prank(provider);
        pact.acceptAgreement(id);
    }

    function _createAcceptAndDeliver() internal returns (uint256 id) {
        id = _createAndAccept();
        vm.prank(provider);
        pact.registerDelivery(id, URL);
    }

    function _status(uint256 id) internal view returns (PactEscrow.Status) {
        return pact.getAgreement(id).status;
    }

    function test_FullFlow_ProviderReceivesExactAmount() public {
        uint256 providerBefore = provider.balance;
        uint256 clientBefore = client.balance;

        uint256 id = _create();
        assertEq(id, 1);
        assertEq(address(pact).balance, AMOUNT, "los fondos quedan bloqueados en el contrato");
        assertEq(client.balance, clientBefore - AMOUNT);
        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Created));

        vm.prank(provider);
        pact.acceptAgreement(id);
        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Accepted));

        vm.prank(provider);
        pact.registerDelivery(id, URL);
        PactEscrow.Agreement memory delivered = pact.getAgreement(id);
        assertEq(uint8(delivered.status), uint8(PactEscrow.Status.Delivered));
        assertEq(delivered.evidenceUrl, URL);

        vm.prank(client);
        pact.approveAndRelease(id);

        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Approved));
        assertEq(provider.balance, providerBefore + AMOUNT, "el proveedor cobra el monto exacto");
        assertEq(address(pact).balance, 0, "el contrato no retiene fondos");
    }

    function test_Cancel_RefundsClientInFull() public {
        uint256 clientBefore = client.balance;
        uint256 id = _create();

        vm.prank(client);
        pact.cancelAndRefund(id);

        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Cancelled));
        assertEq(client.balance, clientBefore, "el cliente recupera todo");
        assertEq(address(pact).balance, 0);
    }

    function test_Cancel_AllowedAfterAccept() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        pact.cancelAndRefund(id);
        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Cancelled));
    }

    function test_CreateStoresAllFieldsAndEmitsEvent() public {
        uint64 deadline = _deadline();

        vm.expectEmit(true, true, true, true);
        emit AgreementCreated(1, client, provider, AMOUNT, deadline, DESCRIPTION);
        vm.prank(client);
        pact.createAgreement{value: AMOUNT}(provider, DESCRIPTION, deadline);

        PactEscrow.Agreement memory a = pact.getAgreement(1);
        assertEq(a.client, client);
        assertEq(a.provider, provider);
        assertEq(a.amount, AMOUNT);
        assertEq(a.deadline, deadline);
        assertEq(a.description, DESCRIPTION);
        assertEq(a.evidenceUrl, "");
        assertEq(pact.agreementCount(), 1);
    }

    function test_TransitionsEmitEvents() public {
        uint256 id = _create();

        vm.expectEmit(true, true, false, false);
        emit AgreementAccepted(id, provider);
        vm.prank(provider);
        pact.acceptAgreement(id);

        vm.expectEmit(true, true, false, true);
        emit DeliveryRegistered(id, provider, URL);
        vm.prank(provider);
        pact.registerDelivery(id, URL);

        vm.expectEmit(true, true, false, true);
        emit AgreementApproved(id, provider, AMOUNT);
        vm.prank(client);
        pact.approveAndRelease(id);
    }

    function test_CancelEmitsEvent() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, true);
        emit AgreementCancelled(id, client, AMOUNT);
        vm.prank(client);
        pact.cancelAndRefund(id);
    }

    function test_AgreementsAreIndependent() public {
        uint256 a = _create();
        vm.prank(client);
        uint256 b = pact.createAgreement{value: 3 ether}(provider, "Otro trabajo", _deadline());

        vm.prank(client);
        pact.cancelAndRefund(a);

        assertEq(uint8(_status(b)), uint8(PactEscrow.Status.Created), "cancelar uno no afecta al otro");
        assertEq(address(pact).balance, 3 ether);
    }

    function test_Create_RevertsWithoutValue() public {
        vm.prank(client);
        vm.expectRevert(PactEscrow.NoValueSent.selector);
        pact.createAgreement(provider, DESCRIPTION, _deadline());
    }

    function test_Create_RevertsWithZeroAddressProvider() public {
        vm.prank(client);
        vm.expectRevert(PactEscrow.InvalidProvider.selector);
        pact.createAgreement{value: AMOUNT}(address(0), DESCRIPTION, _deadline());
    }

    function test_Create_RevertsWhenProviderIsClient() public {
        vm.prank(client);
        vm.expectRevert(PactEscrow.ProviderIsClient.selector);
        pact.createAgreement{value: AMOUNT}(client, DESCRIPTION, _deadline());
    }

    function test_Create_RevertsWithPastOrCurrentDeadline() public {
        vm.startPrank(client);
        vm.expectRevert(PactEscrow.DeadlineNotInFuture.selector);
        pact.createAgreement{value: AMOUNT}(provider, DESCRIPTION, uint64(block.timestamp));
        vm.expectRevert(PactEscrow.DeadlineNotInFuture.selector);
        pact.createAgreement{value: AMOUNT}(provider, DESCRIPTION, 0);
        vm.stopPrank();
    }

    function test_Create_RevertsWithEmptyDescription() public {
        vm.prank(client);
        vm.expectRevert(PactEscrow.EmptyDescription.selector);
        pact.createAgreement{value: AMOUNT}(provider, "", _deadline());
    }

    function test_Create_RevertsWithTooLongDescription() public {
        bytes memory long = new bytes(pact.MAX_DESCRIPTION_LENGTH() + 1);
        for (uint256 i; i < long.length; ++i) {
            long[i] = "a";
        }
        vm.prank(client);
        vm.expectRevert(PactEscrow.DescriptionTooLong.selector);
        pact.createAgreement{value: AMOUNT}(provider, string(long), _deadline());
    }

    function test_Accept_OnlyProvider() public {
        uint256 id = _create();
        vm.prank(client);
        vm.expectRevert(PactEscrow.NotProvider.selector);
        pact.acceptAgreement(id);
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.NotProvider.selector);
        pact.acceptAgreement(id);
    }

    function test_Accept_CannotBeRepeated() public {
        uint256 id = _createAndAccept();
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Accepted));
        pact.acceptAgreement(id);
    }

    function test_Deliver_OnlyProvider() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        vm.expectRevert(PactEscrow.NotProvider.selector);
        pact.registerDelivery(id, URL);
    }

    function test_Deliver_RequiresAcceptance() public {
        uint256 id = _create();
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Created));
        pact.registerDelivery(id, URL);
    }

    function test_Deliver_RevertsWithEmptyOrTooLongUrl() public {
        uint256 id = _createAndAccept();

        vm.prank(provider);
        vm.expectRevert(PactEscrow.EmptyUrl.selector);
        pact.registerDelivery(id, "");

        bytes memory long = new bytes(pact.MAX_URL_LENGTH() + 1);
        for (uint256 i; i < long.length; ++i) {
            long[i] = "a";
        }
        vm.prank(provider);
        vm.expectRevert(PactEscrow.UrlTooLong.selector);
        pact.registerDelivery(id, string(long));
    }

    function test_Approve_OnlyClient() public {
        uint256 id = _createAcceptAndDeliver();
        vm.prank(provider);
        vm.expectRevert(PactEscrow.NotClient.selector);
        pact.approveAndRelease(id);
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.NotClient.selector);
        pact.approveAndRelease(id);
    }

    function test_Approve_RequiresDelivery() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Accepted));
        pact.approveAndRelease(id);
    }

    function test_Approve_CannotBePaidTwice() public {
        uint256 id = _createAcceptAndDeliver();
        vm.startPrank(client);
        pact.approveAndRelease(id);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Approved));
        pact.approveAndRelease(id);
        vm.stopPrank();
    }

    function test_Cancel_OnlyClient() public {
        uint256 id = _create();
        vm.prank(provider);
        vm.expectRevert(PactEscrow.NotClient.selector);
        pact.cancelAndRefund(id);
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.NotClient.selector);
        pact.cancelAndRefund(id);
    }

    function test_Cancel_BlockedOnceDelivered() public {
        uint256 id = _createAcceptAndDeliver();
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Delivered));
        pact.cancelAndRefund(id);
    }

    function test_Cancel_BlockedAfterApprovalOrCancellation() public {
        uint256 paid = _createAcceptAndDeliver();
        vm.prank(client);
        pact.approveAndRelease(paid);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Approved));
        pact.cancelAndRefund(paid);

        uint256 cancelled = _create();
        vm.startPrank(client);
        pact.cancelAndRefund(cancelled);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.InvalidStatus.selector, PactEscrow.Status.Cancelled));
        pact.cancelAndRefund(cancelled);
        vm.stopPrank();
    }

    function test_UnknownIdReverts() public {
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.AgreementNotFound.selector, 42));
        pact.getAgreement(42);
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(PactEscrow.AgreementNotFound.selector, 0));
        pact.acceptAgreement(0);
    }

    function test_PlainTransferIsRejected() public {
        vm.prank(client);
        (bool ok,) = address(pact).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(pact).balance, 0);
    }

    function test_Reentrancy_OnCancelCannotDrainOtherAgreements() public {
        _create();

        ReentrantClient attacker = new ReentrantClient(pact);
        attacker.create{value: 5 ether}(provider, _deadline());

        attacker.cancel();

        assertTrue(attacker.reentrancyBlocked(), "la reentrada fue rechazada");
        assertEq(address(attacker).balance, 5 ether, "el atacante solo recupera lo suyo");
        assertEq(address(pact).balance, AMOUNT, "los fondos del otro acuerdo siguen intactos");
    }

    function test_Approve_RevertsWhenProviderRejectsPayment() public {
        RejectingProvider rejecting = new RejectingProvider(pact);
        vm.prank(client);
        uint256 id = pact.createAgreement{value: AMOUNT}(address(rejecting), DESCRIPTION, _deadline());
        rejecting.accept(id);
        rejecting.deliver(id);

        vm.prank(client);
        vm.expectRevert(PactEscrow.TransferFailed.selector);
        pact.approveAndRelease(id);

        assertEq(uint8(_status(id)), uint8(PactEscrow.Status.Delivered), "el estado no avanza si el pago falla");
        assertEq(address(pact).balance, AMOUNT);
    }

    function testFuzz_FullFlow_PaysExactAmount(uint96 amount) public {
        amount = uint96(bound(amount, 1, 1_000_000 ether));
        vm.deal(client, amount);
        uint256 providerBefore = provider.balance;

        vm.prank(client);
        uint256 id = pact.createAgreement{value: amount}(provider, DESCRIPTION, _deadline());
        vm.prank(provider);
        pact.acceptAgreement(id);
        vm.prank(provider);
        pact.registerDelivery(id, URL);
        vm.prank(client);
        pact.approveAndRelease(id);

        assertEq(provider.balance, providerBefore + amount);
        assertEq(address(pact).balance, 0);
    }

    function testFuzz_Cancel_RefundsExactAmount(uint96 amount) public {
        amount = uint96(bound(amount, 1, 1_000_000 ether));
        vm.deal(client, amount);

        vm.prank(client);
        uint256 id = pact.createAgreement{value: amount}(provider, DESCRIPTION, _deadline());
        vm.prank(client);
        pact.cancelAndRefund(id);

        assertEq(client.balance, amount);
        assertEq(address(pact).balance, 0);
    }
}
