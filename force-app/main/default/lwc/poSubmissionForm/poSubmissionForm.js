import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import isGuest from '@salesforce/user/isGuest';
import submitPurchaseOrder from '@salesforce/apex/POSubmissionController.submitPurchaseOrder';

export default class PoSubmissionForm extends NavigationMixin(LightningElement) {
    @api cartUrl = '/cart';

    // Form fields
    poNumber = '';
    schoolDistrict = '';
    contactName = '';
    contactEmail = '';
    contactPhone = '';
    notes = '';

    // State
    isSubmitting = false;
    isSubmitted = false;
    errorMessage = '';
    caseId = '';
    caseNumber = '';
    filesUploaded = false;

    get isGuestUser() {
        return isGuest;
    }

    get acceptedFormats() {
        return ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
    }

    get isSubmitDisabled() {
        return this.isSubmitting || !this.poNumber || !this.schoolDistrict || !this.contactName || !this.contactEmail;
    }

    /* ---- Field handlers ---- */

    handlePONumberChange(e) { this.poNumber = e.target.value; this.errorMessage = ''; }
    handleSchoolChange(e) { this.schoolDistrict = e.target.value; this.errorMessage = ''; }
    handleNameChange(e) { this.contactName = e.target.value; this.errorMessage = ''; }
    handleEmailChange(e) { this.contactEmail = e.target.value; this.errorMessage = ''; }
    handlePhoneChange(e) { this.contactPhone = e.target.value; }
    handleNotesChange(e) { this.notes = e.target.value; }

    /* ---- Submit ---- */

    async handleSubmit() {
        if (this.isSubmitting) return;

        // Client-side validation
        if (!this.poNumber.trim()) { this.errorMessage = 'PO Number is required.'; return; }
        if (!this.schoolDistrict.trim()) { this.errorMessage = 'School / District Name is required.'; return; }
        if (!this.contactName.trim()) { this.errorMessage = 'Contact Name is required.'; return; }
        if (!this.contactEmail.trim()) { this.errorMessage = 'Contact Email is required.'; return; }

        this.isSubmitting = true;
        this.errorMessage = '';

        try {
            const req = {
                poNumber: this.poNumber.trim(),
                schoolDistrict: this.schoolDistrict.trim(),
                contactName: this.contactName.trim(),
                contactEmail: this.contactEmail.trim(),
                contactPhone: this.contactPhone.trim(),
                notes: this.notes.trim()
            };

            const result = await submitPurchaseOrder({ req });

            if (!result?.success) {
                throw new Error(result?.message || 'Submission failed.');
            }

            this.caseId = result.caseId;
            this.caseNumber = result.caseNumber;
            this.isSubmitted = true;
        } catch (error) {
            this.errorMessage =
                error?.body?.message || error?.message || 'Unable to submit purchase order. Please try again.';
        } finally {
            this.isSubmitting = false;
        }
    }

    /* ---- File upload ---- */

    handleUploadFinished() {
        this.filesUploaded = true;
    }

    /* ---- Navigation ---- */

    handleBackToCart() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: this.cartUrl }
        });
    }
}