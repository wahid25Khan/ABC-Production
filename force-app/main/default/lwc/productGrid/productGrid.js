import { LightningElement } from "lwc";

export default class ProductGrid extends LightningElement {
  isOpen = false;

  handleLookInside() {
    globalThis.window.open("https://coursewave.com/login", "_blank", "noopener");
  }

  openModal() {
    this.isOpen = true;

    // Focus trap-ish: focus the modal container after render
    globalThis.requestAnimationFrame(() => {
      const modal = this.template.querySelector('section[role="dialog"]');
      if (modal) modal.focus();
    });
  }

  closeModal() {
    this.isOpen = false;
  }
}