import { LightningElement, api } from "lwc";

export default class WhatsNewAtAbc extends LightningElement {
  @api imageUrl = "";
  @api articleTitle = "Build a Lifelong Love of Reading Over Summer Break";
  @api articleText =
    "With Summer break hurtling closer, kids everywhere are looking ahead to sunny summer vacation days, and schools are publishing summer reading lists. These are the years when children start to become lifelong readers - and educators and parents can help that process!";

  get resolvedImageUrl() {
    return this.imageUrl || "";
  }

  get hasImage() {
    return !!this.resolvedImageUrl;
  }
}
