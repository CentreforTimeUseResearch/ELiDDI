import { Autocomplete } from "../autocomplete/autocomplete";  // as el-autocomplete

import './activityPanel.css';

export class ActivityPanel extends HTMLElement {
    ready = false;

    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
        this.assignEventHandlers();
    }

    assignEventHandlers() {
        if (!this.ready) {
            //     const activitySelector = this.querySelector('a');
            //     const activityPanel = this.querySelector('.activity-panel')
            //     activitySelector.addEventListener('click', () => {
            //         activityPanel.classList.toggle('active');
            //     })
            this.autocomplete = this.querySelector('el-autocomplete');

            this.addEventListener('activitySearch', (e) => {
                console.log('here')
            })

            this.ready = true;
        }
    }

    render() {
        // this component is a work in progress so this output is for debug purposes
        this.innerHTML = `

        <div class="activity-panel">
            <!-- here will be the autocomplete <el-autocomplete></el-autocomplete> -->
        </div>
        `;
    }
}

customElements.define('activity-panel', ActivityPanel)