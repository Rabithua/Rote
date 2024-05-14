export function observeElementInViewport(element: any, callback: any) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(true);
      } else {
        callback(false);
      }
    });
  });

  observer.observe(element);

  // Return a function to disconnect the observer
  return () => {
    observer.disconnect();
  };
}
