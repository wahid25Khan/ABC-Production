import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';
import getAccountDetails from '@salesforce/apex/AccountDetailsController.getAccountDetails';
import updateAboutYou from '@salesforce/apex/AccountDetailsController.updateAboutYou';
import updateOrganization from '@salesforce/apex/AccountDetailsController.updateOrganization';
import changePassword from '@salesforce/apex/AccountDetailsController.changePassword';
import updateShippingAddress from '@salesforce/apex/AccountDetailsController.updateShippingAddress';

const LOGIN_URL = '/AmericanBookCompany/login';
const PAYMENT_METHOD_URL = '/AmericanBookCompany/add-payment-methods';

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

    isLoading = true;
    isSavingAbout = false;
    isSavingOrganization = false;
    isSavingPassword = false;
    isSavingShipping = false;
    isEditingAbout = false;
    showOrganizationModal = false;
    showShippingModal = false;
    showPaymentModal = false;
    activeSection = 'about-you';
    statusMessage = '';
    statusVariant = 'info';

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

    get paymentMethodsUrl() {
        return PAYMENT_METHOD_URL;
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

    openPaymentModal() {
        this.showPaymentModal = true;
    }

    closePaymentModal() {
        this.showPaymentModal = false;
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
        this.statusMessage = message;
        this.statusVariant = variant;
    }

    clearStatus() {
        this.statusMessage = '';
        this.statusVariant = 'info';
    }

    redirectToLogin() {
        const currentPath = `${globalThis.location?.pathname || '/AmericanBookCompany/myprofile'}${globalThis.location?.search || ''}${globalThis.location?.hash || ''}`;
        const redirectUrl = `${LOGIN_URL}?startURL=${encodeURIComponent(currentPath)}`;
        globalThis.location.replace(redirectUrl);
    }
}