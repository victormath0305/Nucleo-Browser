/**
 * Núcleo Browser - Address Bar Helper
 */

class AddressBarHelper {
  constructor(inputElement, wrapperElement) {
    this.input = inputElement;
    this.wrapper = wrapperElement;
    this.currentUrl = '';
    this.isEditing = false;

    this._bindEvents();
  }

  _bindEvents() {
    this.input.addEventListener('focus', () => {
      this.isEditing = true;
      this.wrapper.classList.add('focused');
      // If display had trimmed URL and it's not internal newtab, show full URL
      if (this.currentUrl && !this.isNewTabUrl(this.currentUrl) && !this.input.value.startsWith('http')) {
        this.input.value = this.currentUrl;
      }
      setTimeout(() => this.input.select(), 10);
    });

    this.input.addEventListener('blur', () => {
      this.isEditing = false;
      this.wrapper.classList.remove('focused');
      this.setDisplayUrl(this.currentUrl);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.setDisplayUrl(this.currentUrl);
        this.input.blur();
      }
    });
  }

  isNewTabUrl(url) {
    if (!url) return true;
    return (
      url === 'nucleo://newtab' ||
      url.includes('newtab.html') ||
      url === 'about:blank'
    );
  }

  /**
   * Updates the displayed address bar value.
   * Only updates if the user is not actively typing in the bar.
   * @param {string} url
   */
  setDisplayUrl(url) {
    this.currentUrl = url || '';
    if (!this.isEditing) {
      if (this.isNewTabUrl(url)) {
        this.input.value = '';
        return;
      }

      // Beautify standard HTTPS URLs for display
      try {
        const parsed = new URL(url);
        // Show clean domain and path
        if (parsed.protocol === 'https:') {
          this.input.value = url.replace(/^https:\/\//, '');
        } else {
          this.input.value = url;
        }
      } catch {
        this.input.value = url;
      }
    }
  }

  getValue() {
    return this.input.value.trim();
  }

  focus() {
    this.input.focus();
  }
}

window.AddressBarHelper = AddressBarHelper;
