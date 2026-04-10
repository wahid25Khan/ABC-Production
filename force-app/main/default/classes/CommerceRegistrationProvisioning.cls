@SuppressWarnings('PMD.ApexCRUDViolation,PMD.ApexDoc')
public without sharing class CommerceRegistrationProvisioning {
  private static final String B2B_BUYER_PERMISSION_SET_NAME = 'B2BBuyer';
  private static final String B2B_BUYER_PERMISSION_SET_LICENSE_LABEL = 'B2B Buyer Permission Sets License Seats';

  @TestVisible
  private static Id buyerGroupIdOverride;
  @TestVisible
  private static Boolean buyerMembershipExistsOverride = false;
  @TestVisible
  private static Id permissionSetIdOverride;
  @TestVisible
  private static Id permissionSetLicenseIdOverride;
  @TestVisible
  private static Boolean permissionSetAssignmentExistsOverride = false;
  @TestVisible
  private static Boolean permissionSetLicenseAssignmentExistsOverride = false;
  @TestVisible
  private static Id lastAssignedBuyerId;
  @TestVisible
  private static Id lastAssignedBuyerGroupId;
  @TestVisible
  private static Id lastPermissionSetAssignedUserId;
  @TestVisible
  private static Id lastAssignedPermissionSetId;
  @TestVisible
  private static Id lastPermissionSetLicenseAssignedUserId;
  @TestVisible
  private static Id lastAssignedPermissionSetLicenseId;

  public static void ensureBuyerAccount(Id accountId) {
    if (accountId == null) {
      return;
    }

    List<Account> accounts = [
      SELECT Id, Name, OwnerId
      FROM Account
      WHERE Id = :accountId
      LIMIT 1
    ];
    if (accounts.isEmpty()) {
      return;
    }

    ensureBuyerAccount(accounts[0]);
  }

  public static void ensureBuyerAccount(Account account) {
    if (account == null || account.Id == null) {
      return;
    }

    List<BuyerAccount> buyerAccounts = [
      SELECT Id, BuyerStatus, IsActive, CommerceType
      FROM BuyerAccount
      WHERE BuyerId = :account.Id
      LIMIT 1
    ];

    if (buyerAccounts.isEmpty()) {
      insert new BuyerAccount(
        Name = account.Name,
        BuyerId = account.Id,
        OwnerId = account.OwnerId,
        BuyerStatus = 'Active',
        CommerceType = 'Buyer',
        IsActive = true
      );
      return;
    }

    BuyerAccount existingBuyerAccount = buyerAccounts[0];
    if (
      existingBuyerAccount.IsActive == true &&
      existingBuyerAccount.BuyerStatus == 'Active' &&
      existingBuyerAccount.CommerceType == 'Buyer'
    ) {
      return;
    }

    update new BuyerAccount(
      Id = existingBuyerAccount.Id,
      BuyerStatus = 'Active',
      CommerceType = 'Buyer',
      IsActive = true
    );
  }

  public static void ensureBuyerAccess(
    Id buyerId,
    String buyerGroupName,
    String missingBuyerGroupMessage
  ) {
    if (buyerId == null) {
      return;
    }

    Id buyerGroupId = resolveBuyerGroupId(
      buyerGroupName,
      missingBuyerGroupMessage
    );
    if (
      buyerGroupId == null || hasExistingBuyerMembership(buyerId, buyerGroupId)
    ) {
      return;
    }

    createBuyerMembership(buyerId, buyerGroupId);
  }

  public static void ensureB2BBuyerEntitlements(String userId) {
    if (String.isBlank(userId)) {
      return;
    }

    ensureB2BBuyerEntitlements((Id) userId);
  }

  @future
  public static void ensureB2BBuyerEntitlementsAsync(String userId) {
    if (String.isBlank(userId)) {
      return;
    }

    ensureB2BBuyerEntitlements((Id) userId);
  }

  public static void ensureB2BBuyerEntitlements(Id userId) {
    if (userId == null) {
      return;
    }

    Id permissionSetLicenseId = resolveB2BBuyerPermissionSetLicenseId();
    if (!hasPermissionSetLicenseAssignment(userId, permissionSetLicenseId)) {
      createPermissionSetLicenseAssignment(userId, permissionSetLicenseId);
    }

    Id permissionSetId = resolveB2BBuyerPermissionSetId();
    if (!hasPermissionSetAssignment(userId, permissionSetId)) {
      createPermissionSetAssignment(userId, permissionSetId);
    }
  }

  private static Id resolveBuyerGroupId(
    String buyerGroupName,
    String missingBuyerGroupMessage
  ) {
    if (Test.isRunningTest() && buyerGroupIdOverride != null) {
      return buyerGroupIdOverride;
    }

    List<BuyerGroup> buyerGroups = [
      SELECT Id
      FROM BuyerGroup
      WHERE Name = :buyerGroupName
      LIMIT 1
    ];
    if (!buyerGroups.isEmpty()) {
      return buyerGroups[0].Id;
    }

    if (String.isNotBlank(missingBuyerGroupMessage)) {
      throwAura(missingBuyerGroupMessage);
    }
    return null;
  }

  private static Boolean hasExistingBuyerMembership(
    Id buyerId,
    Id buyerGroupId
  ) {
    if (buyerId == null || buyerGroupId == null) {
      return false;
    }

    if (Test.isRunningTest() && buyerGroupIdOverride != null) {
      return buyerMembershipExistsOverride == true;
    }

    return [
        SELECT COUNT()
        FROM BuyerGroupMember
        WHERE BuyerId = :buyerId AND BuyerGroupId = :buyerGroupId
      ] > 0;
  }

  private static void createBuyerMembership(Id buyerId, Id buyerGroupId) {
    if (buyerId == null || buyerGroupId == null) {
      return;
    }

    if (Test.isRunningTest() && buyerGroupIdOverride != null) {
      lastAssignedBuyerId = buyerId;
      lastAssignedBuyerGroupId = buyerGroupId;
      return;
    }

    insert new BuyerGroupMember(BuyerId = buyerId, BuyerGroupId = buyerGroupId);
  }

  private static Id resolveB2BBuyerPermissionSetId() {
    if (Test.isRunningTest() && permissionSetIdOverride != null) {
      return permissionSetIdOverride;
    }

    List<PermissionSet> permissionSets = [
      SELECT Id
      FROM PermissionSet
      WHERE Name = :B2B_BUYER_PERMISSION_SET_NAME
      LIMIT 1
    ];
    return permissionSets.isEmpty() ? null : permissionSets[0].Id;
  }

  private static Id resolveB2BBuyerPermissionSetLicenseId() {
    if (Test.isRunningTest() && permissionSetLicenseIdOverride != null) {
      return permissionSetLicenseIdOverride;
    }

    List<PermissionSetLicense> permissionSetLicenses = [
      SELECT Id
      FROM PermissionSetLicense
      WHERE MasterLabel = :B2B_BUYER_PERMISSION_SET_LICENSE_LABEL
      LIMIT 1
    ];
    return permissionSetLicenses.isEmpty() ? null : permissionSetLicenses[0].Id;
  }

  private static Boolean hasPermissionSetAssignment(
    Id userId,
    Id permissionSetId
  ) {
    if (userId == null || permissionSetId == null) {
      return false;
    }

    if (Test.isRunningTest() && permissionSetIdOverride != null) {
      return permissionSetAssignmentExistsOverride == true;
    }

    return [
        SELECT COUNT()
        FROM PermissionSetAssignment
        WHERE AssigneeId = :userId AND PermissionSetId = :permissionSetId
      ] > 0;
  }

  private static Boolean hasPermissionSetLicenseAssignment(
    Id userId,
    Id permissionSetLicenseId
  ) {
    if (userId == null || permissionSetLicenseId == null) {
      return false;
    }

    if (Test.isRunningTest() && permissionSetLicenseIdOverride != null) {
      return permissionSetLicenseAssignmentExistsOverride == true;
    }

    return [
        SELECT COUNT()
        FROM PermissionSetLicenseAssign
        WHERE
          AssigneeId = :userId
          AND PermissionSetLicenseId = :permissionSetLicenseId
      ] > 0;
  }

  private static void createPermissionSetAssignment(
    Id userId,
    Id permissionSetId
  ) {
    if (userId == null || permissionSetId == null) {
      return;
    }

    if (Test.isRunningTest() && permissionSetIdOverride != null) {
      lastPermissionSetAssignedUserId = userId;
      lastAssignedPermissionSetId = permissionSetId;
      return;
    }

    insert new PermissionSetAssignment(
      AssigneeId = userId,
      PermissionSetId = permissionSetId
    );
  }

  private static void createPermissionSetLicenseAssignment(
    Id userId,
    Id permissionSetLicenseId
  ) {
    if (userId == null || permissionSetLicenseId == null) {
      return;
    }

    if (Test.isRunningTest() && permissionSetLicenseIdOverride != null) {
      lastPermissionSetLicenseAssignedUserId = userId;
      lastAssignedPermissionSetLicenseId = permissionSetLicenseId;
      return;
    }

    insert new PermissionSetLicenseAssign(
      AssigneeId = userId,
      PermissionSetLicenseId = permissionSetLicenseId
    );
  }

  private static void throwAura(String message) {
    AuraHandledException ex = new AuraHandledException(message);
    ex.setMessage(message);
    throw ex;
  }

  public static void resetTestState() {
    buyerGroupIdOverride = null;
    buyerMembershipExistsOverride = false;
    permissionSetIdOverride = null;
    permissionSetLicenseIdOverride = null;
    permissionSetAssignmentExistsOverride = false;
    permissionSetLicenseAssignmentExistsOverride = false;
    lastAssignedBuyerId = null;
    lastAssignedBuyerGroupId = null;
    lastPermissionSetAssignedUserId = null;
    lastAssignedPermissionSetId = null;
    lastPermissionSetLicenseAssignedUserId = null;
    lastAssignedPermissionSetLicenseId = null;
  }
}
