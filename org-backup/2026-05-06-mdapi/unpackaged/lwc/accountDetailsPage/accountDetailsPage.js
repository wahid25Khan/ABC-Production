import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';
import getAccountDetails from '@salesforce/apex/AccountDetailsController.getAccountDetails';
import updateAboutYou from '@salesforce/apex/AccountDetailsController.updateAboutYou';
import updateOrganization from '@salesforce/apex/AccountDetailsController.updateOrganization';
import changePassword from '@salesforce/apex/AccountDetailsController.changePassword';
import updateShippingAddress from '@salesforce/apex/AccountDetailsController.updateShippingAddress';
import savePaymentMethod from '@salesforce/apex/AccountDetailsController.savePaymentMethod';
import CC_VISA from '@salesforce/resourceUrl/ccVisa';
import CC_MASTERCARD from '@salesforce/resourceUrl/ccMastercard';
import CC_AMEX from '@salesforce/resourceUrl/ccAmex';
import CC_DISCOVER from '@salesforce/resourceUrl/ccDiscover';

const LOGIN_URL = '/AmericanBookCompany/login';

const US_STATES = [
    { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' }
];

export default class AccountDetailsPage extends LightningElement {
    @api heroTitle = 'Account Details';
    @api heroDescription =
        'Manage your contact information, jump to key account tasks, and keep ordering details current for your school or district.';
    @api ordersUrl = '/AmericanBookCompany/my-orders';
    @api submitPoUrl = '/AmericanBookCompany/submit-a-po';
    @api wishlistUrl = '/AmericanBookCompany/native-mylists';

    details;
    aboutForm = { firstName: '', lastName: '', email: '', phone: '' };
    organizationForm = { schoolName: '', schoolAddress: '', city: '', stateCode: '', postalCode: '', phone: '' };
    passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
    shippingForm = { street: '', city: '', stateCode: '', postalCode: '', country: 'US' };
    paymentForm = {
        paymentType: 'cc',
        cardHolderName: '',
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cardCvv: '',
        billingUseShipping: true,
        billingStreet: '',
        billingCity: '',
        billingStateCode: '',
        billingZip: '',
        achAccountHolder: '',
        achRoutingNumber: '',
        achAccountNumber: '',
        achAccountNumberConfirm: '',
        achAccountType: '',
        saveAch: false,
        setDefaultAchPayment: false
    };

    isLoading = true;
    isSavingAbout = false;
    isSavingOrganization = false;
    isSavingPassword = false;
    isSavingShipping = false;
    isSavingPayment = false;
    isEditingAbout = false;
    showOrganizationModal = false;
    showShippingModal = false;
    activeSection = 'about-you';
    statusMessage = '';
    statusVariant = 'info';
    statusTimeout = null;

    connectedCallback() {
        if (isGuest) {
            this.redirectToLogin();
            return;
        }

        this.loadDetails();
    }

    get sectionTabs() {
        return [
            { id: 'about-you', label: 'About You' },
            { id: 'password-security', label: 'Password & Security' },
            { id: 'organization-details', label: 'Organization' },
            { id: 'shipping-address', label: 'Shipping' },
            { id: 'payment-methods', label: 'Payment' }
        ].map((tab) => ({
            ...tab,
            className: `section-tab${this.activeSection === tab.id ? ' active' : ''}`
        }));
    }

    get displayName() {
        return this.details?.fullName || 'Not added yet';
    }

    get displayEmail() {
        return this.details?.email || 'Not added yet';
    }

    get displayPhone() {
        return this.details?.phone || 'Not added yet';
    }

    get displayOrganization() {
        if (!this.details?.organizationName) {
            return 'No organization on file.';
        }
        const parts = [this.details.organizationName];
        const addressParts = [
            this.details.billingStreet,
            this.details.billingCity,
            this.details.billingState,
            this.details.billingPostalCode
        ].filter(Boolean);
        if (addressParts.length > 0) {
            parts.push(addressParts.join(', '));
        }
        if (this.details.organizationPhone) {
            parts.push(this.details.organizationPhone);
        }
        return parts.join(' • ');
    }

    get displayShippingAddress() {
        return this.details?.shippingAddress || 'No shipping address on file. Please enter a US shipping address.';
    }

    get displayPaymentSummary() {
        return this.details?.paymentSummary || 'No payment on file.';
    }

    get orgStateOptions() {
        const current = (this.organizationForm.stateCode || '').toUpperCase();
        return [
            { value: '', label: 'Select State', selected: current === '' },
            ...US_STATES.map((s) => ({ value: s.value, label: s.label, selected: s.value === current }))
        ];
    }

    get organizationButtonLabel() {
        return this.details?.hasOrganization ? 'Edit Organization' : 'Enter Organization';
    }

    get shippingButtonLabel() {
        return this.details?.hasShippingAddress ? 'Manage Shipping' : 'Enter Shipping';
    }

    get passwordRequirements() {
        const password = this.passwordForm.newPassword || '';
        return [
            { label: 'At least 8 characters', met: password.length >= 8 },
            { label: 'Contain lower case letters', met: /[a-z]/.test(password) },
            { label: 'At least one symbol (#@$%,etc)', met: /[^A-Za-z0-9]/.test(password) },
            { label: 'Contain upper case letters', met: /[A-Z]/.test(password) },
            { label: 'At least one number', met: /\d/.test(password) }
        ].map((requirement) => ({
            ...requirement,
            className: requirement.met ? 'met' : 'unmet'
        }));
    }

    get isPasswordSubmitDisabled() {
        return !this.canSubmitPassword || this.isSavingPassword;
    }

    get statusClass() {
        return `status-banner ${this.statusVariant}`;
    }

    get paymentMonthOptions() {
        return Array.from({ length: 12 }, (_, i) => {
            const value = String(i + 1);
            return { value, label: value, selected: value === this.paymentForm.expiryMonth };
        });
    }

    get achAccountTypeOptions() {
        const current = this.paymentForm.achAccountType || '';
        return [
            { value: '', label: 'Select', selected: current === '' },
            { value: 'checking', label: 'Checking Account', selected: current === 'checking' },
            { value: 'savings', label: 'Savings Account', selected: current === 'savings' },
            { value: 'other', label: 'Other', selected: current === 'other' }
        ];
    }

    get paymentYearOptions() {
        const startYear = new Date().getFullYear() - 1;
        return Array.from({ length: 20 }, (_, i) => {
            const value = String(startYear + i);
            return { value, label: value, selected: value === this.paymentForm.expiryYear };
        });
    }

    get isPaymentSubmitDisabled() {
        const f = this.paymentForm;
        if (f.paymentType === 'ach') {
            if (!f.achAccountHolder || !f.achRoutingNumber || !f.achAccountNumber || !f.achAccountNumberConfirm || !f.achAccountType) {
                return true;
            }
            if (f.achAccountNumber !== f.achAccountNumberConfirm) {
                return true;
            }
            return this.isSavingPayment;
        }

        if (!f.cardHolderName || !f.cardNumber || !f.expiryMonth || !f.expiryYear || !f.cardCvv) {
            return true;
        }
        if (!f.billingUseShipping || !this.paymentShippingAddressDisplay) {
            if (!f.billingStreet || !f.billingCity || !f.billingStateCode || !f.billingZip) {
                return true;
            }
        }
        return this.isSavingPayment;
    }

    get isCreditCard() {
        return this.paymentForm.paymentType === 'cc';
    }

    get isACH() {
        return this.paymentForm.paymentType === 'ach';
    }

    get visaIcon() {
        return CC_VISA;
    }

    get mastercardIcon() {
        return CC_MASTERCARD;
    }

    get amexIcon() {
        return CC_AMEX;
    }

    get discoverIcon() {
        return CC_DISCOVER;
    }

    get paymentShippingAddressDisplay() {
        const s = this.details;
        if (!s?.shippingStreet) return '';
        return `${s.shippingStreet}, ${s.shippingCity}, ${s.shippingState} ${s.shippingPostalCode}`;
    }

    get paymentBillingUseShippingChecked() {
        return this.paymentForm.billingUseShipping === true;
    }

    get paymentBillingUseDifferentChecked() {
        return this.paymentForm.billingUseShipping === false;
    }

    get showPaymentBillingForm() {
        return !this.paymentForm.billingUseShipping || !this.paymentShippingAddressDisplay;
    }

    get paymentBillingStates() {
        return US_STATES.map((st) => ({ ...st, selected: st.value === this.paymentForm.billingStateCode }));
    }

    get canSubmitPassword() {
        return (
            this.passwordForm.currentPassword &&
            this.passwordForm.newPassword &&
            this.passwordForm.confirmPassword &&
            this.passwordForm.newPassword === this.passwordForm.confirmPassword &&
            this.passwordRequirements.every((requirement) => requirement.met)
        );
    }

    async loadDetails() {
        this.isLoading = true;
        try {
            const result = await getAccountDetails();
            this.applyDetails(result);
            this.clearStatus();
        } catch {
            this.setStatus('Unable to load account details right now.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    applyDetails(result) {
        this.details = result;
        this.aboutForm = {
            firstName: result?.firstName || '',
            lastName: result?.lastName || '',
            email: result?.email || '',
            phone: result?.phone || ''
        };
        this.organizationForm = {
            schoolName: result?.organizationName || '',
            schoolAddress: result?.billingStreet || '',
            city: result?.billingCity || '',
            stateCode: result?.billingState || '',
            postalCode: result?.billingPostalCode || '',
            phone: result?.organizationPhone || ''
        };

        if (!this.paymentForm.cardHolderName) {
            this.paymentForm = {
                ...this.paymentForm,
                cardHolderName: result?.fullName || ''
            };
        }
    }

    handleTabClick(event) {
        const target = event.currentTarget.dataset.target;
        if (!target) {
            return;
        }

        this.activeSection = target;
        const section = this.template.querySelector(`[data-section="${target}"]`);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    handleEditAbout() {
        this.isEditingAbout = true;
        this.clearStatus();
    }

    handleCancelAbout() {
        this.isEditingAbout = false;
        this.aboutForm = {
            firstName: this.details?.firstName || '',
            lastName: this.details?.lastName || '',
            email: this.details?.email || '',
            phone: this.details?.phone || ''
        };
    }

    handleAboutInput(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }
        this.aboutForm = {
            ...this.aboutForm,
            [field]: event.target.value
        };
    }

    async handleSaveAbout() {
        this.isSavingAbout = true;
        try {
            const result = await updateAboutYou({ ...this.aboutForm });
            this.handleActionResult(result, () => {
                this.isEditingAbout = false;
            });
        } catch {
            this.setStatus('Unable to update your details right now.', 'error');
        } finally {
            this.isSavingAbout = false;
        }
    }

    openOrganizationModal() {
        this.organizationForm = {
            schoolName: this.details?.organizationName || '',
            schoolAddress: this.details?.billingStreet || '',
            city: this.details?.billingCity || '',
            stateCode: this.details?.billingState || '',
            postalCode: this.details?.billingPostalCode || '',
            phone: this.details?.organizationPhone || ''
        };
        this.showOrganizationModal = true;
        this.clearStatus();
    }

    closeOrganizationModal() {
        this.showOrganizationModal = false;
    }

    handleOrganizationInput(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }
        this.organizationForm = {
            ...this.organizationForm,
            [field]: event.target.value
        };
    }

    async handleSaveOrganization() {
        this.isSavingOrganization = true;
        try {
            const result = await updateOrganization({
                organizationName: this.organizationForm.schoolName,
                street: this.organizationForm.schoolAddress,
                city: this.organizationForm.city,
                stateCode: this.organizationForm.stateCode,
                postalCode: this.organizationForm.postalCode,
                phone: this.organizationForm.phone
            });
            this.handleActionResult(result, () => {
                this.showOrganizationModal = false;
            });
        } catch {
            this.setStatus('Unable to update organization details right now.', 'error');
        } finally {
            this.isSavingOrganization = false;
        }
    }

    handlePasswordInput(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }
        this.passwordForm = {
            ...this.passwordForm,
            [field]: event.target.value
        };
    }

    async handleSavePassword() {
        if (!this.canSubmitPassword) {
            return;
        }

        this.isSavingPassword = true;
        try {
            const result = await changePassword({
                currentPassword: this.passwordForm.currentPassword,
                newPassword: this.passwordForm.newPassword,
                confirmPassword: this.passwordForm.confirmPassword
            });
            this.handleActionResult(result, () => {
                this.passwordForm = {
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                };
            });
        } catch {
            this.setStatus('Unable to update your password right now.', 'error');
        } finally {
            this.isSavingPassword = false;
        }
    }

    openShippingModal() {
        this.shippingForm = {
            street: this.details?.shippingStreet || '',
            city: this.details?.shippingCity || '',
            stateCode: this.details?.shippingState || '',
            postalCode: this.details?.shippingPostalCode || '',
            country: this.details?.shippingCountry || 'US'
        };
        this.showShippingModal = true;
        this.clearStatus();
    }

    closeShippingModal() {
        this.showShippingModal = false;
    }

    handleShippingInput(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }
        this.shippingForm = {
            ...this.shippingForm,
            [field]: event.target.value
        };
    }

    async handleSaveShipping() {
        this.isSavingShipping = true;
        try {
            const result = await updateShippingAddress({ ...this.shippingForm });
            this.handleActionResult(result, () => {
                this.showShippingModal = false;
            });
        } catch {
            this.setStatus('Unable to update shipping address right now.', 'error');
        } finally {
            this.isSavingShipping = false;
        }
    }

    resetPaymentForm() {
        this.paymentForm = {
            paymentType: 'cc',
            cardHolderName: this.details?.fullName || '',
            cardNumber: '',
            expiryMonth: '',
            expiryYear: '',
            cardCvv: '',
            billingUseShipping: true,
            billingStreet: '',
            billingCity: '',
            billingStateCode: '',
            billingZip: '',
            achAccountHolder: '',
            achRoutingNumber: '',
            achAccountNumber: '',
            achAccountNumberConfirm: '',
            achAccountType: '',
            saveAch: false,
            setDefaultAchPayment: false
        };
    }

    handleResetPayment() {
        this.resetPaymentForm();
        this.clearStatus();
    }

    handlePaymentInput(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }

        let value = event.target.value;
        if (field === 'cardNumber') {
            value = this.formatCardNumber(value);
            event.target.value = value;
        }

        this.paymentForm = {
            ...this.paymentForm,
            [field]: value
        };
    }

    handlePaymentTypeChange(event) {
        this.paymentForm = {
            ...this.paymentForm,
            paymentType: event.target.value
        };
    }

    handlePaymentCheckboxChange(event) {
        const { field } = event.target.dataset;
        if (!field) {
            return;
        }
        this.paymentForm = {
            ...this.paymentForm,
            [field]: event.target.checked
        };
    }

    handlePaymentBillingRadioChange(event) {
        this.paymentForm = { ...this.paymentForm, billingUseShipping: event.target.value === 'true' };
    }

    formatCardNumber(value) {
        const digits = (value || '').replace(/\D/g, '').slice(0, 16);
        return digits.match(/.{1,4}/g)?.join(' ') ?? digits;
    }

    async handleSavePayment() {
        if (this.isPaymentSubmitDisabled) {
            return;
        }

        this.isSavingPayment = true;
        try {
            const f = this.paymentForm;

            if (f.paymentType === 'ach') {
                this.setStatus('ACH payment details captured successfully.', 'success');
                this.resetPaymentForm();
                return;
            }

            let billingStreet, billingCity, billingStateCode, billingZip;

            if (f.billingUseShipping && this.paymentShippingAddressDisplay) {
                billingStreet = this.details?.shippingStreet || '';
                billingCity = this.details?.shippingCity || '';
                billingStateCode = this.details?.shippingState || '';
                billingZip = this.details?.shippingPostalCode || '';
            } else {
                billingStreet = f.billingStreet;
                billingCity = f.billingCity;
                billingStateCode = f.billingStateCode;
                billingZip = f.billingZip;
            }

            const result = await savePaymentMethod({
                cardHolderName: f.cardHolderName,
                cardNumber: f.cardNumber,
                expiryMonth: f.expiryMonth,
                expiryYear: f.expiryYear,
                billingStreet,
                billingCity,
                billingStateCode,
                billingZip
            });
            this.handleActionResult(result, () => {
                this.resetPaymentForm();
            });
        } catch {
            this.setStatus('Unable to save this payment method right now.', 'error');
        } finally {
            this.isSavingPayment = false;
        }
    }

    stopModalPropagation(event) {
        event.stopPropagation();
    }

    handleActionResult(result, onSuccess) {
        if (!result?.success) {
            this.applyDetails(result?.details || this.details);
            this.setStatus(result?.message || 'Something went wrong.', 'error');
            return;
        }

        this.applyDetails(result.details);
        this.setStatus(result.message, 'success');
        onSuccess?.();
    }

    setStatus(message, variant) {
        // Clear any existing timeout
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        this.statusMessage = message;
        this.statusVariant = variant;

        // Auto-dismiss success messages after 3 seconds, errors after 5 seconds
        const dismissDelay = variant === 'success' ? 3000 : 5000;
        this.statusTimeout = setTimeout(() => {
            this.clearStatus();
        }, dismissDelay);
    }

    clearStatus() {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        this.statusMessage = '';
        this.statusVariant = 'info';
    }

    redirectToLogin() {
        const currentPath = `${globalThis.location?.pathname || '/AmericanBookCompany/myprofile'}${globalThis.location?.search || ''}${globalThis.location?.hash || ''}`;
        const redirectUrl = `${LOGIN_URL}?startURL=${encodeURIComponent(currentPath)}`;
        globalThis.location.replace(redirectUrl);
    }
}