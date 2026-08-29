import { BADGE_HEIGHT, BADGE_WIDTH, siteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * Loader for the `<script src="/badge.js" data-slug="…">` embed. Rendering the
 * anchor at runtime keeps the backlink and the live SVG under our control even
 * when a merchant pastes the snippet into a template they later edit.
 */
function script(): string {
  return `(function(){
var origin=${JSON.stringify(siteUrl())};
var tag=document.currentScript;
if(!tag){var tags=document.getElementsByTagName("script");tag=tags[tags.length-1];}
if(!tag||!tag.parentNode)return;
var slug=(tag.getAttribute("data-slug")||"").toLowerCase().replace(/[^a-z0-9-]/g,"");
if(!slug)return;
var link=document.createElement("a");
link.href=origin+"/site/"+slug+"?ref=badge";
link.title="Agent-readiness score by Qomvia";
link.target="_blank";
link.rel="noopener";
var image=document.createElement("img");
image.src=origin+"/badge/"+slug+".svg";
image.alt="Qomvia agent-readiness score";
image.width=${BADGE_WIDTH};
image.height=${BADGE_HEIGHT};
image.loading="lazy";
image.style.border="0";
link.appendChild(image);
tag.parentNode.insertBefore(link,tag);
})();
`;
}

export function GET(): Response {
  return new Response(script(), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "access-control-allow-origin": "*",
    },
  });
}
