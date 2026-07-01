import './sidebar.css';

export class Sidebar extends HTMLElement {
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
            const hamMenu = this.querySelector('.ham-menu');
            const offScreenMenu = this.querySelector('.off-screen-menu');
            hamMenu.addEventListener('click', () => {
                hamMenu.classList.toggle('active');
                offScreenMenu.classList.toggle('active');
            })
            this.ready = true;
        }
    }

    render() {
        // this component is a work in progress so this output is for debug purposes
        this.innerHTML = `

        <div class="off-screen-menu">
            <ul>
                <li>Instructions</li>
                <li>Change Date</li>
                <li>Reset</li>
            </ul>
        </div>

        <nav>
            <button class="reset-to-div ham-menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </nav>
        `;
    }
}

customElements.define('side-bar', Sidebar);