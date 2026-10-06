import { useEffect } from "react";

export default function ScrollEffects() {
  useEffect(() => {
    let observer;
    let timer;

    const init = () => {
      const selectors = [
        ".nebula-dashboard .nd-header",
        ".nebula-dashboard .nd-hero",
        ".nebula-dashboard .nd-discipline-panel",
        ".nebula-dashboard .nd-analytics",
        ".nebula-dashboard .htp-panel",
        ".nebula-dashboard .nd-quote",
      ];

      const elements = document.querySelectorAll(selectors.join(","));
      const scrollRoot = document.querySelector("main");

      if (!elements.length || !scrollRoot) {
        return false;
      }

      // Prepare elements for animation.
      elements.forEach((element) => {
        element.classList.add("tl-scroll-reveal");
      });

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("tl-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: scrollRoot,
          threshold: 0,
          rootMargin: "0px 0px -10px 0px",
        }
      );

      elements.forEach((element) => {
        observer.observe(element);
      });

      return true;
    };

    // React may render the Dashboard after this component mounts.
    timer = setInterval(() => {
      if (init()) {
        clearInterval(timer);
      }
    }, 300);

    return () => {
      clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  return null;
}