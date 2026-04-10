var e=Object.defineProperty,t=(t,n)=>{let r={};for(var i in t)e(r,i,{get:t[i],enumerable:!0});return n||e(r,Symbol.toStringTag,{value:`Module`}),r};(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var n=Object.freeze({left:0,top:0,width:16,height:16}),r=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),i=Object.freeze({...n,...r}),a=Object.freeze({...i,body:``,hidden:!1}),o=Object.freeze({width:null,height:null}),s=Object.freeze({...o,...r});function c(e,t=0){let n=e.replace(/^-?[0-9.]*/,``);function r(e){for(;e<0;)e+=4;return e%4}if(n===``){let t=parseInt(e);return isNaN(t)?0:r(t)}else if(n!==e){let t=0;switch(n){case`%`:t=25;break;case`deg`:t=90}if(t){let i=parseFloat(e.slice(0,e.length-n.length));return isNaN(i)?0:(i/=t,i%1==0?r(i):0)}}return t}var l=/[\s,]+/;function u(e,t){t.split(l).forEach(t=>{switch(t.trim()){case`horizontal`:e.hFlip=!0;break;case`vertical`:e.vFlip=!0;break}})}var d={...s,preserveAspectRatio:``};function f(e){let t={...d},n=(t,n)=>e.getAttribute(t)||n;return t.width=n(`width`,null),t.height=n(`height`,null),t.rotate=c(n(`rotate`,``)),u(t,n(`flip`,``)),t.preserveAspectRatio=n(`preserveAspectRatio`,n(`preserveaspectratio`,``)),t}function p(e,t){for(let n in d)if(e[n]!==t[n])return!0;return!1}var m=/^[a-z0-9]+(-[a-z0-9]+)*$/,h=(e,t,n,r=``)=>{let i=e.split(`:`);if(e.slice(0,1)===`@`){if(i.length<2||i.length>3)return null;r=i.shift().slice(1)}if(i.length>3||!i.length)return null;if(i.length>1){let e=i.pop(),n=i.pop(),a={provider:i.length>0?i[0]:r,prefix:n,name:e};return t&&!g(a)?null:a}let a=i[0],o=a.split(`-`);if(o.length>1){let e={provider:r,prefix:o.shift(),name:o.join(`-`)};return t&&!g(e)?null:e}if(n&&r===``){let e={provider:r,prefix:``,name:a};return t&&!g(e,n)?null:e}return null},g=(e,t)=>e?!!((t&&e.prefix===``||e.prefix)&&e.name):!1;function ee(e,t){let n=e.icons,r=e.aliases||Object.create(null),i=Object.create(null);function a(e){if(n[e])return i[e]=[];if(!(e in i)){i[e]=null;let t=r[e]&&r[e].parent,n=t&&a(t);n&&(i[e]=[t].concat(n))}return i[e]}return Object.keys(n).concat(Object.keys(r)).forEach(a),i}function _(e,t){let n={};!e.hFlip!=!t.hFlip&&(n.hFlip=!0),!e.vFlip!=!t.vFlip&&(n.vFlip=!0);let r=((e.rotate||0)+(t.rotate||0))%4;return r&&(n.rotate=r),n}function v(e,t){let n=_(e,t);for(let i in a)i in r?i in e&&!(i in n)&&(n[i]=r[i]):i in t?n[i]=t[i]:i in e&&(n[i]=e[i]);return n}function te(e,t,n){let r=e.icons,i=e.aliases||Object.create(null),a={};function o(e){a=v(r[e]||i[e],a)}return o(t),n.forEach(o),v(e,a)}function y(e,t){let n=[];if(typeof e!=`object`||typeof e.icons!=`object`)return n;e.not_found instanceof Array&&e.not_found.forEach(e=>{t(e,null),n.push(e)});let r=ee(e);for(let i in r){let a=r[i];a&&(t(i,te(e,i,a)),n.push(i))}return n}var ne={provider:``,aliases:{},not_found:{},...n};function re(e,t){for(let n in t)if(n in e&&typeof e[n]!=typeof t[n])return!1;return!0}function ie(e){if(typeof e!=`object`||!e)return null;let t=e;if(typeof t.prefix!=`string`||!e.icons||typeof e.icons!=`object`||!re(e,ne))return null;let n=t.icons;for(let e in n){let t=n[e];if(!e||typeof t.body!=`string`||!re(t,a))return null}let r=t.aliases||Object.create(null);for(let e in r){let t=r[e],i=t.parent;if(!e||typeof i!=`string`||!n[i]&&!r[i]||!re(t,a))return null}return t}var b=Object.create(null);function ae(e,t){return{provider:e,prefix:t,icons:Object.create(null),missing:new Set}}function x(e,t){let n=b[e]||(b[e]=Object.create(null));return n[t]||(n[t]=ae(e,t))}function oe(e,t){return ie(t)?y(t,(t,n)=>{n?e.icons[t]=n:e.missing.add(t)}):[]}function se(e,t,n){try{if(typeof n.body==`string`)return e.icons[t]={...n},!0}catch{}return!1}function ce(e,t){let n=[];return(typeof e==`string`?[e]:Object.keys(b)).forEach(e=>{(typeof e==`string`&&typeof t==`string`?[t]:Object.keys(b[e]||{})).forEach(t=>{let r=x(e,t);n=n.concat(Object.keys(r.icons).map(n=>(e===``?``:`@`+e+`:`)+t+`:`+n))})}),n}var S=!1;function le(e){return typeof e==`boolean`&&(S=e),S}function C(e){let t=typeof e==`string`?h(e,!0,S):e;if(t){let e=x(t.provider,t.prefix),n=t.name;return e.icons[n]||(e.missing.has(n)?null:void 0)}}function ue(e,t){let n=h(e,!0,S);if(!n)return!1;let r=x(n.provider,n.prefix);return t?se(r,n.name,t):(r.missing.add(n.name),!0)}function de(e,t){if(typeof e!=`object`)return!1;if(typeof t!=`string`&&(t=e.provider||``),S&&!t&&!e.prefix){let t=!1;return ie(e)&&(e.prefix=``,y(e,(e,n)=>{ue(e,n)&&(t=!0)})),t}let n=e.prefix;return g({prefix:n,name:`a`})?!!oe(x(t,n),e):!1}function fe(e){return!!C(e)}function pe(e){let t=C(e);return t&&{...i,...t}}function me(e,t){e.forEach(e=>{let n=e.loaderCallbacks;n&&(e.loaderCallbacks=n.filter(e=>e.id!==t))})}function he(e){e.pendingCallbacksFlag||(e.pendingCallbacksFlag=!0,setTimeout(()=>{e.pendingCallbacksFlag=!1;let t=e.loaderCallbacks?e.loaderCallbacks.slice(0):[];if(!t.length)return;let n=!1,r=e.provider,i=e.prefix;t.forEach(t=>{let a=t.icons,o=a.pending.length;a.pending=a.pending.filter(t=>{if(t.prefix!==i)return!0;let o=t.name;if(e.icons[o])a.loaded.push({provider:r,prefix:i,name:o});else if(e.missing.has(o))a.missing.push({provider:r,prefix:i,name:o});else return n=!0,!0;return!1}),a.pending.length!==o&&(n||me([e],t.id),t.callback(a.loaded.slice(0),a.missing.slice(0),a.pending.slice(0),t.abort))})}))}var ge=0;function _e(e,t,n){let r=ge++,i=me.bind(null,n,r);if(!t.pending.length)return i;let a={id:r,icons:t,callback:e,abort:i};return n.forEach(e=>{(e.loaderCallbacks||=[]).push(a)}),i}function ve(e){let t={loaded:[],missing:[],pending:[]},n=Object.create(null);e.sort((e,t)=>e.provider===t.provider?e.prefix===t.prefix?e.name.localeCompare(t.name):e.prefix.localeCompare(t.prefix):e.provider.localeCompare(t.provider));let r={provider:``,prefix:``,name:``};return e.forEach(e=>{if(r.name===e.name&&r.prefix===e.prefix&&r.provider===e.provider)return;r=e;let i=e.provider,a=e.prefix,o=e.name,s=n[i]||(n[i]=Object.create(null)),c=s[a]||(s[a]=x(i,a)),l;l=o in c.icons?t.loaded:a===``||c.missing.has(o)?t.missing:t.pending;let u={provider:i,prefix:a,name:o};l.push(u)}),t}var ye=Object.create(null);function be(e,t){ye[e]=t}function xe(e){return ye[e]||ye[``]}function Se(e,t=!0,n=!1){let r=[];return e.forEach(e=>{let i=typeof e==`string`?h(e,t,n):e;i&&r.push(i)}),r}function Ce(e){let t;if(typeof e.resources==`string`)t=[e.resources];else if(t=e.resources,!(t instanceof Array)||!t.length)return null;return{resources:t,path:e.path||`/`,maxURL:e.maxURL||500,rotate:e.rotate||750,timeout:e.timeout||5e3,random:e.random===!0,index:e.index||0,dataAfterTimeout:e.dataAfterTimeout!==!1}}for(var w=Object.create(null),we=[`https://api.simplesvg.com`,`https://api.unisvg.com`],Te=[];we.length>0;)we.length===1||Math.random()>.5?Te.push(we.shift()):Te.push(we.pop());w[``]=Ce({resources:[`https://api.iconify.design`].concat(Te)});function Ee(e,t){let n=Ce(t);return n===null?!1:(w[e]=n,!0)}function T(e){return w[e]}function De(){return Object.keys(w)}var Oe={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1};function ke(e,t,n,r){let i=e.resources.length,a=e.random?Math.floor(Math.random()*i):e.index,o;if(e.random){let t=e.resources.slice(0);for(o=[];t.length>1;){let e=Math.floor(Math.random()*t.length);o.push(t[e]),t=t.slice(0,e).concat(t.slice(e+1))}o=o.concat(t)}else o=e.resources.slice(a).concat(e.resources.slice(0,a));let s=Date.now(),c=`pending`,l=0,u,d=null,f=[],p=[];typeof r==`function`&&p.push(r);function m(){d&&=(clearTimeout(d),null)}function h(){c===`pending`&&(c=`aborted`),m(),f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function g(e,t){t&&(p=[]),typeof e==`function`&&p.push(e)}function ee(){return{startTime:s,payload:t,status:c,queriesSent:l,queriesPending:f.length,subscribe:g,abort:h}}function _(){c=`failed`,p.forEach(e=>{e(void 0,u)})}function v(){f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function te(t,n,r){let i=n!==`success`;switch(f=f.filter(e=>e!==t),c){case`pending`:break;case`failed`:if(i||!e.dataAfterTimeout)return;break;default:return}if(n===`abort`){u=r,_();return}if(i){u=r,f.length||(o.length?y():_());return}if(m(),v(),!e.random){let n=e.resources.indexOf(t.resource);n!==-1&&n!==e.index&&(e.index=n)}c=`completed`,p.forEach(e=>{e(r)})}function y(){if(c!==`pending`)return;m();let r=o.shift();if(r===void 0){if(f.length){d=setTimeout(()=>{m(),c===`pending`&&(v(),_())},e.timeout);return}_();return}let i={status:`pending`,resource:r,callback:(e,t)=>{te(i,e,t)}};f.push(i),l++,d=setTimeout(y,e.rotate),n(r,t,i.callback)}return setTimeout(y),ee}function Ae(e){let t={...Oe,...e},n=[];function r(){n=n.filter(e=>e().status===`pending`)}function i(e,i,a){let o=ke(t,e,i,(e,t)=>{r(),a&&a(e,t)});return n.push(o),o}function a(e){return n.find(t=>e(t))||null}return{query:i,find:a,setIndex:e=>{t.index=e},getIndex:()=>t.index,cleanup:r}}function je(){}var Me=Object.create(null);function Ne(e){if(!Me[e]){let t=T(e);if(!t)return;Me[e]={config:t,redundancy:Ae(t)}}return Me[e]}function Pe(e,t,n){let r,i;if(typeof e==`string`){let t=xe(e);if(!t)return n(void 0,424),je;i=t.send;let a=Ne(e);a&&(r=a.redundancy)}else{let t=Ce(e);if(t){r=Ae(t);let n=xe(e.resources?e.resources[0]:``);n&&(i=n.send)}}return!r||!i?(n(void 0,424),je):r.query(t,i,n)().abort}function Fe(){}function Ie(e){e.iconsLoaderFlag||(e.iconsLoaderFlag=!0,setTimeout(()=>{e.iconsLoaderFlag=!1,he(e)}))}function Le(e){let t=[],n=[];return e.forEach(e=>{(e.match(m)?t:n).push(e)}),{valid:t,invalid:n}}function E(e,t,n){function r(){let n=e.pendingIcons;t.forEach(t=>{n&&n.delete(t),e.icons[t]||e.missing.add(t)})}if(n&&typeof n==`object`)try{if(!oe(e,n).length){r();return}}catch(e){console.error(e)}r(),Ie(e)}function Re(e,t){e instanceof Promise?e.then(e=>{t(e)}).catch(()=>{t(null)}):t(e)}function ze(e,t){e.iconsToLoad?e.iconsToLoad=e.iconsToLoad.concat(t).sort():e.iconsToLoad=t,e.iconsQueueFlag||(e.iconsQueueFlag=!0,setTimeout(()=>{e.iconsQueueFlag=!1;let{provider:t,prefix:n}=e,r=e.iconsToLoad;if(delete e.iconsToLoad,!r||!r.length)return;let i=e.loadIcon;if(e.loadIcons&&(r.length>1||!i)){Re(e.loadIcons(r,n,t),t=>{E(e,r,t)});return}if(i){r.forEach(r=>{Re(i(r,n,t),t=>{E(e,[r],t?{prefix:n,icons:{[r]:t}}:null)})});return}let{valid:a,invalid:o}=Le(r);if(o.length&&E(e,o,null),!a.length)return;let s=n.match(m)?xe(t):null;if(!s){E(e,a,null);return}s.prepare(t,n,a).forEach(n=>{Pe(t,n,t=>{E(e,n.icons,t)})})}))}var Be=(e,t)=>{let n=ve(Se(e,!0,le()));if(!n.pending.length){let e=!0;return t&&setTimeout(()=>{e&&t(n.loaded,n.missing,n.pending,Fe)}),()=>{e=!1}}let r=Object.create(null),i=[],a,o;return n.pending.forEach(e=>{let{provider:t,prefix:n}=e;if(n===o&&t===a)return;a=t,o=n,i.push(x(t,n));let s=r[t]||(r[t]=Object.create(null));s[n]||(s[n]=[])}),n.pending.forEach(e=>{let{provider:t,prefix:n,name:i}=e,a=x(t,n),o=a.pendingIcons||=new Set;o.has(i)||(o.add(i),r[t][n].push(i))}),i.forEach(e=>{let t=r[e.provider][e.prefix];t.length&&ze(e,t)}),t?_e(t,n,i):Fe},Ve=e=>new Promise((t,n)=>{let r=typeof e==`string`?h(e,!0):e;if(!r){n(e);return}Be([r||e],a=>{if(a.length&&r){let e=C(r);if(e){t({...i,...e});return}}n(e)})});function He(e){try{let t=typeof e==`string`?JSON.parse(e):e;if(typeof t.body==`string`)return{...t}}catch{}}function Ue(e,t){if(typeof e==`object`)return{data:He(e),value:e};if(typeof e!=`string`)return{value:e};if(e.includes(`{`)){let t=He(e);if(t)return{data:t,value:e}}let n=h(e,!0,!0);if(!n)return{value:e};let r=C(n);return r!==void 0||!n.prefix?{value:e,name:n,data:r}:{value:e,name:n,loading:Be([n],()=>t(e,n,C(n)))}}var We=!1;try{We=navigator.vendor.indexOf(`Apple`)===0}catch{}function Ge(e,t){switch(t){case`svg`:case`bg`:case`mask`:return t}return t!==`style`&&(We||e.indexOf(`<a`)===-1)?`svg`:e.indexOf(`currentColor`)===-1?`bg`:`mask`}var Ke=/(-?[0-9.]*[0-9]+[0-9.]*)/g,qe=/^-?[0-9.]*[0-9]+[0-9.]*$/g;function Je(e,t,n){if(t===1)return e;if(n||=100,typeof e==`number`)return Math.ceil(e*t*n)/n;if(typeof e!=`string`)return e;let r=e.split(Ke);if(r===null||!r.length)return e;let i=[],a=r.shift(),o=qe.test(a);for(;;){if(o){let e=parseFloat(a);isNaN(e)?i.push(a):i.push(Math.ceil(e*t*n)/n)}else i.push(a);if(a=r.shift(),a===void 0)return i.join(``);o=!o}}function Ye(e,t=`defs`){let n=``,r=e.indexOf(`<`+t);for(;r>=0;){let i=e.indexOf(`>`,r),a=e.indexOf(`</`+t);if(i===-1||a===-1)break;let o=e.indexOf(`>`,a);if(o===-1)break;n+=e.slice(i+1,a).trim(),e=e.slice(0,r).trim()+e.slice(o+1)}return{defs:n,content:e}}function Xe(e,t){return e?`<defs>`+e+`</defs>`+t:t}function Ze(e,t,n){let r=Ye(e);return Xe(r.defs,t+r.content+n)}var Qe=e=>e===`unset`||e===`undefined`||e===`none`;function $e(e,t){let n={...i,...e},r={...s,...t},a={left:n.left,top:n.top,width:n.width,height:n.height},o=n.body;[n,r].forEach(e=>{let t=[],n=e.hFlip,r=e.vFlip,i=e.rotate;n?r?i+=2:(t.push(`translate(`+(a.width+a.left).toString()+` `+(0-a.top).toString()+`)`),t.push(`scale(-1 1)`),a.top=a.left=0):r&&(t.push(`translate(`+(0-a.left).toString()+` `+(a.height+a.top).toString()+`)`),t.push(`scale(1 -1)`),a.top=a.left=0);let s;switch(i<0&&(i-=Math.floor(i/4)*4),i%=4,i){case 1:s=a.height/2+a.top,t.unshift(`rotate(90 `+s.toString()+` `+s.toString()+`)`);break;case 2:t.unshift(`rotate(180 `+(a.width/2+a.left).toString()+` `+(a.height/2+a.top).toString()+`)`);break;case 3:s=a.width/2+a.left,t.unshift(`rotate(-90 `+s.toString()+` `+s.toString()+`)`);break}i%2==1&&(a.left!==a.top&&(s=a.left,a.left=a.top,a.top=s),a.width!==a.height&&(s=a.width,a.width=a.height,a.height=s)),t.length&&(o=Ze(o,`<g transform="`+t.join(` `)+`">`,`</g>`))});let c=r.width,l=r.height,u=a.width,d=a.height,f,p;c===null?(p=l===null?`1em`:l===`auto`?d:l,f=Je(p,u/d)):(f=c===`auto`?u:c,p=l===null?Je(f,d/u):l===`auto`?d:l);let m={},h=(e,t)=>{Qe(t)||(m[e]=t.toString())};h(`width`,f),h(`height`,p);let g=[a.left,a.top,u,d];return m.viewBox=g.join(` `),{attributes:m,viewBox:g,body:o}}function et(e,t){let n=e.indexOf(`xlink:`)===-1?``:` xmlns:xlink="http://www.w3.org/1999/xlink"`;for(let e in t)n+=` `+e+`="`+t[e]+`"`;return`<svg xmlns="http://www.w3.org/2000/svg"`+n+`>`+e+`</svg>`}function tt(e){return e.replace(/"/g,`'`).replace(/%/g,`%25`).replace(/#/g,`%23`).replace(/</g,`%3C`).replace(/>/g,`%3E`).replace(/\s+/g,` `)}function nt(e){return`data:image/svg+xml,`+tt(e)}function rt(e){return`url("`+nt(e)+`")`}var D=(()=>{let e;try{if(e=fetch,typeof e==`function`)return e}catch{}})();function it(e){D=e}function at(){return D}function ot(e,t){let n=T(e);if(!n)return 0;let r;if(!n.maxURL)r=0;else{let e=0;n.resources.forEach(t=>{e=Math.max(e,t.length)});let i=t+`.json?icons=`;r=n.maxURL-e-n.path.length-i.length}return r}function st(e){return e===404}var ct=(e,t,n)=>{let r=[],i=ot(e,t),a=`icons`,o={type:a,provider:e,prefix:t,icons:[]},s=0;return n.forEach((n,c)=>{s+=n.length+1,s>=i&&c>0&&(r.push(o),o={type:a,provider:e,prefix:t,icons:[]},s=n.length),o.icons.push(n)}),r.push(o),r};function lt(e){if(typeof e==`string`){let t=T(e);if(t)return t.path}return`/`}var ut={prepare:ct,send:(e,t,n)=>{if(!D){n(`abort`,424);return}let r=lt(t.provider);switch(t.type){case`icons`:{let e=t.prefix,n=t.icons.join(`,`),i=new URLSearchParams({icons:n});r+=e+`.json?`+i.toString();break}case`custom`:{let e=t.uri;r+=e.slice(0,1)===`/`?e.slice(1):e;break}default:n(`abort`,400);return}let i=503;D(e+r).then(e=>{let t=e.status;if(t!==200){setTimeout(()=>{n(st(t)?`abort`:`next`,t)});return}return i=501,e.json()}).then(e=>{if(typeof e!=`object`||!e){setTimeout(()=>{e===404?n(`abort`,e):n(`next`,i)});return}setTimeout(()=>{n(`success`,e)})}).catch(()=>{n(`next`,i)})}};function dt(e,t,n){x(n||``,t).loadIcons=e}function ft(e,t,n){x(n||``,t).loadIcon=e}var pt=`data-style`,mt=``;function ht(e){mt=e}function gt(e,t){let n=Array.from(e.childNodes).find(e=>e.hasAttribute&&e.hasAttribute(pt));n||(n=document.createElement(`style`),n.setAttribute(pt,pt),e.appendChild(n)),n.textContent=`:host{display:inline-block;vertical-align:`+(t?`-0.125em`:`0`)+`}span,svg{display:block;margin:auto}`+mt}function _t(){be(``,ut),le(!0);let e;try{e=window}catch{}if(e){if(e.IconifyPreload!==void 0){let t=e.IconifyPreload,n=`Invalid IconifyPreload syntax.`;typeof t==`object`&&t&&(t instanceof Array?t:[t]).forEach(e=>{try{(typeof e!=`object`||!e||e instanceof Array||typeof e.icons!=`object`||typeof e.prefix!=`string`||!de(e))&&console.error(n)}catch{console.error(n)}})}if(e.IconifyProviders!==void 0){let t=e.IconifyProviders;if(typeof t==`object`&&t)for(let e in t){let n=`IconifyProviders[`+e+`] is invalid.`;try{let r=t[e];if(typeof r!=`object`||!r||r.resources===void 0)continue;Ee(e,r)||console.error(n)}catch{console.error(n)}}}}return{iconLoaded:fe,getIcon:pe,listIcons:ce,addIcon:ue,addCollection:de,calculateSize:Je,buildIcon:$e,iconToHTML:et,svgToURL:rt,loadIcons:Be,loadIcon:Ve,addAPIProvider:Ee,setCustomIconLoader:ft,setCustomIconsLoader:dt,appendCustomStyle:ht,_api:{getAPIConfig:T,setAPIModule:be,sendAPIQuery:Pe,setFetch:it,getFetch:at,listAPIProviders:De}}}var vt={"background-color":`currentColor`},yt={"background-color":`transparent`},bt={image:`var(--svg)`,repeat:`no-repeat`,size:`100% 100%`},xt={"-webkit-mask":vt,mask:vt,background:yt};for(let e in xt){let t=xt[e];for(let n in bt)t[e+`-`+n]=bt[n]}function St(e){return e?e+(e.match(/^[-0-9.]+$/)?`px`:``):`inherit`}function Ct(e,t,n){let r=document.createElement(`span`),i=e.body;i.indexOf(`<a`)!==-1&&(i+=`<!-- `+Date.now()+` -->`);let a=e.attributes,o=rt(et(i,{...a,width:t.width+``,height:t.height+``})),s=r.style,c={"--svg":o,width:St(a.width),height:St(a.height),...n?vt:yt};for(let e in c)s.setProperty(e,c[e]);return r}var O;function wt(){try{O=window.trustedTypes.createPolicy(`iconify`,{createHTML:e=>e})}catch{O=null}}function Tt(e){return O===void 0&&wt(),O?O.createHTML(e):e}function Et(e){let t=document.createElement(`span`),n=e.attributes,r=``;return n.width||(r=`width: inherit;`),n.height||(r+=`height: inherit;`),r&&(n.style=r),t.innerHTML=Tt(et(e.body,n)),t.firstChild}function Dt(e){return Array.from(e.childNodes).find(e=>{let t=e.tagName&&e.tagName.toUpperCase();return t===`SPAN`||t===`SVG`})}function Ot(e,t){let n=t.icon.data,r=t.customisations,a=$e(n,r);r.preserveAspectRatio&&(a.attributes.preserveAspectRatio=r.preserveAspectRatio);let o=t.renderedMode,s;switch(o){case`svg`:s=Et(a);break;default:s=Ct(a,{...i,...n},o===`mask`)}let c=Dt(e);c?s.tagName===`SPAN`&&c.tagName===s.tagName?c.setAttribute(`style`,s.getAttribute(`style`)):e.replaceChild(s,c):e.appendChild(s)}function kt(e,t,n){return{rendered:!1,inline:t,icon:e,lastRender:n&&(n.rendered?n:n.lastRender)}}function At(e=`iconify-icon`){let t,n;try{t=window.customElements,n=window.HTMLElement}catch{return}if(!t||!n)return;let r=t.get(e);if(r)return r;let i=[`icon`,`mode`,`inline`,`noobserver`,`width`,`height`,`rotate`,`flip`],a=class extends n{_shadowRoot;_initialised=!1;_state;_checkQueued=!1;_connected=!1;_observer=null;_visible=!0;constructor(){super();let e=this._shadowRoot=this.attachShadow({mode:`open`}),t=this.hasAttribute(`inline`);gt(e,t),this._state=kt({value:``},t),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return i.slice(0)}attributeChangedCallback(e){switch(e){case`inline`:{let e=this.hasAttribute(`inline`),t=this._state;e!==t.inline&&(t.inline=e,gt(this._shadowRoot,e));break}case`noobserver`:this.hasAttribute(`noobserver`)?this.startObserver():this.stopObserver();break;default:this._queueCheck()}}get icon(){let e=this.getAttribute(`icon`);if(e&&e.slice(0,1)===`{`)try{return JSON.parse(e)}catch{}return e}set icon(e){typeof e==`object`&&(e=JSON.stringify(e)),this.setAttribute(`icon`,e)}get inline(){return this.hasAttribute(`inline`)}set inline(e){e?this.setAttribute(`inline`,`true`):this.removeAttribute(`inline`)}get observer(){return this.hasAttribute(`observer`)}set observer(e){e?this.setAttribute(`observer`,`true`):this.removeAttribute(`observer`)}restartAnimation(){let e=this._state;if(e.rendered){let t=this._shadowRoot;if(e.renderedMode===`svg`)try{t.lastChild.setCurrentTime(0);return}catch{}Ot(t,e)}}get status(){let e=this._state;return e.rendered?`rendered`:e.icon.data===null?`failed`:`loading`}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;let e=this._state,t=this.getAttribute(`icon`);if(t!==e.icon.value){this._iconChanged(t);return}if(!e.rendered||!this._visible)return;let n=this.getAttribute(`mode`),r=f(this);(e.attrMode!==n||p(e.customisations,r)||!Dt(this._shadowRoot))&&this._renderIcon(e.icon,r,n)}_iconChanged(e){let t=Ue(e,(e,t,n)=>{let r=this._state;if(r.rendered||this.getAttribute(`icon`)!==e)return;let i={value:e,name:t,data:n};i.data?this._gotIconData(i):r.icon=i});t.data?this._gotIconData(t):this._state=kt(t,this._state.inline,this._state)}_forceRender(){if(!this._visible){let e=Dt(this._shadowRoot);e&&this._shadowRoot.removeChild(e);return}this._queueCheck()}_gotIconData(e){this._checkQueued=!1,this._renderIcon(e,f(this),this.getAttribute(`mode`))}_renderIcon(e,t,n){let r=Ge(e.data.body,n),i=this._state.inline;Ot(this._shadowRoot,this._state={rendered:!0,icon:e,inline:i,customisations:t,attrMode:n,renderedMode:r})}startObserver(){if(!this._observer&&!this.hasAttribute(`noobserver`))try{this._observer=new IntersectionObserver(e=>{let t=e.some(e=>e.isIntersecting);t!==this._visible&&(this._visible=t,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};i.forEach(e=>{e in a.prototype||Object.defineProperty(a.prototype,e,{get:function(){return this.getAttribute(e)},set:function(t){t===null?this.removeAttribute(e):this.setAttribute(e,t)}})});let o=_t();for(let e in o)a[e]=a.prototype[e]=o[e];return t.define(e,a),a}var{iconLoaded:jt,getIcon:Mt,listIcons:Nt,addIcon:Pt,addCollection:Ft,calculateSize:It,buildIcon:Lt,iconToHTML:Rt,svgToURL:zt,loadIcons:Bt,loadIcon:Vt,setCustomIconLoader:Ht,setCustomIconsLoader:Ut,addAPIProvider:Wt,_api:Gt}=At()||_t(),k={};function A(e,t){k[e]||(k[e]=[]),k[e].push(t)}function j(e,...t){if(k[e])for(let n of k[e])n(...t)}var Kt=0,M=[];function qt(){let e=document.getElementById(`toasts`);e&&(e.innerHTML=M.map(e=>`
    <div class="toast toast-${e.type}" data-toast-id="${e.id}">
      ${e.text}
      <button class="toast-dismiss" onclick="this.parentElement.remove()">&times;</button>
    </div>
  `).join(``))}function Jt(e,t=`info`,n=4e3){let r={id:++Kt,text:e,type:t,timestamp:Date.now()};M.push(r),qt(),setTimeout(()=>{let e=M.findIndex(e=>e.id===r.id);e>=0&&(M.splice(e,1),qt())},n)}A(`toast`,(e,t)=>{Jt(e,t||`info`)}),A(`trait-shift`,(e,t)=>{Jt(`${t>0?`+`:``}${t.toFixed(2)} ${e}`,`trait`,3e3)});var Yt=t({bar:()=>I,elementColor:()=>L,icon:()=>F,registerScene:()=>N,renderScene:()=>P,roomTypeIcon:()=>Zt}),Xt={};function N(e,t){Xt[e]=t}function P(e){let t=document.getElementById(`app`);t&&(t.innerHTML=``,Xt[e]?Xt[e]():t.innerHTML=`<div class="scene-error">Unknown scene: ${e}</div>`,j(`scene-changed`,e))}function F(e,t=24){return`<iconify-icon icon="${e}" width="${t}" height="${t}"></iconify-icon>`}function I(e,t,n,r,i=18){return`
    <div class="bar-container" style="height:${i}px">
      <div class="bar-fill" style="width:${Math.max(0,Math.min(100,e/t*100))}%;background:${n}"></div>
      <div class="bar-text">${r||`${e}/${t}`}</div>
    </div>
  `}function L(e){return{fire:`#ff6b35`,ice:`#4fc3f7`,nature:`#66bb6a`,shadow:`#9c27b0`,arcane:`#ffd54f`}[e]||`#aaa`}function Zt(e){return{combat:`game-icons:crossed-swords`,elite:`game-icons:skull-crossed-bones`,forge:`game-icons:anvil`,rest:`game-icons:campfire`,event:`game-icons:scroll-unfurled`,merchant:`game-icons:trade`,boss:`game-icons:boss-key`,training:`game-icons:target-dummy`}[e]||`game-icons:dungeon-gate`}function Qt(){return{aggression:.3,compassion:.5,cunning:.3,resilience:.4,arcaneAffinity:.2}}var $t=[{id:`rune-ember`,name:`Ember Rune`,element:`fire`,icon:`game-icons:fire-ring`,description:`A warm stone pulsing with fire energy`,discovered:!0,affinityLevel:0,affinityMilestones:[{level:25,reward:`Fire spells +20% power`,claimed:!1},{level:50,reward:`Unlock Inferno combinations`,claimed:!1},{level:75,reward:`Fire immunity aura`,claimed:!1}]},{id:`rune-frost`,name:`Frost Rune`,element:`ice`,icon:`game-icons:ice-spell-cast`,description:`A shard of perpetual ice`,discovered:!0,affinityLevel:0,affinityMilestones:[{level:25,reward:`Ice spells slow enemies`,claimed:!1},{level:50,reward:`Unlock Blizzard combinations`,claimed:!1},{level:75,reward:`Frost shield passive`,claimed:!1}]},{id:`rune-thorn`,name:`Thorn Rune`,element:`nature`,icon:`game-icons:thorny-vine`,description:`A living rune wrapped in vines`,discovered:!1,affinityLevel:0,affinityMilestones:[{level:25,reward:`Nature spells heal 10% on hit`,claimed:!1},{level:50,reward:`Unlock Entangle combinations`,claimed:!1},{level:75,reward:`Regeneration passive`,claimed:!1}]},{id:`rune-void`,name:`Void Rune`,element:`shadow`,icon:`game-icons:death-zone`,description:`A fragment of the abyss`,discovered:!1,affinityLevel:0,affinityMilestones:[{level:25,reward:`Shadow spells drain mana`,claimed:!1},{level:50,reward:`Unlock Oblivion combinations`,claimed:!1},{level:75,reward:`Shadow cloak passive`,claimed:!1}]},{id:`rune-prism`,name:`Prism Rune`,element:`arcane`,icon:`game-icons:crystal-ball`,description:`Refracts pure magical energy`,discovered:!1,affinityLevel:0,affinityMilestones:[{level:25,reward:`Arcane spells ignore 20% resist`,claimed:!1},{level:50,reward:`Unlock Prismatic combinations`,claimed:!1},{level:75,reward:`Mana regeneration passive`,claimed:!1}]}],en=[{id:`spell-spark`,name:`Spark`,elements:[`fire`],runeIds:[`rune-ember`],power:8,manaCost:5,effects:[{type:`damage`,element:`fire`,value:8,description:`Weak fire damage`}],icon:`game-icons:flame`,tier:1,ingredients:[`rune-ember`]},{id:`spell-chill`,name:`Chill Touch`,elements:[`ice`],runeIds:[`rune-frost`],power:6,manaCost:4,effects:[{type:`damage`,element:`ice`,value:6,description:`Weak ice damage`},{type:`debuff`,value:-2,duration:2,description:`Slow: -2 speed for 2 turns`}],icon:`game-icons:ice-bolt`,tier:1,ingredients:[`rune-frost`]}],tn=[{id:`skill-slash`,name:`Slash`,staminaCost:5,damage:10,effects:[{type:`damage`,value:10,description:`Physical slash`}],icon:`game-icons:broadsword`,unlocked:!0,tier:1,prerequisites:[]},{id:`skill-shield-bash`,name:`Shield Bash`,staminaCost:8,damage:6,effects:[{type:`damage`,value:6,description:`Bash + stun`},{type:`status`,value:1,duration:1,description:`Stun 1 turn`}],icon:`game-icons:shield-bash`,unlocked:!0,tier:1,prerequisites:[]},{id:`skill-power-strike`,name:`Power Strike`,staminaCost:12,damage:18,effects:[{type:`damage`,value:18,description:`Heavy physical blow`}],icon:`game-icons:sword-clash`,unlocked:!1,tier:2,prerequisites:[`skill-slash`]},{id:`skill-whirlwind`,name:`Whirlwind`,staminaCost:15,damage:12,effects:[{type:`damage`,value:12,description:`AOE physical damage`}],icon:`game-icons:spinning-sword`,unlocked:!1,tier:2,prerequisites:[`skill-slash`]},{id:`skill-execute`,name:`Execute`,staminaCost:20,damage:30,effects:[{type:`damage`,value:30,description:`Massive damage to low HP targets`}],icon:`game-icons:decapitation`,unlocked:!1,tier:3,prerequisites:[`skill-power-strike`]}],nn=[{id:`pol-heal-low`,condition:`self_hp_below_30`,action:`heal`,priority:1,enabled:!0},{id:`pol-weak-spell`,condition:`enemy_has_weakness`,action:`exploit_weakness`,priority:2,enabled:!0},{id:`pol-spell`,condition:`self_mana_above_20`,action:`cast_spell`,priority:3,enabled:!0},{id:`pol-skill`,condition:`self_stamina_above_10`,action:`use_skill`,priority:4,enabled:!0},{id:`pol-attack`,condition:`always`,action:`basic_attack`,priority:5,enabled:!0}],R=[{id:`item-health-potion`,name:`Health Potion`,category:`consumable`,icon:`game-icons:health-potion`,description:`Restores 30 HP`,quantity:1,value:15},{id:`item-mana-potion`,name:`Mana Potion`,category:`consumable`,icon:`game-icons:potion-ball`,description:`Restores 20 Mana`,quantity:1,value:12},{id:`item-stamina-tonic`,name:`Stamina Tonic`,category:`consumable`,icon:`game-icons:square-bottle`,description:`Restores 15 Stamina`,quantity:1,value:10},{id:`item-iron-sword`,name:`Iron Sword`,category:`equipment`,icon:`game-icons:pointy-sword`,description:`+5 Attack`,quantity:1,equipSlot:`main-hand`,statBonuses:{attack:5},value:30},{id:`item-wooden-shield`,name:`Wooden Shield`,category:`equipment`,icon:`game-icons:wooden-shield`,description:`+3 Defense`,quantity:1,equipSlot:`off-hand`,statBonuses:{defense:3},value:20},{id:`item-leather-armor`,name:`Leather Armor`,category:`equipment`,icon:`game-icons:leather-armor`,description:`+4 Defense, +10 Max HP`,quantity:1,equipSlot:`body`,statBonuses:{defense:4,maxHp:10},value:35},{id:`item-fire-charm`,name:`Fire Charm`,category:`equipment`,icon:`game-icons:fire-gem`,description:`+3 Attack, fire affinity boost`,quantity:1,equipSlot:`trinket`,statBonuses:{attack:3},element:`fire`,value:25},{id:`item-crystal-focus`,name:`Crystal Focus`,category:`equipment`,icon:`game-icons:crystal-wand`,description:`+15 Max Mana`,quantity:1,equipSlot:`off-hand`,statBonuses:{maxMana:15},value:40},{id:`item-steel-sword`,name:`Steel Sword`,category:`equipment`,icon:`game-icons:broadsword`,description:`+10 Attack`,quantity:1,equipSlot:`main-hand`,statBonuses:{attack:10},value:60},{id:`item-chainmail`,name:`Chainmail`,category:`equipment`,icon:`game-icons:chain-mail`,description:`+8 Defense, +20 Max HP`,quantity:1,equipSlot:`body`,statBonuses:{defense:8,maxHp:20},value:70},{id:`item-shadow-amulet`,name:`Shadow Amulet`,category:`equipment`,icon:`game-icons:gem-pendant`,description:`+5 Speed, shadow resist`,quantity:1,equipSlot:`trinket`,statBonuses:{speed:5},element:`shadow`,value:45}];function z(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m=[],h=[]){return{id:e,name:t,icon:n,description:p,xpReward:d,goldReward:f,spells:m,loot:h,stats:{hp:i,maxHp:i,mana:30,maxMana:30,stamina:20,maxStamina:20,attack:a,defense:o,speed:s,level:r,xp:0,xpToLevel:100},traits:{aggression:.5,compassion:.1,cunning:.3,resilience:.4,arcaneAffinity:.2,...c},resistances:l,weaknesses:u,actionPolicies:[{id:`${e}-pol-1`,condition:`always`,action:`basic_attack`,priority:3,enabled:!0},{id:`${e}-pol-2`,condition:`self_hp_below_30`,action:`heal`,priority:1,enabled:!0}]}}var B={slime:()=>z(`enemy-slime`,`Stone Slime`,`game-icons:gooey-daemon`,1,35,6,8,3,{resilience:.8},{fire:.5},{fire:1.5,nature:1.3},15,8,`A gelatinous creature with hardened stone skin. Physical attacks barely dent it.`,[],[{itemId:`item-health-potion`,chance:.3}]),rat:()=>z(`enemy-rat`,`Cave Rat`,`game-icons:rat`,1,20,8,3,8,{aggression:.8},{},{ice:1.3},10,5,`Quick and aggressive, attacks in flurries.`,[],[{itemId:`item-stamina-tonic`,chance:.2}]),skeleton:()=>z(`enemy-skeleton`,`Skeleton Guard`,`game-icons:skeleton`,2,45,10,6,4,{aggression:.6,resilience:.6},{shadow:.3,ice:.7},{fire:1.5,nature:1.2},20,12,`An undead sentinel. Shadow magic barely affects it.`,[],[{itemId:`item-iron-sword`,chance:.1}]),spider:()=>z(`enemy-spider`,`Venom Spider`,`game-icons:spider-alt`,2,30,12,4,7,{cunning:.7},{nature:.5},{fire:1.4},18,10,`Spits venom and webs. Nature-resistant.`,[{id:`spell-venom`,name:`Venom Spit`,elements:[`nature`],runeIds:[],power:8,manaCost:5,effects:[{type:`dot`,element:`nature`,value:3,duration:3,description:`Poison: 3 damage for 3 turns`}],icon:`game-icons:poison-bottle`,tier:1,ingredients:[]}],[{itemId:`item-mana-potion`,chance:.25}])},rn=()=>z(`enemy-golem`,`Crystal Golem`,`game-icons:rock-golem`,3,100,14,12,2,{resilience:.9,aggression:.4},{fire:.7,ice:.7,nature:.5},{shadow:1.3,arcane:1.5},50,30,`A massive golem of living crystal. Resists basic elements — only crafted or shadow/arcane spells can crack it.`,[{id:`spell-crystal-slam`,name:`Crystal Slam`,elements:[`arcane`],runeIds:[],power:15,manaCost:8,effects:[{type:`damage`,element:`arcane`,value:15,description:`Arcane slam`}],icon:`game-icons:crystal-growth`,tier:2,ingredients:[]}],[{itemId:`item-steel-sword`,chance:.5},{itemId:`item-chainmail`,chance:.3}]),V={wraith:()=>z(`enemy-wraith`,`Mirror Wraith`,`game-icons:spectre`,3,50,14,5,9,{cunning:.8},{fire:.8,ice:.8},{shadow:1.4,nature:1.2},25,15,`Reflects direct damage spells. Use status effects or physical skills.`,[{id:`spell-drain`,name:`Life Drain`,elements:[`shadow`],runeIds:[],power:10,manaCost:6,effects:[{type:`damage`,element:`shadow`,value:10,description:`Shadow drain`},{type:`heal`,value:5,description:`Heals 5 HP`}],icon:`game-icons:bleeding-wound`,tier:1,ingredients:[]}],[{itemId:`item-shadow-amulet`,chance:.15}]),gargoyle:()=>z(`enemy-gargoyle`,`Stone Gargoyle`,`game-icons:gargoyle`,3,65,12,14,3,{resilience:.9,aggression:.5},{fire:.6,ice:.6,nature:.6},{arcane:1.5},28,18,`Extremely hard. Only arcane or crafted spells pierce its defenses.`,[],[{itemId:`item-crystal-focus`,chance:.2}]),cultist:()=>z(`enemy-cultist`,`Shadow Cultist`,`game-icons:cultist`,4,40,16,6,7,{aggression:.7,arcaneAffinity:.6},{shadow:.3},{fire:1.3,nature:1.2},30,20,`Wields dark magic and is nearly immune to shadow.`,[{id:`spell-shadow-bolt`,name:`Shadow Bolt`,elements:[`shadow`],runeIds:[],power:14,manaCost:7,effects:[{type:`damage`,element:`shadow`,value:14,description:`Shadow bolt`}],icon:`game-icons:shadow-grasp`,tier:2,ingredients:[]}],[{itemId:`item-mana-potion`,chance:.3}]),mimic:()=>z(`enemy-mimic`,`Treasure Mimic`,`game-icons:treasure-map`,4,55,18,8,6,{cunning:.9},{},{fire:1.2,ice:1.2},35,25,`Disguised as a chest. Hits hard but vulnerable to elemental spells.`,[],[{itemId:`item-health-potion`,chance:.5},{itemId:`item-fire-charm`,chance:.2}])},an=()=>z(`enemy-lich`,`The Lich King`,`game-icons:crowned-skull`,5,150,20,10,6,{aggression:.6,cunning:.9,arcaneAffinity:.9},{shadow:.2,arcane:.5,fire:.7},{nature:1.5,ice:1.3},80,50,`The master of the dungeon. Absorbs shadow, resists arcane and fire. Only nature and ice combinations can defeat it.`,[{id:`spell-necrotic-wave`,name:`Necrotic Wave`,elements:[`shadow`],runeIds:[],power:20,manaCost:10,effects:[{type:`damage`,element:`shadow`,value:20,description:`Necrotic wave`},{type:`debuff`,value:-3,duration:2,description:`-3 defense for 2 turns`}],icon:`game-icons:death-zone`,tier:2,ingredients:[]},{id:`spell-soul-siphon`,name:`Soul Siphon`,elements:[`shadow`],runeIds:[],power:12,manaCost:8,effects:[{type:`damage`,element:`shadow`,value:12,description:`Drains soul`},{type:`heal`,value:10,description:`Heals 10 HP`}],icon:`game-icons:ghost`,tier:2,ingredients:[]}],[{itemId:`item-shadow-amulet`,chance:1}]),on={id:`npc-sage`,name:`Elder Sage`,icon:`game-icons:wizard-face`,portrait:`game-icons:wizard-face`,traits:{aggression:.1,compassion:.8,cunning:.6,resilience:.3,arcaneAffinity:.9},dialogue:[{id:`sage-1`,text:`Ah, another soul trapped in these depths. The Crystal Golem on this floor resists all basic elements. You will need to forge shadow or arcane spells to crack its shell.`,speaker:`Elder Sage`,choices:[{text:`Thank you for the wisdom. (Gain Prism Rune)`,effects:[{type:`rune`,id:`rune-prism`},{type:`trait`,traitKey:`compassion`,value:.1}]},{text:`I don't need your help, old man. (Gain +0.1 aggression)`,effects:[{type:`trait`,traitKey:`aggression`,value:.1}]},{text:`What else can you tell me?`,nextNodeId:`sage-2`,effects:[]}]},{id:`sage-2`,text:`The runes scattered through this dungeon hold the key. Each one you discover can be forged into new spells. But beware — the deeper floors demand adaptation. Your starter spells will not suffice.`,speaker:`Elder Sage`,choices:[{text:`I understand. (Gain 20 gold)`,effects:[{type:`gold`,value:20},{type:`trait`,traitKey:`cunning`,value:.05}]}]}]},sn={id:`npc-ghost`,name:`Tormented Spirit`,icon:`game-icons:ghost`,portrait:`game-icons:ghost`,traits:{aggression:.2,compassion:.3,cunning:.4,resilience:.1,arcaneAffinity:.7},dialogue:[{id:`ghost-1`,text:`I was once an adventurer like you... The Lich trapped my soul here. If you defeat him, I can rest. Take this — it may help against his servants.`,speaker:`Tormented Spirit`,choices:[{text:`I will free you. (Gain Void Rune)`,effects:[{type:`rune`,id:`rune-void`},{type:`quest_flag`,id:`free_ghost`},{type:`trait`,traitKey:`compassion`,value:.15}]},{text:`What's in it for me?`,nextNodeId:`ghost-2`,effects:[{type:`trait`,traitKey:`cunning`,value:.1}]}]},{id:`ghost-2`,text:`A practical one, I see. Very well — defeat the Lich and I will reveal the location of a hidden treasure cache. But take this rune regardless, you will need it.`,speaker:`Tormented Spirit`,choices:[{text:`Deal. (Gain Void Rune + 30 gold)`,effects:[{type:`rune`,id:`rune-void`},{type:`gold`,value:30},{type:`quest_flag`,id:`ghost_deal`}]}]}]},cn={id:`npc-hermit`,name:`Mushroom Hermit`,icon:`game-icons:mushroom-gills`,portrait:`game-icons:mushroom-gills`,traits:{aggression:0,compassion:.6,cunning:.8,resilience:.5,arcaneAffinity:.3},dialogue:[{id:`hermit-1`,text:`These caves... they speak to those who listen. The vines here remember. Would you like to learn their secrets?`,speaker:`Mushroom Hermit`,choices:[{text:`Teach me about nature magic. (Gain Thorn Rune)`,effects:[{type:`rune`,id:`rune-thorn`},{type:`trait`,traitKey:`arcaneAffinity`,value:.1}]},{text:`I seek strength, not botany.`,nextNodeId:`hermit-2`,effects:[{type:`trait`,traitKey:`aggression`,value:.05}]},{text:`Do you have anything to sell?`,effects:[{type:`merchant_discount`,value:10},{type:`trait`,traitKey:`cunning`,value:.05}]}]},{id:`hermit-2`,text:`Hmph. Strength fades, knowledge endures. But very well — take this health potion and be on your way.`,speaker:`Mushroom Hermit`,choices:[{text:`Thanks. (Gain Health Potion)`,effects:[{type:`item`,id:`item-health-potion`}]}]}]},ln=[{...R[0],quantity:3},{...R[1],quantity:2},{...R[2],quantity:2},{...R[3],quantity:1},{...R[4],quantity:1},{...R[5],quantity:1}],un=[{...R[0],quantity:5},{...R[1],quantity:3},{...R[8],quantity:1},{...R[9],quantity:1},{...R[7],quantity:1},{...R[10],quantity:1}];function dn(){return[{id:1,name:`The Crystal Caverns`,cleared:!1,mechanicalConstraint:`Enemies resistant to raw physical/basic damage. Require fire DoT or crafted spells.`,bossRoomId:`f1-boss`,rooms:[{id:`f1-entrance`,name:`Cavern Entrance`,type:`combat`,floor:1,description:`The entrance to the dungeon. Slimy creatures lurk here.`,icon:`game-icons:cave-entrance`,connections:[`f1-forge`,`f1-event1`],enemies:[B.slime(),B.rat()],cleared:!1,discovered:!0,gridX:2,gridY:0},{id:`f1-forge`,name:`Ancient Forge`,type:`forge`,floor:1,description:`A magical forge still burning with arcane fire.`,icon:`game-icons:anvil`,connections:[`f1-entrance`,`f1-combat2`],cleared:!1,discovered:!1,gridX:1,gridY:1},{id:`f1-event1`,name:`Sage's Alcove`,type:`event`,floor:1,description:`An old sage sits in a quiet alcove.`,icon:`game-icons:scroll-unfurled`,connections:[`f1-entrance`,`f1-merchant`],npc:on,cleared:!1,discovered:!1,gridX:3,gridY:1,runeReward:`rune-prism`},{id:`f1-combat2`,name:`Spider Nest`,type:`combat`,floor:1,description:`Webs everywhere. Spiders descend from the ceiling.`,icon:`game-icons:spider-web`,connections:[`f1-forge`,`f1-rest`],enemies:[B.spider(),B.spider()],cleared:!1,discovered:!1,gridX:0,gridY:2},{id:`f1-merchant`,name:`Wandering Trader`,type:`merchant`,floor:1,description:`A hooded merchant with a large pack.`,icon:`game-icons:trade`,connections:[`f1-event1`,`f1-elite`],merchantStock:ln,cleared:!1,discovered:!1,gridX:4,gridY:2},{id:`f1-rest`,name:`Underground Spring`,type:`rest`,floor:1,description:`A peaceful underground spring. Rest here to recover.`,icon:`game-icons:campfire`,connections:[`f1-combat2`,`f1-elite`],cleared:!1,discovered:!1,gridX:1,gridY:3},{id:`f1-elite`,name:`Skeleton Hall`,type:`elite`,floor:1,description:`Ranks of skeleton guards stand watch. They resist shadow and ice.`,icon:`game-icons:skeleton-inside`,connections:[`f1-merchant`,`f1-rest`,`f1-training`,`f1-boss`],enemies:[B.skeleton(),B.skeleton(),B.rat()],cleared:!1,discovered:!1,gridX:3,gridY:3},{id:`f1-training`,name:`Training Grounds`,type:`training`,floor:1,description:`Practice dummies stand ready. Train your spells safely.`,icon:`game-icons:target-dummy`,connections:[`f1-elite`],enemies:[z(`enemy-dummy`,`Training Dummy`,`game-icons:target-dummy`,1,999,0,0,0,{},{},{},2,0,`A wooden dummy. Does not attack. Perfect for training affinities.`)],cleared:!1,discovered:!1,gridX:2,gridY:4},{id:`f1-boss`,name:`Crystal Chamber`,type:`boss`,floor:1,description:`A massive crystal golem guards the passage deeper.`,icon:`game-icons:boss-key`,connections:[`f1-elite`],enemies:[rn()],cleared:!1,discovered:!1,gridX:3,gridY:5}]},{id:2,name:`The Shadow Depths`,cleared:!1,mechanicalConstraint:`Enemies reflect direct damage. Use status effects, indirect damage, or physical skills.`,bossRoomId:`f2-boss`,rooms:[{id:`f2-entrance`,name:`Descent Stairs`,type:`combat`,floor:2,description:`Dark stairs leading deeper. Wraiths drift in the shadows.`,icon:`game-icons:stone-stairs`,connections:[`f2-event1`,`f2-forge`],enemies:[V.wraith(),V.cultist()],cleared:!1,discovered:!0,gridX:2,gridY:0},{id:`f2-event1`,name:`Spirit's Rest`,type:`event`,floor:2,description:`A ghost lingers, seeking aid.`,icon:`game-icons:haunting`,connections:[`f2-entrance`,`f2-combat2`],npc:sn,cleared:!1,discovered:!1,gridX:1,gridY:1,runeReward:`rune-void`},{id:`f2-forge`,name:`Shadow Forge`,type:`forge`,floor:2,description:`A forge powered by shadow energy.`,icon:`game-icons:anvil-impact`,connections:[`f2-entrance`,`f2-merchant`],cleared:!1,discovered:!1,gridX:3,gridY:1},{id:`f2-combat2`,name:`Gargoyle Gallery`,type:`combat`,floor:2,description:`Stone gargoyles line the walls. Some are not as still as they seem.`,icon:`game-icons:gargoyle`,connections:[`f2-event1`,`f2-rest`],enemies:[V.gargoyle(),V.gargoyle()],cleared:!1,discovered:!1,gridX:0,gridY:2},{id:`f2-merchant`,name:`Black Market`,type:`merchant`,floor:2,description:`A cloaked figure sells rare goods.`,icon:`game-icons:shop`,connections:[`f2-forge`,`f2-elite`],merchantStock:un,cleared:!1,discovered:!1,gridX:4,gridY:2},{id:`f2-rest`,name:`Fungal Grotto`,type:`rest`,floor:2,description:`Glowing mushrooms provide warmth. A hermit lives here.`,icon:`game-icons:mushroom-house`,connections:[`f2-combat2`,`f2-elite`],npc:cn,cleared:!1,discovered:!1,gridX:1,gridY:3},{id:`f2-elite`,name:`Mimic Treasury`,type:`elite`,floor:2,description:`Chests and treasures — but which are real?`,icon:`game-icons:locked-chest`,connections:[`f2-merchant`,`f2-rest`,`f2-training`,`f2-boss`],enemies:[V.mimic(),V.mimic(),V.cultist()],cleared:!1,discovered:!1,gridX:3,gridY:3},{id:`f2-training`,name:`Dark Training Hall`,type:`training`,floor:2,description:`Shadow-infused training dummies.`,icon:`game-icons:target-dummy`,connections:[`f2-elite`],enemies:[z(`enemy-dummy2`,`Shadow Dummy`,`game-icons:target-dummy`,1,999,0,0,0,{},{},{},3,0,`A shadow-infused dummy. Does not attack.`)],cleared:!1,discovered:!1,gridX:2,gridY:4},{id:`f2-boss`,name:`Lich's Throne`,type:`boss`,floor:2,description:`The Lich King sits on a throne of bones. This is the final challenge.`,icon:`game-icons:skull-throne`,connections:[`f2-elite`],enemies:[an()],cleared:!1,discovered:!1,gridX:3,gridY:5}]}]}var fn=[{ingredients:[`rune-ember`,`rune-frost`],result:{name:`Frostfire Bolt`,elements:[`fire`,`ice`],power:18,manaCost:10,effects:[{type:`damage`,element:`fire`,value:10,description:`Fire damage`},{type:`damage`,element:`ice`,value:8,description:`Ice damage`},{type:`debuff`,value:-2,duration:2,description:`Slow for 2 turns`}],icon:`game-icons:fire-dash`,tier:2}},{ingredients:[`rune-ember`,`rune-thorn`],result:{name:`Wildfire Bloom`,elements:[`fire`,`nature`],power:16,manaCost:9,effects:[{type:`damage`,element:`fire`,value:8,description:`Fire burst`},{type:`dot`,element:`nature`,value:4,duration:3,description:`Burning vines: 4 damage for 3 turns`}],icon:`game-icons:fire-flower`,tier:2}},{ingredients:[`rune-frost`,`rune-thorn`],result:{name:`Frozen Thorns`,elements:[`ice`,`nature`],power:15,manaCost:8,effects:[{type:`damage`,element:`ice`,value:7,description:`Ice spike`},{type:`damage`,element:`nature`,value:8,description:`Thorn pierce`},{type:`status`,value:1,duration:1,description:`Root for 1 turn`}],icon:`game-icons:thorn-arrow`,tier:2}},{ingredients:[`rune-ember`,`rune-void`],result:{name:`Shadowflame`,elements:[`fire`,`shadow`],power:22,manaCost:12,effects:[{type:`damage`,element:`fire`,value:12,description:`Shadowflame`},{type:`damage`,element:`shadow`,value:10,description:`Shadow burn`},{type:`debuff`,value:-3,duration:2,description:`-3 defense for 2 turns`}],icon:`game-icons:fire-breath`,tier:2}},{ingredients:[`rune-frost`,`rune-void`],result:{name:`Void Chill`,elements:[`ice`,`shadow`],power:20,manaCost:11,effects:[{type:`damage`,element:`shadow`,value:12,description:`Void freeze`},{type:`dot`,element:`ice`,value:3,duration:4,description:`Frostbite: 3 damage for 4 turns`}],icon:`game-icons:frozen-orb`,tier:2}},{ingredients:[`rune-thorn`,`rune-void`],result:{name:`Death Blossom`,elements:[`nature`,`shadow`],power:19,manaCost:10,effects:[{type:`damage`,element:`nature`,value:10,description:`Toxic bloom`},{type:`damage`,element:`shadow`,value:9,description:`Shadow drain`},{type:`heal`,value:8,description:`Drain heal 8 HP`}],icon:`game-icons:carnivorous-plant`,tier:2}},{ingredients:[`rune-prism`,`rune-ember`],result:{name:`Prismatic Flare`,elements:[`arcane`,`fire`],power:24,manaCost:14,effects:[{type:`damage`,element:`arcane`,value:14,description:`Prismatic fire`},{type:`damage`,element:`fire`,value:10,description:`Fire burst`}],icon:`game-icons:crystal-shine`,tier:2}},{ingredients:[`rune-prism`,`rune-frost`],result:{name:`Crystal Storm`,elements:[`arcane`,`ice`],power:22,manaCost:13,effects:[{type:`damage`,element:`arcane`,value:12,description:`Crystal shards`},{type:`damage`,element:`ice`,value:10,description:`Ice storm`},{type:`debuff`,value:-4,duration:2,description:`-4 speed for 2 turns`}],icon:`game-icons:crystal-cluster`,tier:2}},{ingredients:[`rune-prism`,`rune-void`],result:{name:`Oblivion Ray`,elements:[`arcane`,`shadow`],power:28,manaCost:16,effects:[{type:`damage`,element:`arcane`,value:16,description:`Arcane annihilation`},{type:`damage`,element:`shadow`,value:12,description:`Shadow obliteration`}],icon:`game-icons:laser-blast`,tier:3}},{ingredients:[`rune-prism`,`rune-thorn`],result:{name:`Living Crystal`,elements:[`arcane`,`nature`],power:20,manaCost:12,effects:[{type:`damage`,element:`arcane`,value:10,description:`Crystal growth`},{type:`heal`,value:12,description:`Nature restore 12 HP`},{type:`buff`,value:3,duration:3,description:`+3 defense for 3 turns`}],icon:`game-icons:crystal-growth`,tier:2}},{ingredients:[`spell-spark`,`rune-frost`],result:{name:`Frostfall Ember`,elements:[`fire`,`ice`],power:20,manaCost:11,effects:[{type:`damage`,element:`fire`,value:12,description:`Evolved fire`},{type:`dot`,element:`ice`,value:4,duration:3,description:`Frostburn: 4 damage for 3 turns`}],icon:`game-icons:fire-dash`,tier:2}},{ingredients:[`spell-chill`,`rune-ember`],result:{name:`Steamblast`,elements:[`ice`,`fire`],power:19,manaCost:10,effects:[{type:`damage`,element:`ice`,value:10,description:`Steam explosion`},{type:`damage`,element:`fire`,value:9,description:`Heat wave`}],icon:`game-icons:fire-wave`,tier:2}}],H=`escape-dungeon-v12-save`,U=null;function pn(){return{name:`Adventurer`,stats:{hp:80,maxHp:80,mana:40,maxMana:40,stamina:30,maxStamina:30,attack:8,defense:5,speed:5,level:1,xp:0,xpToLevel:50},traits:Qt(),runes:$t.map(e=>({...e,affinityMilestones:e.affinityMilestones.map(e=>({...e}))})),spells:en.map(e=>({...e,effects:e.effects.map(e=>({...e}))})),physicalSkills:tn.map(e=>({...e,effects:e.effects.map(e=>({...e}))})),spellLoadout:[en[0].id,en[1].id,null,null],skillLoadout:[tn[0].id,tn[1].id,null],actionPolicies:nn.map(e=>({...e})),inventory:[{id:`item-health-potion`,name:`Health Potion`,category:`consumable`,icon:`game-icons:health-potion`,description:`Restores 30 HP`,quantity:2,value:15},{id:`item-mana-potion`,name:`Mana Potion`,category:`consumable`,icon:`game-icons:potion-ball`,description:`Restores 20 Mana`,quantity:1,value:12}],equipment:{"main-hand":null,"off-hand":null,body:null,trinket:null},gold:30,currentFloor:1,currentRoomId:`f1-entrance`,questFlags:{},discoveredRunes:[`rune-ember`,`rune-frost`],gameClockStart:Date.now()}}function mn(){return U={player:pn(),floors:dn(),started:!0,gameOver:!1,victory:!1,currentScene:`map`,combatLog:[],combatPaused:!1,combatActive:!1},G(),U}function W(){if(!U)throw Error(`Game not initialized`);return U}function hn(){return localStorage.getItem(H)!==null}function G(){U&&localStorage.setItem(H,JSON.stringify(U))}function gn(){let e=localStorage.getItem(H);if(!e)return null;try{return U=JSON.parse(e),U}catch{return null}}function _n(){localStorage.removeItem(H)}function vn(){let e=W();return e.floors.find(t=>t.id===e.player.currentFloor)}function K(){return vn().rooms.find(e=>e.id===W().player.currentRoomId)}function yn(){let e=W();return e.player.spellLoadout.filter(e=>e!==null).map(t=>e.player.spells.find(e=>e.id===t)).filter(e=>e!==void 0)}function bn(){let e=W();return e.player.skillLoadout.filter(e=>e!==null).map(t=>e.player.physicalSkills.find(e=>e.id===t)).filter(e=>e!==void 0)}function xn(e){let t=W(),n=t.player.inventory.find(t=>t.id===e.id);n?n.quantity+=e.quantity:t.player.inventory.push({...e}),j(`state-changed`)}function Sn(e,t=1){let n=W(),r=n.player.inventory.find(t=>t.id===e);return!r||r.quantity<t?!1:(r.quantity-=t,r.quantity<=0&&(n.player.inventory=n.player.inventory.filter(t=>t.id!==e)),j(`state-changed`),!0)}function Cn(e){let t=W();if(t.player.discoveredRunes.includes(e))return;t.player.discoveredRunes.push(e);let n=t.player.runes.find(t=>t.id===e);n&&(n.discovered=!0,j(`toast`,`Discovered: ${n.name}!`,`success`)),j(`state-changed`)}function q(e,t){let n=W();n.player.traits[e]!==void 0&&(n.player.traits[e]=Math.max(0,Math.min(1,n.player.traits[e]+t)),j(`trait-shift`,e,t),j(`state-changed`))}function wn(e){let t=W();for(t.player.stats.xp+=e;t.player.stats.xp>=t.player.stats.xpToLevel;){t.player.stats.xp-=t.player.stats.xpToLevel,t.player.stats.level++,t.player.stats.maxHp+=10,t.player.stats.hp=t.player.stats.maxHp,t.player.stats.maxMana+=5,t.player.stats.mana=t.player.stats.maxMana,t.player.stats.maxStamina+=3,t.player.stats.stamina=t.player.stats.maxStamina,t.player.stats.attack+=2,t.player.stats.defense+=1,t.player.stats.speed+=1,t.player.stats.xpToLevel=Math.floor(t.player.stats.xpToLevel*1.5),j(`toast`,`Level Up! Now level ${t.player.stats.level}`,`success`);for(let e of t.player.physicalSkills)!e.unlocked&&e.tier<=t.player.stats.level&&e.prerequisites.every(e=>t.player.physicalSkills.find(t=>t.id===e)?.unlocked)&&(e.unlocked=!0,j(`toast`,`Skill Unlocked: ${e.name}!`,`success`))}j(`state-changed`)}function Tn(e,t=3){let n=W();for(let r of e.runeIds){let e=n.player.runes.find(e=>e.id===r);if(e&&e.discovered){e.affinityLevel=Math.min(100,e.affinityLevel+t);for(let t of e.affinityMilestones)!t.claimed&&e.affinityLevel>=t.level&&(t.claimed=!0,j(`toast`,`${e.name} Affinity ${t.level}: ${t.reward}`,`success`))}}j(`state-changed`)}function J(){let e=W(),t={...e.player.stats};for(let n of Object.values(e.player.equipment))if(n?.statBonuses)for(let[e,r]of Object.entries(n.statBonuses))r&&e in t&&(t[e]+=r);for(let t of e.player.runes)t.discovered&&t.affinityLevel;return t}var En=`modulepreload`,Dn=function(e,t){return new URL(e,t).href},On={},kn=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}r=o(t.map(t=>{if(t=Dn(t,n),t in On)return;On[t]=!0;let r=t.endsWith(`.css`),i=r?`[rel="stylesheet"]`:``;if(n)for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}else if(document.querySelector(`link[href="${t}"]${i}`))return;let o=document.createElement(`link`);if(o.rel=r?`stylesheet`:En,r||(o.as=`script`),o.crossOrigin=``,o.href=t,a&&o.setAttribute(`nonce`,a),document.head.appendChild(o),r)return new Promise((e,n)=>{o.addEventListener(`load`,e),o.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},An=[`title`,`victory`];function jn(){A(`scene-changed`,Nn),A(`state-changed`,()=>{try{let e=W();An.includes(e.currentScene)||Nn(e.currentScene)}catch{}})}function Mn(){try{let e=W(),t=Date.now()-e.player.gameClockStart,n=Math.floor(t/36e5),r=Math.floor(t%36e5/6e4),i=n%24<6?`Night`:n%24<12?`Morning`:n%24<18?`Afternoon`:`Evening`;return`Day ${Math.floor(n/24)+1} — ${i} (${n}h ${r}m)`}catch{return``}}function Nn(e){let t=document.getElementById(`hud`);if(!t)return;if(An.includes(e||``)){t.classList.add(`hidden`);return}let n;try{n=W()}catch{t.classList.add(`hidden`);return}t.classList.remove(`hidden`);let r=J();t.innerHTML=`
    <div class="hud-row">
      <div class="hud-name">${F(`game-icons:person`,20)} ${n.player.name} <span class="hud-level">Lv.${r.level}</span></div>
      <div class="hud-floor">${F(`game-icons:stairs`,18)} Floor ${n.player.currentFloor}</div>
      <div class="hud-gold">${F(`game-icons:coins`,18)} ${n.player.gold}g</div>
      <div class="hud-time">${F(`game-icons:sundial`,18)} ${Mn()}</div>
      <div class="hud-xp">${I(n.player.stats.xp,n.player.stats.xpToLevel,`#ffd54f`,`XP ${n.player.stats.xp}/${n.player.stats.xpToLevel}`,14)}</div>
    </div>
    <div class="hud-row hud-bars">
      <div class="hud-bar-group">
        <span class="hud-bar-label">${F(`game-icons:hearts`,16)} HP</span>
        ${I(n.player.stats.hp,r.maxHp,`#e53935`)}
      </div>
      <div class="hud-bar-group">
        <span class="hud-bar-label">${F(`game-icons:spell-book`,16)} Mana</span>
        ${I(n.player.stats.mana,r.maxMana,`#1e88e5`)}
      </div>
      <div class="hud-bar-group">
        <span class="hud-bar-label">${F(`game-icons:running-shoe`,16)} Stam</span>
        ${I(n.player.stats.stamina,r.maxStamina,`#43a047`)}
      </div>
    </div>
    <div class="hud-row hud-nav-buttons">
      <button class="hud-btn" data-scene="map">${F(`game-icons:treasure-map`,16)} Map</button>
      <button class="hud-btn" data-scene="inventory">${F(`game-icons:knapsack`,16)} Bag</button>
      <button class="hud-btn" data-scene="character">${F(`game-icons:character-sheet`,16)} Stats</button>
      <button class="hud-btn" data-scene="loadout">${F(`game-icons:spell-book`,16)} Loadout</button>
    </div>
  `,t.querySelectorAll(`.hud-btn`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.scene;if(t){let{renderScene:e}=await kn(async()=>{let{renderScene:e}=await Promise.resolve().then(()=>Yt);return{renderScene:e}},void 0,import.meta.url);n.currentScene=t,e(t)}})})}N(`title`,()=>{let e=document.getElementById(`app`),t=hn();e.innerHTML=`
    <div class="scene title-scene">
      <div class="title-logo">
        ${F(`game-icons:dungeon-gate`,80)}
        <h1>Escape the Dungeon</h1>
        <p class="title-subtitle">Forge your path. Craft your power. Survive.</p>
      </div>
      <div class="title-menu">
        <button class="btn btn-primary btn-large" id="btn-new-game">
          ${F(`game-icons:sword-brandish`,24)} New Game
        </button>
        ${t?`
          <button class="btn btn-secondary btn-large" id="btn-continue">
            ${F(`game-icons:save`,24)} Continue
          </button>
        `:``}
      </div>
      <div class="title-footer">
        <p>A roguelike dungeon crawler — v12 GAD Eval</p>
      </div>
    </div>
  `,document.getElementById(`btn-new-game`)?.addEventListener(`click`,()=>{let e=mn();e.currentScene=`map`,P(`map`)}),document.getElementById(`btn-continue`)?.addEventListener(`click`,()=>{let e=gn();e&&(e.currentScene=`map`,P(`map`))})}),N(`map`,()=>{let e=document.getElementById(`app`),t=W(),n=vn(),r=K();for(let e of r.connections){let t=n.rooms.find(t=>t.id===e);t&&!t.discovered&&(t.discovered=!0)}let i=Math.max(...n.rooms.filter(e=>e.discovered).map(e=>e.gridX)),a=Math.max(...n.rooms.filter(e=>e.discovered).map(e=>e.gridY)),o=`<div class="map-grid">`;for(let e=0;e<=a;e++)for(let t=0;t<=i+1;t++){let i=n.rooms.find(n=>n.discovered&&n.gridX===t&&n.gridY===e);if(i){let n=i.id===r.id,a=r.connections.includes(i.id),s=[`map-room`,`room-type-${i.type}`,n?`map-room-current`:``,i.cleared?`map-room-cleared`:``,a?`map-room-connected`:``].filter(Boolean).join(` `);o+=`
          <div class="${s}" data-room-id="${i.id}" style="grid-column:${t+1};grid-row:${e+1}" title="${i.name} (${i.type})">
            <div class="map-room-icon">${F(i.icon||Zt(i.type),28)}</div>
            <div class="map-room-name">${i.name}</div>
            ${n?`<div class="map-player-marker">${F(`game-icons:person`,16)}</div>`:``}
            ${i.cleared?`<div class="map-cleared-mark">&#10003;</div>`:``}
          </div>
        `}else o+=`<div class="map-empty" style="grid-column:${t+1};grid-row:${e+1}"></div>`}o+=`</div>`,e.innerHTML=`
    <div class="scene map-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:treasure-map`,28)} ${n.name} — Floor ${n.id}</h2>
        <p class="floor-constraint">${F(`game-icons:info`,16)} ${n.mechanicalConstraint}</p>
      </div>
      ${o}
      <div class="room-info-panel">
        <h3>${F(r.icon||Zt(r.type),24)} ${r.name}</h3>
        <p class="room-type-badge room-type-${r.type}">${r.type.toUpperCase()}</p>
        <p>${r.description}</p>
        ${r.cleared?`<p class="cleared-text">&#10003; Cleared</p>`:`<button class="btn btn-primary" id="btn-enter-room">${F(`game-icons:door`,20)} Enter Room</button>`}
      </div>
    </div>
  `,e.querySelectorAll(`.map-room-connected`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.roomId;n&&n!==r.id&&(t.player.currentRoomId=n,t.currentScene=`map`,G(),P(`map`),j(`state-changed`))})}),document.getElementById(`btn-enter-room`)?.addEventListener(`click`,()=>{Pn(r.type)})});function Pn(e){let t=W();switch(e){case`combat`:case`elite`:case`boss`:case`training`:t.currentScene=`combat`,P(`combat`);break;case`forge`:t.currentScene=`forge`,P(`forge`);break;case`rest`:t.currentScene=`rest`,P(`rest`);break;case`event`:t.currentScene=`dialogue`,P(`dialogue`);break;case`merchant`:t.currentScene=`merchant`,P(`merchant`);break;default:t.currentScene=`map`,P(`map`)}}var Y=null;function X(e,t=`info`){Y&&Y.log.push({text:e,type:t,timestamp:Date.now()})}function Fn(e,t){let n=W(),r=0;for(let i of e.effects){let a=t.resistances[i.element||``]??1,o=t.weaknesses[i.element||``]??1,s=In(e,n);switch(i.type){case`damage`:{let n=Math.max(1,Math.floor(i.value*o*(1/Math.max(.1,a))*s));t.currentHp-=n,r+=n,X(`${e.name} deals ${n} ${i.element||``} damage to ${t.name}`,`damage`);break}case`dot`:t.dots.push({element:i.element||``,damage:Math.floor(i.value*s),turns:i.duration||3}),X(`${t.name} is afflicted with ${i.description}`,`status`);break;case`heal`:{let t=Math.floor(i.value*s);n.player.stats.hp=Math.min(n.player.stats.maxHp,n.player.stats.hp+t),X(`${e.name} heals you for ${t} HP`,`heal`);break}case`debuff`:t.debuffs.push({stat:`defense`,value:i.value,turns:i.duration||2}),X(`${t.name}: ${i.description}`,`status`);break;case`buff`:Y.playerBuffs.push({stat:`defense`,value:i.value,turns:i.duration||2}),X(`You gain: ${i.description}`,`status`);break;case`status`:(i.description.toLowerCase().includes(`stun`)||i.description.toLowerCase().includes(`root`))&&(t.stunned+=i.duration||1,X(`${t.name} is ${i.description}`,`status`));break}}return r}function In(e,t){let n=1;for(let r of e.runeIds){let e=t.player.runes.find(e=>e.id===r);e&&e.discovered&&e.affinityLevel>=25&&(n+=.2),e&&e.discovered&&e.affinityLevel>=50&&(n+=.15)}return n}function Ln(){if(!Y||Y.victory||Y.defeat||Y.paused)return;let e=W(),t=J(),n=yn(),r=bn(),i=e.player.actionPolicies.filter(e=>e.enabled).sort((e,t)=>e.priority-t.priority),a=0;for(let e of Y.playerBuffs)a+=e.value;for(let t of Y.playerDots){let n=t.damage;e.player.stats.hp-=n,X(`You take ${n} ${t.element} damage from ongoing effect`,`damage`),t.turns--}if(Y.playerDots=Y.playerDots.filter(e=>e.turns>0),e.player.stats.hp<=0){Y.defeat=!0,X(`You have been defeated!`,`info`);return}let o=Y.enemies.find(e=>e.currentHp>0);if(!o){Y.victory=!0;return}for(let e of i)if(Rn(e,o,n,r,t))break}function Rn(e,t,n,r,i){let a=W();switch(e.condition){case`self_hp_below_30`:if(a.player.stats.hp>a.player.stats.maxHp*.3)return!1;let e=n.find(e=>e.effects.some(e=>e.type===`heal`)&&a.player.stats.mana>=e.manaCost);if(e)return a.player.stats.mana-=e.manaCost,Fn(e,t),Tn(e),q(`resilience`,.02),!0;let o=a.player.inventory.find(e=>e.id===`item-health-potion`&&e.quantity>0);return o?(o.quantity--,a.player.stats.hp=Math.min(a.player.stats.maxHp,a.player.stats.hp+30),X(`You drink a Health Potion (restore 30 HP)`,`heal`),!0):!1;case`enemy_has_weakness`:for(let e of n)if(!(a.player.stats.mana<e.manaCost)&&e.elements.some(e=>(t.weaknesses[e]??1)>1))return a.player.stats.mana-=e.manaCost,X(`[Policy: Exploit Weakness] Casting ${e.name}`,`action`),Fn(e,t),Tn(e),q(`cunning`,.02),!0;return!1;case`self_mana_above_20`:if(a.player.stats.mana<a.player.stats.maxMana*.2)return!1;let s=n.filter(e=>a.player.stats.mana>=e.manaCost).sort((e,t)=>t.power-e.power)[0];return s?(a.player.stats.mana-=s.manaCost,X(`[Policy: Cast Spell] Casting ${s.name}`,`action`),Fn(s,t),Tn(s),q(`arcaneAffinity`,.01),!0):!1;case`self_stamina_above_10`:if(a.player.stats.stamina<10)return!1;let c=r.filter(e=>e.unlocked&&a.player.stats.stamina>=e.staminaCost).sort((e,t)=>t.damage-e.damage)[0];if(c){a.player.stats.stamina-=c.staminaCost;let e=Math.max(1,c.damage+i.attack-(t.stats.defense||0));t.currentHp-=e,X(`[Policy: Use Skill] ${c.name} deals ${e} physical damage to ${t.name}`,`damage`);for(let e of c.effects)e.type===`status`&&e.description.toLowerCase().includes(`stun`)&&(t.stunned+=e.duration||1,X(`${t.name} is stunned for ${e.duration||1} turn(s)`,`status`));return q(`aggression`,.02),!0}return!1;case`always`:let l=Math.max(1,i.attack-(t.stats.defense||0));return t.currentHp-=l,X(`Basic Attack deals ${l} damage to ${t.name}`,`damage`),q(`aggression`,.01),!0}return!1}function zn(e){if(!Y||Y.victory||Y.defeat)return;let t=W();for(let t of e.dots){let n=t.damage;e.currentHp-=n,X(`${e.name} takes ${n} ${t.element} damage from ongoing effect`,`damage`),t.turns--}e.dots=e.dots.filter(e=>e.turns>0);for(let t of e.debuffs)t.turns--;if(e.debuffs=e.debuffs.filter(e=>e.turns>0),!(e.currentHp<=0)){if(e.stunned>0){e.stunned--,X(`${e.name} is stunned and cannot act`,`status`);return}if(e.stats.attack!==0){if(e.traits.aggression>.6)if(e.spells.length>0&&e.stats.mana>=e.spells[0].manaCost){let n=e.spells[0];e.stats.mana-=n.manaCost;let r=0;for(let i of n.effects)i.type===`damage`&&(r+=i.value,t.player.stats.hp-=i.value),i.type===`debuff`&&(Y.playerDots.push({element:``,damage:0,turns:0}),X(`${e.name}'s ${n.name}: ${i.description}`,`status`)),i.type===`heal`&&(e.currentHp=Math.min(e.stats.maxHp,e.currentHp+i.value),X(`${e.name} heals for ${i.value}`,`heal`));r>0&&X(`${e.name} casts ${n.name} for ${r} damage`,`damage`)}else{let n=Math.max(1,e.stats.attack-J().defense);t.player.stats.hp-=n,X(`${e.name} attacks for ${n} damage`,`damage`)}else if(e.traits.cunning>.6)if(e.spells.length>0&&e.stats.mana>=e.spells[0].manaCost){let n=e.spells[Math.floor(Math.random()*e.spells.length)];if(e.stats.mana>=n.manaCost){e.stats.mana-=n.manaCost;let r=0;for(let i of n.effects)i.type===`damage`&&(r+=i.value,t.player.stats.hp-=i.value),i.type===`dot`&&(Y.playerDots.push({element:i.element||``,damage:i.value,turns:i.duration||3}),X(`You are afflicted: ${i.description}`,`status`)),i.type===`heal`&&(e.currentHp=Math.min(e.stats.maxHp,e.currentHp+i.value),X(`${e.name} heals ${i.value}`,`heal`));r>0&&X(`${e.name} casts ${n.name} for ${r} damage`,`damage`)}}else{let n=Math.max(1,e.stats.attack-J().defense);t.player.stats.hp-=n,X(`${e.name} attacks for ${n} damage`,`damage`)}else{let n=Math.max(1,e.stats.attack-J().defense);t.player.stats.hp-=n,X(`${e.name} attacks for ${n} damage`,`damage`)}e.traits.resilience<.3&&e.currentHp<e.stats.maxHp*.2&&(X(`${e.name} attempts to flee!`,`info`),Math.random()<.5&&(e.currentHp=0,X(`${e.name} flees the battle!`,`info`))),t.player.stats.hp<=0&&(Y.defeat=!0,X(`You have been defeated!`,`info`))}}}function Bn(){if(!Y||Y.paused||Y.victory||Y.defeat)return;if(Y.turn++,X(`--- Turn ${Y.turn} ---`,`info`),Ln(),Y.victory||Y.defeat){Vn();return}for(let e of Y.enemies)if(e.currentHp>0&&(zn(e),Y.defeat)){Vn();return}Y.enemies.every(e=>e.currentHp<=0)&&(Y.victory=!0);for(let e of Y.playerBuffs)e.turns--;Y.playerBuffs=Y.playerBuffs.filter(e=>e.turns>0);let e=W();e.player.stats.stamina=Math.min(e.player.stats.maxStamina,e.player.stats.stamina+2),Y.victory||Y.defeat?Vn():Z()}function Vn(){Y&&(Y.running=!1,Y.interval&&(clearInterval(Y.interval),Y.interval=null),Z())}function Hn(){Y&&(Y.running=!0,Y.paused=!1,Y.interval=setInterval(()=>{Y&&!Y.paused&&!Y.victory&&!Y.defeat&&Bn()},1200))}function Un(){Y&&(Y.paused=!0,X(`--- PAUSED --- Adjust your loadout and policies`,`info`),Z())}function Wn(){Y&&(Y.paused=!1,X(`--- RESUMED ---`,`info`))}function Z(){if(!Y)return;let e=document.getElementById(`app`),t=W(),n=K(),r=J(),i=Y.enemies.map(e=>`
    <div class="combat-entity combat-enemy ${e.currentHp<=0?`defeated`:``}">
      <div class="entity-icon enemy-icon">${F(e.icon,48)}</div>
      <div class="entity-info">
        <div class="entity-name">${e.name} <span class="entity-level">Lv.${e.stats.level}</span></div>
        ${I(Math.max(0,e.currentHp),e.stats.maxHp,`#e53935`,`HP ${Math.max(0,e.currentHp)}/${e.stats.maxHp}`)}
        <div class="entity-traits">
          ${Object.entries(e.traits).filter(([e,t])=>t>.4).map(([e,t])=>`<span class="trait-badge">${e}: ${t.toFixed(1)}</span>`).join(``)}
        </div>
        ${e.dots.length>0?`<div class="status-effects">${e.dots.map(e=>`<span class="dot-badge" style="color:${L(e.element)}">${e.element} ${e.damage}/t (${e.turns})</span>`).join(``)}</div>`:``}
        ${e.stunned>0?`<span class="stunned-badge">STUNNED</span>`:``}
        <div class="enemy-resists">
          ${Object.entries(e.resistances).filter(([e,t])=>t<1).map(([e,t])=>`<span class="resist-badge" style="color:${L(e)}">Resist ${e} ${Math.round((1-t)*100)}%</span>`).join(``)}
          ${Object.entries(e.weaknesses).filter(([e,t])=>t>1).map(([e,t])=>`<span class="weak-badge" style="color:${L(e)}">Weak ${e} +${Math.round((t-1)*100)}%</span>`).join(``)}
        </div>
      </div>
    </div>
  `).join(``),a=Y.log.slice(-15).map(e=>`<div class="log-entry log-${e.type}">${e.text}</div>`).join(``),o=yn(),s=bn();e.innerHTML=`
    <div class="scene combat-scene">
      <div class="combat-header">
        <h2>${F(n.icon,24)} ${n.name} — ${n.type.toUpperCase()} Encounter</h2>
        <div class="combat-turn">Turn ${Y.turn}</div>
      </div>

      <div class="combat-arena">
        <div class="combat-player">
          <div class="entity-icon player-icon">${F(`game-icons:knight-banner`,48)}</div>
          <div class="entity-info">
            <div class="entity-name">${t.player.name} <span class="entity-level">Lv.${r.level}</span></div>
            ${I(t.player.stats.hp,r.maxHp,`#e53935`,`HP ${t.player.stats.hp}/${r.maxHp}`)}
            ${I(t.player.stats.mana,r.maxMana,`#1e88e5`,`MP ${t.player.stats.mana}/${r.maxMana}`)}
            ${I(t.player.stats.stamina,r.maxStamina,`#43a047`,`SP ${t.player.stats.stamina}/${r.maxStamina}`)}
          </div>
        </div>
        <div class="combat-vs">${F(`game-icons:crossed-swords`,32)}</div>
        <div class="combat-enemies">${i}</div>
      </div>

      <div class="combat-log">${a}</div>

      <div class="combat-controls">
        ${Y.victory?`
          <div class="combat-result victory">
            <h3>${F(`game-icons:laurels`,24)} Victory!</h3>
            <button class="btn btn-primary" id="btn-collect-rewards">${F(`game-icons:coins`,20)} Collect Rewards</button>
          </div>
        `:Y.defeat?`
          <div class="combat-result defeat">
            <h3>${F(`game-icons:skull`,24)} Defeated!</h3>
            <button class="btn btn-danger" id="btn-death">${F(`game-icons:return-arrow`,20)} Return to Title</button>
          </div>
        `:Y.paused?`
          <div class="combat-paused-controls">
            <p class="pause-info">${F(`game-icons:pause-button`,20)} PAUSED — Adjust loadout and policies</p>
            <div class="pause-loadout">
              <h4>Equipped Spells:</h4>
              <div class="loadout-pills">${o.map(e=>`<span class="spell-pill" style="border-color:${L(e.elements[0])}">${F(e.icon,16)} ${e.name} (${e.manaCost} MP)</span>`).join(``)}</div>
              <h4>Equipped Skills:</h4>
              <div class="loadout-pills">${s.filter(e=>e.unlocked).map(e=>`<span class="skill-pill">${F(e.icon,16)} ${e.name} (${e.staminaCost} SP)</span>`).join(``)}</div>
              <h4>Active Policies:</h4>
              <div class="policy-list">${t.player.actionPolicies.map(e=>`
                <label class="policy-toggle">
                  <input type="checkbox" data-policy-id="${e.id}" ${e.enabled?`checked`:``}>
                  <span>P${e.priority}: ${e.condition} → ${e.action}</span>
                </label>
              `).join(``)}</div>
            </div>
            <button class="btn btn-primary" id="btn-resume">${F(`game-icons:play-button`,20)} Resume</button>
          </div>
        `:`
          <button class="btn btn-warning" id="btn-pause">${F(`game-icons:pause-button`,20)} Pause</button>
        `}
      </div>
    </div>
  `,document.getElementById(`btn-pause`)?.addEventListener(`click`,Un),document.getElementById(`btn-resume`)?.addEventListener(`click`,()=>{e.querySelectorAll(`.policy-toggle input`).forEach(e=>{let n=e.dataset.policyId,r=t.player.actionPolicies.find(e=>e.id===n);r&&(r.enabled=e.checked)}),Wn()}),document.getElementById(`btn-collect-rewards`)?.addEventListener(`click`,()=>{Gn()}),document.getElementById(`btn-death`)?.addEventListener(`click`,()=>{t.currentScene=`title`,P(`title`)});let c=e.querySelector(`.combat-log`);c&&(c.scrollTop=c.scrollHeight)}function Gn(){if(!Y)return;let e=W(),t=K(),n=0,r=0;for(let e of Y.enemies){n+=e.xpReward,r+=e.goldReward;for(let t of e.loot)if(Math.random()<t.chance){let e=R.find(e=>e.id===t.itemId);e&&(xn({...e,quantity:1}),j(`toast`,`Looted: ${e.name}`,`success`))}}if(e.player.gold+=r,wn(n),j(`toast`,`+${n} XP, +${r} gold`,`success`),t.runeReward&&Cn(t.runeReward),t.cleared=!0,t.type===`boss`){let n=e.floors.find(e=>e.bossRoomId===t.id);if(n){if(n.cleared=!0,n.id===2){e.victory=!0,e.currentScene=`victory`,G(),P(`victory`);return}e.player.currentFloor=n.id+1;let t=e.floors.find(e=>e.id===n.id+1);t&&(e.player.currentRoomId=t.rooms[0].id,j(`toast`,`Descending to ${t.name}...`,`info`))}}Y.interval&&clearInterval(Y.interval),Y=null,G(),e.currentScene=`map`,P(`map`),j(`state-changed`)}N(`combat`,()=>{let e=K();if(!e.enemies||e.enemies.length===0){let t=W();e.cleared=!0,t.currentScene=`map`,P(`map`);return}Y={enemies:e.enemies.map(e=>({...e,stats:{...e.stats},traits:{...e.traits},currentHp:e.stats.hp,stunned:0,debuffs:[],dots:[]})),playerDebuffs:[],playerDots:[],playerBuffs:[],log:[],turn:0,running:!1,paused:!1,victory:!1,defeat:!1,interval:null},X(`Encounter: ${e.enemies.map(e=>e.name).join(`, `)}`,`info`),X(`Combat begins! Configure loadout then watch the battle unfold.`,`info`),Z(),Hn()});var Q=[];function Kn(e){let t=[...e].sort();return fn.find(e=>{let n=[...e.ingredients].sort();return n.length===t.length&&n.every((e,n)=>e===t[n])})||null}function qn(){let e=W(),t=Kn(Q);if(!t){j(`toast`,`No known recipe for this combination!`,`warning`);return}if(new Set(Q).size!==Q.length){j(`toast`,`Each ingredient must be unique!`,`warning`);return}let n={id:`spell-crafted-${Date.now()}`,name:t.result.name,elements:t.result.elements,runeIds:Q.filter(e=>e.startsWith(`rune-`)),power:t.result.power,manaCost:t.result.manaCost,effects:t.result.effects.map(e=>({...e})),icon:t.result.icon,tier:t.result.tier,ingredients:[...Q]};for(let t of Q)if(t.startsWith(`spell-`)){let n=e.player.spells.findIndex(e=>e.id===t);n>=0&&(e.player.spellLoadout=e.player.spellLoadout.map(e=>e===t?null:e),e.player.spells.splice(n,1),j(`toast`,`Consumed spell as ingredient`,`info`))}e.player.spells.push(n);let r=e.player.spellLoadout.indexOf(null);r>=0&&(e.player.spellLoadout[r]=n.id),j(`toast`,`Crafted: ${n.name}!`,`success`),Q=[],G(),j(`state-changed`),P(`forge`)}N(`forge`,()=>{let e=document.getElementById(`app`),t=W();t.player.runes.filter(e=>e.discovered);let n=t.player.runes.map(e=>{let t=Q.includes(e.id);return!e.discovered||t||Q.includes(e.id),`
      <div class="forge-ingredient ${e.discovered?``:`undiscovered`} ${t?`selected`:``}"
           data-ingredient-id="${e.id}" data-type="rune">
        <div class="ingredient-icon" style="color:${L(e.element)}">${F(e.icon,32)}</div>
        <div class="ingredient-name">${e.discovered?e.name:`???`}</div>
        ${e.discovered?`
          <div class="ingredient-affinity">
            ${I(e.affinityLevel,100,L(e.element),`Affinity: ${e.affinityLevel}`,12)}
            ${e.affinityMilestones.map(t=>`
              <div class="milestone ${t.claimed?`claimed`:``} ${e.affinityLevel>=t.level?`reached`:``}">
                ${t.level}: ${t.reward}
              </div>
            `).join(``)}
          </div>
        `:``}
      </div>
    `}).join(``),r=t.player.spells.map(e=>`
      <div class="forge-ingredient spell-ingredient ${Q.includes(e.id)?`selected`:``}"
           data-ingredient-id="${e.id}" data-type="spell">
        <div class="ingredient-icon" style="color:${L(e.elements[0])}">${F(e.icon,28)}</div>
        <div class="ingredient-name">${e.name} (T${e.tier})</div>
      </div>
    `).join(``),i=Kn(Q),a=i?`
    <div class="recipe-preview">
      <h4>${F(i.result.icon,24)} ${i.result.name}</h4>
      <div class="recipe-elements">${i.result.elements.map(e=>`<span style="color:${L(e)}">${e}</span>`).join(` + `)}</div>
      <div class="recipe-power">Power: ${i.result.power} | Cost: ${i.result.manaCost} MP</div>
      <div class="recipe-effects">${i.result.effects.map(e=>`<div class="effect">${e.description}</div>`).join(``)}</div>
    </div>
  `:Q.length>=2?`
    <div class="recipe-preview unknown">
      <p>No known recipe for this combination.</p>
    </div>
  `:`
    <div class="recipe-preview empty">
      <p>Select 2 ingredients to see recipe preview.</p>
    </div>
  `;e.innerHTML=`
    <div class="scene forge-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:anvil`,28)} The Forge</h2>
        <button class="btn btn-secondary" id="btn-back-map">${F(`game-icons:return-arrow`,16)} Back to Map</button>
      </div>

      <div class="forge-layout">
        <div class="forge-ingredients">
          <h3>Runes</h3>
          <div class="ingredient-grid">${n}</div>
          <h3>Spells (as ingredients)</h3>
          <div class="ingredient-grid">${r}</div>
        </div>

        <div class="forge-crafting">
          <h3>Crafting Station</h3>
          <div class="selected-ingredients">
            ${Q.map(e=>{let n=t.player.runes.find(t=>t.id===e),r=t.player.spells.find(t=>t.id===e),i=n?.name||r?.name||e;return`<span class="selected-pill" data-remove-id="${e}">${F(n?.icon||r?.icon||`game-icons:cog`,16)} ${i} &times;</span>`}).join(``)}
          </div>
          ${a}
          <button class="btn btn-primary ${Q.length<2||!i?`disabled`:``}" id="btn-craft">
            ${F(`game-icons:anvil-impact`,20)} Craft Spell
          </button>
        </div>
      </div>
    </div>
  `,e.querySelectorAll(`.forge-ingredient:not(.undiscovered)`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.ingredientId,n=Q.indexOf(t);n>=0?Q.splice(n,1):Q.length<3&&!Q.includes(t)&&Q.push(t),P(`forge`)})}),e.querySelectorAll(`.selected-pill`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.removeId;Q=Q.filter(e=>e!==t),P(`forge`)})}),document.getElementById(`btn-craft`)?.addEventListener(`click`,()=>{Q.length>=2&&i&&qn()}),document.getElementById(`btn-back-map`)?.addEventListener(`click`,()=>{let e=t.floors.find(e=>e.id===t.player.currentFloor)?.rooms.find(e=>e.id===t.player.currentRoomId);e&&(e.cleared=!0),Q=[],t.currentScene=`map`,G(),P(`map`)})});var $=null;function Jn(e){let t=W();for(let n of e)switch(n.type){case`rune`:n.id&&Cn(n.id);break;case`item`:{let e=R.find(e=>e.id===n.id);e&&xn({...e,quantity:1});break}case`gold`:t.player.gold+=n.value||0,n.value&&j(`toast`,`${n.value>0?`+`:``}${n.value} gold`,n.value>0?`success`:`warning`);break;case`trait`:n.traitKey&&n.value&&q(n.traitKey,n.value);break;case`quest_flag`:n.id&&(t.player.questFlags[n.id]=!0);break;case`merchant_discount`:t.player.questFlags.merchant_discount=!0,j(`toast`,`Merchant discount unlocked!`,`success`);break;case`spawn_enemy`:j(`toast`,`An enemy appears!`,`danger`);break}j(`state-changed`)}N(`dialogue`,()=>{let e=document.getElementById(`app`),t=W(),n=K(),r=n.npc;if(!r||!r.dialogue||r.dialogue.length===0){n.cleared=!0,e.innerHTML=`
      <div class="scene dialogue-scene">
        <div class="scene-header">
          <h2>${F(n.icon,28)} ${n.name}</h2>
        </div>
        <div class="dialogue-text">
          <p>${n.description}</p>
        </div>
        <button class="btn btn-primary" id="btn-back">${F(`game-icons:return-arrow`,16)} Return to Map</button>
      </div>
    `,document.getElementById(`btn-back`)?.addEventListener(`click`,()=>{t.currentScene=`map`,G(),P(`map`)});return}$||=r.dialogue[0].id;let i=r.dialogue.find(e=>e.id===$);if(!i){n.cleared=!0,$=null,t.currentScene=`map`,G(),P(`map`);return}let a=i.choices.filter(e=>e.traitRequirement?(t.player.traits[e.traitRequirement.trait]??0)>=e.traitRequirement.minValue:!0);e.innerHTML=`
    <div class="scene dialogue-scene">
      <div class="scene-header">
        <h2>${F(n.icon,28)} ${n.name}</h2>
      </div>

      <div class="dialogue-panel">
        <div class="npc-portrait">
          ${F(r.portrait||r.icon,64)}
          <div class="npc-name">${r.name}</div>
          <div class="npc-traits">
            ${Object.entries(r.traits).filter(([e,t])=>t>.4).map(([e,t])=>`<span class="trait-badge">${e}: ${t.toFixed(1)}</span>`).join(``)}
          </div>
        </div>

        <div class="dialogue-content">
          <div class="dialogue-speaker">${i.speaker||r.name}</div>
          <div class="dialogue-text">${i.text}</div>

          <div class="dialogue-choices">
            ${a.map((e,t)=>`
              <button class="btn btn-dialogue" data-choice-idx="${t}">
                ${e.traitRequirement?`<span class="trait-req">[${e.traitRequirement.trait} >= ${e.traitRequirement.minValue}]</span>`:``}
                ${e.text}
              </button>
            `).join(``)}
          </div>
        </div>
      </div>
    </div>
  `,e.querySelectorAll(`.btn-dialogue`).forEach(e=>{e.addEventListener(`click`,()=>{let r=a[parseInt(e.dataset.choiceIdx||`0`)];r&&(Jn(r.effects),r.nextNodeId?($=r.nextNodeId,P(`dialogue`)):(n.cleared=!0,$=null,t.currentScene=`map`,G(),P(`map`)))})})}),N(`merchant`,()=>{let e=document.getElementById(`app`),t=W(),n=K(),r=n.merchantStock||[],i=t.player.questFlags.merchant_discount||!1,a=i?.9:1,o=r.filter(e=>e.quantity>0).map(e=>{let n=Math.floor(e.value*a),r=t.player.gold>=n;return`
      <div class="merchant-item">
        <div class="item-icon">${F(e.icon,28)}</div>
        <div class="item-details">
          <div class="item-name">${e.name} ${e.element?`<span style="color:${L(e.element)}">(${e.element})</span>`:``}</div>
          <div class="item-desc">${e.description}</div>
          <div class="item-stock">Stock: ${e.quantity}</div>
        </div>
        <div class="item-price">${F(`game-icons:coins`,14)} ${n}g</div>
        <button class="btn btn-small ${r?`btn-primary`:`btn-disabled`}" data-buy-id="${e.id}" ${r?``:`disabled`}>Buy</button>
      </div>
    `}).join(``),s=t.player.inventory.filter(e=>e.quantity>0).map(e=>{let t=Math.floor(e.value*.5);return`
      <div class="merchant-item">
        <div class="item-icon">${F(e.icon,28)}</div>
        <div class="item-details">
          <div class="item-name">${e.name}</div>
          <div class="item-qty">x${e.quantity}</div>
        </div>
        <div class="item-price">${F(`game-icons:coins`,14)} ${t}g</div>
        <button class="btn btn-small btn-secondary" data-sell-id="${e.id}">Sell</button>
      </div>
    `}).join(``);e.innerHTML=`
    <div class="scene merchant-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:trade`,28)} ${n.name}</h2>
        <div class="merchant-gold">${F(`game-icons:coins`,20)} ${t.player.gold}g ${i?`<span class="discount-badge">10% discount!</span>`:``}</div>
        <button class="btn btn-secondary" id="btn-back-map">${F(`game-icons:return-arrow`,16)} Leave</button>
      </div>

      <div class="merchant-layout">
        <div class="merchant-section">
          <h3>For Sale</h3>
          <div class="merchant-list">${o||`<p>No items available.</p>`}</div>
        </div>
        <div class="merchant-section">
          <h3>Your Items (Sell)</h3>
          <div class="merchant-list">${s||`<p>Nothing to sell.</p>`}</div>
        </div>
      </div>
    </div>
  `,e.querySelectorAll(`[data-buy-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.buyId,i=r.find(e=>e.id===n);if(!i||i.quantity<=0)return;let o=Math.floor(i.value*a);t.player.gold<o||(t.player.gold-=o,i.quantity--,xn({...i,quantity:1}),j(`toast`,`Bought ${i.name} for ${o}g`,`success`),G(),P(`merchant`))})}),e.querySelectorAll(`[data-sell-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.sellId,r=t.player.inventory.find(e=>e.id===n);if(!r||r.quantity<=0)return;let i=Math.floor(r.value*.5);Sn(n,1),t.player.gold+=i,j(`toast`,`Sold ${r.name} for ${i}g`,`success`),G(),P(`merchant`)})}),document.getElementById(`btn-back-map`)?.addEventListener(`click`,()=>{n.cleared=!0,t.currentScene=`map`,G(),P(`map`)})}),N(`rest`,()=>{let e=document.getElementById(`app`),t=W(),n=K(),r=J();e.innerHTML=`
    <div class="scene rest-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:campfire`,28)} ${n.name}</h2>
      </div>
      <div class="rest-panel">
        <p>${n.description}</p>
        <div class="rest-status">
          <div class="rest-bars">
            ${I(t.player.stats.hp,r.maxHp,`#e53935`,`HP ${t.player.stats.hp}/${r.maxHp}`)}
            ${I(t.player.stats.mana,r.maxMana,`#1e88e5`,`MP ${t.player.stats.mana}/${r.maxMana}`)}
            ${I(t.player.stats.stamina,r.maxStamina,`#43a047`,`SP ${t.player.stats.stamina}/${r.maxStamina}`)}
          </div>
        </div>
        <div class="rest-actions">
          <button class="btn btn-primary" id="btn-rest">
            ${F(`game-icons:night-sleep`,20)} Rest (Restore 60% HP/MP/SP)
          </button>
          <button class="btn btn-secondary" id="btn-loadout">
            ${F(`game-icons:spell-book`,20)} Change Loadout
          </button>
          ${n.npc?`
            <button class="btn btn-secondary" id="btn-talk-npc">
              ${F(n.npc.icon,20)} Talk to ${n.npc.name}
            </button>
          `:``}
          <button class="btn btn-secondary" id="btn-back-map">
            ${F(`game-icons:return-arrow`,16)} Leave
          </button>
        </div>
      </div>
    </div>
  `,document.getElementById(`btn-rest`)?.addEventListener(`click`,()=>{t.player.stats.hp=Math.min(r.maxHp,t.player.stats.hp+Math.floor(r.maxHp*.6)),t.player.stats.mana=Math.min(r.maxMana,t.player.stats.mana+Math.floor(r.maxMana*.6)),t.player.stats.stamina=Math.min(r.maxStamina,t.player.stats.stamina+Math.floor(r.maxStamina*.6)),j(`toast`,`You rest and recover your strength.`,`success`),j(`state-changed`),G(),P(`rest`)}),document.getElementById(`btn-loadout`)?.addEventListener(`click`,()=>{t.currentScene=`loadout`,P(`loadout`)}),document.getElementById(`btn-talk-npc`)?.addEventListener(`click`,()=>{t.currentScene=`dialogue`,P(`dialogue`)}),document.getElementById(`btn-back-map`)?.addEventListener(`click`,()=>{n.cleared=!0,t.currentScene=`map`,G(),P(`map`)})}),N(`character`,()=>{let e=document.getElementById(`app`),t=W(),n=J(),r=Object.entries(t.player.traits).map(([e,t])=>`
    <div class="trait-row">
      <span class="trait-name">${e}</span>
      <div class="trait-bar-container">
        ${I(Math.round(t*100),100,t>.6?`#ff9800`:t>.3?`#4caf50`:`#9e9e9e`,`${t.toFixed(2)}`,14)}
      </div>
    </div>
  `).join(``),i=t.player.runes.filter(e=>e.discovered).map(e=>`
    <div class="affinity-row">
      <span class="affinity-icon" style="color:${L(e.element)}">${F(e.icon,20)} ${e.name}</span>
      ${I(e.affinityLevel,100,L(e.element),`${e.affinityLevel}/100`,14)}
      <div class="affinity-milestones">
        ${e.affinityMilestones.map(t=>`<span class="ms ${t.claimed?`ms-claimed`:e.affinityLevel>=t.level?`ms-reached`:`ms-locked`}">${t.level}: ${t.reward}</span>`).join(``)}
      </div>
    </div>
  `).join(``),a=t.player.physicalSkills.map(e=>`
    <div class="skill-node ${e.unlocked?`unlocked`:`locked`}">
      <div class="skill-icon">${F(e.icon,24)}</div>
      <div class="skill-info">
        <div class="skill-name">${e.name} <span class="skill-tier">T${e.tier}</span></div>
        <div class="skill-cost">${e.staminaCost} SP | ${e.damage} dmg</div>
        ${e.unlocked?``:`<div class="skill-prereq">Requires: ${e.prerequisites.map(e=>t.player.physicalSkills.find(t=>t.id===e)?.name||e).join(`, `)||`Level ${e.tier}`}</div>`}
      </div>
    </div>
  `).join(``),o=[`main-hand`,`off-hand`,`body`,`trinket`].map(e=>{let n=t.player.equipment[e];return`
      <div class="equip-slot">
        <span class="slot-name">${e}</span>
        ${n?`
          <span class="equipped-item">${F(n.icon,20)} ${n.name}</span>
        `:`<span class="empty-slot">Empty</span>`}
      </div>
    `}).join(``),s=t.player.spells.map(e=>`
    <div class="spell-card" style="border-color:${L(e.elements[0])}">
      <div class="spell-icon" style="color:${L(e.elements[0])}">${F(e.icon,24)}</div>
      <div class="spell-name">${e.name}</div>
      <div class="spell-cost">${e.manaCost} MP | Pwr ${e.power}</div>
      <div class="spell-tier">T${e.tier}</div>
    </div>
  `).join(``);e.innerHTML=`
    <div class="scene character-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:character-sheet`,28)} Character Sheet</h2>
        <button class="btn btn-secondary" id="btn-back">${F(`game-icons:return-arrow`,16)} Back</button>
      </div>

      <div class="character-layout">
        <div class="char-section">
          <h3>${F(`game-icons:person`,20)} ${t.player.name} — Level ${n.level}</h3>
          <div class="stat-grid">
            <div class="stat">${F(`game-icons:hearts`,16)} HP: ${t.player.stats.hp}/${n.maxHp}</div>
            <div class="stat">${F(`game-icons:spell-book`,16)} MP: ${t.player.stats.mana}/${n.maxMana}</div>
            <div class="stat">${F(`game-icons:running-shoe`,16)} SP: ${t.player.stats.stamina}/${n.maxStamina}</div>
            <div class="stat">${F(`game-icons:broadsword`,16)} ATK: ${n.attack}</div>
            <div class="stat">${F(`game-icons:shield`,16)} DEF: ${n.defense}</div>
            <div class="stat">${F(`game-icons:sprint`,16)} SPD: ${n.speed}</div>
          </div>
        </div>

        <div class="char-section">
          <h3>${F(`game-icons:brain`,20)} Traits</h3>
          ${r}
        </div>

        <div class="char-section">
          <h3>${F(`game-icons:fire-ring`,20)} Affinities</h3>
          ${i}
        </div>

        <div class="char-section">
          <h3>${F(`game-icons:sword-clash`,20)} Physical Skills</h3>
          <div class="skill-tree">${a}</div>
        </div>

        <div class="char-section">
          <h3>${F(`game-icons:gem-pendant`,20)} Equipment</h3>
          ${o}
        </div>

        <div class="char-section">
          <h3>${F(`game-icons:spell-book`,20)} Known Spells</h3>
          <div class="spell-grid">${s}</div>
        </div>
      </div>
    </div>
  `,document.getElementById(`btn-back`)?.addEventListener(`click`,()=>{t.currentScene=`map`,P(`map`)})}),N(`inventory`,()=>{let e=document.getElementById(`app`),t=W(),n=[`main-hand`,`off-hand`,`body`,`trinket`].map(e=>{let n=t.player.equipment[e];return`
      <div class="equip-slot-panel" data-slot="${e}">
        <div class="slot-label">${e}</div>
        ${n?`
          <div class="equipped-item-card">
            ${F(n.icon,24)} ${n.name}
            <button class="btn btn-small btn-danger" data-unequip="${e}">Unequip</button>
          </div>
        `:`<div class="empty-slot-msg">Empty</div>`}
      </div>
    `}).join(``),r=t.player.inventory.filter(e=>e.quantity>0).map(e=>{let t=e.category===`equipment`&&e.equipSlot,n=e.category===`consumable`;return`
      <div class="inv-item" data-item-id="${e.id}">
        <div class="inv-icon">${F(e.icon,28)}</div>
        <div class="inv-details">
          <div class="inv-name">${e.name} ${e.element?`<span style="color:${L(e.element)}">(${e.element})</span>`:``}</div>
          <div class="inv-desc">${e.description}</div>
          <div class="inv-qty">x${e.quantity}</div>
        </div>
        <div class="inv-actions">
          ${t?`<button class="btn btn-small btn-primary" data-equip-id="${e.id}">Equip</button>`:``}
          ${n?`<button class="btn btn-small btn-primary" data-use-id="${e.id}">Use</button>`:``}
        </div>
      </div>
    `}).join(``);e.innerHTML=`
    <div class="scene inventory-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:knapsack`,28)} Inventory</h2>
        <button class="btn btn-secondary" id="btn-back">${F(`game-icons:return-arrow`,16)} Back</button>
      </div>

      <div class="inventory-layout">
        <div class="equipment-panel">
          <h3>Equipment</h3>
          ${n}
        </div>
        <div class="inventory-grid-panel">
          <h3>Bag</h3>
          <div class="inventory-grid">${r||`<p>Your bag is empty.</p>`}</div>
        </div>
      </div>
    </div>
  `,e.querySelectorAll(`[data-equip-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.equipId,r=t.player.inventory.find(e=>e.id===n);if(!r||!r.equipSlot)return;let i=t.player.equipment[r.equipSlot];i&&t.player.inventory.push({...i,quantity:1}),t.player.equipment[r.equipSlot]={...r,quantity:1},Sn(n,1),j(`toast`,`Equipped ${r.name}`,`success`),j(`state-changed`),G(),P(`inventory`)})}),e.querySelectorAll(`[data-unequip]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.unequip,r=t.player.equipment[n];r&&(t.player.inventory.push({...r,quantity:1}),t.player.equipment[n]=null,j(`toast`,`Unequipped ${r.name}`,`info`),j(`state-changed`),G(),P(`inventory`))})}),e.querySelectorAll(`[data-use-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.useId,r=t.player.inventory.find(e=>e.id===n);if(!(!r||r.quantity<=0)){switch(n){case`item-health-potion`:t.player.stats.hp=Math.min(t.player.stats.maxHp,t.player.stats.hp+30),j(`toast`,`Restored 30 HP`,`success`);break;case`item-mana-potion`:t.player.stats.mana=Math.min(t.player.stats.maxMana,t.player.stats.mana+20),j(`toast`,`Restored 20 MP`,`success`);break;case`item-stamina-tonic`:t.player.stats.stamina=Math.min(t.player.stats.maxStamina,t.player.stats.stamina+15),j(`toast`,`Restored 15 SP`,`success`);break}Sn(n,1),j(`state-changed`),G(),P(`inventory`)}})}),document.getElementById(`btn-back`)?.addEventListener(`click`,()=>{t.currentScene=`map`,P(`map`)})}),N(`loadout`,()=>{let e=document.getElementById(`app`),t=W(),n=t.player.spellLoadout.map((e,n)=>{let r=e?t.player.spells.find(t=>t.id===e):null;return`
      <div class="loadout-slot" data-slot-type="spell" data-slot-idx="${n}">
        <div class="slot-number">Slot ${n+1}</div>
        ${r?`
          <div class="slot-content" style="border-color:${L(r.elements[0])}">
            ${F(r.icon,24)} ${r.name}
            <span class="slot-cost">${r.manaCost} MP</span>
            <button class="btn btn-small btn-danger" data-clear-spell="${n}">&times;</button>
          </div>
        `:`<div class="slot-empty">Empty — click a spell below to assign</div>`}
      </div>
    `}).join(``),r=t.player.spells.map(e=>`
      <div class="loadout-option ${t.player.spellLoadout.includes(e.id)?`equipped`:``}" data-assign-spell="${e.id}">
        <span style="color:${L(e.elements[0])}">${F(e.icon,20)}</span>
        ${e.name} <span class="option-tier">T${e.tier}</span> <span class="option-cost">${e.manaCost} MP</span>
        ${e.elements.map(e=>`<span class="el-badge" style="background:${L(e)}">${e}</span>`).join(``)}
      </div>
    `).join(``),i=t.player.skillLoadout.map((e,n)=>{let r=e?t.player.physicalSkills.find(t=>t.id===e):null;return`
      <div class="loadout-slot" data-slot-type="skill" data-slot-idx="${n}">
        <div class="slot-number">Slot ${n+1}</div>
        ${r?`
          <div class="slot-content">
            ${F(r.icon,24)} ${r.name}
            <span class="slot-cost">${r.staminaCost} SP</span>
            <button class="btn btn-small btn-danger" data-clear-skill="${n}">&times;</button>
          </div>
        `:`<div class="slot-empty">Empty</div>`}
      </div>
    `}).join(``),a=t.player.physicalSkills.filter(e=>e.unlocked).map(e=>`
      <div class="loadout-option ${t.player.skillLoadout.includes(e.id)?`equipped`:``}" data-assign-skill="${e.id}">
        ${F(e.icon,20)} ${e.name} <span class="option-cost">${e.staminaCost} SP</span>
      </div>
    `).join(``),o=t.player.actionPolicies.map(e=>`
    <div class="policy-row">
      <label class="policy-check">
        <input type="checkbox" data-pol-id="${e.id}" ${e.enabled?`checked`:``}>
        <span class="policy-pri">P${e.priority}</span>
        <span class="policy-cond">${e.condition}</span> → <span class="policy-act">${e.action}</span>
      </label>
    </div>
  `).join(``);e.innerHTML=`
    <div class="scene loadout-scene">
      <div class="scene-header">
        <h2>${F(`game-icons:spell-book`,28)} Loadout Configuration</h2>
        <button class="btn btn-secondary" id="btn-back">${F(`game-icons:return-arrow`,16)} Back</button>
      </div>

      <div class="loadout-layout">
        <div class="loadout-section">
          <h3>Spell Loadout (4 slots)</h3>
          <div class="loadout-slots">${n}</div>
          <h4>Available Spells</h4>
          <div class="loadout-options">${r}</div>
        </div>

        <div class="loadout-section">
          <h3>Skill Loadout (3 slots)</h3>
          <div class="loadout-slots">${i}</div>
          <h4>Available Skills</h4>
          <div class="loadout-options">${a}</div>
        </div>

        <div class="loadout-section">
          <h3>Action Policies (Combat AI)</h3>
          <p class="policy-info">Configure how auto-combat resolves. Lower priority number = checked first.</p>
          ${o}
        </div>
      </div>
    </div>
  `;let s=-1,c=-1;e.querySelectorAll(`[data-slot-type="spell"]`).forEach(t=>{t.addEventListener(`click`,n=>{n.target.closest(`[data-clear-spell]`)||(s=parseInt(t.dataset.slotIdx||`-1`),c=-1,e.querySelectorAll(`.loadout-slot`).forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`))})}),e.querySelectorAll(`[data-slot-type="skill"]`).forEach(t=>{t.addEventListener(`click`,n=>{n.target.closest(`[data-clear-skill]`)||(c=parseInt(t.dataset.slotIdx||`-1`),s=-1,e.querySelectorAll(`.loadout-slot`).forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`))})}),e.querySelectorAll(`[data-assign-spell]`).forEach(e=>{e.addEventListener(`click`,()=>{s<0&&(s=t.player.spellLoadout.indexOf(null),s<0&&(s=0));let n=e.dataset.assignSpell;t.player.spellLoadout=t.player.spellLoadout.map(e=>e===n?null:e),t.player.spellLoadout[s]=n,G(),j(`state-changed`),P(`loadout`)})}),e.querySelectorAll(`[data-assign-skill]`).forEach(e=>{e.addEventListener(`click`,()=>{c<0&&(c=t.player.skillLoadout.indexOf(null),c<0&&(c=0));let n=e.dataset.assignSkill;t.player.skillLoadout=t.player.skillLoadout.map(e=>e===n?null:e),t.player.skillLoadout[c]=n,G(),j(`state-changed`),P(`loadout`)})}),e.querySelectorAll(`[data-clear-spell]`).forEach(e=>{e.addEventListener(`click`,n=>{n.stopPropagation();let r=parseInt(e.dataset.clearSpell||`0`);t.player.spellLoadout[r]=null,G(),P(`loadout`)})}),e.querySelectorAll(`[data-clear-skill]`).forEach(e=>{e.addEventListener(`click`,n=>{n.stopPropagation();let r=parseInt(e.dataset.clearSkill||`0`);t.player.skillLoadout[r]=null,G(),P(`loadout`)})}),e.querySelectorAll(`[data-pol-id]`).forEach(e=>{e.addEventListener(`change`,()=>{let n=e.dataset.polId,r=t.player.actionPolicies.find(e=>e.id===n);r&&(r.enabled=e.checked),G()})}),document.getElementById(`btn-back`)?.addEventListener(`click`,()=>{t.currentScene=`map`,P(`map`)})}),N(`victory`,()=>{let e=document.getElementById(`app`),t=W(),n=Date.now()-t.player.gameClockStart,r=Math.floor(n/6e4);e.innerHTML=`
    <div class="scene victory-scene">
      <div class="victory-content">
        ${F(`game-icons:laurel-crown`,80)}
        <h1>You Escaped the Dungeon!</h1>
        <p>The Lich King has been defeated. The dungeon crumbles as light floods the depths.</p>
        <div class="victory-stats">
          <div class="victory-stat">${F(`game-icons:person`,20)} Level ${t.player.stats.level}</div>
          <div class="victory-stat">${F(`game-icons:spell-book`,20)} ${t.player.spells.length} spells learned</div>
          <div class="victory-stat">${F(`game-icons:fire-ring`,20)} ${t.player.discoveredRunes.length} runes discovered</div>
          <div class="victory-stat">${F(`game-icons:coins`,20)} ${t.player.gold} gold collected</div>
          <div class="victory-stat">${F(`game-icons:sundial`,20)} ${r} minutes played</div>
        </div>
        <button class="btn btn-primary btn-large" id="btn-new-game">${F(`game-icons:sword-brandish`,24)} Play Again</button>
      </div>
    </div>
  `,document.getElementById(`btn-new-game`)?.addEventListener(`click`,()=>{_n(),P(`title`)})});function Yn(){jn(),P(`title`)}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,Yn):Yn();