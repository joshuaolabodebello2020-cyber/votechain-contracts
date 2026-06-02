import { useEffect } from 'react';

const FALLBACK_IMAGE = 'https://votechain.dev/og-default.png';
const SITE_NAME = 'VoteChain';

function setMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
        ?? document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    // Twitter uses name=, OG uses property=
    if (property.startsWith('twitter:')) {
      el.setAttribute('name', property);
    } else {
      el.setAttribute('property', property);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

interface OgMetaOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
}

export function useOgMeta({ title, description, url, image }: OgMetaOptions) {
  useEffect(() => {
    const pageTitle = `${title} — ${SITE_NAME}`;
    const img = image ?? FALLBACK_IMAGE;
    const desc = description.length > 200 ? description.slice(0, 197) + '…' : description;

    document.title = pageTitle;

    // Open Graph
    setMeta('og:title', pageTitle);
    setMeta('og:description', desc);
    setMeta('og:image', img);
    setMeta('og:url', url);
    setMeta('og:type', 'website');
    setMeta('og:site_name', SITE_NAME);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', pageTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);

    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, url, image]);
}
