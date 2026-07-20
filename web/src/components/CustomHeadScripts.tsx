import { useSiteStatus } from '@/hooks/useSiteStatus';
import { useEffect } from 'react';

const CUSTOM_SCRIPT_MARKER = 'data-rote-custom-head-script';
let hasHandledInitialConfig = false;

function parseScripts(html: string): HTMLScriptElement[] {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(documentFragment.querySelectorAll('script')).map((source) => {
    const script = document.createElement('script');
    for (const attribute of Array.from(source.attributes)) {
      script.setAttribute(attribute.name, attribute.value);
    }
    script.textContent = source.textContent;
    script.setAttribute(CUSTOM_SCRIPT_MARKER, 'true');
    return script;
  });
}

export async function injectCustomHeadScripts(html: string): Promise<void> {
  const scripts = parseScripts(html);

  for (const script of scripts) {
    const isBlockingExternalScript = Boolean(script.src) && !script.hasAttribute('async');
    if (!isBlockingExternalScript) {
      document.head.appendChild(script);
      continue;
    }

    script.async = false;
    await new Promise<void>((resolve) => {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => resolve(), { once: true });
      document.head.appendChild(script);
    });
  }
}

export default function CustomHeadScripts() {
  const { data: siteStatus } = useSiteStatus();

  useEffect(() => {
    if (!siteStatus || hasHandledInitialConfig) return;
    hasHandledInitialConfig = true;

    if (siteStatus.site.customHeadScripts) {
      void injectCustomHeadScripts(siteStatus.site.customHeadScripts);
    }
  }, [siteStatus]);

  return null;
}
