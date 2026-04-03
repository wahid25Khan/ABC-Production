import { LightningElement, api, track } from 'lwc';
import isGuest from '@salesforce/user/isGuest';
import getAccountDetails from '@salesforce/apex/AccountDetailsController.getAccountDetails';
import updateAboutYou from '@salesforce/apex/AccountDetailsController.updateAboutYou';
import updateOrganization from '@salesforce/apex/AccountDetailsController.updateOrganization';
import changePassword from '@salesforce/apex/AccountDetailsController.changePassword';

const ADDRESS_FORM_URL = '/AmericanBookCompany/addressForm';
const LOGIN_URL = '/AmericanBookCompany/login';
const PAYMENT_METHOD_URL = '/AmericanBookCompany/add-payment-methods';

export default class AccountDetailsPage extends LightningElement {
    @api heroTitle = 'Account Details';
    @api heroDescription =
        'Manage your contact information, jump to key account tasks, and keep ordering details current for your school or district.';
    @api ordersUrl = '/AmericanBookCompany/my-orders';
    @api submitPoUrl = '/AmericanBookCompany/submit-a-po';
    @api wishlistUrl = 'https://americanbookcompany.com/account/my-wishlist';

    @track details;
    @track aboutForm = { firstName: '', lastName: '', email: '', phone: '' };
    @track organizationForm = { organizationName: '' };
    @track passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

    isLoading = true;
    isSavingAbout = false;
    isSavingOrganization = false;
    isSavingPassword = false;
    isEditingAbout = false;
    isEditingOrganization = false;
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
        return this.details?.organizationName || 'No organization on file.';
    }

    get displayShippingAddress() {
        return this.details?.shippingAddress || 'No shipping address on file. Please enter a US shipping address.';
    }

    get displayPaymentSummary() {
        return this.details?.paymentSummary || 'No payment on file.';
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
        } catch (error) {
            this.setStatus('Unable to load account details right now.', 'error');
            console.error('Failed to load account details.', error);
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
            organizationName: result?.organizationName || ''
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
        } catch (error) {
            this.setStatus('Unable to update your details right now.', 'error');
            console.error('Failed to update account details.', error);
        } finally {
            this.isSavingAbout = false;
        }
    }

    handleEditOrganization() {
        this.isEditingOrganization = true;
        this.clearStatus();
    }

    handleOrganizationInput(event) {
        this.organizationForm = {
            organizationName: event.target.value
        };
    }

    handleCancelOrganization() {
        this.isEditingOrganization = false;
        this.organizationForm = {
            organizationName: this.details?.organizationName || ''
        };
    }

    async handleSaveOrganization() {
        this.isSavingOrganization = true;
        try {
            const result = await updateOrganization({
                organizationName: this.organizationForm.organizationName
            });
            this.handleActionResult(result, () => {
                this.isEditingOrganization = false;
            });
        } catch (error) {
            this.setStatus('Unable to update organization details right now.', 'error');
            console.error('Failed to update organization.', error);
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
        } catch (error) {
            this.setStatus('Unable to update your password right now.', 'error');
            console.error('Failed to update password.', error);
        } finally {
            this.isSavingPassword = false;
        }
    }

    handleManageShipping() {
        globalThis.location.assign(ADDRESS_FORM_URL);
    }

    handleManagePayment() {
        globalThis.location.assign(PAYMENT_METHOD_URL);
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
