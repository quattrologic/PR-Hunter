// Real brand marks from the labels' public storefronts. These are WEBSITE logo assets,
// not Instagram profile-picture API results. Do not infer logos for arbitrary profiles.
export const KNOWN_BRAND_LOGOS=Object.freeze({
  'suvene.de':Object.freeze({
    primary:'https://cdn.shopify.com/s/files/1/0861/4163/2844/files/Suvene-Logo.png?format=webp&v=1751271684',
    fallback:'https://suvenes.de/favicon.ico',
    source:'https://shop.app/m/ue8g073wny'
  }),
  'ranya.owt':Object.freeze({
    primary:'https://ranyaowt.com/favicon.ico',
    fallback:null,
    source:'https://ranyaowt.com/'
  }),
  '6pm.update':Object.freeze({
    primary:'https://formsv2.soundestlink.com/cdn-cgi/image/fit%3Dscale-down%2Cwidth%3D1120/forms/63e4f8e57c36a90018d8cff0',
    fallback:'https://www.6pmseason.com/favicon.ico',
    source:'https://www.6pmseason.com/'
  }),
  'moremoneymorelove.de':Object.freeze({
    primary:'https://moremoneymorelove.com/cdn/shop/files/TYPOLOGO_black_1000x628_f8af3048-de8b-4faa-b3ce-e4f01ac92c08.png?v=1688024842&width=2048',
    fallback:'https://moremoneymorelove.com/favicon.ico',
    source:'https://moremoneymorelove.com/'
  }),
  'deputydepartment':Object.freeze({
    primary:'https://deputydepartment.com/cdn/shop/files/Main-Logo_1.png?v=1772458302',
    fallback:'https://deputydepartment.com/favicon.ico',
    source:'https://deputydepartment.com/'
  })
});
export function knownBrandLogo(handle){
  if(typeof handle!=='string')return null;
  const key=handle.trim().replace(/^@/,'').toLowerCase();
  if(!Object.hasOwn(KNOWN_BRAND_LOGOS,key))return null;
  return KNOWN_BRAND_LOGOS[key];
}
