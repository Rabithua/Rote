/**
 * Adds smooth scrolling behavior to anchor links that link to sections within the same page.
 * @param {string} selector - A CSS selector that targets the anchor links.
 * @param {number} [offsetTop=0] - An optional offset value to adjust the scroll position.
 * @param {HTMLElement | null} [scrollContainer=null] - The scroll container element.
 */
function smoothScrollAnchors(selector: string, offsetTop: number, scrollContainer: HTMLElement | null = null): void {
  document.querySelectorAll(selector).forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      e.preventDefault();

      const targetId: any = anchor.getAttribute("href");
      const targetElement = document.querySelector(targetId);

      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.pageYOffset;
        const offsetPosition = targetRect.top + scrollTop - offsetTop;
        
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: offsetPosition, behavior: "smooth" });
        } else {
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
      }
    });
  });
}

export { smoothScrollAnchors };