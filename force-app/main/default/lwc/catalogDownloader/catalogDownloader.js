import { LightningElement, track } from 'lwc';

export default class CatalogDownloader extends LightningElement {
    @track selectedStateData;

    catalogData = [
        { value: 'al', label: 'Alabama', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/al-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/al-catalog-spring-022426v1-web.pdf?c=0.5998403046006126' },
        { value: 'ak', label: 'Alaska', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.7364957458521558' },
        { value: 'az', label: 'Arizona', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.6898616770926933' },
        { value: 'ar', label: 'Arkansas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ar-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ar-catalog-spring-022426v1-web.pdf?c=0.7247807695649944' },
        { value: 'ca', label: 'California', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ca-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ca-catalog-spring-022426v1-web.pdf?c=0.3418982241430105' },
        { value: 'co', label: 'Colorado', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.4236720313636201' },
        { value: 'ct', label: 'Connecticut', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.22100809100921126' },
        { value: 'de', label: 'Delaware', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.41162814193644603' },
        { value: 'dc', label: 'District of Columbia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/dc-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/dc-catalog-spring-022426v1-web.pdf?c=0.44428780158410885' },
        { value: 'fl', label: 'Florida', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.4416041705418646' },
        { value: 'ga', label: 'Georgia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ga-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ga-catalog-spring-022426v1-web.pdf?c=0.407029199737277' },
        { value: 'hi', label: 'Hawaii', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.5619220975563334' },
        { value: 'id', label: 'Idaho', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.6176075033749059' },
        { value: 'il', label: 'Illinois', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/il-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/il-catalog-spring-022426v1-web.pdf?c=0.13972970974199272' },
        { value: 'in', label: 'Indiana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/in-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/in-catalog-spring-022426v1-web.pdf?c=0.4824901864236265' },
        { value: 'ia', label: 'Iowa', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.48772106871724197' },
        { value: 'ks', label: 'Kansas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.6806120639109735' },
        { value: 'ky', label: 'Kentucky', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ky-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ky-catalog-spring-022426v1-web.pdf?c=0.7185157308843018' },
        { value: 'la', label: 'Louisiana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/la-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/la-catalog-spring-022426v1-web.pdf?c=0.6995710504375805' },
        { value: 'me', label: 'Maine', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.022751202603648157' },
        { value: 'md', label: 'Maryland', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.38412657689201946' },
        { value: 'ma', label: 'Massachusetts', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.8057235714919356' },
        { value: 'mi', label: 'Michigan', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.01838815895305146' },
        { value: 'mn', label: 'Minnesota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/mn-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/mn-catalog-spring-022526v1-web.pdf?c=0.8001784437710985' },
        { value: 'ms', label: 'Mississippi', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ms-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ms-catalog-spring-022526v1-web.pdf' },
        { value: 'mo', label: 'Missouri', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.17602888672774153' },
        { value: 'mt', label: 'Montana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.795957428361768' },
        { value: 'ne', label: 'Nebraska', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.7399779513126231' },
        { value: 'nv', label: 'Nevada', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.0649749336315103' },
        { value: 'nh', label: 'New Hampshire', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.5156149398551313' },
        { value: 'nj', label: 'New Jersey', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nj-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/nj-catalog-spring-022526v1-web.pdf?c=0.8036023389732343' },
        { value: 'nm', label: 'New Mexico', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nm-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/nm-catalog-spring-022526v1-web.pdf?c=0.6818364782319605' },
        { value: 'ny', label: 'New York', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.9214241759124164' },
        { value: 'nc', label: 'North Carolina', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nc-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/nc-catalog-spring-022526v1-web.pdf?c=0.466478514705443' },
        { value: 'nd', label: 'North Dakota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.4620695023828576' },
        { value: 'oh', label: 'Ohio', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.925056901061044' },
        { value: 'ok', label: 'Oklahoma', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ok-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ok-catalog-spring-022526v1-web.pdf?c=0.47148562857947296' },
        { value: 'or', label: 'Oregon', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.2229354245425903' },
        { value: 'pa', label: 'Pennsylvania', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.05367157826947355' },
        { value: 'ri', label: 'Rhode Island', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.9490342194768107' },
        { value: 'sc', label: 'South Carolina', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/sc-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/sc-catalog-spring-022526v1-web.pdf?c=0.5582404370220749' },
        { value: 'sd', label: 'South Dakota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.06257898464551592' },
        { value: 'tn', label: 'Tennessee', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/tn-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/tn-catalog-spring-022526v1-web.pdf?c=0.1884296216191622' },
        { value: 'tx', label: 'Texas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.8370990880010246' },
        { value: 'ut', label: 'Utah', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.41031949816279045' },
        { value: 'vt', label: 'Vermont', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.49948405053668843' },
        { value: 'va', label: 'Virginia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/va-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/va-catalog-spring-022526v1-web.pdf?c=0.5928567987567754' },
        { value: 'wa', label: 'Washington', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.6412848889981968' },
        { value: 'wv', label: 'West Virginia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.18809245651077378' },
        { value: 'wi', label: 'Wisconsin', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.9114455011315763' },
        { value: 'wy', label: 'Wyoming', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v1-web.pdf?c=0.87112783839442' }
    ];

    connectedCallback() {
        // B4 fix: Read selected state from localStorage before falling back to first entry
        const savedState = globalThis.localStorage.getItem('abc_selected_state');
        if (savedState) {
            const match = this.catalogData.find(
                c => c.label.toLowerCase() === savedState.toLowerCase()
            );
            this.selectedStateData = match || this.catalogData[0];
        } else {
            this.selectedStateData = this.catalogData[0];
        }

        // Listen for state changes from stateFilterLwc
        this._handleStateChange = (event) => {
            const newState = event.detail?.state || globalThis.localStorage.getItem('abc_selected_state');
            if (newState) {
                const match = this.catalogData.find(
                    c => c.label.toLowerCase() === newState.toLowerCase()
                );
                if (match) {
                    this.selectedStateData = match;
                }
            }
        };
        globalThis.addEventListener('abcstatechange', this._handleStateChange);
    }

    disconnectedCallback() {
        if (this._handleStateChange) {
            globalThis.removeEventListener('abcstatechange', this._handleStateChange);
        }
    }

    get stateOptions() {
        return this.catalogData.map(item => {
            return { label: item.label, value: item.value };
        });
    }

    handleStateChange(event) {
        const selectedValue = event.target.value;
        this.selectedStateData = this.catalogData.find(state => state.value === selectedValue);
    }

    get showCatalog() {
        return this.selectedStateData != null;
    }

    get catalogTitle() {
        return `${this.selectedStateData.label} Catalog`;
    }

    get catalogDescription() {
        return `Contains printed pricing and details for all ${this.selectedStateData.label} books, contact information for our ${this.selectedStateData.label} salespeople and other important information to help you better understand ABC's offerings.`;
    }

    // Open PDF in new tab
    openPdf() {
        if (this.selectedStateData?.pdfUrl) {
            globalThis.open(this.selectedStateData.pdfUrl, '_blank');
        }
    }
}