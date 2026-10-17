pragma solidity ^0.8.28;

contract PactEscrow {
    enum Status {
        None,
        Created,
        Accepted,
        Delivered,
        Approved,
        Cancelled
    }

    struct Agreement {
        address client;
        uint64 deadline;
        Status status;
        address provider;
        uint256 amount;
        string description;
        string evidenceUrl;
    }

    uint256 public constant MAX_DESCRIPTION_LENGTH = 500;
    uint256 public constant MAX_URL_LENGTH = 512;

    uint256 public agreementCount;

    mapping(uint256 id => Agreement) private _agreements;

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

    error NoValueSent();
    error InvalidProvider();
    error ProviderIsClient();
    error DeadlineNotInFuture();
    error EmptyDescription();
    error DescriptionTooLong();
    error EmptyUrl();
    error UrlTooLong();
    error AgreementNotFound(uint256 id);
    error NotClient();
    error NotProvider();
    error InvalidStatus(Status current);
    error TransferFailed();

    modifier exists(uint256 id) {
        if (_agreements[id].status == Status.None) revert AgreementNotFound(id);
        _;
    }

    function createAgreement(address provider, string calldata description, uint64 deadline)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert NoValueSent();
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert ProviderIsClient();

        if (deadline <= block.timestamp) revert DeadlineNotInFuture();

        uint256 descLength = bytes(description).length;
        if (descLength == 0) revert EmptyDescription();
        if (descLength > MAX_DESCRIPTION_LENGTH) revert DescriptionTooLong();

        id = ++agreementCount;
        Agreement storage a = _agreements[id];
        a.client = msg.sender;
        a.provider = provider;
        a.amount = msg.value;
        a.deadline = deadline;
        a.description = description;
        a.status = Status.Created;

        emit AgreementCreated(id, msg.sender, provider, msg.value, deadline, description);
    }

    function acceptAgreement(uint256 id) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.provider) revert NotProvider();
        if (a.status != Status.Created) revert InvalidStatus(a.status);

        a.status = Status.Accepted;
        emit AgreementAccepted(id, msg.sender);
    }

    function registerDelivery(uint256 id, string calldata evidenceUrl) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.provider) revert NotProvider();
        if (a.status != Status.Accepted) revert InvalidStatus(a.status);

        uint256 urlLength = bytes(evidenceUrl).length;
        if (urlLength == 0) revert EmptyUrl();
        if (urlLength > MAX_URL_LENGTH) revert UrlTooLong();

        a.evidenceUrl = evidenceUrl;
        a.status = Status.Delivered;
        emit DeliveryRegistered(id, msg.sender, evidenceUrl);
    }

    function approveAndRelease(uint256 id) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Delivered) revert InvalidStatus(a.status);

        a.status = Status.Approved;
        address provider = a.provider;
        uint256 amount = a.amount;
        emit AgreementApproved(id, provider, amount);

        _send(provider, amount);
    }

    function cancelAndRefund(uint256 id) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Created && a.status != Status.Accepted) revert InvalidStatus(a.status);

        a.status = Status.Cancelled;
        uint256 amount = a.amount;
        emit AgreementCancelled(id, msg.sender, amount);

        _send(msg.sender, amount);
    }

    function getAgreement(uint256 id) external view exists(id) returns (Agreement memory) {
        return _agreements[id];
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
