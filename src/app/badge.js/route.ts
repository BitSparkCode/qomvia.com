import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * Loader for the `<script src="/badge.js" data-slug="…">` embed. The seal only
 * exists as markup we return at runtime, so it disappears when a shop stops
 * qualifying and cannot be reproduced by a shop that never did.
 */
function script(): string {
  return `(function(){
var origin=${JSON.stringify(siteUrl())};
var tag=document.currentScript;
if(!tag){var tags=document.getElementsByTagName("script");tag=tags[tags.length-1];}
if(!tag||!tag.parentNode)return;
var slug=(tag.getAttribute("data-slug")||"").toLowerCase().replace(/[^a-z0-9-]/g,"");
if(!slug)return;
var anchor=tag.parentNode;
var reference=tag;
fetch(origin+"/api/badge/"+encodeURIComponent(slug)).then(function(response){
return response.ok?response.json():null;
}).then(function(data){
if(!data||!data.earned||!reference.parentNode)return;
var link=document.createElement("a");
link.href=origin+data.href+"?ref=badge";
link.title="Agent-commerce ready, verified by Qomvia";
link.target="_blank";
link.rel="noopener";
link.style.display="inline-block";
link.style.lineHeight="0";
link.innerHTML=data.svg;
anchor.insertBefore(link,reference);
}).catch(function(){});
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
