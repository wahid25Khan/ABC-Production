import { LightningElement,api } from 'lwc';

export default class ProductGrid extends LightningElement {
    isOpen = false;

    openModal() {
        this.isOpen = true;

        // // Focus trap-ish: focus the modal container after render
        requestAnimationFrame(() => {
            const modal = this.template.querySelector('section[role="dialog"]');
            if (modal) modal.focus();
        });
    }

    closeModal() {
    this.isOpen = false;
}

    // closeModal() {
    //     this.isOpen = false;
    // }
    // @api currency = 'USD';

    // You can pass products from parent, or use this demo data.
    // @api products = [
    //     {
    //         id: '1',
    //         title: 'Georgia K-12 Standards Success Grade 4 ELA',
    //         price: 25.25,
            // imageUrl: 'https://via.placeholder.com/600x900?text=Book+Cover+1'
        // },
        // {
        //     id: '2',
        //     title: 'Georgia K-12 Standards Success Grade 6 ELA',
        //     price: 25.25,
            // imageUrl: 'https://via.placeholder.com/600x900?text=Book+Cover+2'
        // },
        // {
        //     id: '3',
        //     title: 'Georgia K-12 Standards Success Grade 7 ELA',
        //     price: 25.25,
            // imageUrl: 'https://via.placeholder.com/600x900?text=Book+Cover+3'
        // },
        // {
        //     id: '4',
        //     title: 'Georgia K-12 Standards Success Literature & Composition III',
        //     price: 28.25,
            // imageUrl: 'https://via.placeholder.com/600x900?text=Book+Cover+4'
        // },
        // {
        //     id: '5',
        //     title: 'Georgia K-12 Standards Success Literature & Composition II',
        //     price: 28.25,
            // imageUrl: 'https://via.placeholder.com/600x900?text=Book+Cover+5'
//         }
//     ];

//     get normalizedProducts() {
//         const list = Array.isArray(this.products) ? this.products : [];
//         return list.map((p) => ({
//             ...p,
//             startingLabel: p.startingLabel || 'Starting at',
//             priceFormatted: this.formatMoney(p.price)
//         }));
//     }

//     formatMoney(value) {
//         const num = Number(value);
//         if (Number.isNaN(num)) return '';
//         return new Intl.NumberFormat(undefined, {
//             style: 'currency',
//             currency: this.currency
//         }).format(num);
//     }

//     handleLookInside(event) {
//         const id = event.currentTarget.dataset.id;
//         this.dispatchEvent(new CustomEvent('lookinside', { detail: { id } }));
//     }

//     handleQuickShop(event) {
//         const id = event.currentTarget.dataset.id;
//         this.dispatchEvent(new CustomEvent('quickshop', { detail: { id } }));
//     }
 }