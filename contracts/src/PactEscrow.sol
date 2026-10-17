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
        bytes32 rulesHash;
        string description;
        string evidenceUrl;
        string providerNote;
    }

    uint256 public constant MAX_DESCRIPTION_LENGTH = 500;
    uint256 public constant MAX_URL_LENGTH = 512;
    uint256 public constant MAX_NOTE_LENGTH = 500;

    address public immutable agent;
    uint256 public immutable maxAutoRelease;

    uint256 public agreementCount;

    mapping(uint256 id => Agreement) private _agreements;
    mapping(address client => uint256) public autoReleaseLimit;

    event AgreementCreated(
        uint256 indexed id,
        address indexed client,
        address indexed provider,
        uint256 amount,
        uint64 deadline,
        bytes32 rulesHash,
        string description
    );
    event AgreementAccepted(uint256 indexed id, address indexed provider);
    event DeliveryRegistered(uint256 indexed id, address indexed provider, string evidenceUrl, string note);
    event AgreementApproved(uint256 indexed id, address indexed provider, uint256 amount);
    event AgreementCancelled(uint256 indexed id, address indexed client, uint256 amount);
    event AutoReleaseLimitSet(address indexed client, uint256 limit);
    event AgentReleased(uint256 indexed id, bytes32 indexed decisionHash, uint256 amount);

    error InvalidAgent();
    error InvalidMaxAutoRelease();
    error NoValueSent();
    error InvalidProvider();
    error ProviderIsClient();
    error DeadlineNotInFuture();
    error EmptyDescription();
    error DescriptionTooLong();
    error RulesNotConfirmed();
    error EmptyUrl();
    error UrlTooLong();
    error NoteTooLong();
    error AgreementNotFound(uint256 id);
    error NotClient();
    error NotProvider();
    error NotAgent();
    error InvalidStatus(Status current);
    error LimitAboveCap(uint256 limit, uint256 cap);
    error AboveAutoReleaseLimit(uint256 amount, uint256 limit);
    error EmptyDecisionHash();
    error TransferFailed();

    modifier exists(uint256 id) {
        if (_agreements[id].status == Status.None) revert AgreementNotFound(id);
        _;
    }

    constructor(address agent_, uint256 maxAutoRelease_) {
        if (agent_ == address(0)) revert InvalidAgent();
        if (maxAutoRelease_ == 0) revert InvalidMaxAutoRelease();
        agent = agent_;
        maxAutoRelease = maxAutoRelease_;
    }

    function createAgreement(address provider, string calldata description, uint64 deadline, bytes32 rulesHash)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert NoValueSent();
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert ProviderIsClient();

        if (deadline <= block.timestamp) revert DeadlineNotInFuture();
        if (rulesHash == bytes32(0)) revert RulesNotConfirmed();

        uint256 descLength = bytes(description).length;
        if (descLength == 0) revert EmptyDescription();
        if (descLength > MAX_DESCRIPTION_LENGTH) revert DescriptionTooLong();

        id = ++agreementCount;
        Agreement storage a = _agreements[id];
        a.client = msg.sender;
        a.provider = provider;
        a.amount = msg.value;
        a.deadline = deadline;
        a.rulesHash = rulesHash;
        a.description = description;
        a.status = Status.Created;

        emit AgreementCreated(id, msg.sender, provider, msg.value, deadline, rulesHash, description);
    }

    function acceptAgreement(uint256 id) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.provider) revert NotProvider();
        if (a.status != Status.Created) revert InvalidStatus(a.status);

        a.status = Status.Accepted;
        emit AgreementAccepted(id, msg.sender);
    }

    function registerDelivery(uint256 id, string calldata evidenceUrl, string calldata note) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.provider) revert NotProvider();
        if (a.status != Status.Accepted) revert InvalidStatus(a.status);

        uint256 urlLength = bytes(evidenceUrl).length;
        if (urlLength == 0) revert EmptyUrl();
        if (urlLength > MAX_URL_LENGTH) revert UrlTooLong();
        if (bytes(note).length > MAX_NOTE_LENGTH) revert NoteTooLong();

        a.evidenceUrl = evidenceUrl;
        a.providerNote = note;
        a.status = Status.Delivered;
        emit DeliveryRegistered(id, msg.sender, evidenceUrl, note);
    }

    function approveAndRelease(uint256 id) external exists(id) {
        Agreement storage a = _agreements[id];
        if (msg.sender != a.client) revert NotClient();
        if (a.status != Status.Delivered) revert InvalidStatus(a.status);

        _release(id, a);
    }

    function setAutoReleaseLimit(uint256 limit) external {
        if (limit > maxAutoRelease) revert LimitAboveCap(limit, maxAutoRelease);

        autoReleaseLimit[msg.sender] = limit;
        emit AutoReleaseLimitSet(msg.sender, limit);
    }

    function releaseByAgent(uint256 id, bytes32 decisionHash) external exists(id) {
        if (msg.sender != agent) revert NotAgent();
        if (decisionHash == bytes32(0)) revert EmptyDecisionHash();

        Agreement storage a = _agreements[id];
        if (a.status != Status.Delivered) revert InvalidStatus(a.status);

        uint256 limit = autoReleaseLimit[a.client];
        if (limit == 0 || a.amount > limit) revert AboveAutoReleaseLimit(a.amount, limit);

        emit AgentReleased(id, decisionHash, a.amount);
        _release(id, a);
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

    function _release(uint256 id, Agreement storage a) private {
        a.status = Status.Approved;
        address provider = a.provider;
        uint256 amount = a.amount;
        emit AgreementApproved(id, provider, amount);

        _send(provider, amount);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
