@SuppressWarnings(
  'PMD.ApexCRUDViolation,PMD.ApexDoc,PMD.CyclomaticComplexity,PMD.CognitiveComplexity'
)
public without sharing class BuyerSelfRegistrationService {
  private static final String SHOPPER_PROFILE_NAME = 'American Book Company Shopper Profile';
  private static final String DEFAULT_BUYER_GROUP_NAME = 'American Book Company Buyer Group';
  private static final String DEFAULT_REDIRECT_URL = '/myprofile';
  private static final String DEFAULT_EMAIL_ENCODING = 'UTF-8';
  private static final String DEFAULT_LOCALE = 'en_US';
  private static final String DEFAULT_TIMEZONE = 'America/Chicago';
  private static final String USER_EXISTS_MESSAGE = 'An account with this email already exists. Please sign in or reset your password.';
  private static final String GENERIC_ERROR_MESSAGE = 'We could not create your account right now. Please try again or contact us at (888) 264-5877.';
  private static final Pattern EMAIL_PATTERN = Pattern.compile(
    '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  );
  private static final Pattern PASSWORD_PATTERN = Pattern.compile(
    '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$'
  );

  @TestVisible
  private static Id profileIdOverride;
  @TestVisible
  private static Id accountOwnerIdOverride;
  @TestVisible
  private static ExternalUserOutcome externalUserOutcomeOverride;
  @TestVisible
  private static String externalUserErrorOverride;
  @TestVisible
  private static ExternalUserGateway externalUserGateway = new SiteExternalUserGateway();
  @TestVisible
  private static BuyerAccessGateway buyerAccessGateway = new CommerceBuyerAccessGateway();

  @SuppressWarnings('PMD')
  public class RegistrationRequest {
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public String lastName;
    @AuraEnabled
    public String email;
    @AuraEnabled
    public String confirmEmail;
    @AuraEnabled
    public String organizationName;
    @AuraEnabled
    public String password;
    @AuraEnabled
    public String confirmPassword;
    @AuraEnabled
    public Boolean marketingConsent;
  }

  @SuppressWarnings('PMD')
  public class RegistrationResponse {
    @AuraEnabled
    public Boolean success;
    @AuraEnabled
    public String message;
    @AuraEnabled
    public String redirectUrl;
    @AuraEnabled
    public String userId;
    @AuraEnabled
    public String accountId;
  }

  public class ExternalUserOutcome {
    public String userId;
    public Id accountId;
    public Id contactId;
  }

  public interface ExternalUserGateway {
    ExternalUserOutcome createExternalUser(
      RegistrationRequest req,
      Account account,
      Id profileId
    );
  }

  public interface BuyerAccessGateway {
    void ensureBuyerAccess(Id buyerId, String buyerGroupName);
  }

  private without sharing class SiteExternalUserGateway implements ExternalUserGateway {
    public ExternalUserOutcome createExternalUser(
      RegistrationRequest req,
      Account account,
      Id profileId
    ) {
      User userToCreate = buildExternalUser(req, profileId);

      if (Test.isRunningTest()) {
        if (String.isNotBlank(externalUserErrorOverride)) {
          throwAura(externalUserErrorOverride);
        }
        if (externalUserOutcomeOverride != null) {
          return normalizeExternalUserOutcome(
            externalUserOutcomeOverride,
            account
          );
        }
      }

      try {
        String userId = Site.createExternalUser(
          userToCreate,
          account.Id,
          req.password,
          false
        );
        if (String.isBlank(userId)) {
          throwAura(GENERIC_ERROR_MESSAGE);
        }

        User createdUser = [
          SELECT Id, ContactId, Contact.AccountId
          FROM User
          WHERE Id = :userId
          LIMIT 1
        ];

        ExternalUserOutcome outcome = new ExternalUserOutcome();
        outcome.userId = createdUser.Id;
        outcome.contactId = createdUser.ContactId;
        outcome.accountId = createdUser.ContactId != null
          ? createdUser.Contact.AccountId
          : account.Id;
        return outcome;
      } catch (Site.ExternalUserCreateException ex) {
        throwAura(extractExternalUserMessage(ex));
        return null;
      }
    }
  }

  private without sharing class CommerceBuyerAccessGateway implements BuyerAccessGateway {
    public void ensureBuyerAccess(Id buyerId, String buyerGroupName) {
      CommerceRegistrationProvisioning.ensureBuyerAccess(
        buyerId,
        buyerGroupName,
        'Buyer setup is incomplete. Please contact support.'
      );
    }
  }

  @AuraEnabled
  public static RegistrationResponse registerBuyerFromJson(String reqJson) {
    if (String.isBlank(reqJson)) {
      throwAura('Missing registration request.');
    }
    RegistrationRequest req = (RegistrationRequest) JSON.deserialize(
      reqJson,
      RegistrationRequest.class
    );
    return registerBuyer(req);
  }

  @AuraEnabled
  public static RegistrationResponse registerBuyer(RegistrationRequest req) {
    RegistrationResponse response = new RegistrationResponse();
    Savepoint registrationSavepoint = Database.setSavepoint();

    try {
      validateRequest(req);
      blockExistingUser(normalizeEmail(req.email));

      Account account = createBuyerAccount(req);
      ExternalUserOutcome outcome = externalUserGateway.createExternalUser(
        req,
        account,
        resolveShopperProfileId()
      );

      if (outcome == null || String.isBlank(outcome.userId)) {
        throwAura(GENERIC_ERROR_MESSAGE);
      }

      if (outcome.contactId != null) {
        update new Contact(
          Id = outcome.contactId,
          HasOptedOutOfEmail = !(req.marketingConsent == true)
        );
      }

      buyerAccessGateway.ensureBuyerAccess(
        outcome.accountId != null ? outcome.accountId : account.Id,
        DEFAULT_BUYER_GROUP_NAME
      );

      CommerceRegistrationProvisioning.ensureB2BBuyerEntitlementsAsync(
        outcome.userId
      );

      response.success = true;
      response.userId = outcome.userId;
      response.accountId = String.valueOf(
        outcome.accountId != null ? outcome.accountId : account.Id
      );
      response.redirectUrl = DEFAULT_REDIRECT_URL;
      response.message = 'Account created successfully.';
    } catch (AuraHandledException ex) {
      Database.rollback(registrationSavepoint);
      response.success = false;
      response.message = ex.getMessage();
    } catch (Exception ex) {
      Database.rollback(registrationSavepoint);
      response.success = false;
      response.message = GENERIC_ERROR_MESSAGE;
    }

    return response;
  }

  private static void validateRequest(RegistrationRequest req) {
    if (req == null) {
      throwAura('Missing registration request.');
    }
    if (String.isBlank(req.firstName)) {
      throwAura('Please enter your first name.');
    }
    if (String.isBlank(req.lastName)) {
      throwAura('Please enter your last name.');
    }
    if (String.isBlank(req.email)) {
      throwAura('Please enter your email address.');
    }
    if (!EMAIL_PATTERN.matcher(normalizeEmail(req.email)).matches()) {
      throwAura('Please enter a valid email address.');
    }
    if (String.isBlank(req.confirmEmail)) {
      throwAura('Please confirm your email address.');
    }
    if (normalizeEmail(req.email) != normalizeEmail(req.confirmEmail)) {
      throwAura('Email and Confirm Email must match.');
    }
    if (String.isBlank(req.organizationName)) {
      throwAura('Please enter your organization name.');
    }
    if (String.isBlank(req.password)) {
      throwAura('Please enter a password.');
    }
    if (!PASSWORD_PATTERN.matcher(req.password).matches()) {
      throwAura('Please use a password that meets all listed requirements.');
    }
    if (String.isBlank(req.confirmPassword)) {
      throwAura('Please confirm your password.');
    }
    if (req.password != req.confirmPassword) {
      throwAura('Password and Confirm Password must match.');
    }
  }

  private static void blockExistingUser(String normalizedEmail) {
    List<User> existingUsers = [
      SELECT Id
      FROM User
      WHERE Username = :normalizedEmail OR Email = :normalizedEmail
      LIMIT 1
    ];

    if (!existingUsers.isEmpty()) {
      throwAura(USER_EXISTS_MESSAGE);
    }
  }

  private static Account createBuyerAccount(RegistrationRequest req) {
    Account account = new Account();
    account.Name = safeTrim(req.organizationName);
    account.OwnerId = resolveAccountOwnerId();
    insert account;
    CommerceRegistrationProvisioning.ensureBuyerAccount(account);
    return account;
  }

  @TestVisible
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
    if (profiles.isEmpty()) {
      throwAura('Shopper profile is not configured for self-registration.');
    }
    return profiles[0].Id;
  }

  @TestVisible
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
    if (internalOwners.isEmpty()) {
      throwAura(
        'No internal account owner with a role is configured for shopper registration.'
      );
    }
    return internalOwners[0].Id;
  }

  @TestVisible
  private static Id resolveBuyerGroupId(String buyerGroupName) {
    if (String.isBlank(buyerGroupName)) {
      return null;
    }

    List<BuyerGroup> buyerGroups = [
      SELECT Id
      FROM BuyerGroup
      WHERE Name = :buyerGroupName
      LIMIT 1
    ];
    return buyerGroups.isEmpty() ? null : buyerGroups[0].Id;
  }

  @TestVisible
  private static Boolean hasExistingBuyerMembership(
    Id buyerId,
    Id buyerGroupId
  ) {
    if (buyerId == null || buyerGroupId == null) {
      return false;
    }

    return [
        SELECT COUNT()
        FROM BuyerGroupMember
        WHERE BuyerId = :buyerId AND BuyerGroupId = :buyerGroupId
      ] > 0;
  }

  private static String normalizeEmail(String value) {
    return safeTrim(value).toLowerCase();
  }

  private static User buildExternalUser(RegistrationRequest req, Id profileId) {
    User userToCreate = new User();
    userToCreate.Username = normalizeEmail(req.email);
    userToCreate.Email = normalizeEmail(req.email);
    userToCreate.FirstName = safeTrim(req.firstName);
    userToCreate.LastName = safeTrim(req.lastName);
    userToCreate.ProfileId = profileId;
    userToCreate.Alias = buildAlias(req.firstName, req.lastName);
    userToCreate.CommunityNickname = buildCommunityNickname(
      req.firstName,
      req.lastName,
      req.email
    );
    userToCreate.LocaleSidKey = resolveLocaleSidKey();
    userToCreate.LanguageLocaleKey = resolveLanguageLocaleKey();
    userToCreate.TimeZoneSidKey = resolveTimeZoneSidKey();
    userToCreate.EmailEncodingKey = DEFAULT_EMAIL_ENCODING;
    return userToCreate;
  }

  private static ExternalUserOutcome normalizeExternalUserOutcome(
    ExternalUserOutcome outcome,
    Account account
  ) {
    ExternalUserOutcome normalizedOutcome = new ExternalUserOutcome();
    normalizedOutcome.userId = outcome.userId;
    normalizedOutcome.contactId = outcome.contactId;
    normalizedOutcome.accountId = outcome.accountId != null
      ? outcome.accountId
      : account.Id;
    return normalizedOutcome;
  }

  private static String safeTrim(String value) {
    return value == null ? '' : value.trim();
  }

  private static String buildAlias(String firstName, String lastName) {
    String seed = (safeTrim(firstName) + safeTrim(lastName))
      .replaceAll('[^A-Za-z0-9]', '');
    if (String.isBlank(seed)) {
      seed = 'abcshop';
    }
    return seed.left(Math.min(8, seed.length()));
  }

  private static String buildCommunityNickname(
    String firstName,
    String lastName,
    String email
  ) {
    String seed = (safeTrim(firstName) + safeTrim(lastName))
      .replaceAll('[^A-Za-z0-9]', '')
      .toLowerCase();
    if (String.isBlank(seed)) {
      seed = normalizeEmail(email).replaceAll('[^A-Za-z0-9]', '');
    }
    if (String.isBlank(seed)) {
      seed = 'abcbuyer';
    }

    String suffix = String.valueOf(Math.abs(Crypto.getRandomInteger()));
    String base = seed.left(Math.min(32, seed.length()));
    String nickname = (base + suffix).left(40);
    return nickname;
  }

  private static String resolveLocaleSidKey() {
    String locale = UserInfo.getLocale();
    return String.isNotBlank(locale) ? locale : DEFAULT_LOCALE;
  }

  private static String resolveLanguageLocaleKey() {
    String languageLocale = UserInfo.getLanguage();
    return String.isNotBlank(languageLocale) ? languageLocale : DEFAULT_LOCALE;
  }

  private static String resolveTimeZoneSidKey() {
    TimeZone timeZone = UserInfo.getTimeZone();
    String timeZoneId = timeZone != null ? timeZone.getID() : null;
    return String.isNotBlank(timeZoneId) ? timeZoneId : DEFAULT_TIMEZONE;
  }

  private static String extractExternalUserMessage(
    Site.ExternalUserCreateException ex
  ) {
    List<String> messages = ex.getDisplayMessages();
    if (messages != null && !messages.isEmpty()) {
      return String.join(messages, ' ');
    }
    return GENERIC_ERROR_MESSAGE;
  }

  private static void throwAura(String message) {
    AuraHandledException ex = new AuraHandledException(message);
    ex.setMessage(message);
    throw ex;
  }

  @TestVisible
  private static void resetTestState() {
    profileIdOverride = null;
    accountOwnerIdOverride = null;
    externalUserOutcomeOverride = null;
    externalUserErrorOverride = null;
    CommerceRegistrationProvisioning.resetTestState();
    externalUserGateway = new SiteExternalUserGateway();
    buyerAccessGateway = new CommerceBuyerAccessGateway();
  }
}