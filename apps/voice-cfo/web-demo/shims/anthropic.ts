// Browser demo runs the offline rules agent; no API key ever ships to a browser.
export default class Anthropic { constructor() { throw new Error('Claude is not available in the browser demo'); } }
