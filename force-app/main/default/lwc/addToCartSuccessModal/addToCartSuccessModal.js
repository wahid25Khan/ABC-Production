import { LightningElement, api } from 'lwc';

export default class AddToCartSuccessModal extends LightningElement {
  @api productName = '';
  @api productImageUrl = '';
  @api productUrl = '';
  @api cartUrl = '';

  get hasProductUrl() {
    return Boolean(String(this.productUrl || '').trim());
  }

  get hasProductImage() {
    return Boolean(String(this.productImageUrl || '').trim());
  }

  get resolvedProductName() {
    return String(this.productName || 'Product').trim();
  }

  handleCloseClick() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleOkClick() {
    this.dispatchEvent(new CustomEvent('close'));
  }
}