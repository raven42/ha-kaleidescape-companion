const K = globalThis, _e = K.ShadowRoot && (K.ShadyCSS === void 0 || K.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ke = /* @__PURE__ */ Symbol(), Ue = /* @__PURE__ */ new WeakMap();
let Ye = class {
  constructor(e, t, i) {
    if (this._$cssResult$ = !0, i !== ke) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (_e && e === void 0) {
      const i = t !== void 0 && t.length === 1;
      i && (e = Ue.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && Ue.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const nt = (n) => new Ye(typeof n == "string" ? n : n + "", void 0, ke), L = (n, ...e) => {
  const t = n.length === 1 ? n[0] : e.reduce((i, s, a) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[a + 1], n[0]);
  return new Ye(t, n, ke);
}, ot = (n, e) => {
  if (_e) n.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const i = document.createElement("style"), s = K.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = t.cssText, n.appendChild(i);
  }
}, Re = _e ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const i of e.cssRules) t += i.cssText;
  return nt(t);
})(n) : n;
const { is: lt, defineProperty: ht, getOwnPropertyDescriptor: dt, getOwnPropertyNames: ct, getOwnPropertySymbols: pt, getPrototypeOf: ut } = Object, ne = globalThis, Te = ne.trustedTypes, gt = Te ? Te.emptyScript : "", ft = ne.reactiveElementPolyfillSupport, O = (n, e) => n, pe = { toAttribute(n, e) {
  switch (e) {
    case Boolean:
      n = n ? gt : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, e) {
  let t = n;
  switch (e) {
    case Boolean:
      t = n !== null;
      break;
    case Number:
      t = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(n);
      } catch {
        t = null;
      }
  }
  return t;
} }, Ge = (n, e) => !lt(n, e), Pe = { attribute: !0, type: String, converter: pe, reflect: !1, useDefault: !1, hasChanged: Ge };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), ne.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let R = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Pe) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const i = /* @__PURE__ */ Symbol(), s = this.getPropertyDescriptor(e, i, t);
      s !== void 0 && ht(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, t, i) {
    const { get: s, set: a } = dt(this.prototype, e) ?? { get() {
      return this[t];
    }, set(o) {
      this[t] = o;
    } };
    return { get: s, set(o) {
      const l = s?.call(this);
      a?.call(this, o), this.requestUpdate(e, l, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Pe;
  }
  static _$Ei() {
    if (this.hasOwnProperty(O("elementProperties"))) return;
    const e = ut(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(O("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(O("properties"))) {
      const t = this.properties, i = [...ct(t), ...pt(t)];
      for (const s of i) this.createProperty(s, t[s]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const t = litPropertyMetadata.get(e);
      if (t !== void 0) for (const [i, s] of t) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t, i] of this.elementProperties) {
      const s = this._$Eu(t, i);
      s !== void 0 && this._$Eh.set(s, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const t = [];
    if (Array.isArray(e)) {
      const i = new Set(e.flat(1 / 0).reverse());
      for (const s of i) t.unshift(Re(s));
    } else e !== void 0 && t.push(Re(e));
    return t;
  }
  static _$Eu(e, t) {
    const i = t.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
  }
  addController(e) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
  }
  removeController(e) {
    this._$EO?.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
    for (const i of t.keys()) this.hasOwnProperty(i) && (e.set(i, this[i]), delete this[i]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return ot(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, t, i) {
    this._$AK(e, i);
  }
  _$ET(e, t) {
    const i = this.constructor.elementProperties.get(e), s = this.constructor._$Eu(e, i);
    if (s !== void 0 && i.reflect === !0) {
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : pe).toAttribute(t, i.type);
      this._$Em = e, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(e, t) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), o = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : pe;
      this._$Em = s;
      const l = o.fromAttribute(t, a.type);
      this[s] = l ?? this._$Ej?.get(s) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, t, i, s = !1, a) {
    if (e !== void 0) {
      const o = this.constructor;
      if (s === !1 && (a = this[e]), i ??= o.getPropertyOptions(e), !((i.hasChanged ?? Ge)(a, t) || i.useDefault && i.reflect && a === this._$Ej?.get(e) && !this.hasAttribute(o._$Eu(e, i)))) return;
      this.C(e, t, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: i, reflect: s, wrapped: a }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, o ?? t ?? this[e]), a !== !0 || o !== void 0) || (this._$AL.has(e) || (this.hasUpdated || i || (t = void 0), this._$AL.set(e, t)), s === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (t) {
      Promise.reject(t);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [s, a] of this._$Ep) this[s] = a;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, a] of i) {
        const { wrapped: o } = a, l = this[s];
        o !== !0 || this._$AL.has(s) || l === void 0 || this.C(s, void 0, a, l);
      }
    }
    let e = !1;
    const t = this._$AL;
    try {
      e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(t)) : this._$EM();
    } catch (i) {
      throw e = !1, this._$EM(), i;
    }
    e && this._$AE(t);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    this._$EO?.forEach((t) => t.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq &&= this._$Eq.forEach((t) => this._$ET(t, this[t])), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
R.elementStyles = [], R.shadowRootOptions = { mode: "open" }, R[O("elementProperties")] = /* @__PURE__ */ new Map(), R[O("finalized")] = /* @__PURE__ */ new Map(), ft?.({ ReactiveElement: R }), (ne.reactiveElementVersions ??= []).push("2.1.2");
const Se = globalThis, Le = (n) => n, Y = Se.trustedTypes, ze = Y ? Y.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, Qe = "$lit$", _ = `lit$${Math.random().toFixed(9).slice(2)}$`, Xe = "?" + _, bt = `<${Xe}>`, E = document, M = () => E.createComment(""), I = (n) => n === null || typeof n != "object" && typeof n != "function", Ce = Array.isArray, mt = (n) => Ce(n) || typeof n?.[Symbol.iterator] == "function", le = `[ 	
\f\r]`, z = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, De = /-->/g, Oe = />/g, C = RegExp(`>|${le}(?:([^\\s"'>=/]+)(${le}*=${le}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Ne = /'/g, je = /"/g, Ze = /^(?:script|style|textarea|title)$/i, yt = (n) => (e, ...t) => ({ _$litType$: n, strings: e, values: t }), r = yt(1), $ = /* @__PURE__ */ Symbol.for("lit-noChange"), h = /* @__PURE__ */ Symbol.for("lit-nothing"), Me = /* @__PURE__ */ new WeakMap(), q = E.createTreeWalker(E, 129);
function et(n, e) {
  if (!Ce(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ze !== void 0 ? ze.createHTML(e) : e;
}
const vt = (n, e) => {
  const t = n.length - 1, i = [];
  let s, a = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", o = z;
  for (let l = 0; l < t; l++) {
    const d = n[l];
    let c, g, f = -1, w = 0;
    for (; w < d.length && (o.lastIndex = w, g = o.exec(d), g !== null); ) w = o.lastIndex, o === z ? g[1] === "!--" ? o = De : g[1] !== void 0 ? o = Oe : g[2] !== void 0 ? (Ze.test(g[2]) && (s = RegExp("</" + g[2], "g")), o = C) : g[3] !== void 0 && (o = C) : o === C ? g[0] === ">" ? (o = s ?? z, f = -1) : g[1] === void 0 ? f = -2 : (f = o.lastIndex - g[2].length, c = g[1], o = g[3] === void 0 ? C : g[3] === '"' ? je : Ne) : o === je || o === Ne ? o = C : o === De || o === Oe ? o = z : (o = C, s = void 0);
    const x = o === C && n[l + 1].startsWith("/>") ? " " : "";
    a += o === z ? d + bt : f >= 0 ? (i.push(c), d.slice(0, f) + Qe + d.slice(f) + _ + x) : d + _ + (f === -2 ? l : x);
  }
  return [et(n, a + (n[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class B {
  constructor({ strings: e, _$litType$: t }, i) {
    let s;
    this.parts = [];
    let a = 0, o = 0;
    const l = e.length - 1, d = this.parts, [c, g] = vt(e, t);
    if (this.el = B.createElement(c, i), q.currentNode = this.el.content, t === 2 || t === 3) {
      const f = this.el.content.firstChild;
      f.replaceWith(...f.childNodes);
    }
    for (; (s = q.nextNode()) !== null && d.length < l; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const f of s.getAttributeNames()) if (f.endsWith(Qe)) {
          const w = g[o++], x = s.getAttribute(f).split(_), F = /([.?@])?(.*)/.exec(w);
          d.push({ type: 1, index: a, name: F[2], strings: x, ctor: F[1] === "." ? wt : F[1] === "?" ? xt : F[1] === "@" ? _t : oe }), s.removeAttribute(f);
        } else f.startsWith(_) && (d.push({ type: 6, index: a }), s.removeAttribute(f));
        if (Ze.test(s.tagName)) {
          const f = s.textContent.split(_), w = f.length - 1;
          if (w > 0) {
            s.textContent = Y ? Y.emptyScript : "";
            for (let x = 0; x < w; x++) s.append(f[x], M()), q.nextNode(), d.push({ type: 2, index: ++a });
            s.append(f[w], M());
          }
        }
      } else if (s.nodeType === 8) if (s.data === Xe) d.push({ type: 2, index: a });
      else {
        let f = -1;
        for (; (f = s.data.indexOf(_, f + 1)) !== -1; ) d.push({ type: 7, index: a }), f += _.length - 1;
      }
      a++;
    }
  }
  static createElement(e, t) {
    const i = E.createElement("template");
    return i.innerHTML = e, i;
  }
}
function P(n, e, t = n, i) {
  if (e === $) return e;
  let s = i !== void 0 ? t._$Co?.[i] : t._$Cl;
  const a = I(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(n), s._$AT(n, t, i)), i !== void 0 ? (t._$Co ??= [])[i] = s : t._$Cl = s), s !== void 0 && (e = P(n, s._$AS(n, e.values), s, i)), e;
}
class $t {
  constructor(e, t) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: t }, parts: i } = this._$AD, s = (e?.creationScope ?? E).importNode(t, !0);
    q.currentNode = s;
    let a = q.nextNode(), o = 0, l = 0, d = i[0];
    for (; d !== void 0; ) {
      if (o === d.index) {
        let c;
        d.type === 2 ? c = new H(a, a.nextSibling, this, e) : d.type === 1 ? c = new d.ctor(a, d.name, d.strings, this, e) : d.type === 6 && (c = new kt(a, this, e)), this._$AV.push(c), d = i[++l];
      }
      o !== d?.index && (a = q.nextNode(), o++);
    }
    return q.currentNode = E, s;
  }
  p(e) {
    let t = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, t), t += i.strings.length - 2) : i._$AI(e[t])), t++;
  }
}
class H {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, t, i, s) {
    this.type = 2, this._$AH = h, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const t = this._$AM;
    return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, t = this) {
    e = P(this, e, t), I(e) ? e === h || e == null || e === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : e !== this._$AH && e !== $ && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : mt(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== h && I(this._$AH) ? this._$AA.nextSibling.data = e : this.T(E.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: t, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = B.createElement(et(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(t);
    else {
      const a = new $t(s, this), o = a.u(this.options);
      a.p(t), this.T(o), this._$AH = a;
    }
  }
  _$AC(e) {
    let t = Me.get(e.strings);
    return t === void 0 && Me.set(e.strings, t = new B(e)), t;
  }
  k(e) {
    Ce(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let i, s = 0;
    for (const a of e) s === t.length ? t.push(i = new H(this.O(M()), this.O(M()), this, this.options)) : i = t[s], i._$AI(a), s++;
    s < t.length && (this._$AR(i && i._$AB.nextSibling, s), t.length = s);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    for (this._$AP?.(!1, !0, t); e !== this._$AB; ) {
      const i = Le(e).nextSibling;
      Le(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class oe {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, i, s, a) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = e, this.name = t, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(e, t = this, i, s) {
    const a = this.strings;
    let o = !1;
    if (a === void 0) e = P(this, e, t, 0), o = !I(e) || e !== this._$AH && e !== $, o && (this._$AH = e);
    else {
      const l = e;
      let d, c;
      for (e = a[0], d = 0; d < a.length - 1; d++) c = P(this, l[i + d], t, d), c === $ && (c = this._$AH[d]), o ||= !I(c) || c !== this._$AH[d], c === h ? e = h : e !== h && (e += (c ?? "") + a[d + 1]), this._$AH[d] = c;
    }
    o && !s && this.j(e);
  }
  j(e) {
    e === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class wt extends oe {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === h ? void 0 : e;
  }
}
class xt extends oe {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== h);
  }
}
class _t extends oe {
  constructor(e, t, i, s, a) {
    super(e, t, i, s, a), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = P(this, e, t, 0) ?? h) === $) return;
    const i = this._$AH, s = e === h && i !== h || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, a = e !== h && (i === h || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class kt {
  constructor(e, t, i) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    P(this, e);
  }
}
const St = Se.litHtmlPolyfillSupport;
St?.(B, H), (Se.litHtmlVersions ??= []).push("3.3.3");
const Ct = (n, e, t) => {
  const i = t?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = t?.renderBefore ?? null;
    i._$litPart$ = s = new H(e.insertBefore(M(), a), a, void 0, t ?? {});
  }
  return s._$AI(n), s;
};
const qe = globalThis;
let y = class extends R {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ct(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return $;
  }
};
y._$litElement$ = !0, y.finalized = !0, qe.litElementHydrateSupport?.({ LitElement: y });
const qt = qe.litElementPolyfillSupport;
qt?.({ LitElement: y });
(qe.litElementVersions ??= []).push("4.2.2");
class p extends Error {
  constructor(e) {
    super(e), this.code = e;
  }
}
const b = "kaleidescape_companion", Et = 15e3, m = ({ entry_id: n, dataset_id: e }) => ({
  entry_id: n,
  dataset_id: e
}), At = 256 * 1024 * 1024, Ie = 5 * 1024 * 1024, Ut = 32 * 1024 * 1024;
function Rt() {
  const n = globalThis.crypto;
  if (typeof n?.randomUUID == "function") return n.randomUUID();
  if (typeof n?.getRandomValues != "function")
    throw new p("request_id_unavailable");
  const e = n.getRandomValues(new Uint8Array(16));
  e[6] = e[6] & 15 | 64, e[8] = e[8] & 63 | 128;
  const t = Array.from(
    e,
    (i) => i.toString(16).padStart(2, "0")
  ).join("");
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}
async function W(n, e, t) {
  const i = n.body?.getReader();
  if (!i) throw new p("storage_error");
  const s = [];
  let a = 0;
  try {
    for (; ; ) {
      const { value: o, done: l } = await i.read();
      if (l) break;
      if (a += o.byteLength, a > e) throw new p("export_too_large");
      s.push(new Uint8Array(o));
    }
    return new Blob(s, { type: t });
  } finally {
    await i.cancel().catch(() => {
    }), i.releaseLock();
  }
}
function u(n) {
  return typeof n == "object" && n !== null && "code" in n && typeof n.code == "string" ? n.code : "connection_lost";
}
function v(n) {
  return {
    unauthorized: "Access to this operation is denied. Your journal has been cleared from this view.",
    not_ready: "The integration is not loaded. Reload the connection after it starts.",
    not_found: "This record or dataset is no longer available. Refresh the journal.",
    conflict: "This entry changed elsewhere. Reload the entry and review your changes before saving again.",
    refresh_required: "The journal changed. Return to the first page to refresh the results.",
    invalid_request: "Some values were rejected. Check the fields and try again.",
    busy: "The journal is busy. Wait a moment, then retry.",
    backup_in_progress: "A backup is running. Retry after it finishes.",
    storage_error: "The journal could not access storage. Check HA diagnostics and available space.",
    export_too_large: "This export exceeds the download size limit.",
    export_timeout: "The export timed out. Try again when the server is less busy.",
    request_id_unavailable: "This browser cannot create a secure request ID. Try a supported browser. No change was sent.",
    tracking_enabled: "Disable automatic tracking in Settings before importing or purging entries.",
    import_too_large: "Choose an import file no larger than 32 MiB.",
    import_timeout: "The import result is unconfirmed. Retry the same file and request to confirm it.",
    library_disabled: "Enable library sync in Settings to use the Library.",
    library_storage_limit: "Library refresh reached its database storage ceiling. Cached data is retained and journal storage headroom is reserved.",
    library_unreachable: "The library host could not be reached. Check the hostname and HA network access. Cached data is retained.",
    library_destination: "The library must use a private LAN hostname or address.",
    library_format: "The library page format was not recognized. Cached data is retained.",
    library_response: "The library returned an unsupported response. Cached data is retained.",
    library_changed: "The library changed during sync. Previous collection data was retained; try again later.",
    query_limit: "This query exceeded its execution budget. Simplify the conditions and try again.",
    query_syntax: "Check the field names, operators and quoted values in the condition.",
    database_page_too_large: "The database page is too large. Choose fewer rows per page.",
    library_page_too_large: "This library page is too large. Reduce entries per page and try again.",
    collection_disabled: "Enable Add to Collection and collection sync in Settings first.",
    collection_form: "The server’s collection add form was not recognized. Refresh or sync before starting another add.",
    collection_uncertain: "Check or acknowledge the previous unconfirmed collection add first.",
    collection_limit: "Collection request history reached its storage limit.",
    library_too_large: "A library response exceeded its safety limit. Cached data is retained.",
    library_artwork: "Some artwork could not be cached. Previous artwork is retained when available."
  }[u(n)] ?? "The connection was interrupted. The result could not be confirmed.";
}
async function Tt(n) {
  let e;
  try {
    return await Promise.race([
      n,
      new Promise((t, i) => {
        e = setTimeout(
          () => i(new p("connection_lost")),
          Et
        );
      })
    ]);
  } finally {
    clearTimeout(e);
  }
}
class tt {
  constructor(e) {
    this.transport = e;
  }
  call(e) {
    return Tt(this.transport.callWS(e));
  }
  uiPreferences(e, t = !1, i = "library") {
    return this.call({
      type: `${b}/ui/${t ? "shared" : "preferences"}/get`,
      ...i !== "library" ? { area: i } : {},
      ...m(e)
    });
  }
  prepareUIPreferences(e, t, i, s, a = "library") {
    return this.prepareCommand(
      e,
      `ui/${t ? "shared" : "preferences"}/update`,
      { revision: i, patch: s, ...a !== "library" ? { area: a } : {} }
    );
  }
  saveUIPreferences(e) {
    return this.call({ ...e.message });
  }
  info() {
    return this.call({ type: `${b}/info` });
  }
  list(e, t = "", i = "", s) {
    return this.call({
      type: `${b}/journal/list`,
      ...m(e),
      query: t,
      limit: 25,
      ...i ? { status: i } : {},
      ...s ? { cursor: s } : {}
    });
  }
  get(e, t) {
    return this.call({
      type: `${b}/journal/get`,
      ...m(e),
      viewing_id: t
    });
  }
  sessions(e, t) {
    return this.call({
      type: `${b}/journal/sessions`,
      ...m(e),
      viewing_id: t
    });
  }
  nowPlaying(e) {
    return this.call({ type: `${b}/now_playing`, ...m(e) });
  }
  libraryInfo(e) {
    return this.call({ type: `${b}/library/info`, ...m(e) });
  }
  libraryList(e, t = {}) {
    return this.call({
      type: `${b}/library/list`,
      ...m(e),
      filters: t
    });
  }
  libraryVersions(e, t, i = 0, s) {
    return this.call({
      type: `${b}/library/versions`,
      ...m(e),
      title_id: t,
      offset: i,
      ...s === void 0 ? {} : { revision: s }
    });
  }
  librarySync(e) {
    return this.call({ type: `${b}/library/sync`, ...m(e) });
  }
  collectionTargets(e, t, i) {
    return this.call({
      type: `${b}/library/collections/targets`,
      ...m(e),
      title_id: t,
      revision: i
    });
  }
  prepareCollectionAdd(e, t, i, s) {
    return this.prepareCommand(e, "library/collections/add", {
      title_id: t,
      collection: i,
      revision: s
    });
  }
  collectionAdd(e) {
    return this.call({ ...e.message });
  }
  collectionCheck(e, t) {
    return this.call({
      type: `${b}/library/collections/check`,
      ...m(e),
      request_id: t
    });
  }
  collectionAcknowledge(e, t) {
    return this.call({
      type: `${b}/library/collections/acknowledge`,
      ...m(e),
      request_id: t,
      confirmation: "ACKNOWLEDGE"
    });
  }
  async libraryArtwork(e, t, i) {
    if (!/^[a-f0-9]{64}$/.test(t)) throw new p("invalid_request");
    const s = await this.transport.fetchWithAuth(
      `/api/${b}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/library/artwork/${t}`,
      {
        signal: i,
        cache: "no-store",
        redirect: "error"
      }
    );
    if (!s.ok)
      throw await s.body?.cancel(), new p(
        [401, 403].includes(s.status) ? "unauthorized" : "not_found"
      );
    const a = s.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (!a || !["image/jpeg", "image/png", "image/webp"].includes(a))
      throw await s.body?.cancel(), new p("invalid_request");
    return W(s, Ie, a);
  }
  settings(e, t, i = {}) {
    return this.call({
      ...i,
      ...m(e),
      type: `${b}/settings/${t}`
    });
  }
  inspect(e, t, i = 0, s, a) {
    return this.call({
      type: `${b}/database/inspect`,
      ...m(e),
      table: t,
      offset: i,
      ...s == null ? {} : { revision: s },
      ...a
    });
  }
  preparePurge(e, t) {
    return this.prepareCommand(e, "database/purge", t);
  }
  prepareDatabaseUpdate(e, t) {
    return this.prepareCommand(e, "database/update", t);
  }
  prepareImport(e, t, i) {
    return this.prepareCommand(e, "database/import", {
      plan_id: t.plan_id,
      revision: t.revision,
      selected: [...i].sort()
    });
  }
  applyImport(e) {
    return this.call({ ...e.message });
  }
  async previewImport(e, t, i) {
    const s = /\.(sqlite|sqlite3|db)$/i.test(t.name) ? "sqlite" : /\.json$/i.test(t.name) ? "json" : null;
    if (!s) throw new p("invalid_request");
    if (!t.size || t.size > Ut)
      throw new p("import_too_large");
    const a = await this.transport.fetchWithAuth(
      `/api/${b}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/import/preview?format=${s}`,
      {
        method: "POST",
        body: t,
        signal: i,
        redirect: "error",
        cache: "no-store",
        headers: { "Content-Type": "application/octet-stream" }
      }
    );
    if (!a.ok) {
      const l = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found"
      };
      if (l[a.status]) throw new p(l[a.status]);
      const d = await a.json().catch(() => null);
      throw new p(d?.code ?? "connection_lost");
    }
    const o = await W(
      a,
      8 * 1024 * 1024,
      "application/json"
    );
    return JSON.parse(await o.text());
  }
  purge(e) {
    return this.call({ ...e.message });
  }
  async artwork(e, t) {
    if (!/^media_player\.[a-z0-9_]{1,255}$/.test(e))
      throw new p("invalid_request");
    const i = await this.transport.fetchWithAuth(
      `/api/media_player_proxy/${e}`,
      {
        signal: t,
        cache: "no-store",
        redirect: "error"
      }
    );
    if (!i.ok) {
      if (await i.body?.cancel(), i.status === 404) return null;
      throw new p(
        [401, 403].includes(i.status) ? "unauthorized" : "not_ready"
      );
    }
    const s = i.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    return !s || !["image/jpeg", "image/png", "image/webp"].includes(s) ? (await i.body?.cancel(), null) : W(i, Ie, s);
  }
  librarySuggestions(e, t, i) {
    return this.call({
      type: `${b}/library/suggest`,
      ...m(e),
      field: t,
      query: i
    });
  }
  validateDatabaseQuery(e, t, i) {
    return this.call({
      type: `${b}/database/validate_query`,
      ...m(e),
      table: t,
      query: i
    });
  }
  prepareDatabaseMutation(e, t) {
    return this.prepareCommand(e, "database/mutate", { data: t });
  }
  databaseMutation(e) {
    return this.call({ ...e.message });
  }
  async libraryAll(e, t, i) {
    let s;
    const a = [];
    let o = 0;
    for (; i(); ) {
      const l = await this.libraryList(e, {
        ...t,
        grouped: !0,
        limit: 1e3,
        offset: a.length,
        ...s ? { revision: s.revision, preferences_key: s.preferences_key } : {}
      });
      if (!i()) throw new p("not_ready");
      if (s && (l.revision !== s.revision || l.preferences_key !== s.preferences_key))
        throw new p("refresh_required");
      if (o += new TextEncoder().encode(JSON.stringify(l.items)).byteLength, a.length + l.items.length > 1e4 || o > 32 * 1024 * 1024)
        throw new p("library_page_too_large");
      if (a.push(...l.items), s = l, !l.has_more)
        return {
          ...l,
          items: a,
          offset: 0,
          limit: a.length,
          has_more: !1
        };
      if (!l.items.length) throw new p("refresh_required");
    }
    throw new p("not_ready");
  }
  prepare(e, t, i) {
    return this.prepareCommand(e, `journal/${t}`, i);
  }
  prepareCommand(e, t, i) {
    const s = structuredClone({
      ...i,
      ...m(e),
      type: `${b}/${t}`,
      request_id: Rt()
    });
    return { scope: m(e), message: Object.freeze(s) };
  }
  mutate(e) {
    return this.call({ ...e.message });
  }
  async download(e, t, i) {
    const s = `/api/${b}/${encodeURIComponent(e.entry_id)}/${encodeURIComponent(e.dataset_id)}/export?format=${t}`, a = await this.transport.fetchWithAuth(s, {
      signal: i,
      cache: "no-store",
      redirect: "error"
    });
    if (!a.ok) {
      const o = {
        401: "unauthorized",
        403: "unauthorized",
        404: "not_found",
        413: "export_too_large",
        503: "busy"
      };
      throw new p(o[a.status] ?? "storage_error");
    }
    return W(
      a,
      At,
      t === "json" ? "application/json" : "application/vnd.sqlite3"
    );
  }
}
function Be(n) {
  const e = new Date(n);
  return new Date(e.getTime() - e.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
}
function N(n) {
  return {
    title: n?.title ?? "",
    started_at: Be(n?.started_at ?? (/* @__PURE__ */ new Date()).toISOString()),
    ended_at: n?.ended_at ? Be(n.ended_at) : "",
    duration_seconds: n?.duration_seconds == null ? "" : (n.duration_seconds / 60).toFixed(2),
    watched_seconds: ((n?.watched_seconds ?? 0) / 60).toFixed(2),
    status: n?.status ?? "partial",
    notes: n?.notes ?? "",
    source_id: n?.source_id ?? "",
    player_id: n?.player_id ?? "",
    raw_content_id: n?.raw_content_id ?? ""
  };
}
function it(n, e) {
  const t = {};
  for (const [i, s] of Object.entries(n))
    e && s === e[i] || (i === "started_at" || i === "ended_at" ? t[i] = s ? new Date(s).toISOString() : null : i === "duration_seconds" || i === "watched_seconds" ? t[i] = s === "" ? null : Number(s) * 60 : ["source_id", "player_id", "raw_content_id"].includes(i) ? t[i] = s === "" ? null : s : t[i] = s);
  return t;
}
function st(n, e) {
  function t(i, s, a = "text", o = !1, l) {
    return r`<label
      >${s}<input
        id=${i === "title" ? "title" : i}
        name=${i}
        type=${a}
        .value=${n[i]}
        ?required=${o}
        maxlength=${l ?? h}
        min=${a === "number" ? "0" : h}
        max=${a === "number" ? String(1e9 / 60) : h}
        step=${a === "datetime-local" ? "1" : a === "number" ? "0.01" : h}
        @input=${(d) => e(i, d)}
    /></label>`;
  }
  return r`
    <div class="grid">
      <div class="full">${t("title", "Title", "text", !0, 500)}</div>
      ${t("started_at", "Started · local time", "datetime-local", !0)}
      ${t("ended_at", "Ended · local time", "datetime-local")}
      ${t("watched_seconds", "Watched minutes", "number", !0)}
      ${t("duration_seconds", "Runtime minutes · optional", "number")}
      <label
        >Status<select
          name="record_status"
          .value=${n.status}
          @change=${(i) => e("status", i)}
        >
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
        </select></label
      >
      <label class="full"
        >Notes<textarea
          name="notes"
          maxlength="10000"
          .value=${n.notes}
          @input=${(i) => e("notes", i)}
        ></textarea>
      </label>
    </div>
    <details>
      <summary>Source identifiers</summary>
      <div class="grid">
        ${t("source_id", "Source ID", "text", !1, 255)}
        ${t("player_id", "Player ID", "text", !1, 255)}
        <div class="full">
          ${t("raw_content_id", "Raw content ID", "text", !1, 255)}
        </div>
      </div>
      <small
        >Keep source identifiers exact. Titles do not establish movie
        identity.</small
      >
    </details>
  `;
}
const S = L`
  :host {
    display: block;
    min-height: 0;
    color: var(--primary-text-color, #20302c);
    background: transparent;
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    --accent: var(--primary-color, #256b59);
    --line: var(--divider-color, #dbe3df);
    --surface: var(--card-background-color, #fff);
    --muted: var(--secondary-text-color, #52645d);
  }
  :host(kaleidescape-panel),
  :host(kaleidescape-reader) {
    min-height: 100dvh;
    background: var(--primary-background-color, #f5f7f6);
  }
  * {
    box-sizing: border-box;
  }
  main {
    max-width: 1400px;
    margin: auto;
    padding: 24px clamp(16px, 4vw, 48px) 48px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  h1 {
    margin: 4px 0 6px;
    font-size: clamp(24px, 3vw, 32px);
    letter-spacing: -0.035em;
    font-weight: 650;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  h3 {
    font-size: 14px;
    margin: 20px 0 10px;
  }
  p {
    line-height: 1.6;
  }
  header p {
    margin: 0;
    color: var(--muted);
  }
  .eyebrow {
    color: var(--accent);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .grow {
    flex: 1;
  }
  .muted,
  small {
    color: var(--muted);
  }
  small {
    font-size: 12px;
    line-height: 1.6;
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
  }
  button {
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: inherit;
    padding: 9px 14px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 550;
  }
  button:hover:not(:disabled) {
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--text-primary-color, #fff);
  }
  .danger {
    color: var(--error-color, #b5262c);
  }
  .link {
    padding: 0;
    border: 0;
    min-height: 36px;
    background: none;
    color: var(--accent);
    text-align: left;
  }
  :focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 24px 0;
  }
  .metric,
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .metric {
    padding: 16px 20px;
  }
  .metric strong {
    display: block;
    font-size: 21px;
    margin: 5px 0 0;
    font-weight: 600;
  }
  .metric small {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(340px, 1fr);
    align-items: start;
    gap: 20px;
  }
  .card {
    min-width: 0;
    overflow: hidden;
  }
  .card-head {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-head h2 {
    margin: 0;
    flex: 1;
  }
  .filters {
    padding: 0 20px 20px;
    display: flex;
    align-items: end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .filters label:first-child {
    flex: 1;
    min-width: 150px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  input,
  select,
  textarea {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
    padding: 9px 10px;
    font-size: 14px;
  }
  textarea {
    resize: vertical;
    min-height: 100px;
  }
  input:disabled,
  select:disabled,
  textarea:disabled {
    opacity: 0.65;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  th {
    text-align: left;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    background: var(--secondary-background-color, #f7f9f8);
  }
  td,
  th {
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }
  td:first-child {
    min-width: 150px;
    max-width: 260px;
  }
  td .link {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  tr.selected {
    background: var(--secondary-background-color, #edf4f0);
  }
  td small {
    display: block;
  }
  .badge {
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 20px;
    font-size: 11px;
    white-space: nowrap;
    color: var(--muted);
  }
  .complete {
    color: var(--accent);
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--line);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .editor {
    container: viewing-editor / inline-size;
    padding: 0 20px 20px;
  }
  fieldset {
    padding: 0;
    border: 0;
    margin: 0;
    min-width: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 14px;
  }
  .grid > * {
    min-width: 0;
  }
  .settings-grid {
    align-items: end;
  }
  .full {
    grid-column: 1/-1;
  }
  .editor .actions {
    margin-top: 20px;
  }
  .metadata {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .notice,
  .error,
  .warning {
    padding: 12px 16px;
    margin: 16px 0;
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
    border-radius: 6px;
    background: var(--surface);
    line-height: 1.6;
    font-size: 14px;
  }
  .error {
    border-left-color: var(--error-color, #b5262c);
  }
  .warning {
    border-left-color: var(--warning-color, #a66712);
  }
  .empty {
    padding: 40px 24px;
    text-align: center;
    color: var(--muted);
  }
  .empty strong {
    display: block;
    color: var(--primary-text-color, #20302c);
    margin-bottom: 8px;
    font-size: 16px;
  }
  .check {
    flex-direction: row;
    align-items: center;
    margin: 12px 0;
  }
  .check input {
    width: 20px;
    min-height: 20px;
    flex-shrink: 0;
  }
  .page-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid var(--line);
    margin: 20px 0;
    padding: 4px 0 0;
  }
  .page-tabs button {
    flex-shrink: 0;
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 6px 6px 0 0;
    background: transparent;
  }
  .page-tabs [aria-selected="true"] {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: var(--surface);
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
  }
  .section-head h2 {
    margin: 0;
  }
  .settings-page {
    padding: 20px;
    max-width: 900px;
    margin-top: 24px;
  }
  .settings-page .card-head {
    padding: 0;
  }
  .settings-page form > button {
    margin-top: 12px;
  }
  .database-dialog {
    width: min(560px, calc(100% - 32px));
    max-height: calc(100dvh - 48px);
    overflow: auto;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: inherit;
  }
  .database-dialog::backdrop {
    background: rgb(0 0 0 / 60%);
  }
  .database-dialog .card-head {
    padding: 0;
  }
  .dialog-footer {
    margin-top: 20px;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  details {
    margin-top: 20px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    padding: 4px 0;
  }
  details .grid {
    margin-top: 14px;
  }
  ul {
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.8;
  }
  .session {
    padding: 10px 0;
    border-top: 1px solid var(--line);
    font-size: 12px;
    line-height: 1.8;
  }
  .menu {
    font-size: 20px;
    padding: 6px 12px;
  }
  .now-playing {
    margin-top: 24px;
  }
  .playback-message {
    padding: 0 20px 20px;
    margin: 0;
  }
  .playback-layout {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 20px;
    padding: 0 20px 20px;
  }
  .cover {
    aspect-ratio: 2 / 3;
    background: var(--secondary-background-color, #f7f9f8);
    border-radius: 6px;
    overflow: hidden;
    display: grid;
    place-items: center;
    align-self: start;
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .cover span {
    padding: 12px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  }
  .playback-detail h3 {
    margin: 4px 0 12px;
    font-size: 21px;
    overflow-wrap: anywhere;
  }
  .playback-detail p {
    margin: 8px 0;
  }
  [hidden] {
    display: none !important;
  }
  @container viewing-editor (max-width: 640px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 600px) {
    .playback-layout {
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 12px;
      padding-left: 16px;
      padding-right: 16px;
    }
    main {
      padding-top: 16px;
    }
    header {
      flex-wrap: wrap;
    }
    header .primary {
      width: 100%;
    }
    .metrics {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 16px 0;
    }
    .metric {
      padding: 12px;
    }
    .metric strong {
      font-size: 18px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .card-head,
    .editor {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
`, Pt = [
  "now-playing",
  "library",
  "journal",
  "database",
  "settings"
];
function at(n, e, t) {
  const i = (a) => Pt.includes(a) && (e || a === "journal" || a === "library") && (a !== "library" || t), s = new URL(location.href).searchParams.get("companion_page");
  return i(s) ? s : i(n) ? n : "journal";
}
function j(n) {
  const e = new URL(location.href);
  e.searchParams.set("companion_page", n), history.replaceState(history.state, "", e);
}
const A = { ATTRIBUTE: 1, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, Lt = (n) => (...e) => ({ _$litDirective$: n, values: e });
class zt {
  constructor(e) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(e, t, i) {
    this._$Ct = e, this._$AM = t, this._$Ci = i;
  }
  _$AS(e, t) {
    return this.update(e, t);
  }
  update(e, t) {
    return this.render(...t);
  }
}
const Dt = (n) => n.strings === void 0, Ot = {}, Nt = (n, e = Ot) => n._$AH = e;
const jt = Lt(class extends zt {
  constructor(n) {
    if (super(n), n.type !== A.PROPERTY && n.type !== A.ATTRIBUTE && n.type !== A.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!Dt(n)) throw Error("`live` bindings can only contain a single expression");
  }
  render(n) {
    return n;
  }
  update(n, [e]) {
    if (e === $ || e === h) return e;
    const t = n.element, i = n.name;
    if (n.type === A.PROPERTY) {
      if (e === t[i]) return $;
    } else if (n.type === A.BOOLEAN_ATTRIBUTE) {
      if (!!e === t.hasAttribute(i)) return $;
    } else if (n.type === A.ATTRIBUTE && t.getAttribute(i) === e + "") return $;
    return Nt(n), e;
  }
}), Mt = L`
  .library-page {
    margin-top: 24px;
  }
  .library-toolbar,
  .library-toolbar form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 12px;
  }
  .library-toolbar {
    padding: 20px;
  }
  .library-toolbar form {
    flex: 1;
  }
  .library-toolbar form label {
    flex: 1;
    min-width: 150px;
  }
  .library-options {
    width: min(380px, calc(100% - 32px));
  }
  .options-fields {
    display: grid;
    gap: 14px;
  }
  .view-options {
    display: flex;
    gap: 24px;
    border: 1px solid var(--line);
  }
  .view-options .check {
    margin: 0;
  }
  input[type="range"] {
    padding: 0;
  }
  .cover-grid {
    display: grid;
    grid-template-columns: repeat(var(--cover-columns, 1), minmax(0, 1fr));
    gap: 2px;
  }
  .cover-tile {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: 0;
    min-width: 0;
    overflow: hidden;
  }
  .cover-tile > .cover-caption {
    position: absolute;
    bottom: 0;
    inset-inline: 0;
    color: white;
    background: rgb(0 0 0 / 65%);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 2px;
  }
  .cover-image {
    aspect-ratio: 2 / 3;
  }
  .cover-flags {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .cover-flag {
    position: absolute;
    top: 0;
    left: 0;
  }
  .cover-flag.flag-watched,
  .cover-flag.flag-progress {
    width: 52px;
    height: 52px;
    clip-path: polygon(0 0, 100% 0, 0 100%);
  }
  .cover-flag.flag-watched .badge-symbol,
  .cover-flag.flag-progress .badge-symbol {
    position: absolute;
    top: 6px;
    left: 6px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    box-sizing: border-box;
    border-radius: 50%;
    font-size: 17px;
    font-weight: 900;
  }
  .cover-flag.flag-watched .badge-symbol {
    background: #fff;
    color: #19854a;
  }
  .cover-flag.flag-progress .badge-symbol {
    font-size: 0;
    border: 4px solid #ffde8a;
    border-top-color: #fff;
    box-shadow: 0 1px 3px #9a5c00;
  }
  .cover-flag.flag-recent {
    top: 8px;
    left: 8px;
    border-radius: 5px;
    padding: 4px 9px;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 1px 4px #0006;
  }
  .cover-flag.flag-favorite {
    left: auto;
    right: 6px;
    width: 30px;
    height: 43px;
    display: grid;
    justify-items: center;
    padding-top: 4px;
    font-size: 24px;
    box-sizing: border-box;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
  }
  .flag-watched {
    background: #19854a;
    color: #fff;
  }
  .flag-progress {
    background: #d98c06;
    color: #fff;
  }
  .flag-recent {
    background: #1369ac;
    color: #fff;
  }
  .flag-favorite {
    background: #ffc329;
    color: #241600;
  }
  .cover-formats {
    position: absolute;
    inset-inline: 3px;
    bottom: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .has-title .cover-formats {
    bottom: 28px;
  }
  .library-summary-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
  }
  .format-badge,
  .status-badge {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    border-radius: 4px;
    padding: 2px 5px;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.3;
  }
  .format-badge {
    background: #e0ebf6;
    color: #164f7b;
    border: 1px solid #92b4d6;
  }
  .format-four-k,
  .format-cinematic {
    background: #ffbd18;
    color: #171400;
    border-color: #ffbd18;
  }
  .cinematic-label {
    background: #242018;
    color: #ffc329;
    padding: 0 3px;
    margin-left: 3px;
    border-radius: 2px;
  }
  .format-hd {
    background: #236d9e;
    color: #fff;
    border-color: #236d9e;
  }
  .format-vision,
  .format-atmos {
    font-weight: 500;
  }
  .cover-formats .format-badge {
    font-size: 9px;
    padding: 1px 3px;
  }

  .library-table {
    table-layout: fixed;
    width: var(--library-width);
    min-width: 100%;
  }
  .library-table td:first-child {
    min-width: 0;
    max-width: none;
  }
  .library-table th {
    position: relative;
    padding: 0;
  }
  .library-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .library-table .link,
  .library-table td small {
    display: block;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .library-table .sort-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 54px;
    padding: 12px 16px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    white-space: nowrap;
  }
  .sort-heading > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sort-icon {
    flex-shrink: 0;
  }
  .column-resize {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 8px;
    cursor: col-resize;
    touch-action: none;
    border-right: 1px solid var(--line);
  }
  .column-resize:hover {
    background: var(--line);
  }
  .library-table .collection-cell {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .version-tabs {
    margin-bottom: 16px;
  }
  .library-dialog {
    width: min(850px, calc(100% - 32px));
    overflow-wrap: anywhere;
  }
  .library-dialog .playback-layout {
    padding: 24px 0 0;
  }
  .facet-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    gap: 16px;
    margin-top: 20px;
  }
  .facet-groups fieldset {
    min-width: 0;
    border: 1px solid var(--line);
  }
  .facet-options {
    max-height: 220px;
    overflow: auto;
  }
  .facet-options .check {
    margin: 8px 0;
  }

  .library-results {
    overflow: visible;
  }
  .library-toolbar {
    position: sticky;
    top: var(--companion-sticky-top, 0px);
    z-index: 8;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    border-radius: 12px 12px 0 0;
  }
  .library-toolbar form {
    min-width: 0;
  }
  .library-toolbar form label {
    min-width: min(180px, 100%);
  }
  .library-status {
    position: sticky;
    bottom: 0;
    z-index: 7;
    margin-top: 12px;
    padding: 9px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .rating-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    padding: 2px 6px;
    border: 1px solid currentColor;
    font-weight: 800;
    font-size: 12px;
    background: #e8edf2;
    color: #45535f;
    white-space: nowrap;
  }
  .rating-general {
    background: #d5efdd;
    color: #18572c;
  }
  .rating-parental {
    background: #d9eaf8;
    color: #174e78;
  }
  .rating-teen {
    background: #ffebbd;
    color: #704600;
  }
  .rating-restricted,
  .rating-adult {
    background: #f6d6d8;
    color: #8a2330;
  }
  .cover-rating {
    position: absolute;
    bottom: 6px;
    right: 6px;
    max-width: 45%;
    overflow: hidden;
  }
  .cover-rating .rating-badge {
    max-width: 100%;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .has-title .cover-rating {
    bottom: 28px;
  }
  .cover-formats {
    inset-inline-end: auto;
    max-width: 64%;
  }
  .people-filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 16px;
  }
  .people-filters fieldset {
    min-width: 0;
    border: 1px solid var(--line);
  }
  .selected-people {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 8px 0;
  }
  .person-chip {
    padding: 3px 8px;
    min-height: 28px;
    font-size: 12px;
  }
  @media (max-width: 700px) {
    .library-toolbar form {
      flex-basis: 100%;
    }
    .library-toolbar > button {
      flex: 1;
      padding-inline: 8px;
    }
    .people-filters {
      grid-template-columns: 1fr;
    }
  }
  .has-rating .cover-formats {
    max-width: calc(100% - 48px);
  }
  .cover-formats .format-badge {
    max-width: 100%;
    overflow: hidden;
  }
  .cover-formats .cinematic-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
function k(n) {
  const e = n.currentTarget;
  if (n.target !== e) return;
  const t = e.getBoundingClientRect();
  n.clientX >= t.left && n.clientX <= t.right && n.clientY >= t.top && n.clientY <= t.bottom || e.dispatchEvent(new Event("cancel", { cancelable: !0 })) && e.close();
}
class It {
  constructor(e = 128 * 1024 * 1024, t = 1e3) {
    this.maxBytes = e, this.maxEntries = t, this.entries = /* @__PURE__ */ new Map(), this.readers = /* @__PURE__ */ new Map(), this.bytes = 0, this.closed = !1;
  }
  get(e) {
    const t = this.entries.get(e);
    return t && (this.entries.delete(e), this.entries.set(e, t)), t?.url;
  }
  put(e, t) {
    if (this.closed || t.size > this.maxBytes) return;
    const i = this.get(e);
    if (i) return i;
    for (; this.bytes + t.size > this.maxBytes || this.entries.size >= this.maxEntries; ) {
      const a = [...this.entries.keys()], o = a.find(
        (l) => ![...this.readers.get(l) ?? []].some(
          (d) => d.visible()
        )
      ) ?? a[0];
      if (o === void 0) return;
      this.drop(o);
    }
    const s = { url: URL.createObjectURL(t), size: t.size };
    return this.entries.set(e, s), this.bytes += s.size, s.url;
  }
  watch(e, t) {
    if (this.closed) return () => {
    };
    const i = this.readers.get(e) ?? /* @__PURE__ */ new Set();
    return i.add(t), this.readers.set(e, i), () => {
      i.delete(t), i.size || this.readers.delete(e);
    };
  }
  drop(e) {
    const t = this.entries.get(e);
    if (t) {
      this.entries.delete(e), this.bytes -= t.size, URL.revokeObjectURL(t.url);
      for (const i of this.readers.get(e) ?? []) i.invalidate();
    }
  }
  dispose() {
    this.closed = !0;
    for (const e of this.entries.keys()) this.drop(e);
    this.readers.clear();
  }
}
class He {
  constructor() {
    this.cache = new It(), this.active = 0, this.waiting = [];
  }
  acquire(e) {
    return new Promise((t, i) => {
      const s = () => {
        this.waiting = this.waiting.filter((o) => o !== a), i(new DOMException("Aborted", "AbortError"));
      }, a = () => {
        e.removeEventListener("abort", s), this.active++;
        let o = !1;
        t(() => {
          o || (o = !0, this.active--, this.waiting.shift()?.());
        });
      };
      if (e.aborted) return s();
      this.active < 3 ? a() : (this.waiting.push(a), e.addEventListener("abort", s, { once: !0 }));
    });
  }
}
const G = class G extends y {
  constructor() {
    super(...arguments), this.title = "", this.visible = !1, this.generation = 0, this.visibility = () => {
      document.hidden ? this.cancelLoad() : this.load();
    };
  }
  get cacheKey() {
    return JSON.stringify([
      this.scope?.entry_id,
      this.scope?.dataset_id,
      this.artworkKey
    ]);
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.observer = new IntersectionObserver((e) => {
      this.visible = e.some((t) => t.isIntersecting), this.visible ? this.load() : this.cancelLoad();
    }), this.observer.observe(this), this.requestUpdate("queue");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.observer?.disconnect(), this.visible = !1, this.clear();
  }
  updated(e) {
    ["client", "scope", "artworkKey", "queue"].some((t) => e.has(t)) && (this.clear(), this.unwatch = this.queue?.cache.watch(this.cacheKey, {
      invalidate: () => {
        this.url = void 0, this.requestUpdate();
      },
      visible: () => this.visible && this.isConnected && !document.hidden
    }), this.load());
  }
  cancelLoad() {
    this.generation++, this.controller?.abort(), this.controller = void 0;
  }
  clear() {
    this.cancelLoad(), this.unwatch?.(), this.unwatch = void 0, this.url = void 0, this.requestUpdate();
  }
  async load() {
    if (!this.visible || document.hidden || !this.isConnected || this.controller || !this.client || !this.scope?.library_enabled || !this.artworkKey || !this.queue)
      return;
    const e = this.queue.cache.get(this.cacheKey);
    if (e) {
      this.url !== e && (this.url = e, this.requestUpdate());
      return;
    }
    const t = this.generation, i = this.controller = new AbortController();
    let s, a;
    try {
      if (s = await this.queue.acquire(i.signal), i.signal.aborted) return;
      const o = this.queue.cache.get(this.cacheKey);
      if (o) {
        this.url = o, this.requestUpdate();
        return;
      }
      a = setTimeout(() => i.abort(), 5e3);
      const l = await this.client.libraryArtwork(
        this.scope,
        this.artworkKey,
        i.signal
      );
      if (t !== this.generation || i.signal.aborted || !this.isConnected || document.hidden)
        return;
      this.url = this.queue.cache.put(this.cacheKey, l), this.requestUpdate();
    } catch (o) {
      t === this.generation && u(o) === "unauthorized" && this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
      );
    } finally {
      clearTimeout(a), s?.(), t === this.generation && (this.controller = void 0);
    }
  }
  render() {
    return this.url ? r`<img
          src=${this.url}
          alt=${`Cover for ${this.title}`}
          @error=${() => this.queue?.cache.drop(this.cacheKey)}
        />` : r`<span>No cached artwork</span>`;
  }
};
G.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  queue: { attribute: !1 },
  artworkKey: { attribute: !1 },
  title: { type: String }
}, G.styles = L`
    :host {
      display: grid;
      width: 100%;
      height: 100%;
      place-items: center;
      background: var(--secondary-background-color, #262626);
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    span {
      padding: 8px;
      color: var(--secondary-text-color, #888);
      font: inherit;
    }
  `;
let ue = G;
customElements.get("kaleidescape-library-cover") || customElements.define("kaleidescape-library-cover", ue);
class Ee {
  constructor(e, t, i, s, a = "library") {
    this.client = e, this.scope = t, this.shared = i, this.error = s, this.area = a, this.values = {}, this.revision = 0, this.active = !0, this.sequence = 0, this.versions = /* @__PURE__ */ new Map(), this.failed = {};
  }
  async load() {
    const e = await this.client.uiPreferences(
      this.scope,
      this.shared,
      this.area
    );
    return this.active && (this.values = structuredClone(e.values), this.revision = e.revision), this.values;
  }
  set(e) {
    if (!this.active) return;
    Object.assign(this.values, structuredClone(e));
    const t = ++this.sequence;
    for (const s of Object.keys(e))
      this.versions.set(s, t), delete this.failed[s];
    let i;
    try {
      i = this.client.saveUIPreferences(
        this.client.prepareUIPreferences(
          this.scope,
          this.shared,
          this.revision,
          e,
          this.area
        )
      );
    } catch (s) {
      i = Promise.reject(s);
    }
    i.then((s) => {
      this.active && (this.revision = Math.max(this.revision, s.revision), Object.keys(this.failed).length || this.error(null));
    }).catch((s) => {
      if (this.active) {
        for (const [a, o] of Object.entries(e))
          this.versions.get(a) === t && (this.failed[a] = o);
        Object.keys(this.failed).length && this.error(s);
      }
    });
  }
  retry() {
    const e = this.failed;
    this.failed = {}, Object.keys(e).length && this.set(e);
  }
  dispose() {
    this.active = !1, this.values = {}, this.failed = {}, this.versions.clear();
  }
}
function Bt(n) {
  const e = n.watched_status === "in_progress" ? { key: "progress", label: "In progress", symbol: "◔" } : n.watched_status === "watched" ? { key: "watched", label: "Watched", symbol: "✓" } : n.is_recently_added ? { key: "recent", label: "Recently added", symbol: "NEW" } : void 0;
  return [
    ...e ? [e] : [],
    ...n.is_favorite ? [{ key: "favorite", label: "Favorite", symbol: "★" }] : []
  ];
}
function Ae(n) {
  const e = (n.formats?.length ? n.formats : [n.edition ?? ""]).map(
    (s) => s.toLowerCase()
  ), t = (s) => e.some((a) => s.test(a)), i = [];
  return e.some(
    (s) => /\b4k\b/.test(s) && !/\bcinematic\b/.test(s)
  ) && i.push({ key: "four-k", label: "4K" }), e.some((s) => /\b4k\b/.test(s) && /\bcinematic\b/.test(s)) && i.push({ key: "cinematic", label: "4K Cinematic" }), t(/\bhd\b|\b1080p\b/) && i.push({ key: "hd", label: "HD" }), t(/\bsd\b|\b(?:480|576)[pi]\b/) && i.push({ key: "sd", label: "SD" }), t(/\bsdr\b/) && i.push({ key: "sdr", label: "SDR" }), t(/\bhdr10\b/) && i.push({ key: "hdr10", label: "HDR10" }), t(/\bdolby\s*vision\b/) && i.push({ key: "vision", label: "Dolby Vision" }), t(/\bdolby\s*atmos\b/) && i.push({ key: "atmos", label: "Dolby Atmos" }), i;
}
function Ht(n) {
  const e = Ae(n);
  return ["cinematic", "four-k", "hd", "sd"].map((t) => e.find((i) => i.key === t)).find(Boolean);
}
function D(n, e = !1) {
  const t = e ? Ht(n) : void 0;
  return (e ? t ? [t] : [] : Ae(n)).map(
    (i) => r`<span
        class="format-badge format-${i.key}"
        aria-label=${i.label}
        >${i.key === "cinematic" ? r`<b>4K</b><span class="cinematic-label">Cinematic</span>` : i.label}</span
      >`
  );
}
function Fe(n, e = !1) {
  return Bt(n).map(
    (t) => r`<span
        class=${e ? `cover-flag flag-${t.key}` : `status-badge flag-${t.key}`}
        title=${t.label}
        aria-label=${t.label}
        role="img"
        ><span class="badge-symbol" aria-hidden="true"
          >${e ? t.symbol : t.key === "recent" ? "✦" : t.symbol}</span
        >${e ? "" : ` ${t.label}`}</span
      >`
  );
}
function V(n) {
  if (!n?.trim()) return h;
  const e = n.trim(), t = e.toUpperCase().replaceAll(" ", ""), i = {
    G: "general",
    PG: "parental",
    "PG-13": "teen",
    PG13: "teen",
    R: "restricted",
    "NC-17": "adult",
    NC17: "adult"
  }[t] ?? "unrated";
  return r`<span
    class=${`rating-badge rating-${i}`}
    title=${`Rating: ${e}`}
    >${e}</span
  >`;
}
function T(n) {
  return n.toLocaleLowerCase() === "played" ? "Watched" : n;
}
const Q = class Q extends y {
  constructor() {
    super(...arguments), this.revision = 0, this.enabled = !1, this.blocked = !1, this.generation = 0, this.choices = [], this.selected = "", this.loading = !1, this.busy = !1, this.error = "", this.notice = "";
  }
  willUpdate(e) {
    (e.has("client") || e.has("scope") || e.has("version") || e.has("enabled") && !this.enabled) && this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear();
  }
  updated() {
    this.dispatchEvent(
      new CustomEvent("collection-lock", {
        detail: !this.confirmNavigation(),
        bubbles: !0,
        composed: !0
      })
    );
  }
  clear() {
    this.generation++, this.choices = [], this.selected = "", this.loading = this.busy = !1, this.pending = void 0, this.error = this.notice = "", this.renderRoot.querySelector("dialog")?.close();
  }
  confirmNavigation() {
    return !this.busy && !this.pending;
  }
  close(e) {
    e?.preventDefault(), this.confirmNavigation() && (this.generation++, this.loading = !1, this.renderRoot.querySelector("dialog")?.close(), this.requestUpdate());
  }
  fail(e) {
    this.error = v(e), ["unauthorized", "library_disabled"].includes(u(e)) && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        u(e) === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    ));
  }
  async open() {
    if (!this.client || !this.scope || !this.version || !this.enabled || this.blocked)
      return;
    const e = ++this.generation;
    if (this.loading = !0, this.error = this.notice = this.selected = "", this.choices = [], this.requestUpdate(), await this.updateComplete, !(e !== this.generation || !this.isConnected)) {
      this.renderRoot.querySelector("dialog")?.showModal();
      try {
        const t = await this.client.collectionTargets(
          this.scope,
          this.version.id,
          this.revision
        );
        e === this.generation && (this.choices = t.collections);
      } catch (t) {
        e === this.generation && this.fail(t);
      } finally {
        e === this.generation && (this.loading = !1, this.requestUpdate());
      }
    }
  }
  changed(e) {
    this.dispatchEvent(
      new CustomEvent("collection-changed", {
        detail: e,
        bubbles: !0,
        composed: !0
      })
    );
  }
  complete(e) {
    this.pending = void 0, this.busy = !1, this.notice = e.status === "confirmed" ? "Collection membership confirmed on the device." : e.status === "abandoned" ? "The request was acknowledged without sending another add." : "The add is not confirmed. Close this window and check the pending request on the Library page.", this.close(), this.changed(e);
  }
  async submit() {
    if (!this.client || !this.scope || !this.version || !this.selected || this.busy || this.pending)
      return;
    try {
      this.pending = this.client.prepareCollectionAdd(
        this.scope,
        this.version.id,
        this.selected,
        this.revision
      );
    } catch (t) {
      this.fail(t), this.requestUpdate();
      return;
    }
    const e = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const t = await this.client.collectionAdd(this.pending);
      e === this.generation && this.complete(t);
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  async check() {
    if (!this.client || !this.scope || !this.pending || this.busy) return;
    const e = this.generation;
    this.busy = !0, this.error = "", this.requestUpdate();
    try {
      const t = await this.client.collectionCheck(
        this.scope,
        String(this.pending.message.request_id)
      );
      e === this.generation && this.complete(t);
    } catch (t) {
      e === this.generation && (u(t) === "not_found" ? (this.pending = void 0, this.error = "No accepted add request was found. Refresh title details before starting another add.") : this.fail(t));
    } finally {
      e === this.generation && (this.busy = !1, this.requestUpdate());
    }
  }
  render() {
    return !this.scope?.permissions.edit || !this.version || !this.enabled ? h : r`<button
        ?disabled=${this.blocked || this.busy}
        @click=${this.open}
      >
        Add to Collection…
      </button>
      ${this.notice ? r`<p role="status">${this.notice}</p>` : h}
      <dialog
        class="database-dialog"
        @click=${k}
        @cancel=${this.close}
        aria-labelledby="collection-add-title"
      >
        <div class="card-head">
          <h2 id="collection-add-title">Add to Collection</h2>
          <button ?disabled=${this.busy || !!this.pending} @click=${this.close}>
            Cancel
          </button>
        </div>
        <p>
          <strong>${this.version.title}</strong> ·
          ${this.version.year ?? "Year unknown"} ·
          ${this.version.formats?.join(", ") || this.version.edition || "Format unknown"}
        </p>
        <p>
          This sends one version to one existing collection on your
          Kaleidescape. Other memberships are preserved. Removal is not
          supported.
        </p>
        ${this.loading ? r`<p role="status">Reading available collections from the device…</p>` : h}
        ${this.error ? r`<p role="alert" class="error">${this.error}</p>` : h}
        ${this.pending ? r`<p class="warning">
                  ${this.busy ? "Waiting for the device and read-back verification…" : "The result is unconfirmed. Check its status without sending another add."}
                </p>
                <button ?disabled=${this.busy} @click=${this.check}>
                  Check add result
                </button>` : r`<label
                  >Collection<select
                    name="add_collection"
                    ?disabled=${this.loading}
                    .value=${this.selected}
                    @change=${(e) => {
      this.selected = e.target.value, this.requestUpdate();
    }}
                  >
                    <option value="">Choose a collection</option>
                    ${this.choices.map((e) => r`<option value=${e}>${e}</option>`)}
                  </select></label
                >
                ${!this.loading && !this.choices.length && !this.error ? r`<p>No offered, visible collection targets are available. Sync or check the server’s collections.</p>` : h}
                <button
                  class="primary"
                  ?disabled=${this.loading || !this.selected}
                  @click=${this.submit}
                >
                  Add selected version
                </button>`}
      </dialog>`;
  }
};
Q.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  version: { attribute: !1 },
  revision: { type: Number },
  enabled: { type: Boolean },
  blocked: { type: Boolean }
}, Q.styles = S;
let ge = Q;
customElements.get("kaleidescape-library-collection-add") || customElements.define(
  "kaleidescape-library-collection-add",
  ge
);
const U = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["rating", "Rating", "rating"]
], We = [
  ["name", "Title"],
  ["year", "Year"],
  ["collection", "Collection"],
  ["length", "Length"],
  ["watched", "Status"],
  ["added", "Added on"]
], Ve = [
  ["show_titles", "Show titles on covers"],
  ["show_format", "Show format"],
  ["show_badges", "Show library badges"],
  ["show_rating", "Show rating on covers"]
], J = {
  watched: "Watched",
  unwatched: "Unwatched",
  in_progress: "In progress",
  unknown: "Unknown"
}, X = class X extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.listRequest = 0, this.statusRequest = 0, this.versionRequest = 0, this.versionsLoading = !1, this.versionsError = "", this.widths = [360, 90, 260, 150, 140, 210], this.collectionLocked = !1, this.checkingCollection = !1, this.filters = {
      query: "",
      sort: "name",
      descending: !1
    }, this.applied = { ...this.filters }, this.loading = !1, this.requesting = !1, this.error = "", this.notice = "", this.covers = new He(), this.mode = "list", this.coverSize = 150, this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1
    }, this.entriesPerPage = 100, this.preferencesReady = !1, this.preferenceError = "", this.peopleTimers = {}, this.peopleSearch = {}, this.peopleChoices = {}, this.peopleRequests = {}, this.coverColumns = 1, this.gridWidth = 0, this.requestLimit = 50, this.requestedOffset = 0, this.draft = {}, this.facetSearch = "", this.visibility = () => {
      clearTimeout(this.timer), document.hidden ? (clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0) : (this.refreshStatus(), this.scheduleLayoutPage());
    };
  }
  confirmNavigation() {
    return !(this.collectionLocked || this.checkingCollection);
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    this.boundClient === this.client && this.bound === t || (this.clear(), this.boundClient = this.client, this.bound = t, this.client && this.scope?.library_enabled && (this.initializePreferences(), this.refreshStatus()));
  }
  async initializePreferences() {
    if (!this.client || !this.scope) return;
    const e = this.generation;
    this.preferences = new Ee(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && u(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? v(t) : "", this.requestUpdate()));
      }
    );
    try {
      const t = await this.preferences.load();
      if (e !== this.generation) return;
      this.mode = t.view, this.entriesPerPage = t.page_size, this.coverSize = t.cover_size, this.display = Object.fromEntries(
        Ve.map(([i]) => [i, t[i]])
      ), this.widths = [...t.widths], this.applied = Object.fromEntries(
        [
          "query",
          "sort",
          "descending",
          ...U.map(([i]) => i),
          "status"
        ].map((i) => [i, t[i]])
      ), this.filters = structuredClone(this.applied), this.preferencesReady = !0, await this.load();
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  saveFilters() {
    this.preferences?.set(
      Object.fromEntries(
        ["query", ...U.map(([e]) => e), "status"].map((e) => [
          e,
          this.applied[e] ?? (e === "query" ? "" : [])
        ])
      )
    );
  }
  finishColumnResize() {
    this.resize && (this.resize = void 0, this.preferences?.set({ widths: [...this.widths] }));
  }
  clear() {
    clearTimeout(this.searchTimer), this.clearPeople(), this.preferences?.dispose(), this.preferences = void 0, this.preferencesReady = !1, this.preferenceError = "", this.generation++, this.listRequest++, clearTimeout(this.timer), clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0, this.gridObserver?.disconnect(), this.gridObserver = void 0, this.grid = void 0, this.gridWidth = 0, this.coverColumns = 1, this.entriesPerPage = this.requestLimit = 100, this.requestedOffset = 0;
    for (const e of this.renderRoot.querySelectorAll("dialog"))
      e.close();
    this.covers.cache.dispose(), this.covers = new He(), this.display = {
      show_titles: !0,
      show_format: !0,
      show_badges: !0,
      show_rating: !1
    }, this.draft = {}, this.facetSearch = "", this.page = this.info = this.selected = void 0, this.collectionLocked = this.checkingCollection = !1, this.clearVersions(), this.widths = [360, 90, 260, 150, 140, 210], this.resize = void 0, this.filters = { query: "", sort: "name", descending: !1 }, this.applied = { ...this.filters }, this.loading = this.requesting = !1, this.error = this.notice = "", this.requestUpdate();
  }
  updated() {
    for (const [t, i] of [
      ["library_page_size", String(this.entriesPerPage)],
      ["library_sort", String(this.applied.sort)]
    ]) {
      const s = this.renderRoot.querySelector(
        `[name="${t}"]`
      );
      s && s.value !== i && (s.value = i);
    }
    const e = this.isConnected && this.mode === "covers" && this.scope?.library_enabled && this.client ? this.renderRoot.querySelector(".cover-grid") ?? void 0 : void 0;
    e !== this.grid && (this.gridObserver?.disconnect(), this.grid = e, e && (this.gridObserver = new ResizeObserver((t) => {
      const i = t.find((s) => s.target === this.grid);
      i && this.isConnected && this.fitGrid(i.contentRect.width);
    }), this.gridObserver.observe(e))), e && this.fitGrid(e.getBoundingClientRect().width || this.gridWidth);
  }
  get pageSize() {
    return this.entriesPerPage === "all" ? 1e3 : this.mode === "list" ? this.entriesPerPage : Math.max(
      this.coverColumns,
      Math.floor(this.entriesPerPage / this.coverColumns) * this.coverColumns
    );
  }
  fitGrid(e) {
    if (!this.isConnected || !Number.isFinite(e) || e <= 0 || this.mode !== "covers")
      return;
    this.gridWidth = e;
    const t = Math.max(
      1,
      Math.min(1e3, Math.floor((e + 2) / (this.coverSize + 2)))
    );
    t !== this.coverColumns && (this.coverColumns = t, this.requestUpdate()), this.scheduleLayoutPage();
  }
  scheduleLayoutPage() {
    if (!(!this.client || !this.scope?.library_enabled || !this.isConnected || document.hidden)) {
      if (this.pageSize === this.requestLimit) {
        clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
        return;
      }
      this.layoutTimer && this.pendingLimit === this.pageSize || (clearTimeout(this.layoutTimer), this.pendingLimit = this.pageSize, this.layoutTimer = setTimeout(() => {
        this.layoutTimer = void 0, this.pendingLimit = void 0;
        const e = this.loading ? this.requestedOffset : this.page?.offset ?? 0;
        this.load(Math.floor(e / this.pageSize) * this.pageSize, !0);
      }, 100), this.requestUpdate());
    }
  }
  async setMode(e) {
    this.mode !== e && (this.mode = e, this.preferences?.set({ view: e }), this.requestUpdate(), await this.updateComplete, this.scheduleLayoutPage());
  }
  changePageSize(e) {
    const t = e.target.value, i = t === "all" ? "all" : Number(t);
    i !== "all" && ![25, 100, 1e3].includes(i) || (this.entriesPerPage = i, this.preferences?.set({ page_size: i }), this.requestUpdate(), this.scheduleLayoutPage());
  }
  fail(e) {
    const t = u(e);
    (t === "unauthorized" || t === "library_disabled") && (this.clear(), this.dispatchEvent(
      new CustomEvent(
        t === "unauthorized" ? "access-denied" : "library-disabled",
        { bubbles: !0, composed: !0 }
      )
    )), this.error = v(e), this.requestUpdate();
  }
  async load(e = 0, t = !1) {
    if (this.collectionLocked || !this.client || !this.scope?.library_enabled) return;
    clearTimeout(this.layoutTimer), this.layoutTimer = void 0, this.pendingLimit = void 0;
    const i = this.generation, s = ++this.listRequest, a = this.pageSize;
    this.requestLimit = a, this.requestedOffset = e, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const o = this.entriesPerPage === "all" ? await this.client.libraryAll(
        this.scope,
        { ...this.applied },
        () => i === this.generation && s === this.listRequest
      ) : await this.client.libraryList(this.scope, {
        ...this.applied,
        grouped: !0,
        limit: a,
        offset: e,
        ...e && this.page ? {
          revision: this.page.revision,
          ...this.page.preferences_key ? { preferences_key: this.page.preferences_key } : {}
        } : {}
      });
      if (i !== this.generation || s !== this.listRequest || a !== this.pageSize)
        return;
      this.page = o, this.selected && (this.selected = o.items.find((l) => l.id === this.selected?.id) ?? (t ? this.selected : void 0), this.selected ? this.versions && (this.versions.revision !== o.revision || this.versions.preferences_key !== o.preferences_key) && this.loadVersions() : this.closeDialog("title-dialog"));
    } catch (o) {
      i === this.generation && s === this.listRequest && this.fail(o);
    } finally {
      i === this.generation && s === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  async refreshStatus() {
    if (!this.client || !this.scope?.library_enabled || document.hidden || !this.isConnected)
      return;
    clearTimeout(this.timer);
    const e = this.generation, t = ++this.statusRequest;
    let i = !1;
    try {
      const s = await this.client.libraryInfo(this.scope);
      if (e !== this.generation || t !== this.statusRequest)
        return;
      this.info = s, this.page && (this.page.revision !== s.revision || this.page.preferences_key !== s.preferences_key) && !this.loading && this.load();
    } catch (s) {
      i = u(s) === "unauthorized", e === this.generation && t === this.statusRequest && this.fail(s);
    } finally {
      e === this.generation && t === this.statusRequest && this.isConnected && !i && !document.hidden && (this.timer = setTimeout(
        () => {
          this.refreshStatus();
        },
        !this.info?.phase || this.info.phase === "idle" ? 3e4 : 5e3
      ), this.requestUpdate());
    }
  }
  async sync() {
    if (!this.client || !this.scope?.permissions.edit || this.requesting)
      return;
    const e = this.generation;
    this.requesting = !0, this.error = this.notice = "", this.requestUpdate();
    try {
      if (await this.client.librarySync(this.scope), e !== this.generation) return;
      this.notice = "Library sync requested. Cached titles remain available while it runs.", this.refreshStatus();
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.requesting = !1, this.requestUpdate());
    }
  }
  async openDialog(e) {
    this.requestUpdate(), await this.updateComplete, this.isConnected && this.renderRoot.querySelector(`#${e}`)?.showModal();
  }
  closeDialog(e) {
    e === "filter-dialog" && this.clearPeople(), !(e === "title-dialog" && this.collectionLocked) && (this.renderRoot.querySelector(`#${e}`)?.close(), e === "title-dialog" && (this.selected = void 0, this.clearVersions()), this.requestUpdate());
  }
  select(e) {
    this.clearVersions(), this.selected = e, this.openDialog("title-dialog"), this.loadVersions();
  }
  clearVersions() {
    this.collectionLocked = !1, this.versionRequest++, this.versions = void 0, this.activeVersion = void 0, this.versionsError = "", this.versionsLoading = !1;
  }
  async loadVersions(e = 0) {
    if (this.collectionLocked || !this.client || !this.scope || !this.selected) return;
    const t = this.generation, i = ++this.versionRequest, s = this.selected.id;
    this.versionsLoading = !0, this.versionsError = "", this.activeVersion = void 0, this.requestUpdate();
    try {
      const a = await this.client.libraryVersions(
        this.scope,
        s,
        e,
        this.page?.revision
      );
      if (t !== this.generation || i !== this.versionRequest || this.selected?.id !== s)
        return;
      this.versions = a, this.activeVersion = a.items.find((o) => o.id === s) ?? a.items[0];
    } catch (a) {
      t === this.generation && i === this.versionRequest && (["unauthorized", "library_disabled"].includes(u(a)) ? this.fail(a) : this.versionsError = v(a));
    } finally {
      t === this.generation && i === this.versionRequest && (this.versionsLoading = !1, this.requestUpdate());
    }
  }
  format(e) {
    const t = e.formats ?? (e.edition && e.edition.toLowerCase() !== "multiple" ? [e.edition] : []);
    return t.length ? t.join(", ") + (e.formats_truncated ? "…" : "") : "Formats unavailable · sync library to refresh";
  }
  years(e) {
    return e.years?.join(", ") || String(e.year ?? "—");
  }
  runtime(e) {
    if (e.duration_seconds === null) return "Unknown";
    const t = (e.duration_seconds / 60).toFixed(2), i = e.maximum_duration_seconds;
    return `${t}${i != null && i !== e.duration_seconds ? `–${(i / 60).toFixed(2)}` : ""} min`;
  }
  resizeColumn(e, t) {
    ["ArrowLeft", "ArrowRight", "Home"].includes(e.key) && (e.preventDefault(), this.widths[t] = e.key === "Home" ? [360, 90, 260, 150, 140, 210][t] : Math.max(
      80,
      Math.min(
        800,
        this.widths[t] + (e.key === "ArrowLeft" ? -20 : 20)
      )
    ), this.preferences?.set({ widths: [...this.widths] }), this.requestUpdate());
  }
  versionKey(e) {
    if (this.collectionLocked || !this.versions?.items.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
      return;
    e.preventDefault();
    const t = this.versions.items, i = t.findIndex(
      (a) => a.id === this.activeVersion?.id
    ), s = e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : (i + (e.key === "ArrowLeft" ? -1 : 1) + t.length) % t.length;
    this.activeVersion = t[s], this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#version-${s}`)?.focus()
    );
  }
  sort(e) {
    this.applied = {
      ...this.applied,
      sort: e,
      descending: this.applied.sort === e ? !this.applied.descending : !1
    }, this.preferences?.set({
      sort: this.applied.sort,
      descending: this.applied.descending
    }), this.load();
  }
  openFilters() {
    this.clearPeople(), this.draft = structuredClone(this.applied), this.facetSearch = "", this.openDialog("filter-dialog");
  }
  clearFilters() {
    clearTimeout(this.searchTimer), this.filters = {
      query: "",
      sort: this.applied.sort,
      descending: this.applied.descending
    }, this.applied = { ...this.filters }, this.draft = {}, this.facetSearch = "", this.saveFilters(), this.load();
  }
  clearPeople() {
    for (const e of Object.values(this.peopleTimers)) clearTimeout(e);
    this.peopleTimers = {}, this.peopleSearch = {}, this.peopleChoices = {};
    for (const e of ["actor", "director"])
      this.peopleRequests[e] = (this.peopleRequests[e] ?? 0) + 1;
  }
  completePeople(e, t) {
    this.peopleSearch[e] = t, clearTimeout(this.peopleTimers[e]);
    const i = (this.peopleRequests[e] ?? 0) + 1;
    this.peopleRequests[e] = i;
    const s = this.generation;
    this.peopleTimers[e] = setTimeout(async () => {
      try {
        const a = await this.client.librarySuggestions(
          this.scope,
          e,
          t
        );
        s === this.generation && this.peopleRequests[e] === i && this.renderRoot.querySelector("#filter-dialog")?.open && (this.peopleChoices[e] = a.items, this.requestUpdate());
      } catch (a) {
        s === this.generation && this.peopleRequests[e] === i && this.fail(a);
      }
    }, 200), this.requestUpdate();
  }
  applySearch() {
    clearTimeout(this.searchTimer), this.applied = { ...this.applied, query: this.filters.query }, this.preferences?.set({ query: this.applied.query }), this.load();
  }
  choices(e, t) {
    const i = e === "status" ? Object.keys(J) : this.page?.facets[t] ?? [];
    return [
      .../* @__PURE__ */ new Set([...i, ...this.draft[e] ?? []])
    ].filter(
      (s) => (e === "collection" ? T(s) : s).toLocaleLowerCase().includes(this.facetSearch.toLocaleLowerCase())
    );
  }
  cover(e) {
    return r`<kaleidescape-library-cover
      .client=${this.client}
      .scope=${this.scope}
      .queue=${this.covers}
      .artworkKey=${e.artwork_key}
      .title=${e.title}
    ></kaleidescape-library-cover>`;
  }
  date(e) {
    return e ? new Date(
      e.length === 10 ? `${e}T00:00:00` : e
    ).toLocaleString(void 0, {
      dateStyle: "medium",
      ...e.length === 10 ? {} : { timeStyle: "short" }
    }) : "Not yet synced";
  }
  async checkCollection(e, t = !1) {
    if (!this.client || !this.scope || this.checkingCollection || t && !window.confirm(
      "Inspect the collection on the device first. Acknowledging does not undo an add or send another one; it allows a new request even if this add already applied. Continue?"
    ))
      return;
    const i = this.generation;
    this.checkingCollection = !0, this.error = "", this.requestUpdate();
    try {
      const s = await (t ? this.client.collectionAcknowledge(this.scope, e) : this.client.collectionCheck(this.scope, e));
      if (i !== this.generation) return;
      this.notice = s.status === "confirmed" ? "Collection membership confirmed on the device." : s.status === "abandoned" ? "Request acknowledged. No device edit was sent." : "The requested membership is not confirmed. Inspect the device before acknowledging this request.", this.load(), this.refreshStatus();
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.checkingCollection = !1, this.requestUpdate());
    }
  }
  renderOptionsDialog() {
    return r`<dialog
      id="library-options"
      class="database-dialog library-options"
      aria-labelledby="library-options-title"
      @click=${k}
    >
      <div class="card-head">
        <h2 id="library-options-title">Library options</h2>
        <button @click=${() => this.closeDialog("library-options")}>
          Done
        </button>
      </div>
      <p class="muted">Changes save automatically for your HA user.</p>
      <div class="options-fields">
        <fieldset class="view-options">
          <legend>View type</legend>
          ${["list", "covers"].map((e) => r`<label class="check"><input type="radio" name="library_view" value=${e} .checked=${this.mode === e} @change=${() => this.setMode(e)} />${e === "list" ? "List" : "Cover"}</label>`)}
        </fieldset>
        <label
          >Entries per page<select
            name="library_page_size"
            .value=${String(this.entriesPerPage)}
            @change=${this.changePageSize}
          >
            ${[25, 100, 1e3, "all"].map((e) => r`<option value=${e} ?selected=${e === this.entriesPerPage}>${e === "all" ? "All" : e}</option>`)}
          </select></label
        >
        ${this.mode === "covers" ? r`<label
                >Cover-art size<input
                  type="range"
                  name="cover_size"
                  min="90"
                  max="300"
                  step="10"
                  .value=${String(this.coverSize)}
                  @change=${() => this.preferences?.set({ cover_size: this.coverSize })}
                  @input=${(e) => {
      this.coverSize = Number(
        e.target.value
      ), this.fitGrid(this.gridWidth), this.requestUpdate();
    }}
              /></label>` : h}
        ${Ve.map(
      ([e, t]) => r`<label class="check"
              ><input
                type="checkbox"
                name=${e}
                .checked=${this.display[e]}
                @change=${(i) => {
        const s = i.target.checked;
        this.display = { ...this.display, [e]: s }, this.preferences?.set({ [e]: s }), this.requestUpdate();
      }}
              />${t}</label
            >`
    )}
        <label
          >Sort by<select
            name="library_sort"
            .value=${String(this.applied.sort)}
            @change=${(e) => this.sort(e.target.value)}
          >
            ${We.map(([e, t]) => r`<option value=${e}>${t}</option>`)}
          </select></label
        >
        <button @click=${() => this.sort(String(this.applied.sort))}>
          ${this.applied.descending ? "Descending ↓" : "Ascending ↑"}
        </button>
      </div>
      ${this.info ? r`<details>
              <summary>Library details</summary>
              <p>
                ${this.info.group_count} movies · ${this.info.title_count}
                individual versions · ${this.info.collection_count} collections.
              </p>
              <p>
                Catalog synced: ${this.date(this.info.last_synced_at)}<br />Collections
                synced: ${this.date(this.info.collections_synced_at)}
              </p>
              <p>
                Source “Played” maps to Watched; “Paused” maps to In progress.
              </p>
            </details>` : h}
    </dialog>`;
  }
  renderFilterDialog() {
    return r`<dialog
      id="filter-dialog"
      @click=${k}
      class="database-dialog library-dialog"
      aria-labelledby="filters-title"
    >
      <div class="card-head">
        <h2 id="filters-title">Library filters</h2>
        <button @click=${() => this.closeDialog("filter-dialog")}>
          Cancel
        </button>
      </div>
      <p>
        Match any checked value within a category and all selected categories.
      </p>
      <label
        >Find collections or ratings<input
          name="facet_search"
          type="search"
          .value=${this.facetSearch}
          @input=${(e) => {
      this.facetSearch = e.target.value, this.requestUpdate();
    }}
      /></label>
      ${this.page?.truncated_facets.length ? r`<p class="muted">Each category shows up to 500 known names.</p>` : h}
      <div class="facet-groups">
        ${[["status", "Watched status", "status"], U[0], U[3]].map(
      ([e, t, i]) => {
        const s = this.draft[e] ?? [], a = this.choices(e, i);
        return r`<fieldset>
              <legend>${t}</legend>
              <div class="facet-options">
                ${a.length ? a.map(
          (o) => r`<label class="check"
                            ><input
                              type="checkbox"
                              name=${e}
                              .value=${o}
                              .checked=${s.includes(o)}
                              ?disabled=${s.length >= 100 && !s.includes(o)}
                              @change=${(l) => {
            this.draft = {
              ...this.draft,
              [e]: l.target.checked ? [...s, o] : s.filter((d) => d !== o)
            }, this.requestUpdate();
          }}
                            />${e === "status" ? J[o] : e === "rating" ? V(o) : e === "collection" ? T(o) : o}</label
                          >`
        ) : r`<p class="muted">No matching options</p>`}
              </div>
            </fieldset>`;
      }
    )}
      </div>
      <div class="people-filters">
        ${[
      ["actor", "Actor", "actors"],
      ["director", "Director", "directors"]
    ].map(([e, t, i]) => {
      const s = this.draft[e] ?? [], a = (this.peopleChoices[e] ?? this.page?.facets[i] ?? []).filter(
        (o) => o.toLocaleLowerCase().includes((this.peopleSearch[e] ?? "").toLocaleLowerCase())
      ).slice(0, 20);
      return r`<fieldset>
            <legend>${t}</legend>
            <label
              >Find ${t.toLowerCase()}<input
                type="search"
                name=${`${e}_search`}
                maxlength="100"
                autocomplete="off"
                .value=${this.peopleSearch[e] ?? ""}
                @input=${(o) => this.completePeople(e, o.target.value)}
            /></label>
            <div class="selected-people">
              ${s.map(
        (o) => r`<button
                    type="button"
                    class="person-chip"
                    aria-label=${`Remove ${o}`}
                    @click=${() => {
          this.draft = {
            ...this.draft,
            [e]: s.filter((l) => l !== o)
          }, this.requestUpdate();
        }}
                  >
                    ${o} ×
                  </button>`
      )}
            </div>
            <div class="facet-options" aria-label=${`${t} suggestions`}>
              ${a.map(
        (o) => r`<label class="check"
                    ><input
                      type="checkbox"
                      name=${e}
                      value=${o}
                      .checked=${s.includes(o)}
                      ?disabled=${s.length >= 100 && !s.includes(o)}
                      @change=${(l) => {
          this.draft = {
            ...this.draft,
            [e]: l.target.checked ? [...s, o] : s.filter((d) => d !== o)
          }, this.requestUpdate();
        }}
                    />${o}</label
                  >`
      )}
            </div>
          </fieldset>`;
    })}
      </div>
      <div class="actions dialog-footer">
        <button
          @click=${() => {
      this.draft = {}, this.requestUpdate();
    }}
        >
          Clear filters</button
        ><button
          class="primary"
          @click=${() => {
      const e = { ...this.applied };
      for (const t of [...U.map(([i]) => i), "status"])
        e[t] = this.draft[t] ?? [];
      this.applied = e, this.saveFilters(), this.closeDialog("filter-dialog"), this.load();
    }}
        >
          Apply filters
        </button>
      </div>
    </dialog>`;
  }
  renderTitleDialog() {
    const e = this.selected, t = this.activeVersion, i = this.scope?.permissions.edit;
    return r`<dialog
      id="title-dialog"
      @cancel=${(s) => {
      this.collectionLocked && s.preventDefault();
    }}
      @click=${k}
      class="database-dialog library-dialog"
      aria-labelledby="library-title"
      @close=${() => {
      this.selected = void 0, this.clearVersions(), this.requestUpdate();
    }}
    >
      ${e ? r`<div class="card-head">
                <h2 id="library-title">
                  ${e.title}${e.year ? ` (${e.year})` : ""}
                </h2>
                <button
                  ?disabled=${this.collectionLocked}
                  @click=${() => this.closeDialog("title-dialog")}
                >
                  Close
                </button>
              </div>
              <p>${e.version_count ?? 1} version(s)</p>
              <div class="detail-badges">
                ${D(e)} ${V(e.rating)}
              </div>
              ${this.versionsLoading ? r`<p role="status">Loading individual versions…</p>` : h}
              ${this.versionsError ? r`<p class="error" role="alert">${this.versionsError}</p>
                      <button
                        @click=${async () => {
      await this.load(), this.loadVersions();
    }}
                      >
                        Refresh title details
                      </button>` : h}
              ${this.versions ? r`<div
                        class="page-tabs version-tabs"
                        role="tablist"
                        aria-label="Title versions"
                        @keydown=${this.versionKey}
                      >
                        ${this.versions.items.map(
      (s, a) => r`<button
                              ?disabled=${this.collectionLocked}
                              role="tab"
                              id=${`version-${a}`}
                              aria-controls="version-details"
                              tabindex=${s.id === t?.id ? 0 : -1}
                              aria-selected=${s.id === t?.id}
                              @click=${() => {
        this.activeVersion = s, this.requestUpdate();
      }}
                            >
                              ${D(s)} ·
                              ${s.year ?? "Year unknown"} · Version
                              ${this.versions.offset + a + 1}
                            </button>`
    )}
                      </div>
                      ${this.versions.total > 50 ? r`<div class="actions"><button ?disabled=${!this.versions.offset || this.versionsLoading} @click=${() => this.loadVersions(Math.max(0, this.versions.offset - 50))}>Previous versions</button><button ?disabled=${!this.versions.has_more || this.versionsLoading} @click=${() => this.loadVersions(this.versions.offset + 50)}>Next versions</button></div>` : h}` : h}
              ${t ? r`<div
                      class="playback-layout"
                      id="version-details"
                      role="tabpanel"
                      aria-labelledby=${`version-${this.versions?.items.findIndex((s) => s.id === t.id) ?? 0}`}
                    >
                      <div class="cover">${this.cover(t)}</div>
                      <div>
                        <p>${t.synopsis || "No synopsis available."}</p>
                        <div class="detail-badges">
                          ${D(t)}
                          ${V(t.rating || "Unrated")}
                        </div>
                        <p>
                          ${t.year ?? "Year unknown"} ·
                          ${J[t.watched_status]}
                        </p>
                        <p>
                          ${t.duration_seconds === null ? "Runtime unknown" : `${(t.duration_seconds / 60).toFixed(2)} min`}
                        </p>
                        ${[
      ["Collections", t.collections],
      ["Cast", t.actors],
      ["Directors", t.directors],
      ["Genres", t.genres]
    ].map(
      ([s, a]) => a.length ? r`<p>
                                <strong>${s}:</strong>
                                ${(s === "Collections" ? a.map(T) : a).join(", ")}
                              </p>` : h
    )}
                        <p class="muted">
                          ${t.purchased_on ? r`Purchased ${this.date(t.purchased_on)}<br />` : h}
                          First detected ${this.date(t.first_seen)}.
                        </p>
                        ${i ? r`<kaleidescape-library-collection-add
                                .client=${this.client}
                                .scope=${this.scope}
                                .version=${t}
                                .revision=${this.versions?.revision ?? 0}
                                .enabled=${!!this.info?.collection_add_enabled}
                                .blocked=${!!this.info?.pending_adds?.length}
                                @collection-lock=${(s) => {
      s.detail !== this.collectionLocked && (this.collectionLocked = s.detail, this.requestUpdate());
    }}
                                @collection-changed=${(s) => {
      this.collectionLocked = !1, this.notice = s.detail.status === "confirmed" ? "Collection membership confirmed on the device." : "Check the pending collection add before making another change.", this.load(), this.refreshStatus();
    }}
                              ></kaleidescape-library-collection-add>` : h}
                      </div>
                    </div>` : h}` : h}
    </dialog>`;
  }
  render() {
    if (!this.preferencesReady)
      return r`<p role="status">
          ${this.error || "Loading Library preferences…"}
        </p>
        ${this.error ? r`<button @click=${this.initializePreferences}>Retry Library</button>` : h}`;
    const e = this.page?.limit ?? this.requestLimit, t = this.loading || !!this.layoutTimer, i = this.page?.items ?? [], s = this.mode === "covers" && this.page?.has_more && i.length >= this.coverColumns ? i.slice(
      0,
      i.length - i.length % this.coverColumns
    ) : i, a = this.scope?.permissions.edit, o = [...U.map(([l]) => l), "status"].reduce(
      (l, d) => l + (this.applied[d]?.length ?? 0),
      0
    );
    return r`<section
      class="library-page"
      @access-denied=${(l) => {
      l.stopPropagation(), this.fail(new p("unauthorized"));
    }}
    >
      ${this.preferenceError ? r`<p class="warning" role="alert">Library preferences could not be saved: ${this.preferenceError} <button @click=${() => this.preferences?.retry()}>Retry saving preferences</button></p>` : h}
      <div class="section-head">
        <h2>Library</h2>
        <div class="actions">
          <button
            ?disabled=${this.loading}
            @click=${() => {
      this.load(), this.refreshStatus();
    }}
          >
            Refresh cached data
          </button>
          ${a ? r`<button class="primary" ?disabled=${this.requesting || !!this.info?.phase && this.info.phase !== "idle"} @click=${this.sync}>Sync now</button>` : h}
        </div>
      </div>
      ${a && this.info?.phase && this.info.phase !== "idle" ? r`<p role="status">Syncing… ${this.info.processed ?? 0}/${this.info.total ?? "?"}</p>` : h}
      ${a && this.info?.error ? r`<p class="warning" role="status">${v(new p(this.info.error))}</p>` : h}
      ${this.error ? r`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : h}
      ${this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : h}
      ${a ? (this.info?.pending_adds ?? []).map(
      (l) => r`<div class="warning" role="status">
                  Unconfirmed collection add: <strong>${l.title}</strong> →
                  ${l.collection}. Checking never sends another add.
                  <div class="actions">
                    <button
                      ?disabled=${this.checkingCollection}
                      @click=${() => this.checkCollection(l.request_id)}
                    >
                      Check membership</button
                    ><button
                      ?disabled=${this.checkingCollection}
                      @click=${() => this.checkCollection(l.request_id, !0)}
                    >
                      Acknowledge unconfirmed add
                    </button>
                  </div>
                </div>`
    ) : h}
      <section class="card library-results">
        <div class="library-toolbar">
          <form
            @submit=${(l) => {
      l.preventDefault(), this.applySearch();
    }}
          >
            <label
              >Search titles, actors or directors<input
                name="library_query"
                type="search"
                maxlength="500"
                .value=${jt(String(this.filters.query ?? ""))}
                @input=${(l) => {
      this.filters.query = l.target.value, clearTimeout(this.searchTimer), this.searchTimer = setTimeout(() => this.applySearch(), 300);
    }}
            /></label>
            <button type="submit" ?disabled=${this.loading}>Search</button>
          </form>
          <button @click=${this.openFilters}>
            Filters${o ? ` (${o})` : ""}
          </button>
          <button ?disabled=${this.loading} @click=${this.clearFilters}>
            Clear Filter
          </button>
          <button
            aria-haspopup="dialog"
            aria-controls="library-options"
            @click=${() => this.openDialog("library-options")}
          >
            Options
          </button>
        </div>
        ${this.mode === "covers" ? r`<div
                class="cover-grid"
                style=${`--cover-size: ${this.coverSize}px; --cover-columns: ${this.coverColumns}`}
              >
                ${s.map(
      (l) => r`<button
                      class=${`cover-tile${this.display.show_titles ? " has-title" : ""}${this.display.show_rating && l.rating ? " has-rating" : ""}`}
                      title=${`${l.title}${l.year ? ` (${l.year})` : ""}`}
                      aria-label=${`Details for ${l.title}${l.year ? ` (${l.year})` : ""}`}
                      @click=${() => this.select(l)}
                    >
                      <div class="cover-image">${this.cover(l)}</div>
                      ${this.display.show_badges ? r`<div class="cover-flags">${Fe(l, !0)}</div>` : h}
                      ${this.display.show_format ? r`<div class="cover-formats">${D(l, !0)}</div>` : h}
                      ${this.display.show_rating ? r`<div class="cover-rating">${V(l.rating)}</div>` : h}
                      ${this.display.show_titles ? r`<span class="cover-caption">${l.title}${l.year ? ` (${l.year})` : ""}</span>` : h}
                    </button>`
    )}
              </div>` : r`<div class="table-wrap">
                <table
                  class="library-table"
                  style=${`--library-width: ${this.widths.reduce((l, d) => l + d, 0)}px`}
                >
                  <colgroup>
                    ${this.widths.map((l) => r`<col style=${`width: ${l}px`} />`)}
                  </colgroup>
                  <thead>
                    <tr>
                      ${We.map(
      ([l, d], c) => r`<th
                            aria-sort=${this.applied.sort === l ? this.applied.descending ? "descending" : "ascending" : "none"}
                          >
                            <button
                              class="sort-heading"
                              @click=${() => this.sort(l)}
                            >
                              <span>${d}</span
                              ><span class="sort-icon" aria-hidden="true"
                                >${this.applied.sort === l ? this.applied.descending ? "↓" : "↑" : "↕"}</span
                              >
                            </button>
                            <span
                              class="column-resize"
                              role="separator"
                              aria-label=${`Resize ${d} column`}
                              aria-orientation="vertical"
                              aria-valuemin="80"
                              aria-valuemax="800"
                              aria-valuenow=${this.widths[c]}
                              tabindex="0"
                              title="Drag or use Left/Right to resize; Home resets"
                              @keydown=${(g) => this.resizeColumn(g, c)}
                              @pointerdown=${(g) => {
        g.preventDefault(), this.resize = {
          index: c,
          start: g.clientX,
          width: this.widths[c]
        }, g.currentTarget.setPointerCapture(g.pointerId);
      }}
                              @pointermove=${(g) => {
        this.resize?.index === c && (this.widths[c] = Math.max(
          80,
          Math.min(
            800,
            this.resize.width + g.clientX - this.resize.start
          )
        ), this.requestUpdate());
      }}
                              @pointerup=${this.finishColumnResize}
                              @pointercancel=${this.finishColumnResize}
                              @lostpointercapture=${this.finishColumnResize}
                            ></span>
                          </th>`
    )}
                    </tr>
                  </thead>
                  <tbody>
                    ${(this.page?.items ?? []).map(
      (l) => r`<tr>
                          <td>
                            <button
                              class="link"
                              @click=${() => this.select(l)}
                            >
                              ${l.title}
                            </button>
                            <div
                              class="library-summary-line"
                              title=${this.format(l)}
                            >
                              ${this.display.show_badges ? Fe(l) : h}
                              ${this.display.show_format ? D(l) : h}
                              ${this.display.show_format && !Ae(l).length ? r`<small>${this.format(l)}</small>` : h}
                              ${(l.version_count ?? 1) > 1 ? r`<small>${l.version_count} versions</small>` : h}
                            </div>
                          </td>
                          <td title=${this.years(l)}>${this.years(l)}</td>
                          <td>
                            <span
                              class="collection-cell"
                              title=${l.collections.map(T).join(", ")}
                              >${l.collections.map(T).join(", ") || "—"}</span
                            >
                          </td>
                          <td>${this.runtime(l)}</td>
                          <td>${J[l.watched_status]}</td>
                          <td
                            title=${l.purchased_on ? "Imported purchase date" : "First detected by Companion"}
                          >
                            ${this.date(l.purchased_on ?? l.first_seen)}
                          </td>
                        </tr>`
    )}
                  </tbody>
                </table>
              </div>`}
        ${this.page?.items.length ? h : r`<p class="empty" role="status">${this.loading ? "Loading library…" : "No cached titles match. Adjust your filters or wait for a library sync."}</p>`}
        <div class="pagination">
          <small
            >${this.page?.total ?? 0} matching titles ·
            ${this.entriesPerPage === "all" ? "All" : this.pageSize} per
            page${this.mode === "covers" ? ` · ${this.coverColumns} covers per row` : ""}</small
          >
          <div class="actions">
            <button
              ?disabled=${t || !this.page?.offset}
              @click=${() => this.load()}
            >
              First
            </button>
            <button
              ?disabled=${t || !this.page?.offset}
              @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - e))}
            >
              Previous
            </button>
            <button
              ?disabled=${t || !this.page?.has_more}
              @click=${() => this.load((this.page?.offset ?? 0) + e)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      ${this.info ? r`<footer class="library-status" role="status"><span>${this.info.group_count} titles · ${this.info.collection_count} collections ${a && this.info.artwork_enabled ? `· Artwork ${((this.info.artwork_bytes ?? 0) / 1048576).toFixed(1)}/${((this.info.artwork_limit_bytes ?? 0) / 1048576).toFixed(0)} MiB` : ""} · Synced ${this.date(this.info.last_synced_at)}</span></footer>` : h}
      ${this.renderOptionsDialog()} ${this.renderFilterDialog()}
      ${this.renderTitleDialog()}
    </section>`;
  }
};
X.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, X.styles = [S, Mt];
let fe = X;
customElements.get("kaleidescape-library") || customElements.define("kaleidescape-library", fe);
const Z = class Z extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.userKey = "", this.generation = 0, this.scope = null, this.rows = [], this.loading = !1, this.error = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.next = null, this.history = [], this.page = 1, this.activePage = "journal", this.navigationReady = !1;
  }
  willUpdate(e) {
    if (!(!e.has("hass") && !e.has("client")))
      if (this.hass) {
        const t = `${this.hass.user?.id}:${this.hass.user?.is_admin}`;
        !this.hass.user || !this.hass.connection.connected ? this.bind(null) : (this.connection !== this.hass.connection || this.userKey !== t || !this.api) && (this.connection = this.hass.connection, this.userKey = t, this.bind(
          new tt({
            callWS: (i) => this.hass.callWS(i),
            fetchWithAuth: (i, s) => this.hass.fetchWithAuth(i, s)
          })
        ));
      } else this.bind(this.client ?? null);
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("hass"), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.bind(null);
  }
  clear() {
    this.generation++, this.scope = null, this.activePage = "journal", this.navigationReady = !1, this.rows = [], this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.query = this.status = this.searchText = this.filterStatus = "", this.loading = !1, this.error = "";
  }
  bind(e) {
    e !== this.api && (this.clear(), this.api = e, this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    u(e) === "unauthorized" && this.clear(), this.error = v(e), this.requestUpdate();
  }
  async refresh() {
    if (!this.api) return;
    const e = ++this.generation;
    this.scope = null, this.rows = [], this.next = null, this.cursor = void 0, this.history = [], this.page = 1, this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const { entries: t } = await this.api.info();
      if (e !== this.generation) return;
      if (!t[0]?.permissions.read || t[0].api_version !== 1)
        throw new p("not_ready");
      if (this.scope = {
        ...t[0],
        permissions: { read: !0, edit: !1, export: !1 }
      }, !this.navigationReady) {
        const i = at(
          this.scope.ui_defaults?.default_landing_page,
          !1,
          !!this.scope.library_enabled
        );
        this.activePage = i === "library" ? "library" : "journal", this.navigationReady = !0;
      }
      this.scope.library_enabled || (this.activePage = "journal"), j(this.activePage), await this.load(void 0, e);
    } catch (t) {
      e === this.generation && this.fail(t);
    } finally {
      e === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async load(e, t = ++this.generation) {
    if (!(!this.api || !this.scope)) {
      this.loading = !0, this.error = "", this.rows = [], this.requestUpdate();
      try {
        const i = await this.api.list(
          this.scope,
          this.query,
          this.status,
          e
        );
        if (t !== this.generation) return;
        this.rows = i.items, this.next = i.next_cursor, this.cursor = e;
      } catch (i) {
        t === this.generation && (this.next = null, this.fail(i));
      } finally {
        t === this.generation && (this.loading = !1, this.requestUpdate());
      }
    }
  }
  date(e) {
    if (!e) return "—";
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? "—" : t.toLocaleString();
  }
  selectPage(e) {
    e === "library" && !this.scope?.library_enabled || (this.activePage = e, j(e), this.requestUpdate());
  }
  tabKey(e) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const t = !this.scope?.library_enabled || e.key === "End" ? "journal" : e.key === "Home" || this.activePage === "journal" ? "library" : "journal";
    this.selectPage(t), this.updateComplete.then(
      () => this.renderRoot.querySelector(`#reader-${t}`)?.focus()
    );
  }
  render() {
    return r`<main>
      <header>
        ${this.hass && this.narrow ? r`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : h}
        <div>
          <span class="eyebrow">Kaleidescape Companion</span>
          <h1>Viewing history</h1>
          <p>Read-only household journal</p>
        </div>
      </header>
      ${this.error ? r`<p role="alert" class="error">${this.error}</p>` : h}
      <nav
        class="page-tabs"
        role="tablist"
        aria-label="Companion pages"
        @keydown=${this.tabKey}
      >
        ${["library", "journal"].map((e) => r`<button id=${`reader-${e}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === e} tabindex=${this.activePage === e ? 0 : -1} ?disabled=${e === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(e)}>${e === "journal" ? "Journal" : "Library"}</button>`)}
      </nav>
      <section
        id="reader-content"
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
      >
        ${this.activePage === "library" && this.scope ? r`<kaleidescape-library
                .client=${this.api ?? void 0}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new p("unauthorized"))}
                @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
              ></kaleidescape-library>` : r`<section class="card" aria-label="Viewing history">
                <div class="card-head">
                  <h2>Viewings</h2>
                  <button
                    ?disabled=${this.loading || !this.api}
                    @click=${this.refresh}
                  >
                    Refresh
                  </button>
                </div>
                <form
                  class="filters"
                  @submit=${(e) => {
      e.preventDefault(), this.query = this.searchText, this.status = this.filterStatus, this.history = [], this.page = 1, this.load();
    }}
                >
                  <label
                    >Search titles<input
                      name="search"
                      type="search"
                      maxlength="500"
                      .value=${this.searchText}
                      ?disabled=${this.loading || !this.scope}
                      @input=${(e) => {
      this.searchText = e.target.value;
    }}
                  /></label>
                  <label
                    >Status<select
                      name="filter_status"
                      .value=${this.filterStatus}
                      ?disabled=${this.loading || !this.scope}
                      @change=${(e) => {
      this.filterStatus = e.target.value;
    }}
                    >
                      <option value="">All</option>
                      <option value="completed">Completed</option>
                      <option value="partial">Partial</option>
                    </select></label
                  >
                  <button ?disabled=${this.loading || !this.scope}>
                    Search
                  </button>
                </form>
                ${this.loading ? r`<p role="status">Loading viewings…</p>` : this.api ? this.rows.length ? r`<div class="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Movie</th>
                                  <th>Status</th>
                                  <th>Watched</th>
                                  <th>Runtime</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${this.rows.map(
      (e) => r`<tr>
                                      <td>
                                        <strong>${e.title}</strong
                                        ><small
                                          >Started
                                          ${this.date(e.started_at)}<br />Ended
                                          ${this.date(e.ended_at)}</small
                                        >
                                      </td>
                                      <td>
                                        ${e.status === "completed" ? "Completed" : "Partial"}
                                      </td>
                                      <td>
                                        ${(e.watched_seconds / 60).toFixed(2)}
                                        min
                                      </td>
                                      <td>
                                        ${e.duration_seconds == null ? "—" : `${(e.duration_seconds / 60).toFixed(2)} min`}
                                      </td>
                                    </tr>`
    )}
                              </tbody>
                            </table>
                          </div>` : r`<p>No viewings to display.</p>` : r`<p>
                          Sign in to Home Assistant to view the household
                          journal.
                        </p>`}
                <div class="pagination">
                  <small>Page ${this.page} · Up to 25 entries</small>
                  <div class="actions">
                    <button
                      ?disabled=${this.loading || this.page === 1}
                      @click=${() => {
      this.history = [], this.page = 1, this.load();
    }}
                    >
                      First
                    </button>
                    <button
                      ?disabled=${this.loading || !this.history.length}
                      @click=${() => {
      this.page--, this.load(this.history.pop());
    }}
                    >
                      Previous
                    </button>
                    <button
                      ?disabled=${this.loading || !this.next}
                      @click=${() => {
      this.history.push(this.cursor), this.history.length > 200 && this.history.shift(), this.page++, this.load(this.next);
    }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>`}
      </section>
    </main>`;
  }
};
Z.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, Z.styles = S;
let be = Z;
customElements.get("kaleidescape-reader") || customElements.define("kaleidescape-reader", be);
const Ft = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped"
}, Wt = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content"
}, ee = class ee extends y {
  constructor() {
    super(...arguments), this.boundScope = "", this.generation = 0, this.player = null, this.loading = !1, this.denied = !1, this.error = "", this.image = "", this.imageKey = "", this.visibility = () => {
      this.reset(), document.hidden || this.refresh();
    };
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("visibilitychange", this.visibility), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), document.removeEventListener("visibilitychange", this.visibility), this.reset();
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = this.scope?.permissions.edit ? `${this.scope.entry_id}:${this.scope.dataset_id}` : "";
    this.boundClient !== this.client || this.boundScope !== t ? (this.reset(), this.boundClient = this.client, this.boundScope = t, this.refresh()) : e.has("client") && !this.timer && !this.loading && this.refresh();
  }
  clearImage() {
    this.image && URL.revokeObjectURL(this.image), this.image = "", this.imageKey = "";
  }
  reset() {
    this.generation++, clearTimeout(this.timer), this.timer = void 0, this.abort?.abort(), this.abort = void 0, this.clearImage(), this.player = null, this.loading = this.denied = !1, this.error = "", this.requestUpdate();
  }
  async refresh() {
    if (!this.isConnected || document.hidden || !this.client || !this.boundScope || this.loading)
      return;
    clearTimeout(this.timer);
    const e = this.client, t = this.scope, i = ++this.generation;
    this.loading = !0, this.denied = !1, this.error = "", this.requestUpdate();
    try {
      const { players: s } = await e.nowPlaying(t);
      if (i !== this.generation) return;
      this.player = s[0] ?? null;
      const a = this.player, o = a?.available && a.artwork_key && a.entity_id ? `${a.entity_id}:${a.raw_content_id}:${a.artwork_key}` : "";
      if (o !== this.imageKey && (this.clearImage(), this.imageKey = o, this.requestUpdate(), o)) {
        const l = this.abort = new AbortController(), d = setTimeout(() => l.abort(), 5e3);
        try {
          const c = await e.artwork(
            a.entity_id,
            l.signal
          );
          i === this.generation && c && (this.image = URL.createObjectURL(c));
        } catch (c) {
          if (u(c) === "unauthorized") throw c;
        } finally {
          clearTimeout(d), this.abort === l && (this.abort = void 0);
        }
      }
    } catch (s) {
      if (i !== this.generation) return;
      this.player = null, this.clearImage(), this.denied = u(s) === "unauthorized", this.error = this.denied ? "Now Playing access is unavailable. Check your account and source permissions." : "Now Playing could not refresh. Check the connection or refresh again.";
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate(), !this.denied && this.isConnected && !document.hidden && (this.timer = setTimeout(() => {
        this.refresh();
      }, 5e3)));
    }
  }
  recordingStatus(e, t) {
    return e.recording_error ? "Recording needs attention. Check HA diagnostics." : e.recording_paused ? "Recording paused for backup." : e.available ? t && e.recording_exclusion === "below_minimum_runtime" ? `Not recording: runtime is below the minimum of ${e.minimum_runtime_minutes} minutes.` : t && e.recording_exclusion === "runtime_unknown" ? "Waiting for a known runtime before recording." : "Recording enabled." : "Recording waiting for source entities.";
  }
  render() {
    const e = this.player, t = e?.available && !["stopped", "none"].includes(e.play_status);
    return r`<section class="card now-playing" aria-label="Now Playing">
      <div class="card-head">
        <h2>Now Playing</h2>
        <button
          ?disabled=${this.loading || !this.boundScope}
          @click=${() => {
      this.imageKey = "", this.refresh();
    }}
        >
          Refresh playback
        </button>
      </div>
      ${this.error ? r`<p class="playback-message" role="alert">${this.error}</p>` : e ? r`<div class="playback-layout">
                <div class="cover">
                  ${this.image ? r`<img
                          src=${this.image}
                          alt="Current movie cover"
                          @error=${() => {
      const i = this.imageKey;
      this.clearImage(), this.imageKey = i, this.requestUpdate();
    }}
                        />` : r`<span>No artwork available</span>`}
                </div>
                <div class="playback-detail">
                  <small>${e.name ?? "Configured player"}</small>
                  <h3>
                    ${e.available ? t ? e.title ?? "Unknown title" : "No movie playing" : "Player unavailable"}
                  </h3>
                  ${e.available ? r`<p>${Ft[e.play_status] ?? "Unknown playback state"} · ${Wt[e.location] ?? "Unknown location"}</p>` : h}
                  ${t && e.duration_seconds != null ? r`<p>Runtime · ${(e.duration_seconds / 60).toFixed(2)} min</p>` : h}
                  ${t && e.session ? r`<p>
                            This session ·
                            ${(e.session.watched_seconds / 60).toFixed(2)}
                            min counted
                          </p>
                          <small
                            >Pauses and scans are excluded.
                            ${e.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                            ${e.session.gap_count ? r` ${e.session.gap_count} timing gap(s).` : h}</small
                          >` : h}
                  <p role="status">
                    ${this.recordingStatus(e, !!t)}
                    ${e.buffered_observations ? r` ${e.buffered_observations} update(s) buffered.` : h}
                  </p>
                  <small
                    >Live snapshot refreshes about every 5 seconds while
                    visible.</small
                  >
                </div>
              </div>` : r`<p class="playback-message" role="status">
                ${this.loading ? "Loading playback…" : "Automatic tracking is off. Configure a player in the integration options to show Now Playing."}
              </p>`}
    </section>`;
  }
};
ee.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, ee.styles = S;
let me = ee;
customElements.get("kaleidescape-now-playing") || customElements.define("kaleidescape-now-playing", me);
const Je = [
  ["media_player", "Kaleidescape media player", "text", "", ""],
  ["play_status", "Exact play-status sensor", "text", "", ""],
  ["media_location", "Media-location sensor", "text", "", ""],
  [
    "minimum_runtime_minutes",
    "Minimum runtime to record · minutes (0 disables)",
    "number",
    "0",
    "1440"
  ],
  [
    "minimum_seconds",
    "Minimum main-content playback before credits completion · seconds",
    "number",
    "1",
    "3600"
  ],
  [
    "resume_hours",
    "Merge partial viewings within · hours (0 disables)",
    "number",
    "0",
    "168"
  ]
], Ke = [
  [
    "library_host",
    "Library hostname · blank uses my-kaleidescape.local",
    "text",
    "",
    ""
  ],
  ["library_interval_hours", "Sync interval · hours", "number", "1", "168"],
  [
    "library_artwork_cache_mb",
    "Artwork cache limit · MiB",
    "number",
    "32",
    "4096"
  ]
], rt = [
  ["library_allow_collection_add", "Allow Add to Collection on the device"],
  ["library_sync_collections", "Sync collections and watched status"],
  ["library_sync_details", "Sync title details and credits"],
  ["library_sync_artwork", "Sync artwork"]
], Vt = /* @__PURE__ */ new Set([
  "tracking_enabled",
  "library_enabled",
  ...rt.map(([n]) => n)
]), Jt = {
  invalid_display_options: "Choose a valid default landing page.",
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities: "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
  invalid_library_host: "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_options: "Choose a sync interval of 1–168 hours and an artwork cache limit of 32–4096 MiB."
}, te = class te extends y {
  constructor() {
    super(...arguments), this.generation = 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.customCollection = "", this.loading = !1, this.saving = !1, this.uncertain = !1, this.error = "", this.bound = "";
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    t === this.bound && this.client === this.boundClient || (this.cancelFlow(), this.bound = t, this.boundClient = this.client, this.boundScope = this.scope, this.flow = void 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.uncertain = this.saving = !1, this.client && this.scope && this.start());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.cancelFlow(), this.flow = void 0, this.draft = {}, this.initial = {}, this.collectionChoices = [], this.customCollection = "", this.bound = "", this.boundClient = void 0;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  updated() {
    const e = this.renderRoot.querySelector(
      '[name="default_landing_page"]'
    ), t = String(this.draft.default_landing_page ?? "journal");
    e && e.value !== t && (e.value = t);
  }
  cancelFlow() {
    this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.hiddenCollections = [], this.sharedReady = !1, this.sharedError = "", this.generation++, this.flow?.flow_id && this.boundClient && this.boundScope && this.boundClient.settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id }).catch(() => {
    });
  }
  fail(e) {
    this.error = v(e), u(e) === "unauthorized" && (this.sharedPreferences?.dispose(), this.sharedPreferences = void 0, this.sharedReady = !1, this.hiddenCollections = [], this.flow = void 0, this.draft = {}, this.initial = {}, this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.requestUpdate();
  }
  async start() {
    const e = this.client, t = this.scope, i = ++this.generation;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const s = await e.settings(t, "start");
      if (i !== this.generation) {
        s.flow_id && e.settings(t, "cancel", { flow_id: s.flow_id }).catch(() => {
        });
        return;
      }
      this.flow = s, this.draft = Object.fromEntries(
        (s.fields ?? []).map((o) => [
          o.name,
          Vt.has(o.name) ? !!o.default : String(o.default ?? "")
        ])
      ), this.initial = { ...this.draft }, this.sharedPreferences = new Ee(
        e,
        t,
        !0,
        (o) => {
          i === this.generation && (o && u(o) === "unauthorized" ? this.fail(o) : (this.sharedError = o ? v(o) : "", this.requestUpdate()));
        }
      );
      const a = await this.sharedPreferences.load();
      if (i !== this.generation) return;
      if (this.hiddenCollections = [...a.hidden_collections], this.sharedReady = !0, t.library_enabled) {
        const o = await e.libraryInfo(t);
        i === this.generation && (this.collectionChoices = o.collection_names ?? []);
      }
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  confirmNavigation() {
    return this.saving ? !1 : this.uncertain ? window.confirm(
      "The settings save may already have committed. Leave this view and inspect saved values before making another change?"
    ) : JSON.stringify(this.draft) === JSON.stringify(this.initial) || window.confirm("Discard your unsaved settings changes?");
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail: this.saving,
        bubbles: !0,
        composed: !0
      })
    );
  }
  reload() {
    this.confirmNavigation() && (this.cancelFlow(), this.flow = void 0, this.draft = this.initial = {}, this.uncertain = !1, this.start());
  }
  async save(e) {
    if (e.preventDefault(), !this.client || !this.scope || !this.flow?.flow_id || this.saving || this.uncertain || !e.target.reportValidity()) return;
    const t = this.generation;
    this.saving = !0, this.busy(), this.error = "", this.requestUpdate();
    const i = { ...this.draft };
    for (const [s, , a] of Je)
      a === "number" ? i[s] = Number(i[s]) : i[s] || delete i[s];
    for (const [s, , a] of Ke)
      a === "number" && (i[s] = Number(i[s]));
    i.library_host = String(i.library_host ?? "");
    try {
      const s = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data: i
      });
      if (t !== this.generation) return;
      this.flow = s, s.type === "create_entry" ? (this.initial = { ...this.draft }, this.saving = !1, this.busy(), this.dispatchEvent(
        new CustomEvent("settings-saved", { bubbles: !0, composed: !0 })
      )) : s.type === "form" ? this.error = Object.values(s.errors ?? {}).map(
        (a) => Jt[a] ?? "Check the settings and try again."
      ).join(" ") : this.error = "The settings flow ended. Reload settings to continue.";
    } catch (s) {
      t === this.generation && (this.fail(s), this.uncertain = ![
        "unauthorized",
        "invalid_request",
        "conflict"
      ].includes(u(s)));
    } finally {
      t === this.generation && (this.saving = !1, this.busy(), this.requestUpdate());
    }
  }
  render() {
    return r`<section
      class="card settings-page"
      aria-labelledby="settings-title"
    >
      <div class="card-head">
        <h2 id="settings-title">Companion settings</h2>
        <button ?disabled=${this.saving || this.loading} @click=${this.reload}>
          Reload settings
        </button>
      </div>
      <p>
        HA runtime settings use the integration’s Configure options and reload
        when saved. Shared Library display settings save immediately to the
        database.
      </p>
      ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
      ${this.uncertain ? r`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : h}
      ${this.loading ? r`<p role="status">Loading settings…</p>` : this.flow?.type === "form" ? r`<form @submit=${this.save}>
                  <fieldset ?disabled=${this.saving || this.uncertain}>
                    <label class="check"
                      ><input
                        name="tracking_enabled"
                        type="checkbox"
                        .checked=${!!this.draft.tracking_enabled}
                        @change=${(e) => {
      this.draft = {
        ...this.draft,
        tracking_enabled: e.target.checked
      }, this.requestUpdate();
    }}
                      />Automatically record playback</label
                    >
                    <div class="grid settings-grid">
                      ${Je.map(
      ([e, t, i, s, a]) => r`<label class=${i === "text" ? "full" : ""}
                            >${t}<input
                              name=${e}
                              type=${i}
                              min=${s || h}
                              max=${a || h}
                              step=${i === "number" ? "1" : h}
                              maxlength=${i === "text" ? "255" : h}
                              ?required=${i === "number" || !!this.draft.tracking_enabled}
                              .value=${String(this.draft[e] ?? "")}
                              @input=${(o) => {
        this.draft = {
          ...this.draft,
          [e]: o.target.value
        };
      }}
                          /></label>`
    )}
                    </div>
                    <p class="muted">
                      Use HA entity IDs for the three sources. The runtime
                      cutoff uses total duration; missing runtime waits for
                      metadata. Completion uses watched time and confirmed
                      credits.
                    </p>
                    <h3>Library sync</h3>
                    <label class="check"
                      ><input
                        name="library_enabled"
                        type="checkbox"
                        .checked=${!!this.draft.library_enabled}
                        @change=${(e) => {
      this.draft = {
        ...this.draft,
        library_enabled: e.target.checked
      }, this.requestUpdate();
    }}
                      />Enable library sync</label
                    >
                    <p class="muted">
                      Optional synchronization with your local Kaleidescape
                      library. Disabled by default; no library discovery or
                      device requests occur while disabled.
                    </p>
                    ${this.draft.library_enabled ? r`<div class="grid settings-grid">
                              ${Ke.map(
      ([e, t, i, s, a]) => r`<label
                                    class=${i === "text" ? "full" : ""}
                                    >${t}<input
                                      name=${e}
                                      type=${i}
                                      min=${s || h}
                                      max=${a || h}
                                      step=${i === "number" ? "1" : h}
                                      maxlength=${i === "text" ? "255" : h}
                                      ?required=${i === "number"}
                                      .value=${String(this.draft[e] ?? "")}
                                      @input=${(o) => {
        this.draft = {
          ...this.draft,
          [e]: o.target.value
        }, this.requestUpdate();
      }}
                                  /></label>`
    )}
                              ${rt.map(
      ([e, t]) => r`<label class="check full"
                                    ><input
                                      name=${e}
                                      type="checkbox"
                                      .checked=${!!this.draft[e]}
                                      @change=${(i) => {
        this.draft = {
          ...this.draft,
          [e]: i.target.checked
        }, this.requestUpdate();
      }}
                                    />${t}</label
                                  >`
    )}
                            </div>
                            <p class="muted">
                              Add to Collection is separately disabled by
                              default. Enabling it lets administrators add an
                              explicitly selected version to an existing offered
                              collection. It requires collection sync. Removal
                              is not supported.
                            </p>
                            <p class="muted">
                              Source collections determine watched status, with
                              in-progress. Detail fields depend on available
                              source metadata. “Added on” means first detected,
                              not purchased or downloaded.
                            </p>
                            ${this.draft.library_sync_artwork ? r`<p class="warning">Artwork uses additional disk space in a separate private cache, up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. Increase the cache limit for a large library; older covers may be evicted and fetched again. HA backups can include these files.</p>` : h}` : h}
                    <h3>Landing page</h3>
                    <label
                      >Default landing page<select
                        name="default_landing_page"
                        .value=${String(this.draft.default_landing_page ?? "journal")}
                        @change=${(e) => {
      this.draft = {
        ...this.draft,
        default_landing_page: e.target.value
      }, this.requestUpdate();
    }}
                      >
                        ${[
      ["now-playing", "Now Playing"],
      ["library", "Library"],
      ["journal", "Journal"],
      ["database", "Database"],
      ["settings", "Settings"]
    ].map(
      ([e, t]) => r`<option
                              value=${e}
                              ?selected=${e === this.draft.default_landing_page}
                            >
                              ${t}
                            </option>`
    )}
                      </select></label
                    >
                    <p class="muted">
                      The URL remembers your current tab. Library view, page
                      size, filters and sort save automatically for your HA user
                      while browsing.
                    </p>
                    <button class="primary" type="submit">
                      ${this.saving ? "Saving…" : "Save settings"}
                    </button>
                  </fieldset>
                  <button
                    type="button"
                    ?disabled=${this.saving || this.loading}
                    @click=${this.reload}
                  >
                    Cancel changes
                  </button>
                </form>
                <h3>Shared Library display settings</h3>
                <p>Saved to the database as you change them; no HA reload.</p>
                ${this.renderCollections()}` : h}
    </section>`;
  }
  renderCollections() {
    if (!this.sharedReady)
      return r`<p>
        Shared display settings could not be loaded. Reload settings to retry.
      </p>`;
    const e = this.hiddenCollections, t = [.../* @__PURE__ */ new Set([...this.collectionChoices, ...e])].sort(
      (i, s) => i.localeCompare(s)
    );
    return r`<fieldset class="full">
      <legend>Hidden collection names</legend>
      ${this.sharedError ? r`<p class="error" role="alert">${this.sharedError}<button type="button" @click=${() => this.sharedPreferences?.retry()}>Retry UI settings</button></p>` : h}
      <div class="facet-options">
        ${t.map(
      (i) => r`<label class="check"
              ><input
                name="library_excluded_collections"
                type="checkbox"
                .value=${i}
                .checked=${e.includes(i)}
                ?disabled=${e.length >= 200 && !e.includes(i)}
                @change=${(s) => {
        this.hiddenCollections = s.target.checked ? [...e, i] : e.filter((a) => a !== i), this.sharedPreferences?.set({
          hidden_collections: this.hiddenCollections
        }), this.requestUpdate();
      }}
              />${T(i)}</label
            >`
    )}
      </div>
      <div class="actions">
        <label
          >Custom collection name<input
            name="custom_collection"
            maxlength="256"
            .value=${this.customCollection}
            @input=${(i) => {
      this.customCollection = i.target.value;
    }} /></label
        ><button
          type="button"
          @click=${() => {
      const i = this.customCollection.trim().replace(/\s+/g, " ");
      !i || e.length >= 200 || (e.some(
        (s) => s.toLocaleLowerCase() === i.toLocaleLowerCase()
      ) || (this.hiddenCollections = [...e, i], this.sharedPreferences?.set({
        hidden_collections: this.hiddenCollections
      })), this.customCollection = "", this.requestUpdate());
    }}
        >
          Add hidden name
        </button>
      </div>
      <small
        >Selected names are hidden from labels and filters. Movies remain
        visible; source collections still determine status. No device
        changes.</small
      >
    </fieldset>`;
  }
};
te.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, te.styles = S;
let ye = te;
customElements.get("kaleidescape-settings") || customElements.define("kaleidescape-settings", ye);
const Kt = L`
  .database-entries {
    padding: 20px;
  }
  .database {
    overflow: visible;
    margin-top: 24px;
  }
  .database-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 12px;
    padding: 20px;
  }
  .database-toolbar kaleidescape-transfers {
    margin-left: auto;
    min-width: 0;
    max-width: 100%;
  }
  .database-messages {
    padding: 0 20px;
  }
  .database .card-head {
    padding: 0;
  }
  .database .card-head + .editor {
    margin-top: 20px;
  }
  .database-pagination {
    flex-direction: column;
    align-items: stretch;
    padding: 16px 0 0;
  }
  .database-filters {
    padding: 20px;
    border-bottom: 1px solid var(--line);
  }
  .database-filters select {
    width: auto;
    max-width: 250px;
  }
  .database-pagination .actions {
    flex-wrap: nowrap;
    gap: 6px;
  }
  .database-pagination button {
    flex: 1 0 auto;
    padding-inline: 6px;
    white-space: nowrap;
  }
  .table-tabs {
    margin: 0;
    padding: 4px 20px 0;
  }
  .database-layout {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
  }
  .database-detail {
    padding: 20px;
    border-left: 1px solid var(--line);
  }
  .database-detail .editor {
    padding: 0;
  }
  .entry-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .entry-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }
  .entry-list li.selected {
    background: var(--secondary-background-color, #edf4f0);
  }
  .entry-list input {
    width: 20px;
    min-height: 20px;
    flex-shrink: 0;
  }
  .entry-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .entry-name small {
    display: block;
  }
  @media (max-width: 900px) {
    .database-layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .database-detail {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .database-toolbar kaleidescape-transfers {
      margin-left: 0;
    }
  }
`, ie = class ie extends y {
  constructor() {
    super(...arguments), this.table = "viewings", this.value = "", this.fields = [], this.operators = [], this.disabled = !1, this.open = !1, this.active = 0, this.cursor = 0, this.message = "", this.invalid = !1, this.generation = 0;
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearTimeout(this.timer), this.generation++, this.open = !1;
  }
  willUpdate(e) {
    ["client", "scope", "table"].some((t) => e.has(t)) && (clearTimeout(this.timer), this.generation++, this.message = "", this.invalid = !1, this.open = !1);
  }
  choices() {
    const e = this.value.slice(0, this.cursor);
    if ((e.match(/'/g)?.length ?? 0) % 2) return [];
    const t = e.match(/[A-Za-z_0-9.<>!=]*$/)?.[0] ?? "", i = e.slice(0, e.length - t.length).trim();
    let s;
    return !i || /(?:\bAND|\bOR|\bNOT|\bWHERE|\()$/i.test(i) ? s = this.fields.map((a) => a.name) : this.fields.some(
      (a) => i.toLowerCase().endsWith(a.name.toLowerCase())
    ) ? s = this.operators : /(?:NULL|'|\d|TRUE|FALSE)$/i.test(i) ? s = ["AND", "OR"] : s = ["''", "0", "TRUE", "FALSE"], s.filter((a) => a.toLowerCase().startsWith(t.toLowerCase())).slice(0, 12);
  }
  changed() {
    this.dispatchEvent(
      new CustomEvent("query-change", {
        detail: this.value,
        bubbles: !0,
        composed: !0
      })
    ), clearTimeout(this.timer);
    const e = ++this.generation;
    this.timer = setTimeout(async () => {
      try {
        await this.client?.validateDatabaseQuery(
          this.scope,
          this.table,
          this.value
        ), e === this.generation && (this.message = "", this.invalid = !1);
      } catch (t) {
        if (e !== this.generation) return;
        this.invalid = !0, this.message = u(t) === "query_syntax" && typeof t.message == "string" ? t.message : v(t), u(t) === "unauthorized" && this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
        );
      } finally {
        e === this.generation && this.requestUpdate();
      }
    }, 250), this.requestUpdate();
  }
  choose(e) {
    const t = this.value.slice(0, this.cursor), i = t.match(/[A-Za-z_0-9.<>!=]*$/)?.[0] ?? "", s = this.cursor - i.length;
    this.value = this.value.slice(0, s) + e + " " + this.value.slice(this.cursor), this.cursor = s + (e === "''" ? 1 : e.length + 1), this.active = 0, this.changed(), this.updateComplete.then(() => {
      const a = this.renderRoot.querySelector("input");
      a.focus(), a.setSelectionRange(this.cursor, this.cursor);
    });
  }
  render() {
    const e = this.choices();
    return r`<div class="search">
        <label
          >Search rows / conditions<input
            name="database_query"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded=${this.open && !!e.length}
            aria-controls="query-suggestions"
            aria-activedescendant=${this.open && e.length ? `query-option-${this.active}` : h}
            aria-invalid=${this.invalid}
            aria-describedby="query-help"
            maxlength="2000"
            autocomplete="off"
            .value=${this.value}
            ?disabled=${this.disabled}
            @focus=${() => {
      this.open = !0, this.requestUpdate();
    }}
            @blur=${() => {
      this.open = !1, this.requestUpdate();
    }}
            @click=${(t) => {
      this.cursor = t.target.selectionStart ?? this.value.length, this.open = !0, this.requestUpdate();
    }}
            @input=${(t) => {
      const i = t.target;
      this.value = i.value, this.cursor = i.selectionStart ?? i.value.length, this.active = 0, this.open = !0, this.changed();
    }}
            @keydown=${(t) => {
      t.key === "Escape" ? (this.open = !1, this.requestUpdate()) : (t.key === "ArrowDown" || t.key === "ArrowUp") && e.length ? (t.preventDefault(), this.open = !0, this.active = (this.active + (t.key === "ArrowDown" ? 1 : -1) + e.length) % e.length, this.requestUpdate()) : t.key === "Tab" && this.open && e.length ? (t.preventDefault(), this.choose(e[this.active] ?? e[0])) : t.key === "Enter" && (t.preventDefault(), this.open = !1, this.dispatchEvent(
        new CustomEvent("query-submit", {
          bubbles: !0,
          composed: !0
        })
      ), this.requestUpdate());
    }} /></label
        >${this.open && e.length ? r`<div class="suggestions" id="query-suggestions" role="listbox">${e.map((t, i) => r`<button type="button" role="option" id=${`query-option-${i}`} aria-selected=${this.active === i} tabindex="-1" @mousedown=${(s) => s.preventDefault()} @click=${() => this.choose(t)}>${t}</button>`)}</div>` : h}
      </div>
      <small id="query-help" class=${this.invalid ? "error" : ""} role="status"
        >${this.message || "Text searches every column. Conditions: purchased_on IS NULL · actors CONTAINS 'name' · title LIKE 'Star%'. Tab accepts a suggestion; Enter searches."}</small
      >`;
  }
};
ie.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  table: {},
  value: {},
  fields: { attribute: !1 },
  operators: { attribute: !1 },
  disabled: { type: Boolean }
}, ie.styles = L`
    :host {
      display: block;
      min-width: 0;
      flex: 1;
    }
    label {
      display: grid;
      gap: 6px;
      font: inherit;
    }
    input {
      font: inherit;
      color: inherit;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    .search {
      position: relative;
    }
    .suggestions {
      position: absolute;
      z-index: 20;
      inset-inline: 0;
      top: 100%;
      max-height: 220px;
      overflow: auto;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px #0004;
      display: grid;
    }
    button {
      font: inherit;
      padding: 8px;
      text-align: left;
      color: inherit;
      background: transparent;
      border: 0;
    }
    button[aria-selected="true"] {
      background: var(--line);
    }
    small {
      display: block;
      margin-top: 5px;
      color: var(--muted);
    }
    .error {
      color: var(--error-color, #b3261e);
    }
  `;
let ve = ie;
customElements.get("kaleidescape-database-search") || customElements.define("kaleidescape-database-search", ve);
const se = class se extends y {
  constructor() {
    super(...arguments), this.disabled = !1, this.bound = "", this.generation = 0, this.selected = /* @__PURE__ */ new Set(), this.query = "", this.changesOnly = !1, this.page = 0, this.pageSize = 100, this.working = !1, this.error = "", this.notice = "", this.dialog = null;
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    this.boundClient === this.client && this.bound === t || (this.clear(), this.bound = t, this.boundClient = this.client);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.boundClient = void 0;
  }
  clear() {
    this.generation++, this.controller?.abort(), this.controller = void 0, this.file = void 0, this.review = void 0, this.selected.clear();
    const e = this.renderRoot.querySelector('input[type="file"]');
    e && (e.value = ""), this.pending = void 0, this.working = !1, this.hideDialog(), this.error = this.notice = "", this.busy();
  }
  async openDialog(e) {
    if (this.disabled || this.working || this.pending || !this.dispatchEvent(
      new CustomEvent("transfer-open", {
        detail: e,
        bubbles: !0,
        composed: !0,
        cancelable: !0
      })
    ))
      return;
    const t = this.generation;
    this.dialog = e, this.error = this.notice = "", this.requestUpdate(), await this.updateComplete, !(t !== this.generation || !this.isConnected) && this.renderRoot.querySelector("dialog")?.showModal();
  }
  hideDialog() {
    this.renderRoot.querySelector("dialog")?.close(), this.dialog = null;
  }
  closeDialog(e) {
    if (e?.preventDefault(), this.working || this.pending) return;
    const t = this.dialog;
    this.hideDialog(), this.file = void 0, this.review = void 0, this.selected.clear();
    const i = this.renderRoot.querySelector('input[type="file"]');
    i && (i.value = ""), this.requestUpdate(), this.renderRoot.querySelector(`[data-transfer="${t}"]`)?.focus();
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("transfer-busy", {
        detail: this.working || !!this.pending,
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(e) {
    u(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    )), this.error = v(e), this.requestUpdate();
  }
  async exportData(e) {
    if (!this.client || !this.scope || this.working || this.pending || this.disabled)
      return;
    const t = this.generation, i = this.controller = new AbortController(), s = setTimeout(() => i.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const a = await this.client.download(
        this.scope,
        e,
        i.signal
      );
      if (t !== this.generation) return;
      const o = URL.createObjectURL(a), l = document.createElement("a");
      try {
        l.href = o, l.download = `kaleidescape-journal.${e}`, l.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(o), 1e3);
      }
      this.notice = "Export downloaded. Keep this private copy in a protected location.", this.hideDialog();
    } catch (a) {
      t === this.generation && this.fail(a);
    } finally {
      clearTimeout(s), t === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
    }
  }
  async previewData() {
    if (!this.client || !this.scope || !this.file || this.working || this.disabled || this.scope.tracking_enabled)
      return;
    const e = this.generation, t = this.controller = new AbortController(), i = setTimeout(() => t.abort(), 65e3);
    this.working = !0, this.error = this.notice = "", this.review = void 0, this.selected.clear(), this.busy(), this.requestUpdate();
    try {
      const s = await this.client.previewImport(
        this.scope,
        this.file,
        t.signal
      );
      if (e !== this.generation) return;
      this.review = s, this.selected = new Set(
        s.rows.filter((a) => ["new", "merge"].includes(a.action)).map((a) => a.key)
      ), this.page = 0, this.query = "", this.changesOnly = !1;
    } catch (s) {
      e === this.generation && this.fail(s);
    } finally {
      clearTimeout(i), e === this.generation && (this.working = !1, this.controller = void 0, this.busy(), this.requestUpdate());
    }
  }
  async importData() {
    if (!this.client || !this.scope || !this.review || this.working || this.disabled || this.scope.tracking_enabled)
      return;
    this.pending ??= this.client.prepareImport(this.scope, this.review, [
      ...this.selected
    ]);
    const e = this.generation;
    this.working = !0, this.error = this.notice = "", this.busy(), this.requestUpdate();
    try {
      const t = await this.client.applyImport(this.pending);
      if (e !== this.generation) return;
      this.pending = void 0, this.review = void 0, this.file = void 0, this.selected.clear(), this.notice = `Imported ${t.imported_count} new entries; filled missing data in ${t.updated_count}; left ${t.skipped_count} unchanged or unselected.`, this.hideDialog(), this.dispatchEvent(
        new CustomEvent("database-changed", { bubbles: !0, composed: !0 })
      );
    } catch (t) {
      if (e !== this.generation) return;
      [
        "invalid_request",
        "unauthorized",
        "conflict",
        "not_found",
        "tracking_enabled"
      ].includes(u(t)) && (this.pending = void 0, this.review = void 0, this.selected.clear()), this.fail(t);
    } finally {
      e === this.generation && (this.working = !1, this.busy(), this.requestUpdate());
    }
  }
  renderReview(e) {
    if (!this.review) return h;
    const t = this.review, i = this.query.trim().toLocaleLowerCase(), s = t.rows.filter(
      (d) => (!this.changesOnly || ["new", "merge"].includes(d.action)) && `${d.title} ${d.detail ?? ""} ${d.table} ${Object.keys(d.changes).join(" ")}`.toLocaleLowerCase().includes(i)
    ), a = Math.max(0, Math.ceil(s.length / this.pageSize) - 1), o = Math.min(this.page, a), l = s.slice(
      o * this.pageSize,
      (o + 1) * this.pageSize
    );
    return r`<p role="status">
        ${t.counts.new} new · ${t.counts.merge} mergeable ·
        ${t.counts.unchanged} unchanged · ${t.counts.skip} skipped.
        ${this.selected.size} selected.
      </p>
      <div class="actions">
        <label
          >Search review<input
            type="search"
            .value=${this.query}
            ?disabled=${e}
            @input=${(d) => {
      this.query = d.target.value, this.page = 0, this.requestUpdate();
    }}
        /></label>
        <label class="check"
          ><input
            type="checkbox"
            .checked=${this.changesOnly}
            ?disabled=${e}
            @change=${(d) => {
      this.changesOnly = d.target.checked, this.page = 0, this.requestUpdate();
    }}
          />Changes only</label
        >
        <button
          ?disabled=${e}
          @click=${() => {
      this.selected = new Set(
        t.rows.filter((d) => ["new", "merge"].includes(d.action)).map((d) => d.key)
      ), this.requestUpdate();
    }}
        >
          Select all changes
        </button>
        <button
          ?disabled=${e}
          @click=${() => {
      this.selected.clear(), this.requestUpdate();
    }}
        >
          Select none
        </button>
      </div>
      <div class="table-wrap">
        <table aria-label="Import review">
          <thead>
            <tr>
              <th>Select</th>
              <th>Entry</th>
              <th>Action</th>
              <th>Fields / details</th>
            </tr>
          </thead>
          <tbody>
            ${l.map(
      (d) => r`<tr>
                  <td>
                    <input
                      type="checkbox"
                      aria-label=${`Import ${d.title}`}
                      .checked=${this.selected.has(d.key)}
                      ?disabled=${e || !["new", "merge"].includes(d.action)}
                      @change=${(c) => {
        c.target.checked ? this.selected.add(d.key) : this.selected.delete(d.key), this.requestUpdate();
      }}
                    />
                  </td>
                  <td>
                    ${d.title}<small class="muted" title=${d.key}
                      >${d.detail}</small
                    ><small class="muted">${d.table}</small>
                  </td>
                  <td>${d.action}</td>
                  <td>
                    ${d.reason || Object.keys(d.changes).join(", ") || "No missing data"}
                    ${d.conflicts.length ? r`<small class="muted">Existing values kept: ${d.conflicts.join(", ")}</small>` : h}
                    ${Object.keys(d.changes).length ? r`<details>
                            <summary>Changes</summary>
                            <pre>${JSON.stringify(d.changes, null, 2)}</pre>
                          </details>` : h}
                  </td>
                </tr>`
    )}
          </tbody>
        </table>
      </div>
      <p class="muted">
        Rows
        ${s.length ? o * this.pageSize + 1 : 0}–${Math.min((o + 1) * this.pageSize, s.length)}
        of ${s.length}. Selection covers all review pages.
      </p>
      <div class="actions">
        <button
          ?disabled=${e || !o}
          @click=${() => {
      this.page = o - 1, this.requestUpdate();
    }}
        >
          Previous</button
        ><button
          ?disabled=${e || o >= a}
          @click=${() => {
      this.page = o + 1, this.requestUpdate();
    }}
        >
          Next
        </button>
        <label
          >Rows per page<select
            ?disabled=${e}
            .value=${String(this.pageSize)}
            @change=${(d) => {
      this.pageSize = Number(d.target.value), this.page = 0, this.requestUpdate();
    }}
          >
            ${[25, 100, 500].map((d) => r`<option value=${d}>${d}</option>`)}
          </select></label
        >
        <button
          class="primary"
          ?disabled=${e || !this.selected.size}
          @click=${this.importData}
        >
          Apply ${this.selected.size} selected changes
        </button>
      </div>`;
  }
  renderImport(e) {
    return r`<p>
        Add new IDs and fill missing data in existing viewings and Library
        versions. Populated values, manual corrections and deletion status are
        kept. Only known Library sources match. Newly imported versions stay
        inactive until a server sync verifies them. Session evidence, collection
        membership, artwork files, audit and retry state are not restored.
        Maximum 32 MiB / 10,000 records. Review expires after 10 minutes or any
        database change.
      </p>
      ${this.scope?.tracking_enabled ? r`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : h}
      <label
        >JSON or SQLite export<input
          type="file"
          accept=".json,.sqlite,.sqlite3,.db"
          ?disabled=${e || !!this.scope?.tracking_enabled}
          @change=${(t) => {
      this.file = t.target.files?.[0], this.review = void 0, this.selected.clear(), this.error = this.notice = "", this.requestUpdate();
    }}
      /></label>
      ${this.file ? r`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : h}
      <div class="actions">
        <button
          ?disabled=${e || !this.file || !!this.scope?.tracking_enabled}
          @click=${this.previewData}
        >
          Review import
        </button>
      </div>
      ${this.renderReview(e)}
      ${this.pending ? r`<div class="warning">
              ${this.working ? "Importing…" : "The import result is unconfirmed. Retry the same selection and request to confirm it."}
              <div class="actions">
                <button ?disabled=${this.working} @click=${this.importData}>
                  Retry same import</button
                ><button
                  ?disabled=${this.working}
                  @click=${() => {
      window.confirm(
        "The import may already have committed. Discard its retry and inspect the database before importing again?"
      ) && (this.pending = void 0, this.review = void 0, this.file = void 0, this.selected.clear(), this.hideDialog(), this.busy(), this.dispatchEvent(
        new CustomEvent("database-changed", {
          bubbles: !0,
          composed: !0
        })
      ), this.requestUpdate());
    }}
                >
                  Discard import retry & inspect
                </button>
              </div>
            </div>` : h}`;
  }
  render() {
    const e = this.disabled || this.working || !!this.pending;
    return r`<div class="actions" aria-label="Import and export">
        <button
          data-transfer="import"
          ?disabled=${e}
          @click=${() => this.openDialog("import")}
        >
          Merge Import
        </button>
        <button
          data-transfer="export"
          ?disabled=${e}
          @click=${() => this.openDialog("export")}
        >
          Export
        </button>
      </div>
      ${!this.dialog && this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}
      ${!this.dialog && this.notice ? r`<p class="notice" role="status">${this.notice}</p>` : h}
      <dialog
        class="database-dialog"
        @click=${k}
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Merge Import"}
          </h2>
        </div>
        ${this.error && this.dialog ? r`<p class="error" role="alert">${this.error}</p>` : h}
        ${this.dialog === "export" ? r`<p>
                  Exports include private history and deleted records. SQLite
                  also includes catalog and source metadata. Store downloads
                  securely.
                </p>
                <div class="actions">
                  <button
                    ?disabled=${e}
                    @click=${() => this.exportData("json")}
                  >
                    Export JSON</button
                  ><button
                    ?disabled=${e}
                    @click=${() => this.exportData("sqlite")}
                  >
                    Export SQLite
                  </button>
                </div>` : this.dialog === "import" ? this.renderImport(e) : h}
        <div class="actions dialog-footer">
          <button
            ?disabled=${this.working || !!this.pending}
            @click=${this.closeDialog}
          >
            Cancel
          </button>
        </div>
      </dialog>`;
  }
};
se.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 },
  disabled: { type: Boolean }
}, se.styles = [
  S,
  L`
      .database-dialog {
        width: min(1100px, calc(100% - 32px));
      }
      table {
        table-layout: fixed;
      }
      th:first-child {
        width: 56px;
      }
      th:nth-child(2) {
        width: 30%;
      }
      th:nth-child(3) {
        width: 90px;
      }
      td:first-child {
        min-width: 0;
        max-width: none;
      }
      td {
        padding: 8px;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      th {
        padding: 8px;
      }
      td input[type="checkbox"] {
        width: auto;
      }
      details {
        margin-top: 4px;
      }
      .table-wrap {
        max-height: 55dvh;
        overflow: auto;
      }
      th {
        position: sticky;
        top: 0;
      }
    `
];
let $e = se;
customElements.get("kaleidescape-transfers") || customElements.define("kaleidescape-transfers", $e);
const he = {
  viewings: "Viewings",
  sessions: "Sessions",
  library_titles: "Library titles",
  library_collections: "Library collections",
  library_sources: "Library sources",
  library_artwork: "Library artwork",
  settings: "UI settings",
  library_memberships: "Library memberships",
  requests: "Write requests",
  schema_metadata: "Metadata",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  database_audit: "Database audit",
  library_collection_intents: "Collection add receipts"
}, de = [
  "viewings",
  "sessions",
  "library_titles",
  "library_collections",
  "library_sources",
  "library_artwork"
], ae = class ae extends y {
  constructor() {
    super(...arguments), this.bound = "", this.generation = 0, this.request = 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.showSystem = !1, this.sorts = {}, this.ready = !1, this.preferenceError = "", this.loading = !1, this.saving = !1, this.transferBusy = !1, this.error = "", this.notice = "", this.search = "", this.selected = /* @__PURE__ */ new Set(), this.operation = null, this.draft = {}, this.nulls = /* @__PURE__ */ new Set(), this.original = "", this.createDraft = N(), this.confirmed = !1, this.deleteWord = "";
  }
  willUpdate(e) {
    if (!e.has("client") && !e.has("scope")) return;
    const t = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}`;
    t === this.bound && this.client === this.boundClient || (this.clear(), this.bound = t, this.boundClient = this.client, this.client && this.scope?.permissions.edit && this.initialize());
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("client"), this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.clear(), this.boundClient = void 0, this.bound = "";
  }
  clear() {
    this.generation++, this.request++, this.preferences?.dispose(), this.preferences = void 0, this.ready = !1, this.page = void 0, this.table = "viewings", this.filters = { limit: 25, query: "", descending: !1 }, this.showSystem = !1, this.sorts = {}, this.detail = void 0, this.selected.clear(), this.pending = void 0, this.operation = null, this.draft = {}, this.original = "", this.search = "", this.confirmed = !1, this.deleteWord = "", this.loading = this.saving = this.transferBusy = !1, this.error = this.notice = this.preferenceError = "";
    for (const e of this.renderRoot.querySelectorAll("dialog"))
      e.close();
    this.busy(), this.requestUpdate();
  }
  async initialize() {
    const e = ++this.generation;
    this.preferences?.dispose(), this.preferences = new Ee(
      this.client,
      this.scope,
      !1,
      (t) => {
        e === this.generation && (t && u(t) === "unauthorized" ? this.fail(t) : (this.preferenceError = t ? v(t) : "", this.requestUpdate()));
      },
      "database"
    );
    try {
      const t = await this.preferences.load();
      if (e !== this.generation) return;
      this.filters.limit = t.limit, this.showSystem = t.show_system, this.sorts = t.sorts ?? {}, this.table = String(t.table ?? "viewings"), !this.showSystem && !de.includes(this.table) && (this.table = "viewings"), this.filters = { ...this.filters, ...this.sorts[this.table] }, this.ready = !0, await this.load();
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  updated() {
    for (const [e, t] of [
      ["database_limit", String(this.filters.limit)],
      ["database_sort", this.filters.sort ?? this.page?.columns[0] ?? ""]
    ]) {
      const i = this.renderRoot.querySelector(
        `[name="${e}"]`
      );
      i && i.value !== t && (i.value = t);
    }
  }
  get blocked() {
    return this.loading || this.saving || !!this.pending || this.transferBusy;
  }
  busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail: this.saving || !!this.pending || this.transferBusy,
        bubbles: !0,
        composed: !0
      })
    );
  }
  fail(e) {
    u(e) === "unauthorized" && (this.clear(), this.dispatchEvent(
      new CustomEvent("access-denied", { bubbles: !0, composed: !0 })
    ));
    const t = u(e), i = e?.message;
    this.error = ["query_syntax", "conflict", "invalid_request", "busy"].includes(t) && typeof i == "string" && i !== t ? i : v(e), this.requestUpdate();
  }
  async load(e = 0, t) {
    if (!this.client || !this.scope || !this.ready || this.pending) return;
    const i = this.generation, s = ++this.request;
    this.loading = !0, this.page?.table !== this.table && (this.page = void 0), this.error = "", this.detail = void 0, this.selected.clear(), this.requestUpdate();
    try {
      const a = await this.client.inspect(
        this.scope,
        this.table,
        e,
        t,
        this.filters
      );
      if (i !== this.generation || s !== this.request) return;
      this.page = a, this.filters.sort = a.sort;
    } catch (a) {
      i === this.generation && s === this.request && this.fail(a);
    } finally {
      i === this.generation && s === this.request && (this.loading = !1, this.requestUpdate());
    }
  }
  rowKey(e) {
    return Object.fromEntries(
      (this.page?.schema ?? []).filter((t) => t.primary).map((t) => [t.name, e[t.name]])
    );
  }
  rowSelection(e) {
    const t = this.page.items.indexOf(e);
    return {
      key: this.rowKey(e),
      token: this.page.row_tokens?.[t] ?? ""
    };
  }
  selectedRows() {
    return this.selected.size ? [...this.selected].map((e) => this.page.items[e]) : this.detail ? [this.detail] : [];
  }
  showDetail(e) {
    this.detail = e, this.requestUpdate();
  }
  async open(e) {
    this.requestUpdate(), await this.updateComplete, this.isConnected && this.renderRoot.querySelector(`#${e}`)?.showModal();
  }
  async edit() {
    if (!(this.blocked || !this.detail)) {
      this.operation = "edit", this.draft = {}, this.nulls.clear();
      for (const e of this.page?.schema ?? []) {
        if (!e.editable) continue;
        const t = this.detail[e.name];
        this.draft[e.name] = t === null ? "" : typeof t == "string" ? t : JSON.stringify(t), t === null && this.nulls.add(e.name);
      }
      this.original = JSON.stringify([this.draft, [...this.nulls]]), this.confirmed = !1, this.open("database-edit");
    }
  }
  newEntry() {
    this.blocked || this.table !== "viewings" || (this.operation = "new", this.createDraft = N(), this.original = JSON.stringify(this.createDraft), this.confirmed = !1, this.open("database-edit"));
  }
  deleteEntries() {
    this.blocked || !this.page?.deletable || !this.selectedRows().length || (this.operation = "delete", this.deleteWord = "", this.open("database-delete"));
  }
  discard() {
    return this.pending || this.saving ? !1 : (this.operation === "edit" ? JSON.stringify([this.draft, [...this.nulls]]) : this.operation === "new" ? JSON.stringify(this.createDraft) : this.original) === this.original || window.confirm("Discard unsaved database changes?");
  }
  confirmNavigation() {
    return !this.transferBusy && !this.saving && !this.pending && this.discard();
  }
  close(e) {
    if (e?.preventDefault(), !!this.discard()) {
      for (const t of ["database-edit", "database-delete"])
        this.renderRoot.querySelector(`#${t}`)?.close();
      this.operation = null, this.draft = {}, this.original = "", this.requestUpdate();
    }
  }
  async save(e) {
    if (e?.preventDefault(), !(!this.client || !this.scope || this.saving))
      try {
        if (!this.pending) {
          if (!this.operation || !this.page || this.operation === "delete" && this.deleteWord !== "DELETE" || this.operation !== "delete" && !this.confirmed) return;
          if (this.operation === "new")
            this.pending = this.client.prepare(this.scope, "create", {
              data: it(this.createDraft)
            });
          else {
            const i = {};
            if (this.operation === "edit") {
              for (const s of this.page.schema ?? []) {
                if (!s.editable) continue;
                let a = this.nulls.has(s.name) ? null : this.draft[s.name];
                if (a !== null && s.type === "number") {
                  if (!String(a).trim()) throw new Error("invalid");
                  if (a = Number(a), !Number.isFinite(a)) throw new Error("invalid");
                }
                a !== null && s.type === "json" && (a = JSON.parse(String(a)), a = JSON.stringify(a)), JSON.stringify(a) !== JSON.stringify(this.detail[s.name]) && (i[s.name] = a);
              }
              if (!Object.keys(i).length) {
                this.close();
                return;
              }
            }
            this.pending = this.client.prepareDatabaseMutation(this.scope, {
              table: this.table,
              operation: this.operation,
              rows: (this.operation === "edit" ? [this.detail] : this.selectedRows()).map((s) => this.rowSelection(s)),
              patch: i,
              expected_revision: this.page.dataset_revision ?? this.page.revision,
              confirmation: this.operation === "delete" ? "DELETE" : "SAVE"
            });
          }
        }
        const t = this.generation;
        this.saving = !0, this.error = "", this.busy(), this.requestUpdate();
        try {
          if (this.operation === "new" ? await this.client.mutate(this.pending) : await this.client.databaseMutation(this.pending), t !== this.generation) return;
          this.pending = void 0, this.saving = !1, this.operation = null, this.original = "", this.draft = {};
          for (const i of this.renderRoot.querySelectorAll(
            "#database-edit,#database-delete"
          ))
            i.close();
          this.notice = "Database change applied.", this.dispatchEvent(
            new CustomEvent("database-changed", {
              bubbles: !0,
              composed: !0
            })
          ), await this.load();
        } catch (i) {
          if (t !== this.generation) return;
          [
            "invalid_request",
            "conflict",
            "not_found",
            "unauthorized",
            "busy",
            "backup_in_progress",
            "library_storage_limit"
          ].includes(u(i)) && (this.pending = void 0), this.fail(i);
        } finally {
          t === this.generation && (this.saving = !1, this.busy(), this.requestUpdate());
        }
      } catch {
        this.error = "Check the edited values and JSON syntax before saving.", this.requestUpdate();
      }
  }
  changeTable(e) {
    this.blocked || !this.discard() || (this.table = e, this.filters = {
      limit: this.filters.limit,
      query: "",
      descending: !1,
      ...this.sorts[e]
    }, this.search = "", this.preferences?.set({ table: e }), this.load());
  }
  browse(e) {
    this.blocked || (this.filters = { ...this.filters, ...e }, e.limit !== void 0 && this.preferences?.set({ limit: e.limit }), (e.sort !== void 0 || e.descending !== void 0) && (this.sorts = {
      ...this.sorts,
      [this.table]: {
        sort: this.filters.sort ?? this.page?.columns[0] ?? "id",
        descending: this.filters.descending
      }
    }, this.preferences?.set({ sorts: this.sorts })), this.load());
  }
  retry() {
    return this.pending ? r`<div class="warning" role="alert">
          ${this.saving ? "Saving…" : "Result unconfirmed. Retry this exact request."}<button
            ?disabled=${this.saving}
            @click=${() => this.save()}
          >
            Retry same change</button
          ><button
            ?disabled=${this.saving}
            @click=${() => {
      if (window.confirm(
        "The change may have committed. Discard the retry and refresh to inspect the result?"
      )) {
        this.pending = void 0, this.original = "", this.operation = null, this.busy();
        for (const e of this.renderRoot.querySelectorAll("dialog"))
          e.close();
        this.load();
      }
    }}
          >
            Discard retry & reload
          </button>
        </div>` : h;
  }
  options() {
    return r`<dialog
      id="database-options"
      class="database-dialog"
      @click=${k}
    >
      <div class="card-head">
        <h2>Database options</h2>
        <button
          @click=${() => this.renderRoot.querySelector("#database-options")?.close()}
        >
          Done
        </button>
      </div>
      <p>View choices save automatically for your HA user.</p>
      <fieldset ?disabled=${this.blocked}>
        <label
          >Rows per page<select
            name="database_limit"
            .value=${String(this.filters.limit)}
            @change=${(e) => this.browse({ limit: Number(e.target.value) })}
          >
            ${[10, 25, 100, 500].map((e) => r`<option value=${e}>${e}</option>`)}
          </select></label
        ><label class="check"
          ><input
            name="show_system"
            type="checkbox"
            .checked=${this.showSystem}
            @change=${(e) => {
      this.showSystem = e.target.checked, this.preferences?.set({ show_system: this.showSystem }), !this.showSystem && !de.includes(this.table) && this.changeTable("viewings"), this.requestUpdate();
    }}
          />Show system tables</label
        ><label
          >Sort by<select
            name="database_sort"
            .value=${this.filters.sort ?? ""}
            @change=${(e) => this.browse({ sort: e.target.value })}
          >
            ${this.page?.columns.map((e) => r`<option value=${e}>${e}</option>`)}
          </select></label
        ><button
          aria-label="Reverse database sort"
          @click=${() => this.browse({ descending: !this.filters.descending })}
        >
          ${this.filters.descending ? "Descending ↓" : "Ascending ↑"}
        </button>
      </fieldset>
      <p class="muted">
        IDs, relationship keys, managed paths, audit history, dataset metadata
        and write receipts remain protected.
      </p>
    </dialog>`;
  }
  render() {
    if (!this.ready)
      return r`<p>${this.error || "Loading database preferences…"}</p>
        ${this.error ? r`<button @click=${() => this.initialize()}>Retry loading database</button>` : h}`;
    const e = Object.keys(this.page?.tables ?? he).filter(
      (i) => this.showSystem || de.includes(i)
    ), t = (this.page?.schema ?? []).some((i) => i.editable);
    return r`<section class="card database" aria-label="Database management">
      <div class="database-toolbar">
        <div class="actions">
          <button
            class="primary"
            ?disabled=${this.blocked || this.table !== "viewings"}
            @click=${this.newEntry}
          >
            New Entry</button
          ><button
            class="danger"
            ?disabled=${this.blocked || !this.page?.deletable || !this.selectedRows().length}
            @click=${this.deleteEntries}
          >
            Delete entry${this.selected.size ? ` (${this.selected.size})` : ""}</button
          ><button ?disabled=${this.blocked} @click=${() => this.load()}>
            Refresh database</button
          ><button
            ?disabled=${this.blocked}
            @click=${() => this.open("database-options")}
          >
            Options
          </button>
        </div>
        <kaleidescape-transfers
          .client=${this.client}
          .scope=${this.scope ? { ...this.scope, revision: this.page?.dataset_revision ?? this.scope.revision } : void 0}
          .disabled=${this.blocked || !!this.operation}
          @transfer-busy=${(i) => {
      this.transferBusy = i.detail, this.busy();
    }}
          @database-changed=${() => {
      this.pending || this.load();
    }}
        ></kaleidescape-transfers>
      </div>
      <div class="database-messages">
        ${this.error ? r`<p class="error" role="alert">${this.error}</p>` : h}${this.notice ? r`<p role="status">${this.notice}</p>` : h}${this.preferenceError ? r`<p class="warning">${this.preferenceError}<button @click=${() => this.preferences?.retry()}>Retry preferences</button></p>` : h}${this.retry()}
      </div>
      <div
        class="page-tabs table-tabs"
        role="tablist"
        aria-label="Database tables"
        @keydown=${(i) => {
      const s = e.indexOf(this.table), a = i.key === "ArrowRight" ? (s + 1) % e.length : i.key === "ArrowLeft" ? (s + e.length - 1) % e.length : i.key === "Home" ? 0 : i.key === "End" ? e.length - 1 : -1;
      a >= 0 && !this.blocked && (i.preventDefault(), this.changeTable(e[a]), this.updateComplete.then(
        () => this.renderRoot.querySelector(`#table-${this.table}`)?.focus()
      ));
    }}
      >
        ${e.map((i) => r`<button role="tab" id=${`table-${i}`} aria-selected=${this.table === i} tabindex=${this.table === i ? 0 : -1} ?disabled=${this.blocked} @click=${() => this.changeTable(i)}>${he[i] ?? i}${this.page ? ` (${this.page.tables[i]})` : ""}</button>`)}
      </div>
      <div class="database-filters filters">
        <kaleidescape-database-search
          .client=${this.client}
          .scope=${this.scope}
          .table=${this.table}
          .value=${this.search}
          .fields=${this.page?.query_fields ?? []}
          .operators=${this.page?.operators ?? []}
          .disabled=${this.blocked}
          @query-change=${(i) => {
      this.search = i.detail;
    }}
          @query-submit=${() => this.browse({ query: this.search })}
          @access-denied=${() => this.fail({ code: "unauthorized" })}
        ></kaleidescape-database-search
        ><button
          ?disabled=${this.blocked}
          @click=${() => this.browse({ query: this.search })}
        >
          Search
        </button>
      </div>
      <div class="database-layout">
        <section class="database-entries" aria-label="Database entries">
          <div class="card-head">
            <h2>${he[this.table] ?? this.table}</h2>
          </div>
          ${this.loading ? r`<p role="status">Loading database…</p>` : h}
          <ul class="entry-list">
            ${this.page?.items.map(
      (i, s) => r`<li class=${this.detail === i ? "selected" : ""}>
                  ${this.page?.deletable ? r`<input
                          type="checkbox"
                          aria-label=${`Select ${String(i.title ?? i.name ?? i.id ?? i.cache_key ?? i.owner ?? "row")}`}
                          .checked=${this.selected.has(s)}
                          ?disabled=${this.blocked || this.selected.size >= 100 && !this.selected.has(s)}
                          @change=${(a) => {
        a.target.checked ? this.selected.add(s) : this.selected.delete(s), this.requestUpdate();
      }}
                        />` : h}<button
                    class="link entry-name"
                    ?disabled=${this.blocked}
                    @click=${() => this.showDetail(i)}
                  >
                    ${String(i.title ?? i.name ?? i.id ?? i.cache_key ?? i.owner ?? i.request_id ?? "Dataset metadata")}
                  </button>
                </li>`
    )}
          </ul>
          ${this.page ? r`<div class="pagination database-pagination">
                  <small
                    >Rows
                    ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length}
                    of ${this.page.total} · ${this.selected.size} selected
                    (maximum 100)</small
                  >
                  <div class="actions">
                    <button
                      ?disabled=${this.blocked || !this.page.offset}
                      @click=${() => this.load()}
                    >
                      First</button
                    ><button
                      ?disabled=${this.blocked || !this.page.offset}
                      @click=${() => this.load(Math.max(0, this.page.offset - this.page.limit), this.page.revision)}
                    >
                      Previous</button
                    ><button
                      ?disabled=${this.blocked || !this.page.has_more}
                      @click=${() => this.load(this.page.offset + this.page.limit, this.page.revision)}
                    >
                      Next
                    </button>
                  </div>
                </div>` : h}
        </section>
        <section class="database-detail" aria-label="Selected database entry">
          <div class="card-head">
            <h2>Entry details</h2>
            ${this.detail ? r`<button ?disabled=${this.blocked || !t} @click=${this.edit}>Edit entry</button>` : h}
          </div>
          ${this.detail ? r`<pre>${JSON.stringify(this.detail, null, 2)}</pre>
                  ${t ? h : r`<p class="muted">This table protects system integrity; stored values are read-only.</p>`}` : r`<p class="empty">
                  Select an entry to inspect raw values.
                </p>`}
        </section>
      </div>
      ${this.options()}
      <dialog
        id="database-edit"
        class="database-dialog"
        @click=${k}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.operation === "new" ? "New viewing" : "Edit database entry"}
          </h2>
        </div>
        <p class="warning">
          Only supported fields can change. Source metadata may be restored by a
          later sync. Open playback sessions and their viewings are protected
          until closed. Session corrections do not recalculate viewing
          summaries.
        </p>
        ${this.error ? r`<p class="error">${this.error}</p>` : h}${this.retry()}
        <form @submit=${this.save}>
          <fieldset ?disabled=${this.saving || !!this.pending}>
            ${this.operation === "new" ? st(this.createDraft, (i, s) => {
      this.createDraft = {
        ...this.createDraft,
        [i]: s.target.value
      }, this.requestUpdate();
    }) : (this.page?.schema ?? []).filter((i) => i.editable).map(
      (i) => r`<div class="database-edit-field">
                          <label
                            >${i.name}${i.type === "json" || i.name === "notes" ? r`<textarea
                                    name=${i.name}
                                    .value=${this.draft[i.name] ?? ""}
                                    ?disabled=${this.nulls.has(i.name)}
                                    @input=${(s) => {
        this.draft = {
          ...this.draft,
          [i.name]: s.target.value
        };
      }}
                                  ></textarea>` : r`<input
                                    name=${i.name}
                                    type=${i.type === "number" ? "number" : "text"}
                                    step="any"
                                    .value=${this.draft[i.name] ?? ""}
                                    ?disabled=${this.nulls.has(i.name)}
                                    @input=${(s) => {
        this.draft = {
          ...this.draft,
          [i.name]: s.target.value
        };
      }}
                                  />`}</label
                          >${i.nullable ? r`<label class="check"
                                  ><input
                                    type="checkbox"
                                    aria-label=${`Set ${i.name} to NULL`}
                                    .checked=${this.nulls.has(i.name)}
                                    @change=${(s) => {
        s.target.checked ? this.nulls.add(i.name) : this.nulls.delete(i.name), this.requestUpdate();
      }}
                                  />NULL</label
                                >` : h}
                        </div>`
    )}<label class="check"
              ><input
                name="confirm_edit"
                type="checkbox"
                .checked=${this.confirmed}
                @change=${(i) => {
      this.confirmed = i.target.checked, this.requestUpdate();
    }}
              />I reviewed these changes and confirm saving.</label
            ><button type="submit" class="primary" ?disabled=${!this.confirmed}>
              Save changes
            </button>
          </fieldset>
          <button
            type="button"
            ?disabled=${this.saving || !!this.pending}
            @click=${this.close}
          >
            Cancel edit
          </button>
        </form>
      </dialog>
      <dialog
        id="database-delete"
        class="database-dialog"
        @click=${k}
        @cancel=${this.close}
      >
        <h2>Permanently delete ${this.selectedRows().length} entries?</h2>
        <p>
          Database deletion is permanent. Associated memberships/session
          references may also be removed, and artwork references cleared. Source
          sync may recreate cached library records. Existing exports and backups
          remain.
        </p>
        ${this.error ? r`<p class="error">${this.error}</p>` : h}${this.retry()}<label
          >Type DELETE to confirm<input
            name="delete_confirmation"
            .value=${this.deleteWord}
            ?disabled=${!!this.pending || this.saving}
            @input=${(i) => {
      this.deleteWord = i.target.value, this.requestUpdate();
    }} /></label
        ><button
          class="danger"
          ?disabled=${this.deleteWord !== "DELETE" || this.saving || !!this.pending}
          @click=${() => this.save()}
        >
          Confirm delete</button
        ><button
          ?disabled=${this.saving || !!this.pending}
          @click=${this.close}
        >
          Cancel delete
        </button>
      </dialog>
    </section>`;
  }
};
ae.properties = {
  client: { attribute: !1 },
  scope: { attribute: !1 }
}, ae.styles = [S, Kt];
let we = ae;
customElements.get("kaleidescape-database") || customElements.define("kaleidescape-database", we);
const ce = [
  {
    id: "now-playing",
    label: "Now Playing",
    description: "Live playback and recording context."
  },
  {
    id: "library",
    label: "Library",
    description: "Browse cached titles, collections, and source metadata."
  },
  {
    id: "journal",
    label: "Journal",
    description: "Review recordings and make corrections."
  },
  {
    id: "database",
    label: "Database",
    description: "Inspect entries and manage stored history."
  },
  {
    id: "settings",
    label: "Settings",
    description: "Configure playback recording and journal rules."
  }
], re = class re extends y {
  constructor() {
    super(...arguments), this.narrow = !1, this.api = null, this.generation = 0, this.listRequest = 0, this.detailRequest = 0, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.nextCursor = null, this.history = [], this.page = 1, this.loading = !1, this.detailLoading = !1, this.saving = !1, this.pending = null, this.confirmDelete = !1, this.error = "", this.lastError = "", this.notice = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = !1, this.maintenanceBusy = !1;
  }
  willUpdate(e) {
    if (!(!e.has("hass") && !e.has("client")))
      if (this.hass) {
        if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
          this.bind(null);
          return;
        }
        (this.haConnection !== this.hass.connection || this.haUser !== this.hass.user.id) && (this.haConnection = this.hass.connection, this.haUser = this.hass.user.id, this.haClient = new tt({
          callWS: (t) => this.hass.callWS(t),
          fetchWithAuth: (t, i) => this.hass.fetchWithAuth(t, i)
        })), this.bind(this.haClient);
      } else
        this.bind(this.client ?? null);
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate("hass"), this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.bind(null);
  }
  clearPrivate() {
    this.generation++, this.info = null, this.rows = [], this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.pending = null, this.history = [], this.nextCursor = null, this.cursor = void 0, this.page = 1, this.query = "", this.status = "", this.searchText = "", this.filterStatus = "", this.confirmDelete = !1, this.saving = !1, this.loading = !1, this.detailLoading = !1, this.sessionError = "", this.notice = "", this.activePage = "journal", this.navigationReady = !1, this.settingsBusy = this.maintenanceBusy = !1;
  }
  bind(e) {
    this.api !== e && (this.clearPrivate(), this.api = e, this.error = "", this.requestUpdate(), e && this.refresh());
  }
  fail(e) {
    u(e) === "unauthorized" && this.clearPrivate(), this.lastError = u(e), this.error = v(e), this.requestUpdate();
  }
  dirty() {
    return this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.initial);
  }
  discard() {
    return (!this.dirty() || window.confirm("Discard your unsaved changes?")) && (this.activePage !== "library" || (this.renderRoot.querySelector("kaleidescape-library")?.confirmNavigation() ?? !0)) && (this.activePage !== "database" || (this.renderRoot.querySelector("kaleidescape-database")?.confirmNavigation() ?? !0)) && (this.activePage !== "settings" || (this.renderRoot.querySelector("kaleidescape-settings")?.confirmNavigation() ?? !0));
  }
  async switchPage(e) {
    e === "library" && !this.info?.library_enabled || e === this.activePage || this.loading || this.saving || this.pending || this.maintenanceBusy || this.settingsBusy || !this.discard() || (this.closeEditor(), this.activePage = e, j(e), this.error = this.notice = "", this.requestUpdate(), e === "journal" && (this.page = 1, this.history = [], await this.loadList()));
  }
  pageKey(e) {
    const t = ce.filter(
      (o) => o.id !== "library" || this.info?.library_enabled
    ), i = t.findIndex((o) => o.id === this.activePage), s = e.key === "ArrowRight" ? (i + 1) % t.length : e.key === "ArrowLeft" ? (i + t.length - 1) % t.length : e.key === "Home" ? 0 : e.key === "End" ? t.length - 1 : -1;
    if (s < 0) return;
    e.preventDefault(), this.switchPage(t[s].id).then(() => this.updateComplete).then(
      () => this.renderRoot.querySelector(`#page-${this.activePage}`)?.focus()
    );
  }
  async refresh(e = !1) {
    if (!this.api || this.pending || !this.discard()) return;
    const t = this.api, i = ++this.generation;
    this.info = null, this.rows = [], this.closeEditor(), this.loading = !0, this.error = "", this.requestUpdate();
    try {
      let { entries: s } = await t.info();
      for (let a = 0; e && !s.length && a < 20; a++) {
        if (await new Promise((o) => setTimeout(o, 500)), i !== this.generation) return;
        ({ entries: s } = await t.info());
      }
      if (i !== this.generation) return;
      if (!s.length) throw new p("not_ready");
      if (s[0].api_version !== 1) throw new p("not_ready");
      if (this.info = s[0], !this.info.permissions.edit) return;
      this.navigationReady || (this.activePage = at(
        this.info.ui_defaults?.default_landing_page,
        !0,
        !!this.info.library_enabled
      ), this.navigationReady = !0, j(this.activePage)), this.activePage === "library" && !this.info.library_enabled && (this.activePage = "journal", j(this.activePage)), this.history = [], this.cursor = void 0, this.page = 1, await this.loadList();
    } catch (s) {
      i === this.generation && this.fail(s);
    } finally {
      i === this.generation && (this.loading = !1, this.requestUpdate());
    }
  }
  async loadList(e) {
    if (!this.api || !this.info) return;
    const t = this.api, i = this.info, s = this.generation, a = ++this.listRequest;
    this.loading = !0, this.error = "", this.requestUpdate();
    try {
      const o = await t.list(i, this.query, this.status, e);
      if (s !== this.generation || a !== this.listRequest)
        return;
      this.rows = o.items, this.cursor = e, this.nextCursor = o.next_cursor, this.info = { ...this.info, revision: o.revision };
    } catch (o) {
      s === this.generation && a === this.listRequest && (this.rows = [], this.nextCursor = null, this.fail(o));
    } finally {
      s === this.generation && a === this.listRequest && (this.loading = !1, this.requestUpdate());
    }
  }
  async selectRecord(e) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor();
    const t = this.api, i = this.info, s = this.generation, a = ++this.detailRequest;
    this.detailLoading = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const o = await t.get(i, e);
      if (s !== this.generation || a !== this.detailRequest)
        return;
      this.selected = o, this.draft = N(o), this.initial = { ...this.draft }, this.detailLoading = !1, this.requestUpdate();
      try {
        const l = await t.sessions(i, e);
        s === this.generation && a === this.detailRequest && (this.sessions = l);
      } catch (l) {
        s === this.generation && a === this.detailRequest && (u(l) === "unauthorized" ? this.fail(l) : this.sessionError = "Session details could not be loaded.");
      }
    } catch (o) {
      s === this.generation && a === this.detailRequest && this.fail(o);
    } finally {
      s === this.generation && a === this.detailRequest && (this.detailLoading = !1, this.requestUpdate());
    }
  }
  closeEditor() {
    this.detailRequest++, this.selected = null, this.draft = null, this.initial = null, this.sessions = null, this.sessionError = "", this.confirmDelete = !1, this.detailLoading = !1;
  }
  newRecord() {
    this.pending || !this.discard() || (this.closeEditor(), this.draft = N(), this.initial = { ...this.draft }, this.error = "", this.notice = "", this.requestUpdate(), this.updateComplete.then(
      () => this.renderRoot.querySelector("#title")?.focus()
    ));
  }
  input(e, t) {
    this.draft && (this.draft = {
      ...this.draft,
      [e]: t.target.value
    }, this.requestUpdate());
  }
  async save(e) {
    if (e.preventDefault(), !(!this.api || !this.info || !this.draft || this.pending || this.saving || !e.target.reportValidity()))
      try {
        const i = it(
          this.draft,
          this.selected ? this.initial : void 0
        );
        if (this.selected && !Object.keys(i).length) {
          this.notice = "There are no changes to save.", this.requestUpdate();
          return;
        }
        if (i.ended_at && i.started_at && i.ended_at < i.started_at) {
          this.error = "The end time must be after the start time.", this.requestUpdate();
          return;
        }
        this.pending = this.api.prepare(
          this.info,
          this.selected ? "update" : "create",
          this.selected ? {
            viewing_id: this.selected.id,
            expected_revision: this.selected.revision,
            patch: i
          } : { data: i }
        ), await this.commit();
      } catch (i) {
        u(i) === "request_id_unavailable" ? this.fail(i) : (this.error = "Check the dates and numeric fields before saving.", this.requestUpdate());
      }
  }
  async deleteRecord() {
    if (!(!this.api || !this.info || !this.selected || this.pending))
      try {
        this.pending = this.api.prepare(this.info, "delete", {
          viewing_id: this.selected.id,
          expected_revision: this.selected.revision
        }), this.confirmDelete = !1, await this.commit();
      } catch (e) {
        this.fail(e);
      }
  }
  async commit() {
    if (!this.api || !this.pending || this.saving) return;
    const e = this.api, t = this.pending, i = this.generation;
    this.saving = !0, this.error = "", this.notice = "", this.requestUpdate();
    try {
      const s = await e.mutate(t);
      if (i !== this.generation) return;
      this.pending = null, this.closeEditor(), this.notice = s.viewing.deleted_at ? "Entry removed from the journal. Stored history is retained." : "Entry saved.", s.viewing.deleted_at || (this.selected = s.viewing, this.draft = N(s.viewing), this.initial = { ...this.draft }), this.page = 1, this.history = [], await this.loadList();
      try {
        const { entries: a } = await e.info();
        i === this.generation && a[0]?.dataset_id === this.info?.dataset_id && (this.info = a[0]);
      } catch (a) {
        i === this.generation && this.fail(a);
      }
    } catch (s) {
      if (i !== this.generation) return;
      ["invalid_request", "conflict", "unauthorized"].includes(
        u(s)
      ) && (this.pending = null), this.fail(s);
    } finally {
      i === this.generation && (this.saving = !1, this.requestUpdate());
    }
  }
  async inspectJournal() {
    this.saving || !this.pending || window.confirm(
      "This change may already have committed. Discard its retry and inspect the journal before adding it again?"
    ) && (this.pending = null, this.closeEditor(), this.notice = "Retry discarded. Check the journal before recreating the change.", await this.refresh());
  }
  date(e) {
    return new Date(e).toLocaleString(void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }
  bytes(e) {
    return `${(e / 1024 / 1024).toFixed(e < 1024 * 1024 ? 2 : 1)} MiB`;
  }
  async refreshInfo() {
    if (!this.api) return;
    const e = this.generation;
    try {
      const { entries: t } = await this.api.info();
      e === this.generation && t[0]?.dataset_id === this.info?.dataset_id && (this.info = t[0], this.requestUpdate());
    } catch (t) {
      e === this.generation && this.fail(t);
    }
  }
  renderEditor() {
    return this.detailLoading ? r`<div class="empty" role="status">Loading entry…</div>` : this.draft ? r`<form class="editor" @submit=${this.save}>
      <fieldset ?disabled=${this.saving || !!this.pending}>
        ${st(this.draft, (e, t) => this.input(e, t))}
        ${this.selected?.origin === "observed" ? r`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : h}
        <div class="actions">
          <button type="submit" class="primary">
            ${this.saving ? "Saving…" : this.selected ? "Save changes" : "Add entry"}
          </button>
          <button
            type="button"
            @click=${() => {
      this.discard() && (this.closeEditor(), this.requestUpdate());
    }}
          >
            Cancel
          </button>
          ${this.selected ? r`<span class="grow"></span
                  ><button
                    type="button"
                    class="danger"
                    @click=${() => {
      this.confirmDelete = !0, this.requestUpdate();
    }}
                  >
                    Delete entry
                  </button>` : h}
        </div>
      </fieldset>
      ${this.confirmDelete ? r`<div class="warning">
              <strong>Remove this entry from the journal?</strong>
              <p>
                Stored history and backup copies are retained. This does not
                permanently erase the data.
              </p>
              <div class="actions">
                <button
                  type="button"
                  class="danger"
                  @click=${this.deleteRecord}
                >
                  Confirm deletion</button
                ><button
                  type="button"
                  @click=${() => {
      this.confirmDelete = !1, this.requestUpdate();
    }}
                >
                  Keep entry
                </button>
              </div>
            </div>` : h}
      ${this.selected ? r`<details>
              <summary>Record details & sessions</summary>
              <div class="metadata">
                Record ${this.selected.id}<br />Origin: ${this.selected.origin}
                · Revision ${this.selected.revision}<br />Updated
                ${this.date(this.selected.updated_at)}<br />Completion:
                ${this.selected.completion_reason ?? "Not completed"}
              </div>
              ${this.sessionError ? r`<p>${this.sessionError}</p>` : this.sessions ? this.sessions.items.length ? r` ${this.sessions.items.map((e) => r`<div class="session">${this.date(e.started_at)}<br />${(e.watched_seconds / 60).toFixed(2)} min watched · ${e.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${e.gap_count} timing gaps<br />${e.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? r`<small>Showing the latest 100 sessions.</small>` : h}` : r`<p class="muted">
                          No recorded sessions for this entry.
                        </p>` : r`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`}
            </details>` : h}
    </form>` : r`<div class="empty">
        <strong>Select an entry</strong>
        <p>Review its details, make corrections, or add a manual viewing.</p>
      </div>`;
  }
  render() {
    if (this.hass?.user && !this.hass.user.is_admin || this.info && !this.info.permissions.edit)
      return r`<kaleidescape-reader
        .hass=${this.hass}
        .client=${this.hass ? void 0 : this.client}
        .narrow=${this.narrow}
      ></kaleidescape-reader>`;
    const e = this.loading || this.saving || !!this.pending || this.maintenanceBusy || this.settingsBusy;
    return r`<main>
      <header>
        ${this.hass && this.narrow ? r`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>☰</button>` : h}
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${ce.find((t) => t.id === this.activePage).description}
          </p>
        </div>
      </header>
      ${this.info?.permissions.edit ? r`<div
              class="page-tabs"
              role="tablist"
              aria-label="Companion pages"
              @keydown=${(t) => this.pageKey(t)}
            >
              ${ce.map((t) => r`<button id=${`page-${t.id}`} role="tab" aria-selected=${this.activePage === t.id} aria-controls="companion-page" tabindex=${this.activePage === t.id ? "0" : "-1"} ?disabled=${e || t.id === "library" && !this.info?.library_enabled} title=${t.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : h} @click=${() => this.switchPage(t.id)}>${t.label}</button>`)}
            </div>` : h}
      ${this.error ? r`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? r` <button ?disabled=${e} @click=${() => this.selectRecord(this.selected.id)}>Reload entry</button>` : h}</div>` : h}
      ${this.notice ? r`<div class="notice" role="status">${this.notice}</div>` : h}
      ${this.pending && !this.saving ? r`<div class="warning">
              Retry the same change to confirm its result. The form is locked to
              prevent duplicate writes.
              <div class="actions">
                <button @click=${this.commit}>Retry same change</button>
                <button @click=${this.inspectJournal}>
                  Discard retry & inspect journal
                </button>
              </div>
            </div>` : h}
      ${this.api ? this.info ? r`<section
                id="companion-page"
                role="tabpanel"
                aria-labelledby=${`page-${this.activePage}`}
              >
                ${this.activePage === "library" ? r`<kaleidescape-library
                        .client=${this.api}
                        .scope=${this.info}
                        @access-denied=${() => this.fail(new p("unauthorized"))}
                        @library-disabled=${() => {
      this.activePage = "journal", this.refresh();
    }}
                      ></kaleidescape-library>` : this.activePage === "database" ? r`<kaleidescape-database
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new p("unauthorized"))}
                          @maintenance-busy=${(t) => {
      this.maintenanceBusy = t.detail, this.requestUpdate();
    }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-database>` : this.activePage === "settings" ? r`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new p("unauthorized"))}
                            @settings-busy=${(t) => {
      this.settingsBusy = t.detail, this.requestUpdate();
    }}
                            @settings-saved=${() => {
      this.notice = "Settings saved. Reloading the integration…";
      const t = this.api;
      this.refresh(!0).then(() => {
        this.api === t && this.info && (this.notice = "Settings saved.", this.requestUpdate());
      });
    }}
                          ></kaleidescape-settings>` : this.activePage === "now-playing" ? r`<kaleidescape-now-playing
                              .client=${this.api}
                              .scope=${this.info}
                            ></kaleidescape-now-playing>` : r`<div class="section-head">
                                <h2>Journal</h2>
                                <button
                                  class="primary"
                                  ?disabled=${e}
                                  @click=${() => this.newRecord()}
                                >
                                  ＋ Add viewing
                                </button>
                              </div>
                              <section
                                class="metrics"
                                aria-label="Database overview"
                              >
                                <div class="metric">
                                  <small>Journal entries</small
                                  ><strong>${this.info.viewing_count}</strong>
                                </div>
                                <div class="metric">
                                  <small>Database size</small
                                  ><strong
                                    >${this.bytes(this.info.database_bytes ?? 0)}</strong
                                  ><small
                                    >of
                                    ${this.bytes(this.info.database_limit_bytes ?? 0)}</small
                                  >
                                </div>
                                <div class="metric">
                                  <small>Recording</small
                                  ><strong
                                    >${this.info.tracking_enabled ? "Enabled" : "Manual only"}</strong
                                  >
                                </div>
                                <div class="metric">
                                  <small>Storage</small
                                  ><strong
                                    >${this.info.backup_in_progress ? "Backing up" : "Ready"}</strong
                                  ><small
                                    >Schema ${this.info.schema_version} ·
                                    Revision ${this.info.revision}</small
                                  >
                                </div>
                              </section>
                              <div class="layout">
                                <section
                                  class="card"
                                  aria-label="Journal entries"
                                >
                                  <div class="card-head">
                                    <h2>Viewings</h2>
                                    <button
                                      ?disabled=${e}
                                      @click=${() => this.refresh()}
                                    >
                                      Refresh
                                    </button>
                                  </div>
                                  <form
                                    class="filters"
                                    @submit=${(t) => {
      t.preventDefault(), this.query = this.searchText, this.status = this.filterStatus, this.page = 1, this.history = [], this.loadList();
    }}
                                  >
                                    <label
                                      >Search titles<input
                                        name="search"
                                        type="search"
                                        maxlength="500"
                                        .value=${this.searchText}
                                        ?disabled=${e}
                                        @input=${(t) => {
      this.searchText = t.target.value;
    }}
                                    /></label>
                                    <label
                                      >Status<select
                                        name="filter_status"
                                        .value=${this.filterStatus}
                                        ?disabled=${e}
                                        @change=${(t) => {
      this.filterStatus = t.target.value;
    }}
                                      >
                                        <option value="">All</option>
                                        <option value="partial">Partial</option>
                                        <option value="completed">
                                          Completed
                                        </option>
                                      </select></label
                                    >
                                    <button ?disabled=${e}>Search</button>
                                  </form>
                                  ${this.loading ? r`<div class="empty" role="status">
                                          Loading viewings…
                                        </div>` : this.rows.length ? r`<div class="table-wrap">
                                            <table>
                                              <thead>
                                                <tr>
                                                  <th>Title</th>
                                                  <th>Status</th>
                                                  <th>Watched</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                ${this.rows.map(
      (t) => r` <tr
                                                      class=${this.selected?.id === t.id ? "selected" : ""}
                                                    >
                                                      <td>
                                                        <button
                                                          class="link"
                                                          ?disabled=${this.saving || !!this.pending}
                                                          @click=${() => this.selectRecord(t.id)}
                                                        >
                                                          ${t.title}</button
                                                        ><small
                                                          >${this.date(t.started_at)}
                                                          ·
                                                          ${t.origin === "observed" ? "Recorded" : "Manual"}</small
                                                        >
                                                      </td>
                                                      <td>
                                                        <span
                                                          class=${`badge ${t.status === "completed" ? "complete" : ""}`}
                                                          >${t.status === "completed" ? "Completed" : "Partial"}</span
                                                        >
                                                      </td>
                                                      <td>
                                                        ${(t.watched_seconds / 60).toFixed(2)}
                                                        min
                                                      </td>
                                                    </tr>`
    )}
                                              </tbody>
                                            </table>
                                          </div>` : r`<div class="empty">
                                            <strong
                                              >${this.query || this.status ? "No matching viewings" : "Your journal is empty"}</strong
                                            >
                                            <p>
                                              ${this.query || this.status ? "Try another title or status." : "Add a manual viewing or enable automatic tracking in the integration settings."}
                                            </p>
                                          </div>`}
                                  <div class="pagination">
                                    <small
                                      >Page ${this.page} · Up to 25
                                      entries</small
                                    >
                                    <div class="actions">
                                      <button
                                        ?disabled=${e || this.page === 1}
                                        @click=${() => {
      this.page = 1, this.history = [], this.loadList();
    }}
                                      >
                                        First
                                      </button>
                                      <button
                                        ?disabled=${e || !this.history.length}
                                        @click=${() => {
      this.page--, this.loadList(
        this.history.pop()
      );
    }}
                                      >
                                        Previous
                                      </button>
                                      <button
                                        ?disabled=${e || !this.nextCursor}
                                        @click=${() => {
      this.history.push(this.cursor), this.history.length > 200 && this.history.shift(), this.page++, this.loadList(this.nextCursor);
    }}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                </section>
                                <section
                                  class="card"
                                  aria-label="Viewing editor"
                                >
                                  <div class="card-head">
                                    <h2>
                                      ${this.selected ? "Edit viewing" : this.draft ? "New viewing" : "Viewing details"}
                                    </h2>
                                    ${this.dirty() ? r`<span class="badge">Unsaved</span>` : h}
                                  </div>
                                  ${this.renderEditor()}
                                </section>
                              </div> `}
              </section>` : r`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${this.loading ? h : r`<button @click=${() => this.refresh()}>Reload connection</button>`}
              </div>` : r`<div class="empty">
              <strong>Connect through Home Assistant</strong>
              <p>
                Open Kaleidescape Companion in HA with an administrator account,
                or connect the local development preview.
              </p>
            </div>`}
    </main>`;
  }
};
re.properties = {
  hass: { attribute: !1 },
  client: { attribute: !1 },
  narrow: { type: Boolean }
}, re.styles = S;
let xe = re;
customElements.get("kaleidescape-panel") || customElements.define("kaleidescape-panel", xe);
export {
  xe as KaleidescapePanel
};
