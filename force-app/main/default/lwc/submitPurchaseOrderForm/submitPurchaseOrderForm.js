import { LightningElement } from "lwc";
import uploadPurchaseOrderFile from "@salesforce/apex/SubmitPurchaseOrderController.uploadPurchaseOrderFile";
import submitPurchaseOrder from "@salesforce/apex/SubmitPurchaseOrderController.submitPurchaseOrder";

export default class SubmitPurchaseOrderForm extends LightningElement {
  isLoading = false;
  isSubmitted = false;
  errorMessage = "";
  personalErrorMessage = "";
  fileError = "";
  fileName = "";
  selectedFile = null;
  personalCollapsed = false;

  form = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    street: "",
    street2: "",
    city: "",
    state: "",
    zipCode: "",
    poNumber: "",
    notes: "",
    referralInfo: "",
    comments: ""
  };

  stateOptions = [
    { label: "Alabama", value: "AL" },
    { label: "Alaska", value: "AK" },
    { label: "Arizona", value: "AZ" },
    { label: "Arkansas", value: "AR" },
    { label: "California", value: "CA" },
    { label: "Colorado", value: "CO" },
    { label: "Connecticut", value: "CT" },
    { label: "Delaware", value: "DE" },
    { label: "Florida", value: "FL" },
    { label: "Georgia", value: "GA" },
    { label: "Hawaii", value: "HI" },
    { label: "Idaho", value: "ID" },
    { label: "Illinois", value: "IL" },
    { label: "Indiana", value: "IN" },
    { label: "Iowa", value: "IA" },
    { label: "Kansas", value: "KS" },
    { label: "Kentucky", value: "KY" },
    { label: "Louisiana", value: "LA" },
    { label: "Maine", value: "ME" },
    { label: "Maryland", value: "MD" },
    { label: "Massachusetts", value: "MA" },
    { label: "Michigan", value: "MI" },
    { label: "Minnesota", value: "MN" },
    { label: "Mississippi", value: "MS" },
    { label: "Missouri", value: "MO" },
    { label: "Montana", value: "MT" },
    { label: "Nebraska", value: "NE" },
    { label: "Nevada", value: "NV" },
    { label: "New Hampshire", value: "NH" },
    { label: "New Jersey", value: "NJ" },
    { label: "New Mexico", value: "NM" },
    { label: "New York", value: "NY" },
    { label: "North Carolina", value: "NC" },
    { label: "North Dakota", value: "ND" },
    { label: "Ohio", value: "OH" },
    { label: "Oklahoma", value: "OK" },
    { label: "Oregon", value: "OR" },
    { label: "Pennsylvania", value: "PA" },
    { label: "Rhode Island", value: "RI" },
    { label: "South Carolina", value: "SC" },
    { label: "South Dakota", value: "SD" },
    { label: "Tennessee", value: "TN" },
    { label: "Texas", value: "TX" },
    { label: "Utah", value: "UT" },
    { label: "Vermont", value: "VT" },
    { label: "Virginia", value: "VA" },
    { label: "Washington", value: "WA" },
    { label: "West Virginia", value: "WV" },
    { label: "Wisconsin", value: "WI" },
    { label: "Wyoming", value: "WY" }
  ];

  get submitButtonLabel() {
    return this.isLoading ? "Submitting..." : "Submit PO";
  }

  get fullName() {
    return `${this.form.firstName || ""} ${this.form.lastName || ""}`.trim();
  }

  get formattedAddress() {
    const city = this.form.city || "";
    const state = this.form.state || "";
    const zip = this.form.zipCode || "";
    return `${city}${city ? ", " : ""}${state} ${zip}`.trim();
  }

  get personalSectionValid() {
    return Boolean(
      this.form.firstName &&
      this.form.lastName &&
      this.form.email &&
      this.form.phone
    );
  }

  handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    this.form = {
      ...this.form,
      [fieldName]: fieldValue
    };

    this.errorMessage = "";

    if (
      ["firstName", "lastName", "email", "phone"].includes(fieldName) &&
      this.personalSectionValid
    ) {
      this.personalErrorMessage = "";
    }

    if (
      event.target.classList.contains("input-error") &&
      fieldValue &&
      fieldValue.trim()
    ) {
      event.target.classList.remove("input-error");
    }
  }

  handlePersonalClose() {
    if (this.personalSectionValid) {
      this.personalCollapsed = true;
      this.personalErrorMessage = "";
    } else {
      this.personalCollapsed = false;
      this.personalErrorMessage =
        "Please complete personal details before closing that section.";
    }
  }

  handlePersonalEdit() {
    this.personalCollapsed = false;
    this.personalErrorMessage = "";
  }

  handleFileChange(event) {
    this.fileError = "";
    this.errorMessage = "";

    const file = event.target.files && event.target.files[0];
    if (!file) {
      this.selectedFile = null;
      this.fileName = "";
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isPdf) {
      this.selectedFile = null;
      this.fileName = "";
      this.fileError = "Only PDF files are allowed.";
      return;
    }

    this.selectedFile = file;
    this.fileName = file.name;
  }

  validateForm() {
    let isValid = true;
    const fields = this.template.querySelectorAll(".field-input");

    fields.forEach((field) => {
      if (field.dataset.required === "true") {
        const value = field.value ? field.value.trim() : "";
        if (!value) {
          field.classList.add("input-error");
          isValid = false;
        } else {
          field.classList.remove("input-error");
        }
      }
    });

    return isValid;
  }

  async handleSubmit() {
    this.errorMessage = "";
    this.fileError = "";

    if (!this.validateForm()) {
      this.errorMessage = "Please complete all required fields.";
      return;
    }

    if (!this.selectedFile) {
      this.fileError = "Please upload a PDF file.";
      return;
    }

    this.isLoading = true;

    try {
      const base64Data = await this.readFileAsBase64(this.selectedFile);

      const uploadResponse = await uploadPurchaseOrderFile({
        fileName: this.selectedFile.name,
        base64Data,
        contentType: this.selectedFile.type
      });

      if (!uploadResponse || !uploadResponse.success) {
        throw new Error(uploadResponse?.message || "File upload failed.");
      }

      const req = {
        firstName: this.form.firstName,
        lastName: this.form.lastName,
        email: this.form.email,
        phone: this.form.phone,
        organizationName: this.form.organizationName,
        street: this.form.street,
        city: this.form.city,
        state: this.form.state,
        zipCode: this.form.zipCode,
        poNumber: this.form.poNumber,
        notes: this.form.notes,
        referralInfo: this.form.referralInfo,
        comments: this.form.comments,
        uploadedContentDocumentId: uploadResponse.contentDocumentId
      };

      const submitResponse = await submitPurchaseOrder({
        reqJson: JSON.stringify(req)
      });

      if (!submitResponse || !submitResponse.success) {
        throw new Error(submitResponse?.message || "Submission failed.");
      }

      this.isSubmitted = true;
    } catch (error) {
      this.errorMessage = this.normalizeError(error);
    } finally {
      this.isLoading = false;
    }
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result || "";
        const base64Marker = "base64,";
        const base64Index = result.indexOf(base64Marker);

        if (base64Index === -1) {
          reject(new Error("Unable to process file."));
          return;
        }

        resolve(result.substring(base64Index + base64Marker.length));
      };

      reader.onerror = () => {
        reject(new Error("Unable to read file."));
      };

      reader.readAsDataURL(file);
    });
  }

  normalizeError(error) {
    if (error?.body?.message) {
      return error.body.message;
    }
    if (error?.message) {
      return error.message;
    }
    return "Something went wrong. Please try again.";
  }
}
