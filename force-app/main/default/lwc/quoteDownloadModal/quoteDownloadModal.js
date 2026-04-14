import { api } from 'lwc';
import LightningModal from 'lightning/modal';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function createDefaultQuoteForm() {
    return {
        contactName: '',
        organization: '',
        address: '',
        city: '',
        stateCode: '',
        postalCode: '',
        phone: '',
        email: '',
        taxExempt: false
    };
}

export default class QuoteDownloadModal extends LightningModal {
    @api formData;
    @api states;

    quoteForm = createDefaultQuoteForm();
    errorMessage = '';

    connectedCallback() {
        this.quoteForm = {
            ...createDefaultQuoteForm(),
            ...(this.formData || {})
        };
    }

    get stateOptions() {
        const stateList = Array.isArray(this.states) ? this.states : [];
        return stateList.map((state) => ({
            label: state.label,
            value: state.value,
            selected: state.value === this.quoteForm.stateCode
        }));
    }

    handleFieldChange(event) {
        const { name, type } = event.target;
        const value = type === 'checkbox' ? event.target.checked : event.target.value;

        this.quoteForm = {
            ...this.quoteForm,
            [name]: value
        };

        this.errorMessage = '';
        event.target.classList.remove('input-error');
    }

    clearFieldErrors() {
        this.template.querySelectorAll('.quote-field').forEach((field) => {
            field.classList.remove('input-error');
        });
    }

    markFieldInvalid(fieldName) {
        const field = this.template.querySelector(`[data-field="${fieldName}"]`);
        field?.classList.add('input-error');
        field?.focus();
    }

    validateFields() {
        this.clearFieldErrors();

        const validations = [
            ['contactName', 'Contact Name is required.'],
            ['organization', 'Organization is required.'],
            ['address', 'Address is required.'],
            ['city', 'City is required.'],
            ['stateCode', 'State is required.'],
            ['postalCode', 'ZIP Code is required.'],
            ['phone', 'Phone is required.'],
            ['email', 'Email is required.']
        ];

        for (const [fieldName, message] of validations) {
            if (!normalizeText(this.quoteForm[fieldName])) {
                this.markFieldInvalid(fieldName);
                this.errorMessage = message;
                return false;
            }
        }

        if (!EMAIL_PATTERN.test(normalizeText(this.quoteForm.email))) {
            this.markFieldInvalid('email');
            this.errorMessage = 'Please enter a valid email address.';
            return false;
        }

        return true;
    }

    handleDownload() {
        if (!this.validateFields()) {
            return;
        }

        this.close({
            action: 'download',
            form: {
                contactName: normalizeText(this.quoteForm.contactName),
                organization: normalizeText(this.quoteForm.organization),
                address: normalizeText(this.quoteForm.address),
                city: normalizeText(this.quoteForm.city),
                stateCode: normalizeText(this.quoteForm.stateCode),
                postalCode: normalizeText(this.quoteForm.postalCode),
                phone: normalizeText(this.quoteForm.phone),
                email: normalizeText(this.quoteForm.email),
                taxExempt: this.quoteForm.taxExempt === true
            }
        });
    }

    handleCancel() {
        this.close({ action: 'cancel' });
    }
}