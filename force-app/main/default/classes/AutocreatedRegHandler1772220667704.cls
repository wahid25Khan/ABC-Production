@SuppressWarnings(
  'PMD.ApexCRUDViolation,PMD.ApexDoc,PMD.CyclomaticComplexity,PMD.CognitiveComplexity,PMD.AvoidGlobalModifier'
)
global without sharing class AutocreatedRegHandler1772220667704 implements Auth.RegistrationHandler {
  private static final String SHOPPER_PROFILE_NAME = 'American Book Company Shopper Profile';
  private static final String DEFAULT_BUYER_GROUP_NAME = 'American Book Company Buyer Group';
  private static final String EXISTING_INTERNAL_USER_EMAIL_MESSAGE = 'An internal user already exists with this email address. Sign in with that account or use a different Google or Microsoft account.';
  private static final String DEFAULT_EMAIL_ENCODING = 'UTF-8';
  private static final String DEFAULT_LOCALE = 'en_US';
  private static final String DEFAULT_TIMEZONE = 'America/Chicago';
  private static final Set<String> CONSUMER_EMAIL_DOMAINS = new Set<String>{
    'gmail.com',
    'googlemail.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'outlook.com'
  };
  private static final Integer USERNAME_MAX_LENGTH = 80;

  @TestVisible
  private static Id profileIdOverride;
  @TestVisible
  private static Id accountOwnerIdOverride;
  @TestVisible
  private static User existingUserOverride;
  @TestVisible
  private static String externalUserErrorOverride;
  @TestVisible
  private static Id createdExternalUserIdOverride;

  global Boolean canCreateUser(Auth.UserData data) {
    if (!hasRequiredIdentity(data)) {
      return false;
    }

    User existingUser = findUserByEmail(normalizeEmail(data.email));
    return existingUser == null || existingUser.ContactId != null;
  }

  global User createUser(Id portalId, Auth.UserData data) {
    if (!hasRequiredIdentity(data)) {
      return null;
    }

    String normalizedEmail = normalizeEmail(data.email);
    User existingUser = findUserByEmail(normalizedEmail);
    if (existingUser != null && existingUser.ContactId == null) {
      throw newHandledException(EXISTING_INTERNAL_USER_EMAIL_MESSAGE);
    }

    Savepoint registrationSavepoint = Database.setSavepoint();
    try {
      if (existingUser != null) {
        Id existingBuyerId = resolveExistingBuyerId(existingUser);
        ensureBuyerAccount(existingBuyerId);
        if (existingBuyerId != null) {
          ensureBuyerAccess(existingBuyerId, DEFAULT_BUYER_GROUP_NAME);
        }
        enqueueB2BBuyerEntitlements(existingUser.Id);
        assignCommerceBuyerGroup(existingUser.Id);
        return existingUser;
      }

      Account account = createBuyerAccount(data);
      User createdUser = createExternalCommunityUser(
        account.Id,
        data,
        normalizedEmail
      );
      if (createdUser == null) {
        return null;
      }

      Id buyerId = resolveExistingBuyerId(createdUser);
      ensureBuyerAccess(
        buyerId != null ? buyerId : account.Id,
        DEFAULT_BUYER_GROUP_NAME
      );
      enqueueB2BBuyerEntitlements(createdUser.Id);
      assignCommerceBuyerGroup(createdUser.Id);
      return createdUser;
    } catch (Exception ex) {
      Database.rollback(registrationSavepoint);
      throw ex;
    }
  }

  global void updateUser(Id userId, Id portalId, Auth.UserData data) {
    if (userId == null || !hasRequiredIdentity(data)) {
      return;
    }

    update new User(
      Id = userId,
      Email = normalizeEmail(data.email),
      FirstName = deriveFirstName(data),
      LastName = deriveLastName(data)
    );
  }

  private static Boolean hasRequiredIdentity(Auth.UserData data) {
    return data != null && String.isNotBlank(normalizeEmail(data.email));
  }

  private static User findUserByEmail(String normalizedEmail) {
    if (String.isBlank(normalizedEmail)) {
      return null;
    }

    if (Test.isRunningTest() && existingUserOverride != null) {
      return normalizeEmail(existingUserOverride.Email) == normalizedEmail
        ? existingUserOverride
        : null;
    }

    List<User> users = [
      SELECT Id, ContactId, Contact.AccountId, IsActive
      FROM User
      WHERE Username = :normalizedEmail OR Email = :normalizedEmail
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];

    return users.isEmpty() || users[0].IsActive != true ? null : users[0];
  }

  private static Id resolveExistingBuyerId(User existingUser) {
    if (existingUser == null || existingUser.ContactId == null) {
      return null;
    }

    if (existingUser.Contact != null) {
      return existingUser.Contact.AccountId;
    }

    List<Contact> contacts = [
      SELECT AccountId
      FROM Contact
      WHERE Id = :existingUser.ContactId
      LIMIT 1
    ];
    return contacts.isEmpty() ? null : contacts[0].AccountId;
  }

  private static Account createBuyerAccount(Auth.UserData data) {
    Account account = new Account(
      Name = deriveOrganizationName(data),
      OwnerId = resolveAccountOwnerId()
    );
    insert account;
    CommerceRegistrationProvisioning.ensureBuyerAccount(account);
    return account;
  }

  private static void ensureBuyerAccount(Id accountId) {
    CommerceRegistrationProvisioning.ensureBuyerAccount(accountId);
  }

  private static void ensureBuyerAccount(Account account) {
    CommerceRegistrationProvisioning.ensureBuyerAccount(account);
  }

  private static User createExternalCommunityUser(
    Id accountId,
    Auth.UserData data,
    String normalizedEmail
  ) {
    if (String.isNotBlank(externalUserErrorOverride)) {
      throw newHandledException(externalUserErrorOverride);
    }

    if (Test.isRunningTest()) {
      Contact contact = createBuyerContact(accountId, data, normalizedEmail);
      User userToCreate = buildCommunityUser(data, normalizedEmail);
      userToCreate.ContactId = contact.Id;
      userToCreate.Id = createdExternalUserIdOverride;
      return userToCreate;
    }

    try {
      String userId = Site.createExternalUser(
        buildCommunityUser(data, normalizedEmail),
        accountId,
        null
      );
      if (String.isBlank(userId)) {
        return null;
      }

      User createdUser = [
        SELECT
          Id,
          ContactId,
          Contact.AccountId,
          Email,
          FirstName,
          LastName,
          ProfileId,
          Username
        FROM User
        WHERE Id = :userId
        LIMIT 1
      ];

      if (createdUser.ContactId != null) {
        update new Contact(
          Id = createdUser.ContactId,
          HasOptedOutOfEmail = true
        );
      }

      return createdUser;
    } catch (Site.ExternalUserCreateException ex) {
      throw newHandledException(extractExternalUserMessage(ex));
    }
  }

  private static AuraHandledException newHandledException(String message) {
    AuraHandledException handledException = new AuraHandledException(message);
    handledException.setMessage(message);
    return handledException;
  }

  private static Contact createBuyerContact(
    Id accountId,
    Auth.UserData data,
    String normalizedEmail
  ) {
    Contact contact = new Contact(
      AccountId = accountId,
      Email = normalizedEmail,
      FirstName = deriveFirstName(data),
      LastName = deriveLastName(data),
      HasOptedOutOfEmail = true
    );
    insert contact;
    return contact;
  }

  private static User buildCommunityUser(
    Auth.UserData data,
    String normalizedEmail
  ) {
    User newUser = new User();
    newUser.Username = buildExternalUsername(normalizedEmail);
    newUser.Email = normalizedEmail;
    newUser.FirstName = deriveFirstName(data);
    newUser.LastName = deriveLastName(data);
    newUser.Alias = buildAlias(data);
    newUser.CommunityNickname = buildCommunityNickname(data, normalizedEmail);
    newUser.LocaleSidKey = resolveLocaleSidKey();
    newUser.LanguageLocaleKey = resolveLanguageLocaleKey();
    newUser.TimeZoneSidKey = resolveTimeZoneSidKey();
    newUser.EmailEncodingKey = DEFAULT_EMAIL_ENCODING;
    newUser.ProfileId = resolveShopperProfileId();
    return newUser;
  }

  private static void ensureBuyerAccess(Id buyerId, String buyerGroupName) {
    CommerceRegistrationProvisioning.ensureBuyerAccess(
      buyerId,
      buyerGroupName,
      null
    );
  }

  private static void ensureB2BBuyerEntitlements(Id userId) {
    CommerceRegistrationProvisioning.ensureB2BBuyerEntitlements(userId);
  }

  private static void enqueueB2BBuyerEntitlements(Id userId) {
    if (userId == null) {
      return;
    }

    if (Test.isRunningTest()) {
      ensureB2BBuyerEntitlements(userId);
      return;
    }

    ensureB2BBuyerEntitlementsAsync(String.valueOf(userId));
  }

  @future
  private static void ensureB2BBuyerEntitlementsAsync(String userId) {
    if (String.isBlank(userId)) {
      return;
    }

    CommerceRegistrationProvisioning.ensureB2BBuyerEntitlements((Id) userId);
  }

  private static Id resolveShopperProfileId() {
    if (profileIdOverride != null) {
      return profileIdOverride;
    }

    List<Profile> profiles = [
      SELECT Id
      FROM Profile
      WHERE Name = :SHOPPER_PROFILE_NAME
      LIMIT 1
    ];
    return profiles.isEmpty() ? null : profiles[0].Id;
  }

  private static Id resolveAccountOwnerId() {
    if (accountOwnerIdOverride != null) {
      return accountOwnerIdOverride;
    }

    List<User> internalOwners = [
      SELECT Id
      FROM User
      WHERE IsActive = TRUE AND UserType = 'Standard' AND UserRoleId != NULL
      ORDER BY LastLoginDate DESC NULLS LAST
      LIMIT 1
    ];
    return internalOwners.isEmpty() ? null : internalOwners[0].Id;
  }

  private static String deriveFirstName(Auth.UserData data) {
    String firstName = safeTrim(data != null ? data.firstName : null);
    if (String.isNotBlank(firstName)) {
      return firstName;
    }

    String fullName = safeTrim(data != null ? data.fullName : null);
    if (String.isNotBlank(fullName) && fullName.contains(' ')) {
      return fullName.substringBefore(' ');
    }

    String emailLocalPart = deriveEmailLocalPart(data);
    if (String.isNotBlank(emailLocalPart)) {
      return emailLocalPart.left(40);
    }

    return 'ABC';
  }

  private static String deriveLastName(Auth.UserData data) {
    String lastName = safeTrim(data != null ? data.lastName : null);
    if (String.isNotBlank(lastName)) {
      return lastName;
    }

    String fullName = safeTrim(data != null ? data.fullName : null);
    if (String.isNotBlank(fullName) && fullName.contains(' ')) {
      return fullName.substringAfterLast(' ');
    }

    return 'Shopper';
  }

  private static String deriveOrganizationName(Auth.UserData data) {
    String hostedDomain = safeTrim(getAttribute(data, 'hd'));
    if (
      String.isNotBlank(hostedDomain) && !isConsumerEmailDomain(hostedDomain)
    ) {
      return hostedDomain;
    }

    String emailDomain = deriveEmailDomain(data);
    if (String.isNotBlank(emailDomain) && !isConsumerEmailDomain(emailDomain)) {
      return emailDomain;
    }

    String fullName = safeTrim(data != null ? data.fullName : null);
    if (String.isNotBlank(fullName)) {
      return fullName + ' Buyer Account';
    }

    return deriveLastName(data) + ' Buyer Account';
  }

  private static String buildAlias(Auth.UserData data) {
    String seed = (deriveFirstName(data) + deriveLastName(data))
      .replaceAll('[^A-Za-z0-9]', '');
    if (String.isBlank(seed)) {
      seed = 'abcshop';
    }
    return seed.left(Math.min(8, seed.length()));
  }

  private static String buildCommunityNickname(
    Auth.UserData data,
    String normalizedEmail
  ) {
    String seed = (deriveFirstName(data) + deriveLastName(data))
      .replaceAll('[^A-Za-z0-9]', '')
      .toLowerCase();
    if (String.isBlank(seed)) {
      seed = normalizedEmail.replaceAll('[^A-Za-z0-9]', '');
    }
    if (String.isBlank(seed)) {
      seed = 'abcbuyer';
    }

    String suffix = String.valueOf(Math.abs(Crypto.getRandomInteger()));
    return (seed.left(Math.min(30, seed.length())) + suffix).left(40);
  }

  private static String buildExternalUsername(String normalizedEmail) {
    if (String.isBlank(normalizedEmail) || !normalizedEmail.contains('@')) {
      return normalizedEmail;
    }

    String localPart = normalizedEmail.substringBefore('@');
    String domainPart = normalizedEmail.substringAfter('@');
    String orgKey = safeTrim(UserInfo.getOrganizationId()).toLowerCase();
    String suffix =
      '+abcshop-' +
      (String.isNotBlank(orgKey) ? orgKey.left(15) : 'storefront');
    Integer maxLocalLength = Math.max(
      1,
      USERNAME_MAX_LENGTH - domainPart.length() - suffix.length() - 1
    );

    if (localPart.length() > maxLocalLength) {
      localPart = localPart.left(maxLocalLength);
    }

    return localPart + suffix + '@' + domainPart;
  }

  private static String deriveEmailDomain(Auth.UserData data) {
    String normalizedEmail = normalizeEmail(data != null ? data.email : null);
    if (String.isBlank(normalizedEmail) || !normalizedEmail.contains('@')) {
      return '';
    }

    return normalizedEmail.substringAfter('@');
  }

  private static String deriveEmailLocalPart(Auth.UserData data) {
    String normalizedEmail = normalizeEmail(data != null ? data.email : null);
    if (String.isBlank(normalizedEmail) || !normalizedEmail.contains('@')) {
      return '';
    }

    String localPart = normalizedEmail.substringBefore('@')
      .replaceAll('[^A-Za-z0-9]', '');
    return localPart;
  }

  private static Boolean isConsumerEmailDomain(String domain) {
    String normalizedDomain = safeTrim(domain).toLowerCase();
    return String.isNotBlank(normalizedDomain) &&
      CONSUMER_EMAIL_DOMAINS.contains(normalizedDomain);
  }

  private static String resolveLocaleSidKey() {
    String locale = UserInfo.getLocale();
    return String.isNotBlank(locale) ? locale : DEFAULT_LOCALE;
  }

  private static String resolveLanguageLocaleKey() {
    String language = UserInfo.getLanguage();
    return String.isNotBlank(language) ? language : DEFAULT_LOCALE;
  }

  private static String resolveTimeZoneSidKey() {
    TimeZone timeZone = UserInfo.getTimeZone();
    String timeZoneId = timeZone != null ? timeZone.getID() : null;
    return String.isNotBlank(timeZoneId) ? timeZoneId : DEFAULT_TIMEZONE;
  }

  private static String normalizeEmail(String value) {
    return safeTrim(value).toLowerCase();
  }

  private static String safeTrim(String value) {
    return value == null ? '' : value.trim();
  }

  private static String getAttribute(Auth.UserData data, String key) {
    if (data == null || data.attributeMap == null || String.isBlank(key)) {
      return null;
    }
    return data.attributeMap.get(key);
  }

  private static String extractExternalUserMessage(
    Site.ExternalUserCreateException ex
  ) {
    List<String> messages = ex.getDisplayMessages();
    if (messages != null && !messages.isEmpty()) {
      return String.join(messages, ' ');
    }
    return ex.getMessage();
  }

  @TestVisible
  private static void resetTestState() {
    profileIdOverride = null;
    accountOwnerIdOverride = null;
    existingUserOverride = null;
    externalUserErrorOverride = null;
    createdExternalUserIdOverride = null;
    CommerceRegistrationProvisioning.resetTestState();
  }

  private static void assignCommerceBuyerGroup(Id userId) {
    if (userId == null) {
      return;
    }
    try {
      List<PermissionSetGroup> psgs = [
        SELECT Id
        FROM PermissionSetGroup
        WHERE DeveloperName = 'Commerce_Buyer'
        LIMIT 1
      ];
      if (psgs.isEmpty()) {
        return;
      }
      Id psgId = psgs[0].Id;
      Integer existing = [
        SELECT COUNT()
        FROM PermissionSetAssignment
        WHERE AssigneeId = :userId AND PermissionSetGroupId = :psgId
      ];
      if (existing == 0) {
        insert new PermissionSetAssignment(
          AssigneeId = userId,
          PermissionSetGroupId = psgId
        );
      }
    } catch (Exception e) {
      // Non-fatal: log and continue; buyer entitlements are
      // also set asynchronously via enqueueB2BBuyerEntitlements
      System.debug(
        LoggingLevel.WARN,
        'assignCommerceBuyerGroup failed: ' + e.getMessage()
      );
    }
  }
}
