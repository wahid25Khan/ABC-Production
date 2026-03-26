import { LightningElement } from "lwc";
import CERT0 from "@salesforce/resourceUrl/CertificationImage0";
import CERT1 from "@salesforce/resourceUrl/CertificationImage1";
import CERT2 from "@salesforce/resourceUrl/CertificationImage2";
import CERT3 from "@salesforce/resourceUrl/CertificationImage3";
import CERT4 from "@salesforce/resourceUrl/CertificationImage4";
import CERT5 from "@salesforce/resourceUrl/CertificationImage5";

export default class UpdatedComponent extends LightningElement {
  cert0 = CERT0;
  cert1 = CERT1;
  cert2 = CERT2;
  cert3 = CERT3;
  cert4 = CERT4;
  cert5 = CERT5;

  links = {
    vpat: "https://americanbookcompany.com/American-Book-Company-Accessibility-Conformance-Report.pdf",
    validationStudyPdf:
      "https://americanbookcompany.com/A-Validation-Study-of-ABC-Final.pdf",
    validationStudyDoc:
      "https://view.officeapps.live.com/op/view.aspx?src=https%3A%2F%2Famericanbookcompany.com%2FA-Validation-Study-of-ABC-Final.doc&wdOrigin=BROWSELINK",
    instructureReport:
      "https://americanbookcompany.com/ABC-ESSA-Level-IV-Report.pdf",
    certSecurity:
      "https://americanbookcompany.com/docs/Certificate-of-Security.pdf",
    securityAssessment:
      "https://americanbookcompany.com/docs/Security-Assessment-Public-Report.pdf"
  };
}
