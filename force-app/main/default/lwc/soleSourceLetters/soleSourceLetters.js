import { LightningElement } from 'lwc';
import PDF_ICON_URL from '@salesforce/resourceUrl/pdf_icon'; 
import DOC_ICON_URL from '@salesforce/resourceUrl/doc_icon';

export default class SoleSourceLetters extends LightningElement {
    pdfIcon = PDF_ICON_URL; 
    docIcon = DOC_ICON_URL;

    stateLetters = [
        { id: 1, name: 'All', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/all.state.source.letter.021726.pdf' },
        { id: 2, name: 'Alabama', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/al.source.letter.021726.pdf' },
        { id: 3, name: 'Arkansas', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/ar.source.letter.103125.pdf' },
        { id: 4, name: 'Georgia', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/ga.source.letter.103125.pdf' },
        { id: 5, name: 'Kentucky', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/ky.source.letter.110325.pdf' },
        { id: 6, name: 'Louisiana', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/la.source.letter.110325.pdf' },
        { id: 7, name: 'Minnesota', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/mn.source.letter.110425.pdf' },
        { id: 8, name: 'North Carolina', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/nc.source.letter.102125.pdf' },
        { id: 9, name: 'New Mexico', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/nm.source.letter.110425.pdf' },
        { id: 10, name: 'Oklahoma', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/ok.source.letter.110425.pdf' },
        { id: 11, name: 'South Carolina', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/sc.source.letter.102825v2.pdf' },
        { id: 12, name: 'Tennessee', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/tn.source.letter.110425.pdf' },
        { id: 13, name: 'Virginia', url: 'https://cms-assets.americanbookcompany.com/sole_source_letters/va.source.letter.123125.pdf' }
    ];
}