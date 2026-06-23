export class DynamicTimelineUI extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        // this component is a work in progress so this output is for debug purposes
        this.innerHTML = `<h1>Hello, World!</h1>`;
    }
}
