import { LightningElement } from 'lwc';
import { STATE_STORAGE_KEY } from 'c/utils';

export default class CatalogDownloader extends LightningElement {
    selectedStateData;

    // https://cms-assets.americanbookcompany.com/catalogs/pdfs/ga-catalog-spring-022426v2-web.pdf?c=0.3496255657002909
        //sfsites/c/cms/delivery/media/MCFM5GBPACZ5AN5FBXQZYZ4ZSTO4
    catalogData = [
        { value: 'al', label: 'Alabama', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/al-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCFM5GBPACZ5AN5FBXQZYZ4ZSTO4' },
        { value: 'ak', label: 'Alaska', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCDIQWA3OBPBF5LNJOTYFEF7TJEA' },
        { value: 'az', label: 'Arizona', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCL4FIACZF3FCNPCW7VEGEDLJF6E' },
        { value: 'ar', label: 'Arkansas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ar-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCRASVIEXSYRFBDNNNBF6A6L4XBE' },
        { value: 'ca', label: 'California', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ca-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCRRCLOV6KBNC45CVQIE6IX7MEMM' },
        { value: 'co', label: 'Colorado', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCT6JLFEWEUNFMNMJLFUFFFCNSNA' },
        { value: 'ct', label: 'Connecticut', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC2CANZCGRMBG3XN2ADZU7WAWQ5U' },
        { value: 'de', label: 'Delaware', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCSIMQVZUUV5HVHJM2SDU2DYBCPQ' },
        { value: 'dc', label: 'District of Columbia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/dc-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCDPDXXUX5YVH5JL2HPSYSFWSIEY' },
        { value: 'fl', label: 'Florida', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCE6YEX7MX6FHWXFDPXLEUTJYH2M' },
        { value: 'ga', label: 'Georgia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ga-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCUTWL7WHONZDUVODO26HC6QNW2Q' },
        { value: 'hi', label: 'Hawaii', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC7WMM33SRYJCITNJCTPAWEFXPTU' },
        { value: 'id', label: 'Idaho', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCFTPNX5DGAFF6LJELPRIMA5GMTQ' },
        { value: 'il', label: 'Illinois', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/il-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC2KVNEND4JVFELMIRLDLXL2TQLQ' },
        { value: 'in', label: 'Indiana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/in-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC7W47MS62SJBF5CK2G3STNTMRAU' },
        { value: 'ia', label: 'Iowa', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCWASN3VXUZVBMJOGRDZ2O2GPRZM' },
        { value: 'ks', label: 'Kansas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC7LTXU2567VGNXJABC7U6KKMKO4' },
        { value: 'ky', label: 'Kentucky', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ky-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC2JLHL7GYP5DEBBFB3OZUD5YVHA' },
        { value: 'la', label: 'Louisiana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/la-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCFMQVGRDY3BAD3HWH5RG65AUTCQ' },
        { value: 'me', label: 'Maine', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCSH56CCKDGFETBDQAMBACERK6ZA' },
        { value: 'md', label: 'Maryland', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCDBE34V7F25CMLKYWGTHDJUWW4Q' },
        { value: 'ma', label: 'Massachusetts', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCLX4IK7YYHJFTJNWBYR3AQIWNHU' },
        { value: 'mi', label: 'Michigan', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCECOIDFTFTJBBHCLN2GX6QSSCRQ' },
        { value: 'mn', label: 'Minnesota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/mn-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCEU3UCEKJ6RCIJG6U4HCQN4YURQ' },
        { value: 'ms', label: 'Mississippi', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ms-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCZRVAJPZDKJHJDKIGRN3TZJV4UE' },
        { value: 'mo', label: 'Missouri', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCZRY2B5TCIBEQPOOJCHRRV4KUJE' },
        { value: 'mt', label: 'Montana', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC2PL44UBDTFENVLNFJKBVUR7PJU' },
        { value: 'ne', label: 'Nebraska', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCMT3L3FUVIVA6HJNSGHLEAQD6JY' },
        { value: 'nv', label: 'Nevada', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCW7LFQXLO4BATXHJJ7PGEUQQAGY' },
        { value: 'nh', label: 'New Hampshire', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC4WWVG7X4SJHYXLPCIW4OOMGJT4' },
        { value: 'nj', label: 'New Jersey', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nj-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC43BC4AZ4JFDONCYTGRN2JGSGEQ' },
        { value: 'nm', label: 'New Mexico', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nm-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCG4TF5YOFTVEMJMCQ377C7CXWPU' },
        { value: 'ny', label: 'New York', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC74BWZNDCHJCANIQUTE4K3EOD3A' },
        { value: 'nc', label: 'North Carolina', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/nc-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCZ33MXSECOBH2VJY5VG6LI6HCYE' },
        { value: 'nd', label: 'North Dakota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC3DOXMEMVKNBKXBU2FAXQNJYO6Y' },
        { value: 'oh', label: 'Ohio', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCYRKH22R6GBH5TFP2GLS2HL3TKU' },
        { value: 'ok', label: 'Oklahoma', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ok-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCRM6BCBDQYBGWFM5PMOMEAYRK7Q' },
        { value: 'or', label: 'Oregon', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCATXBBGF5EJCAHNI36HPTEQTK3I' },
        { value: 'pa', label: 'Pennsylvania', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCIECLNDFMWFEUHJD2SGFDKAMZ34' },
        { value: 'ri', label: 'Rhode Island', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCME5INWSEOBFD5ICDQCK7GEXMAY' },
        { value: 'sc', label: 'South Carolina', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/sc-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCEVZLZCW3NVHFJLPIRV7YMOZKRU' },
        { value: 'sd', label: 'South Dakota', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCLW7MYINIQVCMNLAGRI62E75DYE' },
        { value: 'tn', label: 'Tennessee', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/tn-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCSA4X3TDW5ZBRFPARB7QFZNOJOU' },
        { value: 'tx', label: 'Texas', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCVJK45XNWGJG3TF6WKHLG4WFFDY' },
        { value: 'ut', label: 'Utah', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCMWSCD5TPEJBAFHC5MMFI6MTKXA' },
        { value: 'vt', label: 'Vermont', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCEAWJN2CCZ5EHVP3B3PTCHMBAGY' },
        { value: 'va', label: 'Virginia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/va-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCUAWNXMAZNBG6FOLIXKR3JIBZ5A' },
        { value: 'wa', label: 'Washington', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCL7IAGH7Q3VDK7NUFKG7CXKV55A' },
        { value: 'wv', label: 'West Virginia', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCAF5DNAOADFEBBC5EP5DUPKRXXA' },
        { value: 'wi', label: 'Wisconsin', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MCLKG4Q2OIYFAT5BSO4U7G2EM5CQ' },
        { value: 'wy', label: 'Wyoming', imageUrl: 'https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg', pdfUrl: 'sfsites/c/cms/delivery/media/MC5VA4WD6PVRAZZCXLVXT2DYJT7I' }
    ];

    connectedCallback() {
        // Read selected state from localStorage before falling back to first entry
        const savedState = globalThis.localStorage.getItem(STATE_STORAGE_KEY);
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
            const newState = event.detail?.state || globalThis.localStorage.getItem(STATE_STORAGE_KEY);
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

    async openPdf() {
        if (this.selectedStateData?.pdfUrl) {
            try {
                const response = await fetch(this.selectedStateData.pdfUrl);
                const originalBlob = await response.blob();
                
                const pdfBlob = new Blob([originalBlob], { type: 'application/pdf' });
                
                const objectUrl = URL.createObjectURL(pdfBlob);
                
                globalThis.open(objectUrl, '_blank');
                
            } catch (error) {
                console.error('Failed to Load PDF Document:', error);
                globalThis.open(this.selectedStateData.pdfUrl, '_blank');
            }
        }
    }
}