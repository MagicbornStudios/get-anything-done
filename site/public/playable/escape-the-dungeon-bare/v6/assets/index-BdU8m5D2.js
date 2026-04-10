var e=(e,t)=>()=>(e&&(t=e(e=0)),t),t=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function n(e,t=0){let n=e.replace(/^-?[0-9.]*/,``);function r(e){for(;e<0;)e+=4;return e%4}if(n===``){let t=parseInt(e);return isNaN(t)?0:r(t)}else if(n!==e){let t=0;switch(n){case`%`:t=25;break;case`deg`:t=90}if(t){let i=parseFloat(e.slice(0,e.length-n.length));return isNaN(i)?0:(i/=t,i%1==0?r(i):0)}}return t}function r(e,t){t.split(ct).forEach(t=>{switch(t.trim()){case`horizontal`:e.hFlip=!0;break;case`vertical`:e.vFlip=!0;break}})}function i(e){let t={...lt},i=(t,n)=>e.getAttribute(t)||n;return t.width=i(`width`,null),t.height=i(`height`,null),t.rotate=n(i(`rotate`,``)),r(t,i(`flip`,``)),t.preserveAspectRatio=i(`preserveAspectRatio`,i(`preserveaspectratio`,``)),t}function a(e,t){for(let n in lt)if(e[n]!==t[n])return!0;return!1}function o(e,t){let n=e.icons,r=e.aliases||Object.create(null),i=Object.create(null);function a(e){if(n[e])return i[e]=[];if(!(e in i)){i[e]=null;let t=r[e]&&r[e].parent,n=t&&a(t);n&&(i[e]=[t].concat(n))}return i[e]}return Object.keys(n).concat(Object.keys(r)).forEach(a),i}function s(e,t){let n={};!e.hFlip!=!t.hFlip&&(n.hFlip=!0),!e.vFlip!=!t.vFlip&&(n.vFlip=!0);let r=((e.rotate||0)+(t.rotate||0))%4;return r&&(n.rotate=r),n}function c(e,t){let n=s(e,t);for(let r in at)r in y?r in e&&!(r in n)&&(n[r]=y[r]):r in t?n[r]=t[r]:r in e&&(n[r]=e[r]);return n}function l(e,t,n){let r=e.icons,i=e.aliases||Object.create(null),a={};function o(e){a=c(r[e]||i[e],a)}return o(t),n.forEach(o),c(e,a)}function u(e,t){let n=[];if(typeof e!=`object`||typeof e.icons!=`object`)return n;e.not_found instanceof Array&&e.not_found.forEach(e=>{t(e,null),n.push(e)});let r=o(e);for(let i in r){let a=r[i];a&&(t(i,l(e,i,a)),n.push(i))}return n}function d(e,t){for(let n in t)if(n in e&&typeof e[n]!=typeof t[n])return!1;return!0}function f(e){if(typeof e!=`object`||!e)return null;let t=e;if(typeof t.prefix!=`string`||!e.icons||typeof e.icons!=`object`||!d(e,dt))return null;let n=t.icons;for(let e in n){let t=n[e];if(!e||typeof t.body!=`string`||!d(t,at))return null}let r=t.aliases||Object.create(null);for(let e in r){let t=r[e],i=t.parent;if(!e||typeof i!=`string`||!n[i]&&!r[i]||!d(t,at))return null}return t}function p(e,t){return{provider:e,prefix:t,icons:Object.create(null),missing:new Set}}function m(e,t){let n=C[e]||(C[e]=Object.create(null));return n[t]||(n[t]=p(e,t))}function ee(e,t){return f(t)?u(t,(t,n)=>{n?e.icons[t]=n:e.missing.add(t)}):[]}function te(e,t,n){try{if(typeof n.body==`string`)return e.icons[t]={...n},!0}catch{}return!1}function ne(e,t){let n=[];return(typeof e==`string`?[e]:Object.keys(C)).forEach(e=>{(typeof e==`string`&&typeof t==`string`?[t]:Object.keys(C[e]||{})).forEach(t=>{let r=m(e,t);n=n.concat(Object.keys(r.icons).map(n=>(e===``?``:`@`+e+`:`)+t+`:`+n))})}),n}function h(e){return typeof e==`boolean`&&(w=e),w}function g(e){let t=typeof e==`string`?x(e,!0,w):e;if(t){let e=m(t.provider,t.prefix),n=t.name;return e.icons[n]||(e.missing.has(n)?null:void 0)}}function re(e,t){let n=x(e,!0,w);if(!n)return!1;let r=m(n.provider,n.prefix);return t?te(r,n.name,t):(r.missing.add(n.name),!0)}function _(e,t){if(typeof e!=`object`)return!1;if(typeof t!=`string`&&(t=e.provider||``),w&&!t&&!e.prefix){let t=!1;return f(e)&&(e.prefix=``,u(e,(e,n)=>{re(e,n)&&(t=!0)})),t}let n=e.prefix;return S({prefix:n,name:`a`})?!!ee(m(t,n),e):!1}function ie(e){return!!g(e)}function ae(e){let t=g(e);return t&&{...b,...t}}function oe(e,t){e.forEach(e=>{let n=e.loaderCallbacks;n&&(e.loaderCallbacks=n.filter(e=>e.id!==t))})}function se(e){e.pendingCallbacksFlag||(e.pendingCallbacksFlag=!0,setTimeout(()=>{e.pendingCallbacksFlag=!1;let t=e.loaderCallbacks?e.loaderCallbacks.slice(0):[];if(!t.length)return;let n=!1,r=e.provider,i=e.prefix;t.forEach(t=>{let a=t.icons,o=a.pending.length;a.pending=a.pending.filter(t=>{if(t.prefix!==i)return!0;let o=t.name;if(e.icons[o])a.loaded.push({provider:r,prefix:i,name:o});else if(e.missing.has(o))a.missing.push({provider:r,prefix:i,name:o});else return n=!0,!0;return!1}),a.pending.length!==o&&(n||oe([e],t.id),t.callback(a.loaded.slice(0),a.missing.slice(0),a.pending.slice(0),t.abort))})}))}function ce(e,t,n){let r=ft++,i=oe.bind(null,n,r);if(!t.pending.length)return i;let a={id:r,icons:t,callback:e,abort:i};return n.forEach(e=>{(e.loaderCallbacks||=[]).push(a)}),i}function le(e){let t={loaded:[],missing:[],pending:[]},n=Object.create(null);e.sort((e,t)=>e.provider===t.provider?e.prefix===t.prefix?e.name.localeCompare(t.name):e.prefix.localeCompare(t.prefix):e.provider.localeCompare(t.provider));let r={provider:``,prefix:``,name:``};return e.forEach(e=>{if(r.name===e.name&&r.prefix===e.prefix&&r.provider===e.provider)return;r=e;let i=e.provider,a=e.prefix,o=e.name,s=n[i]||(n[i]=Object.create(null)),c=s[a]||(s[a]=m(i,a)),l;l=o in c.icons?t.loaded:a===``||c.missing.has(o)?t.missing:t.pending;let u={provider:i,prefix:a,name:o};l.push(u)}),t}function ue(e,t){pt[e]=t}function de(e){return pt[e]||pt[``]}function fe(e,t=!0,n=!1){let r=[];return e.forEach(e=>{let i=typeof e==`string`?x(e,t,n):e;i&&r.push(i)}),r}function pe(e){let t;if(typeof e.resources==`string`)t=[e.resources];else if(t=e.resources,!(t instanceof Array)||!t.length)return null;return{resources:t,path:e.path||`/`,maxURL:e.maxURL||500,rotate:e.rotate||750,timeout:e.timeout||5e3,random:e.random===!0,index:e.index||0,dataAfterTimeout:e.dataAfterTimeout!==!1}}function me(e,t){let n=pe(t);return n===null?!1:(T[e]=n,!0)}function he(e){return T[e]}function ge(){return Object.keys(T)}function _e(e,t,n,r){let i=e.resources.length,a=e.random?Math.floor(Math.random()*i):e.index,o;if(e.random){let t=e.resources.slice(0);for(o=[];t.length>1;){let e=Math.floor(Math.random()*t.length);o.push(t[e]),t=t.slice(0,e).concat(t.slice(e+1))}o=o.concat(t)}else o=e.resources.slice(a).concat(e.resources.slice(0,a));let s=Date.now(),c=`pending`,l=0,u,d=null,f=[],p=[];typeof r==`function`&&p.push(r);function m(){d&&=(clearTimeout(d),null)}function ee(){c===`pending`&&(c=`aborted`),m(),f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function te(e,t){t&&(p=[]),typeof e==`function`&&p.push(e)}function ne(){return{startTime:s,payload:t,status:c,queriesSent:l,queriesPending:f.length,subscribe:te,abort:ee}}function h(){c=`failed`,p.forEach(e=>{e(void 0,u)})}function g(){f.forEach(e=>{e.status===`pending`&&(e.status=`aborted`)}),f=[]}function re(t,n,r){let i=n!==`success`;switch(f=f.filter(e=>e!==t),c){case`pending`:break;case`failed`:if(i||!e.dataAfterTimeout)return;break;default:return}if(n===`abort`){u=r,h();return}if(i){u=r,f.length||(o.length?_():h());return}if(m(),g(),!e.random){let n=e.resources.indexOf(t.resource);n!==-1&&n!==e.index&&(e.index=n)}c=`completed`,p.forEach(e=>{e(r)})}function _(){if(c!==`pending`)return;m();let r=o.shift();if(r===void 0){if(f.length){d=setTimeout(()=>{m(),c===`pending`&&(g(),h())},e.timeout);return}h();return}let i={status:`pending`,resource:r,callback:(e,t)=>{re(i,e,t)}};f.push(i),l++,d=setTimeout(_,e.rotate),n(r,t,i.callback)}return setTimeout(_),ne}function ve(e){let t={...ht,...e},n=[];function r(){n=n.filter(e=>e().status===`pending`)}function i(e,i,a){let o=_e(t,e,i,(e,t)=>{r(),a&&a(e,t)});return n.push(o),o}function a(e){return n.find(t=>e(t))||null}return{query:i,find:a,setIndex:e=>{t.index=e},getIndex:()=>t.index,cleanup:r}}function ye(){}function be(e){if(!gt[e]){let t=he(e);if(!t)return;gt[e]={config:t,redundancy:ve(t)}}return gt[e]}function xe(e,t,n){let r,i;if(typeof e==`string`){let t=de(e);if(!t)return n(void 0,424),ye;i=t.send;let a=be(e);a&&(r=a.redundancy)}else{let t=pe(e);if(t){r=ve(t);let n=de(e.resources?e.resources[0]:``);n&&(i=n.send)}}return!r||!i?(n(void 0,424),ye):r.query(t,i,n)().abort}function Se(){}function Ce(e){e.iconsLoaderFlag||(e.iconsLoaderFlag=!0,setTimeout(()=>{e.iconsLoaderFlag=!1,se(e)}))}function we(e){let t=[],n=[];return e.forEach(e=>{(e.match(ut)?t:n).push(e)}),{valid:t,invalid:n}}function v(e,t,n){function r(){let n=e.pendingIcons;t.forEach(t=>{n&&n.delete(t),e.icons[t]||e.missing.add(t)})}if(n&&typeof n==`object`)try{if(!ee(e,n).length){r();return}}catch(e){console.error(e)}r(),Ce(e)}function Te(e,t){e instanceof Promise?e.then(e=>{t(e)}).catch(()=>{t(null)}):t(e)}function Ee(e,t){e.iconsToLoad?e.iconsToLoad=e.iconsToLoad.concat(t).sort():e.iconsToLoad=t,e.iconsQueueFlag||(e.iconsQueueFlag=!0,setTimeout(()=>{e.iconsQueueFlag=!1;let{provider:t,prefix:n}=e,r=e.iconsToLoad;if(delete e.iconsToLoad,!r||!r.length)return;let i=e.loadIcon;if(e.loadIcons&&(r.length>1||!i)){Te(e.loadIcons(r,n,t),t=>{v(e,r,t)});return}if(i){r.forEach(r=>{Te(i(r,n,t),t=>{v(e,[r],t?{prefix:n,icons:{[r]:t}}:null)})});return}let{valid:a,invalid:o}=we(r);if(o.length&&v(e,o,null),!a.length)return;let s=n.match(ut)?de(t):null;if(!s){v(e,a,null);return}s.prepare(t,n,a).forEach(n=>{xe(t,n,t=>{v(e,n.icons,t)})})}))}function De(e){try{let t=typeof e==`string`?JSON.parse(e):e;if(typeof t.body==`string`)return{...t}}catch{}}function Oe(e,t){if(typeof e==`object`)return{data:De(e),value:e};if(typeof e!=`string`)return{value:e};if(e.includes(`{`)){let t=De(e);if(t)return{data:t,value:e}}let n=x(e,!0,!0);if(!n)return{value:e};let r=g(n);return r!==void 0||!n.prefix?{value:e,name:n,data:r}:{value:e,name:n,loading:_t([n],()=>t(e,n,g(n)))}}function ke(e,t){switch(t){case`svg`:case`bg`:case`mask`:return t}return t!==`style`&&(yt||e.indexOf(`<a`)===-1)?`svg`:e.indexOf(`currentColor`)===-1?`bg`:`mask`}function Ae(e,t,n){if(t===1)return e;if(n||=100,typeof e==`number`)return Math.ceil(e*t*n)/n;if(typeof e!=`string`)return e;let r=e.split(bt);if(r===null||!r.length)return e;let i=[],a=r.shift(),o=xt.test(a);for(;;){if(o){let e=parseFloat(a);isNaN(e)?i.push(a):i.push(Math.ceil(e*t*n)/n)}else i.push(a);if(a=r.shift(),a===void 0)return i.join(``);o=!o}}function je(e,t=`defs`){let n=``,r=e.indexOf(`<`+t);for(;r>=0;){let i=e.indexOf(`>`,r),a=e.indexOf(`</`+t);if(i===-1||a===-1)break;let o=e.indexOf(`>`,a);if(o===-1)break;n+=e.slice(i+1,a).trim(),e=e.slice(0,r).trim()+e.slice(o+1)}return{defs:n,content:e}}function Me(e,t){return e?`<defs>`+e+`</defs>`+t:t}function Ne(e,t,n){let r=je(e);return Me(r.defs,t+r.content+n)}function Pe(e,t){let n={...b,...e},r={...st,...t},i={left:n.left,top:n.top,width:n.width,height:n.height},a=n.body;[n,r].forEach(e=>{let t=[],n=e.hFlip,r=e.vFlip,o=e.rotate;n?r?o+=2:(t.push(`translate(`+(i.width+i.left).toString()+` `+(0-i.top).toString()+`)`),t.push(`scale(-1 1)`),i.top=i.left=0):r&&(t.push(`translate(`+(0-i.left).toString()+` `+(i.height+i.top).toString()+`)`),t.push(`scale(1 -1)`),i.top=i.left=0);let s;switch(o<0&&(o-=Math.floor(o/4)*4),o%=4,o){case 1:s=i.height/2+i.top,t.unshift(`rotate(90 `+s.toString()+` `+s.toString()+`)`);break;case 2:t.unshift(`rotate(180 `+(i.width/2+i.left).toString()+` `+(i.height/2+i.top).toString()+`)`);break;case 3:s=i.width/2+i.left,t.unshift(`rotate(-90 `+s.toString()+` `+s.toString()+`)`);break}o%2==1&&(i.left!==i.top&&(s=i.left,i.left=i.top,i.top=s),i.width!==i.height&&(s=i.width,i.width=i.height,i.height=s)),t.length&&(a=Ne(a,`<g transform="`+t.join(` `)+`">`,`</g>`))});let o=r.width,s=r.height,c=i.width,l=i.height,u,d;o===null?(d=s===null?`1em`:s===`auto`?l:s,u=Ae(d,c/l)):(u=o===`auto`?c:o,d=s===null?Ae(u,l/c):s===`auto`?l:s);let f={},p=(e,t)=>{St(t)||(f[e]=t.toString())};p(`width`,u),p(`height`,d);let m=[i.left,i.top,c,l];return f.viewBox=m.join(` `),{attributes:f,viewBox:m,body:a}}function Fe(e,t){let n=e.indexOf(`xlink:`)===-1?``:` xmlns:xlink="http://www.w3.org/1999/xlink"`;for(let e in t)n+=` `+e+`="`+t[e]+`"`;return`<svg xmlns="http://www.w3.org/2000/svg"`+n+`>`+e+`</svg>`}function Ie(e){return e.replace(/"/g,`'`).replace(/%/g,`%25`).replace(/#/g,`%23`).replace(/</g,`%3C`).replace(/>/g,`%3E`).replace(/\s+/g,` `)}function Le(e){return`data:image/svg+xml,`+Ie(e)}function Re(e){return`url("`+Le(e)+`")`}function ze(e){D=e}function Be(){return D}function Ve(e,t){let n=he(e);if(!n)return 0;let r;if(!n.maxURL)r=0;else{let e=0;n.resources.forEach(t=>{e=Math.max(e,t.length)});let i=t+`.json?icons=`;r=n.maxURL-e-n.path.length-i.length}return r}function He(e){return e===404}function Ue(e){if(typeof e==`string`){let t=he(e);if(t)return t.path}return`/`}function We(e,t,n){m(n||``,t).loadIcons=e}function Ge(e,t,n){m(n||``,t).loadIcon=e}function Ke(e){Ot=e}function qe(e,t){let n=Array.from(e.childNodes).find(e=>e.hasAttribute&&e.hasAttribute(Dt));n||(n=document.createElement(`style`),n.setAttribute(Dt,Dt),e.appendChild(n)),n.textContent=`:host{display:inline-block;vertical-align:`+(t?`-0.125em`:`0`)+`}span,svg{display:block;margin:auto}`+Ot}function Je(){ue(``,Et),h(!0);let e;try{e=window}catch{}if(e){if(e.IconifyPreload!==void 0){let t=e.IconifyPreload,n=`Invalid IconifyPreload syntax.`;typeof t==`object`&&t&&(t instanceof Array?t:[t]).forEach(e=>{try{(typeof e!=`object`||!e||e instanceof Array||typeof e.icons!=`object`||typeof e.prefix!=`string`||!_(e))&&console.error(n)}catch{console.error(n)}})}if(e.IconifyProviders!==void 0){let t=e.IconifyProviders;if(typeof t==`object`&&t)for(let e in t){let n=`IconifyProviders[`+e+`] is invalid.`;try{let r=t[e];if(typeof r!=`object`||!r||r.resources===void 0)continue;me(e,r)||console.error(n)}catch{console.error(n)}}}}return{iconLoaded:ie,getIcon:ae,listIcons:ne,addIcon:re,addCollection:_,calculateSize:Ae,buildIcon:Pe,iconToHTML:Fe,svgToURL:Re,loadIcons:_t,loadIcon:vt,addAPIProvider:me,setCustomIconLoader:Ge,setCustomIconsLoader:We,appendCustomStyle:Ke,_api:{getAPIConfig:he,setAPIModule:ue,sendAPIQuery:xe,setFetch:ze,getFetch:Be,listAPIProviders:ge}}}function Ye(e){return e?e+(e.match(/^[-0-9.]+$/)?`px`:``):`inherit`}function Xe(e,t,n){let r=document.createElement(`span`),i=e.body;i.indexOf(`<a`)!==-1&&(i+=`<!-- `+Date.now()+` -->`);let a=e.attributes,o=Re(Fe(i,{...a,width:t.width+``,height:t.height+``})),s=r.style,c={"--svg":o,width:Ye(a.width),height:Ye(a.height),...n?kt:At};for(let e in c)s.setProperty(e,c[e]);return r}function Ze(){try{O=window.trustedTypes.createPolicy(`iconify`,{createHTML:e=>e})}catch{O=null}}function Qe(e){return O===void 0&&Ze(),O?O.createHTML(e):e}function $e(e){let t=document.createElement(`span`),n=e.attributes,r=``;return n.width||(r=`width: inherit;`),n.height||(r+=`height: inherit;`),r&&(n.style=r),t.innerHTML=Qe(Fe(e.body,n)),t.firstChild}function et(e){return Array.from(e.childNodes).find(e=>{let t=e.tagName&&e.tagName.toUpperCase();return t===`SPAN`||t===`SVG`})}function tt(e,t){let n=t.icon.data,r=t.customisations,i=Pe(n,r);r.preserveAspectRatio&&(i.attributes.preserveAspectRatio=r.preserveAspectRatio);let a=t.renderedMode,o;switch(a){case`svg`:o=$e(i);break;default:o=Xe(i,{...b,...n},a===`mask`)}let s=et(e);s?o.tagName===`SPAN`&&s.tagName===o.tagName?s.setAttribute(`style`,o.getAttribute(`style`)):e.replaceChild(o,s):e.appendChild(o)}function nt(e,t,n){return{rendered:!1,inline:t,icon:e,lastRender:n&&(n.rendered?n:n.lastRender)}}function rt(e=`iconify-icon`){let t,n;try{t=window.customElements,n=window.HTMLElement}catch{return}if(!t||!n)return;let r=t.get(e);if(r)return r;let o=[`icon`,`mode`,`inline`,`noobserver`,`width`,`height`,`rotate`,`flip`],s=class extends n{_shadowRoot;_initialised=!1;_state;_checkQueued=!1;_connected=!1;_observer=null;_visible=!0;constructor(){super();let e=this._shadowRoot=this.attachShadow({mode:`open`}),t=this.hasAttribute(`inline`);qe(e,t),this._state=nt({value:``},t),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return o.slice(0)}attributeChangedCallback(e){switch(e){case`inline`:{let e=this.hasAttribute(`inline`),t=this._state;e!==t.inline&&(t.inline=e,qe(this._shadowRoot,e));break}case`noobserver`:this.hasAttribute(`noobserver`)?this.startObserver():this.stopObserver();break;default:this._queueCheck()}}get icon(){let e=this.getAttribute(`icon`);if(e&&e.slice(0,1)===`{`)try{return JSON.parse(e)}catch{}return e}set icon(e){typeof e==`object`&&(e=JSON.stringify(e)),this.setAttribute(`icon`,e)}get inline(){return this.hasAttribute(`inline`)}set inline(e){e?this.setAttribute(`inline`,`true`):this.removeAttribute(`inline`)}get observer(){return this.hasAttribute(`observer`)}set observer(e){e?this.setAttribute(`observer`,`true`):this.removeAttribute(`observer`)}restartAnimation(){let e=this._state;if(e.rendered){let t=this._shadowRoot;if(e.renderedMode===`svg`)try{t.lastChild.setCurrentTime(0);return}catch{}tt(t,e)}}get status(){let e=this._state;return e.rendered?`rendered`:e.icon.data===null?`failed`:`loading`}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;let e=this._state,t=this.getAttribute(`icon`);if(t!==e.icon.value){this._iconChanged(t);return}if(!e.rendered||!this._visible)return;let n=this.getAttribute(`mode`),r=i(this);(e.attrMode!==n||a(e.customisations,r)||!et(this._shadowRoot))&&this._renderIcon(e.icon,r,n)}_iconChanged(e){let t=Oe(e,(e,t,n)=>{let r=this._state;if(r.rendered||this.getAttribute(`icon`)!==e)return;let i={value:e,name:t,data:n};i.data?this._gotIconData(i):r.icon=i});t.data?this._gotIconData(t):this._state=nt(t,this._state.inline,this._state)}_forceRender(){if(!this._visible){let e=et(this._shadowRoot);e&&this._shadowRoot.removeChild(e);return}this._queueCheck()}_gotIconData(e){this._checkQueued=!1,this._renderIcon(e,i(this),this.getAttribute(`mode`))}_renderIcon(e,t,n){let r=ke(e.data.body,n),i=this._state.inline;tt(this._shadowRoot,this._state={rendered:!0,icon:e,inline:i,customisations:t,attrMode:n,renderedMode:r})}startObserver(){if(!this._observer&&!this.hasAttribute(`noobserver`))try{this._observer=new IntersectionObserver(e=>{let t=e.some(e=>e.isIntersecting);t!==this._visible&&(this._visible=t,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};o.forEach(e=>{e in s.prototype||Object.defineProperty(s.prototype,e,{get:function(){return this.getAttribute(e)},set:function(t){t===null?this.removeAttribute(e):this.setAttribute(e,t)}})});let c=Je();for(let e in c)s[e]=s.prototype[e]=c[e];return t.define(e,s),s}var it,y,b,at,ot,st,ct,lt,ut,x,S,dt,C,w,ft,pt,T,E,mt,ht,gt,_t,vt,yt,bt,xt,St,Ct,D,wt,Tt,Et,Dt,Ot,kt,At,jt,Mt,O,Nt,Pt,Ft,It,Lt,Rt,zt,Bt,Vt,Ht,Ut,Wt,Gt,Kt,qt,Jt,Yt=e((()=>{for(it=Object.freeze({left:0,top:0,width:16,height:16}),y=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),b=Object.freeze({...it,...y}),at=Object.freeze({...b,body:``,hidden:!1}),ot=Object.freeze({width:null,height:null}),st=Object.freeze({...ot,...y}),ct=/[\s,]+/,lt={...st,preserveAspectRatio:``},ut=/^[a-z0-9]+(-[a-z0-9]+)*$/,x=(e,t,n,r=``)=>{let i=e.split(`:`);if(e.slice(0,1)===`@`){if(i.length<2||i.length>3)return null;r=i.shift().slice(1)}if(i.length>3||!i.length)return null;if(i.length>1){let e=i.pop(),n=i.pop(),a={provider:i.length>0?i[0]:r,prefix:n,name:e};return t&&!S(a)?null:a}let a=i[0],o=a.split(`-`);if(o.length>1){let e={provider:r,prefix:o.shift(),name:o.join(`-`)};return t&&!S(e)?null:e}if(n&&r===``){let e={provider:r,prefix:``,name:a};return t&&!S(e,n)?null:e}return null},S=(e,t)=>e?!!((t&&e.prefix===``||e.prefix)&&e.name):!1,dt={provider:``,aliases:{},not_found:{},...it},C=Object.create(null),w=!1,ft=0,pt=Object.create(null),T=Object.create(null),E=[`https://api.simplesvg.com`,`https://api.unisvg.com`],mt=[];E.length>0;)E.length===1||Math.random()>.5?mt.push(E.shift()):mt.push(E.pop());T[``]=pe({resources:[`https://api.iconify.design`].concat(mt)}),ht={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1},gt=Object.create(null),_t=(e,t)=>{let n=le(fe(e,!0,h()));if(!n.pending.length){let e=!0;return t&&setTimeout(()=>{e&&t(n.loaded,n.missing,n.pending,Se)}),()=>{e=!1}}let r=Object.create(null),i=[],a,o;return n.pending.forEach(e=>{let{provider:t,prefix:n}=e;if(n===o&&t===a)return;a=t,o=n,i.push(m(t,n));let s=r[t]||(r[t]=Object.create(null));s[n]||(s[n]=[])}),n.pending.forEach(e=>{let{provider:t,prefix:n,name:i}=e,a=m(t,n),o=a.pendingIcons||=new Set;o.has(i)||(o.add(i),r[t][n].push(i))}),i.forEach(e=>{let t=r[e.provider][e.prefix];t.length&&Ee(e,t)}),t?ce(t,n,i):Se},vt=e=>new Promise((t,n)=>{let r=typeof e==`string`?x(e,!0):e;if(!r){n(e);return}_t([r||e],i=>{if(i.length&&r){let e=g(r);if(e){t({...b,...e});return}}n(e)})}),yt=!1;try{yt=navigator.vendor.indexOf(`Apple`)===0}catch{}bt=/(-?[0-9.]*[0-9]+[0-9.]*)/g,xt=/^-?[0-9.]*[0-9]+[0-9.]*$/g,St=e=>e===`unset`||e===`undefined`||e===`none`,Ct=()=>{let e;try{if(e=fetch,typeof e==`function`)return e}catch{}},D=Ct(),wt=(e,t,n)=>{let r=[],i=Ve(e,t),a=`icons`,o={type:a,provider:e,prefix:t,icons:[]},s=0;return n.forEach((n,c)=>{s+=n.length+1,s>=i&&c>0&&(r.push(o),o={type:a,provider:e,prefix:t,icons:[]},s=n.length),o.icons.push(n)}),r.push(o),r},Tt=(e,t,n)=>{if(!D){n(`abort`,424);return}let r=Ue(t.provider);switch(t.type){case`icons`:{let e=t.prefix,n=t.icons.join(`,`),i=new URLSearchParams({icons:n});r+=e+`.json?`+i.toString();break}case`custom`:{let e=t.uri;r+=e.slice(0,1)===`/`?e.slice(1):e;break}default:n(`abort`,400);return}let i=503;D(e+r).then(e=>{let t=e.status;if(t!==200){setTimeout(()=>{n(He(t)?`abort`:`next`,t)});return}return i=501,e.json()}).then(e=>{if(typeof e!=`object`||!e){setTimeout(()=>{e===404?n(`abort`,e):n(`next`,i)});return}setTimeout(()=>{n(`success`,e)})}).catch(()=>{n(`next`,i)})},Et={prepare:wt,send:Tt},Dt=`data-style`,Ot=``,kt={"background-color":`currentColor`},At={"background-color":`transparent`},jt={image:`var(--svg)`,repeat:`no-repeat`,size:`100% 100%`},Mt={"-webkit-mask":kt,mask:kt,background:At};for(let e in Mt){let t=Mt[e];for(let n in jt)t[e+`-`+n]=jt[n]}Nt=rt()||Je(),{iconLoaded:Pt,getIcon:Ft,listIcons:It,addIcon:Lt,addCollection:Rt,calculateSize:zt,buildIcon:Bt,iconToHTML:Vt,svgToURL:Ht,loadIcons:Ut,loadIcon:Wt,setCustomIconLoader:Gt,setCustomIconsLoader:Kt,addAPIProvider:qt,_api:Jt}=Nt}));function Xt(){let e=document.createElement(`style`);e.textContent=`
    :root {
      --bg-dark: #0a0a12;
      --bg-panel: #14141f;
      --bg-panel-light: #1a1a2e;
      --bg-panel-hover: #222240;
      --border: #2a2a4a;
      --border-light: #3a3a5a;
      --text: #e0e0f0;
      --text-dim: #8888aa;
      --text-bright: #ffffff;
      --accent: #6644cc;
      --accent-light: #8866ee;
      --fire: #ff6633;
      --ice: #44bbff;
      --lightning: #ffdd44;
      --shadow: #9944cc;
      --nature: #44cc66;
      --arcane: #cc44ff;
      --hp-bar: #cc3333;
      --hp-bar-bg: #441111;
      --mana-bar: #3366cc;
      --mana-bar-bg: #111144;
      --stamina-bar: #ccaa33;
      --stamina-bar-bg: #443311;
      --xp-bar: #33cc66;
      --xp-bar-bg: #114422;
      --gold: #ffcc33;
      --danger: #cc3333;
      --success: #33cc66;
      --warning: #ccaa33;
      --info: #3388cc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg-dark);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
    }

    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    h1, h2, h3 { font-family: 'Cinzel', serif; color: var(--text-bright); }

    .title-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a12 70%);
    }

    .title-screen h1 {
      font-size: 3rem;
      background: linear-gradient(135deg, var(--accent-light), var(--fire), var(--accent));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
      text-shadow: none;
    }

    .title-screen .subtitle {
      color: var(--text-dim);
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      background: var(--bg-panel-light);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .btn:hover {
      background: var(--bg-panel-hover);
      border-color: var(--accent);
      color: var(--text-bright);
    }

    .btn:active { transform: scale(0.97); }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent-light);
      color: white;
      font-weight: 600;
    }

    .btn-primary:hover {
      background: var(--accent-light);
    }

    .btn-danger {
      border-color: var(--danger);
      color: var(--danger);
    }

    .btn-danger:hover {
      background: rgba(204, 51, 51, 0.2);
    }

    .btn-success {
      border-color: var(--success);
      color: var(--success);
    }

    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn-lg { padding: 12px 24px; font-size: 16px; }

    .btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* HUD */
    .hud {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .hud-section {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-label {
      color: var(--text-dim);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .hud-value {
      font-weight: 600;
      font-size: 13px;
    }

    .bar-container {
      width: 100px;
      height: 14px;
      background: var(--hp-bar-bg);
      border-radius: 7px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 7px;
      transition: width 0.3s ease;
    }

    .bar-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .hp-bar .bar-fill { background: var(--hp-bar); }
    .hp-bar { background: var(--hp-bar-bg); }
    .mana-bar .bar-fill { background: var(--mana-bar); }
    .mana-bar { background: var(--mana-bar-bg); }
    .stamina-bar .bar-fill { background: var(--stamina-bar); }
    .stamina-bar { background: var(--stamina-bar-bg); }
    .xp-bar .bar-fill { background: var(--xp-bar); }
    .xp-bar { background: var(--xp-bar-bg); }
    .affinity-bar .bar-fill { background: var(--accent); }
    .affinity-bar { background: var(--bg-panel); width: 60px; height: 10px; }

    /* Main layout */
    .game-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .main-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .side-panel {
      width: 280px;
      background: var(--bg-panel);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .panel-header {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      font-family: 'Cinzel', serif;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-bright);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .panel-body {
      padding: 10px 14px;
      overflow-y: auto;
      flex: 1;
    }

    .panel-footer {
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Room / Map */
    .room-header {
      padding: 16px;
      background: var(--bg-panel-light);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .room-icon {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .room-info h2 { font-size: 1.2rem; margin-bottom: 2px; }
    .room-info .room-type { color: var(--text-dim); font-size: 12px; text-transform: uppercase; }

    .room-description {
      padding: 12px 16px;
      color: var(--text-dim);
      font-style: italic;
      border-bottom: 1px solid var(--border);
    }

    .room-content {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }

    .room-actions {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Map */
    .map-grid {
      display: grid;
      gap: 8px;
      padding: 16px;
      justify-content: center;
    }

    .map-cell {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.15s;
      position: relative;
    }

    .map-cell.discovered {
      background: var(--bg-panel-light);
      border-color: var(--border);
    }

    .map-cell.current {
      border-color: var(--accent-light);
      box-shadow: 0 0 12px rgba(102, 68, 204, 0.4);
    }

    .map-cell.cleared {
      opacity: 0.7;
    }

    .map-cell.undiscovered {
      background: var(--bg-dark);
      opacity: 0.3;
      cursor: default;
    }

    .map-cell.adjacent {
      border-color: var(--accent);
      cursor: pointer;
    }

    .map-cell.adjacent:hover {
      background: var(--bg-panel-hover);
      transform: scale(1.05);
    }

    .map-cell-icon { font-size: 20px; margin-bottom: 2px; }
    .map-cell-name { text-align: center; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; max-width: 64px; }

    .map-connection {
      position: absolute;
      background: var(--border);
    }

    /* Combat */
    .combat-arena {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      min-height: 200px;
    }

    .combat-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-radius: 12px;
      min-width: 180px;
    }

    .player-side {
      background: rgba(51, 102, 204, 0.1);
      border: 1px solid rgba(51, 102, 204, 0.3);
    }

    .enemy-side {
      background: rgba(204, 51, 51, 0.1);
      border: 1px solid rgba(204, 51, 51, 0.3);
    }

    .combat-entity {
      text-align: center;
    }

    .entity-portrait {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin: 0 auto 6px;
    }

    .player-portrait { background: rgba(51, 102, 204, 0.2); border: 2px solid var(--mana-bar); }
    .enemy-portrait { background: rgba(204, 51, 51, 0.2); border: 2px solid var(--hp-bar); }

    .entity-name { font-weight: 600; font-size: 13px; }
    .entity-hp { font-size: 11px; color: var(--text-dim); }

    .combat-vs {
      font-family: 'Cinzel', serif;
      font-size: 2rem;
      color: var(--text-dim);
      font-weight: 700;
    }

    .combat-log {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      font-size: 12px;
      font-family: 'Inter', monospace;
      line-height: 1.6;
    }

    .log-action { color: var(--info); }
    .log-damage { color: var(--danger); }
    .log-heal { color: var(--success); }
    .log-info { color: var(--text-dim); }
    .log-trait { color: var(--accent-light); }
    .log-policy { color: var(--warning); }

    .combat-controls {
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .speed-label { font-size: 11px; color: var(--text-dim); }

    /* Forge */
    .forge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }

    .rune-card, .spell-card, .item-card {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-panel);
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }

    .rune-card:hover, .spell-card:hover, .item-card:hover {
      border-color: var(--accent);
      background: var(--bg-panel-hover);
    }

    .rune-card.selected, .spell-card.selected {
      border-color: var(--accent-light);
      background: rgba(102, 68, 204, 0.2);
    }

    .rune-card.locked {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .element-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .el-fire { background: rgba(255, 102, 51, 0.2); color: var(--fire); }
    .el-ice { background: rgba(68, 187, 255, 0.2); color: var(--ice); }
    .el-lightning { background: rgba(255, 221, 68, 0.2); color: var(--lightning); }
    .el-shadow { background: rgba(153, 68, 204, 0.2); color: var(--shadow); }
    .el-nature { background: rgba(68, 204, 102, 0.2); color: var(--nature); }
    .el-arcane { background: rgba(204, 68, 255, 0.2); color: var(--arcane); }

    /* Inventory / Character */
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
    }

    .equip-slot {
      padding: 8px;
      border: 1px dashed var(--border);
      border-radius: 6px;
      text-align: center;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .equip-slot.filled { border-style: solid; background: var(--bg-panel); }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid rgba(42, 42, 74, 0.5);
    }

    .stat-label { color: var(--text-dim); }
    .stat-value { font-weight: 600; }

    .trait-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .trait-bar {
      flex: 1;
      height: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      overflow: hidden;
    }

    .trait-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    /* Skill Tree */
    .skill-tree {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .skill-node {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .skill-node.unlocked { border-color: var(--success); background: rgba(51, 204, 102, 0.1); }
    .skill-node.available { border-color: var(--accent); }
    .skill-node.locked { opacity: 0.5; cursor: not-allowed; }

    /* Merchant */
    .merchant-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .merchant-item:hover {
      background: var(--bg-panel-hover);
    }

    /* Notifications */
    .notifications {
      position: fixed;
      top: 50px;
      right: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
    }

    .notif {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      animation: notifSlide 0.3s ease;
      max-width: 350px;
    }

    .notif-info { background: rgba(51, 136, 204, 0.9); color: white; }
    .notif-reward { background: rgba(255, 204, 51, 0.9); color: #333; }
    .notif-danger { background: rgba(204, 51, 51, 0.9); color: white; }
    .notif-trait { background: rgba(102, 68, 204, 0.9); color: white; }

    @keyframes notifSlide {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Dialogue */
    .dialogue-box {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .dialogue-portrait {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .dialogue-portrait .portrait-icon {
      font-size: 48px;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border-radius: 50%;
      border: 2px solid var(--accent);
    }

    .dialogue-text {
      padding: 16px;
      background: var(--bg-panel-light);
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 3px solid var(--accent);
      line-height: 1.6;
    }

    .dialogue-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dialogue-choice {
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }

    .dialogue-choice:hover {
      background: var(--bg-panel-hover);
      border-color: var(--accent);
    }

    /* Overlay menus */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 18, 0.95);
      z-index: 100;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .overlay-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .overlay-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 20px;
      border-bottom: 1px solid var(--border);
    }

    .tab-btn {
      padding: 6px 14px;
      border: 1px solid transparent;
      border-radius: 6px 6px 0 0;
      background: transparent;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .tab-btn.active {
      background: var(--bg-panel-light);
      border-color: var(--border);
      border-bottom-color: transparent;
      color: var(--text-bright);
    }

    .tab-btn:hover { color: var(--text); }

    /* Policy editor */
    .policy-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .policy-priority {
      width: 30px;
      text-align: center;
      font-weight: 700;
      color: var(--accent);
    }

    .policy-condition { color: var(--warning); font-size: 12px; }
    .policy-action { color: var(--info); font-size: 12px; flex: 1; }

    .policy-toggle {
      width: 36px; height: 18px;
      border-radius: 9px;
      background: var(--border);
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
    }

    .policy-toggle.on { background: var(--success); }

    .policy-toggle::after {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: white;
      top: 2px; left: 2px;
      transition: transform 0.2s;
    }

    .policy-toggle.on::after { transform: translateX(18px); }

    /* Victory / Game Over */
    .end-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }

    .end-screen h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .end-screen .stats {
      color: var(--text-dim);
      margin-bottom: 2rem;
      line-height: 2;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-light); }

    /* Floor switcher */
    .floor-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-panel);
    }

    .floor-tab {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-dim);
    }

    .floor-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
    .floor-tab.locked { opacity: 0.3; cursor: not-allowed; }

    /* Event room */
    .event-text {
      padding: 16px;
      background: var(--bg-panel-light);
      border-radius: 8px;
      margin-bottom: 16px;
      line-height: 1.7;
      border-left: 3px solid var(--warning);
    }

    .event-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Game clock */
    .game-clock {
      font-size: 11px;
      color: var(--text-dim);
    }

    /* Loadout */
    .loadout-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }

    .loadout-slot {
      padding: 10px;
      border: 2px dashed var(--border);
      border-radius: 8px;
      text-align: center;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .loadout-slot.filled {
      border-style: solid;
      background: var(--bg-panel);
    }

    .loadout-slot:hover {
      border-color: var(--accent);
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent-light);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 16px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
  `,document.head.appendChild(e)}var Zt=e((()=>{}));function Qt(e,t){if(e.length===0)return`Unknown Spell`;if(e.length===1){let t=e[0],n=nn[t]||[`Magic`],r=rn[t]||[`bolt`],i=Math.floor(Math.random()*n.length),a=Math.floor(Math.random()*r.length);return`${n[i]}${r[a]}`}let[n,r]=e,i=an[n]?.[r]||an[r]?.[n]||`Primal`,a=rn[r]||rn[n]||[`bolt`],o=Math.floor(Math.random()*a.length);if(t){let e=[`Greater`,`Grand`,`Ascended`,`True`,`Ancient`];return`${e[Math.floor(Math.random()*e.length)]} ${i}`}return`${i} ${a[o].charAt(0).toUpperCase()+a[o].slice(1)}`}function $t(e,t){let n=8;for(let r of e){n+=4;let e=t[r]||0;n+=Math.floor(e/20)*2}return n}function en(e){return 5+e.length*3}var tn,nn,rn,an,on=e((()=>{tn=[{id:`rune-fire`,name:`Ignis Rune`,element:`fire`,description:`Burns with inner flame. Base element for fire spells.`,discovered:!0},{id:`rune-ice`,name:`Glacius Rune`,element:`ice`,description:`Cold as the void between stars. Base for ice spells.`,discovered:!0},{id:`rune-lightning`,name:`Voltus Rune`,element:`lightning`,description:`Crackles with raw energy. Base for lightning spells.`,discovered:!1},{id:`rune-shadow`,name:`Umbra Rune`,element:`shadow`,description:`Absorbs light around it. Base for shadow spells.`,discovered:!1},{id:`rune-nature`,name:`Verdis Rune`,element:`nature`,description:`Pulses with living energy. Base for nature spells.`,discovered:!1},{id:`rune-arcane`,name:`Arcanum Rune`,element:`arcane`,description:`Pure magical essence. Base for arcane spells.`,discovered:!1}],nn={fire:[`Flame`,`Ember`,`Blaze`,`Pyre`,`Scorch`],ice:[`Frost`,`Glacial`,`Chill`,`Sleet`,`Rime`],lightning:[`Spark`,`Thunder`,`Volt`,`Storm`,`Arc`],shadow:[`Shadow`,`Void`,`Dusk`,`Umbral`,`Eclipse`],nature:[`Thorn`,`Bloom`,`Vine`,`Root`,`Verdant`],arcane:[`Arcane`,`Ether`,`Mystic`,`Astral`,`Aether`]},rn={fire:[`fall`,`burst`,`wave`,`strike`,`storm`],ice:[`snap`,`bite`,`shard`,`lance`,`wall`],lightning:[`bolt`,`crack`,`surge`,`chain`,`flash`],shadow:[`grasp`,`veil`,`pulse`,`mark`,`drain`],nature:[`spike`,`wrap`,`bloom`,`seed`,`mend`],arcane:[`ray`,`nova`,`orb`,`weave`,`surge`]},an={fire:{ice:`Frostfall`,lightning:`Thunderflame`,shadow:`Darkfire`,nature:`Wildfire`,arcane:`Starfire`},ice:{fire:`Meltwater`,lightning:`Frostbolt`,shadow:`Blackice`,nature:`Winterbloom`,arcane:`Crystal`},lightning:{fire:`Firestorm`,ice:`Shockfrost`,shadow:`Darkstorm`,nature:`Stormroot`,arcane:`Sparkweave`},shadow:{fire:`Shadowflame`,ice:`Darkfrost`,lightning:`Nightstrike`,nature:`Blight`,arcane:`Voidweave`},nature:{fire:`Ashbloom`,ice:`Frostbloom`,lightning:`Thundervine`,shadow:`Rotwood`,arcane:`Lifespark`},arcane:{fire:`Sunfire`,ice:`Moonbeam`,lightning:`Starshock`,shadow:`Voidbeam`,nature:`Spiritbloom`}}})),k,A,sn=e((()=>{k={stoneSentinel:()=>({id:`stone-sentinel-`+Math.random().toString(36).slice(2,6),name:`Stone Sentinel`,hp:35,maxHp:35,attack:8,defense:12,resistances:{fire:.3,ice:.3},weaknesses:[`lightning`,`nature`],traits:{aggression:.6,compassion:.1,arcaneAffinity:.2,cunning:.3,resilience:.8},xpReward:15,goldReward:8,loot:[{itemId:`potion-small`,chance:.4}],icon:`game-icons:stone-wall`,behavior:`territorial`}),venomSpider:()=>({id:`venom-spider-`+Math.random().toString(36).slice(2,6),name:`Venom Spider`,hp:22,maxHp:22,attack:10,defense:4,resistances:{nature:.5},weaknesses:[`fire`,`ice`],traits:{aggression:.8,compassion:0,arcaneAffinity:.1,cunning:.7,resilience:.3},xpReward:12,goldReward:5,loot:[{itemId:`spider-silk`,chance:.3}],icon:`game-icons:spider-face`,behavior:`aggressive`}),gravelGolem:()=>({id:`gravel-golem-`+Math.random().toString(36).slice(2,6),name:`Gravel Golem`,hp:50,maxHp:50,attack:12,defense:15,resistances:{fire:.5,ice:.3,lightning:.2},weaknesses:[`nature`],traits:{aggression:.4,compassion:0,arcaneAffinity:.1,cunning:.1,resilience:.9},xpReward:20,goldReward:12,loot:[{itemId:`stone-chunk`,chance:.5}],icon:`game-icons:rock-golem`,behavior:`territorial`}),caveBat:()=>({id:`cave-bat-`+Math.random().toString(36).slice(2,6),name:`Cave Bat`,hp:15,maxHp:15,attack:7,defense:2,resistances:{shadow:.4},weaknesses:[`lightning`,`fire`],traits:{aggression:.5,compassion:0,arcaneAffinity:0,cunning:.6,resilience:.2},xpReward:8,goldReward:3,loot:[],icon:`game-icons:bat-wing`,behavior:`cowardly`}),crystalGuardian:()=>({id:`crystal-guardian-`+Math.random().toString(36).slice(2,6),name:`Crystal Guardian`,hp:60,maxHp:60,attack:14,defense:10,resistances:{fire:.8,lightning:.5},weaknesses:[`ice`,`shadow`],traits:{aggression:.5,compassion:0,arcaneAffinity:.6,cunning:.4,resilience:.7},xpReward:30,goldReward:20,loot:[{itemId:`rune-lightning`,chance:.6}],icon:`game-icons:crystal-growth`,behavior:`defensive`,spells:[{name:`Crystal Shard`,element:`arcane`,damage:12,manaCost:0}]}),floorBoss1:()=>({id:`stone-king`,name:`The Stone King`,hp:120,maxHp:120,attack:16,defense:18,resistances:{fire:.4,ice:.4,lightning:.4},weaknesses:[`nature`,`shadow`],traits:{aggression:.7,compassion:0,arcaneAffinity:.5,cunning:.5,resilience:.9},xpReward:60,goldReward:40,loot:[{itemId:`kings-crown`,chance:1}],icon:`game-icons:crowned-skull`,behavior:`aggressive`,spells:[{name:`Stone Crush`,element:`nature`,damage:18,manaCost:0},{name:`Rock Shield`,element:`nature`,damage:0,manaCost:0}]})},A={mirrorWraith:()=>({id:`mirror-wraith-`+Math.random().toString(36).slice(2,6),name:`Mirror Wraith`,hp:40,maxHp:40,attack:12,defense:6,resistances:{arcane:.6,fire:.3},weaknesses:[`shadow`,`nature`],traits:{aggression:.3,compassion:0,arcaneAffinity:.7,cunning:.8,resilience:.4},xpReward:22,goldReward:15,loot:[{itemId:`mirror-shard`,chance:.3}],icon:`game-icons:spectre`,behavior:`defensive`,spells:[{name:`Reflect`,element:`arcane`,damage:8,manaCost:0}]}),shadowHound:()=>({id:`shadow-hound-`+Math.random().toString(36).slice(2,6),name:`Shadow Hound`,hp:32,maxHp:32,attack:14,defense:5,resistances:{shadow:.7,ice:.2},weaknesses:[`fire`,`lightning`],traits:{aggression:.9,compassion:0,arcaneAffinity:.3,cunning:.5,resilience:.5},xpReward:18,goldReward:10,loot:[{itemId:`shadow-fang`,chance:.3}],icon:`game-icons:wolf-head`,behavior:`aggressive`}),manaDrainer:()=>({id:`mana-drainer-`+Math.random().toString(36).slice(2,6),name:`Mana Leech`,hp:28,maxHp:28,attack:8,defense:4,resistances:{arcane:.5,lightning:.3},weaknesses:[`fire`,`nature`],traits:{aggression:.4,compassion:0,arcaneAffinity:.8,cunning:.9,resilience:.3},xpReward:16,goldReward:8,loot:[{itemId:`mana-crystal`,chance:.5}],icon:`game-icons:leech`,behavior:`cowardly`,spells:[{name:`Mana Drain`,element:`arcane`,damage:5,manaCost:0}]}),abyssalKnight:()=>({id:`abyssal-knight-`+Math.random().toString(36).slice(2,6),name:`Abyssal Knight`,hp:55,maxHp:55,attack:16,defense:12,resistances:{shadow:.5,fire:.3,ice:.3},weaknesses:[`lightning`,`arcane`],traits:{aggression:.7,compassion:.1,arcaneAffinity:.4,cunning:.3,resilience:.7},xpReward:28,goldReward:18,loot:[{itemId:`dark-plate`,chance:.3}],icon:`game-icons:visor-knight`,behavior:`aggressive`}),voidWeaver:()=>({id:`void-weaver-`+Math.random().toString(36).slice(2,6),name:`Void Weaver`,hp:70,maxHp:70,attack:15,defense:8,resistances:{shadow:.8,arcane:.6,fire:.3,ice:.3},weaknesses:[`nature`,`lightning`],traits:{aggression:.3,compassion:0,arcaneAffinity:.9,cunning:.8,resilience:.5},xpReward:40,goldReward:25,loot:[{itemId:`rune-arcane`,chance:.5}],icon:`game-icons:magic-portal`,behavior:`defensive`,spells:[{name:`Void Bolt`,element:`shadow`,damage:14,manaCost:0},{name:`Mana Siphon`,element:`arcane`,damage:8,manaCost:0}]}),floorBoss2:()=>({id:`void-empress`,name:`The Void Empress`,hp:180,maxHp:180,attack:20,defense:14,resistances:{shadow:.7,arcane:.5,fire:.3,ice:.3,lightning:.3},weaknesses:[`nature`],traits:{aggression:.6,compassion:0,arcaneAffinity:.9,cunning:.7,resilience:.8},xpReward:100,goldReward:60,loot:[{itemId:`void-crown`,chance:1}],icon:`game-icons:crowned-heart`,behavior:`aggressive`,spells:[{name:`Void Storm`,element:`shadow`,damage:22,manaCost:0},{name:`Reality Tear`,element:`arcane`,damage:18,manaCost:0},{name:`Essence Drain`,element:`shadow`,damage:12,manaCost:0}]})}})),j,M,cn=e((()=>{j={"potion-small":()=>({id:`potion-small-`+Math.random().toString(36).slice(2,6),name:`Minor Health Potion`,category:`consumable`,description:`Restores 20 HP.`,value:10,effect:{type:`heal-hp`,value:20},quantity:1,icon:`game-icons:health-potion`}),"potion-large":()=>({id:`potion-large-`+Math.random().toString(36).slice(2,6),name:`Greater Health Potion`,category:`consumable`,description:`Restores 50 HP.`,value:25,effect:{type:`heal-hp`,value:50},quantity:1,icon:`game-icons:health-potion`}),"mana-potion":()=>({id:`mana-potion-`+Math.random().toString(36).slice(2,6),name:`Mana Draught`,category:`consumable`,description:`Restores 15 mana.`,value:15,effect:{type:`heal-mana`,value:15},quantity:1,icon:`game-icons:potion-ball`}),"stamina-potion":()=>({id:`stamina-potion-`+Math.random().toString(36).slice(2,6),name:`Stamina Tonic`,category:`consumable`,description:`Restores 15 stamina.`,value:12,effect:{type:`heal-stamina`,value:15},quantity:1,icon:`game-icons:round-bottom-flask`}),"spider-silk":()=>({id:`spider-silk-`+Math.random().toString(36).slice(2,6),name:`Spider Silk`,category:`consumable`,description:`Tough silk from a venom spider. Trade material.`,value:8,quantity:1,icon:`game-icons:web-spit`}),"stone-chunk":()=>({id:`stone-chunk-`+Math.random().toString(36).slice(2,6),name:`Stone Chunk`,category:`consumable`,description:`A dense piece of enchanted stone. Trade material.`,value:12,quantity:1,icon:`game-icons:stone-block`}),"mirror-shard":()=>({id:`mirror-shard-`+Math.random().toString(36).slice(2,6),name:`Mirror Shard`,category:`consumable`,description:`Reflects light in strange patterns. Trade material.`,value:15,quantity:1,icon:`game-icons:crystal-shine`}),"shadow-fang":()=>({id:`shadow-fang-`+Math.random().toString(36).slice(2,6),name:`Shadow Fang`,category:`consumable`,description:`Dripping with shadow energy. Trade material.`,value:14,quantity:1,icon:`game-icons:fang`}),"mana-crystal":()=>({id:`mana-crystal-`+Math.random().toString(36).slice(2,6),name:`Mana Crystal`,category:`consumable`,description:`Concentrated mana in crystal form. Restores 25 mana.`,value:20,effect:{type:`heal-mana`,value:25},quantity:1,icon:`game-icons:crystal-bars`}),"dungeon-key":()=>({id:`dungeon-key-`+Math.random().toString(36).slice(2,6),name:`Dungeon Key`,category:`consumable`,description:`Opens a locked passage.`,value:50,effect:{type:`key`,value:1},quantity:1,icon:`game-icons:key`})},M={"rusty-sword":()=>({id:`rusty-sword`,name:`Rusty Sword`,slot:`main-hand`,stats:{attack:3},description:`A battered but functional blade.`,value:15}),"iron-sword":()=>({id:`iron-sword`,name:`Iron Sword`,slot:`main-hand`,stats:{attack:6},description:`A solid iron blade.`,value:35}),"flame-dagger":()=>({id:`flame-dagger`,name:`Flame Dagger`,slot:`main-hand`,stats:{attack:5},element:`fire`,description:`A dagger that burns with inner flame. +fire damage to physical attacks.`,value:45}),"wooden-shield":()=>({id:`wooden-shield`,name:`Wooden Shield`,slot:`off-hand`,stats:{defense:3},description:`Basic wooden shield.`,value:12}),"crystal-focus":()=>({id:`crystal-focus`,name:`Crystal Focus`,slot:`off-hand`,stats:{maxMana:10},description:`A focusing crystal that increases mana pool.`,value:40}),"leather-armor":()=>({id:`leather-armor`,name:`Leather Armor`,slot:`body`,stats:{defense:4,maxHp:10},description:`Light leather armor.`,value:25}),"chain-mail":()=>({id:`chain-mail`,name:`Chain Mail`,slot:`body`,stats:{defense:8,maxHp:15},description:`Sturdy chain mail armor.`,value:60}),"dark-plate":()=>({id:`dark-plate`,name:`Dark Plate`,slot:`body`,stats:{defense:10,maxHp:20},element:`shadow`,description:`Armor infused with shadow energy. Reduces shadow damage.`,value:80}),"health-amulet":()=>({id:`health-amulet`,name:`Amulet of Vitality`,slot:`trinket`,stats:{maxHp:20},description:`Radiates with healing energy.`,value:30}),"mana-ring":()=>({id:`mana-ring`,name:`Ring of Sorcery`,slot:`trinket`,stats:{maxMana:15},description:`Hums with arcane power.`,value:35}),"kings-crown":()=>({id:`kings-crown`,name:`Stone King's Crown`,slot:`trinket`,stats:{defense:5,maxHp:15,attack:3},description:`The crown of the defeated Stone King. Radiates authority.`,value:100}),"void-crown":()=>({id:`void-crown`,name:`Void Empress Crown`,slot:`trinket`,stats:{maxMana:20,maxHp:10,attack:5},element:`shadow`,description:`Crown of the Void Empress. Pulses with dark power.`,value:200})}}));function ln(){return[{id:`npc-hermit`,name:`Grizzled Hermit`,icon:`game-icons:hooded-figure`,traits:{aggression:.2,compassion:.6,arcaneAffinity:.4,cunning:.5,resilience:.7},met:!1,dialogue:[{id:`start`,text:`Hmm... another soul trapped in these depths. I've been here longer than I can remember. I know the secrets of the runes, if you're interested.`,choices:[{text:`Please teach me about the runes. (Compassionate)`,nextId:`teach`,traitShift:{compassion:.1}},{text:`Hand over what you know, old man. (Aggressive)`,nextId:`threaten`,traitShift:{aggression:.15,compassion:-.1}},{text:`What's in it for me? (Cunning)`,nextId:`bargain`,traitShift:{cunning:.1}}]},{id:`teach`,text:`A kind heart in these dark halls... rare indeed. Here, take this rune. It channels the storms themselves. Use it wisely.`,choices:[{text:`Thank you, elder.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-lightning`);t&&(t.discovered=!0),N(e,`Discovered: Voltus Rune (Lightning)!`,`reward`)}}]},{id:`threaten`,text:`Violence? Here? ...Fine. Take this and go. But know that the dungeon remembers cruelty.`,choices:[{text:`Whatever.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-lightning`);t&&(t.discovered=!0),e.player.traits.aggression=Math.min(1,e.player.traits.aggression+.1),N(e,`Discovered: Voltus Rune (Lightning). +0.1 Aggression.`,`reward`)}}]},{id:`bargain`,text:`Sharp one, aren't you? I'll trade: bring me a Stone Chunk from the golems, and I'll give you a rune AND teach you a trick.`,choices:[{text:`Deal. I'll be back.`,effect:e=>{let t=e.player.inventory.find(e=>e.name===`Stone Chunk`);if(t){t.quantity--,t.quantity<=0&&(e.player.inventory=e.player.inventory.filter(e=>e!==t));let n=e.player.discoveredRunes.find(e=>e.id===`rune-lightning`);n&&(n.discovered=!0),e.player.gold+=20,N(e,`Traded Stone Chunk! Got: Voltus Rune + 20 gold.`,`reward`)}else N(e,`You need a Stone Chunk to trade. Come back later.`,`info`)}},{text:`Nevermind.`}]}]},{id:`npc-witch`,name:`Shadow Witch Morvyn`,icon:`game-icons:witch-face`,traits:{aggression:.4,compassion:.3,arcaneAffinity:.9,cunning:.7,resilience:.5},met:!1,dialogue:[{id:`start`,text:`The shadows told me you'd come. I am Morvyn, keeper of the dark arts. The Umbra Rune calls to you... but shadow magic has a price.`,choices:[{text:`I'll pay any price for power. (Arcane)`,nextId:`accept-shadow`,traitShift:{arcaneAffinity:.15,resilience:-.05}},{text:`What kind of price? (Cautious)`,nextId:`cautious`,traitShift:{cunning:.1}},{text:`Shadow magic is dangerous. No thanks. (Resilient)`,nextId:`refuse`,traitShift:{resilience:.1}}]},{id:`accept-shadow`,text:`Bold. The shadows favor the fearless. Take the Umbra Rune. But beware: use it too freely and the Void Empress will sense you.`,choices:[{text:`I understand.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-shadow`);t&&(t.discovered=!0),e.player.hp=Math.max(1,e.player.hp-10),N(e,`Discovered: Umbra Rune (Shadow)! Lost 10 HP from the dark pact.`,`reward`)}}]},{id:`cautious`,text:`Smart. The price is a piece of your vitality. 10 HP, permanently until you rest. But the shadow arts can bypass the Crystal Guardian's defenses entirely.`,choices:[{text:`Worth it. Give me the rune.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-shadow`);t&&(t.discovered=!0),e.player.hp=Math.max(1,e.player.hp-10),N(e,`Discovered: Umbra Rune (Shadow)! Cost: 10 HP.`,`reward`)}},{text:`Too steep. I'll pass.`}]},{id:`refuse`,text:`Hmph. Resilience without ambition is just stubbornness. Go, then. But you'll be back when the deep halls swallow your light spells whole.`,choices:[{text:`We'll see about that.`,effect:e=>{e.player.traits.resilience=Math.min(1,e.player.traits.resilience+.1),N(e,`+0.1 Resilience. Morvyn respects your conviction.`,`trait`)}}]}]},{id:`npc-spirit`,name:`Ancient Spirit Lyra`,icon:`game-icons:fairy`,traits:{aggression:.1,compassion:.8,arcaneAffinity:.7,cunning:.3,resilience:.6},met:!1,dialogue:[{id:`start`,text:`I am Lyra, bound to this place since before the dungeon swallowed the light. I sense the runes within you... but do you understand their true nature?`,choices:[{text:`Teach me about rune harmony. (Compassionate)`,nextId:`teach-harmony`,traitShift:{compassion:.1,arcaneAffinity:.05}},{text:`Can you help me fight the Void Empress? (Direct)`,nextId:`fight-help`,traitShift:{aggression:.05}},{text:`Are you trapped here too? (Empathetic)`,nextId:`empathy`,traitShift:{compassion:.15}}]},{id:`teach-harmony`,text:`When runes of opposing elements merge, they create something neither could alone. Take this Nature rune — it is the opposite of shadow, the antidote to the Empress's power.`,choices:[{text:`Thank you, Lyra.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-nature`);t&&(t.discovered=!0),e.player.affinities.nature=Math.min(100,(e.player.affinities.nature||0)+10),N(e,`Discovered: Verdis Rune (Nature)! +10 Nature affinity.`,`reward`)}}]},{id:`fight-help`,text:`The Empress... she was once like me. A spirit of this place. But she consumed too much void energy. To defeat her, you need nature-infused spells. Take this.`,choices:[{text:`I'll end her reign.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-nature`);t&&(t.discovered=!0),N(e,`Discovered: Verdis Rune (Nature)! Lyra whispers: "Combine it with another element..."`,`reward`)}}]},{id:`empathy`,text:`Yes... for centuries. But your kindness gives me hope. Take both my gifts — a rune of nature, and a blessing of the ancients.`,choices:[{text:`I'll free you if I can.`,effect:e=>{let t=e.player.discoveredRunes.find(e=>e.id===`rune-nature`);t&&(t.discovered=!0),e.player.maxHp+=10,e.player.hp+=10,e.player.affinities.nature=Math.min(100,(e.player.affinities.nature||0)+15),N(e,`Discovered: Verdis Rune! +10 max HP! +15 Nature affinity! Lyra blesses you.`,`reward`)}}]}]}]}function N(e,t,n){e.notifications.push({text:t,type:n,id:e.nextNotifId++,expires:Date.now()+4e3})}var un=e((()=>{}));function P(e){return{description:``,cleared:!1,discovered:!1,connections:[],icon:dn(e.type),...e}}function dn(e){return{combat:`game-icons:crossed-swords`,elite:`game-icons:skull-crossed-bones`,forge:`game-icons:anvil`,rest:`game-icons:campfire`,event:`game-icons:scroll-unfurled`,merchant:`game-icons:shop`,boss:`game-icons:crowned-skull`,training:`game-icons:training`}[e]||`game-icons:dungeon-gate`}function fn(){let e=ln(),t=[P({id:`f1-entrance`,name:`Dungeon Entrance`,type:`event`,floor:1,x:2,y:0,discovered:!0,description:`Cold stone steps lead down into darkness. A faint glow beckons ahead.`,eventData:{text:`You descend into the dungeon. The air is thick with ancient magic. A weathered sign reads: "Only the ingenious escape these depths."`,choices:[{text:`Press forward with determination.`,effect:e=>{e.player.traits.resilience=Math.min(1,e.player.traits.resilience+.05)},resultText:`You steel yourself. (+0.05 Resilience)`},{text:`Study the runes carved into the walls.`,effect:e=>{e.player.traits.arcaneAffinity=Math.min(1,e.player.traits.arcaneAffinity+.05)},resultText:`The runes whisper ancient secrets. (+0.05 Arcane Affinity)`}]}}),P({id:`f1-combat1`,name:`Spider Nest`,type:`combat`,floor:1,x:1,y:1,description:`Webs cover every surface. Something skitters in the dark.`,enemies:[k.venomSpider(),k.caveBat()]}),P({id:`f1-combat2`,name:`Golem Hall`,type:`combat`,floor:1,x:3,y:1,description:`Stone constructs stand watch over crumbling pillars.`,enemies:[k.stoneSentinel(),k.gravelGolem()]}),P({id:`f1-event1`,name:`Hermit's Alcove`,type:`event`,floor:1,x:0,y:2,description:`A small alcove where an old figure sits by a dim fire.`,npc:e[0]}),P({id:`f1-forge`,name:`Ancient Forge`,type:`forge`,floor:1,x:2,y:2,description:`Glowing runes pulse on an ancient stone anvil. The forge still burns.`}),P({id:`f1-merchant`,name:`Crag's Shop`,type:`merchant`,floor:1,x:4,y:2,description:`A merchant has set up shop in a surprisingly clean alcove.`,merchantStock:[j[`potion-small`](),j[`potion-small`](),j[`potion-large`](),j[`mana-potion`](),j[`stamina-potion`](),M[`iron-sword`](),M[`wooden-shield`](),M[`leather-armor`](),M[`health-amulet`]()]}),P({id:`f1-rest`,name:`Moss Grotto`,type:`rest`,floor:1,x:1,y:3,description:`Soft moss and a gentle spring. A place of respite.`}),P({id:`f1-elite`,name:`Crystal Chamber`,type:`elite`,floor:1,x:3,y:3,description:`Crystals pulse with hostile energy. A guardian stands vigil.`,enemies:[k.crystalGuardian()]}),P({id:`f1-training`,name:`Training Grounds`,type:`training`,floor:1,x:2,y:3,description:`Practice dummies and enchanted sparring targets line the walls.`,enemies:[{id:`dummy-1`,name:`Training Dummy`,hp:999,maxHp:999,attack:1,defense:0,resistances:{},weaknesses:[],traits:{aggression:0,compassion:0,arcaneAffinity:0,cunning:0,resilience:1},xpReward:2,goldReward:0,icon:`game-icons:armor-punch`,behavior:`territorial`,loot:[]}]}),P({id:`f1-boss`,name:`Stone King's Throne`,type:`boss`,floor:1,x:2,y:4,description:`A massive throne room. The Stone King rises from his seat.`,enemies:[k.floorBoss1()]})];for(let[e,n]of[[`f1-entrance`,`f1-combat1`],[`f1-entrance`,`f1-combat2`],[`f1-combat1`,`f1-event1`],[`f1-combat1`,`f1-forge`],[`f1-combat2`,`f1-forge`],[`f1-combat2`,`f1-merchant`],[`f1-event1`,`f1-rest`],[`f1-forge`,`f1-training`],[`f1-forge`,`f1-rest`],[`f1-forge`,`f1-elite`],[`f1-merchant`,`f1-elite`],[`f1-rest`,`f1-boss`],[`f1-elite`,`f1-boss`],[`f1-training`,`f1-boss`]]){let r=t.find(t=>t.id===e),i=t.find(e=>e.id===n);r.connections.includes(n)||r.connections.push(n),i.connections.includes(e)||i.connections.push(e)}let n=[P({id:`f2-entrance`,name:`Shadow Threshold`,type:`event`,floor:2,x:2,y:0,description:`The air grows thick with shadow. Reality feels thinner here.`,eventData:{text:`As you descend deeper, shadows seem to move with purpose. The dungeon itself seems aware of your presence.`,choices:[{text:`Embrace the darkness within. (+Shadow affinity)`,effect:e=>{e.player.affinities.shadow=Math.min(100,(e.player.affinities.shadow||0)+5)},resultText:`The shadows welcome you. (+5 Shadow affinity)`},{text:`Light a torch and push through. (+Resilience)`,effect:e=>{e.player.traits.resilience=Math.min(1,e.player.traits.resilience+.05)},resultText:`Your light pushes back the dark. (+0.05 Resilience)`}]}}),P({id:`f2-combat1`,name:`Wraith Corridor`,type:`combat`,floor:2,x:1,y:1,description:`Ghostly figures drift through translucent walls.`,enemies:[A.mirrorWraith(),A.manaDrainer()]}),P({id:`f2-combat2`,name:`Hound Kennel`,type:`combat`,floor:2,x:3,y:1,description:`Growling echoes from the shadows. Red eyes watch your every move.`,enemies:[A.shadowHound(),A.shadowHound()]}),P({id:`f2-event1`,name:`Morvyn's Sanctum`,type:`event`,floor:2,x:0,y:2,description:`Candles float in the air. A witch peers at you from the darkness.`,npc:e[1]}),P({id:`f2-forge`,name:`Shadow Forge`,type:`forge`,floor:2,x:2,y:2,description:`A forge that burns with dark flame. More powerful but more dangerous.`}),P({id:`f2-merchant`,name:`Shade's Bazaar`,type:`merchant`,floor:2,x:4,y:2,description:`A mysterious merchant who seems to exist between worlds.`,merchantStock:[j[`potion-large`](),j[`potion-large`](),j[`mana-potion`](),j[`mana-crystal`](),j[`stamina-potion`](),M[`flame-dagger`](),M[`crystal-focus`](),M[`chain-mail`](),M[`mana-ring`]()]}),P({id:`f2-rest`,name:`Spirit Spring`,type:`rest`,floor:2,x:1,y:3,description:`A spectral spring pulses with healing energy.`}),P({id:`f2-event2`,name:`Lyra's Shrine`,type:`event`,floor:2,x:3,y:3,description:`A serene glow emanates from an ancient shrine.`,npc:e[2]}),P({id:`f2-elite`,name:`Void Weaver's Lair`,type:`elite`,floor:2,x:2,y:3,description:`Reality warps and tears around a powerful void entity.`,enemies:[A.voidWeaver()]}),P({id:`f2-combat3`,name:`Dark Garrison`,type:`combat`,floor:2,x:4,y:3,description:`Armored knights of the abyss stand guard.`,enemies:[A.abyssalKnight(),A.shadowHound()]}),P({id:`f2-boss`,name:`Void Empress's Chamber`,type:`boss`,floor:2,x:2,y:4,description:`The heart of the dungeon. The Void Empress awaits.`,enemies:[A.floorBoss2()]})];for(let[e,t]of[[`f2-entrance`,`f2-combat1`],[`f2-entrance`,`f2-combat2`],[`f2-combat1`,`f2-event1`],[`f2-combat1`,`f2-forge`],[`f2-combat2`,`f2-forge`],[`f2-combat2`,`f2-merchant`],[`f2-event1`,`f2-rest`],[`f2-forge`,`f2-elite`],[`f2-forge`,`f2-rest`],[`f2-forge`,`f2-event2`],[`f2-merchant`,`f2-event2`],[`f2-merchant`,`f2-combat3`],[`f2-rest`,`f2-boss`],[`f2-elite`,`f2-boss`],[`f2-event2`,`f2-boss`],[`f2-combat3`,`f2-boss`]]){let r=n.find(t=>t.id===e),i=n.find(e=>e.id===t);r.connections.includes(t)||r.connections.push(t),i.connections.includes(e)||i.connections.push(e)}return[{id:1,name:`Stone Depths`,rooms:t,bossRoomId:`f1-boss`,mechanicalConstraint:`Enemies resistant to raw damage. Craft elemental spells using the forge.`,unlocked:!0},{id:2,name:`Shadow Depths`,rooms:n,bossRoomId:`f2-boss`,mechanicalConstraint:`Enemies reflect direct damage and drain mana. Use combo spells and physical skills.`,unlocked:!1}]}var pn=e((()=>{sn(),cn(),un()}));function mn(){return[{id:`spell-basic-fire`,name:`Ember Spark`,elements:[`fire`],runeIds:[`rune-fire`],damage:10,manaCost:5,affinity:0,isCrafted:!1},{id:`spell-basic-ice`,name:`Frost Shard`,elements:[`ice`],runeIds:[`rune-ice`],damage:10,manaCost:5,affinity:0,isCrafted:!1}]}function hn(){return[{id:`skill-slash`,name:`Slash`,staminaCost:5,damage:8,level:1,xpToNext:20,currentXp:0},{id:`skill-guard`,name:`Guard`,staminaCost:3,damage:0,effect:{type:`shield`,value:8,duration:1},level:1,xpToNext:20,currentXp:0}]}function gn(){return[{id:`st-power-strike`,name:`Power Strike`,description:`A devastating blow. 15 damage, costs 8 stamina.`,unlocked:!1,skillId:`skill-power-strike`,cost:1},{id:`st-whirlwind`,name:`Whirlwind`,description:`Hit all enemies for 10 damage. Costs 10 stamina.`,unlocked:!1,requires:[`st-power-strike`],skillId:`skill-whirlwind`,cost:2},{id:`st-iron-wall`,name:`Iron Wall`,description:`Block 15 damage for 2 turns. Costs 6 stamina.`,unlocked:!1,skillId:`skill-iron-wall`,cost:1},{id:`st-counter`,name:`Counter`,description:`Reflect 50% of next attack. Costs 7 stamina.`,unlocked:!1,requires:[`st-iron-wall`],skillId:`skill-counter`,cost:2},{id:`st-drain-strike`,name:`Drain Strike`,description:`Deal 10 damage, heal 5 HP. Costs 8 stamina.`,unlocked:!1,requires:[`st-power-strike`],skillId:`skill-drain-strike`,cost:2},{id:`st-focus`,name:`Focus`,description:`Next spell deals 50% more damage. Costs 5 stamina.`,unlocked:!1,skillId:`skill-focus`,cost:1}]}function _n(){return[{id:`policy-heal-low`,condition:`HP < 30%`,action:`Use heal spell`,priority:1,enabled:!0},{id:`policy-weakness`,condition:`Enemy has weakness`,action:`Use element-matched spell`,priority:2,enabled:!0},{id:`policy-default`,condition:`Always`,action:`Use highest damage spell`,priority:5,enabled:!0},{id:`policy-guard-low`,condition:`HP < 20%`,action:`Use Guard skill`,priority:0,enabled:!0},{id:`policy-stamina-attack`,condition:`Mana < 10`,action:`Use physical skill`,priority:3,enabled:!0}]}function vn(){let e=mn(),t=hn();return{name:`Adventurer`,hp:80,maxHp:80,mana:30,maxMana:30,stamina:25,maxStamina:25,level:1,xp:0,xpToNext:50,gold:20,attack:5,defense:3,traits:{aggression:.3,compassion:.4,arcaneAffinity:.3,cunning:.3,resilience:.4},knownSpells:e,equippedSpells:[e[0],e[1],null,null,null,null],knownSkills:t,equippedSkills:[t[0],t[1],null,null],actionPolicies:_n(),equipment:{"main-hand":null,"off-hand":null,body:null,trinket:null},inventory:[],discoveredRunes:tn.map(e=>({...e})),skillPoints:0,skillTree:gn(),affinities:{fire:5,ice:5,lightning:0,shadow:0,nature:0,arcane:0}}}function yn(){let e=fn();return e[0].rooms[0].discovered=!0,{screen:`exploration`,player:vn(),floors:e,currentFloor:0,currentRoomId:`f1-entrance`,combatState:null,combatLog:[],gameTime:0,gameStartTime:Date.now(),notifications:[],nextNotifId:1,roomTransitions:0,dialogueState:null,paused:!1}}function F(e){try{let t=JSON.parse(JSON.stringify(e,(e,t)=>{if(typeof t!=`function`)return t}));localStorage.setItem(Tn,JSON.stringify(t))}catch(e){console.warn(`Save failed:`,e)}}function bn(){try{let e=localStorage.getItem(Tn);if(!e)return null;let t=JSON.parse(e),n=fn();for(let e=0;e<t.floors.length&&e<n.length;e++){let r=t.floors[e],i=n[e];for(let e of i.rooms){let t=r.rooms.find(t=>t.id===e.id);if(t&&(e.eventData&&(t.eventData=e.eventData),e.npc)){let n=e.npc;t.npc&&(n.met=t.npc.met),t.npc=n}}}return t}catch(e){return console.warn(`Load failed:`,e),null}}function xn(){localStorage.removeItem(Tn)}function I(){return R}function Sn(e){R=e,wn()}function L(e){R&&(e(R),wn())}function Cn(e){return En.add(e),()=>En.delete(e)}function wn(){for(let e of En)e()}var Tn,R,En,z=e((()=>{on(),pn(),Tn=`escape-dungeon-save`,R=null,En=new Set}));function B(e,t=20){return`<iconify-icon icon="${e}" width="${t}" height="${t}"></iconify-icon>`}function V(e,t,n,r=`100px`){return`
    <div class="bar-container ${n}" style="width:${r}">
      <div class="bar-fill" style="width:${t>0?Math.round(e/t*100):0}%"></div>
      <div class="bar-text">${e}/${t}</div>
    </div>
  `}function Dn(e){return`<span class="element-tag el-${e}">${B(H(e),12)} ${e}</span>`}function H(e){return{fire:`game-icons:fire`,ice:`game-icons:snowflake-1`,lightning:`game-icons:lightning-bolt`,shadow:`game-icons:death-skull`,nature:`game-icons:oak-leaf`,arcane:`game-icons:crystal-ball`}[e]||`game-icons:magic-swirl`}function U(e){return{fire:`var(--fire)`,ice:`var(--ice)`,lightning:`var(--lightning)`,shadow:`var(--shadow)`,nature:`var(--nature)`,arcane:`var(--arcane)`}[e]||`var(--text)`}function On(e,t=!1,n){let r=e.elements.map(e=>Dn(e)).join(` `),i=e.effect?`<div style="font-size:10px;color:var(--text-dim);">${e.effect.type}${e.effect.value?`: `+e.effect.value:``}${e.effect.duration?` (`+e.effect.duration+`t)`:``}</div>`:``;return`
    <div class="spell-card ${t?`selected`:``}" ${n?`onclick="${n}"`:``}>
      <div style="font-size:24px;margin-bottom:4px">${B(kn(e),24)}</div>
      <div style="font-weight:600;font-size:12px">${e.name}</div>
      <div style="font-size:11px;color:var(--text-dim)">${e.damage>0?e.damage+` dmg`:``} ${e.manaCost} mana</div>
      <div style="margin-top:4px">${r}</div>
      ${i}
      ${e.isCrafted?`<div style="font-size:9px;color:var(--accent-light);margin-top:2px">CRAFTED</div>`:``}
    </div>
  `}function kn(e){return e.elements.includes(`fire`)?`game-icons:fire-spell-cast`:e.elements.includes(`ice`)?`game-icons:ice-spell-cast`:e.elements.includes(`lightning`)?`game-icons:lightning-storm`:e.elements.includes(`shadow`)?`game-icons:death-zone`:e.elements.includes(`nature`)?`game-icons:leaf-swirl`:e.elements.includes(`arcane`)?`game-icons:magic-swirl`:`game-icons:spell-book`}function An(e){return`
    <div class="spell-card">
      <div style="font-size:24px;margin-bottom:4px">${B(`game-icons:sword-brandish`,24)}</div>
      <div style="font-weight:600;font-size:12px">${e.name}</div>
      <div style="font-size:11px;color:var(--text-dim)">${e.damage>0?e.damage+` dmg`:`Utility`} ${e.staminaCost} sta</div>
      <div style="font-size:10px;color:var(--accent-light)">Lv.${e.level}</div>
    </div>
  `}function W(e){return{combat:`var(--danger)`,elite:`#ff6600`,forge:`var(--fire)`,rest:`var(--nature)`,event:`var(--warning)`,merchant:`var(--gold)`,boss:`#ff0066`,training:`var(--info)`}[e]||`var(--text-dim)`}function jn(e){return{aggression:`var(--danger)`,compassion:`var(--nature)`,arcaneAffinity:`var(--arcane)`,cunning:`var(--warning)`,resilience:`var(--info)`}[e]||`var(--text)`}var Mn=e((()=>{}));function Nn(e){L(t=>{let n=e.map(e=>({...e,hp:e.maxHp}));t.combatState={enemies:n,turn:0,playerTurnDone:!1,enemyTurnDone:!1,isAutoResolving:!1,autoSpeed:800,combatOver:!1,result:`pending`,activeEffects:[]},t.combatLog=[],t.screen=`combat`,t.paused=!1,G(t,`Combat begins! ${n.map(e=>e.name).join(`, `)} appear!`,`info`)})}function G(e,t,n){e.combatLog.push({text:t,type:n,timestamp:Date.now()}),e.combatLog.length>100&&(e.combatLog=e.combatLog.slice(-80))}function Pn(e,t,n){e.notifications.push({text:t,type:n,id:e.nextNotifId++,expires:Date.now()+4e3})}function Fn(e){let{player:t,combatState:n}=e;if(!n)return null;let r=n.enemies.filter(e=>e.hp>0);if(r.length===0)return null;let i=t.actionPolicies.filter(e=>e.enabled).sort((e,t)=>e.priority-t.priority);for(let e of i){let n=t.hp/t.maxHp;t.mana/t.maxMana;let i=!1;if(e.condition===`HP < 30%`?i=n<.3:e.condition===`HP < 20%`?i=n<.2:e.condition===`Mana < 10`?i=t.mana<10:e.condition===`Enemy has weakness`?i=r.some(e=>e.weaknesses.length>0):e.condition===`Always`&&(i=!0),i){if(e.action===`Use heal spell`){let e=t.equippedSpells.find(e=>e&&e.effect?.type===`heal`&&t.mana>=e.manaCost);if(e)return{type:`spell`,id:e.id}}else if(e.action===`Use element-matched spell`)for(let e of r)for(let n of e.weaknesses){let e=t.equippedSpells.find(e=>e&&e.elements.includes(n)&&t.mana>=e.manaCost);if(e)return{type:`spell`,id:e.id}}else if(e.action===`Use highest damage spell`){let e=t.equippedSpells.filter(e=>e!==null&&t.mana>=e.manaCost).sort((e,t)=>t.damage-e.damage)[0];if(e)return{type:`spell`,id:e.id}}else if(e.action===`Use Guard skill`){let e=t.equippedSkills.find(e=>e&&e.effect?.type===`shield`&&t.stamina>=e.staminaCost);if(e)return{type:`skill`,id:e.id}}else if(e.action===`Use physical skill`){let e=t.equippedSkills.filter(e=>e!==null&&t.stamina>=e.staminaCost).sort((e,t)=>t.damage-e.damage)[0];if(e)return{type:`skill`,id:e.id}}}}let a=t.equippedSpells.find(e=>e&&t.mana>=e.manaCost);if(a)return{type:`spell`,id:a.id};let o=t.equippedSkills.find(e=>e&&t.stamina>=e.staminaCost);return o?{type:`skill`,id:o.id}:null}function In(e,t,n,r,i){let a=e+Math.floor(r*.5);for(let e of t){let t=i[e]||0;a+=Math.floor(t/25)*2}for(let e of t){let t=n.resistances[e]||0;a=Math.floor(a*(1-t))}for(let e of t)n.weaknesses.includes(e)&&(a=Math.floor(a*1.5));return Math.max(1,a)}function Ln(e){if(!e.combatState)return;let t=[];for(let n=0;n<e.combatState.activeEffects.length;n++){let r=e.combatState.activeEffects[n];if(r.type===`dot`)if(r.targetType===`enemy`&&r.targetIndex!==void 0){let t=e.combatState.enemies[r.targetIndex];t&&t.hp>0&&(t.hp=Math.max(0,t.hp-r.value),G(e,`${t.name} takes ${r.value} ${r.source} damage (DoT)`,`damage`))}else r.targetType===`player`&&(e.player.hp=Math.max(0,e.player.hp-r.value),G(e,`You take ${r.value} ${r.source} damage (DoT)`,`damage`));r.turnsRemaining--,r.turnsRemaining<=0&&t.push(n)}for(let n=t.length-1;n>=0;n--)e.combatState.activeEffects.splice(t[n],1)}function Rn(e){if(!e.combatState||e.combatState.combatOver)return;let t=Fn(e),n=e.combatState.enemies.filter(e=>e.hp>0);if(!t||n.length===0){let t=n[0];if(t){let n=Math.max(1,e.player.attack-Math.floor(t.defense*.3));t.hp=Math.max(0,t.hp-n),G(e,`You strike ${t.name} for ${n} damage (basic attack - no resources left)`,`action`)}return}if(t.type===`spell`){let r=e.player.equippedSpells.find(e=>e&&e.id===t.id);if(!r)return;e.player.mana-=r.manaCost;for(let t of r.elements){let n=r.isCrafted?3:2;e.player.affinities[t]=Math.min(100,(e.player.affinities[t]||0)+n),n>0&&G(e,`+${n} ${t} affinity (casting ${r.name})`,`trait`)}let i=e.player.knownSpells.find(e=>e.id===r.id);if(i&&(i.affinity=Math.min(100,i.affinity+2)),r.effect?.type===`heal`){let n=r.effect.value;e.player.hp=Math.min(e.player.maxHp,e.player.hp+n),G(e,`[Policy: ${Bn(t,e)}] Cast ${r.name}: Heal ${n} HP (${e.player.mana} mana left)`,`heal`)}else{let i=n[0];for(let e of n)for(let t of r.elements)if(e.weaknesses.includes(t)){i=e;break}let a=In(r.damage,r.elements,i,e.player.attack,e.player.affinities);i.hp=Math.max(0,i.hp-a);let o=r.elements.some(e=>i.weaknesses.includes(e))?` (SUPER EFFECTIVE!)`:``;if(G(e,`[Policy: ${Bn(t,e)}] Cast ${r.name} on ${i.name}: ${a} damage${o} (${e.player.mana} mana left)`,`action`),r.effect?.type===`dot`&&i.hp>0){let t=e.combatState.enemies.indexOf(i);e.combatState.activeEffects.push({targetType:`enemy`,targetIndex:t,type:`dot`,value:r.effect.value,turnsRemaining:r.effect.duration||3,source:r.name}),G(e,`${i.name} is burning! (${r.effect.value} dmg/turn for ${r.effect.duration||3} turns)`,`info`)}r.effect?.type===`stun`&&i.hp>0&&G(e,`${i.name} is stunned!`,`info`)}}else{let r=e.player.equippedSkills.find(e=>e&&e.id===t.id);if(!r)return;if(e.player.stamina-=r.staminaCost,r.currentXp+=1,r.currentXp>=r.xpToNext&&(r.level++,r.currentXp=0,r.xpToNext=Math.floor(r.xpToNext*1.5),r.damage+=2,G(e,`${r.name} leveled up to ${r.level}!`,`info`)),r.effect?.type===`shield`)e.combatState.activeEffects.push({targetType:`player`,type:`shield`,value:r.effect.value,turnsRemaining:r.effect.duration||1,source:r.name}),G(e,`[Policy: ${Bn(t,e)}] Use ${r.name}: Shield ${r.effect.value} for ${r.effect.duration||1} turns`,`action`);else{let i=n[0];if(i){let n=Math.max(1,r.damage+e.player.attack-Math.floor(i.defense*.3));i.hp=Math.max(0,i.hp-n),G(e,`[Policy: ${Bn(t,e)}] Use ${r.name} on ${i.name}: ${n} damage (${e.player.stamina} stamina left)`,`action`),r.effect?.type===`heal`&&(e.player.hp=Math.min(e.player.maxHp,e.player.hp+r.effect.value),G(e,`Drained ${r.effect.value} HP from ${i.name}`,`heal`))}}}}function zn(e){if(!(!e.combatState||e.combatState.combatOver))for(let t of e.combatState.enemies){if(t.hp<=0)continue;if(t.behavior===`cowardly`&&t.hp<t.maxHp*.25){G(e,`${t.name} cowers in fear!`,`info`);continue}let n=0;for(let t of e.combatState.activeEffects)t.targetType===`player`&&t.type===`shield`&&(n+=t.value);if(t.spells&&t.spells.length>0&&(t.traits.aggression>.5||t.traits.cunning>.5)){let r=t.spells[Math.floor(Math.random()*t.spells.length)];if(r.name===`Rock Shield`||r.name===`Reflect`){G(e,`${t.name} uses ${r.name}! (Defense up)`,`action`),t.defense+=3;continue}if(r.name===`Mana Drain`||r.name===`Mana Siphon`||r.name===`Essence Drain`){let i=Math.floor(r.damage*.8);e.player.mana=Math.max(0,e.player.mana-i);let a=r.damage,o=Math.max(0,a-n);e.player.hp=Math.max(0,e.player.hp-o),G(e,`${t.name} uses ${r.name}: ${o} damage, drains ${i} mana!`,`damage`);continue}let i=r.damage,a=Math.max(0,i-n);e.player.hp=Math.max(0,e.player.hp-a),G(e,`${t.name} casts ${r.name}: ${a} damage${n>0?` (${n} blocked)`:``}`,`damage`)}else{let r=1;t.behavior===`aggressive`&&(r=1.2),t.behavior===`defensive`&&(r=.8);let i=Math.max(1,Math.floor(t.attack*r)-Math.floor(e.player.defense*.3)),a=Math.max(0,i-n);e.player.hp=Math.max(0,e.player.hp-a);let o=t.behavior===`aggressive`?` (aggressive!)`:t.behavior===`defensive`?` (cautiously)`:``;G(e,`${t.name} attacks${o}: ${a} damage${n>0?` (${n} blocked)`:``}`,`damage`)}}}function Bn(e,t){if(e.type===`spell`){let n=t.player.equippedSpells.find(t=>t&&t.id===e.id);if(n?.effect?.type===`heal`)return`Heal when low`;for(let e of t.combatState?.enemies||[])if(e.hp>0&&e.weaknesses.some(e=>n?.elements.includes(e)))return`Target weakness`;return`Highest damage`}return`Physical fallback`}function Vn(e){if(!e.combatState)return!0;let t=e.combatState.enemies.every(e=>e.hp<=0),n=e.player.hp<=0;if(t){e.combatState.combatOver=!0,e.combatState.result=`victory`;let t=0,n=0;for(let r of e.combatState.enemies){t+=r.xpReward,n+=r.goldReward;for(let t of r.loot||[])if(Math.random()<t.chance){if(t.itemId.startsWith(`rune-`)){let n=e.player.discoveredRunes.find(e=>e.id===t.itemId);n&&!n.discovered&&(n.discovered=!0,G(e,`Discovered rune: ${n.name}!`,`info`),Pn(e,`Discovered: ${n.name}!`,`reward`))}else if(M[t.itemId]){let n=M[t.itemId]();e.player.inventory.push({id:n.id,name:n.name,category:`equipment`,description:n.description,value:n.value,quantity:1,icon:`game-icons:chest-armor`}),G(e,`Looted: ${n.name}!`,`info`)}else if(j[t.itemId]){let n=j[t.itemId](),r=e.player.inventory.find(e=>e.name===n.name);r?r.quantity++:e.player.inventory.push(n),G(e,`Looted: ${n.name}!`,`info`)}}}for(e.player.xp+=t,e.player.gold+=n,G(e,`Victory! Gained ${t} XP and ${n} gold.`,`info`);e.player.xp>=e.player.xpToNext;)e.player.xp-=e.player.xpToNext,e.player.level++,e.player.xpToNext=Math.floor(e.player.xpToNext*1.4),e.player.maxHp+=8,e.player.hp=Math.min(e.player.hp+8,e.player.maxHp),e.player.maxMana+=4,e.player.mana=Math.min(e.player.mana+4,e.player.maxMana),e.player.maxStamina+=3,e.player.stamina=Math.min(e.player.stamina+3,e.player.maxStamina),e.player.attack+=1,e.player.defense+=1,e.player.skillPoints+=1,G(e,`LEVEL UP! You are now level ${e.player.level}! +1 Skill Point`,`info`),Pn(e,`Level ${e.player.level}! +8 HP, +4 Mana, +3 Stamina, +1 Skill Point`,`reward`);return e.player.stamina=Math.min(e.player.maxStamina,e.player.stamina+5),!0}return n?(e.combatState.combatOver=!0,e.combatState.result=`defeat`,G(e,`You have been defeated...`,`info`),!0):!1}function Hn(){L(e=>{e.combatState&&(e.combatState.isAutoResolving=!0,e.paused=!1)}),Un()}function Un(){let e=I();if(!e.combatState||e.combatState.combatOver||e.paused){K&&clearTimeout(K),K=null;return}Kn(),e.combatState.combatOver||(K=window.setTimeout(Un,e.combatState.autoSpeed))}function Wn(){L(e=>{e.paused=!0,e.combatState&&(e.combatState.isAutoResolving=!1)}),K&&=(clearTimeout(K),null)}function Gn(){L(e=>{e.paused=!1,e.combatState&&(e.combatState.isAutoResolving=!0)}),Un()}function Kn(){L(e=>{!e.combatState||e.combatState.combatOver||(e.combatState.turn++,G(e,`--- Turn ${e.combatState.turn} ---`,`info`),Ln(e),!Vn(e)&&(Rn(e),!Vn(e)&&(zn(e),Vn(e))))})}function qn(){K&&=(clearTimeout(K),null),L(e=>{if(e.combatState)if(e.combatState.result===`victory`){let t=e.floors[e.currentFloor].rooms.find(t=>t.id===e.currentRoomId);if(t&&(t.cleared=!0,t.type===`boss`&&e.currentFloor<e.floors.length-1&&(e.floors[e.currentFloor+1].unlocked=!0,Pn(e,`Floor ${e.currentFloor+2} unlocked!`,`reward`)),t.type===`boss`&&e.currentFloor===e.floors.length-1)){e.screen=`victory`,e.combatState=null,F(e);return}e.screen=`exploration`,e.combatState=null,F(e)}else e.combatState.result===`defeat`&&(e.screen=`gameover`,e.combatState=null)})}function Jn(){K&&=(clearTimeout(K),null),L(e=>{e.combatState=null,e.screen=`exploration`,e.paused=!1,Pn(e,`Fled from combat!`,`info`)})}function Yn(e){L(t=>{t.combatState&&(t.combatState.autoSpeed=e)})}var K,Xn=e((()=>{z(),cn(),K=null}));function Zn(e){L(t=>{let n=t.floors[t.currentFloor],r=n.rooms.find(e=>e.id===t.currentRoomId),i=n.rooms.find(t=>t.id===e);if(!(!r||!i)&&r.connections.includes(e)){t.currentRoomId=e,i.discovered=!0,t.roomTransitions++;for(let e of i.connections){let t=n.rooms.find(t=>t.id===e);t&&(t.discovered=!0)}t.notifications.push({text:`Entered: ${i.name}`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3}),Qn(t,i)}})}function Qn(e,t){switch(t.type){case`combat`:case`training`:(!t.cleared||t.type===`training`)&&((!t.enemies||t.enemies.length===0)&&$n(e,t),t.enemies&&t.enemies.length>0&&(e.screen=`exploration`));break;case`elite`:t.cleared||(e.screen=`exploration`);break;case`boss`:t.cleared||(e.screen=`exploration`);break;case`forge`:e.screen=`exploration`;break;case`rest`:e.screen=`exploration`;break;case`merchant`:e.screen=`exploration`;break;case`event`:t.npc&&!t.npc.met?(e.dialogueState={npcId:t.npc.id,currentNodeId:`start`},e.screen=`dialogue`):t.eventData&&!t.cleared?e.screen=`event`:e.screen=`exploration`;break}}function $n(e,t){let n=e.currentFloor===0?k:A;if(t.type===`training`){t.enemies=[{id:`dummy-`+Math.random().toString(36).slice(2,6),name:`Training Dummy`,hp:999,maxHp:999,attack:1,defense:0,resistances:{},weaknesses:[],traits:{aggression:0,compassion:0,arcaneAffinity:0,cunning:0,resilience:1},xpReward:2,goldReward:0,icon:`game-icons:armor-punch`,behavior:`territorial`,loot:[]}];return}let r=Object.values(n).filter(e=>{let t=e();return t.name!==`The Stone King`&&t.name!==`The Void Empress`&&t.name!==`Crystal Guardian`&&t.name!==`Void Weaver`});if(r.length>0){let e=1+Math.floor(Math.random()*2);t.enemies=[];for(let n=0;n<e;n++){let e=r[Math.floor(Math.random()*r.length)];t.enemies.push(e())}}}function er(e){L(t=>{if(e<0||e>=t.floors.length||!t.floors[e].unlocked)return;t.currentFloor=e;let n=t.floors[e],r=n.rooms[0];t.currentRoomId=r.id,r.discovered=!0;for(let e of r.connections){let t=n.rooms.find(t=>t.id===e);t&&(t.discovered=!0)}t.screen=`exploration`,t.roomTransitions++,F(t)})}function q(e){return e.floors[e.currentFloor]?.rooms.find(t=>t.id===e.currentRoomId)}var tr=e((()=>{z(),sn()}));function nr(e){return e.player.discoveredRunes.filter(e=>e.discovered)}function rr(e,t,n){if(new Set(e).size!==e.length||e.length<1)return null;let r=e.map(e=>n.player.discoveredRunes.find(t=>t.id===e&&t.discovered)).filter(e=>e!==null);if(r.length===0)return null;let i=r.map(e=>e.element),a;if(t){let e=n.player.knownSpells.find(e=>e.id===t);if(e){a=e.name;for(let t of e.elements)i.includes(t)||i.push(t)}}let o=Qt(i,a),s=$t(i,n.player.affinities),c=en(i),l;return i.includes(`fire`)&&i.includes(`nature`)?l={type:`dot`,value:Math.floor(s*.3),duration:3}:i.includes(`ice`)&&i.includes(`shadow`)?l={type:`stun`,value:1,duration:1}:i.includes(`nature`)&&i.includes(`arcane`)?l={type:`heal`,value:Math.floor(s*.6)}:i.includes(`lightning`)&&i.includes(`fire`)?l={type:`burst`,value:Math.floor(s*.4)}:i.includes(`shadow`)&&i.includes(`arcane`)?l={type:`drain`,value:Math.floor(s*.3)}:i.includes(`ice`)&&i.length>1?l={type:`debuff`,value:3,duration:2}:i.includes(`fire`)?l={type:`dot`,value:Math.floor(s*.2),duration:2}:i.includes(`nature`)&&(l={type:`heal`,value:Math.floor(s*.4)}),{id:`spell-crafted-`+Math.random().toString(36).slice(2,8),name:o,elements:i,runeIds:e,damage:l?.type===`heal`?0:s,manaCost:c,effect:l,affinity:0,isCrafted:!0,ingredients:[...e,...t?[t]:[]]}}function ir(e){L(t=>{t.player.knownSpells.push(e);let n=t.player.equippedSpells.findIndex(e=>e===null);n!==-1&&(t.player.equippedSpells[n]=e),t.notifications.push({text:`Crafted: ${e.name} (${e.elements.join(`+`)}${e.effect?` - `+e.effect.type:``})!`,type:`reward`,id:t.nextNotifId++,expires:Date.now()+5e3})})}function ar(e,t){let n=[];return t>=15&&n.push(`${e} spells deal +2 damage`),t>=30&&n.push(`Unlock ${e} combo recipes`),t>=50&&n.push(`${e} spells cost -1 mana`),t>=75&&n.push(`${e} DoT/effects +50% duration`),t>=100&&n.push(`Master of ${e}: all bonuses doubled`),n}var or=e((()=>{z(),on()}));function sr(e,...t){switch(e){case`newGame`:xn(),Sn(yn());break;case`continue`:{let e=bn();e&&Sn(e);break}case`moveToRoom`:Zn(t[0]);break;case`moveToFloor`:er(t[0]);break;case`startCombat`:{let e=q(I());e?.enemies&&Nn(e.enemies);break}case`autoResolve`:Hn();break;case`pause`:Wn();break;case`resume`:Gn();break;case`endCombat`:qn();break;case`setSpeed`:Yn(t[0]);break;case`flee`:Jn();break;case`overlay`:Z=t[0],J();break;case`charTab`:Q=t[0],J();break;case`merchantTab`:$=t[0],J();break;case`toggleRune`:cr(t[0]);break;case`toggleSpellIngredient`:X=X===t[0]?null:t[0],J();break;case`craftSpell`:lr();break;case`rest`:ur();break;case`useItem`:dr(t[0]);break;case`buyItem`:fr(t[0]);break;case`sellItem`:pr(t[0]);break;case`equipItem`:mr(t[0]);break;case`unequipSlot`:hr(t[0]);break;case`equipSpell`:_r(t[0],t[1]);break;case`unequipSpell`:vr(t[0]);break;case`equipSkill`:yr(t[0],t[1]);break;case`unequipSkill`:br(t[0]);break;case`togglePolicy`:xr(t[0]);break;case`unlockSkillNode`:Sr(t[0]);break;case`dialogueChoice`:Cr(t[0]);break;case`eventChoice`:wr(t[0]);break;case`returnToExploration`:L(e=>{e.screen=`exploration`});break;case`openForge`:Y=[],X=null,L(e=>{e.screen=`forge`});break;case`openDialogue`:{let e=q(I());e?.npc&&L(t=>{t.dialogueState={npcId:e.npc.id,currentNodeId:`start`},t.screen=`dialogue`});break}case`openEvent`:L(e=>{e.screen=`event`});break;case`backToTitle`:{let e=yn();e.screen=`title`,Sn(e);break}case`training`:{let e=q(I());e?.enemies&&Nn(e.enemies);break}}}function cr(e){let t=Y.indexOf(e);t>=0?Y.splice(t,1):Y.length<3&&Y.push(e),J()}function lr(){let e=I(),t=rr(Y,X,e);t&&(ir(t),Y=[],X=null)}function ur(){L(e=>{let t=Math.floor(e.player.maxHp*.4),n=Math.floor(e.player.maxMana*.5),r=Math.floor(e.player.maxStamina*.6);e.player.hp=Math.min(e.player.maxHp,e.player.hp+t),e.player.mana=Math.min(e.player.maxMana,e.player.mana+n),e.player.stamina=Math.min(e.player.maxStamina,e.player.stamina+r);let i=q(e);i&&(i.cleared=!0),e.notifications.push({text:`Rested: +${t} HP, +${n} Mana, +${r} Stamina`,type:`info`,id:e.nextNotifId++,expires:Date.now()+4e3}),F(e)})}function dr(e){L(t=>{let n=t.player.inventory.find(t=>t.id===e);!n||!n.effect||(n.effect.type===`heal-hp`?(t.player.hp=Math.min(t.player.maxHp,t.player.hp+n.effect.value),t.notifications.push({text:`Used ${n.name}: +${n.effect.value} HP`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})):n.effect.type===`heal-mana`?(t.player.mana=Math.min(t.player.maxMana,t.player.mana+n.effect.value),t.notifications.push({text:`Used ${n.name}: +${n.effect.value} Mana`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})):n.effect.type===`heal-stamina`&&(t.player.stamina=Math.min(t.player.maxStamina,t.player.stamina+n.effect.value),t.notifications.push({text:`Used ${n.name}: +${n.effect.value} Stamina`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})),n.quantity--,n.quantity<=0&&(t.player.inventory=t.player.inventory.filter(t=>t.id!==e)))})}function fr(e){L(t=>{let n=q(t);if(!n?.merchantStock)return;let r=n.merchantStock[e];if(!r)return;let i=r.value||10;if(t.player.gold<i){t.notifications.push({text:`Not enough gold!`,type:`danger`,id:t.nextNotifId++,expires:Date.now()+3e3});return}if(t.player.gold-=i,r.slot)t.player.inventory.push({id:r.id+`-`+Math.random().toString(36).slice(2,6),name:r.name,category:`equipment`,description:r.description,value:r.value,quantity:1,icon:`game-icons:chest-armor`});else if(r.element){let e=t.player.discoveredRunes.find(e=>e.id===r.id);e&&(e.discovered=!0)}else{let e=t.player.inventory.find(e=>e.name===r.name);e?e.quantity++:t.player.inventory.push({...r,id:r.id+`-`+Math.random().toString(36).slice(2,6)})}n.merchantStock.splice(e,1),t.notifications.push({text:`Bought ${r.name} for ${i}g`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})})}function pr(e){L(t=>{let n=t.player.inventory.find(t=>t.id===e);if(!n)return;let r=Math.floor(n.value*.5);t.player.gold+=r,n.quantity--,n.quantity<=0&&(t.player.inventory=t.player.inventory.filter(t=>t.id!==e)),t.notifications.push({text:`Sold ${n.name} for ${r}g`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})})}function mr(e){L(t=>{let n=t.player.inventory.find(t=>t.id===e);if(!n)return;let r=Object.values(M).map(e=>e()).find(e=>e.name===n.name);if(!r)return;let i=t.player.equipment[r.slot];i&&(t.player.inventory.push({id:i.id+`-inv`,name:i.name,category:`equipment`,description:i.description,value:i.value,quantity:1}),gr(t,i,!1)),t.player.equipment[r.slot]=r,gr(t,r,!0),n.quantity--,n.quantity<=0&&(t.player.inventory=t.player.inventory.filter(t=>t.id!==e)),t.notifications.push({text:`Equipped ${r.name}`,type:`info`,id:t.nextNotifId++,expires:Date.now()+3e3})})}function hr(e){L(t=>{let n=t.player.equipment[e];n&&(t.player.inventory.push({id:n.id+`-inv`,name:n.name,category:`equipment`,description:n.description,value:n.value,quantity:1}),gr(t,n,!1),t.player.equipment[e]=null)})}function gr(e,t,n){let r=n?1:-1;t.stats.attack&&(e.player.attack+=t.stats.attack*r),t.stats.defense&&(e.player.defense+=t.stats.defense*r),t.stats.maxHp&&(e.player.maxHp+=t.stats.maxHp*r,n?e.player.hp+=t.stats.maxHp:e.player.hp=Math.min(e.player.hp,e.player.maxHp)),t.stats.maxMana&&(e.player.maxMana+=t.stats.maxMana*r,n?e.player.mana+=t.stats.maxMana:e.player.mana=Math.min(e.player.mana,e.player.maxMana)),t.stats.maxStamina&&(e.player.maxStamina+=t.stats.maxStamina*r,n?e.player.stamina+=t.stats.maxStamina:e.player.stamina=Math.min(e.player.stamina,e.player.maxStamina))}function _r(e,t){L(n=>{let r=n.player.knownSpells.find(e=>e.id===t);r&&e>=0&&e<n.player.equippedSpells.length&&(n.player.equippedSpells[e]=r)})}function vr(e){L(t=>{e>=0&&e<t.player.equippedSpells.length&&(t.player.equippedSpells[e]=null)})}function yr(e,t){L(n=>{let r=n.player.knownSkills.find(e=>e.id===t);r&&e>=0&&e<n.player.equippedSkills.length&&(n.player.equippedSkills[e]=r)})}function br(e){L(t=>{e>=0&&e<t.player.equippedSkills.length&&(t.player.equippedSkills[e]=null)})}function xr(e){L(t=>{let n=t.player.actionPolicies.find(t=>t.id===e);n&&(n.enabled=!n.enabled)})}function Sr(e){L(t=>{let n=t.player.skillTree.find(t=>t.id===e);if(!n||n.unlocked)return;if(t.player.skillPoints<n.cost){t.notifications.push({text:`Not enough skill points!`,type:`danger`,id:t.nextNotifId++,expires:Date.now()+3e3});return}if(n.requires)for(let e of n.requires){let n=t.player.skillTree.find(t=>t.id===e);if(!n?.unlocked){t.notifications.push({text:`Requires: ${n?.name||e}`,type:`danger`,id:t.nextNotifId++,expires:Date.now()+3e3});return}}t.player.skillPoints-=n.cost,n.unlocked=!0;let r={"skill-power-strike":{id:`skill-power-strike`,name:`Power Strike`,staminaCost:8,damage:15,level:1,xpToNext:30,currentXp:0},"skill-whirlwind":{id:`skill-whirlwind`,name:`Whirlwind`,staminaCost:10,damage:10,level:1,xpToNext:40,currentXp:0},"skill-iron-wall":{id:`skill-iron-wall`,name:`Iron Wall`,staminaCost:6,damage:0,effect:{type:`shield`,value:15,duration:2},level:1,xpToNext:30,currentXp:0},"skill-counter":{id:`skill-counter`,name:`Counter`,staminaCost:7,damage:0,effect:{type:`reflect`,value:.5},level:1,xpToNext:35,currentXp:0},"skill-drain-strike":{id:`skill-drain-strike`,name:`Drain Strike`,staminaCost:8,damage:10,effect:{type:`heal`,value:5},level:1,xpToNext:35,currentXp:0},"skill-focus":{id:`skill-focus`,name:`Focus`,staminaCost:5,damage:0,effect:{type:`buff`,value:1.5},level:1,xpToNext:25,currentXp:0}}[n.skillId];r&&(t.player.knownSkills.push(r),t.notifications.push({text:`Unlocked: ${r.name}!`,type:`reward`,id:t.nextNotifId++,expires:Date.now()+4e3}))})}function Cr(e){L(t=>{if(!t.dialogueState)return;let n=t.floors[t.currentFloor].rooms.find(e=>e.id===t.currentRoomId);if(!n?.npc)return;let r=n.npc,i=r.dialogue.find(e=>e.id===t.dialogueState.currentNodeId);if(!i)return;let a=i.choices[e];if(a){if(a.traitShift)for(let[e,n]of Object.entries(a.traitShift)){let r=e;t.player.traits[r]=Math.max(0,Math.min(1,t.player.traits[r]+(n||0))),n&&n!==0&&t.notifications.push({text:`${n>0?`+`:``}${n.toFixed(2)} ${e}`,type:`trait`,id:t.nextNotifId++,expires:Date.now()+3e3})}a.effect&&a.effect(t),a.nextId?t.dialogueState.currentNodeId=a.nextId:(r.met=!0,n.cleared=!0,t.dialogueState=null,t.screen=`exploration`,F(t))}})}function wr(e){L(t=>{let n=q(t);if(!n?.eventData)return;let r=n.eventData.choices[e];r&&(r.effect(t),n.cleared=!0,t.notifications.push({text:r.resultText,type:`info`,id:t.nextNotifId++,expires:Date.now()+4e3}),t.screen=`exploration`,F(t))})}function J(){let e=I();if(!e)return;let t=document.getElementById(`app`),n=document.getElementById(`combat-log`),r=n?n.scrollTop+n.clientHeight>=n.scrollHeight-20:!0,i=Date.now();e.notifications=e.notifications.filter(e=>e.expires>i),e.gameTime=i-e.gameStartTime;let a=``;if(e.screen===`title`||!e.screen?a=Tr():e.screen===`gameover`?a=Wr(e):e.screen===`victory`?a=Gr(e):(a=Er(e),a+=`<div class="game-layout">`,a+=`<div class="main-panel">`,e.screen===`combat`?a+=kr(e):e.screen===`forge`?a+=Ar(e):e.screen===`dialogue`?a+=jr(e):e.screen===`event`?a+=Mr(e):a+=Dr(e),a+=`</div>`,a+=Nr(e),a+=`</div>`,Z!==`none`&&(a+=Fr(e))),a+=Ur(e),t.innerHTML=a,r){let e=document.getElementById(`combat-log`);e&&(e.scrollTop=e.scrollHeight)}}function Tr(){let e=!!localStorage.getItem(`escape-dungeon-save`);return`
    <div class="title-screen">
      <div style="font-size:64px;margin-bottom:20px">${B(`game-icons:dungeon-gate`,80)}</div>
      <h1>Escape the Dungeon</h1>
      <p class="subtitle">A roguelike of ingenuity and spell craft</p>
      <div style="display:flex;gap:12px;margin-top:20px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('newGame')">${B(`game-icons:crossed-swords`,18)} New Game</button>
        ${e?`<button class="btn btn-lg" onclick="gameAction('continue')">${B(`game-icons:save`,18)} Continue</button>`:``}
      </div>
      <div style="color:var(--text-dim);margin-top:40px;font-size:12px;max-width:500px;text-align:center">
        <p>Craft spells from discovered runes. Configure action policies for auto-combat.</p>
        <p style="margin-top:8px">Starter spells won't cut it. You must craft to survive.</p>
      </div>
    </div>
  `}function Er(e){let t=e.player,n=e.floors[e.currentFloor],r=Math.floor(e.gameTime/6e4),i=Math.floor(r/60),a=r%60,o=`Day ${i+1}, ${a<30?`Morning`:`Evening`}`;return`
    <div class="hud">
      <div class="hud-section">
        ${B(`game-icons:person`,16)}
        <span class="hud-value">${t.name} Lv.${t.level}</span>
      </div>
      <div class="hud-section">
        <span class="hud-label">HP</span>
        ${V(t.hp,t.maxHp,`hp-bar`)}
      </div>
      <div class="hud-section">
        <span class="hud-label">MP</span>
        ${V(t.mana,t.maxMana,`mana-bar`)}
      </div>
      <div class="hud-section">
        <span class="hud-label">STA</span>
        ${V(t.stamina,t.maxStamina,`stamina-bar`,`80px`)}
      </div>
      <div class="hud-section">
        <span class="hud-label">XP</span>
        ${V(t.xp,t.xpToNext,`xp-bar`,`70px`)}
      </div>
      <div class="hud-section">
        ${B(`game-icons:two-coins`,14)}
        <span class="hud-value" style="color:var(--gold)">${t.gold}</span>
      </div>
      <div class="hud-section">
        <span class="hud-label">${B(`game-icons:stairs`,14)} Floor</span>
        <span class="hud-value">${n.name}</span>
      </div>
      <div class="hud-section game-clock">
        ${B(`game-icons:sun`,14)} ${o}
      </div>
      <div style="flex:1"></div>
      <div class="hud-section" style="gap:4px">
        <button class="btn btn-sm" onclick="gameAction('overlay','map')">${B(`game-icons:treasure-map`,14)} Map</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','inventory')">${B(`game-icons:swap-bag`,14)} Bag</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','character')">${B(`game-icons:character`,14)} Stats</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','spellbook')">${B(`game-icons:spell-book`,14)} Spells</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','loadout')">${B(`game-icons:battle-gear`,14)} Loadout</button>
        <button class="btn btn-sm" onclick="gameAction('overlay','policies')">${B(`game-icons:brain`,14)} Policies</button>
      </div>
    </div>
  `}function Dr(e){let t=q(e);if(!t)return`<div class="room-content">No room found</div>`;let n=e.floors[e.currentFloor],r=W(t.type),i=``;i+=`<div class="floor-tabs">`;for(let t of e.floors){let n=t.id-1===e.currentFloor?`active`:t.unlocked?``:`locked`;i+=`<button class="floor-tab ${n}" ${t.unlocked&&t.id-1!==e.currentFloor?`onclick="gameAction('moveToFloor',${t.id-1})"`:``}>${t.name}${t.unlocked?``:` (Locked)`}</button>`}if(i+=`</div>`,i+=`
    <div class="room-header">
      <div class="room-icon" style="border-color:${r}">
        ${B(t.icon,32)}
      </div>
      <div class="room-info">
        <h2>${t.name}</h2>
        <span class="room-type" style="color:${r}">${t.type.toUpperCase()}${t.cleared?` - CLEARED`:``}</span>
      </div>
    </div>
    <div class="room-description">${t.description}</div>
  `,i+=`<div class="room-content">`,t.type===`combat`||t.type===`elite`||t.type===`boss`)if(!t.cleared&&t.enemies&&t.enemies.length>0){i+=`<div class="section-title">Enemies</div>`,i+=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">`;for(let e of t.enemies)i+=`
          <div style="text-align:center;padding:12px;background:var(--bg-panel);border-radius:8px;border:1px solid var(--border);min-width:120px">
            <div style="font-size:32px;margin-bottom:4px">${B(e.icon,32)}</div>
            <div style="font-weight:600;font-size:13px">${e.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">HP: ${e.hp} | ATK: ${e.attack} | DEF: ${e.defense}</div>
            ${e.weaknesses.length>0?`<div style="margin-top:4px">${e.weaknesses.map(e=>Dn(e)).join(` `)}<span style="font-size:10px;color:var(--text-dim)"> weak</span></div>`:``}
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${e.behavior}</div>
          </div>
        `;i+=`</div>`,t.type===`boss`&&(i+=`<div style="color:var(--warning);font-size:12px;margin-bottom:8px">${B(`game-icons:warning-sign`,14)} ${n.mechanicalConstraint}</div>`)}else i+=`<p style="color:var(--text-dim)">This area has been cleared.</p>`;if(t.type===`training`&&(i+=`<p style="margin-bottom:8px">Practice against training dummies to build spell affinity. Low XP, no loot, but safe casting.</p>`),t.type===`forge`){i+=`<p style="margin-bottom:8px">The forge glows with ancient power. Combine runes to craft new spells.</p>`,i+=`<div class="section-title">Rune Affinities</div>`;for(let t of[`fire`,`ice`,`lightning`,`shadow`,`nature`,`arcane`]){let n=e.player.affinities[t]||0,r=ar(t,n);i+=`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${B(H(t),16)}
          <span style="width:70px;font-size:12px;color:${U(t)}">${t}</span>
          ${V(n,100,`affinity-bar`,`80px`)}
          <span style="font-size:11px;color:var(--text-dim)">${n}/100</span>
          ${r.length>0?`<span style="font-size:10px;color:var(--success)">${r[r.length-1]}</span>`:``}
        </div>
      `}}t.type===`rest`&&(i+=`<p style="margin-bottom:8px">A peaceful spot to recover your strength. Rest restores 40% HP, 50% Mana, 60% Stamina.</p>`,i+=`<p style="font-size:12px;color:var(--text-dim)">You can also change your loadout here.</p>`),t.type===`merchant`&&t.merchantStock&&(i+=Or(e,t)),t.npc&&t.type===`event`&&(t.npc.met?i+=`<p style="color:var(--text-dim)">You've already spoken with ${t.npc.name}.</p>`:i+=`<p>${t.npc.name} awaits.</p>`),t.eventData&&t.type===`event`&&!t.npc&&t.cleared&&(i+=`<p style="color:var(--text-dim)">You have already made your choice here.</p>`),i+=`</div>`,i+=`<div class="room-actions">`,(t.type===`combat`||t.type===`elite`||t.type===`boss`)&&!t.cleared&&t.enemies&&t.enemies.length>0&&(i+=`<button class="btn btn-primary" onclick="gameAction('startCombat')">${B(`game-icons:crossed-swords`,16)} Engage Combat</button>`),t.type===`training`&&(i+=`<button class="btn btn-primary" onclick="gameAction('training')">${B(`game-icons:training`,16)} Train (Combat Dummy)</button>`),t.type===`forge`&&(i+=`<button class="btn btn-primary" onclick="gameAction('openForge')">${B(`game-icons:anvil`,16)} Open Forge</button>`),t.type===`rest`&&(i+=`<button class="btn btn-success" onclick="gameAction('rest')">${B(`game-icons:campfire`,16)} Rest</button>`,i+=`<button class="btn" onclick="gameAction('overlay','loadout')">${B(`game-icons:battle-gear`,16)} Change Loadout</button>`),t.npc&&t.type===`event`&&!t.npc.met&&(i+=`<button class="btn btn-primary" onclick="gameAction('openDialogue')">${B(`game-icons:talk`,16)} Talk to ${t.npc.name}</button>`),t.eventData&&!t.cleared&&!t.npc&&(i+=`<button class="btn btn-primary" onclick="gameAction('openEvent')">${B(`game-icons:scroll-unfurled`,16)} Investigate</button>`);let a=t.connections.map(e=>n.rooms.find(t=>t.id===e)).filter(e=>e!==null);if(a.length>0){i+=`<div style="flex:1"></div>`;for(let e of a){let t=W(e.type);i+=`<button class="btn btn-sm" style="border-color:${t}" onclick="gameAction('moveToRoom','${e.id}')">${B(e.icon,14)} ${e.name}${e.cleared?` *`:``}</button>`}}return i+=`</div>`,i}function Or(e,t){let n=`<div class="section-title">Merchant</div>`;if(n+=`<div style="margin-bottom:8px">
    <button class="btn btn-sm ${$===`buy`?`btn-primary`:``}" onclick="gameAction('merchantTab','buy')">Buy</button>
    <button class="btn btn-sm ${$===`sell`?`btn-primary`:``}" onclick="gameAction('merchantTab','sell')">Sell</button>
  </div>`,$===`buy`&&t.merchantStock){for(let r=0;r<t.merchantStock.length;r++){let i=t.merchantStock[r],a=e.player.gold>=(i.value||10);n+=`
        <div class="merchant-item">
          <div style="font-size:20px">${B(i.icon||`game-icons:swap-bag`,20)}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px">${i.name}</div>
            <div style="font-size:11px;color:var(--text-dim)">${i.description||``}</div>
          </div>
          <div style="color:var(--gold);font-weight:600">${i.value||10}g</div>
          <button class="btn btn-sm btn-success" ${a?``:`disabled`} onclick="gameAction('buyItem',${r})">Buy</button>
        </div>
      `}t.merchantStock.length===0&&(n+=`<p style="color:var(--text-dim)">Sold out!</p>`)}if($===`sell`){for(let t of e.player.inventory){let e=Math.floor(t.value*.5);n+=`
        <div class="merchant-item">
          <div style="font-size:20px">${B(t.icon||`game-icons:swap-bag`,20)}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:12px">${t.name} ${t.quantity>1?`x`+t.quantity:``}</div>
          </div>
          <div style="color:var(--gold)">${e}g</div>
          <button class="btn btn-sm" onclick="gameAction('sellItem','${t.id}')">Sell</button>
        </div>
      `}e.player.inventory.length===0&&(n+=`<p style="color:var(--text-dim)">Nothing to sell.</p>`)}return n}function kr(e){if(!e.combatState)return``;let t=e.combatState,n=e.player,r=``;r+=`<div class="combat-arena">`,r+=`
    <div class="combat-side player-side">
      <div class="combat-entity">
        <div class="entity-portrait player-portrait">${B(`game-icons:mage-staff`,36)}</div>
        <div class="entity-name" style="color:var(--mana-bar)">${n.name}</div>
        <div class="entity-hp">${V(n.hp,n.maxHp,`hp-bar`,`120px`)}</div>
        <div style="margin-top:4px">${V(n.mana,n.maxMana,`mana-bar`,`100px`)}</div>
        <div style="margin-top:4px">${V(n.stamina,n.maxStamina,`stamina-bar`,`80px`)}</div>
      </div>
    </div>
  `,r+=`<div class="combat-vs">VS</div>`,r+=`<div class="combat-side enemy-side">`;for(let e of t.enemies){let t=e.hp<=0;r+=`
      <div class="combat-entity" style="${t?`opacity:0.3`:``}">
        <div class="entity-portrait enemy-portrait">${B(e.icon,36)}</div>
        <div class="entity-name" style="color:var(--hp-bar)">${e.name}${t?` (Dead)`:``}</div>
        <div class="entity-hp">${V(Math.max(0,e.hp),e.maxHp,`hp-bar`,`120px`)}</div>
        <div style="font-size:10px;color:var(--text-dim)">
          ${e.weaknesses.map(e=>Dn(e)).join(` `)}
          <span style="margin-left:4px">${e.behavior}</span>
        </div>
      </div>
    `}r+=`</div>`,r+=`</div>`,r+=`<div class="combat-log" id="combat-log">`;for(let t of e.combatLog.slice(-30))r+=`<div class="log-${t.type}">${t.text}</div>`;return r+=`</div>`,r+=`<div class="combat-controls">`,t.combatOver?r+=`<button class="btn btn-primary btn-lg" onclick="gameAction('endCombat')">${t.result===`victory`?B(`game-icons:trophy`,18)+` Collect Rewards`:B(`game-icons:skull`,18)+` Accept Defeat`}</button>`:e.paused?(r+=`<button class="btn btn-primary" onclick="gameAction('resume')">${B(`game-icons:play-button`,16)} Resume</button>`,r+=`<button class="btn" onclick="gameAction('overlay','loadout')">${B(`game-icons:battle-gear`,16)} Adjust Loadout</button>`,r+=`<button class="btn" onclick="gameAction('overlay','policies')">${B(`game-icons:brain`,16)} Adjust Policies</button>`,r+=`<button class="btn" onclick="gameAction('overlay','inventory')">${B(`game-icons:swap-bag`,16)} Use Items</button>`,r+=`<button class="btn btn-danger" onclick="gameAction('flee')">${B(`game-icons:run`,16)} Flee</button>`):t.isAutoResolving?r+=`<button class="btn" onclick="gameAction('pause')">${B(`game-icons:pause-button`,16)} Pause</button>`:r+=`<button class="btn btn-primary" onclick="gameAction('autoResolve')">${B(`game-icons:play-button`,16)} Start Auto-Combat</button>`,t.combatOver||(r+=`<span class="speed-label">Speed:</span>`,r+=`<button class="btn btn-sm ${t.autoSpeed===1200?`btn-primary`:``}" onclick="gameAction('setSpeed',1200)">Slow</button>`,r+=`<button class="btn btn-sm ${t.autoSpeed===800?`btn-primary`:``}" onclick="gameAction('setSpeed',800)">Normal</button>`,r+=`<button class="btn btn-sm ${t.autoSpeed===400?`btn-primary`:``}" onclick="gameAction('setSpeed',400)">Fast</button>`,r+=`<button class="btn btn-sm ${t.autoSpeed===150?`btn-primary`:``}" onclick="gameAction('setSpeed',150)">Ultra</button>`),r+=`</div>`,r}function Ar(e){nr(e);let t=e.player.discoveredRunes,n=`
    <div class="room-header">
      <div class="room-icon" style="border-color:var(--fire)">${B(`game-icons:anvil`,32)}</div>
      <div class="room-info">
        <h2>Rune Forge</h2>
        <span class="room-type" style="color:var(--fire)">CRAFT SPELLS</span>
      </div>
    </div>
  `;n+=`<div class="room-content">`,n+=`<div class="section-title">Select Runes (1-3, unique only)</div>`,n+=`<div class="forge-grid">`;for(let e of t){let t=Y.includes(e.id),r=!e.discovered;n+=`
      <div class="rune-card ${t?`selected`:``} ${r?`locked`:``}"
        ${r?``:`onclick="gameAction('toggleRune','${e.id}')"`}>
        <div style="font-size:24px">${B(H(e.element),24)}</div>
        <div style="font-weight:600;font-size:12px;color:${U(e.element)}">${r?`???`:e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${r?`Undiscovered`:e.element}</div>
        ${r?``:`<div style="font-size:10px;color:var(--text-dim)">${e.description}</div>`}
      </div>
    `}n+=`</div>`;let r=e.player.knownSpells.filter(e=>e.affinity>=10);if(r.length>0){n+=`<div class="section-title">Spell Ingredient (Optional - needs 10+ affinity)</div>`,n+=`<div class="forge-grid">`;for(let e of r){let t=X===e.id;n+=On(e,t,`gameAction('toggleSpellIngredient','${e.id}')`)}n+=`</div>`}if(Y.length>=1){let t=rr(Y,X,e);t&&(n+=`<div class="section-title">Preview</div>`,n+=`<div style="padding:12px;background:var(--bg-panel);border:1px solid var(--accent);border-radius:8px">
        <div style="font-weight:700;font-size:16px;color:var(--text-bright)">${t.name}</div>
        <div style="margin-top:4px">${t.elements.map(e=>Dn(e)).join(` `)}</div>
        <div style="margin-top:4px;font-size:13px">${t.damage>0?`Damage: `+t.damage:``}${t.effect?` | Effect: `+t.effect.type+(t.effect.value?` (`+t.effect.value+`)`:``):``}</div>
        <div style="font-size:12px;color:var(--text-dim)">Mana cost: ${t.manaCost}</div>
      </div>`)}return n+=`</div>`,n+=`<div class="room-actions">`,n+=`<button class="btn btn-primary" ${Y.length<1?`disabled`:``} onclick="gameAction('craftSpell')">${B(`game-icons:anvil`,16)} Craft Spell</button>`,n+=`<button class="btn" onclick="gameAction('returnToExploration')">Back</button>`,n+=`</div>`,n}function jr(e){if(!e.dialogueState)return``;let t=e.floors[e.currentFloor].rooms.find(t=>t.id===e.currentRoomId);if(!t?.npc)return``;let n=t.npc,r=n.dialogue.find(t=>t.id===e.dialogueState.currentNodeId);if(!r)return`<div class="room-content">Dialogue ended.</div>`;let i=`<div class="room-content"><div class="dialogue-box">`;i+=`
    <div class="dialogue-portrait">
      <div class="portrait-icon">${B(n.icon,40)}</div>
      <div>
        <h3>${n.name}</h3>
        <div style="font-size:11px;color:var(--text-dim)">
          ${Object.entries(n.traits).map(([e,t])=>`${e}: ${t.toFixed(1)}`).join(` | `)}
        </div>
      </div>
    </div>
  `,i+=`<div class="dialogue-text">${r.text}</div>`,i+=`<div class="dialogue-choices">`;for(let t=0;t<r.choices.length;t++){let n=r.choices[t];n.condition&&!n.condition(e)||(i+=`<div class="dialogue-choice" onclick="gameAction('dialogueChoice',${t})">${n.text}</div>`)}return i+=`</div></div></div>`,i}function Mr(e){let t=q(e);if(!t?.eventData)return``;let n=`<div class="room-content">`;n+=`<div class="event-text">${t.eventData.text}</div>`,n+=`<div class="event-choices">`;for(let e=0;e<t.eventData.choices.length;e++){let r=t.eventData.choices[e];n+=`<div class="dialogue-choice" onclick="gameAction('eventChoice',${e})">${r.text}</div>`}return n+=`</div></div>`,n}function Nr(e){let t=`<div class="side-panel">`;t+=`<div class="panel-header">`+B(`game-icons:treasure-map`,16)+` Map</div>`,t+=`<div class="panel-body">`,t+=Pr(e),t+=`</div>`,t+=`<div class="panel-header">`+B(`game-icons:spell-book`,16)+` Loadout</div>`,t+=`<div class="panel-body" style="max-height:200px">`,t+=`<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">Spells:</div>`;for(let n of e.player.equippedSpells)n&&(t+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:11px">
        ${B(H(n.elements[0]),14)}
        <span>${n.name}</span>
        <span style="color:var(--text-dim);margin-left:auto">${n.manaCost}mp</span>
      </div>`);t+=`<div style="font-size:11px;color:var(--text-dim);margin:4px 0">Skills:</div>`;for(let n of e.player.equippedSkills)n&&(t+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:11px">
        ${B(`game-icons:sword-brandish`,14)}
        <span>${n.name}</span>
        <span style="color:var(--text-dim);margin-left:auto">${n.staminaCost}sta</span>
      </div>`);return t+=`</div>`,t+=`</div>`,t}function Pr(e){let t=e.floors[e.currentFloor].rooms,n=0,r=0;for(let e of t)n=Math.max(n,e.x),r=Math.max(r,e.y);let i=`<div class="map-grid" style="grid-template-columns:repeat(${n+1}, 48px)">`;for(let a=0;a<=r;a++)for(let r=0;r<=n;r++){let n=t.find(e=>e.x===r&&e.y===a);if(!n){i+=`<div style="width:48px;height:48px"></div>`;continue}let o=n.id===e.currentRoomId,s=!o&&n.discovered&&q(e)?.connections.includes(n.id),c=[`map-cell`,n.discovered?`discovered`:`undiscovered`,o?`current`:``,n.cleared?`cleared`:``,s?`adjacent`:``].join(` `),l=s?`onclick="gameAction('moveToRoom','${n.id}')"`:``;i+=`
        <div class="${c}" ${l} title="${n.discovered?n.name:`???`}" style="border-color:${o?`var(--accent-light)`:n.discovered?W(n.type):`transparent`}">
          ${n.discovered?`<div class="map-cell-icon" style="color:${W(n.type)}">${B(n.icon,18)}</div>`:`?`}
          <div class="map-cell-name" style="font-size:8px">${n.discovered?n.name.split(` `)[0]:``}</div>
          ${o?`<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:var(--accent-light);border-radius:50%;border:1px solid var(--bg-dark)"></div>`:``}
        </div>
      `}return i+=`</div>`,i}function Fr(e){let t=`<div class="overlay">`;switch(t+=`<div class="overlay-header">
    <h2>${Z===`inventory`?`Inventory`:Z===`character`?`Character`:Z===`spellbook`?`Spellbook`:Z===`map`?`Dungeon Map`:Z===`loadout`?`Loadout`:`Action Policies`}</h2>
    <button class="btn" onclick="gameAction('overlay','none')">Close (Esc)</button>
  </div>`,t+=`<div class="overlay-body">`,Z){case`inventory`:t+=Ir(e);break;case`character`:t+=Lr(e);break;case`spellbook`:t+=Rr(e);break;case`map`:t+=zr(e);break;case`loadout`:t+=Vr(e);break;case`policies`:t+=Hr(e);break}return t+=`</div></div>`,t}function Ir(e){let t=e.player,n=``;n+=`<div class="section-title">Equipment</div>`,n+=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">`;for(let e of[`main-hand`,`off-hand`,`body`,`trinket`]){let r=t.equipment[e];n+=`
      <div class="equip-slot ${r?`filled`:``}">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase">${e}</div>
        ${r?`
          <div style="font-size:12px;font-weight:600">${r.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${Object.entries(r.stats).map(([e,t])=>`+${t} ${e}`).join(`, `)}</div>
          <button class="btn btn-sm" style="margin-top:4px" onclick="gameAction('unequipSlot','${e}')">Unequip</button>
        `:`<div style="color:var(--text-dim);font-size:11px">Empty</div>`}
      </div>
    `}if(n+=`</div>`,n+=`<div class="section-title">Bag</div>`,t.inventory.length===0)n+=`<p style="color:var(--text-dim)">Empty.</p>`;else{n+=`<div class="inventory-grid">`;for(let e of t.inventory){let t=e.category===`equipment`,r=e.effect&&(e.effect.type===`heal-hp`||e.effect.type===`heal-mana`||e.effect.type===`heal-stamina`);n+=`
        <div class="item-card">
          <div style="font-size:20px">${B(e.icon||`game-icons:swap-bag`,20)}</div>
          <div style="font-weight:600;font-size:11px">${e.name}${e.quantity>1?` x`+e.quantity:``}</div>
          <div style="font-size:10px;color:var(--text-dim)">${e.description||``}</div>
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:center">
            ${r?`<button class="btn btn-sm btn-success" onclick="gameAction('useItem','${e.id}')">Use</button>`:``}
            ${t?`<button class="btn btn-sm" onclick="gameAction('equipItem','${e.id}')">Equip</button>`:``}
          </div>
        </div>
      `}n+=`</div>`}return n}function Lr(e){let t=e.player,n=``;n+=`<div style="display:flex;gap:4px;margin-bottom:16px">`;for(let e of[`stats`,`traits`,`skills`,`equipment`])n+=`<button class="btn btn-sm ${Q===e?`btn-primary`:``}" onclick="gameAction('charTab','${e}')">${e.charAt(0).toUpperCase()+e.slice(1)}</button>`;if(n+=`</div>`,Q===`stats`){n+=`<div style="max-width:400px">`;let e=[[`Level`,t.level.toString()],[`HP`,`${t.hp}/${t.maxHp}`],[`Mana`,`${t.mana}/${t.maxMana}`],[`Stamina`,`${t.stamina}/${t.maxStamina}`],[`Attack`,t.attack.toString()],[`Defense`,t.defense.toString()],[`XP`,`${t.xp}/${t.xpToNext}`],[`Gold`,t.gold.toString()],[`Skill Points`,t.skillPoints.toString()]];for(let[t,r]of e)n+=`<div class="stat-row"><span class="stat-label">${t}</span><span class="stat-value">${r}</span></div>`;n+=`<div class="section-title">Rune Affinities</div>`;for(let e of[`fire`,`ice`,`lightning`,`shadow`,`nature`,`arcane`]){let r=t.affinities[e]||0;n+=`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${B(H(e),14)}
          <span style="width:70px;font-size:12px;color:${U(e)}">${e}</span>
          ${V(r,100,`affinity-bar`,`60px`)}
          <span style="font-size:11px">${r}</span>
        </div>
      `}n+=`<div class="section-title">Equipment Bonuses</div>`;for(let e of[`main-hand`,`off-hand`,`body`,`trinket`]){let r=t.equipment[e];r&&(n+=`<div class="stat-row"><span class="stat-label">${e}: ${r.name}</span><span class="stat-value">${Object.entries(r.stats).map(([e,t])=>`+${t} ${e}`).join(`, `)}</span></div>`)}n+=`</div>`}if(Q===`traits`){n+=`<div style="max-width:400px">`,n+=`<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Traits shift based on your choices, dialogue, and combat actions.</p>`;for(let[e,r]of Object.entries(t.traits)){let t=r;n+=`
        <div class="trait-row">
          <span style="width:120px;font-size:12px">${e}</span>
          <div class="trait-bar">
            <div class="trait-fill" style="width:${t*100}%;background:${jn(e)}"></div>
          </div>
          <span style="font-size:12px;width:40px;text-align:right">${t.toFixed(2)}</span>
        </div>
      `}n+=`</div>`}if(Q===`skills`){n+=`<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Skill Points: ${t.skillPoints}</p>`,n+=`<div class="skill-tree">`;for(let e of t.skillTree){let r=!e.unlocked&&t.skillPoints>=e.cost&&(!e.requires||e.requires.every(e=>t.skillTree.find(t=>t.id===e)?.unlocked)),i=e.unlocked?`unlocked`:r?`available`:`locked`;n+=`
        <div class="skill-node ${i}" ${r?`onclick="gameAction('unlockSkillNode','${e.id}')"`:``}>
          <div style="font-weight:600;font-size:12px">${e.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${e.description}</div>
          <div style="font-size:10px;margin-top:4px;color:${e.unlocked?`var(--success)`:`var(--accent)`}">
            ${e.unlocked?`UNLOCKED`:`Cost: ${e.cost} SP`}
          </div>
          ${e.requires?`<div style="font-size:9px;color:var(--text-dim)">Requires: ${e.requires.map(e=>t.skillTree.find(t=>t.id===e)?.name||e).join(`, `)}</div>`:``}
        </div>
      `}n+=`</div>`,n+=`<div class="section-title">Known Physical Skills</div>`,n+=`<div class="forge-grid">`;for(let e of t.knownSkills)n+=An(e);n+=`</div>`}return Q===`equipment`?Ir(e):n}function Rr(e){let t=e.player,n=`<div class="section-title">Known Spells</div>`;n+=`<div class="forge-grid">`;for(let e of t.knownSpells)n+=On(e);n+=`</div>`,n+=`<div class="section-title">Discovered Runes</div>`,n+=`<div class="forge-grid">`;for(let e of t.discoveredRunes)n+=`
      <div class="rune-card ${e.discovered?``:`locked`}">
        <div style="font-size:20px">${B(H(e.element),20)}</div>
        <div style="font-weight:600;font-size:12px;color:${e.discovered?U(e.element):`var(--text-dim)`}">${e.discovered?e.name:`???`}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.discovered?e.element:`Undiscovered`}</div>
      </div>
    `;return n+=`</div>`,n}function zr(e){let t=e.floors[e.currentFloor],n=t.rooms,r=`<div style="display:flex;gap:8px;margin-bottom:16px">`;for(let t of e.floors){let n=t.id-1===e.currentFloor?`btn-primary`:``;r+=`<button class="btn ${n}" ${t.unlocked?`onclick="gameAction('moveToFloor',${t.id-1});gameAction('overlay','none')"`:`disabled`}>${t.name}${t.unlocked?``:` (Locked)`}</button>`}r+=`</div>`,r+=`<p style="color:var(--warning);font-size:12px;margin-bottom:12px">${B(`game-icons:warning-sign`,14)} ${t.mechanicalConstraint}</p>`;let i=0,a=0;for(let e of n)i=Math.max(i,e.x),a=Math.max(a,e.y);r+=`<div class="map-grid" style="grid-template-columns:repeat(${i+1}, 72px)">`;for(let t=0;t<=a;t++)for(let a=0;a<=i;a++){let i=n.find(e=>e.x===a&&e.y===t);if(!i){r+=`<div style="width:72px;height:72px"></div>`;continue}let o=i.id===e.currentRoomId,s=q(e),c=!o&&i.discovered&&s?.connections.includes(i.id),l=[`map-cell`,i.discovered?`discovered`:`undiscovered`,o?`current`:``,i.cleared?`cleared`:``,c?`adjacent`:``].join(` `),u=c?`onclick="gameAction('moveToRoom','${i.id}');gameAction('overlay','none')"`:``;r+=`
        <div class="${l}" ${u} style="border-color:${o?`var(--accent-light)`:i.discovered?W(i.type):`transparent`}">
          ${i.discovered?`<div class="map-cell-icon" style="color:${W(i.type)}">${B(i.icon,22)}</div>`:`?`}
          <div class="map-cell-name">${i.discovered?i.name:`???`}</div>
          ${o?`<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;background:var(--accent-light);border-radius:50%;border:2px solid var(--bg-dark)">${B(`game-icons:mage-staff`,10)}</div>`:``}
          ${i.cleared?`<div style="position:absolute;bottom:2px;right:4px;font-size:10px;color:var(--success)">${B(`game-icons:check-mark`,10)}</div>`:``}
        </div>
      `}r+=`</div>`,r+=`<div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px">`;for(let e of[`combat`,`elite`,`forge`,`rest`,`event`,`merchant`,`boss`,`training`])r+=`<span style="color:${W(e)}">${B(Br(e),14)} ${e}</span>`;return r+=`</div>`,r}function Br(e){return{combat:`game-icons:crossed-swords`,elite:`game-icons:skull-crossed-bones`,forge:`game-icons:anvil`,rest:`game-icons:campfire`,event:`game-icons:scroll-unfurled`,merchant:`game-icons:shop`,boss:`game-icons:crowned-skull`,training:`game-icons:training`}[e]||`game-icons:dungeon-gate`}function Vr(e){let t=e.player,n=``;n+=`<div class="section-title">Spell Loadout (6 slots)</div>`,n+=`<div class="loadout-grid">`;for(let e=0;e<t.equippedSpells.length;e++){let r=t.equippedSpells[e];n+=`
      <div class="loadout-slot ${r?`filled`:``}">
        <div style="font-size:10px;color:var(--text-dim)">Slot ${e+1}</div>
        ${r?`
          <div style="font-size:18px">${B(H(r.elements[0]),18)}</div>
          <div style="font-weight:600;font-size:11px">${r.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${r.damage>0?r.damage+`dmg`:``} ${r.manaCost}mp</div>
          <button class="btn btn-sm" onclick="gameAction('unequipSpell',${e})" style="margin-top:4px">Remove</button>
        `:`<div style="color:var(--text-dim);font-size:11px">Empty</div>`}
      </div>
    `}n+=`</div>`,n+=`<div class="section-title">Available Spells</div>`,n+=`<div class="forge-grid">`;for(let e of t.knownSpells)if(!t.equippedSpells.some(t=>t?.id===e.id)){let r=t.equippedSpells.findIndex(e=>e===null);n+=`<div class="spell-card" ${r>=0?`onclick="gameAction('equipSpell',${r},'${e.id}')"`:``} style="${r<0?`opacity:0.5`:``}">
        <div style="font-size:18px">${B(H(e.elements[0]),18)}</div>
        <div style="font-weight:600;font-size:11px">${e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.damage>0?e.damage+`dmg`:``} ${e.manaCost}mp</div>
      </div>`}n+=`</div>`,n+=`<div class="section-title">Physical Skill Loadout (4 slots)</div>`,n+=`<div class="loadout-grid">`;for(let e=0;e<t.equippedSkills.length;e++){let r=t.equippedSkills[e];n+=`
      <div class="loadout-slot ${r?`filled`:``}">
        <div style="font-size:10px;color:var(--text-dim)">Slot ${e+1}</div>
        ${r?`
          <div style="font-size:18px">${B(`game-icons:sword-brandish`,18)}</div>
          <div style="font-weight:600;font-size:11px">${r.name}</div>
          <div style="font-size:10px;color:var(--text-dim)">${r.damage>0?r.damage+`dmg`:`Utility`} ${r.staminaCost}sta</div>
          <button class="btn btn-sm" onclick="gameAction('unequipSkill',${e})" style="margin-top:4px">Remove</button>
        `:`<div style="color:var(--text-dim);font-size:11px">Empty</div>`}
      </div>
    `}n+=`</div>`,n+=`<div class="section-title">Available Skills</div>`,n+=`<div class="forge-grid">`;for(let e of t.knownSkills)if(!t.equippedSkills.some(t=>t?.id===e.id)){let r=t.equippedSkills.findIndex(e=>e===null);n+=`<div class="spell-card" ${r>=0?`onclick="gameAction('equipSkill',${r},'${e.id}')"`:``} style="${r<0?`opacity:0.5`:``}">
        <div style="font-size:18px">${B(`game-icons:sword-brandish`,18)}</div>
        <div style="font-weight:600;font-size:11px">${e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.damage>0?e.damage+`dmg`:`Utility`} ${e.staminaCost}sta</div>
      </div>`}return n+=`</div>`,n}function Hr(e){let t=`<p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">Action policies determine how auto-combat resolves. Lower priority number = checked first. Toggle to enable/disable.</p>`;for(let n of e.player.actionPolicies.sort((e,t)=>e.priority-t.priority))t+=`
      <div class="policy-row">
        <div class="policy-priority">${n.priority}</div>
        <div class="policy-condition">${B(`game-icons:conversation`,12)} IF ${n.condition}</div>
        <div class="policy-action">THEN ${n.action}</div>
        <div class="policy-toggle ${n.enabled?`on`:``}" onclick="gameAction('togglePolicy','${n.id}')"></div>
      </div>
    `;return t+=`<p style="color:var(--text-dim);margin-top:16px;font-size:11px">
    Policies are evaluated top-to-bottom. The first matching enabled policy determines the action.
    If no policy matches, a basic attack is used.
  </p>`,t}function Ur(e){if(e.notifications.length===0)return``;let t=`<div class="notifications">`;for(let n of e.notifications)t+=`<div class="notif notif-${n.type}">${n.text}</div>`;return t+=`</div>`,t}function Wr(e){return`
    <div class="end-screen">
      <div style="font-size:64px;margin-bottom:20px">${B(`game-icons:skull`,64)}</div>
      <h1 style="color:var(--danger)">Defeated</h1>
      <div class="stats">
        <p>Level: ${e.player.level} | Floor: ${e.floors[e.currentFloor].name}</p>
        <p>Room transitions: ${e.roomTransitions}</p>
        <p>Spells crafted: ${e.player.knownSpells.filter(e=>e.isCrafted).length}</p>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('continue')">${B(`game-icons:save`,18)} Load Checkpoint</button>
        <button class="btn btn-lg" onclick="gameAction('newGame')">${B(`game-icons:crossed-swords`,18)} New Game</button>
        <button class="btn btn-lg" onclick="gameAction('backToTitle')">Title Screen</button>
      </div>
    </div>
  `}function Gr(e){return`
    <div class="end-screen">
      <div style="font-size:64px;margin-bottom:20px">${B(`game-icons:trophy`,64)}</div>
      <h1 style="background:linear-gradient(135deg, var(--gold), var(--accent-light));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Dungeon Escaped!</h1>
      <div class="stats">
        <p>Level: ${e.player.level}</p>
        <p>Room transitions: ${e.roomTransitions}</p>
        <p>Spells crafted: ${e.player.knownSpells.filter(e=>e.isCrafted).length}</p>
        <p>Runes discovered: ${e.player.discoveredRunes.filter(e=>e.discovered).length}/${e.player.discoveredRunes.length}</p>
        <p>Skills unlocked: ${e.player.skillTree.filter(e=>e.unlocked).length}/${e.player.skillTree.length}</p>
      </div>
      <div style="display:flex;gap:12px">
        <button class="btn btn-primary btn-lg" onclick="gameAction('newGame')">${B(`game-icons:crossed-swords`,18)} New Game</button>
        <button class="btn btn-lg" onclick="gameAction('backToTitle')">Title Screen</button>
      </div>
    </div>
  `}function Kr(){document.addEventListener(`keydown`,e=>{e.key===`Escape`&&Z!==`none`&&(Z=`none`,J()),(e.key===`m`||e.key===`M`)&&Z===`none`&&(Z=`map`,J()),(e.key===`i`||e.key===`I`)&&Z===`none`&&(Z=`inventory`,J()),(e.key===`c`||e.key===`C`)&&Z===`none`&&(Z=`character`,J())})}var Y,X,Z,Q,$,qr=e((()=>{z(),Mn(),Xn(),tr(),or(),cn(),Y=[],X=null,Z=`none`,Q=`stats`,$=`buy`,window.gameAction=sr}));t((()=>{Yt(),Zt(),qr(),z(),Xt(),Cn(()=>{requestAnimationFrame(()=>J())});var e=yn();e.screen=`title`,Sn(e),Kr(),setInterval(()=>{let e=I();if(e&&e.notifications.length>0){let t=Date.now(),n=e.notifications.length;e.notifications=e.notifications.filter(e=>e.expires>t),e.notifications.length!==n&&requestAnimationFrame(()=>J())}},1e3)}))();