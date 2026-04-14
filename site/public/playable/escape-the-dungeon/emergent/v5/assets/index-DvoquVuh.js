var e=(e,t)=>()=>(e&&(t=e(e=0)),t),t=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function n(e,t=0){let n=e.replace(/^-?[0-9.]*/,``);function r(e){for(;e<0;)e+=4;return e%4}if(n===``){let t=parseInt(e);return isNaN(t)?0:r(t)}else if(n!==e){let t=0;switch(n){case`%`:t=25;break;case`deg`:t=90}if(t){let i=parseFloat(e.slice(0,e.length-n.length));return isNaN(i)?0:(i/=t,i%1==0?r(i):0)}}return t}function r(e,t){t.split(Ze).forEach(t=>{switch(t.trim()){case`horizontal`:e.hFlip=!0;break;case`vertical`:e.vFlip=!0;break}})}function i(e){let t={...M},i=(t,n)=>e.getAttribute(t)||n;return t.width=i(`width`,null),t.height=i(`height`,null),t.rotate=n(i(`rotate`,``)),r(t,i(`flip`,``)),t.preserveAspectRatio=i(`preserveAspectRatio`,i(`preserveaspectratio`,``)),t}function a(e,t){for(let n in M)if(e[n]!==t[n])return!0;return!1}function o(e,t){let n=e.icons,r=e.aliases||Object.create(null),i=Object.create(null);function a(e){if(n[e])return i[e]=[];if(!(e in i)){i[e]=null;let t=r[e]&&r[e].parent,n=t&&a(t);n&&(i[e]=[t].concat(n))}return i[e]}return Object.keys(n).concat(Object.keys(r)).forEach(a),i}function s(e,t){let n={};!e.hFlip!=!t.hFlip&&(n.hFlip=!0),!e.vFlip!=!t.vFlip&&(n.vFlip=!0);let r=((e.rotate||0)+(t.rotate||0))%4;return r&&(n.rotate=r),n}function c(e,t){let n=s(e,t);for(let r in A)r in O?r in e&&!(r in n)&&(n[r]=O[r]):r in t?n[r]=t[r]:r in e&&(n[r]=e[r]);return n}function l(e,t,n){let r=e.icons,i=e.aliases||Object.create(null),a={};function o(e){a=c(r[e]||i[e],a)}return o(t),n.forEach(o),c(e,a)}function u(e,t){let n=[];if(typeof e!=`object`||typeof e.icons!=`object`)return n;e.not_found instanceof Array&&e.not_found.forEach(e=>{t(e,null),n.push(e)});let r=o(e);for(let i in r){let a=r[i];a&&(t(i,l(e,i,a)),n.push(i))}return n}function d(e,t){for(let n in t)if(n in e&&typeof e[n]!=typeof t[n])return!1;return!0}function f(e){if(typeof e!=`object`||!e)return null;let t=e;if(typeof t.prefix!=`string`||!e.icons||typeof e.icons!=`object`||!d(e,Qe))return null;let n=t.icons;for(let e in n){let t=n[e];if(!e||typeof t.body!=`string`||!d(t,A))return null}let r=t.aliases||Object.create(null);for(let e in r){let t=r[e],i=t.parent;if(!e||typeof i!=`string`||!n[i]&&!r[i]||!d(t,A))return null}return t}function p(e,t){return{provider:e,prefix:t,icons:Object.create(null),missing:new Set}}function m(e,t){let n=I[e]||(I[e]=Object.create(null));return n[t]||(n[t]=p(e,t))}function h(e,t){return f(t)?u(t,(t,n)=>{n?e.icons[t]=n:e.missing.add(t)}):[]}function ee(e,t,n){try{if(typeof n.body==`string`)return e.icons[t]={...n},!0}catch{}return!1}function te(e,t){let n=[];return(typeof e==`string`?[e]:Object.keys(I)).forEach(e=>{(typeof e==`string`&&typeof t==`string`?[t]:Object.keys(I[e]||{})).forEach(t=>{let r=m(e,t);n=n.concat(Object.keys(r.icons).map(n=>(e===``?``:`@`+e+`:`)+t+`:`+n))})}),n}function g(e){return typeof e==`boolean`&&(L=e),L}function _(e){let t=typeof e==`string`?P(e,!0,L):e;if(t){let e=m(t.provider,t.prefix),n=t.name;return e.icons[n]||(e.missing.has(n)?null:void 0)}}function v(e,t){let n=P(e,!0,L);if(!n)return!1;let r=m(n.provider,n.prefix);return t?ee(r,n.name,t):(r.missing.add(n.name),!0)}function y(e,t){if(typeof e!=`object`)return!1;if(typeof t!=`string`&&(t=e.provider||``),L&&!t&&!e.prefix){let t=!1;return f(e)&&(e.prefix=``,u(e,(e,n)=>{v(e,n)&&(t=!0)})),t}let n=e.prefix;return F({prefix:n,name:`a`})?!!h(m(t,n),e):!1}function ne(e){return!!_(e)}function re(e){let t=_(e);return t&&{...k,...t}}function ie(e,t){e.forEach(e=>{let n=e.loaderCallbacks;n&&(e.loaderCallbacks=n.filter(e=>e.id!==t))})}function ae(e){e.pendingCallbacksFlag||(e.pendingCallbacksFlag=!0,setTimeout(()=>{e.pendingCallbacksFlag=!1;let t=e.loaderCallbacks?e.loaderCallbacks.slice(0):[];if(!t.length)return;let n=!1,r=e.provider,i=e.prefix;t.forEach(t=>{let a=t.icons,o=a.pending.length;a.pending=a.pending.filter(t=>{if(t.prefix!==i)return!0;let o=t.name;if(e.icons[o])a.loaded.push({provider:r,prefix:i,name:o});else if(e.missing.has(o))a.missing.push({provider:r,prefix:i,name:o});else return n=!0,!0;return!1}),a.pending.length!==o&&(n||ie([e],t.id),t.callback(a.loaded.slice(0),a.missing.slice(0),a.pending.slice(0),t.abort))})}))}function oe(e,t,n){let r=$e++,i=ie.bind(null,n,r);if(!t.pending.length)return i;let a={id:r,icons:t,callback:e,abort:i};return n.forEach(e=>{(e.loaderCallbacks||=[]).push(a)}),i}function se(e){let t={loaded:[],missing:[],pending:[]},n=Object.create(null);e.sort((e,t)=>e.provider===t.provider?e.prefix===t.prefix?e.name.localeCompare(t.name):e.prefix.localeCompare(t.prefix):e.provider.localeCompare(t.provider));let r={provider:``,prefix:``,name:``};return e.forEach(e=>{if(r.name===e.name&&r.prefix===e.prefix&&r.provider===e.provider)return;r=e;let i=e.provider,a=e.prefix,o=e.name,s=n[i]||(n[i]=Object.create(null)),c=s[a]||(s[a]=m(i,a)),l;l=o in c.icons?t.loaded:a===``||c.missing.has(o)?t.missing:t.pending;let u={provider:i,prefix:a,name:o};l.push(u)}),t}function ce(e,t){R[e]=t}function b(e){return R[e]||R[``]}function le(e,t=!0,n=!1){let r=[];return e.forEach(e=>{let i=typeof e==`string`?P(e,t,n):e;i&&r.push(i)}),r}function x(e){let t;if(typeof e.resources==`string`)t=[e.resources];else if(t=e.resources,!(t instanceof Array)||!t.length)return null;return{resources:t,path:e.path||`/`,maxURL:e.maxURL||500,rotate:e.rotate||750,timeout:e.timeout||5e3,random:e.random===!0,index:e.index||0,dataAfterTimeout:e.dataAfterTimeout!==!1}}function ue(e,t){let n=x(t);return n===null?!1:(z[e]=n,!0)}function S(e){return z[e]}function de(){return Object.keys(z)}function fe(e,t,n,r){let i=e.resources.length,a=e.random?Math.floor(Math.random()*i):e.index,o;if(e.random){let t=e.resources.slice(0);for(o=[];t.length>1;){let e=Math.floor(Math.random()*t.length);o.push(t[e]),t=t.slice(0,e).concat(t.slice(e+1))}o=o.concat(t)}else o=e.resources.slice(a).concat(e.resources.slice(0,a));let s=Date.now(),c=`pending`,l=0,u,d=null,f=[],p=[];typeof r==`function`&&p.push(r);function m(){d&&=(clearTimeout(d),null)}function h(){c===`pending`&&(c=`aborted`),m(),f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function ee(e,t){t&&(p=[]),typeof e==`function`&&p.push(e)}function te(){return{startTime:s,payload:t,status:c,queriesSent:l,queriesPending:f.length,subscribe:ee,abort:h}}function g(){c=`failed`,p.forEach(e=>{e(void 0,u)})}function _(){f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function v(t,n,r){let i=n!==`success`;switch(f=f.filter(e=>e!==t),c){case`pending`:break;case`failed`:if(i||!e.dataAfterTimeout)return;break;default:return}if(n===`abort`){u=r,g();return}if(i){u=r,f.length||(o.length?y():g());return}if(m(),_(),!e.random){let n=e.resources.indexOf(t.resource);n!==-1&&n!==e.index&&(e.index=n)}c=`completed`,p.forEach(e=>{e(r)})}function y(){if(c!==`pending`)return;m();let r=o.shift();if(r===void 0){if(f.length){d=setTimeout(()=>{m(),c===`pending`&&(_(),g())},e.timeout);return}g();return}let i={status:`pending`,resource:r,callback:(e,t)=>{v(i,e,t)}};f.push(i),l++,d=setTimeout(y,e.rotate),n(r,t,i.callback)}return setTimeout(y),te}function pe(e){let t={...et,...e},n=[];function r(){n=n.filter(e=>e().status===`pending`)}function i(e,i,a){let o=fe(t,e,i,(e,t)=>{r(),a&&a(e,t)});return n.push(o),o}function a(e){return n.find(t=>e(t))||null}return{query:i,find:a,setIndex:e=>{t.index=e},getIndex:()=>t.index,cleanup:r}}function me(){}function he(e){if(!H[e]){let t=S(e);if(!t)return;H[e]={config:t,redundancy:pe(t)}}return H[e]}function ge(e,t,n){let r,i;if(typeof e==`string`){let t=b(e);if(!t)return n(void 0,424),me;i=t.send;let a=he(e);a&&(r=a.redundancy)}else{let t=x(e);if(t){r=pe(t);let n=b(e.resources?e.resources[0]:``);n&&(i=n.send)}}return!r||!i?(n(void 0,424),me):r.query(t,i,n)().abort}function _e(){}function ve(e){e.iconsLoaderFlag||(e.iconsLoaderFlag=!0,setTimeout(()=>{e.iconsLoaderFlag=!1,ae(e)}))}function ye(e){let t=[],n=[];return e.forEach(e=>{(e.match(N)?t:n).push(e)}),{valid:t,invalid:n}}function C(e,t,n){function r(){let n=e.pendingIcons;t.forEach(t=>{n&&n.delete(t),e.icons[t]||e.missing.add(t)})}if(n&&typeof n==`object`)try{if(!h(e,n).length){r();return}}catch(e){console.error(e)}r(),ve(e)}function be(e,t){e instanceof Promise?e.then(e=>{t(e)}).catch(()=>{t(null)}):t(e)}function xe(e,t){e.iconsToLoad?e.iconsToLoad=e.iconsToLoad.concat(t).sort():e.iconsToLoad=t,e.iconsQueueFlag||(e.iconsQueueFlag=!0,setTimeout(()=>{e.iconsQueueFlag=!1;let{provider:t,prefix:n}=e,r=e.iconsToLoad;if(delete e.iconsToLoad,!r||!r.length)return;let i=e.loadIcon;if(e.loadIcons&&(r.length>1||!i)){be(e.loadIcons(r,n,t),t=>{C(e,r,t)});return}if(i){r.forEach(r=>{be(i(r,n,t),t=>{C(e,[r],t?{prefix:n,icons:{[r]:t}}:null)})});return}let{valid:a,invalid:o}=ye(r);if(o.length&&C(e,o,null),!a.length)return;let s=n.match(N)?b(t):null;if(!s){C(e,a,null);return}s.prepare(t,n,a).forEach(n=>{ge(t,n,t=>{C(e,n.icons,t)})})}))}function Se(e){try{let t=typeof e==`string`?JSON.parse(e):e;if(typeof t.body==`string`)return{...t}}catch{}}function Ce(e,t){if(typeof e==`object`)return{data:Se(e),value:e};if(typeof e!=`string`)return{value:e};if(e.includes(`{`)){let t=Se(e);if(t)return{data:t,value:e}}let n=P(e,!0,!0);if(!n)return{value:e};let r=_(n);return r!==void 0||!n.prefix?{value:e,name:n,data:r}:{value:e,name:n,loading:U([n],()=>t(e,n,_(n)))}}function we(e,t){switch(t){case`svg`:case`bg`:case`mask`:return t}return t!==`style`&&(nt||e.indexOf(`<a`)===-1)?`svg`:e.indexOf(`currentColor`)===-1?`bg`:`mask`}function w(e,t,n){if(t===1)return e;if(n||=100,typeof e==`number`)return Math.ceil(e*t*n)/n;if(typeof e!=`string`)return e;let r=e.split(rt);if(r===null||!r.length)return e;let i=[],a=r.shift(),o=it.test(a);for(;;){if(o){let e=parseFloat(a);isNaN(e)?i.push(a):i.push(Math.ceil(e*t*n)/n)}else i.push(a);if(a=r.shift(),a===void 0)return i.join(``);o=!o}}function Te(e,t=`defs`){let n=``,r=e.indexOf(`<`+t);for(;r>=0;){let i=e.indexOf(`>`,r),a=e.indexOf(`</`+t);if(i===-1||a===-1)break;let o=e.indexOf(`>`,a);if(o===-1)break;n+=e.slice(i+1,a).trim(),e=e.slice(0,r).trim()+e.slice(o+1)}return{defs:n,content:e}}function Ee(e,t){return e?`<defs>`+e+`</defs>`+t:t}function De(e,t,n){let r=Te(e);return Ee(r.defs,t+r.content+n)}function Oe(e,t){let n={...k,...e},r={...j,...t},i={left:n.left,top:n.top,width:n.width,height:n.height},a=n.body;[n,r].forEach(e=>{let t=[],n=e.hFlip,r=e.vFlip,o=e.rotate;n?r?o+=2:(t.push(`translate(`+(i.width+i.left).toString()+` `+(0-i.top).toString()+`)`),t.push(`scale(-1 1)`),i.top=i.left=0):r&&(t.push(`translate(`+(0-i.left).toString()+` `+(i.height+i.top).toString()+`)`),t.push(`scale(1 -1)`),i.top=i.left=0);let s;switch(o<0&&(o-=Math.floor(o/4)*4),o%=4,o){case 1:s=i.height/2+i.top,t.unshift(`rotate(90 `+s.toString()+` `+s.toString()+`)`);break;case 2:t.unshift(`rotate(180 `+(i.width/2+i.left).toString()+` `+(i.height/2+i.top).toString()+`)`);break;case 3:s=i.width/2+i.left,t.unshift(`rotate(-90 `+s.toString()+` `+s.toString()+`)`);break}o%2==1&&(i.left!==i.top&&(s=i.left,i.left=i.top,i.top=s),i.width!==i.height&&(s=i.width,i.width=i.height,i.height=s)),t.length&&(a=De(a,`<g transform="`+t.join(` `)+`">`,`</g>`))});let o=r.width,s=r.height,c=i.width,l=i.height,u,d;o===null?(d=s===null?`1em`:s===`auto`?l:s,u=w(d,c/l)):(u=o===`auto`?c:o,d=s===null?w(u,l/c):s===`auto`?l:s);let f={},p=(e,t)=>{at(t)||(f[e]=t.toString())};p(`width`,u),p(`height`,d);let m=[i.left,i.top,c,l];return f.viewBox=m.join(` `),{attributes:f,viewBox:m,body:a}}function T(e,t){let n=e.indexOf(`xlink:`)===-1?``:` xmlns:xlink="http://www.w3.org/1999/xlink"`;for(let e in t)n+=` `+e+`="`+t[e]+`"`;return`<svg xmlns="http://www.w3.org/2000/svg"`+n+`>`+e+`</svg>`}function ke(e){return e.replace(/"/g,`'`).replace(/%/g,`%25`).replace(/#/g,`%23`).replace(/</g,`%3C`).replace(/>/g,`%3E`).replace(/\s+/g,` `)}function Ae(e){return`data:image/svg+xml,`+ke(e)}function je(e){return`url("`+Ae(e)+`")`}function Me(e){W=e}function Ne(){return W}function Pe(e,t){let n=S(e);if(!n)return 0;let r;if(!n.maxURL)r=0;else{let e=0;n.resources.forEach(t=>{e=Math.max(e,t.length)});let i=t+`.json?icons=`;r=n.maxURL-e-n.path.length-i.length}return r}function Fe(e){return e===404}function Ie(e){if(typeof e==`string`){let t=S(e);if(t)return t.path}return`/`}function Le(e,t,n){m(n||``,t).loadIcons=e}function Re(e,t,n){m(n||``,t).loadIcon=e}function ze(e){ut=e}function Be(e,t){let n=Array.from(e.childNodes).find(e=>e.hasAttribute&&e.hasAttribute(G));n||(n=document.createElement(`style`),n.setAttribute(G,G),e.appendChild(n)),n.textContent=`:host{display:inline-block;vertical-align:`+(t?`-0.125em`:`0`)+`}span,svg{display:block;margin:auto}`+ut}function Ve(){ce(``,lt),g(!0);let e;try{e=window}catch{}if(e){if(e.IconifyPreload!==void 0){let t=e.IconifyPreload,n=`Invalid IconifyPreload syntax.`;typeof t==`object`&&t&&(t instanceof Array?t:[t]).forEach(e=>{try{(typeof e!=`object`||!e||e instanceof Array||typeof e.icons!=`object`||typeof e.prefix!=`string`||!y(e))&&console.error(n)}catch{console.error(n)}})}if(e.IconifyProviders!==void 0){let t=e.IconifyProviders;if(typeof t==`object`&&t)for(let e in t){let n=`IconifyProviders[`+e+`] is invalid.`;try{let r=t[e];if(typeof r!=`object`||!r||r.resources===void 0)continue;ue(e,r)||console.error(n)}catch{console.error(n)}}}}return{iconLoaded:ne,getIcon:re,listIcons:te,addIcon:v,addCollection:y,calculateSize:w,buildIcon:Oe,iconToHTML:T,svgToURL:je,loadIcons:U,loadIcon:tt,addAPIProvider:ue,setCustomIconLoader:Re,setCustomIconsLoader:Le,appendCustomStyle:ze,_api:{getAPIConfig:S,setAPIModule:ce,sendAPIQuery:ge,setFetch:Me,getFetch:Ne,listAPIProviders:de}}}function He(e){return e?e+(e.match(/^[-0-9.]+$/)?`px`:``):`inherit`}function Ue(e,t,n){let r=document.createElement(`span`),i=e.body;i.indexOf(`<a`)!==-1&&(i+=`<!-- `+Date.now()+` -->`);let a=e.attributes,o=je(T(i,{...a,width:t.width+``,height:t.height+``})),s=r.style,c={"--svg":o,width:He(a.width),height:He(a.height),...n?K:dt};for(let e in c)s.setProperty(e,c[e]);return r}function We(){try{q=window.trustedTypes.createPolicy(`iconify`,{createHTML:e=>e})}catch{q=null}}function Ge(e){return q===void 0&&We(),q?q.createHTML(e):e}function Ke(e){let t=document.createElement(`span`),n=e.attributes,r=``;return n.width||(r=`width: inherit;`),n.height||(r+=`height: inherit;`),r&&(n.style=r),t.innerHTML=Ge(T(e.body,n)),t.firstChild}function E(e){return Array.from(e.childNodes).find(e=>{let t=e.tagName&&e.tagName.toUpperCase();return t===`SPAN`||t===`SVG`})}function qe(e,t){let n=t.icon.data,r=t.customisations,i=Oe(n,r);r.preserveAspectRatio&&(i.attributes.preserveAspectRatio=r.preserveAspectRatio);let a=t.renderedMode,o;switch(a){case`svg`:o=Ke(i);break;default:o=Ue(i,{...k,...n},a===`mask`)}let s=E(e);s?o.tagName===`SPAN`&&s.tagName===o.tagName?s.setAttribute(`style`,o.getAttribute(`style`)):e.replaceChild(o,s):e.appendChild(o)}function Je(e,t,n){return{rendered:!1,inline:t,icon:e,lastRender:n&&(n.rendered?n:n.lastRender)}}function Ye(e=`iconify-icon`){let t,n;try{t=window.customElements,n=window.HTMLElement}catch{return}if(!t||!n)return;let r=t.get(e);if(r)return r;let o=[`icon`,`mode`,`inline`,`noobserver`,`width`,`height`,`rotate`,`flip`],s=class extends n{_shadowRoot;_initialised=!1;_state;_checkQueued=!1;_connected=!1;_observer=null;_visible=!0;constructor(){super();let e=this._shadowRoot=this.attachShadow({mode:`open`}),t=this.hasAttribute(`inline`);Be(e,t),this._state=Je({value:``},t),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return o.slice(0)}attributeChangedCallback(e){switch(e){case`inline`:{let e=this.hasAttribute(`inline`),t=this._state;e!==t.inline&&(t.inline=e,Be(this._shadowRoot,e));break}case`noobserver`:this.hasAttribute(`noobserver`)?this.startObserver():this.stopObserver();break;default:this._queueCheck()}}get icon(){let e=this.getAttribute(`icon`);if(e&&e.slice(0,1)===`{`)try{return JSON.parse(e)}catch{}return e}set icon(e){typeof e==`object`&&(e=JSON.stringify(e)),this.setAttribute(`icon`,e)}get inline(){return this.hasAttribute(`inline`)}set inline(e){e?this.setAttribute(`inline`,`true`):this.removeAttribute(`inline`)}get observer(){return this.hasAttribute(`observer`)}set observer(e){e?this.setAttribute(`observer`,`true`):this.removeAttribute(`observer`)}restartAnimation(){let e=this._state;if(e.rendered){let t=this._shadowRoot;if(e.renderedMode===`svg`)try{t.lastChild.setCurrentTime(0);return}catch{}qe(t,e)}}get status(){let e=this._state;return e.rendered?`rendered`:e.icon.data===null?`failed`:`loading`}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;let e=this._state,t=this.getAttribute(`icon`);if(t!==e.icon.value){this._iconChanged(t);return}if(!e.rendered||!this._visible)return;let n=this.getAttribute(`mode`),r=i(this);(e.attrMode!==n||a(e.customisations,r)||!E(this._shadowRoot))&&this._renderIcon(e.icon,r,n)}_iconChanged(e){let t=Ce(e,(e,t,n)=>{let r=this._state;if(r.rendered||this.getAttribute(`icon`)!==e)return;let i={value:e,name:t,data:n};i.data?this._gotIconData(i):r.icon=i});t.data?this._gotIconData(t):this._state=Je(t,this._state.inline,this._state)}_forceRender(){if(!this._visible){let e=E(this._shadowRoot);e&&this._shadowRoot.removeChild(e);return}this._queueCheck()}_gotIconData(e){this._checkQueued=!1,this._renderIcon(e,i(this),this.getAttribute(`mode`))}_renderIcon(e,t,n){let r=we(e.data.body,n),i=this._state.inline;qe(this._shadowRoot,this._state={rendered:!0,icon:e,inline:i,customisations:t,attrMode:n,renderedMode:r})}startObserver(){if(!this._observer&&!this.hasAttribute(`noobserver`))try{this._observer=new IntersectionObserver(e=>{let t=e.some(e=>e.isIntersecting);t!==this._visible&&(this._visible=t,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};o.forEach(e=>{e in s.prototype||Object.defineProperty(s.prototype,e,{get:function(){return this.getAttribute(e)},set:function(t){t===null?this.removeAttribute(e):this.setAttribute(e,t)}})});let c=Ve();for(let e in c)s[e]=s.prototype[e]=c[e];return t.define(e,s),s}var D,O,k,A,Xe,j,Ze,M,N,P,F,Qe,I,L,$e,R,z,B,V,et,H,U,tt,nt,rt,it,at,ot,W,st,ct,lt,G,ut,K,dt,ft,pt,q,mt,ht,gt,_t,vt,yt,bt,xt,St,Ct,wt,Tt,Et,Dt,Ot,kt,At=e((()=>{for(D=Object.freeze({left:0,top:0,width:16,height:16}),O=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),k=Object.freeze({...D,...O}),A=Object.freeze({...k,body:``,hidden:!1}),Xe=Object.freeze({width:null,height:null}),j=Object.freeze({...Xe,...O}),Ze=/[\s,]+/,M={...j,preserveAspectRatio:``},N=/^[a-z0-9]+(-[a-z0-9]+)*$/,P=(e,t,n,r=``)=>{let i=e.split(`:`);if(e.slice(0,1)===`@`){if(i.length<2||i.length>3)return null;r=i.shift().slice(1)}if(i.length>3||!i.length)return null;if(i.length>1){let e=i.pop(),n=i.pop(),a={provider:i.length>0?i[0]:r,prefix:n,name:e};return t&&!F(a)?null:a}let a=i[0],o=a.split(`-`);if(o.length>1){let e={provider:r,prefix:o.shift(),name:o.join(`-`)};return t&&!F(e)?null:e}if(n&&r===``){let e={provider:r,prefix:``,name:a};return t&&!F(e,n)?null:e}return null},F=(e,t)=>e?!!((t&&e.prefix===``||e.prefix)&&e.name):!1,Qe={provider:``,aliases:{},not_found:{},...D},I=Object.create(null),L=!1,$e=0,R=Object.create(null),z=Object.create(null),B=[`https://api.simplesvg.com`,`https://api.unisvg.com`],V=[];B.length>0;)B.length===1||Math.random()>.5?V.push(B.shift()):V.push(B.pop());z[``]=x({resources:[`https://api.iconify.design`].concat(V)}),et={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1},H=Object.create(null),U=(e,t)=>{let n=se(le(e,!0,g()));if(!n.pending.length){let e=!0;return t&&setTimeout(()=>{e&&t(n.loaded,n.missing,n.pending,_e)}),()=>{e=!1}}let r=Object.create(null),i=[],a,o;return n.pending.forEach(e=>{let{provider:t,prefix:n}=e;if(n===o&&t===a)return;a=t,o=n,i.push(m(t,n));let s=r[t]||(r[t]=Object.create(null));s[n]||(s[n]=[])}),n.pending.forEach(e=>{let{provider:t,prefix:n,name:i}=e,a=m(t,n),o=a.pendingIcons||=new Set;o.has(i)||(o.add(i),r[t][n].push(i))}),i.forEach(e=>{let t=r[e.provider][e.prefix];t.length&&xe(e,t)}),t?oe(t,n,i):_e},tt=e=>new Promise((t,n)=>{let r=typeof e==`string`?P(e,!0):e;if(!r){n(e);return}U([r||e],i=>{if(i.length&&r){let e=_(r);if(e){t({...k,...e});return}}n(e)})}),nt=!1;try{nt=navigator.vendor.indexOf(`Apple`)===0}catch{}rt=/(-?[0-9.]*[0-9]+[0-9.]*)/g,it=/^-?[0-9.]*[0-9]+[0-9.]*$/g,at=e=>e===`unset`||e===`undefined`||e===`none`,ot=()=>{let e;try{if(e=fetch,typeof e==`function`)return e}catch{}},W=ot(),st=(e,t,n)=>{let r=[],i=Pe(e,t),a=`icons`,o={type:a,provider:e,prefix:t,icons:[]},s=0;return n.forEach((n,c)=>{s+=n.length+1,s>=i&&c>0&&(r.push(o),o={type:a,provider:e,prefix:t,icons:[]},s=n.length),o.icons.push(n)}),r.push(o),r},ct=(e,t,n)=>{if(!W){n(`abort`,424);return}let r=Ie(t.provider);switch(t.type){case`icons`:{let e=t.prefix,n=t.icons.join(`,`),i=new URLSearchParams({icons:n});r+=e+`.json?`+i.toString();break}case`custom`:{let e=t.uri;r+=e.slice(0,1)===`/`?e.slice(1):e;break}default:n(`abort`,400);return}let i=503;W(e+r).then(e=>{let t=e.status;if(t!==200){setTimeout(()=>{n(Fe(t)?`abort`:`next`,t)});return}return i=501,e.json()}).then(e=>{if(typeof e!=`object`||!e){setTimeout(()=>{e===404?n(`abort`,e):n(`next`,i)});return}setTimeout(()=>{n(`success`,e)})}).catch(()=>{n(`next`,i)})},lt={prepare:st,send:ct},G=`data-style`,ut=``,K={"background-color":`currentColor`},dt={"background-color":`transparent`},ft={image:`var(--svg)`,repeat:`no-repeat`,size:`100% 100%`},pt={"-webkit-mask":K,mask:K,background:dt};for(let e in pt){let t=pt[e];for(let n in ft)t[e+`-`+n]=ft[n]}mt=Ye()||Ve(),{iconLoaded:ht,getIcon:gt,listIcons:_t,addIcon:vt,addCollection:yt,calculateSize:bt,buildIcon:xt,iconToHTML:St,svgToURL:Ct,loadIcons:wt,loadIcon:Tt,setCustomIconLoader:Et,setCustomIconsLoader:Dt,addAPIProvider:Ot,_api:kt}=mt}));function jt(){return{lowHpThreshold:30,preferDot:!0,useForgeSpells:!0,conserveMana:!1}}function Mt(e,t,n,r,i){return{view:`game`,currentFloorId:`f1`,currentRoomId:`f1_entry`,player:{name:`Adventurer`,level:1,xp:0,xpToNext:50,hp:80,maxHp:80,mana:40,maxMana:40,attack:10,defense:5,spellPower:8,gold:30,traits:{aggression:.3,compassion:.5,cunning:.3},inventory:[],equipment:{weapon:null,offhand:null,accessory:null},spells:r.map(e=>({...e,affinityUses:0})),runes:[{id:`rune_fire`,name:`Fire Rune`,type:`rune`,icon:`game-icons:fire-ring`,element:`fire`},{id:`rune_blood`,name:`Blood Rune`,type:`rune`,icon:`game-icons:drop`,element:`blood`}],discoveredRecipes:[],craftedSpellUsedOnFloor:{},skillPoints:1,unlockedSkills:[],loadout:{spellSlots:[r[0]?.id||null,r[1]?.id||null,null,null]},combatPolicy:jt(),affinities:{}},clearedRooms:[],visitedRooms:[`f1_entry`],dialogueChoicesMade:{},combat:null,floorsData:e,runesData:t,recipesData:n,skillTreeData:i,starterSpells:r,turnsElapsed:0,hungerLevel:0}}function J(e){try{let t={...e,combat:null};localStorage.setItem(Q,JSON.stringify(t))}catch(e){console.warn(`Failed to save game:`,e)}}function Nt(){try{let e=localStorage.getItem(Q);return e?JSON.parse(e):null}catch(e){return console.warn(`Failed to load game:`,e),null}}function Pt(){localStorage.removeItem(Q)}function Y(e){return e.floorsData.find(t=>t.id===e.currentFloorId)}function X(e){return Y(e)?.rooms.find(t=>t.id===e.currentRoomId)}function Ft(e){let t={};for(let n of Object.values(e.player.equipment))if(n?.stats)for(let[e,r]of Object.entries(n.stats))t[e]=(t[e]||0)+r;return t}function Z(e){let t=Ft(e),n={};for(let t of e.player.unlockedSkills){let r=e.skillTreeData.find(e=>e.id===t);if(r)for(let[e,t]of Object.entries(r.effect))n[e]=(n[e]||0)+t}let r=Math.floor(e.hungerLevel/20);return{maxHp:e.player.maxHp+(t.maxHp||0)+(n.maxHp||0),maxMana:e.player.maxMana+(t.maxMana||0)+(n.maxMana||0),attack:Math.max(1,e.player.attack+(t.attack||0)+(n.attack||0)-r),defense:Math.max(0,e.player.defense+(t.defense||0)+(n.defense||0)-r),spellPower:Math.max(1,e.player.spellPower+(t.spellPower||0)+(n.spellPower||0)),craftedManaCostReduction:n.craftedManaCostReduction||0}}function It(e){return e.player.xp>=e.player.xpToNext?(e.player.xp-=e.player.xpToNext,e.player.level++,e.player.xpToNext=Math.floor(e.player.xpToNext*1.5),e.player.maxHp+=8,e.player.maxMana+=5,e.player.hp=e.player.maxHp,e.player.mana=e.player.maxMana,e.player.attack+=2,e.player.defense+=1,e.player.spellPower+=1,e.player.skillPoints+=1,!0):!1}var Q,$=e((()=>{Q=`escape-dungeon-save-v5`}));function Lt(e,t){return{enemy:{...JSON.parse(JSON.stringify(t)),statusEffects:[]},playerStatusEffects:[],playerShield:null,playerBuff:null,log:[{actor:`system`,text:`${t.name} appears!`,type:`info`}],turn:0,phase:`setup`,autoRunning:!1}}function Rt(e){return e.player.loadout.spellSlots.filter(e=>e!==null).map(t=>e.player.spells.find(e=>e.id===t)).filter(e=>!!e)}function zt(e,t){let n=e.player.combatPolicy,r=Z(e),i=e.player.hp/r.maxHp*100,a=Rt(e);if(i<=n.lowHpThreshold){let t=a.find(t=>t.effect.type===`heal`&&e.player.mana>=t.manaCost);if(t)return{action:`heal`,spell:t}}if(n.preferDot||t.enemy.reflectDamage>.2||t.enemy.directResist>.3){let t=a.find(t=>t.effect.type===`dot`&&e.player.mana>=t.manaCost);if(t)return{action:`spell`,spell:t}}if(n.useForgeSpells){let t=a.find(t=>t.isCrafted&&e.player.mana>=t.manaCost);if(t)return{action:`spell`,spell:t}}let o=a.find(n=>(n.effect.type===`shield`||n.effect.type===`buff`)&&e.player.mana>=n.manaCost&&!t.playerShield&&!t.playerBuff);if(o)return{action:`spell`,spell:o};if(n.conserveMana&&e.player.mana<e.player.maxMana*.4)return{action:`attack`};let s=a.find(t=>(t.effect.type===`direct`||t.effect.type===`dot`)&&e.player.mana>=t.manaCost);return s?{action:`spell`,spell:s}:{action:`attack`}}function Bt(e,t){t.turn++,e.turnsElapsed++,e.hungerLevel+=.5;let n=Z(e),r=t.log,i=zt(e,t);if(i.action===`heal`&&i.spell){let t=i.spell;e.player.mana-=t.manaCost;let a=t.effect.amount||20,o=Math.min(a,n.maxHp-e.player.hp);e.player.hp+=o,r.push({actor:`player`,text:`You cast ${t.name}, healing ${o} HP.`,type:`heal`}),Vt(e,t)}else if(i.action===`spell`&&i.spell){let a=i.spell,o=a.isCrafted?n.craftedManaCostReduction:0,s=Math.max(1,a.manaCost-o);if(e.player.mana-=s,Vt(e,a),a.isCrafted&&(e.player.craftedSpellUsedOnFloor[e.currentFloorId]=!0),a.effect.type===`dot`){let e=a.effect.damage+Math.floor(n.spellPower*.3),i=e-Math.floor(e*t.enemy.dotResist);t.enemy.statusEffects.push({kind:a.effect.element||`magic`,dmgPerTurn:i,turns:a.effect.turns||3,sourceSpell:a.id,element:a.effect.element}),r.push({actor:`player`,text:`You cast ${a.name}! ${t.enemy.name} is afflicted (${i}/turn for ${a.effect.turns} turns).`,type:`dot`})}else if(a.effect.type===`direct`){let i=(a.effect.damage||0)+Math.floor(n.spellPower*.5),o=Math.floor(i*t.enemy.directResist),s=Math.max(1,i-o-Math.floor(t.enemy.defense*.3));if(t.enemy.reflectDamage>0&&!a.effect.bypassReflect){let n=Math.floor(s*t.enemy.reflectDamage),i=0;t.playerShield&&(i=Math.min(n,t.playerShield.absorb),t.playerShield.absorb-=i,t.playerShield.absorb<=0&&(t.playerShield=null));let a=n-i;a>0&&(e.player.hp-=a,r.push({actor:`enemy`,text:`${t.enemy.name} reflects ${a} damage back!${i>0?` (${i} absorbed by shield)`:``}`,type:`reflect`}))}t.enemy.hp-=s,r.push({actor:`player`,text:`You cast ${a.name} for ${s} damage${o>0?` (${o} resisted)`:``}.`,type:`damage`})}else a.effect.type===`buff`?(a.effect.hpCost&&(e.player.hp-=a.effect.hpCost),a.effect.manaRestore&&(e.player.mana=Math.min(n.maxMana,e.player.mana+a.effect.manaRestore)),a.effect.spellPowerBuff&&(t.playerBuff={spellPower:a.effect.spellPowerBuff,turns:a.effect.buffTurns||3}),r.push({actor:`player`,text:`You cast ${a.name}!${a.effect.hpCost?` Lost ${a.effect.hpCost} HP.`:``}${a.effect.manaRestore?` Restored ${a.effect.manaRestore} mana.`:``}`,type:`status`})):a.effect.type===`shield`&&(t.playerShield={absorb:a.effect.absorb||30,turns:a.effect.turns||4},r.push({actor:`player`,text:`You cast ${a.name}! Shield absorbs up to ${t.playerShield.absorb} damage.`,type:`status`}))}else{let i=n.attack,a=Math.max(1,i-Math.floor(t.enemy.defense*.5));if(t.enemy.reflectDamage>0){let n=Math.floor(a*t.enemy.reflectDamage*.5);n>0&&(e.player.hp-=n,r.push({actor:`enemy`,text:`${t.enemy.name} reflects ${n} damage from your attack!`,type:`reflect`}))}t.enemy.hp-=a,r.push({actor:`player`,text:`You strike for ${a} damage.`,type:`damage`})}if(t.enemy.hp<=0){t.enemy.hp=0,t.phase=`victory`,r.push({actor:`system`,text:`${t.enemy.name} is defeated!`,type:`info`});return}let a=[];for(let e=0;e<t.enemy.statusEffects.length;e++){let n=t.enemy.statusEffects[e];t.enemy.hp-=n.dmgPerTurn,r.push({actor:`system`,text:`${t.enemy.name} takes ${n.dmgPerTurn} ${n.kind} damage (DoT).`,type:`dot`}),n.turns--,n.turns<=0&&a.push(e)}for(let e=a.length-1;e>=0;e--)t.enemy.statusEffects.splice(a[e],1);if(t.enemy.hp<=0){t.enemy.hp=0,t.phase=`victory`,r.push({actor:`system`,text:`${t.enemy.name} is defeated!`,type:`info`});return}if(t.enemy.manaDrainPerTurn){let n=Math.min(t.enemy.manaDrainPerTurn,e.player.mana);e.player.mana-=n,n>0&&r.push({actor:`enemy`,text:`${t.enemy.name} drains ${n} mana!`,type:`drain`})}let o=1+(t.enemy.traits.aggression||0)*.3,s=Math.floor(t.enemy.attack*o),c=Math.max(1,s-Math.floor(n.defense*.5));if(t.playerShield){let e=Math.min(c,t.playerShield.absorb);t.playerShield.absorb-=e,c-=e,e>0&&r.push({actor:`system`,text:`Shield absorbs ${e} damage.`,type:`status`}),t.playerShield.absorb<=0&&(t.playerShield=null)}c>0&&(e.player.hp-=c,r.push({actor:`enemy`,text:`${t.enemy.name} attacks for ${c} damage.`,type:`damage`}));let l=[];for(let n=0;n<t.playerStatusEffects.length;n++){let i=t.playerStatusEffects[n];e.player.hp-=i.dmgPerTurn,r.push({actor:`system`,text:`You take ${i.dmgPerTurn} ${i.kind} damage.`,type:`dot`}),i.turns--,i.turns<=0&&l.push(n)}for(let e=l.length-1;e>=0;e--)t.playerStatusEffects.splice(l[e],1);t.playerShield&&(t.playerShield.turns--,t.playerShield.turns<=0&&(t.playerShield=null,r.push({actor:`system`,text:`Your shield fades.`,type:`status`}))),t.playerBuff&&(t.playerBuff.turns--,t.playerBuff.turns<=0&&(t.playerBuff=null,r.push({actor:`system`,text:`Your buff fades.`,type:`status`}))),e.player.hp<=0&&(e.player.hp=0,t.phase=`defeat`,r.push({actor:`system`,text:`You have been defeated...`,type:`info`}))}function Vt(e,t){t.effect.element&&(e.player.affinities[t.effect.element]=(e.player.affinities[t.effect.element]||0)+1);let n=e.player.spells.find(e=>e.id===t.id);n&&(n.affinityUses=(n.affinityUses||0)+1)}var Ht=e((()=>{$()})),Ut,Wt=e((()=>{$(),Ht(),Ut=class{constructor(e){this.combatTimer=null,this.forgeSelection=[],this.dialogueResponse=null,this.dialogueChosenIdx=null,this.root=e}setState(e,t){this.state=e,this.onStateChange=t,this.render()}render(){switch(this.combatTimer&&=(clearTimeout(this.combatTimer),null),this.state.view){case`title`:return this.renderTitle();case`game`:return this.renderGame();case`combatSetup`:return this.renderCombatSetup();case`combat`:return this.renderCombat();case`merchant`:return this.renderMerchant();case`dialogue`:return this.renderDialogue();case`forge`:return this.renderForge();case`inventory`:return this.renderInventory();case`character`:return this.renderCharacter();case`map`:return this.renderMap();case`victory`:return this.renderVictory();case`defeat`:return this.renderDefeat()}}bind(){this.root.querySelectorAll(`[data-action]`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation(),this.handle(e.dataset.action,e)})}),this.root.querySelectorAll(`[data-spell-slot]`).forEach(e=>{e.addEventListener(`change`,()=>{let t=parseInt(e.dataset.spellSlot);this.state.player.loadout.spellSlots[t]=e.value||null,this.render()})}),this.root.querySelectorAll(`[data-policy-range]`).forEach(e=>{e.addEventListener(`input`,()=>{let t=e.dataset.policyRange;this.state.player.combatPolicy[t]=parseInt(e.value),this.render()})})}handle(e,t){let n=this.state;if(e===`navigate`){let e=t.dataset.room;this.navigateTo(e)}else if(e===`enter-combat`){n.view=`combatSetup`;let e=X(n);e?.enemy&&(n.combat=Lt(n,e.enemy)),this.render()}else if(e===`start-auto-combat`)n.combat&&(n.combat.phase=`running`,n.combat.autoRunning=!0,n.view=`combat`,this.render(),this.runAutoCombat());else if(e===`pause-combat`)n.combat&&(n.combat.phase=`paused`,n.combat.autoRunning=!1),this.render();else if(e===`resume-combat`)n.combat&&(n.combat.phase=`running`,n.combat.autoRunning=!0,this.render(),this.runAutoCombat());else if(e===`collect-loot`)this.collectLoot();else if(e===`return-to-room`)n.combat=null,n.view=`game`,J(n),this.render();else if(e===`open-merchant`)n.view=`merchant`,this.render();else if(e===`buy-item`){let e=t.dataset.itemId;this.buyItem(e)}else if(e===`open-dialogue`)n.view=`dialogue`,this.dialogueResponse=null,this.dialogueChosenIdx=null,this.render();else if(e===`dialogue-choice`){let e=parseInt(t.dataset.choiceIdx);this.handleDialogueChoice(e)}else if(e===`open-forge`)n.view=`forge`,this.forgeSelection=[],this.render();else if(e===`toggle-rune`){let e=t.dataset.element;this.forgeSelection.includes(e)?this.forgeSelection=this.forgeSelection.filter(t=>t!==e):this.forgeSelection.length<2&&this.forgeSelection.push(e),this.render()}else if(e===`craft-spell`)this.craftSpell();else if(e===`back-to-game`)n.view=`game`,this.render();else if(e===`open-inventory`)n.view=`inventory`,this.render();else if(e===`open-character`)n.view=`character`,this.render();else if(e===`open-map`)n.view=`map`,this.render();else if(e===`equip-item`){let e=t.dataset.itemId;this.equipItem(e)}else if(e===`use-item`){let e=t.dataset.itemId;this.useConsumable(e)}else if(e===`unequip-item`){let e=t.dataset.slot;this.unequipItem(e)}else if(e===`unlock-skill`){let e=t.dataset.skillId;this.unlockSkill(e)}else if(e===`toggle-policy`){let e=t.dataset.policyKey;n.player.combatPolicy[e]=!n.player.combatPolicy[e],this.render()}else if(e===`next-floor`){let e=X(n);if(e?.bossGateToFloor){if(e.bossGateToFloor===`victory`)n.view=`victory`;else{n.currentFloorId=e.bossGateToFloor;let t=Y(n);t&&(n.currentRoomId=t.rooms[0].id,n.visitedRooms.push(n.currentRoomId)),n.view=`game`}J(n),this.render()}}else if(e===`new-game-from-defeat`)this.onStateChange?.();else if(e===`map-navigate`){let e=t.dataset.room;n.visitedRooms.includes(e)&&(this.navigateTo(e),n.view=`game`,this.render())}}navigateTo(e){let t=this.state;t.currentRoomId=e,t.visitedRooms.includes(e)||t.visitedRooms.push(e),t.hungerLevel+=1,t.view=`game`,J(t),this.render()}runAutoCombat(){!this.state.combat||!this.state.combat.autoRunning||this.state.combat.phase===`running`&&(Bt(this.state,this.state.combat),this.render(),this.state.combat.phase===`running`&&(this.combatTimer=window.setTimeout(()=>this.runAutoCombat(),800)))}collectLoot(){let e=this.state,t=X(e);if(!t?.enemy||!e.combat)return;let n=t.enemy;e.player.xp+=n.xpReward,e.player.gold+=n.goldReward;for(let t of n.loot)if(!(Math.random()>t.chance))if(t.type===`rune`&&t.id){let n=e.runesData.find(e=>e.id===t.id);n&&!e.player.runes.some(e=>e.id===t.id)&&e.player.runes.push({id:n.id,name:n.name,type:`rune`,icon:n.icon,element:n.element})}else t.type===`equipment`&&t.value&&e.player.inventory.push(t.value);e.clearedRooms.push(e.currentRoomId),It(e),e.combat=null,e.view=`game`,J(e),this.render()}buyItem(e){let t=this.state,n=X(t);if(!n?.merchant)return;let r=n.merchant.inventory.find(t=>t.id===e);!r||t.player.gold<r.cost||(t.player.gold-=r.cost,r.type===`consumable`?t.player.inventory.push({id:r.id,name:r.name,type:`consumable`,icon:r.icon,effect:r.effect}):r.type===`equipment`&&t.player.inventory.push({id:r.id,name:r.name,type:`equipment`,slot:r.slot,icon:r.icon,stats:r.stats}),J(t),this.render())}handleDialogueChoice(e){let t=this.state,n=X(t);if(!n?.npc)return;let r=n.npc.branches[e];if(r){this.dialogueChosenIdx=e,this.dialogueResponse=r.response;for(let[e,n]of Object.entries(r.traitShift))t.player.traits[e]=Math.max(0,Math.min(1,(t.player.traits[e]||0)+n));if(r.reward)if(r.reward.type===`item`&&r.reward.value){let e=r.reward.value;e.type===`rune`?t.player.runes.some(t=>t.id===e.id)||t.player.runes.push(e):t.player.inventory.push(e)}else r.reward.type===`xp`&&(t.player.xp+=r.reward.value,It(t));t.dialogueChoicesMade[n.id]=e,J(t),this.render()}}craftSpell(){let e=this.state;if(this.forgeSelection.length!==2)return;let t=[...this.forgeSelection].sort(),n=e.recipesData.find(e=>{let n=[...e.elements].sort();return n[0]===t[0]&&n[1]===t[1]});if(n&&!e.player.spells.some(e=>e.id===n.id)){let t={id:n.id,name:n.name,icon:n.icon,manaCost:n.manaCost,description:n.description,effect:n.effect,isCrafted:!0,affinityUses:0};e.player.spells.push(t),e.player.discoveredRecipes.includes(n.id)||e.player.discoveredRecipes.push(n.id);let r=e.player.loadout.spellSlots.indexOf(null);r>=0&&(e.player.loadout.spellSlots[r]=n.id),J(e)}this.render()}equipItem(e){let t=this.state,n=t.player.inventory.findIndex(t=>t.id===e&&t.type===`equipment`);if(n<0)return;let r=t.player.inventory[n],i=t.player.equipment[r.slot];i&&t.player.inventory.push(i),t.player.equipment[r.slot]=r,t.player.inventory.splice(n,1),J(t),this.render()}unequipItem(e){let t=this.state,n=t.player.equipment[e];n&&(t.player.inventory.push(n),t.player.equipment[e]=null,J(t),this.render())}useConsumable(e){let t=this.state,n=t.player.inventory.findIndex(t=>t.id===e&&t.type===`consumable`);if(n<0)return;let r=t.player.inventory[n];if(r.type!==`consumable`)return;let i=Z(t);r.effect.heal&&(t.player.hp=Math.min(i.maxHp,t.player.hp+r.effect.heal)),r.effect.restoreMana&&(t.player.mana=Math.min(i.maxMana,t.player.mana+r.effect.restoreMana)),t.player.inventory.splice(n,1),J(t),this.render()}unlockSkill(e){let t=this.state,n=t.skillTreeData.find(t=>t.id===e);if(!n||t.player.unlockedSkills.includes(e)||t.player.skillPoints<n.cost||n.requires.some(e=>!t.player.unlockedSkills.includes(e)))return;t.player.skillPoints-=n.cost,t.player.unlockedSkills.push(e);let r=Z(t);t.player.hp=Math.min(t.player.hp,r.maxHp),t.player.mana=Math.min(t.player.mana,r.maxMana),J(t),this.render()}renderTitle(){this.root.innerHTML=`
      <div class="title-screen">
        <iconify-icon class="title-icon" icon="game-icons:dungeon-gate" width="80"></iconify-icon>
        <h1>Escape the Dungeon</h1>
        <p class="subtitle">Craft your spells. Configure your tactics. Survive.</p>
        <div class="title-buttons">
          <button class="btn btn-primary" data-action="new-game-from-defeat">
            <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> New Game
          </button>
        </div>
      </div>
    `,this.bind()}renderTopBar(){let e=this.state,t=Z(e),n=Y(e),r=Math.max(0,e.player.hp/t.maxHp*100),i=Math.max(0,e.player.mana/t.maxMana*100),a=e.player.xp/e.player.xpToNext*100,o=Math.min(100,e.player.hungerLevel);return`
      <div class="top-bar">
        <span class="floor-name">
          <iconify-icon icon="game-icons:stairs"></iconify-icon> ${n?.name||`Unknown`}
        </span>
        <div class="stat-group">
          <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
          <span>${e.player.hp}/${t.maxHp}</span>
          <div class="bar-container"><div class="bar-fill bar-hp" style="width:${r}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon>
          <span>${e.player.mana}/${t.maxMana}</span>
          <div class="bar-container"><div class="bar-fill bar-mana" style="width:${i}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:level-end-flag" style="color:var(--gold)"></iconify-icon>
          <span>Lv.${e.player.level}</span>
          <div class="bar-container"><div class="bar-fill bar-xp" style="width:${a}%"></div></div>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:coins" style="color:var(--gold)"></iconify-icon>
          <span>${e.player.gold}g</span>
        </div>
        <div class="stat-group">
          <iconify-icon icon="game-icons:meal" style="color:var(--fire)"></iconify-icon>
          <span>Hunger</span>
          <div class="bar-container"><div class="bar-fill bar-hunger" style="width:${o}%"></div></div>
        </div>
      </div>
    `}renderSidebar(){let e=this.state,t=Y(e),n=``;for(let[t,r]of Object.entries(e.player.traits)){let e=r*100;n+=`
        <div class="trait-row">
          <span>${t}</span>
          <div class="trait-bar-bg">
            <div class="trait-bar-fill trait-${t}" style="width:${e}%"></div>
          </div>
          <span class="trait-value">${r.toFixed(2)}</span>
        </div>
      `}let r=``,i=Object.entries(e.player.affinities);if(i.length>0){r=`<div class="panel"><h3><iconify-icon icon="game-icons:magic-swirl"></iconify-icon> Affinities</h3><div class="affinity-list">`;for(let[e,t]of i)r+=`<div class="affinity-row"><span class="element-${e}">${e}</span><span>${t} casts</span></div>`;r+=`</div></div>`}return`
      <div class="sidebar">
        <div class="panel">
          <h3><iconify-icon icon="game-icons:compass"></iconify-icon> Navigation</h3>
          <div class="nav-buttons">
            <button class="btn btn-small" data-action="open-inventory">
              <iconify-icon icon="game-icons:knapsack"></iconify-icon> Inventory
            </button>
            <button class="btn btn-small" data-action="open-character">
              <iconify-icon icon="game-icons:character"></iconify-icon> Character
            </button>
            <button class="btn btn-small" data-action="open-map">
              <iconify-icon icon="game-icons:treasure-map"></iconify-icon> Map
            </button>
          </div>
        </div>
        <div class="panel">
          <h3><iconify-icon icon="game-icons:brain"></iconify-icon> Traits</h3>
          ${n}
        </div>
        ${r}
        ${t?`<div class="panel pressure-panel">
          <div class="floor-pressure-note">
            <iconify-icon icon="game-icons:alert"></iconify-icon>
            ${t.pressure_note}
          </div>
        </div>`:``}
      </div>
    `}renderGame(){let e=this.state,t=X(e),n=Y(e);if(!t||!n)return;let r=e.clearedRooms.includes(t.id),i=e.dialogueChoicesMade[t.id]!==void 0,a=``;t.type===`combat`||t.type===`boss`?a=r?t.bossGateToFloor?`
          <div style="margin-top:12px">
            <button class="btn btn-primary" data-action="next-floor">
              <iconify-icon icon="game-icons:stairs"></iconify-icon> Descend to Next Floor
            </button>
          </div>
        `:`<p style="color:var(--nature);margin-top:8px"><iconify-icon icon="game-icons:check-mark"></iconify-icon> Room cleared</p>`:`
          <div style="margin-top:12px">
            <button class="btn btn-danger" data-action="enter-combat">
              <iconify-icon icon="game-icons:crossed-swords"></iconify-icon> Engage ${t.enemy?.name||`Enemy`}
            </button>
          </div>
        `:t.type===`merchant`?a=`
        <div style="margin-top:12px">
          <button class="btn" data-action="open-merchant">
            <iconify-icon icon="game-icons:trade"></iconify-icon> Browse Wares
          </button>
        </div>
      `:t.type===`dialogue`?a=i?`<p style="color:var(--text-dim);margin-top:8px"><iconify-icon icon="game-icons:check-mark"></iconify-icon> Already spoken</p>`:`
          <div style="margin-top:12px">
            <button class="btn" data-action="open-dialogue">
              <iconify-icon icon="game-icons:talk"></iconify-icon> Speak with ${t.npc?.name||`NPC`}
            </button>
          </div>
        `:t.type===`forge`&&(a=`
        <div style="margin-top:12px">
          <button class="btn" data-action="open-forge">
            <iconify-icon icon="game-icons:anvil"></iconify-icon> Use the Runforge
          </button>
        </div>
      `);let o=`<div class="exits-list">`;for(let r of t.exits){let t=n.rooms.find(e=>e.id===r);if(t){e.visitedRooms.includes(r);let n=e.clearedRooms.includes(r);o+=`
          <button class="btn btn-small" data-action="navigate" data-room="${r}">
            <iconify-icon icon="${t.icon}"></iconify-icon>
            ${t.name}
            ${n?`<iconify-icon icon="game-icons:check-mark" style="color:var(--nature);font-size:0.8em"></iconify-icon>`:``}
          </button>
        `}}o+=`</div>`,this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${t.icon}" width="48"></iconify-icon>
              <div>
                <h2>${t.name} <span class="room-type-badge type-${t.type}">${t.type}</span></h2>
              </div>
            </div>
            <p class="room-description">${t.description}</p>
            ${a}
          </div>
          <div class="panel">
            <h3><iconify-icon icon="game-icons:doorway"></iconify-icon> Exits</h3>
            ${o}
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderCombatSetup(){let e=this.state,t=e.combat;if(!t)return;let n=e.player.combatPolicy,r=``;for(let t=0;t<4;t++){let n=e.player.loadout.spellSlots[t],i=`<option value="">-- empty --</option>`;for(let t of e.player.spells){let e=t.id===n?`selected`:``;i+=`<option value="${t.id}" ${e}>${t.name} (${t.manaCost} MP)</option>`}r+=`
        <div class="spell-slot">
          <span>Slot ${t+1}:</span>
          <select data-spell-slot="${t}">${i}</select>
        </div>
      `}this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:battle-gear"></iconify-icon> Combat Setup</h2>
            <p style="color:var(--text-dim);margin-bottom:16px">Configure your loadout and action policies before engaging. Combat will auto-resolve based on your build.</p>

            <div class="combatants" style="margin-bottom:16px">
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="game-icons:knight-helmet" style="color:var(--arcane)"></iconify-icon>
                <div><strong>You</strong></div>
                <div style="font-size:0.85rem;color:var(--text-dim)">Lv.${e.player.level}</div>
              </div>
              <div class="vs-divider">VS</div>
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="${t.enemy.icon}" style="color:var(--danger)"></iconify-icon>
                <div><strong>${t.enemy.name}</strong></div>
                <div style="font-size:0.85rem;color:var(--text-dim)">
                  HP: ${t.enemy.hp} | ATK: ${t.enemy.attack} | DEF: ${t.enemy.defense}
                </div>
                <div class="enemy-traits">
                  ${Object.entries(t.enemy.traits).map(([e,t])=>`<span>${e}: ${t.toFixed(1)}</span>`).join(` | `)}
                </div>
                ${t.enemy.directResist>0?`<div style="font-size:0.8rem;color:var(--fire)">Direct Resist: ${Math.round(t.enemy.directResist*100)}%</div>`:``}
                ${t.enemy.reflectDamage>0?`<div style="font-size:0.8rem;color:var(--shadow)">Reflects: ${Math.round(t.enemy.reflectDamage*100)}% damage</div>`:``}
                ${t.enemy.manaDrainPerTurn?`<div style="font-size:0.8rem;color:var(--mana)">Mana Drain: ${t.enemy.manaDrainPerTurn}/turn</div>`:``}
              </div>
            </div>

            <div class="setup-section">
              <h3><iconify-icon icon="game-icons:spell-book"></iconify-icon> Spell Loadout</h3>
              <div class="spell-slot-grid">${r}</div>
            </div>

            <div class="setup-section">
              <h3><iconify-icon icon="game-icons:cog"></iconify-icon> Action Policies</h3>
              <div class="policy-grid">
                <div class="policy-toggle ${n.preferDot?`active`:``}" data-action="toggle-policy" data-policy-key="preferDot">
                  <iconify-icon icon="game-icons:poison-cloud"></iconify-icon> Prefer DoT Spells
                </div>
                <div class="policy-toggle ${n.useForgeSpells?`active`:``}" data-action="toggle-policy" data-policy-key="useForgeSpells">
                  <iconify-icon icon="game-icons:anvil"></iconify-icon> Use Crafted Spells
                </div>
                <div class="policy-toggle ${n.conserveMana?`active`:``}" data-action="toggle-policy" data-policy-key="conserveMana">
                  <iconify-icon icon="game-icons:crystal-ball"></iconify-icon> Conserve Mana
                </div>
              </div>
              <div class="threshold-control" style="margin-top:8px">
                <iconify-icon icon="game-icons:health-increase" style="color:var(--heal)"></iconify-icon>
                <span>Heal at HP%:</span>
                <input type="range" min="10" max="60" value="${n.lowHpThreshold}" data-policy-range="lowHpThreshold" />
                <span>${n.lowHpThreshold}%</span>
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px">
              <button class="btn btn-primary" data-action="start-auto-combat">
                <iconify-icon icon="game-icons:sword-clash"></iconify-icon> Begin Auto-Combat
              </button>
              <button class="btn" data-action="return-to-room">
                <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Retreat
              </button>
            </div>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderCombat(){let e=this.state,t=e.combat;if(!t)return;let n=Z(e),r=Math.max(0,e.player.hp/n.maxHp*100),i=Math.max(0,e.player.mana/n.maxMana*100),a=Math.max(0,t.enemy.hp/t.enemy.maxHp*100),o=``;for(let e of t.enemy.statusEffects)o+=`<span class="status-chip element-${e.element||``}">${e.kind} (${e.dmgPerTurn}/t, ${e.turns}t)</span>`;let s=``;t.playerShield&&(s+=`<span class="status-chip" style="color:var(--arcane)">Shield (${t.playerShield.absorb} abs, ${t.playerShield.turns}t)</span>`),t.playerBuff&&(s+=`<span class="status-chip" style="color:var(--gold)">Buff (+${t.playerBuff.spellPower} SP, ${t.playerBuff.turns}t)</span>`);let c=t.log.slice(-15),l=``;for(let e of c){let t=e.actor===`player`?`log-player`:e.actor===`enemy`?`log-enemy`:`log-${e.type}`;l+=`<div class="log-entry ${t}">${e.text}</div>`}let u=``;t.phase===`running`?u=`<button class="btn btn-danger" data-action="pause-combat"><iconify-icon icon="game-icons:pause-button"></iconify-icon> Pause</button>`:t.phase===`paused`?u=`
        <button class="btn btn-primary" data-action="resume-combat"><iconify-icon icon="game-icons:play-button"></iconify-icon> Resume</button>
        <button class="btn" data-action="return-to-room"><iconify-icon icon="game-icons:return-arrow"></iconify-icon> Flee</button>
      `:t.phase===`victory`?u=`<button class="btn btn-primary" data-action="collect-loot"><iconify-icon icon="game-icons:open-treasure-chest"></iconify-icon> Collect Loot & Continue</button>`:t.phase===`defeat`&&(u=`<button class="btn btn-danger" data-action="new-game-from-defeat"><iconify-icon icon="game-icons:skull"></iconify-icon> Game Over</button>`),this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel combat-layout">
            <h2><iconify-icon icon="game-icons:crossed-swords"></iconify-icon> Combat - Turn ${t.turn}</h2>
            <div class="combatants">
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="game-icons:knight-helmet" style="color:var(--arcane)" width="48"></iconify-icon>
                <div><strong>You</strong></div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
                  ${e.player.hp}/${n.maxHp}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-hp" style="width:${r}%"></div></div>
                </div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon>
                  ${e.player.mana}/${n.maxMana}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-mana" style="width:${i}%"></div></div>
                </div>
                <div class="status-effects">${s}</div>
              </div>
              <div class="vs-divider">VS</div>
              <div class="combatant-card panel">
                <iconify-icon class="combatant-icon" icon="${t.enemy.icon}" style="color:var(--danger)" width="48"></iconify-icon>
                <div><strong>${t.enemy.name}</strong></div>
                <div class="stat-group" style="justify-content:center">
                  <iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon>
                  ${t.enemy.hp}/${t.enemy.maxHp}
                  <div class="bar-container" style="width:80px"><div class="bar-fill bar-hp" style="width:${a}%"></div></div>
                </div>
                <div class="enemy-traits">
                  ${Object.entries(t.enemy.traits).map(([e,t])=>`<span>${e}: ${t.toFixed(1)}</span>`).join(` | `)}
                </div>
                <div class="status-effects">${o}</div>
              </div>
            </div>

            <div class="combat-log" id="combat-log">${l}</div>

            <div class="combat-controls">${u}</div>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `;let d=document.getElementById(`combat-log`);d&&(d.scrollTop=d.scrollHeight),this.bind()}renderMerchant(){let e=this.state,t=X(e);if(!t?.merchant)return;let n=t.merchant,r=``;for(let t of n.inventory){let n=e.player.gold>=t.cost,i=e.player.inventory.some(e=>e.id===t.id)||Object.values(e.player.equipment).some(e=>e?.id===t.id),a=[];t.effect&&a.push(Object.entries(t.effect).map(([e,t])=>`${e}: +${t}`).join(`, `)),t.stats&&a.push(Object.entries(t.stats).map(([e,t])=>`${e}: +${t}`).join(`, `)),r+=`
        <div class="shop-item">
          <iconify-icon icon="${t.icon}" style="font-size:1.5rem;color:var(--gold)"></iconify-icon>
          <div class="shop-item-info">
            <div class="shop-item-name">${t.name}</div>
            <div class="shop-item-desc">${a.join(`, `)}</div>
          </div>
          <div class="shop-price">
            <iconify-icon icon="game-icons:coins"></iconify-icon> ${t.cost}g
          </div>
          <button class="btn btn-small" data-action="buy-item" data-item-id="${t.id}" ${!n||i?`disabled`:``}>
            ${i?`Owned`:`Buy`}
          </button>
        </div>
      `}this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${n.icon}" width="48" style="color:var(--gold)"></iconify-icon>
              <div>
                <h2>${n.name}</h2>
                <span class="room-type-badge type-merchant">Merchant</span>
              </div>
            </div>
            <p style="color:var(--text-dim);margin-bottom:16px">Your gold: <span style="color:var(--gold);font-weight:600">${e.player.gold}g</span></p>
            ${r}
            <button class="btn" data-action="back-to-game" style="margin-top:12px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave Shop
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderDialogue(){let e=this.state,t=X(e);if(!t?.npc)return;let n=t.npc,r=``;for(let e=0;e<n.branches.length;e++){let t=n.branches[e],i=this.dialogueChosenIdx===e,a=this.dialogueChosenIdx!==null&&!i;r+=`
        <button class="dialogue-choice ${i?`chosen`:``}" data-action="dialogue-choice" data-choice-idx="${e}" ${a?`disabled`:``}>
          ${t.text}
          ${t.traitShift?`<span style="font-size:0.75rem;color:var(--text-dim)"> (${Object.entries(t.traitShift).map(([e,t])=>`${e} ${t>0?`+`:``}${t}`).join(`, `)})</span>`:``}
        </button>
      `}this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="${n.icon}" width="48" style="color:var(--nature)"></iconify-icon>
              <div>
                <h2>${n.name}</h2>
                <span class="room-type-badge type-dialogue">Dialogue</span>
              </div>
            </div>
            <div class="npc-greeting">"${n.greeting}"</div>
            ${r}
            ${this.dialogueResponse?`<div class="dialogue-response">"${this.dialogueResponse}"</div>`:``}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderForge(){let e=this.state,t=[...new Set(e.player.runes.map(e=>e.element))],n=``;for(let r of t){let t=e.player.runes.find(e=>e.element===r),i=this.forgeSelection.includes(r);n+=`
        <div class="rune-chip ${i?`selected`:``} element-${r}" data-action="toggle-rune" data-element="${r}">
          <iconify-icon icon="${t.icon}"></iconify-icon> ${t.name}
        </div>
      `}let r=``;if(this.forgeSelection.length===2){let t=[...this.forgeSelection].sort(),n=e.recipesData.find(e=>{let n=[...e.elements].sort();return n[0]===t[0]&&n[1]===t[1]});if(n){let t=e.player.spells.some(e=>e.id===n.id);r=`
          <div class="recipe-result found">
            <iconify-icon icon="${n.icon}" style="font-size:2rem;color:var(--gold)"></iconify-icon>
            <div class="recipe-name">${n.name}</div>
            <p style="font-size:0.85rem;color:var(--text-dim);margin:6px 0">${n.description}</p>
            <p style="font-size:0.8rem">Mana Cost: ${n.manaCost} | Effect: ${n.effect.type}${n.effect.damage?` (${n.effect.damage} dmg)`:``}</p>
            ${t?`<p style="color:var(--nature);margin-top:8px">Already crafted!</p>`:`<button class="btn btn-primary" data-action="craft-spell" style="margin-top:8px"><iconify-icon icon="game-icons:anvil"></iconify-icon> Craft Spell</button>`}
          </div>
        `}else r=`<div class="recipe-result"><p style="color:var(--text-dim)">No recipe found for this combination.</p></div>`}let i=``;if(e.player.discoveredRecipes.length>0){i=`<div style="margin-top:16px"><h3>Crafted Spells</h3>`;for(let t of e.player.discoveredRecipes){let n=e.recipesData.find(e=>e.id===t);n&&(i+=`
            <div class="shop-item">
              <iconify-icon icon="${n.icon}" style="font-size:1.3rem;color:var(--gold)"></iconify-icon>
              <div class="shop-item-info">
                <div class="shop-item-name">${n.name}</div>
                <div class="shop-item-desc">${n.description}</div>
              </div>
            </div>
          `)}i+=`</div>`}let a=`<div style="margin-top:16px"><h3><iconify-icon icon="game-icons:spell-book"></iconify-icon> Recipe Hints</h3>`;for(let n of e.recipesData){let r=n.elements.every(e=>t.includes(e)),i=e.player.discoveredRecipes.includes(n.id);a+=`
        <div style="padding:6px 0;font-size:0.85rem;color:${r?`var(--text)`:`var(--text-dim)`}">
          <iconify-icon icon="${n.icon}"></iconify-icon>
          ${i?n.name:`???`} = ${n.elements.map(e=>`<span class="element-${e}">${e}</span>`).join(` + `)}
          ${r?``:` (missing runes)`}
        </div>
      `}a+=`</div>`,this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <div class="room-header">
              <iconify-icon class="room-icon" icon="game-icons:anvil" width="48" style="color:var(--fire)"></iconify-icon>
              <h2>Runforge</h2>
            </div>
            <p style="color:var(--text-dim);margin-bottom:12px">Select two runes to combine into a new spell. Crafted spells are key to surviving the dungeon's challenges.</p>

            <h3>Your Runes</h3>
            <div class="rune-grid">${n}</div>
            ${this.forgeSelection.length===2?`<p style="font-size:0.85rem;color:var(--accent);margin-bottom:8px">Combining: `+this.forgeSelection.join(` + `)+`</p>`:`<p style="font-size:0.85rem;color:var(--text-dim)">Select 2 runes to combine</p>`}
            ${r}
            ${i}
            ${a}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Leave Forge
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderInventory(){let e=this.state,t=`<div style="margin-bottom:16px"><h3>Equipment</h3><div class="char-stats">`;for(let[n,r]of Object.entries(e.player.equipment))r?t+=`
          <div class="char-stat">
            <iconify-icon icon="${r.icon}" style="color:var(--gold)"></iconify-icon>
            <span>${r.name}</span>
            <span style="font-size:0.75rem;color:var(--text-dim)">(${n})</span>
            <button class="btn btn-small" data-action="unequip-item" data-slot="${n}" style="margin-left:auto;padding:2px 6px">X</button>
          </div>
        `:t+=`<div class="char-stat" style="color:var(--text-dim)"><span>${n}</span><span style="margin-left:auto">empty</span></div>`;t+=`</div></div>`;let n=`<h3>Items</h3>`;if(e.player.inventory.length===0)n+=`<p style="color:var(--text-dim)">No items</p>`;else{n+=`<div class="inventory-grid">`;for(let t of e.player.inventory){let e=``;t.type===`equipment`?e=`data-action="equip-item" data-item-id="${t.id}"`:t.type===`consumable`&&(e=`data-action="use-item" data-item-id="${t.id}"`),n+=`
          <div class="inv-item" ${e}>
            <iconify-icon icon="${t.icon}" style="color:var(--gold)"></iconify-icon>
            <div class="inv-item-name">${t.name}</div>
            <div style="font-size:0.7rem;color:var(--text-dim)">${t.type}</div>
          </div>
        `}n+=`</div>`}let r=`<div style="margin-top:16px"><h3>Runes</h3><div class="rune-grid">`;for(let t of e.player.runes)r+=`
        <div class="rune-chip element-${t.element}">
          <iconify-icon icon="${t.icon}"></iconify-icon> ${t.name}
        </div>
      `;r+=`</div></div>`;let i=`<div style="margin-top:16px"><h3>Spells</h3>`;for(let t of e.player.spells)i+=`
        <div class="shop-item">
          <iconify-icon icon="${t.icon}" style="font-size:1.3rem;color:${t.isCrafted?`var(--gold)`:`var(--arcane)`}"></iconify-icon>
          <div class="shop-item-info">
            <div class="shop-item-name">${t.name} ${t.isCrafted?`<span style="font-size:0.75rem;color:var(--gold)">[Crafted]</span>`:``}</div>
            <div class="shop-item-desc">${t.description} | Cost: ${t.manaCost} MP | Uses: ${t.affinityUses||0}</div>
          </div>
        </div>
      `;i+=`</div>`,this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:knapsack"></iconify-icon> Inventory</h2>
            ${t}
            ${n}
            ${r}
            ${i}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderCharacter(){let e=this.state,t=Z(e),n=`
      <div class="char-stats">
        <div class="char-stat"><iconify-icon icon="game-icons:hearts" style="color:var(--blood)"></iconify-icon> Max HP <span class="char-stat-value">${t.maxHp}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:crystal-ball" style="color:var(--mana)"></iconify-icon> Max Mana <span class="char-stat-value">${t.maxMana}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:broadsword" style="color:var(--danger)"></iconify-icon> Attack <span class="char-stat-value">${t.attack}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:shield" style="color:var(--accent)"></iconify-icon> Defense <span class="char-stat-value">${t.defense}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:magic-lamp" style="color:var(--shadow)"></iconify-icon> Spell Power <span class="char-stat-value">${t.spellPower}</span></div>
        <div class="char-stat"><iconify-icon icon="game-icons:level-end-flag" style="color:var(--gold)"></iconify-icon> Level <span class="char-stat-value">${e.player.level}</span></div>
      </div>
    `,r=`<div style="margin-top:20px"><h3><iconify-icon icon="game-icons:upgrade"></iconify-icon> Skill Tree (${e.player.skillPoints} points available)</h3>`;for(let t of e.skillTreeData){let n=e.player.unlockedSkills.includes(t.id),i=!n&&e.player.skillPoints>=t.cost&&t.requires.every(t=>e.player.unlockedSkills.includes(t));r+=`
        <div class="skill-node ${n?`unlocked`:!n&&!i?`locked`:``}" ${i?`data-action="unlock-skill" data-skill-id="${t.id}"`:``}>
          <iconify-icon icon="${t.icon}" style="color:${n?`var(--gold)`:`var(--text-dim)`}"></iconify-icon>
          <div class="skill-node-info">
            <div><strong>${t.name}</strong></div>
            <div style="font-size:0.8rem;color:var(--text-dim)">${t.description}</div>
            ${t.requires.length>0?`<div style="font-size:0.75rem;color:var(--text-dim)">Requires: ${t.requires.join(`, `)}</div>`:``}
          </div>
          <div class="skill-cost">${n?`Unlocked`:`${t.cost} pts`}</div>
        </div>
      `}r+=`</div>`,this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:character"></iconify-icon> Character Sheet</h2>
            ${n}
            ${r}
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderMap(){let e=this.state,t=Y(e);if(!t)return;let n=``;for(let r of t.rooms){let t=r.id===e.currentRoomId,i=e.visitedRooms.includes(r.id),a=e.clearedRooms.includes(r.id),o=``;t?o=`current`:a?o=`cleared`:i&&(o=`visited`),n+=`
        <div class="map-node ${o}" data-action="map-navigate" data-room="${r.id}" ${i?``:`style="opacity:0.3;cursor:default"`}>
          <iconify-icon icon="${i?r.icon:`game-icons:uncertainty`}" style="color:${t?`var(--accent-bright)`:a?`var(--nature)`:`var(--text-dim)`}"></iconify-icon>
          <div class="map-node-name">${i?r.name:`???`}</div>
          <span class="room-type-badge type-${i?r.type:`corridor`}" style="font-size:0.6rem">${i?r.type:`?`}</span>
        </div>
      `}this.root.innerHTML=`
      <div class="game-layout">
        ${this.renderTopBar()}
        <div class="main-area">
          <div class="panel">
            <h2><iconify-icon icon="game-icons:treasure-map"></iconify-icon> ${t.name} - Map</h2>
            <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:12px">Click a visited room to navigate there.</p>
            <div class="map-container">${n}</div>
            <button class="btn" data-action="back-to-game" style="margin-top:16px">
              <iconify-icon icon="game-icons:return-arrow"></iconify-icon> Back
            </button>
          </div>
        </div>
        ${this.renderSidebar()}
      </div>
    `,this.bind()}renderVictory(){let e=this.state,t=Object.keys(e.player.craftedSpellUsedOnFloor).length,n=Object.entries(e.player.affinities);this.root.innerHTML=`
      <div class="end-screen victory">
        <iconify-icon icon="game-icons:crown" style="font-size:80px;color:var(--gold);filter:drop-shadow(0 0 30px var(--gold-dim))"></iconify-icon>
        <h1>Dungeon Escaped!</h1>
        <p style="color:var(--text-dim);font-size:1.1rem">You conquered the dungeon and escaped alive.</p>
        <div class="panel" style="text-align:left;max-width:400px;width:100%">
          <h3>Run Statistics</h3>
          <div class="end-stats">
            <div class="char-stat"><iconify-icon icon="game-icons:level-end-flag"></iconify-icon> Level <span class="char-stat-value">${e.player.level}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:coins"></iconify-icon> Gold <span class="char-stat-value">${e.player.gold}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:sword-clash"></iconify-icon> Turns <span class="char-stat-value">${e.turnsElapsed}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:anvil"></iconify-icon> Crafted Spells Used <span class="char-stat-value">${t} floors</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:spell-book"></iconify-icon> Recipes Found <span class="char-stat-value">${e.player.discoveredRecipes.length}</span></div>
            <div class="char-stat"><iconify-icon icon="game-icons:meal"></iconify-icon> Hunger <span class="char-stat-value">${Math.floor(e.player.hungerLevel)}</span></div>
          </div>
          <div style="margin-top:12px">
            <h3>Affinities</h3>
            ${n.map(([e,t])=>`<div class="affinity-row"><span class="element-${e}">${e}</span><span>${t} casts</span></div>`).join(``)}
          </div>
          <div style="margin-top:12px">
            <h3>Traits</h3>
            ${Object.entries(e.player.traits).map(([e,t])=>`<div class="trait-row"><span>${e}</span><span class="trait-value">${t.toFixed(2)}</span></div>`).join(``)}
          </div>
        </div>
        <button class="btn btn-primary" data-action="new-game-from-defeat">
          <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> New Game
        </button>
      </div>
    `,this.bind()}renderDefeat(){this.root.innerHTML=`
      <div class="end-screen defeat">
        <iconify-icon icon="game-icons:skull" style="font-size:80px;color:var(--danger);filter:drop-shadow(0 0 30px var(--blood-dim))"></iconify-icon>
        <h1>Defeated</h1>
        <p style="color:var(--text-dim);font-size:1.1rem">The dungeon claims another soul...</p>
        <p style="color:var(--text-dim)">Level: ${this.state.player.level} | Rooms cleared: ${this.state.clearedRooms.length} | Turns: ${this.state.turnsElapsed}</p>
        <button class="btn btn-primary" data-action="new-game-from-defeat">
          <iconify-icon icon="game-icons:sword-brandish"></iconify-icon> Try Again
        </button>
      </div>
    `,this.bind()}}}));t((()=>{At(),$(),Wt();var e=`./`;async function t(){try{let t=await fetch(`${e}data/floors.json`);if(!t.ok)throw Error(`Failed to load game data: ${t.status}`);let n=await t.json();return{floors:n.floors,runes:n.runes,recipes:n.recipes,starterSpells:n.starterSpells,skillTree:n.skillTree}}catch(e){return console.error(`Failed to load game data, using fallback:`,e),{floors:[],runes:[],recipes:[],starterSpells:[],skillTree:[]}}}async function n(){let e=document.getElementById(`app`);if(!e)return;let n=await t(),r=new Ut(e);function i(){Pt();let e=Mt(n.floors,n.runes,n.recipes,n.starterSpells,n.skillTree);r.setState(e,()=>i())}let a=Nt();if(a)a.floorsData=n.floors,a.runesData=n.runes,a.recipesData=n.recipes,a.skillTreeData=n.skillTree,a.starterSpells=n.starterSpells,a.turnsElapsed===void 0&&(a.turnsElapsed=0),a.hungerLevel===void 0&&(a.hungerLevel=0),a.player.affinities||(a.player.affinities={}),a.player.combatPolicy||(a.player.combatPolicy={lowHpThreshold:30,preferDot:!0,useForgeSpells:!0,conserveMana:!1}),a.player.loadout||(a.player.loadout={spellSlots:[a.player.spells[0]?.id||null,a.player.spells[1]?.id||null,null,null]}),a.player.craftedSpellUsedOnFloor||(a.player.craftedSpellUsedOnFloor={}),r.setState(a,()=>i());else{let e=Mt(n.floors,n.runes,n.recipes,n.starterSpells,n.skillTree);e.view=`title`,r.setState(e,()=>i())}}n()}))();